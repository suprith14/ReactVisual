/*
 * JS Engine Lab — engine part: real multithreading (simulated faithfully).
 *
 *  - every Web Worker has its OWN call stack, shown next to the main one
 *  - workers that have work at the same time take turns ONE STATEMENT AT A TIME, so you can watch
 *    them interleave like threads on separate CPU cores — including data races
 *  - SharedArrayBuffer: memory that is shared (not copied) between threads
 *  - Atomics: indivisible read-modify-write operations, plus wait / notify to block and wake threads
 */
(function () {
  'use strict';
  const { CONSTRUCT, esc, code, JSObject, ThrowSignal } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { setupPlatform: P.setupPlatform, createWorker: P.createWorker, platformRoots: P.platformRoots, cloneValue: P.cloneValue, display: P.display, serExtra: P.serExtra };

  window.JSEngine.mixin(class {
    setupPlatform() {
      base.setupPlatform.call(this);
      const I = this, B = this.builtins;
      this.mainStack = this.stack;
      this.threadJobs = [];
      this.asyncWaiters = [];

      B.set('SharedArrayBuffer', this.native('SharedArrayBuffer', function (s, a, node) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Constructor SharedArrayBuffer requires 'new'", node);
        const o = this.wrapBuffer(new ArrayBuffer(this.toNumber(a[0] || 0)));
        o.shared = true; o.ctorName = 'SharedArrayBuffer';
        this.badge('shared');
        this.record(node, `🔗 <code>new SharedArrayBuffer</code> #${o.id}: ${o.buf.byteLength} bytes that several threads can use <b>at the same time</b>. Sending it to a worker shares the <b>same memory</b> instead of copying it — powerful, but now two threads can change it at once.`, 'heap');
        return o;
      }, { isCtor: true, typedName: '' }));

      // ---- Atomics
      const intTA = (x, node) => {
        if (!(x instanceof JSObject) || x.kind !== 'typed' || /Float|Clamped/.test(x.ta.constructor.name)) throw I.makeError('TypeError', 'Atomics operations need an integer typed array (e.g. Int32Array)', node);
        return x.ta;
      };
      const val = (ta, v) => (typeof ta[0] === 'bigint' ? BigInt(v) : I.toNumber(v));
      const A = {};
      ['add', 'sub', 'and', 'or', 'xor', 'exchange'].forEach(op => {
        A[op] = this.native(op, function (s, a, node) {
          const ta = intTA(a[0], node), i = this.toNumber(a[1]);
          const old = Atomics[op](ta, i, val(ta, a[2]));
          this.changedProp = { id: a[0].id, key: String(i) };
          this.record(node, `⚛️ <code>Atomics.${op}</code> reads slot ${i} (${old}), changes it and writes it back (now ${ta[i]}) as <b>one indivisible step</b>: no other thread can sneak in between.`, 'heap');
          return old;
        });
      });
      A.load = this.native('load', (s, a, node) => Atomics.load(intTA(a[0], node), I.toNumber(a[1])));
      A.store = this.native('store', function (s, a, node) { const ta = intTA(a[0], node); const r = Atomics.store(ta, this.toNumber(a[1]), val(ta, a[2])); this.changedProp = { id: a[0].id, key: String(a[1]) }; return r; });
      A.compareExchange = this.native('compareExchange', function (s, a, node) {
        const ta = intTA(a[0], node), i = this.toNumber(a[1]);
        const old = Atomics.compareExchange(ta, i, val(ta, a[2]), val(ta, a[3]));
        this.record(node, `⚛️ <code>Atomics.compareExchange</code>: slot ${i} was ${old}; it is replaced only if it equalled ${this.toNumber(a[2])} (now ${ta[i]}). This is the building block of locks.`, 'heap');
        return old;
      });
      A.isLockFree = this.native('isLockFree', (s, a) => Atomics.isLockFree(I.toNumber(a[0])));
      A.notify = this.native('notify', function (s, a, node) { return this.atomicsNotify(intTA(a[0], node), this.toNumber(a[1]), a[2] === undefined ? Infinity : this.toNumber(a[2]), node); });
      // used when Atomics.wait is NOT called directly inside a worker's handler (see expressions.js)
      A.wait = this.native('wait', function (s, a, node) {
        const ta = intTA(a[0], node), i = this.toNumber(a[1]);
        if (!this.curThread) throw this.makeError('TypeError', 'Atomics.wait cannot be called on the main thread — it would freeze the page. Use Atomics.waitAsync instead.', node);
        if (ta[i] !== val(ta, a[2])) return 'not-equal';
        this.record(node, '⚛️ <code>Atomics.wait</code> can only really block when called directly in the worker\'s own code (not inside a nested function), so here it returns "timed-out".', 'native');
        return 'timed-out';
      });
      this.atomicsWaitFn = A.wait;
      A.waitAsync = this.native('waitAsync', function (s, a, node) {
        const ta = intTA(a[0], node), i = this.toNumber(a[1]);
        const res = this.alloc('object');
        if (ta[i] !== val(ta, a[2])) { res.props.set('async', false); res.props.set('value', 'not-equal'); return res; }
        const p = this.newPromise();
        this.asyncWaiters.push({ ta, i, p });
        res.props.set('async', true); res.props.set('value', p);
        this.record(node, `⚛️ <code>Atomics.waitAsync</code> returns Promise #${p.id}, which resolves when another thread calls <code>Atomics.notify</code> on slot ${i}. Unlike <code>wait</code>, it does not block.`, 'promise');
        return res;
      });
      B.set('Atomics', this.hiddenObj('Atomics', A));
    }

    // ======================================================== threads
    switchTo(w) {
      if (w && !w.stack) w.stack = [];
      this.stack = w ? w.stack : this.mainStack;
      this.curThread = w || null;
    }

    createWorker(name, file, node) {
      const same = (this.workers || []).filter(x => x.realm.file === file).length;
      const w = base.createWorker.call(this, name, file, node);
      w.stack = [];
      if (same) { w.realm.name = `${name} #${same + 1}`; w.realm.scope.name = `worker ${w.realm.name}`; }
      return w;
    }

    // the worker's top-level code becomes a "thread job"
    runWorkerScript(w) {
      const r = w.realm, f = r.file;
      const masked = this.src.split('').map((c, i) => (i >= f.start && i < f.end) || c === '\n' ? c : ' ').join('');
      let ast;
      try { ast = window.acorn.parse(masked, { ecmaVersion: 2022, locations: true, sourceType: 'script' }); }
      catch (e) { this.record(null, `💥 SyntaxError in ${code(r.name)}: ${esc(e.message)}`, 'error'); this.flushThreads(); return; }
      r.started = true;
      const ctx = { id: ++this.ctxSeq, name: `🧵 ${r.name}`, phase: 'creation', funcScope: r.scope, currentScope: r.scope, isGlobal: false, isWorker: true, thisVal: r.self, looked: new Set(), strict: false, tickable: true, thread: w };
      r.scope.owner = ctx;
      this.switchTo(w);
      w.stack.push(ctx);
      this.record({ start: f.start, end: f.start + 1, loc: { start: { line: this.lineAt(f.start) } } }, `🧵 The <b>${esc(r.name)}</b> thread starts with its own call stack and its own global memory.`, 'push');
      this.hoist(this.collectVars(ast.body, []).concat(this.lexicalDecls(ast.body)), r.scope, ctx, false);
      ctx.phase = 'execution';
      this.switchTo(null);
      const I = this;
      this.addJob({ w, ctx, top: true, gen: (function* () { yield* I.execStatements(ast.body, ctx); })() });
      this.flushThreads();
    }

    // a message for a worker starts a thread job for each of its handlers
    workerPost(w, dir, data, node) {
      const copy = this.cloneValue(data, node, new Map());
      const toWorker = dir === 'toWorker';
      const shared = this.hasShared(data);
      const t = { id: ++this.timerSeq, cb: null, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: `✉️ message → ${toWorker ? w.realm.name : 'main'}`, kind: 'worker', worker: w, refs: [copy], toMain: !toWorker };
      t.doneMsg = () => `✉️ A message arrives at ${toWorker ? 'the ' + code(w.realm.name) + ' thread' : 'the main thread'}. A "message" event task is queued there.`;
      t.internal = () => { try { deliver(); } finally { this.flushThreads(); } };
      const deliver = () => {
        if (w.terminated && toWorker) return;
        // a thread reads its messages only after its top-level code has finished
        const top = toWorker && this.threadJobs.find(j => j.w === w && j.top);
        if (top) { (top.after = top.after || []).push(deliver); return; }
        const target = toWorker ? w.realm.self : w;
        const ev = this.alloc('object');
        ev.ctorName = 'MessageEvent';
        ev.props.set('data', copy);
        const handlers = [target.props.get('onmessage'), ...target.wListeners].filter(f => this.isCallable(f));
        if (!toWorker) {
          this.record(null, handlers.length ? `✉️ The main thread handles the message: <code>event.data</code> is ${this.valText(copy)}.` : '✉️ The message arrived, but the main thread has no "message" listener.', 'eventloop');
          handlers.forEach(fn => this.callFunction(fn, target, [ev], fn.node || null, 'queue'));
          return;
        }
        if (!handlers.length) { this.record(null, `✉️ The message arrived, but ${code(w.realm.name)} has no "message" listener.`, 'eventloop'); return; }
        handlers.forEach(fn => {
          if (fn.kind !== 'function' || fn.isAsync || fn.isGenerator) {
            // simple case: run it straight through on the worker thread
            this.switchTo(w);
            try { this.callFunction(fn, target, [ev], fn.node || null, 'queue'); } finally { this.switchTo(null); }
            return;
          }
          this.addJob(this.threadCall(w, fn, target, [ev]));
        });
      };
      this.webApis.push(t);
      this.record(node, shared
        ? `✉️ <code>postMessage</code> sends ${this.valText(data)}. Its <b>SharedArrayBuffer</b> is <b>not copied</b>: both threads now see the same memory.`
        : `✉️ <code>postMessage</code> sends a <b>copy</b> of ${this.valText(data)} to ${toWorker ? 'the ' + code(w.realm.name) + ' thread' : 'the main thread'} (structured clone). The threads never share ordinary objects.`, 'webapi');
    }

    hasShared(v, seen = new Set()) {
      if (!(v instanceof JSObject) || seen.has(v)) return false;
      seen.add(v);
      if (v.kind === 'buffer') return !!v.shared;
      if (v.kind === 'typed') { const b = this.bufObjs && this.bufObjs.get(v.ta.buffer); return !!(b && b.shared); }
      if (v.items) return v.items.some(x => this.hasShared(x, seen));
      return [...v.props.values()].some(x => this.hasShared(x, seen));
    }

    // like callFunction, but returns a job whose body the scheduler steps through
    threadCall(w, fn, thisVal, args) {
      const name = fn.name ? fn.name + '()' : fn.label;
      const scope = this.newScope('function', name, fn.closure, null);
      const ctx = {
        id: ++this.ctxSeq, name, phase: 'creation', funcScope: scope, currentScope: scope, isGlobal: false,
        thisVal: fn.isArrow ? fn.lexicalThis : thisVal, isArrow: fn.isArrow, fn, looked: new Set(), fromQueue: 'queue', args, strict: !!fn.strict, tickable: true, thread: w,
      };
      scope.owner = ctx;
      fn.calls = (fn.calls || 0) + 1;
      this.switchTo(w);
      w.stack.push(ctx);
      this.record(fn.node, `🧵 ${code(name)} starts on the <b>${esc(w.realm.name)}</b> thread to handle the message.`, 'push');
      this.switchTo(null);
      return { w, ctx, gen: this.runBody(fn, ctx, args, name) };
    }

    // start the scheduler once every thread job that is due right now has been created
    addJob(job) { this.threadJobs.push(job); }
    flushThreads() {
      if (!this.threadJobs.length || this.schedulerRunning) return;
      if (this.queue.some(t => t.kind === 'worker' && !t.toMain)) return; // more threads are about to start
      this.runThreads();
    }

    // Round-robin: each runnable thread runs ONE statement, then the next thread gets a turn.
    runThreads() {
      if (this.schedulerRunning) return;
      this.schedulerRunning = true;
      let last = null;
      try {
        while (this.threadJobs.length) {
          const runnable = this.threadJobs.filter(j => !j.waiting);
          if (!runnable.length) {
            const j = this.threadJobs[0];
            this.switchTo(j.w);
            this.record(null, `⏰ Every thread is asleep in <code>Atomics.wait</code> and nobody can wake them. ${code(j.w.realm.name)} gives up waiting: <code>Atomics.wait</code> returns "timed-out".`, 'native');
            j.waiting = null; j.resume = 'timed-out';
            continue;
          }
          for (const job of runnable) {
            if (!this.threadJobs.includes(job) || job.waiting) continue;
            this.switchTo(job.w);
            if (last && last !== job && this.threadJobs.length > 1) {
              this.record(null, `🔀 <b>Thread switch</b> → ${code(job.w.realm.name)} runs its next statement. (Real threads run at the same moment on different CPU cores; here they take turns one statement at a time, which shows how their steps interleave.)`, 'native');
            }
            last = job;
            job.w.ticking = true;
            let r;
            try { r = job.gen.next(job.resume); job.resume = undefined; }
            catch (e) { job.w.ticking = false; this.finishJob(job, e); continue; }
            job.w.ticking = false;
            if (r.done) { this.finishJob(job); continue; }
            if (r.value.kind === 'wait') this.parkJob(job, r.value);
            else if (r.value.kind !== 'tick') { this.finishJob(job, new ThrowSignal(this.makeErrorObj('SyntaxError', 'await is only valid in async functions'), r.value.node)); }
          }
        }
      } finally {
        this.switchTo(null);
        this.schedulerRunning = false;
      }
    }

    finishJob(job, err) {
      this.threadJobs = this.threadJobs.filter(j => j !== job);
      this.switchTo(job.w);
      const i = job.w.stack.lastIndexOf(job.ctx);
      if (i >= 0) job.w.stack.splice(i, 1);
      if (err && !(err instanceof ThrowSignal)) { this.switchTo(null); throw err; }
      if (err) this.uncaught(err);
      else this.record(null, job.top
        ? `🧵 ${code(job.w.realm.name)} finished its top-level code. The thread stays alive, waiting for messages.`
        : `📤 ${code(job.ctx.name)} finished on the ${code(job.w.realm.name)} thread. That thread's stack is empty again.`, 'pop');
      this.pending.clear();
      this.switchTo(null);
      if (job.after) job.after.forEach(f => f());
    }

    parkJob(job, y) {
      const [taObj, iRaw, vRaw] = y.args;
      if (!(taObj instanceof JSObject) || taObj.kind !== 'typed') { job.resume = 'not-equal'; return; }
      const ta = taObj.ta, i = this.toNumber(iRaw), v = typeof ta[0] === 'bigint' ? BigInt(vRaw) : this.toNumber(vRaw);
      if (ta[i] !== v) {
        job.resume = 'not-equal';
        this.record(y.node, `⚛️ <code>Atomics.wait</code>: slot ${i} is ${ta[i]}, not ${v}, so the thread does not sleep ("not-equal").`, 'native');
        return;
      }
      job.waiting = { ta, i };
      this.record(y.node, `😴 <code>Atomics.wait</code>: ${code(job.w.realm.name)} <b>goes to sleep</b> until another thread calls <code>Atomics.notify</code> on slot ${i}. (Worker threads may block like this; the main thread never may.)`, 'await');
    }

    atomicsNotify(ta, i, count, node) {
      let woken = 0;
      for (const j of this.threadJobs) {
        if (woken >= count) break;
        if (j.waiting && j.waiting.ta.buffer === ta.buffer && j.waiting.i === i) { j.waiting = null; j.resume = 'ok'; woken++; }
      }
      this.asyncWaiters = this.asyncWaiters.filter(w => {
        if (woken >= count || w.ta.buffer !== ta.buffer || w.i !== i) return true;
        this.resolvePromise(w.p, 'ok', null); woken++; return false;
      });
      this.record(node, `🔔 <code>Atomics.notify</code> on slot ${i} wakes ${woken} sleeping thread${woken === 1 ? '' : 's'}.`, 'native');
      return woken;
    }

    serThreads() {
      return (this.workers || []).filter(w => w.stack && w.stack.length).map(w => {
        const job = this.threadJobs.find(j => j.w === w);
        return { name: w.realm.name, sleeping: !!(job && job.waiting), running: this.curThread === w, stack: w.stack.map(c => this.reuse('c' + c.id, this.serCtx(c))) };
      });
    }

    platformRoots(markV, markS, root) {
      base.platformRoots.call(this, markV, markS, root);
      (this.workers || []).forEach(w => (w.stack || []).forEach(c => root(`the ${w.realm.name} thread`, () => { markS(c.currentScope); markV(c.thisVal); })));
      (this.asyncWaiters || []).forEach(x => root('Atomics.waitAsync', () => markV(x.p)));
    }

    // shared memory is passed by reference; everything else is copied as before
    cloneValue(v, node, seen) {
      if (v instanceof JSObject && v.kind === 'buffer' && v.shared) return v;
      if (v instanceof JSObject && v.kind === 'typed') {
        const b = this.bufObjs && this.bufObjs.get(v.ta.buffer);
        if (b && b.shared) return this.wrapTyped(new v.ta.constructor(v.ta.buffer, v.ta.byteOffset, v.ta.length));
      }
      return base.cloneValue.call(this, v, node, seen);
    }

    display(v, depth, top, maxDepth) {
      if (v instanceof JSObject && v.kind === 'buffer' && v.shared) return `SharedArrayBuffer { byteLength: ${v.buf.byteLength} }`;
      return base.display.call(this, v, depth, top, maxDepth);
    }

    serExtra(o, b) {
      const r = base.serExtra.call(this, o, b);
      if (r && o.kind === 'buffer' && o.shared) r.title = 'SharedArrayBuffer (shared by all threads)';
      return r;
    }
  });
})();
