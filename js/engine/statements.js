/* JS Engine Quest — engine part: statements: declarations, if, loops, switch, try/catch. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== statements
    *execStatements(stmts, ctx) { for (const s of stmts) yield* this.exec(s, ctx); }

    *exec(node, ctx) {
      if (ctx.tickable && ctx.thread && ctx.thread.ticking) yield { kind: 'tick', node };
      switch (node.type) {
        case 'VariableDeclaration': yield* this.execVarDecl(node, ctx); break;
        case 'FunctionDeclaration':
          this.record(R(node.start, node.body.start, node.loc.start.line), `⏭️ ${code('function ' + node.id.name)} was already stored in memory during the Creation phase — skip it.`, 'skip');
          break;
        case 'ExpressionStatement': yield* this.execExprStmt(node, ctx); break;
        case 'ReturnStatement': {
          let v;
          if (node.argument) v = yield* this.evaluate(node.argument, ctx);
          this.tempRoot = v;
          this.record(node, `↩️ ${code('return')} hands back ${this.valText(v)} to whoever called ${code(ctx.name)}.`, 'return');
          throw new ReturnSignal(v);
        }
        case 'IfStatement': {
          const t = yield* this.evaluate(node.test, ctx);
          const ok = this.truthy(t);
          const shown = typeof t === 'boolean' ? '' : ` (${esc(this.display(t, 0, false, 1))} is ${ok ? 'truthy' : 'falsy'})`;
          this.record(node.test, `🤔 Checking ${code(this.snip(node.test))} → <b>${ok}</b>${shown} ${ok ? '✅ so the <b>if</b> block runs.' : node.alternate ? '❌ so we jump to the <b>else</b> part.' : '❌ so the block is skipped.'}`, 'branch');
          if (ok) yield* this.exec(node.consequent, ctx);
          else if (node.alternate) yield* this.exec(node.alternate, ctx);
          break;
        }
        case 'BlockStatement': yield* this.execBlock(node, ctx); break;
        case 'ForStatement': yield* this.execFor(node, ctx); break;
        case 'ForOfStatement': case 'ForInStatement': yield* this.execForOf(node, ctx); break;
        case 'WhileStatement': case 'DoWhileStatement': yield* this.execWhile(node, ctx); break;
        case 'BreakStatement': this.record(node, '🛑 <code>break</code> → jump straight out of the loop.', 'flow'); throw new BreakSignal(node.label && node.label.name);
        case 'ContinueStatement': this.record(node, '⏩ <code>continue</code> → skip the rest of this round and go to the next one.', 'flow'); throw new ContinueSignal(node.label && node.label.name);
        case 'ThrowStatement': {
          const v = yield* this.evaluate(node.argument, ctx);
          this.badge('error');
          this.record(node, `💥 <code>throw</code> ${this.valText(v)}! Normal execution stops and JavaScript looks for a <code>catch</code> block…`, 'error');
          throw new ThrowSignal(v, node);
        }
        case 'TryStatement': yield* this.execTry(node, ctx); break;
        case 'SwitchStatement': yield* this.execSwitch(node, ctx); break;
        case 'LabeledStatement':
          node.body._label = node.label.name; // lets `continue label` find its loop
          try { yield* this.exec(node.body, ctx); } catch (e) { if (!(e instanceof BreakSignal && e.label === node.label.name)) throw e; }
          break;
        case 'EmptyStatement': break;
        case 'ClassDeclaration': yield* this.defineClass(node, ctx, true); break;
        case 'ExportDefaultExpr': {
          const d = node.expr;
          let v;
          if (d.type === 'FunctionDeclaration') { v = this.makeFunction(d, ctx.currentScope, ctx); this.nameFn(v, 'default'); }
          else if (d.type === 'ClassDeclaration') v = yield* this.defineClass(d, ctx, false);
          else { v = yield* this.evaluate(d, ctx); if (isAnonFn(d)) this.nameFn(v, 'default'); }
          this.initBinding('*default*', v, 'const', ctx);
          this.record(node, `📤 <code>export default</code> stores ${this.valText(v)} as this module's <b>default export</b>.`, 'assign');
          break;
        }
        default: throw new Unsupported(`"${node.type}" is not supported in this visualizer yet.`, node);
      }
      if (this.stack.length === 1 && this.stack[0] === ctx) this.pending.clear();
    }

    *execVarDecl(node, ctx) {
      for (const d of node.declarations) {
        const hasInit = !!d.init;
        let value;
        if (hasInit) {
          value = yield* this.evaluate(d.init, ctx);
          if (d.id.type === 'Identifier' && isAnonFn(d.init)) this.nameFn(value, d.id.name);
        }
        if (d.id.type !== 'Identifier') {
          yield* this.bindPattern(d.id, value, ctx, node.kind === 'var' ? 'assign' : 'init', node.kind);
          this.record(d, `📦 Destructuring: ${patternNames(d.id).map(n => code(n)).join(', ')} are unpacked from ${this.valText(value)} and stored in memory.`, 'assign');
          continue;
        }
        const name = d.id.name;
        if (node.kind === 'var') {
          if (!hasInit) { this.record(d, `⏭️ ${code('var ' + name)} was already created during hoisting — nothing new happens here.`, 'skip'); continue; }
          this.assignVar(name, value, ctx, d);
          this.record(d, `📦 ${code('var ' + name)} was ${code('undefined')} since hoisting — now it holds ${this.valText(value)}.`, 'assign');
        } else {
          this.initBinding(name, value, node.kind, ctx);
          this.record(d, `📦 ${code(node.kind + ' ' + name)} gets its value ${this.valText(value)} — it leaves the Temporal Dead Zone and is ready to use. ✅`, 'assign');
        }
      }
    }

    *execExprStmt(node, ctx) {
      const e = node.expression;
      const before = this.trace.length;
      this.implicitGlobal = null;
      this.frozenIgnored = false;
      const v = yield* this.evaluate(e, ctx);
      this.completion = v; // eval() returns the value of the last expression statement
      if (this.frozenIgnored && e.type === 'AssignmentExpression') {
        this.record(node, `🧊 ${code(this.snip(e.left))} was <b>not</b> changed — the object is frozen, so JavaScript silently ignores the assignment.`, 'assign');
        return;
      }
      if (e.type === 'AssignmentExpression' || e.type === 'UpdateExpression') {
        const target = e.type === 'AssignmentExpression' ? e.left : e.argument;
        let msg = `✏️ ${code(this.snip(target))} is updated → ${this.valText(this.lastAssigned)}`;
        if (target.type === 'MemberExpression' && this.changedProp) msg += ` — changed inside object #${this.changedProp.id} in the Heap.`;
        if (this.implicitGlobal) msg += ` ⚠️ ${code(this.implicitGlobal)} was never declared, so JavaScript quietly created a <b>global</b> variable (a classic bug!).`;
        this.record(node, msg, 'assign');
        return;
      }
      if (e.type === 'AwaitExpression') return;
      if ((e.type === 'CallExpression' || e.type === 'NewExpression') && this.trace.length > before) return;
      this.record(node, `🧮 Ran ${code(this.snip(e))} → ${this.valText(v)}`, 'eval');
    }

    *execBlock(node, ctx) {
      const decls = this.lexicalDecls(node.body);
      if (!decls.length) { yield* this.execStatements(node.body, ctx); return; }
      const prev = ctx.currentScope;
      const scope = this.newScope('block', `Block {} (line ${node.loc.start.line})`, prev, ctx);
      ctx.currentScope = scope;
      try {
        this.hoist(decls, scope, ctx, false);
        this.badge('block');
        this.record(R(node.start, node.start + 1, node.loc.start.line), `🧱 Entering a block <b>{ }</b> → a new <b>Block Scope</b> is created for ${decls.map(d => this.hoistShort(d)).join(', ')}. These live <b>only</b> inside the braces.`, 'scope');
        yield* this.execStatements(node.body, ctx);
      } finally { ctx.currentScope = prev; }
      this.record(R(node.end - 1, node.end, node.loc.end.line), `🧹 Leaving the block — its block scope (${decls.map(d => code(d.name)).join(', ')}) is thrown away.`, 'scope');
    }

    *loopBody(node, ctx) {
      try { yield* this.exec(node.body, ctx); return true; }
      catch (e) {
        if (e instanceof BreakSignal && !e.label) return false;
        if (e instanceof ContinueSignal && (!e.label || e.label === node._label)) return true;
        throw e;
      }
    }

    copyScope(s, round, ctx) {
      const n = this.newScope('block', `for-loop · round ${round}`, s.parent, ctx);
      s.vars.forEach((e, k) => n.vars.set(k, Object.assign({}, e)));
      return n;
    }

    *execFor(node, ctx) {
      const prev = ctx.currentScope;
      const isLet = node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var';
      let round = 0;
      try {
        if (isLet) {
          const s = this.newScope('block', 'for-loop · setup', prev, ctx);
          node.init.declarations.forEach(d => patternNames(d.id).forEach(n => s.vars.set(n, { value: undefined, kind: node.init.kind, tdz: true })));
          ctx.currentScope = s;
          this.badge('block');
        }
        if (node.init) {
          if (node.init.type === 'VariableDeclaration') yield* this.execVarDecl(node.init, ctx);
          else { yield* this.evaluate(node.init, ctx); this.record(node.init, `🏁 Loop setup: ${code(this.snip(node.init))}`, 'loop'); }
        }
        if (isLet) ctx.currentScope = this.copyScope(ctx.currentScope, ++round, ctx);
        let first = true;
        for (;;) {
          if (node.test) {
            const ok = this.truthy(yield* this.evaluate(node.test, ctx));
            const letNote = isLet && first ? ' (Because of <code>let</code>, every round gets its <b>own fresh copy</b> of the loop variable.)' : '';
            this.record(node.test, `🔁 Loop check ${code(this.snip(node.test))} → <b>${ok}</b> ${ok ? '— run the loop body.' : '— the loop is over!'}${letNote}`, 'loop');
            if (!ok) break;
          }
          first = false;
          if (!(yield* this.loopBody(node, ctx))) break;
          if (isLet) ctx.currentScope = this.copyScope(ctx.currentScope, ++round, ctx);
          if (node.update) {
            yield* this.evaluate(node.update, ctx);
            this.record(node.update, `➕ Update step ${code(this.snip(node.update))} → now ${this.valText(this.lastAssigned)}`, 'assign');
          }
        }
      } finally { ctx.currentScope = prev; }
    }

    *execForOf(node, ctx) {
      const I = this;
      const isOf = node.type === 'ForOfStatement';
      const right = yield* this.evaluate(node.right, ctx);
      const label = node.await ? 'for await…of' : isOf ? 'for…of' : 'for…in';
      // `step` hands back { done, value } one item at a time (lazy, so infinite generators work)
      let step, close = () => {}, total = null;
      if (!isOf) {
        const keys = this.forInKeys ? this.forInKeys(right) : this.ownKeys(right);
        let i = 0;
        total = keys.length;
        step = function* () { return i < keys.length ? { done: false, value: keys[i++] } : { done: true }; };
      } else if (node.await) {
        const am = right instanceof JSObject ? this.getMember(right, SYM_ASYNC_ITER, node.right) : undefined;
        if (this.isCallable(am)) {
          const itObj = this.callFunction(am, right, [], node.right);
          step = function* () {
            const p = I.callFunction(I.getMember(itObj, 'next', node.right), itObj, [], node.right);
            const res = yield { kind: 'await', value: p, node: node.right };
            return { done: I.truthy(I.getMember(res, 'done')), value: I.getMember(res, 'value') };
          };
        } else {
          const it = this.getIterator(right, node.right);
          step = function* () {
            const r = it.next();
            if (r.done) return r;
            return { done: false, value: yield { kind: 'await', value: r.value, node: node.right } };
          };
          close = () => it.return();
        }
      } else {
        const it = this.getIterator(right, node.right);
        step = function* () { return it.next(); };
        close = () => it.return();
      }
      const decl = node.left.type === 'VariableDeclaration' ? node.left : null;
      const pattern = decl ? decl.declarations[0].id : node.left;
      const prev = ctx.currentScope;
      let rounds = 0, exhausted = false;
      try {
        for (;;) {
          ctx.currentScope = prev;
          const r = yield* step();
          if (r.done) { exhausted = true; break; }
          rounds++;
          if (decl && decl.kind !== 'var') {
            const s = this.newScope('block', `${label} · round ${rounds}`, prev, ctx);
            ctx.currentScope = s;
            yield* this.bindPattern(pattern, r.value, ctx, 'declare', decl.kind, s);
          } else yield* this.bindPattern(pattern, r.value, ctx, 'assign');
          this.record(node.left, `🔁 Round ${rounds}${total != null ? ' of ' + total : ''}: ${code(this.snip(pattern))} = ${this.valText(r.value)}${node.await ? ' (after awaiting it)' : ''}`, 'loop');
          if (!(yield* this.loopBody(node, ctx))) break;
        }
      } finally {
        ctx.currentScope = prev;
        if (!exhausted) close();
      }
      this.record(node.right, exhausted ? `✅ Loop finished — the ${isOf ? 'iterator said <code>done: true</code>' : 'keys ran out'} after ${rounds} round${rounds === 1 ? '' : 's'}.` : `✅ Left the loop early after ${rounds} round${rounds === 1 ? '' : 's'}.`, 'loop');
    }

    *execWhile(node, ctx) {
      const doWhile = node.type === 'DoWhileStatement';
      for (let first = true; ; first = false) {
        if (!(doWhile && first)) {
          const ok = this.truthy(yield* this.evaluate(node.test, ctx));
          this.record(node.test, `🔁 ${doWhile ? 'do…while' : 'while'} check ${code(this.snip(node.test))} → <b>${ok}</b> ${ok ? '— run the body.' : '— the loop is over!'}`, 'loop');
          if (!ok) break;
        }
        if (!(yield* this.loopBody(node, ctx))) break;
      }
    }

    *execSwitch(node, ctx) {
      const d = yield* this.evaluate(node.discriminant, ctx);
      let idx = -1;
      for (let i = 0; i < node.cases.length; i++) {
        const c = node.cases[i];
        if (c.test && (yield* this.evaluate(c.test, ctx)) === d) { idx = i; break; }
      }
      if (idx < 0) idx = node.cases.findIndex(c => !c.test);
      this.record(node.discriminant, `🔀 switch on ${this.valText(d)} → ${idx < 0 ? 'no matching case.' : node.cases[idx].test ? 'jumps to ' + code('case ' + this.snip(node.cases[idx].test)) : 'jumps to ' + code('default')}`, 'branch');
      if (idx < 0) return;
      try { for (let i = idx; i < node.cases.length; i++) yield* this.execStatements(node.cases[i].consequent, ctx); }
      catch (e) { if (!(e instanceof BreakSignal && !e.label)) throw e; }
    }

    *execTry(node, ctx) {
      const prev = ctx.currentScope;
      let pending = null;
      try {
        try { yield* this.exec(node.block, ctx); }
        catch (e) {
          if (!(e instanceof ThrowSignal) || !node.handler) throw e;
          ctx.currentScope = prev;
          const h = node.handler;
          if (h.param) {
            const s = this.newScope('block', 'catch scope', prev, ctx);
            ctx.currentScope = s;
            yield* this.bindPattern(h.param, e.value, ctx, 'declare', 'let', s);
          }
          this.record(R(h.start, h.body.start, h.loc.start.line), `🛟 Error caught: ${this.valText(e.value)} — instead of crashing, JavaScript jumps into the <b>catch</b> block.`, 'catch');
          try { yield* this.exec(h.body, ctx); } finally { ctx.currentScope = prev; }
        }
      } catch (e) { pending = e; }
      ctx.currentScope = prev;
      if (pending && !isSignal(pending)) throw pending;
      if (node.finalizer) {
        this.record(R(node.finalizer.start, node.finalizer.start + 1, node.finalizer.loc.start.line), '🧾 The <code>finally</code> block always runs — error or not.', 'flow');
        yield* this.exec(node.finalizer, ctx);
      }
      if (pending) throw pending;
    }

  });
})();
