/* JS Engine Quest — engine part: built-in globals: console, Math, Object, Array, JSON, Symbol, Map/Set, RegExp, Date, BigInt, Proxy, Reflect, and the pretend browser (fetch, DOM, animation frames). */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== builtins
    native(name, fn, extra) { const f = new JSObject(-1, 'native'); f.name = name; f.fn = fn; return Object.assign(f, extra || {}); }
    hiddenObj(label, entries) {
      const o = new JSObject(-1, 'object'); o.hidden = true; o.label = label;
      Object.keys(entries).forEach(k => o.props.set(k, entries[k]));
      return o;
    }

    setupBuiltins() {
      const I = this, B = this.builtins;
      B.set('undefined', undefined); B.set('NaN', NaN); B.set('Infinity', Infinity);
      B.set('globalThis', this.globalThisObj); B.set('window', this.globalThisObj);

      const logger = type => this.native(type, function (self, args, node) {
        const text = '  '.repeat(this.consoleDepth || 0) + args.map(a => this.display(a, 0, true)).join(' ');
        this.consoleLines.push({ type, text });
        const icon = type === 'error' ? '🛑' : type === 'warn' ? '⚠️' : '🖨️';
        this.record(node, `${icon} <b>console.${type}</b> prints ${code(text)} in the Console.`, 'console');
      });
      const con = { log: logger('log'), info: logger('info'), warn: logger('warn'), error: logger('error'), debug: logger('log') };
      const push = (type, text, node, msg) => { this.consoleLines.push({ type, text }); this.record(node, msg || `🖨️ ${code(text)} appears in the Console.`, 'console'); };
      const counts = new Map(), timers = new Map();
      con.group = this.native('group', function (s, a, node) { push('group', '▾ ' + (a.length ? a.map(x => this.display(x, 0, true)).join(' ') : 'console.group'), node, '📂 <code>console.group</code> starts an indented group in the Console.'); this.consoleDepth = (this.consoleDepth || 0) + 1; });
      con.groupEnd = this.native('groupEnd', function () { this.consoleDepth = Math.max(0, (this.consoleDepth || 0) - 1); });
      con.count = this.native('count', function (s, a, node) { const k = a.length ? this.toStr(a[0]) : 'default'; counts.set(k, (counts.get(k) || 0) + 1); push('log', `${k}: ${counts.get(k)}`, node); });
      con.time = this.native('time', function (s, a) { timers.set(a.length ? this.toStr(a[0]) : 'default', this.time); });
      con.timeEnd = this.native('timeEnd', function (s, a, node) { const k = a.length ? this.toStr(a[0]) : 'default'; push('log', `${k}: ${this.time - (timers.get(k) || 0)} ms (virtual time)`, node); });
      con.assert = this.native('assert', function (s, a, node) { if (!this.truthy(a[0])) push('error', 'Assertion failed' + (a.length > 1 ? ': ' + a.slice(1).map(x => this.display(x, 0, true)).join(' ') : ''), node); });
      con.dir = logger('log');
      con.table = this.native('table', function (s, a, node) { push('table', this.tableText(a[0]), node, '📊 <code>console.table</code> prints the data as a table.'); });
      B.set('console', this.hiddenObj('console', con));

      const M = { PI: Math.PI, E: Math.E, random: this.native('random', () => Math.random()) };
      M.LN2 = Math.LN2; M.LN10 = Math.LN10; M.SQRT2 = Math.SQRT2;
      ['floor', 'ceil', 'round', 'abs', 'sqrt', 'max', 'min', 'pow', 'trunc', 'sign', 'cbrt', 'log', 'log2', 'log10', 'exp', 'hypot', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos'].forEach(n => {
        M[n] = this.native(n, (s, a) => Math[n](...a.map(x => I.toNumber(x))));
      });
      B.set('Math', this.hiddenObj('Math', M));

      B.set('parseInt', this.native('parseInt', (s, a) => parseInt(I.toStr(a[0]), a[1])));
      B.set('parseFloat', this.native('parseFloat', (s, a) => parseFloat(I.toStr(a[0]))));
      B.set('isNaN', this.native('isNaN', (s, a) => isNaN(I.toNumber(a[0]))));
      B.set('Number', this.native('Number', (s, a) => (!a.length ? 0 : typeof a[0] === 'bigint' ? Number(a[0]) : I.toNumber(a[0]))));
      B.set('String', this.native('String', (s, a) => (a.length ? I.toStr(a[0]) : '')));
      B.set('Boolean', this.native('Boolean', (s, a) => I.truthy(a[0])));
      B.set('setTimeout', this.native('setTimeout', function (s, a, node) { return this.setTimer(a, node); }));
      B.set('setInterval', this.native('setInterval', function (s, a, node) { return this.setTimer(a, node, true); }));
      const clearer = name => this.native(name, function (s, a, node) {
        const t = this.webApis.find(x => x.id === a[0]) || this.queue.find(x => x.id === a[0]);
        this.webApis = this.webApis.filter(x => x.id !== a[0]);
        this.queue = this.queue.filter(x => x.id !== a[0]);
        if (t) this.record(node, `🚫 ${code(name)} cancels the ${t.interval ? 'repeating ' : ''}timer for ${code(t.label)} — it won't run again.`, 'webapi');
      });
      B.set('clearTimeout', clearer('clearTimeout'));
      B.set('clearInterval', clearer('clearInterval'));
      const withProps = (fn, entries) => { Object.keys(entries).forEach(k => fn.props.set(k, entries[k])); return fn; };
      B.set('Object', withProps(this.native('Object', (s, a) => (a[0] instanceof JSObject ? a[0] : I.alloc('object')), { isCtor: true }), {
        keys: this.native('keys', (s, a) => I.makeArray(I.ownKeys(a[0]))),
        values: this.native('values', (s, a) => I.makeArray(I.ownKeys(a[0]).map(k => I.getMember(a[0], k)))),
        entries: this.native('entries', (s, a) => I.makeArray(I.ownKeys(a[0]).map(k => I.makeArray([k, I.getMember(a[0], k)])))),
        assign: this.native('assign', (s, a) => { a.slice(1).forEach(src => I.ownKeys(src).forEach(k => I.setMember(a[0], k, I.getMember(src, k)))); return a[0]; }),
        fromEntries: this.native('fromEntries', (s, a, node) => {
          const o = I.alloc('object');
          I.iterable(a[0], node).forEach(pair => o.props.set(I.toKey(I.getMember(pair, '0')), I.getMember(pair, '1')));
          return o;
        }),
        freeze: this.native('freeze', function (s, a, node) {
          if (a[0] instanceof JSObject) {
            a[0].frozen = true;
            this.record(node, `🧊 ${code('Object.freeze')} locks object #${a[0].id}: its properties can no longer be added, changed or removed.`, 'heap');
          }
          return a[0];
        }),
        isFrozen: this.native('isFrozen', (s, a) => !(a[0] instanceof JSObject) || !!a[0].frozen),
        create: this.native('create', (s, a) => { const o = I.alloc('object'); o.proto = a[0] instanceof JSObject ? a[0] : null; return o; }),
        getPrototypeOf: this.native('getPrototypeOf', (s, a) => (a[0] instanceof JSObject ? a[0].proto || null : null)),
        setPrototypeOf: this.native('setPrototypeOf', (s, a) => { if (a[0] instanceof JSObject) a[0].proto = a[1] instanceof JSObject ? a[1] : null; return a[0]; }),
        defineProperty: this.native('defineProperty', (s, a) => {
          const [o, k, d] = a;
          const key = I.toKey(k);
          const get = I.getMember(d, 'get'), set = I.getMember(d, 'set');
          if (I.isCallable(get) || I.isCallable(set)) o.props.set(key, new Accessor(I.isCallable(get) ? get : null, I.isCallable(set) ? set : null));
          else o.props.set(key, I.getMember(d, 'value'));
          return o;
        }),
        getOwnPropertyNames: this.native('getOwnPropertyNames', (s, a) => I.makeArray(I.ownKeys(a[0]))),
      }));
      B.set('Array', withProps(this.native('Array', (s, a) => I.makeArray(a.length === 1 && typeof a[0] === 'number' ? new Array(a[0]).fill(undefined) : a.slice()), { isCtor: true }), {
        isArray: this.native('isArray', (s, a) => a[0] instanceof JSObject && a[0].kind === 'array'),
        from: this.native('from', (s, a, node) => {
          let items;
          if (a[0] instanceof JSObject && a[0].kind !== 'array' && !I.isIterable(a[0]) && I.getMember(a[0], 'length') !== undefined) {
            items = Array.from({ length: I.toNumber(I.getMember(a[0], 'length')) }, (_, i) => I.getMember(a[0], String(i)));
          } else items = I.iterable(a[0], node);
          if (I.isCallable(a[1])) items = items.map((x, i) => I.callFunction(a[1], undefined, [x, i], node));
          return I.makeArray(items);
        }),
        of: this.native('of', (s, a) => I.makeArray(a.slice())),
      }));
      this.setupMore();
      B.set('JSON', this.hiddenObj('JSON', {
        stringify: this.native('stringify', (s, a) => JSON.stringify(I.toNative(a[0]), null, a[2])),
        parse: this.native('parse', (s, a) => I.fromNative(JSON.parse(I.toStr(a[0])))),
      }));
      this.setupPromise();
      ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError'].forEach(n => {
        B.set(n, this.native(n, function (s, a) { return this.makeErrorObj(n, a.length ? this.toStr(a[0]) : ''); }, { isCtor: true }));
      });
    }

    tableText(data) {
      if (!(data instanceof JSObject)) return this.display(data, 0, true);
      const rowKeys = this.ownKeys(data);
      const rows = rowKeys.map(k => this.getMember(data, k));
      const cols = [];
      let hasValues = false;
      rows.forEach(r => {
        if (r instanceof JSObject && r.kind !== 'function') this.ownKeys(r).forEach(c => { if (!cols.includes(c)) cols.push(c); });
        else hasValues = true;
      });
      const head = ['(index)'].concat(cols, hasValues ? ['Values'] : []);
      const body = rows.map((r, i) => [rowKeys[i]].concat(
        cols.map(c => (r instanceof JSObject && r.kind !== 'function' && this.ownKeys(r).includes(c) ? this.display(this.getMember(r, c), 1, false, 1) : '')),
        hasValues ? [r instanceof JSObject && r.kind !== 'function' ? '' : this.display(r, 1, false, 1)] : []));
      const w = head.map((h, i) => Math.max(h.length, ...body.map(b => String(b[i]).length)));
      const line = cells => '│ ' + cells.map((c, i) => String(c).padEnd(w[i])).join(' │ ') + ' │';
      const sep = (l, m, r) => l + w.map(n => '─'.repeat(n + 2)).join(m) + r;
      return [sep('┌', '┬', '┐'), line(head), sep('├', '┼', '┤'), ...body.map(line), sep('└', '┴', '┘')].join('\n');
    }

    // ======================================================== more built-ins
    setupMore() {
      const I = this, B = this.builtins;
      const N = B.get('Number');
      [['isInteger', Number.isInteger], ['isNaN', Number.isNaN], ['isFinite', Number.isFinite], ['isSafeInteger', Number.isSafeInteger],
        ['parseFloat', parseFloat], ['parseInt', parseInt]].forEach(([n, f]) => N.props.set(n, this.native(n, (s, a) => f(...a.map(x => I.toPrim(x))))));
      ['MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'EPSILON', 'MAX_VALUE', 'MIN_VALUE', 'POSITIVE_INFINITY', 'NEGATIVE_INFINITY', 'NaN'].forEach(k => N.props.set(k, Number[k]));
      const S = B.get('String');
      S.props.set('fromCharCode', this.native('fromCharCode', (s, a) => String.fromCharCode(...a.map(x => I.toNumber(x)))));
      S.props.set('raw', this.native('raw', (s, a) => {
        const raw = I.getMember(a[0], 'raw');
        const parts = I.iterable(raw, null);
        return parts.map((p, i) => p + (i < a.length - 1 && i < parts.length - 1 ? I.toStr(a[i + 1]) : '')).join('');
      }));
      B.set('isFinite', this.native('isFinite', (s, a) => isFinite(I.toNumber(a[0]))));
      B.set('encodeURIComponent', this.native('encodeURIComponent', (s, a) => encodeURIComponent(I.toStr(a[0]))));
      B.set('decodeURIComponent', this.native('decodeURIComponent', (s, a) => decodeURIComponent(I.toStr(a[0]))));

      // Symbol
      const registry = new Map();
      const Sym = this.native('Symbol', function (s, a, node) {
        if (s === CONSTRUCT) throw this.makeError('TypeError', 'Symbol is not a constructor', node);
        return new JSSymbol(a[0] === undefined ? undefined : this.toStr(a[0]));
      }, { isCtor: true });
      Sym.props.set('iterator', SYM_ITER);
      Sym.props.set('asyncIterator', SYM_ASYNC_ITER);
      Sym.props.set('toPrimitive', SYM_TO_PRIM);
      Sym.props.set('for', this.native('for', (s, a) => { const k = I.toStr(a[0]); if (!registry.has(k)) registry.set(k, new JSSymbol(k)); return registry.get(k); }));
      B.set('Symbol', Sym);

      // Map / Set (WeakMap / WeakSet behave the same here)
      const collection = (name, kind) => this.native(name, function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', `Constructor ${name} requires 'new'`, node);
        const o = this.alloc(kind);
        o.ctorName = name;
        if (kind === 'map') { o.map = new Map(); if (a[0] != null) this.iterable(a[0], node).forEach(p => o.map.set(this.getMember(p, '0'), this.getMember(p, '1'))); }
        else { o.set = new Set(); if (a[0] != null) this.iterable(a[0], node).forEach(x => o.set.add(x)); }
        const size = kind === 'map' ? o.map.size : o.set.size;
        this.badge('collection');
        this.record(node, `🗂️ <code>new ${name}</code> creates ${kind === 'map' ? 'a <b>key → value</b> table (any value can be a key!)' : 'a collection of <b>unique</b> values (duplicates are dropped)'} #${o.id} in the Heap${size ? ` with ${size} entr${size === 1 ? 'y' : 'ies'}` : ''}.`, 'heap');
        return o;
      }, { isCtor: true, instanceKind: kind });
      B.set('Map', collection('Map', 'map'));
      B.set('Set', collection('Set', 'set'));
      B.set('WeakMap', collection('WeakMap', 'map'));
      B.set('WeakSet', collection('WeakSet', 'set'));

      // RegExp
      B.set('RegExp', this.native('RegExp', function (s, a, node) {
        const src = a[0] instanceof JSObject && a[0].kind === 'regexp' ? a[0].re.source : this.toStr(a[0] === undefined ? '(?:)' : a[0]);
        const flags = a[1] !== undefined ? this.toStr(a[1]) : a[0] instanceof JSObject && a[0].kind === 'regexp' ? a[0].re.flags : '';
        let re;
        try { re = new RegExp(src, flags); } catch (e) { throw this.makeError('SyntaxError', e.message, node); }
        return this.makeRegExp(re);
      }, { isCtor: true, instanceKind: 'regexp' }));

      // Date
      const D = this.native('Date', function (s, a) {
        if (s !== CONSTRUCT) return new Date().toString();
        const o = this.alloc('date');
        o.d = new Date(...a.map(x => this.toPrim(x)));
        return o;
      }, { isCtor: true, instanceKind: 'date' });
      D.props.set('now', this.native('now', () => Date.now()));
      D.props.set('parse', this.native('parse', (s, a) => Date.parse(I.toStr(a[0]))));
      D.props.set('UTC', this.native('UTC', (s, a) => Date.UTC(...a.map(x => I.toNumber(x)))));
      B.set('Date', D);
      B.set('Function', this.native('Function', (s, a, node) => { throw new Unsupported('Creating functions from strings (new Function) is not supported.', node); }, { isCtor: true }));
      this.setupAdvanced();
      this.setupWeb();
      this.setupExtras();
    }

    // ======================================================== BigInt, Proxy, Reflect
    setupAdvanced() {
      const I = this, B = this.builtins;
      B.set('BigInt', this.native('BigInt', function (s, a, node) {
        if (s === CONSTRUCT) throw this.makeError('TypeError', 'BigInt is not a constructor', node);
        return BigInt(this.toPrim(a[0], 'number'));
      }, { isCtor: true }));

      B.set('Proxy', this.native('Proxy', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Constructor Proxy requires 'new'", node);
        const [target, handler] = a;
        if (!(target instanceof JSObject) || !(handler instanceof JSObject)) throw this.makeError('TypeError', 'Cannot create proxy with a non-object as target or handler', node);
        let p;
        if (this.isCallable(target)) {
          // a proxied function stays callable: the `apply` / `construct` traps can intercept calls
          p = this.native('proxy of ' + this.fnLabel(target), function (self, args, n2) {
            if (self === CONSTRUCT) {
              const ct = this.getMember(handler, 'construct');
              if (this.isCallable(ct)) { this.trapStep('construct', null, n2); return this.callFunction(ct, handler, [target, this.makeArray(args)], n2); }
              return this.construct(target, args, n2);
            }
            const ap = this.getMember(handler, 'apply');
            if (this.isCallable(ap)) { this.trapStep('apply', null, n2); return this.callFunction(ap, handler, [target, self, this.makeArray(args)], n2); }
            return this.callFunction(target, self, args, n2);
          }, { isCtor: true });
        } else p = this.alloc('object');
        p.isProxy = true; p.target = target; p.handler = handler;
        p.refs = [target, handler];
        this.badge('proxy');
        this.record(node, `🪤 <code>new Proxy</code> wraps ${target.id > 0 ? 'object #' + target.id : 'the function'} in a Proxy${p.id > 0 ? ' #' + p.id : ''}. Every read, write, <code>in</code> check or delete on the proxy first goes through the <b>handler</b> #${handler.id}, which can change what happens.`, 'heap');
        return p;
      }, { isCtor: true }));

      const arr = v => (v instanceof JSObject && v.items ? v.items.slice() : []);
      B.set('Reflect', this.hiddenObj('Reflect', {
        get: this.native('get', (s, a, node) => I.getMember(a[0], a[1], node, a.length > 2 ? a[2] : a[0])),
        set: this.native('set', (s, a, node) => { I.setMember(a[0], a[1], a[2], node); return true; }),
        has: this.native('has', (s, a, node) => I.binary('in', a[1], a[0], node)),
        ownKeys: this.native('ownKeys', (s, a) => I.makeArray(I.ownKeys(a[0]))),
        deleteProperty: this.native('deleteProperty', (s, a) => I.deleteProp(a[0], I.toKey(a[1]))),
        apply: this.native('apply', (s, a, node) => I.callFunction(a[0], a[1], arr(a[2]), node)),
        construct: this.native('construct', (s, a, node) => I.construct(a[0], arr(a[1]), node)),
        getPrototypeOf: this.native('getPrototypeOf', (s, a) => (a[0] instanceof JSObject ? a[0].proto || null : null)),
        setPrototypeOf: this.native('setPrototypeOf', (s, a) => { a[0].proto = a[1] instanceof JSObject ? a[1] : null; return true; }),
        defineProperty: this.native('defineProperty', (s, a, node) => { I.callFunction(I.builtins.get('Object').props.get('defineProperty'), undefined, a, node); return true; }),
      }));
    }

    // ======================================================== pretend browser: fetch, DOM events, animation frames
    setupWeb() {
      const I = this, B = this.builtins;
      const DB = {
        users: [{ id: 1, name: 'Ada Lovelace', role: 'admin' }, { id: 2, name: 'Linus', role: 'dev' }, { id: 3, name: 'Grace Hopper', role: 'dev' }],
        todos: [{ id: 1, title: 'Learn the event loop', done: true }, { id: 2, title: 'Master promises', done: false }, { id: 3, title: 'Build something cool', done: false }],
      };
      const route = (method, url, body) => {
        const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path === '/api/slow') return { status: 200, delay: 2000, data: { message: 'Sorry I am late!' } };
        if (path === '/api/error') return { status: 500, delay: 300, data: { error: 'Server exploded' } };
        let m = path.match(/^\/api\/(users|todos)\/?$/);
        if (m) {
          if (method === 'POST') return { status: 201, delay: 400, data: Object.assign({ id: 100 + DB[m[1]].length + 1 }, body || {}) };
          return { status: 200, delay: 300, data: DB[m[1]] };
        }
        m = path.match(/^\/api\/(users|todos)\/(\d+)$/);
        if (m) {
          const item = DB[m[1]].find(x => x.id === +m[2]);
          return item ? { status: 200, delay: 300, data: item } : { status: 404, delay: 300, data: { error: 'Not found' } };
        }
        return { status: 404, delay: 300, data: { error: 'Not found: ' + path } };
      };
      B.set('fetch', this.native('fetch', function (s, a, node) {
        const url = this.toStr(a[0]);
        const opts = a[1] instanceof JSObject ? a[1] : null;
        const mVal = opts ? this.getMember(opts, 'method') : undefined;
        const method = mVal === undefined ? 'GET' : this.toStr(mVal).toUpperCase();
        let body;
        const bVal = opts ? this.getMember(opts, 'body') : undefined;
        if (typeof bVal === 'string') { try { body = JSON.parse(bVal); } catch (e) { body = { raw: bVal }; } }
        const mocked = this.mockFor(url);
        // absolute http(s) URLs go to the real internet (fetched once, then replayed)
        this.fetchOpts = opts;
        if (this.httpServers && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) return this.localFetch(url, method, typeof bVal === 'string' ? bVal : undefined, opts, node);
        if (!mocked && /^https?:\/\//i.test(url)) return this.realFetch(url, method, opts ? this.natArg(this.getMember(opts, 'headers')) : undefined, typeof bVal === 'string' ? bVal : undefined, node);
        const res = mocked || route(method, url, body);
        const p = this.newPromise();
        const t = { id: ++this.timerSeq, cb: null, args: [], delay: res.delay, start: this.time, fireAt: this.time + res.delay, label: `🌐 ${method} ${url}`, kind: 'fetch', refs: [p] };
        t.doneMsg = () => `🌐 Time is now <b>${this.time}ms</b>: the server answered <b>${res.status}</b> for ${code(method + ' ' + url)}. The browser puts a "response arrived" task in the Callback Queue.`;
        t.internal = () => {
          const r = this.makeResponse(url, res);
          this.record(null, `📬 The network task runs: a <b>Response</b> object #${r.id} is created and fetch's Promise #${p.id} is fulfilled with it.${res.status >= 400 ? ` ⚠️ fetch does <b>not</b> reject on HTTP errors like ${res.status} — always check <code>response.ok</code>!` : ''}`, 'promise');
          this.resolvePromise(p, r, null);
        };
        this.webApis.push(t);
        this.bindAbort(t, p, opts, node);
        this.badge('fetch');
        this.record(node, `🌐 <code>fetch</code> is a browser <b>Web API</b>: it sends ${code(method + ' ' + url)} over the (pretend) network and immediately returns Promise #${p.id}, still pending. JavaScript keeps going while the request travels (about ${res.delay}ms).`, 'webapi');
        return p;
      }));

      B.set('requestAnimationFrame', this.native('requestAnimationFrame', function (s, a, node) {
        const cb = a[0];
        if (!this.isCallable(cb)) throw this.makeError('TypeError', 'requestAnimationFrame needs a function', node);
        const idx = Math.floor(this.time * 60 / 1000) + 1;
        const fireAt = Math.round(idx * 1000 / 60);
        const t = { id: ++this.timerSeq, cb, args: [fireAt], delay: fireAt - this.time, start: this.time, fireAt, label: '🎞️ ' + this.fnLabel(cb), kind: 'frame' };
        this.webApis.push(t);
        this.record(node, `🎞️ <code>requestAnimationFrame</code> asks the browser to run ${code(this.fnLabel(cb))} right before the <b>next screen repaint</b> — at 60 frames per second that's every ~16.7ms (next one at ${fireAt}ms).`, 'webapi');
        return t.id;
      }));
      B.set('cancelAnimationFrame', B.get('clearTimeout'));

    }

    makeResponse(url, res) {
      const r = this.alloc('object');
      r.ctorName = 'Response';
      r.props.set('ok', res.status >= 200 && res.status < 300);
      r.props.set('status', res.status);
      r.props.set('statusText', { 200: 'OK', 201: 'Created', 404: 'Not Found', 500: 'Internal Server Error' }[res.status] || '');
      r.props.set('url', url);
      let used = false;
      const reader = (name, conv) => this.native(name, function (s, a, node) {
        if (used) throw this.makeError('TypeError', `Failed to execute '${name}' on 'Response': body stream already read`, node);
        used = true;
        const p = this.newPromise();
        this.record(node, `📖 <code>response.${name}()</code> reads the body. That takes time too, so it returns <b>another</b> Promise #${p.id}.`, 'promise');
        this.resolvePromise(p, conv(), node);
        return p;
      });
      r.props.set('json', reader('json', () => this.fromNative(JSON.parse(res.raw !== undefined ? res.raw : JSON.stringify(res.data)))));
      r.props.set('text', reader('text', () => (res.raw !== undefined ? res.raw : JSON.stringify(res.data))));
      return r;
    }

    trapStep(trap, key, node) {
      this.record(node, `🪤 The proxy's <b>${trap}</b> trap intercepts ${key !== null && key !== undefined ? code(keyText(key)) : 'the operation'} — your handler decides what really happens.`, 'native');
    }

    deleteProp(obj, key) {
      if (!(obj instanceof JSObject)) return true;
      if (obj.isProxy) {
        const t = this.getMember(obj.handler, 'deleteProperty');
        if (this.isCallable(t)) { this.trapStep('deleteProperty', key, null); return this.truthy(this.callFunction(t, obj.handler, [obj.target, key], null)); }
        return this.deleteProp(obj.target, key);
      }
      const at = obj.attrs && obj.attrs.get(key);
      if (obj.frozen || obj.sealed || (at && at.configurable === false)) { if (this.isStrict()) throw this.makeError('TypeError', `Cannot delete property '${keyText(key)}' of #<Object>`, null); return false; }
      if (obj.kind === 'array' && isIndex(key)) { if (+key < obj.items.length) obj.items[+key] = undefined; }
      else obj.props.delete(key);
      this.changedProp = { id: obj.id, key: keyText(key) };
      return true;
    }

  });
})();
