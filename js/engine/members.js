/* JS Engine Quest — engine part: property access (getMember / setMember), variables, scopes and hoisting. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    // ======================================================== members
    getMember(obj, key, node, receiver) {
      key = this.toKey(key);
      if (receiver === undefined) receiver = obj;
      if (obj === undefined || obj === null) throw this.makeError('TypeError', `Cannot read properties of ${obj} (reading '${keyText(key)}')`, node);
      // browser objects: page elements, classList/style views, localStorage
      if (obj instanceof JSObject && obj.domNode) { const v = this.domGet(obj, key, node); if (v !== undefined) return v; }
      if (obj instanceof JSObject && obj.domView) return this.domViewGet(obj, key);
      if (obj instanceof JSObject && obj.isStorage) return this.storageGet(obj, key);
      if (obj instanceof JSObject && (obj.kind === 'typed' || obj.kind === 'buffer' || obj.host)) { const v = this.platformGet(obj, key, node); if (v !== undefined) return v; }
      if (obj instanceof JSObject && obj.isProxy) {
        const t = this.getMember(obj.handler, 'get');
        if (this.isCallable(t)) { this.trapStep('get', key, node); return this.callFunction(t, obj.handler, [obj.target, key, receiver], node); }
        return this.getMember(obj.target, key, node, receiver === obj ? obj.target : receiver);
      }
      if (key === SYM_ITER) { const m = this.builtinIterMethod(obj); if (m) return m; }
      if (typeof obj === 'string') {
        if (key === 'length') return obj.length;
        if (isIndex(key)) return obj[+key];
        return this.stringMethod(key);
      }
      if (typeof obj === 'number') {
        if (['toFixed', 'toString', 'toPrecision', 'toLocaleString', 'valueOf'].includes(key)) return this.method('num', key, (s, a) => s[key](...a.map(x => this.natArg(x))));
        return undefined;
      }
      if (typeof obj === 'boolean') return key === 'toString' ? this.method('bool', 'toString', s => String(s)) : undefined;
      if (obj instanceof JSSymbol) {
        if (key === 'description') return obj.desc;
        if (key === 'toString') return this.method('sym', 'toString', s => s.toString());
        return undefined;
      }
      if (!(obj instanceof JSObject)) return undefined;
      if (obj === this.globalThisObj && this.globalScope) {
        const e = this.globalScope.vars.get(key);
        if (e && (e.kind === 'var' || e.kind === 'function')) return e.value;
      }
      if (obj.isPromise) { const m = this.promiseMethod(key); if (m) return m; }
      if (obj.isGenerator) { const m = this.generatorMethod(obj, key); if (m) return m; }
      if (obj.kind === 'iterator' && key === 'next') {
        return this.method('it', 'next', self => {
          const r = self.pos < self.items.length ? this.iterResult(self.items[self.pos++], false) : this.iterResult(undefined, true);
          this.changedProp = { id: self.id, key: 'position' };
          return r;
        });
      }
      // methods written in a subclass (class X extends Array/Map/Set) win over the built-in ones
      if ((obj.kind === 'array' || obj.kind === 'map' || obj.kind === 'set') && obj.proto) {
        for (let o = obj.proto; o; o = o.proto) {
          if (!o.props.has(key) || key === 'constructor') continue;
          const v = o.props.get(key);
          return v instanceof Accessor ? (v.get ? this.callFunction(v.get, receiver, [], node) : undefined) : v;
        }
      }
      if (obj.kind === 'map' || obj.kind === 'set') {
        if (key === 'size') return obj.kind === 'map' ? obj.map.size : obj.set.size;
        const m = this.collectionMethod(obj, key); if (m) return m;
      }
      if (obj.kind === 'regexp') { const m = this.regexpMember(obj, key); if (m !== undefined) return m; }
      if (obj.kind === 'date') { const m = this.dateMember(obj, key); if (m) return m; }
      if (obj.kind === 'array') {
        if (key === 'length') return obj.items.length;
        if (isIndex(key)) return obj.items[+key];
        if (!obj.props.has(key)) { const m = this.arrayMethod(key); if (m) return m; }
      }
      if (obj.kind === 'function' || obj.kind === 'native') {
        if (key === 'name') return obj.kind === 'native' ? obj.name : obj.name || '';
        if (key === 'length' && obj.kind === 'function') { if (!obj.node) return 0; const k = obj.node.params.findIndex(p => p.type === 'AssignmentPattern' || p.type === 'RestElement'); return k < 0 ? obj.node.params.length : k; }
        if (key === 'prototype' && obj.kind === 'function' && !obj.isArrow && !obj.isMethod && !obj.props.has('prototype')) {
          const p = this.alloc('object'); p.isProto = true; p.protoOf = obj.label; obj.props.set('prototype', p);
        }
        if (!obj.props.has(key)) { const m = this.functionMethod(obj, key); if (m) return m; }
      }
      if (node && obj.kind === 'object' && !obj.hidden) this.noteIC(node, obj, key);
      if (obj.isWeakRef && key === 'deref') return this.weakDeref(obj);
      if (obj.intl) { const m = this.intlMember(obj, key); if (m) return m; }
      for (let o = obj; o; o = o.proto) {
        if (!o.props.has(key)) continue;
        const v = o.props.get(key);
        if (v instanceof Accessor) return v.get ? this.callFunction(v.get, receiver, [], node) : undefined;
        return v;
      }
      if (key === 'hasOwnProperty') return this.method('obj', 'hasOwnProperty', (s, a) => s instanceof JSObject && (s.props.has(this.toKey(a[0])) || this.ownKeys(s).includes(this.toKey(a[0]))));
      if (key === 'toString') return this.method('obj', 'toString', () => '[object Object]');
      if (key === 'isPrototypeOf') return this.method('obj', 'isPrototypeOf', (s, a) => { for (let p = a[0] && a[0].proto; p; p = p.proto) if (p === s) return true; return false; });
      return undefined;
    }

    setMember(obj, key, value, node) {
      key = this.toKey(key);
      if (obj === undefined || obj === null) throw this.makeError('TypeError', `Cannot set properties of ${obj} (setting '${keyText(key)}')`, node);
      if (!(obj instanceof JSObject)) {
        if (this.isStrict()) throw this.makeError('TypeError', `Cannot create property '${keyText(key)}' on ${typeof obj} '${this.display(obj, 0, true)}'`, node);
        return value;
      }
      this.lastAssigned = value;
      if (obj.domNode) { this.domSet(obj, key, value, node); return value; }
      if (obj.domView) { this.domViewSet(obj, key, value, node); return value; }
      if (obj.isStorage) { this.callFunction(this.storageGet(obj, 'setItem'), obj, [key, value], node); return value; }
      if ((obj.kind === 'typed' || obj.host) && this.platformSet(obj, key, value, node)) return value;
      if (obj.isProxy) {
        const t = this.getMember(obj.handler, 'set');
        if (this.isCallable(t)) {
          this.trapStep('set', key, node);
          const ok = this.callFunction(t, obj.handler, [obj.target, key, value, obj], node);
          if (!this.truthy(ok) && this.isStrict()) throw this.makeError('TypeError', `'set' on proxy: trap returned falsish for property '${keyText(key)}'`, node);
          return value;
        }
        return this.setMember(obj.target, key, value, node);
      }
      // a setter anywhere on the prototype chain wins
      for (let o = obj; o; o = o.proto) {
        if (!o.props.has(key)) continue;
        const v = o.props.get(key);
        if (v instanceof Accessor) {
          if (v.set) this.callFunction(v.set, obj, [value], node);
          else if (this.isStrict()) throw this.makeError('TypeError', `Cannot set property ${keyText(key)} of #<Object> which has only a getter`, node);
          return value;
        }
        break;
      }
      // property attributes set with Object.defineProperty / seal / preventExtensions
      const at = obj.attrs && obj.attrs.get(key);
      const readOnly = at && at.writable === false && obj.props.has(key);
      const noAdd = !obj.props.has(key) && (obj.noExtend || obj.sealed) && !(obj.kind === 'array' && isIndex(key));
      if (readOnly || noAdd) {
        if (this.isStrict()) throw this.makeError('TypeError', readOnly ? `Cannot assign to read only property '${keyText(key)}' of object` : `Cannot add property ${keyText(key)}, object is not extensible`, node);
        this.frozenIgnored = true;
        return value;
      }
      if (obj.frozen) {
        if (this.isStrict()) throw this.makeError('TypeError', `Cannot assign to read only property '${keyText(key)}' of object`, node);
        this.frozenIgnored = true;
        return value;
      }
      if (obj.kind === 'regexp' && key === 'lastIndex') obj.re.lastIndex = this.toNumber(value);
      else if (obj.kind === 'array' && key === 'length') obj.items.length = this.toNumber(value);
      else if (obj.kind === 'array' && isIndex(key)) {
        while (obj.items.length < +key) obj.items.push(undefined);
        obj.items[+key] = value;
      } else obj.props.set(key, value);
      this.changedProp = { id: obj.id, key: keyText(key) };
      return value;
    }

    *memberKey(node, ctx) {
      if (!node.computed) return (node.property.type === 'PrivateIdentifier' ? '#' : '') + node.property.name;
      return this.toKey(yield* this.evaluate(node.property, ctx));
    }

    // ======================================================== variables
    findBinding(name, ctx) {
      for (let s = ctx.currentScope; s; s = s.parent) if (s.vars.has(name)) return s;
      return null;
    }

    lookup(name, ctx, node) {
      for (let s = ctx.currentScope; s; s = s.parent) {
        const e = s.vars.get(name);
        if (e) {
          if (e.importFrom) {
            // an import is a live link: read the exporting module's variable right now
            const src = e.importFrom.scope.vars.get(e.importFrom.name);
            if (!src || src.tdz) throw this.makeError('ReferenceError', `Cannot access '${name}' before initialization`, node);
            if (!ctx.looked.has(name)) {
              ctx.looked.add(name);
              this.focusScope = e.importFrom.scope.id;
              this.record(node, `🔗 ${code(name)} is an <b>import</b>, so JavaScript reads it live from ${code(e.importFrom.scope.name)}: ${this.valText(src.value)}`, 'lookup');
            }
            return src.value;
          }
          if (e.tdz) {
            this.badge('tdz');
            throw this.makeError('ReferenceError', `Cannot access '${name}' before initialization`, node);
          }
          if (s.owner !== ctx && !ctx.looked.has(name)) {
            ctx.looked.add(name);
            this.focusScope = s.id;
            const where = s.kind === 'global' ? 'the <b>Global</b> memory' : code(s.name) + (this.stack.includes(s.owner) ? '' : ' 🎒 (a closure — that function already finished!)');
            this.record(node, `🔍 ${code(name)} is not in ${code(ctx.name)}'s own memory, so JavaScript climbs the <b>scope chain</b> → found it in ${where}: ${this.valText(e.value)}`, 'lookup');
          }
          return e.value;
        }
        if (s.kind === 'function' && s.owner && s.owner.fn && s.owner.fn.node) {
          const o = s.owner;
          // a named function expression can see its own name
          if (o.fn.node.type === 'FunctionExpression' && o.fn.node.id && o.fn.node.id.name === name) return o.fn;
          // every normal function gets an `arguments` object (arrows borrow the outer one)
          if (name === 'arguments' && !o.isArrow) {
            if (!o.argsObj) { o.argsObj = this.makeArray(o.args.slice()); o.argsObj.ctorName = 'Arguments'; }
            return o.argsObj;
          }
        }
      }
      // a Web Worker has its own globals (self, postMessage, ...)
      const rootS = this.rootScope(ctx);
      if (rootS && rootS.workerGlobals && rootS.workerGlobals.has(name)) return rootS.workerGlobals.get(name);
      if (rootS && rootS.workerGlobals && name === 'onmessage') return rootS.workerGlobals.get('self').props.get('onmessage');
      if (UNSUPPORTED.has(name)) throw new Unsupported(`${name} is not supported in this visualizer yet (try setTimeout, functions, objects, arrays, loops…).`, node);
      if (this.builtins.has(name)) return this.builtins.get(name);
      throw this.makeError('ReferenceError', `${name} is not defined`, node);
    }

    assignVar(name, value, ctx, node) {
      this.lastAssigned = value;
      for (let s = ctx.currentScope; s; s = s.parent) {
        const e = s.vars.get(name);
        if (!e) continue;
        if (e.tdz) { this.badge('tdz'); throw this.makeError('ReferenceError', `Cannot access '${name}' before initialization`, node); }
        if (e.kind === 'const' || e.kind === 'class' && s.kind === 'block' && s.name.startsWith('class ')) throw this.makeError('TypeError', 'Assignment to constant variable.', node);
        if (e.kind === 'import') throw this.makeError('TypeError', `Assignment to constant variable. ('${name}' is an import — only its own module can change it)`, node);
        e.value = value;
        this.changed = { scope: s.id, name };
        return;
      }
      // strict mode: assigning to an undeclared name is an error; sloppy mode quietly creates a global
      if (ctx.strict) throw this.makeError('ReferenceError', `${name} is not defined`, node);
      const rootS = this.rootScope(ctx);
      if (rootS && rootS.workerGlobals) { // inside a worker: globals belong to the worker
        if (name === 'onmessage') { rootS.workerGlobals.get('self').props.set('onmessage', value); return; }
        rootS.vars.set(name, { value, kind: 'var', implicit: true });
        this.changed = { scope: rootS.id, name };
        return;
      }
      this.globalScope.vars.set(name, { value, kind: 'var', implicit: true });
      this.changed = { scope: this.globalScope.id, name };
      this.implicitGlobal = name;
    }

    initBinding(name, value, kind, ctx) {
      const s = ctx.currentScope;
      const e = s.vars.get(name);
      if (e) { e.value = value; e.tdz = false; } else s.vars.set(name, { value, kind });
      this.changed = { scope: s.id, name };
      this.lastAssigned = value;
    }

    // mode: 'declare' (into a given scope), 'init' (let/const), 'assign' (var / plain assignment)
    *bindPattern(p, value, ctx, mode, kind, scope) {
      switch (p.type) {
        case 'Identifier':
          if (mode === 'declare') { scope.vars.set(p.name, { value, kind }); this.changed = { scope: scope.id, name: p.name }; }
          else if (mode === 'init') this.initBinding(p.name, value, kind, ctx);
          else this.assignVar(p.name, value, ctx, p);
          return;
        case 'AssignmentPattern':
          if (value === undefined) { value = yield* this.evaluate(p.right, ctx); if (p.left.type === 'Identifier' && isAnonFn(p.right)) this.nameFn(value, p.left.name); }
          yield* this.bindPattern(p.left, value, ctx, mode, kind, scope);
          return;
        case 'ObjectPattern': {
          if (value == null) throw this.makeError('TypeError', `Cannot destructure '${this.display(value)}'`, p);
          const used = [];
          for (const prop of p.properties) {
            if (prop.type === 'RestElement') {
              const rest = this.alloc('object');
              this.ownKeys(value).filter(k => !used.includes(k)).forEach(k => rest.props.set(k, this.getMember(value, k)));
              yield* this.bindPattern(prop.argument, rest, ctx, mode, kind, scope);
              continue;
            }
            const key = prop.computed ? this.toKey(yield* this.evaluate(prop.key, ctx)) : prop.key.type === 'Identifier' ? prop.key.name : String(prop.key.value);
            used.push(key);
            yield* this.bindPattern(prop.value, this.getMember(value, key, prop), ctx, mode, kind, scope);
          }
          return;
        }
        case 'ArrayPattern': {
          // take only as many values as needed (works with endless generators too)
          const it = this.getIterator(value, p);
          let done = false;
          const take = () => { if (done) return undefined; const r = it.next(); if (r.done) { done = true; return undefined; } return r.value; };
          for (let i = 0; i < p.elements.length; i++) {
            const el = p.elements[i];
            if (!el) { take(); continue; }
            if (el.type === 'RestElement') {
              const rest = [];
              for (;;) { const v = take(); if (done) break; rest.push(v); }
              yield* this.bindPattern(el.argument, this.makeArray(rest), ctx, mode, kind, scope);
            } else yield* this.bindPattern(el, take(), ctx, mode, kind, scope);
          }
          if (!done) it.return();
          return;
        }
        case 'MemberExpression': {
          const obj = yield* this.evaluate(p.object, ctx);
          const key = yield* this.memberKey(p, ctx);
          this.setMember(obj, key, value, p);
          return;
        }
        default: throw new Unsupported(`Pattern "${p.type}" is not supported yet.`, p);
      }
    }

    // ======================================================== hoisting
    collectVars(stmts, out) {
      const walk = n => {
        if (!n) return;
        switch (n.type) {
          case 'VariableDeclaration': if (n.kind === 'var') n.declarations.forEach(d => patternNames(d.id).forEach(name => out.push({ kind: 'var', name, node: d }))); return;
          case 'IfStatement': walk(n.consequent); walk(n.alternate); return;
          case 'BlockStatement': n.body.forEach(walk); return;
          case 'ForStatement': walk(n.init); walk(n.body); return;
          case 'ForInStatement': case 'ForOfStatement': walk(n.left); walk(n.body); return;
          case 'WhileStatement': case 'DoWhileStatement': case 'LabeledStatement': walk(n.body); return;
          case 'TryStatement': walk(n.block); if (n.handler) walk(n.handler.body); walk(n.finalizer); return;
          case 'SwitchStatement': n.cases.forEach(c => c.consequent.forEach(walk)); return;
        }
      };
      stmts.forEach(walk);
      return out;
    }

    lexicalDecls(stmts) {
      const out = [];
      for (const s of stmts) {
        if (s.type === 'VariableDeclaration' && s.kind !== 'var') s.declarations.forEach(d => patternNames(d.id).forEach(name => out.push({ kind: s.kind, name, node: d })));
        else if (s.type === 'FunctionDeclaration') out.push({ kind: 'function', name: s.id.name, node: s });
        else if (s.type === 'ClassDeclaration') out.push({ kind: 'class', name: s.id.name, node: s });
      }
      return out;
    }

    hoist(decls, scope, ctx, verbose) {
      decls.sort((a, b) => a.node.start - b.node.start);
      const applied = [];
      for (const d of decls) {
        let dup = false;
        if (d.kind === 'var') {
          if (scope.vars.has(d.name)) dup = true;
          else scope.vars.set(d.name, { value: undefined, kind: 'var' });
        } else if (d.kind === 'function') {
          scope.vars.set(d.name, { value: this.makeFunction(d.node, scope, ctx), kind: 'function' });
        } else scope.vars.set(d.name, { value: undefined, kind: d.kind, tdz: true });
        this.changed = { scope: scope.id, name: d.name };
        if (!dup) applied.push(d);
        if (verbose) {
          this.badge(d.kind === 'var' || d.kind === 'function' ? 'hoist' : 'tdz');
          const hl = d.kind === 'function' ? R(d.node.start, d.node.body.start, d.node.loc.start.line) : d.node;
          this.record(hl, this.hoistMsg(d, dup), 'hoist');
        }
      }
      return applied;
    }

    hoistMsg(d, dup) {
      if (dup) return `📌 ${code('var ' + d.name)} again? It's the <b>same</b> variable — <code>var</code> ignores blocks, so no new memory slot is made.`;
      if (d.kind === 'var') return `📌 Found ${code('var ' + d.name)} → a memory slot is created and set to ${code('undefined')}. (That's why using it early gives <i>undefined</i>, not an error.)`;
      if (d.kind === 'function') return `📌 Found ${code('function ' + d.name)} → the <b>whole function</b> is stored in memory right now. It can be called even before its line!`;
      return `📌 Found ${code(d.kind + ' ' + d.name)} → memory is reserved but <b>uninitialized</b>. It sits in the <b>Temporal Dead Zone</b> until its line runs.`;
    }

    hoistShort(d) {
      if (d.kind === 'var') return code('var ' + d.name + ' → undefined');
      if (d.kind === 'function') return code('function ' + d.name + ' → ƒ');
      return code(d.kind + ' ' + d.name + ' → TDZ');
    }

  });
})();
