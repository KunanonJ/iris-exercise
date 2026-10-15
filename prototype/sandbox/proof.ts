/** Real local HTTP proof; this command performs synthetic enrolments/activity completion. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { MoodleConnector, fetchHrDelta, type MoodleSource } from '../src/lib/sandbox-integrations';

const directory = resolve('sandbox');
const local = join(directory, '.local');
const credentialSchema = z.object({
  source: z.enum(['moodle-a', 'moodle-b']), baseUrl: z.string(), categoryId: z.number().int().positive(),
  courseId: z.number().int().positive(), userId: z.number().int().positive(), roleId: z.number().int().positive(),
  activityId: z.number().int().positive(), serviceToken: z.string().min(1), learnerToken: z.string().min(1),
  serviceAdmin: z.literal(false), serviceFunctions: z.array(z.string()),
});
interface Receipt { check: string; source: string; status: 'PASS' | 'FAIL'; evidence?: unknown; reason?: string }
async function main() {
  process.umask(0o077);
  const receipts: Receipt[] = [];
  const createdAt = new Date().toISOString();
  const pins = JSON.parse(await readFile(join(local, 'pins.json'), 'utf8'));
  async function prove(source: string, check: string, operation: () => Promise<unknown>) {
    try { receipts.push({ source, check, status: 'PASS', evidence: await operation() }); }
    catch { receipts.push({ source, check, status: 'FAIL', reason: 'Local proof assertion or upstream operation failed; no credential/payload output retained.' }); }
  }
  await prove('synthetic-hr', 'delta_replay_and_lifecycle', async () => {
    const credential = z.object({ token: z.string().min(1) }).parse(JSON.parse(await readFile(join(local, 'private', 'hr.json'), 'utf8')));
    let cursor = '0';
    let count = 0;
    while (true) {
      const page = await fetchHrDelta('http://127.0.0.1:8083', credential.token, cursor);
      assert.deepEqual(await fetchHrDelta('http://127.0.0.1:8083', credential.token, cursor), page);
      count += page.changes.length;
      if (page.nextCursor === cursor) break;
      cursor = page.nextCursor;
    }
    assert.ok(count >= 3);
    for (const expectedReleased of [4, 5, 6]) {
      let state = JSON.parse(await readFile(join(local, 'hr-state.json'), 'utf8'));
      if (state.released < expectedReleased) {
        const result = spawnSync(process.execPath, [join(directory, 'run.mjs'), 'hr', 'advance'], { stdio: 'pipe' });
        assert.equal(result.status, 0);
        state = JSON.parse(await readFile(join(local, 'hr-state.json'), 'utf8'));
        assert.equal(state.released, expectedReleased);
      }
    }
    const joiner = await fetchHrDelta('http://127.0.0.1:8083', credential.token, '3');
    const transfer = await fetchHrDelta('http://127.0.0.1:8083', credential.token, '4');
    const leaver = await fetchHrDelta('http://127.0.0.1:8083', credential.token, '5');
    assert.equal(joiner.changes[0]?.employee?.managerId, 'E0002');
    assert.equal(transfer.changes[0]?.employee?.managerId, 'E9001');
    assert.equal(leaver.changes[0]?.active, false);
    assert.equal(leaver.changes[0]?.id, 'E0003');
    assert.deepEqual(await fetchHrDelta('http://127.0.0.1:8083', credential.token, '3'), joiner);
    return { kind: 'synthetic', initialSnapshotRecords: 3, lifecycle: ['joiner', 'manager_transfer', 'leaver'], finalCursor: '6', replayIdentical: true };
  });
  const connectorBySource = new Map<MoodleSource, MoodleConnector>();
  for (const source of ['moodle-a', 'moodle-b'] as const) {
    await prove(source, 'catalogue_enrol_learner_activity_completion', async () => {
      const credentials = credentialSchema.parse(JSON.parse(await readFile(join(local, 'private', `${source}.json`), 'utf8')));
      assert.equal(credentials.source, source);
      const connector = new MoodleConnector({ baseUrl: credentials.baseUrl, token: credentials.serviceToken, source });
      connectorBySource.set(source, connector);
      const catalogue = await connector.catalogue(credentials.categoryId);
      const course = catalogue.find(row => row.nativeCourseId === credentials.courseId);
      assert.ok(course);
      assert.equal(course.id, `${source}:${credentials.courseId}`);
      const enrolled = await connector.enrol(credentials.userId, credentials.courseId, credentials.roleId);
      const replay = await connector.enrol(credentials.userId, credentials.courseId, credentials.roleId);
      assert.equal(replay.alreadyEnrolled, true);
      const before = await connector.completion(credentials.userId, credentials.courseId);
      // This endpoint acts as the enrolled learner. The service token cannot mark completion.
      const response = await fetch(`${credentials.baseUrl}/webservice/rest/server.php`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ wstoken: credentials.learnerToken, moodlewsrestformat: 'json',
          wsfunction: 'core_completion_update_activity_completion_status_manually', cmid: String(credentials.activityId), completed: '1' }),
      });
      assert.equal(response.ok, true);
      const completedActivity = z.object({ status: z.literal(true), warnings: z.array(z.unknown()).max(0) }).parse(await response.json());
      assert.equal(completedActivity.status, true);
      let after = before;
      for (let attempt = 0; attempt < 4; attempt++) {
        const cron = spawnSync(process.execPath, [join(directory, 'run.mjs'), 'cron', source], { stdio: 'pipe', timeout: 30_000 });
        assert.equal(cron.status, 0);
        after = await connector.completion(credentials.userId, credentials.courseId);
        if (after.completed) break;
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
      assert.equal(after.completed, true);
      assert.ok(after.completedAt);
      assert.deepEqual(await connector.completion(credentials.userId, credentials.courseId), after);
      return { origin: credentials.baseUrl, catalogueCount: catalogue.length, courseId: course.id, syntheticEmployeeId: 'E0001',
        serviceUserIsAdmin: false, allowlistedServiceFunctions: credentials.serviceFunctions,
        enrolmentConfirmed: enrolled.enrolled, duplicateEnrolmentSkipped: replay.alreadyEnrolled,
        completionBefore: before.completed, completionAfter: after.completed, activityCompletionActor: 'enrolled_learner',
        completionTransition: before.completed ? 'ALREADY_COMPLETE_REPLAY' : 'INCOMPLETE_TO_COMPLETE',
        completionObservedAt: after.completedAt, repeatedCompletionIdentical: true };
    });
  }
  await prove('moodle-b', 'one_source_unavailable_does_not_block_other_source', async () => {
    const credentials = credentialSchema.parse(JSON.parse(await readFile(join(local, 'private', 'moodle-b.json'), 'utf8')));
    const offline = connectorBySource.get('moodle-a');
    const online = connectorBySource.get('moodle-b');
    assert.ok(offline); assert.ok(online);
    const pause = spawnSync(process.execPath, [join(directory, 'run.mjs'), 'pause', 'moodle-a'], { stdio: 'pipe', timeout: 15_000 });
    assert.equal(pause.status, 0);
    try {
      await assert.rejects(offline.catalogue(credentials.categoryId));
      const courses = await online.catalogue(credentials.categoryId);
      assert.ok(courses.length > 0);
      return { failedSource: 'moodle-a', fault: 'actual_webserver_container_paused', unaffectedSource: 'moodle-b', unaffectedCatalogueCount: courses.length };
    } finally {
      const resume = spawnSync(process.execPath, [join(directory, 'run.mjs'), 'resume', 'moodle-a'], { stdio: 'pipe', timeout: 15_000 });
      assert.equal(resume.status, 0, 'paused local Moodle must be restored');
    }
  });
  const report = { schema: 1, createdAt, kind: 'local_sandbox_only', hosted: 'unconfigured', pins,
    status: receipts.every(receipt => receipt.status === 'PASS') ? 'PASS' : 'FAIL', receipts,
    limitations: ['Synthetic HR service and self-created course content.', 'Separate local Moodle logins; Suite SSO is not Moodle SSO.',
      'No client HR/LMS or hosted connector was verified.', 'D1 workflow reconciliation requires its separate integration acceptance test.'] };
  const receiptDirectory = join(local, 'receipts');
  await mkdir(receiptDirectory, { recursive: true, mode: 0o700 });
  const path = join(receiptDirectory, `${createdAt.replaceAll(':', '-')}.json`);
  await writeFile(path, JSON.stringify(report, null, 2), { mode: 0o600, flag: 'wx' });
  // Deliberately output only the redacted report. Credential files never reach stdout.
  process.stdout.write(JSON.stringify({ ...report, receiptPath: path }, null, 2) + '\n');
  if (report.status !== 'PASS') process.exitCode = 1;
}
main().catch(() => { process.stderr.write('Sandbox proof incomplete; check local prerequisites. Credentials and raw upstream errors omitted.\n'); process.exitCode = 1; });
