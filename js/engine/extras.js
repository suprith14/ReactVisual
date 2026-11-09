/* JS Engine Quest — engine part: eval / new Function, WeakRef & FinalizationRegistry, Intl, and mockFetch. */
(function () {
  'use strict';
  const { CONSTRUCT, esc, code, trunc, JSObject, ThrowSignal, keyText } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    setupExtras() {
      const I = this, B = this.builtins;
      this.registries = [];
      this.mockRoutes = new Map();
      this.setupBrowser();

      // ---- eval: an indirect call (e.g. const e = eval; e(code)) runs in the global scope
      B.set('eval', this.native('eval', function (s, a, node) { return this.evalCode(a[0], null, node, true); }));

      // ---- new Function("a", "b", "return a + b")
      B.set('Function', this.native('Function', function (s, a, node) {
        const params = a.slice(0, -1).map(x => this.toStr(x));
        const body = a.length ? this.toStr(a[a.length - 1]) : '';
        const src = `(function anonymous(${params.join(', ')}\n) {\n${body}\n})`;
        const file = { code: src, label: 'new Function' };
        let ast;
        try { ast = window.acorn.parse(src, { ecmaVersion: 2022, locations: true, sourceType: 'script', directSourceFile: file }); }
        catch (e) { throw this.makeError('SyntaxError', e.message.replace(/\s*\(\d+:\d+\)$/, ''), node); }
        const fnNode = ast.body[0].expression;
        const f = this.makeFunction(fnNode, this.globalScope, { thisVal: this.globalThisObj, strict: false });
        this.badge('eval');
        this.record(node, `🧪 <code>new Function</code> turns text into a real function #${f.id}. It is parsed <b>now</b>, while the program runs, and it can only see <b>global</b> variables (not the local ones around this line).`, 'heap');
        return f;
      }, { isCtor: true }));

      // ---- WeakRef: points to an object without keeping it alive
      B.set('WeakRef', this.native('WeakRef', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Constructor WeakRef requires 'new'", node);
        if (!(a[0] instanceof JSObject) || a[0].id < 0) throw this.makeError('TypeError', 'WeakRef: target must be an object', node);
        const w = this.alloc('object');
        w.ctorName = 'WeakRef';
        w.isWeakRef = true;
        w.weakTarget = a[0];
        this.badge('weak');
        this.record(node, `🪶 <code>new WeakRef</code> #${w.id} points to object #${a[0].id} <b>weakly</b>: it does not keep the object alive. If nothing else points to #${a[0].id}, the garbage collector may remove it, and <code>.deref()</code> will then give <code>undefined</code>.`, 'heap');
        return w;
      }, { isCtor: true }));

      B.set('FinalizationRegistry', this.native('FinalizationRegistry', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Constructor FinalizationRegistry requires 'new'", node);
        if (!this.isCallable(a[0])) throw this.makeError('TypeError', 'FinalizationRegistry: cleanup must be callable', node);
        const r = this.alloc('object');
        r.ctorName = 'FinalizationRegistry';
        r.frCells = [];
        r.refs = [a[0]];
        r.cleanup = a[0];
        this.registries.push(r);
        r.props.set('register', this.native('register', function (s2, a2, n2) {
          if (!(a2[0] instanceof JSObject)) throw this.makeError('TypeError', 'register: target must be an object', n2);
          r.frCells.push({ target: a2[0], held: a2[1], token: a2[2] });
          this.record(n2, `📝 The registry will call ${code(this.fnLabel(r.cleanup))} with ${this.valText(a2[1])} some time <b>after</b> object #${a2[0].id} is garbage-collected.`, 'heap');
        }));
        r.props.set('unregister', this.native('unregister', (s2, a2) => {
          const before = r.frCells.length;
          r.frCells = r.frCells.filter(c => c.token !== a2[0] || a2[0] === undefined);
          return r.frCells.length < before;
        }));
        return r;
      }, { isCtor: true }));

      // ---- Intl: handed to the browser's real Intl, which has all the language data
      const intlNames = ['NumberFormat', 'DateTimeFormat', 'RelativeTimeFormat', 'PluralRules', 'Collator', 'ListFormat', 'DisplayNames', 'Segmenter'].filter(n => typeof Intl[n] === 'function');
      const intl = {};
      intlNames.forEach(n => {
        intl[n] = this.native(n, function (s, a, node) {
          let real;
          try { real = new Intl[n](...a.map(x => this.natArg(x))); } catch (e) { throw this.makeError(e.name === 'RangeError' ? 'RangeError' : 'TypeError', e.message, node); }
          const o = this.alloc('object');
          o.ctorName = 'Intl.' + n;
          o.intl = real;
          this.badge('intl');
          this.record(node, `🌍 <code>Intl.${n}</code> #${o.id} formats values for the locale <b>${esc(real.resolvedOptions().locale)}</b> (language + region rules come from the browser).`, 'heap');
          return o;
        }, { isCtor: true });
      });
      intl.getCanonicalLocales = this.native('getCanonicalLocales', (s, a) => I.makeArray(Intl.getCanonicalLocales(I.natArg(a[0]))));
      B.set('Intl', this.hiddenObj('Intl', intl));

      // ---- mockFetch: add your own pretend server routes
      B.set('mockFetch', this.native('mockFetch', function (s, a, node) {
        const path = this.toStr(a[0]).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        const opts = a[2] instanceof JSObject ? this.toNative(a[2]) : {};
        this.mockRoutes.set(path, { status: opts.status || 200, delay: opts.delay === undefined ? 300 : opts.delay, data: this.toNative(a[1]) });
        this.record(node, `🧰 (Visualizer helper) The pretend server will now answer ${code(path)} with status ${opts.status || 200} after ${opts.delay === undefined ? 300 : opts.delay}ms.`, 'webapi');
      }));
    }

    mockFor(url) {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      const m = this.mockRoutes && this.mockRoutes.get(path);
      return m ? { status: m.status, delay: m.delay, data: JSON.parse(JSON.stringify(m.data === undefined ? null : m.data)) } : null;
    }

    // turn an engine value into a real JS value for the browser's Intl / Date APIs
    natArg(x) {
      if (x instanceof JSObject) {
        if (x.kind === 'date') return new Date(x.d.getTime());
        if (x.kind === 'array') return x.items.map(v => this.natArg(v));
        if (x.kind === 'object') { const o = {}; this.ownKeys(x).forEach(k => { o[k] = this.natArg(this.getMember(x, k)); }); return o; }
      }
      return x;
    }

    intlMember(o, key) {
      const real = o.intl;
      if (typeof key !== 'string' || typeof real[key] !== 'function') return undefined;
      return this.method('intl', o.ctorName + '.' + key, (self, a) => this.fromNative(self.intl[key](...a.map(x => this.natArg(x)))));
    }

    // called by the garbage collector (in core.js) when an object is removed
    onCollected(o) {
      for (const r of this.registries || []) {
        const hit = r.frCells.filter(c => c.target === o);
        if (!hit.length) continue;
        r.frCells = r.frCells.filter(c => c.target !== o);
        hit.forEach(c => this.queue.push({ id: ++this.timerSeq, cb: r.cleanup, args: [c.held], label: `🧹 cleanup ${this.fnLabel(r.cleanup)}`, kind: 'gc', refs: [c.held] }));
      }
    }

    weakDeref(w) {
      return this.method('weak', 'deref', function (self, a, node) {
        const t = self.weakTarget;
        const alive = t && !t.collected;
        this.record(node, alive ? `🪶 <code>.deref()</code>: object #${t.id} is still alive, so you get it back.` : `🪶 <code>.deref()</code>: the object was <b>garbage-collected</b>, so you get <code>undefined</code>.`, 'heap');
        return alive ? t : undefined;
      });
    }

    // run a string as code. Direct eval sees local variables; indirect eval only sees globals.
    evalCode(src, ctx, node, indirect) {
      if (typeof src !== 'string') return src;
      const file = { code: src, label: indirect ? 'eval (global)' : 'eval' };
      let ast;
      try { ast = window.acorn.parse(src, { ecmaVersion: 2022, locations: true, sourceType: 'script', directSourceFile: file }); }
      catch (e) { throw this.makeError('SyntaxError', e.message.replace(/\s*\(\d+:\d+\)$/, ''), node); }
      this.badge('eval');
      const caller = indirect ? this.globalCtx : ctx;
      const strict = (!indirect && caller.strict) || !!(ast.body[0] && ast.body[0].directive === 'use strict');
      const parentScope = indirect ? this.globalScope : caller.currentScope;
      const scope = this.newScope('block', 'eval code', parentScope, null);
      const ectx = {
        id: ++this.ctxSeq, name: indirect ? 'eval (global)' : 'eval code', phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: false,
        thisVal: indirect ? this.globalThisObj : caller.thisVal, looked: new Set(), strict, fn: indirect ? null : caller.fn,
      };
      scope.owner = ectx;
      // in sloppy mode, var and function declarations leak into the surrounding function (or global) scope
      const varScope = strict ? scope : indirect ? this.globalScope : caller.funcScope;
      const lex = this.lexicalDecls(ast.body);
      this.hoist(this.collectVars(ast.body, []).concat(lex.filter(d => d.kind === 'function')), varScope, varScope === scope ? ectx : (varScope.owner || ectx), false);
      this.hoist(lex.filter(d => d.kind !== 'function'), scope, ectx, false);
      this.stack.push(ectx);
      this.record(node, `🧪 <code>eval</code> treats a <b>string as code</b>: ${code(trunc(src, 60))}. It is parsed <b>now</b>, while the program runs, and gets its own Execution Context.${indirect ? ' This is an <b>indirect</b> eval, so it only sees global variables.' : ' A <b>direct</b> eval can see the local variables around it.'}${!strict && varScope !== scope ? ` Its <code>var</code>/<code>function</code> declarations leak into ${code(varScope.name === 'Global' ? 'Global' : varScope.name)}.` : ''} ⚠️ eval is slow and risky with untrusted text, so real code avoids it.`, 'push');
      ectx.phase = 'execution';
      this.completion = undefined;
      try { this.runSync(this.execStatements(ast.body, ectx)); }
      catch (e) {
        this.removeCtx(ectx);
        if (e instanceof ThrowSignal) this.record(node, '💨 The error flies out of the eval code.', 'pop');
        throw e;
      }
      this.removeCtx(ectx);
      const v = this.completion;
      this.tempRoot = v;
      this.record(node, `📤 eval is done and returns ${this.valText(v)} (the value of its last expression). Its context is popped.`, 'pop');
      return v;
    }

    serExtra(o, base) {
      const br = this.serBrowser(o, base);
      if (br) return br;
      if (o.isWeakRef) {
        const t = o.weakTarget;
        return Object.assign(base, { title: 'WeakRef', entries: [{ k: 'target (weak)', v: t && !t.collected ? { t: 'obj', text: `#${t.id} (alive)` } : { t: 'undef', text: 'collected' } }] });
      }
      if (o.frCells) return Object.assign(base, { title: 'FinalizationRegistry', entries: [{ k: 'cleanup', v: this.serValue(o.cleanup) }, { k: 'watching', v: { t: 'num', text: o.frCells.map(c => '#' + c.target.id).join(', ') || 'nothing' } }] });
      if (o.intl) return Object.assign(base, { title: o.ctorName, entries: [{ k: 'locale', v: this.serValue(o.intl.resolvedOptions().locale) }] });
      return null;
    }

    // used by keyText-aware callers
    keyLabel(k) { return keyText(k); }
  });
})();
