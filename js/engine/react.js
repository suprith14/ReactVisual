/*
 * React Engine Lab — engine part: runs ReactLite inside the interpreter and records React's internals.
 *
 *  - JSX is turned into React.createElement calls, with a position map back to your code
 *  - ReactLite (js/react/reactlite.js) is loaded as JavaScript, so its code can be stepped through
 *  - every trace() from ReactLite becomes a "react" step with a plain-language explanation
 *  - each snapshot carries the fiber trees (current and work-in-progress), hooks and React's phase
 *  - React's own steps are collapsed by default (one step per React event);
 *    with { deepReact: true } every line inside React is shown too
 */
(function () {
  'use strict';
  const { code, esc, JSObject } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { run: P.run, makeGlobal: P.makeGlobal, record: P.record, alloc: P.alloc, callFunction: P.callFunction, serCtx: P.serCtx };
  const TAGS = { 0: 'FunctionComponent', 1: 'ClassComponent', 3: 'HostRoot', 4: 'HostPortal', 5: 'HostComponent', 6: 'HostText', 7: 'Fragment', 8: 'Mode', 9: 'ContextConsumer', 10: 'ContextProvider', 11: 'ForwardRef', 12: 'Profiler', 13: 'SuspenseComponent', 14: 'MemoComponent', 16: 'LazyComponent', 22: 'OffscreenComponent' };
  const FLAG_NAMES = [[2, 'Placement'], [4, 'Update'], [16, 'ChildDeletion'], [128, 'DidCapture'], [512, 'Ref'], [1024, 'Snapshot'], [2048, 'Passive'], [8192, 'Visibility']];
  const REASONS = {
    mount: 'it is <b>new</b> (first render: mount)',
    state: 'its <b>state changed</b> (an update is waiting in one of its hooks)',
    props: 'its parent re-rendered and passed a <b>new props object</b>',
    context: 'a <b>context</b> value it reads changed',
    caught: 'a child <b>threw an error</b>: this error boundary renders again to show its error UI',
    suspended: 'something inside <b>suspended</b> (threw a Promise): it renders again to show its <b>fallback</b>',
  };

  window.JSEngine.mixin(class {
    // ======================================================== JSX + positions
    run() {
      const src = this.src;
      this.reactWanted = !!window.REACT_LITE && /\bReact(DOM|DOMServer)?\b|createRoot|hydrateRoot|from\s*['"]react/.test(src);
      // TypeScript generics (<T>) look like JSX: plain .ts code is left alone unless it uses React
      const isTS = window.JSEngine.isTypeScript && window.JSEngine.isTypeScript(src);
      if (window.JSEngine.hasJSX && window.JSEngine.hasJSX(src) && (!isTS || this.reactWanted)) {
        // "// @file page.html" sections are HTML, not JSX: they are blanked out for the transform and put back after
        const markers = [...src.matchAll(/^[ \t]*\/\/[ \t]*@file[ \t]+(\S+)[^\n]*\n?/gm)];
        const html = markers.map((m, i) => ({ head: m[0], start: m.index + m[0].length, end: i + 1 < markers.length ? markers[i + 1].index : src.length, name: m[1] }))
          .filter(f => /\.html?$/i.test(f.name));
        let input = src;
        html.forEach(f => { input = input.slice(0, f.start) + input.slice(f.start, f.end).replace(/[^\n]/g, ' ') + input.slice(f.end); });
        let r;
        try { r = window.JSEngine.transformJSX(input); }
        catch (e) {
          if (e instanceof window.JSEngine.JSXError) return { error: 'JSX: ' + e.message, errorLine: src.slice(0, e.pos).split('\n').length, trace: [] };
          throw e;
        }
        if (r.changed) {
          this.reactWanted = !!window.REACT_LITE;
          const mapper = window.JSEngine.jsxMapper(r.map);
          let from = 0;
          html.forEach(f => {
            const at = r.code.indexOf(f.head, from);
            if (at < 0) return;
            const s = at + f.head.length;
            r.code = r.code.slice(0, s) + src.slice(f.start, f.end) + r.code.slice(s + (f.end - f.start));
            from = s;
          });
          const parses = type => { try { window.acorn.parse(r.code, { ecmaVersion: 2022, sourceType: type }); return null; } catch (e) { return e; } };
          const bad = !isTS && !markers.length && parses('module') && parses('script');
          if (bad) {
            const e = bad;
            const pos = e.pos != null ? mapper.start(e.pos) : 0;
            return { error: 'SyntaxError: ' + e.message.replace(/\s*\(\d+:\d+\)$/, ''), errorLine: src.slice(0, pos).split('\n').length, trace: [] };
          }
          this.jsx = { mapper, origSrc: src, lineStarts: [0].concat([...src.matchAll(/\n/g)].map(m => m.index + 1)) };
          this.src = r.code;
        }
      }
      return base.run.call(this);
    }

    origLine(pos) {
      const ls = this.jsx.lineStarts;
      let lo = 0, hi = ls.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ls[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo + 1;
    }

    // ======================================================== loading ReactLite
    makeGlobal(strict) {
      const ctx = base.makeGlobal.call(this, strict);
      if (this.reactWanted && !this.nodeMode && !this.reactLoaded) this.setupReact(ctx);
      return ctx;
    }

    setupReact(ctx) {
      this.reactLoaded = true;
      // a React app starts from an empty <div id="root">, unless the program brings its own page
      if (this.page && !this.page.touched && this.opts.pageHTML == null) { this.page.doc.body.innerHTML = '<div id="root"></div>'; this.page.touched = true; }
      const source = '(' + window.REACT_LITE.toString() + ')';
      const file = { code: source, label: 'React internals (ReactLite)', react: true };
      this.reactFile = file;
      const ast = window.acorn.parse(source, { ecmaVersion: 2022, locations: true, sourceType: 'script', directSourceFile: file });
      this.rx = { roots: [], phase: 'idle', lane: null, wip: null, wipRoot: null, worked: [], bailed: [], completed: [], mutations: [], effects: [], log: [], detail: null };
      const trace = this.native('trace', function (s, a, node) { this.reactTrace(this.toStr(a[0]), a[1], node); });
      this.silent = true;
      try {
        const factory = this.runSync(this.evaluate(ast.body[0].expression, ctx));
        const mod = this.callFunction(factory, undefined, [trace], null);
        const React = mod.props.get('React'), ReactDOM = mod.props.get('ReactDOM');
        React.hidden = true; React.label = 'React';
        ReactDOM.hidden = true; ReactDOM.label = 'ReactDOM';
        this.builtins.set('React', React);
        this.builtins.set('ReactDOM', ReactDOM);
        const Server = mod.props.get('ReactDOMServer');
        Server.hidden = true; Server.label = 'ReactDOMServer';
        this.builtins.set('ReactDOMServer', Server);
        if (!this.builtins.has('FormData')) this.builtins.set('FormData', mod.props.get('FormData'));
        const Compiler = mod.props.get('ReactCompilerRuntime');
        Compiler.hidden = true; Compiler.label = 'ReactCompilerRuntime';
        this.builtins.set('ReactCompilerRuntime', Compiler);
        const RSC = mod.props.get('ReactServer');
        RSC.hidden = true; RSC.label = 'ReactServer';
        this.builtins.set('ReactServer', RSC);
        const Static = mod.props.get('ReactDOMStatic');
        Static.hidden = true; Static.label = 'ReactDOMStatic';
        this.builtins.set('ReactDOMStatic', Static);
      } finally { this.silent = false; }
      this.badge('react');
    }

    // React's own objects (fibers, hooks, updates) stay out of the Heap panel unless you dive into React
    callFunction(fn, thisVal, args, callNode, how, opts) {
      const isReact = !!(fn && fn.kind === 'function' && fn.node && fn.node.sourceFile && fn.node.sourceFile.react);
      if (!fn || fn.kind !== 'function') return base.callFunction.call(this, fn, thisVal, args, callNode, how, opts);
      const saved = this.reactDepth || 0;
      this.reactDepth = isReact ? saved + 1 : 0;
      // push/pop steps of a React function called by another React function are hidden in collapsed mode
      (this.rcalls || (this.rcalls = [])).push(isReact && saved > 0);
      try { return base.callFunction.call(this, fn, thisVal, args, callNode, how, opts); }
      finally { this.reactDepth = saved; this.rcalls.pop(); }
    }
    hiddenInReact(node, kind) {
      if (kind === 'react' || this.opts.deepReact || !this.rx) return false;
      if (kind === 'push' || kind === 'pop') { const c = this.rcalls; if (c && c.length) return c[c.length - 1]; }
      return this.reactDepth > 0 || !!(node && node.sourceFile && node.sourceFile.react);
    }
    alloc(kind) {
      const o = base.alloc.call(this, kind);
      if (this.reactDepth > 0 && !this.opts.deepReact) o.internal = true;
      return o;
    }
    serCtx(c) {
      const r = base.serCtx.call(this, c);
      if (c.fn && c.fn.node && c.fn.node.sourceFile && c.fn.node.sourceFile.react) r.react = true;
      return r;
    }

    // ======================================================== recording
    record(node, msg, kind) {
      // collapsed mode: lines inside React are not separate steps; React reports its work with trace()
      if (this.hiddenInReact(node, kind)) return;
      const n = this.trace.length;
      base.record.call(this, node, msg, kind);
      if (this.trace.length === n) return;
      const snap = this.trace[n];
      if (this.jsx && snap.start != null && !snap.ext) {
        const s = this.jsx.mapper.start(snap.start), e = this.jsx.mapper.end(snap.end);
        snap.start = s; snap.end = Math.max(s + 1, e); snap.line = this.origLine(s);
      }
      if (this.jsx && snap.evals) snap.evals = snap.evals.map(ev => Object.assign({}, ev, { s: this.jsx.mapper.start(ev.s), e: this.jsx.mapper.end(ev.e) }));
      if (this.rx && this.rx.roots.length) snap.react = this.serReact();
      if (kind === 'react' && this.rx) { snap.reactDetail = this.rx.detail; this.rx.detail = null; this.rx.hit = null; }
    }

    // ======================================================== React's trace() calls
    fiberName(f) {
      if (!(f instanceof JSObject)) return '?';
      const g = k => f.props.get(k);
      const tag = g('tag'), type = g('type');
      const fnName = t => (t instanceof JSObject ? (t.props.has('name') ? this.toStr(this.getMember(t, 'name')) : t.name) || 'Anonymous' : 'Anonymous');
      if (tag === 3) return 'Root';
      const key = g('key') != null ? ' key=' + String(g('key')) : '';
      if (tag === 5) return '<' + type + key + '>';
      if (tag === 6) { const t = String(g('pendingProps')); return '"' + (t.length > 14 ? t.slice(0, 13) + '…' : t) + '"'; }
      if (tag === 7) return 'Fragment';
      if (tag === 10) return 'Provider';
      if (tag === 14) {
        const inner = type instanceof JSObject ? type.props.get('type') : null;
        return 'memo(' + (inner instanceof JSObject && inner.props.has('render') ? fnName(inner.props.get('render')) : fnName(inner)) + ')';
      }
      if (tag === 11) return 'forwardRef(' + fnName(type instanceof JSObject ? type.props.get('render') : null) + ')';
      if (tag === 4) return 'Portal';
      if (tag === 8) return 'StrictMode';
      if (tag === 12) { const p = g('pendingProps'); return 'Profiler' + (p instanceof JSObject && p.props.get('id') !== undefined ? ' "' + this.toStr(p.props.get('id')) + '"' : ''); }
      if (tag === 9) return 'Consumer';
      if (tag === 13) return 'Suspense';
      if (tag === 16) return 'lazy';
      if (tag === 22) {
        const p = g('pendingProps'), mode = p instanceof JSObject ? p.props.get('mode') : undefined;
        return (g('isActivity') ? 'Activity' : 'Offscreen') + ' (' + (mode === 'hidden' ? 'hidden' : 'visible') + ')';
      }
      return fnName(type) + (key ? ' (' + key.trim() + ')' : '');
    }

    // [first line, last line] of a component's function in the user's code, or null
    componentLines(fiber) {
      const tag = fiber.props.get('tag');
      if (![0, 1, 11, 14].includes(tag)) return null;
      let fn = fiber.props.get('type');
      if (tag === 14 && fn instanceof JSObject) fn = fn.props.get('type');
      if (fn instanceof JSObject && fn.props.has('render') && !fn.node) fn = fn.props.get('render'); // forwardRef
      const ast = fn instanceof JSObject ? fn.node : null;
      if (!ast || ast.start == null || (ast.sourceFile && ast.sourceFile.react)) return null;
      const lineAt = pos => (this.jsx ? this.origLine(this.jsx.mapper.start(pos)) : this.src.slice(0, pos).split('\n').length);
      const a = lineAt(ast.start), b = lineAt(Math.max(ast.start, ast.end - 1));
      return a && b && b >= a ? [a, b] : null;
    }

    reactTrace(kind, info, node) {
      const rx = this.rx;
      const get = k => (info instanceof JSObject ? info.props.get(k) : undefined);
      const fiber = get('fiber');
      const name = fiber ? code(this.fiberName(fiber)) : '';
      const lane = get('lane');
      let msg = null;
      if (kind === 'completed') { if (fiber) rx.completed.push(fiber.props.get('id')); return; } // bookkeeping only, not a step
      rx.detail = this.reactDetail(kind, get, fiber);
      // commit steps that touch one DOM element: remember it, so the Page panel can outline it
      const DOM_OP = { placement: 'insert', commitUpdate: 'update', commitText: 'text', refAttached: 'ref', hideContent: 'hide', revealContent: 'show', activityHide: 'hide', activityShow: 'show', hydrateClaim: 'adopt' };
      rx.hit = null;
      if (DOM_OP[kind] && fiber instanceof JSObject) {
        let host = fiber;
        for (let k = 0; host instanceof JSObject && k < 60; k++) { const t = host.props.get('tag'); if (t === 5 || t === 6) break; host = host.props.get('child'); }
        const sn = host instanceof JSObject ? host.props.get('stateNode') : null;
        let dom = sn && sn.domNode;
        if (dom && dom.nodeType === 3) dom = dom.parentElement;
        if (dom && dom.nodeType === 1) rx.hit = { node: dom, op: DOM_OP[kind] };
      }
      // render steps of a component: the lines of its function in your code (the code panel highlights them)
      const RENDER_KINDS = { beginWork: 'render', rendered: 'render', processUpdates: 'render', memoHit: 'render', memoMiss: 'render', effectSkipped: 'render', strictRender: 'render', classMount: 'render', renderBailout: 'render', bailout: 'skip', bailoutSubtree: 'skip', memoBailout: 'skip', classSkip: 'skip' };
      if (rx.detail && RENDER_KINDS[kind] && fiber instanceof JSObject) {
        const range = this.componentLines(fiber);
        if (range) rx.detail.comp = { from: range[0], to: range[1], mode: RENDER_KINDS[kind], name: this.fiberName(fiber) };
      }
      if (rx.detail) {
        if (rx.hit) rx.detail.domOp = rx.hit.op;
        rx.detail.trace = kind; // which real React function this step matches (see the Inside view)
        const num = k => { const v = get(k); return typeof v === 'number' ? v : 0; };
        const bits = get('bits');
        if (bits instanceof JSObject) {
          const b = k => { const v = bits.props.get(k); return typeof v === 'number' ? v : 0; };
          rx.detail.bits = { lanes: b('lanes'), childLanes: b('childLanes'), renderLanes: b('renderLanes'), slice: b('slice'), slices: b('slices'), size: b('size'), sameProps: !!bits.props.get('sameProps') };
        }
        if (['scheduleSync', 'scheduleTask', 'transition', 'renderStart', 'yield', 'resume', 'interrupt'].includes(kind)) {
          const root = get('root');
          rx.detail.sched = { pending: root instanceof JSObject ? root.props.get('pendingLanes') || 0 : 0, lane: this.toStr(get('lane') || ''), from: this.toStr(get('from') || ''), slices: num('slices'), used: num('used'), size: num('size') || 3 };
        }
      }
      switch (kind) {
        case 'createRoot':
          rx.roots.push(get('root'));
          msg = '⚛️ <code>createRoot</code> creates a <b>FiberRoot</b> (React\'s record of this app) and the first fiber, the <b>HostRoot</b>. React also adds <b>one listener per event type</b> on the container: all clicks in the app will be handled there (event delegation).';
          break;
        case 'rootRender': msg = `⚛️ <code>root.render(…)</code> doesn't render yet: it puts an <b>update</b> (lane <b>${esc(lane)}</b>) on the HostRoot and asks React to schedule work.`; break;
        case 'setState': msg = `⚛️ A state setter in ${name} adds an <b>update</b> to that hook's queue (lane <b>${esc(lane)}</b>). Nothing re-renders yet: React marks the fiber and all its parents as having pending work, then schedules a render.`; break;
        case 'eagerBailout': msg = `⚛️ <b>Bail out early</b>: the new state of ${name} is the same value (<code>Object.is</code>), so React doesn't schedule a render at all.`; break;
        case 'scheduleSync': msg = '⚛️ The update has <b>Sync</b> priority (it came from a click or typing). React will render in a <b>microtask</b> right after the event handler finishes, so every setState in the handler is <b>batched</b> into one render.'; break;
        case 'scheduleTask': msg = `⚛️ The update has <b>${esc(lane)}</b> priority, so React's scheduler runs the render in a <b>new task</b> (a <code>setTimeout</code>/MessageChannel callback), giving the browser a chance to handle input first.`; break;
        case 'transition': msg = '⚛️ <code>startTransition</code>: updates made inside get the low-priority <b>Transition</b> lane. Their render can be split into slices and <b>interrupted</b> by urgent updates.'; break;
        case 'renderStart':
          rx.phase = 'render'; rx.lane = lane; rx.wipRoot = fiber; rx.worked = []; rx.bailed = []; rx.completed = [];
          msg = `⚛️ <b>Render phase</b> (lane ${esc(lane)}): React clones the current HostRoot into a <b>work-in-progress</b> fiber. It now builds a new tree next to the one on screen (double buffering), one fiber at a time.`;
          break;
        case 'resume': rx.phase = 'render'; msg = '⚛️ React continues the paused render exactly where it stopped: the work-in-progress tree was kept.'; break;
        case 'interrupt': msg = `⚛️ <b>Interrupted!</b> A higher-priority (${esc(lane)}) update arrived while a ${esc(get('from'))} render was paused. React throws the unfinished work-in-progress tree away and starts again with the urgent update; the ${esc(get('from'))} render will restart later.`; break;
        case 'yield':
          rx.wip = fiber;
          msg = `⏸️ <b>Time slice used up</b>: React stops before ${name} and yields to the browser (it could handle a click now). The render continues in the next task. This is <b>concurrent rendering</b>.`;
          break;
        case 'beginWork': {
          rx.wip = fiber; rx.worked.push(fiber.props.get('id'));
          const reason = this.toStr(get('reason'));
          const tag = fiber.props.get('tag');
          msg = tag === 1
            ? `⚛️ <code>beginWork</code> → class ${name} because ${REASONS[reason] || reason}. React processes its <code>setState</code> queue, checks <code>shouldComponentUpdate</code>, then calls <code>render()</code> on the instance.`
            : tag === 13 ? `⚛️ <code>beginWork</code> → ${name}${reason === 'suspended' ? ': a child suspended, so this time it renders its <b>fallback</b> and keeps the content hidden (its state is kept)' : ': it renders its content inside an <b>Offscreen</b> fiber, so the content can be hidden instead of destroyed if something suspends'}.`
            : tag === 0 || tag === 14 || tag === 11
            ? `⚛️ <code>beginWork</code> → ${name} renders because ${REASONS[reason] || reason}. React calls the component function with its props.`
            : tag === 3 ? '⚛️ <code>beginWork</code> → the HostRoot: React reads the element passed to <code>root.render</code> and reconciles its children.'
              : `⚛️ <code>beginWork</code> → ${name}: React compares its new children with the old ones.`;
          break;
        }
        case 'rendered': msg = `⚛️ ${name} returned its JSX. React now <b>reconciles</b>: it compares these elements with the existing child fibers.`; break;
        case 'bailout': rx.bailed.push(fiber.props.get('id')); rx.wip = fiber; msg = fiber.props.get('tag') === 3 ? '⚛️ <b>Bailout</b> on the HostRoot: there is no new <code>root.render</code> call, so React keeps its children and walks down to the component that has the update.' : `⚛️ <b>Bailout</b>: ${name} got the <b>same props object</b> and has no update, so React skips calling it, but something below it has work, so React clones its children and keeps going.`; break;
        case 'bailoutSubtree': rx.bailed.push(fiber.props.get('id')); rx.wip = fiber; msg = `⚛️ <b>Skipped</b>: nothing changed in ${name} or anything inside it, so React reuses the whole subtree without rendering it.`; break;
        case 'renderBailout': rx.bailed.push(fiber.props.get('id')); msg = `⚛️ ${name} ran, but its props and state are <b>the same</b> as before, so React throws its new JSX away and keeps the old children (no DOM changes, no effects).`; break;
        case 'memoBailout': rx.bailed.push(fiber.props.get('id')); msg = `⚛️ <code>memo</code>: the props of ${name} are <b>shallowly equal</b> to last time, so React skips rendering it.`; break;
        case 'contextChanged': msg = `⚛️ The value of ${name} changed (<code>Object.is</code>), so React finds every component below that reads this context and gives it work in this render, even if a parent bails out.`; break;
        case 'processUpdates': msg = `⚛️ <code>${esc(get('hook'))}</code> in ${name} processes its queue: ${get('count')} update${get('count') === 1 ? '' : 's'} applied in order${get('skipped') ? `, ${get('skipped')} lower-priority update${get('skipped') === 1 ? '' : 's'} left for later` : ''}. The new state is the result.`; break;
        case 'effectSkipped': msg = `⚛️ <code>${esc(get('hook'))}</code> in ${name}: every dependency is the same (<code>Object.is</code>), so this effect will <b>not</b> run after this render.`; break;
        case 'memoHit': msg = `⚛️ <code>${esc(get('hook'))}</code> in ${name}: same dependencies, so React returns the value saved last time (nothing recalculated).`; break;
        case 'memoMiss': msg = `⚛️ <code>${esc(get('hook'))}</code> in ${name}: a dependency changed, so the value is calculated again.`; break;
        case 'reconciled': {
          const ops = get('ops');
          const list = ops instanceof JSObject ? ops.items.map(x => String(x)) : [];
          const pretty = list.slice(0, 8).map(x => { const [verb, ...rest] = x.split(' '); return `<b>${esc(verb)}</b> ${code(rest.join(' '))}`; }).join(', ');
          msg = `⚛️ <b>Reconciliation</b> of ${name}'s children: ${pretty}${list.length > 8 ? ' …' : ''}. Matching uses the <b>key</b> (or the position) and the <b>type</b>: same key and type → reuse the fiber; otherwise create a new one and delete the old one.`;
          break;
        }
        case 'diffProps': msg = `⚛️ <code>completeWork</code> on ${name}: the props changed (${esc(this.iterable(get('keys'), null).join(', '))}), so React prepares a DOM update for the commit. The page is not touched yet.`; break;
        case 'createDOM': msg = `⚛️ <code>completeWork</code> on ${name}: React creates the real DOM element and puts its children's DOM nodes inside it, still <b>off-screen</b>.`; break;
        case 'commitStart':
          rx.phase = 'commit'; rx.wip = null;
          msg = '🧾 <b>Commit phase</b>: the new tree is complete. React now applies all the DOM changes in one go. This part is <b>synchronous</b> and can\'t be interrupted, so the user never sees a half-updated page.';
          break;
        case 'placement': msg = `🧾 <b>Placement</b>: ${name} is inserted into the page${get('before') ? ' (with <code>insertBefore</code>, in front of its next sibling)' : ' (with <code>appendChild</code>)'}.`; break;
        case 'deletion': msg = `🧾 <b>Deletion</b>: ${name} and everything inside it is removed from the page. Their effect cleanups run.`; break;
        case 'commitUpdate': msg = `🧾 <b>Update</b>: React changes only what differs on ${name}: ${esc(this.iterable(get('keys'), null).filter(k => !/^on[A-Z]/.test(k)).join(', ') || 'event handlers (no DOM change)')}.`; break;
        case 'commitText': msg = `🧾 <b>Update</b>: the text ${name} is changed with <code>nodeValue</code>.`; break;
        case 'swap': msg = '🔁 <code>root.current = finishedWork</code>: the work-in-progress tree is now the <b>current</b> tree (what is on screen). The old tree stays as its <b>alternate</b> and will be reused for the next render.'; break;
        case 'refAttached': msg = `🧾 The <code>ref</code> of ${name} now points to its DOM element (<code>ref.current</code>).`; break;
        case 'schedulePassive': msg = '🧾 Some components have <code>useEffect</code> work. React schedules it for <b>after the browser paints</b>, in a separate task.'; break;
        case 'commitEnd': rx.phase = 'idle'; msg = '✅ Commit finished. The page shows the new UI.'; break;
        case 'passiveStart': rx.phase = 'passive'; msg = '⏱️ <b>Passive effects</b> (<code>useEffect</code>): first every cleanup from the previous render runs, then every new effect, in tree order.'; break;
        case 'passiveEnd': rx.phase = 'idle'; msg = '✅ All effects have run.'; break;
        case 'effectCleanup': msg = `🧹 Cleanup of ${get('insertion') ? '<code>useInsertionEffect</code>' : get('layout') ? '<code>useLayoutEffect</code>' : '<code>useEffect</code>'} in ${name}${get('hidden') ? ' (an <code>&lt;Activity&gt;</code> above it was hidden: effects stop, but its state is kept)' : get('unmount') ? ' (the component was removed)' : ' (its dependencies changed, or StrictMode is testing the cleanup)'}.`; break;
        case 'activityHide': msg = `🙈 ${name} becomes <b>hidden</b>: its DOM gets <code>display: none</code> and every effect inside is <b>cleaned up</b> (layout cleanups now, <code>useEffect</code> cleanups after paint). Unlike an unmount, the fibers, their <b>state</b> and their DOM are kept.`; break;
        case 'activityShow': msg = `👀 ${name} becomes <b>visible</b> again: the DOM is shown, and the effects that were cleaned up <b>run again</b>, with the state it kept while hidden.`; break;
        case 'effectEventUpdated': msg = `🔗 <code>useEffectEvent</code> in ${name}: during the commit (before any effect runs) the event function is pointed at <b>this render's</b> callback. Effects that call it always see the latest props and state, without listing them as dependencies.`; break;
        case 'effectRun': msg = get('reappear') ? `▶️ ${get('layout') ? '<code>useLayoutEffect</code>' : '<code>useEffect</code>'} in ${name} runs again: its <code>&lt;Activity&gt;</code> is visible again.` : `▶️ ${get('insertion') ? '<code>useInsertionEffect</code> runs during the DOM changes, before any layout effect (for CSS-in-JS libraries to insert styles)' : get('layout') ? '<code>useLayoutEffect</code> runs right after the DOM changes, <b>before</b> the browser paints' : '<code>useEffect</code> runs'} in ${name}.`; break;
        case 'event': msg = `🖱️ React's root listener received a <b>${esc(get('type'))}</b>. It walks from the clicked element up to the root, collecting ${get('count')} handler${get('count') === 1 ? '' : 's'}, and calls them with a <b>synthetic event</b>. State updates inside get the <b>Sync</b> lane and are batched.`; break;
        // ---- class components
        case 'classMount': msg = `⚛️ Class ${name} mounts: React calls <code>new ${esc(this.fiberName(fiber))}(props)</code>, stores the instance on the fiber (<code>stateNode</code>) and runs <code>getDerivedStateFromProps</code> if there is one.`; break;
        case 'classSetState': msg = `⚛️ <code>this.setState</code> in ${name} adds an update (lane <b>${esc(lane)}</b>) to the class's update queue. <code>this.state</code> does not change yet: the object is <b>merged</b> into the state during the next render.`; break;
        case 'forceUpdate': msg = `⚛️ <code>forceUpdate()</code> in ${name}: the next render skips <code>shouldComponentUpdate</code>.`; break;
        case 'classSkip': msg = `⚛️ ${name} does <b>not</b> render: ${get('scu') ? '<code>shouldComponentUpdate</code> returned false' : get('pure') ? 'it is a <code>PureComponent</code> and its props and state are shallowly equal' : 'nothing changed'}. Its new state is still saved.`; break;
        case 'classLifecycle': msg = `🧾 <code>${esc(get('method'))}</code> runs on ${name}${get('method') === 'componentWillUnmount' ? ' (the component is being removed)' : get('method') === 'componentDidCatch' ? ' with the error and the component stack (good place to log it)' : ' (commit phase, after the DOM is updated)'}.`; break;
        case 'snapshot': msg = `🧾 <code>getSnapshotBeforeUpdate</code> on ${name} runs <b>before</b> the DOM changes (for example to read a scroll position). Its return value goes to <code>componentDidUpdate</code>.`; break;
        case 'strictRender': msg = `🧪 <b>StrictMode</b>: ${name} is rendered <b>twice</b> (development only). The first result is thrown away. If the two renders differ, your component is not pure.`; break;
        case 'strictEffects': msg = `🧪 <b>StrictMode</b>: React unmounts and mounts the ${get('count')} new component${get('count') === 1 ? '' : 's'} once more (cleanup → effect again), to check that every effect cleans up after itself.`; break;
        // ---- errors
        case 'caughtError': msg = `💥 ${name} threw <b>${esc(get('message'))}</b> while rendering. React throws away the unfinished work below the nearest <b>error boundary</b> (${code(this.fiberName(get('boundary')))}) and renders it again with the error.`; break;
        case 'uncaughtError': msg = `💥 ${name} threw <b>${esc(get('message'))}</b> while rendering, and no error boundary caught it. React 18 <b>removes the whole app</b> from the page (an empty screen is safer than a broken one) and reports the error.`; break;
        // ---- Suspense, lazy, use
        case 'suspend': msg = `⏳ ${name} <b>suspended</b>: it threw a Promise (data or code is not ready). React goes back to the nearest ${code(this.fiberName(get('boundary')))} boundary, shows its fallback, and will try again when the Promise resolves.`; break;
        case 'suspendedTransition': msg = `⏳ ${name} suspended during a <b>transition</b>. Instead of replacing visible content with a fallback, React <b>keeps the old UI</b> (isPending stays true) and throws this render away until the Promise resolves.`; break;
        case 'retry': msg = `🔁 The Promise resolved: React schedules a new render of ${name} to try again.`; break;
        case 'showFallback': msg = `⏳ ${name} shows its <b>fallback</b>. The real content is kept in a hidden Offscreen fiber.`; break;
        case 'showContent': msg = `✅ ${name}: nothing is suspended any more, so the content is shown and the fallback is removed.`; break;
        case 'hideContent': msg = `🧾 The content of ${name} is <b>hidden</b> with <code>display: none</code>, not removed, so its state survives while the fallback is shown.`; break;
        case 'revealContent': msg = `🧾 The content of ${name} is shown again (its DOM and state were kept).`; break;
        case 'lazyResolved': msg = `📦 <code>lazy</code>: the code for ${name} has loaded, so React now renders the real component.`; break;
        // ---- concurrent features and newer hooks
        case 'deferValue': msg = `🐢 <code>useDeferredValue</code> in ${name}: this is an urgent render, so it returns the <b>old</b> value and schedules a <b>Transition</b> render with the new one.`; break;
        case 'storeChanged': msg = `📡 The external store changed, so <code>useSyncExternalStore</code> in ${name} schedules a <b>Sync</b> render (store updates can't be split, so every component sees the same value).`; break;
        case 'optimistic': msg = `✨ <code>useOptimistic</code> in ${name}: the guessed value shows <b>right away</b>, while the async action is still running.`; break;
        case 'asyncAction': msg = '⏳ The transition function returned a Promise: an <b>async action</b> (React 19). <code>isPending</code> stays true until it finishes.'; break;
        case 'actionDone': msg = '✅ The async action finished: React ends the transition (<code>isPending</code> becomes false) and drops optimistic values.'; break;
        // ---- server rendering and hydration
        case 'ssrStart': msg = `🖥️ <code>${get('markers') ? 'renderToString' : 'renderToStaticMarkup'}</code> renders the tree to an HTML <b>string</b>, like a server does. Components run once with their initial state; effects and event handlers are ignored (there is no DOM).`; break;
        case 'ssrEnd': msg = `🖥️ Server render done: ${get('length')} characters of HTML. The browser can show it before any JavaScript runs.`; break;
        case 'ssrFallback': msg = '🖥️ Something suspended on the server: <code>renderToString</code> cannot wait, so it sends the Suspense <b>fallback</b> and the client renders the content later. (Streaming renderers can wait and stream it in.)'; break;
        case 'hydrateStart': msg = '💧 <b>Hydration</b> starts: the container already holds the server\'s HTML. React renders as usual, but instead of creating DOM nodes it <b>adopts</b> the existing ones, one by one, and attaches event handlers to them.'; break;
        case 'hydrateClaim': msg = `💧 ${name} matches the next server node, so React reuses that DOM node (no new element is created).`; break;
        case 'hydrateEnd': msg = '💧 Hydration finished: every server node was matched. From now on the page is a normal interactive React app.'; break;
        case 'hydrationFailed': msg = '💥 <b>Hydration mismatch</b>: the client render does not match the server HTML. React 18 throws the server HTML away and renders the whole root on the client (slower, and the page may flicker).'; break;
        case 'restoreControlled': msg = `⌨️ ${name} is a <b>controlled</b> input and its state did not change, so React puts the DOM value back to the <code>value</code> prop. That is why typing seems to do nothing without <code>onChange</code>.`; break;
        case 'formAction': msg = '📨 The form has an <code>action</code> function (React 19): React prevents the page from reloading, collects the fields into a <code>FormData</code> and runs the action in a <b>transition</b>. <code>useFormStatus</code> inside the form now reports <code>pending: true</code>.'; break;
        // ---- React 19 extras
        case 'refCleanup': msg = `🧹 The callback ref of ${name} returned a <b>cleanup function</b> (React 19), so React calls that cleanup now instead of calling the ref with <code>null</code>.`; break;
        case 'hoisted': msg = `📄 ${name} is <b>document metadata</b>: React 19 puts it into <code>&lt;head&gt;</code>, wherever the component that renders it is in the tree.`; break;
        case 'profilerRender': msg = `⏱️ <code>&lt;Profiler&gt;</code> ${name}: something inside rendered in this commit, so React calls <code>onRender</code> (phase <b>${esc(get('phase'))}</b>; ${get('actual')} of ${get('base')} components rendered). In real React the durations are milliseconds; ReactLite counts 1 per component.`; break;
        case 'streamFallback': msg = `🌊 A Suspense boundary is still waiting for data. The streaming renderer does not stop: it writes the <b>fallback</b> with a placeholder <code>&lt;template id="B:${get('id')}"&gt;</code> and carries on with the rest of the page.`; break;
        case 'streamShell': msg = `🌊 The <b>shell</b> is ready (${get('length')} characters): the page with a fallback for each of the ${get('waiting')} waiting boundar${get('waiting') === 1 ? 'y' : 'ies'}. It is sent right away, so the browser can show it before the data arrives.`; break;
        case 'streamChunk': msg = `🌊 The data for boundary ${get('id')} is ready: React renders its content and sends one more chunk: hidden HTML plus a tiny <code>$RC()</code> script that swaps it in place of the fallback.`; break;
        case 'streamEnd': msg = '🌊 Every boundary has been sent: the stream ends (<code>onAllReady</code>).'; break;
        case 'contextPropagated': msg = `🔦 React walks down from ${name} looking at every fiber's list of contexts it reads: <b>${get('readers')}</b> reader${get('readers') === 1 ? '' : 's'} found. Each one gets the update lane, and every parent on the way up gets <code>childLanes</code>, so the render reaches it even through a <code>memo</code> that bails out.`; break;
        case 'dehydrated': msg = `💧 ${name} was server-rendered. Instead of hydrating it with the rest of the page, React leaves it as plain server HTML (<b>dehydrated</b>) and moves on: the page outside it becomes interactive sooner.`; break;
        case 'hydrationScheduled': msg = `💧 After this commit, React schedules a separate, lower-priority render to hydrate ${name} on its own.`; break;
        case 'hydrateBoundary': msg = `💧 Now React hydrates only ${name}: it walks its server nodes and claims them for the new fibers.`; break;
        case 'boundaryHydrated': msg = `💧 ${name} is hydrated: its event handlers work now.`; break;
        case 'selectiveHydration': msg = `⚡ <b>Selective hydration</b>: the user ${get('type') === 'click' ? 'clicked' : 'interacted with'} ${name} before it was hydrated. React hydrates <b>this</b> boundary first, right now (Sync priority), then <b>replays</b> the ${esc(get('type'))} event on it.`; break;
        case 'resourceHint': msg = `🔗 <code>${esc(get('kind'))}</code> for <code>${esc(get('href'))}</code>: React adds the tag to <code>&lt;head&gt;</code> so the browser starts the work early.`; break;
        case 'resourceDeduped': msg = `🔗 <code>${esc(get('href'))}</code> was already requested: React does not add it twice.`; break;
        case 'stylesheetInserted': msg = `🎨 Stylesheet <code>${esc(get('href'))}</code> (precedence <b>${esc(get('precedence'))}</b>) goes into <code>&lt;head&gt;</code> with the other sheets of the same precedence. Order now: ${esc(this.iterable(get('order'), null).join(' → '))}.`; break;
        case 'stylesheetDeduped': msg = `🎨 <code>${esc(get('href'))}</code> is already in the head: React keeps one copy, however many components render it.`; break;
        case 'cacheMiss': msg = `🗃️ <code>cache</code>: <code>${esc(get('name'))}</code> was not called yet in this request, so it runs and the result is remembered.`; break;
        case 'cacheHit': msg = `🗃️ <code>cache</code>: <code>${esc(get('name'))}</code> already ran in this request: the remembered result is returned, nothing is fetched again.`; break;
        case 'staticStart': msg = '🏗️ <code>prerender</code> (react-dom/static) renders the page to HTML, like at build time, and will <b>wait</b> for every Suspense boundary.'; break;
        case 'staticWait': msg = `🏗️ Something suspended (try ${get('attempt')}): unlike <code>renderToString</code>, <code>prerender</code> waits for the data, then renders again.`; break;
        case 'staticEnd': msg = `🏗️ The static HTML is complete (${get('length')} characters): no fallbacks, all data included. It can be saved as a file and served to everyone.`; break;
        case 'formResetRequested': msg = '🧽 <code>requestFormReset(form)</code>: React will reset the form fields when the current action finishes.'; break;
        case 'formReset': msg = '🧽 The action is done: React resets the form fields (uncontrolled inputs go back to their default value).'; break;
        case 'rootErrorOption': msg =`📮 The error goes to the root option <code>${esc(get('option'))}</code> you passed to <code>${get('option') === 'onRecoverableError' ? 'hydrateRoot' : 'createRoot'}</code> (React 19), for example to send it to an error-tracking service.`; break;
        case 'prerenderScheduled': msg = `🌙 ${name} is hidden and its content was never rendered. After this commit React schedules a render at the <b>Offscreen</b> lane, the lowest priority, to prepare it in the background.`; break;
        case 'prerender': msg = `🌙 Offscreen-lane render: React now renders the hidden content of ${name}. Its DOM is created but stays hidden, and its effects do <b>not</b> run until it becomes visible.`; break;
        // ---- Server Components (Flight)
        case 'flightStart': msg = '🗄️ <b>Server</b>: React starts rendering the server component tree into the <b>RSC payload</b> (the Flight format): one row per piece, sent as text.'; break;
        case 'flightServerComponent': msg = `🗄️ Server component <code>${esc(get('name'))}</code> runs <b>on the server</b>. It may be <code>async</code> and read data directly; its code is never sent to the browser, only its output.`; break;
        case 'flightClientRef': msg = `🗄️ <code>${esc(get('name'))}</code> is a <b>client component</b> ("use client"): the server does not run it. It writes an import row (<code>I["${esc(get('name'))}"]</code>) and puts a reference (<code>$L…</code>) with its props in the tree.`; break;
        case 'flightServerRef': msg = `🗄️ <code>${esc(get('name'))}</code> is a <b>server function</b> ("use server"): only a reference (<code>$F…</code>) is sent. The browser can call it, which becomes a request to the server.`; break;
        case 'flightEnd': msg = `🗄️ The payload is ready: ${get('rows')} rows. Row 0 is the tree; the others are client components and server functions it refers to.`; break;
        case 'flightClient': msg = '🖥️ <b>Browser</b>: the payload is turned back into React elements. Each <code>$L</code> reference becomes the real client component from the bundle, then React renders as usual.'; break;
        case 'serverCall': msg = `📡 The browser calls the server function <code>${esc(get('name'))}</code>: the arguments are serialised and sent to the server, which runs the function and sends back the result.`; break;
        default: msg = `⚛️ ${esc(kind)}`;
      }
      rx.log.push({ kind, step: this.trace.length });
      this.record(node, msg, 'react');
    }

    // ======================================================== data for the "Inside" diagrams (one object per React step)
    actionText(v) {
      if (this.isCallable(v) && v.node) {
        const t = this.text(v.node).replace(/\s+/g, ' ');
        return t.length > 44 ? t.slice(0, 43) + '…' : t;
      }
      return this.quickText(v);
    }
    reactDetail(kind, get, fiber) {
      const rx = this.rx;
      const name = fiber ? this.fiberName(fiber) : '';
      const arr = v => (v instanceof JSObject && v.items ? v.items : []);
      const pathToRoot = f => { const out = []; for (let x = f, k = 0; x instanceof JSObject && k < 40; x = x.props.get('return'), k++) out.push(this.fiberName(x)); return out; };
      const lanesOf = root => (root instanceof JSObject ? root.props.get('pendingLanes') || 0 : 0);
      const id = fiber ? fiber.props.get('id') : null;
      switch (kind) {
        case 'setState': case 'classSetState': case 'forceUpdate': case 'eagerBailout':
          return { kind: 'update', sub: kind, comp: name, id, lane: this.toStr(get('lane') || ''), action: this.actionText(get('action') !== undefined ? get('action') : get('value')), path: pathToRoot(fiber) };
        case 'rootRender':
          return { kind: 'update', sub: kind, comp: 'Root', lane: this.toStr(get('lane') || ''), action: 'root.render(<App />)', path: ['Root'] };
        case 'scheduleSync': case 'scheduleTask': case 'transition':
          return { kind: 'schedule', sub: kind, lane: this.toStr(get('lane') || 'Transition'), pending: lanesOf(get('root')) };
        case 'processUpdates': {
          const steps = arr(get('steps')).map(s => ({ action: this.actionText(s.props.get('action')), lane: this.toStr(s.props.get('lane')), skipped: !!s.props.get('skipped'), after: this.quickText(s.props.get('after')) }));
          return { kind: 'queue', comp: name, id, hook: this.toStr(get('hook')), start: this.quickText(get('start')), steps };
        }
        case 'reconciled':
          return {
            kind: 'reconcile', parent: name, id,
            before: arr(get('before')).map(x => this.toStr(x)),
            after: arr(get('after')).map(x => ({ name: this.toStr(x.props.get('name')), op: this.toStr(x.props.get('op')) })),
            deleted: arr(get('deleted')).map(x => this.toStr(x)),
            diff: arr(get('diff')).map(x => { const g = k => x.props.get(k); return { name: this.toStr(g('name')), pass: this.toStr(g('pass')), oldIndex: g('oldIndex'), last: g('last'), newIndex: g('newIndex'), decision: this.toStr(g('decision')) }; }),
          };
        case 'diffProps': case 'createDOM':
          return { kind: 'complete', sub: kind, name, id, keys: arr(get('keys')).map(x => this.toStr(x)) };
        case 'commitStart':
          rx.mutations = []; rx.effects = [];
          return { kind: 'commit', list: [], sub: kind };
        case 'placement': case 'deletion': case 'commitUpdate': case 'commitText': case 'refAttached': case 'hideContent': case 'revealContent': case 'snapshot': case 'activityHide': case 'activityShow': case 'effectEventUpdated': case 'refCleanup': case 'hoisted': case 'profilerRender': {
          const what = { placement: 'insert', deletion: 'remove', commitUpdate: 'update props', commitText: 'update text', refAttached: 'attach ref', hideContent: 'hide (display:none)', revealContent: 'show again', snapshot: 'getSnapshotBeforeUpdate', activityHide: 'hide + clean up effects', activityShow: 'show + run effects again', effectEventUpdated: 'point useEffectEvent at the new callback', refCleanup: 'ref cleanup', hoisted: 'move into <head>', profilerRender: 'onRender (Profiler)' }[kind];
          const keys = arr(get('keys')).map(x => this.toStr(x)).filter(k => !/^on[A-Z]/.test(k));
          rx.mutations.push({ op: what, name: kind === 'hideContent' || kind === 'revealContent' ? 'content of ' + name : name, extra: kind === 'commitUpdate' ? (keys.join(', ') || 'only event handlers') : '' });
          return { kind: 'commit', sub: kind, list: rx.mutations.slice() };
        }
        case 'swap':
          return { kind: 'swap', mutations: rx.mutations.length };
        case 'schedulePassive': case 'commitEnd':
          return { kind: 'paint', sub: kind, effects: rx.effects.slice() };
        case 'effectRun': case 'effectCleanup': case 'classLifecycle': case 'strictEffects': case 'passiveStart': case 'passiveEnd': {
          if (kind === 'passiveStart') rx.effects = rx.effects.filter(e => e.layout);
          if (kind === 'effectRun' || kind === 'effectCleanup') rx.effects.push({ what: kind === 'effectRun' ? 'run' : 'cleanup', hook: get('insertion') ? 'useInsertionEffect' : get('layout') ? 'useLayoutEffect' : 'useEffect', name, layout: !!get('layout') || !!get('insertion'), unmount: !!get('unmount') });
          if (kind === 'classLifecycle') rx.effects.push({ what: 'run', hook: this.toStr(get('method')), name, layout: rx.phase === 'commit' });
          return { kind: 'effects', sub: kind, passive: rx.phase === 'passive' || kind === 'passiveStart', list: rx.effects.slice() };
        }
        case 'event':
          return { kind: 'event', type: this.toStr(get('type')), prop: this.toStr(get('prop') || ''), path: arr(get('path')).map(p => ({ name: this.toStr(p.props.get('name')), handler: !!p.props.get('handler'), capture: !!p.props.get('capture') })) };
        case 'suspend': case 'suspendedTransition': case 'caughtError': case 'uncaughtError': case 'showFallback': case 'showContent': case 'retry':
          return { kind: 'boundary', sub: kind, from: name, boundary: get('boundary') ? this.fiberName(get('boundary')) : '', path: pathToRoot(fiber), message: get('message') !== undefined ? this.toStr(get('message')) : '' };
        case 'contextPropagated':
          return { kind: 'context', provider: name, walk: arr(get('walk')).map(x => ({ name: this.toStr(x.props.get('name')), depth: x.props.get('depth') || 0, reads: !!x.props.get('reads') })) };
        case 'createRoot':
          return { kind: 'root' };
        case 'hydrateStart': case 'hydrateClaim': case 'hydrateEnd': case 'hydrationFailed': case 'ssrStart': case 'ssrEnd': case 'ssrFallback': case 'streamFallback': case 'streamShell': case 'streamChunk': case 'streamEnd': case 'flightStart': case 'flightServerComponent': case 'flightClientRef': case 'flightServerRef': case 'flightEnd': case 'flightClient': case 'serverCall': case 'dehydrated': case 'hydrationScheduled': case 'hydrateBoundary': case 'boundaryHydrated': case 'selectiveHydration': case 'resourceHint': case 'resourceDeduped': case 'stylesheetInserted': case 'stylesheetDeduped': case 'cacheHit': case 'cacheMiss': case 'staticStart': case 'staticWait': case 'staticEnd': case 'formResetRequested': case 'formReset':
          return { kind: 'server', sub: kind, name };
        default:
          return { kind: 'workloop', sub: kind, id, name, reason: get('reason') !== undefined ? this.toStr(get('reason')) : '' };
      }
    }

    // ======================================================== snapshot of React's state
    serReact() {
      const rx = this.rx;
      const fiberObj = (f, depth, seen) => {
        if (!(f instanceof JSObject) || depth > 30 || seen.size > 300 || seen.has(f)) return null;
        seen.add(f);
        const g = k => f.props.get(k);
        const tag = g('tag');
        const flags = g('flags') || 0;
        const props = g('memoizedProps') != null ? g('memoizedProps') : g('pendingProps');
        let propText = '';
        if (props instanceof JSObject && tag !== 6) {
          propText = this.ownKeys(props).filter(k => k !== 'children').slice(0, 4).map(k => {
            const v = props.props.get(k);
            return k + '=' + (this.isCallable(v) ? 'ƒ' : this.quickText(v));
          }).join(' ');
        }
        const node = {
          id: g('id'), tag, tagName: TAGS[tag] || String(tag), name: this.fiberName(f), key: g('key'),
          flags: FLAG_NAMES.filter(([bit]) => flags & bit).map(([, nm]) => nm), lanes: g('lanes') || 0, childLanes: g('childLanes') || 0,
          alt: g('alternate') instanceof JSObject ? g('alternate').props.get('id') : null, props: propText, hooks: null, kids: [],
          deletions: g('deletions') instanceof JSObject ? g('deletions').items.map(d => this.fiberName(d)) : null,
        };
        if (tag === 0 || tag === 14 || tag === 11) node.hooks = this.serHooks(g('memoizedState'));
        // useDebugValue labels, shown after the hook they follow (like React DevTools)
        const dbg = g('debugValues');
        if (node.hooks && dbg instanceof JSObject && dbg.items) dbg.items.slice().reverse().forEach(e => { const at = e.props.get('after') || 0; node.hooks.splice(Math.min(at, node.hooks.length), 0, { name: 'useDebugValue', value: this.quickText(e.props.get('value')), note: 'label for the custom hook (React DevTools)' }); });
        if (tag === 1) node.hooks = [{ name: 'this.state', value: this.quickText(g('memoizedState')), note: 'class state (one object, merged by setState)' }];
        for (let c = g('child'), k = 0; c instanceof JSObject && k < 60; c = c.props.get('sibling'), k++) {
          const kid = fiberObj(c, depth + 1, seen);
          if (kid) node.kids.push(kid);
        }
        return node;
      };
      const roots = rx.roots.map(r => {
        const current = r.props.get('current');
        const wip = rx.phase === 'render' && rx.wipRoot instanceof JSObject && rx.wipRoot.props.get('alternate') === current ? rx.wipRoot : null;
        return { current: fiberObj(current, 0, new Set()), wip: wip ? fiberObj(wip, 0, new Set()) : null, pendingLanes: r.props.get('pendingLanes') || 0 };
      });
      return { phase: rx.phase, lane: rx.lane, wip: rx.wip instanceof JSObject ? rx.wip.props.get('id') : null, worked: rx.worked.slice(), bailed: rx.bailed.slice(), completed: rx.completed.slice(), roots };
    }

    serHooks(first) {
      const out = [];
      for (let h = first, k = 0; h instanceof JSObject && k < 30; h = h.props.get('next'), k++) {
        const name = this.toStr(h.props.get('name'));
        const st = h.props.get('memoizedState');
        let value = '', note = '';
        if (name === 'useState' || name === 'useReducer') {
          value = this.quickText(st);
          const q = h.props.get('queue');
          const pending = q instanceof JSObject ? q.props.get('pending') : null;
          if (pending instanceof JSObject) { let n = 0, u = pending.props.get('next'); while (u instanceof JSObject && n < 20) { n++; if (u === pending) break; u = u.props.get('next'); } note = `${n} update${n === 1 ? '' : 's'} queued`; }
        } else if (name === 'useEffect' || name === 'useLayoutEffect') {
          const deps = st instanceof JSObject ? st.props.get('deps') : null;
          const tag = st instanceof JSObject ? st.props.get('tag') : 0;
          value = deps === null || deps === undefined ? 'no deps (runs every render)' : 'deps ' + this.quickText(deps);
          note = tag & 1 ? 'will run' : 'skipped';
        } else if (name === 'useRef') value = '{ current: ' + this.quickText(st instanceof JSObject ? st.props.get('current') : undefined) + ' }';
        else if (name === 'useMemo' || name === 'useCallback') {
          const arr = st instanceof JSObject ? st.items || [] : [];
          value = this.quickText(arr[0]);
          note = 'deps ' + this.quickText(arr[1]);
        } else value = this.quickText(st);
        out.push({ name, value, note });
      }
      return out;
    }
  });
})();
