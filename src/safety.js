// Destination validation. Redirect services are a magnet for phishing and
// malware, so we are strict about what we accept and keep a blocklist that the
// operator can extend via BLOCKED_DOMAINS.
const BUILTIN_BLOCKED = [
  // Other URL shorteners: chaining hides the real destination from abuse review.
  'bit.ly', 'tinyurl.com', 'is.gd', 't.co', 'goo.gl', 'ow.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc',
];

export function blockedDomains(env = process.env) {
  const extra = (env.BLOCKED_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  return new Set([...BUILTIN_BLOCKED, ...extra]);
}

export function validateDestination(input, { ownHost, blocked = blockedDomains() } = {}) {
  let value = String(input || '').trim();
  if (!value) return { error: 'Please enter a destination URL.' };
  if (value.length > 2000) return { error: 'That URL is too long (max 2000 characters).' };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: 'That does not look like a valid URL.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: 'Only http:// and https:// links are supported.' };
  }
  if (url.username || url.password) return { error: 'URLs containing credentials are not allowed.' };

  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || /^[\d.]+$/.test(host) || host.startsWith('[')) {
    return { error: 'Please link to a public domain name, not an IP address or local host.' };
  }
  if (ownHost && host === ownHost.toLowerCase()) {
    return { error: 'A code cannot point back to this service.' };
  }
  for (const d of blocked) {
    if (host === d || host.endsWith(`.${d}`)) return { error: `Links to ${d} are not allowed.` };
  }
  return { url: url.toString() };
}

export function normalizeHex(input, fallback) {
  const v = String(input || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return fallback;
}

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Scanners need dark modules on a light background with decent contrast.
// Rejecting bad combos up front saves customers from printing unscannable codes.
export function colorProblem(fg, bg) {
  const lf = luminance(fg);
  const lb = luminance(bg);
  if (lf >= lb) return 'The foreground must be darker than the background, or many phones will not scan it.';
  const ratio = (lb + 0.05) / (lf + 0.05);
  if (ratio < 4) return 'Those colors are too similar to scan reliably. Pick a darker foreground or lighter background.';
  return null;
}
