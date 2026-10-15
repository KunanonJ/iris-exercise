import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MoodleConnector, fetchHrDelta } from '../src/lib/sandbox-integrations';

const token = 'test-token-never-valid-upstream';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const course = { id: 7, fullname: 'Synthetic safety lesson', shortname: 'IRIS-A-1', categoryid: 2, visible: 1 };

function fixture(replies: (Response | Error)[]) {
  const calls: { url: string; options?: RequestInit; body: URLSearchParams }[] = [];
  const mockFetch: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options, body: new URLSearchParams(String(options?.body ?? '')) });
    const next = replies.shift();
    if (next instanceof Error) throw next;
    assert.ok(next, 'unexpected upstream request');
    return next;
  };
  return { calls, fetch: mockFetch };
}

test('catalogue validates upstream, qualifies IDs and keeps credentials out of URL', async () => {
  const f = fixture([json({ courses: [course], warnings: [] })]);
  const result = await new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch }).catalogue(2);
  assert.equal(result[0].id, 'moodle-a:7');
  assert.equal(result[0].nativeCourseId, 7);
  assert.equal(f.calls[0].body.get('field'), 'category');
  assert.equal(f.calls[0].body.get('value'), '2');
  assert.equal(f.calls[0].body.get('wstoken'), token);
  assert.equal(f.calls[0].options?.method, 'POST');
  assert.equal(f.calls[0].options?.redirect, 'manual');
  assert.equal(f.calls[0].url, 'http://127.0.0.1:8081/webservice/rest/server.php');
});

test('equal native IDs in two Moodle sources remain distinct', async () => {
  const a = fixture([json({ courses: [course], warnings: [] })]);
  const b = fixture([json({ courses: [course], warnings: [] })]);
  const left = await new MoodleConnector({ baseUrl: 'http://localhost:8081', source: 'moodle-a', token, fetch: a.fetch }).catalogue(2);
  const right = await new MoodleConnector({ baseUrl: 'http://localhost:8082', source: 'moodle-b', token, fetch: b.fetch }).catalogue(2);
  assert.notEqual(left[0].id, right[0].id);
});

test('enrolment checks upstream and replay does not re-enrol', async () => {
  const f = fixture([json([]), json(null), json([{ id: 7 }]), json([{ id: 7 }])]);
  const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch });
  assert.deepEqual(await connector.enrol(12, 7, 5), { enrolled: true, alreadyEnrolled: false });
  assert.deepEqual(await connector.enrol(12, 7, 5), { enrolled: true, alreadyEnrolled: true });
  assert.equal(f.calls.filter(c => c.body.get('wsfunction') === 'enrol_manual_enrol_users').length, 1);
});

test('enrol write is never retried after an ambiguous upstream failure', async () => {
  const f = fixture([json([]), new Error('ambiguous transport failure')]);
  const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch });
  await assert.rejects(connector.enrol(12, 7, 5), /unavailable/);
  assert.equal(f.calls.length, 2);
});

test('read transient failure is retried once, then validated', async () => {
  const f = fixture([json({}, 503), json({ courses: [course], warnings: [] })]);
  const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch });
  assert.equal((await connector.catalogue(2)).length, 1);
  assert.equal(f.calls.length, 2);
});

test('completion accepts upstream booleans only and rejects Moodle errors without leaking payload', async () => {
  for (const payload of [
    { completionstatus: { completed: 'true', completions: [] }, warnings: [] },
    { exception: 'moodle_exception', errorcode: 'invalidtoken', message: token },
    { completionstatus: { completed: true, completions: [] }, warnings: [{ message: token }] },
  ]) {
    const f = fixture([json(payload)]);
    const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch });
    await assert.rejects(connector.completion(12, 7), error => error instanceof Error && !error.message.includes(token));
  }
});

