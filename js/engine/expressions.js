/* JS Engine Quest — engine part: expressions: values, operators, calls, new, await, yield, assignment. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== expressions
    *evaluate(node, ctx) {
      switch (node.type) {
        case 'Literal':
          if (node.regex) {
            let re;
            try { re = new RegExp(node.regex.pattern, node.regex.flags); } catch (e) { throw this.makeError('SyntaxError', e.message, node); }
            return this.makeRegExp(re);
          }
          if (node.bigint !== undefined) { this.badge('bigint'); return BigInt(node.bigint); }
          return node.value;
        case 'Identifier': return this.lookup(node.name, ctx, node);
        case 'ThisExpression':
          if (ctx.thisVal === UNINIT) throw this.makeError('ReferenceError', "Must call super constructor in derived class before accessing 'this'", node);
          return ctx.thisVal;
        case 'ClassExpression': return yield* this.defineClass(node, ctx, false);
        case 'MetaProperty': {
          let c = ctx;
          while (c && c.isArrow && c.fn && c.fn.lexicalCtx) c = c.fn.lexicalCtx;
          return c ? c.newTarget : undefined;
        }
        case 'TaggedTemplateExpression': {
          let fn, thisVal;
          if (node.tag.type === 'MemberExpression') {
            thisVal = yield* this.evaluate(node.tag.object, ctx);
            fn = this.getMember(thisVal, yield* this.memberKey(node.tag, ctx), node.tag);
          } else fn = yield* this.evaluate(node.tag, ctx);
          const q = node.quasi;
          const strings = this.makeArray(q.quasis.map(x => x.value.cooked));
          strings.props.set('raw', this.makeArray(q.quasis.map(x => x.value.raw)));
          const vals = [];
          for (const ex of q.expressions) vals.push(yield* this.evaluate(ex, ctx));
          if (!this.isCallable(fn)) throw this.makeError('TypeError', `${this.snip(node.tag, 30)} is not a function`, node);
          this.record(node, `🏷️ A <b>tagged template</b>: ${code(this.snip(node.tag, 20))} is called with the text pieces ${code(this.display(strings, 0, false, 1))} and the values ${code(vals.map(v => this.display(v, 0, false, 1)).join(', ') || '(none)')}.`, 'eval');
          return this.callFunction(fn, thisVal, [strings, ...vals], node);
        }
        case 'YieldExpression': {
          if (node.delegate) {
            const inner = yield* this.evaluate(node.argument, ctx);
            const it = this.getIterator(inner, node.argument);
            this.record(node, `🔁 <code>yield*</code> hands control to another iterable — each of its values will be yielded one by one.`, 'yield');
            let received;
            for (;;) {
              const r = it.next(received);
              if (r.done) return r.value;
              received = yield { kind: 'yield', value: r.value, node };
            }
          }
          let v;
          if (node.argument) v = yield* this.evaluate(node.argument, ctx);
          return yield { kind: 'yield', value: v, node };
        }
        case 'TemplateLiteral': {
          let s = node.quasis[0].value.cooked;
          for (let i = 0; i < node.expressions.length; i++) s += this.toStr(yield* this.evaluate(node.expressions[i], ctx)) + node.quasis[i + 1].value.cooked;
          return s;
        }
        case 'ArrayExpression': {
          const items = [];
          for (const el of node.elements) {
            if (!el) items.push(undefined);
            else if (el.type === 'SpreadElement') { const v = yield* this.evaluate(el.argument, ctx); items.push(...this.iterable(v, el.argument)); }
            else items.push(yield* this.evaluate(el, ctx));
          }
          return this.makeArray(items);
        }
        case 'ObjectExpression': {
          const o = this.alloc('object');
          for (const p of node.properties) {
            if (p.type === 'SpreadElement') { const src = yield* this.evaluate(p.argument, ctx); this.ownKeys(src).forEach(k => o.props.set(k, this.getMember(src, k))); continue; }
            const key = p.computed ? this.toKey(yield* this.evaluate(p.key, ctx)) : p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
            if (p.kind === 'get' || p.kind === 'set') {
              const f = this.makeFunction(p.value, ctx.currentScope, ctx);
              this.nameFn(f, key);
              f.homeObject = o; f.isMethod = true;
              let acc = o.props.get(key);
              if (!(acc instanceof Accessor)) acc = new Accessor(null, null);
              acc[p.kind] = f;
              o.props.set(key, acc);
              this.badge('accessor');
              continue;
            }
            const v = yield* this.evaluate(p.value, ctx);
            if (isAnonFn(p.value) || p.method) this.nameFn(v, key);
            if (p.method) { v.homeObject = o; v.isMethod = true; }
            o.props.set(key, v);
          }
          return o;
        }
        case 'FunctionExpression': case 'ArrowFunctionExpression': return this.makeFunction(node, ctx.currentScope, ctx);
        case 'UnaryExpression': {
          if (node.operator === 'typeof' && node.argument.type === 'Identifier' && !this.findBinding(node.argument.name, ctx) && !this.builtins.has(node.argument.name) && !this.nfeName(node.argument.name, ctx)) return 'undefined';
          if (node.operator === 'delete') {
            if (node.argument.type !== 'MemberExpression') return true;
            const obj = yield* this.evaluate(node.argument.object, ctx);
            const key = yield* this.memberKey(node.argument, ctx);
            return this.deleteProp(obj, key);
          }
          const v = yield* this.evaluate(node.argument, ctx);
          switch (node.operator) {
            case '!': return !this.truthy(v);
            case '-': { const p = this.toPrim(v, 'number'); return typeof p === 'bigint' ? -p : -Number(p); }
            case '+': return this.toNumber(v);
            case '~': { const p = this.toPrim(v, 'number'); return typeof p === 'bigint' ? ~p : ~Number(p); }
            case 'void': return undefined;
            case 'typeof': return v instanceof JSSymbol ? 'symbol' : v instanceof JSObject ? (this.isCallable(v) ? 'function' : 'object') : v === null ? 'object' : typeof v;
          }
          break;
        }
        case 'BinaryExpression': {
          if (node.left.type === 'PrivateIdentifier') { // #field in obj
            const r = yield* this.evaluate(node.right, ctx);
            return r instanceof JSObject && r.props.has('#' + node.left.name);
          }
          const l = yield* this.evaluate(node.left, ctx);
          const r = yield* this.evaluate(node.right, ctx);
          return this.binary(node.operator, l, r, node);
        }
        case 'LogicalExpression': {
          const l = yield* this.evaluate(node.left, ctx);
          if (node.operator === '&&') { if (!this.truthy(l)) return l; }
          else if (node.operator === '||') { if (this.truthy(l)) return l; }
          else if (l != null) return l;
          return yield* this.evaluate(node.right, ctx);
        }
        case 'ConditionalExpression':
          if (this.truthy(yield* this.evaluate(node.test, ctx))) return yield* this.evaluate(node.consequent, ctx);
          return yield* this.evaluate(node.alternate, ctx);
        case 'SequenceExpression': { let v; for (const x of node.expressions) v = yield* this.evaluate(x, ctx); return v; }
        case 'AssignmentExpression': return yield* this.evalAssign(node, ctx);
        case 'UpdateExpression': {
          const a = node.argument, delta = node.operator === '++' ? 1 : -1;
          if (a.type === 'Identifier') {
            const raw = this.toPrim(this.lookup(a.name, ctx, a), 'number');
            const old = typeof raw === 'bigint' ? raw : Number(raw);
            const nv = typeof old === 'bigint' ? old + BigInt(delta) : old + delta;
            this.assignVar(a.name, nv, ctx, node);
            return node.prefix ? nv : old;
          }
          if (a.type === 'MemberExpression') {
            const obj = yield* this.evaluate(a.object, ctx);
            const key = yield* this.memberKey(a, ctx);
            const old = this.toNumber(this.getMember(obj, key, a));
            this.setMember(obj, key, old + delta, a);
            return node.prefix ? old + delta : old;
          }
          throw new Unsupported('Unsupported update target.', node);
        }
        case 'MemberExpression': {
          if (node.object.type === 'Super') {
            const key = yield* this.memberKey(node, ctx);
            return this.superLookup(ctx, key, node);
          }
          const obj = yield* this.evaluate(node.object, ctx);
          if (node.optional && obj == null) throw new ShortCircuit();
          return this.getMember(obj, yield* this.memberKey(node, ctx), node);
        }
        case 'ChainExpression':
          try { return yield* this.evaluate(node.expression, ctx); } catch (e) { if (e instanceof ShortCircuit) return undefined; throw e; }
        case 'CallExpression': {
          let fn, thisVal;
          if (node.callee.type === 'Super') {
            const args = yield* this.evalArgs(node.arguments, ctx);
            const cctx = this.ctorCtx(ctx);
            if (!cctx) throw new Unsupported("'super()' can only be used inside a class constructor.", node);
            if (cctx.thisVal !== UNINIT) throw this.makeError('ReferenceError', 'Super constructor may only be called once', node);
            const P = cctx.classFn.parentClass;
            const obj = cctx.pendingThis;
            this.record(node, `⬆️ <code>super(${esc(trunc(args.map(a => this.display(a, 0, false, 1)).join(', '), 30))})</code> runs the <b>parent</b> constructor ${code(P ? this.fnLabel(P) : 'null')} on the same new object #${obj.id}.`, 'class');
            this.superConstruct(cctx.classFn, obj, args, node, cctx.newTarget);
            cctx.thisVal = obj;
            if (ctx !== cctx) ctx.thisVal = obj;
            this.initFields(cctx.classFn, obj, node);
            this.record(node, `✅ <code>super()</code> is done — <code>this</code> (object #${obj.id}) is now ready to use inside ${code(cctx.name)}.`, 'class');
            return undefined;
          }
          if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Super') {
            const key = yield* this.memberKey(node.callee, ctx);
            thisVal = ctx.thisVal;
            fn = this.superLookup(ctx, key, node.callee);
            const args = yield* this.evalArgs(node.arguments, ctx);
            if (!this.isCallable(fn)) throw this.makeError('TypeError', `(intermediate value).${keyText(key)} is not a function`, node);
            this.record(node, `⬆️ <code>super.${esc(keyText(key))}()</code> borrows the <b>parent's</b> version of ${code(keyText(key))} (found one step up the prototype chain) and runs it with the same <code>this</code>.`, 'class');
            return this.callFunction(fn, thisVal, args, node);
          }
          if (node.callee.type === 'MemberExpression') {
            thisVal = yield* this.evaluate(node.callee.object, ctx);
            if (node.callee.optional && thisVal == null) throw new ShortCircuit();
            fn = this.getMember(thisVal, yield* this.memberKey(node.callee, ctx), node.callee);
          } else {
            fn = yield* this.evaluate(node.callee, ctx);
            thisVal = undefined;
          }
          if (node.optional && fn == null) throw new ShortCircuit();
          const args = yield* this.evalArgs(node.arguments, ctx);
          if (!this.isCallable(fn)) throw this.makeError('TypeError', `${this.snip(node.callee, 30)} is not a function`, node);
          // a plain eval(...) call is a *direct* eval: the code can see the local variables here
          if (fn === this.builtins.get('eval') && node.callee.type === 'Identifier' && node.callee.name === 'eval') return this.evalCode(args[0], ctx, node, false);
          if (fn === this.atomicsWaitFn && ctx.tickable && ctx.thread && ctx.thread.ticking) return yield { kind: 'wait', args, node };
          return this.callFunction(fn, thisVal, args, node);
        }
        case 'NewExpression': {
          const ctor = yield* this.evaluate(node.callee, ctx);
          const args = yield* this.evalArgs(node.arguments, ctx);
          return this.construct(ctor, args, node);
        }
        case 'ImportExpression': {
          const spec = yield* this.evaluate(node.source, ctx);
          return this.dynamicImport(this.toStr(spec), node);
        }
        case 'AwaitExpression': {
          const v = yield* this.evaluate(node.argument, ctx);
          return yield { kind: 'await', value: v, node };
        }
      }
      throw new Unsupported(`"${node.type}" is not supported in this visualizer yet.`, node);
    }

    *evalAssign(node, ctx) {
      const op = node.operator, left = node.left;
      const self = this;
      const combine = function* (cur) {
        if (op === '=') return yield* self.evaluate(node.right, ctx);
        if (op === '&&=') return self.truthy(cur) ? (yield* self.evaluate(node.right, ctx)) : cur;
        if (op === '||=') return self.truthy(cur) ? cur : (yield* self.evaluate(node.right, ctx));
        if (op === '??=') return cur == null ? (yield* self.evaluate(node.right, ctx)) : cur;
        const r = yield* self.evaluate(node.right, ctx);
        return self.binary(op.slice(0, -1), cur, r, node);
      };
      if (left.type === 'Identifier') {
        const cur = op === '=' ? undefined : this.lookup(left.name, ctx, left);
        const v = yield* combine(cur);
        if (op === '=' && isAnonFn(node.right)) this.nameFn(v, left.name);
        this.assignVar(left.name, v, ctx, left);
        return v;
      }
      if (left.type === 'MemberExpression') {
        const obj = yield* this.evaluate(left.object, ctx);
        const key = yield* this.memberKey(left, ctx);
        const cur = op === '=' ? undefined : this.getMember(obj, key, left);
        const v = yield* combine(cur);
        if (op === '=' && isAnonFn(node.right)) this.nameFn(v, key);
        this.setMember(obj, key, v, left);
        return v;
      }
      const v = yield* this.evaluate(node.right, ctx);
      yield* this.bindPattern(left, v, ctx, 'assign');
      this.lastAssigned = v;
      return v;
    }

    binary(op, l, r, node) {
      // BigInt math: both sides must be BigInt (comparisons may mix)
      if ((typeof l === 'bigint' || typeof r === 'bigint') && !['===', '!==', '==', '!=', 'in', 'instanceof'].includes(op)) {
        const a = this.toPrim(l, 'number'), b = this.toPrim(r, 'number');
        if (['<', '>', '<=', '>='].includes(op)) return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
        if (op === '+' && (typeof a === 'string' || typeof b === 'string')) return String(a) + String(b);
        if (typeof a !== 'bigint' || typeof b !== 'bigint') throw this.makeError('TypeError', 'Cannot mix BigInt and other types, use explicit conversions', node);
        if ((op === '/' || op === '%') && b === 0n) throw this.makeError('RangeError', 'Division by zero', node);
        switch (op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b; case '**': return a ** b;
          case '&': return a & b; case '|': return a | b; case '^': return a ^ b; case '<<': return a << b; case '>>': return a >> b;
        }
      }
      switch (op) {
        case '===': return l === r;
        case '!==': return l !== r;
        case '==': return (l instanceof JSObject && r instanceof JSObject) ? l === r : this.toPrim(l) == this.toPrim(r); // eslint-disable-line eqeqeq
        case '!=': return (l instanceof JSObject && r instanceof JSObject) ? l !== r : this.toPrim(l) != this.toPrim(r); // eslint-disable-line eqeqeq
        case '+': {
          // Dates and symbols are special: date + x joins text, symbols can't be added
          const pl = l instanceof JSObject && l.kind === 'date' ? this.toStr(l) : this.toPrim(l);
          const pr = r instanceof JSObject && r.kind === 'date' ? this.toStr(r) : this.toPrim(r);
          if (pl instanceof JSSymbol || pr instanceof JSSymbol) throw this.makeError('TypeError', 'Cannot convert a Symbol value to a string', node);
          return pl + pr;
        }
        case '-': return this.toNumber(l) - this.toNumber(r);
        case '*': return this.toNumber(l) * this.toNumber(r);
        case '/': return this.toNumber(l) / this.toNumber(r);
        case '%': return this.toNumber(l) % this.toNumber(r);
        case '**': return this.toNumber(l) ** this.toNumber(r);
        case '<': return this.toPrim(l, 'number') < this.toPrim(r, 'number');
        case '>': return this.toPrim(l, 'number') > this.toPrim(r, 'number');
        case '<=': return this.toPrim(l, 'number') <= this.toPrim(r, 'number');
        case '>=': return this.toPrim(l, 'number') >= this.toPrim(r, 'number');
        case '&': return this.toNumber(l) & this.toNumber(r);
        case '|': return this.toNumber(l) | this.toNumber(r);
        case '^': return this.toNumber(l) ^ this.toNumber(r);
        case '<<': return this.toNumber(l) << this.toNumber(r);
        case '>>': return this.toNumber(l) >> this.toNumber(r);
        case '>>>': return this.toNumber(l) >>> this.toNumber(r);
        case 'in':
          if (!(r instanceof JSObject)) throw this.makeError('TypeError', "Cannot use 'in' operator on a non-object", node);
          if (r.isProxy) {
            const t = this.getMember(r.handler, 'has');
            if (this.isCallable(t)) { this.trapStep('has', this.toKey(l), node); return this.truthy(this.callFunction(t, r.handler, [r.target, this.toKey(l)], node)); }
            return this.binary('in', l, r.target, node);
          }
          for (let o = r; o; o = o.proto) if (o.props.has(this.toKey(l))) return true;
          return this.ownKeys(r).includes(this.toKey(l)) || this.getMember(r, this.toKey(l)) !== undefined;
        case 'instanceof': {
          const hi = this.hasInstanceHook(l, r, node);
          if (hi !== undefined) return hi;
          if (!(l instanceof JSObject)) return false;
          if (r instanceof JSObject && r.kind === 'native' && r.isCtor) {
            if (ERROR_NAMES.includes(r.name)) return !!l.isError && (r.name === 'Error' || l.props.get('name') === r.name);
            if (r.name === 'Object') return true;
            if (r.name === 'Array') return l.kind === 'array';
            if (r.name === 'Promise') return !!l.isPromise;
            if (r.name === 'Function') return this.isCallable(l);
            if (r.instanceKind) return l.kind === r.instanceKind;
            return false;
          }
          if (!(r instanceof JSObject) || r.kind !== 'function') throw this.makeError('TypeError', "Right-hand side of 'instanceof' is not callable", node);
          const proto = r.props.get('prototype');
          for (let p = l.proto; p; p = p.proto) if (p === proto) return true;
          return false;
        }
      }
      throw new Unsupported(`Operator ${op} is not supported yet.`, node);
    }
  });
})();
