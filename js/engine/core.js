/*
 * JS Engine Quest — engine core: data types, the Interpreter class, recording snapshots and value helpers.
 *
 * It parses code with Acorn, runs it with its own small JavaScript engine,
 * and records a "snapshot" of the whole engine state (call stack, memory,
 * heap, Web APIs, callback queue, console) at every interesting moment.
 * The UI then plays those snapshots forwards and backwards.
 */
(function (root) {
  'use strict';

  const MAX_STEPS = 5000;
  const MAX_DEPTH = 40;
  const UNSUPPORTED = new Set([]);
  const CONSTRUCT = { construct: true }; // passed as `self` when a built-in is called with `new`
  const UNINIT = { uninitThis: true };   // `this` inside a derived class constructor before super()

  // ---------- small helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const code = s => '<code>' + esc(s) + '</code>';
  const trunc = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const isAnonFn = n => n && (n.type === 'ArrowFunctionExpression' || (n.type === 'FunctionExpression' && !n.id));
  const isIndex = k => typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k);
  const R = (start, end, line) => ({ start, end, loc: { start: { line } } });

  function patternNames(p, out = []) {
    if (!p) return out;
    switch (p.type) {
      case 'Identifier': out.push(p.name); break;
      case 'AssignmentPattern': patternNames(p.left, out); break;
      case 'RestElement': patternNames(p.argument, out); break;
      case 'ArrayPattern': p.elements.forEach(e => patternNames(e, out)); break;
      case 'ObjectPattern': p.properties.forEach(pr => patternNames(pr.type === 'RestElement' ? pr : pr.value, out)); break;
    }
    return out;
  }

  // ---------- runtime data ----------
  // ---------- change tracking ----------
  // Every write to an object's properties, array items or Map/Set contents puts it in DIRTY.
  // At each snapshot only dirty objects (and the objects that show a preview of them) are
  // serialised again; everything else reuses its previous copy. This keeps long programs fast.
  let DIRTY = new Set();
  const touch = o => { DIRTY.add(o); };
  class TrackedMap extends Map {
    set(k, v) { if (this.owner) DIRTY.add(this.owner); return super.set(k, v); }
    delete(k) { if (this.owner) DIRTY.add(this.owner); return super.delete(k); }
    clear() { if (this.owner) DIRTY.add(this.owner); return super.clear(); }
  }
  class TrackedSet extends Set {
    add(v) { if (this.owner) DIRTY.add(this.owner); return super.add(v); }
    delete(v) { if (this.owner) DIRTY.add(this.owner); return super.delete(v); }
    clear() { if (this.owner) DIRTY.add(this.owner); return super.clear(); }
  }
  // (array items are not watched: each snapshot compares a cheap fingerprint of every array instead)
  class JSObject {
    constructor(id, kind) {
      this.id = id; this.kind = kind;
      DIRTY.add(this);
      const props = new TrackedMap();
      props.owner = this;
      this.props = props;
      this.items = kind === 'array' ? [] : null;
    }
    get map() { return this._map; }
    set map(m) { if (m instanceof Map && !(m instanceof TrackedMap)) Object.setPrototypeOf(m, TrackedMap.prototype); if (m) m.owner = this; this._map = m; DIRTY.add(this); }
    get set() { return this._set; }
    set set(s) { if (s instanceof Set && !(s instanceof TrackedSet)) Object.setPrototypeOf(s, TrackedSet.prototype); if (s) s.owner = this; this._set = s; DIRTY.add(this); }
  }
  const takeDirty = () => { const d = DIRTY; DIRTY = new Set(); return d; };
  class Scope {
    constructor(id, kind, name, parent, owner) { this.id = id; this.kind = kind; this.name = name; this.parent = parent; this.owner = owner; this.vars = new Map(); }
  }
  class ReturnSignal { constructor(v) { this.value = v; } }
  class BreakSignal { constructor(l) { this.label = l; } }
  class ContinueSignal { constructor(l) { this.label = l; } }
  class ThrowSignal { constructor(v, node) { this.value = v; this.node = node; } }
  class StepLimit { }
  class Unsupported { constructor(m, node) { this.message = m; this.node = node; } }
  class ShortCircuit { }
  class GenReturnSignal { constructor(v) { this.value = v; } } // generator.return() forces the body to finish
  class JSSymbol {
    constructor(desc) { this.desc = desc; }
    toString() { return `Symbol(${this.desc === undefined ? '' : this.desc})`; }
  }
  class Accessor { constructor(get, set) { this.get = get; this.set = set; } } // a getter / setter pair
  const SYM_ITER = new JSSymbol('Symbol.iterator');
  const SYM_ASYNC_ITER = new JSSymbol('Symbol.asyncIterator');
  const SYM_TO_PRIM = new JSSymbol('Symbol.toPrimitive');
  const isSignal = e => e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal || e instanceof ThrowSignal || e instanceof GenReturnSignal;
  const keyText = k => (k instanceof JSSymbol ? `[${k}]` : String(k));
  const ERROR_NAMES = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError'];

  class Interpreter {
    // opts (all optional): netCache, answers, events, storage, maxSteps — data collected by the app between runs
    constructor(source, opts) {
      this.opts = opts || {};
      this.maxSteps = this.opts.maxSteps || MAX_STEPS;
      this.src = source;
      this.trace = [];
      this.heap = [];
      this.objSeq = 0; this.scopeSeq = 0; this.ctxSeq = 0; this.timerSeq = 0;
      this.stack = [];
      this.consoleLines = [];
      this.webApis = [];
      this.queue = [];
      this.microtasks = [];
      this.paused = [];
      this.microSeq = 0;
      this.unhandled = [];
      this.time = 0;
      this.badges = []; this.newBadges = [];
      this.changed = null; this.changedProp = null; this.focusScope = null; this.nextTask = null;
      this.pending = new Set();
      this.tempRoot = undefined;
      this.lastAssigned = undefined;
      this.stage = 'creation';
      this.limitHit = false;
      this.globalThisObj = new JSObject(0, 'object');
      this.globalThisObj.hidden = true; this.globalThisObj.label = 'window';
      this.builtins = new Map();
      this.cache = new Map();
      this.setupBuiltins();
      if (this.setupPlatform) this.setupPlatform(); // needs every other built-in to exist first
    }

    // ======================================================== public
    run() {
      // TypeScript: types are blanked out with spaces, so every position (and every highlight) stays the same
      if (root.JSEngine.isTypeScript && root.JSEngine.isTypeScript(this.src)) {
        try { this.src = root.JSEngine.stripTypes(this.src); this.tsMode = true; }
        catch (e) {
          if (e instanceof root.JSEngine.TSError) return { error: 'TypeScript: ' + e.message, errorLine: this.src.slice(0, e.pos).split('\n').length, trace: [] };
          throw e;
        }
      }
      let ast = null;
      let files = this.splitFiles();
      // other sections are blanked out (same length, same line breaks) so positions still match the editor
      const mask = f => this.src.split('').map((c, i) => (i >= f.start && i < f.end) || c === '\n' ? c : ' ').join('');
      if (files) {
        // "// @file index.html" sections become the page; the rest is JavaScript
        const html = files.filter(f => /\.html?$/i.test(f.name));
        if (html.length) {
          const h = html[0];
          this.page.doc.body.innerHTML = this.src.slice(h.start, h.end).replace(/^[^\n]*\n?/, '');
          this.page.touched = true;
        }
        files = files.filter(f => !/\.html?$/i.test(f.name));
        // files with "worker" in their name are Web Worker scripts, started with new Worker("name.js")
        this.workerFiles = files.filter(f => /worker/i.test(f.name));
        files = files.filter(f => !/worker/i.test(f.name));
        this.dataFiles = files.filter(f => !/\.(m?js|cjs|ts|mts|cts)$/i.test(f.name)).map(f => ({ name: f.name, text: this.src.slice(f.start, f.end).replace(/^[^\n]*\n?/, '').replace(/\s+$/, '') + '\n' }));
        files = files.filter(f => /\.(m?js|cjs|ts|mts|cts)$/i.test(f.name));
      }
      let script = null; // a single JS file next to an HTML page runs as a classic <script>
      try {
        const usesESM = f => /^\s*(import|export)\b/m.test(this.src.slice(f.start, f.end));
        if (files && files.length > 1 && /^\s*\/\/\s*@env\s+node\b/m.test(this.src) && !files.some(usesESM)) {
          // Node mode without import/export: CommonJS. The entry file runs; the others run when required.
          const entry = files.find(f => /^(main|index|app)\.c?js$/i.test(f.name)) || files[files.length - 1];
          this.cjsFiles = files.filter(f => f !== entry);
          script = root.acorn.parse(mask(entry), { ecmaVersion: 2022, locations: true, sourceType: 'script' });
        } else if (files && files.length === 1 && !usesESM(files[0])) {
          script = root.acorn.parse(mask(files[0]), { ecmaVersion: 2022, locations: true, sourceType: 'script' });
        } else if (files && files.length) {
          // each "// @file name.js" section is parsed as its own module
          files.forEach(f => { f.ast = root.acorn.parse(mask(f), { ecmaVersion: 2022, locations: true, sourceType: 'module' }); });
        } else if (!files) ast = root.acorn.parse(this.src, { ecmaVersion: 2022, locations: true, sourceType: 'script' });
      } catch (e) {
        return { error: 'SyntaxError: ' + e.message.replace(/\s*\(\d+:\d+\)$/, ''), errorLine: e.loc ? e.loc.line : null, trace: [] };
      }
      try {
        if (/^\s*\/\/\s*@env\s+node\b/m.test(this.src)) this.setupNode();
        this.registerUserEvents();
        if (script) this.runProgram(script);
        else if (files && files.length) this.runModules(files);
        else if (files) this.runProgram({ body: [] });
        else this.runProgram(ast);
        this.runEventLoop();
        this.stage = 'done';
        this.record(null, '🎉 <b>Program complete!</b> The Call Stack is empty, no timers are waiting and the Callback Queue is empty. Nothing left to do.', 'done');
      } catch (e) {
        this.limitHit = true;
        this.stage = 'error';
        if (e instanceof StepLimit) this.record(null, `⛔ Stopped after ${this.maxSteps} steps — this looks like an infinite loop (or a very long program).`, 'error');
        else if (e instanceof Unsupported) this.record(e.node, '🚧 ' + esc(e.message), 'error');
        else { console.error(e); this.record(null, '🐞 The visualizer hit an internal error: ' + esc(e && e.message), 'error'); }
      }
      return { trace: this.trace };
    }

    // ======================================================== recording
    // Snapshots share every piece that did not change since the previous step (same JSON → same object),
    // which keeps long recordings small.
    // objects whose display depends on state outside props/items/map/set are rebuilt every step
    isVolatile(o) {
      return !!(o.isPromise || o.isGenerator || o.isProxy || o.domNode || o.dom || o.domView || o.host || o.isWeakRef || o.frCells || o.intl
        || o.isStorage || o.nodeBuffer || o.isWorker || o.realm || o.kind === 'typed' || o.kind === 'buffer' || o.kind === 'date' || o.kind === 'regexp' || o.kind === 'iterator');
    }
    // does `o` show (among its first n entries) an object from `set`, or a volatile object?
    showsAny(o, set, n) {
      const hit = x => x instanceof JSObject && (set.has(x) || this.isVolatile(x));
      const items = o.items;
      if (items) for (let i = 0; i < items.length && i < n; i++) if (hit(items[i])) return true;
      let k = 0;
      for (const x of o.props.values()) { if (++k > n) break; if (hit(x)) return true; }
      if (o._map) { k = 0; for (const [a, b] of o._map) { if (++k > n) break; if (hit(a) || hit(b)) return true; } }
      if (o._set) { k = 0; for (const x of o._set) { if (++k > n) break; if (hit(x)) return true; } }
      return false;
    }
    // before a snapshot: find what changed since the last one and drop those cached copies
    prepareSnapshot() {
      const dirty = takeDirty();
      for (const o of this.heap) {
        const items = o.items;
        if (!items) continue;
        // arrays are compared by a fingerprint of everything a card or preview can show
        let fp = items.length + ':';
        for (let i = 0; i < items.length && i < 30; i++) {
          const x = items[i];
          fp += (x instanceof JSObject ? 'o' + x.id : typeof x === 'string' ? 's' + x.length + x : typeof x + String(x)) + '\u0001';
        }
        if (fp !== o._fp) { o._fp = fp; dirty.add(o); }
      }
      // a preview such as {name: 'Ada', tags: […]} shows its own entries and the kind of each child
      const previews = new Set(dirty);
      for (const o of this.heap) if (!previews.has(o) && this.showsAny(o, dirty, 15)) previews.add(o);
      // a heap card shows the previews of its first 30 entries
      const cards = new Set(previews);
      for (const o of this.heap) if (!cards.has(o) && this.showsAny(o, previews, 30)) cards.add(o);
      for (const o of previews) o._pv = null;
      for (const o of cards) o._so = null;
      if (this.opts.noCache) for (const o of this.heap) { o._pv = null; o._so = null; } // used by the tests to check the cache

    }
    serObjCached(o, garbage) {
      const changedKey = this.changedProp && this.changedProp.id === o.id ? String(this.changedProp.key) : null;
      const c = o._so;
      if (c && !this.isVolatile(o) && c.garbage === garbage && c.keptBy === (o.keptBy || null) && c.changedKey === changedKey && c.calls === (o.calls || 0)
        && c.label === o.label && c.name === o.name && c.frozen === !!o.frozen && c.proto === o.proto && c.ctorName === o.ctorName) return c.val;
      const val = this.serObj(o, garbage);
      o._so = { val, garbage, keptBy: o.keptBy || null, changedKey, calls: o.calls || 0, label: o.label, name: o.name, frozen: !!o.frozen, proto: o.proto, ctorName: o.ctorName };
      return val;
    }

    reuse(key, obj) {
      const same = this.serCache.get(key);
      if (same && same.o === obj) return obj; // the cached copy itself: nothing to compare
      const j = JSON.stringify(obj);
      const prev = this.serCache.get(key);
      if (prev && prev.j === j) return prev.o;
      this.serCache.set(key, { j, o: obj });
      return obj;
    }

    record(node, msg, kind) {
      if (this.silent) return; // setting up built-ins written in JS (e.g. Node's EventEmitter)
      if (this.trace.length >= this.maxSteps && !this.limitHit) { this.limitHit = true; throw new StepLimit(); }
      if (!this.serCache) this.serCache = new Map();
      this.prepareSnapshot();
      this.snapActive = true;
      const top = this.stack[this.stack.length - 1];
      const lines = this.consoleLines, clen = lines.length;
      const snap = {
        env: this.nodeMode ? 'node' : 'browser',
        loopPhase: this.loopPhase || null,
        workers: (this.workers || []).filter(w => w.realm.started).map(w => this.serScope(w.realm.scope)),
        ic: this.icSummary ? this.icSummary() : null,
        msg, kind,
        // code that came from eval()/new Function has no place in the editor, so it is shown separately
        start: node && !node.sourceFile ? node.start : null,
        end: node && !node.sourceFile ? node.end : null,
        line: node && node.loc && !node.sourceFile ? node.loc.start.line : null,
        ext: node && node.sourceFile ? { label: node.sourceFile.label, code: node.sourceFile.code, start: node.start, end: node.end } : null,
        phase: this.stage === 'error' ? 'error' : top ? top.phase : this.stage,
        where: top ? top.name : null,
        stack: (this.mainStack || this.stack).map(c => this.reuse('c' + c.id, this.serCtx(c))),
        threads: this.serThreads ? this.serThreads() : null,
        files: this.serFiles ? this.serFiles() : null,
        paused: this.paused.map(t => Object.assign(this.serCtx(t.ctx), { reason: t.reason() })),
        globalMem: this.globalScope ? this.serScope(this.globalScope) : null,
        globalAlive: !!this.globalCtx && (this.mainStack || this.stack).includes(this.globalCtx),
        modules: (this.modules || []).filter(m => m.scope && m.state === 'done' && !this.stack.some(c => c.funcScope === m.scope)).map(m => this.serScope(m.scope)),
        heap: this.serHeap(),
        webApis: this.webApis.map(t => ({ id: t.id, label: t.label, delay: t.delay, start: t.start, fireAt: t.fireAt, ref: t.cb ? t.cb.id : null, kind: t.kind || (t.interval ? 'interval' : 'timeout') })),
        queue: this.queue.concat(this.immediates || []).map(t => ({ id: t.id, label: t.label, ref: t.cb ? t.cb.id : null, next: t === this.nextTask })),
        page: this.serPage(),
        microtasks: (this.tickQueue || []).concat(this.microtasks).map(t => ({ id: t.id, label: t.label, ref: t.ref, next: t === this.nextTask })),
        time: this.time,
        badges: this.badges.slice(),
        newBadges: this.newBadges.splice(0),
        focusScope: this.focusScope,
      };
      // console lines never change once printed, so each step just remembers how many there were
      Object.defineProperty(snap, 'console', { get: () => lines.slice(0, clen), enumerable: true });
      this.snapActive = false;
      this.trace.push(snap);
      this.changed = null; this.changedProp = null; this.focusScope = null; this.nextTask = null;
    }

    badge(id) { if (!this.badges.includes(id)) { this.badges.push(id); this.newBadges.push(id); } }

    serValue(v) {
      if (v === undefined) return { t: 'undef', text: 'undefined' };
      if (v === null) return { t: 'null', text: 'null' };
      if (typeof v === 'number') return { t: 'num', text: Object.is(v, -0) ? '-0' : String(v) };
      if (typeof v === 'bigint') return { t: 'num', text: v + 'n' };
      if (typeof v === 'string') return { t: 'str', text: JSON.stringify(v) };
      if (typeof v === 'boolean') return { t: 'bool', text: String(v) };
      if (v instanceof JSSymbol) return { t: 'sym', text: v.toString() };
      if (v instanceof Accessor) return { t: 'fn', text: `⚙ ${[v.get && 'get', v.set && 'set'].filter(Boolean).join(' / ')}` };
      if (v === UNINIT) return { t: 'tdz', text: '‹not ready until super()›' };
      if (v instanceof JSObject) {
        if (v.kind === 'native') return { t: 'fn', text: 'ƒ ' + v.name + ' (built-in)' };
        if (v.hidden) return { t: 'obj', text: v.label };
        if (v.kind === 'function') return { t: 'fn', text: (v.isClass ? 'class ' : 'ƒ ') + v.label, ref: v.id };
        if (v.isError) return { t: 'err', text: '⚠ ' + v.props.get('name'), ref: v.id };
        if (v.isPromise) return { t: 'obj', text: `Promise {<${v.state}>}`, ref: v.id };
        // previews are cached while a snapshot is being built (prepareSnapshot drops the stale ones)
        const cacheable = this.snapActive && !this.isVolatile(v);
        if (cacheable && v._pv && v._pv.proto === v.proto && v._pv.ctorName === v.ctorName) return v._pv.val;
        const val = { t: v.kind === 'array' ? 'arr' : 'obj', text: trunc(this.display(v, 0, false, 1), 26), ref: v.id };
        if (cacheable) v._pv = { val, proto: v.proto, ctorName: v.ctorName };
        return val;
      }
      return { t: 'undef', text: String(v) };
    }

    serScope(s) {
      const vars = [];
      s.vars.forEach((e, name) => {
        if (name === '*default*') name = 'default (export)';
        let v;
        if (e.importFrom) {
          const src = e.importFrom.scope.vars.get(e.importFrom.name);
          v = !src || src.tdz ? { t: 'tdz', text: '‹not ready yet›' } : this.serValue(src.value);
        } else v = e.tdz ? { t: 'tdz', text: '‹uninitialized›' } : this.serValue(e.value);
        vars.push({
          name, kind: e.kind, implicit: !!e.implicit, v, from: e.importLabel || null,
          changed: !!this.changed && this.changed.scope === s.id && (this.changed.name === name || (name === 'default (export)' && this.changed.name === '*default*')),
        });
      });
      return { id: s.id, name: s.name, kind: s.kind, vars };
    }

    serCtx(c) {
      const own = [];
      let s = c.currentScope;
      while (s) { own.push(this.serScope(s)); if (s === c.funcScope) break; s = s.parent; }
      const outer = [];
      for (let o = c.funcScope.parent; o; o = o.parent) {
        if (o.kind === 'global') outer.push({ id: o.id, name: 'Global', kind: 'global', vars: [] });
        else outer.push(Object.assign(this.serScope(o), { alive: this.stack.includes(o.owner) }));
      }
      return {
        id: c.id, name: c.name, phase: c.phase, isGlobal: c.isGlobal, isModule: !!c.isModule, isWorker: !!c.isWorker, strict: !!c.strict, fromQueue: c.fromQueue || null, isAsync: !!c.isAsync,
        thisText: c.isArrow ? 'inherited (arrow fn)' : this.serValue(c.thisVal).text,
        scopes: own.reverse(), outer,
      };
    }

    // Mark-and-sweep, like a real garbage collector: start from the "roots" (variables that can still be
    // used) and follow every reference. Each object remembers which root first reached it (keptBy).
    reachable() {
      const seen = new Set(), seenScopes = new Set();
      let why = '';
      const markV = (v, via) => {
        if (!(v instanceof JSObject) || seen.has(v)) return;
        seen.add(v);
        if (v.id > 0) v.keptBy = via ? `${why} → #${via}` : why;
        const kid = x => markV(x, v.id > 0 ? v.id : via);
        if (v.items) v.items.forEach(x => kid(x));
        v.props.forEach((x, k) => { kid(k); if (x instanceof Accessor) { kid(x.get); kid(x.set); } else kid(x); });
        if (v.closure) markS(v.closure, true);
        [v.lexicalThis, v.proto, v.homeObject, v.parentClass].forEach(x => kid(x));
        if (v.refs) v.refs.forEach(x => kid(x));
        if (v.isPromise) { kid(v.value); v.reactions.forEach(r => [r.onF, r.onR, r.child].concat(r.refs || []).forEach(x => kid(x))); }
        if (v.map) v.map.forEach((x, k) => { kid(k); kid(x); });
        if (v.set) v.set.forEach(x => kid(x));
        if (v.fields) v.fields.forEach(f => kid(f.key));
        if (v.genCtx) { markS(v.genCtx.currentScope, true); kid(v.genCtx.thisVal); }
        if (v.agQueue) v.agQueue.forEach(r => { kid(r.promise); kid(r.value); });
        if (v.frCells) v.frCells.forEach(c => { kid(c.held); kid(c.token); }); // targets are weak: not marked
      };
      const markS = (s, keepWhy) => {
        for (; s && !seenScopes.has(s); s = s.parent) {
          seenScopes.add(s);
          const outer = why;
          s.vars.forEach((e, name) => { if (!keepWhy) why = `${s.kind === 'global' ? 'global' : s.name} › ${name}`; markV(e.value); });
          why = outer;
        }
      };
      const root = (label, fn) => { why = label; fn(); };
      if (this.globalScope) markS(this.globalScope);
      this.stack.forEach(c => { markS(c.currentScope); root(`this of ${c.name}`, () => { markV(c.thisVal); markV(c.pendingThis); markV(c.argsObj); }); });
      // paused async functions stay alive; paused generators are only alive while something points to them
      this.paused.forEach(t => { if (!t.root) return; markS(t.ctx.currentScope); root(`paused ${t.ctx.name}`, () => { markV(t.ctx.thisVal); markV(t.promise); markV(t.waitingOn); markV(t.genObj); }); });
      this.webApis.concat(this.queue).forEach(t => root(`timer/task ${t.label}`, () => { markV(t.cb); t.args.forEach(x => markV(x)); (t.refs || []).forEach(x => markV(x)); }));
      this.browserRoots(markV, root);
      if (this.platformRoots) this.platformRoots(markV, markS, root);
      (this.modules || []).forEach(m => { if (m.scope) markS(m.scope); });
      this.microtasks.forEach(t => root(`microtask ${t.label}`, () => t.refs.forEach(x => markV(x))));
      root('the line running right now', () => { this.pending.forEach(x => markV(x)); markV(this.tempRoot); });
      return seen;
    }

    serHeap() {
      const reach = this.reachable();
      const out = [];
      const n = this.trace.length;
      for (const o of this.heap) {
        if (o.internal) continue; // objects that belong to built-ins written in JS
        const garbage = !reach.has(o);
        if (garbage) {
          if (o.garbageAt == null) o.garbageAt = n;
          if (n - o.garbageAt >= 3) { o.collected = true; this.badge('gc'); this.onCollected(o); continue; }
        } else o.garbageAt = null;
        const v = this.serObjCached(o, garbage);
        const card = o._so && v === o._so.canon ? v : this.reuse('h' + o.id, v);
        if (o._so) { o._so.val = card; o._so.canon = card; } // the canonical copy: the next step needs no comparison
        out.push(card);
      }
      if (this.heap.some(o => o.collected)) this.heap = this.heap.filter(o => !o.collected);
      this.paused = this.paused.filter(t => !(t.genObj && t.genObj.collected));
      // nothing changed: share the previous step's list (saves memory on long runs)
      const last = this.lastHeapOut;
      if (last && last.length === out.length && out.every((x, i) => x === last[i])) return last;
      this.lastHeapOut = out;
      return out;
    }

    serObj(o, garbage) {
      const changedKey = this.changedProp && this.changedProp.id === o.id ? String(this.changedProp.key) : null;
      const props = [...o.props].slice(0, 30).map(([k, v]) => ({ k: keyText(k), v: this.serValue(v) }));
      const base = { id: o.id, kind: o.kind, garbage, changedKey, keptBy: garbage ? null : o.keptBy || null };
      const extra = this.serExtra(o, base);
      if (extra) return extra;
      if (o.kind === 'function') {
        if (o.isClass) {
          return Object.assign(base, { title: 'class ' + o.label, params: o.params.join(', '), scope: this.scopeLabel(o.closure) + (o.parentClass ? ' · extends ' + this.fnLabel(o.parentClass) : ''), isClass: true, entries: props.filter(e => e.k !== 'prototype').concat(props.filter(e => e.k === 'prototype')) });
        }
        const pre = (o.isAsync && o.name ? 'async ' : '') + (o.isGenerator ? '* ' : '');
        return Object.assign(base, { title: 'ƒ ' + pre + o.label, params: o.params.join(', '), scope: this.scopeLabel(o.closure), arrow: o.isArrow, entries: props });
      }
      if (o.dom) {
        return Object.assign(base, { title: `${o.ctorName} <${o.dom.tag}>`, entries: [
          { k: 'id', v: this.serValue(o.dom.id) }, { k: 'textContent', v: this.serValue(o.dom.text) },
          ...(o.dom.tag === 'input' ? [{ k: 'value', v: this.serValue(o.dom.value) }] : []),
          { k: 'listeners', v: { t: 'num', text: o.dom.listeners.map(l => l.type).join(', ') || 'none' } },
          { k: 'on page', v: this.serValue(o.dom.attached) }] });
      }
      if (o.isProxy) return Object.assign(base, { title: 'Proxy', entries: [{ k: 'target', v: this.serValue(o.target) }, { k: 'handler', v: this.serValue(o.handler) }] });
      if (o.kind === 'map') {
        const entries = [...o.map].slice(0, 30).map(([k, v]) => ({ k: trunc(this.display(k, 1, false, 1), 18) + ' ⇒', v: this.serValue(v) }));
        return Object.assign(base, { title: `Map(${o.map.size})`, entries });
      }
      if (o.kind === 'set') {
        const entries = [...o.set].slice(0, 30).map(v => ({ k: '•', v: this.serValue(v) }));
        return Object.assign(base, { title: `Set(${o.set.size})`, entries });
      }
      if (o.kind === 'regexp') return Object.assign(base, { title: 'RegExp ' + String(o.re), entries: [{ k: 'lastIndex', v: this.serValue(o.re.lastIndex) }] });
      if (o.kind === 'date') return Object.assign(base, { title: 'Date', entries: [{ k: 'time', v: { t: 'str', text: isNaN(o.d) ? 'Invalid Date' : o.d.toISOString() } }] });
      if (o.kind === 'iterator') return Object.assign(base, { title: o.label, entries: [{ k: 'position', v: { t: 'num', text: `${Math.min(o.pos, o.items.length)} of ${o.items.length}` } }] });
      if (o.isGenerator) {
        return Object.assign(base, { title: (o.isAsyncGen ? 'Async Generator · ' : 'Generator · ') + o.genName, entries: [{ k: 'state', v: { t: 'pstate-' + (o.genState === 'completed' ? 'fulfilled' : 'pending'), text: o.genState } }].concat(props) });
      }
      if (o.isPromise) {
        const entries = [
          { k: 'state', v: { t: 'pstate-' + o.state, text: o.state } },
          { k: 'result', v: o.state === 'pending' ? { t: 'undef', text: '—' } : this.serValue(o.value) },
          { k: 'waiting', v: { t: 'num', text: o.reactions.length + ' callback' + (o.reactions.length === 1 ? '' : 's') } },
        ];
        return Object.assign(base, { title: 'Promise', isPromise: true, state: o.state, entries, changedKey: changedKey && 'state' });
      }
      if (o.kind === 'array') {
        const entries = o.items.slice(0, 30).map((v, i) => ({ k: String(i), v: this.serValue(v) })).concat(props);
        return Object.assign(base, { title: `Array(${o.items.length})`, entries });
      }
      const title = o.isError ? (o.ctorName && o.ctorName !== 'Error' ? o.ctorName + ' (Error)' : o.props.get('name'))
        : o.ctorName ? o.ctorName + ' object' : o.isProto ? (o.protoOf ? o.protoOf + '.prototype' : 'prototype') : 'Object';
      return Object.assign(base, { title: title + (o.frozen ? ' 🧊' : ''), isError: !!o.isError, entries: props });
    }

    scopeLabel(s) { return !s ? '?' : s.kind === 'global' ? 'Global' : s.name; }

    // ======================================================== value helpers
    display(v, depth = 0, top = false, maxDepth = 2) {
      if (typeof v === 'string') return top ? v : "'" + v + "'";
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
      if (typeof v === 'bigint') return v + 'n';
      if (v instanceof JSObject && v.isProxy) return `Proxy(${this.display(v.target, depth, false, maxDepth)})`;
      if (v instanceof JSSymbol) return v.toString();
      if (v instanceof Accessor) return v.get && v.set ? '[Getter/Setter]' : v.get ? '[Getter]' : '[Setter]';
      if (v === UNINIT) return '‹uninitialized this›';
      if (typeof v !== 'object') return String(v);
      if (v.kind === 'native') return top || depth > 0 ? `ƒ ${v.name}() { [native code] }` : `ƒ ${v.name}()`;
      if (v.hidden) return v.label;
      if (v.isError) return `${v.props.get('name')}: ${v.props.get('message')}`;
      if (v.kind === 'regexp') return String(v.re);
      if (v.kind === 'date') return isNaN(v.d) ? 'Invalid Date' : v.d.toString();
      if (v.kind === 'iterator') return `${v.label} {…}`;
      if (v.isGenerator) return `${v.isAsyncGen ? 'AsyncGenerator' : 'Generator'} {<${v.genState}>}`;
      if (v.kind === 'map') {
        if (depth >= maxDepth) return `Map(${v.map.size})`;
        return `Map(${v.map.size}) {` + [...v.map].map(([k, x]) => `${this.display(k, depth + 1, false, maxDepth)} => ${this.display(x, depth + 1, false, maxDepth)}`).join(', ') + '}';
      }
      if (v.kind === 'set') {
        if (depth >= maxDepth) return `Set(${v.set.size})`;
        return `Set(${v.set.size}) {` + [...v.set].map(x => this.display(x, depth + 1, false, maxDepth)).join(', ') + '}';
      }
      if (v.kind === 'function' && v.isClass) return `class ${v.name || '(anonymous)'}`;
      if (v.isPromise) {
        if (v.state === 'pending') return 'Promise {<pending>}';
        const inner = this.display(v.value, depth + 1, false, maxDepth);
        return v.state === 'fulfilled' ? `Promise {${inner}}` : `Promise {<rejected> ${inner}}`;
      }
      if (v.kind === 'function') return `ƒ ${v.name || 'anonymous'}()`;
      if (v.kind === 'array') {
        if (depth >= maxDepth) return `Array(${v.items.length})`;
        return '[' + v.items.map(x => this.display(x, depth + 1, false, maxDepth)).join(', ') + ']';
      }
      if (depth >= maxDepth) return '{…}';
      const parts = [...v.props].map(([k, x]) => `${keyText(k)}: ${this.display(x, depth + 1, false, maxDepth)}`);
      return (v.ctorName ? v.ctorName + ' ' : '') + (parts.length ? '{' + parts.join(', ') + '}' : '{}');
    }

    valText(v) {
      const d = trunc(this.display(v, 0, false, 1), 46);
      if (v instanceof JSObject && !v.hidden && v.kind !== 'native') {
        return `<span class="nv ref" data-ref="${v.id}">${esc(d)}</span> <small>(a reference → #${v.id} in the Heap)</small>`;
      }
      return `<span class="nv">${esc(d)}</span>`;
    }

    snip(node, n = 40) { return trunc(this.text(node), n); }
    // source text of a node: the editor's code, or the string given to eval / new Function
    text(node) { return (node && node.sourceFile ? node.sourceFile.code : this.src).slice(node.start, node.end); }

    toStr(v) {
      if (typeof v === 'string') return v;
      if (v instanceof JSSymbol) throw this.makeError('TypeError', 'Cannot convert a Symbol value to a string', null);
      if (v instanceof JSObject) {
        if (v.kind === 'array') return v.items.map(x => (x == null ? '' : this.toStr(x))).join(',');
        if (v.isError) return `${v.props.get('name')}: ${v.props.get('message')}`;
        if (v.kind === 'regexp') return String(v.re);
        if (v.kind === 'date') return v.d.toString();
        if (v.kind === 'function') return v.node ? this.text(v.node) : `class ${v.name} {}`;
        if (v.kind === 'native') return `function ${v.name}() { [native code] }`;
        if (v.kind === 'map') return '[object Map]';
        if (v.kind === 'set') return '[object Set]';
        const tp = this.getMember(v, SYM_TO_PRIM);
        if (this.isCallable(tp)) return this.toStr(this.callFunction(tp, v, ['string'], null));
        const ts = v.proto || v.props.has('toString') || v.isProxy ? this.getMember(v, 'toString') : undefined;
        if (ts instanceof JSObject && ts.kind === 'function') return this.toStr(this.callFunction(ts, v, [], null));
        return '[object Object]';
      }
      return String(v);
    }
    // object → primitive, following JS rules: Symbol.toPrimitive, then valueOf / toString
    toPrim(v, hint = 'default') {
      if (!(v instanceof JSObject)) return v;
      if (v.kind === 'native' || v.kind === 'function' || v.hidden) return this.toStr(v);
      const tp = this.getMember(v, SYM_TO_PRIM);
      if (this.isCallable(tp)) {
        const r = this.callFunction(tp, v, [hint], null);
        if (r instanceof JSObject) throw this.makeError('TypeError', 'Cannot convert object to primitive value', null);
        return r;
      }
      if (v.kind === 'date') return hint === 'number' ? v.d.getTime() : v.d.toString();
      if (hint !== 'string') {
        const vo = this.getMember(v, 'valueOf');
        if (vo instanceof JSObject && vo.kind === 'function') {
          const r = this.callFunction(vo, v, [], null);
          if (!(r instanceof JSObject)) return r;
        }
      }
      return this.toStr(v);
    }
    toNumber(v) {
      if (v instanceof JSSymbol) throw this.makeError('TypeError', 'Cannot convert a Symbol value to a number', null);
      const p = this.toPrim(v, 'number');
      if (typeof p === 'bigint') throw this.makeError('TypeError', 'Cannot convert a BigInt value to a number', null);
      return Number(p);
    }
    isStrict() { const top = this.stack[this.stack.length - 1]; return !!(top && top.strict); }
    truthy(v) { return v instanceof JSObject || v instanceof JSSymbol ? true : !!v; }
    toKey(v) { return typeof v === 'string' || v instanceof JSSymbol ? v : this.toStr(v); }
    isCallable(v) { return v instanceof JSObject && (v.kind === 'function' || v.kind === 'native'); }
    fnLabel(f) { return f.kind === 'native' ? f.name : f.label; }

    alloc(kind) {
      const o = new JSObject(++this.objSeq, kind);
      this.heap.push(o);
      this.pending.add(o);
      if (this.silent) o.internal = true;
      if (kind !== 'function' && !this.silent) this.badge('heap');
      return o;
    }
    makeArray(items) { const a = this.alloc('array'); a.items = items; return a; }
    makeErrorObj(name, message) {
      const o = this.alloc('object');
      o.isError = true;
      o.props.set('name', name); o.props.set('message', message);
      return o;
    }
    makeError(name, message, node) { this.badge('error'); return new ThrowSignal(this.makeErrorObj(name, message), node); }

    makeFunction(node, scope, ctx) {
      const f = this.alloc('function');
      f.node = node; f.closure = scope;
      f.isArrow = node.type === 'ArrowFunctionExpression';
      f.isAsync = !!node.async;
      f.isGenerator = !!node.generator;
      const b = node.body;
      f.ownStrict = !!(b && b.type === 'BlockStatement' && b.body[0] && b.body[0].directive === 'use strict');
      f.strict = !!ctx.strict || f.ownStrict;
      f.name = node.id ? node.id.name : null;
      f.label = f.name || `${f.isAsync ? 'async ' : ''}${f.isGenerator ? 'generator' : f.isArrow ? 'arrow fn' : 'anonymous fn'} @ line ${node.loc.start.line}`;
      f.params = node.params.map(p => this.text(p));
      if (f.isArrow) {
        f.lexicalThis = ctx.thisVal;
        f.lexicalCtx = ctx; // arrows also borrow `arguments`, `super` and `new.target`
        if (ctx.fn && ctx.fn.homeObject) f.homeObject = ctx.fn.homeObject;
      }
      return f;
    }
    nameFn(f, name) { if (f instanceof JSObject && f.kind === 'function' && !f.name) { f.name = keyText(name); f.label = keyText(name); } }

    newScope(kind, name, parent, owner) { return new Scope(++this.scopeSeq, kind, name, parent, owner); }

    // collect every value of an iterable into a plain JS array
    iterable(v, node) {
      if (typeof v === 'string') return [...v];
      if (v instanceof JSObject && v.kind === 'array') return v.items.slice();
      const it = this.getIterator(v, node);
      const out = [];
      for (;;) { const r = it.next(); if (r.done) return out; out.push(r.value); }
    }

    // returns a JS-level iterator { next(x) → {done, value}, return() } for any iterable value
    getIterator(v, node) {
      const I = this;
      const list = items => { let i = 0; return { next: () => (i < items.length ? { done: false, value: items[i++] } : { done: true }), return: () => {} }; };
      if (typeof v === 'string') return list([...v]);
      if (v instanceof JSObject) {
        if (v.kind === 'array') { let i = 0; return { next: () => (i < v.items.length ? { done: false, value: v.items[i++] } : { done: true }), return: () => {} }; }
        if (v.kind === 'map') return list([...v.map].map(([k, x]) => this.makeArray([k, x])));
        if (v.kind === 'set') return list([...v.set]);
        if (v.kind === 'iterator') return { next: () => (v.pos < v.items.length ? { done: false, value: v.items[v.pos++] } : { done: true }), return: () => {} };
        if (v.isGenerator && !v.isAsyncGen) {
          return {
            next: x => { const r = I.genResume(v, 'next', x, node); return { done: I.truthy(I.getMember(r, 'done')), value: I.getMember(r, 'value') }; },
            return: () => { if (v.genState !== 'completed') I.genResume(v, 'return', undefined, node); },
          };
        }
        const m = this.getMember(v, SYM_ITER, node);
        if (this.isCallable(m)) {
          const itObj = this.callFunction(m, v, [], node);
          if (itObj instanceof JSObject && itObj.kind === 'iterator') return this.getIterator(itObj, node);
          if (itObj instanceof JSObject && itObj.isGenerator) return this.getIterator(itObj, node);
          return {
            next: x => {
              const nx = I.getMember(itObj, 'next', node);
              const r = I.callFunction(nx, itObj, [x], node);
              if (!(r instanceof JSObject)) throw I.makeError('TypeError', `Iterator result ${I.display(r)} is not an object`, node);
              return { done: I.truthy(I.getMember(r, 'done')), value: I.getMember(r, 'value') };
            },
            return: () => { const rt = I.getMember(itObj, 'return'); if (I.isCallable(rt)) I.callFunction(rt, itObj, [], node); },
          };
        }
      }
      throw this.makeError('TypeError', `${node && node.start != null ? this.snip(node) : this.display(v)} is not iterable`, node);
    }

    listIterator(items, label) {
      const it = this.alloc('iterator');
      it.items = items; it.pos = 0; it.label = label;
      return it;
    }

    iterResult(value, done) {
      const r = this.alloc('object');
      r.props.set('value', value); r.props.set('done', done);
      return r;
    }

    ownKeys(v) {
      if (!(v instanceof JSObject)) return typeof v === 'string' ? [...v].map((_, i) => String(i)) : [];
      if (v.isProxy) {
        const t = this.getMember(v.handler, 'ownKeys');
        if (this.isCallable(t)) { this.trapStep('ownKeys', null, null); return this.iterable(this.callFunction(t, v.handler, [v.target], null), null).map(k => this.toKey(k)).filter(k => typeof k === 'string'); }
        return this.ownKeys(v.target);
      }
      const keys = v.items ? v.items.map((_, i) => String(i)) : [];
      // non-enumerable properties (Object.defineProperty with enumerable: false) are skipped
      return keys.concat([...v.props.keys()].filter(k => typeof k === 'string' && !k.startsWith('#') && !(v.isProto && k === 'constructor') && !(v.attrs && v.attrs.get(k) && v.attrs.get(k).enumerable === false)));
    }
  }

  // Shared helpers for the other engine files (js/engine/*.js).
  const internals = { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES };

  // Each engine file adds its methods to Interpreter with mixin(class { ... }).
  const mixin = cls => {
    Object.getOwnPropertyNames(cls.prototype).forEach(k => {
      if (k !== 'constructor') Object.defineProperty(Interpreter.prototype, k, Object.getOwnPropertyDescriptor(cls.prototype, k));
    });
  };

  root.JSEngine = { Interpreter, MAX_STEPS, internals, mixin };
})(window);
