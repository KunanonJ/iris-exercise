import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const events = JSON.parse(readFileSync(new URL('./hr-events.json', import.meta.url), 'utf8'));
export const initialReleased = 3;
export const totalEvents = events.length;
export function createHrServer({ token, statePath }) {
  if (!token || /\s/.test(token)) throw new Error('Synthetic HR credential is missing');
  const expected = Buffer.from(`Bearer ${token}`);
  return createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    const send = (status, body) => { response.writeHead(status); response.end(JSON.stringify(body)); };
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1:8083');
      if (request.method === 'GET' && url.pathname === '/health' && !url.search) return send(200, { service: 'IRIS synthetic HR', kind: 'synthetic', ready: true });
      if (request.method !== 'GET' || url.pathname !== '/delta') return send(404, { error: 'not_found' });
      const supplied = Buffer.from(request.headers.authorization ?? '');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: 'unauthorized' });
      const cursor = url.searchParams.get('cursor') ?? '0';
      if (!/^(0|[1-9]\d{0,11})$/.test(cursor) || [...url.searchParams.keys()].some(k => k !== 'cursor') || url.searchParams.getAll('cursor').length > 1) {
        return send(400, { error: 'invalid_cursor' });
      }
      const state = JSON.parse(await readFile(statePath, 'utf8'));
      if (!Number.isInteger(state.released) || state.released < initialReleased || state.released > events.length) return send(503, { error: 'state_invalid' });
      const offset = Number(cursor);
      if (offset > state.released) return send(409, { error: 'cursor_ahead_of_source' });
      // A page contains one change, so transfer and leaver events cannot collapse.
      const end = Math.min(offset + 1, state.released);
      return send(200, { changes: events.slice(offset, end), nextCursor: String(end) });
    } catch { return send(503, { error: 'synthetic_hr_unavailable' }); }
  });
}

async function main() {
  const stateDir = new URL('./.local/', import.meta.url);
  const credentials = JSON.parse(await readFile(new URL('private/hr.json', stateDir), 'utf8'));
  const server = createHrServer({ token: credentials.token, statePath: new URL('hr-state.json', stateDir) });
  server.listen(8083, '127.0.0.1', () => process.stdout.write('Synthetic HR listening on loopback port 8083\n'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(() => { process.stderr.write('Synthetic HR startup failed\n'); process.exitCode = 1; });
