/*
 * JS Engine Lab — engine part: the rest of the platform.
 *
 *  - Promise.allSettled / any, AggregateError, Error { cause }, structuredClone
 *  - property attributes (writable / enumerable / configurable), seal / preventExtensions, Object.groupBy, newer array methods
 *  - binary data: ArrayBuffer, typed arrays, DataView, TextEncoder / TextDecoder
 *  - URL / URLSearchParams, AbortController / AbortSignal, crypto, seeded Math.random
 *  - Symbol.hasInstance / Symbol.toStringTag, dynamic import()
 *  - Web Workers (separate memory, messages are copied)
 *  - a Node.js mode ("// @env node"): process.nextTick, setImmediate, event-loop phases, require("events"), util.promisify
 *  - engine internals (simulated): hidden classes ("shapes"), inline caches, hot functions
 */
(function () {
  'use strict';
  const { CONSTRUCT, esc, code, trunc, isIndex, JSObject, JSSymbol, ThrowSignal, Accessor, SYM_ITER, keyText, ERROR_NAMES } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  // the versions defined by earlier engine files; the methods below extend them
  const base = { arrayMethod: P.arrayMethod, getIterator: P.getIterator, display: P.display, toStr: P.toStr, natArg: P.natArg, serExtra: P.serExtra, serObj: P.serObj };
  const SYM_HAS_INSTANCE = new JSSymbol('Symbol.hasInstance');
  const SYM_TAG = new JSSymbol('Symbol.toStringTag');
  const TYPED = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];
  const EMITTER_SRC = `class EventEmitter {
  constructor() { this._events = {}; }
  on(name, listener) { (this._events[name] = this._events[name] || []).push(listener); return this; }
  addListener(name, listener) { return this.on(name, listener); }
  once(name, listener) { const wrapper = (...args) => { this.off(name, wrapper); listener.apply(this, args); }; return this.on(name, wrapper); }
  off(name, listener) { const list = this._events[name]; if (list) this._events[name] = list.filter(l => l !== listener); return this; }
  removeListener(name, listener) { return this.off(name, listener); }
  emit(name, ...args) {
    const list = this._events[name];
    if (!list || !list.length) return false;
    for (const listener of list.slice()) listener.apply(this, args);
    return true;
  }
  listenerCount(name) { return (this._events[name] || []).length; }
}`;

  window.JSEngine.mixin(class {
    setupPlatform() {
      const I = this, B = this.builtins;
      this.workers = [];

      // ---- predictable randomness: the same seed on every re-run, so replays stay exact
      let seed = (this.opts.seed >>> 0) || 20260101;
      this.rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      B.get('Math').props.set('random', this.native('random', () => I.rand()));

      const Sym = B.get('Symbol');
      Sym.props.set('hasInstance', SYM_HAS_INSTANCE);
      Sym.props.set('toStringTag', SYM_TAG);

      // ---- errors: { cause } and AggregateError
      ERROR_NAMES.forEach(n => B.set(n, this.native(n, function (s, a) {
        const e = this.makeErrorObj(n, a.length && a[0] !== undefined ? this.toStr(a[0]) : '');
        if (a[1] instanceof JSObject && this.ownKeys(a[1]).includes('cause')) e.props.set('cause', this.getMember(a[1], 'cause'));
        return e;
      }, { isCtor: true })));
      if (!ERROR_NAMES.includes('AggregateError')) ERROR_NAMES.push('AggregateError');
      B.set('AggregateError', this.native('AggregateError', function (s, a) {
        const e = this.makeErrorObj('AggregateError', a.length > 1 ? this.toStr(a[1]) : 'All promises were rejected');
        e.props.set('errors', this.makeArray(a[0] ? this.iterable(a[0], null) : []));
        return e;
      }, { isCtor: true }));

      // ---- Promise.allSettled / Promise.any
      const Pr = B.get('Promise');
      const combine = kind => this.native(kind, function (s, a, node) {
        const items = this.iterable(a[0], node);
        const p = this.newPromise();
        const results = new Array(items.length);
        let remaining = items.length;
        this.record(node, kind === 'allSettled'
          ? `🧺 <code>Promise.allSettled</code> creates Promise #${p.id}. It waits for <b>every</b> item to finish, success or failure, and never rejects: you get a report for each one.`
          : `🧺 <code>Promise.any</code> creates Promise #${p.id}. It fulfills with the <b>first success</b>, and only rejects (with an AggregateError) if <b>all</b> of them fail.`, 'promise');
        const finish = () => {
          if (p.alreadyResolved) return;
          p.alreadyResolved = true;
          if (kind === 'allSettled') this.settle(p, 'fulfilled', this.makeArray(results), null, ' (every item finished)');
          else {
            const err = this.makeErrorObj('AggregateError', 'All promises were rejected');
            err.props.set('errors', this.makeArray(results));
            this.settle(p, 'rejected', err, null, ' (every item failed)');
          }
        };
        if (!items.length) { finish(); return p; }
        items.forEach((item, i) => {
          const ip = this.toPromise(item);
          const ok = v => {
            if (kind === 'any') { if (!p.alreadyResolved) { p.alreadyResolved = true; this.settle(p, 'fulfilled', v, null, ` (item ${i} succeeded first)`); } return; }
            results[i] = this.fromNative({ status: 'fulfilled' }); results[i].props.set('value', v);
            if (--remaining === 0) finish();
          };
          const bad = r => {
            if (kind === 'any') { results[i] = r; if (--remaining === 0) finish(); return; }
            results[i] = this.fromNative({ status: 'rejected' }); results[i].props.set('reason', r);
            if (--remaining === 0) finish();
          };
          this.promiseThen(ip, ok, bad, null, false, [p, ip], `Promise.${kind} helper`);
        });
        return p;
      });
      Pr.props.set('allSettled', combine('allSettled'));
      Pr.props.set('any', combine('any'));
      Pr.props.set('withResolvers', this.native('withResolvers', function () {
        const p = this.newPromise();
        const o = this.alloc('object');
        o.props.set('promise', p); o.props.set('resolve', this.resolvingFunction(p, 'resolve')); o.props.set('reject', this.resolvingFunction(p, 'reject'));
        return o;
      }));

      // ---- structuredClone: a deep copy of plain data (functions can't be copied)
      B.set('structuredClone', this.native('structuredClone', function (s, a, node) {
        const c = this.cloneValue(a[0], node, new Map());
        this.record(node, `📑 <code>structuredClone</code> makes a <b>deep copy</b>${c instanceof JSObject ? ` #${c.id}` : ''}: every nested object and array is copied too, so changing the copy never changes the original.`, 'heap');
        return c;
      }));

      // ---- property attributes
      const Obj = B.get('Object');
      // Object.prototype.toString.call(x) — the classic way to ask "what kind of value is this?"
      const tagOf = v => {
        if (v === undefined) return 'Undefined'; if (v === null) return 'Null';
        if (typeof v === 'number') return 'Number'; if (typeof v === 'string') return 'String'; if (typeof v === 'boolean') return 'Boolean';
        if (typeof v === 'bigint') return 'BigInt'; if (v instanceof JSSymbol) return 'Symbol';
        const tag = v instanceof JSObject && !v.hidden ? this.getMember(v, SYM_TAG) : undefined;
        if (typeof tag === 'string') return tag;
        if (v.kind === 'array') return 'Array'; if (this.isCallable(v)) return 'Function'; if (v.isError) return 'Error';
        if (v.kind === 'date') return 'Date'; if (v.kind === 'regexp') return 'RegExp'; if (v.kind === 'map') return 'Map'; if (v.kind === 'set') return 'Set';
        if (v.isPromise) return 'Promise'; if (v.kind === 'typed') return v.ta.constructor.name; if (v.host) return v.ctorName;
        return 'Object';
      };
      const objProto = this.hiddenObj('Object.prototype', {
        toString: this.native('toString', self => `[object ${tagOf(self)}]`),
        hasOwnProperty: this.native('hasOwnProperty', (self, a) => self instanceof JSObject && (self.props.has(I.toKey(a[0])) || I.ownKeys(self).includes(I.toKey(a[0])))),
        isPrototypeOf: this.native('isPrototypeOf', (self, a) => { for (let x = a[0] && a[0].proto; x; x = x.proto) if (x === self) return true; return false; }),
        valueOf: this.native('valueOf', self => self),
      });
      Obj.props.set('prototype', objProto);
      const descOf = (o, k) => {
        if (!(o instanceof JSObject)) return undefined;
        let v;
        if (o.kind === 'array' && isIndex(k) && +k < o.items.length) v = o.items[+k];
        else if (o.kind === 'array' && k === 'length') v = o.items.length;
        else if (!o.props.has(k)) return undefined;
        else v = o.props.get(k);
        const at = (o.attrs && o.attrs.get(k)) || {};
        const d = this.alloc('object');
        if (v instanceof Accessor) { d.props.set('get', v.get || undefined); d.props.set('set', v.set || undefined); }
        else { d.props.set('value', v); d.props.set('writable', o.frozen ? false : at.writable !== false); }
        d.props.set('enumerable', at.enumerable !== false);
        d.props.set('configurable', o.frozen || o.sealed ? false : at.configurable !== false);
        return d;
      };
      const define = (o, k, d, node) => {
        if (!(o instanceof JSObject)) throw this.makeError('TypeError', 'Object.defineProperty called on non-object', node);
        const key = this.toKey(k);
        const existed = o.props.has(key);
        const old = (o.attrs && o.attrs.get(key)) || (existed ? { writable: true, enumerable: true, configurable: true } : { writable: false, enumerable: false, configurable: false });
        if (existed && old.configurable === false) throw this.makeError('TypeError', `Cannot redefine property: ${keyText(key)}`, node);
        const has = n => d instanceof JSObject && (d.props.has(n) || this.ownKeys(d).includes(n));
        const get = has('get') ? this.getMember(d, 'get') : undefined, set = has('set') ? this.getMember(d, 'set') : undefined;
        if (this.isCallable(get) || this.isCallable(set)) o.props.set(key, new Accessor(this.isCallable(get) ? get : null, this.isCallable(set) ? set : null));
        else if (has('value') || !existed) o.props.set(key, this.getMember(d, 'value'));
        const at = {
          writable: has('writable') ? this.truthy(this.getMember(d, 'writable')) : old.writable,
          enumerable: has('enumerable') ? this.truthy(this.getMember(d, 'enumerable')) : old.enumerable,
          configurable: has('configurable') ? this.truthy(this.getMember(d, 'configurable')) : old.configurable,
        };
        o.attrs = o.attrs || new Map();
        o.attrs.set(key, at);
        this.changedProp = { id: o.id, key: keyText(key) };
        return at;
      };
      Obj.props.set('defineProperty', this.native('defineProperty', function (s, a, node) {
        const at = define(a[0], a[1], a[2], node);
        const flags = Object.entries(at).filter(([, v]) => !v).map(([k]) => k);
        this.record(node, `🔧 <code>Object.defineProperty</code> sets ${code(keyText(this.toKey(a[1])))} on object #${a[0].id}${flags.length ? ` — not ${flags.join(', not ')}` : ''}. (${at.writable ? '' : 'Read-only: assignments are ignored, or throw in strict mode. '}${at.enumerable ? '' : 'Hidden from Object.keys, for…in and JSON. '}${at.configurable ? '' : 'It can never be deleted or redefined.'})`, 'heap');
        return a[0];
      }));
      Obj.props.set('defineProperties', this.native('defineProperties', (s, a, node) => { I.ownKeys(a[1]).forEach(k => define(a[0], k, I.getMember(a[1], k), node)); return a[0]; }));
      Obj.props.set('getOwnPropertyDescriptor', this.native('getOwnPropertyDescriptor', (s, a) => descOf(a[0], I.toKey(a[1]))));
      Obj.props.set('getOwnPropertyDescriptors', this.native('getOwnPropertyDescriptors', (s, a) => {
        const o = I.alloc('object');
        if (a[0] instanceof JSObject) [...a[0].props.keys()].filter(k => typeof k === 'string').forEach(k => o.props.set(k, descOf(a[0], k)));
        return o;
      }));
      Obj.props.set('seal', this.native('seal', function (s, a, node) { if (a[0] instanceof JSObject) { a[0].sealed = true; this.record(node, `🔒 <code>Object.seal</code>: object #${a[0].id} keeps its properties (they can still change), but none can be <b>added or removed</b>.`, 'heap'); } return a[0]; }));
      Obj.props.set('isSealed', this.native('isSealed', (s, a) => !(a[0] instanceof JSObject) || !!(a[0].sealed || a[0].frozen)));
      Obj.props.set('preventExtensions', this.native('preventExtensions', (s, a) => { if (a[0] instanceof JSObject) a[0].noExtend = true; return a[0]; }));
      Obj.props.set('isExtensible', this.native('isExtensible', (s, a) => a[0] instanceof JSObject && !(a[0].noExtend || a[0].sealed || a[0].frozen)));
      Obj.props.set('hasOwn', this.native('hasOwn', (s, a) => a[0] instanceof JSObject && (a[0].props.has(I.toKey(a[1])) || I.ownKeys(a[0]).includes(I.toKey(a[1])))));
      const groupBy = asMap => this.native('groupBy', function (s, a, node) {
        const out = asMap ? this.alloc('map') : this.alloc('object');
        if (asMap) { out.map = new Map(); out.ctorName = 'Map'; } else out.proto = null;
        this.iterable(a[0], node).forEach((v, i) => {
          const k = this.callFunction(a[1], undefined, [v, i], node);
          const key = asMap ? k : this.toKey(k);
          const bag = asMap ? out.map.get(key) : out.props.get(key);
          if (bag) bag.items.push(v);
          else if (asMap) out.map.set(key, this.makeArray([v])); else out.props.set(key, this.makeArray([v]));
        });
        return out;
      });
      Obj.props.set('groupBy', groupBy(false));
      B.get('Map').props.set('groupBy', groupBy(true));

      // ---- binary data
      TYPED.filter(n => typeof window[n] === 'function').forEach(n => {
        const ctor = this.native(n, function (s, a, node) {
          if (s !== CONSTRUCT) throw this.makeError('TypeError', `Constructor ${n} requires 'new'`, node);
          const Real = window[n], big = n.startsWith('Big');
          const x = a[0];
          let ta;
          if (x instanceof JSObject && x.kind === 'buffer') ta = new Real(x.buf, a[1] === undefined ? 0 : this.toNumber(a[1]), a[2] === undefined ? undefined : this.toNumber(a[2]));
          else if (x instanceof JSObject && x.kind === 'typed') ta = new Real(x.ta);
          else if (x instanceof JSObject) ta = Real.from(this.iterable(x, node).map(v => (big ? BigInt(v) : this.toNumber(v))));
          else ta = new Real(x === undefined ? 0 : this.toNumber(x));
          const o = this.wrapTyped(ta);
          this.badge('binary');
          this.record(node, `🔢 <code>new ${n}</code> #${o.id}: ${ta.length} slot${ta.length === 1 ? '' : 's'} of ${ta.BYTES_PER_ELEMENT} byte${ta.BYTES_PER_ELEMENT > 1 ? 's' : ''} each, backed by a raw ArrayBuffer of ${ta.byteLength} bytes. Values are <b>forced to fit</b> the type (a Uint8 slot can only hold 0–255).`, 'heap');
          return o;
        }, { isCtor: true, typedName: n });
        ctor.props.set('BYTES_PER_ELEMENT', window[n].BYTES_PER_ELEMENT);
        ctor.props.set('from', this.native('from', function (s, a, node) { return this.construct(ctor, [this.makeArray(this.iterable(a[0], node))], node); }));
        B.set(n, ctor);
      });
      const AB = this.native('ArrayBuffer', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Constructor ArrayBuffer requires 'new'", node);
        const o = this.wrapBuffer(new ArrayBuffer(this.toNumber(a[0] || 0)));
        this.badge('binary');
        this.record(node, `🔢 <code>new ArrayBuffer</code> #${o.id} reserves ${o.buf.byteLength} raw bytes. You can't read it directly: you look at it through a <b>view</b> (a typed array or DataView).`, 'heap');
        return o;
      }, { isCtor: true, typedName: '' });
      AB.props.set('isView', this.native('isView', (s, a) => a[0] instanceof JSObject && (a[0].kind === 'typed' || (a[0].host instanceof DataView))));
      B.set('ArrayBuffer', AB);
      const hostCtor = (name, make) => B.set(name, this.native(name, function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', `Failed to construct '${name}': Please use the 'new' operator`, node);
        let real;
        try { real = make(a.map(x => this.hostArg(x))); } catch (e) { throw this.makeError(e.name === 'RangeError' ? 'RangeError' : 'TypeError', e.message, node); }
        const o = this.hostObj(real);
        if (name === 'URL') this.record(node, `🔗 <code>new URL</code> #${o.id} splits the address into parts: protocol ${code(real.protocol)}, host ${code(real.host)}, path ${code(real.pathname)}${real.search ? ', query ' + code(real.search) : ''}.`, 'heap');
        return o;
      }, { isCtor: true, hostName: name }));
      hostCtor('DataView', a => new DataView(...a));
      hostCtor('TextEncoder', () => new TextEncoder());
      hostCtor('TextDecoder', a => new TextDecoder(...a));
      hostCtor('URL', a => new URL(...a));
      hostCtor('URLSearchParams', a => new URLSearchParams(...a));
      B.get('URL').props.set('canParse', this.native('canParse', (s, a) => { try { new URL(...a.map(x => I.hostArg(x))); return true; } catch (e) { return false; } }));

      // ---- AbortController / AbortSignal
      B.set('AbortController', this.native('AbortController', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Failed to construct 'AbortController': Please use the 'new' operator", node);
        const c = this.alloc('object');
        c.ctorName = 'AbortController';
        const sig = this.makeSignal();
        c.props.set('signal', sig);
        c.props.set('abort', this.native('abort', function (s2, a2, n2) { this.abortSignal(sig, a2.length && a2[0] !== undefined ? a2[0] : this.abortError('AbortError', 'This operation was aborted'), n2); }));
        this.record(node, `🛑 <code>new AbortController</code> #${c.id} comes with a <b>signal</b> #${sig.id}. Pass the signal to fetch (or anything that supports it); calling <code>abort()</code> cancels all of them.`, 'heap');
        return c;
      }, { isCtor: true }));
      const AS = this.native('AbortSignal', function (s, a, node) { throw this.makeError('TypeError', 'Illegal constructor', node); }, { isCtor: true });
      AS.props.set('timeout', this.native('timeout', function (s, a, node) {
        const sig = this.makeSignal();
        const ms = this.toNumber(a[0] || 0);
        const t = { id: ++this.timerSeq, cb: null, args: [], delay: ms, start: this.time, fireAt: this.time + ms, label: `⏱ AbortSignal.timeout(${ms})`, kind: 'timeout', refs: [sig] };
        t.internal = () => this.abortSignal(sig, this.abortError('TimeoutError', 'The operation timed out.'), null);
        this.webApis.push(t);
        return sig;
      }));
      AS.props.set('abort', this.native('abort', function () { const sig = this.makeSignal(); sig.aborted = true; sig.props.set('aborted', true); sig.props.set('reason', this.abortError('AbortError', 'This operation was aborted')); return sig; }));
      B.set('AbortSignal', AS);

      // ---- crypto (seeded, so replays stay identical)
      const hex = n => Array.from({ length: n }, () => Math.floor(I.rand() * 16).toString(16)).join('');
      B.set('crypto', this.hiddenObj('crypto', {
        randomUUID: this.native('randomUUID', () => `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(I.rand() * 4)]}${hex(3)}-${hex(12)}`),
        getRandomValues: this.native('getRandomValues', (s, a, node) => {
          if (!(a[0] instanceof JSObject) || a[0].kind !== 'typed') throw I.makeError('TypeError', 'getRandomValues needs a typed array', node);
          const ta = a[0].ta;
          for (let i = 0; i < ta.length; i++) ta[i] = typeof ta[0] === 'bigint' ? BigInt(Math.floor(I.rand() * 2 ** 32)) : Math.floor(I.rand() * 2 ** (8 * ta.BYTES_PER_ELEMENT));
          return a[0];
        }),
      }));

      // ---- Web Workers
      B.set('Worker', this.native('Worker', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Failed to construct 'Worker': Please use the 'new' operator", node);
        const name = this.toStr(a[0]).replace(/^\.?\//, '');
        const file = (this.workerFiles || []).find(f => f.name === name);
        if (!file) throw this.makeError('Error', `Cannot find worker script '${name}'. Add a "// @file ${name}" section (worker file names must contain "worker").`, node);
        return this.createWorker(name, file, node);
      }, { isCtor: true }));
    }

    // ======================================================== helpers for the new built-ins
    rootScope(ctx) { let s = ctx && ctx.currentScope; while (s && s.parent) s = s.parent; return s; }

    abortError(name, msg) { const e = this.makeErrorObj(name, msg); e.ctorName = 'DOMException'; return e; }

    makeSignal() {
      const sig = this.alloc('object');
      sig.ctorName = 'AbortSignal';
      sig.isSignal = true;
      sig.sigListeners = [];
      sig.pendingOps = [];
      sig.props.set('aborted', false);
      sig.props.set('reason', undefined);
      sig.props.set('onabort', null);
      sig.props.set('addEventListener', this.native('addEventListener', (s, a) => { if (this.toStr(a[0]) === 'abort') sig.sigListeners.push(a[1]); }));
      sig.props.set('throwIfAborted', this.native('throwIfAborted', function () { if (sig.aborted) throw new ThrowSignal(sig.props.get('reason'), null); }));
      return sig;
    }

    // connect a pending fetch to an AbortSignal (called from both fetch implementations)
    bindAbort(t, p, opts, node) {
      if (!(opts instanceof JSObject)) return;
      const sig = this.getMember(opts, 'signal');
      if (!(sig instanceof JSObject) || !sig.isSignal) return;
      if (sig.aborted) {
        this.webApis = this.webApis.filter(x => x !== t);
        p.alreadyResolved = true;
        this.settle(p, 'rejected', sig.props.get('reason'), node, ' (its signal was already aborted)');
        return;
      }
      t.signal = sig;
      sig.pendingOps.push({ t, p });
    }

    abortSignal(sig, reason, node) {
      if (sig.aborted) return;
      sig.aborted = true;
      sig.props.set('aborted', true);
      sig.props.set('reason', reason);
      this.changedProp = { id: sig.id, key: 'aborted' };
      const ops = sig.pendingOps.filter(o => this.webApis.includes(o.t) || this.queue.includes(o.t));
      this.record(node, `🛑 The signal #${sig.id} is now <b>aborted</b>${ops.length ? `: ${ops.length} pending request${ops.length > 1 ? 's are' : ' is'} cancelled, and ${ops.length > 1 ? 'their promises reject' : 'its promise rejects'} with ${code(this.display(reason, 0, true))}` : ''}.`, 'webapi');
      for (const o of ops) {
        this.webApis = this.webApis.filter(x => x !== o.t);
        this.queue = this.queue.filter(x => x !== o.t);
        o.p.alreadyResolved = true;
        this.settle(o.p, 'rejected', reason, null, ' (aborted)');
      }
      const ev = this.fromNative({ type: 'abort' });
      const on = sig.props.get('onabort');
      [...sig.sigListeners, on].filter(f => this.isCallable(f)).forEach(f => this.callFunction(f, sig, [ev], f.node || node));
    }

    // a deep copy, like the browser's structured clone algorithm
    cloneValue(v, node, seen) {
      if (!(v instanceof JSObject)) {
        if (v instanceof JSSymbol) throw this.makeError('DataCloneError', `${v} could not be cloned.`, node);
        return v;
      }
      if (seen.has(v)) return seen.get(v);
      if (this.isCallable(v)) throw this.makeError('DataCloneError', `${this.display(v)} could not be cloned (functions can't be copied).`, node);
      if (v.isPromise || v.domNode || v.isProxy || v.hidden) throw this.makeError('DataCloneError', `${this.display(v, 0, false, 1)} could not be cloned.`, node);
      let c;
      if (v.kind === 'array') { c = this.makeArray([]); seen.set(v, c); v.items.forEach(x => c.items.push(this.cloneValue(x, node, seen))); return c; }
      if (v.kind === 'map') { c = this.alloc('map'); c.ctorName = 'Map'; c.map = new Map(); seen.set(v, c); v.map.forEach((x, k) => c.map.set(this.cloneValue(k, node, seen), this.cloneValue(x, node, seen))); return c; }
      if (v.kind === 'set') { c = this.alloc('set'); c.ctorName = 'Set'; c.set = new Set(); seen.set(v, c); v.set.forEach(x => c.set.add(this.cloneValue(x, node, seen))); return c; }
      if (v.kind === 'date') { c = this.alloc('date'); c.d = new Date(v.d.getTime()); return c; }
      if (v.kind === 'regexp') return this.makeRegExp(new RegExp(v.re.source, v.re.flags));
      if (v.kind === 'typed') return this.wrapTyped(v.ta.slice());
      if (v.kind === 'buffer') return this.wrapBuffer(v.buf.slice(0));
      if (v.isError) { c = this.makeErrorObj(v.props.get('name'), v.props.get('message')); return c; }
      c = this.alloc('object');
      seen.set(v, c);
      // class instances lose their prototype: only the own data is copied
      this.ownKeys(v).forEach(k => c.props.set(k, this.cloneValue(this.getMember(v, k, node), node, seen)));
      return c;
    }

    // ---- typed arrays, buffers and wrapped browser objects (URL, DataView, ...)
    wrapTyped(ta) {
      this.taObjs = this.taObjs || new Map();
      if (this.taObjs.has(ta)) return this.taObjs.get(ta);
      const o = this.alloc('typed');
      o.ta = ta; o.ctorName = ta.constructor.name;
      this.taObjs.set(ta, o);
      return o;
    }
    wrapBuffer(buf) {
      this.bufObjs = this.bufObjs || new Map();
      if (this.bufObjs.has(buf)) return this.bufObjs.get(buf);
      const o = this.alloc('buffer');
      o.buf = buf; o.ctorName = 'ArrayBuffer';
      this.bufObjs.set(buf, o);
      return o;
    }
    hostObj(r) {
      this.hostObjs = this.hostObjs || new Map();
      if (this.hostObjs.has(r)) return this.hostObjs.get(r);
      const o = this.alloc('object');
      o.host = r; o.ctorName = r.constructor.name;
      this.hostObjs.set(r, o);
      return o;
    }
    hostArg(x) {
      if (x instanceof JSObject) {
        if (x.kind === 'typed') return x.ta;
        if (x.kind === 'buffer') return x.buf;
        if (x.host) return x.host;
      }
      return this.natArg(x);
    }
    wrapHost(r) {
      if (r === null || r === undefined || (typeof r !== 'object' && typeof r !== 'function')) return r;
      if (ArrayBuffer.isView(r) && !(r instanceof DataView)) return this.wrapTyped(r);
      if (r instanceof ArrayBuffer) return this.wrapBuffer(r);
      if (Array.isArray(r)) return this.makeArray(r.map(x => this.wrapHost(x)));
      if (typeof r.next === 'function' && typeof r[Symbol.iterator] === 'function') return this.listIterator([...r].map(x => this.wrapHost(x)), r[Symbol.toStringTag] || 'Iterator');
      if (r instanceof URL || r instanceof URLSearchParams || r instanceof DataView || r instanceof TextEncoder || r instanceof TextDecoder) return this.hostObj(r);
      return this.fromNative(JSON.parse(JSON.stringify(r)));
    }

    natArg(x) {
      if (x instanceof JSObject && (x.kind === 'typed' || x.kind === 'buffer' || x.host)) return this.hostArg(x);
      return base.natArg.call(this, x);
    }

    platformGet(obj, key, node) {
      const I = this;
      if (obj.kind === 'typed') {
        const ta = obj.ta;
        if (key === SYM_ITER) return this.method('typed', '@@iterator', self => I.listIterator([...self.ta], 'Array Iterator'));
        if (typeof key !== 'string') return undefined;
        if (isIndex(key)) return ta[+key];
        if (['length', 'byteLength', 'byteOffset', 'BYTES_PER_ELEMENT'].includes(key)) return ta[key];
        if (key === 'buffer') return this.wrapBuffer(ta.buffer);
        const withCb = ['map', 'filter', 'forEach', 'reduce', 'find', 'findIndex', 'some', 'every'];
        if (withCb.includes(key)) {
          return this.method('typed', key, function (self, a, n) {
            const items = [...self.ta], fn = a[0];
            if (!this.isCallable(fn)) throw this.makeError('TypeError', `${this.display(fn)} is not a function`, n);
            const call = (x, i) => this.callFunction(fn, undefined, [x, i, self], n);
            if (key === 'forEach') { items.forEach(call); return undefined; }
            if (key === 'map') { const out = new self.ta.constructor(items.length); items.forEach((x, i) => { out[i] = call(x, i); }); return this.wrapTyped(out); }
            if (key === 'filter') return this.wrapTyped(self.ta.constructor.from(items.filter((x, i) => this.truthy(call(x, i)))));
            if (key === 'find') return items.find((x, i) => this.truthy(call(x, i)));
            if (key === 'findIndex') return items.findIndex((x, i) => this.truthy(call(x, i)));
            if (key === 'some') return items.some((x, i) => this.truthy(call(x, i)));
            if (key === 'every') return items.every((x, i) => this.truthy(call(x, i)));
            let acc = a.length > 1 ? a[1] : items[0];
            for (let i = a.length > 1 ? 0 : 1; i < items.length; i++) acc = this.callFunction(fn, undefined, [acc, items[i], i, self], n);
            return acc;
          });
        }
        if (typeof ta[key] === 'function') {
          return this.method('typed', key, function (self, a, n) {
            const args = key === 'sort' && this.isCallable(a[0]) ? [(x, y) => this.toNumber(this.callFunction(a[0], undefined, [x, y], n))] : a.map(x => this.hostArg(x));
            const r = self.ta[key](...args);
            if (['set', 'fill', 'reverse', 'sort', 'copyWithin'].includes(key)) this.changedProp = { id: self.id, key: '0' };
            return r === self.ta ? self : this.wrapHost(r);
          });
        }
        return undefined;
      }
      if (obj.kind === 'buffer') {
        if (key === 'byteLength') return obj.buf.byteLength;
        if (key === 'slice') return this.method('buffer', 'slice', (self, a) => I.wrapBuffer(self.buf.slice(...a.map(x => I.toNumber(x)))));
        return undefined;
      }
      if (obj.host) {
        const r = obj.host;
        if (key === SYM_ITER && typeof r[Symbol.iterator] === 'function') return this.method('host', '@@iterator', self => I.listIterator([...self.host].map(x => I.wrapHost(x)), 'Iterator'));
        if (typeof key !== 'string' || !(key in r)) return undefined;
        const v = r[key];
        if (typeof v === 'function') {
          return this.method('host', obj.ctorName + '.' + key, function (self, a, n) {
            let res;
            try { res = self.host[key](...a.map(x => this.hostArg(x))); } catch (e) { throw this.makeError(e.name === 'RangeError' ? 'RangeError' : 'TypeError', e.message, n); }
            if (/^(set|append|delete|sort)$/.test(key)) { this.changedProp = { id: self.id, key: 'href' }; this.record(n, `🔧 <code>.${key}()</code> changes ${code(self.ctorName)} #${self.id} → ${code(String(self.host))}`, 'heap'); }
            return this.wrapHost(res);
          });
        }
        return this.wrapHost(v);
      }
      return undefined;
    }

    platformSet(obj, key, value, node) {
      if (obj.kind === 'typed') {
        if (typeof key === 'string' && isIndex(key)) {
          if (+key >= obj.ta.length) return true; // out of range: silently ignored, like real typed arrays
          obj.ta[+key] = typeof obj.ta[0] === 'bigint' ? BigInt(value) : this.toNumber(value);
          this.lastAssigned = obj.ta[+key];
          this.changedProp = { id: obj.id, key: String(key) };
          return true;
        }
        return true;
      }
      if (obj.host && typeof key === 'string' && key in obj.host) {
        try { obj.host[key] = this.hostArg(value); } catch (e) { throw this.makeError('TypeError', e.message, node); }
        this.changedProp = { id: obj.id, key: 'href' };
        return true;
      }
      return false;
    }

    hasInstanceHook(l, r, node) {
      if (!(r instanceof JSObject)) return undefined;
      for (let o = r; o; o = o.proto) {
        const h = o.props.get(SYM_HAS_INSTANCE);
        if (this.isCallable(h)) {
          this.record(node, `🧪 <code>instanceof</code> asks ${code(this.fnLabel(r))}'s <code>[Symbol.hasInstance]</code> method instead of checking the prototype chain.`, 'native');
          return this.truthy(this.callFunction(h, r, [l], node));
        }
      }
      if (!(l instanceof JSObject)) return undefined;
      if (r.typedName !== undefined) return r.typedName === '' ? l.kind === 'buffer' : l.kind === 'typed' && l.ta.constructor.name === r.typedName;
      if (r.hostName) return !!l.host && l.host instanceof window[r.hostName];
      return undefined;
    }

    // ---- display, conversion and Heap cards for the new kinds of objects
    display(v, depth = 0, top = false, maxDepth = 2) {
      if (v instanceof JSObject) {
        if (v.kind === 'typed') { const xs = [...v.ta].slice(0, 20).map(x => (typeof x === 'bigint' ? x + 'n' : String(x))); return `${v.ta.constructor.name}(${v.ta.length}) [${xs.join(', ')}${v.ta.length > 20 ? ', …' : ''}]`; }
        if (v.kind === 'buffer') return `ArrayBuffer { byteLength: ${v.buf.byteLength} }`;
        if (v.host) {
          if (v.host instanceof URL) return `URL {href: '${v.host.href}'}`;
          if (v.host instanceof URLSearchParams) return `URLSearchParams {${[...v.host].map(([k, x]) => `'${k}' => '${x}'`).join(', ')}}`;
          return `${v.ctorName} {}`;
        }
      }
      return base.display.call(this, v, depth, top, maxDepth);
    }

    toStr(v) {
      if (v instanceof JSObject) {
        if (v.kind === 'typed') return [...v.ta].join(',');
        if (v.kind === 'buffer') return '[object ArrayBuffer]';
        if (v.host) return String(v.host);
      }
      const s = base.toStr.call(this, v);
      if (s === '[object Object]' && v instanceof JSObject) {
        const tag = this.getMember(v, SYM_TAG);
        if (typeof tag === 'string') return `[object ${tag}]`;
      }
      return s;
    }

    getIterator(v, node) {
      if (v instanceof JSObject && (v.kind === 'typed' || (v.host && typeof v.host[Symbol.iterator] === 'function'))) {
        const items = v.kind === 'typed' ? [...v.ta] : [...v.host].map(x => this.wrapHost(x));
        let i = 0;
        return { next: () => (i < items.length ? { done: false, value: items[i++] } : { done: true }), return: () => {} };
      }
      return base.getIterator.call(this, v, node);
    }

    arrayMethod(name) {
      const I = this;
      const copy = arr => arr.items.slice();
      const t = {
        toSorted: (arr, a, node) => { const out = I.makeArray(copy(arr)); I.arrayMethod('sort').fn.call(I, out, a, node); return out; },
        toReversed: arr => I.makeArray(copy(arr).reverse()),
        toSpliced: (arr, a) => { const c = copy(arr); c.splice(...a); return I.makeArray(c); },
        with: (arr, a, node) => {
          const i = I.toNumber(a[0]), idx = i < 0 ? arr.items.length + i : i;
          if (idx < 0 || idx >= arr.items.length) throw I.makeError('RangeError', 'Invalid index : ' + i, node);
          const c = copy(arr); c[idx] = a[1]; return I.makeArray(c);
        },
      };
      if (Object.prototype.hasOwnProperty.call(t, name)) return this.method('arr2', name, (self, a, node) => t[name](self, a, node));
      return base.arrayMethod.call(this, name);
    }

    serExtra(o, b) {
      if (o.kind === 'typed') {
        const ta = o.ta;
        return Object.assign(b, { title: `${ta.constructor.name}(${ta.length})`, entries: [...ta].slice(0, 24).map((x, i) => ({ k: String(i), v: this.serValue(x) })).concat([{ k: 'bytes', v: { t: 'num', text: `${ta.byteLength} (${ta.BYTES_PER_ELEMENT} per slot)` } }]) });
      }
      if (o.kind === 'buffer') {
        const bytes = [...new Uint8Array(o.buf).slice(0, 16)].map(x => x.toString(16).padStart(2, '0')).join(' ');
        return Object.assign(b, { title: 'ArrayBuffer', entries: [{ k: 'byteLength', v: this.serValue(o.buf.byteLength) }, { k: 'bytes', v: { t: 'str', text: bytes + (o.buf.byteLength > 16 ? ' …' : '') } }] });
      }
      if (o.host) {
        const r = o.host;
        let entries = [];
        if (r instanceof URL) entries = ['href', 'protocol', 'host', 'pathname', 'search', 'hash'].filter(k => r[k]).map(k => ({ k, v: this.serValue(r[k]) }));
        else if (r instanceof URLSearchParams) entries = [...r].slice(0, 20).map(([k, x]) => ({ k, v: this.serValue(x) }));
        else if (r instanceof DataView) entries = [{ k: 'byteLength', v: this.serValue(r.byteLength) }];
        else if (r.encoding) entries = [{ k: 'encoding', v: this.serValue(r.encoding) }];
        return Object.assign(b, { title: o.ctorName, entries });
      }
      if (o.isWorker) return Object.assign(b, { title: `Worker (${o.realm.name})`, entries: [{ k: 'thread', v: { t: 'str', text: o.terminated ? 'terminated' : 'running separately' } }] });
      return base.serExtra.call(this, o, b);
    }

    serObj(o, garbage) {
      const r = base.serObj.call(this, o, garbage);
      if (o.kind === 'object' && !o.isPromise && !o.domNode && !o.host && !o.isError && !o.hidden) r.shape = this.shapeOf(o);
      if (o.kind === 'function') r.calls = o.calls || 0;
      return r;
    }

    // ======================================================== engine internals (simulated)
    // Objects with the same property names, added in the same order, share a hidden class ("shape").
    shapeOf(o) {
      this.shapes = this.shapes || new Map();
      const key = (o.proto ? 'p' + o.proto.id : '') + '|' + [...o.props.keys()].filter(k => typeof k === 'string').join(',');
      if (!this.shapes.has(key)) this.shapes.set(key, 'S' + (this.shapes.size + 1));
      return this.shapes.get(key);
    }
    // Every property read in the code remembers which shapes it has seen (an "inline cache").
    noteIC(node, obj, key) {
      if (!node || node.sourceFile || !node.loc || typeof key !== 'string') return;
      this.icSites = this.icSites || new Map();
      let s = this.icSites.get(node.start);
      if (!s) { s = { line: node.loc.start.line, text: this.snip(node, 28), shapes: new Set(), hits: 0 }; this.icSites.set(node.start, s); }
      s.shapes.add(this.shapeOf(obj));
      s.hits++;
    }
    icSummary() {
      if (!this.icSites) return null;
      return [...this.icSites.values()].slice(-12).map(s => ({ line: s.line, text: s.text, shapes: s.shapes.size, hits: s.hits }));
    }

    // ======================================================== dynamic import()
    dynamicImport(spec, node) {
      const p = this.newPromise();
      this.badge('module');
      const byName = this.moduleMap;
      if (!byName) {
        p.alreadyResolved = true;
        this.settle(p, 'rejected', this.makeErrorObj('TypeError', `Failed to resolve module '${spec}'. Write the module as a "// @file name.js" section.`), node);
        return p;
      }
      let mod;
      try { mod = this.resolveModule(spec, byName, node); }
      catch (e) { if (!(e instanceof ThrowSignal)) throw e; p.alreadyResolved = true; this.settle(p, 'rejected', e.value, node); return p; }
      const t = { id: ++this.timerSeq, cb: null, args: [], delay: 5, start: this.time, fireAt: this.time + 5, label: `📦 load ${mod.name}`, kind: 'module', refs: [p] };
      t.doneMsg = () => `📦 ${code(mod.name)} has been downloaded. The engine queues a task to run it.`;
      t.internal = () => {
        this.evalModule(mod, byName, node, () => {
          if (mod.failed) { p.alreadyResolved = true; this.settle(p, 'rejected', this.makeErrorObj('Error', `Module ${mod.name} failed`), null); }
          else this.resolvePromise(p, this.namespaceObj(mod, node), null);
        });
      };
      this.webApis.push(t);
      this.record(node, `📦 <code>import("${esc(spec)}")</code> loads ${code(mod.name)} <b>on demand</b> and immediately returns Promise #${p.id}. The module runs only when it is first needed (this is how apps "lazy-load" code).`, 'webapi');
      return p;
    }

    // ======================================================== Web Workers
    createWorker(name, file, node) {
      const w = this.alloc('object');
      w.ctorName = 'Worker';
      w.isWorker = true;
      w.wListeners = [];
      const scope = this.newScope('worker', `worker ${name}`, null, null);
      const self = this.alloc('object');
      self.ctorName = 'WorkerGlobalScope';
      self.wListeners = [];
      scope.workerGlobals = new Map([
        ['self', self],
        ['postMessage', this.native('postMessage', function (s, a, n) { this.workerPost(w, 'toMain', a[0], n); })],
        ['close', this.native('close', function (s, a, n) { w.terminated = true; this.record(n, '🧵 The worker closes itself — it will not receive more messages.', 'webapi'); })],
      ]);
      self.props.set('postMessage', scope.workerGlobals.get('postMessage'));
      self.props.set('addEventListener', this.native('addEventListener', (s, a) => { if (this.toStr(a[0]) === 'message') self.wListeners.push(a[1]); }));
      w.realm = { scope, self, name, file, started: false };
      w.props.set('postMessage', this.native('postMessage', function (s, a, n) { this.workerPost(w, 'toWorker', a[0], n); }));
      w.props.set('terminate', this.native('terminate', function (s, a, n) {
        w.terminated = true;
        this.webApis = this.webApis.filter(t => t.worker !== w);
        this.record(n, `🧵 <code>terminate()</code> stops the worker thread immediately. Pending messages are dropped.`, 'webapi');
      }));
      w.props.set('addEventListener', this.native('addEventListener', (s, a) => { if (this.toStr(a[0]) === 'message') w.wListeners.push(a[1]); }));
      this.workers.push(w);
      this.badge('worker');
      const t = { id: ++this.timerSeq, cb: null, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: `🧵 start ${name}`, kind: 'worker', worker: w };
      t.doneMsg = () => `🧵 The new thread is ready to run ${code(name)}.`;
      t.internal = () => this.runWorkerScript(w);
      this.webApis.push(t);
      this.record(node, `🧵 <code>new Worker("${esc(name)}")</code> #${w.id} starts a <b>separate thread</b> with its <b>own memory</b> and its own event loop. It can't see your variables or the page — the two sides talk only by <b>messages</b>, and messages are <b>copied</b>.`, 'webapi');
      return w;
    }

    runWorkerScript(w) {
      const r = w.realm, f = r.file;
      const masked = this.src.split('').map((c, i) => (i >= f.start && i < f.end) || c === '\n' ? c : ' ').join('');
      let ast;
      try { ast = window.acorn.parse(masked, { ecmaVersion: 2022, locations: true, sourceType: 'script' }); }
      catch (e) { this.record(null, `💥 SyntaxError in ${code(r.name)}: ${esc(e.message)}`, 'error'); return; }
      r.started = true;
      const ctx = { id: ++this.ctxSeq, name: `🧵 ${r.name}`, phase: 'creation', funcScope: r.scope, currentScope: r.scope, isGlobal: false, isWorker: true, thisVal: r.self, looked: new Set(), strict: false };
      r.scope.owner = ctx;
      this.stack.push(ctx);
      this.record(R0(f.start, this), `🧵 The worker thread runs ${code(r.name)} in its <b>own global scope</b>. (A real browser runs it truly <b>in parallel</b> on another CPU core; here its steps are shown one at a time.)`, 'push');
      this.hoist(this.collectVars(ast.body, []).concat(this.lexicalDecls(ast.body)), r.scope, ctx, false);
      ctx.phase = 'execution';
      try { this.runSync(this.execStatements(ast.body, ctx)); }
      catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else { this.removeCtx(ctx); throw e; } }
      this.removeCtx(ctx);
      this.record(null, `🧵 ${code(r.name)} finished its top-level code. The worker stays alive, waiting for messages.`, 'pop');
    }

    workerPost(w, dir, data, node) {
      const copy = this.cloneValue(data, node, new Map());
      const toWorker = dir === 'toWorker';
      const t = { id: ++this.timerSeq, cb: null, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: `✉️ message → ${toWorker ? 'worker' : 'main'}`, kind: 'worker', worker: w, refs: [copy] };
      t.doneMsg = () => `✉️ A message arrives at the ${toWorker ? 'worker' : 'main'} thread. A "message" event task is queued there.`;
      t.internal = () => {
        if (w.terminated && toWorker) return;
        const target = toWorker ? w.realm.self : w;
        const ev = this.alloc('object');
        ev.ctorName = 'MessageEvent';
        ev.props.set('data', copy);
        const handlers = [target.props.get('onmessage'), ...target.wListeners].filter(f => this.isCallable(f));
        this.record(null, handlers.length ? `✉️ The ${toWorker ? 'worker' : 'main thread'} handles the message: <code>event.data</code> is the <b>copy</b> ${this.valText(copy)}.` : `✉️ The message arrived, but nobody on the ${toWorker ? 'worker' : 'main'} side listens for "message".`, 'eventloop');
        handlers.forEach(fn => this.callFunction(fn, target, [ev], fn.node || null, 'queue'));
      };
      this.webApis.push(t);
      this.record(node, `✉️ <code>postMessage</code> sends a <b>copy</b> of ${this.valText(data)} to the ${toWorker ? 'worker' : 'main'} thread (structured clone). The two threads never share objects, so changing one side can't affect the other.`, 'webapi');
    }

    platformRoots(markV, markS, root) {
      (this.workers || []).forEach(w => root(`the worker ${w.realm.name}`, () => {
        markV(w); markV(w.realm.self);
        markS(w.realm.scope);
        w.realm.scope.workerGlobals.forEach(v => markV(v));
        w.wListeners.concat(w.realm.self.wListeners).forEach(f => markV(f));
      }));
      (this.immediates || []).forEach(t => root(`setImmediate ${t.label}`, () => { markV(t.cb); t.args.forEach(x => markV(x)); }));
      (this.tickQueue || []).forEach(t => root(`nextTick ${t.label}`, () => t.refs.forEach(x => markV(x))));
    }

    // ======================================================== Node.js mode ("// @env node")
    setupNode() {
      const I = this, B = this.builtins;
      this.nodeMode = true;
      this.tickQueue = [];
      this.immediates = [];
      ['document', 'window', 'alert', 'confirm', 'prompt', 'localStorage', 'sessionStorage', 'navigator', 'location', 'requestAnimationFrame', 'cancelAnimationFrame', 'simulateClick', 'simulateTyping', 'Worker'].forEach(n => B.delete(n));
      this.globalThisObj.label = 'global';
      B.set('global', this.globalThisObj);
      this.badge('node');
      const lazy = make => new Accessor(this.native('get', () => make()), null);
      const proc = this.hiddenObj('process', {
        platform: 'linux', version: 'v20.11.0', pid: 4242, exitCode: 0,
        env: this.hiddenObj('env', { NODE_ENV: 'development', HOME: '/home/user' }),
        cwd: this.native('cwd', () => '/home/user/app'),
        uptime: this.native('uptime', () => I.time / 1000),
        nextTick: this.native('nextTick', function (s, a, node) {
          const fn = a[0];
          if (!this.isCallable(fn)) throw this.makeError('TypeError', 'The "callback" argument must be of type function', node);
          const args = a.slice(1);
          this.tickQueue.push({ id: ++this.microSeq, label: 'nextTick: ' + this.fnLabel(fn), ref: fn.id > 0 ? fn.id : null, refs: [fn, ...args], run: () => this.callFunction(fn, undefined, args, fn.node || node, 'micro') });
          this.record(node, `🟢 <code>process.nextTick</code> puts ${code(this.fnLabel(fn))} in Node's <b>nextTick queue</b>. It runs as soon as the current code finishes — even <b>before</b> promise callbacks.`, 'promise');
        }),
      });
      proc.props.set('argv', lazy(() => I.makeArray(['/usr/bin/node', '/home/user/app/main.js'])));
      proc.props.set('memoryUsage', this.native('memoryUsage', () => I.fromNative({ heapUsed: I.heap.length * 64, heapTotal: 4194304 })));
      B.set('process', proc);
      B.set('setImmediate', this.native('setImmediate', function (s, a, node) {
        const fn = a[0];
        if (!this.isCallable(fn)) throw this.makeError('TypeError', 'The "callback" argument must be of type function', node);
        const t = { id: ++this.timerSeq, cb: fn, args: a.slice(1), label: 'setImmediate: ' + this.fnLabel(fn) };
        this.immediates.push(t);
        this.record(node, `🟢 <code>setImmediate</code> queues ${code(this.fnLabel(fn))} for the <b>check phase</b> of Node's event loop (right after it polls for I/O).`, 'webapi');
        return t.id;
      }));
      B.set('clearImmediate', this.native('clearImmediate', (s, a) => { I.immediates = I.immediates.filter(t => t.id !== a[0]); }));
      B.set('__dirname', '/home/user/app');
      B.set('__filename', '/home/user/app/main.js');
      B.set('require', this.native('require', function (s, a, node) {
        const name = this.toStr(a[0]).replace(/^node:/, '');
        if (name === 'events') return this.nodeEvents();
        if (name === 'util') return this.nodeUtil();
        if (name === 'timers/promises') return this.hiddenObj('timers/promises', {
          setTimeout: this.native('setTimeout', function (s2, a2, n2) {
            const p = this.newPromise();
            const done = this.native('resolve', function () { this.resolvePromise(p, a2[1], null); });
            this.setTimer([done, a2[0]], n2);
            return p;
          }),
        });
        throw this.makeError('Error', `Cannot find module '${name}'. Only events, util and timers/promises are simulated here (fs, http and path need a real Node.js).`, node);
      }));
    }

    nodeEvents() {
      if (this._EE) return this._EE;
      const file = { code: EMITTER_SRC, label: 'events (Node built-in)' };
      const ast = window.acorn.parse(EMITTER_SRC, { ecmaVersion: 2022, locations: true, sourceType: 'script', directSourceFile: file });
      this.silent = true;
      try { this._EE = this.runSync(this.defineClass(ast.body[0], this.globalCtx, false)); } finally { this.silent = false; }
      this._EE.props.set('EventEmitter', this._EE);
      return this._EE;
    }

    nodeUtil() {
      const I = this;
      return this.hiddenObj('util', {
        promisify: this.native('promisify', (s, a) => {
          const fn = a[0];
          return I.native('promisified ' + I.fnLabel(fn), function (s2, a2, n2) {
            const p = this.newPromise();
            const cb = this.native('callback', function (s3, a3) {
              if (a3[0] != null) { p.alreadyResolved = true; this.settle(p, 'rejected', a3[0], null); } else this.resolvePromise(p, a3[1], null);
            });
            this.callFunction(fn, s2, a2.concat([cb]), n2);
            return p;
          });
        }),
        inspect: this.native('inspect', (s, a) => I.display(a[0], 0, false, 3)),
      });
    }

    // Node: after each piece of work, ALL nextTicks run, then ALL promise jobs (and again if more ticks appeared)
    drainNode() {
      let first = true;
      const runJob = (list, what) => {
        const job = list[0];
        this.stage = 'eventloop';
        this.badge('micro');
        this.nextTask = job;
        this.record(null, first
          ? `🟢 The current code finished, so Node empties its queues: first <b>every process.nextTick</b> callback, then <b>every promise</b> callback. Next up (${what}): ${code(job.label)}`
          : `🟢 Node keeps going (${what}). Next up: ${code(job.label)}`, 'eventloop');
        list.shift();
        try { job.run(); } catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
        this.pending.clear();
        this.tempRoot = undefined;
        first = false;
      };
      while (this.tickQueue.length || this.microtasks.length) {
        while (this.tickQueue.length) runJob(this.tickQueue, 'nextTick queue');
        while (this.microtasks.length) runJob(this.microtasks, 'promise microtasks');
      }
      this.checkUnhandled();
    }

    nodePhase(name, filter) {
      const due = this.webApis.filter(t => t.fireAt <= this.time && filter(t)).sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
      if (!due.length) return 0;
      this.loopPhase = name;
      this.record(null, `🟢 Node's event loop enters the <b>${name} phase</b>: ${due.length} callback${due.length > 1 ? 's are' : ' is'} ready (${name === 'timers' ? 'expired setTimeout / setInterval timers' : 'finished I/O, such as network responses'}).`, 'eventloop');
      for (const t of due) {
        this.webApis.splice(this.webApis.indexOf(t), 1);
        if (t.interval) this.webApis.push(Object.assign({}, t, { start: this.time, fireAt: this.time + t.delay }));
        this.queue.push(t);
        this.nextTask = t;
        this.record(null, `🟢 ${name} phase → runs ${code(t.label)}.`, 'eventloop');
        this.queue.shift();
        try { if (t.internal) t.internal(); else this.callFunction(t.cb, undefined, t.args, t.cb.node || null, 'queue'); }
        catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
        this.pending.clear();
        this.drainMicrotasks();
      }
      return due.length;
    }

    runNodeLoop() {
      this.drainMicrotasks();
      const work = () => this.webApis.length || this.immediates.length;
      if (!work()) { this.stage = 'done'; return; }
      this.stage = 'eventloop';
      for (let guard = 0; work() && guard < 100000; guard++) {
        let ran = 0;
        ran += this.nodePhase('timers', t => !t.kind || t.kind === 'timeout' || t.kind === 'interval');
        ran += this.nodePhase('poll', t => t.kind && t.kind !== 'timeout' && t.kind !== 'interval');
        if (this.immediates.length) {
          this.loopPhase = 'check';
          const list = this.immediates.slice();
          this.record(null, `🟢 Node's event loop enters the <b>check phase</b>: ${list.length} setImmediate callback${list.length > 1 ? 's' : ''} to run.`, 'eventloop');
          for (const t of list) {
            this.nextTask = t;
            this.record(null, `🟢 check phase → runs ${code(t.label)}.`, 'eventloop');
            this.immediates.splice(this.immediates.indexOf(t), 1);
            try { this.callFunction(t.cb, undefined, t.args, t.cb.node || null, 'queue'); } catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
            this.pending.clear();
            this.drainMicrotasks();
            ran++;
          }
        }
        this.loopPhase = null;
        if (!ran) {
          const next = Math.min(...this.webApis.map(t => t.fireAt));
          if (!isFinite(next)) break;
          this.time = Math.max(this.time, next);
        }
      }
      this.stage = 'done';
    }
  });

  // a source range used for "the top of a file" highlights
  function R0(start, I) { return { start, end: start + 1, loc: { start: { line: I.lineAt(start) } } }; }
})();
