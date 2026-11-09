/*
 * JS Engine Lab — engine part: built-in prototypes you can extend.
 *
 *  - Array.prototype, Function.prototype, String.prototype and Number.prototype exist as objects,
 *    so polyfills like `Array.prototype.myMap = function () {...}` work on every array
 *  - reading a built-in method from them (Array.prototype.slice.call(...)) gives the real method
 *  - Array#reduceRight, Object.is
 *  - own property order follows the spec: integer-like keys first (ascending), then strings
 */
(function () {
  'use strict';
  const { code, JSObject, Accessor } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { setupPlatform: P.setupPlatform, getMember: P.getMember, arrayMethod: P.arrayMethod, ownKeys: P.ownKeys, collectionMethod: P.collectionMethod };
  const isArrayIndex = k => typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k) && +k < 4294967295;

  window.JSEngine.mixin(class {
    setupPlatform() {
      base.setupPlatform.call(this);
      const B = this.builtins;
      this.builtinProtos = {};
      [['array', 'Array'], ['function', 'Function'], ['string', 'String'], ['number', 'Number']].forEach(([kind, ctor]) => {
        const proto = this.hiddenObj(ctor + '.prototype', {});
        proto.isBuiltinProto = kind;
        this.builtinProtos[kind] = proto;
        const C = B.get(ctor);
        if (C instanceof JSObject) { C.props.set('prototype', proto); proto.props.set('constructor', C); }
      });
      const I = this;
      const Obj = B.get('Object');
      if (Obj) {
        Obj.props.set('is', this.native('is', (s, a) => Object.is(a[0], a[1])));
        // Object.create(null) makes an object with no prototype at all (no toString, no hasOwnProperty)
        Obj.props.set('create', this.native('create', function (s, a, node) {
          if (a[0] !== null && !(a[0] instanceof JSObject)) throw this.makeError('TypeError', `Object prototype may only be an Object or null: ${this.display(a[0])}`, node);
          const o = this.alloc('object');
          o.proto = a[0] || null;
          if (a[0] === null) o.nullProto = true;
          return o;
        }));
      }
      // the arguments object looks like an array but is not one
      const Arr = B.get('Array');
      if (Arr) Arr.props.set('isArray', this.native('isArray', (s, a) => a[0] instanceof JSObject && a[0].kind === 'array' && a[0].ctorName !== 'Arguments'));
      // JSON.stringify with toJSON, replacer functions / key lists and circular-reference errors
      const J = B.get('JSON');
      if (J) J.props.set('stringify', this.native('stringify', function (s, a, node) {
        const replacer = a[1];
        const fnRep = this.isCallable(replacer) ? replacer : null;
        const allow = replacer instanceof JSObject && replacer.kind === 'array' ? new Set(replacer.items.map(x => String(x))) : null;
        const stack = [];
        const conv = (holder, key, val) => {
          if (val instanceof JSObject && !this.isCallable(val)) {
            const tj = this.getMember(val, 'toJSON');
            if (this.isCallable(tj)) val = this.callFunction(tj, val, [key], node);
          }
          if (fnRep) val = this.callFunction(fnRep, holder, [key, val], node);
          if (!(val instanceof JSObject)) return typeof val === 'bigint' ? (() => { throw this.makeError('TypeError', 'Do not know how to serialize a BigInt', node); })() : val;
          if (this.isCallable(val)) return undefined;
          if (stack.includes(val)) throw this.makeError('TypeError', 'Converting circular structure to JSON', node);
          if (val.kind === 'date') return val.d.toJSON();
          if (val.kind === 'map' || val.kind === 'set' || val.kind === 'regexp') return {};
          stack.push(val);
          let out;
          if (val.kind === 'array') out = val.items.map((x, i) => conv(val, String(i), x));
          else {
            out = {};
            for (const k of this.ownKeys(val)) {
              if (allow && !allow.has(k)) continue;
              const r = conv(val, k, this.getMember(val, k));
              if (r !== undefined) out[k] = r;
            }
          }
          stack.pop();
          return out;
        };
        const wrapper = this.hiddenObj('', { '': a[0] });
        const nat = conv(wrapper, '', a[0]);
        const space = typeof a[2] === 'number' || typeof a[2] === 'string' ? a[2] : undefined;
        return JSON.stringify(nat, null, space);
      }));
    }

    // WeakMap / WeakSet keys must be objects
    collectionMethod(obj, key) {
      const m = base.collectionMethod.call(this, obj, key);
      const weak = obj.ctorName === 'WeakMap' ? 'set' : obj.ctorName === 'WeakSet' ? 'add' : null;
      if (!m || key !== weak) return m;
      const I = this;
      return this.method(obj.ctorName, key, function (self, a, node) {
        if (!(a[0] instanceof JSObject)) throw I.makeError('TypeError', obj.ctorName === 'WeakMap' ? 'Invalid value used as weak map key' : 'Invalid value used in weak set', node);
        return I.callFunction(m, self, a, node);
      });
    }

    // for...in: own enumerable keys, then inherited ones further up the prototype chain
    forInKeys(v) {
      const keys = this.ownKeys(v);
      if (!(v instanceof JSObject) || v.isProxy) return keys;
      const seen = new Set(keys);
      for (let p = v.proto; p; p = p.proto) {
        if (p.hidden || p.isBuiltinProto) continue;
        for (const k of this.ownKeys(p)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
      }
      return keys;
    }

    // is `name` the name of a named function expression that we are inside?
    nfeName(name, ctx) {
      for (let s = ctx.currentScope; s; s = s.parent) {
        const f = s.owner && s.owner.fn;
        if (s.kind === 'function' && f && f.node && f.node.type === 'FunctionExpression' && f.node.id && f.node.id.name === name) return true;
      }
      return false;
    }

    getMember(obj, key, node, receiver) {
      if (obj instanceof JSObject && obj.nullProto) {
        const k0 = this.toKey(key);
        let has = false;
        for (let o = obj; o; o = o.proto) if (o.props.has(k0)) { has = true; break; }
        if (!has) return undefined;
      }
      const v = base.getMember.call(this, obj, key, node, receiver);
      if (v !== undefined || !this.builtinProtos) return v;
      const k = this.toKey(key);
      // Array.prototype.map, String.prototype.slice ... read from the prototype object itself
      if (obj instanceof JSObject && obj.isBuiltinProto) {
        const m = obj.isBuiltinProto === 'array' ? this.arrayMethod(k)
          : obj.isBuiltinProto === 'string' ? this.stringMethod(k)
          : obj.isBuiltinProto === 'function' && ['call', 'apply', 'bind'].includes(k) ? this.functionMethod(obj, k) : undefined;
        return m || undefined;
      }
      // methods you added yourself, e.g. Array.prototype.myMap
      const kind = typeof obj === 'string' ? 'string' : typeof obj === 'number' ? 'number'
        : obj instanceof JSObject ? (obj.kind === 'array' ? 'array' : obj.kind === 'function' || obj.kind === 'native' ? 'function' : null) : null;
      const proto = kind && this.builtinProtos[kind];
      if (!proto || !proto.props.has(k) || k === 'constructor') return undefined;
      const found = proto.props.get(k);
      if (found instanceof Accessor) return found.get ? this.callFunction(found.get, receiver === undefined ? obj : receiver, [], node) : undefined;
      if (node && !this.silent && this.isCallable(found)) {
        this.record(node, `🧬 <code>${code(String(k))}</code> is not on the ${kind} itself, so the engine climbs the <b>prototype chain</b> and finds it on <code>${proto.label}</code>, where your code added it. Every ${kind} shares it.`, 'lookup');
      }
      return found;
    }

    arrayMethod(name) {
      if (name !== 'reduceRight') return base.arrayMethod.call(this, name);
      const I = this;
      return this.method('array', 'reduceRight', function (arr, a, node) {
        const cb = a[0];
        if (!I.isCallable(cb)) throw I.makeError('TypeError', `${I.display(cb)} is not a function`, node);
        I.badge('callback');
        I.record(node, `🔁 <b>.reduceRight()</b> is like <code>reduce</code>, but walks the ${arr.items.length} items from the <b>last</b> to the first.`, 'native');
        let i = arr.items.length - 1, acc;
        if (a.length > 1) acc = a[1];
        else { if (i < 0) throw I.makeError('TypeError', 'Reduce of empty array with no initial value', node); acc = arr.items[i--]; }
        for (; i >= 0; i--) acc = I.callFunction(cb, undefined, [acc, arr.items[i], i, arr], node);
        return acc;
      });
    }

    ownKeys(v) {
      const keys = base.ownKeys.call(this, v);
      if (!(v instanceof JSObject) || v.items || v.isProxy) return keys;
      const ints = keys.filter(isArrayIndex);
      if (!ints.length) return keys;
      return ints.sort((x, y) => x - y).concat(keys.filter(k => !isArrayIndex(k)));
    }
  });
})();
