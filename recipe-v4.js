/* ============================================================
   recipe-v4.js — Addendum 009 + 010 (feedback-4 fork · desktop)
   Real lightweight vanilla JS for the minimalist 3-tab module.
   Reuses recipe.js (window.FB): drawers, addRow, renderQR, money/num.
   Adds: tab switch, ingredient bar proportions, inline row-edit
   + save, cost auto-totals, batch-size validation, batch-order QR.
   feedback-4.1 (010): yield in row-small, quality free-text, cost
   sub-tabs, inline cost editor (Unit added, no slider), stronger
   totals, and a non-destructive batch-size preview scaler.
   ============================================================ */
(function () {
  'use strict';
  const FB = window.FB || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = FB.num || ((v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; });
  const money = FB.money || ((n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
  // trim trailing zeros for quantity labels (e.g. 0.50 -> 0.5, 24.00 -> 24)
  const fmtQty = (n) => { n = Math.round(n * 1000) / 1000; return String(n); };

  /* ---------- batch-size preview (non-destructive) ----------
     Base recipe is authored at BASE_BATCH kg (factor 1). The preview
     only rescales *displayed* quantities/costs; edits target the base. */
  const BASE_BATCH = 100;
  let previewFactor = 1;

  /* ---------- tabs ---------- */
  function showTab(id) {
    $$('[data-v4panel]').forEach((p) => { p.hidden = p.getAttribute('data-v4panel') !== id; });
    $$('[data-v4tab]').forEach((t) => t.classList.toggle('on', t.getAttribute('data-v4tab') === id));
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-v4tab]');
    if (t) { e.preventDefault(); showTab(t.getAttribute('data-v4tab')); }
  });

  /* ---------- F1: recipe rail (master-detail) — select + search ---------- */
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.rl-item');
    if (!item) return;
    e.preventDefault();
    $$('.rl-item').forEach((x) => x.classList.remove('active'));
    item.classList.add('active');
    const h1 = $('.v4-head h1');
    if (h1) h1.textContent = item.getAttribute('data-recipe');
  });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'rail-search') return;
    const q = e.target.value.toLowerCase();
    $$('#rail-list .rl-item').forEach((it) => { it.hidden = !it.getAttribute('data-recipe').toLowerCase().includes(q); });
  });

  /* ---------- cost sub-tabs ---------- */
  function showCostSub(id) {
    $$('[data-costsub]').forEach((s) => s.classList.toggle('on', s.getAttribute('data-costsub') === id));
    $$('[data-costpanel]').forEach((p) => { p.hidden = p.getAttribute('data-costpanel') !== id; });
  }
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-costsub]');
    if (s) { e.preventDefault(); showCostSub(s.getAttribute('data-costsub')); }
  });

  /* ---------- ingredient proportional bars ----------
     Each .ing carries data-qty (BASE quantity); widest ingredient = 100%.
     The displayed qty label = base × previewFactor (bars stay proportional). */
  function drawBars() {
    const rows = $$('.ing');
    const max = Math.max(1, ...rows.map((r) => num(r.getAttribute('data-qty'))));
    rows.forEach((r) => {
      const base = num(r.getAttribute('data-qty'));
      const fill = $('.ing-fill', r);
      if (fill) fill.style.width = (base / max * 100) + '%';
      const q = $('.ing-qty', r);
      if (q) q.textContent = fmtQty(base * previewFactor) + ' ' + (r.getAttribute('data-unit') || 'kg');
    });
  }

  /* ---------- inline row-expand (only the selected row) ---------- */
  function rowSmall(brand, unit, yieldPct) {
    return (brand || '') + (unit ? ' · ' + unit : '') + (yieldPct ? ' · Yield ' + yieldPct + '%' : '');
  }
  document.addEventListener('click', (e) => {
    // toggle on header click, but not when interacting with the edit area
    const head = e.target.closest('.ing-row');
    if (head && !e.target.closest('.ing-edit')) {
      const ing = head.closest('.ing');
      const wasOpen = ing.classList.contains('open');
      $$('.ing.open').forEach((x) => x.classList.remove('open'));
      if (!wasOpen) ing.classList.add('open');
      return;
    }
    // inline Save: read edited fields back into the row, redraw bar, collapse
    const save = e.target.closest('[data-ing-save]');
    if (save) {
      e.preventDefault();
      const ing = save.closest('.ing');
      const qty = num($('[data-f=qty]', ing) && $('[data-f=qty]', ing).value);
      const unit = ($('[data-f=unit]', ing) && $('[data-f=unit]', ing).value) || 'kg';
      const brand = ($('[data-f=brand]', ing) && $('[data-f=brand]', ing).value) || '';
      const yieldPct = num($('[data-f=yield]', ing) && $('[data-f=yield]', ing).value);
      ing.setAttribute('data-qty', qty);          // qty edited = BASE value
      ing.setAttribute('data-unit', unit);
      ing.setAttribute('data-yield', yieldPct);
      const sub = $('.ing-row .nm small', ing);
      if (sub) sub.textContent = rowSmall(brand, unit, yieldPct);
      ing.classList.remove('open');
      drawBars();
      recalcYieldTile();
    }
  });

  /* ---------- add ingredient inline search ---------- */
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-open]');
    if (add) { e.preventDefault(); $('#add-search').hidden = false; add.hidden = true; $('#add-search input').focus(); }
    const opt = e.target.closest('.add-search .opt:not(.create)');
    if (opt) {
      e.preventDefault();
      appendIngredient(opt.textContent.trim(), 5, 'kg', '');
      closeAddSearch();
    }
  });
  function closeAddSearch() {
    const s = $('#add-search'); if (s) s.hidden = true;
    const b = $('[data-add-open]'); if (b) b.hidden = false;
    const inp = $('#add-search input'); if (inp) inp.value = '';
  }
  function appendIngredient(name, qty, unit, brand) {
    const list = $('.ing-list'); if (!list) return;
    const el = document.createElement('div');
    el.className = 'ing';
    el.setAttribute('data-qty', qty); el.setAttribute('data-unit', unit); el.setAttribute('data-yield', 98);
    el.innerHTML = ingMarkup(name, qty, unit, brand);
    list.appendChild(el);
    drawBars(); recalcYieldTile();
  }
  function ingMarkup(name, qty, unit, brand) {
    return `<div class="ing-row"><div class="nm">${name}<small>${rowSmall(brand || 'new', unit, 98)}</small></div>
      <div class="ing-track"><div class="ing-fill"></div></div><div class="ing-qty">${qty} ${unit}</div></div>
      <div class="ing-edit"><div class="grid">
        <div class="fld"><label class="label">Brand</label><input class="input" data-f="brand" value="${brand}"></div>
        <div class="fld"><label class="label">Quality</label><input class="input" data-f="quality" value=""></div>
        <div class="fld"><label class="label">Quantity</label><input class="input" data-f="qty" type="number" value="${qty}"></div>
        <div class="fld"><label class="label">Unit</label><select class="input" data-f="unit"><option ${unit==='kg'?'selected':''}>kg</option><option ${unit==='g'?'selected':''}>g</option><option ${unit==='litre'?'selected':''}>litre</option><option ${unit==='ml'?'selected':''}>ml</option><option ${unit==='pcs'?'selected':''}>pcs</option></select></div>
        <div class="fld"><label class="label">Yield %</label><input class="input" data-f="yield" type="number" value="98"></div>
      </div><div class="save-row"><button class="btn btn-sm btn-primary" data-ing-save>✓ Save</button></div></div>`;
  }
  // search filter
  document.addEventListener('input', (e) => {
    if (!e.target.matches('#add-search input')) return;
    const q = e.target.value.toLowerCase();
    $$('#add-search .opt:not(.create)').forEach((o) => { o.hidden = !o.textContent.toLowerCase().includes(q); });
  });

  /* ---------- expected yield (avg of row yields, display) ---------- */
  function recalcYieldTile() {
    const tile = $('#yield-value'); if (!tile) return;
    const ys = $$('.ing [data-f=yield]').map((i) => num(i.value)).filter((n) => n > 0);
    if (ys.length) tile.textContent = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length) + '%';
  }

  /* ---------- cost auto-totals + batch-size scaling ----------
     Sections marked [data-cost-scale] (ingredients, making) scale by
     previewFactor; packaging stays per-pack. Line data-* hold BASE values. */
  function renderCost() {
    let grand = 0;
    $$('[data-cost-sec]').forEach((sec) => {
      const scale = sec.hasAttribute('data-cost-scale');
      const f = scale ? previewFactor : 1;
      let sum = 0;
      $$('.cost-line', sec).forEach((l) => {
        const base = num(l.getAttribute('data-amount'));
        sum += base * f;
        // refresh editable-line display (ingredients). Making lines have no .cv.
        if (l.classList.contains('editable')) {
          const cv = $('.cv', l);
          if (cv) cv.textContent = money(base * f);
          const small = $('.cn small', l);
          if (small && !l.hasAttribute('data-keepsmall')) {
            const price = num(l.getAttribute('data-price'));
            const q = num(l.getAttribute('data-qtyv')) * f;
            const u = l.getAttribute('data-unit') || '';
            small.textContent = '₹' + price + ' × ' + fmtQty(q) + (u ? ' ' + u : '');
          }
        }
      });
      const out = $('[data-sec-total]', sec);
      if (out) out.textContent = money(sum);
      grand += sum;
    });
    const g = $('#grand-total'); if (g) g.textContent = money(grand);
    const gn = $('#grand-note'); if (gn) gn.textContent = 'at ' + fmtQty(BASE_BATCH * previewFactor) + ' kg';
  }

  /* ---------- inline cost editor (replaces old slider) ---------- */
  document.addEventListener('click', (e) => {
    // toggle editor on row click
    const clRow = e.target.closest('.cl-row');
    if (clRow) {
      const line = clRow.closest('.cost-line.editable');
      if (line) {
        const wasOpen = line.classList.contains('open');
        $$('.cost-line.editable.open').forEach((x) => x.classList.remove('open'));
        if (!wasOpen) line.classList.add('open');
        return;
      }
    }
    // inline Save
    const save = e.target.closest('[data-cost-save]');
    if (save) {
      e.preventDefault();
      const line = save.closest('.cost-line');
      const price = num($('[data-cf=price]', line) && $('[data-cf=price]', line).value);
      const qty = num($('[data-cf=qty]', line) && $('[data-cf=qty]', line).value) || 1;
      const unit = ($('[data-cf=unit]', line) && $('[data-cf=unit]', line).value) || '';
      const eff = price * qty;
      line.setAttribute('data-price', price);   // BASE values
      line.setAttribute('data-qtyv', qty);
      line.setAttribute('data-unit', unit);
      line.setAttribute('data-amount', eff);
      line.classList.remove('open');
      renderCost();
    }
  });
  // live "Effective Cost" preview while typing in an inline editor
  document.addEventListener('input', (e) => {
    const edit = e.target.closest('.cl-edit');
    if (!edit) return;
    const line = e.target.closest('.cost-line');
    const price = num($('[data-cf=price]', line) && $('[data-cf=price]', line).value);
    const qty = num($('[data-cf=qty]', line) && $('[data-cf=qty]', line).value) || 1;
    const out = $('[data-cf=eff]', line);
    if (out) out.textContent = money(price * qty);
  });

  // making-cost add/delete + amount edits
  document.addEventListener('click', (e) => {
    const del = e.target.closest('[data-cost-del]');
    if (del) { e.preventDefault(); const l = del.closest('.cost-line'); if (l) { l.remove(); renderCost(); } }
    const addc = e.target.closest('[data-add-cost]');
    if (addc) {
      e.preventDefault();
      const list = $('#making-list');
      const el = document.createElement('div');
      el.className = 'cost-line'; el.setAttribute('data-amount', '0');
      el.innerHTML = `<div class="cn"><input class="input" placeholder="Cost name" style="max-width:220px"></div>
        <input class="input" type="number" placeholder="0" style="width:110px" data-cost-amt>
        <button class="btn btn-sm" data-cost-del>✕</button>`;
      list.appendChild(el);
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-cost-amt]')) {
      const l = e.target.closest('.cost-line');
      l.setAttribute('data-amount', num(e.target.value));   // BASE value
      renderCost();
    }
  });

  /* ---------- batch-size preview handler ---------- */
  document.addEventListener('change', (e) => {
    if (e.target.matches('#batch-size')) {
      previewFactor = num(e.target.value) / BASE_BATCH;
      drawBars();
      renderCost();
    }
  });

  /* ---------- production: batch-size validation + create batch ---------- */
  const ALLOWED = [50, 100, 200]; // supported batch sizes (kg)
  function validateBatch() {
    const sel = $('#pb-size'); if (!sel) return true;
    const v = num(sel.value);
    const ok = ALLOWED.includes(v);
    const warn = $('#batch-warn'); if (warn) warn.classList.toggle('on', !ok);
    const btn = $('#create-batch'); if (btn) btn.disabled = !ok;
    return ok;
  }
  document.addEventListener('change', (e) => { if (e.target.matches('#pb-size')) validateBatch(); });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#create-batch')) return;
    e.preventDefault();
    if (!validateBatch()) return;
    const n = 180 + Math.floor(Math.random() * 40);
    const no = 'PB-2026-' + String(n).padStart(5, '0');
    $('#pb-number').textContent = no;
    const card = $('#order-card'); if (card) card.classList.add('on');
    const qr = $('#pb-qr');
    if (qr && FB.renderQR) {
      qr.setAttribute('data-qr-payload', 'recipe=PBC;ver=V4.2;batch=' + $('#pb-size').value + ';no=' + no);
      qr.setAttribute('data-qr-size', '108');
      FB.renderQR(qr);
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  // "create new recipe version" from the validation warning
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-warn-newver]')) { e.preventDefault(); FB.openDrawer && FB.openDrawer('drawer-newversion'); }
  });

  /* ---------- Save As New Version: batch-size chips ---------- */
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.size-pick .chip');
    if (c) { e.preventDefault(); c.classList.toggle('sel'); }
  });

  /* ---------- boot ---------- */
  function boot() {
    showTab('ingredients');
    showCostSub('ing');
    drawBars();
    renderCost();
    validateBatch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
