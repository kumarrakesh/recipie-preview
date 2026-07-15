/* ============================================================
   recipe.js — shared lightweight vanilla JS for the Recipe Module
   Addendum 004 (feedback-2). No framework, no build step.

   Load on every page with:  <script src="recipe.js" defer></script>

   Everything is namespaced under window.FB and wired declaratively
   through data-* attributes, so screens stay plain HTML. Each module
   below documents its markup contract so a developer can drop the
   same attributes onto real components and keep the behaviour.
   ============================================================ */
(function () {
  'use strict';
  const FB = (window.FB = window.FB || {});

  /* ---------- tiny helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  FB.$ = $; FB.$$ = $$; FB.num = num; FB.money = money;

  /* ============================================================
     1. Drawer / slider
     Contract:
       <button data-drawer-open="drawer-version">…</button>
       <aside class="drawer" id="drawer-version" hidden> …
         <button data-drawer-close>✕</button>
       </aside>
     A single shared .scrim is created automatically. ESC + scrim
     click close the top-most open drawer. Optional callbacks:
       FB.onDrawerOpen(id, fn) / FB.onDrawerClose(id, fn)
     ============================================================ */
  const openHooks = {}, closeHooks = {};
  let scrim = null;
  function ensureScrim() {
    if (scrim) return scrim;
    scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.hidden = true;
    scrim.addEventListener('click', () => FB.closeDrawer());
    document.body.appendChild(scrim);
    return scrim;
  }
  FB.openDrawer = function (id) {
    const d = document.getElementById(id);
    if (!d) return;
    ensureScrim().hidden = false;
    d.hidden = false;
    // force reflow then add .in for the css slide transition
    requestAnimationFrame(() => d.classList.add('in'));
    document.body.classList.add('no-scroll');
    (openHooks[id] || []).forEach((fn) => fn(d));
  };
  FB.closeDrawer = function (id) {
    const open = id ? [document.getElementById(id)] : $$('.drawer:not([hidden])');
    open.forEach((d) => {
      if (!d) return;
      d.classList.remove('in');
      d.hidden = true;
      (closeHooks[d.id] || []).forEach((fn) => fn(d));
    });
    if (!$$('.drawer:not([hidden])').length) {
      if (scrim) scrim.hidden = true;
      document.body.classList.remove('no-scroll');
    }
  };
  FB.onDrawerOpen  = (id, fn) => ((openHooks[id]  = openHooks[id]  || []).push(fn));
  FB.onDrawerClose = (id, fn) => ((closeHooks[id] = closeHooks[id] || []).push(fn));

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (opener) { e.preventDefault(); FB.openDrawer(opener.getAttribute('data-drawer-open')); }
    if (e.target.closest('[data-drawer-close]')) { e.preventDefault(); FB.closeDrawer(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') FB.closeDrawer(); });

  /* ============================================================
     2. Tax calculation (Create Ingredient form)
     Contract — wrap fields in [data-tax-form]:
       <input data-price>          price before tax
       <select|input data-tax-rate> percentage (e.g. 5, 10, 15, or "Custom")
       <input data-tax-custom hidden> shown when rate = Custom
       <output data-price-after>   auto-filled, display-only
       <output data-tax-amount>    optional
     Price After Tax = Price Before Tax + (Price * rate/100)
     ============================================================ */
  function recalcTax(form) {
    const price = num($('[data-price]', form) && $('[data-price]', form).value);
    const rateEl = $('[data-tax-rate]', form);
    let rate = rateEl ? rateEl.value : 0;
    const customEl = $('[data-tax-custom]', form);
    if (String(rate).toLowerCase() === 'custom') {
      if (customEl) customEl.hidden = false;
      rate = num(customEl && customEl.value);
    } else if (customEl) { customEl.hidden = true; }
    const amount = price * num(rate) / 100;
    const after = price + amount;
    const amtEl = $('[data-tax-amount]', form); if (amtEl) amtEl.value = money(amount);
    const afterEl = $('[data-price-after]', form); if (afterEl) afterEl.value = money(after);
  }
  FB.initTaxForms = () => $$('[data-tax-form]').forEach((f) => {
    f.addEventListener('input', () => recalcTax(f));
    f.addEventListener('change', () => recalcTax(f));
    recalcTax(f);
  });

  /* ============================================================
     3. Two-way yield calc (ingredient rows)
     Contract — wrap a row/region in [data-yield]:
       [data-actual]       Actual Qty (editable)
       [data-yield-pct]    Yield % (editable)
       [data-after]        Qty After Yield (editable — two-way)
       [data-unit-price]   Price per unit (optional, editable)
       [data-cost]         output cost (display)
     Editing Actual or Yield% updates After. Editing After back-
     solves Actual for the given Yield%. Cost = After * unitPrice.
     ============================================================ */
  function recalcYield(scope, source) {
    const actualEl = $('[data-actual]', scope);
    const pctEl    = $('[data-yield-pct]', scope);
    const afterEl  = $('[data-after]', scope);
    const priceEl  = $('[data-unit-price]', scope);
    const costEl   = $('[data-cost]', scope);
    const pct = pctEl ? num(pctEl.value) : 100;
    const f = pct > 0 ? pct / 100 : 1;
    if (source === 'after' && afterEl && actualEl) {
      actualEl.value = round(num(afterEl.value) / f);
    } else if (afterEl && actualEl) {
      afterEl.value = round(num(actualEl.value) * f);
    }
    if (costEl) {
      // You pay for the full Actual Qty; yield only affects finished output.
      const actual = actualEl ? num(actualEl.value) : 0;
      const price = priceEl ? num(priceEl.value) : 0;
      costEl.textContent = money(actual * price);
      costEl.value = money(actual * price);
    }
  }
  const round = (n) => Math.round(n * 1000) / 1000;
  FB.initYield = () => $$('[data-yield]').forEach((scope) => {
    const handler = (e) => recalcYield(scope, e.target.matches('[data-after]') ? 'after' : 'forward');
    scope.addEventListener('input', handler);
    recalcYield(scope, 'forward');
  });
  FB.recalcYield = recalcYield;

  /* ============================================================
     4. Inline add-row
     Contract:
       <table id="tbl-ingredients"> … <tbody> … </tbody></table>
       <template data-row-template="tbl-ingredients"> <tr>…</tr> </template>
       <button data-add-row="tbl-ingredients">＋ Add</button>
     New row is appended to <tbody>; any [data-yield]/[data-tax-form]
     inside it is initialised; [data-row-remove] deletes its row.
     ============================================================ */
  FB.addRow = function (tableId) {
    const tpl = $('[data-row-template="' + tableId + '"]');
    const tbody = $('#' + tableId + ' tbody') || $('#' + tableId);
    if (!tpl || !tbody) return null;
    const frag = tpl.content.cloneNode(true);
    const row = frag.querySelector('tr') || frag.firstElementChild;
    tbody.appendChild(frag);
    // initialise interactive bits inside the freshly inserted row
    if (row) {
      if (row.matches('[data-yield]')) FB.initYieldOne(row);
      $$('[data-yield]', row).forEach(FB.initYieldOne);
      $$('[data-tax-form]', row).forEach((f) => f.addEventListener('input', () => recalcTax(f)));
      attachAutosuggest(row);
      const firstInput = row.querySelector('input,select');
      if (firstInput) firstInput.focus();
    }
    return row;
  };
  FB.initYieldOne = (scope) => {
    scope.addEventListener('input', (e) =>
      recalcYield(scope, e.target.matches('[data-after]') ? 'after' : 'forward'));
    recalcYield(scope, 'forward');
  };
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-row]');
    if (add) { e.preventDefault(); FB.addRow(add.getAttribute('data-add-row')); }
    const rm = e.target.closest('[data-row-remove]');
    if (rm) { e.preventDefault(); const tr = rm.closest('tr'); if (tr) tr.remove(); }
  });

  /* ============================================================
     5. Expand / collapse table row (Versions ▸ View)
     Contract:
       <tr> … <button data-row-expand="ver-1">View</button> … </tr>
       <tr id="ver-1" class="row-detail" hidden> <td colspan=…>…</td></tr>
     ============================================================ */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-row-expand]');
    if (!btn) return;
    e.preventDefault();
    const target = document.getElementById(btn.getAttribute('data-row-expand'));
    if (!target) return;
    const show = target.hidden;
    target.hidden = !show;
    btn.classList.toggle('on', show);
    const lbl = btn.getAttribute('data-expand-label');
    if (lbl) btn.textContent = show ? lbl : (btn.getAttribute('data-collapse-label') || 'View');
  });

  /* ============================================================
     6. Drag-and-drop reorder (Method steps)
     Contract:
       <div data-drag-list data-renumber=".sn">
         <div class="step-card" draggable="true"> … <span class="sn">1</span></div>
       </div>
     After any drop, every [data-renumber] target is renumbered 1..n.
     ============================================================ */
  FB.initDragList = () => $$('[data-drag-list]').forEach((list) => {
    let dragging = null;
    list.addEventListener('dragstart', (e) => {
      dragging = e.target.closest('[draggable]');
      if (dragging) dragging.classList.add('dragging');
    });
    list.addEventListener('dragend', () => {
      if (dragging) dragging.classList.remove('dragging');
      dragging = null; renumber(list);
    });
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const after = elAfter(list, e.clientY);
      if (!dragging) return;
      if (after == null) list.appendChild(dragging);
      else list.insertBefore(dragging, after);
    });
  });
  function elAfter(list, y) {
    const items = $$('[draggable]:not(.dragging)', list);
    return items.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      return offset < 0 && offset > closest.offset ? { offset, el: child } : closest;
    }, { offset: -Infinity, el: null }).el;
  }
  function renumber(list) {
    const sel = list.getAttribute('data-renumber'); if (!sel) return;
    $$('[draggable]', list).forEach((item, i) => {
      const tgt = item.querySelector(sel); if (tgt) tgt.textContent = i + 1;
    });
  }

  /* ============================================================
     7. Dynamic rating fields (Testing outcome)
     Contract:
       <div data-field-list="testing"> … rows … </div>
       <template data-field-template="testing"><div class="trow">…
          <input data-field-name> <input type="range|number" …>
          <button data-field-remove>✕</button></div></template>
       <button data-add-field="testing">＋ Add field</button>
     Each row keeps a 1–5 rating; range inputs mirror into [data-rating-out].
     ============================================================ */
  FB.addField = function (name) {
    const tpl = $('[data-field-template="' + name + '"]');
    const list = $('[data-field-list="' + name + '"]');
    if (!tpl || !list) return;
    list.appendChild(tpl.content.cloneNode(true));
  };
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-field]');
    if (add) { e.preventDefault(); FB.addField(add.getAttribute('data-add-field')); }
    const rm = e.target.closest('[data-field-remove]');
    if (rm) { e.preventDefault(); const r = rm.closest('.trow'); if (r) r.remove(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-rating]')) {
      const out = e.target.parentElement.querySelector('[data-rating-out]');
      if (out) out.textContent = e.target.value;
    }
  });

  /* ============================================================
     8. Product autosuggest (inline fields)
     Contract:
       <div class="autosuggest"><input data-autosuggest placeholder="Type product…"></div>
     Suggestions come from FB.PRODUCTS (override per page if needed).
     Selecting fills the input and dispatches a 'product:select' event.
     ============================================================ */
  FB.PRODUCTS = [
    { name: 'Kaju Katli 250g',  cat: 'Sweets' }, { name: 'Kaju Katli 500g', cat: 'Sweets' },
    { name: 'Kaju Katli 1kg',   cat: 'Sweets' }, { name: 'Masala Cookies 200g', cat: 'Bakery' },
    { name: 'Jeera Biscuit 150g',cat: 'Bakery' }, { name: 'Aam Ras 500ml', cat: 'Beverages' },
    { name: 'Chana Masala 100g',cat: 'Spices' }, { name: 'Besan Flour 1kg', cat: 'Flours' },
    { name: 'Soan Papdi 250g',  cat: 'Sweets' }, { name: 'Namkeen Mix 200g', cat: 'Snacks' },
  ];
  function attachAutosuggest(root) {
    $$('[data-autosuggest]', root || document).forEach((input) => {
      if (input.dataset.asReady) return; input.dataset.asReady = '1';
      const box = document.createElement('div');
      box.className = 'as-list'; box.hidden = true;
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(box);
      const render = () => {
        const q = input.value.trim().toLowerCase();
        const items = FB.PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
        box.innerHTML = items.map((p) =>
          `<button type="button" class="as-item" data-val="${p.name}">${p.name}<span class="muted small"> · ${p.cat}</span></button>`).join('');
        box.hidden = !(q && items.length);
      };
      input.addEventListener('input', render);
      input.addEventListener('focus', render);
      input.addEventListener('blur', () => setTimeout(() => (box.hidden = true), 150));
      box.addEventListener('mousedown', (e) => {
        const it = e.target.closest('.as-item'); if (!it) return;
        input.value = it.getAttribute('data-val'); box.hidden = true;
        input.dispatchEvent(new CustomEvent('product:select', { bubbles: true, detail: { name: input.value } }));
      });
    });
  }
  FB.initAutosuggest = () => attachAutosuggest(document);

  /* ============================================================
     9. Reusable Product Picker drawer
     Contract — one shared drawer per page:
       <aside class="drawer" id="drawer-product" hidden> built by FB if absent </aside>
       trigger: <button data-pick-product data-product-target="#someInput">Link Product</button>
     On select, fills the target input (if given) and dispatches
     'product:select' on it. Categories drive the filter chips.
     ============================================================ */
  const CATS = ['All', 'Sweets', 'Snacks', 'Bakery', 'Beverages', 'Spices', 'Flours'];
  let pickTarget = null;
  function buildProductDrawer() {
    if (document.getElementById('drawer-product')) return;
    const d = document.createElement('aside');
    d.className = 'drawer'; d.id = 'drawer-product'; d.hidden = true;
    d.innerHTML =
      `<div class="dhead"><div><div class="section-eyebrow">Link product</div>
         <h3 style="font-size:16px">Select a product</h3></div>
         <button class="btn btn-sm" data-drawer-close>✕</button></div>
       <div class="dbody">
         <div class="search" style="position:relative;margin-bottom:12px"><span class="mag" style="position:absolute;left:12px;top:11px">🔍</span>
           <input class="input" id="pp-search" placeholder="Search products…" style="padding-left:36px"></div>
         <div class="chip-pick" id="pp-chips" style="margin-bottom:14px"></div>
         <div id="pp-list"></div>
       </div>`;
    document.body.appendChild(d);
    const chips = $('#pp-chips', d);
    chips.innerHTML = CATS.map((c, i) => `<button class="chip ${i === 0 ? 'sel' : ''}" data-cat="${c}">${c}</button>`).join('');
    let cat = 'All';
    const list = $('#pp-list', d), search = $('#pp-search', d);
    const render = () => {
      const q = search.value.trim().toLowerCase();
      const items = FB.PRODUCTS.filter((p) =>
        (cat === 'All' || p.cat === cat) && p.name.toLowerCase().includes(q));
      list.innerHTML = items.map((p) =>
        `<button type="button" class="pp-row" data-val="${p.name}">
           <div><b>${p.name}</b><div class="muted small">${p.cat}</div></div>
           <span class="btn btn-sm btn-primary">Select</span></button>`).join('') ||
        '<div class="muted small" style="padding:16px">No products match.</div>';
    };
    chips.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]'); if (!c) return;
      cat = c.getAttribute('data-cat');
      $$('.chip', chips).forEach((x) => x.classList.toggle('sel', x === c));
      render();
    });
    search.addEventListener('input', render);
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.pp-row'); if (!row) return;
      const val = row.getAttribute('data-val');
      if (pickTarget) {
        pickTarget.value = val;
        pickTarget.dispatchEvent(new CustomEvent('product:select', { bubbles: true, detail: { name: val } }));
      }
      FB.closeDrawer('drawer-product');
    });
    render();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pick-product]');
    if (!t) return;
    e.preventDefault();
    buildProductDrawer();
    const sel = t.getAttribute('data-product-target');
    pickTarget = sel ? document.querySelector(sel) : null;
    FB.openDrawer('drawer-product');
  });

  /* ============================================================
     10. QR preview (Batch × Packaging combination)
     Contract:
       <div data-qr data-qr-payload="recipe=KK;ver=1.2;batch=50kg;pack=250g"></div>
     Renders a deterministic preview matrix on a <canvas> from the
     payload. NOTE: this is a visual placeholder. To emit a *scannable*
     QR, drop in qrcode.js and replace renderPreview() with:
        new QRCode(el, { text: payload, width:96, height:96 });
     ============================================================ */
  function hashCode(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
  function renderQR(el) {
    const payload = el.getAttribute('data-qr-payload') || el.textContent || '';
    const size = parseInt(el.getAttribute('data-qr-size') || '96', 10);
    const N = 21; // QR v1 module grid
    const cv = document.createElement('canvas');
    cv.width = cv.height = size; cv.className = 'qr-canvas';
    const ctx = cv.getContext('2d'); const cell = size / N;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111';
    let h = hashCode(payload);
    const bit = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h & 1; };
    const finder = (ox, oy) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) ctx.fillRect((ox + x) * cell, (oy + y) * cell, cell, cell);
      }
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inFinder = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      if (inFinder) continue;
      if (bit()) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    el.innerHTML = ''; el.appendChild(cv);
  }
  FB.initQR = () => $$('[data-qr]').forEach(renderQR);
  FB.renderQR = renderQR;

  /* ============================================================
     11. Sub-tabs (batch override tabs in Method / Costing)
     Contract:
       <div data-subtabs>
         <button data-tab="panel-base" class="on">Base</button>
         <button data-tab="panel-10kg">10 kg Trial</button>
       </div>
       <div data-tab-panel="panel-base"> … </div>
       <div data-tab-panel="panel-10kg" hidden> … </div>
     ============================================================ */
  FB.initSubtabs = () => $$('[data-subtabs]').forEach((bar) => {
    const panels = () => $$('[data-tab-panel]');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      const id = b.getAttribute('data-tab');
      $$('[data-tab]', bar).forEach((x) => x.classList.toggle('on', x === b));
      panels().forEach((p) => { p.hidden = p.getAttribute('data-tab-panel') !== id; });
    });
  });

  /* ============================================================
     boot
     ============================================================ */
  function boot() {
    FB.initTaxForms();
    FB.initYield();
    FB.initDragList();
    FB.initAutosuggest();
    FB.initQR();
    FB.initSubtabs();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
