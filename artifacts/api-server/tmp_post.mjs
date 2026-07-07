(async () => {
  try {
    const res = await fetch('http://localhost:8080/api/test-whatsapp-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+27725985706', messageText: 'E2E test: Hello from Levy bot' }),
    });

    const text = await res.text();
    console.log('STATUS', res.status);
    console.log(text);
  } catch (err) {
    console.error('ERROR', err);
  }
})();
