import fs from 'fs';

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

(async () => {
  try {
    const env = loadEnv('.env');
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = env.WHATSAPP_API_VERSION || 'v19.0';
    const apiUrl = env.WHATSAPP_API_URL || 'https://graph.facebook.com';

    if (!phoneNumberId || !accessToken) {
      console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in .env');
      process.exit(1);
    }

    const to = '+27725985706';
    const bodyText = 'E2E real send test from Levy bot';

    const url = `${apiUrl}/${apiVersion}/${phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: bodyText },
      }),
    });

    const json = await res.json().catch(() => null);
    console.log('STATUS', res.status);
    console.log('RESPONSE', json);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
