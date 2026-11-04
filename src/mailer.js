// Transactional email. Uses Resend's HTTP API when RESEND_API_KEY is set,
// otherwise logs the message so local development works without an account.
export function createMailer(config) {
  return async function sendMail({ to, subject, text }) {
    if (!config.mail.resendApiKey) {
      console.log(`[mail] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.mail.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mail.from, to, subject, text }),
    });
    if (!res.ok) console.error(`[mail] send failed: ${res.status} ${await res.text()}`);
  };
}
