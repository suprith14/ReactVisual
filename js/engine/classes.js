/* JS Engine Quest — engine part: classes (class, extends, super, fields) and generators (sync and async). */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== classes
    *defineClass(node, ctx, bind) {
      const name = node.id ? node.id.name : null;
      let parent = null;
      if (node.superClass) {
        parent = yield* this.evaluate(node.superClass, ctx);
        const ok = parent === null || (parent instanceof JSObject && (parent.kind === 'function' || (parent.kind === 'native' && parent.isCtor)));
        if (!ok) throw this.makeError('TypeError', `Class extends value ${this.display(parent)} is not a constructor or null`, node.superClass);
        if (parent && parent.kind === 'native' && !ERROR_NAMES.includes(parent.name) && !['Array', 'Map', 'Set'].includes(parent.name)) throw new Unsupported(`Extending the built-in ${parent.name} is not supported yet (Error, Array, Map, Set and your own classes work).`, node.superClass);
      }
      const classScope = this.newScope('block', `class ${name || '(anonymous)'}`, ctx.currentScope, ctx);
      const C = this.alloc('function');
      C.isClass = true; C.strict = true; C.name = name; C.label = name || `anonymous class @ line ${node.loc.start.line}`;
      C.closure = classScope; C.parentClass = parent; C.fields = [];
      if (name) classScope.vars.set(name, { value: C, kind: 'const' });
      const ctorDef = node.body.body.find(el => el.type === 'MethodDefinition' && el.kind === 'constructor');
      C.node = ctorDef ? ctorDef.value : null;
      C.params = ctorDef ? ctorDef.value.params.map(p => this.text(p)) : [];
      const proto = this.alloc('object');
      proto.isProto = true; proto.protoOf = C.label;
      proto.props.set('constructor', C);
      C.props.set('prototype', proto);
      C.homeObject = proto;
      if (parent && parent.kind === 'function') { proto.proto = this.getMember(parent, 'prototype', node); C.proto = parent; }
      const elemCtx = thisVal => ({ id: ++this.ctxSeq, name: `class ${C.label}`, phase: 'execution', funcScope: classScope, currentScope: classScope, isGlobal: false, thisVal, looked: new Set(), fn: { homeObject: C } });
      const methods = [], statics = [];
      for (const el of node.body.body) {
        if (el.type === 'StaticBlock') { yield* this.execStatements(el.body, elemCtx(C)); statics.push('static { … }'); continue; }
        if (el.type === 'MethodDefinition' && el.kind === 'constructor') continue;
        let key;
        if (el.computed) key = this.toKey(yield* this.evaluate(el.key, ctx));
        else key = el.key.type === 'PrivateIdentifier' ? '#' + el.key.name : el.key.type === 'Identifier' ? el.key.name : String(el.key.value);
        const target = el.static ? C : proto;
        if (el.type === 'MethodDefinition') {
          const f = this.makeFunction(el.value, classScope, ctx);
          this.nameFn(f, key);
          f.homeObject = target; f.isMethod = true; f.strict = true; // class code is always strict
          if (el.kind === 'method') target.props.set(key, f);
          else {
            let acc = target.props.get(key);
            if (!(acc instanceof Accessor)) acc = new Accessor(null, null);
            acc[el.kind] = f;
            target.props.set(key, acc);
          }
          (el.static ? statics : methods).push((el.kind === 'method' ? '' : el.kind + ' ') + keyText(key) + '()');
        } else if (el.type === 'PropertyDefinition') {
          if (el.static) {
            let v;
            if (el.value) { v = yield* this.evaluate(el.value, elemCtx(C)); if (isAnonFn(el.value)) this.nameFn(v, key); }
            C.props.set(key, v);
            statics.push(keyText(key));
          } else C.fields.push({ key, value: el.value, node: el });
        }
      }
      if (bind) this.initBinding(name, C, 'class', ctx);
      this.badge('class');
      const pLabel = parent ? this.fnLabel(parent) : null;
      this.record(R(node.start, node.body.start + 1, node.loc.start.line),
        `🏛️ <code>class ${esc(C.label)}</code> is created. Under the hood it's a <b>constructor function</b> (#${C.id}) plus a <b>prototype</b> object (#${proto.id}) that holds the methods every instance shares${methods.length ? ': ' + methods.map(m => code(m)).join(', ') : ''}.`
        + (parent ? ` <code>extends ${esc(pLabel)}</code> links ${code(C.label + '.prototype')} to ${code(pLabel + '.prototype')} — that's the <b>prototype chain</b>.` : '')
        + (statics.length ? ` Static members live on the class itself: ${statics.map(s => code(s)).join(', ')}.` : '')
        + (C.fields.length ? ` Every new instance will get the fields ${C.fields.map(f => code(keyText(f.key))).join(', ')}.` : ''), 'class');
      return C;
    }

    construct(ctor, args, node) {
      if (ctor instanceof JSObject && ctor.kind === 'native' && ctor.isCtor) return ctor.fn.call(this, CONSTRUCT, args, node);
      if (!(ctor instanceof JSObject) || ctor.kind !== 'function' || ctor.isArrow || ctor.isAsync || ctor.isGenerator || ctor.isMethod) {
        throw this.makeError('TypeError', `${node.callee ? this.snip(node.callee, 30) : this.display(ctor)} is not a constructor`, node);
      }
      const obj = this.alloc('object');
      obj.ctorName = ctor.name;
      const proto = this.getMember(ctor, 'prototype', node);
      obj.proto = proto instanceof JSObject ? proto : null;
      this.record(node, `🆕 <code>new</code> creates an empty object #${obj.id} in the Heap, links it to ${code(ctor.label + '.prototype')}, and runs ${ctor.isClass ? 'the class constructor' : code(ctor.label)} with <code>this</code> pointing to the new object.`, 'heap');
      if (!ctor.isClass) {
        const r = this.callFunction(ctor, obj, args, node, undefined, { construct: true, newTarget: ctor });
        return r instanceof JSObject ? r : obj;
      }
      return this.constructClass(ctor, obj, args, node, ctor);
    }

    constructClass(C, obj, args, node, newTarget) {
      const derived = !!C.parentClass;
      if (C.node) {
        if (!derived) this.initFields(C, obj, node);
        const r = this.callFunction(C, derived ? UNINIT : obj, args, node, undefined, { construct: true, newTarget, derived, pendingThis: obj });
        return r instanceof JSObject ? r : obj;
      }
      if (derived) {
        this.record(node, `🏛️ ${code(C.label)} has no <code>constructor</code> of its own, so it uses the default one: <code>constructor(...args) { super(...args); }</code>`, 'class');
        this.superConstruct(C, obj, args, node, newTarget);
      }
      this.initFields(C, obj, node);
      return obj;
    }

    superConstruct(C, obj, args, node, newTarget) {
      const P = C.parentClass;
      if (P === null) throw this.makeError('TypeError', 'Super constructor null is not a constructor', node);
      if (P.kind === 'native' && P.name === 'Array') { obj.kind = 'array'; obj.items = args.length === 1 && typeof args[0] === 'number' ? new Array(args[0]).fill(undefined) : args.slice(); return; }
      if (P.kind === 'native' && P.name === 'Map') { obj.kind = 'map'; obj.map = new Map(); if (args[0] != null) this.iterable(args[0], node).forEach(p => obj.map.set(this.getMember(p, '0'), this.getMember(p, '1'))); return; }
      if (P.kind === 'native' && P.name === 'Set') { obj.kind = 'set'; obj.set = new Set(); if (args[0] != null) this.iterable(args[0], node).forEach(x => obj.set.add(x)); return; }
      if (P.kind === 'native') { // extends Error
        obj.isError = true;
        if (!obj.props.has('name')) obj.props.set('name', 'Error');
        obj.props.set('message', args.length && args[0] !== undefined ? this.toStr(args[0]) : '');
        return;
      }
      if (P.isClass) { this.constructClass(P, obj, args, node, newTarget); return; }
      this.callFunction(P, obj, args, node, undefined, { construct: true, newTarget });
    }

    initFields(C, obj, node) {
      if (!C.fields || !C.fields.length) return;
      const fctx = { id: ++this.ctxSeq, name: `${C.label} fields`, phase: 'execution', funcScope: C.closure, currentScope: C.closure, isGlobal: false, thisVal: obj, looked: new Set(), fn: { homeObject: C.homeObject } };
      const shown = [];
      for (const f of C.fields) {
        let v;
        if (f.value) { v = this.runSync(this.evaluate(f.value, fctx)); if (isAnonFn(f.value)) this.nameFn(v, f.key); }
        obj.props.set(f.key, v);
        shown.push(code(keyText(f.key) + ' = ' + this.display(v, 0, false, 1)));
      }
      this.changedProp = { id: obj.id, key: keyText(C.fields[C.fields.length - 1].key) };
      const priv = C.fields.some(f => typeof f.key === 'string' && f.key.startsWith('#'));
      this.record(node, `🏷️ The class fields of ${code(C.label)} are added to object #${obj.id}: ${shown.join(', ')}.${priv ? ' Names starting with <code>#</code> are <b>private</b> — only code inside the class can use them.' : ''}`, 'assign');
    }

    // super.x: look one step up the prototype chain from the object the method was written in
    superLookup(ctx, key, node) {
      const home = ctx.fn && ctx.fn.homeObject;
      const self = ctx.thisVal;
      if (home && home.proto) return this.getMember(home.proto, key, node, self);
      // parent is a built-in (class X extends Array / Map / Set): use the built-in method
      if (self instanceof JSObject) {
        if (self.kind === 'map' || self.kind === 'set') return this.collectionMethod(self, key);
        if (self.kind === 'array') return this.arrayMethod(key);
      }
      return undefined;
    }

    ctorCtx(ctx) {
      for (let c = ctx; c; c = c.isArrow && c.fn ? c.fn.lexicalCtx : null) if (c.classFn) return c;
      return null;
    }

    // ======================================================== generators
    startGenerator(fn, ctx, args, callNode, name) {
      const g = this.alloc('object');
      g.isGenerator = true; g.isAsyncGen = !!fn.isAsync; g.genName = name; g.genState = 'suspended-start';
      g.genCtx = ctx; g.gen = this.runBody(fn, ctx, args, name);
      if (g.isAsyncGen) { g.agQueue = []; g.running = false; }
      this.badge('generator');
      try { g.gen.next(); } // runs only the creation phase
      catch (e) { this.removeCtx(ctx); throw e; }
      this.removeCtx(ctx);
      this.pauseGen(g, '💤 not started — waiting for .next()', false);
      this.tempRoot = g;
      this.record(callNode, `🔂 Calling the ${g.isAsyncGen ? 'async ' : ''}generator function ${code(name)} does <b>not</b> run its body! Its memory is set up, then it hands back a <b>${g.isAsyncGen ? 'Async ' : ''}Generator object</b> #${g.id} and its context steps off the stack. The body runs piece by piece, each time you call <code>.next()</code>.`, 'pop');
      return g;
    }

    pauseGen(g, reason, root) { this.unpause(g); this.paused.push({ ctx: g.genCtx, genObj: g, reason: () => reason, root: !!root }); }
    unpause(g) { this.paused = this.paused.filter(t => t.genObj !== g); }
    finishGen(g) { g.genState = 'completed'; this.unpause(g); }

    genResume(g, mode, value, node) {
      const name = g.genName;
      if (g.genState === 'running') throw this.makeError('TypeError', 'Generator is already running', node);
      if (g.genState === 'completed' || (g.genState === 'suspended-start' && mode !== 'next')) {
        this.finishGen(g);
        if (mode === 'throw') throw new ThrowSignal(value, node);
        return this.iterResult(mode === 'return' ? value : undefined, true);
      }
      const first = g.genState === 'suspended-start';
      g.genState = 'running';
      this.unpause(g);
      g.genCtx.fromQueue = null;
      this.stack.push(g.genCtx);
      const verb = mode === 'next' ? `.next(${value === undefined ? '' : trunc(this.display(value, 0, false, 1), 20)})` : `.${mode}()`;
      this.record(node, `▶️ ${code(verb)} wakes up generator ${code(name)}: its Execution Context is pushed back onto the Call Stack and it continues ${first ? 'from the <b>top</b> of its body' : 'right after its last <code>yield</code>'}${mode === 'next' && !first && value !== undefined ? ` — that <code>yield</code> now evaluates to ${this.valText(value)}` : ''}${mode === 'return' ? ' — but only to finish early (any <code>finally</code> still runs)' : ''}${mode === 'throw' ? ' — and an error is thrown right at that <code>yield</code>' : ''}.`, 'push');
      let r;
      try {
        r = mode === 'throw' ? g.gen.throw(new ThrowSignal(value, g.lastYieldNode || node))
          : mode === 'return' ? g.gen.throw(new GenReturnSignal(value))
          : g.gen.next(value);
      } catch (e) {
        this.removeCtx(g.genCtx);
        this.finishGen(g);
        if (e instanceof ThrowSignal) this.record(e.node, `💨 An error escapes generator ${code(name)}. The generator is now finished, and the error flies to whoever called it.`, 'pop');
        throw e;
      }
      this.removeCtx(g.genCtx);
      if (r.done) {
        this.finishGen(g);
        const res = this.iterResult(r.value, true);
        this.tempRoot = res;
        this.record(node, `🏁 Generator ${code(name)} reached the end. Its context is gone for good, and ${code(verb)} returns ${code(`{ value: ${this.display(r.value, 0, false, 1)}, done: true }`)}.`, 'pop');
        return res;
      }
      if (r.value.kind !== 'yield') throw new Unsupported('`await` can only be used inside an async function.', r.value.node);
      g.genState = 'suspended-yield';
      g.lastYieldNode = r.value.node;
      this.pauseGen(g, '⏸ paused at yield', false);
      const res = this.iterResult(r.value.value, false);
      this.tempRoot = res;
      this.record(r.value.node, `⏸️ <code>yield</code> ${this.valText(r.value.value)} → generator ${code(name)} <b>pauses</b> right here. Its context leaves the Call Stack but keeps all its variables, and ${code(verb)} returns ${code(`{ value: ${this.display(r.value.value, 0, false, 1)}, done: false }`)}.`, 'yield');
      return res;
    }

    // async generators: every .next() returns a promise; requests wait in line
    agRequest(g, mode, value, node) {
      const p = this.newPromise();
      g.agQueue.push({ mode, value, promise: p, node });
      this.record(node, `📨 <code>.${mode}()</code> on async generator ${code(g.genName)} immediately returns Promise #${p.id}. It will be resolved when the generator reaches its next <code>yield</code>.`, 'promise');
      if (!g.running) this.agDrain(g);
      return p;
    }

    agDrain(g) {
      while (!g.running && g.agQueue.length) {
        const req = g.agQueue[0];
        if (g.genState === 'completed' || (g.genState === 'suspended-start' && req.mode !== 'next')) {
          g.agQueue.shift();
          this.finishGen(g);
          if (req.mode === 'throw') { req.promise.alreadyResolved = true; this.settle(req.promise, 'rejected', req.value, null); }
          else this.resolvePromise(req.promise, this.iterResult(req.mode === 'return' ? req.value : undefined, true), null);
          continue;
        }
        const first = g.genState === 'suspended-start';
        g.running = true;
        g.genState = 'running';
        this.unpause(g);
        this.stack.push(g.genCtx);
        this.record(req.node, `▶️ Async generator ${code(g.genName)} is pushed back onto the Call Stack and continues ${first ? 'from the top' : 'after its last <code>yield</code>'}.`, 'push');
        this.agStep(g, req.mode, req.value);
      }
    }

    agStep(g, mode, value) {
      let r;
      try {
        r = mode === 'throw' ? g.gen.throw(new ThrowSignal(value, g.lastYieldNode))
          : mode === 'return' ? g.gen.throw(new GenReturnSignal(value))
          : g.gen.next(value);
      } catch (e) {
        this.removeCtx(g.genCtx);
        if (!(e instanceof ThrowSignal)) throw e;
        g.running = false;
        this.finishGen(g);
        const req = g.agQueue.shift();
        this.record(e.node, `💨 An error escapes async generator ${code(g.genName)}, so Promise #${req.promise.id} from <code>.next()</code> is <b>rejected</b>.`, 'pop');
        req.promise.alreadyResolved = true;
        this.settle(req.promise, 'rejected', e.value, null);
        this.agDrain(g);
        return;
      }
      this.removeCtx(g.genCtx);
      if (r.done) {
        g.running = false;
        this.finishGen(g);
        const req = g.agQueue.shift();
        this.record(null, `🏁 Async generator ${code(g.genName)} reached the end, so Promise #${req.promise.id} gets ${code('{ value: ' + this.display(r.value, 0, false, 1) + ', done: true }')}.`, 'pop');
        this.resolvePromise(req.promise, this.iterResult(r.value, true), null);
        this.agDrain(g);
        return;
      }
      const node = r.value.node;
      if (r.value.kind === 'await') {
        const p = this.toPromise(r.value.value);
        this.pauseGen(g, `⏸ awaiting Promise #${p.id}`, true);
        this.promiseThen(p, v => this.agResumeAfterAwait(g, 'next', v, node), e => this.agResumeAfterAwait(g, 'throw', e, node), null, false, [g, p], `resume ${g.genName}`);
        this.record(node, `⏸️ <code>await</code> inside async generator ${code(g.genName)} → it pauses until Promise #${p.id} settles. Its context leaves the Call Stack.`, 'await');
        return;
      }
      g.running = false;
      g.genState = 'suspended-yield';
      g.lastYieldNode = node;
      this.pauseGen(g, '⏸ paused at yield', false);
      const req = g.agQueue.shift();
      this.record(node, `⏸️ <code>yield</code> ${this.valText(r.value.value)} → async generator ${code(g.genName)} pauses, and Promise #${req.promise.id} from <code>.next()</code> gets ${code('{ value: ' + this.display(r.value.value, 0, false, 1) + ', done: false }')}.`, 'yield');
      this.resolvePromise(req.promise, this.iterResult(r.value.value, false), null);
      this.agDrain(g);
    }

    agResumeAfterAwait(g, mode, value, node) {
      this.unpause(g);
      g.genCtx.fromQueue = 'micro';
      this.stack.push(g.genCtx);
      this.record(node, `▶️ Async generator ${code(g.genName)} is back on the Call Stack; its <code>await</code> ${mode === 'next' ? 'gives ' + this.valText(value) : 'throws ' + this.valText(value)}.`, 'push');
      this.agStep(g, mode, value);
    }

    isThenable(v) {
      return v instanceof JSObject && !v.isPromise && !v.hidden && v.kind !== 'native' && this.isCallable(this.getMember(v, 'then'));
    }

    toPromise(v) {
      if (this.isPromise(v)) return v;
      if (this.isThenable(v)) { const tp = this.newPromise(); this.resolvePromise(tp, v, null); return tp; }
      const p = this.newPromise();
      p.alreadyResolved = true; p.state = 'fulfilled'; p.value = v;
      return p;
    }

  });
})();
