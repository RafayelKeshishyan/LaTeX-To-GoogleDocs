/** Read-only Supabase connection check. Never prints environment values. */
import { readFile } from 'node:fs/promises';

function parseEnv(raw) {
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].trim().replace(/^(["'])(.*)\1$/, '$2')]),
  );
}

async function request(url, key, path) {
  try {
    const response = await fetch(`${url}${path}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return {
      status: response.status,
      ok: response.ok,
      code: typeof body.code === 'string' ? body.code : '',
      message: typeof body.message === 'string' ? body.message : '',
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      code: '',
      message: error instanceof Error ? error.name : 'Network error',
    };
  }
}

const env = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key || /your-project|replace_me/.test(`${url}${key}`)) {
  console.error('Configuration: missing or still using placeholders.');
  process.exit(1);
}

const auth = await request(url, key, '/auth/v1/settings');
console.log(`Auth endpoint: HTTP ${auth.status || 'network error'}`);

const database = await request(url, key, '/rest/v1/profiles?select=id&limit=1');
console.log(`Database endpoint: HTTP ${database.status || 'network error'}`);
if (database.code) console.log(`Database code: ${database.code}`);
if (database.message) console.log(`Database message: ${database.message}`);

const workspace = await request(
  url,
  key,
  '/rest/v1/personal_workspaces?select=user_id&limit=1',
);
console.log(`Cloud workspace endpoint: HTTP ${workspace.status || 'network error'}`);

if (!auth.ok) {
  console.error('Result: Supabase Auth connection failed.');
  process.exit(1);
}

if (database.ok) {
  console.error('Result: database responded, but profiles are readable without signing in. Check RLS and grants.');
  process.exit(1);
}

if (database.code === 'PGRST205' || /could not find.*profiles|relation.*does not exist/i.test(database.message)) {
  console.error('Result: Supabase connects, but the classroom migration is missing.');
  process.exit(1);
}

if (!(database.code === '42501' || /permission denied/i.test(database.message))) {
  console.error('Result: Supabase connects, but the database response was not recognized.');
  process.exit(1);
}

if (workspace.ok) {
  console.error('Result: personal workspaces are readable without signing in. Check RLS and grants.');
  process.exit(1);
}

if (
  workspace.code === 'PGRST205' ||
  /could not find.*personal_workspaces|relation.*does not exist/i.test(workspace.message)
) {
  console.error('Result: classroom schema exists, but the personal workspace migration is missing.');
  process.exit(1);
}

if (workspace.code === '42501' || /permission denied/i.test(workspace.message)) {
  console.log('Result: connection successful; schemas exist and anonymous access is blocked.');
  process.exit(0);
}

console.error('Result: Supabase connects, but the database response was not recognized.');
process.exit(1);
