/** Server-only local sandbox clients. Never import this module into client components.
 * This is a REST integration proof, not an enterprise identity or LMS deployment.
 */
import { z } from 'zod';
import type { Employee } from './types';

export type MoodleSource = 'moodle-a' | 'moodle-b';
export interface SandboxCourse {
  id: `${MoodleSource}:${number}`;
  source: MoodleSource;
  nativeCourseId: number;
  title: string;
  shortname: string;
}
export interface SandboxCompletion {
  source: MoodleSource;
  courseId: `${MoodleSource}:${number}`;
  nativeCourseId: number;
  userId: number;
  completed: boolean;
  completedAt: string | null;
}
export interface HrChange { id: string; employee?: Employee; active: boolean }
export interface HrDelta { changes: HrChange[]; nextCursor: string }

const positiveId = z.number().int().positive().max(2_147_483_647);
const cursorSchema = z.string().regex(/^(0|[1-9]\d{0,11})$/);
const bilingual = z.object({ th: z.string().min(1).max(300), en: z.string().min(1).max(300) });
const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const employeeSchema = z.object({
  id: z.string().regex(/^E\d{4,8}$/), name: bilingual,
  bu: z.enum(['BM', 'CH', 'PK', 'RD', 'CS']), roleId: z.string().min(1).max(100),
  nextRoleId: z.string().min(1).max(100).nullable(), managerId: z.string().regex(/^E\d{4,8}$/).nullable(),
  site: bilingual, lang: z.enum(['th', 'en']), frontline: z.boolean(),
  scores: z.record(z.string().min(1).max(100), z.object({ self: level, manager: level.optional(), quiz: level.optional(), final: level })),
});
const deltaSchema = z.object({
  changes: z.array(z.object({ id: z.string().regex(/^E\d{4,8}$/), employee: employeeSchema.optional(), active: z.boolean() })
    .refine(c => (!c.active || !!c.employee) && (!c.employee || c.employee.id === c.id), 'Invalid HR identity')).max(100),
  nextCursor: cursorSchema,
});
const noWarnings = z.array(z.unknown()).max(0).default([]);
const coursesSchema = z.object({ courses: z.array(z.object({
  id: positiveId, fullname: z.string().min(1).max(1000), shortname: z.string().min(1).max(255),
  categoryid: positiveId, visible: z.union([z.literal(0), z.literal(1)]).optional(),
})).max(1000), warnings: noWarnings });
const enrolmentsSchema = z.array(z.object({ id: positiveId })).max(5000);
const completionSchema = z.object({ completionstatus: z.object({
  completed: z.boolean(), completions: z.array(z.object({ timecompleted: z.number().int().nonnegative().max(253_402_300_799).nullable() })).max(1000),
}), warnings: noWarnings });

function localOrigin(baseUrl: string, port: number): string {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('Sandbox origin is invalid'); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== String(port) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Sandbox origin is not an approved local endpoint');
  }
  return url.origin;
}
function credential(token: string): string {
  if (!token || token.length > 512 || /[\r\n\s]/.test(token)) throw new Error('Sandbox credential is missing or invalid');
  return token;
}

const MAX_RESPONSE_BYTES = 1_048_576;
async function readJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('Sandbox response exceeds limit');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Sandbox response is empty');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Sandbox response exceeds limit'); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { throw new Error('Sandbox response is invalid JSON'); }
}

async function requestJson(fetcher: typeof fetch, url: string, options: RequestInit, idempotent: boolean): Promise<unknown> {
  const attempts = idempotent ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // This signal covers both response headers and the bounded response stream.
    const signal = AbortSignal.timeout(5_000);
    let response: Response;
    // workerd rejects redirect:error. Manual returns 3xx for the non-OK guard below; credentials never follow Location.
    try { response = await fetcher(url, { ...options, signal, redirect: 'manual' }); }
    catch {
      if (attempt + 1 < attempts) { await new Promise(resolve => setTimeout(resolve, 50)); continue; }
      throw new Error('Sandbox upstream unavailable');
    }
    if (!response.ok) {
      await response.body?.cancel();
      if ((response.status === 408 || response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 50)); continue;
      }
      throw new Error(`Sandbox upstream rejected request (${response.status})`);
    }
    try { return await readJson(response); }
    catch { throw new Error('Sandbox upstream returned an invalid response'); }
  }
  throw new Error('Sandbox upstream unavailable');
}
function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new Error('Sandbox upstream response failed validation');
  return result.data;
}

