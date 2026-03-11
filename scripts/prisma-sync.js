const path = require('path');
const { spawnSync } = require('child_process');
let dotenv;
try { dotenv = require('dotenv'); } catch {}
if (dotenv) { try { dotenv.config({ path: path.join(process.cwd(), '.env') }); } catch {} }

const env = process.env;
const db_user = env.DB_USER || 'root';
const db_password = env.DB_PASSWORD || 'root';
const db_host = env.DB_HOST || 'localhost';
const db_port = env.DB_PORT ? Number(env.DB_PORT) : 3306;
const db_name = env.DB_NAME || 'dbtest';

const user = encodeURIComponent(db_user);
const pass = encodeURIComponent(db_password);
const url = `mysql://${user}:${pass}@${db_host}:${db_port}/${db_name}`;
process.env.DATABASE_URL = url;

function logInfo(msg) {
  console.log(`${new Date().toISOString()} - prisma-sync - INFO - ${msg}`);
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return res.status === 0;
}

const mode = (env.PRISMA_SYNC_MODE || 'push').toLowerCase();
const continueOnError = (env.PRISMA_SYNC_CONTINUE_ON_ERROR || 'true').toLowerCase() === 'true';
const runSeed = (env.PRISMA_RUN_SEED || 'true').toLowerCase() === 'true';

if (mode === 'pull') {
  logInfo(`Pulling schema from DB ${db_host}:${db_port}/${db_name}`);
  if (!run('npx', ['prisma', 'db', 'pull']) && !continueOnError) process.exit(1);
} else if (mode === 'push') {
  logInfo(`Pushing local schema to DB ${db_host}:${db_port}/${db_name}`);
  const acceptDataLoss = (env.PRISMA_ACCEPT_DATA_LOSS || 'true').toLowerCase() === 'true';
  const args = ['prisma', 'db', 'push'];
  if (acceptDataLoss) args.push('--accept-data-loss');
  if (!run('npx', args) && !continueOnError) process.exit(1);
} else if (mode === 'generate') {
  logInfo('Skipping schema sync, generating Prisma client only');
} else if (mode === 'none') {
  logInfo('Skipping Prisma sync operations');
} else {
  logInfo(`Unknown mode "${mode}", defaulting to "push"`);
  if (!run('npx', ['prisma', 'db', 'push']) && !continueOnError) process.exit(1);
}

logInfo('Generating Prisma client');
if (!run('npx', ['prisma', 'generate']) && !continueOnError) process.exit(1);

if (runSeed) {
  logInfo('Running Prisma seed');
  if (!run('npx', ['prisma', 'db', 'seed']) && !continueOnError) process.exit(1);
}

logInfo('Done');
