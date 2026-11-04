// Progressive enhancement only: every page works without JavaScript.
(function () {
  // Live preview for the free static generator.
  const data = document.getElementById('gen-data');
  if (data) {
    const fg = document.getElementById('gen-fg');
    const bg = document.getElementById('gen-bg');
    const ecc = document.getElementById('gen-ecc');
    const img = document.getElementById('gen-img');
    const png = document.getElementById('gen-png');
    const svg = document.getElementById('gen-svg');
    const warn = document.getElementById('gen-warn');
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    let timer;
    const update = () => {
      const value = data.value.trim() || ' ';
      const q = new URLSearchParams({ data: value, fg: fg.value, bg: bg.value, ecc: ecc.value });
      img.src = `/api/qr?${q}&format=svg`;
      png.href = `/api/qr?${q}&format=png&download=1`;
      svg.href = `/api/qr?${q}&format=svg&download=1`;
      const lf = lum(fg.value); const lb = lum(bg.value);
      const bad = lf >= lb || (lb + 0.05) / (lf + 0.05) < 4;
      warn.hidden = !bad;
      warn.textContent = bad ? 'Heads up: low contrast or a light-on-dark code may not scan on many phones.' : '';
    };
    [data, fg, bg, ecc].forEach((el) => el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 200); }));
  }

  // Copy short links.
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = old; }, 1200);
      } catch { /* clipboard unavailable */ }
    });
  });

  // Confirm destructive actions.
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (e) => { if (!window.confirm(form.dataset.confirm)) e.preventDefault(); });
  });
})();
