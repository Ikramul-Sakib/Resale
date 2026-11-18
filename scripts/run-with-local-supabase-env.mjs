import { spawnSync, spawn } from 'node:child_process';

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command) {
  console.error('Usage: node scripts/run-with-local-supabase-env.mjs <command> [args...]');
  process.exit(1);
}

const status = spawnSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
if (status.error || status.status !== 0) {
  console.error('Could not read local Supabase credentials. Run `supabase start` first.');
  process.exit(status.status || 1);
}

const active = {};
for (const line of status.stdout.split('\n')) {
  const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;
  active[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const required = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
if (required.some((key) => !active[key])) {
  console.error('Local Supabase is not running or did not return its connection keys. Run `supabase start` first.');
  process.exit(1);
}

const environment = {
  ...process.env,
  SUPABASE_URL: active.API_URL,
  SUPABASE_ANON_KEY: active.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: active.SERVICE_ROLE_KEY,
  VITE_SUPABASE_URL: active.API_URL,
  VITE_SUPABASE_ANON_KEY: active.ANON_KEY,
};

const child = spawn(command, args, { stdio: 'inherit', env: environment, shell: false });
const forwardSignal = (signal) => child.kill(signal);
process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));
child.on('error', (error) => { console.error(`Could not start ${command}: ${error.message}`); process.exit(1); });
child.on('exit', (code, signal) => { process.exit(code ?? (signal ? 1 : 0)); });
