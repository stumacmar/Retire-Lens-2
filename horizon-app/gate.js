/* Someday · preview gate.
 * A passphrase screen in front of every page while the site is not yet
 * launched. Nothing behind it is visible until the phrase is entered once on
 * this device. This is a courtesy gate on a static site, not security: the
 * code and content are public to anyone who reads the source.
 *
 * To change the phrase:  printf 'someday-gate:NEW PHRASE' | sha256sum
 * and paste the hash into HASH. To launch: set ENABLED = false (and remove
 * the noindex meta tags / robots.txt). A tester link can carry it:
 *   https://…/?gate=the-phrase
 */
(function () {
  var ENABLED = true;
  var HASH = 'cb324a4b2e31c92710892f6da1e947047d1c681ef5f94edeab60eac54b828e8f';
  var KEY = 'someday-gate-v1';
  var SALT = 'someday-gate:';
  if (!ENABLED) return;
  try { if (localStorage.getItem(KEY) === HASH) return; } catch (e) { /* fall through */ }

  function sha256(text) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('This page needs a secure (https) address to check the phrase.'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function unlock(hash) {
    try { localStorage.setItem(KEY, hash); } catch (e) { /* private mode: lasts the page */ }
    var el = document.getElementById('someday-gate'); if (el) el.remove();
    document.documentElement.style.overflow = '';
  }

  // A link with ?gate=phrase unlocks without typing (for testers).
  try {
    var u = new URL(location.href), q = u.searchParams.get('gate');
    if (q) {
      sha256(SALT + q).then(function (h) {
        if (h === HASH) {
          unlock(h);
          u.searchParams.delete('gate');   // keep any other parameters (e.g. ?licence=)
          history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
        }
      }).catch(function () { /* shown on submit */ });
    }
  } catch (e) { /* ignore */ }

  function render() {
    if (document.getElementById('someday-gate')) return;
    document.documentElement.style.overflow = 'hidden';
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var el = document.createElement('div');
    el.id = 'someday-gate';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Private preview');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;'
      + 'background:' + (dark ? '#161210' : '#F9F6F0') + ';color:' + (dark ? '#ede8e0' : '#2C2C2C') + ';'
      + 'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;';
    el.innerHTML =
      '<form style="width:100%;max-width:400px" autocomplete="off">'
      + '<div style="font-size:0.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#64805f;margin-bottom:10px">Private preview</div>'
      + '<h1 style="font-size:1.7rem;font-weight:800;letter-spacing:-.02em;line-height:1.2;margin:0 0 8px">Someday isn’t open yet.</h1>'
      + '<p style="margin:0 0 20px;font-size:.95rem;line-height:1.5;color:' + (dark ? '#b0a898' : '#6b655a') + '">If you’ve been given the preview phrase, enter it once on this device.</p>'
      + '<input id="someday-gate-input" type="password" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Preview phrase" placeholder="Preview phrase" '
      + 'style="width:100%;box-sizing:border-box;height:52px;border-radius:16px;padding:0 16px;font-size:1.05rem;font-weight:600;outline:none;'
      + 'background:' + (dark ? '#211c17' : '#F4F0E9') + ';color:inherit;border:1px solid ' + (dark ? 'rgba(237,232,224,.10)' : 'rgba(44,44,44,.09)') + '">'
      + '<button type="submit" style="margin-top:12px;width:100%;height:52px;border:0;border-radius:16px;background:#D4A373;color:#fff;font-size:1.05rem;font-weight:800;cursor:pointer">Enter</button>'
      + '<p id="someday-gate-err" role="alert" style="min-height:1.4em;margin:10px 0 0;font-size:.85rem;color:#b0837e"></p>'
      + '</form>';
    document.body.appendChild(el);
    var input = el.querySelector('#someday-gate-input'), err = el.querySelector('#someday-gate-err');
    input.focus();
    el.querySelector('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = (input.value || '').trim();
      if (!v) return;
      sha256(SALT + v).then(function (h) {
        if (h === HASH) unlock(h);
        else { err.textContent = 'That’s not the phrase. Check for typos, or ask for it again.'; input.select(); }
      }).catch(function (e) { err.textContent = e && e.message ? e.message : 'Could not check the phrase.'; });
    });
  }
  if (document.body) render(); else document.addEventListener('DOMContentLoaded', render);
})();
