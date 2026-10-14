/* =========================================================================
   Formula Builder — engine
   Graph model, port definitions, value classification, formula generation
   (Excel / Google Sheets IT), pretty printing and formula import (parser).
   No DOM access here.
   ========================================================================= */
(function () {
  'use strict';
  const C = window.FB_CATALOG;

  /* ----------------------------- MODES ---------------------------------- */
  const MODES = {
    excel:   { sep: ',', dec: '.', t: 'TRUE', f: 'FALSE', fnName: f => f.id },
    gsheets: { sep: ';', dec: ',', t: 'VERO', f: 'FALSO', fnName: f => f.gs }
  };

  /* ----------------------------- PORTS ---------------------------------- */
  // Returns the list of input ports of a node.
  function ports(node) {
    const out = [];
    switch (node.type) {
      case 'fn': {
        const f = C.byId[node.fn];
        if (!f) return out;
        (f.a || []).forEach((a, i) => out.push({ key: 'a' + i, def: a, opt: !!a.opt }));
        if (f.r) {
          const n = Math.max(f.r.min, node.rep || f.r.min);
          for (let i = 0; i < n; i++) {
            f.r.a.forEach((a, j) => out.push({ key: 'r' + i + '_' + j, def: a, opt: false, group: i, removable: i >= f.r.min, groupFirst: j === 0, groupSize: f.r.a.length }));
          }
        }
        (f.tl || []).forEach((a, i) => out.push({ key: 't' + i, def: a, opt: !!a.opt }));
        break;
      }
      case 'math': case 'cmp':
        out.push({ key: 'l', def: { n: ['primo valore', 'first value'], d: ['Il valore a sinistra.', 'The left value.'] } });
        out.push({ key: 'r', def: { n: ['secondo valore', 'second value'], d: ['Il valore a destra.', 'The right value.'] } });
        break;
      case 'join': {
        const n = Math.max(2, node.rep || 2);
        for (let i = 0; i < n; i++) out.push({ key: 'j' + i, def: { n: ['parte ' + (i + 1), 'part ' + (i + 1)], d: ['Un pezzo del testo finale.', 'A piece of the final text.'] }, removable: i >= 2, group: i });
        break;
      }
      case 'neg':
        out.push({ key: 'v', def: { n: ['valore', 'value'], d: ['Il valore da trasformare.', 'The value to transform.'] } });
        break;
      case 'custom': {
        const n = Math.max(0, node.rep == null ? 1 : node.rep);
        for (let i = 0; i < n; i++) out.push({ key: 'c' + i, def: { n: ['argomento ' + (i + 1), 'argument ' + (i + 1)], d: ['Un argomento della funzione.', 'A function argument.'] }, opt: true, removable: true, group: i });
        break;
      }
      case 'result':
        out.push({ key: 'in', def: { n: ['formula', 'formula'], d: ['Collega qui il blocco che dà il risultato finale.', 'Connect the block that gives the final result here.'] } });
        break;
    }
    return out;
  }
  const hasOutput = node => node.type !== 'result';

  /* ------------------------- VALUE CLASSIFIER --------------------------- */
  const REF_RE = new RegExp(
    "^(?:(?:'[^']+'|[A-Za-z_\\u00C0-\\u017F][\\w.\\u00C0-\\u017F]*)!)?" +
    '(?:\\$?[A-Za-z]{1,3}\\$?\\d+(?::\\$?[A-Za-z]{1,3}\\$?\\d+|:\\$?[A-Za-z]{1,3})?' +
    '|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3}' +
    '|\\$?\\d+:\\$?\\d+)$');
  const NUM_RE = /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?%?$/;
  const NAME_RE = /^[A-Za-z_À-ſ][\w.À-ſ]*$/;

  function isValidRef(s) {
    if (!REF_RE.test(s)) return false;
    // column letters must not exceed XFD
    const cols = s.replace(/^.*!/, '').match(/[A-Za-z]{1,3}/g) || [];
    return cols.every(c => colNum(c) <= 16384);
  }
  function colNum(c) { let n = 0; for (const ch of c.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }

  // Classify a typed inline value. nameSet = Set of upper-case variable names in scope.
  function classify(raw, nameSet) {
    const s = (raw == null ? '' : String(raw)).trim();
    if (s === '') return { kind: 'empty' };
    if (s[0] === '=') return { kind: 'raw', v: s.slice(1).trim() };
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return { kind: 'text', v: s.slice(1, -1).replace(/""/g, '"') };
    const up = s.toUpperCase();
    if (up === 'TRUE' || up === 'VERO') return { kind: 'bool', v: true };
    if (up === 'FALSE' || up === 'FALSO') return { kind: 'bool', v: false };
    if (NUM_RE.test(s)) return { kind: 'num', v: s.replace(',', '.') };
    if (nameSet && nameSet.has(up)) return { kind: 'name', v: s };
    if (isValidRef(s)) return { kind: 'ref', v: s };
    return { kind: 'text', v: s };
  }

  /* --------------------------- GRAPH HELPERS ---------------------------- */
  function linkInto(g, nodeId, port) { return g.links.find(l => l.to === nodeId && l.port === port); }
  function linksFrom(g, nodeId) { return g.links.filter(l => l.from === nodeId); }

  // All variable names (LET names, LAMBDA params, @name blocks) used in the graph.
  function nameSet(g) {
    const s = new Set();
    Object.values(g.nodes).forEach(n => {
      if (n.type === 'fn' && (n.fn === 'LET' || n.fn === 'LAMBDA')) {
        ports(n).forEach(p => { if (p.def.kind === 'name') { const v = (n.vals && n.vals[p.key] || '').trim(); if (v) s.add(v.toUpperCase()); } });
      }
    });
    return s;
  }

  // Would linking from -> to create a cycle?
  function createsCycle(g, fromId, toId) {
    if (fromId === toId) return true;
    const seen = new Set();
    const stack = [fromId];
    while (stack.length) {
      const id = stack.pop();
      if (id === toId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      g.links.filter(l => l.to === id).forEach(l => stack.push(l.from));
    }
    return false;
  }

  /* ----------------------------- AST BUILD ------------------------------ */
  // Builds an AST from the graph, starting at the result node.
  // Returns { ast, issues:[{node, port, label}] , used:Set(nodeIds) }
  function buildAst(g) {
    const result = Object.values(g.nodes).find(n => n.type === 'result');
    const issues = [];
    const used = new Set();
    const names = nameSet(g);
    if (!result) return { ast: null, issues, used };
    used.add(result.id);

    function valueOf(node, port) {
      const link = linkInto(g, node.id, port.key);
      if (link) return nodeAst(g.nodes[link.from]);
      // choice port
      if (port.def.ch) {
        const idx = node.ch && node.ch[port.key] != null ? node.ch[port.key] : (port.def.def != null ? port.def.def : 0);
        if (idx >= 0 && port.def.ch[idx]) return { t: 'tok', v: port.def.ch[idx].v, node: node.id };
        return null;
      }
      const raw = node.vals ? node.vals[port.key] : '';
      if (port.def.kind === 'name') {
        const v = (raw || '').trim();
        return v ? { t: 'name', v, node: node.id } : null;
      }
      const c = classify(raw, names);
      return literalAst(c, node.id);
    }

    function nodeAst(node) {
      if (!node) return null;
      used.add(node.id);
      const id = node.id;
      switch (node.type) {
        case 'num': {
          const c = classify(node.value, null);
          return c.kind === 'num' ? { t: 'num', v: c.v, node: id } : miss(node, null, ['numero', 'number']);
        }
        case 'text': return { t: 'str', v: node.value || '', node: id };
        case 'ref': {
          const v = (node.value || '').trim();
          return v ? { t: 'ref', v, node: id } : miss(node, null, ['cella', 'cell']);
        }
        case 'bool': return { t: 'bool', v: node.value !== false && node.value !== 'false', node: id };
        case 'name': {
          const v = (node.value || '').trim();
          return v ? { t: 'name', v, node: id } : miss(node, null, ['nome', 'name']);
        }
        case 'math': case 'cmp': {
          const l = arg(node, 'l'), r = arg(node, 'r');
          return { t: 'op', op: node.op || (node.type === 'math' ? '+' : '='), l, r, node: id };
        }
        case 'join': {
          const ps = ports(node).map(p => arg(node, p.key, p));
          return ps.slice(1).reduce((acc, p) => ({ t: 'op', op: '&', l: acc, r: p, node: id }), ps[0]);
        }
        case 'neg': {
          const v = arg(node, 'v');
          return node.op === '%' ? { t: 'pct', v, node: id } : { t: 'neg', v, node: id };
        }
        case 'custom': {
          const args = ports(node).map(p => valueOf(node, p) || { t: 'empty' });
          trimEmpty(args);
          const nm = (node.value || '').trim();
          if (!nm) issues.push({ node: id, port: null, label: ['nome funzione', 'function name'] });
          return { t: 'call', name: nm || '?', custom: true, args, node: id };
        }
        case 'fn': {
          const f = C.byId[node.fn];
          const ps = ports(node);
          const args = ps.map(p => {
            const v = valueOf(node, p);
            if (v) return v;
            if (p.opt) return { t: 'empty' };
            return miss(node, p.key, p.def.n);
          });
          trimEmpty(args);
          return { t: 'call', fn: f, args, node: id };
        }
      }
      return null;
    }

    function arg(node, key, port) {
      const p = port || ports(node).find(x => x.key === key);
      return valueOf(node, p) || miss(node, key, p.def.n);
    }
    function miss(node, port, label) {
      issues.push({ node: node.id, port, label });
      return { t: 'missing', label, node: node.id, port };
    }

    const link = linkInto(g, result.id, 'in');
    let ast = null;
    if (link) ast = nodeAst(g.nodes[link.from]);
    else {
      const raw = result.vals && result.vals.in;
      const c = classify(raw, names);
      if (c.kind !== 'empty') ast = literalAst(c, result.id);
    }
    return { ast, issues, used };
  }

  function trimEmpty(args) { while (args.length && args[args.length - 1].t === 'empty') args.pop(); }

  function literalAst(c, nodeId) {
    switch (c.kind) {
      case 'empty': return null;
      case 'num': return { t: 'num', v: c.v, node: nodeId };
      case 'text': return { t: 'str', v: c.v, node: nodeId };
      case 'bool': return { t: 'bool', v: c.v, node: nodeId };
      case 'ref': return { t: 'ref', v: c.v, node: nodeId };
      case 'name': return { t: 'name', v: c.v, node: nodeId };
      case 'raw': {
        try { const a = parse(c.v); tagNode(a, nodeId); return a; }
        catch (e) { return { t: 'rawtxt', v: c.v, node: nodeId }; }
      }
    }
    return null;
  }
  function tagNode(a, id) {
    if (!a || typeof a !== 'object') return;
    a.node = id;
    ['l', 'r', 'v'].forEach(k => a[k] && typeof a[k] === 'object' && tagNode(a[k], id));
    if (a.args) a.args.forEach(x => tagNode(x, id));
  }

  /* ------------------------------ PRINTER ------------------------------- */
  const PREC = { '=': 1, '<>': 1, '>': 1, '<': 1, '>=': 1, '<=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };
  function prec(a) {
    if (!a) return 9;
    if (a.t === 'op') return PREC[a.op];
    if (a.t === 'pct') return 6;
    if (a.t === 'neg') return 7;
    if (a.t === 'rawtxt') return 0;
    return 9;
  }

  // Converts mode-specific special tokens
  function tokAst(v, mode) {
    if (v === 'TRUE' || v === 'FALSE') return { t: 'bool', v: v === 'TRUE' };
    if (v === 'ASC') return mode === 'excel' ? { t: 'num', v: '1' } : { t: 'bool', v: true };
    if (v === 'DESC') return mode === 'excel' ? { t: 'num', v: '-1' } : { t: 'bool', v: false };
    if (v[0] === '"') return { t: 'str', v: v.slice(1, -1) };
    return { t: 'num', v };
  }

  function fnName(a, mode) {
    if (a.custom || !a.fn) return a.name;
    return MODES[mode].fnName(a.fn);
  }

  // Mode-specific rewrites (e.g. Google FILTER has no if_empty argument)
  function rewrite(a, mode) {
    if (a && a.t === 'call' && a.fn && a.fn.id === 'FILTER' && mode === 'gsheets' && a.args.length >= 3) {
      return { t: 'call', fn: C.byId.IFERROR, node: a.node, args: [{ t: 'call', fn: a.fn, node: a.node, args: a.args.slice(0, 2) }, a.args[2]] };
    }
    return a;
  }

  // Emits a token list: {s:text, c:cssClass, n:nodeId}
  function tokens(ast, mode, pretty) {
    const M = MODES[mode];
    const out = [];
    const push = (s, c, n) => out.push({ s, c, n });

    function flat(a) { const t = []; const save = out.length; emit(a, 0, false); const s = out.splice(save).map(x => x.s).join(''); return s; }

    function emit(a, ind, pr) {
      a = rewrite(a, mode);
      if (!a) { push('', '', null); return; }
      switch (a.t) {
        case 'num': push(fmtNum(a.v, M), 'tk-num', a.node); break;
        case 'str': push('"' + a.v.replace(/"/g, '""') + '"', 'tk-str', a.node); break;
        case 'bool': push(a.v ? M.t : M.f, 'tk-bool', a.node); break;
        case 'ref': push(a.v, 'tk-ref', a.node); break;
        case 'name': push(a.v, 'tk-name', a.node); break;
        case 'tok': emit(Object.assign(tokAst(a.v, mode), { node: a.node }), ind, pr); break;
        case 'rawtxt': push(a.v, 'tk-raw', a.node); break;
        case 'empty': break;
        case 'missing': push('‹' + a.label[window.FB_LANG === 'en' ? 1 : 0] + '›', 'tk-miss', a.node); break;
        case 'neg': push('-', 'tk-op', a.node); wrap(a.v, prec(a.v) < 7, ind, pr); break;
        case 'pct': wrap(a.v, prec(a.v) < 6, ind, pr); push('%', 'tk-op', a.node); break;
        case 'op': {
          const p = PREC[a.op];
          const lp = prec(a.l), rp = prec(a.r);
          wrap(a.l, lp < p, ind, pr);
          const sp = (a.op === '&' || p <= 3) ? ' ' : '';
          push(sp + a.op + sp, 'tk-op', a.node);
          wrap(a.r, rp < p || (rp === p && !['+', '*', '&'].includes(a.op)), ind, pr);
          break;
        }
        case 'call': {
          const name = fnName(a, mode);
          push(name, 'tk-fn', a.node);
          push('(', 'tk-par', a.node);
          if (a.args.length) {
            const multi = pr && shouldBreak(a, ind);
            // which args start a new line (LET keeps "name, value" together, LAMBDA keeps all parameters together)
            const n = a.args.length;
            const id = a.fn && a.fn.id;
            const starts = a.args.map((x, i) => {
              if (id === 'LET') return i % 2 === 0 || i === n - 1;
              if (id === 'LAMBDA') return i === 0 || i === n - 1;
              return true;
            });
            a.args.forEach((x, i) => {
              if (multi && starts[i]) push('\n' + '    '.repeat(ind + 1), '', null);
              else if (multi && i > 0) push(' ', '', null);
              emit(x, ind + 1, pr);
              if (i < n - 1) push(M.sep + (multi ? '' : ' '), 'tk-sep', a.node);
            });
            if (multi) push('\n' + '    '.repeat(ind), '', null);
          }
          push(')', 'tk-par', a.node);
          break;
        }
      }
    }
    function wrap(a, need, ind, pr) {
      if (need) { push('(', 'tk-par', a && a.node); emit(a, ind, pr); push(')', 'tk-par', a && a.node); }
      else emit(a, ind, pr);
    }
    function shouldBreak(a, ind) {
      const f = flat(a);
      const nested = a.args.some(x => x && (x.t === 'call' || (x.t === 'op' && /\(/.test(flat(x)))));
      return (f.length + ind * 4 > 62 && a.args.length > 1) || (nested && f.length > 50);
    }

    if (ast) emit(ast, 0, pretty);
    // remove the space after separators in compact Excel/Sheets output? keep readable spacing only in pretty mode
    if (!pretty) out.forEach(t => { if (t.c === 'tk-sep') t.s = M.sep; if (t.c === 'tk-op' && t.s.trim() !== t.s) t.s = t.s.trim(); });
    return out;
  }

  function fmtNum(v, M) {
    let s = String(v);
    if (M.dec === ',') s = s.replace('.', ',');
    return s;
  }

  function toText(ast, mode, pretty) {
    return '=' + tokens(ast, mode, pretty).map(t => t.s).join('');
  }

  /* ------------------------------- PARSER ------------------------------- */
  // Parses a formula (Excel or Google Sheets syntax, with or without '=')
  function parse(src, preferMode) {
    const hasSemicolon = /;/.test(String(src).replace(/"(?:[^"]|"")*"/g, ''));
    const modesToTry = (hasSemicolon || preferMode === 'gsheets') ? ['gsheets', 'excel'] : ['excel', 'gsheets'];
    let lastErr;
    for (const m of modesToTry) {
      try { return parseWith(src, m); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  function parseWith(src, mode) {
    let s = String(src).replace(/\r/g, '').trim();
    if (s[0] === '=') s = s.slice(1);
    const toks = tokenize(s, mode);
    let i = 0;
    const peek = () => toks[i];
    const next = () => toks[i++];
    const expect = (type, v) => { const t = next(); if (!t || t.type !== type || (v && t.v !== v)) throw new Error('Unexpected ' + (t ? t.v : 'end')); return t; };

    function parseExpr(minP) {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (!t || t.type !== 'op' || PREC[t.v] == null) break;
        const p = PREC[t.v];
        if (p < minP) break;
        next();
        const right = parseExpr(p + 1);
        left = { t: 'op', op: t.v, l: left, r: right };
      }
      return left;
    }
    function parseUnary() {
      const t = peek();
      if (t && t.type === 'op' && (t.v === '-' || t.v === '+')) {
        next();
        const v = parseUnary();
        if (t.v === '+') return v;
        if (v.t === 'num' && v.v[0] !== '-') return { t: 'num', v: '-' + v.v };
        return { t: 'neg', v };
      }
      let a = parsePrimary();
      while (peek() && peek().type === 'op' && peek().v === '%') { next(); a = { t: 'pct', v: a }; }
      return a;
    }
    function parsePrimary() {
      const t = next();
      if (!t) throw new Error('Unexpected end');
      switch (t.type) {
        case 'num': return { t: 'num', v: t.v };
        case 'str': return { t: 'str', v: t.v };
        case 'ref': return { t: 'ref', v: t.v };
        case 'paren':
          if (t.v === '(') { const e = parseExpr(0); expect('paren', ')'); return e; }
          throw new Error('Unexpected )');
        case 'word': {
          if (peek() && peek().type === 'paren' && peek().v === '(') {
            next();
            const args = [];
            if (peek() && peek().type === 'paren' && peek().v === ')') { next(); }
            else {
              for (;;) {
                if (peek() && (peek().type === 'sep' || (peek().type === 'paren' && peek().v === ')'))) args.push({ t: 'empty' });
                else args.push(parseExpr(0));
                const n = next();
                if (!n) throw new Error('Missing )');
                if (n.type === 'sep') continue;
                if (n.type === 'paren' && n.v === ')') break;
                throw new Error('Unexpected ' + n.v);
              }
            }
            const up = t.v.toUpperCase();
            const f = C.byAnyName[up];
            // A LAMBDA called directly: LAMBDA(x,x*2)(5) is not supported as blocks
            if (peek() && peek().type === 'paren' && peek().v === '(') throw new Error('Unsupported');
            if (f) return { t: 'call', fn: f, args };
            return { t: 'call', name: t.v, custom: true, args };
          }
          const up = t.v.toUpperCase();
          if (up === 'TRUE' || up === 'VERO') return { t: 'bool', v: true };
          if (up === 'FALSE' || up === 'FALSO') return { t: 'bool', v: false };
          if (isValidRef(t.v)) return { t: 'ref', v: t.v };
          return { t: 'name', v: t.v };
        }
      }
      throw new Error('Unexpected ' + t.v);
    }

    const ast = parseExpr(0);
    if (i < toks.length) throw new Error('Unexpected ' + toks[i].v);
    return ast;
  }

  function tokenize(s, mode) {
    const toks = [];
    const sepChars = mode === 'gsheets' ? [';'] : [',', ';'];
    const dec = mode === 'gsheets' ? ',' : '.';
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        let j = i + 1, v = '';
        for (;;) {
          if (j >= s.length) throw new Error('Unclosed string');
          if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; }
          v += s[j++];
        }
        toks.push({ type: 'str', v }); i = j + 1; continue;
      }
      if (ch === '{') throw new Error('Array constants are not supported');
      if (ch === '(' || ch === ')') { toks.push({ type: 'paren', v: ch }); i++; continue; }
      if (sepChars.includes(ch)) { toks.push({ type: 'sep', v: ch }); i++; continue; }
      const two = s.substr(i, 2);
      if (two === '<>' || two === '>=' || two === '<=') { toks.push({ type: 'op', v: two }); i += 2; continue; }
      if ('+-*/^&=<>%'.includes(ch)) { toks.push({ type: 'op', v: ch }); i++; continue; }
      // number
      const numRe = mode === 'gsheets' ? /^(?:\d+(?:,\d+)?|,\d+)(?:[eE][-+]?\d+)?/ : /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?/;
      // references starting with digits (1:5) or $
      const refM = s.slice(i).match(/^(?:'[^']+'!)?(?:\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+|:\$?[A-Za-z]{1,3})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(?![\w(.!])/);
      if (/[\d$']/.test(ch) && refM && (ch !== "'" || refM[0].includes('!'))) {
        if (/^\d/.test(refM[0]) && !refM[0].includes(':')) { /* plain number, fall through */ }
        else { toks.push({ type: 'ref', v: refM[0] }); i += refM[0].length; continue; }
      }
      const nm = s.slice(i).match(numRe);
      if (nm && (/\d/.test(ch) || ch === dec)) {
        toks.push({ type: 'num', v: nm[0].replace(',', '.') }); i += nm[0].length; continue;
      }
      // words: function names, refs with sheet, names
      const wm = s.slice(i).match(/^[A-Za-z_À-ſ$][\w.$À-ſ]*(?:!\$?[A-Za-z]{1,3}\$?\d*(?::\$?[A-Za-z]{1,3}\$?\d*)?)?/);
      if (wm) {
        let w = wm[0];
        // range continuation like A1:B2 when word is a ref
        const rest = s.slice(i + w.length);
        const cont = rest.match(/^:\$?[A-Za-z]{0,3}\$?\d*/);
        if (cont && cont[0].length > 1 && isValidRef(w + cont[0])) w += cont[0];
        if (w.includes('!') || (isValidRef(w) && !/^\s*\(/.test(s.slice(i + w.length)))) toks.push({ type: 'ref', v: w });
        else toks.push({ type: 'word', v: w });
        i += w.length; continue;
      }
      throw new Error('Unexpected character ' + ch);
    }
    return toks;
  }

  /* --------------------------- AST -> GRAPH ----------------------------- */
  // Builds nodes from a parsed AST. Returns { nodes:[], links:[], rootId }
  function astToGraph(ast, newId) {
    const nodes = [], links = [];
    // variable names declared in the formula (LET names, LAMBDA parameters)
    const declared = new Set();
    (function walk(a) {
      if (!a || typeof a !== 'object') return;
      if (a.t === 'call' && a.fn && a.fn.id === 'LET') a.args.forEach((x, i) => { if (i % 2 === 0 && i < a.args.length - 1 && x.t === 'name') declared.add(x.v.toUpperCase()); });
      if (a.t === 'call' && a.fn && a.fn.id === 'LAMBDA') a.args.forEach((x, i) => { if (i < a.args.length - 1 && x.t === 'name') declared.add(x.v.toUpperCase()); });
      ['l', 'r', 'v'].forEach(k => walk(a[k]));
      (a.args || []).forEach(walk);
    })(ast);
    function inlineOf(a) {
      if (!a) return null;
      switch (a.t) {
        case 'num': return a.v;
        case 'ref': return a.v;
        case 'bool': return a.v ? 'TRUE' : 'FALSE';
        case 'str': {
          const c = classify(a.v, null);
          return (c.kind === 'text' && a.v === a.v.trim() && a.v !== '') ? a.v : '"' + a.v.replace(/"/g, '""') + '"';
        }
        case 'name': return declared.has(a.v.toUpperCase()) ? a.v : '=' + a.v;
        case 'pct': return a.v && a.v.t === 'num' ? a.v.v + '%' : null;
        case 'op': {
          // a simple comparison/calculation between plain values stays inline (e.g. =B2>=90)
          const simple = x => x && ['num', 'str', 'ref', 'bool', 'name'].includes(x.t);
          if (a.op !== '&' && simple(a.l) && simple(a.r)) return '=' + tokens(a, 'excel', false).map(k => k.s).join('');
          return null;
        }
        case 'empty': return '';
      }
      return null;
    }
    function make(a) {
      const id = newId();
      let node;
      if (a.t === 'call' && a.fn) {
        const f = a.fn;
        const nf = (f.a || []).length;
        const g = f.r ? f.r.a.length : 0;
        const tl = f.tl || [];
        const rem = a.args.length - nf;
        let tlLen = 0, reps = 0;
        if (f.r) {
          tlLen = tl.length ? (tl[0].opt ? Math.max(0, rem % g) : tl.length) : 0;
          reps = Math.floor((rem - tlLen) / g);
          if (reps < f.r.min) reps = f.r.min;
        } else if (a.args.length > nf + tl.length) {
          return makeCustom(a, id);
        }
        node = { id, type: 'fn', fn: f.id, vals: {}, ch: {}, rep: f.r ? reps : undefined };
        nodes.push(node);
        const ps = ports(node);
        const keys = [];
        ps.forEach(p => keys.push(p));
        // map args to ports in order: fixed, reps, tail (tail aligned to the end)
        const fixedP = ps.filter(p => p.key[0] === 'a');
        const repP = ps.filter(p => p.key[0] === 'r');
        const tailP = ps.filter(p => p.key[0] === 't');
        const order = fixedP.concat(repP).concat(tailP.slice(0, tlLen || (f.r ? 0 : tl.length)));
        a.args.forEach((x, i) => { const p = order[i]; if (p) attach(node, p, x); });
        // choice ports that were not written keep "empty" so the formula stays identical
        ps.forEach(p => { if (p.def.ch && node.ch[p.key] == null) node.ch[p.key] = -1; });
        return id;
      }
      if (a.t === 'call') return makeCustom(a, id);
      if (a.t === 'op') {
        if (a.op === '&') {
          const parts = [];
          (function flatJ(x) { if (x.t === 'op' && x.op === '&') { flatJ(x.l); flatJ(x.r); } else parts.push(x); })(a);
          node = { id, type: 'join', vals: {}, rep: parts.length };
          nodes.push(node);
          parts.forEach((x, i) => attach(node, { key: 'j' + i, def: {} }, x));
          return id;
        }
        const isCmp = ['=', '<>', '>', '<', '>=', '<='].includes(a.op);
        node = { id, type: isCmp ? 'cmp' : 'math', op: a.op, vals: {} };
        nodes.push(node);
        attach(node, { key: 'l', def: {} }, a.l);
        attach(node, { key: 'r', def: {} }, a.r);
        return id;
      }
      if (a.t === 'neg' || a.t === 'pct') {
        node = { id, type: 'neg', op: a.t === 'pct' ? '%' : '-', vals: {} };
        nodes.push(node);
        attach(node, { key: 'v', def: {} }, a.v);
        return id;
      }
      // literal as standalone block
      const map = { num: 'num', str: 'text', ref: 'ref', bool: 'bool', name: 'name' };
      node = { id, type: map[a.t] || 'text', value: a.t === 'bool' ? a.v : a.v };
      nodes.push(node);
      return id;
    }
    function makeCustom(a, id) {
      const node = { id, type: 'custom', value: a.name || (a.fn && a.fn.id), vals: {}, rep: a.args.length };
      nodes.push(node);
      a.args.forEach((x, i) => attach(node, { key: 'c' + i, def: {} }, x));
      return id;
    }
    function attach(node, port, x) {
      if (!x || x.t === 'empty') return;
      if (port.def && port.def.kind === 'name' && x.t === 'name') { node.vals[port.key] = x.v; return; }
      if (port.def && port.def.ch) {
        const lit = x.t === 'bool' ? (x.v ? 'TRUE' : 'FALSE') : x.t === 'num' ? x.v : x.t === 'str' ? '"' + x.v + '"' : null;
        let idx = port.def.ch.findIndex(o => o.v === lit);
        if (idx < 0 && node.fn === 'SORT') idx = (lit === '1' || lit === 'TRUE') ? 0 : (lit === '-1' || lit === 'FALSE') ? 1 : -1;
        if (idx >= 0) { node.ch[port.key] = idx; return; }
      }
      const inl = inlineOf(x);
      if (inl != null) { node.vals[port.key] = inl; return; }
      const childId = make(x);
      links.push({ from: childId, to: node.id, port: port.key });
    }
    const rootInline = inlineOf(ast);
    if (rootInline != null && ast.t !== 'name') {
      return { nodes, links, rootId: null, rootInline };
    }
    const rootId = make(ast);
    return { nodes, links, rootId };
  }

  /* ------------------------------ LAYOUT -------------------------------- */
  // Simple tidy tree layout: columns by depth (right to left), rows by leaf order.
  function autoLayout(g, sizeOf) {
    const result = Object.values(g.nodes).find(n => n.type === 'result');
    if (!result) return;
    const placed = new Set();
    const colW = 300, gapY = 28;
    let cursorY = 0;
    const depthX = d => -d * colW;
    function layout(node, depth) {
      placed.add(node.id);
      const kids = ports(node).map(p => linkInto(g, node.id, p.key)).filter(Boolean).map(l => g.nodes[l.from]).filter(n => n && !placed.has(n.id));
      const h = sizeOf(node).h;
      if (!kids.length) {
        node.x = depthX(depth); node.y = cursorY; cursorY += h + gapY;
        return { top: node.y, bottom: node.y + h };
      }
      const spans = kids.map(k => layout(k, depth + 1));
      const top = spans[0].top, bottom = spans[spans.length - 1].bottom;
      node.x = depthX(depth);
      node.y = Math.max(top, (top + bottom) / 2 - h / 2);
      if (node.y + h + gapY > cursorY) cursorY = node.y + h + gapY;
      return { top: Math.min(top, node.y), bottom: Math.max(bottom, node.y + h) };
    }
    layout(result, 0);
    // unconnected nodes: stack below
    let y = cursorY + 60;
    Object.values(g.nodes).forEach(n => { if (!placed.has(n.id)) { n.x = -colW; n.y = y; y += sizeOf(n).h + gapY; } });
    // shift so the result node sits on the right
    Object.values(g.nodes).forEach(n => { n.x += 900; n.y += 80; });
  }

  window.FB_ENGINE = { MODES, ports, hasOutput, classify, isValidRef, nameSet, linkInto, linksFrom, createsCycle,
    buildAst, tokens, toText, parse, astToGraph, autoLayout };
})();
