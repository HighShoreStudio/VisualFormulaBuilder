/* =========================================================================
   Formula Builder — application (UI, node editor, interactions)
   ========================================================================= */
(function () {
  'use strict';
  const C = window.FB_CATALOG, E = window.FB_ENGINE, I = window.FB_I18N;
  const t = I.t, L = I.L;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = id => `<svg><use href="#i-${id}"/></svg>`;
  const catOf = id => C.CATEGORIES.find(c => c.id === id);
  const isCompact = () => window.matchMedia('(max-height: 560px), (max-width: 1080px)').matches;

  /* ------------------------------- STATE -------------------------------- */
  const state = {
    g: { nodes: {}, links: [], next: 1 },
    mode: 'excel',
    pretty: false,
    view: { x: 0, y: 0, s: 1 },
    sbOpen: true
  };
  let selected = null;           // selected node id
  let sbTarget = null;           // what the sidebar explains
  const undoStack = [], redoStack = [];
  let lastSnap = null;
  let built = { ast: null, issues: [], used: new Set() };

  const dom = {
    app: $('#app'), wrap: $('#canvasWrap'), canvas: $('#canvas'), nodes: $('#nodes'), wires: $('#wires'),
    libList: $('#libList'), libSearch: $('#libSearch'), sbBody: $('#sbBody'), fbCode: $('#fbCode'),
    pill: $('#statusPill'), zoomVal: $('#zoomVal'), emptyHint: $('#emptyHint')
  };

  /* ---------------------------- NODE VISUALS ---------------------------- */
  function nodeColor(n) {
    switch (n.type) {
      case 'fn': return catOf(C.byId[n.fn] ? C.byId[n.fn].cat : 'basic').color;
      case 'math': case 'neg': return catOf('math').color;
      case 'cmp': return catOf('logic').color;
      case 'join': return catOf('text').color;
      case 'custom': return catOf('array').color;
      case 'result': return state.mode === 'excel' ? '#107c41' : '#0f9d58';
      default: return catOf('basic').color;
    }
  }
  const BLOCK_ICON = { num: '12', text: 'Aa', ref: 'A1', bool: '✓', name: 'x', math: '+−', cmp: '≥', join: '&', neg: '±', custom: 'ƒ', result: '=' };
  function nodeIcon(n) { return n.type === 'fn' ? catOf(C.byId[n.fn].cat).icon : BLOCK_ICON[n.type]; }
  function blockDef(type) { return C.BLOCKS.find(b => b.id === '@' + type); }
  function nodeTitle(n) {
    if (n.type === 'fn') { const f = C.byId[n.fn]; return state.mode === 'excel' ? f.id : f.gs; }
    if (n.type === 'result') return t('result');
    if (n.type === 'custom') return (n.value || '').trim().toUpperCase() || L(blockDef('fn').t);
    return L(blockDef(n.type).t);
  }
  function nodeSub(n) {
    if (n.type === 'fn') return L(C.byId[n.fn].t);
    if (n.type === 'result') return t('resultSub');
    if (n.type === 'custom') return L(blockDef('fn').t);
    return '';
  }

  /* ----------------------------- RENDERING ------------------------------ */
  const portCache = {}; // nodeId -> { out:{x,y}, in:{key:{x,y}} }

  function renderAll() {
    dom.nodes.innerHTML = '';
    Object.values(state.g.nodes).forEach(n => renderNode(n, true));
    afterChange(true);
  }

  function renderNode(n, noAnim) {
    const old = dom.nodes.querySelector(`.node[data-id="${n.id}"]`);
    const focusKey = old && document.activeElement && old.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const e = el('div', 'node');
    e.dataset.id = n.id;
    e.style.setProperty('--c', nodeColor(n));
    if (n.type === 'result') e.classList.add('result');
    if (n.type === 'fn' && (n.fn === 'LET' || n.fn === 'LAMBDA' || n.fn === 'XLOOKUP')) e.classList.add('wide');
    if (noAnim || old) e.style.animation = 'none';
    if (n.id === selected) e.classList.add('sel');
    e.style.transform = `translate(${n.x}px, ${n.y}px)`;

    // header
    const head = el('div', 'node-head');
    head.innerHTML = `<span class="node-icon">${esc(nodeIcon(n))}</span>
      <div class="node-titles"><div class="node-name">${esc(nodeTitle(n))}</div>${nodeSub(n) ? `<div class="node-sub">${esc(nodeSub(n))}</div>` : ''}</div>`;
    const help = el('button', 'node-btn help', icon('help'));
    help.dataset.tip = 'explainTip'; help.dataset.act = 'help';
    head.appendChild(help);
    if (n.type !== 'result') {
      const del = el('button', 'node-btn del', icon('close'));
      del.dataset.tip = 'del'; del.dataset.act = 'del';
      head.appendChild(del);
    }
    e.appendChild(head);

    const body = el('div', 'node-body');
    e.appendChild(body);
    const names = E.nameSet(state.g);

    // value blocks
    if (['num', 'text', 'ref', 'name'].includes(n.type)) {
      const row = el('div', 'port-row');
      row.style.paddingLeft = '12px';
      const ph = { num: 'phNumber', text: 'phText', ref: 'phRef', name: 'phName' }[n.type];
      row.appendChild(fieldFor(n, '$value', n.value || '', t(ph), n.type === 'num' ? 'decimal' : 'text'));
      body.appendChild(row);
    } else if (n.type === 'bool') {
      const row = el('div', 'port-row'); row.style.paddingLeft = '12px';
      const tg = el('div', 'bool-toggle');
      const M = E.MODES[state.mode];
      [true, false].forEach(v => {
        const b = el('button', (n.value !== false) === v ? 'on' : '', v ? M.t : M.f);
        b.dataset.act = 'bool'; b.dataset.v = v ? '1' : '0';
        tg.appendChild(b);
      });
      row.appendChild(tg); body.appendChild(row);
    } else if (n.type === 'custom') {
      const row = el('div', 'port-row'); row.style.paddingLeft = '12px';
      row.appendChild(fieldFor(n, '$value', n.value || '', t('phFn'), 'text'));
      body.appendChild(row);
    } else if (n.type === 'math' || n.type === 'cmp' || n.type === 'neg') {
      const opts = n.type === 'math' ? C.MATH_OPS : n.type === 'cmp' ? C.CMP_OPS : [{ v: '-', l: [t('negMinus'), t('negMinus')] }, { v: '%', l: [t('negPct'), t('negPct')] }];
      const wrap = el('div', 'op-select');
      const f = el('div', 'field sel-field');
      const s = el('select');
      s.dataset.key = '$op';
      opts.forEach(o => { const op = el('option', null, esc(L(o.l))); op.value = o.v; s.appendChild(op); });
      s.value = n.op || opts[0].v;
      f.appendChild(s); wrap.appendChild(f); body.appendChild(wrap);
    }

    // input ports
    const ports = E.ports(n);
    let prevGroup = null;
    ports.forEach(p => {
      const row = el('div', 'port-row');
      row.dataset.port = p.key;
      if (p.group != null && p.groupFirst !== false && prevGroup !== null && p.group !== prevGroup && (p.groupSize || 1) > 1) row.classList.add('group-start');
      if (p.group != null) prevGroup = p.group;
      const link = E.linkInto(state.g, n.id, p.key);
      if (p.def.kind !== 'name') {
        const sock = el('span', 'socket in');
        sock.dataset.port = p.key;
        if (link) { sock.classList.add('connected'); sock.style.setProperty('--lc', nodeColor(state.g.nodes[link.from])); }
        row.appendChild(sock);
      }
      const main = el('div', 'port-main');
      const lbl = el('div', 'port-label', esc(L(p.def.n)) + (p.opt ? ` <span class="opt">· ${esc(t('optional'))}</span>` : ''));
      lbl.dataset.tipText = L(p.def.d);
      main.appendChild(lbl);
      if (link) {
        const src = state.g.nodes[link.from];
        const lk = el('div', 'linked');
        lk.style.setProperty('--lc', nodeColor(src));
        lk.innerHTML = `<span class="lk-arrow">←</span><span class="lk-name">${esc(nodeTitle(src))}</span>`;
        const b = el('button', null, icon('close'));
        b.dataset.act = 'unlink'; b.dataset.port = p.key; b.dataset.tip = 'disconnect';
        lk.appendChild(b);
        main.appendChild(lk);
      } else if (p.def.ch) {
        const f = el('div', 'field sel-field');
        const s = el('select');
        s.dataset.key = '#' + p.key;
        if (p.opt) { const o = el('option', null, esc(t('emptyChoice'))); o.value = '-1'; s.appendChild(o); }
        p.def.ch.forEach((o, i) => { const op = el('option', null, esc(L(o.l))); op.value = String(i); s.appendChild(op); });
        const cur = n.ch && n.ch[p.key] != null ? n.ch[p.key] : (p.def.def != null ? p.def.def : 0);
        s.value = String(p.opt ? cur : Math.max(0, cur));
        f.appendChild(s); main.appendChild(f);
      } else {
        main.appendChild(fieldFor(n, p.key, (n.vals && n.vals[p.key]) || '', p.def.kind === 'name' ? t('phNameArg') : t('phValue'), 'text', names, p.def.kind === 'name'));
      }
      row.appendChild(main);
      if (p.removable && p.groupFirst !== false) {
        const rb = el('button', 'row-remove', icon('minus'));
        rb.dataset.act = 'rmgroup'; rb.dataset.group = p.group; rb.dataset.tip = 'remove';
        row.appendChild(rb);
      }
      body.appendChild(row);
    });

    // add buttons for repeating groups
    const f = n.type === 'fn' ? C.byId[n.fn] : null;
    if ((f && f.r) || n.type === 'join' || n.type === 'custom') {
      const label = f && f.r ? (f.id === 'LET' ? L(['variabile', 'variable']) : L(f.r.a[0].n)) : (n.type === 'join' ? L(['parte', 'part']) : L(['argomento', 'argument']));
      const add = el('button', 'add-rep', icon('plus') + `<span>${esc(t('addCond'))}: ${esc(label)}</span>`);
      add.dataset.act = 'addrep';
      body.appendChild(add);
    }

    if (E.hasOutput(n)) {
      const out = el('span', 'socket out');
      out.dataset.out = '1';
      e.appendChild(out);
    }

    if (old) old.replaceWith(e); else dom.nodes.appendChild(e);
    measure(n, e);
    if (focusKey) { const inp = e.querySelector(`[data-key="${CSS.escape(focusKey)}"]`); if (inp) inp.focus(); }
    return e;
  }

  // Creates an inline field (input + type chip)
  function fieldFor(n, key, value, ph, mode, names, isName) {
    const f = el('div', 'field');
    const inp = el('input');
    inp.type = 'text';
    inp.value = value;
    inp.placeholder = ph;
    inp.dataset.key = key;
    inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off');
    if (mode === 'decimal') inp.inputMode = 'decimal';
    f.appendChild(inp);
    if (key !== '$value' && !isName) {
      const chip = el('span', 'chip');
      f.appendChild(chip);
      updateChip(chip, value, names || E.nameSet(state.g));
    }
    return f;
  }
  function updateChip(chip, value, names) {
    const c = E.classify(value, names);
    const map = { num: 'kNum', text: 'kText', ref: 'kRef', bool: 'kBool', name: 'kName', raw: 'kRaw' };
    if (c.kind === 'empty') { chip.hidden = true; return; }
    chip.hidden = false;
    chip.className = 'chip k-' + c.kind;
    chip.textContent = t(map[c.kind]);
  }
  function refreshChips() {
    const names = E.nameSet(state.g);
    dom.nodes.querySelectorAll('.field').forEach(f => {
      const chip = f.querySelector('.chip'), inp = f.querySelector('input');
      if (chip && inp) updateChip(chip, inp.value, names);
    });
  }

  // cache socket positions relative to the node (offsets are transform-independent)
  function measure(n, e) {
    const pos = sock => {
      let x = sock.offsetLeft + sock.offsetWidth / 2, y = sock.offsetTop + sock.offsetHeight / 2, p = sock.offsetParent;
      while (p && p !== e) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent; }
      return { x, y };
    };
    const c = { in: {}, out: null, w: e.offsetWidth, h: e.offsetHeight };
    e.querySelectorAll('.socket.in').forEach(s => { c.in[s.dataset.port] = pos(s); });
    const o = e.querySelector('.socket.out');
    if (o) c.out = pos(o);
    portCache[n.id] = c;
  }
  function remeasureAll() {
    Object.values(state.g.nodes).forEach(n => { const e = nodeEl(n.id); if (e) measure(n, e); });
  }
  const nodeEl = id => dom.nodes.querySelector(`.node[data-id="${id}"]`);

  function sockWorld(nodeId, key) {
    const n = state.g.nodes[nodeId], c = portCache[nodeId];
    if (!n || !c) return { x: 0, y: 0 };
    const p = key === '$out' ? c.out : c.in[key];
    if (!p) return { x: n.x, y: n.y };
    return { x: n.x + p.x, y: n.y + p.y };
  }

  /* ------------------------------- WIRES -------------------------------- */
  let tempWire = null;
  const freshLinks = new Set();
  function wirePath(a, b) {
    const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5);
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  }
  function drawWires() {
    const parts = [];
    state.g.links.forEach(l => {
      const a = sockWorld(l.from, '$out'), b = sockWorld(l.to, l.port);
      const src = state.g.nodes[l.from];
      const cls = ['wire'];
      if (selected && (l.from === selected || l.to === selected)) cls.push('sel');
      if (freshLinks.has(l.id)) cls.push('new');
      parts.push(`<path class="${cls.join(' ')}" d="${wirePath(a, b)}" style="stroke:${nodeColor(src)}"/>`);
    });
    if (tempWire) parts.push(`<path class="wire live" d="${wirePath(tempWire.a, tempWire.b)}" style="stroke:var(--accent)"/>`);
    dom.wires.innerHTML = parts.join('');
    freshLinks.clear();
  }

  /* ------------------------------ FORMULA ------------------------------- */
  function afterChange(skipRemeasure) {
    if (!skipRemeasure) remeasureAll();
    built = E.buildAst(state.g);
    // node states
    dom.nodes.querySelectorAll('.node').forEach(e => {
      const id = e.dataset.id;
      const unused = !built.used.has(id);
      e.classList.toggle('unused', unused);
      if (unused) e.dataset.tipText = t('unusedTip'); else delete e.dataset.tipText;
      e.querySelectorAll('.port-row.missing').forEach(r => r.classList.remove('missing'));
    });
    built.issues.forEach(is => {
      if (!is.port) return;
      const r = dom.nodes.querySelector(`.node[data-id="${is.node}"] .port-row[data-port="${is.port}"]`);
      if (r) r.classList.add('missing');
    });
    drawWires();
    renderFormula();
    const nodesCount = Object.keys(state.g.nodes).length;
    dom.emptyHint.hidden = !(nodesCount <= 1 && !built.ast);
    scheduleSave();
  }

  function renderFormula() {
    const code = dom.fbCode;
    if (!built.ast) {
      code.innerHTML = `<span class="ph">${esc(t('emptyFormula'))}</span>`;
    } else {
      const toks = E.tokens(built.ast, state.mode, state.pretty);
      code.innerHTML = '<span class="tk-op">=</span>' + toks.map(tk => tk.c
        ? `<span class="${tk.c}"${tk.n ? ` data-n="${tk.n}"` : ''}>${esc(tk.s)}</span>`
        : esc(tk.s)).join('');
    }
    const pill = dom.pill;
    const n = built.issues.length;
    if (!built.ast) { pill.className = 'status-pill none'; pill.innerHTML = ''; }
    else if (n) { pill.className = 'status-pill warn'; pill.innerHTML = icon('warn') + esc(n === 1 ? t('missing1') : t('missingN', { n })); pill.dataset.tip = 'missingTip'; }
    else { pill.className = 'status-pill ok'; pill.innerHTML = icon('check') + esc(t('complete')); delete pill.dataset.tip; }
  }

  function formulaText() { return built.ast ? E.toText(built.ast, state.mode, state.pretty) : ''; }

  /* ------------------------------ HISTORY ------------------------------- */
  function snap() { return JSON.stringify(state.g); }
  function commit() {
    const s = snap();
    if (s === lastSnap) return;
    if (lastSnap != null) { undoStack.push(lastSnap); if (undoStack.length > 150) undoStack.shift(); }
    redoStack.length = 0;
    lastSnap = s;
    updateUndoButtons();
    scheduleSave();
  }
  function restore(s) {
    state.g = JSON.parse(s);
    lastSnap = s;
    if (selected && !state.g.nodes[selected]) selected = null;
    renderAll();
    updateUndoButtons();
    refreshSidebar();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); }
  function updateUndoButtons() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }

  /* ---------------------------- PERSISTENCE ----------------------------- */
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem('fb.state', JSON.stringify({ g: state.g, mode: state.mode, pretty: state.pretty, view: state.view, sbOpen: state.sbOpen })); } catch (e) { /* ignore */ }
    }, 250);
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('fb.state') || 'null');
      if (s && s.g && s.g.nodes) { Object.assign(state, s); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  /* ---------------------------- GRAPH EDITS ----------------------------- */
  function newId() { return 'n' + (state.g.next++); }
  function ensureResult() {
    if (!Object.values(state.g.nodes).some(n => n.type === 'result')) {
      const id = newId();
      state.g.nodes[id] = { id, type: 'result', x: 760, y: 220, vals: {} };
    }
  }
  function resultNode() { return Object.values(state.g.nodes).find(n => n.type === 'result'); }

  function createNode(spec, x, y) {
    const id = newId();
    let n;
    if (spec[0] === '@') {
      const type = spec.slice(1) === 'fn' ? 'custom' : spec.slice(1);
      n = { id, type, x, y, vals: {} };
      if (type === 'math') n.op = '+';
      if (type === 'cmp') n.op = '>';
      if (type === 'neg') n.op = '-';
      if (type === 'bool') n.value = true;
      if (type === 'join') n.rep = 2;
      if (type === 'custom') n.rep = 1;
    } else {
      const f = C.byId[spec];
      n = { id, type: 'fn', fn: spec, x, y, vals: {}, ch: {} };
      if (f.r) n.rep = f.r.min;
    }
    state.g.nodes[id] = n;
    return n;
  }

  function addNodeAt(spec, wx, wy, opts) {
    const n = createNode(spec, Math.round(wx), Math.round(wy));
    const e = renderNode(n);
    // when placed from the library, center the node on the point
    if (!opts || !opts.exact) {
      n.x = Math.round(wx - e.offsetWidth / 2); n.y = Math.round(wy - 30);
      e.style.transform = `translate(${n.x}px, ${n.y}px)`;
    }
    select(n.id);
    afterChange();
    commit();
    return n;
  }

  function addNodeCenter(spec) {
    const r = dom.wrap.getBoundingClientRect();
    const c = toWorld(r.left + r.width * 0.4, r.top + r.height * 0.35);
    const spot = freeSpot(c.x - 132, c.y - 30, 270, 200);
    const n = addNodeAt(spec, spot.x + 132, spot.y + 30);
    if (isCompact()) closePanels();
    return n;
  }

  // finds a position near (x, y) that does not overlap existing blocks
  function freeSpot(x, y, w, h) {
    const rects = Object.values(state.g.nodes).map(n => { const c = portCache[n.id] || { w: 264, h: 160 }; return { x: n.x - 24, y: n.y - 24, w: c.w + 48, h: c.h + 48 }; });
    const free = (px, py) => rects.every(r => px + w < r.x || px > r.x + r.w || py + h < r.y || py > r.y + r.h);
    if (free(x, y)) return { x, y };
    for (let ring = 1; ring < 14; ring++) {
      for (let k = -ring; k <= ring; k++) {
        const cands = [[x - ring * 150, y + k * 90], [x + k * 150, y + ring * 90], [x + k * 150, y - ring * 90], [x + ring * 150, y + k * 90]];
        for (const [px, py] of cands) if (free(px, py)) return { x: px, y: py };
      }
    }
    return { x: x + 40, y: y + 40 };
  }

  function deleteNode(id) {
    const n = state.g.nodes[id];
    if (!n) return;
    if (n.type === 'result') { toast(t('cantDeleteResult'), 'warn'); return; }
    const affected = new Set(state.g.links.filter(l => l.from === id).map(l => l.to));
    state.g.links = state.g.links.filter(l => l.from !== id && l.to !== id);
    delete state.g.nodes[id];
    delete portCache[id];
    const e = nodeEl(id);
    if (selected === id) selected = null;
    if (e) { e.classList.add('removing'); setTimeout(() => e.remove(), 200); }
    affected.forEach(a => state.g.nodes[a] && renderNode(state.g.nodes[a]));
    afterChange();
    commit();
    refreshSidebar();
  }

  function duplicateNode(id) {
    const n = state.g.nodes[id];
    if (!n || n.type === 'result') return;
    const copy = JSON.parse(JSON.stringify(n));
    copy.id = newId(); copy.x += 30; copy.y += 30;
    state.g.nodes[copy.id] = copy;
    renderNode(copy);
    select(copy.id);
    afterChange(); commit();
  }

  function connect(fromId, toId, port, silent) {
    if (E.createsCycle(state.g, fromId, toId)) { toast(t('cycle'), 'warn'); return false; }
    state.g.links = state.g.links.filter(l => !(l.to === toId && l.port === port));
    const id = 'l' + (state.g.next++);
    state.g.links.push({ id, from: fromId, to: toId, port });
    freshLinks.add(id);
    renderNode(state.g.nodes[toId]);
    afterChange();
    if (!silent) commit();
    return true;
  }
  function disconnect(toId, port) {
    state.g.links = state.g.links.filter(l => !(l.to === toId && l.port === port));
    renderNode(state.g.nodes[toId]);
    afterChange(); commit();
  }

  // first free (or any) input port of a node usable for a link
  function bestPort(nodeId) {
    const n = state.g.nodes[nodeId];
    const ps = E.ports(n).filter(p => p.def.kind !== 'name');
    const free = ps.find(p => !E.linkInto(state.g, nodeId, p.key) && !(n.vals && (n.vals[p.key] || '').trim()) && !p.def.ch);
    return (free || ps.find(p => !E.linkInto(state.g, nodeId, p.key)) || ps[0] || {}).key;
  }

  // repeat groups
  function addRep(id) {
    const n = state.g.nodes[id];
    const f = n.type === 'fn' ? C.byId[n.fn] : null;
    if (f && f.r) n.rep = Math.max(f.r.min, n.rep || f.r.min) + 1;
    else if (n.type === 'join') n.rep = Math.max(2, n.rep || 2) + 1;
    else if (n.type === 'custom') n.rep = (n.rep == null ? 1 : n.rep) + 1;
    renderNode(n); afterChange(); commit();
    const e = nodeEl(id);
    const inputs = e.querySelectorAll('.port-row input');
    if (inputs.length) inputs[inputs.length - 1].focus({ preventScroll: true });
  }
  function removeGroup(id, gi) {
    const n = state.g.nodes[id];
    const parse = key => {
      let m;
      if ((m = key.match(/^r(\d+)_(\d+)$/))) return { g: +m[1], mk: g => 'r' + g + '_' + m[2] };
      if ((m = key.match(/^([jc])(\d+)$/))) return { g: +m[2], mk: g => m[1] + g };
      return null;
    };
    const shift = obj => {
      if (!obj) return obj;
      const out = {};
      Object.keys(obj).forEach(k => {
        const p = parse(k);
        if (!p) { out[k] = obj[k]; return; }
        if (p.g === gi) return;
        out[p.g > gi ? p.mk(p.g - 1) : k] = obj[k];
      });
      return out;
    };
    n.vals = shift(n.vals); n.ch = shift(n.ch);
    state.g.links = state.g.links.filter(l => {
      if (l.to !== id) return true;
      const p = parse(l.port);
      if (!p) return true;
      if (p.g === gi) return false;
      if (p.g > gi) l.port = p.mk(p.g - 1);
      return true;
    });
    n.rep = Math.max(0, (n.rep || 1) - 1);
    renderNode(n); afterChange(); commit();
  }

  /* ------------------------------ SELECTION ----------------------------- */
  function select(id) {
    if (selected === id) return;
    const prev = selected && nodeEl(selected);
    if (prev) prev.classList.remove('sel');
    selected = id;
    const e = id && nodeEl(id);
    if (e) { e.classList.add('sel'); dom.nodes.appendChild(e); }
    drawWires();
    if (id) {
      const n = state.g.nodes[id];
      sbTarget = n.type === 'fn' ? { kind: 'fn', id: n.fn } : n.type === 'result' ? null : { kind: 'block', type: n.type };
      if (state.sbOpen && !isCompact()) renderSidebar();
    }
  }

  /* -------------------------------- VIEW -------------------------------- */
  function applyView() {
    const v = state.view;
    dom.canvas.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    dom.wrap.style.backgroundSize = `${24 * v.s}px ${24 * v.s}px`;
    dom.wrap.style.backgroundPosition = `${v.x}px ${v.y}px`;
    dom.zoomVal.textContent = Math.round(v.s * 100) + '%';
  }
  function toWorld(cx, cy) {
    const r = dom.wrap.getBoundingClientRect();
    return { x: (cx - r.left - state.view.x) / state.view.s, y: (cy - r.top - state.view.y) / state.view.s };
  }
  function zoomAt(cx, cy, factor) {
    const r = dom.wrap.getBoundingClientRect();
    const v = state.view;
    const ns = Math.min(2, Math.max(0.3, v.s * factor));
    const px = cx - r.left, py = cy - r.top;
    v.x = px - (px - v.x) * (ns / v.s);
    v.y = py - (py - v.y) * (ns / v.s);
    v.s = ns;
    applyView(); scheduleSave();
  }
  function animateView(target) {
    const from = Object.assign({}, state.view);
    const t0 = performance.now(), dur = 380;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      state.view.x = from.x + (target.x - from.x) * e;
      state.view.y = from.y + (target.y - from.y) * e;
      state.view.s = from.s + (target.s - from.s) * e;
      applyView();
      if (k < 1) requestAnimationFrame(step); else scheduleSave();
    };
    requestAnimationFrame(step);
  }
  function fitView(animate) {
    const ns = Object.values(state.g.nodes);
    if (!ns.length) return;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ns.forEach(n => { const c = portCache[n.id] || { w: 264, h: 150 }; x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + c.w); y2 = Math.max(y2, n.y + c.h); });
    const r = dom.wrap.getBoundingClientRect();
    const pad = 50;
    const minS = isCompact() ? 0.6 : 0.45;
    const fit = Math.min((r.width - pad * 2) / (x2 - x1), (r.height - pad * 2) / (y2 - y1));
    const s = Math.min(1.1, Math.max(minS, fit));
    const target = { s, x: (r.width - (x2 - x1) * s) / 2 - x1 * s, y: (r.height - (y2 - y1) * s) / 2 - y1 * s };
    if (fit < minS) {
      // too big to fit while staying readable: keep the Result block in view on the right
      const res = resultNode(), c = portCache[res.id] || { w: 230, h: 120 };
      target.x = r.width - pad - (res.x + c.w) * s;
      target.y = r.height / 2 - (res.y + c.h / 2) * s;
    }
    if (animate) animateView(target); else { Object.assign(state.view, target); applyView(); }
  }
  function centerOn(id) {
    const n = state.g.nodes[id], c = portCache[id];
    if (!n || !c) return;
    const r = dom.wrap.getBoundingClientRect();
    const s = Math.max(state.view.s, 0.8);
    animateView({ s, x: r.width / 2 - (n.x + c.w / 2) * s, y: r.height / 2 - (n.y + c.h / 2) * s });
  }

  function arrange() {
    E.autoLayout(state.g, n => portCache[n.id] ? { w: portCache[n.id].w, h: portCache[n.id].h } : { w: 264, h: 150 });
    dom.nodes.classList.add('animating');
    Object.values(state.g.nodes).forEach(n => {
      const e = nodeEl(n.id);
      if (e) { e.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; e.style.transform = `translate(${n.x}px, ${n.y}px)`; }
    });
    // animate wires during the transition
    const t0 = performance.now();
    const tick = () => {
      // read actual positions from computed transforms
      Object.values(state.g.nodes).forEach(n => {
        const e = nodeEl(n.id); if (!e) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(e).transform);
        n._x = m.m41; n._y = m.m42;
      });
      const saved = Object.values(state.g.nodes).map(n => [n, n.x, n.y]);
      saved.forEach(([n]) => { n.x = n._x; n.y = n._y; });
      drawWires();
      saved.forEach(([n, x, y]) => { n.x = x; n.y = y; delete n._x; delete n._y; });
      if (performance.now() - t0 < 560) requestAnimationFrame(tick);
      else {
        Object.values(state.g.nodes).forEach(n => { const e = nodeEl(n.id); if (e) e.style.transition = ''; });
        drawWires(); fitView(true);
      }
    };
    requestAnimationFrame(tick);
    commit();
  }

  /* ---------------------------- INTERACTION ----------------------------- */
  const pointers = new Map();
  let gesture = null;

  function onPointerDown(ev) {
    if (ev.button > 0) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    hideTooltip();
    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;
    closeQuick();

    const target = ev.target;
    const nodeE = target.closest('.node');
    const outS = target.closest('.socket.out');
    const inS = target.closest('.socket.in');

    // pending tap-to-connect mode
    if (gesture && gesture.type === 'pending') {
      finishWire(ev, gesture);
      gesture = null;
      return;
    }
    if (outS) {
      ev.preventDefault();
      const id = nodeE.dataset.id;
      gesture = { type: 'wire', dir: 'out', from: id, start: { x: ev.clientX, y: ev.clientY }, moved: false };
      beginWireVisual(gesture);
      dom.wrap.setPointerCapture(ev.pointerId);
      return;
    }
    if (inS) {
      ev.preventDefault();
      const id = nodeE.dataset.id, port = inS.dataset.port;
      const link = E.linkInto(state.g, id, port);
      if (link) {
        // pick the wire up from its input and re-route it
        state.g.links = state.g.links.filter(l => l !== link);
        renderNode(state.g.nodes[id]); afterChange();
        gesture = { type: 'wire', dir: 'out', from: link.from, start: { x: ev.clientX, y: ev.clientY }, moved: true, detached: true };
      } else {
        gesture = { type: 'wire', dir: 'in', to: id, port, start: { x: ev.clientX, y: ev.clientY }, moved: false };
      }
      beginWireVisual(gesture);
      updateTempWire(gesture, ev.clientX, ev.clientY);
      dom.wrap.setPointerCapture(ev.pointerId);
      return;
    }
    if (target.closest('input, select, textarea, button, .linked')) return;
    if (nodeE) {
      const id = nodeE.dataset.id;
      select(id);
      const n = state.g.nodes[id];
      gesture = { type: 'drag', id, start: { x: ev.clientX, y: ev.clientY }, orig: { x: n.x, y: n.y }, moved: false };
      dom.wrap.setPointerCapture(ev.pointerId);
      return;
    }
    // background
    gesture = { type: 'pan', start: { x: ev.clientX, y: ev.clientY }, orig: { x: state.view.x, y: state.view.y }, moved: false, t: performance.now() };
    dom.wrap.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev) {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (gesture && gesture.type === 'pinch') { movePinch(); return; }
    if (!gesture) return;
    const dx = ev.clientX - gesture.start.x, dy = ev.clientY - gesture.start.y;
    if (!gesture.moved && Math.hypot(dx, dy) > 4) gesture.moved = true;
    if (gesture.type === 'pan' && gesture.moved) {
      dom.wrap.classList.add('panning');
      state.view.x = gesture.orig.x + dx; state.view.y = gesture.orig.y + dy; applyView();
    } else if (gesture.type === 'drag' && gesture.moved) {
      const n = state.g.nodes[gesture.id];
      n.x = Math.round(gesture.orig.x + dx / state.view.s);
      n.y = Math.round(gesture.orig.y + dy / state.view.s);
      const e = nodeEl(n.id);
      e.classList.add('dragging');
      e.style.transform = `translate(${n.x}px, ${n.y}px)`;
      drawWires();
    } else if (gesture.type === 'wire' || gesture.type === 'pending') {
      updateTempWire(gesture, ev.clientX, ev.clientY);
    }
  }

  function onPointerUp(ev) {
    pointers.delete(ev.pointerId);
    if (gesture && gesture.type === 'pinch') { if (pointers.size < 2) { gesture = null; scheduleSave(); } return; }
    if (!gesture) return;
    const g = gesture;
    dom.wrap.classList.remove('panning');
    if (g.type === 'pan') {
      if (!g.moved) {
        const now = performance.now();
        if (lastBgTap && now - lastBgTap.t < 350 && Math.hypot(ev.clientX - lastBgTap.x, ev.clientY - lastBgTap.y) < 20) {
          openQuick(ev.clientX, ev.clientY, null);
          lastBgTap = null;
        } else {
          lastBgTap = { t: now, x: ev.clientX, y: ev.clientY };
          select(null);
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        }
      } else scheduleSave();
      gesture = null;
    } else if (g.type === 'drag') {
      const e = nodeEl(g.id); if (e) e.classList.remove('dragging');
      if (g.moved) commit();
      gesture = null;
    } else if (g.type === 'wire') {
      if (!g.moved && !g.detached) {
        // tap on a socket: wait for a second tap on the target
        g.type = 'pending';
        toast(g.dir === 'out' ? L(['Ora tocca il campo in cui inserirlo', 'Now tap the field to plug it into']) : L(['Ora tocca il blocco da inserire', 'Now tap the block to plug in']), 'info');
        return;
      }
      finishWire(ev, g);
      gesture = null;
    }
  }
  let lastBgTap = null;

  function beginWireVisual(g) {
    dom.wrap.classList.add('connecting');
    // mark ports that would create a cycle
    if (g.dir === 'out') {
      dom.nodes.querySelectorAll('.node').forEach(ne => {
        const blocked = E.createsCycle(state.g, g.from, ne.dataset.id);
        ne.querySelectorAll('.socket.in').forEach(s => s.classList.toggle('blocked', blocked));
      });
    }
  }
  function endWireVisual() {
    dom.wrap.classList.remove('connecting');
    dom.nodes.querySelectorAll('.socket.blocked, .socket.target').forEach(s => s.classList.remove('blocked', 'target', 'ok'));
    tempWire = null;
    drawWires();
  }
  function updateTempWire(g, cx, cy) {
    const p = toWorld(cx, cy);
    if (g.dir === 'out') tempWire = { a: sockWorld(g.from, '$out'), b: p };
    else tempWire = { a: p, b: sockWorld(g.to, g.port) };
    dom.nodes.querySelectorAll('.socket.target').forEach(s => s.classList.remove('target', 'ok'));
    const hit = document.elementFromPoint(cx, cy);
    if (hit) {
      const s = g.dir === 'out' ? hit.closest('.socket.in') : hit.closest('.socket.out');
      if (s) s.classList.add('target', 'ok');
    }
    drawWires();
  }

  function finishWire(ev, g) {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const nodeE = hit && hit.closest('.node');
    endWireVisual();
    let done = false;
    if (g.dir === 'out') {
      const inS = hit && hit.closest('.socket.in');
      if (inS && nodeE && nodeE.dataset.id !== g.from) done = connect(g.from, nodeE.dataset.id, inS.dataset.port);
      else if (nodeE && nodeE.dataset.id !== g.from) {
        const row = hit.closest('.port-row');
        const port = row && row.dataset.port && row.querySelector('.socket.in') ? row.dataset.port : bestPort(nodeE.dataset.id);
        if (port) done = connect(g.from, nodeE.dataset.id, port);
      } else if (!nodeE && hit && hit.closest('#canvasWrap')) {
        openQuick(ev.clientX, ev.clientY, { from: g.from });
        done = true;
      }
    } else {
      if (nodeE && nodeE.dataset.id !== g.to && state.g.nodes[nodeE.dataset.id].type !== 'result') done = connect(nodeE.dataset.id, g.to, g.port);
      else if (!nodeE && hit && hit.closest('#canvasWrap')) { openQuick(ev.clientX, ev.clientY, { to: g.to, port: g.port }); done = true; }
    }
    if (g.detached && !done) commit();
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    if (gesture && gesture.type === 'drag') { const e = nodeEl(gesture.id); if (e) e.classList.remove('dragging'); }
    if (gesture && (gesture.type === 'wire' || gesture.type === 'pending')) endWireVisual();
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: Object.assign({}, state.view) };
  }
  function movePinch() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    const g = gesture, r = dom.wrap.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ns = Math.min(2, Math.max(0.3, g.v0.s * d / g.d0));
    const wx = (g.m0.x - r.left - g.v0.x) / g.v0.s, wy = (g.m0.y - r.top - g.v0.y) / g.v0.s;
    state.view.s = ns;
    state.view.x = m.x - r.left - wx * ns;
    state.view.y = m.y - r.top - wy * ns;
    applyView();
  }

  function onWheel(ev) {
    if (ev.target.closest('select')) return;
    ev.preventDefault();
    const isMouseWheel = ev.deltaMode === 1 || (ev.deltaX === 0 && Math.abs(ev.deltaY) >= 40 && Number.isInteger(ev.deltaY));
    if (ev.ctrlKey || isMouseWheel) {
      zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)));
    } else {
      state.view.x -= ev.deltaX; state.view.y -= ev.deltaY; applyView(); scheduleSave();
    }
  }

  // clicks inside nodes (buttons)
  function onNodeClick(ev) {
    const b = ev.target.closest('button');
    if (!b) return;
    const nodeE = b.closest('.node');
    if (!nodeE) return;
    const id = nodeE.dataset.id, n = state.g.nodes[id];
    switch (b.dataset.act) {
      case 'del': deleteNode(id); break;
      case 'help':
        select(id);
        sbTarget = n.type === 'fn' ? { kind: 'fn', id: n.fn } : n.type === 'result' ? null : { kind: 'block', type: n.type };
        openSidebar(); break;
      case 'unlink': disconnect(id, b.dataset.port); break;
      case 'addrep': addRep(id); break;
      case 'rmgroup': removeGroup(id, +b.dataset.group); break;
      case 'bool': n.value = b.dataset.v === '1'; renderNode(n); afterChange(); commit(); break;
    }
  }
  function onNodeInput(ev) {
    const inp = ev.target;
    const nodeE = inp.closest('.node');
    if (!nodeE || !inp.dataset.key) return;
    const n = state.g.nodes[nodeE.dataset.id];
    const key = inp.dataset.key;
    if (key === '$value') {
      n.value = inp.value;
      if (n.type === 'custom') nodeE.querySelector('.node-name').textContent = nodeTitle(n);
    } else if (key === '$op') { n.op = inp.value; }
    else if (key[0] === '#') { n.ch = n.ch || {}; n.ch[key.slice(1)] = parseInt(inp.value, 10); }
    else {
      n.vals = n.vals || {};
      n.vals[key] = inp.value;
      const chip = inp.parentElement.querySelector('.chip');
      if (chip) updateChip(chip, inp.value, E.nameSet(state.g));
    }
    if (n.type === 'fn' && (n.fn === 'LET' || n.fn === 'LAMBDA')) refreshChips();
    afterChange(true);
    if (ev.type === 'change') commit();
  }

  /* ------------------------------- LIBRARY ------------------------------ */
  const openCats = new Set(['basic', 'logic']);
  function libraryItems() {
    const items = [];
    C.BLOCKS.forEach(b => items.push({ spec: b.id, cat: 'basic', name: L(b.t), sub: L(b.d), mono: false, search: (b.t.join(' ') + ' ' + b.d.join(' ')) }));
    C.FUNCTIONS.forEach(f => items.push({ spec: f.id, cat: f.cat, name: state.mode === 'excel' ? f.id : f.gs, sub: L(f.t), mono: true,
      search: f.id + ' ' + f.gs + ' ' + f.t.join(' ') + ' ' + f.d.join(' ') }));
    return items;
  }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function filterItems(q) {
    const items = libraryItems();
    if (!q) return items;
    const qn = norm(q.trim());
    const scored = items.map(it => {
      const name = norm(it.name), sub = norm(it.sub), all = norm(it.search);
      let s = -1;
      if (name === qn) s = 100; else if (name.startsWith(qn)) s = 80; else if (name.includes(qn)) s = 60;
      else if (sub.includes(qn)) s = 40; else if (all.includes(qn)) s = 20;
      return { it, s };
    }).filter(x => x.s >= 0).sort((a, b) => b.s - a.s);
    return scored.map(x => x.it);
  }
  function buildLibrary() {
    const q = dom.libSearch.value;
    const list = dom.libList;
    list.innerHTML = '';
    const items = filterItems(q);
    if (!items.length) { list.innerHTML = `<div class="lib-empty">${esc(t('noResults'))}</div>`; return; }
    C.CATEGORIES.forEach(cat => {
      const its = items.filter(i => i.cat === cat.id);
      if (!its.length) return;
      const c = el('div', 'cat' + (q || openCats.has(cat.id) ? ' open' : ''));
      const h = el('button', 'cat-head', `<span class="cat-badge" style="background:${cat.color}">${esc(cat.icon)}</span><span>${esc(L(cat.n))}</span>${icon('chev').replace('<svg>', '<svg class="chev">')}`);
      h.addEventListener('click', () => { c.classList.toggle('open'); if (c.classList.contains('open')) openCats.add(cat.id); else openCats.delete(cat.id); });
      c.appendChild(h);
      const wrap = el('div', 'cat-items'), inner = el('div');
      its.forEach(it => {
        const tile = el('div', 'tile');
        tile.style.setProperty('--c', cat.color);
        tile.dataset.spec = it.spec;
        tile.innerHTML = `<span class="tile-name" style="${it.mono ? '' : 'font-family:var(--font)'}">${esc(it.name)}</span><span class="tile-sub">${esc(it.sub)}</span>`;
        const info = el('button', 'tile-info', icon('help'));
        info.dataset.tip = 'explainTip';
        info.addEventListener('click', ev => { ev.stopPropagation(); sbTarget = it.spec[0] === '@' ? { kind: 'block', type: it.spec === '@fn' ? 'custom' : it.spec.slice(1) } : { kind: 'fn', id: it.spec }; openSidebar(); });
        tile.appendChild(info);
        bindTileDrag(tile, it);
        inner.appendChild(tile);
      });
      wrap.appendChild(inner); c.appendChild(wrap); list.appendChild(c);
    });
  }
  function bindTileDrag(tile, it) {
    let st = null, ghost = null;
    tile.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.tile-info') || ev.button > 0) return;
      st = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, type: ev.pointerType };
    });
    tile.addEventListener('pointermove', ev => {
      if (!st || ev.pointerId !== st.id) return;
      const dx = ev.clientX - st.x, dy = ev.clientY - st.y;
      // touch: only horizontal drags start a drag (vertical scrolls the list)
      if (!ghost && Math.hypot(dx, dy) > 8 && (st.type !== 'touch' || Math.abs(dx) > Math.abs(dy) * 1.3)) {
        ghost = el('div', 'drag-ghost', esc(it.name));
        ghost.style.setProperty('--c', catOf(it.cat).color);
        document.body.appendChild(ghost);
        tile.setPointerCapture(ev.pointerId);
        if (isCompact()) closePanels();
      }
      if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
    });
    const end = ev => {
      if (!st || ev.pointerId !== st.id) return;
      if (ghost) {
        ghost.remove(); ghost = null;
        const r = dom.wrap.getBoundingClientRect();
        if (ev.type === 'pointerup' && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
          const p = toWorld(ev.clientX, ev.clientY);
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const n = addNodeAt(it.spec, p.x, p.y);
          // dropped on an input field: plug it in directly
          const row = hit && hit.closest('.port-row');
          const target = hit && hit.closest('.node');
          if (row && target && row.dataset.port && row.querySelector('.socket.in') && target.dataset.id !== n.id) connect(n.id, target.dataset.id, row.dataset.port);
        }
      } else if (ev.type === 'pointerup' && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < 8) {
        addNodeCenter(it.spec);
      }
      st = null;
    };
    tile.addEventListener('pointerup', end);
    tile.addEventListener('pointercancel', end);
  }

  /* ------------------------------ QUICK ADD ----------------------------- */
  let quickCtx = null, quickIdx = 0;
  function openQuick(cx, cy, ctx) {
    const q = $('#quick');
    quickCtx = { cx, cy, ctx };
    q.hidden = false;
    const w = 340, h = 420;
    q.style.left = Math.min(window.innerWidth - w - 10, Math.max(10, cx - 20)) + 'px';
    q.style.top = Math.min(window.innerHeight - h - 10, Math.max(10, cy - 20)) + 'px';
    const inp = $('#quickInput');
    inp.value = ''; inp.placeholder = t('search');
    renderQuick();
    setTimeout(() => inp.focus(), 30);
  }
  function closeQuick() { $('#quick').hidden = true; quickCtx = null; }
  function renderQuick() {
    const items = filterItems($('#quickInput').value).slice(0, 40);
    const list = $('#quickList');
    quickIdx = 0;
    list.innerHTML = '';
    items.forEach((it, i) => {
      const cat = catOf(it.cat);
      const b = el('button', 'quick-item' + (i === 0 ? ' active' : ''), `<span class="cat-badge" style="background:${cat.color}">${esc(cat.icon)}</span><span><div class="qi-name" style="${it.mono ? '' : 'font-family:var(--font)'}">${esc(it.name)}</div><div class="qi-sub">${esc(it.sub)}</div></span>`);
      b.addEventListener('click', () => pickQuick(it));
      b._it = it;
      list.appendChild(b);
    });
  }
  function pickQuick(it) {
    if (!quickCtx) return;
    const { cx, cy, ctx } = quickCtx;
    closeQuick();
    const p = toWorld(cx, cy);
    const n = createNode(it.spec, Math.round(p.x), Math.round(p.y));
    const e = renderNode(n);
    if (ctx && ctx.to) { n.x = Math.round(p.x - e.offsetWidth - 20); n.y = Math.round(p.y - 26); }
    else { n.x = Math.round(p.x + 20); n.y = Math.round(p.y - 40); }
    e.style.transform = `translate(${n.x}px, ${n.y}px)`;
    select(n.id);
    measure(n, e);
    if (ctx && ctx.from) { const port = bestPort(n.id); if (port) connect(ctx.from, n.id, port, true); }
    if (ctx && ctx.to) connect(n.id, ctx.to, ctx.port, true);
    afterChange(); commit();
    const first = e.querySelector('input');
    if (first && !(window.matchMedia('(hover: none)').matches)) first.focus({ preventScroll: true });
  }

  /* ------------------------------- SIDEBAR ------------------------------ */
  function openSidebar() {
    state.sbOpen = true;
    if (isCompact()) dom.app.classList.remove('lib-open');
    dom.app.classList.add('sb-open');
    renderSidebar();
    scheduleSave();
    setTimeout(() => { remeasureAll(); drawWires(); }, 420);
  }
  function closeSidebar() {
    state.sbOpen = false;
    dom.app.classList.remove('sb-open');
    scheduleSave();
  }
  function toggleSidebarGuide() {
    if (state.sbOpen && dom.app.classList.contains('sb-open') && sbTarget == null) { closeSidebar(); return; }
    sbTarget = null; openSidebar();
  }
  function refreshSidebar() { if (dom.app.classList.contains('sb-open')) renderSidebar(); }

  function renderSidebar() {
    const b = dom.sbBody;
    b.scrollTop = 0;
    if (!sbTarget) { b.innerHTML = guideHtml(); return; }
    if (sbTarget.kind === 'block') { b.innerHTML = blockHtml(sbTarget.type); bindSidebar(); return; }
    const f = C.byId[sbTarget.id];
    const cat = catOf(f.cat);
    const name = state.mode === 'excel' ? f.id : f.gs;
    let h = `<div class="sb-hero"><span class="node-icon" style="background:${cat.color}">${esc(cat.icon)}</span><div><div class="sb-name">${esc(name)}</div><div class="sb-friendly">${esc(L(f.t))}</div></div></div>`;
    h += `<div class="sb-names"><span class="name-chip"><span class="dot dot-excel"></span>Excel <b>${esc(f.id)}</b></span><span class="name-chip"><span class="dot dot-sheets"></span>${esc(t('modeSheets'))} <b>${esc(f.gs)}</b></span></div>`;
    h += `<p class="sb-p" style="margin-top:14px">${esc(L(f.d))}</p>`;
    // syntax
    const M = E.MODES[state.mode];
    const argNames = [];
    (f.a || []).forEach(a => argNames.push(a.opt ? `[${L(a.n)}]` : L(a.n)));
    if (f.r) { const g = f.r.a.map(a => L(a.n)).join(M.sep + ' '); argNames.push(g); argNames.push('…'); }
    (f.tl || []).forEach(a => argNames.push(a.opt ? `[${L(a.n)}]` : L(a.n)));
    h += `<div class="sb-h">${esc(t('syntax'))}</div><pre class="code"><span class="tk-fn">${esc(name)}</span>(${esc(argNames.join(M.sep + ' '))})</pre>`;
    // params
    const allArgs = [].concat((f.a || []).map(a => [a, false]), f.r ? f.r.a.map(a => [a, true]) : [], (f.tl || []).map(a => [a, false]));
    if (allArgs.length) {
      h += `<div class="sb-h">${esc(t('params'))}</div>`;
      allArgs.forEach(([a, rep]) => {
        h += `<div class="param"><div class="param-name">${esc(L(a.n))}${a.opt ? `<span class="badge">${esc(t('optional'))}</span>` : ''}${rep ? `<span class="badge rep">${esc(t('repeatable'))}</span>` : ''}</div><div class="param-desc">${esc(L(a.d))}</div>`;
        if (a.ch) h += `<ul class="choices">${a.ch.map(o => `<li>${esc(L(o.l))}</li>`).join('')}</ul>`;
        h += `</div>`;
      });
    }
    // example
    let exText = f.ex;
    try { exText = E.toText(E.parse(f.ex), state.mode, false); } catch (e) { exText = '=' + f.ex; }
    h += `<div class="sb-h">${esc(t('example'))}</div><pre class="code">${highlight(exText)}</pre><p class="sb-p" style="margin-top:10px">${esc(L(f.exd))}</p>`;
    h += `<div class="ex-actions"><button class="btn small ghost" data-sb="copyex">${icon('copy')}<span>${esc(t('copyExample'))}</span></button><button class="btn small ghost" data-sb="tryex">${icon('blocks')}<span>${esc(t('tryExample'))}</span></button></div>`;
    if (f.tip) h += `<div class="callout tip"><b>${esc(t('tip'))}</b>${esc(L(f.tip))}</div>`;
    if (state.mode === 'gsheets' && (f.gsnote || f.gsf)) {
      h += `<div class="callout note"><b>${esc(t('note'))}</b>${esc(f.gsnote ? L(f.gsnote) : t('gsFallback'))}</div>`;
    }
    b.innerHTML = h;
    b._ex = exText;
    bindSidebar();
  }
  function highlight(formula) {
    try {
      const ast = E.parse(formula);
      return '<span class="tk-op">=</span>' + E.tokens(ast, state.mode, false).map(tk => tk.c ? `<span class="${tk.c}">${esc(tk.s)}</span>` : esc(tk.s)).join('');
    } catch (e) { return esc(formula); }
  }
  function blockHtml(type) {
    const b = blockDef(type === 'custom' ? 'fn' : type);
    const color = nodeColor({ type });
    let h = `<div class="sb-hero"><span class="node-icon" style="background:${color}">${esc(BLOCK_ICON[type])}</span><div><div class="sb-name" style="font-family:var(--font)">${esc(L(b.t))}</div><div class="sb-friendly">${esc(t('blockDesc'))}</div></div></div>`;
    h += `<p class="sb-p">${esc(L(b.d))}</p>`;
    const ex = { num: '=A1*1.22', text: '="Total: "&A1', ref: '=SUM(B2:B20)', bool: '=IF(A1,"Yes","No")', name: '=LET(x,A1*2,x+1)', math: '=(A1+B1)/2', cmp: '=IF(A1>=10,"OK","KO")', join: '=A1&" "&B1', neg: '=A1*20%', custom: '=SUBTOTAL(9,A1:A10)' }[type];
    if (ex) h += `<div class="sb-h">${esc(t('example'))}</div><pre class="code">${highlight(ex)}</pre>`;
    h += `<div class="sb-h">${esc(t('welcomeTips'))}</div><ul class="tricks"><li>${esc(t('trick1'))}</li><li>${esc(t('trick2'))}</li></ul>`;
    return h;
  }
  function guideHtml() {
    return `<div class="sb-hero"><span class="node-icon" style="background:var(--accent)">?</span><div><div class="sb-name" style="font-family:var(--font)">${esc(t('welcomeTitle'))}</div><div class="sb-friendly">Formula Builder</div></div></div>
      <ol class="steps"><li>${esc(t('welcome1'))}</li><li>${esc(t('welcome2'))}</li><li>${esc(t('welcome3'))}</li><li>${esc(t('welcome4'))}</li></ol>
      <div class="sb-h">${esc(t('welcomeTips'))}</div>
      <ul class="tricks"><li>${esc(t('trick1'))}</li><li>${esc(t('trick2'))}</li><li>${esc(t('trick3'))}</li><li>${esc(t('trick4'))}</li><li>${esc(t('trick5'))}</li></ul>
      <div class="sb-h">${esc(t('modesTitle'))}</div><p class="sb-p">${esc(t('modesText'))}</p>
      <div class="sb-foot">${esc(t('sourceGS'))}</div>`;
  }
  function bindSidebar() {
    dom.sbBody.querySelectorAll('[data-sb]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.sb === 'copyex') copyText(dom.sbBody._ex).then(() => toast(t('copied'), 'ok'));
      if (btn.dataset.sb === 'tryex') importFormula(dom.sbBody._ex, true);
    }));
  }

  /* ---------------------------- IMPORT / IO ----------------------------- */
  function hasContent() { return Object.values(state.g.nodes).length > 1 || state.g.links.length > 0; }

  function importFormula(text, askReplace) {
    let ast;
    try { ast = E.parse(text, state.mode); } catch (e) { return false; }
    const go = () => {
      const res = resultNode();
      state.g.nodes = {}; state.g.links = [];
      state.g.nodes[res.id] = Object.assign(res, { vals: {} });
      const r = E.astToGraph(ast, newId);
      r.nodes.forEach(n => { n.x = 0; n.y = 0; state.g.nodes[n.id] = n; });
      r.links.forEach(l => { l.id = 'l' + (state.g.next++); state.g.links.push(l); });
      if (r.rootId) state.g.links.push({ id: 'l' + (state.g.next++), from: r.rootId, to: res.id, port: 'in' });
      else res.vals.in = r.rootInline || '';
      selected = null;
      renderAll();
      E.autoLayout(state.g, n => portCache[n.id] ? { w: portCache[n.id].w, h: portCache[n.id].h } : { w: 264, h: 150 });
      Object.values(state.g.nodes).forEach(n => { const e = nodeEl(n.id); if (e) { e.style.animation = ''; e.style.transform = `translate(${n.x}px, ${n.y}px)`; } });
      afterChange();
      fitView(true);
      commit();
      if (isCompact()) closePanels();
    };
    if (askReplace && hasContent()) {
      dialog({ title: t('tryExample'), text: t('confirmReplace'), ok: t('replace'), onOk: go });
    } else go();
    return true;
  }

  function newGraph() {
    const go = () => {
      const res = resultNode();
      state.g.nodes = {}; state.g.links = [];
      res.vals = {}; res.x = 760; res.y = 220;
      state.g.nodes[res.id] = res;
      selected = null;
      renderAll(); fitCenterResult(); commit(); refreshSidebar();
    };
    dialog({ title: t('newGraph'), text: t('confirmNew'), ok: t('startOver'), danger: true, onOk: go });
  }
  function fitCenterResult() {
    const r = dom.wrap.getBoundingClientRect();
    const res = resultNode();
    state.view.s = 1;
    state.view.x = r.width * 0.64 - res.x - 115;
    state.view.y = r.height * 0.42 - res.y - 40;
    applyView();
  }

  const EXAMPLES = {
    1: ['=IFS(B2>=90,"Ottimo",B2>=75,"Buono",B2>=60,"Sufficiente",TRUE,"Insufficiente")', '=IFS(B2>=90,"Excellent",B2>=75,"Good",B2>=60,"Pass",TRUE,"Fail")'],
    2: ['=IFERROR(XLOOKUP(A2,Listino!A:A,Listino!C:C),"Non trovato")', '=IFERROR(XLOOKUP(A2,Prices!A:A,Prices!C:C),"Not found")'],
    3: ['=DATEDIF(B2,TODAY(),"Y")', '=DATEDIF(B2,TODAY(),"Y")'],
    4: ['=PROPER(TRIM(A2))&" "&UPPER(TRIM(B2))', '=PROPER(TRIM(A2))&" "&UPPER(TRIM(B2))'],
    5: ['=SUMIFS(D2:D100,B2:B100,"Roma",C2:C100,">=100")', '=SUMIFS(D2:D100,B2:B100,"London",C2:C100,">=100")'],
    6: ['=LET(netto,SUM(B2:B10),iva,netto*22%,IF(netto>0,netto+iva,0))', '=LET(net,SUM(B2:B10),vat,net*20%,IF(net>0,net+vat,0))']
  };

  function saveFile() {
    const data = JSON.stringify({ app: 'formula-builder', v: 1, g: state.g, mode: state.mode }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'formula.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(t('savedFile'), 'ok');
  }
  function openFile(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d.g || !d.g.nodes) throw new Error('bad');
        state.g = d.g;
        if (d.mode) setMode(d.mode, true);
        ensureResult();
        selected = null;
        renderAll(); fitView(true); commit();
      } catch (e) { toast(t('openErr'), 'warn'); }
    };
    rd.readAsText(file);
  }

  /* ---------------------------- MODE & LANG ----------------------------- */
  function setMode(m, silent) {
    state.mode = m;
    document.body.classList.toggle('mode-gsheets', m === 'gsheets');
    segSet($('#modeSeg'), 'mode', m);
    if (!silent) {
      Object.values(state.g.nodes).forEach(n => renderNode(n, true));
      afterChange();
      buildLibrary();
      refreshSidebar();
      scheduleSave();
    }
  }
  function setLang(l) {
    I.setLang(l);
    document.documentElement.lang = l;
    segSet($('#langSeg'), 'lang', l);
    applyTexts();
    buildLibrary();
    Object.values(state.g.nodes).forEach(n => renderNode(n, true));
    afterChange();
    refreshSidebar();
  }
  function segSet(seg, attr, val) {
    const btns = [...seg.querySelectorAll('button')];
    btns.forEach(b => b.classList.toggle('on', b.dataset[attr] === val));
    const on = btns.find(b => b.dataset[attr] === val);
    const thumb = seg.querySelector('.seg-thumb');
    if (on && thumb) { thumb.style.width = on.offsetWidth + 'px'; thumb.style.transform = `translateX(${on.offsetLeft - 3}px)`; }
  }
  function applyTexts() {
    document.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
    dom.libSearch.placeholder = t('search');
    document.title = 'Formula Builder';
    requestAnimationFrame(() => { segSet($('#modeSeg'), 'mode', state.mode); segSet($('#langSeg'), 'lang', window.FB_LANG); });
  }

  /* --------------------------- SMALL WIDGETS ---------------------------- */
  let toastTimer = null;
  function toast(msg, kind) {
    const e = $('#toast');
    e.innerHTML = (kind === 'ok' ? icon('check') : kind === 'warn' ? icon('warn') : '') + `<span>${esc(msg)}</span>`;
    e.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => e.classList.remove('show'), 2400);
  }

  function dialog(o) {
    const d = $('#dialog');
    $('#dlgTitle').textContent = o.title || '';
    $('#dlgText').textContent = o.text || '';
    const area = $('#dlgArea');
    area.hidden = !o.area; area.value = '';
    if (o.area) area.placeholder = o.placeholder || '';
    $('#dlgErr').hidden = true;
    const ok = $('#dlgOk'), cancel = $('#dlgCancel');
    ok.textContent = o.ok || t('ok'); cancel.textContent = t('cancel');
    ok.className = 'btn ' + (o.danger ? 'danger' : 'primary');
    d.hidden = false;
    const close = () => { d.hidden = true; ok.onclick = cancel.onclick = null; document.removeEventListener('keydown', key, true); };
    const key = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } if (ev.key === 'Enter' && (!o.area || ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ok.click(); } };
    document.addEventListener('keydown', key, true);
    cancel.onclick = close;
    d.onclick = ev => { if (ev.target === d) close(); };
    ok.onclick = () => {
      const res = o.onOk ? o.onOk(o.area ? area.value : undefined) : true;
      if (res === false) { $('#dlgErr').textContent = o.err || ''; $('#dlgErr').hidden = !o.err; return; }
      close();
    };
    setTimeout(() => (o.area ? area : ok).focus(), 40);
  }

  // tooltips (desktop only)
  let tipTimer = null, tipEl = null;
  function onOver(ev) {
    const target = ev.target.closest('[data-tip], [data-tip-text]');
    if (target === tipEl) return;
    hideTooltip();
    if (!target) return;
    tipEl = target;
    tipTimer = setTimeout(() => {
      const txt = target.dataset.tipText || t(target.dataset.tip);
      if (!txt) return;
      const tp = $('#tooltip');
      tp.textContent = txt;
      const r = target.getBoundingClientRect();
      tp.style.left = '0px'; tp.style.top = '0px';
      tp.classList.add('show');
      const tw = tp.offsetWidth, th = tp.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
      if (y + th > window.innerHeight - 8) y = r.top - th - 8;
      x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
      tp.style.left = x + 'px'; tp.style.top = y + 'px';
    }, 550);
  }
  function hideTooltip() { clearTimeout(tipTimer); tipEl = null; $('#tooltip').classList.remove('show'); }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
      ta.remove(); return true;
    }
  }

  function closePanels() { dom.app.classList.remove('lib-open'); if (isCompact()) { dom.app.classList.remove('sb-open'); } }

  /* ------------------------------- WIRING ------------------------------- */
  function bind() {
    const w = dom.wrap;
    w.addEventListener('pointerdown', onPointerDown);
    w.addEventListener('pointermove', onPointerMove);
    w.addEventListener('pointerup', onPointerUp);
    w.addEventListener('pointercancel', onPointerUp);
    w.addEventListener('wheel', onWheel, { passive: false });
    w.addEventListener('dblclick', ev => { if (!ev.target.closest('.node')) ev.preventDefault(); });
    dom.nodes.addEventListener('click', onNodeClick);
    dom.nodes.addEventListener('input', onNodeInput);
    dom.nodes.addEventListener('change', onNodeInput);
    dom.nodes.addEventListener('focusin', ev => { const ne = ev.target.closest('.node'); if (ne) select(ne.dataset.id); });
    dom.nodes.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') {
        const all = [...ev.target.closest('.node').querySelectorAll('input')];
        const i = all.indexOf(ev.target);
        if (all[i + 1]) all[i + 1].focus(); else ev.target.blur();
      }
    });

    document.addEventListener('mouseover', onOver);
    document.addEventListener('pointerdown', ev => {
      if (!ev.target.closest('.menu-wrap')) $('#menu').hidden = true;
      if (!ev.target.closest('#quick') && !ev.target.closest('#canvasWrap')) closeQuick();
    });

    $('#modeSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) setMode(b.dataset.mode); });
    $('#langSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) setLang(b.dataset.lang); });
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnArrange').addEventListener('click', arrange);
    $('#btnHelp').addEventListener('click', toggleSidebarGuide);
    $('#btnSbClose').addEventListener('click', closeSidebar);
    $('#btnLibrary').addEventListener('click', () => { dom.app.classList.remove('sb-open'); dom.app.classList.toggle('lib-open'); });
    $('#btnLibClose').addEventListener('click', () => dom.app.classList.remove('lib-open'));
    $('#scrim').addEventListener('click', closePanels);
    $('#btnMenu').addEventListener('click', () => { $('#menu').hidden = !$('#menu').hidden; });
    $('#menu').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      $('#menu').hidden = true;
      if (b.dataset.ex) importFormula(EXAMPLES[b.dataset.ex][window.FB_LANG === 'en' ? 1 : 0], true);
      else if (b.dataset.act === 'import') askImport();
      else if (b.dataset.act === 'new') newGraph();
      else if (b.dataset.act === 'save') saveFile();
      else if (b.dataset.act === 'open') $('#fileInput').click();
    });
    $('#fileInput').addEventListener('change', ev => { const f = ev.target.files[0]; if (f) openFile(f); ev.target.value = ''; });
    $('#btnZoomIn').addEventListener('click', () => { const r = dom.wrap.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); });
    $('#btnZoomOut').addEventListener('click', () => { const r = dom.wrap.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); });
    $('#btnFit').addEventListener('click', () => fitView(true));
    $('#zoomVal').addEventListener('click', () => fitView(true));
    $('#btnPretty').addEventListener('click', () => { state.pretty = !state.pretty; $('#btnPretty').classList.toggle('on', state.pretty); renderFormula(); scheduleSave(); });
    $('#btnImport').addEventListener('click', askImport);
    $('#btnCopy').addEventListener('click', () => {
      const txt = formulaText();
      if (!txt) { toast(t('emptyFormula'), 'warn'); return; }
      copyText(txt).then(() => {
        toast(built.issues.length ? t('copiedIncomplete') : t('copied'), built.issues.length ? 'warn' : 'ok');
        const b = $('#btnCopy'); b.classList.add('copied'); setTimeout(() => b.classList.remove('copied'), 1200);
      });
    });
    dom.pill.addEventListener('click', () => {
      const is = built.issues[0];
      if (!is) return;
      select(is.node); centerOn(is.node);
      const e = nodeEl(is.node);
      if (e) {
        e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash');
        const inp = is.port && e.querySelector(`.port-row[data-port="${is.port}"] input`);
        if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 400);
      }
    });
    dom.fbCode.addEventListener('click', ev => {
      const s = ev.target.closest('span[data-n]');
      if (!s || window.getSelection().toString()) return;
      const id = s.dataset.n;
      if (!state.g.nodes[id]) return;
      select(id); centerOn(id);
      const e = nodeEl(id); if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
    });
    dom.fbCode.addEventListener('mouseover', ev => {
      const s = ev.target.closest('span[data-n]');
      dom.fbCode.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
      if (s) dom.fbCode.querySelectorAll(`span[data-n="${s.dataset.n}"]`).forEach(x => x.classList.add('hl'));
    });

    dom.libSearch.addEventListener('input', buildLibrary);
    $('#quickInput').addEventListener('input', renderQuick);
    $('#quickInput').addEventListener('keydown', ev => {
      const items = [...$('#quickList').children];
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        quickIdx = Math.max(0, Math.min(items.length - 1, quickIdx + (ev.key === 'ArrowDown' ? 1 : -1)));
        items.forEach((x, i) => x.classList.toggle('active', i === quickIdx));
        items[quickIdx] && items[quickIdx].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') { ev.preventDefault(); if (items[quickIdx]) pickQuick(items[quickIdx]._it); }
      else if (ev.key === 'Escape') closeQuick();
    });
    dom.wrap.addEventListener('dblclick', ev => { if (!ev.target.closest('.node')) openQuick(ev.clientX, ev.clientY, null); });

    document.addEventListener('keydown', ev => {
      const inField = ev.target.closest && ev.target.closest('input, textarea, select');
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === 'z' && !inField) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
      else if (mod && ev.key.toLowerCase() === 'y' && !inField) { ev.preventDefault(); redo(); }
      else if (mod && ev.key.toLowerCase() === 'd' && selected) { ev.preventDefault(); duplicateNode(selected); }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !inField && selected) { ev.preventDefault(); deleteNode(selected); }
      else if (ev.key === 'Escape') {
        if (gesture && gesture.type === 'pending') { endWireVisual(); gesture = null; }
        closeQuick(); $('#menu').hidden = true;
      }
    });
    window.addEventListener('resize', () => { segSet($('#modeSeg'), 'mode', state.mode); segSet($('#langSeg'), 'lang', window.FB_LANG); syncPanels(); });
  }

  function askImport() {
    dialog({
      title: t('importTitle'), text: t('importDesc'), area: true, ok: t('importBtn'),
      placeholder: '=IF(A1>10,"High","Low")', err: t('importErr'),
      onOk: v => (v && v.trim() ? importFormula(v, false) : false)
    });
  }

  let wasCompact = null;
  function syncPanels() {
    const c = isCompact();
    if (c === wasCompact) return;
    wasCompact = c;
    if (c) dom.app.classList.remove('sb-open', 'lib-open');
    else dom.app.classList.toggle('sb-open', state.sbOpen);
    setTimeout(() => { remeasureAll(); drawWires(); }, 450);
  }

  /* -------------------------------- INIT -------------------------------- */
  function init() {
    const had = load();
    ensureResult();
    document.documentElement.lang = window.FB_LANG;
    document.body.classList.toggle('mode-gsheets', state.mode === 'gsheets');
    applyTexts();
    $('#btnPretty').classList.toggle('on', state.pretty);
    buildLibrary();
    bind();
    syncPanels();
    renderAll();
    if (!had) { fitCenterResult(); setTimeout(fitCenterResult, 450); } else applyView();
    lastSnap = snap();
    updateUndoButtons();
    renderSidebar();
    // fonts can change node sizes after load
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { remeasureAll(); drawWires(); segSet($('#modeSeg'), 'mode', state.mode); segSet($('#langSeg'), 'lang', window.FB_LANG); });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  init();
})();
