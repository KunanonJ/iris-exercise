import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHrServer } from '../sandbox/hr-service.mjs';

test('synthetic HR HTTP service persists released cursor, replays safely and exposes ordered joiner, transfer, leaver', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'iris-hr-test-'));
  const statePath = join(directory, 'state.json');
  const secret = 'test-only-synthetic-hr-token';
  await writeFile(statePath, JSON.stringify({ released: 3 }));
  const server = createHrServer({ token: secret, statePath });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/delta`;
    const get = (cursor: string) => fetch(`${url}?cursor=${cursor}`, { headers: { authorization: `Bearer ${secret}` } });
    assert.equal((await fetch(`${url}?cursor=0`)).status, 401);
    assert.equal((await get('7')).status, 409);
    assert.equal((await get('-1')).status, 400);
    const initial = await (await get('0')).json();
    assert.deepEqual(await (await get('0')).json(), initial);
    assert.equal(initial.nextCursor, '1');
    assert.deepEqual(await (await get('3')).json(), { changes: [], nextCursor: '3' });
    await writeFile(statePath, JSON.stringify({ released: 4 }));
    const joiner = await (await get('3')).json();
    assert.equal(joiner.changes[0].id, 'E0003');
    assert.equal(joiner.changes[0].employee.managerId, 'E0002');
    await writeFile(statePath, JSON.stringify({ released: 5 }));
    const transfer = await (await get('4')).json();
    assert.equal(transfer.changes[0].employee.managerId, 'E9001');
    await writeFile(statePath, JSON.stringify({ released: 6 }));
    assert.deepEqual(await (await get('5')).json(), { changes: [{ id: 'E0003', active: false }], nextCursor: '6' });
    assert.deepEqual(await (await get('6')).json(), { changes: [], nextCursor: '6' });
    // A restarted consumer can replay any prior offset against the persisted source.
    assert.deepEqual(await (await get('3')).json(), joiner);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
