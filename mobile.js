/* ============================================================
   mobile.js — wired interactions for the mobile recipe prototype
   Addendum 005. Vanilla JS, no framework. Role-play ready:
   footer nav · bottom-sheets · tax/yield auto-calc · steppers · QR.
   ============================================================ */
(function () {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  /* ---------- per-screen chrome (title, progress, FAB, action bar) ---------- */
  const META = {
    overview:    { title: 'Kaju Katli',         sub: 'Sweets · v1.2 · Published',        progress: true,
                   abar: [{ label: '＋ New Version', cls: 'btn-outline', sheet: 'sheet-version' },
                          { label: '🏭 Production', cls: 'btn-teal', sheet: 'sheet-production' }] },
    ingredients: { title: 'Ingredients',         sub: 'Kaju Katli · v1.2 · 50 kg batch',  progress: false,
                   fab: 'sheet-adding' },
    batch:       { title: 'Batch & Packaging',   sub: 'Kaju Katli · v1.2',                progress: false,
                   fab: 'sheet-batch' },
    method:      { title: 'Method',              sub: 'Kaju Katli · v1.2',                progress: false,
                   fab: 'sheet-step' },
    costing:     { title: 'Costing',             sub: 'Kaju Katli · v1.2 · 50 kg batch',  progress: false,
                   abar: [{ label: '🧫 Create Sample Batch', cls: 'btn-outline', sheet: 'sheet-sample' }] },
  };

  const hdrTitle = $('#hdrTitle'), hdrSub = $('#hdrSub'), progBar = $('#progBar'),
        fab = $('#fab'), abar = $('#abar'), backBtn = $('.wh-back');

  let current = null;
  const history = [];

  function nav(screen, fromBack) {
    const meta = META[screen]; if (!meta) return;
    if (current && !fromBack && current !== screen) history.push(current);
    current = screen;
    // back arrow only when there's somewhere to go back to
    if (backBtn) backBtn.style.visibility = history.length ? 'visible' : 'hidden';
    $$('[data-screen]').forEach((s) => (s.hidden = s.dataset.screen !== screen));
    hdrTitle.textContent = meta.title;
    hdrSub.textContent = meta.sub;
    progBar.hidden = !meta.progress;
    // footer active (Costing lives under "More")
    const activeNav = screen === 'costing' ? 'more' : screen;
    $$('.ti').forEach((t) => t.classList.toggle('on', t.dataset.nav === activeNav));
    // FAB
    if (meta.fab) { fab.hidden = false; fab.dataset.sheetOpen = meta.fab; }
    else { fab.hidden = true; delete fab.dataset.sheetOpen; }
    // action bar
    if (meta.abar) {
      abar.hidden = false;
      abar.innerHTML = meta.abar.map((b) =>
        `<button class="btn-xl ${b.cls}" data-sheet-open="${b.sheet}">${b.label}</button>`).join('');
    } else { abar.hidden = true; abar.innerHTML = ''; }
    $('.body').scrollTop = 0;
  }

  /* ---------- bottom-sheets ---------- */
  const scrim = $('#scrim');
  function openSheet(id) {
    const sh = document.getElementById(id); if (!sh) return;
    scrim.classList.add('open');
    sh.classList.add('open');
  }
  function closeSheet() {
    scrim.classList.remove('open');
    $$('.sheet.open').forEach((s) => s.classList.remove('open'));
  }

  /* ---------- toast ---------- */
  const toast = $('#toast'); let toastT;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 1900);
  }

  /* ---------- tax calc (Create Ingredient) ---------- */
  function recalcTax(form) {
    const price = num($('[data-price]', form) && $('[data-price]', form).value);
    const sel = $('[data-tax-chips] .chip.sel', form);
    const rate = sel ? num(sel.dataset.tax) : 0;
    const after = price + price * rate / 100;
    const out = $('[data-price-after]', form);
    if (out) out.value = money(after);
  }

  /* ---------- two-way yield (Add Ingredient) ---------- */
  function recalcYield(scope, fromAfter) {
    const a = $('[data-actual]', scope), p = $('[data-yield-pct]', scope),
          af = $('[data-after]', scope), up = $('[data-unit-price]', scope), c = $('[data-cost]', scope);
    const pct = p ? num(p.value) : 100, f = pct > 0 ? pct / 100 : 1;
    if (fromAfter && a && af) a.value = round(num(af.value) / f);
    else if (a && af) af.value = round(num(a.value) * f);
    if (c) c.value = money(num(a && a.value) * num(up && up.value)); // cost = actual × price
  }
  const round = (n) => Math.round(n * 1000) / 1000;

  /* ---------- QR preview ---------- */
  function hashCode(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
  function renderQR(el) {
    const payload = el.dataset.qrPayload || '';
    const size = 44, N = 21, cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d'), cell = size / N;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#111';
    let h = hashCode(payload);
    const bit = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h & 1; };
    const finder = (ox, oy) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      if (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) ctx.fillRect((ox + x) * cell, (oy + y) * cell, cell, cell); } };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if ((x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9)) continue;
      if (bit()) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    el.innerHTML = ''; el.appendChild(cv);
  }

  /* ---------- delegated events ---------- */
  document.addEventListener('click', (e) => {
    // header back
    if (e.target.closest('.wh-back')) {
      if (history.length) { closeSheet(); nav(history.pop(), true); }
      return;
    }
    // footer nav / menu nav
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      const t = navBtn.dataset.nav;
      if (t === 'more') { openSheet('sheet-more'); return; }
      closeSheet(); nav(t); return;
    }
    // sheet open
    const so = e.target.closest('[data-sheet-open]');
    if (so) { openSheet(so.dataset.sheetOpen); }
    // toast (before close so sheet still in DOM is fine)
    const tt = e.target.closest('[data-toast]');
    if (tt) { showToast(tt.dataset.toast); }
    // sheet close
    if (e.target.closest('[data-sheet-close]') || e.target === scrim) { closeSheet(); }
    // single-select chip groups (tax %, scaling on/off, etc.)
    const chip = e.target.closest('.chips .chip');
    if (chip) {
      const group = chip.parentElement;
      $$('.chip', group).forEach((c) => c.classList.toggle('sel', c === chip));
      if (group.matches('[data-tax-chips]')) recalcTax(group.closest('[data-tax-form]'));
    }
    // chip-tabs (method override tabs)
    const ct = e.target.closest('[data-chiptabs] [data-method]');
    if (ct) {
      const bar = ct.closest('[data-chiptabs]');
      $$('[data-method]', bar).forEach((b) => b.classList.toggle('on', b === ct));
      const id = ct.dataset.method;
      $$('[data-method-panel]').forEach((p) => (p.hidden = p.dataset.methodPanel !== id));
    }
    // stepper ±
    const step = e.target.closest('[data-step]');
    if (step) {
      const wrap = step.closest('.stepper'), val = $('[data-step-val]', wrap);
      const next = Math.max(0, num(val.textContent) + num(step.dataset.step));
      val.textContent = next;
    }
  });

  // live recalc on input
  document.addEventListener('input', (e) => {
    const taxForm = e.target.closest('[data-tax-form]');
    if (taxForm && e.target.matches('[data-price]')) recalcTax(taxForm);
    const yScope = e.target.closest('[data-yield]');
    if (yScope) recalcYield(yScope, e.target.matches('[data-after]'));
  });

  /* ---------- boot ---------- */
  $$('[data-qr]').forEach(renderQR);
  nav('overview');
})();
