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

/* ============================================================
   Addendum 004 — feedback-4.4 · Cost-Iteration (Target & Margin) SHEET
   Desktop-only Excel-like cost sheet: editable ingredient grid
   (add / edit / delete rows) + live cost & margin build-up ladder.
   Non-destructive what-if until Apply. Two seeds: bakery cookies +
   masala (real data from inputs/CLASSIC NOODLES SAMP-2.xlsx).
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const round2 = (n) => Math.round(n * 100) / 100;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // seed mirrors seed-data/seed.json (embedded: prototype runs from file://)
  const SEED = {
    cookies: {
      name: 'Premium Butter Cookies', basis: 'batch', batchKg: 100, markup: 25, target: 40,
      ing: [
        { name: 'Butter', rate: 68.33, qty: 12, unit: 'kg' },
        { name: 'Milk Powder', rate: 90, qty: 6, unit: 'kg' },
        { name: 'Sugar', rate: 40, qty: 15, unit: 'kg' },
        { name: 'Flour', rate: 31.82, qty: 22, unit: 'kg' },
        { name: 'Salt', rate: 40, qty: 0.5, unit: 'kg' }
      ],
      making: [{ name: 'Labour', amount: 250 }, { name: 'Electricity', amount: 90 }, { name: 'Gas', amount: 60 }]
    },
    masala: {
      name: 'Classic Noodles Masala', basis: 'per1000g', markup: 20, target: 116,
      ing: [
        { name: 'Onion Pdr', rate: 110, qty: 50, unit: 'g' },
        { name: 'Garlic Flake', rate: 120, qty: 35, unit: 'g' },
        { name: 'Garlic Pdr (white)', rate: 90, qty: 130, unit: 'g' },
        { name: 'Zira Pdr', rate: 300, qty: 6, unit: 'g' },
        { name: 'Modified Starch', rate: 50, qty: 75, unit: 'g' },
        { name: 'I+G', rate: 660, qty: 2, unit: 'g' },
        { name: 'Anti-cake', rate: 130, qty: 5, unit: 'g' },
        { name: 'Salt', rate: 9, qty: 210, unit: 'g' },
        { name: 'Citric (anhydrous)', rate: 110, qty: 2, unit: 'g' },
        { name: 'Sugar (Sabut)', rate: 47, qty: 260, unit: 'g' },
        { name: 'Dextrose Sugar', rate: 58, qty: 65, unit: 'g' },
        { name: 'Haldi', rate: 200, qty: 10, unit: 'g' },
        { name: 'Aamchur', rate: 220, qty: 9, unit: 'g' },
        { name: 'MSG', rate: 120, qty: 95, unit: 'g' },
        { name: 'Soaf (fennel)', rate: 160, qty: 35, unit: 'g' },
        { name: 'Noodles', rate: 42, qty: 100, unit: 'g' },
        { name: 'Malto', rate: 52, qty: 115, unit: 'g' },
        { name: 'Methi', rate: 85, qty: 12, unit: 'g' },
        { name: 'Kasturi Methi', rate: 150, qty: 7, unit: 'g' },
        { name: 'Star Anis', rate: 700, qty: 1, unit: 'g' },
        { name: 'DNS Garam Masala', rate: 350, qty: 18, unit: 'g' },
        { name: 'Curcumin', rate: 750, qty: 2, unit: 'g' },
        { name: 'Black Salt', rate: 30, qty: 50, unit: 'g' },
        { name: 'Oil Palm', rate: 150, qty: 10, unit: 'g' },
        { name: 'Red Chilli', rate: 210, qty: 60, unit: 'g' },
        { name: 'Masala Top Note (GIV)', rate: 1560, qty: 1, unit: 'g' }
      ],
      making: [{ name: 'Labour', amount: 5 }, { name: 'Packing', amount: 3.5 }, { name: 'Transport', amount: 3 }, { name: 'Wastage + Electricity', amount: 4 }]
    }
  };
  const RAIL = { 'Premium Butter Cookies': 'cookies', 'Classic Noodles Masala': 'masala' };
  const UNITS = ['kg', 'g', 'litre', 'ml', 'pcs'];

  let cur = 'cookies', work = null, base = null;
  const makPerKg = (m) => work.basis === 'per1000g' ? m.amount : m.amount / (work.batchKg || 1);

  // per-kg economics for a product copy
  function econ(p) {
    const per = p.basis === 'per1000g';
    const f = per ? 0.001 : 1;
    const rowAmt = (it) => it.rate * it.qty * f;
    const ingAmtTotal = p.ing.reduce((s, it) => s + rowAmt(it), 0);
    const totalKg = per ? p.ing.reduce((s, it) => s + it.qty, 0) / 1000 : p.batchKg;
    const ingPerKg = totalKg ? (per ? ingAmtTotal / totalKg : ingAmtTotal / p.batchKg) : 0;
    const makTotal = p.making.reduce((s, m) => s + m.amount, 0);
    const makPerKgV = per ? makTotal : makTotal / p.batchKg;
    const mfg = ingPerKg + makPerKgV;
    const sell = mfg * (1 + num(p.markup) / 100);
    return { ingPerKg, makPerKg: makPerKgV, mfg, sell, ingAmtTotal, rowAmt };
  }

  function updateSubtotal(e) {
    e = e || econ(work);
    const per = work.basis === 'per1000g';
    const st = $('#ti-sheet-subtotal'); if (st) st.textContent = money(e.ingAmtTotal);
    const sn = $('#ti-sheet-subnote');
    if (sn) sn.textContent = per ? `per ${round2(work.ing.reduce((s, it) => s + it.qty, 0))} g blend` : `per ${work.batchKg} kg batch`;
  }

  function renderRows() {
    const host = $('#ti-sheet-rows'); if (!host) return;
    const e = econ(work);
    const qstep = work.basis === 'per1000g' ? '1' : '0.1';
    host.innerHTML = work.ing.map((it, i) => {
      const amt = e.rowAmt(it);
      const share = e.ingAmtTotal ? amt / e.ingAmtTotal * 100 : 0;
      const units = UNITS.map((u) => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('');
      return `<tr class="sh-row${i % 2 ? ' alt' : ''}" data-i="${i}">
        <td class="sh-idx">${i + 1}</td>
        <td class="sh-cell sh-namecell"><input class="sh-in sh-name" data-sh="name" value="${esc(it.name)}" placeholder="Ingredient name"></td>
        <td class="sh-cell"><input class="sh-in" data-sh="rate" type="number" step="0.01" min="0" value="${it.rate}"></td>
        <td class="sh-cell"><input class="sh-in" data-sh="qty" type="number" step="${qstep}" min="0" value="${it.qty}"></td>
        <td class="sh-cell sh-unitcell"><select class="sh-sel" data-sh="unit">${units}</select></td>
        <td class="sh-num sh-amt">${money(amt)}</td>
        <td class="sh-num sh-share">${share.toFixed(0)}%</td>
        <td class="sh-act"><button class="sh-del" data-ti-del type="button" title="Delete row">🗑</button></td>
      </tr>`;
    }).join('');
    updateSubtotal(e);
  }

  // refresh amounts/shares/subtotal in place (keeps focus while typing a cell)
  function refreshAmounts() {
    const e = econ(work);
    $$('#ti-sheet-rows .sh-row').forEach((row) => {
      const it = work.ing[num(row.getAttribute('data-i'))]; if (!it) return;
      const amt = e.rowAmt(it);
      const a = $('.sh-amt', row); if (a) a.textContent = money(amt);
      const sh = $('.sh-share', row); if (sh) sh.textContent = (e.ingAmtTotal ? amt / e.ingAmtTotal * 100 : 0).toFixed(0) + '%';
    });
    updateSubtotal(e);
  }

  function renderLadderMaking() {
    const host = $('#ti-ladder-making'); if (!host) return;
    host.innerHTML = work.making.map((m, i) =>
      `<div class="sl-row sl-edit"><span>${esc(m.name)}</span><input class="sl-in" data-sh-mak="${i}" type="number" step="0.5" min="0" value="${round2(makPerKg(m))}"></div>`
    ).join('');
  }

  function recompute() {
    const e = econ(work), target = num(work.target);
    const setT = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    const setV = (id, v) => { const el = $(id); if (el && el !== document.activeElement) el.value = v; };
    setT('#ti-sh-ing', money(e.ingPerKg)); setT('#ti-sh-mfg', money(e.mfg)); setT('#ti-sh-sell', money(e.sell));
    const under = e.sell <= target;
    const head = target - e.sell, headPct = target ? head / target * 100 : 0;
    const profit = target - e.mfg, profitPct = target ? profit / target * 100 : 0;
    const pill = $('#ti-sh-pill'); if (pill) { pill.textContent = under ? 'Under target ✓' : 'Over target ✗'; pill.className = 'ti-pill ' + (under ? 'ok' : 'bad'); }
    const note = $('#ti-sh-note');
    if (note) note.textContent = (under
      ? `${money(head)}/kg headroom (${headPct.toFixed(1)}% under target)`
      : `${money(-head)}/kg over target — trim cost`) + ` · profit at target ${money(profit)}/kg (${profitPct.toFixed(0)}%)`;
    setV('#ti-sh-markup', work.markup); setV('#ti-sh-target', work.target);
    const d = e.sell - econ(base).sell, del = $('#ti-delta');
    if (del) del.textContent = Math.abs(d) < 0.005 ? 'No change vs saved baseline'
      : `Selling ${money(e.sell)}/kg — ${d < 0 ? '▼ ' : '▲ '}${money(Math.abs(d))}/kg vs saved`;
  }

  function load(key) {
    if (!SEED[key]) return;
    cur = key; work = clone(SEED[key]);
    const f = work.basis === 'per1000g' ? 0.001 : 1;
    work.ing.sort((a, b) => (b.rate * b.qty * f) - (a.rate * a.qty * f)); // biggest cost first
    base = clone(work);
    $$('[data-ti-prod]').forEach((b) => b.classList.toggle('sel', b.getAttribute('data-ti-prod') === key));
    const mk = $('#ti-sh-markup'); if (mk) mk.value = work.markup;
    const tg = $('#ti-sh-target'); if (tg) tg.value = work.target;
    renderRows(); renderLadderMaking(); recompute();
  }

  function syncGrand(isTarget) {
    const g = $('.grand'); if (!g) return;
    g.style.display = isTarget ? 'none' : '';
    const note = g.nextElementSibling; if (note) note.style.display = isTarget ? 'none' : '';
  }

  // ---- events (delegated) ----
  document.addEventListener('click', (e) => {
    const sub = e.target.closest('[data-costsub]');
    if (sub) syncGrand(sub.getAttribute('data-costsub') === 'target');

    const prod = e.target.closest('[data-ti-prod]');
    if (prod) { e.preventDefault(); load(prod.getAttribute('data-ti-prod')); return; }

    const rail = e.target.closest('.rl-item');
    if (rail) { const k = RAIL[rail.getAttribute('data-recipe')]; if (k) load(k); }

    if (e.target.closest('#ti-add')) {
      e.preventDefault();
      work.ing.push({ name: '', rate: 0, qty: 0, unit: work.basis === 'per1000g' ? 'g' : 'kg' });
      renderRows(); recompute();
      const rows = $$('#ti-sheet-rows .sh-row'); const last = rows[rows.length - 1];
      const nm = last && $('.sh-name', last); if (nm) nm.focus();
      const sc = $('.sheet-scroll'); if (sc) sc.scrollTop = sc.scrollHeight;
      return;
    }

    const del = e.target.closest('[data-ti-del]');
    if (del) {
      e.preventDefault();
      const row = del.closest('.sh-row'); if (!row) return;
      work.ing.splice(num(row.getAttribute('data-i')), 1);
      renderRows(); recompute(); return;
    }

    if (e.target.closest('#ti-reset')) {
      e.preventDefault(); work = clone(base);
      const mk = $('#ti-sh-markup'); if (mk) mk.value = work.markup;
      const tg = $('#ti-sh-target'); if (tg) tg.value = work.target;
      renderRows(); renderLadderMaking(); recompute(); return;
    }
    if (e.target.closest('#ti-apply')) {
      e.preventDefault(); base = clone(work); recompute();
      const del2 = $('#ti-delta'); if (del2) del2.textContent = 'Applied ✓ — baseline updated for ' + work.name;
    }
  });

  function applyCell(t) {
    if (t.matches('#ti-sh-markup')) { work.markup = num(t.value); recompute(); return; }
    if (t.matches('#ti-sh-target')) { work.target = num(t.value); recompute(); return; }
    if (t.matches('[data-sh-mak]')) {
      const i = num(t.getAttribute('data-sh-mak')), v = num(t.value);
      work.making[i].amount = work.basis === 'per1000g' ? v : v * (work.batchKg || 1);
      recompute(); return;
    }
    const row = t.closest('.sh-row');
    if (row && t.matches('[data-sh]')) {
      const it = work.ing[num(row.getAttribute('data-i'))]; if (!it) return;
      const f = t.getAttribute('data-sh');
      if (f === 'rate' || f === 'qty') { it[f] = num(t.value); refreshAmounts(); recompute(); }
      else { it[f] = t.value; }   // name / unit — cosmetic, no cost impact
    }
  }
  document.addEventListener('input', (e) => applyCell(e.target));
  document.addEventListener('change', (e) => { if (e.target.matches('[data-sh="unit"]')) applyCell(e.target); });

  function boot() { load('cookies'); syncGrand(false); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
