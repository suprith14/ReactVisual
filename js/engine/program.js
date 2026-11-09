/* JS Engine Quest — engine part: running a program: global code, modules, the event loop, function calls and async/await. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== program & event loop
    makeGlobal(strict) {
      const scope = this.newScope('global', 'Global', null, null);
      const ctx = { id: ++this.ctxSeq, name: 'Global', phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: true, thisVal: this.globalThisObj, looked: new Set(), strict };
      scope.owner = ctx;
      this.globalScope = scope; this.globalCtx = ctx;
      this.stack.push(ctx);
      return ctx;
    }

    runProgram(ast) {
      const strict = !!(ast.body[0] && ast.body[0].directive === 'use strict');
      const ctx = this.makeGlobal(strict);
      const scope = ctx.funcScope;
      this.record(null, '🌍 The JS engine starts! First it creates the <b>Global Execution Context</b> and pushes it onto the <b>Call Stack</b>. Every program has exactly one.', 'push');
      if (strict) {
        this.badge('strict');
        this.record(ast.body[0], '🔒 <code>"use strict"</code> turns on <b>strict mode</b>: silent mistakes become real errors (no accidental globals, no writing to frozen objects), and <code>this</code> is <code>undefined</code> in plain function calls.', 'create');
      }
      this.record(null, '🏗️ <b>CREATION PHASE</b> — before running a single line, the engine scans the whole code and sets up memory for every declaration. This is called <b>hoisting</b>. <code>this</code> points to the global <code>window</code> object.', 'create');
      const decls = this.collectVars(ast.body, []).concat(this.lexicalDecls(ast.body));
      this.hoist(decls, scope, ctx, true);
      if (!decls.length) this.record(null, '📭 No <code>var</code>, <code>let</code>, <code>const</code> or <code>function</code> declarations found — nothing to hoist.', 'create');
      ctx.phase = 'execution'; this.stage = 'execution';
      this.record(null, '⚡ <b>EXECUTION PHASE</b> — memory is ready! Now the engine runs the code <b>line by line</b>, from top to bottom.', 'exec');
      try { this.runSync(this.execStatements(ast.body, ctx)); }
      catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
      this.finishScript();
    }

    // ======================================================== modules (import / export)
    splitFiles() {
      const re = /^[ \t]*\/\/[ \t]*@file[ \t]+(\S+)[ \t]*$/gm;
      const marks = [];
      let m;
      while ((m = re.exec(this.src))) marks.push({ name: m[1].replace(/^\.\//, ''), start: m.index });
      if (!marks.length) return null;
      return marks.map((mk, i) => ({ name: mk.name, start: mk.start, end: i + 1 < marks.length ? marks[i + 1].start : this.src.length }));
    }

    runModules(files) {
      const ctx = this.makeGlobal(true);
      this.modules = files;
      const byName = new Map(files.map(f => [f.name, f]));
      this.moduleMap = byName;
      this.record(null, `🌍 The JS engine starts and creates the <b>Global Execution Context</b>. This program is made of <b>${files.length} modules</b>: ${files.map(f => code(f.name)).join(', ')}.`, 'push');
      const entry = byName.get('main.js') || files[files.length - 1];
      ctx.phase = 'execution'; this.stage = 'execution';
      this.badge('module');
      this.record(null, `📦 The entry module is ${code(entry.name)}. Before running it, the engine follows its <code>import</code> lines and runs those modules <b>first</b> (each module runs only once).`, 'exec');
      try { this.evalModule(entry, byName, null, null); }
      catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
      this.finishScript();
    }

    resolveModule(spec, byName, node) {
      const name = String(spec).replace(/^\.\//, '');
      const m = byName.get(name) || byName.get(name + '.js');
      if (!m) throw this.makeError('Error', `Cannot find module '${spec}' — add a "// @file ${name}" section`, node);
      return m;
    }

    // follow an export (possibly re-exported) to the scope + variable that really holds it
    resolveExport(mod, name, node, seen = new Set()) {
      if (seen.has(mod.name + ':' + name)) throw this.makeError('SyntaxError', `Circular re-export of '${name}'`, node);
      seen.add(mod.name + ':' + name);
      const ex = mod.exports.get(name);
      if (!ex) throw this.makeError('SyntaxError', `The module '${mod.name}' does not provide an export named '${name}'`, node);
      if (ex.from) return this.resolveExport(ex.from, ex.name, node, seen);
      return { scope: mod.scope, name: ex.local };
    }

    // Runs a module once. Dependencies run first; if one pauses at a top-level `await`,
    // this module waits for it (onDone is called when `mod` has completely finished).
    evalModule(mod, byName, fromNode, onDone) {
      if (mod.state === 'done') { if (onDone) onDone(); return; }
      if (mod.state === 'evaluating') { mod.waiters.push(onDone); return; } // paused at top-level await
      if (mod.state === 'linking') { if (onDone) onDone(); return; }        // circular import: carry on
      mod.state = 'linking';
      mod.waiters = onDone ? [onDone] : [];
      mod.scope = this.newScope('module', `module ${mod.name}`, this.globalScope, null);
      mod.exports = new Map();
      const deps = [];
      for (const st of mod.ast.body) {
        if (st.type === 'ImportDeclaration' || ((st.type === 'ExportNamedDeclaration' || st.type === 'ExportAllDeclaration') && st.source)) {
          deps.push({ st, dep: this.resolveModule(st.source.value, byName, st) });
        }
      }
      const runDeps = k => {
        if (k === deps.length) { this.runModuleBody(mod, deps); return; }
        const { st, dep } = deps[k];
        if (dep.state === 'done' || dep.state === 'linking') {
          if (dep.failed) { this.failModule(mod, dep); return; }
          runDeps(k + 1);
          return;
        }
        this.record(st, dep.state === 'evaluating'
          ? `⏳ ${code(mod.name)} needs ${code(dep.name)}, which is paused at a <b>top-level await</b> — so ${code(mod.name)} waits for it to finish.`
          : `📥 ${code(mod.name)} needs ${code(dep.name)}, so the engine runs ${code(dep.name)} <b>first</b>.`, 'exec');
        this.evalModule(dep, byName, st, () => { if (dep.failed) this.failModule(mod, dep); else runDeps(k + 1); });
      };
      runDeps(0);
    }

    failModule(mod, dep) {
      mod.state = 'done';
      mod.failed = true;
      this.record(null, `❌ ${code(mod.name)} will not run, because the module it imports (${code(dep.name)}) failed with an error.`, 'error');
      mod.waiters.splice(0).forEach(w => w && w());
    }

    runModuleBody(mod, deps) {
      const body = mod.ast.body, scope = mod.scope;
      for (const st of body) {
        if (st.type === 'ExportNamedDeclaration') {
          if (st.declaration) {
            const d = st.declaration;
            const names = d.type === 'VariableDeclaration' ? d.declarations.flatMap(x => patternNames(x.id)) : [d.id.name];
            names.forEach(n => mod.exports.set(n, { local: n }));
          }
          const from = st.source ? deps.find(x => x.st === st).dep : null;
          (st.specifiers || []).forEach(sp => {
            const local = sp.local.name !== undefined ? sp.local.name : sp.local.value;
            const exported = sp.exported.name !== undefined ? sp.exported.name : sp.exported.value;
            mod.exports.set(exported, from ? { from, name: local } : { local });
          });
        } else if (st.type === 'ExportDefaultDeclaration') {
          const d = st.declaration;
          mod.exports.set('default', { local: (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id ? d.id.name : '*default*' });
        } else if (st.type === 'ExportAllDeclaration') {
          const from = deps.find(x => x.st === st).dep;
          if (st.exported) mod.exports.set(st.exported.name, { local: '*ns:' + from.name, nsOf: from });
          else from.exports.forEach((v, k) => { if (k !== 'default') mod.exports.set(k, { from, name: k }); });
        }
      }
      // the module gets its own execution context (always strict, top-level `this` is undefined)
      const ctx = { id: ++this.ctxSeq, name: `module ${mod.name}`, phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: false, isModule: true, thisVal: undefined, looked: new Set(), strict: true };
      scope.owner = ctx;
      this.stack.push(ctx);
      const head = R(mod.start, mod.start + 1, this.lineAt(mod.start));
      this.record(head, `📦 A <b>Module Execution Context</b> is created for ${code(mod.name)}. Modules are always <b>strict</b>, their top-level <code>this</code> is <code>undefined</code>, and their variables are <b>private</b> unless exported.`, 'push');
      // imports become live links to the exporting module's variables
      const linked = [];
      for (const { st, dep } of deps) {
        if (st.type !== 'ImportDeclaration') continue;
        for (const sp of st.specifiers) {
          if (sp.type === 'ImportNamespaceSpecifier') {
            scope.vars.set(sp.local.name, { value: this.namespaceObj(dep, st), kind: 'import' });
            linked.push(`${sp.local.name} → everything from ${dep.name}`);
          } else {
            const name = sp.type === 'ImportDefaultSpecifier' ? 'default' : (sp.imported.name !== undefined ? sp.imported.name : sp.imported.value);
            const target = this.resolveExport(dep, name, sp);
            scope.vars.set(sp.local.name, { value: undefined, kind: 'import', importFrom: target, importLabel: `${dep.name} → ${name}` });
            linked.push(`${sp.local.name} ← ${dep.name}`);
          }
        }
      }
      for (const [, ex] of mod.exports) if (ex.nsOf) scope.vars.set(ex.local, { value: this.namespaceObj(ex.nsOf, null), kind: 'const' });
      const stmts = body.map(st => {
        if (st.type === 'ExportNamedDeclaration') return st.declaration || null;
        if (st.type === 'ExportDefaultDeclaration') {
          const d = st.declaration;
          if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) return d;
          return { type: 'ExportDefaultExpr', expr: d, start: st.start, end: st.end, loc: st.loc };
        }
        if (st.type === 'ImportDeclaration' || st.type === 'ExportAllDeclaration') return null;
        return st;
      }).filter(Boolean);
      if (mod.exports.get('default') && mod.exports.get('default').local === '*default*') scope.vars.set('*default*', { value: undefined, kind: 'const', tdz: true });
      const decls = this.collectVars(stmts, []).concat(this.lexicalDecls(stmts));
      this.hoist(decls, scope, ctx, false);
      const exportsList = [...mod.exports.keys()];
      this.record(head, `🏗️ <b>Creation phase</b> of ${code(mod.name)}: ${linked.length ? 'imports linked (' + linked.map(x => code(x)).join(', ') + ' — these are <b>live</b> links, not copies); ' : ''}${decls.length ? 'hoisted ' + decls.map(d => this.hoistShort(d)).join(', ') : 'nothing to hoist'}.${exportsList.length ? ' It will export: ' + exportsList.map(x => code(x)).join(', ') + '.' : ''}`, 'create');
      ctx.phase = 'execution';
      mod.state = 'evaluating';
      this.stepModule(mod, ctx, this.execStatements(stmts, ctx), 'next', undefined);
    }

    // drive a module body; a top-level `await` pauses the whole module like an async function
    stepModule(mod, ctx, gen, mode, value) {
      let r;
      try { r = mode === 'throw' ? gen.throw(new ThrowSignal(value, mod.awaitNode)) : gen.next(value); }
      catch (e) {
        this.removeCtx(ctx);
        if (!(e instanceof ThrowSignal)) throw e;
        mod.state = 'done';
        mod.failed = true;
        this.uncaught(e);
        mod.waiters.splice(0).forEach(w => w && w());
        return;
      }
      if (r.done) {
        this.removeCtx(ctx);
        mod.state = 'done';
        this.record(null, `✅ Module ${code(mod.name)} finished running. Its context is popped, but its memory stays alive so other modules can use its exports.`, 'pop');
        mod.waiters.splice(0).forEach(w => w && w());
        return;
      }
      if (r.value.kind !== 'await') throw new Unsupported('`yield` can only be used inside a generator function.', r.value.node);
      const p = this.toPromise(r.value.value);
      mod.awaitNode = r.value.node;
      this.removeCtx(ctx);
      const task = { ctx, root: true, promise: null, waitingOn: p, reason: () => `⏸ top-level await on Promise #${p.id}` };
      this.paused.push(task);
      this.badge('await');
      const resume = (m, v) => {
        this.paused.splice(this.paused.indexOf(task), 1);
        ctx.fromQueue = 'micro';
        this.stack.push(ctx);
        this.record(mod.awaitNode, m === 'next'
          ? `▶️ Module ${code(mod.name)} resumes after its top-level <code>await</code>, which gives ${this.valText(v)}.`
          : `▶️ Module ${code(mod.name)} resumes, but the awaited Promise was rejected, so <code>await</code> throws ${this.valText(v)}.`, 'push');
        this.stepModule(mod, ctx, gen, m, v);
      };
      this.promiseThen(p, v => resume('next', v), e => resume('throw', e), null, false, [p], `resume module ${mod.name}`);
      this.record(r.value.node, `⏸️ <b>Top-level await</b> in ${code(mod.name)}: the whole module pauses until Promise #${p.id} settles. Modules that import it must wait too, but the event loop keeps running other work.`, 'await');
    }

    namespaceObj(dep, node) {
      const ns = this.alloc('object');
      ns.ctorName = 'Module';
      dep.exports.forEach((ex, k) => {
        ns.props.set(k, new Accessor(this.native('get ' + k, () => { const t = this.resolveExport(dep, k, node); const e = t.scope.vars.get(t.name); return e ? e.value : undefined; }), null));
      });
      ns.frozen = true;
      return ns;
    }

    lineAt(offset) { let n = 1; for (let i = 0; i < offset && i < this.src.length; i++) if (this.src[i] === '\n') n++; return n; }

    finishScript() {
      this.stack.pop();
      this.pending.clear();
      this.stage = this.webApis.length || this.microtasks.length ? 'eventloop' : 'done';
      const w = [];
      if (this.microtasks.length) w.push(`${this.microtasks.length} Promise job${this.microtasks.length > 1 ? 's are' : ' is'} waiting in the Microtask Queue ⚡`);
      if (this.webApis.length) w.push(`${this.webApis.length} timer${this.webApis.length > 1 ? 's are' : ' is'} still waiting in the Web APIs ⏳`);
      const waiting = w.length ? ' But ' + w.join(' and ') + '…' : '';
      this.record(null, `🏁 All synchronous code has run. The Global Execution Context is <b>popped</b> — the Call Stack is now <b>empty</b>.${waiting}`, 'pop');
    }

    uncaught(e) {
      this.badge('error');
      this.consoleLines.push({ type: 'error', text: 'Uncaught ' + this.display(e.value, 0, true) });
      this.record(e.node, `💥 <b>Uncaught ${esc(this.display(e.value, 0, true))}</b> — nobody caught this error, so this script stops right here.`, 'error');
    }

    setTimer(args, node, interval) {
      const cb = args[0];
      const fname = interval ? 'setInterval' : 'setTimeout';
      if (!this.isCallable(cb)) throw this.makeError('TypeError', `The callback passed to ${fname} must be a function`, node);
      let delay = Math.max(0, this.toNumber(args[1] === undefined ? 0 : args[1]) || 0);
      if (interval) delay = Math.max(delay, 1);
      const t = { id: ++this.timerSeq, cb, args: args.slice(2), delay, start: this.time, fireAt: this.time + delay, label: this.fnLabel(cb), interval: !!interval };
      this.webApis.push(t);
      this.badge('async');
      this.record(node, interval
        ? `🔁 ${code('setInterval')} is a browser <b>Web API</b> too. The browser will put ${code(t.label)} in the Callback Queue <b>every ${delay}ms</b> until ${code('clearInterval(' + t.id + ')')} is called. JavaScript moves on right away!`
        : `⏲️ ${code('setTimeout')} isn't part of JavaScript itself — it's a browser <b>Web API</b>. The browser starts a <b>${delay}ms</b> timer and holds on to ${code(t.label)}. JavaScript does <b>not</b> wait — it moves on right away!`, 'webapi');
      return t.id;
    }

    runEventLoop() {
      if (this.nodeMode) { this.runNodeLoop(); return; }
      this.drainMicrotasks();
      if (!this.webApis.length) { this.stage = 'done'; return; }
      this.stage = 'eventloop';
      while (this.webApis.length || this.queue.length) {
        if (!this.queue.length) {
          const next = Math.min(...this.webApis.map(t => t.fireAt));
          if (next > this.time) this.time = next;
          const due = this.webApis.filter(t => t.fireAt <= this.time).sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
          for (const t of due) {
            this.webApis.splice(this.webApis.indexOf(t), 1);
            this.queue.push(t);
            if (t.interval) this.webApis.push(Object.assign({}, t, { start: this.time, fireAt: this.time + t.delay }));
            this.record(null, t.doneMsg ? t.doneMsg() : t.kind === 'frame'
              ? `🎞️ Time is now <b>${this.time}ms</b>: the browser is about to repaint the screen, so it queues ${code(t.label.replace('🎞️ ', ''))}. (Simplified: real browsers run frame callbacks in a special step just before painting.)`
              : `⏰ Time is now <b>${this.time}ms</b>: the ${t.delay}ms timer is done! The browser puts ${code(t.label)} into the <b>Callback Queue</b> — it can't jump straight onto the Call Stack.${t.interval ? ' Because it is an <b>interval</b>, the browser also restarts the timer for another round.' : ''}`, 'queue');
          }
        }
        const task = this.queue[0];
        this.badge('loop');
        this.nextTask = task;
        this.record(null, `🔄 <b>Event Loop</b>: "Is the Call Stack empty? Yes!" → it takes ${code(task.label)} from the front of the queue and pushes it onto the stack.`, 'eventloop');
        this.queue.shift();
        try {
          if (task.internal) task.internal();
          else this.callFunction(task.cb, undefined, task.args, task.cb.node || null, 'queue');
        }
        catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
        this.pending.clear();
        this.tempRoot = undefined;
        this.drainMicrotasks();
        this.stage = 'eventloop';
      }
      this.stage = 'done';
    }

    // ======================================================== function calls
    // Code runs inside generators so an async function can pause at `await`.
    // Normal (non-async) code never pauses, so it is driven to the end in one go.
    runSync(gen) {
      const r = gen.next();
      if (!r.done) throw new Unsupported('`await` can only be used inside an async function.', r.value && r.value.node);
      return r.value;
    }

    removeCtx(ctx) { const i = this.stack.lastIndexOf(ctx); if (i >= 0) this.stack.splice(i, 1); }

    callFunction(fn, thisVal, args, callNode, how, opts) {
      if (!this.isCallable(fn)) throw this.makeError('TypeError', `${this.display(fn)} is not a function`, callNode);
      if (fn.kind === 'native') {
        try { return fn.fn.call(this, thisVal, args, callNode); }
        catch (e) {
          // a real JS error from a built-in (e.g. bad regex, invalid argument) becomes a catchable JS error
          if (e instanceof Error) throw this.makeError(ERROR_NAMES.includes(e.name) ? e.name : 'Error', e.message, callNode);
          throw e;
        }
      }
      fn.calls = (fn.calls || 0) + 1;
      if (fn.isClass && !(opts && opts.construct)) throw this.makeError('TypeError', `Class constructor ${fn.name} cannot be invoked without 'new'`, callNode);
      if (this.stack.length >= MAX_DEPTH) throw this.makeError('RangeError', 'Maximum call stack size exceeded', callNode);

      const name = fn.isClass ? `${fn.label} constructor` : fn.name ? fn.name + '()' : fn.label;
      const scope = this.newScope('function', name, fn.closure, null);
      const construct = !!(opts && opts.construct);
      const ctx = {
        id: ++this.ctxSeq, name, phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: false,
        // plain calls get `window` as this in sloppy mode, but `undefined` in strict mode
        thisVal: fn.isArrow ? fn.lexicalThis : construct ? thisVal : thisVal === undefined && !fn.strict ? this.globalThisObj : thisVal,
        strict: !!fn.strict,
        isArrow: fn.isArrow, isAsync: !!fn.isAsync, fn, looked: new Set(), fromQueue: how || null, args,
        classFn: construct && fn.isClass ? fn : null, pendingThis: opts && opts.pendingThis, derived: !!(opts && opts.derived),
        newTarget: construct ? opts.newTarget : fn.isArrow && fn.lexicalCtx ? fn.lexicalCtx.newTarget : undefined,
      };
      scope.owner = ctx;
      const recursive = this.stack.some(c => c.fn === fn);
      this.stack.push(ctx);
      this.badge('call');
      if (recursive) this.badge('recursion');
      const argText = args.map(a => this.display(a, 0, false, 1)).join(', ');
      const asyncNote = fn.isAsync ? ' It is an <b>async</b> function, so it will hand back a <b>Promise</b>.' : '';
      this.record(callNode, how === 'queue' || how === 'micro'
        ? `${how === 'micro' ? '⚡' : '📥'} ${code(name)} comes off the ${how === 'micro' ? 'Microtask' : 'Callback'} Queue and lands on the Call Stack. A fresh <b>Execution Context</b> is created for it.${asyncNote}`
        : `📞 Calling ${code(fn.name ? fn.name + '(' + trunc(argText, 40) + ')' : fn.label)}${!fn.name && args.length ? ' with ' + code(trunc(argText, 40)) : ''} → a brand-new <b>Execution Context</b> is created and <b>pushed</b> on top of the Call Stack.${recursive ? ' 🪆 It calls itself — that is <b>recursion</b>!' : ''}${asyncNote}`, 'push');

      if (fn.isGenerator) return this.startGenerator(fn, ctx, args, callNode, name);
      if (fn.isAsync) return this.startAsync(fn, ctx, args, callNode, name);

      let result;
      try {
        result = this.runSync(this.runBody(fn, ctx, args, name));
        if (ctx.derived && ctx.thisVal === UNINIT && !(result instanceof JSObject)) {
          throw this.makeError('ReferenceError', "Must call super constructor in derived class before accessing 'this' or returning from derived constructor", callNode);
        }
      } catch (e) {
        this.removeCtx(ctx);
        if (e instanceof ThrowSignal) this.record(e.node, `💨 The error flies out of ${code(name)} — its Execution Context is thrown off the stack while the error looks for a <code>catch</code>.`, 'pop');
        throw e;
      }
      this.removeCtx(ctx);
      this.tempRoot = result;
      const caller = this.stack[this.stack.length - 1];
      this.record(callNode, `📤 ${code(name)} is done and returns ${this.valText(result)}. Its Execution Context is <b>popped</b> off the stack${caller ? ` — back to ${code(caller.name)}.` : ' — the Call Stack is empty again.'}`, 'pop');
      return result;
    }

    // creation phase + execution phase of one function call
    *runBody(fn, ctx, args, name) {
      const node = fn.node, scope = ctx.funcScope;
      const header = R(node.start, node.body.start, node.loc.start.line);
      for (let i = 0; i < node.params.length; i++) {
        const p = node.params[i];
        if (p.type === 'RestElement') yield* this.bindPattern(p.argument, this.makeArray(args.slice(i)), ctx, 'declare', 'param', scope);
        else yield* this.bindPattern(p, args[i], ctx, 'declare', 'param', scope);
      }
      const params = [...scope.vars.keys()];
      let hoisted = [];
      if (node.body.type === 'BlockStatement') {
        const b = node.body.body;
        hoisted = this.hoist(this.collectVars(b, []).concat(this.lexicalDecls(b)), scope, ctx, false);
        if (hoisted.some(d => d.kind !== 'var' && d.kind !== 'function')) this.badge('tdz');
      }
      const parts = [];
      if (params.length) parts.push('parameters ' + params.map(n => code(n + ' = ' + this.display(scope.vars.get(n).value, 0, false, 1))).join(', '));
      if (hoisted.length) parts.push('hoisted ' + hoisted.map(d => this.hoistShort(d)).join(', '));
      let note = '';
      const cl = fn.closure;
      if (cl && cl.kind !== 'global' && cl.owner && !this.stack.includes(cl.owner)) {
        this.badge('closure');
        note = ` 🎒 It also carries a <b>closure backpack</b>: the variables of ${code(cl.name)}, which already finished, are still reachable!`;
      }
      const thisText = fn.isArrow ? 'is borrowed from where the arrow function was created (arrows have no own <code>this</code>)'
        : ctx.thisVal === UNINIT ? 'is <b>not ready yet</b> — in a class that <code>extends</code> another, you must call <code>super()</code> first'
        : '→ ' + esc(this.serValue(ctx.thisVal).text);
      this.changed = null;
      this.record(header, `🏗️ <b>Creation phase</b> of ${code(name)}: ${parts.length ? parts.join('; ') : 'no parameters or declarations to set up'}. <code>this</code> ${thisText}.${note}`, 'create');

      ctx.phase = 'execution';
      if (fn.isGenerator) yield { kind: 'created' }; // a generator stops here until the first .next()
      if (node.body.type !== 'BlockStatement') {
        this.record(node.body, `⚡ <b>Execution phase</b> of ${code(name)} — evaluating ${code(this.snip(node.body))}`, 'exec');
        const result = yield* this.evaluate(node.body, ctx);
        this.tempRoot = result;
        this.record(node.body, `↩️ The arrow function returns ${this.valText(result)} (no curly braces = automatic return).`, 'return');
        return result;
      }
      this.record(header, `⚡ <b>Execution phase</b> of ${code(name)} begins — running its code line by line.`, 'exec');
      try { yield* this.execStatements(node.body.body, ctx); }
      catch (e) { if (e instanceof ReturnSignal || e instanceof GenReturnSignal) return e.value; throw e; }
      this.record(R(node.body.end - 1, node.body.end, node.body.loc.end.line), ctx.classFn
        ? `🔚 The constructor of ${code(ctx.classFn.label)} is done — the new object is ready.`
        : `🔚 Reached the end of ${code(name)} without a <code>return</code>, so it returns ${code('undefined')}.`, 'return');
      return undefined;
    }

    // ======================================================== async / await
    startAsync(fn, ctx, args, callNode, name) {
      const promise = this.newPromise();
      this.badge('await');
      const task = { fn, ctx, name, promise, gen: this.runBody(fn, ctx, args, name), callNode, awaitNode: null, waitingOn: null };
      this.stepAsync(task, 'next', undefined);
      return promise;
    }

    stepAsync(task, mode, value) {
      let r;
      try {
        r = mode === 'throw' ? task.gen.throw(new ThrowSignal(value, task.awaitNode)) : task.gen.next(value);
      } catch (e) {
        this.removeCtx(task.ctx);
        if (!(e instanceof ThrowSignal)) throw e;
        this.record(e.node, `💨 The error escapes async ${code(task.name)}. Its Execution Context is popped — and instead of crashing the program, its Promise #${task.promise.id} gets <b>rejected</b>.`, 'pop');
        task.promise.alreadyResolved = true;
        this.settle(task.promise, 'rejected', e.value, null);
        return;
      }
      const fnNode = task.fn.node;
      if (r.done) {
        this.removeCtx(task.ctx);
        this.tempRoot = r.value;
        this.record(R(fnNode.start, fnNode.body.start, fnNode.loc.start.line), `📤 async ${code(task.name)} is finished. Its Execution Context is <b>popped</b>, and its Promise #${task.promise.id} is resolved with ${this.valText(r.value)}.`, 'pop');
        this.resolvePromise(task.promise, r.value, null);
        return;
      }
      // paused at an `await`
      if (r.value.kind !== 'await') throw new Unsupported('`yield` can only be used inside a generator function.', r.value.node);
      const awaited = r.value.value, node = r.value.node;
      task.awaitNode = node;
      const p = this.toPromise(awaited);
      task.waitingOn = p;
      task.root = true;
      task.reason = () => `⏸ awaiting Promise #${p.id}`;
      this.removeCtx(task.ctx);
      this.paused.push(task);
      this.promiseThen(p, v => this.resumeAsync(task, 'next', v), e => this.resumeAsync(task, 'throw', e), null, false, [task.promise, p], `resume ${task.name}`);
      const caller = this.stack[this.stack.length - 1];
      const first = task.ctx.fromQueue !== 'micro';
      this.record(node, `⏸️ <code>await</code> ${this.valText(awaited)} → ${code(task.name)} <b>pauses</b> here. Its Execution Context is lifted <b>off the Call Stack</b> and parked until Promise #${p.id} settles${p.state !== 'pending' ? ' (it already has, so the "resume" job goes straight into the Microtask Queue)' : ''}.${caller ? ` Meanwhile ${code(caller.name)} carries on${first ? ` — it already got Promise #${task.promise.id} back` : ''}.` : ' The Call Stack is now free for other work.'}`, 'await');
    }

    resumeAsync(task, mode, value) {
      this.paused.splice(this.paused.indexOf(task), 1);
      task.ctx.fromQueue = 'micro';
      task.waitingOn = null;
      this.stack.push(task.ctx);
      this.record(task.awaitNode, mode === 'next'
        ? `▶️ ${code(task.name)} is <b>back on the Call Stack</b>! It continues right after its <code>await</code>, which now gives ${this.valText(value)}.`
        : `▶️ ${code(task.name)} is back on the Call Stack, but the awaited Promise was <b>rejected</b> — so <code>await</code> throws ${this.valText(value)} right here (a <code>try/catch</code> can catch it).`, 'push');
      this.stepAsync(task, mode, value);
    }

    *evalArgs(list, ctx) {
      const out = [];
      for (const a of list) {
        if (a.type === 'SpreadElement') { const v = yield* this.evaluate(a.argument, ctx); out.push(...this.iterable(v, a.argument)); }
        else out.push(yield* this.evaluate(a, ctx));
      }
      return out;
    }

  });
})();
