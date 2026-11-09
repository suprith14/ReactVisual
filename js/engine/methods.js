/* JS Engine Quest — engine part: methods of built-in values: strings, arrays, functions, Map/Set, RegExp, Date, iterators. */
(function () {
  'use strict';
  const { MAX_STEPS, MAX_DEPTH, UNSUPPORTED, CONSTRUCT, UNINIT, esc, code, trunc, isAnonFn, isIndex, R, patternNames, JSObject, Scope, ReturnSignal, BreakSignal, ContinueSignal, ThrowSignal, StepLimit, Unsupported, ShortCircuit, GenReturnSignal, JSSymbol, Accessor, SYM_ITER, SYM_ASYNC_ITER, SYM_TO_PRIM, isSignal, keyText, ERROR_NAMES } = window.JSEngine.internals;

  window.JSEngine.mixin(class {
    toNative(v) {
      if (!(v instanceof JSObject)) return v;
      if (v.kind === 'array') return v.items.map(x => this.toNative(x));
      if (v.kind === 'date') return v.d.toJSON();
      if (v.kind === 'map' || v.kind === 'set' || v.kind === 'regexp') return {};
      if (v.kind !== 'object') return undefined;
      const o = {};
      v.props.forEach((x, k) => {
        if (typeof k !== 'string' || k.startsWith('#') || (v.attrs && v.attrs.get(k) && v.attrs.get(k).enumerable === false)) return;
        const val = x instanceof Accessor ? (x.get ? this.callFunction(x.get, v, [], null) : undefined) : x;
        o[k] = this.toNative(val);
      });
      return o;
    }
    fromNative(v) {
      if (Array.isArray(v)) return this.makeArray(v.map(x => this.fromNative(x)));
      if (v && typeof v === 'object') { const o = this.alloc('object'); Object.keys(v).forEach(k => o.props.set(k, this.fromNative(v[k]))); return o; }
      return v;
    }

    method(group, name, impl) {
      const key = group + '.' + name;
      if (!this.cache.has(key)) this.cache.set(key, this.native(name, impl));
      return this.cache.get(key);
    }

    stringMethod(name) {
      const I = this;
      const pat = x => (x instanceof JSObject && x.kind === 'regexp' ? x.re : I.toStr(x));
      const replacer = x => (I.isCallable(x)
        ? (...m) => I.toStr(I.callFunction(x, undefined, m.map(v => (v && typeof v === 'object' ? I.fromNative(Object.assign({}, v)) : v)), null))
        : I.toStr(x));
      const t = {
        toUpperCase: s => s.toUpperCase(), toLowerCase: s => s.toLowerCase(), trim: s => s.trim(),
        trimStart: s => s.trimStart(), trimEnd: s => s.trimEnd(),
        includes: (s, a) => s.includes(I.toStr(a[0]), a[1]), indexOf: (s, a) => s.indexOf(I.toStr(a[0]), a[1]),
        lastIndexOf: (s, a) => s.lastIndexOf(I.toStr(a[0])),
        startsWith: (s, a) => s.startsWith(I.toStr(a[0])), endsWith: (s, a) => s.endsWith(I.toStr(a[0])),
        slice: (s, a) => s.slice(a[0], a[1]), substring: (s, a) => s.substring(a[0], a[1]),
        charAt: (s, a) => s.charAt(a[0]), at: (s, a) => s.at(a[0] || 0), repeat: (s, a) => s.repeat(a[0]),
        charCodeAt: (s, a) => s.charCodeAt(a[0] || 0), codePointAt: (s, a) => s.codePointAt(a[0] || 0),
        localeCompare: (s, a) => s.localeCompare(I.toStr(a[0])), normalize: s => s.normalize(),
        padStart: (s, a) => s.padStart(a[0], a[1] === undefined ? ' ' : I.toStr(a[1])),
        padEnd: (s, a) => s.padEnd(a[0], a[1] === undefined ? ' ' : I.toStr(a[1])),
        replace: (s, a) => s.replace(pat(a[0]), replacer(a[1])),
        replaceAll: (s, a) => s.replaceAll(pat(a[0]), replacer(a[1])),
        search: (s, a) => s.search(pat(a[0])),
        match: (s, a) => {
          const re = pat(a[0]);
          const m = s.match(re);
          if (!m) return null;
          return re instanceof RegExp && re.global ? I.makeArray([...m]) : I.matchToArray(m);
        },
        matchAll: (s, a) => I.listIterator([...s.matchAll(pat(a[0]))].map(m => I.matchToArray(m)), 'RegExp String Iterator'),
        concat: (s, a) => s.concat(...a.map(x => I.toStr(x))), toString: s => s, valueOf: s => s,
        split: (s, a) => I.makeArray(a[0] === undefined ? [s] : s.split(pat(a[0]), a[1])),
      };
      return Object.prototype.hasOwnProperty.call(t, name) ? this.method('str', name, (self, args) => t[name](self, args)) : undefined;
    }

    matchToArray(m) {
      if (!m) return null;
      const arr = this.makeArray([...m]);
      arr.props.set('index', m.index);
      arr.props.set('input', m.input);
      arr.props.set('groups', m.groups ? this.fromNative(Object.assign({}, m.groups)) : undefined);
      return arr;
    }

    makeRegExp(re) {
      const o = this.alloc('regexp');
      o.re = re;
      this.badge('regex');
      return o;
    }

    isIterable(v) {
      if (typeof v === 'string') return true;
      if (!(v instanceof JSObject)) return false;
      if (['array', 'map', 'set', 'iterator'].includes(v.kind) || (v.isGenerator && !v.isAsyncGen)) return true;
      return this.isCallable(this.getMember(v, SYM_ITER));
    }

    arrayMethod(name) {
      const I = this;
      const call = (cb, args, node) => I.callFunction(cb, undefined, args, node);
      const withCb = body => (arr, args, node) => {
        const cb = args[0];
        if (!I.isCallable(cb)) throw I.makeError('TypeError', `${I.display(cb)} is not a function`, node);
        I.badge('callback');
        I.record(node, `🔁 <b>.${name}()</b> is a built-in method. It will call your callback ${code(I.fnLabel(cb))} once for each of the ${arr.items.length} items.`, 'native');
        return body(arr, cb, args, node);
      };
      const changed = arr => { I.changedProp = { id: arr.id, key: String(arr.items.length - 1) }; };
      const frozen = (arr, node) => { if (arr.frozen) throw I.makeError('TypeError', 'Cannot change a frozen array', node); };
      const t = {
        push: (arr, a, node) => { frozen(arr, node); arr.items.push(...a); changed(arr); return arr.items.length; },
        pop: (arr, a, node) => { frozen(arr, node); return arr.items.pop(); },
        shift: (arr, a, node) => { frozen(arr, node); return arr.items.shift(); },
        unshift: (arr, a, node) => { frozen(arr, node); arr.items.unshift(...a); I.changedProp = { id: arr.id, key: '0' }; return arr.items.length; },
        slice: (arr, a) => I.makeArray(arr.items.slice(a[0], a[1])),
        splice: (arr, a, node) => { frozen(arr, node); return I.makeArray(a.length ? arr.items.splice(...a) : []); },
        concat: (arr, a) => I.makeArray(arr.items.concat(...a.map(x => (x instanceof JSObject && x.kind === 'array' ? x.items : [x])))),
        join: (arr, a) => arr.items.map(x => (x == null ? '' : I.toStr(x))).join(a[0] === undefined ? ',' : I.toStr(a[0])),
        indexOf: (arr, a) => arr.items.indexOf(a[0]),
        lastIndexOf: (arr, a) => arr.items.lastIndexOf(a[0]),
        includes: (arr, a) => arr.items.includes(a[0]),
        reverse: arr => { arr.items.reverse(); return arr; },
        fill: (arr, a) => { arr.items.fill(a[0], a[1], a[2]); return arr; },
        at: (arr, a) => arr.items.at(a[0] || 0),
        flat: (arr, a) => {
          const depth = a[0] === undefined ? 1 : I.toNumber(a[0]);
          const flat = (items, d) => items.flatMap(x => (x instanceof JSObject && x.kind === 'array' && d > 0 ? flat(x.items, d - 1) : [x]));
          return I.makeArray(flat(arr.items, depth));
        },
        keys: arr => I.listIterator(arr.items.map((_, i) => i), 'Array Iterator'),
        values: arr => I.listIterator(arr.items.slice(), 'Array Iterator'),
        entries: arr => I.listIterator(arr.items.map((x, i) => I.makeArray([i, x])), 'Array Iterator'),
        toString: arr => I.toStr(arr),
        map: withCb((arr, cb, a, node) => {
          const out = I.makeArray([]);
          const len = arr.items.length;
          for (let i = 0; i < len; i++) { out.items.push(call(cb, [arr.items[i], i, arr], node)); I.changedProp = { id: out.id, key: String(i) }; }
          return out;
        }),
        flatMap: withCb((arr, cb, a, node) => {
          const out = I.makeArray([]);
          for (let i = 0; i < arr.items.length; i++) {
            const r = call(cb, [arr.items[i], i, arr], node);
            if (r instanceof JSObject && r.kind === 'array') out.items.push(...r.items); else out.items.push(r);
          }
          return out;
        }),
        filter: withCb((arr, cb, a, node) => {
          const out = I.makeArray([]);
          const len = arr.items.length;
          for (let i = 0; i < len; i++) { const x = arr.items[i]; if (I.truthy(call(cb, [x, i, arr], node))) { out.items.push(x); I.changedProp = { id: out.id, key: String(out.items.length - 1) }; } }
          return out;
        }),
        forEach: withCb((arr, cb, a, node) => { const len = arr.items.length; for (let i = 0; i < len; i++) call(cb, [arr.items[i], i, arr], node); }),
        find: withCb((arr, cb, a, node) => { for (let i = 0; i < arr.items.length; i++) if (I.truthy(call(cb, [arr.items[i], i, arr], node))) return arr.items[i]; }),
        findIndex: withCb((arr, cb, a, node) => { for (let i = 0; i < arr.items.length; i++) if (I.truthy(call(cb, [arr.items[i], i, arr], node))) return i; return -1; }),
        findLast: withCb((arr, cb, a, node) => { for (let i = arr.items.length - 1; i >= 0; i--) if (I.truthy(call(cb, [arr.items[i], i, arr], node))) return arr.items[i]; }),
        findLastIndex: withCb((arr, cb, a, node) => { for (let i = arr.items.length - 1; i >= 0; i--) if (I.truthy(call(cb, [arr.items[i], i, arr], node))) return i; return -1; }),
        some: withCb((arr, cb, a, node) => { for (let i = 0; i < arr.items.length; i++) if (I.truthy(call(cb, [arr.items[i], i, arr], node))) return true; return false; }),
        every: withCb((arr, cb, a, node) => { for (let i = 0; i < arr.items.length; i++) if (!I.truthy(call(cb, [arr.items[i], i, arr], node))) return false; return true; }),
        reduce: withCb((arr, cb, a, node) => {
          let i = 0, acc;
          if (a.length > 1) acc = a[1];
          else { if (!arr.items.length) throw I.makeError('TypeError', 'Reduce of empty array with no initial value', node); acc = arr.items[0]; i = 1; }
          for (; i < arr.items.length; i++) acc = call(cb, [acc, arr.items[i], i, arr], node);
          return acc;
        }),
        sort: (arr, a, node) => {
          const cmp = a[0];
          const items = arr.items;
          for (let i = 1; i < items.length; i++) {
            for (let j = i; j > 0; j--) {
              const x = items[j - 1], y = items[j];
              const r = cmp ? I.toNumber(call(cmp, [x, y], node)) : (I.toStr(x) > I.toStr(y) ? 1 : -1);
              if (r > 0) { items[j - 1] = y; items[j] = x; } else break;
            }
          }
          return arr;
        },
      };
      return Object.prototype.hasOwnProperty.call(t, name) ? this.method('arr', name, (self, args, node) => t[name](self, args, node)) : undefined;
    }

    functionMethod(fn, name) {
      const I = this;
      if (name === 'call') return this.native('call', (self, a, node) => I.callFunction(self, a[0], a.slice(1), node));
      if (name === 'apply') return this.native('apply', (self, a, node) => I.callFunction(self, a[0], a[1] instanceof JSObject && a[1].items ? a[1].items.slice() : [], node));
      if (name === 'bind') return this.native('bind', (self, a) => {
        const target = self, thisArg = a[0], pre = a.slice(1);
        return I.native('bound ' + I.fnLabel(target), (s2, a2, node) => I.callFunction(target, thisArg, pre.concat(a2), node));
      });
      if (name === 'toString') return this.native('toString', self => I.toStr(self));
      return undefined;
    }

    collectionMethod(o, name) {
      const I = this;
      const mapKey = k => trunc(I.display(k, 1, false, 1), 18) + ' ⇒';
      const t = o.kind === 'map' ? {
        set: (m, a) => { m.map.set(a[0], a[1]); I.changedProp = { id: m.id, key: mapKey(a[0]) }; return m; },
        get: (m, a) => m.map.get(a[0]),
        has: (m, a) => m.map.has(a[0]),
        delete: (m, a) => m.map.delete(a[0]),
        clear: m => { m.map.clear(); },
        forEach: (m, a, node) => { [...m.map].forEach(([k, v]) => I.callFunction(a[0], a[1], [v, k, m], node)); },
        keys: m => I.listIterator([...m.map.keys()], 'Map Iterator'),
        values: m => I.listIterator([...m.map.values()], 'Map Iterator'),
        entries: m => I.listIterator([...m.map].map(([k, v]) => I.makeArray([k, v])), 'Map Iterator'),
      } : {
        add: (s, a) => { s.set.add(a[0]); I.changedProp = { id: s.id, key: '•' }; return s; },
        has: (s, a) => s.set.has(a[0]),
        delete: (s, a) => s.set.delete(a[0]),
        clear: s => { s.set.clear(); },
        forEach: (s, a, node) => { [...s.set].forEach(v => I.callFunction(a[0], a[1], [v, v, s], node)); },
        values: s => I.listIterator([...s.set], 'Set Iterator'),
        keys: s => I.listIterator([...s.set], 'Set Iterator'),
        entries: s => I.listIterator([...s.set].map(v => I.makeArray([v, v])), 'Set Iterator'),
      };
      return Object.prototype.hasOwnProperty.call(t, name) ? this.method(o.kind, name, (self, args, node) => t[name](self, args, node)) : undefined;
    }

    regexpMember(r, key) {
      const I = this;
      if (key === 'lastIndex') return r.re.lastIndex;
      if (['source', 'flags', 'global', 'ignoreCase', 'multiline', 'sticky', 'unicode'].includes(key)) return r.re[key];
      if (key === 'test') return this.method('re', 'test', (self, a) => { const ok = self.re.test(I.toStr(a[0])); I.changedProp = { id: self.id, key: 'lastIndex' }; return ok; });
      if (key === 'exec') return this.method('re', 'exec', (self, a) => { const m = I.matchToArray(self.re.exec(I.toStr(a[0]))); I.changedProp = { id: self.id, key: 'lastIndex' }; return m; });
      if (key === 'toString') return this.method('re', 'toString', self => String(self.re));
      return undefined;
    }

    dateMember(d, key) {
      const I = this;
      if (typeof key !== 'string' || typeof Date.prototype[key] !== 'function' || key === 'constructor') return undefined;
      return this.method('date', key, (self, a) => {
        const r = self.d[key](...a.map(x => (x instanceof JSObject && x.kind !== 'date' ? I.natArg(x) : I.toPrim(x))));
        if (key.startsWith('set')) I.changedProp = { id: self.id, key: 'time' };
        return r;
      });
    }

    generatorMethod(g, key) {
      const I = this;
      if (key === 'next' || key === 'return' || key === 'throw') {
        return this.method('gen', key, (self, a, node) => (self.isAsyncGen ? I.agRequest(self, key, a[0], node) : I.genResume(self, key, a[0], node)));
      }
      if ((key === SYM_ITER && !g.isAsyncGen) || (key === SYM_ASYNC_ITER && g.isAsyncGen)) return this.method('gen', 'self', self => self);
      return undefined;
    }

    // [Symbol.iterator] for built-in iterables
    builtinIterMethod(obj) {
      const I = this;
      if (typeof obj === 'string') return this.method('iter', 'string', self => I.listIterator([...self], 'String Iterator'));
      if (!(obj instanceof JSObject)) return undefined;
      if (obj.kind === 'array') return this.method('iter', 'array', self => I.listIterator(self.items.slice(), 'Array Iterator'));
      if (obj.kind === 'map') return this.method('iter', 'map', self => I.listIterator([...self.map].map(([k, v]) => I.makeArray([k, v])), 'Map Iterator'));
      if (obj.kind === 'set') return this.method('iter', 'set', self => I.listIterator([...self.set], 'Set Iterator'));
      if (obj.kind === 'iterator') return this.method('iter', 'self', self => self);
      return undefined;
    }

  });
})();
