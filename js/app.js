/* JS Engine Quest — UI: draws each recorded step and handles playback, levels, lessons, quizzes, challenges and rewards. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LEVELS = window.JS_LEVELS;
  const LESSONS = window.JS_LESSONS || {};
  const CHALLENGES = window.JS_CHALLENGES || [];
  const SPEEDS = [2600, 1600, 1000, 560, 240];

  const CFG = window.JSLabConfig;
  const BADGES = CFG.BADGES;
  const KINDS = CFG.KINDS;
  const PHASES = CFG.PHASES;
  const WORLDS = CFG.WORLDS;
  const RANKS = CFG.RANKS;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('rql.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rql.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const S = {
    level: Math.min(store.get('level', 0), LEVELS.length - 1),
    mode: 'level', chal: null,
    trace: [], i: 0, playing: false, timer: null,
    src: '', tokens: [], dirty: false,
    bps: new Set(),
    earned: new Set(store.get('badges', [])),
    completed: new Set(store.get('completed', [])),
    solved: new Set(store.get('solved', [])),
    awarded: new Set(store.get('awarded', [])),
    briefed: new Set(store.get('briefed', [])),
    xp: store.get('xp', 0),
    sandbox: store.get('sandbox', null),
    drafts: store.get('drafts', {}),
    arrows: store.get('arrows', false),
    flow: store.get('flow', true),
    inline: store.get('inline', true),
    evaltree: store.get('evaltree', true),
    arrayView: store.get('arrayView', true),
    callTree: store.get('callTree', true),
    gcView: store.get('gcView', false),
    graph: store.get('graph', false),
    sound: store.get('sound', false),
    hints: 0,
    maxSteps: store.get('maxSteps', 10000),
    internals: store.get('internals', false),
    deepReact: store.get('deepReact', false),
    onePanel: store.get('onePanel', true),
    pinPanel: null,
  };

  // the view is always "Full detail" (the View menu is hidden); "One panel at a time" stays on
  Object.assign(S, CFG.VIEW_PRESETS.find(p => p.id === 'full').set, { onePanel: true });
  const editor = $('editor'), codeView = $('codeView'), codeWrap = document.querySelector('.code-wrap');
  // a proper code editor (CodeMirror) when online; the plain textarea otherwise
  let cm = null;
  if (window.CodeMirror) {
    cm = window.CodeMirror.fromTextArea(editor, {
      mode: 'javascript', lineNumbers: true, indentUnit: 2, tabSize: 2, matchBrackets: true, autoCloseBrackets: true,
      extraKeys: { Tab: c => c.execCommand('insertSoftTab'), 'Ctrl-Enter': () => build(), 'Cmd-Enter': () => build(), 'Shift-Ctrl-Enter': () => checkChallenge(), 'Shift-Cmd-Enter': () => checkChallenge() },
    });
    cm.on('change', () => { S.dirty = true; S.noSave = false; });
  }
  function getCode() { return cm ? cm.getValue() : editor.value; }
  function setCode(v) { if (cm) cm.setValue(v); else editor.value = v; }
  function focusEditor() { if (cm) { cm.refresh(); cm.focus(); } else editor.focus(); }
  const stripLead = s => String(s).replace(/^\s*(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*|[\u2600-\u27BF]\uFE0F?)\s*/u, '');
  // long explanations show their first sentence; "more" shows the rest (remembered)
  let narrFull = store.get('narrFull', false);
  function shortNarration(html) {
    const plain = html.replace(/<[^>]+>/g, '');
    if (plain.length < 140) return html;
    const balanced = s => (s.match(/<[a-z][^>]*>/gi) || []).length === (s.match(/<\/[a-z]+>/gi) || []).length;
    const re = /[.!?](?:<\/b>)?\s+(?=[A-Z<(])/g;
    let m, cut = -1;
    while ((m = re.exec(html))) {
      const head = html.slice(0, m.index + m[0].length);
      if (head.replace(/<[^>]+>/g, '').length >= 30 && balanced(head)) { cut = m.index + m[0].length; break; }
    }
    if (cut < 0 || html.slice(cut).replace(/<[^>]+>/g, '').trim().length < 25) return html;
    return `${html.slice(0, cut)}<span class="nar-rest${narrFull ? ' open' : ''}">${html.slice(cut)}</span> <button class="nar-more" data-narmore aria-expanded="${narrFull}">${narrFull ? 'less \u25B4' : 'more \u25BE'}</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-narmore]');
    if (!b) return;
    narrFull = !narrFull;
    store.set('narrFull', narrFull);
    document.querySelectorAll('.nar-rest').forEach(r => r.classList.toggle('open', narrFull));
    document.querySelectorAll('[data-narmore]').forEach(x => { x.textContent = narrFull ? 'less \u25B4' : 'more \u25BE'; x.setAttribute('aria-expanded', String(narrFull)); });
  });
  const refColor = id => `hsl(${(id * 67 + 190) % 360} 85% 62%)`;
  const ctxColor = c => (c.isGlobal ? '#3ee6a8' : c.isModule ? '#ffb547' : `hsl(${(c.id * 83 + 20) % 360} 85% 62%)`);

  // ------------------------------------------------------------ sound effects (tiny synth, off by default)
  let audio = null;
  function beep(kind) {
    if (!S.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const tones = { push: [520, 'triangle'], pop: [360, 'triangle'], console: [700, 'sine'], error: [150, 'sawtooth'], done: [880, 'sine'], eventloop: [440, 'square'], await: [300, 'sine'], yield: [600, 'sine'], promise: [620, 'sine'] };
      const t = tones[kind];
      if (!t) return;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = t[1]; o.frequency.value = t[0];
      g.gain.setValueAtTime(0.06, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.2);
    } catch (e) { /* audio not available */ }
  }

  // ------------------------------------------------------------ syntax colors
  function tokenClasses(src) {
    const cls = new Array(src.length).fill('');
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`)|\b(\d+(?:\.\d+)?n?)\b|\b(var|let|const|function|return|if|else|for|while|do|break|continue|new|this|typeof|of|in|try|catch|finally|throw|true|false|null|undefined|class|extends|super|static|get|set|switch|case|default|delete|instanceof|async|await|yield|import|export|from)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
    let m;
    while ((m = re.exec(src))) {
      const c = m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'num' : m[4] ? 'kw' : 'fn';
      for (let k = m.index; k < m.index + m[0].length; k++) cls[k] = c;
    }
    return cls;
  }

  function renderCode(snap, errLine) {
    const src = S.src, cls = S.tokens;
    const hasRange = snap && snap.start != null;
    let html = '', pos = 0;
    const inl = snap ? inlineValues(S.i) : new Map();
    const flush = (text, key) => {
      if (!text) return '';
      const [c, m] = key.split('|');
      let h = esc(text);
      if (c) h = `<span class="tk-${c}">${h}</span>`;
      if (m === '1') h = `<mark class="hl">${h}</mark>`;
      return h;
    };
    src.split('\n').forEach((line, li) => {
      let inner = '', run = '', runKey = null;
      for (let k = 0; k < line.length; k++) {
        const gi = pos + k;
        const key = cls[gi] + '|' + (hasRange && gi >= snap.start && gi < snap.end ? 1 : 0);
        if (key !== runKey) { inner += flush(run, runKey); run = ''; runKey = key; }
        run += line[k];
      }
      inner += flush(run, runKey);
      pos += line.length + 1;
      const ln = li + 1;
      const c = (snap && snap.line === ln ? ' cur' : '') + (errLine === ln ? ' err' : '') + (S.bps.has(ln) ? ' bp' : '');
      const iv = inl.get(ln);
      html += `<div class="ln${c}" data-ln="${ln}"><span class="g" title="Click to toggle a breakpoint">${ln}</span><span class="s">${inner || ' '}${iv ? `<span class="inl${snap && snap.line === ln ? ' now' : ''}" title="What this line produced most recently">${esc(iv)}</span>` : ''}</span></div>`;
    });
    codeView.innerHTML = html;
    const cur = codeView.querySelector('.ln.cur, .ln.err');
    if (cur) {
      const top = cur.offsetTop, h = codeView.clientHeight;
      if (top < codeView.scrollTop + 24 || top > codeView.scrollTop + h - 48) codeView.scrollTop = Math.max(0, top - h / 3);
    }
  }

  // ------------------------------------------------------------ timeline strip: one coloured tick per step
  const TL_COLOR = CFG.TL_COLOR;
  const TL_RANK = CFG.TL_RANK;
  // React's phase at a step, for the bands under the timeline
  const PHASE = { code: ['your code', '--faint'], trigger: ['update', '--creation'], render: ['render', '--react'], commit: ['commit', '--execution'], passive: ['effects', '--eventloop'] };
  const PHASE_RANK = { code: 0, trigger: 1, passive: 2, render: 3, commit: 4 };
  function phaseOf(s) {
    if (!s || !s.react) return 'code';
    const p = s.react.phase;
    if (p === 'render' || p === 'commit' || p === 'passive') return p;
    return s.kind === 'react' ? 'trigger' : 'code';
  }
  let phaseCache = { trace: null, has: false };
  const tracePhases = () => { if (phaseCache.trace !== S.trace) phaseCache = { trace: S.trace, has: S.trace.some(t => t.react) }; return phaseCache.has; };
  function drawTimeline() {
    const cv = $('timeline');
    if (!cv) return;
    const bands = S.trace.length > 0 && tracePhases();
    cv.classList.toggle('has-phases', bands);
    const w = cv.clientWidth, h0 = cv.clientHeight;
    const BAND = bands ? 13 : 0, h = h0 - BAND;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h0 * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h0 * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h0);
    const n = S.trace.length;
    if (!n) return;
    const css = getComputedStyle(document.documentElement);
    const colors = {};
    const color = k => colors[k] || (colors[k] = css.getPropertyValue(TL_COLOR[k] || '--faint').trim() || '#888');
    const cols = Math.min(n, Math.floor(w));
    const cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const a = Math.floor(c * n / cols), b = Math.max(a + 1, Math.floor((c + 1) * n / cols));
      let best = S.trace[a].kind;
      for (let j = a + 1; j < b; j++) if ((TL_RANK[S.trace[j].kind] || 0) > (TL_RANK[best] || 0)) best = S.trace[j].kind;
      const tall = (TL_RANK[best] || 0) >= 5;
      g.globalAlpha = a <= S.i ? (tall ? 1 : 0.7) : (tall ? 0.5 : 0.28);
      g.fillStyle = color(best);
      g.fillRect(c * cw, tall ? 2 : 6, Math.max(1, cw - (cw > 3 ? 1 : 0)), tall ? h - 4 : h - 12);
    }
    g.globalAlpha = 1;
    if (bands) {
      // one band per column (the most important phase in it), then a label on each long stretch
      const col = [];
      for (let c = 0; c < cols; c++) {
        const a = Math.floor(c * n / cols), b = Math.max(a + 1, Math.floor((c + 1) * n / cols));
        let best = phaseOf(S.trace[a]);
        for (let j = a + 1; j < b; j++) { const p = phaseOf(S.trace[j]); if (PHASE_RANK[p] > PHASE_RANK[best]) best = p; }
        col.push(best);
        g.globalAlpha = a <= S.i ? 0.95 : 0.4;
        g.fillStyle = css.getPropertyValue(PHASE[best][1]).trim() || '#888';
        g.fillRect(c * cw, h + 2, cw + 0.5, BAND - 3);
      }
      g.globalAlpha = 1;
      g.font = '600 9px system-ui, sans-serif';
      g.textBaseline = 'middle';
      for (let c = 0; c < cols;) {
        let e = c;
        while (e + 1 < cols && col[e + 1] === col[c]) e++;
        const width = (e - c + 1) * cw, label = PHASE[col[c]][0];
        if (col[c] !== 'code' && width > g.measureText(label).width + 8) {
          g.fillStyle = '#0d1117';
          g.fillText(label, c * cw + 4, h + 2 + (BAND - 3) / 2);
        }
        c = e + 1;
      }
    }
    if (S.bps.size) {
      g.fillStyle = css.getPropertyValue('--error').trim();
      S.trace.forEach((s, j) => {
        if (s.line != null && S.bps.has(s.line) && (!j || S.trace[j - 1].line !== s.line)) { g.beginPath(); g.arc((j + 0.5) * w / n, 3, 2.5, 0, 7); g.fill(); }
      });
    }
    const x = (S.i + 0.5) * w / n;
    g.fillStyle = css.getPropertyValue('--text').trim();
    g.fillRect(Math.round(x) - 1, 0, 2, h0);
  }
  function timelineStepAt(e) {
    const cv = $('timeline');
    return Math.max(0, Math.min(S.trace.length - 1, Math.floor(e.offsetX / cv.clientWidth * S.trace.length)));
  }

  // ------------------------------------------------------------ inline values: what each line last produced
  function changedText(s) {
    for (const c of s.stack || []) {
      for (const sc of (c.scopes || []).concat(c.outer || [])) {
        const v = sc.vars && sc.vars.find(x => x.changed);
        if (v) return `${v.name} = ${v.v.text}`;
      }
    }
    for (const o of s.heap || []) {
      if (o.changedKey == null) continue;
      const e = o.entries.find(x => x.k === o.changedKey);
      if (e) return `#${o.id}.${e.k} = ${e.v.text}`;
    }
    return null;
  }
  function inlineValues(i) {
    const map = new Map();
    if (!S.inline || !S.trace.length) return map;
    for (let j = 0; j <= i && j < S.trace.length; j++) {
      const s = S.trace[j];
      if (!s.line || s.ext) continue;
      let t = null;
      if (s.kind === 'assign') t = changedText(s);
      else if ((s.kind === 'branch' || s.kind === 'loop') && s.evals) {
        const ev = s.evals.find(x => x.s === s.start && x.e === s.end);
        if (ev) t = (ev.tr ? '✓ ' : '✗ ') + (ev.t === 'true' || ev.t === 'false' ? ev.t : ev.t + (ev.tr ? ' (truthy)' : ' (falsy)'));
      }
      else if (s.kind === 'console' && s.console.length) t = '⟶ ' + s.console[s.console.length - 1].text;
      else if (s.kind === 'error') t = '✗ ' + String(s.msg || '').replace(/<[^>]+>/g, '').replace(/^\W+/, '').slice(0, 60);
      if (t) map.set(s.line, t.length > 48 ? t.slice(0, 47) + '…' : t);
    }
    return map;
  }

  // ------------------------------------------------------------ expression evaluation tree for the current statement
  function evalTreeData(i) {
    const snap = S.trace[i];
    if (!snap || snap.start == null || snap.ext) return null;
    const fs = snap.start, fe = snap.end;
    const topOf = s => (s.stack.length ? s.stack[s.stack.length - 1].id : null);
    const topId = topOf(snap);
    const found = new Map();
    for (let j = i; j >= 0 && j > i - 500; j--) {
      const s = S.trace[j];
      // stop at the step just before this statement started (same function, code outside the statement)
      if (j < i && topOf(s) === topId && s.start != null && !s.ext && (s.end <= fs || s.start >= fe)) break;
      const evs = s.evals || [];
      for (let k = evs.length - 1; k >= 0; k--) {
        const ev = evs[k], key = ev.s + ':' + ev.e;
        if (ev.s >= fs && ev.e <= fe && !found.has(key)) found.set(key, Object.assign({ fresh: j === i }, ev));
      }
    }
    // functions themselves (console.log → ƒ log) and names that show their own text add noise
    let list = [...found.values()].filter(n => !/^(ƒ |class )/.test(n.t) && S.src.slice(n.s, n.e) !== n.t);
    if (list.length < 2) return null;
    if (list.length > 28) list = list.filter(n => S.src.slice(n.s, n.e).length > 2 || n.fresh).slice(-28);
    list.sort((a, b) => a.s - b.s || b.e - a.e);
    const roots = [], path = [];
    for (const n of list) {
      n.kids = [];
      while (path.length && !(n.s >= path[path.length - 1].s && n.e <= path[path.length - 1].e)) path.pop();
      (path.length ? path[path.length - 1].kids : roots).push(n);
      path.push(n);
    }
    return roots;
  }
  function renderEvalBox(i) {
    const box = $('evalbox');
    const roots = S.evaltree ? evalTreeData(i) : null;
    if (!roots) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const snip = n => { const t = S.src.slice(n.s, n.e).replace(/\s+/g, ' '); return t.length > 46 ? t.slice(0, 45) + '…' : t; };
    const nodeHTML = n => `<li class="${n.fresh ? 'fresh' : ''}"><span class="et-code">${esc(snip(n))}</span><span class="et-arrow">→</span><span class="et-val${n.tr ? '' : ' falsy'}"${n.ref ? ` data-ref="${n.ref}"` : ''}>${esc(n.t)}</span>${n.kids.length ? `<ul>${n.kids.map(nodeHTML).join('')}</ul>` : ''}</li>`;
    box.innerHTML = `<div class="et-title">Evaluation <small>inner parts first · newest highlighted</small></div><ul class="et-tree">${roots.map(nodeHTML).join('')}</ul>`;
    box.classList.remove('hidden');
  }

  // ------------------------------------------------------------ array view: cells or bars, pointers, reads and writes
  const PTR_NAMES = CFG.PTR_NAMES;
  function arrayViewHTML(o, snap) {
    const n = +((/^Array\((\d+)\)/.exec(o.title) || [])[1]);
    const items = o.entries.filter(e => /^\d+$/.test(e.k));
    if (!S.arrayView || !n || n > 30 || items.length !== n || n < 2) return null;
    if (!items.every(e => ['num', 'str', 'bool', 'null', 'undef'].includes(e.v.t))) return null;
    const nums = items.every(e => e.v.t === 'num' && isFinite(+e.v.text));
    const max = nums ? Math.max(1, ...items.map(e => Math.abs(+e.v.text))) : 1;
    const ops = (snap.arr || []).filter(x => x.id === o.id);
    const reads = new Set(ops.filter(x => !x.w).map(x => x.i)), writes = new Set(ops.filter(x => x.w).map(x => x.i));
    // index-like variables in the current function that point into this array
    const ptrs = {};
    const top = snap.stack[snap.stack.length - 1];
    if (top) {
      const scopes = top.scopes.concat(top.outer || []);
      const usesIt = scopes.some(sc => sc.vars.some(v => v.v.ref === o.id)) || (snap.globalMem && snap.globalMem.vars.some(v => v.v.ref === o.id));
      if (usesIt) scopes.forEach(sc => sc.vars.forEach(v => {
        if (v.v.t === 'num' && PTR_NAMES.test(v.name)) { const x = +v.v.text; if (Number.isInteger(x) && x >= 0 && x <= n) (ptrs[x] = ptrs[x] || []).push(v.name); }
      }));
    }
    const cells = items.map((e, idx) => {
      const h = nums ? Math.max(6, Math.round(Math.abs(+e.v.text) / max * 100)) : 0;
      return `<div class="ac${reads.has(idx) ? ' rd' : ''}${writes.has(idx) ? ' wr' : ''}${ptrs[idx] ? ' pt' : ''}"${nums ? ` style="--h:${h}%"` : ''}><span class="av">${esc(e.v.t === 'str' ? e.v.text.replace(/^"|"$/g, '') : e.v.text)}</span><span class="ai">${idx}</span>${ptrs[idx] ? `<span class="ap">${esc(ptrs[idx].join(' '))}</span>` : ''}</div>`;
    }).join('');
    const end = ptrs[n] ? `<div class="ac ghost pt"><span class="av"></span><span class="ai">${n}</span><span class="ap">${esc(ptrs[n].join(' '))}</span></div>` : '';
    const legend = ops.length ? `<div class="av-legend">${reads.size ? '<i class="rd"></i> read' : ''}${writes.size ? ' <i class="wr"></i> written' : ''} this step</div>` : '';
    return `<div class="arrview${nums ? ' bars' : ''}">${cells}${end}</div>${legend}`;
  }

  // ------------------------------------------------------------ call tree (recursion) built from the whole run
  function buildCalls() {
    const nodes = new Map(), order = [];
    let prev = [];
    S.trace.forEach((s, j) => {
      const ids = s.stack.map(c => c.id);
      s.stack.forEach((c, k) => {
        let node = nodes.get(c.id);
        if (!node) {
          if (c.isGlobal || c.isModule || c.isWorker || (c.react && !S.builtDeep)) { nodes.set(c.id, { skip: true }); return; }
          // the parent is the nearest caller that is shown (React's own frames are left out)
          let pk = k - 1;
          while (pk >= 0 && nodes.get(ids[pk]) && nodes.get(ids[pk]).skip && s.stack[pk].react) pk--;
          node = { id: c.id, name: c.name.replace(/\(\)$/, ''), args: null, parent: pk >= 0 ? ids[pk] : null, born: j, endAt: null, ret: null, kids: [] };
          nodes.set(c.id, node);
          order.push(node);
        }
        if (!node.skip && node.args == null && c.phase === 'execution') {
          const sc = c.scopes[0];
          node.args = sc ? sc.vars.filter(v => v.kind === 'param').map(v => v.v.text).join(', ') : '';
        }
      });
      prev.forEach(id => {
        if (ids.includes(id)) return;
        const nd = nodes.get(id);
        if (nd && !nd.skip && nd.endAt == null) { nd.endAt = j; if (s.ret != null) nd.ret = s.ret; }
      });
      prev = ids;
    });
    const roots = [];
    order.forEach(nd => { const p = nodes.get(nd.parent); if (p && !p.skip) p.kids.push(nd); else roots.push(nd); });
    const recursive = order.some(nd => { for (let p = nodes.get(nd.parent); p && !p.skip; p = nodes.get(p.parent)) if (p.name === nd.name) return true; return false; });
    S.calls = { roots, order, recursive };
  }
  function callTreeHTML(i) {
    const C = S.calls;
    if (!S.callTree || !C || C.order.length < 3) return '';
    const snap = S.trace[i];
    const onStack = new Set(snap.stack.map(c => c.id));
    const cur = snap.stack.length ? snap.stack[snap.stack.length - 1].id : null;
    const W = 84, H = 46, MAXN = 160;
    let shown = 0, leaf = 0, maxDepth = 0;
    const place = (nd, depth) => {
      if (nd.born > i || shown >= MAXN) return null;
      shown++;
      maxDepth = Math.max(maxDepth, depth);
      const kids = nd.kids.map(k => place(k, depth + 1)).filter(Boolean);
      const x = kids.length ? (kids[0].x + kids[kids.length - 1].x) / 2 : leaf++;
      return { nd, x, depth, kids };
    };
    const roots = C.roots.map(r => place(r, 0)).filter(Boolean);
    S.ctCur = null;
    if (shown < 2) return '';
    let edges = '', boxes = '';
    const label = nd => { const a = nd.args == null ? '…' : nd.args; const t = `${nd.name}(${a})`; return t.length > 13 ? t.slice(0, 12) + '…' : t; };
    const draw = p => {
      const cx = 8 + p.x * W + W / 2, cy = 8 + p.depth * H;
      p.kids.forEach(k => { edges += `<path d="M${cx},${cy + 30} C${cx},${cy + 38} ${8 + k.x * W + W / 2},${8 + k.depth * H - 8} ${8 + k.x * W + W / 2},${8 + k.depth * H}"/>`; draw(k); });
      const nd = p.nd, done = nd.endAt != null && nd.endAt <= i;
      const cls = nd.id === cur ? 'cur' : onStack.has(nd.id) ? 'live' : done ? 'done' : 'wait';
      if (nd.id === cur) S.ctCur = { x: cx, y: cy };
      boxes += `<g class="ct-n ${cls}"><rect x="${cx - W / 2 + 3}" y="${cy}" width="${W - 6}" height="30" rx="6"/><text x="${cx}" y="${cy + 13}" text-anchor="middle">${esc(label(nd))}</text><text class="ct-ret" x="${cx}" y="${cy + 25}" text-anchor="middle">${done && nd.ret != null ? '→ ' + esc(nd.ret.length > 11 ? nd.ret.slice(0, 10) + '…' : nd.ret) : nd.id === cur ? 'running' : onStack.has(nd.id) ? 'waiting' : ''}</text><title>${esc(nd.name)}(${esc(nd.args || '')})${done && nd.ret != null ? ' returned ' + esc(nd.ret) : ''}</title></g>`;
    };
    roots.forEach(draw);
    const w = 16 + leaf * W, h = 16 + (maxDepth + 1) * H;
    const total = C.order.filter(nd => nd.born <= i).length;
    return `<details class="calltree" open><summary>Call tree <small>${total} call${total === 1 ? '' : 's'}${C.recursive ? ' · recursion' : ''}${total > MAXN ? ` · first ${MAXN} shown` : ''}</small></summary>
      <div class="ct-scroll"><svg width="${w}" height="${h}" role="img" aria-label="Tree of function calls">${edges}${boxes}</svg></div></details>`;
  }

  // ------------------------------------------------------------ flow arrows: where did execution just move?
  const FLOW_LABELS = CFG.FLOW_LABELS;
  let charW = 0;
  const colOf = pos => pos - S.src.lastIndexOf('\n', pos - 1) - 1;

  // the closest earlier step that pointed at code (event-loop steps don't)
  function prevCodeStep(i) {
    let between = false;
    for (let j = i - 1; j >= 0 && j >= i - 60; j--) {
      const s = S.trace[j];
      if (s.kind === 'eventloop' || s.kind === 'queue') between = true;
      if (s.start != null && !s.ext && s.line) return { s, between };
    }
    return null;
  }

  function flowKind(a, b, between) {
    const runner = s => { const t = (s.threads || []).find(x => x.running); return t ? t.name : 'main'; };
    if (runner(a) !== runner(b)) return 'thread';
    const dp = b.stack.length - a.stack.length;
    if (b.kind === 'catch') return 'catch';
    if (dp < 0 || b.kind === 'pop') return 'ret';
    if (between) return 'q';
    if (a.kind === 'push' && b.kind === 'create') return 'enter';
    if (dp > 0 || b.kind === 'push') return b.kind === 'create' ? 'enter' : 'call';
    if (b.kind === 'await' || /resume|back on the Call Stack/i.test(b.msg)) return 'resume';
    if (b.line < a.line) return 'loop';
    if (b.line > a.line + 1) return b.kind === 'skip' || b.kind === 'branch' ? 'skip' : 'jump';
    return 'next';
  }

  // while React renders (or skips) a component, its whole function is marked in the code
  function markComponent(snap) {
    codeView.querySelectorAll('.ln.comp-render, .ln.comp-skip').forEach(el => el.classList.remove('comp-render', 'comp-skip', 'comp-first'));
    codeView.querySelectorAll('.comp-tag').forEach(el => el.remove());
    const c = snap && snap.reactDetail && snap.reactDetail.comp;
    if (!c) return;
    const cls = c.mode === 'skip' ? 'comp-skip' : 'comp-render';
    let first = null;
    for (let ln = c.from; ln <= c.to; ln++) {
      const el = codeView.querySelector(`.ln[data-ln="${ln}"]`);
      if (!el) continue;
      el.classList.add(cls);
      if (!first) { first = el; el.classList.add('comp-first'); }
    }
    if (!first) return;
    const tag = document.createElement('span');
    tag.className = 'comp-tag ' + cls;
    tag.textContent = c.mode === 'skip' ? `⏭ React skips ${c.name}` : `⚛️ React renders ${c.name}`;
    tag.style.top = (first.offsetTop + 2) + 'px';
    codeView.appendChild(tag);
  }

  function drawFlow(i) {
    const old = codeView.querySelector('svg.flow');
    if (old) old.remove();
    codeView.querySelectorAll('.flow-tag').forEach(el => el.remove());
    codeView.classList.toggle('flowing', S.flow);
    const snap = S.trace[i];
    if (!S.flow || !snap) return;

    // fading trail of the last few lines that ran
    const seen = [];
    for (let j = i - 1; j >= 0 && seen.length < 4 && j >= i - 80; j--) {
      const s = S.trace[j];
      if (s.line && s.line !== snap.line && !seen.includes(s.line) && !s.ext) seen.push(s.line);
    }
    seen.forEach((ln, k) => { const el = codeView.querySelector(`.ln[data-ln="${ln}"]`); if (el) { el.classList.add('trail'); el.style.setProperty('--trail', (0.55 - k * 0.12).toFixed(2)); } });

    if (snap.start == null || snap.ext || !snap.line) return;
    const p = prevCodeStep(i);
    if (!p) return;
    const a = p.s, b = snap;
    if (a.start === b.start && a.end === b.end) return;
    const la = codeView.querySelector(`.ln[data-ln="${a.line}"]`), lb = codeView.querySelector(`.ln[data-ln="${b.line}"]`);
    if (!la || !lb) return;
    const sEl = lb.querySelector('.s');
    if (!charW) {
      const probe = document.createElement('span');
      probe.textContent = 'x'.repeat(40);
      probe.style.visibility = 'hidden';
      sEl.appendChild(probe);
      charW = probe.getBoundingClientRect().width / 40 || 7.8;
      probe.remove();
    }
    const kind = flowKind(a, b, p.between);
    const left = sEl.offsetLeft;
    const yOf = el => el.offsetTop + el.offsetHeight / 2;
    const xa = left + colOf(a.start) * charW, xb = left + colOf(b.start) * charW;
    const ya = yOf(la), yb = yOf(lb);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'flow k-' + kind);
    svg.setAttribute('width', codeView.scrollWidth);
    svg.setAttribute('height', codeView.scrollHeight);
    let d, head;
    if (a.line === b.line) {
      // moving inside one line: a small hop over the code
      const top = ya - lb.offsetHeight / 2 + 1, lift = Math.min(16, 7 + Math.abs(xb - xa) * 0.06);
      d = `M ${xa + 3} ${top} C ${xa + 3} ${top - lift}, ${xb + 3} ${top - lift}, ${xb + 3} ${top}`;
      head = `M ${xb - 1} ${top - 6} L ${xb + 3} ${top} L ${xb + 7} ${top - 6}`;
    } else {
      // between lines: an arc in the lane left of the code, arrowhead pointing at the new line
      const lane = left - 4, bend = Math.min(lane - 10, 10 + Math.abs(yb - ya) * 0.09);
      const x0 = lane - bend;
      d = `M ${lane} ${ya} C ${x0} ${ya}, ${x0} ${yb}, ${lane} ${yb}`;
      head = `M ${lane - 7} ${yb - 4.5} L ${lane} ${yb} L ${lane - 7} ${yb + 4.5}`;
    }
    const dur = arrowDur();
    svg.style.setProperty('--dur', dur + 'ms');
    svg.innerHTML = `<path class="fl-path" d="${d}"/><path class="fl-head" d="${head}"/>
      <circle class="fl-dot" r="3.2"><animateMotion dur="${dur}ms" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" path="${d}"/></circle>`;
    codeView.appendChild(svg);
    const path = svg.querySelector('.fl-path');
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`;
    path.style.strokeDashoffset = 0;
    la.classList.add('flow-from');
    restartAnim(lb, 'arrive');
    const label = FLOW_LABELS[kind];
    if (label && a.line !== b.line) {
      const tag = document.createElement('span');
      tag.className = 'flow-tag k-' + kind;
      tag.textContent = `${label} · from line ${a.line}`;
      codeView.appendChild(tag);
      // right after the line's text when it fits, otherwise in the panel's bottom-right corner
      const w = tag.offsetWidth, x = left + (sEl.textContent.replace(/\s+$/, '').length + 2) * charW;
      const maxX = codeView.scrollLeft + codeView.clientWidth - 8;
      if (x + w <= maxX) { tag.style.top = (lb.offsetTop + 3) + 'px'; tag.style.left = x + 'px'; }
      else {
        tag.textContent = `${label} · line ${a.line} → ${b.line}`;
        tag.classList.add('corner');
        tag.style.top = (codeView.scrollTop + codeView.clientHeight - tag.offsetHeight - 10) + 'px';
        tag.style.left = (maxX - tag.offsetWidth - 2) + 'px';
      }
    }
  }

  // ------------------------------------------------------------ pieces
  function valHTML(v) {
    const hasRef = v.ref != null;
    const attrs = hasRef ? ` data-ref="${v.ref}" style="--c:${refColor(v.ref)}"` : '';
    const rid = hasRef ? `<span class="rid">#${v.ref}</span>` : '';
    return `<span class="val val-${v.t}"${attrs} title="${esc(v.text)}">${esc(v.text)}${rid}</span>`;
  }

  function varRow(x) {
    const labels = { function: 'fn', import: 'imp' };
    const k = labels[x.kind] || x.kind;
    return `<div class="var${x.changed ? ' changed' : ''}"${x.from ? ` title="live import from ${esc(x.from)}"` : ''}><span class="kind k-${x.kind}">${k}</span><span class="vname">${esc(x.name)}</span><span class="eq">=</span>${valHTML(x.v)}${x.implicit ? ' <span title="Accidental global variable">⚠️</span>' : ''}${x.from ? ' <span class="from" title="live import">↗</span>' : ''}</div>`;
  }

  function scopeHTML(sc, cls, title, focus) {
    const rows = sc.vars.length ? sc.vars.map(varRow).join('') : '<div class="fn-meta">— empty —</div>';
    return `<div class="scope ${cls}${focus === sc.id ? ' focus' : ''}" data-scope="${sc.id}"><div class="scope-title">${title}</div>${rows}</div>`;
  }

  function ctxHTML(c, active, entering, focus, paused) {
    const memTitle = c.isGlobal ? 'Global memory' : c.isModule ? 'Module memory (private)' : c.isWorker ? 'Worker global memory (separate thread)' : 'Local memory';
    let body = c.scopes.map((sc, i) => (i === 0 ? scopeHTML(sc, '', memTitle, focus) : scopeHTML(sc, 'block', esc(sc.name), focus))).join('');
    const outer = c.outer.filter(o => o.kind !== 'global');
    body += outer.map(o => scopeHTML(o, 'closure', (o.alive ? 'Outer scope · ' : 'Closure · ') + esc(o.name) + (o.alive ? '' : ' (finished)'), focus)).join('');
    if (!c.isGlobal) {
      const globalFocus = c.outer.some(o => o.kind === 'global' && o.id === focus);
      const chain = [c.name].concat(outer.map(o => o.name)).map(n => `<span class="link">${esc(n)}</span>`).join(' → ');
      body += `<div class="chain">Scope chain: ${chain} → <span class="link"${globalFocus ? ' style="border-color:var(--done);color:var(--done)"' : ''}>Global</span></div>`;
    }
    const phase = c.phase === 'creation' ? '<span class="pill creation">creation</span>' : '<span class="pill execution">execution</span>';
    const title = c.isGlobal ? 'Global Execution Context' : (c.isModule ? '' : '') + esc(c.name) + (c.fromQueue === 'micro' ? ' <small class="src-tag" title="came from the Microtask Queue">microtask</small>' : c.fromQueue === 'queue' ? ' <small class="src-tag" title="came from the Callback Queue">task</small>' : '');
    const pills = (c.isAsync ? '<span class="pill async">async</span>' : '') + (c.strict ? '<span class="pill strict" title="strict mode">🔒</span>' : '');
    const state = paused ? esc(c.reason) : active ? '▶ running' : '⏸ waiting';
    return `<div class="ctx${active ? ' active' : ''}${entering ? ' enter' : ''}${paused ? ' paused' : ''}" style="--c:${ctxColor(c)}">
      <div class="ctx-head"><span class="ctx-name">${title}</span>${pills}${phase}<span class="state">${state}</span></div>
      <div class="ctx-this"><code>this</code> → ${esc(c.thisText)}</div>${body}</div>`;
  }

  function heapHTML(o, entering) {
    const icons = { function: 'ƒ' };
    const icon = o.isClass ? '' : icons[o.kind] || '';
    let body = '';
    if (o.kind === 'function') body += `<div class="fn-meta">(${esc(o.params)})${o.arrow ? ' =>' : ''} · born in ${esc(o.scope)}</div>`;
    const av = o.kind === 'array' && S.curSnap ? arrayViewHTML(o, S.curSnap) : null;
    body += av || o.entries.map(e => `<div class="entry${o.changedKey === e.k ? ' changed' : ''}"><span class="k">${esc(e.k)}:</span>${valHTML(e.v)}</div>`).join('');
    if (!o.entries.length && o.kind !== 'function') body += '<div class="fn-meta">(empty)</div>';
    if (S.internals && o.shape) body += `<div class="intl-note" title="Objects with the same properties added in the same order share a hidden class">hidden class <b>${esc(o.shape)}</b></div>`;
    if (S.internals && o.calls) body += `<div class="intl-note">called ${o.calls}×${o.calls >= 20 ? ' · <b>hot</b>: a real engine would compile it to fast machine code (JIT)' : ''}</div>`;
    if (o.garbage) body += '<div class="gc-note">Unreachable — will be garbage-collected</div>';
    else if (S.gcView && o.keptBy) body += `<div class="kept">kept alive by ${esc(o.keptBy)}</div>`;
    return `<div class="hobj${o.garbage ? ' garbage' : ''}${entering ? ' enter' : ''}${o.isPromise ? ' promise-' + o.state : ''}" data-ref="${o.id}" style="--c:${refColor(o.id)}" title="${o.keptBy ? 'Kept alive by: ' + esc(o.keptBy) : o.garbage ? 'Unreachable: will be garbage-collected' : ''}">
      <div class="hobj-head"><span class="hid">#${o.id}</span>${icon} ${esc(o.title.replace(/^ƒ /, ''))}</div>${body}</div>`;
  }

  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // ------------------------------------------------------------ main render
  // "One panel at a time": the right side shows only the panel this step is about
  const PANEL_NAMES = { stack: '📚 Call Stack', heap: '🧱 Heap', web: '⏱️ Web APIs & queues', react: '⚛️ React' };
  // which panels this step CHANGED (compared with the step before), and which one to show
  const STACK_KINDS = ['push', 'pop', 'create', 'hoist', 'exec', 'scope', 'lookup', 'return', 'catch', 'loop', 'branch', 'class', 'assign'];
  const WEB_KINDS = ['webapi', 'queue', 'eventloop', 'promise', 'await', 'yield'];
  const listSig = s => (s ? [s.webApis, s.queue, s.microtasks].map(l => (l || []).map(t => t.id).join(',')).join('|') : '');
  const stackSig = s => (s ? s.stack.map(c => c.id + ':' + c.phase).join(',') : '');
  function changesOf(snap, prev) {
    const c = new Set();
    if (snap.kind === 'react') c.add('react');
    if (WEB_KINDS.includes(snap.kind) || (prev && listSig(prev) !== listSig(snap))) c.add('web');
    const before = prev ? new Set(prev.heap.map(o => o.id)) : new Set();
    // a new object or array (functions made by declarations belong to the creation phase), or an object that changed
    if (snap.kind === 'heap' || (prev && snap.heap.some(o => !before.has(o.id) && o.kind !== 'function')) || snap.heap.some(o => o.changedKey != null)) c.add('heap');
    if (STACK_KINDS.includes(snap.kind) || (prev && stackSig(prev) !== stackSig(snap))) c.add('stack');
    return c;
  }
  // priority: React > a new or changed object > timers and queues > the call stack
  function panelOf(snap, prev, changes) {
    const c = changes || changesOf(snap, prev);
    if (c.has('react')) return 'react';
    if (c.has('heap') && snap.kind !== 'hoist' && snap.kind !== 'create') return 'heap';
    if (c.has('web')) return 'web';
    return 'stack';
  }
  function updatePanelStrip(snap, prev) {
    const strip = $('panelStrip');
    // the course always shows one panel at a time; elsewhere it is a View option
    const on = !!S.onePanel || document.body.classList.contains('course-focus');
    document.body.classList.toggle('one-panel', on);
    if (!strip) return;
    const panels = ['stack', 'heap', 'web'].concat(S.hasReact ? ['react'] : []);
    const changes = changesOf(snap, prev);
    let auto = panelOf(snap, prev, changes);
    if (auto === 'react' && !S.hasReact) auto = 'stack';
    const active = S.pinPanel && panels.includes(S.pinPanel) ? S.pinPanel : auto;
    const moved = document.body.dataset.panel !== active;
    document.body.dataset.panel = active;
    strip.classList.toggle('hidden', !on);
    strip.innerHTML = '<span class="ps-label">Showing</span>' + panels.map(p => `<button class="ps-chip${p === active ? ' on' : ''}${p === auto && S.pinPanel ? ' auto' : ''}${changes.has(p) ? ' changed' : ''}" data-pin="${p}" title="${p === active ? 'This panel is shown' : changes.has(p) ? 'This panel also changed at this step: click to see it' : 'Show this panel'} (click again to go back to automatic)">${PANEL_NAMES[p]}</button>`).join('')
      + (S.pinPanel ? '<button class="ps-chip unpin" data-pin="" title="Follow the current step again">📌 pinned · auto</button>' : '<span class="ps-auto" title="The panel follows each step. A pulsing dot means that panel changed too.">auto</span>');
    if (moved && on) { const el = { stack: '.stack-panel', heap: '.heap-panel', web: '.async-panel', react: '#reactPanel' }[active]; const node = document.querySelector(el); if (node) restartAnim(node, 'panel-in'); }
  }

  function render(i, forward) {
    const snap = S.trace[i];
    if (!snap) return;
    S.curSnap = snap;
    const prev = forward ? S.trace[i - 1] : null;

    const ph = PHASES[snap.phase] || PHASES.execution;
    const banner = $('phaseBanner');
    const newClass = 'phase phase-' + (PHASES[snap.phase] ? snap.phase : 'execution');
    if (banner.className.replace(' flip', '') !== newClass) { banner.className = newClass; restartAnim(banner, 'flip'); }
    const rph = snap.react && { render: 'RENDER', commit: 'COMMIT', passive: 'EFFECTS' }[snap.react.phase];
    const userTop = snap.stack.slice().reverse().find(c => !c.react);
    const where = rph ? (userTop && !userTop.isGlobal ? userTop.name : null) : snap.where;
    banner.innerHTML = `<span class="phase-icon"></span><span class="phase-text">${rph ? `⚛️ REACT ${rph} PHASE${snap.react.phase === 'render' && snap.react.lane ? ' (' + esc(snap.react.lane) + ')' : ''}` : ph[1]}${snap.loopPhase ? ' · ' + esc(snap.loopPhase) + ' phase' : ''}${where && snap.phase !== 'done' ? ' · ' + esc(where) : ''}</span>`;
    $('clock').textContent = `${snap.time}ms`;
    $('stepCount').textContent = `Step ${i + 1} / ${S.trace.length}`;
    if (window.ReactPanel) window.ReactPanel.render(snap, prev, i, S.trace);
    $('btnPair').classList.toggle('hidden', !currentPair()); // only concepts with a ready-made pair
    updatePanelStrip(snap, i > 0 ? S.trace[i - 1] : null);

    renderCode(snap);
    drawFlow(i);
    markComponent(snap);
    renderEvalBox(i);
    const ext = $('ext');
    if (snap.ext) {
      const x = snap.ext;
      ext.innerHTML = `<div class="ext-title">Running code from ${esc(x.label)}</div><pre>${esc(x.code.slice(0, x.start))}<mark class="hl">${esc(x.code.slice(x.start, x.end))}</mark>${esc(x.code.slice(x.end))}</pre>`;
      ext.classList.remove('hidden');
      // long sources (such as React's) scroll to the running part
      const mk = ext.querySelector('mark'), pre = ext.querySelector('pre');
      if (mk && pre) pre.scrollTop = Math.max(0, mk.offsetTop - pre.clientHeight / 3);
    } else ext.classList.add('hidden');

    const k = KINDS[snap.kind] || ['STEP', '#5cc8ff'];
    const tag = $('kindTag');
    tag.textContent = k[0]; $('bubble').style.setProperty('--kind', k[1]);
    const nar = $('narration');
    nar.innerHTML = shortNarration(stripLead(snap.msg));
    nar.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + S.trace.length);
    nar.querySelectorAll('[data-ref]').forEach(el => el.style.setProperty('--c', refColor(+el.dataset.ref)));
    const mascot = $('mascot');
    mascot.className = 'mascot';
    mascot.textContent = snap.kind === 'error' ? '😵' : snap.kind === 'done' ? '🥳' : snap.kind === 'catch' ? '😅' : '🤖';
    restartAnim(mascot, snap.kind === 'error' ? 'shake' : snap.kind === 'done' ? 'party' : 'talk');
    if (forward) beep(snap.kind);

    // call stack
    const stackEl = $('stack');
    const prevIds = new Set(prev ? prev.stack.concat(...(prev.threads || []).map(t => t.stack)).map(c => c.id) : []);
    let sh = callTreeHTML(i);
    if (!snap.stack.length) sh += '<div class="stack-empty"><span class="big">💤</span>The Call Stack is empty</div>';
    // React's own frames are folded into one block (unless "Inside React" is on)
    const frames = snap.stack.slice().reverse();
    for (let idx = 0; idx < frames.length; idx++) {
      const c = frames[idx];
      if (c.react && !S.builtDeep) {
        let end = idx;
        while (end + 1 < frames.length && frames[end + 1].react) end++;
        const names = frames.slice(idx, end + 1).map(f => f.name).reverse();
        sh += `<div class="ctx react-frame${idx === 0 ? ' active' : ''}" title="React's own functions. Turn on View → Inside React to step through them."><div class="ctx-head"><span class="ctx-name">⚛️ React internals <small>${names.length} frame${names.length > 1 ? 's' : ''}</small></span><span class="state">${idx === 0 ? '▶ running' : '⏸ waiting'}</span></div><div class="rf-chain">${names.map(n => `<code>${esc(n)}</code>`).join(' → ')}</div></div>`;
        idx = end;
        continue;
      }
      sh += ctxHTML(c, idx === 0, !!prev && !prevIds.has(c.id), snap.focusScope);
    }
    sh += '<div class="stack-floor">bottom of stack</div>';
    (snap.threads || []).forEach(th => {
      const state = th.sleeping ? '😴 asleep in Atomics.wait' : th.running ? '▶ running now' : 'waiting for its turn';
      sh += `<div class="thread-lane${th.running ? ' running' : ''}${th.sleeping ? ' sleeping' : ''}"><div class="scope-title">🧵 ${esc(th.name)} thread <small>own call stack · ${state}</small></div>${th.stack.slice().reverse().map((c, idx) => ctxHTML(c, idx === 0 && th.running, !!prev && !prevIds.has(c.id), snap.focusScope)).join('')}</div>`;
    });
    if (snap.paused && snap.paused.length) {
      const prevPaused = new Set(prev && prev.paused ? prev.paused.map(c => c.id) : []);
      sh += `<div class="paused-zone"><div class="scope-title">Paused — off the stack, waiting to resume</div>${snap.paused.map(c => ctxHTML(c, false, !!prev && !prevPaused.has(c.id), snap.focusScope, true)).join('')}</div>`;
    }
    if (!snap.globalAlive && snap.globalMem && snap.globalMem.vars.length) {
      sh += `<div class="ghost-global">${scopeHTML(snap.globalMem, '', 'Global memory — still alive after the script finished', snap.focusScope)}</div>`;
    }
    (snap.workers || []).forEach(m => { sh += `<div class="ghost-global worker">${scopeHTML(m, '', esc(m.name) + ' — its own memory on another thread', snap.focusScope)}</div>`; });
    (snap.modules || []).forEach(m => { sh += `<div class="ghost-global module">${scopeHTML(m, '', esc(m.name) + ' memory — kept alive', snap.focusScope)}</div>`; });
    stackEl.innerHTML = sh;
    const ct = stackEl.querySelector('.ct-scroll');
    if (ct && S.ctCur) { ct.scrollLeft = S.ctCur.x - ct.clientWidth / 2; ct.scrollTop = S.ctCur.y - ct.clientHeight / 2; }
    if (prev && (snap.kind === 'push' || snap.kind === 'pop')) {
      const fx = document.createElement('div');
      fx.className = 'fx ' + snap.kind;
      fx.textContent = snap.kind === 'push' ? '⬇ PUSH!' : '⬆ POP!';
      stackEl.appendChild(fx);
      setTimeout(() => fx.remove(), 1000);
    }
    if (snap.kind === 'push') stackEl.scrollTop = 0;
    const focused = stackEl.querySelector('.scope.focus');
    if (focused) focused.scrollIntoView({ block: 'nearest' });

    // heap
    const prevHeap = new Set(prev ? prev.heap.map(o => o.id) : []);
    $('heap').innerHTML = S.graph ? heapGraphHTML(snap) : snap.heap.length
      ? snap.heap.map(o => heapHTML(o, !!prev && !prevHeap.has(o.id))).join('')
      : '<div class="empty">Nothing in the Heap yet.<br>Objects, arrays and functions will appear here.</div>';
    if (S.internals && snap.ic && snap.ic.length) {
      const state = n => (n === 1 ? 'monomorphic · fast' : n <= 4 ? 'polymorphic · slower' : 'megamorphic · slow');
      $('heap').insertAdjacentHTML('beforeend', `<div class="ic-panel"><div class="scope-title">Inline caches (property reads)</div>${snap.ic.map(s => `<div class="ic-row"><code>${esc(s.text)}</code> line ${s.line} · ${s.hits} read${s.hits > 1 ? 's' : ''} · ${s.shapes} shape${s.shapes > 1 ? 's' : ''} → <b class="ic-${s.shapes === 1 ? 'mono' : s.shapes <= 4 ? 'poly' : 'mega'}">${state(s.shapes)}</b></div>`).join('')}<div class="fn-meta">Simulated: real engines (V8, SpiderMonkey) cache where a property lives for each hidden class they have seen.</div></div>`);
    }

    // web APIs, queues, event loop
    const icons = { fetch: 'NET', event: 'EVT', frame: 'RAF', interval: 'INT', timeout: 'TMR', gc: 'GC' };
    const prevTimers = new Set(prev ? prev.webApis.map(t => t.id) : []);
    $('webapis').innerHTML = snap.webApis.length ? snap.webApis.map(t => {
      const pct = t.delay ? Math.min(100, ((snap.time - t.start) / t.delay) * 100) : 100;
      const color = t.ref ? refColor(t.ref) : 'var(--accent)';
      return `<div class="timer${prev && !prevTimers.has(t.id) ? ' enter' : ''}"><span class="ttag">${icons[t.kind] || 'TMR'}</span><span class="tl"${t.ref ? ` data-ref="${t.ref}"` : ''} style="color:${color}">${esc(t.label)}</span><small>${t.delay}ms · at ${t.fireAt}ms</small><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('') : `<div class="empty" style="padding:8px">Nothing waiting ${snap.env === 'node' ? 'in libuv' : 'in the browser'}</div>`;
    const queueHTML = (list, prevList) => {
      const prevQ = new Set(prevList ? prevList.map(t => t.id) : []);
      return list.length ? list.map(t => `<div class="task${t.next ? ' next' : ''}${prev && !prevQ.has(t.id) ? ' enter' : ''}">${esc(t.label)}</div>`).join('') : '<span class="fn-meta" style="padding:4px 6px">empty</span>';
    };
    const node = snap.env === 'node';
    $('qMicroTitle').innerHTML = node ? 'nextTick + microtask queue <small>nextTick first, then promises</small>' : 'Microtask queue <small>promises · always first</small>';
    $('qTaskTitle').innerHTML = node ? 'Check queue <small>setImmediate · check phase</small>' : 'Callback queue <small>timers, events · after microtasks</small>';
    $('webTitle').textContent = node ? 'Node · timers & I/O (libuv)' : 'Web APIs';
    $('queue').innerHTML = queueHTML(snap.queue, prev && prev.queue);
    $('microQueue').innerHTML = queueHTML(snap.microtasks, prev && prev.microtasks);
    const loop = $('eventLoop');
    loop.classList.remove('spin');
    renderLoopTrack(snap);
    if (snap.kind === 'eventloop') restartAnim(loop, 'spin');

    // console (+ pretend page)
    const prevLen = prev ? prev.console.length : snap.console.length;
    const con = $('console');
    con.innerHTML = snap.console.length
      ? snap.console.map((l, n) => `<div class="c ${l.type}${n >= prevLen ? ' new' : ''}">${esc(l.text)}</div>`).join('')
      : '<div class="empty">Nothing printed yet</div>';
    con.scrollTop = con.scrollHeight;
    const pagePanel = document.querySelector('.console-panel');
    pagePanel.classList.toggle('has-page', !!(snap.page || snap.files));
    pagePanel.querySelector('.page-title').textContent = snap.page ? 'Page' : snap.env === 'node' ? 'Disk' : 'Files';
    renderPage(snap.page, snap.files, snap.env === 'node');

    // rewards
    snap.badges.forEach(b => {
      if (S.earned.has(b)) return;
      S.earned.add(b);
      store.set('badges', [...S.earned]);
      const d = BADGES[b];
      void d; // no achievement pop-ups
      award('badge:' + b, 5);
      renderShelf(b);
    });
    if (i === S.trace.length - 1 && S.trace.length > 1 && S.mode === 'level') document.dispatchEvent(new CustomEvent('jsl:watched', { detail: LEVELS[S.level].id }));
    if (i === S.trace.length - 1 && S.trace.length > 1 && S.mode === 'level') {
      const id = LEVELS[S.level].id;
      if (!S.completed.has(id) && id !== 'sandbox') {
        S.completed.add(id);
        store.set('completed', [...S.completed]);
        award('lvl:' + id, 20);
      }
    }

    $('scrub').value = i;
    $('btnPlay').textContent = S.playing ? '⏸' : '▶';
    drawEngineFlow(i, forward);
    drawArrows();
    drawTimeline();
  }

  // ------------------------------------------------------------ engine flow: how a step moves between the panels
  // arrows move slowly so you can follow where execution goes: 1.8 s when you step yourself;
  // while playing, most of the time until the next step (so an arrow always finishes before the next one)
  function arrowDur() {
    const step = SPEEDS[+$('speed').value] || 1000;
    return S.playing ? Math.max(200, Math.round(step * 0.8)) : 1800;
  }
  function flowDur() { return arrowDur(); }

  function engineMoves(snap, prev) {
    const q = sel => document.querySelector(sel);
    const all = sel => [...document.querySelectorAll(sel)];
    const codeEl = codeWrap.classList.contains('edit') ? null : (q('#codeView mark.hl') || q('#codeView .ln.cur .s'));
    const node = snap.env === 'node';
    const moves = [];
    const add = (from, to, label, kind) => { if (from && to && from !== to) moves.push({ from, to, label, kind }); };
    const newFrame = q('#stack .ctx.enter');
    const newObj = q('#heap .hobj.enter');
    const newTimer = q('#webapis .timer.enter');
    const newTask = q('#queue .task.enter'), newMicro = q('#microQueue .task.enter');
    const newLog = all('#console .c.new').pop();
    switch (snap.kind) {
      case 'push':
        if (newFrame) {
          if (/Queue and lands|comes off/i.test(snap.msg)) add($('eventLoop'), newFrame, snap.msg.includes('Microtask') ? 'microtask → stack' : 'callback → stack', 'q');
          else add(codeEl, newFrame, 'push frame', 'call');
        }
        break;
      case 'pop': {
        const top = q('#stack .ctx.active') || q('#stack .stack-floor');
        if (prev && prev.stack.length > snap.stack.length) add(top, codeEl || top, 'pop · return value', 'ret');
        break;
      }
      case 'webapi':
        if (newTimer) add(codeEl, newTimer, node ? 'hand to libuv' : 'hand to Web API', 'web');
        else if (newMicro) add(codeEl, newMicro, 'queue microtask', 'micro');
        break;
      case 'queue':
        if (newTask) add($('webTitle'), newTask, 'ready → callback queue', 'q');
        else if (newMicro) add($('webTitle'), newMicro, 'ready → microtask queue', 'micro');
        break;
      case 'eventloop': {
        const next = q('#microQueue .task.next') || q('#queue .task.next') || q('#microQueue .task') || q('#queue .task');
        if (next) add(next, $('eventLoop'), 'event loop picks it', 'q');
        break;
      }
      case 'promise':
        if (newMicro) add(codeEl, newMicro, 'reaction → microtask queue', 'micro');
        else if (newObj) add(codeEl, newObj, 'new Promise', 'heap');
        break;
      case 'console':
        if (newLog) add(codeEl, newLog, 'print', 'log');
        break;
      case 'assign': {
        const v = q('#stack .var.changed');
        const e = q('#heap .entry.changed');
        if (e) add(codeEl, e, 'write to heap', 'heap');
        else if (v) add(codeEl, v, 'store in memory', 'mem');
        break;
      }
      case 'hoist': {
        const v = all('#stack .var.changed').pop() || all('#stack .ctx.active .var').pop();
        if (v) add(codeEl, v, 'reserve memory', 'mem');
        break;
      }
      case 'lookup': {
        const found = q('#stack .scope.focus');
        const here = q('#stack .ctx.active .scope');
        if (found && here && found !== here && !here.contains(found)) add(here, found, 'scope chain: found here', 'scope');
        break;
      }
      default: break;
    }
    // any step that created an object also gets an arrow into the heap
    if (newObj && !moves.some(m => m.to === newObj) && snap.kind !== 'pop') add(codeEl, newObj, 'allocate in heap', 'heap');
    return moves.slice(0, 2);
  }

  let lastFlowAt = 0;
  function clearEngineFlow() { if (performance.now() - lastFlowAt < 250) return; $('engineFlow').innerHTML = ''; $('engineTags').innerHTML = ''; }

  function drawEngineFlow(i, forward) {
    const svg = $('engineFlow'), tags = $('engineTags');
    lastFlowAt = performance.now();
    svg.innerHTML = ''; tags.innerHTML = '';
    const snap = S.trace[i];
    if (!S.flow || !forward || !snap) return;
    paintMoves(engineMoves(snap, S.trace[i - 1]), false);
  }
  // React's commit changed one element: once the page preview has loaded, draw an arrow from the React panel to it
  function drawPageLink(frame) {
    const snap = S.trace[S.i];
    if (!S.flow || !snap || snap.kind !== 'react' || !snap.reactDetail || !snap.reactDetail.domOp) return;
    let doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    const el = doc && doc.querySelector('[data-react-hit]');
    if (!el) return;
    const from = document.querySelector('#reactBody .cm-list li.now') || document.querySelector('#reactBody .fb.fresh') || document.querySelector('#reactBody .in-cap') || $('reactPanel');
    if (!from || from.offsetParent === null) return;
    // a stand-in for the element inside the iframe, in page coordinates
    const to = {
      getBoundingClientRect() { const f = frame.getBoundingClientRect(), r = el.getBoundingClientRect(); return { left: f.left + r.left, right: f.left + r.right, top: f.top + r.top, bottom: f.top + r.bottom, width: r.width, height: r.height }; },
      closest() { return null; },
    };
    paintMoves([{ from, to, label: 'fiber → DOM: ' + snap.reactDetail.domOp, kind: 'web' }], true);
  }
  function paintMoves(moves, append) {
    const svg = $('engineFlow'), tags = $('engineTags');
    if (!moves.length) return;
    if (!append) { svg.innerHTML = ''; tags.innerHTML = ''; }
    const W = window.innerWidth, H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const dur = flowDur();
    const visible = r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    // keep a point inside the panel that scrolls the element, so arrows never point at hidden things
    const clampTo = (el, r) => {
      const panel = el.closest('.code-view, .stack, .heap, .queue, .webapis, .console');
      if (!panel) return r;
      const b = panel.getBoundingClientRect();
      const top = Math.max(r.top, b.top + 4), bottom = Math.min(r.bottom, b.bottom - 4);
      return bottom <= top ? null : { left: r.left, right: Math.min(r.right, b.right - 4), top, bottom, width: r.width, height: bottom - top };
    };
    let html = '';
    moves.forEach((m, n) => {
      let a = m.from.getBoundingClientRect(), b = m.to.getBoundingClientRect();
      if (!visible(a) || !visible(b)) return;
      a = clampTo(m.from, a); b = clampTo(m.to, b);
      if (!a || !b) return;
      const ac = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 }, bc = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
      const horizontal = Math.abs(bc.x - ac.x) > Math.abs(bc.y - ac.y) * 0.6;
      let p1, p2, c1, c2;
      if (horizontal) {
        const right = bc.x > ac.x;
        p1 = { x: right ? a.right : a.left, y: ac.y };
        p2 = { x: right ? b.left : b.right, y: Math.min(b.bottom - 6, b.top + 12) };
        const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.45) * (right ? 1 : -1);
        c1 = { x: p1.x + dx, y: p1.y }; c2 = { x: p2.x - dx, y: p2.y };
      } else {
        const down = bc.y > ac.y;
        p1 = { x: Math.min(a.right - 10, a.left + 40), y: down ? a.bottom : a.top };
        p2 = { x: Math.min(b.right - 10, b.left + 40), y: down ? b.top : b.bottom };
        const dy = Math.max(30, Math.abs(p2.y - p1.y) * 0.45) * (down ? 1 : -1);
        c1 = { x: p1.x, y: p1.y + dy }; c2 = { x: p2.x, y: p2.y - dy };
      }
      const d = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
      const ang = Math.atan2(p2.y - c2.y, p2.x - c2.x), hl = 8;
      const hx = k => p2.x - hl * Math.cos(ang + k), hy = k => p2.y - hl * Math.sin(ang + k);
      const head = `M ${hx(0.45)} ${hy(0.45)} L ${p2.x} ${p2.y} L ${hx(-0.45)} ${hy(-0.45)}`;
      const delay = n * dur * 0.5;
      html += `<g class="ef k-${m.kind}" style="--dur:${dur}ms;--delay:${delay}ms">
        <path class="ef-glow" d="${d}"/><path class="ef-path" d="${d}" pathLength="100"/><path class="ef-head" d="${head}"/><circle class="ef-ring" cx="${p2.x}" cy="${p2.y}" r="5"/>
        <circle class="ef-dot" r="4"><animateMotion dur="${dur}ms" begin="${delay}ms" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.42 0 0.58 1" path="${d}"/></circle></g>`;
      // label at the middle of the curve
      const t = 0.5, mt = 1 - t;
      const mx = mt ** 3 * p1.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * p2.x;
      const my = mt ** 3 * p1.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * p2.y;
      tags.insertAdjacentHTML('beforeend', `<span class="ef-tag k-${m.kind}" style="left:${mx}px;top:${my}px;--delay:${delay}ms">${esc(m.label)}</span>`);
    });
    if (append) svg.insertAdjacentHTML('beforeend', html); else svg.innerHTML = html;
  }

  // ------------------------------------------------------------ event loop "race track": which station is running now?
  function loopStation(snap) {
    const node = snap.env === 'node';
    if (snap.phase === 'done' || snap.phase === 'error') return null;
    if (node && snap.loopPhase) return snap.loopPhase;
    const top = snap.stack[snap.stack.length - 1];
    if (top) {
      if (top.fromQueue === 'micro') return node ? 'ticks' : 'microtasks';
      if (top.fromQueue === 'queue') return node ? 'timers' : /🎞️/.test(top.name || '') ? 'render' : 'task';
      return 'script';
    }
    if (snap.microtasks.length) return node ? 'ticks' : 'microtasks';
    if (snap.queue.length) return node ? 'timers' : (snap.queue[0].label || '').startsWith('🎞️') ? 'render' : 'task';
    return node ? 'poll' : 'waiting';
  }
  function renderLoopTrack(snap) {
    const node = snap.env === 'node';
    const names = node ? ['script', 'ticks', 'timers', 'poll', 'check'] : ['script', 'microtasks', 'task', 'render'];
    const st = loopStation(snap);
    const k = names.indexOf(st);
    const n = names.length;
    const dot = (name, j) => {
      const a = -Math.PI / 2 + j * 2 * Math.PI / n;
      return `<circle class="lt-st${name === st ? ' on' : ''}" cx="${(32 + 27 * Math.cos(a)).toFixed(1)}" cy="${(32 + 27 * Math.sin(a)).toFixed(1)}" r="${name === st ? 4.5 : 2.8}"><title>${name}</title></circle>`;
    };
    $('eventLoop').innerHTML = `<svg class="lt" viewBox="0 0 64 64" aria-hidden="true"><circle class="lt-ring" cx="32" cy="32" r="27"/>${names.map(dot).join('')}${k >= 0 ? `<g class="lt-tok" style="transform: rotate(${k * 360 / n}deg)"><circle cx="32" cy="5" r="3"/></g>` : ''}</svg><span>↻</span><small>${esc(st || 'idle')}</small>`;
    $('eventLoop').title = `Event loop: ${st || 'idle'}. Stations: ${names.join(' → ')}`;
  }

  // ------------------------------------------------------------ heap as a graph of references
  function heapGraphHTML(snap) {
    const objs = snap.heap;
    if (!objs.length) return '<div class="empty">Nothing in the Heap yet.</div>';
    const byId = new Map(objs.map(o => [o.id, o]));
    const roots = [], seenRoot = new Set();
    const addRoot = (name, v) => { if (v && v.ref != null && byId.has(v.ref) && !seenRoot.has(name + v.ref) && roots.length < 14) { seenRoot.add(name + v.ref); roots.push({ name, ref: v.ref }); } };
    snap.stack.slice().reverse().forEach(c => (c.scopes || []).concat(c.outer || []).forEach(sc => sc.vars.forEach(x => addRoot(x.name, x.v))));
    if (snap.globalMem) snap.globalMem.vars.forEach(x => addRoot(x.name, x.v));
    // breadth-first from the roots gives each object a column
    const depth = new Map();
    let frontier = [...new Set(roots.map(r => r.ref))];
    frontier.forEach(id => depth.set(id, 1));
    for (let d = 2; frontier.length && d < 8; d++) {
      const next = [];
      frontier.forEach(id => byId.get(id).entries.forEach(e => { if (e.v.ref != null && byId.has(e.v.ref) && !depth.has(e.v.ref)) { depth.set(e.v.ref, d); next.push(e.v.ref); } }));
      frontier = next;
    }
    const maxD = depth.size ? Math.max(...depth.values()) : 0;
    objs.forEach(o => { if (!depth.has(o.id)) depth.set(o.id, maxD + 1); });
    const colW = 138, gap = 34, pad = 8, rootW = roots.length ? 86 : -gap;
    const cols = new Map();
    objs.forEach(o => { const d = depth.get(o.id); if (!cols.has(d)) cols.set(d, []); cols.get(d).push(o); });
    const pos = new Map();
    let height = 0;
    const xOf = d => pad + rootW + gap + (d - 1) * (colW + gap);
    [...cols.keys()].sort((a, b) => a - b).forEach(d => {
      let y = pad;
      cols.get(d).forEach(o => {
        const rows = Math.min(o.entries.length, 5) + (o.entries.length > 5 ? 1 : 0);
        const h = 22 + rows * 15 + 4;
        pos.set(o.id, { x: xOf(d), y, h });
        y += h + 10;
      });
      height = Math.max(height, y);
    });
    const rootPos = roots.map((r, i) => ({ ...r, x: pad, y: pad + i * 26 }));
    height = Math.max(height, pad + roots.length * 26) + pad;
    const width = xOf(Math.max(...depth.values())) + colW + pad;
    const trunc2 = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    let edges = '', nodes = '';
    const curve = (x1, y1, x2, y2) => { const dx = Math.max(16, (x2 - x1) / 2); return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`; };
    rootPos.forEach(r => {
      const t = pos.get(r.ref);
      edges += `<path d="${curve(r.x + rootW, r.y + 10, t.x, t.y + 11)}" stroke="${refColor(r.ref)}"/>`;
      nodes += `<g class="hg-root"><rect x="${r.x}" y="${r.y}" width="${rootW}" height="20" rx="10"/><text x="${r.x + rootW / 2}" y="${r.y + 14}" text-anchor="middle">${esc(trunc2(r.name, 11))}</text></g>`;
    });
    objs.forEach(o => {
      const p = pos.get(o.id);
      const shown = o.entries.slice(0, 5);
      shown.forEach((e, i) => {
        if (e.v.ref == null || !pos.has(e.v.ref)) return;
        const t = pos.get(e.v.ref), y1 = p.y + 22 + i * 15 + 8;
        if (e.v.ref === o.id) edges += `<path d="M${p.x + colW},${y1} c18,0 18,-${y1 - p.y - 6} 0,-${y1 - p.y - 6}" stroke="${refColor(e.v.ref)}"/>`;
        else edges += `<path d="${t.x > p.x ? curve(p.x + colW, y1, t.x, t.y + 11) : curve(p.x + colW, y1, t.x + colW, t.y + 11)}" stroke="${refColor(e.v.ref)}"/>`;
      });
      const title = `#${o.id} ${o.title.replace(/^ƒ /, 'ƒ ')}`;
      nodes += `<g class="hg-node${o.garbage ? ' garbage' : ''}" data-hnode="${o.id}">
        <rect x="${p.x}" y="${p.y}" width="${colW}" height="${p.h}" rx="6" style="stroke:${refColor(o.id)}"/>
        <text class="hg-title" x="${p.x + 8}" y="${p.y + 15}">${esc(trunc2(title, 20))}</text>
        ${shown.map((e, i) => `<text class="hg-row${e.v.ref != null ? ' ref' : ''}" x="${p.x + 8}" y="${p.y + 33 + i * 15}">${esc(trunc2(e.k + ': ' + e.v.text, 22))}</text>`).join('')}
        ${o.entries.length > 5 ? `<text class="hg-row" x="${p.x + 8}" y="${p.y + 33 + 5 * 15}">+${o.entries.length - 5} more</text>` : ''}
        <title>${esc(o.title)}${o.garbage ? ' (unreachable: will be garbage-collected)' : ''}</title></g>`;
    });
    const unreached = objs.filter(o => depth.get(o.id) === maxD + 1).length;
    return `<div class="hgraph"><svg width="${width}" height="${height}" role="img" aria-label="Heap objects and the references between them">${edges}${nodes}</svg>
      <div class="fn-meta">Left: variables on the stack. Arrows: references. Columns: how many hops from a variable.${unreached ? ' Last column: objects no variable reaches directly (kept by queues, closures or about to be garbage-collected).' : ''}</div></div>`;
  }

  // ------------------------------------------------------------ compare two versions side by side
  function runForCompare(src) {
    try {
      const it = new JSEngine.Interpreter(src, { maxSteps: S.maxSteps || undefined, seed: 7, storage: {} });
      const r = it.run();
      if (r.error) return { error: r.error, lines: [], steps: 0, time: 0 };
      const last = r.trace[r.trace.length - 1];
      return { lines: last.console.map(l => l.text), steps: r.trace.length, time: last.time, stopped: last.kind === 'error' ? String(last.msg).replace(/<[^>]+>/g, '') : null, trace: r.trace };
    } catch (e) { return { error: e.message, lines: [], steps: 0, time: 0 }; }
  }
  function openCompare() {
    stop();
    S.pairWhy = null;
    $('cmpNameA').textContent = 'Version A'; $('cmpNameB').textContent = 'Version B';
    if (!$('cmpA').value) { $('cmpA').value = getCode(); $('cmpB').value = getCode(); }
    $('cmpOut').innerHTML = '<p class="fn-meta">Change version B (or A), then press Run both.</p>';
    openModal('compareModal');
  }
  // a ready-made pair for the current concept (js/react-pairs.js): the concept's code and one change, run side by side
  function currentPair() {
    const L = S.mode === 'level' ? LEVELS[S.level] : null;
    const pair = L && window.REACT_PAIRS && window.REACT_PAIRS[L.id];
    if (!pair) return null;
    const b = window.REACT_PAIRS_APPLY(L.code, pair);
    return b ? { pair, a: L.code, b } : null;
  }
  function openPair() {
    const p = currentPair();
    if (!p) return;
    stop();
    $('cmpA').value = p.a; $('cmpB').value = p.b;
    $('cmpNameA').textContent = 'A: ' + p.pair.a; $('cmpNameB').textContent = 'B: ' + p.pair.b;
    S.pairWhy = p.pair.why;
    openModal('compareModal');
    runCompare();
  }
  // what React did in a run: renders, skips, DOM changes and the final page
  function reactSummary(trace) {
    if (!trace || !trace.some(t => t.react)) return null;
    const count = kinds => trace.filter(t => t.reactDetail && kinds.includes(t.reactDetail.trace)).length;
    const comps = trace.filter(t => t.reactDetail && t.reactDetail.trace === 'beginWork' && t.reactDetail.comp).length;
    const last = trace[trace.length - 1];
    const page = last && last.page ? last.page.html.replace(/\sdata-(jsl|ref|react-hit)="[^"]*"/g, '') : '';
    return { renders: count(['renderStart']), comps, skips: count(['bailout', 'bailoutSubtree', 'memoBailout', 'renderBailout', 'classSkip']), dom: count(['placement', 'commitUpdate', 'commitText', 'deletion']), effects: count(['effectRun']), interrupted: count(['interrupt', 'yield']), page };
  }
  function runCompare() {
    const A = runForCompare($('cmpA').value), B = runForCompare($('cmpB').value);
    const n = Math.max(A.lines.length, B.lines.length);
    let firstDiff = -1, rows = '';
    for (let i = 0; i < n; i++) {
      const same = A.lines[i] === B.lines[i];
      if (!same && firstDiff < 0) firstDiff = i;
      rows += `<tr class="${same ? '' : 'diff'}"><td>${i + 1}</td><td><code>${A.lines[i] === undefined ? '<i>—</i>' : esc(A.lines[i])}</code></td><td><code>${B.lines[i] === undefined ? '<i>—</i>' : esc(B.lines[i])}</code></td></tr>`;
    }
    const sum = (r, name) => r.error ? `<b>${name}</b>: <span class="bad">${esc(r.error)}</span>` : `<b>${name}</b>: ${r.steps} steps · ${r.time}ms virtual time${r.stopped ? ` · <span class="bad">stopped: ${esc(r.stopped.slice(0, 80))}</span>` : ''}`;
    $('cmpOut').innerHTML = `<div class="cmp-sum">${sum(A, 'A')}<br>${sum(B, 'B')}<br>${firstDiff < 0 ? '✅ <b>Same output.</b>' : `⚠️ <b>The output differs first at line ${firstDiff + 1}.</b>`}</div>
      ${S.pairWhy ? `<div class="cmp-why">💡 ${esc(S.pairWhy)}</div>` : ''}
      <table class="iv-diff cmp-table"><thead><tr><th>#</th><th>Console A</th><th>Console B</th></tr></thead><tbody>${rows || '<tr><td colspan="3"><i>Neither version prints anything.</i></td></tr>'}</tbody></table>
      ${(() => {
        const ra = reactSummary(A.trace), rb = reactSummary(B.trace);
        if (!ra && !rb) return '';
        const row = (label, k) => { const x = ra ? ra[k] : '—', y = rb ? rb[k] : '—'; return `<tr class="${x !== y ? 'diff' : ''}"><td>${label}</td><td>${esc(String(x))}</td><td>${esc(String(y))}</td></tr>`; };
        return `<table class="iv-diff cmp-table cmp-react"><thead><tr><th>React's work</th><th>A</th><th>B</th></tr></thead><tbody>
          ${row('renders (render phases)', 'renders')}${row('components rendered', 'comps')}${row('components skipped', 'skips')}${row('DOM changes in commits', 'dom')}${row('effects run', 'effects')}${row('paused or interrupted', 'interrupted')}
          <tr class="${ra && rb && ra.page !== rb.page ? 'diff' : ''}"><td>final page</td><td><code>${esc((ra && ra.page || '').slice(0, 160))}</code></td><td><code>${esc((rb && rb.page || '').slice(0, 160))}</code></td></tr></tbody></table>`;
      })()}
      <div class="iv-row2"><button class="btn small" data-cmpopen="A">Step through A</button><button class="btn small" data-cmpopen="B">Step through B</button></div>`;
    $('cmpOut').querySelectorAll('[data-cmpopen]').forEach(b => b.onclick = () => {
      const text = $(b.dataset.cmpopen === 'A' ? 'cmpA' : 'cmpB').value;
      closeModals();
      const sb = LEVELS.findIndex(l => l.id === 'sandbox');
      S.noSave = true;
      loadLevel(sb);
      setCode(text);
      build();
      toast(`Version ${b.dataset.cmpopen} loaded`, 'It is in the sandbox. Your saved sandbox code is untouched until you edit.');
    });
  }

  // ------------------------------------------------------------ record a video of the run / export the steps as text
  async function toggleRecording() {
    if (S.recording) { if (S.recording.state === 'recording') S.recording.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) { toast('Recording is not available', 'This browser cannot record its own tab. Try Chrome or Edge.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' }); }
    catch (e) { toast('Recording cancelled', 'Pick this tab in the browser dialog to record the run.'); return; }
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      S.recording = null;
      $('btnRecord').classList.remove('on');
      $('btnRecord').textContent = '⏺ Record';
      if (!chunks.length) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      a.download = `js-engine-lab-${(LEVELS[S.level] || {}).id || 'run'}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast('🎬 Video saved', 'A .webm file was downloaded.');
    };
    stream.getVideoTracks()[0].onended = () => { if (rec.state === 'recording') rec.stop(); };
    S.recording = rec;
    $('btnRecord').classList.add('on');
    $('btnRecord').textContent = '⏹ Stop';
    rec.start(250);
    if (!S.trace.length) await build();
    go(0);
    play();
  }
  function exportSteps() {
    if (!S.trace.length) return;
    const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
    const title = $('levelTitle').textContent;
    const last = S.trace[S.trace.length - 1];
    const fence = '`'.repeat(3);
    const out = [`# ${title}`, '', `${S.trace.length} steps · ${last.time}ms virtual time · exported from JS Engine Lab`, '', fence + 'js', S.src, fence, '',
      '| # | Kind | Line | Time | What happens |', '|---|---|---|---|---|'];
    S.trace.forEach((s, j) => out.push(`| ${j + 1} | ${(KINDS[s.kind] || ['STEP'])[0]} | ${s.line || ''} | ${s.time}ms | ${plain(s.msg).replace(/\|/g, '\\|')} |`));
    out.push('', '## Console output', '', fence, ...last.console.map(l => l.text), fence, '');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/markdown' }));
    a.download = `js-engine-lab-steps-${(LEVELS[S.level] || {}).id || 'run'}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('⬇ Steps exported', 'Every step as a Markdown table, with the code and the console output.');
  }

  // ------------------------------------------------------------ arrows from variables to heap objects
  function drawArrows() {
    const svg = $('arrows');
    if (!S.arrows) { svg.innerHTML = ''; return; }
    const W = window.innerWidth, H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const stackBox = $('stack').getBoundingClientRect(), heapBox = $('heap').getBoundingClientRect();
    const inside = (r, b) => r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right;
    let paths = '';
    const seen = new Set();
    document.querySelectorAll('#stack .val[data-ref]').forEach(chip => {
      const id = chip.dataset.ref;
      const target = document.querySelector(`#heap .hobj[data-ref="${id}"], #heap [data-hnode="${id}"]`);
      if (!target) return;
      const a = chip.getBoundingClientRect(), b = target.getBoundingClientRect();
      if (!inside(a, stackBox) || !inside(b, heapBox)) return;
      const key = id + ':' + Math.round(a.top);
      if (seen.has(key)) return;
      seen.add(key);
      const x1 = a.right, y1 = a.top + a.height / 2, x2 = b.left, y2 = Math.min(b.bottom - 8, b.top + 14);
      const dx = Math.max(40, (x2 - x1) / 2);
      const col = refColor(+id);
      paths += `<path d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" stroke="${col}" /><circle cx="${x2}" cy="${y2}" r="3.5" fill="${col}" />`;
    });
    svg.innerHTML = paths;
  }

  // ------------------------------------------------------------ playback
  window.JSLabGo = n => { stop(); go(n); };
  window.JSLabGo.trace = () => S.trace; // used by the React panel tests and screenshots
  // used by the guided course (js/react-course.js)
  window.JSLabAPI = {
    openLesson(id, tab) { const i = LEVELS.findIndex(l => l.id === id); if (i < 0) return false; closeModals(); loadLevel(i); if (tab) openBriefing(tab); return true; },
    openChallenge(id) { const i = CHALLENGES.findIndex(c => c.id === id); if (i < 0) return false; loadChallenge(i); return true; },
    openWriteIt(qid) { const q = IVQ.find(x => x.id === qid); if (!q) return false; closeModals(); startWriteIt(q); return true; },
    openQuestion(qid) { const q = IVQ.find(x => x.id === qid); if (!q) return false; closeModals(); loadInterview(q); return true; },
    play() { closeModals(); go(0); play(); },
    closeModals,
    isCompleted: id => S.completed.has(id),
    isSolved: id => S.solved.has(id) || S.solved.has('iv:' + id),
    lessonTitle: id => { const l = LEVELS.find(x => x.id === id); return l ? l.emoji + ' ' + l.title : id; },
    challengeTitle: id => { const c = CHALLENGES.find(x => x.id === id); return c ? c.title : id; },
    questionTitle: id => { const q = IVQ.find(x => x.id === id); return q ? q.title : id; },
    currentLessonId: () => (S.mode === 'level' && LEVELS[S.level] ? LEVELS[S.level].id : null),
    // for the practice list (js/react-practice.js)
    questions: () => IVQ,
    challenges: () => CHALLENGES,
    isTheory: q => q.kind === 'theory',
    canWrite: q => !!(window.JSWriteIt && JSWriteIt.has(q.id)),
    openPredict(qid) { const q = IVQ.find(x => x.id === qid); if (!q) return false; closeModals(); S.mock = null; loadInterview(q).then(() => openAnswer()); return true; },
    showLesson(id) { const idx = LEVELS.findIndex(l => l.id === id); if (idx < 0) return false; const keep = S.level; S.level = idx; openBriefing('lesson'); S.level = keep; return true; },
    currentKey() {
      if (S.mode === 'interview' && S.iv) return 'q:' + S.iv.id;
      if (S.mode === 'challenge' && S.chal) return S.chal.fromInterview ? 'w:' + S.chal.fromInterview.id : 'c:' + S.chal.id;
      return null;
    },
  };
  function go(i, silent) {
    if (!S.trace.length) return;
    i = Math.max(0, Math.min(S.trace.length - 1, i));
    const forward = i === S.i + 1;
    S.i = i;
    render(i, forward && !silent);
    if (i === S.trace.length - 1) stop();
  }
  function hitsBreakpoint(j) {
    const s = S.trace[j], p = S.trace[j - 1];
    return s && s.line != null && S.bps.has(s.line) && (!p || p.line !== s.line);
  }
  // "Stop at React": pause playback where React starts a render, a commit or its effects
  const REACT_STOPS = ['off', 'render', 'commit', 'effects', 'all'];
  const REACT_STOP_AT = { renderStart: 'render', commitStart: 'commit', passiveStart: 'effects' };
  const REACT_STOP_TEXT = { render: '⚛️ Render starts', commit: '🧾 Commit starts', effects: '⏱️ Effects start' };
  S.reactStop = REACT_STOPS.includes(store.get('reactStop', 'off')) ? store.get('reactStop', 'off') : 'off';
  function reactStopAt(j) {
    const s = S.trace[j];
    const at = s && s.reactDetail && REACT_STOP_AT[s.reactDetail.trace];
    return at && (S.reactStop === 'all' || S.reactStop === at) ? at : null;
  }
  function showReactStop() { const b = $('btnReactStop'); if (b) { b.textContent = '⏸ Stop at React: ' + S.reactStop; b.classList.toggle('on', S.reactStop !== 'off'); } }
  function play() {
    if (S.dirty || !S.trace.length || codeWrap.classList.contains('edit')) { build().then(ok => { if (ok) play(); }); return; }
    if (S.i >= S.trace.length - 1) go(0);
    S.playing = true;
    $('btnPlay').textContent = '⏸';
    clearInterval(S.timer);
    S.timer = setInterval(() => {
      go(S.i + 1);
      if (S.playing && hitsBreakpoint(S.i)) { stop(); toast(`⛔ Breakpoint on line ${S.trace[S.i].line}`, 'Paused. Step through, or press ▶ to continue.'); }
      else if (S.playing && reactStopAt(S.i)) { const at = reactStopAt(S.i); stop(); toast(`${REACT_STOP_TEXT[at]} · paused`, 'Step through it with → , or press ▶ to continue.'); }
    }, SPEEDS[+$('speed').value]);
  }
  function stop() {
    S.playing = false;
    clearInterval(S.timer);
    $('btnPlay').textContent = '▶';
    if (S.recording && S.trace.length && S.i >= S.trace.length - 1) setTimeout(() => { if (S.recording && S.recording.state === 'recording') S.recording.stop(); }, 1500);
  }
  function toggle() { if (S.playing) stop(); else play(); }
  const depth = j => S.trace[j].stack.length + (S.trace[j].paused ? 0 : 0);
  function stepOver() {
    stop();
    if (!S.trace.length) return;
    const cur = S.trace[S.i];
    const d = cur.kind === 'push' ? depth(S.i) - 1 : depth(S.i);
    for (let j = S.i + 1; j < S.trace.length; j++) if (depth(j) <= d) return go(j);
    go(S.trace.length - 1);
  }
  function stepOut() {
    stop();
    if (!S.trace.length) return;
    const d = depth(S.i);
    for (let j = S.i + 1; j < S.trace.length; j++) if (depth(j) < d) return go(j);
    go(S.trace.length - 1);
  }
  function nextBreakpoint() {
    stop();
    if (!S.bps.size) { toast('No breakpoints yet', 'Click a line number in the code to add one.'); return; }
    for (let j = S.i + 1; j < S.trace.length; j++) if (hitsBreakpoint(j)) return go(j);
    toast('No more breakpoints ahead', 'Jumped to the end.');
    go(S.trace.length - 1);
  }

  function setMode(mode) {
    codeWrap.classList.toggle('edit', mode === 'edit');
    $('tabEdit').classList.toggle('active', mode === 'edit');
    if (mode === 'edit') { stop(); focusEditor(); }
  }

  function showError(title, msg, line) {
    stop();
    S.trace = [];
    $('scrub').max = 0;
    $('stepCount').textContent = 'Step 0 / 0';
    const tag = $('kindTag');
    tag.textContent = title; $('bubble').style.setProperty('--kind', 'var(--error)');
    $('narration').innerHTML = msg;
    const m = $('mascot');
    m.textContent = '😵';
    restartAnim(m, 'shake');
    const banner = $('phaseBanner');
    banner.className = 'phase phase-error';
    banner.innerHTML = '<span class="phase-icon">💥</span><span class="phase-text">CAN\'T START</span>';
    if (line) { renderCode(null, line); codeWrap.classList.remove('edit'); }
  }

  function saveDraft() {
    if (S.noSave) return;
    const src = getCode();
    if (S.mode === 'challenge') { S.drafts[S.chal.id] = src; store.set('drafts', S.drafts); }
    else if (S.mode === 'interview') { /* interview code is never saved over your sandbox */ }
    else if (LEVELS[S.level].id === 'sandbox') { S.sandbox = src; store.set('sandbox', src); }
  }

  // Things that come from outside the program — real network answers, dialog answers, your clicks —
  // are collected here between runs. The program is then run again with them, so the recording
  // (and stepping backward) stays exact.
  const EXT = { netCache: new Map(), answers: [], events: [], src: null };

  async function fetchReal(m) {
    const t0 = performance.now();
    try {
      const r = await fetch(m.url, { method: m.method, headers: m.headers || undefined, body: m.body });
      let body = await r.text();
      if (body.length > 200000) body = body.slice(0, 200000);
      EXT.netCache.set(m.key, { status: r.status, statusText: r.statusText, url: r.url, headers: [...r.headers], body, latency: Math.round(performance.now() - t0) });
    } catch (e) {
      EXT.netCache.set(m.key, { error: e.message || 'Failed to fetch', latency: Math.round(performance.now() - t0) });
    }
  }

  async function build(keepStep) {
    stop();
    const src = getCode();
    if (EXT.src !== src) { EXT.answers = []; EXT.events = []; EXT.src = src; EXT.seed = Math.floor(Math.random() * 2 ** 31); } // new code: forget old clicks and answers
    S.src = src;
    S.tokens = tokenClasses(src);
    S.dirty = false;
    saveDraft();
    $('explain').classList.add('hidden');
    if (!window.acorn || !window.JSEngine) {
      showError('ERROR', 'The JavaScript parser did not load. Make sure <code>vendor/acorn.js</code> exists or that you are online.');
      return false;
    }
    let res, it;
    for (let round = 0; round < 40; round++) {
      S.builtDeep = !!S.deepReact;
      it = new window.JSEngine.Interpreter(src, { netCache: EXT.netCache, answers: EXT.answers, events: EXT.events, storage: store.get('pageStorage', {}), maxSteps: S.maxSteps, seed: EXT.seed, deepReact: S.builtDeep });
      res = it.run();
      if (res.error) break;
      if (it.netMisses && it.netMisses.length) {
        $('kindTag').textContent = 'NETWORK';
        $('narration').innerHTML = `Fetching ${it.netMisses.length} real request${it.netMisses.length > 1 ? 's' : ''} from the internet (${it.netMisses.map(m => '<code>' + esc(m.url) + '</code>').join(', ')})… The program will then be replayed with the real responses.`;
        await Promise.all(it.netMisses.map(fetchReal));
        continue;
      }
      if (it.dialogMisses && it.dialogMisses.length) {
        // show the real dialog once; the answer is replayed from now on
        const d = it.dialogMisses[0];
        const answer = d.kind === 'alert' ? (window.alert(d.message), true) : d.kind === 'confirm' ? window.confirm(d.message) : window.prompt(d.message, d.def);
        EXT.answers.push(answer);
        continue;
      }
      break;
    }
    if (res.error) {
      showError('SYNTAX ERROR', `The code can't be parsed: <b>${esc(res.error)}</b>${res.errorLine ? ` on line ${res.errorLine}` : ''}. Fix it and press Run ▶ (double-click the code to edit).`, res.errorLine);
      return false;
    }
    if (it.storageOut) store.set('pageStorage', it.storageOut);
    S.trace = res.trace;
    S.hasReact = res.trace.some(t => t.react);
    buildCalls();
    S.i = keepStep ? Math.min(keepStep, S.trace.length - 1) : 0;
    $('scrub').max = S.trace.length - 1;
    setMode('view');
    render(S.i, false);
    return true;
  }

  // ------------------------------------------------------------ live page preview (a sandboxed iframe)
  const PAGE_CSS = CFG.PAGE_CSS;
  let lastPageHTML = null;
  function filesHTML(files, node) {
    return `<div class="disk"><div class="disk-title">${node ? 'Virtual disk · /home/user/app' : 'Files served to fetch()'}</div>${files.map(f => `<div class="dfile${f.changed ? ' changed' : ''}"><div class="dfile-head"><code>${esc(f.name)}</code><small>${f.size} B${f.changed ? ' · written by your code' : ''}</small></div><pre>${esc(f.text)}</pre></div>`).join('')}</div>`;
  }

  function renderPage(page, files, node) {
    const host = $('page');
    if (!page) { host.innerHTML = files ? filesHTML(files, node) : ''; lastPageHTML = null; return; }
    let frame = host.querySelector('iframe');
    if (!frame) {
      host.innerHTML = '<div class="browser"><div class="bbar"><span></span><span></span><span></span><div class="burl">my-page.example/index.html</div></div><iframe sandbox="allow-same-origin" title="Page preview"></iframe></div><div id="pageExtra" class="page-extra"></div>';
      frame = host.querySelector('iframe');
      lastPageHTML = null;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>${page.html}</body></html>`;
    if (html !== lastPageHTML) {
      lastPageHTML = html;
      frame.onload = () => { wireFrame(frame); drawPageLink(frame); };
      frame.srcdoc = html;
    }
    const extra = [];
    if (page.dialog) extra.push(`<div class="pdialog"><b>${esc(page.dialog.kind)}</b> “${esc(page.dialog.message)}” → <code>${esc(page.dialog.answer)}</code></div>`);
    if (page.storage) extra.push(`<div class="pstore"><b>localStorage</b> ${page.storage.length ? page.storage.map(([k, v]) => `<code>${esc(k)}</code> = <code>${esc(String(v).slice(0, 40))}</code>`).join(' ') : '<i>empty</i>'} <a href="#" id="clearStore">clear</a></div>`);
    if (files) extra.push(filesHTML(files, node));
    $('pageExtra').innerHTML = extra.join('');
    const cs = $('clearStore');
    if (cs) cs.onclick = e => { e.preventDefault(); store.set('pageStorage', {}); toast('localStorage cleared', 'Run again to start fresh.'); };
  }

  // clicks and typing inside the preview become real events: the program re-runs with them
  function wireFrame(frame) {
    let doc;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;
    const pathOf = el => { const p = []; for (let n = el; n && n !== doc.body; n = n.parentElement) p.unshift([...n.parentElement.children].indexOf(n)); return p; };
    doc.addEventListener('click', e => {
      if (!(e.target instanceof doc.defaultView.Element)) return;
      if (e.target.matches('input, textarea, select')) return;
      e.preventDefault();
      addUserEvent({ type: 'click', path: pathOf(e.target) });
    });
    doc.addEventListener('change', e => {
      if (e.target.matches && e.target.matches('input, textarea, select')) addUserEvent({ type: 'input', path: pathOf(e.target), value: e.target.value });
    });
  }

  function addUserEvent(ev) {
    if (!S.trace.length) return;
    const now = S.trace[S.i].time;
    const lastAt = EXT.events.length ? EXT.events[EXT.events.length - 1].at : 0;
    ev.at = Math.max(now, lastAt) + 1;
    EXT.events.push(ev);
    toast(ev.type === 'click' ? 'Click recorded' : 'Typing recorded', `It happens at ${ev.at}ms. Re-running the program with it…`);
    build(S.i).then(ok => {
      if (!ok) return;
      const hits = [];
      S.trace.forEach((s, j) => { if (s.kind === 'queue' && /<b>you<\/b>/.test(s.msg)) hits.push(j); });
      const j = hits[EXT.events.length - 1];
      if (j != null) { go(j, true); play(); }
    });
  }

  // ------------------------------------------------------------ XP & ranks
  function award(key, points) {
    if (S.awarded.has(key)) return;
    S.awarded.add(key);
    store.set('awarded', [...S.awarded]);
    const before = rankOf(S.xp);
    S.xp += points;
    store.set('xp', S.xp);
    const after = rankOf(S.xp);
    renderXP(points);
    // (no rank pop-ups: progress is shown in the course map and the Progress window)
    void after; void before;
  }
  function rankOf(xp) { let r = RANKS[0]; RANKS.forEach(x => { if (xp >= x[0]) r = x; }); return r; }
  function renderXP(gain) {
    const r = rankOf(S.xp);
    const next = RANKS.find(x => x[0] > S.xp);
    const pct = next ? ((S.xp - r[0]) / (next[0] - r[0])) * 100 : 100;
    $('xpChip').innerHTML = `<span class="rank">${esc(r[1])}</span><span class="xpbar"><i style="width:${pct}%"></i></span><span class="xpnum">${S.xp} XP${gain ? ` <b class="gain">+${gain}</b>` : ''}</span>`;
    $('xpChip').title = next ? `${next[0] - S.xp} XP to ${next[1]}` : 'Max rank!';
  }

  // ------------------------------------------------------------ levels, lessons & quizzes
  function loadLevel(idx, opts = {}) {
    S.mode = 'level'; S.chal = null;
    document.body.classList.remove('challenge-mode');
    S.level = idx;
    store.set('level', idx);
    const L = LEVELS[idx];
    setCode(L.id === 'sandbox' && S.sandbox ? S.sandbox : L.code);
    S.bps.clear();
    $('levelEmoji').textContent = L.emoji;
    // React concepts are numbered by the concept list (the pill next to the title shows "Concept n / total")
    $('levelTitle').textContent = window.ReactConcepts && window.ReactConcepts.ORDER.includes(L.id) ? L.title : `Lesson ${idx + 1} · ${L.title}`;
    $('levelGoal').textContent = '— ' + L.goal;
    $('btnLesson').classList.toggle('hidden', !LESSONS[L.id]);
    $('btnLesson').textContent = 'Lesson & quiz';
    S.ivOpen = null;
    const done = build();
    if (opts.brief && LESSONS[L.id] && !S.briefed.has(L.id)) openBriefing('lesson');
    return done;
  }

  // ------------------------------------------------------------ interview questions
  const IVQ = window.JS_INTERVIEW || [];
  const ivSeen = new Set(store.get('ivSeen', []));
  const ivSolved = new Set(store.get('ivSolved', []));
  // spaced repetition: each question has a "box"; every correct answer moves it up a box and
  // schedules the next review 1, 3, 7, 14 or 30 days later. A miss sends it back to box 0 (due now).
  const ivSRS = store.get('ivSRS', {});
  store.get('ivReview', []).forEach(id => { if (!ivSRS[id]) ivSRS[id] = { box: 0, due: 0 }; });
  const SRS_DAYS = [0, 1, 3, 7, 14, 30];
  const isDue = id => !!ivSRS[id] && ivSRS[id].due <= Date.now();
  const srsAgain = id => { ivSRS[id] = { box: 0, due: Date.now() }; };
  const srsGood = id => {
    const box = Math.min((ivSRS[id] ? ivSRS[id].box : 0) + 1, SRS_DAYS.length - 1);
    ivSRS[id] = { box, due: Date.now() + SRS_DAYS[box] * 86400000 };
  };
  const ivReview = {
    has: isDue,
    add: srsAgain,
    delete: id => { delete ivSRS[id]; },
    get size() { return Object.keys(ivSRS).filter(isDue).length; },
  };
  const nextReviewText = id => {
    const r = ivSRS[id];
    if (!r) return '';
    if (r.due <= Date.now()) return 'due for review now';
    const d = Math.ceil((r.due - Date.now()) / 86400000);
    return `next review in ${d} day${d === 1 ? '' : 's'}`;
  };
  function renderDueBadge() {
    const n = ivReview.size;
    const b = $('ivDue');
    if (b) { b.textContent = n; b.classList.toggle('hidden', !n); b.title = `${n} question${n === 1 ? '' : 's'} due for review`; }
  }
  const ivStars = new Set(store.get('ivStars', []));
  const ivNotes = store.get('ivNotes', {});
  const saveIv = () => {
    store.set('ivSeen', [...ivSeen]); store.set('ivSolved', [...ivSolved]); store.set('ivSRS', ivSRS); renderDueBadge();
    store.set('ivStars', [...ivStars]); store.set('ivNotes', ivNotes);
  };
  let ivLevel = 'All';
  // topics in a sensible learning order; anything new goes at the end
  const IV_ORDER = CFG.IV_ORDER;
  const ivCats = [...new Set(IVQ.map(q => q.cat))].sort((a, b) => ((IV_ORDER.indexOf(a) + 1) || 99) - ((IV_ORDER.indexOf(b) + 1) || 99));
  const IV_XP = { Easy: 5, Medium: 10, Hard: 15 };
  const isTheory = q => q.kind === 'theory';

  function loadInterview(q) {
    closeInterviewMenu();
    ivSeen.add(q.id);
    saveIv();
    S.iv = q;
    if (isTheory(q)) { renderMockBar(); openFlashcard(q); return Promise.resolve(true); }
    const sb = LEVELS.findIndex(l => l.id === 'sandbox');
    stop();
    S.noSave = true;
    loadLevel(sb);
    S.mode = 'interview';
    S.iv = q;
    setCode(q.code);
    $('levelEmoji').textContent = '🎤';
    $('levelTitle').textContent = `Interview · ${q.title}`;
    $('levelGoal').textContent = `— ${q.ask}`;
    $('btnLesson').textContent = 'Predict & answer';
    $('btnLesson').classList.remove('hidden');
    renderMockBar();
    if (!S.mock) toast(`🎤 ${q.title}`, `${q.ask} Open "Predict & answer" to type your prediction, or press ▶ to watch.`);
    return build().then(ok => { if (S.mock) openAnswer(); return ok; });
  }

  // the shared bottom of both answer windows: bookmark, review mark and notes
  function ivToolsHTML(q) {
    return `<div class="iv-tools2">
        <button class="btn small iv-toggle${ivStars.has(q.id) ? ' on' : ''}" data-ivtoggle="star">${ivStars.has(q.id) ? '★ Bookmarked' : '☆ Bookmark'}</button>
        <button class="btn small iv-toggle${ivReview.has(q.id) ? ' on' : ''}" data-ivtoggle="review">↻ ${ivReview.has(q.id) ? 'Marked for review' : 'Review later'}</button>
        ${ivSolved.has(q.id) ? '<span class="iv-solved-chip">✓ solved</span>' : ''}
        ${ivSRS[q.id] ? `<span class="iv-next">🗓 ${nextReviewText(q.id)}</span>` : ''}
      </div>
      <label class="iv-label" for="ivNote">Your notes <small>(saved in this browser)</small></label>
      <textarea id="ivNote" class="iv-note" rows="2" placeholder="Key idea to remember…">${esc(ivNotes[q.id] || '')}</textarea>`;
  }
  function wireIvTools(q, reopen) {
    $('lessonBody').querySelectorAll('[data-ivtoggle]').forEach(b => b.onclick = () => {
      const set = b.dataset.ivtoggle === 'star' ? ivStars : ivReview;
      set.has(q.id) ? set.delete(q.id) : set.add(q.id);
      saveIv();
      reopen(true);
    });
    $('ivNote').oninput = e => { const v = e.target.value.trim(); if (v) ivNotes[q.id] = e.target.value; else delete ivNotes[q.id]; saveIv(); };
  }
  function setBriefFoot() {
    $('tabQuiz').classList.add('hidden');
    $('tabLesson').textContent = 'Answer';
    $('briefStart').textContent = S.mock ? (S.mock.i < S.mock.qs.length - 1 ? 'Next question ▶' : 'Finish interview ▶') : isTheory(S.iv) ? 'Close' : '▶ Watch it run';
    showBriefTab('lesson');
    $('briefModal').classList.remove('hidden');
  }

  function ivMarkSolved(q, ok) {
    if (S.mock && !(q.id in S.mock.results)) { S.mock.results[q.id] = ok; renderMockBar(); }
    if (!ok) { srsAgain(q.id); saveIv(); return; }
    ivSolved.add(q.id);
    srsGood(q.id);
    saveIv();
    award('iv:' + q.id, isTheory(q) ? 3 : IV_XP[q.level] || 5);
  }

  // code questions: predict the output, check it line by line, then read why
  function openAnswer(keepGuess) {
    const q = S.iv;
    if (!q || isTheory(q)) { if (q) openFlashcard(q); return; }
    stop();
    S.ivOpen = q;
    document.dispatchEvent(new CustomEvent('jsl:answered', { detail: q.id }));
    const last = S.trace[S.trace.length - 1];
    const lines = last ? last.console.map(l => l.text) : [];
    const edited = getCode() !== q.code;
    const guess = keepGuess === true && $('ivGuess') ? $('ivGuess').value : '';
    $('briefTitle').textContent = `🎤 ${q.title}`;
    $('lessonBody').innerHTML = `<p class="quiz-q"><span class="iv-level lv-${q.level.toLowerCase()}">${q.level}</span> ${esc(q.ask)}</p>
      <details class="iv-reveal iv-codebox" open><summary>The code${edited ? ' (your edited version)' : ''}</summary><pre class="iv-code">${esc(getCode())}</pre></details>
      <div class="iv-predict">
        <label class="iv-label" for="ivGuess">🎯 Your prediction: what does the console print? <small>one line per console.log</small></label>
        <textarea id="ivGuess" class="iv-guess" rows="4" spellcheck="false" placeholder="Type each line you expect…">${esc(guess)}</textarea>
        <div class="iv-row2"><button id="ivCheck" class="btn primary small">Check my answer</button><button id="ivSkip" class="btn small">Just show me</button></div>
        <div id="ivResult"></div>
      </div>
      <details class="iv-reveal" id="ivOut"><summary>Real output</summary><pre class="iv-out">${lines.length ? lines.map(esc).join('\n') : '(nothing is printed)'}</pre></details>
      <details class="iv-reveal" id="ivWhy"><summary>Why</summary><div class="iv-why">${q.why}</div></details>
      ${window.JSWriteIt && JSWriteIt.has(q.id) ? `<div class="wi-cta"><div><b>✍️ Now write it yourself</b><small>The function bodies are removed; the test code stays. Your output must match exactly.</small></div><button class="btn primary small" id="ivWrite">Start</button></div>` : ''}
      ${ivToolsHTML(q)}`;
    if ($('ivWrite')) $('ivWrite').onclick = () => startWriteIt(q);
    const reveal = () => { $('ivOut').open = true; $('ivWhy').open = true; };
    $('ivSkip').onclick = () => { reveal(); ivMarkSolved(q, false); };
    $('ivCheck').onclick = () => {
      const norm = s => s.split('\n').map(x => x.trim()).filter(Boolean);
      const want = lines.map(x => String(x).trim()).filter(Boolean), got = norm($('ivGuess').value);
      if (!got.length) { $('ivResult').innerHTML = '<p class="iv-hint">Type at least one line first, or press "Just show me".</p>'; return; }
      const n = Math.max(want.length, got.length);
      let right = 0;
      const rows = [];
      for (let i = 0; i < n; i++) {
        const ok = want[i] === got[i];
        if (ok) right++;
        rows.push(`<tr class="${ok ? 'ok' : 'bad'}"><td>${ok ? '✓' : '✗'}</td><td><code>${got[i] === undefined ? '<i>(missing)</i>' : esc(got[i])}</code></td><td><code>${want[i] === undefined ? '<i>(nothing more)</i>' : esc(want[i])}</code></td></tr>`);
      }
      const all = right === n;
      $('ivResult').innerHTML = `<div class="iv-verdict ${all ? 'ok' : 'bad'}">${all ? '✅ <b>Exactly right!</b>' : `❌ <b>${right} of ${n} lines right.</b> Compare below, then read why.`}</div>
        <table class="iv-diff"><thead><tr><th></th><th>You said</th><th>Real output</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
      $('ivWhy').open = true;
      ivMarkSolved(q, all);
    };
    wireIvTools(q, openAnswer);
    setBriefFoot();
    setTimeout(() => { const g = $('ivGuess'); if (g && !guess) g.focus(); }, 30);
  }

  // theory questions: answer in your head (or type it), reveal the model answer, rate yourself
  function openFlashcard(q, keep) {
    stop();
    S.iv = q;
    S.ivOpen = q;
    const shown = keep === true && $('ivFlashA') && !$('ivFlashA').classList.contains('hidden');
    const guess = keep === true && $('ivGuess') ? $('ivGuess').value : '';
    $('briefTitle').textContent = '🗂️ Theory flashcard';
    $('lessonBody').innerHTML = `<p class="quiz-q"><span class="iv-level lv-${q.level.toLowerCase()}">${q.level}</span> Explain it as you would in an interview.</p>
      <h3 class="iv-flash-q">${esc(q.ask)}</h3>
      <textarea id="ivGuess" class="iv-guess" rows="3" placeholder="Your answer (optional: saying it out loud works too)…">${esc(guess)}</textarea>
      <div class="iv-row2"><button id="ivFlip" class="btn primary small"${shown ? ' disabled' : ''}>Show model answer</button></div>
      <div id="ivFlashA" class="iv-flash-a${shown ? '' : ' hidden'}">${q.why}</div>
      <div id="ivRate" class="iv-rate${shown ? '' : ' hidden'}">How did you do?
        <button class="btn small" data-rate="knew">✓ I knew it</button>
        <button class="btn small" data-rate="review">↻ Review again</button></div>
      ${ivToolsHTML(q)}`;
    $('ivFlip').onclick = () => { $('ivFlashA').classList.remove('hidden'); $('ivRate').classList.remove('hidden'); $('ivFlip').disabled = true; document.dispatchEvent(new CustomEvent('jsl:answered', { detail: q.id })); };
    $('ivRate').querySelectorAll('[data-rate]').forEach(b => b.onclick = () => {
      const knew = b.dataset.rate === 'knew';
      if (knew) ivMarkSolved(q, true);
      else { ivReview.add(q.id); ivSolved.delete(q.id); saveIv(); ivMarkSolved(q, false); toast('↻ Added to review', 'It is due again now. Find it under "Due for review".'); }
      if (S.mock) mockNext(); else openFlashcard(q, true);
    });
    wireIvTools(q, k => openFlashcard(q, k));
    setBriefFoot();
  }

  // ------------------------------------------------------------ export / import everything this app saved
  function exportProgress() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('rql.')) data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify({ app: 'js-engine-lab', version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `js-engine-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('⬇ Progress exported', 'Keep the file, or import it in another browser.');
  }
  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || parsed.app !== 'js-engine-lab' || typeof parsed.data !== 'object') throw new Error('not a JS Engine Lab progress file');
        const keys = Object.keys(parsed.data).filter(k => k.startsWith('rql.'));
        keys.forEach(k => localStorage.setItem(k, String(parsed.data[k])));
        toast('⬆ Progress imported', `${keys.length} saved items restored. Reloading…`);
        setTimeout(() => location.reload(), 900);
      } catch (e) { toast('Could not import that file', e.message); }
    };
    reader.readAsText(file);
  }

  // ------------------------------------------------------------ Big-O lab: count steps for growing input sizes
  const LAB_PRESETS = CFG.LAB_PRESETS;
  const LAB_COLORS = CFG.LAB_COLORS;
  const labSeries = [];
  function openLab() {
    stop();
    const sel = $('labPreset');
    if (!sel.options.length) {
      sel.innerHTML = LAB_PRESETS.map((p, k) => `<option value="${k}">${esc(p.name)}</option>`).join('');
      loadLabPreset(0);
    }
    renderLab();
    openModal('labModal');
  }
  function loadLabPreset(k) {
    const p = LAB_PRESETS[k];
    $('labSetup').value = p.setup;
    $('labMeasure').value = p.measure;
    $('labSizes').value = p.sizes;
    $('labName').value = p.name;
  }
  function labRun() {
    const sizes = $('labSizes').value.split(/[,\s]+/).map(Number).filter(x => Number.isFinite(x) && x >= 0).slice(0, 12);
    if (sizes.length < 2) { toast('Need at least two sizes', 'For example: 10, 20, 40, 80'); return; }
    const setup = $('labSetup').value, measure = $('labMeasure').value;
    const points = [];
    let note = '';
    for (const n of sizes) {
      const src = `const n = ${n};\n${setup}\nstartMeasure();\n${measure}`;
      let it;
      try { it = new JSEngine.Interpreter(src, { countOnly: true, maxSteps: 400000, seed: 1 }); }
      catch (e) { note = e.message; break; }
      const r = it.run();
      if (r.error) { note = r.error; break; }
      if (it.limitHit) { note = `n = ${n} took more than 400,000 steps, so bigger sizes were skipped.`; break; }
      points.push({ n, steps: it.stepCount || 0 });
    }
    if (points.length < 2) { $('labNote').textContent = note || 'Not enough results to plot.'; return; }
    const name = $('labName').value.trim() || 'My code';
    labSeries.push({ name, points, color: LAB_COLORS[labSeries.length % LAB_COLORS.length], big: bigO(points) });
    if (labSeries.length > 6) labSeries.shift();
    $('labNote').textContent = note;
    renderLab();
  }
  // estimate the growth class from how the step count grows with n
  function bigO(pts) {
    const p = pts.filter(x => x.n > 0 && x.steps > 0);
    if (p.length < 2) return '?';
    const a = p[Math.max(0, p.length - 3)], b = p[p.length - 1];
    const k = Math.log(b.steps / a.steps) / Math.log(b.n / a.n);
    const ratio = b.steps / a.steps, growth = b.n / a.n;
    if (ratio < 1.15) return 'O(1)';
    if (growth >= 2 && ratio > Math.pow(1.5, b.n - a.n) * 0.5 && k > 3) return 'O(2ⁿ)';
    if (k < 0.45) return 'O(log n)';
    if (k < 1.6) {
      // n vs n log n: with O(n) the cost per extra item stays flat, with O(n log n) it keeps rising
      const slopes = [];
      for (let q = 1; q < p.length; q++) slopes.push((p[q].steps - p[q - 1].steps) / (p[q].n - p[q - 1].n));
      const rising = slopes.length >= 2 && slopes.every((s, q) => !q || s >= slopes[q - 1] * 0.98) && slopes[slopes.length - 1] / slopes[0] > 1.15;
      if (rising || k >= 1.12) return 'O(n log n)';
      return 'O(n)';
    }
    if (k < 2.5) return 'O(n²)';
    if (k < 3.5) return 'O(n³)';
    return 'O(2ⁿ) or worse';
  }
  function renderLab() {
    const W = 560, H = 240, pl = 56, pr = 16, pt = 14, pb = 34;
    const all = labSeries.flatMap(s => s.points);
    if (!all.length) { $('labChart').innerHTML = '<div class="empty" style="padding:30px">Run a preset (or your own code) to plot how its step count grows.</div>'; $('labTable').innerHTML = ''; return; }
    const maxN = Math.max(...all.map(p => p.n)), maxS = Math.max(...all.map(p => p.steps));
    const x = n => pl + (n / maxN) * (W - pl - pr), y = s => H - pb - (s / maxS) * (H - pt - pb);
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const yy = pt + k * (H - pt - pb) / 4;
      g += `<line class="lab-grid" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="lab-ax" x="${pl - 6}" y="${yy + 4}" text-anchor="end">${Math.round(maxS * (1 - k / 4)).toLocaleString()}</text>`;
    }
    [0, 0.25, 0.5, 0.75, 1].forEach(f => { g += `<text class="lab-ax" x="${x(maxN * f)}" y="${H - pb + 16}" text-anchor="middle">${Math.round(maxN * f)}</text>`; });
    g += `<text class="lab-ax" x="${(W + pl) / 2}" y="${H - 4}" text-anchor="middle">input size n</text>`;
    labSeries.forEach(s => {
      const d = s.points.map((p, k) => `${k ? 'L' : 'M'}${x(p.n).toFixed(1)},${y(p.steps).toFixed(1)}`).join(' ');
      g += `<path class="lab-line" d="${d}" style="stroke:${s.color}"/>` + s.points.map(p => `<circle cx="${x(p.n)}" cy="${y(p.steps)}" r="3.5" style="fill:${s.color}"><title>${esc(s.name)}: n = ${p.n} → ${p.steps.toLocaleString()} steps</title></circle>`).join('');
    });
    $('labChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lab-svg" role="img" aria-label="Steps against input size">${g}</svg>`;
    $('labTable').innerHTML = labSeries.map(s => `<div class="lab-row"><i style="background:${s.color}"></i><b>${esc(s.name)}</b><span class="lab-big">${s.big}</span><small>${s.points.map(p => `n=${p.n}: ${p.steps.toLocaleString()}`).join(' · ')}</small></div>`).join('')
      + '<p class="fn-meta">Steps are engine steps (statements and expressions), so built-in methods such as <code>indexOf</code> or <code>sort</code> count as one step: write the loop yourself to measure it. The Big-O guess comes from how the last points grow.</p>';
  }

  // ------------------------------------------------------------ write it yourself
  function startWriteIt(q) {
    const c = window.JSWriteIt && JSWriteIt.writeItChallenge(q);
    if (!c) { toast('Not available', 'This question has no write-it-yourself version.'); return; }
    S.mock = null;
    renderMockBar();
    loadChallenge(c);
    toast('✍️ Write it yourself', 'Fill in the empty function bodies, then press Check solution. Run ▶ steps through your own code.');
  }

  // ------------------------------------------------------------ mock interview
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startMock(onlyReact) {
    closeInterviewMenu();
    const isReactQ = q => /^r(q|th)-/.test(q.id);
    const pool = onlyReact === true ? IVQ.filter(isReactQ) : IVQ;
    const code = pool.filter(q => !isTheory(q));
    const pick = (lvl, n) => shuffle(code.filter(q => q.level === lvl)).slice(0, n);
    const qs = shuffle(onlyReact === true ? [...pick('Easy', 1), ...pick('Medium', 3), ...pick('Hard', 1)] : [...pick('Easy', 1), ...pick('Medium', 2), ...pick('Hard', 1)]);
    qs.push(shuffle(pool.filter(isTheory))[0]);
    const minutes = onlyReact === true ? 20 : 15;
    S.mock = { qs, i: 0, results: {}, endsAt: Date.now() + minutes * 60 * 1000, started: Date.now(), react: onlyReact === true };
    clearInterval(S.mockTimer);
    S.mockTimer = setInterval(() => { if (S.mock && Date.now() >= S.mock.endsAt) finishMock(true); else renderMockBar(); }, 1000);
    toast(onlyReact === true ? '⚛️ React mock interview started' : '⏱ Mock interview started', qs.length + ' questions, ' + minutes + ' minutes. Predict each answer, then press "Next question".');
    loadInterview(qs[0]);
  }
  function mockNext() {
    if (!S.mock) return;
    const q = S.mock.qs[S.mock.i];
    if (!(q.id in S.mock.results)) S.mock.results[q.id] = false;
    closeModals();
    S.mock.i++;
    if (S.mock.i >= S.mock.qs.length) finishMock(false);
    else loadInterview(S.mock.qs[S.mock.i]);
  }
  function finishMock(timeUp) {
    const m = S.mock;
    if (!m) return;
    clearInterval(S.mockTimer);
    S.mock = null;
    renderMockBar();
    const score = m.qs.filter(q => m.results[q.id]).length;
    const secs = Math.round((Math.min(Date.now(), m.endsAt) - m.started) / 1000);
    const grade = score === 5 ? 'Outstanding: you would ace this round.' : score >= 4 ? 'Strong result.' : score >= 3 ? 'Solid. Review the misses below.' : 'Keep practising: open the misses and step through them.';
    if (score) award('mock:' + m.started, score * 5);
    S.ivOpen = null;
    $('briefTitle').textContent = '⏱ Mock interview result';
    $('lessonBody').innerHTML = `<div class="iv-score"><b>${score} / ${m.qs.length}</b> correct in ${Math.floor(secs / 60)}m ${secs % 60}s${timeUp ? ' (time ran out)' : ''}</div>
      <p>${grade}</p>
      <table class="iv-diff"><thead><tr><th></th><th>Question</th><th>Topic</th></tr></thead><tbody>${m.qs.map(q => `<tr class="${m.results[q.id] ? 'ok' : 'bad'}"><td>${m.results[q.id] ? '✓' : q.id in m.results ? '✗' : '–'}</td><td><a href="#" data-ivopen="${q.id}">${esc(q.title)}</a></td><td>${esc(q.cat)}</td></tr>`).join('')}</tbody></table>
      <p class="tip">💡 Missed questions are a great list to step through with ▶. Open one above.</p>`;
    $('lessonBody').querySelectorAll('[data-ivopen]').forEach(a => a.onclick = e => { e.preventDefault(); closeModals(); loadInterview(IVQ.find(q => q.id === a.dataset.ivopen)); });
    $('tabQuiz').classList.add('hidden');
    $('tabLesson').textContent = 'Result';
    $('briefStart').textContent = 'Close';
    showBriefTab('lesson');
    $('briefModal').classList.remove('hidden');
  }
  function renderMockBar() {
    const bar = $('mockBar');
    const m = S.mock;
    if (!m) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    const left = Math.max(0, Math.round((m.endsAt - Date.now()) / 1000));
    const score = Object.values(m.results).filter(Boolean).length;
    bar.classList.remove('hidden');
    bar.innerHTML = `<span class="mb-title">${m.react ? "⚛️ React mock interview" : "⏱ Mock interview"}</span>
      <span class="mb-dots">${m.qs.map((q, i) => `<i class="${q.id in m.results ? (m.results[q.id] ? 'ok' : 'bad') : i === m.i ? 'cur' : ''}"></i>`).join('')}</span>
      <span>Question ${m.i + 1} / ${m.qs.length}</span>
      <span class="mb-time${left < 60 ? ' low' : ''}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left</span>
      <span>Score ${score}</span>
      <span class="mb-actions"><button class="btn small" id="mbOpen">Open question</button><button class="btn small primary" id="mbNext">${m.i < m.qs.length - 1 ? 'Next ▶' : 'Finish'}</button><button class="btn small" id="mbEnd">End</button></span>`;
    $('mbOpen').onclick = () => (isTheory(m.qs[m.i]) ? openFlashcard(m.qs[m.i]) : openAnswer());
    $('mbNext').onclick = mockNext;
    $('mbEnd').onclick = () => finishMock(false);
  }

  // ------------------------------------------------------------ the dropdown list
  function ivFilter(q, topic) {
    if (topic === '★') return ivStars.has(q.id);
    if (topic === '↻') return ivReview.has(q.id);
    if (topic === '○') return !ivSolved.has(q.id);
    return !topic || q.cat === topic;
  }
  function renderInterviewList() {
    const term = $('ivSearch').value.trim().toLowerCase();
    const topic = $('ivCat').value;
    const shown = IVQ.filter(q => (ivLevel === 'All' || q.level === ivLevel) && ivFilter(q, topic)
      && (!term || (q.title + ' ' + q.cat + ' ' + q.ask + ' ' + (ivNotes[q.id] || '')).toLowerCase().includes(term)));
    const cats = ivCats.filter(c => shown.some(q => q.cat === c));
    $('ivCount').innerHTML = `${shown.length} questions · ${ivStars.size} ★ bookmarked · ${ivReview.size} to review again`;
    $('ivList').innerHTML = cats.length ? cats.map(c => {
      const all = IVQ.filter(q => q.cat === c), done = all.filter(q => ivSolved.has(q.id)).length;
      return `<div class="iv-cat"><div class="iv-cat-title">${esc(c)} <small>${all.length} questions</small></div>${shown.filter(q => q.cat === c).map(q => `
      <button class="iv-item${S.iv === q ? ' current' : ''}${ivSolved.has(q.id) ? ' solved' : ''}" data-iv="${q.id}" role="menuitem">
        <span class="iv-title">${ivSolved.has(q.id) ? '<span class="iv-seen" title="Solved">✓</span>' : ivSeen.has(q.id) ? '<span class="iv-opened" title="Opened">•</span>' : ''}${ivStars.has(q.id) ? '<span class="iv-star" title="Bookmarked">★</span>' : ''}${ivReview.has(q.id) ? '<span class="iv-rev" title="Due for review">↻</span>' : ''}${esc(q.title)}</span>
        <span class="iv-level lv-${q.level.toLowerCase()}">${isTheory(q) ? 'Card · ' : ''}${q.level}</span>
        ${isTheory(q) ? '' : `<span class="iv-ask">${esc(q.ask)}</span>`}
        ${ivNotes[q.id] ? `<span class="iv-ask iv-has-note">📝 ${esc(ivNotes[q.id].slice(0, 80))}</span>` : ''}
      </button>`).join('')}</div>`;
    }).join('') : '<div class="empty" style="padding:16px">No question matches.</div>';
  }

  function openInterviewMenu() {
    const keep = $('ivCat').value;
    const count = f => IVQ.filter(q => ivFilter(q, f)).length;
    $('ivCat').innerHTML = `<option value="">All topics (${IVQ.length})</option>
      <option value="○">Not solved yet (${count('○')})</option><option value="★">★ Bookmarked (${count('★')})</option><option value="↻">↻ Due for review (${count('↻')})</option>
      <optgroup label="Topics">${ivCats.map(c => `<option value="${esc(c)}">${esc(c)} (${IVQ.filter(q => q.cat === c).length})</option>`).join('')}</optgroup>`;
    $('ivCat').value = keep;
    $('ivMenu').classList.remove('hidden');
    $('btnInterview').setAttribute('aria-expanded', 'true');
    renderInterviewList();
    setTimeout(() => $('ivSearch').focus(), 0);
  }
  function closeInterviewMenu() {
    $('ivMenu').classList.add('hidden');
    $('btnInterview').setAttribute('aria-expanded', 'false');
  }

  function openBriefing(tab) {
    const L = LEVELS[S.level];
    const info = LESSONS[L.id];
    if (!info) return;
    stop();
    S.briefed.add(L.id); store.set('briefed', [...S.briefed]);
    $('briefTitle').textContent = `${L.emoji} ${L.title}`;
    $('tabLesson').textContent = 'Lesson';
    S.ivOpen = null;
    $('briefStart').textContent = 'Next: predict, then watch';
    $('lessonBody').innerHTML = info.lesson;
    const q = info.quiz;
    $('tabQuiz').classList.toggle('hidden', !q);
    if (q) {
      $('quizBody').innerHTML = `<p class="quiz-q">🎯 <b>Predict before you watch:</b> ${q.q}</p>
        <div class="quiz-opts">${q.options.map((o, n) => `<button class="quiz-opt" data-opt="${n}">${esc(o)}</button>`).join('')}</div>
        <div id="quizResult" class="quiz-result hidden"></div>`;
    }
    showBriefTab(tab === 'quiz' && q ? 'quiz' : 'lesson');
    $('briefModal').classList.remove('hidden');
  }
  function showBriefTab(t) {
    $('tabLesson').classList.toggle('active', t === 'lesson');
    $('tabQuiz').classList.toggle('active', t === 'quiz');
    $('lessonBody').classList.toggle('hidden', t !== 'lesson');
    $('quizBody').classList.toggle('hidden', t !== 'quiz');
  }
  function answerQuiz(n) {
    const L = LEVELS[S.level];
    const q = LESSONS[L.id].quiz;
    const right = n === q.answer;
    document.querySelectorAll('.quiz-opt').forEach(b => {
      const k = +b.dataset.opt;
      b.disabled = true;
      b.classList.toggle('right', k === q.answer);
      b.classList.toggle('wrong', k === n && !right);
    });
    const res = $('quizResult');
    res.classList.remove('hidden');
    res.innerHTML = `${right ? '✅ <b>Correct!</b>' : '❌ <b>Not quite.</b>'} ${q.why}<br><button class="btn primary" id="quizWatch">▶ Watch it run step by step</button>`;
    document.dispatchEvent(new CustomEvent('jsl:quiz', { detail: { id: L.id, right } }));
    if (right && !S.awarded.has('quizmiss:' + L.id)) award('quiz:' + L.id, 10);
    if (!right) { S.awarded.add('quizmiss:' + L.id); store.set('awarded', [...S.awarded]); }
    $('quizWatch').onclick = () => { closeModals(); go(0); play(); };
  }

  function renderLevels() {
    const card = i => {
      const L = LEVELS[i];
      return `<button class="level${i === S.level && S.mode === 'level' ? ' current' : ''}" data-level="${i}">
        ${S.completed.has(L.id) ? '<span class="done-star">✓ done</span>' : ''}
        <span class="num">${L.id === 'sandbox' ? 'SANDBOX' : 'LESSON ' + String(i + 1).padStart(2, '0')}</span>
        <span class="em">${L.emoji}</span>
        <div class="t">${esc(L.title)}</div>
        <div class="cpt">${esc(L.concept)}</div>
        <div class="goal">${esc(L.goal)}</div>
        <div class="diff">${L.stars ? ['', 'Beginner', 'Intermediate', 'Advanced'][L.stars] : 'Free practice'}</div>
      </button>`;
    };
    const used = new Set();
    let html = '';
    WORLDS.forEach(w => {
      const idxs = w.ids.map(id => LEVELS.findIndex(l => l.id === id)).filter(i => i >= 0);
      idxs.forEach(i => used.add(i));
      const done = idxs.filter(i => S.completed.has(LEVELS[i].id)).length;
      html += `<h3 class="world">${w.name} <small>${idxs.length} lessons</small></h3><div class="level-grid">${idxs.map(card).join('')}</div>`;
    });
    const rest = LEVELS.map((_, i) => i).filter(i => !used.has(i));
    if (rest.length) html += `<h3 class="world">✨ More</h3><div class="level-grid">${rest.map(card).join('')}</div>`;
    $('levelGrid').innerHTML = html;
  }

  // ------------------------------------------------------------ challenges: write the code yourself
  function renderChallenges() {
    $('chalGrid').innerHTML = CHALLENGES.map((c, i) => `
      <button class="level chal${S.solved.has(c.id) ? ' solved' : ''}" data-chal="${i}">
        ${S.solved.has(c.id) ? '<span class="done-star">✓ solved</span>' : ''}
        <span class="num">CHALLENGE ${String(i + 1).padStart(2, '0')}</span>
        <span class="em">${c.emoji}</span>
        <div class="t">${esc(c.title)}</div>
        <div class="goal">${c.task.replace(/<[^>]+>/g, '').slice(0, 90)}…</div>
        <div class="diff">${['', 'Beginner', 'Easy', 'Intermediate', 'Advanced'][c.difficulty]} · +${30 + 10 * c.difficulty} XP</div>
      </button>`).join('');
    $('chalProgress').textContent = `${S.solved.size} of ${CHALLENGES.length} solved`;
  }

  function loadChallenge(i) {
    const c = typeof i === 'object' ? i : CHALLENGES[i];
    closeModals();
    S.mode = 'challenge'; S.chal = c; S.hints = 0;
    document.body.classList.add('challenge-mode');
    S.bps.clear();
    setCode(S.drafts[c.id] || c.starter);
    $('levelEmoji').textContent = c.emoji;
    $('levelTitle').textContent = c.fromInterview ? `Write it yourself · ${c.title}` : `Challenge ${i + 1} · ${c.title}`;
    $('levelGoal').textContent = '— write the code, then press Check solution';
    $('btnLesson').classList.add('hidden');
    $('taskText').innerHTML = c.task + (c.concept && LESSONS[c.concept] ? ` <a href="#" id="taskLesson" class="tlink">📖 Need a refresher?</a>` : '');
    $('taskResults').innerHTML = '';
    $('taskHints').innerHTML = '';
    const tl = $('taskLesson');
    if (tl) tl.onclick = e => { e.preventDefault(); const idx = LEVELS.findIndex(l => l.id === c.concept); if (idx >= 0) { const keep = S.level; S.level = idx; openBriefing('lesson'); S.level = keep; } };
    S.trace = []; S.src = getCode(); S.tokens = tokenClasses(S.src);
    setMode('edit');
    $('narration').innerHTML = 'Write your solution in the editor. <b>Check solution</b> runs the tests; <b>Run ▶</b> steps through your own code.';
    $('kindTag').textContent = 'CHALLENGE';
    $('kindTag').style.background = '#ffd84d';
  }

  function runQuiet(code) {
    const r = new window.JSEngine.Interpreter(code).run();
    if (r.error) return { error: r.error, lines: [] };
    const last = r.trace[r.trace.length - 1];
    return { lines: last.console.map(l => l.text), stopped: last.kind === 'error' ? last.msg.replace(/<[^>]+>/g, '') : null };
  }

  function checkChallenge() {
    const c = S.chal;
    if (!c) return;
    saveDraft();
    const code = getCode();
    const results = [];
    (c.mustUse || []).forEach(m => results.push({ ok: m.re.test(code), label: m.msg }));
    (c.mustNotUse || []).forEach(m => results.push({ ok: !m.re.test(code), label: m.msg }));
    const base = runQuiet(code);
    if (base.error) results.push({ ok: false, label: 'Your code must run', detail: base.error });
    else {
      if (base.stopped) results.push({ ok: false, label: 'Your code stopped with an error', detail: base.stopped });
      if (c.expectOutput) {
        const got = base.lines.join('\n'), want = c.expectOutput.join('\n');
        results.push({ ok: got === want, label: 'Console output matches', detail: got === want ? null : `Expected:\n${want}\n\nGot:\n${got || '(nothing)'}` });
      }
      (c.tests || []).forEach(t => {
        const r = runQuiet(code + '\n;' + t.run);
        const got = r.error ? r.error : r.lines.slice(base.lines.length).join('\n');
        const ok = !r.error && got === t.expect;
        results.push({ ok, label: `<code>${esc(t.run)}</code>`, raw: true, detail: ok ? null : `Expected: ${t.expect}\nGot: ${got || '(nothing)'}${r.stopped ? '\n' + r.stopped : ''}` });
      });
    }
    const pass = results.every(r => r.ok);
    const tips = pass ? [] : mistakeTips(code, base, c.expectOutput);
    $('taskResults').innerHTML = results.map(r => `<div class="tres ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✅' : '❌'} ${r.raw ? r.label : esc(r.label)}${r.detail ? `<pre>${esc(r.detail)}</pre>` : ''}</div>`).join('')
      + (tips.length ? `<div class="tres tips"><b>🔎 Common mistakes to check</b><ul>${tips.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '')
      + (pass ? '<div class="tres win">✅ <b>All checks pass.</b> Press Run ▶ to watch your code step by step.</div>' : '');
    if (pass) document.dispatchEvent(new CustomEvent('jsl:solved', { detail: c.id }));
    if (pass) {
      if (!S.solved.has(c.id)) { S.solved.add(c.id); store.set('solved', [...S.solved]); } // remembered only so the course knows the step is finished
      if (c.fromInterview) ivMarkSolved(c.fromInterview, true);
      award('chal:' + c.id, 30 + 10 * c.difficulty);
      beep('done');
    } else beep('error');
  }

  // spot typical bugs in a failing solution (pattern checks, not a full analysis)
  function mistakeTips(code, base, want) {
    const tips = [];
    const add = t => { if (!tips.includes(t)) tips.push(t); };
    const stripped = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const err = String(base.error || base.stopped || '');
    if (/your code here/.test(code)) add('Some function bodies are still empty (<code>// your code here</code>).');
    if (/forEach\(\s*async/.test(stripped)) add('<code>forEach</code> does not wait for <code>async</code> callbacks. Use <code>for...of</code> with <code>await</code>, or <code>Promise.all(arr.map(...))</code>.');
    const re = /\.(map|filter|find|findIndex|some|every|flatMap|reduce)\(\s*(?:async\s*)?(?:\([^()]*\)|\w+)\s*=>\s*\{/g;
    let m;
    while ((m = re.exec(stripped))) {
      let depth = 0, k = m.index + m[0].length - 1, body = '';
      for (; k < stripped.length; k++) { const ch = stripped[k]; if (ch === '{') depth++; else if (ch === '}' && --depth === 0) break; body += ch; }
      if (!/\breturn\b/.test(body)) { add(`The <code>.${m[1]}()</code> callback uses <code>{ }</code> but has no <code>return</code>, so it returns <code>undefined</code>. Add <code>return</code>, or drop the braces.`); break; }
    }
    if (/for\s*\(\s*var\b/.test(stripped) && /setTimeout|then\(|=>/.test(stripped)) add('<code>var</code> in a loop is shared by every callback. Use <code>let</code> so each round gets its own variable.');
    if (/for\s*\([^;]*;[^;]*<=\s*[\w.]+\.length/.test(stripped)) add('Off-by-one: <code>i &lt;= arr.length</code> goes one past the last index. Use <code>i &lt; arr.length</code>.');
    if (/\.sort\(\s*\)/.test(stripped)) add('<code>.sort()</code> without a compare function sorts as <b>strings</b> (10 comes before 9). Use <code>.sort((a, b) =&gt; a - b)</code> for numbers.');
    if (/[!=]==?\s*(\[\s*\]|\{\s*\})/.test(stripped)) add('<code>===</code> compares objects and arrays by <b>reference</b>, so <code>x === []</code> is always false. Compare lengths or contents.');
    if (/\w+\s*:\s*(?:\([^)]*\)|\w+)\s*=>[^\n]*\bthis\./.test(stripped)) add('An arrow function used as an object method has no own <code>this</code>. Use a normal method: <code>name() { ... }</code>.');
    if (/Maximum call stack/i.test(err)) add('Infinite recursion: check that your recursive function has a <b>base case</b> that stops it, and that each call gets closer to it.');
    else if (/step limit|steps/i.test(err) && base.stopped) add('The program never finished: check that every loop changes the value its condition tests (or raise the step limit in Reference).');
    if (/is not a function/.test(err)) add('"…is not a function": check the spelling, that the function returns a function where one is expected, and that <code>this</code> is what you think it is.');
    if (/Cannot read properties of (undefined|null)/.test(err)) add('Reading a property of <code>undefined</code>/<code>null</code>: a function probably forgot to <code>return</code>, or a lookup found nothing. Guard it, or check the return values.');
    if (/before initialization/.test(err)) add('Temporal Dead Zone: a <code>let</code>/<code>const</code> is used before its line runs. Move the declaration up.');
    if (want && base.lines) {
      const extraUndef = base.lines.some((l, i) => /\bundefined\b/.test(l) && !/\bundefined\b/.test(want[i] || ''));
      if (extraUndef) add('Your output shows <code>undefined</code> where a value is expected: a function is probably missing a <code>return</code>.');
      const nanOut = base.lines.some((l, i) => /\bNaN\b/.test(l) && !/\bNaN\b/.test(want[i] || ''));
      if (nanOut) add('<code>NaN</code> appears: a number was combined with <code>undefined</code> or a non-numeric string. Check the starting value of your counters and sums.');
      if (want.length && base.lines.length && base.lines.length !== want.length) add(`Your program printed ${base.lines.length} line${base.lines.length === 1 ? '' : 's'}, but ${want.length} ${want.length === 1 ? 'is' : 'are'} expected. Check for missing or extra <code>console.log</code> calls, or callbacks that run too often (or never).`);
    }
    if (/new Promise\(/.test(stripped) && !/resolve\s*\(|resolve\)|reject\s*\(|\bres\(|\br\(/.test(stripped)) add('A <code>new Promise</code> never calls <code>resolve</code>, so anything awaiting it waits forever.');
    return tips.slice(0, 4);
  }

  function showHint() {
    const c = S.chal;
    if (!c) return;
    if (S.hints < c.hints.length) S.hints++;
    $('taskHints').innerHTML = c.hints.slice(0, S.hints).map((h, n) => `<div class="hintbox">💡 Hint ${n + 1}: ${esc(h)}</div>`).join('') + (S.hints >= c.hints.length ? '<div class="hintbox muted">No more hints. You can peek at the solution.</div>' : '');
  }

  function showSolution() {
    const c = S.chal;
    if (!c) return;
    $('taskHints').innerHTML = `<div class="hintbox">👀 <b>One possible solution</b> (try to understand <i>why</i> it works, then write it yourself!):<pre>${esc(c.solution)}</pre><button class="btn" id="useSolution">Put it in the editor</button></div>`;
    $('useSolution').onclick = () => { setCode(c.solution); S.dirty = true; saveDraft(); setMode('edit'); };
  }

  // ------------------------------------------------------------ explain a clicked line
  function explainLine(ln) {
    const box = $('explain');
    const html = window.JSExplain ? window.JSExplain.explainLine(S.src, ln) : null;
    if (!html) { box.classList.add('hidden'); return; }
    const steps = S.trace.reduce((n, s, j) => n + (s.line === ln && (j === 0 || S.trace[j - 1].line !== ln) ? 1 : 0), 0);
    box.innerHTML = `<button class="close sm" id="explainClose">✕</button><b>💡 Line ${ln}</b> ${html}<div class="ex-meta">${steps ? `▶ This line runs <b>${steps}</b> time${steps > 1 ? 's' : ''} in this program — click it again to jump to the next time.` : 'This line never runs as its own step (it may be part of a bigger statement).'}</div>`;
    box.classList.remove('hidden');
    $('explainClose').onclick = () => box.classList.add('hidden');
  }

  function jumpToLine(ln) {
    if (!S.trace.length) return;
    const n = S.trace.length;
    for (let k = 1; k <= n; k++) {
      const j = (S.i + k) % n;
      if (S.trace[j].line === ln && (j === 0 || S.trace[j - 1].line !== ln)) { stop(); go(j, true); return; }
    }
  }

  // ------------------------------------------------------------ badges, toasts, modals
  function renderShelf() {
    const total = LEVELS.filter(l => l.id !== 'sandbox').length;
    $('stats').innerHTML = [[S.xp + ' XP', rankOf(S.xp)[1]], [`${S.completed.size} / ${total}`, 'lessons completed'], [`${S.solved.size} / ${CHALLENGES.length}`, 'challenges solved'], [`${S.earned.size} / ${Object.keys(BADGES).length}`, 'achievements']]
      .map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
    $('badgeList').innerHTML = Object.keys(BADGES).map(id => {
      const [e, name, desc] = BADGES[id];
      return `<div class="badge-item${S.earned.has(id) ? ' on' : ''}"><span class="e">${e}</span><div><b>${esc(name)}</b><small>${esc(desc)}</small></div></div>`;
    }).join('');
  }

  function toast(title, sub) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : '');
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }

  function openModal(id) {
    stop();
    if (id === 'levelsModal') renderLevels();
    if (id === 'chalModal') renderChallenges();
    $(id).classList.remove('hidden');
  }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store.set('theme', t);
    $('btnTheme').textContent = t === 'light' ? '☾' : '☀';
  }
  // ------------------------------------------------------------ first-visit tour
  const TOUR = CFG.TOUR;
  let tourStep = -1, tourDone = null;
  function startTour(onDone) {
    stop();
    closeModals();
    closeViewMenu();
    closeInterviewMenu();
    tourDone = onDone || null;
    $('tour').classList.remove('hidden');
    showTourStep(0);
  }
  function endTour() {
    $('tour').classList.add('hidden');
    tourStep = -1;
    store.set('toured', true);
    const cb = tourDone;
    tourDone = null;
    if (cb) cb();
  }
  function showTourStep(i) {
    const steps = TOUR.filter(s => { const el = document.querySelector(s.sel); return el && el.getClientRects().length; });
    if (i < 0 || i >= steps.length) { endTour(); return; }
    tourStep = i;
    const s = steps[i];
    const el = document.querySelector(s.sel);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect(), pad = 6;
    const spot = $('tourSpot');
    Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    $('tourCard').innerHTML = `<div class="tour-count">${i + 1} / ${steps.length}</div><h3>${s.title}</h3><p>${s.text}</p>
      <div class="tour-dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('')}</div>
      <div class="tour-btns"><button class="btn small" id="tourSkip">Skip tour</button><span>${i ? '<button class="btn small" id="tourBack">Back</button>' : ''}<button class="btn small primary" id="tourNext">${i === steps.length - 1 ? 'Start learning' : 'Next'}</button></span></div>`;
    // place the card next to the highlighted area, wherever there is room
    const card = $('tourCard');
    const W = window.innerWidth, H = window.innerHeight, cw = Math.min(340, W - 32);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight;
    let left, top;
    if (r.bottom + 14 + ch < H) { top = r.bottom + 14; left = r.left; }
    else if (r.top - 14 - ch > 0) { top = r.top - 14 - ch; left = r.left; }
    else if (r.right + 14 + cw < W) { left = r.right + 14; top = r.top; }
    else if (r.left - 14 - cw > 0) { left = r.left - 14 - cw; top = r.top; }
    else { left = (W - cw) / 2; top = H - ch - 16; }
    card.style.left = Math.max(16, Math.min(left, W - cw - 16)) + 'px';
    card.style.top = Math.max(16, Math.min(top, H - ch - 16)) + 'px';
    $('tourSkip').onclick = endTour;
    $('tourNext').onclick = () => showTourStep(i + 1);
    if ($('tourBack')) $('tourBack').onclick = () => showTourStep(i - 1);
    $('tourNext').focus();
  }

  // ------------------------------------------------------------ the View menu: every display option in one place
  const VIEW_OPTS = CFG.VIEW_OPTS;
  const VIEW_PRESETS = CFG.VIEW_PRESETS;
  // options a preset does not mention (such as "Inside React") are left alone by it
  const currentPreset = () => VIEW_PRESETS.find(p => VIEW_OPTS.every(o => p.set[o.key] === undefined || !!S[o.key] === p.set[o.key]));
  function applyView() {
    setToggles();
    // stepping inside React needs a new recording
    if (S.trace.length && S.builtDeep !== !!S.deepReact) { build(); return; }
    if (S.trace.length) render(S.i, false); else drawArrows();
  }
  function setViewOpt(key, value) {
    S[key] = value;
    store.set(key, value);
  }
  function toggleView(key) {
    setViewOpt(key, !S[key]);
    applyView();
    const o = VIEW_OPTS.find(x => x.key === key);
    toast(`${o.label}: ${S[key] ? 'on' : 'off'}`, `View: ${(currentPreset() || { label: 'Custom' }).label}`);
  }
  function usePreset(id) {
    const p = VIEW_PRESETS.find(x => x.id === id);
    Object.entries(p.set).forEach(([k, v]) => setViewOpt(k, v));
    applyView();
  }
  function renderViewMenu() {
    const cur = currentPreset();
    $('viewName').textContent = cur ? cur.label : 'Custom';
    $('viewPresets').innerHTML = VIEW_PRESETS.map((p, i) => `<button class="${cur === p ? 'on' : ''}" data-preset="${p.id}" title="${esc(p.desc)} (${i + 1})"><b>${esc(p.label)}</b><small>${esc(p.desc)}</small></button>`).join('');
    $('viewOpts').innerHTML = VIEW_OPTS.map(o => `<label class="view-opt"><input type="checkbox" data-view="${o.key}"${S[o.key] ? ' checked' : ''}><span><b>${esc(o.label)}</b><small>${esc(o.desc)}</small></span><kbd>${o.kbd}</kbd></label>`).join('');
  }
  function openViewMenu() {
    renderViewMenu();
    $('viewMenu').classList.remove('hidden');
    $('btnView').setAttribute('aria-expanded', 'true');
    setTimeout(() => { const b = $('viewPresets').querySelector('.on') || $('viewPresets').querySelector('button'); if (b) b.focus(); }, 0);
  }
  function closeViewMenu() {
    $('viewMenu').classList.add('hidden');
    $('btnView').setAttribute('aria-expanded', 'false');
  }

  function setToggles() {
    $('btnSound').textContent = S.sound ? '🔊' : '🔇';
    renderViewMenu();
  }

  // ------------------------------------------------------------ events
  $('btnPlay').onclick = toggle;
  $('btnNext').onclick = () => { stop(); if (S.dirty || !S.trace.length) { build(); return; } go(S.i + 1); };
  $('btnBack').onclick = () => { stop(); go(S.i - 1); };
  $('btnFirst').onclick = () => { stop(); go(0); };
  $('btnLast').onclick = () => { stop(); go(S.trace.length - 1); };
  $('btnOver').onclick = stepOver;
  $('btnOut').onclick = stepOut;
  $('btnBp').onclick = nextBreakpoint;
  $('scrub').oninput = e => { stop(); go(+e.target.value); };
  $('speed').oninput = () => { if (S.playing) play(); };
  showReactStop();
  $('btnReactStop').onclick = () => {
    S.reactStop = REACT_STOPS[(REACT_STOPS.indexOf(S.reactStop) + 1) % REACT_STOPS.length];
    store.set('reactStop', S.reactStop);
    showReactStop();
  };
  $('tabRun').onclick = () => build();
  $('tabEdit').onclick = () => setMode('edit');
  codeView.ondblclick = () => setMode('edit');
  codeView.onclick = e => {
    const ln = e.target.closest('.ln');
    if (!ln) return;
    const n = +ln.dataset.ln;
    if (e.target.closest('.g')) {
      if (S.bps.has(n)) S.bps.delete(n); else S.bps.add(n);
      ln.classList.toggle('bp', S.bps.has(n));
      return;
    }
    jumpToLine(n);
    explainLine(n);
  };
  editor.oninput = () => { S.dirty = true; S.noSave = false; };
  editor.onkeydown = e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart;
      editor.setRangeText('  ', s, editor.selectionEnd, 'end');
      S.dirty = true;
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (S.mode === 'challenge' && e.shiftKey) checkChallenge(); else build(); }
  };
  $('btnLevels').onclick = () => openModal('levelsModal');
  $('btnChallenges').onclick = () => openModal('chalModal');
  $('btnHelp').onclick = () => openModal('helpModal');
  $('btnProgress').onclick = () => { renderShelf(); openModal('progressModal'); };
  $('stepLimit').value = String(S.maxSteps);
  $('stepLimit').onchange = e => { S.maxSteps = +e.target.value; store.set('maxSteps', S.maxSteps); S.dirty = true; toast('Step limit changed', `Up to ${S.maxSteps.toLocaleString()} steps per run. Press Run ▶ to apply.`); };
  $('xpChip').onclick = () => { renderShelf(); openModal('progressModal'); };
  // share: the code travels inside the link (base64url), and opens in the sandbox
  $('btnShare').onclick = async () => {
    const b64 = btoa(unescape(encodeURIComponent(getCode()))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.href.split(/[?#]/)[0] + '?code=' + b64;
    try { await navigator.clipboard.writeText(url); toast('Link copied', 'Anyone who opens it sees this code in the sandbox.'); }
    catch (e) { window.prompt('Copy this link:', url); }
  };
  $('btnInterview').onclick = e => { e.stopPropagation(); $('ivMenu').classList.contains('hidden') ? openInterviewMenu() : closeInterviewMenu(); };
  $('ivSearch').oninput = renderInterviewList;
  $('ivCat').onchange = () => { renderInterviewList(); $('ivList').scrollTop = 0; };
  $('ivLevels').onclick = e => {
    const b = e.target.closest('[data-lv]');
    if (!b) return;
    ivLevel = b.dataset.lv;
    $('ivLevels').querySelectorAll('[data-lv]').forEach(x => x.classList.toggle('on', x === b));
    renderInterviewList();
  };
  $('ivMock').onclick = () => startMock(false);
  $('ivMockReact').onclick = () => startMock(true);
  $('btnExport').onclick = exportProgress;
  $('importFile').onchange = e => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; };
  renderDueBadge();
  $('ivRandom').onclick = () => { const pool = IVQ.filter(q => !ivSolved.has(q.id) && !ivSeen.has(q.id)).length ? IVQ.filter(q => !ivSolved.has(q.id) && !ivSeen.has(q.id)) : IVQ.filter(q => !ivSolved.has(q.id)); const list = pool.length ? pool : IVQ; loadInterview(list[Math.floor(Math.random() * list.length)]); };
  $('ivList').onclick = e => { const b = e.target.closest('[data-iv]'); if (b) loadInterview(IVQ.find(q => q.id === b.dataset.iv)); };
  $('ivMenu').addEventListener('click', e => e.stopPropagation());
  $('ivMenu').addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeInterviewMenu(); $('btnInterview').focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    const items = [...$('ivList').querySelectorAll('.iv-item')];
    if (!items.length) return;
    if (e.key === 'Enter' && document.activeElement === $('ivSearch')) { e.preventDefault(); items[0].click(); return; }
    if (e.key === 'Enter') return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : i <= 0 ? -1 : i - 1;
    (next < 0 ? $('ivSearch') : items[next]).focus();
  });
  document.addEventListener('click', () => closeInterviewMenu());
  $('btnLesson').onclick = () => (S.mode === 'interview' ? openAnswer() : openBriefing('lesson'));
  $('tabLesson').onclick = () => showBriefTab('lesson');
  $('tabQuiz').onclick = () => showBriefTab('quiz');
  $('briefStart').onclick = () => {
    if (S.mock && S.ivOpen) { mockNext(); return; }
    if (S.ivOpen || $('tabLesson').textContent === 'Result') { const q = S.ivOpen; S.ivOpen = null; closeModals(); if (q && !isTheory(q)) { go(0); play(); } return; }
    if (S.mode !== 'interview' && LESSONS[LEVELS[S.level].id] && LESSONS[LEVELS[S.level].id].quiz && $('quizBody').classList.contains('hidden')) showBriefTab('quiz');
    else { closeModals(); go(0); play(); }
  };
  $('quizBody').onclick = e => { const b = e.target.closest('.quiz-opt'); if (b && !b.disabled) answerQuiz(+b.dataset.opt); };
  $('btnCheck').onclick = checkChallenge;
  $('btnHint').onclick = showHint;
  $('btnSolution').onclick = showSolution;
  $('btnReset').onclick = () => { if (S.chal && confirm('Reset this challenge to the starter code?')) { setCode(S.chal.starter); S.dirty = true; saveDraft(); setMode('edit'); } };
  $('btnTheme').onclick = () => setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  $('btnSound').onclick = () => { S.sound = !S.sound; store.set('sound', S.sound); setToggles(); beep('done'); };
  $('btnView').onclick = e => { e.stopPropagation(); $('viewMenu').classList.contains('hidden') ? openViewMenu() : closeViewMenu(); };
  $('viewMenu').addEventListener('click', e => {
    e.stopPropagation();
    const p = e.target.closest('[data-preset]');
    if (p) usePreset(p.dataset.preset);
  });
  $('viewMenu').addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.view;
    if (k) { setViewOpt(k, e.target.checked); applyView(); }
  });
  $('viewMenu').addEventListener('keydown', e => { if (e.key === 'Escape') { closeViewMenu(); $('btnView').focus(); } });
  document.addEventListener('click', () => closeViewMenu());

  $('timeline').addEventListener('click', e => { if (S.trace.length) { stop(); go(timelineStepAt(e)); } });
  $('panelStrip').addEventListener('click', e => { const b = e.target.closest('[data-pin]'); if (!b) return; const p = b.dataset.pin || null; S.pinPanel = p && p !== S.pinPanel ? p : null; if (S.trace.length) render(S.i, false); });
  $('timeline').addEventListener('mousemove', e => {
    if (!S.trace.length) return;
    const j = timelineStepAt(e), s = S.trace[j], k = KINDS[s.kind] || ['STEP'];
    const ph = s.react ? ' · React: ' + PHASE[phaseOf(s)][0] : '';
    $('timeline').title = `Step ${j + 1}: ${k[0]}${s.line ? ' · line ' + s.line : ''} · ${s.time}ms${ph} (click to jump)`;
  });
  window.addEventListener('resize', () => requestAnimationFrame(drawTimeline));

  $('btnCompare').onclick = openCompare;
  $('btnPair').onclick = openPair;
  $('btnLab').onclick = openLab;
  $('labPreset').onchange = e => loadLabPreset(+e.target.value);
  $('labRun').onclick = labRun;
  $('labClear').onclick = () => { labSeries.length = 0; $('labNote').textContent = ''; renderLab(); };
  $('labFromCode').onclick = () => {
    $('labSetup').value = getCode() + '\n// call your function on input of size n below';
    $('labMeasure').value = '// e.g. mySort(Array.from({ length: n }, (_, i) => n - i));';
    $('labName').value = 'My code';
    $('labSizes').value = '5, 10, 20, 40';
  };
  $('cmpRun').onclick = runCompare;
  $('cmpReset').onclick = () => { $('cmpA').value = getCode(); $('cmpB').value = getCode(); $('cmpOut').innerHTML = ''; };
  $('btnRecord').onclick = toggleRecording;
  $('btnSteps').onclick = exportSteps;
  $('btnKeys').onclick = () => openModal('keysModal');
  $('btnTour').onclick = () => startTour();
  window.addEventListener('resize', () => { if (tourStep >= 0) showTourStep(tourStep); });

  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = closeModals; });
  document.querySelectorAll('.modal').forEach(m => { m.onclick = e => { if (e.target === m) closeModals(); }; });
  $('levelGrid').onclick = e => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    closeModals();
    loadLevel(+b.dataset.level, { brief: true });
  };
  $('chalGrid').onclick = e => {
    const b = e.target.closest('[data-chal]');
    if (!b) return;
    closeModals();
    loadChallenge(+b.dataset.chal);
  };
  ['stack', 'heap'].forEach(id => $(id).addEventListener('scroll', () => requestAnimationFrame(drawArrows)));
  ['stack', 'heap', 'console', 'codeView', 'queue', 'microQueue', 'webapis'].forEach(id => $(id).addEventListener('scroll', clearEngineFlow, { passive: true }));
  window.addEventListener('resize', clearEngineFlow);
  window.addEventListener('resize', () => requestAnimationFrame(drawArrows));

  document.addEventListener('keydown', e => {
    if (tourStep >= 0) {
      if (e.key === 'Escape') { e.preventDefault(); endTour(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); showTourStep(tourStep + 1); }
      else if (e.key === 'ArrowLeft' && tourStep > 0) { e.preventDefault(); showTourStep(tourStep - 1); }
      return;
    }
    if (e.key === 'Escape') { closeModals(); return; }
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || document.querySelector('.modal:not(.hidden)')) return;
    const keys = { ArrowRight: () => $('btnNext').click(), ArrowLeft: () => $('btnBack').click(), ' ': toggle, Home: () => $('btnFirst').click(), End: () => $('btnLast').click(), ArrowDown: stepOver, ArrowUp: stepOut, b: nextBreakpoint, '?': () => openModal('keysModal'), v: () => toggleView('inline'), f: () => toggleView('flow'), a: () => toggleView('arrows'), g: () => toggleView('graph'), c: () => toggleView('gcView'), n: () => toggleView('internals'), x: () => toggleView('evaltree'), r: () => toggleView('arrayView'), t: () => toggleView('callTree'), k: () => toggleView('deepReact'), o: () => toggleView('onePanel'), 1: () => usePreset('minimal'), 2: () => usePreset('beginner'), 3: () => usePreset('standard'), 4: () => usePreset('full'), i: () => $('btnInterview').click(), e: () => $('tabEdit').click() };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });

  // highlight every place a heap object is referenced
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-ref]');
    if (!el) return;
    document.querySelectorAll(`[data-ref="${el.dataset.ref}"]`).forEach(x => x.classList.add('hlref'));
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-ref]');
    if (!el) return;
    document.querySelectorAll('.hlref').forEach(x => x.classList.remove('hlref'));
  });

  // ------------------------------------------------------------ install as an app (works offline when served over http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
  }
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    $('btnInstall').classList.remove('hidden');
  });
  $('btnInstall').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    $('btnInstall').classList.add('hidden');
    if (choice.outcome === 'accepted') toast('📲 Installed', 'JS Engine Lab now opens in its own window and works offline.');
  };
  window.addEventListener('appinstalled', () => $('btnInstall').classList.add('hidden'));

  // ------------------------------------------------------------ start
  // optional link parameters: ?level=5&step=20 (level is 1-based) or ?challenge=3
  setTheme(store.get('theme', 'dark'));
  setToggles();
  renderXP();
  renderShelf();
  const params = new URLSearchParams(location.search);
  const qLevel = parseInt(params.get('level'), 10);
  const qChal = parseInt(params.get('challenge'), 10);
  if (qLevel >= 1 && qLevel <= LEVELS.length) S.level = qLevel - 1;
  const shared = params.get('code');
  const qIv = params.get('interview') && IVQ.find(q => q.id === params.get('interview'));
  if (qIv) { if (isTheory(qIv)) loadLevel(S.level); loadInterview(qIv); }
  else if (shared) {
    const sb = LEVELS.findIndex(l => l.id === 'sandbox');
    try {
      const text = decodeURIComponent(escape(atob(shared.replace(/-/g, '+').replace(/_/g, '/'))));
      S.noSave = true;
      loadLevel(sb);
      setCode(text);
      build();
      toast('Shared code loaded', 'It opened in the sandbox. Your own saved sandbox code is untouched until you edit.');
    } catch (e) { toast('Could not read the shared link', 'The code in the link is damaged.'); loadLevel(S.level); }
  } else if (qChal >= 1 && qChal <= CHALLENGES.length) loadChallenge(qChal - 1);
  else {
    const qStep = parseInt(params.get('step'), 10);
    loadLevel(S.level).then(() => { if (qStep > 1) { go(qStep - 2, true); go(qStep - 1); } else if (qStep > 0) go(0); }); // waits for real network data, if any
  }
  if (params.get('interview') === 'list') setTimeout(() => { closeModals(); openInterviewMenu(); }, 300);
  if (params.has('arrows')) { S.arrows = true; setToggles(); drawArrows(); }
  if (params.get('theme') === 'light' || params.get('theme') === 'dark') setTheme(params.get('theme'));
  if (params.has('lesson') && S.mode === 'level') openBriefing(params.get('lesson') === 'quiz' ? 'quiz' : 'lesson');
  if (!params.has('level') && !params.has('challenge') && !params.has('interview') && !store.get('seen', false)) { store.set('seen', true); setTimeout(() => (window.ReactConcepts ? window.ReactConcepts.showList() : startTour(() => openModal('levelsModal'))), 400); }
  if (window.ReactConcepts) window.ReactConcepts.resume();
  if (window.ReactPractice) window.ReactPractice.resume();
  if (params.has('tour')) setTimeout(() => startTour(), 400);
})();
