/**
 * Someday — friendly front door for the planner.
 *
 * The spreadsheet (nine tabs) is powerful but intimidating cold. This shows a
 * calm, plain-English welcome on a first visit, orients the person, and walks
 * them into their own details — then gets out of the way. It never touches the
 * maths or the saved plan; it's purely a gentle way in. Self-styled so it needs
 * no external CSS, and shown once (remembered in local storage).
 */

const SEEN_KEY = 'rl_welcomed_v1';

function alreadyWelcomed() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markWelcomed() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
}
function isAutomated() {
  try { return typeof navigator !== 'undefined' && navigator.webdriver === true; } catch { return false; }
}

function injectStyles() {
  if (document.getElementById('rl-welcome-styles')) return;
  const s = document.createElement('style');
  s.id = 'rl-welcome-styles';
  s.textContent = `
  .rl-wel-overlay{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;
    padding:1rem;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow-y:auto;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.55;}
  .rl-wel-card{width:100%;max-width:500px;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.28);
    padding:2rem 1.9rem;margin:auto;}
  .rl-wel-badge{font-size:2rem;line-height:1;margin-bottom:.6rem;}
  .rl-wel-card h1{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin:0 0 .6rem;}
  .rl-wel-lead{color:#475569;margin:0 0 1.25rem;font-size:1.02rem;}
  .rl-wel-steps{list-style:none;padding:0;margin:0 0 1.5rem;display:grid;gap:.85rem;}
  .rl-wel-steps li{display:flex;gap:.8rem;align-items:flex-start;}
  .rl-wel-num{flex:0 0 auto;width:1.8rem;height:1.8rem;border-radius:50%;background:#0e7a6e;color:#fff;
    font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.9rem;}
  .rl-wel-steps b{display:block;font-size:.98rem;}
  .rl-wel-steps span{color:#64748b;font-size:.9rem;}
  .rl-wel-btn{display:block;width:100%;text-align:center;background:#0e7a6e;color:#fff;border:none;border-radius:12px;
    padding:.9rem 1rem;font-size:1.05rem;font-weight:700;cursor:pointer;}
  .rl-wel-btn:hover{background:#0b6459;}
  .rl-wel-btn:focus-visible{outline:3px solid #99f6e4;outline-offset:2px;}
  .rl-wel-skip{display:block;width:100%;text-align:center;background:none;border:none;color:#64748b;
    margin-top:.75rem;font-size:.9rem;cursor:pointer;text-decoration:underline;}
  .rl-wel-note{margin-top:1rem;font-size:.8rem;color:#94a3b8;text-align:center;}`;
  document.head.appendChild(s);
}

function goToDetails() {
  // Send them straight to their details in plain-English form.
  const tab = document.querySelector('[data-tab="assumptions"]');
  if (tab) tab.click();
}

function show() {
  injectStyles();
  const el = document.createElement('div');
  el.className = 'rl-wel-overlay';
  el.innerHTML = `
    <div class="rl-wel-card" role="dialog" aria-modal="true" aria-labelledby="rl-wel-title">
      <div class="rl-wel-badge" aria-hidden="true">👋</div>
      <h1 id="rl-wel-title">Can you afford to retire? Let's find out.</h1>
      <p class="rl-wel-lead">This is built from a real, tested spreadsheet, so the sums are solid — but I'll keep it in plain English. It takes about five minutes, and nothing you type ever leaves your device.</p>
      <ol class="rl-wel-steps">
        <li><span class="rl-wel-num">1</span><div><b>Tell it about you</b><span>Your names, ages, when you'd like to stop work, your pensions and savings.</span></div></li>
        <li><span class="rl-wel-num">2</span><div><b>See your answer</b><span>A clear yes / not-yet, and how long your money lasts.</span></div></li>
        <li><span class="rl-wel-num">3</span><div><b>Explore if you want</b><span>Tabs across the top show the detail — tax, income year by year, and more.</span></div></li>
      </ol>
      <button class="rl-wel-btn" id="rl-wel-start">Start with my details →</button>
      <button class="rl-wel-skip" id="rl-wel-skip">Skip — take me straight to the numbers</button>
      <p class="rl-wel-note">You can change anything later. Your figures stay on this device.<br>
        <a href="friendly.html" style="color:#0e7a6e;">Why I built this</a> · <a href="legal.html" style="color:#0e7a6e;">the important bit (not advice)</a></p>
    </div>`;
  document.body.appendChild(el);

  const close = (details) => {
    markWelcomed();
    el.remove();
    if (details) goToDetails();
  };
  el.querySelector('#rl-wel-start').addEventListener('click', () => close(true));
  el.querySelector('#rl-wel-skip').addEventListener('click', () => close(false));
  el.querySelector('#rl-wel-start').focus();
}

function disclaimerAccepted() {
  // Mirrors js/access.js: once the gate is accepted this key is set, so we can
  // proceed even if the overlay element lingers for a frame.
  try { return !!localStorage.getItem('rl_disclaimer_accepted_v'); } catch { return false; }
}

function init() {
  if (isAutomated() || alreadyWelcomed()) return;
  // Wait until the app's tabs exist AND the disclaimer gate is out of the way,
  // so we never cover it. Time-bounded: after ~6s (or once the disclaimer is
  // recorded as accepted) greet anyway, so a gate glitch can never permanently
  // suppress the only guided way in.
  let tries = 0;
  const start = () => {
    const tabsReady = !!document.getElementById('tabs');
    const gateClear = !document.querySelector('.rl-gate-overlay') || disclaimerAccepted();
    if (tabsReady && (gateClear || tries > 30)) show();
    else { tries++; setTimeout(start, 200); }
  };
  start();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  else setTimeout(init, 400);
}
