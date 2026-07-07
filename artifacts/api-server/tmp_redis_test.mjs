import fs from 'fs';
import IORedis from 'ioredis';

function loadEnv(path = '.env') {
  if (!fs.existsSync(path)) return {};
  const raw = fs.readFileSync(path, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function normalizeRedisUrl(rawUrl) {
  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  const match = /(?:rediss?:|redis:)\/\/[^^\s"']+/i.exec(trimmed);
  return (match?.[0] ?? trimmed).trim();
}

(async () => {
  const env = loadEnv('../../.env') || loadEnv('../.env') || loadEnv('.env');
  const raw = env.REDIS_URL || process.env.REDIS_URL;
  if (!raw) {
    console.error('No REDIS_URL found in .env or environment');
    process.exit(1);
  }
  const normalized = normalizeRedisUrl(raw);
  console.log('Normalized REDIS_URL:', normalized);
  try {
    const client = new IORedis(normalized, { maxRetriesPerRequest: null });
    const res = await client.ping();
    console.log('Redis PING result:', res);
    await client.quit();
  } catch (err) {
    console.error('Redis connection failed:', err);
    process.exit(1);
  }
})();
