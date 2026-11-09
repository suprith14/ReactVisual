/*
 * JS Engine Lab — engine part: extra data for the teaching animations.
 *
 * Each snapshot gets:
 *  - evals: every sub-expression evaluated since the previous step, with its value
 *           (the UI builds an "evaluation tree": a * b + c(d) → 6 + 5 → 11)
 *  - arr:   array reads and writes by index ({ id, i, w }), for the array view (sorting, two pointers…)
 *  - ret:   the value a function returned, on "pop" steps (for the call tree)
 */
(function () {
  'use strict';
  const { JSObject, isIndex, trunc, StepLimit } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { evaluate: P.evaluate, getMember: P.getMember, setMember: P.setMember, record: P.record, setupPlatform: P.setupPlatform };
  const LOGGED = new Set(['BinaryExpression', 'LogicalExpression', 'CallExpression', 'NewExpression', 'MemberExpression', 'ConditionalExpression',
    'UnaryExpression', 'UpdateExpression', 'AssignmentExpression', 'Identifier', 'TemplateLiteral', 'ArrayExpression', 'ObjectExpression',
    'AwaitExpression', 'ChainExpression', 'TaggedTemplateExpression', 'SequenceExpression']);

  window.JSEngine.mixin(class {
    // a short, cheap description of a value (no deep previews: this runs for every sub-expression)
    quickText(v) {
      if (v === undefined) return 'undefined';
      if (v === null) return 'null';
      if (typeof v === 'string') return JSON.stringify(trunc(v, 24));
      if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
      if (typeof v === 'bigint') return v + 'n';
      if (typeof v === 'boolean') return String(v);
      if (!(v instanceof JSObject)) return typeof v === 'symbol' || (v && v.desc !== undefined) ? 'Symbol()' : String(v);
      if (v.kind === 'native') return 'ƒ ' + v.name;
      if (v.kind === 'function') return (v.isClass ? 'class ' : 'ƒ ') + (v.name || 'anonymous');
      if (v.isPromise) return `Promise <${v.state}> #${v.id}`;
      if (v.kind === 'array') {
        const items = v.items;
        if (items.length <= 6 && items.every(x => !(x instanceof JSObject))) return trunc('[' + items.map(x => (typeof x === 'string' ? JSON.stringify(x) : String(x))).join(', ') + ']', 30);
        return `Array(${items.length}) #${v.id}`;
      }
      if (v.hidden) return v.label;
      return `${v.isError ? 'Error' : v.ctorName || '{…}'} #${v.id}`;
    }

    *evaluate(node, ctx) {
      const v = yield* base.evaluate.call(this, node, ctx);
      if (!this.silent && LOGGED.has(node.type) && !node.sourceFile) {
        const log = this.evalLog || (this.evalLog = []);
        log.push({ s: node.start, e: node.end, t: this.quickText(v), tr: this.truthy(v), ref: v instanceof JSObject && v.id > 0 ? v.id : null });
        if (log.length > 300) log.splice(0, log.length - 300);
      }
      return v;
    }

    getMember(obj, key, node, receiver) {
      if (node && obj instanceof JSObject && obj.kind === 'array' && obj.id > 0 && !this.silent && (typeof key === 'number' || isIndex(key))) this.noteArrayOp(obj, +key, 0);
      return base.getMember.call(this, obj, key, node, receiver);
    }

    setMember(obj, key, value, node) {
      if (node && obj instanceof JSObject && obj.kind === 'array' && obj.id > 0 && !this.silent && (typeof key === 'number' || isIndex(key))) this.noteArrayOp(obj, +key, 1);
      return base.setMember.call(this, obj, key, value, node);
    }

    noteArrayOp(arr, i, w) {
      const ops = this.arrOps || (this.arrOps = []);
      if (ops.length < 200) ops.push({ id: arr.id, i, w });
    }

    // Big-O lab: count steps only (no snapshots), and let the code restart the count after its setup
    setupPlatform() {
      base.setupPlatform.call(this);
      if (this.opts.countOnly) this.builtins.set('startMeasure', this.native('startMeasure', function () { this.stepCount = 0; }));
    }

    record(node, msg, kind) {
      if (this.opts.countOnly) {
        if (this.silent) return;
        this.stepCount = (this.stepCount || 0) + 1;
        if (this.stepCount > this.maxSteps && !this.limitHit) { this.limitHit = true; throw new StepLimit(); }
        return;
      }
      const n = this.trace.length;
      base.record.call(this, node, msg, kind);
      if (this.trace.length === n) return; // silent: nothing was recorded
      const snap = this.trace[n];
      snap.evals = this.evalLog && this.evalLog.length ? this.evalLog.splice(0) : null;
      snap.arr = this.arrOps && this.arrOps.length ? this.arrOps.splice(0) : null;
      snap.ret = kind === 'pop' && /is done and returns/.test(msg) ? this.quickText(this.tempRoot) : null;
    }
  });
})();
