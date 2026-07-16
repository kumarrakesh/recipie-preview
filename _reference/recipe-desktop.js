/* ============================================================
   recipe-desktop.js — Addendum 008 (feedback-3 desktop shell)
   Adds the three things the new shell needs on top of recipe.js:
     1. In-page tab switching (5 tabs, no page reloads)
     2. Role gating (Owner / Creator / Costing / QA / Worker)
     3. "How much to make" scaler on the Production Use tab
   recipe.js (drawers, tax, two-way yield, add-row, row-expand,
   autosuggest, product picker, sub-tabs, QR) is loaded alongside
   and reused unchanged.
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  /* ---------- 1. In-page tabs ---------- */
  function showTab(id) {
    $$('[data-panel]').forEach((p) => { p.hidden = p.getAttribute('data-panel') !== id; });
    $$('[data-tab-to]').forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab-to') === id));
    // re-apply role gating (newly shown panel may hold gated nodes)
    applyRole(currentRole);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab-to]');
    if (!t) return;
    e.preventDefault();
    showTab(t.getAttribute('data-tab-to'));
  });

  /* ---------- 2. Role gating ----------
     Each gated node carries data-show="owner costing …" (space list of
     roles allowed to see it). Worker is intentionally steered to mobile. */
  const ROLE_META = {
    owner:   { label: 'Owner', icon: '👑', note: 'You see cost, profit, approval and history — the full planning view.' },
    creator: { label: 'Recipe Creator', icon: '🧑‍🍳', note: 'You see ingredients, method, trials and history. Pricing shows as alerts only.' },
    costing: { label: 'Costing User', icon: '🧮', note: 'You see full costing — ingredient prices, extra costs, cost per pack and profit estimate.' },
    qa:      { label: 'QA Tester', icon: '🔬', note: 'You see trial samples, quality scores and the approve / rework decision.' },
    worker:  { label: 'Production Worker', icon: '👷', note: 'Workers use the mobile app for production. On desktop, pricing and version internals are hidden.' },
  };
  let currentRole = 'owner';
  function applyRole(role) {
    currentRole = role;
    document.body.setAttribute('data-role', role);
    $$('[data-show]').forEach((el) => {
      const allowed = (el.getAttribute('data-show') || '').split(/\s+/);
      el.classList.toggle('role-hidden', !(allowed.includes(role) || allowed.includes('all')));
    });
    const meta = ROLE_META[role];
    const banner = $('#role-banner');
    if (banner && meta) banner.innerHTML = `<span class="ic">${meta.icon}</span><span>Viewing as <b>${meta.label}</b> · ${meta.note}</span>`;
  }
  const sw = $('#role-switch');
  if (sw) sw.addEventListener('change', () => applyRole(sw.value));

  /* ---------- 3. "How much to make" scaler (Production Use) ----------
     Base batch = 50 kg. Each ingredient row holds data-base (qty for the
     base batch). Entering a target output scales every quantity + the
     expected output proportionally. Near-zero typing: one number drives all. */
  const BASE_OUTPUT = 50; // kg, the 50 kg Regular batch
  function scaleMaking() {
    const target = num($('#make-qty') && $('#make-qty').value) || BASE_OUTPUT;
    const factor = target / BASE_OUTPUT;
    $$('[data-base]').forEach((cell) => {
      const base = num(cell.getAttribute('data-base'));
      const unit = cell.getAttribute('data-unit') || '';
      const scaled = base * factor;
      cell.textContent = (Math.round(scaled * 1000) / 1000) + (unit ? ' ' + unit : '');
    });
    const eo = $('#make-expected');
    if (eo) eo.textContent = (Math.round(target * 0.96 * 100) / 100) + ' kg'; // ~4% process loss
    const fc = $('#make-factor');
    if (fc) fc.textContent = '×' + (Math.round(factor * 100) / 100);
  }
  const mq = $('#make-qty');
  if (mq) mq.addEventListener('input', scaleMaking);
  $$('#make-unit button').forEach((b) => b.addEventListener('click', () => {
    $$('#make-unit button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  /* ---------- boot ---------- */
  function boot() {
    applyRole('owner');
    showTab('recipe');
    scaleMaking();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
