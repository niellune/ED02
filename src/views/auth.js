import { html } from './html.js';
import { layout } from './layout.js';

function authShell(ctx, title, inner) {
  return layout({ ctx, title, noindex: true, body: html`<section class="wrap auth"><div class="card">${inner}</div></section>` });
}

export function signupPage(ctx, { error, email = '', plan } = {}) {
  return authShell(ctx, 'Create your account', html`
    <h1>Create your free account</h1>
    <p class="muted">3 dynamic QR codes free. No credit card.</p>
    ${error ? html`<p class="error">${error}</p>` : ''}
    <form method="post" action="/signup" class="stack">
      ${plan ? html`<input type="hidden" name="plan" value="${plan}">` : ''}
      <label>Email<input name="email" type="email" required autocomplete="email" value="${email}" maxlength="200"></label>
      <label>Password<input name="password" type="password" required minlength="8" maxlength="200" autocomplete="new-password"></label>
      <button class="btn block">Create account</button>
    </form>
    <p class="small muted">By signing up you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.</p>
    <p class="small">Already have an account? <a href="/login">Log in</a></p>`);
}

export function loginPage(ctx, { error, email = '', notice } = {}) {
  return authShell(ctx, 'Log in', html`
    <h1>Welcome back</h1>
    ${notice ? html`<p class="notice">${notice}</p>` : ''}
    ${error ? html`<p class="error">${error}</p>` : ''}
    <form method="post" action="/login" class="stack">
      <label>Email<input name="email" type="email" required autocomplete="email" value="${email}" maxlength="200"></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password" maxlength="200"></label>
      <button class="btn block">Log in</button>
    </form>
    <p class="small"><a href="/forgot">Forgot your password?</a> · <a href="/signup">Create an account</a></p>`);
}

export function forgotPage(ctx, { sent } = {}) {
  return authShell(ctx, 'Reset password', html`
    <h1>Reset your password</h1>
    ${sent
      ? html`<p class="notice">If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>`
      : html`<form method="post" action="/forgot" class="stack">
          <label>Email<input name="email" type="email" required maxlength="200"></label>
          <button class="btn block">Send reset link</button>
        </form>`}`);
}

export function resetPage(ctx, { token, error, invalid } = {}) {
  return authShell(ctx, 'Choose a new password', invalid
    ? html`<h1>Link expired</h1><p>This reset link is invalid or has expired. <a href="/forgot">Request a new one</a>.</p>`
    : html`
    <h1>Choose a new password</h1>
    ${error ? html`<p class="error">${error}</p>` : ''}
    <form method="post" action="/reset/${token}" class="stack">
      <label>New password<input name="password" type="password" required minlength="8" maxlength="200" autocomplete="new-password"></label>
      <button class="btn block">Save password</button>
    </form>`);
}
