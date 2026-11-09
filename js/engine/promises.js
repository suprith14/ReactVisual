/* JS Engine Quest — engine part: promises, the microtask queue and unhandled rejections. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== promises & microtasks
    isPromise(v) { return v instanceof JSObject && !!v.isPromise; }

    newPromise() {
      const p = this.alloc('object');
      p.isPromise = true; p.state = 'pending'; p.value = undefined; p.reactions = [];
      this.badge('promise');
      return p;
    }

    setupPromise() {
      const I = this;
      const P = this.native('Promise', function (self, args, node) {
        if (self !== CONSTRUCT) throw this.makeError('TypeError', "Promise constructor cannot be invoked without 'new'", node);
        const executor = args[0];
        if (!this.isCallable(executor)) throw this.makeError('TypeError', 'Promise resolver is not a function', node);
        const p = this.newPromise();
        const res = this.resolvingFunction(p, 'resolve'), rej = this.resolvingFunction(p, 'reject');
        this.record(node, `🤝 <code>new Promise</code> creates Promise #${p.id} in the <b>pending</b> state and runs your executor function <b>right now</b> (synchronously!), handing it ${code('resolve')} and ${code('reject')}.`, 'promise');
        try { this.callFunction(executor, undefined, [res, rej], node); }
        catch (e) {
          if (!(e instanceof ThrowSignal)) throw e;
          if (!p.alreadyResolved) { p.alreadyResolved = true; this.settle(p, 'rejected', e.value, node, ' (the executor threw an error)'); }
        }
        return p;
      }, { isCtor: true });
      P.props.set('resolve', this.native('resolve', (s, a, node) => {
        if (I.isPromise(a[0])) return a[0];
        const p = I.newPromise();
        I.resolvePromise(p, a[0], node);
        return p;
      }));
      P.props.set('reject', this.native('reject', (s, a, node) => {
        const p = I.newPromise();
        p.alreadyResolved = true;
        I.settle(p, 'rejected', a[0], node);
        return p;
      }));
      const combinator = kind => this.native(kind, (s, a, node) => {
        const items = I.iterable(a[0], node);
        const p = I.newPromise();
        const results = new Array(items.length);
        let remaining = items.length;
        I.record(node, `🧺 <code>Promise.${kind}</code> creates Promise #${p.id} and watches ${items.length} item(s). ${kind === 'all' ? 'It fulfills when <b>all</b> fulfill, or rejects as soon as <b>one</b> rejects.' : 'It settles as soon as the <b>first</b> one settles.'}`, 'promise');
        if (kind === 'all' && !items.length) { I.resolvePromise(p, I.makeArray([]), node); return p; }
        items.forEach((item, i) => {
          let ip = item;
          if (!I.isPromise(ip)) { ip = I.newPromise(); ip.alreadyResolved = true; ip.state = 'fulfilled'; ip.value = item; }
          const done = v => {
            if (kind === 'race') { if (!p.alreadyResolved) { p.alreadyResolved = true; I.settle(p, 'fulfilled', v, null, ' (it won the race)'); } return; }
            results[i] = v;
            if (--remaining === 0 && !p.alreadyResolved) { p.alreadyResolved = true; I.settle(p, 'fulfilled', I.makeArray(results), null, ' (every item is done)'); }
          };
          const fail = r => { if (!p.alreadyResolved) { p.alreadyResolved = true; I.settle(p, 'rejected', r, null, ` (item ${i} rejected)`); } };
          I.promiseThen(ip, done, fail, null, false, [p, ip], `Promise.${kind} helper`);
        });
        return p;
      });
      P.props.set('all', combinator('all'));
      P.props.set('race', combinator('race'));
      this.builtins.set('Promise', P);
      this.builtins.set('queueMicrotask', this.native('queueMicrotask', function (s, a, node) {
        const fn = a[0];
        if (!this.isCallable(fn)) throw this.makeError('TypeError', 'queueMicrotask needs a function', node);
        this.enqueueMicro(this.fnLabel(fn), fn, [fn], () => this.callFunction(fn, undefined, [], fn.node || node, 'micro'));
        this.record(node, `⚡ <code>queueMicrotask</code> puts ${code(this.fnLabel(fn))} straight into the <b>Microtask Queue</b>.`, 'promise');
      }));
    }

    // the resolve / reject functions handed to a Promise executor
    resolvingFunction(p, which) {
      const f = this.native(which, function (s, a, node) {
        if (p.alreadyResolved) {
          this.record(node, `🙅 ${code(which + '()')} is ignored — Promise #${p.id} was already settled. A promise can only settle <b>once</b>.`, 'promise');
          return;
        }
        if (which === 'resolve') this.resolvePromise(p, a[0], node);
        else { p.alreadyResolved = true; this.settle(p, 'rejected', a[0], node); }
      });
      f.refs = [p];
      return f;
    }

    resolvePromise(p, x, node) {
      if (p.alreadyResolved) return;
      p.alreadyResolved = true;
      if (x === p) { this.settle(p, 'rejected', this.makeErrorObj('TypeError', 'Chaining cycle detected for promise'), node); return; }
      if (this.isPromise(x)) {
        this.enqueueMicro(`wait for Promise #${x.id}`, null, [p, x], () => {
          this.record(null, `🔗 Promise #${p.id} was resolved with <b>another promise</b> (#${x.id}), so it now subscribes to #${x.id} and will copy its result. (This costs extra microtask ticks!)`, 'promise');
          this.promiseThen(x, v => this.settle(p, 'fulfilled', v, null), r => this.settle(p, 'rejected', r, null), null, false, [p], `copy into Promise #${p.id}`);
        });
        this.record(node, `🔗 Promise #${p.id} is resolved with Promise #${x.id}. It can't take the value yet — a job to follow #${x.id} goes into the <b>Microtask Queue</b>.`, 'promise');
        return;
      }
      if (this.isThenable(x)) {
        // a "thenable" is any object with a .then method — JS asks it for its value in a microtask
        const then = this.getMember(x, 'then');
        this.enqueueMicro(`ask thenable #${x.id} .then()`, then, [p, x, then], () => {
          let called = false;
          const res = this.native('resolve', function (s, a, n) { if (called) return; called = true; p.alreadyResolved = false; this.resolvePromise(p, a[0], n); });
          const rej = this.native('reject', function (s, a, n) { if (called) return; called = true; this.settle(p, 'rejected', a[0], n); });
          res.refs = [p]; rej.refs = [p];
          this.record(null, `🔗 Promise #${p.id} was resolved with a <b>thenable</b> (object #${x.id} has a <code>.then</code> method), so JavaScript calls <code>.then(resolve, reject)</code> on it to find the real value.`, 'promise');
          try { this.callFunction(then, x, [res, rej], then.node || null); }
          catch (e) { if (!(e instanceof ThrowSignal)) throw e; if (!called) { called = true; this.settle(p, 'rejected', e.value, null); } }
        });
        this.record(node, `🔗 Promise #${p.id} is resolved with object #${x.id}, which has a <code>.then</code> method (a <b>thenable</b>). A job to ask it for its value goes into the Microtask Queue.`, 'promise');
        return;
      }
      this.settle(p, 'fulfilled', x, node);
    }

    settle(p, state, value, node, why) {
      p.state = state; p.value = value;
      const reactions = p.reactions;
      p.reactions = [];
      reactions.forEach(r => this.enqueueReaction(r, state, value));
      if (state === 'rejected') { this.badge('error'); if (!p.handled) this.unhandled.push(p); }
      this.changedProp = { id: p.id, key: 'state' };
      const n = reactions.length;
      this.record(node, `${state === 'fulfilled' ? '✅' : '❌'} Promise #${p.id} is now <b>${state}</b> with ${this.valText(value)}${why || ''}.${n ? ` Its ${n} waiting callback${n > 1 ? 's move' : ' moves'} into the <b>Microtask Queue</b>.` : ' No callbacks are waiting on it yet.'}`, 'promise');
    }

    enqueueMicro(label, fnObj, refs, run) {
      this.microtasks.push({ id: ++this.microSeq, label, ref: fnObj && fnObj.id > 0 ? fnObj.id : null, refs, run });
    }

    enqueueReaction(r, state, value) {
      const h = state === 'fulfilled' ? r.onF : r.onR;
      const label = r.label || (h ? (r.isFinally ? 'finally: ' : state === 'fulfilled' ? 'then: ' : 'catch: ') + this.fnLabel(h) : `pass-through → #${r.child.id}`);
      this.enqueueMicro(label, h instanceof JSObject ? h : null, [h, r.child, value].concat(r.refs || []), () => this.runReaction(r, state, value));
    }

    runReaction(r, state, value) {
      const h = state === 'fulfilled' ? r.onF : r.onR;
      if (typeof h === 'function') { h(value); return; } // internal helper
      const child = r.child;
      if (!h) {
        this.record(null, `↪️ There is no ${state === 'fulfilled' ? '<code>.then</code>' : '<code>.catch</code>'} handler on this link, so Promise #${child.id} simply passes the result along.`, 'promise');
        child.alreadyResolved = true;
        this.settle(child, state, value, null);
        return;
      }
      let result;
      try { result = this.callFunction(h, undefined, r.isFinally ? [] : [value], h.node || null, 'micro'); }
      catch (e) {
        if (!(e instanceof ThrowSignal)) throw e;
        child.alreadyResolved = true;
        this.settle(child, 'rejected', e.value, null, ' (the callback threw)');
        return;
      }
      if (r.isFinally) { child.alreadyResolved = true; this.settle(child, state, value, null, ' (finally keeps the original result)'); }
      else this.resolvePromise(child, result, null);
    }

    promiseThen(p, onF, onR, child, isFinally, refs, label) {
      const r = { onF, onR, child, isFinally, refs, label };
      p.handled = true;
      if (p.state === 'pending') p.reactions.push(r);
      else this.enqueueReaction(r, p.state, p.value);
    }

    promiseMethod(name) {
      if (name !== 'then' && name !== 'catch' && name !== 'finally') return undefined;
      return this.method('promise', name, function (p, a, node) {
        const fn = x => (this.isCallable(x) ? x : undefined);
        let onF, onR;
        if (name === 'then') { onF = fn(a[0]); onR = fn(a[1]); }
        else if (name === 'catch') onR = fn(a[0]);
        else onF = onR = fn(a[0]);
        const child = this.newPromise();
        this.promiseThen(p, onF, onR, child, name === 'finally' && !!onF);
        const cb = onF || onR;
        const what = cb ? code(this.fnLabel(cb)) : 'nothing (no function given)';
        const tail = ` <code>.${name}()</code> immediately returns a <b>new</b> Promise #${child.id}, so you can keep chaining.`;
        this.record(node, p.state === 'pending'
          ? `📝 <code>.${name}()</code> attaches ${what} to Promise #${p.id}. That promise is still <b>pending</b>, so the callback just waits on it.${tail}`
          : `📝 <code>.${name}()</code> on an already-<b>${p.state}</b> Promise #${p.id} → the job goes straight into the <b>Microtask Queue</b>. It still won't run until the Call Stack is empty!${tail}`, 'promise');
        return child;
      });
    }

    drainMicrotasks() {
      if (this.nodeMode) { this.drainNode(); return; }
      let first = true;
      while (this.microtasks.length) {
        const job = this.microtasks[0];
        this.stage = 'eventloop';
        this.badge('micro');
        this.nextTask = job;
        this.record(null, first
          ? `⚡ The Call Stack is empty → before touching the Callback Queue, the Event Loop empties the <b>Microtask Queue</b> first (Promise jobs are VIPs!). Next up: ${code(job.label)}`
          : `⚡ More microtasks are waiting, and the Event Loop keeps going until that queue is <b>completely</b> empty. Next up: ${code(job.label)}`, 'eventloop');
        this.microtasks.shift();
        try { job.run(); }
        catch (e) { if (e instanceof ThrowSignal) this.uncaught(e); else throw e; }
        this.pending.clear();
        this.tempRoot = undefined;
        first = false;
      }
      this.checkUnhandled();
    }

    checkUnhandled() {
      for (const p of this.unhandled) {
        if (p.handled || p.reported) continue;
        p.reported = true;
        this.consoleLines.push({ type: 'error', text: 'Uncaught (in promise) ' + this.display(p.value, 0, true) });
        this.record(null, `💥 Promise #${p.id} was rejected and nobody handled it with <code>.catch()</code> → the browser reports <b>Uncaught (in promise)</b>.`, 'error');
      }
      this.unhandled = [];
    }

  });
})();
