(async () => {
  try {
    const res = await fetch('http://localhost:8080/api/test-whatsapp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+27725985706', message: 'E2E real send test from Levy bot' }),
    });

    const json = await res.json().catch(() => null);
    console.log('STATUS', res.status);
    console.log(json);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