export class MoodleConnector {
  readonly source: MoodleSource;
  private readonly origin: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  constructor(options: { baseUrl: string; token: string; source: MoodleSource; fetch?: typeof fetch }) {
    this.source = z.enum(['moodle-a', 'moodle-b']).parse(options.source);
    this.origin = localOrigin(options.baseUrl, this.source === 'moodle-a' ? 8081 : 8082);
    this.token = credential(options.token);
    this.fetcher = options.fetch ?? fetch;
  }
  private async call(functionName: string, args: Record<string, string>, idempotent: boolean): Promise<unknown> {
    const body = new URLSearchParams({ wstoken: this.token, moodlewsrestformat: 'json', wsfunction: functionName, ...args });
    // Moodle tokens are in the POST body only; no URL credentials, upstream error text or payloads are logged.
    const result = await requestJson(this.fetcher, `${this.origin}/webservice/rest/server.php`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body,
    }, idempotent);
    if (result && typeof result === 'object' && ('exception' in result || 'errorcode' in result)) {
      throw new Error('Moodle rejected the sandbox operation');
    }
    return result;
  }
  async catalogue(categoryId: number): Promise<SandboxCourse[]> {
    positiveId.parse(categoryId);
    const result = parse(coursesSchema, await this.call('core_course_get_courses_by_field', { field: 'category', value: String(categoryId) }, true));
    return result.courses.filter(course => course.categoryid === categoryId && course.visible !== 0).map(course => ({
      id: `${this.source}:${course.id}`, source: this.source, nativeCourseId: course.id, title: course.fullname, shortname: course.shortname,
    }));
  }
  async enrol(userId: number, courseId: number, roleId: number): Promise<{ enrolled: true; alreadyEnrolled: boolean }> {
    positiveId.parse(userId); positiveId.parse(courseId); positiveId.parse(roleId);
    const current = parse(enrolmentsSchema, await this.call('core_enrol_get_users_courses', { userid: String(userId) }, true));
    if (current.some(course => course.id === courseId)) return { enrolled: true, alreadyEnrolled: true };
    const result = await this.call('enrol_manual_enrol_users', {
      'enrolments[0][roleid]': String(roleId), 'enrolments[0][userid]': String(userId), 'enrolments[0][courseid]': String(courseId),
    }, false);
    if (result !== null) throw new Error('Moodle enrolment response failed validation');
    const after = parse(enrolmentsSchema, await this.call('core_enrol_get_users_courses', { userid: String(userId) }, true));
    if (!after.some(course => course.id === courseId)) throw new Error('Moodle enrolment was not confirmed');
    return { enrolled: true, alreadyEnrolled: false };
  }
  async completion(userId: number, courseId: number): Promise<SandboxCompletion> {
    positiveId.parse(userId); positiveId.parse(courseId);
    const result = parse(completionSchema, await this.call('core_completion_get_course_completion_status', { userid: String(userId), courseid: String(courseId) }, true));
    const completed = result.completionstatus.completed;
    const latest = Math.max(0, ...result.completionstatus.completions.map(row => row.timecompleted ?? 0));
    return { source: this.source, courseId: `${this.source}:${courseId}`, nativeCourseId: courseId, userId, completed,
      completedAt: completed && latest ? new Date(latest * 1000).toISOString() : null };
  }
}

export async function fetchHrDelta(baseUrl: string, token: string, cursor: string, fetcher: typeof fetch = fetch): Promise<HrDelta> {
  const origin = localOrigin(baseUrl, 8083);
  credential(token); cursorSchema.parse(cursor);
  const result = parse(deltaSchema, await requestJson(fetcher, `${origin}/delta?cursor=${encodeURIComponent(cursor)}`, {
    method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  }, true));
  if (Number(result.nextCursor) !== Number(cursor) + result.changes.length) {
    throw new Error('HR cursor did not advance safely');
  }
  return result;
}
