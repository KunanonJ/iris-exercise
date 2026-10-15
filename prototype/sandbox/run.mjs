#!/usr/bin/env node
/** Local-only sandbox lifecycle. Never echoes process output that may contain credentials. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialReleased, totalEvents } from './hr-service.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const local = join(directory, '.local');
const privateDir = join(local, 'private');
const root = resolve(directory, '..');
const dockerCommit = 'f4c2324d32fb74d7753264381f0a9b418b6034b2';
const moodleCommit = '215f44380bdc3ccf852a3a22e34f8423ff64033a';
const sourceTag = 'v4.5.15';
const sources = ['moodle-a', 'moodle-b'];
const dockerSource = join(local, 'moodle-docker');
const pinsPath = join(local, 'pins.json');
const randomSecret = () => randomBytes(32).toString('base64url');
async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function atomic(path, value, mode = 0o600) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode, flag: 'wx' });
  await chmod(temporary, mode);
  await rename(temporary, path);
}
function execute(command, args, { env, input, outputFile, timeout = 300_000, allowedFailure = false } = {}) {
  let fd;
  if (outputFile) fd = openSync(outputFile, 'w', 0o600);
  try {
    const result = spawnSync(command, args, { cwd: root, env: env ?? process.env, input, timeout,
      encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, stdio: outputFile ? ['pipe', fd, 'pipe'] : 'pipe' });
    if (result.status !== 0 && !allowedFailure) throw new Error(`Sandbox command failed: ${command} (${result.status ?? 'unavailable'})`);
    return { ok: result.status === 0, stdout: outputFile ? '' : result.stdout ?? '' };
  } finally { if (fd !== undefined) closeSync(fd); }
}
async function requireDocker() {
  if (!execute('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000, allowedFailure: true }).ok) {
    throw new Error('Docker daemon is unavailable. Start Docker Desktop and rerun this command.');
  }
}
function envFor(source) {
  const port = source === 'moodle-a' ? 8081 : 8082;
  return { ...process.env, ASSETDIR: join(dockerSource, 'assets'), MOODLE_DOCKER_WWWROOT: join(local, source, 'moodle'),
    MOODLE_DOCKER_PHP_VERSION: '8.3', MOODLE_DOCKER_DB_VERSION: '17', MOODLE_DOCKER_DBTYPE: 'pgsql',
    MOODLE_DOCKER_DBNAME: 'moodle', MOODLE_DOCKER_DBUSER: 'moodle', MOODLE_DOCKER_WEB_HOST: '127.0.0.1',
    MOODLE_DOCKER_WEB_PORT: `127.0.0.1:${port}`, MOODLE_DOCKER_BROWSER_TAG: '4', MOODLE_DOCKER_TIMEOUT_FACTOR: '1' };
}
function compose(source, args, options = {}) {
  return execute('docker', ['compose', '-p', `iris-${source}`, '-f', join(dockerSource, 'base.yml'), '-f', join(dockerSource, 'db.pgsql.yml'),
    '-f', join(local, `${source}.compose.json`), ...args], { ...options, env: envFor(source) });
}
async function checkout(repository, ref, expected, destination) {
  if (!await exists(join(destination, '.git'))) {
    await mkdir(destination, { recursive: true, mode: 0o755 });
    const previousMask = process.umask(0o022);
    try {
      execute('git', ['init', '--quiet', destination]);
      execute('git', ['-C', destination, 'remote', 'add', 'origin', repository]);
      execute('git', ['-C', destination, 'fetch', '--depth', '1', 'origin', expected]);
      execute('git', ['-C', destination, 'checkout', '--quiet', '--detach', 'FETCH_HEAD']);
    } finally { process.umask(previousMask); }
  }
  const commit = execute('git', ['-C', destination, 'rev-parse', 'HEAD']).stdout.trim();
  if (!execute('git', ['-C', destination, 'diff', '--quiet', 'HEAD', '--'], { allowedFailure: true }).ok) {
    throw new Error('Sandbox source has tracked modifications; refusing to execute it');
  }
  if (commit !== expected) throw new Error('Sandbox source revision mismatch; source was not executed');
  // Stable archive hash records exactly which source tree was downloaded. It is not a publisher signature.
  const hash = createHash('sha256');
  await new Promise((resolveArchive, reject) => {
    const archive = spawn('git', ['-C', destination, 'archive', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 300_000 });
    archive.stdout.on('data', chunk => hash.update(chunk));
    archive.on('error', () => reject(new Error('Sandbox source checksum failed')));
    archive.on('close', status => status === 0 ? resolveArchive() : reject(new Error('Sandbox source checksum failed')));
  });
  return { repository, ref, commit, archiveSha256: hash.digest('hex') };
}
async function setup() {
  process.umask(0o077);
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  await chmod(privateDir, 0o700);
  // Must be checked in the actual repository, before any credential is created.
  const inRepository = execute('git', ['rev-parse', '--is-inside-work-tree'], { allowedFailure: true }).ok;
  if (inRepository) {
    const ignore = execute('git', ['check-ignore', '--quiet', 'sandbox/.local/private/probe.json'], { allowedFailure: true });
    if (!ignore.ok) throw new Error('sandbox/.local must be git-ignored before setup');
  } else if (!(await readFile(join(directory, '.gitignore'), 'utf8')).split('\n').includes('.local/')) {
    throw new Error('Unversioned sandbox still requires a .local ignore rule');
  }
  await requireDocker();
  process.stdout.write('Fetching pinned official Moodle sources and locking image digests.\n');
  const docker = await checkout('https://github.com/moodlehq/moodle-docker.git', 'main', dockerCommit, dockerSource);
  const moodle = await checkout('https://github.com/moodle/moodle.git', sourceTag, moodleCommit, join(local, 'moodle-a', 'moodle'));
  await checkout('https://github.com/moodle/moodle.git', sourceTag, moodleCommit, join(local, 'moodle-b', 'moodle'));
  const prior = await exists(pinsPath) ? await json(pinsPath) : null;
  const images = {};
  for (const image of ['moodlehq/moodle-php-apache:8.3', 'postgres:17']) {
    const pinned = prior?.images?.[image];
    execute('docker', ['pull', pinned ?? image]);
    const digests = JSON.parse(execute('docker', ['image', 'inspect', pinned ?? image, '--format', '{{json .RepoDigests}}']).stdout);
    const digest = pinned ?? digests?.[0];
    if (!digest || !/^[\w./-]+@sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Image digest could not be pinned');
    images[image] = digest;
  }
  const pins = { schema: 1, moodleVersion: '4.5.15', preparedAt: new Date().toISOString(), docker, moodle, images };
  await atomic(pinsPath, pins);
  for (const source of sources) {
    const port = source === 'moodle-a' ? 8081 : 8082;
    const secretPath = join(privateDir, `${source}-config.json`);
    if (!await exists(secretPath)) {
      await atomic(secretPath, { source, port, dbPassword: randomSecret(), adminPassword: `A!a9${randomSecret()}`,
        learnerPassword: `L!a9${randomSecret()}`, servicePassword: `S!a9${randomSecret()}` });
    }
    const config = await json(secretPath);
    const dbSecretPath = join(privateDir, `${source}-db-password`);
    if (!await exists(dbSecretPath)) await atomic(dbSecretPath, config.dbPassword);
    await copyFile(join(directory, 'moodle-config.php'), join(local, source, 'moodle', 'config.php'));
    // Config contains only the runtime secret path, never credential values.
    await chmod(join(local, source, 'moodle', 'config.php'), 0o644);
    await atomic(join(local, `${source}.compose.json`), {
      services: {
        webserver: { image: images['moodlehq/moodle-php-apache:8.3'], ports: [`127.0.0.1:${port}:80`],
          volumes: [`${directory}:/opt/iris:ro`, 'moodledata:/var/www/moodledata'],
          tmpfs: ['/run/iris-private:mode=0700,uid=33,gid=33'], security_opt: ['no-new-privileges:true'] },
        db: { image: images['postgres:17'], environment: { POSTGRES_PASSWORD: null, POSTGRES_PASSWORD_FILE: '/run/iris-db-password' },
          volumes: ['pgdata:/var/lib/postgresql/data', `${dbSecretPath}:/run/iris-db-password:ro`],
          healthcheck: { test: ['CMD-SHELL', 'pg_isready -U moodle -d moodle'], interval: '2s', timeout: '2s', retries: 60 },
          security_opt: ['no-new-privileges:true'] },
      }, volumes: { moodledata: {}, pgdata: {} },
    });
  }
  if (!await exists(join(privateDir, 'hr.json'))) await atomic(join(privateDir, 'hr.json'), { token: randomSecret() });
  if (!await exists(join(local, 'hr-state.json'))) await atomic(join(local, 'hr-state.json'), { released: initialReleased });
  process.stdout.write('Prepared two isolated Moodle projects. Credentials remain under sandbox/.local/private; no containers started.\n');
}
async function materialize(source) {
  const input = await readFile(join(privateDir, `${source}-config.json`), 'utf8');
  compose(source, ['exec', '-T', '-u', 'root', 'webserver', 'php', '/opt/iris/materialize.php'], { input });
  compose(source, ['exec', '-T', '-u', 'root', 'webserver', 'chown', 'www-data:www-data', '/var/www/moodledata']);
}
async function startHr() {
  if (await exists(join(local, 'hr.pid'))) {
    const pid = Number(await readFile(join(local, 'hr.pid'), 'utf8'));
    const args = execute('ps', ['-p', String(pid), '-o', 'command='], { allowedFailure: true }).stdout;
    if (args.includes(join(directory, 'hr-service.mjs'))) return;
    if (args.trim()) throw new Error('Synthetic HR PID belongs to another process; refusing to replace it');
  }
  const log = openSync(join(local, 'hr.log'), 'a', 0o600);
  const processHr = spawn(process.execPath, [join(directory, 'hr-service.mjs')], { detached: true, stdio: ['ignore', log, log], cwd: root });
  closeSync(log);
  if (!processHr.pid) throw new Error('Synthetic HR failed to start');
  await atomic(join(local, 'hr.pid'), String(processHr.pid));
  processHr.unref();
}
async function start() {
  await requireDocker();
  if (!await exists(pinsPath)) throw new Error('Run setup first');
  for (const source of sources) {
    process.stdout.write(`Starting ${source} on its loopback port.\n`);
    compose(source, ['up', '-d', '--wait', '--wait-timeout', '120', 'db', 'webserver']);
    await materialize(source);
    const installed = compose(source, ['exec', '-T', '-u', 'www-data', 'webserver', 'php', '/opt/iris/is-installed.php']);
    if (installed.stdout.trim() !== 'installed') {
      // Installer output is not returned to the caller. No plaintext setup log is persisted.
      compose(source, ['exec', '-T', '-u', 'www-data', 'webserver', 'php', '/opt/iris/install.php']);
      // Ensure fixture bootstrap reads the final installed settings in a fresh process.
      compose(source, ['exec', '-T', '-u', 'www-data', 'webserver', 'php', 'admin/cli/purge_caches.php']);
    }
    const credentialPath = join(privateDir, `${source}.json`);
    const temporary = `${credentialPath}.${process.pid}.tmp`;
    try {
      compose(source, ['exec', '-T', '-u', 'www-data', 'webserver', 'php', '/opt/iris/seed.php'], { outputFile: temporary });
      const credentials = await json(temporary);
      if (credentials.source !== source || credentials.serviceAdmin !== false) throw new Error('Sandbox seed validation failed');
      if (await exists(credentialPath)) {
        const prior = await json(credentialPath);
        for (const field of ['serviceToken', 'learnerToken', 'adminPassword', 'learnerPassword']) {
          if (prior[field] !== credentials[field]) throw new Error('Existing sandbox credentials changed; refusing to overwrite them');
        }
      }
      await rename(temporary, credentialPath);
    } finally { if (await exists(temporary)) await unlink(temporary); }
    process.stdout.write(`${source}: installed synthetic course, learner and restricted service.\n`);
  }
  await startHr();
  process.stdout.write('Synthetic HR started. Run status, then proof; startup alone is not integration evidence.\n');
}
async function status() {
  const report = { kind: 'local_sandbox', hosted: 'unconfigured', moodleVersion: '4.5.15', instances: [], hr: 'unavailable' };
  for (const source of sources) {
    const port = source === 'moodle-a' ? 8081 : 8082;
    let httpStatus = null;
    try { httpStatus = (await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000), redirect: 'manual' })).status; } catch {}
    report.instances.push({ source, origin: `http://127.0.0.1:${port}`, httpStatus,
      credentialConfigured: await exists(join(privateDir, `${source}.json`)) });
  }
  try {
    const response = await fetch('http://127.0.0.1:8083/health', { signal: AbortSignal.timeout(3000) });
    if (response.ok) report.hr = 'synthetic_online';
  } catch {}
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
async function advanceHr() {
  const path = join(local, 'hr-state.json');
  const state = await json(path);
  if (!Number.isInteger(state.released) || state.released < initialReleased || state.released > totalEvents) throw new Error('Invalid synthetic HR state');
  if (state.released < totalEvents) state.released += 1;
  await atomic(path, state);
  process.stdout.write(JSON.stringify({ kind: 'synthetic_hr', released: state.released, latest: ['joiner', 'manager_transfer', 'leaver'][state.released - initialReleased - 1] ?? 'initial_snapshot', remaining: totalEvents - state.released }) + '\n');
}
async function stop() {
  await requireDocker();
  for (const source of sources) compose(source, ['stop', 'webserver', 'db']);
  if (await exists(join(local, 'hr.pid'))) {
    const pid = Number(await readFile(join(local, 'hr.pid'), 'utf8'));
    const args = execute('ps', ['-p', String(pid), '-o', 'command='], { allowedFailure: true }).stdout;
    if (args.includes(join(directory, 'hr-service.mjs'))) process.kill(pid, 'SIGTERM');
  }
  process.stdout.write('Stopped local sandbox processes. Data and credential files are preserved.\n');
}
async function cron(source) {
  if (!sources.includes(source)) throw new Error('Choose moodle-a or moodle-b');
  compose(source, ['exec', '-T', '-u', 'www-data', 'webserver', 'php', 'admin/cli/scheduled_task.php', '--execute=\\core\\task\\completion_regular_task', '--showdebugging=0']);
  process.stdout.write(`${source}: completion task executed.\n`);
}
async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === 'setup') return setup();
  if (command === 'start') return start();
  if (command === 'status') return status();
  if (command === 'stop') return stop();
  if (command === 'hr' && argument === 'advance') return advanceHr();
  if (command === 'cron') return cron(argument);
  if (command === 'pause' || command === 'resume') {
    if (!sources.includes(argument)) throw new Error('Choose moodle-a or moodle-b');
    compose(argument, [command === 'pause' ? 'pause' : 'unpause', 'webserver']);
    process.stdout.write(`${argument}: ${command === 'pause' ? 'paused for local fault proof' : 'resumed'}.\n`);
    return;
  }
  if (command === 'proof') {
    const result = execute('pnpm', ['exec', 'tsx', 'sandbox/proof.ts'], { timeout: 120_000, allowedFailure: true });
    process.stdout.write(result.stdout);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error('Usage: node sandbox/run.mjs setup|start|status|proof|cron moodle-a|stop|hr advance');
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
