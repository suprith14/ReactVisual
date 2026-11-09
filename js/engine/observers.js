/*
 * JS Engine Lab — engine part: DOM observers and CommonJS modules.
 *
 *  - MutationObserver: real DOM change records (from the hidden page), delivered as a MICROTASK,
 *    exactly when a browser would deliver them
 *  - ResizeObserver / IntersectionObserver: simulated (there is no real layout here): they send the
 *    initial notification that browsers send right after observe(), before the next frame
 *  - Node mode: require("./file.js") runs your own "// @file" sections as CommonJS modules
 *    (module.exports / exports, cached after the first require)
 */
(function () {
  'use strict';
  const { CONSTRUCT, code, esc, JSObject, ReturnSignal } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { setupPlatform: P.setupPlatform, setupNode: P.setupNode, drainMicrotasks: P.drainMicrotasks, enqueueMicro: P.enqueueMicro, platformRoots: P.platformRoots };

  window.JSEngine.mixin(class {
    setupPlatform() {
      base.setupPlatform.call(this);
      const I = this, B = this.builtins;
      this.mutationObservers = [];
      this.layoutObservers = [];

      B.set('MutationObserver', this.native('MutationObserver', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Failed to construct 'MutationObserver': Please use the 'new' operator", node);
        if (!this.isCallable(a[0])) throw this.makeError('TypeError', "Failed to construct 'MutationObserver': parameter 1 is not of type 'Function'", node);
        const o = this.alloc('object');
        o.ctorName = 'MutationObserver';
        o.cb = a[0];
        o.real = new window.MutationObserver(() => {});
        o.props.set('observe', this.native('observe', function (s2, a2, n2) {
          const target = a2[0];
          if (!(target instanceof JSObject) || !target.domNode) throw this.makeError('TypeError', "Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'", n2);
          const opts = a2[1] instanceof JSObject ? this.natArg(a2[1]) : {};
          try { o.real.observe(target.domNode, opts); }
          catch (e) { throw this.makeError('TypeError', e.message, n2); }
          if (!this.mutationObservers.includes(o)) this.mutationObservers.push(o);
          this.badge('dom');
          this.record(n2, `🔭 <code>observe</code>: from now on, changes to ${code(this.describeNode(target.domNode))} (${esc(Object.keys(opts).filter(k => opts[k]).join(', ') || 'nothing')}) are <b>collected</b>. They are reported together, as one <b>microtask</b>, after the current code finishes.`, 'webapi');
        }));
        o.props.set('disconnect', this.native('disconnect', function () { o.real.disconnect(); this.mutationObservers = this.mutationObservers.filter(x => x !== o); }));
        o.props.set('takeRecords', this.native('takeRecords', function () { return this.makeArray(o.real.takeRecords().map(r => this.mutationRecord(r))); }));
        this.record(node, `🔭 <code>new MutationObserver</code> #${o.id} is ready. It does nothing until you call <code>observe(element, options)</code>.`, 'heap');
        return o;
      }, { isCtor: true }));

      const layoutObserver = (name, entryOf, note) => this.native(name, function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', `Failed to construct '${name}': Please use the 'new' operator`, node);
        if (!this.isCallable(a[0])) throw this.makeError('TypeError', `Failed to construct '${name}': parameter 1 is not of type 'Function'`, node);
        const o = this.alloc('object');
        o.ctorName = name;
        o.cb = a[0];
        o.targets = [];
        o.pending = [];
        o.props.set('observe', this.native('observe', function (s2, a2, n2) {
          const el = a2[0];
          if (!(el instanceof JSObject) || !el.domNode) throw this.makeError('TypeError', `Failed to execute 'observe' on '${name}': parameter 1 is not of type 'Element'`, n2);
          if (!o.targets.includes(el)) o.targets.push(el);
          o.pending.push(el);
          if (!this.layoutObservers.includes(o)) this.layoutObservers.push(o);
          if (!o.scheduled) {
            o.scheduled = true;
            const fireAt = Math.round((Math.floor(this.time * 60 / 1000) + 1) * 1000 / 60);
            const t = { id: ++this.timerSeq, cb: null, args: [], delay: fireAt - this.time, start: this.time, fireAt, label: `🔭 ${name} callback`, kind: 'frame', refs: [o, o.cb] };
            t.doneMsg = () => `🔭 Before the next frame, the browser measures the observed elements and queues the <b>${name}</b> callback.`;
            t.internal = () => {
              o.scheduled = false;
              const els = o.pending.splice(0);
              if (!els.length) return;
              const entries = this.makeArray(els.map(e => entryOf(e)));
              this.record(null, `🔭 <b>${name}</b> reports ${els.length} element${els.length > 1 ? 's' : ''}. ${note}`, 'eventloop');
              this.callFunction(o.cb, o, [entries, o], o.cb.node || null, 'queue');
            };
            this.webApis.push(t);
          }
          this.record(n2, `🔭 <code>${name}.observe</code> watches ${code(this.describeNode(el.domNode))}. Browsers always send a first report right after you start observing, before the next frame.`, 'webapi');
        }));
        o.props.set('unobserve', this.native('unobserve', function (s2, a2) { o.targets = o.targets.filter(x => x !== a2[0]); o.pending = o.pending.filter(x => x !== a2[0]); }));
        o.props.set('disconnect', this.native('disconnect', function () { o.targets = []; o.pending = []; this.layoutObservers = this.layoutObservers.filter(x => x !== o); }));
        return o;
      }, { isCtor: true });
      const px = (el, prop) => { const v = parseFloat(el.domNode.style && el.domNode.style[prop]); return isFinite(v) ? v : 0; };
      B.set('ResizeObserver', layoutObserver('ResizeObserver', el => I.fromNativeWith({ target: el, contentRect: { x: 0, y: 0, width: px(el, 'width'), height: px(el, 'height') } }),
        '(Simulated: there is no real layout here, so sizes come from inline <code>style="width/height"</code>, or 0.)'));
      B.set('IntersectionObserver', layoutObserver('IntersectionObserver', el => I.fromNativeWith({ target: el, isIntersecting: true, intersectionRatio: 1, time: I.time }),
        '(Simulated: there is no real scrolling here, so every element counts as fully visible.)'));
    }

    // like fromNative, but keeps engine objects (such as element wrappers) as they are
    fromNativeWith(obj) {
      const o = this.alloc('object');
      Object.keys(obj).forEach(k => {
        const v = obj[k];
        o.props.set(k, v instanceof JSObject ? v : v && typeof v === 'object' ? this.fromNativeWith(v) : v);
      });
      return o;
    }

    mutationRecord(r) {
      const rec = this.alloc('object');
      rec.ctorName = 'MutationRecord';
      rec.props.set('type', r.type);
      rec.props.set('target', this.wrapNode(r.target));
      rec.props.set('addedNodes', this.makeArray([...r.addedNodes].map(n => this.wrapNode(n))));
      rec.props.set('removedNodes', this.makeArray([...r.removedNodes].map(n => this.wrapNode(n))));
      rec.props.set('attributeName', r.attributeName);
      rec.props.set('oldValue', r.oldValue);
      return rec;
    }

    // collect DOM changes and queue each observer's callback as a microtask
    flushMutations() {
      let n = 0;
      for (const o of this.mutationObservers || []) {
        if (o.queued) continue;
        const recs = o.real.takeRecords();
        if (!recs.length) continue;
        n++;
        o.queued = true;
        const arr = this.makeArray(recs.map(r => this.mutationRecord(r)));
        const kinds = [...new Set(recs.map(r => r.type))].join(', ');
        this.microtasks.push({
          id: ++this.microSeq, label: '🔭 MutationObserver: ' + this.fnLabel(o.cb), ref: o.cb.id > 0 ? o.cb.id : null, refs: [o, o.cb, arr],
          run: () => {
            o.queued = false;
            const more = o.real.takeRecords().map(r => this.mutationRecord(r));
            more.forEach(r => arr.items.push(r));
            this.callFunction(o.cb, o, [arr, o], o.cb.node || null, 'micro');
          },
        });
        this.record(null, `🔭 The DOM changed (${esc(kinds)}: ${recs.length} record${recs.length > 1 ? 's' : ''}). The MutationObserver callback is queued as a <b>microtask</b>, so it runs after the current code, before any timer.`, 'promise');
      }
      return n;
    }

    enqueueMicro(label, fnObj, refs, run) {
      this.flushMutations(); // changes made before this promise reaction are reported first
      return base.enqueueMicro.call(this, label, fnObj, refs, run);
    }

    drainMicrotasks() {
      for (let guard = 0; guard < 1000; guard++) {
        const n = this.flushMutations();
        if (!n && guard > 0) break;
        base.drainMicrotasks.call(this);
      }
    }

    platformRoots(markV, markS, root) {
      base.platformRoots.call(this, markV, markS, root);
      (this.mutationObservers || []).forEach(o => root('a MutationObserver', () => { markV(o); markV(o.cb); }));
      (this.layoutObservers || []).forEach(o => root(`a ${o.ctorName}`, () => { markV(o); markV(o.cb); o.targets.forEach(t => markV(t)); }));
    }

    // ======================================================== CommonJS in Node mode
    setupNode() {
      base.setupNode.call(this);
      const B = this.builtins, nodeRequire = B.get('require');
      ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'].forEach(n => B.delete(n));
      this.cjsCache = new Map();
      const req = this.native('require', function (s, a, node) {
        const spec = this.toStr(a[0]);
        if (/^\.{0,2}\//.test(spec)) {
          const name = spec.replace(/^(\.\/)+/, '').replace(/^\//, '');
          const f = (this.cjsFiles || []).find(x => x.name === name || x.name === name + '.js' || x.name === name + '.cjs' || x.name === name + '/index.js');
          if (!f) throw this.makeError('Error', `Cannot find module '${spec}'. Add it as a "// @file ${name.endsWith('.js') ? name : name + '.js'}" section.`, node);
          return this.loadCommonJS(f, node);
        }
        return nodeRequire.fn.call(this, s, a, node);
      });
      B.set('require', req);
      this.cjsRequire = req;
    }

    loadCommonJS(f, node) {
      const cached = this.cjsCache.get(f);
      if (cached) {
        this.record(node, `📦 <code>require("./${esc(f.name)}")</code> again: Node returns the <b>cached</b> <code>module.exports</code>. The file does not run a second time.`, 'native');
        return this.getMember(cached, 'exports');
      }
      const masked = this.src.split('').map((c, i) => (i >= f.start && i < f.end) || c === '\n' ? c : ' ').join('');
      let ast;
      try { ast = window.acorn.parse(masked, { ecmaVersion: 2022, locations: true, sourceType: 'script', allowReturnOutsideFunction: true }); }
      catch (e) { throw this.makeError('SyntaxError', `${f.name}: ${e.message}`, node); }
      const mod = this.alloc('object');
      mod.ctorName = 'Module';
      const exportsObj = this.alloc('object');
      mod.props.set('id', './' + f.name);
      mod.props.set('exports', exportsObj);
      mod.props.set('loaded', false);
      this.cjsCache.set(f, mod);
      const scope = this.newScope('function', `module ${f.name}`, this.globalScope, null);
      [['module', mod], ['exports', exportsObj], ['require', this.cjsRequire], ['__filename', '/home/user/app/' + f.name], ['__dirname', '/home/user/app']].forEach(([k, v]) => scope.vars.set(k, { value: v, kind: 'param' }));
      const ctx = { id: ++this.ctxSeq, name: `module ${f.name}`, phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: false, thisVal: exportsObj, looked: new Set(), strict: false };
      scope.owner = ctx;
      this.stack.push(ctx);
      this.record(node, `📦 <code>require("./${esc(f.name)}")</code> runs that file <b>now</b>, synchronously, wrapped in a function that receives <code>module</code>, <code>exports</code>, <code>require</code>, <code>__filename</code> and <code>__dirname</code>.`, 'push');
      this.hoist(this.collectVars(ast.body, []).concat(this.lexicalDecls(ast.body)), scope, ctx, false);
      ctx.phase = 'execution';
      try { this.runSync(this.execStatements(ast.body, ctx)); }
      catch (e) { if (!(e instanceof ReturnSignal)) { this.removeCtx(ctx); throw e; } }
      this.removeCtx(ctx);
      mod.props.set('loaded', true);
      const out = this.getMember(mod, 'exports');
      this.tempRoot = out;
      this.record(node, `📤 ${code(f.name)} finished. <code>require</code> returns its <code>module.exports</code>: ${this.valText(out)}. Node caches it, so the next require of this file returns the same object.`, 'pop');
      return out;
    }
  });
})();
