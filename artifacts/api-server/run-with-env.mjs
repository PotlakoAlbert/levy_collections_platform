import { readFile } from 'node:fs/promises';
import path from 'node:path';

const isProduction = process.argv.includes('--production');
process.env.NODE_ENV = isProduction ? 'production' : (process.env.NODE_ENV || 'development');

function applyEnvLines(txt) {
  txt.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

async function loadDotEnvFile() {
  const rootEnv = path.resolve(process.cwd(), '..', '..', '.env');
  const localEnv = path.resolve(process.cwd(), '.env');

  try {
    applyEnvLines(await readFile(rootEnv, 'utf8'));
    console.log('Loaded .env from', rootEnv);
  } catch (err) {
    console.warn('Could not load root .env file:', err.message);
  }

  try {
    applyEnvLines(await readFile(localEnv, 'utf8'));
    console.log('Loaded .env from', localEnv, '(overrides root)');
  } catch (err) {
    console.warn('Could not load local .env file:', err.message);
  }
}

await loadDotEnvFile();

// Import the built server bundle
import('./dist/index.mjs').catch((err) => {
  console.error('Failed to start server bundle:', err);
  process.exit(1);
});
