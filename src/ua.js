// Tiny user-agent classifier. We deliberately keep only coarse buckets:
// enough for useful analytics, not enough to fingerprint anyone.
export function classifyUA(ua = '') {
  const s = String(ua);
  const device = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))
    ? 'tablet'
    : /Mobi|iPhone|iPod|Android/i.test(s) ? 'mobile' : 'desktop';
  const os = /iPhone|iPad|iPod/i.test(s) ? 'iOS'
    : /Android/i.test(s) ? 'Android'
    : /Windows/i.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(s) ? 'macOS'
    : /CrOS/i.test(s) ? 'ChromeOS'
    : /Linux/i.test(s) ? 'Linux' : 'Other';
  const browser = /Edg\//i.test(s) ? 'Edge'
    : /SamsungBrowser/i.test(s) ? 'Samsung Internet'
    : /CriOS|Chrome\//i.test(s) ? 'Chrome'
    : /FxiOS|Firefox\//i.test(s) ? 'Firefox'
    : /Safari\//i.test(s) ? 'Safari' : 'Other';
  return { device, os, browser };
}

export function isBot(ua = '') {
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|python-requests|headless/i.test(ua);
}