test('completion remains upstream-derived and scoped to one source and learner', async () => {
  const f = fixture([json({ completionstatus: { completed: true, completions: [{ timecompleted: 1800000000 }] }, warnings: [] })]);
  const result = await new MoodleConnector({ baseUrl: 'http://127.0.0.1:8082', source: 'moodle-b', token, fetch: f.fetch }).completion(12, 7);
  assert.deepEqual(result, { source: 'moodle-b', courseId: 'moodle-b:7', nativeCourseId: 7, userId: 12, completed: true, completedAt: '2027-01-15T08:00:00.000Z' });
  assert.equal(f.calls[0].body.get('userid'), '12');
});

test('unapproved origins, userinfo, paths, query and source/port mismatches fail closed', () => {
  for (const baseUrl of ['https://example.org', 'http://169.254.169.254', 'http://localhost:8082', 'http://localhost:8081/path', 'http://localhost:8081?token=x', 'http://user:pass@localhost:8081', 'http://127.0.0.2:8081']) {
    assert.throws(() => new MoodleConnector({ baseUrl, source: 'moodle-a', token }));
  }
});

test('invalid IDs are rejected before upstream requests', async () => {
  const f = fixture([]);
  const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch });
  await assert.rejects(connector.catalogue(-1));
  await assert.rejects(connector.enrol(1, NaN, 5));
  assert.equal(f.calls.length, 0);
});

test('HR delta sends bearer auth, validates changes, and preserves cursor semantics', async () => {
  const f = fixture([json({ changes: [{ id: 'E0003', active: false }], nextCursor: '3' })]);
  const delta = await fetchHrDelta('http://127.0.0.1:8083', token, '2', f.fetch);
  assert.deepEqual(delta, { changes: [{ id: 'E0003', active: false }], nextCursor: '3' });
  assert.equal(f.calls[0].url, 'http://127.0.0.1:8083/delta?cursor=2');
  assert.equal(new Headers(f.calls[0].options?.headers).get('authorization'), `Bearer ${token}`);
  assert.equal(f.calls[0].options?.redirect, 'manual');
});

test('HR rejects backwards cursor, mismatched employee ID, malformed active profile and oversized input', async () => {
  for (const payload of [
    { changes: [], nextCursor: '1' },
    { changes: [], nextCursor: '3' },
    { changes: [{ id: 'E0003', active: false }], nextCursor: '4' },
    { changes: [{ id: 'E0003', active: true }], nextCursor: '3' },
    { changes: [{ id: 'E0003', active: true, employee: { id: 'E9999' } }], nextCursor: '3' },
    { changes: Array.from({ length: 101 }, () => ({ id: 'E0003', active: false })), nextCursor: '3' },
  ]) {
    const f = fixture([json(payload)]);
    await assert.rejects(fetchHrDelta('http://127.0.0.1:8083', token, '2', f.fetch));
  }
});

test('Moodle incomplete criteria may have null completion timestamps', async () => {
  const f = fixture([json({ completionstatus: { completed: false, completions: [{ timecompleted: null }] }, warnings: [] })]);
  const result = await new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: f.fetch }).completion(12, 7);
  assert.equal(result.completed, false);
  assert.equal(result.completedAt, null);
});


test('upstream redirects are rejected once without forwarding service credentials', async () => {
  for (const status of [302, 307]) {
    const moodle = fixture([new Response(null, { status, headers: { location: 'http://localhost:8082/untrusted' } })]);
    const connector = new MoodleConnector({ baseUrl: 'http://127.0.0.1:8081', source: 'moodle-a', token, fetch: moodle.fetch });
    await assert.rejects(connector.catalogue(2), /rejected request/);
    assert.equal(moodle.calls[0].options?.redirect, 'manual');
    assert.equal(moodle.calls.length, 1);
    const hr = fixture([new Response(null, { status, headers: { location: 'http://localhost:8082/untrusted' } })]);
    await assert.rejects(fetchHrDelta('http://127.0.0.1:8083', token, '0', hr.fetch), /rejected request/);
    assert.equal(hr.calls[0].options?.redirect, 'manual');
    assert.equal(hr.calls.length, 1);
  }
});
