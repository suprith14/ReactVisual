/*
 * ReactLite — a small React with the same architecture as the real one.
 * This function's source code is run INSIDE the JS Engine Lab interpreter, so every line of
 * React itself (beginWork, reconcileChildren, commitRoot, …) can be stepped through.
 * `trace(kind, info)` reports what React is doing to the visualizer.
 *
 *   Fibers          one object per component / DOM node, linked by child, sibling and return
 *   Double buffering current tree ↔ work-in-progress tree, swapped after each commit
 *   Work loop       performUnitOfWork → beginWork (render, reconcile) → completeWork (DOM)
 *   Reconciliation  keys and types decide what is reused, moved, created or deleted
 *   Hooks           a linked list on each fiber; updates queue on the hook
 *   Lanes           priorities: Sync (clicks), Default, Transition (time-sliced, interruptible)
 *   Commit          mutation (DOM) → swap trees → layout effects → passive effects (useEffect) later
 *   Events          one listener per event type on the root container (delegation)
 */
window.REACT_LITE = function ReactLite(trace) {
  // ---------------------------------------------------------------- element types
  const REACT_ELEMENT = Symbol.for('react.element');
  const REACT_FRAGMENT = Symbol.for('react.fragment');
  const REACT_PROVIDER = Symbol.for('react.provider');
  const REACT_MEMO = Symbol.for('react.memo');
  const REACT_CONTEXT = Symbol.for('react.context');
  const REACT_PROFILER = Symbol.for('react.profiler');
  const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel'); // React Compiler: "not computed yet"
  const REACT_CONSUMER = Symbol.for('react.consumer');
  const REACT_FORWARD_REF = Symbol.for('react.forward_ref');
  const REACT_LAZY = Symbol.for('react.lazy');
  const REACT_SUSPENSE = Symbol.for('react.suspense');
  const REACT_STRICT_MODE = Symbol.for('react.strict_mode');
  const REACT_PORTAL = Symbol.for('react.portal');
  const REACT_OFFSCREEN = Symbol.for('react.offscreen');
  const REACT_ACTIVITY = Symbol.for('react.activity'); // <Activity mode="hidden">: an Offscreen fiber you control (React 19.2)

  // fiber tags (same numbers as React)
  const FunctionComponent = 0, ClassComponent = 1, HostRoot = 3, HostPortal = 4, HostComponent = 5, HostText = 6, Fragment = 7,
    Mode = 8, ContextConsumer = 9, ContextProvider = 10, ForwardRef = 11, Profiler = 12, SuspenseComponent = 13, MemoComponent = 14, LazyComponent = 16, OffscreenComponent = 22;
  // flags (same bits as React)
  const NoFlags = 0, Placement = 2, Update = 4, ChildDeletion = 16, DidCapture = 128, Ref = 512, Snapshot = 1024, Passive = 2048, Visibility = 8192;
  // lanes: a lower bit means a higher priority
  const NoLanes = 0, SyncLane = 1, DefaultLane = 16, TransitionLane = 64;
  const OffscreenLane = 1 << 29; // the lowest priority: pre-rendering hidden <Activity> content (same bit as React)
  // hook effect tags
  const HookHasEffect = 1, HookInsertion = 2, HookLayout = 4, HookPassive = 8;
  // fiber modes
  const StrictModeBit = 8;
  // function-like fibers: their hooks and effects live on the fiber
  const isFnFiber = f => f.tag === FunctionComponent || f.tag === ForwardRef || f.tag === MemoComponent;
  // execution contexts
  const BatchedContext = 1, RenderContext = 2, CommitContext = 4;

  function createElement(type, config, ...children) {
    const props = {};
    let key = null, ref = null;
    if (config != null) {
      for (const name in config) {
        if (name === 'key') key = config.key == null ? null : String(config.key);
        else if (name === 'ref') { ref = config.ref; if (ref != null && refIsProp(type)) props.ref = ref; } // React 19: ref is a prop of function components
        else props[name] = config[name];
      }
    }
    if (children.length === 1) props.children = children[0];
    else if (children.length > 1) { props.children = children; staticChildren.add(children); } // written out in JSX: no keys needed
    if (type && type.defaultProps) for (const k in type.defaultProps) if (props[k] === undefined) props[k] = type.defaultProps[k];
    return { $$typeof: REACT_ELEMENT, type, key, ref, props };
  }
  const staticChildren = new WeakSet();
  const isClass = t => typeof t === 'function' && !!(t.prototype && t.prototype.isReactComponent);
  // React 19: a function component (or memo of one) gets ref as a normal prop; classes and forwardRef get it separately
  const refIsProp = t => (typeof t === 'function' && !isClass(t)) || (!!t && t.$$typeof === REACT_MEMO && typeof t.type === 'function' && !isClass(t.type));
  const isValidElement = x => x !== null && typeof x === 'object' && x.$$typeof === REACT_ELEMENT;

  function cloneElement(element, config, ...children) {
    const props = Object.assign({}, element.props);
    let key = element.key, ref = element.ref;
    if (config != null) for (const name in config) {
      if (name === 'key') key = String(config.key);
      else if (name === 'ref') { ref = config.ref; if (ref != null && refIsProp(element.type)) props.ref = ref; else delete props.ref; }
      else props[name] = config[name];
    }
    if (children.length === 1) props.children = children[0];
    else if (children.length > 1) props.children = children;
    return { $$typeof: REACT_ELEMENT, type: element.type, key, ref, props };
  }

  // React.Children: flattens arrays, skips null / booleans, and gives each child a key like ".0" or ".$id"
  function flattenChildren(children, out, prefix) {
    if (children === null || children === undefined || typeof children === 'boolean') return out;
    if (Array.isArray(children)) { children.forEach((c, i) => flattenChildren(c, out, prefix + (isValidElement(c) && c.key !== null ? '$' + c.key : i) + ':')); return out; }
    out.push(children);
    return out;
  }
  const Children = {
    map(children, fn) {
      return flattenChildren(children, [], '').map((c, i) => {
        const r = fn(c, i);
        return isValidElement(r) ? cloneElement(r, { key: '.' + (isValidElement(c) && c.key !== null ? '$' + c.key : i) + (r.key !== null && r.key !== c.key ? '/' + r.key : '') }) : r;
      });
    },
    forEach(children, fn) { flattenChildren(children, [], '').forEach((c, i) => fn(c, i)); },
    count(children) { return flattenChildren(children, [], '').length; },
    toArray(children) { return flattenChildren(children, [], '').map((c, i) => (isValidElement(c) ? cloneElement(c, { key: '.' + (c.key !== null ? '$' + c.key : i) }) : c)); },
    only(children) { if (!isValidElement(children)) throw new Error('React.Children.only expected to receive a single React element child.'); return children; },
  };

  // ---------------------------------------------------------------- fibers
  let fiberSeq = 0;
  function createFiber(tag, pendingProps, key) {
    return {
      id: ++fiberSeq, tag, key, type: null, elementType: null, stateNode: null,
      return: null, child: null, sibling: null, index: 0, ref: null,
      pendingProps, memoizedProps: null, memoizedState: null, updateQueue: null, dependencies: null,
      flags: NoFlags, subtreeFlags: NoFlags, deletions: null, lanes: NoLanes, childLanes: NoLanes, alternate: null, mode: 0,
    };
  }

  // double buffering: reuse the fiber's alternate (the copy from two renders ago) if there is one
  function createWorkInProgress(current, pendingProps) {
    let wip = current.alternate;
    if (wip === null) {
      wip = createFiber(current.tag, pendingProps, current.key);
      wip.elementType = current.elementType;
      wip.type = current.type;
      wip.stateNode = current.stateNode;
      if (current.isActivity) wip.isActivity = true; // an <Activity> boundary (for the visualizer's names)
      wip.alternate = current;
      current.alternate = wip;
    } else {
      wip.pendingProps = pendingProps;
      wip.flags = NoFlags;
      wip.subtreeFlags = NoFlags;
      wip.deletions = null;
    }
    wip.lanes = current.lanes;
    wip.childLanes = current.childLanes;
    wip.child = current.child;
    wip.memoizedProps = current.memoizedProps;
    wip.memoizedState = current.memoizedState;
    wip.updateQueue = current.updateQueue;
    wip.dependencies = current.dependencies;
    wip.sibling = current.sibling;
    wip.index = current.index;
    wip.ref = current.ref;
    return wip;
  }

  function createFiberFromElement(element) {
    const type = element.type;
    let fiber;
    if (type === REACT_FRAGMENT) fiber = createFiber(Fragment, element.props.children, element.key);
    else fiber = createFiber(tagForType(type), element.props, element.key);
    fiber.elementType = type;
    fiber.type = type;
    fiber.ref = element.ref;
    if (type === REACT_ACTIVITY) fiber.isActivity = true;
    return fiber;
  }
  function tagForType(type) {
    if (typeof type === 'string') return HostComponent;
    if (typeof type === 'function') return type.prototype && type.prototype.isReactComponent ? ClassComponent : FunctionComponent;
    if (type === REACT_STRICT_MODE) return Mode;
    if (type === REACT_PROFILER) return Profiler;
    if (type && type.$$typeof === REACT_CONTEXT) return ContextProvider; // React 19: <ThemeContext value=…> is the provider
    if (type === REACT_SUSPENSE) return SuspenseComponent;
    if (type === REACT_OFFSCREEN || type === REACT_ACTIVITY) return OffscreenComponent;
    if (type && type.$$typeof === REACT_PROVIDER) return ContextProvider;
    if (type && type.$$typeof === REACT_CONSUMER) return ContextConsumer;
    if (type && type.$$typeof === REACT_MEMO) return MemoComponent;
    if (type && type.$$typeof === REACT_FORWARD_REF) return ForwardRef;
    if (type && type.$$typeof === REACT_LAZY) return LazyComponent;
    throw new Error('Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: ' + (type === null ? 'null' : typeof type) + '.');
  }
  function createFiberFromPortal(portal) {
    const fiber = createFiber(HostPortal, portal.children !== undefined ? portal.children : null, portal.key);
    fiber.stateNode = { containerInfo: portal.containerInfo };
    return fiber;
  }

  // ---------------------------------------------------------------- module state of the reconciler
  let executionContext = 0;
  let workInProgressRoot = null;
  let workInProgress = null;
  let workInProgressRootRenderLanes = NoLanes;
  let currentEventLane = NoLanes;
  let isInsideTransition = false;
  let sliceUnits = 0;
  let sliceNumber = 0; // which time slice of the current concurrent render (for the visualizer)
  let isConcurrentRender = false;
  let pendingPassiveRoot = null;
  let pendingPassiveUnmounts = [];
  const SLICE_SIZE = 3; // fibers per time slice (real React: about 5 ms)

  const getHighestPriorityLane = lanes => lanes & -lanes;
  const includesSomeLane = (a, b) => (a & b) !== NoLanes;
  const laneName = lane => (lane === SyncLane ? 'Sync' : lane === DefaultLane ? 'Default' : lane === TransitionLane ? 'Transition' : lane === OffscreenLane ? 'Offscreen' : String(lane));

  function requestUpdateLane() {
    if (isInsideTransition) return TransitionLane;
    if (executionContext & CommitContext) return SyncLane; // setState in componentDidMount / useLayoutEffect: before the browser paints
    if (currentEventLane !== NoLanes) return currentEventLane;
    return DefaultLane;
  }

  // ---------------------------------------------------------------- roots
  function createRoot(container, options) {
    const root = { tag: 'FiberRoot', containerInfo: container, current: null, finishedWork: null, pendingLanes: NoLanes, callbackLane: NoLanes, options: options || {} }; // React 19: onCaughtError, onUncaughtError, onRecoverableError
    const hostRoot = createFiber(HostRoot, null, null);
    hostRoot.stateNode = root;
    hostRoot.memoizedState = { element: null };
    hostRoot.updateQueue = { pending: null };
    root.current = hostRoot;
    listenToAllSupportedEvents(container);
    trace('createRoot', { root, fiber: hostRoot });
    return {
      render(children) { updateContainer(children, root); },
      unmount() { updateContainer(null, root); },
      _internalRoot: root,
    };
  }

  function updateContainer(element, root) {
    const fiber = root.current;
    const lane = requestUpdateLane();
    enqueueUpdate(fiber.updateQueue, { lane, action: { element }, next: null });
    trace('rootRender', { root, fiber, lane: laneName(lane) });
    scheduleUpdateOnFiber(root, fiber, lane);
  }

  function enqueueUpdate(queue, update) {
    const pending = queue.pending;
    if (pending === null) update.next = update; // a circular list with one update
    else { update.next = pending.next; pending.next = update; }
    queue.pending = update;
  }

  // ---------------------------------------------------------------- scheduling
  function markUpdateLaneFromFiberToRoot(fiber, lane) {
    fiber.lanes |= lane;
    if (fiber.alternate !== null) fiber.alternate.lanes |= lane;
    let node = fiber, parent = fiber.return;
    while (parent !== null) {
      parent.childLanes |= lane;
      if (parent.alternate !== null) parent.alternate.childLanes |= lane;
      node = parent;
      parent = parent.return;
    }
    return node.tag === HostRoot ? node.stateNode : null;
  }

  function scheduleUpdateOnFiber(root, fiber, lane) {
    markUpdateLaneFromFiberToRoot(fiber, lane);
    root.pendingLanes |= lane;
    ensureRootIsScheduled(root);
  }

  function ensureRootIsScheduled(root) {
    const lane = getHighestPriorityLane(root.pendingLanes);
    if (lane === NoLanes) return;
    if (root.callbackLane !== NoLanes && root.callbackLane <= lane) return; // already scheduled at this priority or higher
    root.callbackLane = lane;
    if (lane === SyncLane) {
      trace('scheduleSync', { root, lane: 'Sync' });
      queueMicrotask(() => performWorkOnRoot(root, true));
    } else {
      trace('scheduleTask', { root, lane: laneName(lane) });
      setTimeout(() => performWorkOnRoot(root, false), 0);
    }
  }

  function performWorkOnRoot(root, isSync) {
    flushPassiveEffects();
    root.callbackLane = NoLanes;
    const lanes = getHighestPriorityLane(root.pendingLanes);
    if (lanes === NoLanes) return;
    if (isSync && lanes !== SyncLane) return;
    if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
      if (workInProgress !== null) {
        trace('interrupt', { root, lane: laneName(lanes), from: laneName(workInProgressRootRenderLanes), slices: sliceNumber, fiber: workInProgress });
        unwindTo(workInProgress, null); // the paused render had entered some context providers
        changedContexts = [];
      }
      prepareFreshStack(root, lanes);
    } else trace('resume', { root, lane: laneName(lanes), slices: sliceNumber });
    executionContext |= RenderContext;
    const timeSliced = lanes === TransitionLane;
    isConcurrentRender = timeSliced;
    try { if (timeSliced) workLoopConcurrent(); else workLoopSync(); }
    finally { executionContext &= ~RenderContext; }
    if (renderAbandoned) { renderAbandoned = false; return; } // a transition suspended: keep showing the old UI
    if (workInProgress !== null) {
      // the time slice ran out: give the browser a turn, then continue where we stopped
      trace('yield', { root, fiber: workInProgress, lane: laneName(lanes), slices: sliceNumber, used: sliceUnits - 1, size: SLICE_SIZE });
      root.callbackLane = lanes;
      // (1ms later: in a real browser each slice takes ~5ms, so time passes and input can arrive in between)
      setTimeout(() => { root.callbackLane = NoLanes; performWorkOnRoot(root, false); }, 1);
      return;
    }
    if (isHydrating) {
      // the server sent more nodes than the client rendered: that is a mismatch too
      if (nextHydratable !== null) { failHydration(root, 'extra', nextHydratable); return; }
      isHydrating = false;
      root.hydrate = false;
      trace('hydrateEnd', { root });
    }
    const finishedWork = root.current.alternate;
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;
    root.finishedWork = finishedWork;
    root.pendingLanes &= ~lanes;
    commitRoot(root, lanes);
    ensureRootIsScheduled(root);
  }

  function prepareFreshStack(root, lanes) {
    workInProgressRoot = root;
    workInProgress = createWorkInProgress(root.current, null);
    workInProgressRootRenderLanes = lanes;
    sliceNumber = 0;
    capturedThisRender = [];
    pendingPrerender = [];
    pendingDehydrated = [];
    queueCommits = [];
    isHydrating = !!root.hydrate;
    if (isHydrating) { nextHydratable = firstHydratable(root.containerInfo.firstChild); trace("hydrateStart", { root }); }
    trace('renderStart', { root, fiber: workInProgress, lane: laneName(lanes) });
  }

  // a component can throw during render: an Error (→ error boundary) or a Promise (→ Suspense)
  function workLoopSync() {
    while (workInProgress !== null) {
      try { performUnitOfWork(workInProgress); } catch (thrown) { handleThrow(thrown); }
    }
  }

  function workLoopConcurrent() {
    sliceUnits = 0;
    sliceNumber++;
    while (workInProgress !== null && !shouldYield()) {
      try { performUnitOfWork(workInProgress); } catch (thrown) { handleThrow(thrown); }
    }
  }

  // ---------------------------------------------------------------- throwing during render: errors and Suspense
  let capturedThisRender = [];
  let renderAbandoned = false;
  const isThenable = x => x !== null && (typeof x === 'object' || typeof x === 'function') && typeof x.then === 'function';
  const componentName = f => (typeof f.type === 'string' ? f.type : typeof f.type === 'function' ? f.type.name || 'Anonymous'
    : f.type && f.type.$$typeof === REACT_MEMO ? 'Memo' : f.type && f.type.$$typeof === REACT_FORWARD_REF ? 'ForwardRef' : f.tag === SuspenseComponent ? 'Suspense' : f.tag === HostRoot ? 'Root' : null);
  function componentStack(fiber) {
    const out = [];
    for (let f = fiber; f !== null; f = f.return) { const n = componentName(f); if (n && f.tag !== HostRoot) out.push('    in ' + n); }
    return '\n' + out.join('\n');
  }
  function rootOf(fiber) { let f = fiber; while (f.return !== null) f = f.return; return f.stateNode; }

  // undo what the fibers between the thrower and the boundary did on their way down (context values)
  function unwindTo(fiber, boundary) {
    for (let f = fiber; f !== null && f !== boundary; f = f.return) {
      if (f.tag === ContextProvider && f !== fiber) {
        const context = f.type._context;
        context._currentValue = providerStack.pop();
        changedContexts = changedContexts.filter(c => c !== context);
      }
    }
  }
  function abandonRender() {
    if (workInProgress !== null) unwindTo(workInProgress, null);
    workInProgress = null;
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;
    renderAbandoned = true;
    changedContexts = [];
    queueCommits = []; // nothing was consumed: every update is still in its base queue
  }
  // the boundary renders again from scratch: forget what its first attempt decided (deleted children, built children)
  function resetForRetry(boundary) {
    boundary.deletions = null;
    boundary.flags &= ~ChildDeletion;
    boundary.subtreeFlags = NoFlags;
    boundary.child = boundary.alternate !== null ? boundary.alternate.child : null;
  }
  // updates read by fibers inside a boundary that is being re-rendered do not count: they will be read again
  function forgetQueuesInside(boundary) {
    queueCommits = queueCommits.filter(e => { for (let f = e.fiber; f !== null; f = f.return) if (f === boundary) return false; return true; });
  }

  function handleThrow(thrown) {
    const thrower = workInProgress;
    const root = workInProgressRoot;
    if (thrown === HYDRATION_MISMATCH) { failHydration(root); return; }
    if (isThenable(thrown)) {
      let boundary = null;
      for (let f = thrower; f !== null; f = f.return) if (f.tag === SuspenseComponent && !capturedThisRender.includes(f)) { boundary = f; break; }
      if (boundary === null) {
        abandonRender(); renderAbandoned = false;
        throw new Error('A component suspended while rendering, but no fallback UI was specified. Add a <Suspense fallback=...> component higher in the tree.');
      }
      const lanes = workInProgressRootRenderLanes;
      const showingContent = boundary.alternate !== null && boundary.alternate.memoizedState === null;
      if (lanes === TransitionLane && showingContent) {
        // in a transition React keeps the old UI on screen instead of showing a fallback, and tries again later
        trace('suspendedTransition', { fiber: thrower, boundary });
        thrown.then(() => { trace('retry', { fiber: boundary }); scheduleUpdateOnFiber(root, boundary, TransitionLane); }, () => scheduleUpdateOnFiber(root, boundary, TransitionLane));
        abandonRender();
        return;
      }
      trace('suspend', { fiber: thrower, boundary });
      thrown.then(() => { trace('retry', { fiber: boundary }); scheduleUpdateOnFiber(rootOf(boundary), boundary, DefaultLane); }, () => scheduleUpdateOnFiber(rootOf(boundary), boundary, DefaultLane));
      capturedThisRender.push(boundary);
      boundary.flags |= DidCapture;
      unwindTo(thrower, boundary);
      resetForRetry(boundary);
      forgetQueuesInside(boundary);
      workInProgress = boundary;
      return;
    }
    // an error: find the closest class component above with getDerivedStateFromError / componentDidCatch
    let boundary = null;
    for (let f = thrower.return; f !== null; f = f.return) {
      if (f.tag === ClassComponent && (f.type.getDerivedStateFromError || (f.stateNode && f.stateNode.componentDidCatch)) && !capturedThisRender.includes(f)) { boundary = f; break; }
    }
    if (boundary === null) {
      // nobody caught it: React 18 removes the whole app from the page and reports the error
      trace('uncaughtError', { fiber: thrower, message: String(thrown && thrown.message) });
      abandonRender(); renderAbandoned = false;
      root.pendingLanes = NoLanes;
      updateContainer(null, root);
      // React 19: createRoot(el, { onUncaughtError }) receives it instead of it being thrown to the page
      if (root.options.onUncaughtError) { trace('rootErrorOption', { option: 'onUncaughtError' }); root.options.onUncaughtError(thrown, { componentStack: componentStack(thrower) }); renderAbandoned = true; return; }
      throw thrown;
    }
    trace('caughtError', { fiber: thrower, boundary, message: String(thrown && thrown.message) });
    capturedThisRender.push(boundary);
    boundary.flags |= DidCapture;
    boundary.capturedError = { value: thrown, componentStack: componentStack(thrower) };
    unwindTo(thrower, boundary);
    resetForRetry(boundary);
    forgetQueuesInside(boundary);
    workInProgress = boundary;
  }

  function shouldYield() { return sliceUnits++ >= SLICE_SIZE; }

  function performUnitOfWork(unitOfWork) {
    const current = unitOfWork.alternate;
    const next = beginWork(current, unitOfWork, workInProgressRootRenderLanes);
    unitOfWork.memoizedProps = unitOfWork.pendingProps;
    if (next === null) completeUnitOfWork(unitOfWork);
    else workInProgress = next;
  }

  function completeUnitOfWork(unitOfWork) {
    let completed = unitOfWork;
    do {
      completeWork(completed.alternate, completed);
      trace('completed', { fiber: completed }); // not a step: lets the visualizer number the work loop
      const sibling = completed.sibling;
      if (sibling !== null) { workInProgress = sibling; return; }
      completed = completed.return;
      workInProgress = completed;
    } while (completed !== null);
  }

  // ---------------------------------------------------------------- render phase: beginWork
  let didReceiveUpdate = false;

  function beginWork(current, wip, renderLanes) {
    wip.mode = (wip.return !== null ? wip.return.mode : 0) | (wip.tag === Mode && wip.type === REACT_STRICT_MODE ? StrictModeBit : 0);
    // the lane check below, for the visualizer: these bits decide skip / clone / render
    if (wip.tag === Profiler) wip.profiled = 0;
    const bits = { lanes: wip.lanes, childLanes: wip.childLanes, renderLanes, slice: isConcurrentRender ? sliceUnits : 0, slices: isConcurrentRender ? sliceNumber : 0, size: SLICE_SIZE, sameProps: current !== null && current.memoizedProps === wip.pendingProps };
    if (current !== null) {
      const oldProps = current.memoizedProps, newProps = wip.pendingProps;
      if (oldProps === newProps && !includesSomeLane(wip.lanes, renderLanes) && !hasContextChanged(wip) && !(wip.flags & DidCapture)) {
        // a provider still has to provide its value to the subtree (completeWork pops it again)
        if (wip.tag === ContextProvider) { providerStack.push(wip.type._context._currentValue); wip.type._context._currentValue = wip.memoizedProps.value; }
        if (!includesSomeLane(wip.childLanes, renderLanes)) {
          trace('bailoutSubtree', { fiber: wip, bits });
          return null; // nothing below needs work: skip the whole subtree
        }
        trace('bailout', { fiber: wip, bits });
        cloneChildFibers(current, wip);
        return wip.child;
      }
      didReceiveUpdate = oldProps !== newProps;
    } else didReceiveUpdate = false;
    const reason = current === null ? 'mount' : includesSomeLane(wip.lanes, renderLanes) ? 'state' : hasContextChanged(wip) ? 'context' : 'props';
    wip.lanes = NoLanes;
    // <Profiler>: count each component that really renders inside it (ReactLite's stand-in for "actualDuration")
    if (wip.tag === FunctionComponent || wip.tag === ClassComponent || wip.tag === ForwardRef) countProfiled(wip);
    trace('beginWork', { fiber: wip, bits, reason: wip.flags & DidCapture ? (wip.tag === SuspenseComponent ? 'suspended' : 'caught') : reason });
    return beginWorkByTag(current, wip, renderLanes);
  }
  function beginWorkByTag(current, wip, renderLanes) {
    switch (wip.tag) {
      case FunctionComponent: return updateFunctionComponent(current, wip, wip.type, wip.pendingProps, renderLanes);
      case ClassComponent: return updateClassComponent(current, wip, renderLanes);
      case ForwardRef: return updateFunctionComponent(current, wip, props => wip.type.render(props, wip.ref), wip.pendingProps, renderLanes);
      case MemoComponent: return updateMemoComponent(current, wip, renderLanes);
      case LazyComponent: {
        const Component = resolveLazy(wip.elementType); // throws a promise while the code is still loading
        wip.type = Component;
        wip.tag = tagForType(Component);
        trace('lazyResolved', { fiber: wip });
        return beginWorkByTag(current, wip, renderLanes);
      }
      case HostRoot: return updateHostRoot(current, wip, renderLanes);
      case HostPortal: {
        // a portal's children are inserted at commit (not appended during render), so their insertions are tracked even on mount
        const ops = [];
        wip.child = reconcileChildFibers(true, ops, wip, current !== null ? current.child : null, wip.pendingProps);
        return wip.child;
      }
      case HostComponent:
        if (isHydrating && current === null) claimHydratable(wip);
        reconcileChildren(current, wip, wip.pendingProps.children);
        return wip.child;
      case HostText:
        if (isHydrating && current === null) claimHydratable(wip);
        return null;
      case Fragment: reconcileChildren(current, wip, wip.pendingProps); return wip.child;
      case Mode: reconcileChildren(current, wip, wip.pendingProps.children); return wip.child;
      case Profiler: wip.profiled = 0; reconcileChildren(current, wip, wip.pendingProps.children); return wip.child;
      case ContextProvider: return updateContextProvider(current, wip, renderLanes);
      case ContextConsumer: {
        const context = wip.type._context;
        wip.dependencies = [context];
        const render = wip.pendingProps.children;
        reconcileChildren(current, wip, render(context._currentValue));
        return wip.child;
      }
      case SuspenseComponent: return updateSuspenseComponent(current, wip);
      case OffscreenComponent: return updateOffscreenComponent(current, wip, renderLanes);
      default: throw new Error('Unknown fiber tag ' + wip.tag);
    }
  }

  // ---------------------------------------------------------------- Suspense, Offscreen, lazy, use()
  // ---- selective hydration: a server-rendered Suspense boundary (<!--$-->…<!--/$-->) is NOT hydrated with the rest
  // of the page. It stays "dehydrated" (plain server HTML) and is hydrated later on its own, or right away if the user
  // interacts with it first.
  let pendingDehydrated = [];
  function dehydrateBoundary(wip) {
    const first = nextHydratable;
    const start = first && first.previousSibling;
    if (!start || start.nodeType !== 8 || start.nodeValue !== '$') return false;
    let end = start.nextSibling;
    const nodes = [];
    while (end && !(end.nodeType === 8 && end.nodeValue === '/$')) { nodes.push(end); end = end.nextSibling; }
    if (!end) return false;
    nodes.forEach(n => { n.__dehydratedBoundary = wip; });
    wip.memoizedState = { dehydrated: { first } };
    wip.child = null;
    pendingDehydrated.push(wip);
    nextHydratable = firstHydratable(end.nextSibling); // the rest of the page goes on after the boundary
    trace('dehydrated', { fiber: wip });
    return true;
  }
  function hydrateBoundary(current, wip) {
    // now hydrate just this boundary's content, starting at its first server node
    isHydrating = true;
    nextHydratable = current.memoizedState.dehydrated.first;
    wip.hydratingBoundary = true;
    wip.memoizedState = null;
    trace('hydrateBoundary', { fiber: wip });
    const props = wip.pendingProps;
    const primary = { $$typeof: REACT_ELEMENT, type: REACT_OFFSCREEN, key: null, ref: null, props: { mode: 'visible', children: props.children } };
    const kids = [primary, null];
    staticChildren.add(kids);
    wip.child = reconcileChildFibers(false, [], wip, null, kids); // mount: adopt the server DOM, no insertions
    return wip.child;
  }
  function updateSuspenseComponent(current, wip) {
    if (current === null && isHydrating && dehydrateBoundary(wip)) return null;
    if (current !== null && current.memoizedState && current.memoizedState.dehydrated) return hydrateBoundary(current, wip);
    const showFallback = (wip.flags & DidCapture) !== 0;
    wip.flags &= ~DidCapture;
    const props = wip.pendingProps;
    // the content always sits in an Offscreen fiber, so it can be hidden (keeping its state) while the fallback shows
    const primary = { $$typeof: REACT_ELEMENT, type: REACT_OFFSCREEN, key: null, ref: null, props: { mode: showFallback ? 'hidden' : 'visible', children: props.children } };
    const fallback = showFallback ? { $$typeof: REACT_ELEMENT, type: REACT_FRAGMENT, key: 'fallback', ref: null, props: { children: props.fallback } } : null;
    wip.memoizedState = showFallback ? { showingFallback: true } : null;
    if (showFallback) trace('showFallback', { fiber: wip });
    else if (current !== null && current.memoizedState !== null) trace('showContent', { fiber: wip });
    const kids = [primary, fallback];
    staticChildren.add(kids);
    reconcileChildren(current, wip, kids);
    return wip.child;
  }
  // <Activity mode="hidden"> content that was never rendered is pre-rendered later, at the lowest priority
  let pendingPrerender = [];
  function updateOffscreenComponent(current, wip, renderLanes) {
    if (wip.pendingProps.mode === 'hidden') {
      if (wip.isActivity && includesSomeLane(renderLanes, OffscreenLane)) {
        // the Offscreen-lane render: build the hidden content now (DOM stays hidden, effects don't run)
        trace('prerender', { fiber: wip });
        wip.prerendered = true;
        reconcileChildren(current, wip, wip.pendingProps.children);
        return wip.child;
      }
      // hidden content is not rendered again: React keeps the old fibers (and their state) as they are
      if (current === null) { wip.child = null; if (wip.isActivity) pendingPrerender.push(wip); }
      return null;
    }
    reconcileChildren(current, wip, wip.pendingProps.children);
    return wip.child;
  }
  function lazy(load) { return { $$typeof: REACT_LAZY, _payload: { status: -1, result: load } }; }
  function resolveLazy(lazyType) {
    const p = lazyType._payload;
    if (p.status === 1) return p.result;
    if (p.status === 2) throw p.result;
    if (p.status === -1) {
      const thenable = p.result();
      p.status = 0;
      p.result = thenable;
      thenable.then(m => { p.status = 1; p.result = m && m.default !== undefined ? m.default : m; }, e => { p.status = 2; p.result = e; });
    }
    throw p.result; // still loading: the nearest Suspense shows its fallback
  }
  // use(promise) reads a promise's value (suspending until it is ready); use(context) reads a context
  function use(usable) {
    if (isThenable(usable)) {
      if (usable.status === 'fulfilled') return usable.value;
      if (usable.status === 'rejected') throw usable.reason;
      if (usable.status !== 'pending') {
        usable.status = 'pending';
        usable.then(v => { usable.status = 'fulfilled'; usable.value = v; }, e => { usable.status = 'rejected'; usable.reason = e; });
      }
      throw usable;
    }
    if (usable && usable.$$typeof === REACT_CONTEXT) { resolveFiber('use'); return readContext(usable); }
    throw new Error('An unsupported type was passed to use(): ' + String(usable));
  }

  // ---------------------------------------------------------------- class components
  const classUpdater = {
    enqueue(instance, payload, callback, force) {
      const fiber = instance._reactInternals;
      if (!fiber) throw new Error('setState() was called on a component that is not mounted yet. Use this.state = … in the constructor.');
      const lane = requestUpdateLane();
      enqueueUpdate(fiber.updateQueue, { lane, payload, callback: callback || null, force: !!force, next: null });
      trace(force ? 'forceUpdate' : 'classSetState', { fiber, lane: laneName(lane) });
      scheduleUpdateOnFiber(rootOf(fiber), fiber, lane);
    },
  };
  class Component {
    constructor(props, context) { this.props = props; this.context = context; this.state = null; this.refs = {}; }
    setState(partial, callback) {
      if (partial !== null && typeof partial !== 'object' && typeof partial !== 'function') throw new Error('setState(...): takes an object of state variables to update or a function which returns an object of state variables.');
      classUpdater.enqueue(this, partial, callback, false);
    }
    forceUpdate(callback) { classUpdater.enqueue(this, null, callback, true); }
  }
  Component.prototype.isReactComponent = {};
  class PureComponent extends Component {}
  PureComponent.prototype.isPureReactComponent = true;

  function callRender(wip, instance) {
    if (wip.mode & StrictModeBit) { trace('strictRender', { fiber: wip }); instance.render(); } // StrictMode: render twice to find impure code
    const children = instance.render();
    trace('rendered', { fiber: wip });
    return children;
  }

  function updateClassComponent(current, wip, renderLanes) {
    const Ctor = wip.type, props = wip.pendingProps;
    const contextFor = () => { if (!Ctor.contextType) return undefined; if (wip.dependencies === null) wip.dependencies = []; if (!wip.dependencies.includes(Ctor.contextType)) wip.dependencies.push(Ctor.contextType); return Ctor.contextType._currentValue; };
    let instance = wip.stateNode, shouldUpdate = true, nextState;
    const captured = (wip.flags & DidCapture) !== 0;
    wip.flags &= ~DidCapture;
    if (instance === null) {
      // mount: create the instance with `new`, like class components always are
      wip.dependencies = null;
      instance = new Ctor(props, contextFor());
      instance.props = props;
      instance.context = contextFor();
      instance._reactInternals = wip;
      wip.stateNode = instance;
      wip.updateQueue = { pending: null };
      nextState = instance.state === undefined ? null : instance.state;
      if (Ctor.getDerivedStateFromProps) { const part = Ctor.getDerivedStateFromProps(props, nextState); if (part != null) nextState = Object.assign({}, nextState, part); }
      trace('classMount', { fiber: wip });
      if (instance.componentDidMount) wip.flags |= Update;
    } else if (current === null) {
      // the first render of this boundary is being retried after a child threw
      nextState = wip.memoizedState;
      if (instance.componentDidMount) wip.flags |= Update;
    } else {
      instance._reactInternals = wip;
      const oldProps = current.memoizedProps, oldState = current.memoizedState;
      nextState = oldState;
      let forced = false;
      const queue = wip.updateQueue;
      const callbacks = [];
      const r = processUpdateQueue(wip, queue, oldState, renderLanes, (s, u) => {
        if (u.callback) callbacks.push(u.callback);
        if (u.force) { forced = true; return s; }
        const part = typeof u.payload === 'function' ? u.payload.call(instance, s, props) : u.payload;
        return part != null ? Object.assign({}, s, part) : s; // setState MERGES into the old state
      });
      if (r !== null) {
        nextState = r.state;
        wip.lanes |= r.lanes;
        trace('processUpdates', { fiber: wip, hook: 'this.setState', count: r.applied, skipped: r.skipped, start: r.start, steps: r.steps });
      }
      if (Ctor.getDerivedStateFromProps) { const part = Ctor.getDerivedStateFromProps(props, nextState); if (part != null) nextState = Object.assign({}, nextState, part); }
      const nextContext = contextFor();
      if (forced || captured) shouldUpdate = true;
      else if (oldProps === props && oldState === nextState && !hasContextChanged(wip)) shouldUpdate = false;
      else if (instance.shouldComponentUpdate) shouldUpdate = !!instance.shouldComponentUpdate(props, nextState, nextContext);
      else if (Ctor.prototype.isPureReactComponent) shouldUpdate = !shallowEqual(oldProps, props) || !shallowEqual(oldState, nextState);
      if (callbacks.length) { wip.classCallbacks = callbacks; wip.flags |= Update; }
      if (shouldUpdate) {
        if (instance.componentDidUpdate) wip.flags |= Update;
        if (instance.getSnapshotBeforeUpdate) wip.flags |= Snapshot;
      }
      instance.context = nextContext;
    }
    if (captured && wip.capturedError) {
      // an error boundary: turn the error into state, then render the error UI
      if (Ctor.getDerivedStateFromError) nextState = Object.assign({}, nextState, Ctor.getDerivedStateFromError(wip.capturedError.value));
      wip.flags |= Update; // componentDidCatch runs in the commit
    }
    if (current === null && wip.ref) wip.flags |= Ref;
    if (current !== null && current.ref !== wip.ref) wip.flags |= Ref;
    wip.memoizedState = nextState;
    instance.props = props;
    instance.state = nextState;
    wip.classShouldUpdate = shouldUpdate;
    if (!shouldUpdate) {
      trace('classSkip', { fiber: wip, scu: !!instance.shouldComponentUpdate, pure: !!Ctor.prototype.isPureReactComponent });
      if (!includesSomeLane(wip.childLanes, renderLanes)) return null;
      cloneChildFibers(current, wip);
      return wip.child;
    }
    const children = captured && wip.capturedError && !Ctor.getDerivedStateFromError ? null : callRender(wip, instance);
    reconcileChildren(current, wip, children);
    return wip.child;
  }

  function cloneChildFibers(current, wip) {
    if (wip.child === null) return;
    let currentChild = wip.child;
    let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
    wip.child = newChild;
    newChild.return = wip;
    while (currentChild.sibling !== null) {
      currentChild = currentChild.sibling;
      newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
      newChild.return = wip;
    }
    newChild.sibling = null;
  }

  function updateHostRoot(current, wip, renderLanes) {
    const queue = wip.updateQueue;
    let state = wip.memoizedState;
    const r = processUpdateQueue(wip, queue, state, renderLanes, (s, u) => Object.assign({}, s, u.action));
    if (r !== null) { state = r.state; wip.lanes |= r.lanes; }
    wip.memoizedState = state;
    if (isHydrating && current !== null && current.child === null) wip.child = reconcileChildFibers(false, [], wip, null, state.element); // hydration: adopt the server DOM, no insertions
    else reconcileChildren(current, wip, state.element);
    return wip.child;
  }

  function updateFunctionComponent(current, wip, Component, props, renderLanes) {
    const children = renderWithHooks(current, wip, Component, props, renderLanes);
    // the component ran, but its props and state are the same: keep the old children (like React's bailoutHooks)
    if (current !== null && !didReceiveUpdate && !hasContextChanged(wip)) {
      wip.flags &= ~(Passive | Update);
      trace('renderBailout', { fiber: wip });
      if (!includesSomeLane(wip.childLanes, renderLanes)) return null;
      cloneChildFibers(current, wip);
      return wip.child;
    }
    reconcileChildren(current, wip, children);
    return wip.child;
  }

  function shallowEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
  }

  function countProfiled(wip) { for (let p = wip.return; p !== null; p = p.return) if (p.tag === Profiler) { p.profiled++; p.flags |= Update; } }
  function updateMemoComponent(current, wip, renderLanes) {
    const compare = wip.type.compare || shallowEqual;
    if (current !== null && compare(current.memoizedProps, wip.pendingProps) && !includesSomeLane(current.lanes, renderLanes) && !hasContextChanged(wip)) {
      trace('memoBailout', { fiber: wip });
      wip.memoizedState = current.memoizedState;
      if (!includesSomeLane(wip.childLanes, renderLanes)) return null;
      cloneChildFibers(current, wip);
      return wip.child;
    }
    countProfiled(wip); // memo: only counted when it really renders
    const inner = wip.type.type;
    const Component = inner && inner.$$typeof === REACT_FORWARD_REF ? p => inner.render(p, wip.ref) : inner;
    const children = renderWithHooks(current, wip, Component, wip.pendingProps, renderLanes);
    reconcileChildren(current, wip, children);
    return wip.child;
  }

  // ---------------------------------------------------------------- context
  function createContext(defaultValue) {
    const context = { $$typeof: Symbol.for('react.context'), _currentValue: defaultValue, Provider: null, displayName: null };
    context.Provider = { $$typeof: REACT_PROVIDER, _context: context };
    context._context = context; // so the context itself can be used as a provider (React 19)
    context.Consumer = { $$typeof: REACT_CONSUMER, _context: context };
    return context;
  }
  const providerStack = [];
  let changedContexts = [];
  function hasContextChanged(fiber) {
    return !!fiber.dependencies && fiber.dependencies.some(c => changedContexts.includes(c));
  }
  function updateContextProvider(current, wip, renderLanes) {
    const context = wip.type._context;
    const newValue = wip.pendingProps.value;
    providerStack.push(context._currentValue);
    context._currentValue = newValue;
    if (current !== null && !Object.is(current.memoizedProps.value, newValue)) {
      changedContexts.push(context);
      trace('contextChanged', { fiber: wip });
      propagateContextChange(wip, context, renderLanes);
    }
    reconcileChildren(current, wip, wip.pendingProps.children);
    return wip.child;
  }
  // find every component below that reads this context, and give it work in this render
  function propagateContextChange(wip, context, renderLanes) {
    let fiber = wip.child;
    const walk = []; // for the visualizer: every fiber visited, in order, with depth and whether it reads this context
    const visit = (f, depth) => {
      for (; f !== null; f = f.sibling) {
        const reads = !!(f.dependencies && f.dependencies.includes(context));
        if (walk.length < 40) walk.push({ name: fiberLabel(f), depth, reads });
        if (reads) {
          f.lanes |= renderLanes;
          if (f.alternate) f.alternate.lanes |= renderLanes;
          for (let p = f.return; p !== null && p !== wip.return; p = p.return) { p.childLanes |= renderLanes; if (p.alternate) p.alternate.childLanes |= renderLanes; }
        }
        if (f.child !== null) visit(f.child, depth + 1);
      }
    };
    visit(fiber, 0);
    trace('contextPropagated', { fiber: wip, walk, readers: walk.filter(x => x.reads).length });
  }
  function readContext(context) {
    const fiber = currentlyRenderingFiber;
    if (fiber.dependencies === null) fiber.dependencies = [];
    if (!fiber.dependencies.includes(context)) fiber.dependencies.push(context);
    return context._currentValue;
  }

  // ---------------------------------------------------------------- hooks
  let currentlyRenderingFiber = null;
  let currentHook = null;
  let workInProgressHook = null;
  let isMounting = false;
  let renderLanesForHooks = NoLanes;

  function renderWithHooks(current, wip, Component, props, renderLanes) {
    currentlyRenderingFiber = wip;
    renderLanesForHooks = renderLanes;
    wip.memoizedState = null;
    wip.updateQueue = null;
    wip.dependencies = null;
    wip.eventUpdates = null; // useEffectEvent: new callbacks, put in place during the commit
    wip.debugValues = null; // useDebugValue labels of this render
    currentHook = null;
    workInProgressHook = null;
    isMounting = current === null || current.memoizedState === null;
    let children, threw = true;
    try {
      if (wip.mode & StrictModeBit) {
        // StrictMode (development): call the component twice and keep the second result, to reveal impure renders
        strictFirstPass = true;
        trace('strictRender', { fiber: wip });
        Component(props);
        strictFirstPass = false;
        wip.memoizedState = null; wip.updateQueue = null; wip.dependencies = null;
        currentHook = null; workInProgressHook = null;
      }
      children = Component(props);
      threw = false;
    } finally {
      strictFirstPass = false;
      const leftover = !threw && !isMounting && currentHook !== null && currentHook.next !== null;
      currentlyRenderingFiber = null;
      currentHook = null;
      workInProgressHook = null;
      if (leftover) throw new Error('Rendered fewer hooks than expected. This may be caused by an accidental early return statement.');
    }
    trace('rendered', { fiber: wip });
    return children;
  }
  let strictFirstPass = false;

  function resolveFiber(name) {
    if (currentlyRenderingFiber === null && flightRendering) throw new Error(name + ' only works in Client Components. Add the "use client" directive at the top of the file to use it.');
    if (currentlyRenderingFiber === null) throw new Error('Invalid hook call: ' + name + '() can only be called inside the body of a function component.');
    return currentlyRenderingFiber;
  }

  function mountWorkInProgressHook(name) {
    const hook = { name, memoizedState: null, queue: null, next: null };
    if (workInProgressHook === null) currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
    else workInProgressHook = workInProgressHook.next = hook;
    return hook;
  }

  function updateWorkInProgressHook(name) {
    const current = currentlyRenderingFiber.alternate;
    const nextCurrentHook = currentHook === null ? current.memoizedState : currentHook.next;
    if (nextCurrentHook === null) throw new Error('Rendered more hooks than during the previous render.');
    if (nextCurrentHook.name !== name) throw new Error('Hook order changed: this render called ' + name + '() where the previous render called ' + nextCurrentHook.name + '(). Never call hooks conditionally.');
    currentHook = nextCurrentHook;
    const hook = { name, memoizedState: currentHook.memoizedState, queue: currentHook.queue, next: null };
    if (workInProgressHook === null) currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
    else workInProgressHook = workInProgressHook.next = hook;
    return hook;
  }

  const basicStateReducer = (state, action) => (typeof action === 'function' ? action(state) : action);

  function useReducer(reducer, initialArg, init) { return reducerHook('useReducer', reducer, initialArg, init); }
  function useState(initialState) { return reducerHook('useState', basicStateReducer, initialState); }

  // Process a queue of updates (hooks and class components use the same logic).
  // Updates are moved from `pending` to a BASE queue that both trees share, and only removed from it when the
  // render COMMITS. So a render that is interrupted, thrown away or suspended loses nothing.
  // Skipped (lower-priority) updates stay in the base queue, and so does every update after them (rebasing),
  // so the final state is the same as if all updates had been applied in order.
  let queueCommits = [];
  function processUpdateQueue(fiber, queue, committedState, renderLanes, apply) {
    const pending = queue.pending;
    if (pending !== null) {
      queue.pending = null;
      if (queue.baseQueue === null || queue.baseQueue === undefined) { queue.baseQueue = pending; queue.baseState = committedState; }
      else { const baseFirst = queue.baseQueue.next; queue.baseQueue.next = pending.next; pending.next = baseFirst; queue.baseQueue = pending; }
    }
    if (!queue.baseQueue) return null;
    const last = queue.baseQueue;
    let state = queue.baseState, u = last.next, applied = 0, skipped = 0, lanes = NoLanes;
    const start = state, steps = [];
    let newFirst = null, newLast = null, newBaseState = null;
    do {
      const include = u.lane === NoLanes || includesSomeLane(renderLanes, u.lane);
      if (!include) {
        const clone = Object.assign({}, u, { next: null });
        if (newLast === null) { newFirst = newLast = clone; newBaseState = state; } else newLast = newLast.next = clone;
        lanes |= u.lane;
        skipped++;
        steps.push({ action: u.action !== undefined ? u.action : u.payload, lane: laneName(u.lane), skipped: true, after: state });
      } else {
        if (newLast !== null) newLast = newLast.next = Object.assign({}, u, { lane: NoLanes, callback: null, next: null }); // rebase: apply again later, in order
        state = apply(state, u);
        steps.push({ action: u.action !== undefined ? u.action : u.payload, lane: u.lane === NoLanes ? "rebased" : laneName(u.lane), skipped: false, after: state });
        applied++;
      }
      u = u.next;
    } while (u !== last.next);
    if (newLast === null) newBaseState = state; else newLast.next = newFirst;
    queueCommits.push({ fiber, queue, baseQueue: newLast, baseState: newBaseState });
    return { state, applied, skipped, lanes, start, steps };
  }

  function reducerHook(name, reducer, initialArg, init) {
    const fiber = resolveFiber(name);
    if (isMounting) {
      const hook = mountWorkInProgressHook(name);
      const initial = init !== undefined ? init(initialArg) : typeof initialArg === 'function' && name === 'useState' ? initialArg() : initialArg;
      hook.memoizedState = initial;
      const queue = { pending: null, dispatch: null, lastRenderedReducer: reducer, lastRenderedState: initial };
      hook.queue = queue;
      queue.dispatch = action => dispatchSetState(fiber, queue, action);
      return [hook.memoizedState, queue.dispatch];
    }
    const hook = updateWorkInProgressHook(name);
    const queue = hook.queue;
    queue.lastRenderedReducer = reducer;
    let newState = hook.memoizedState;
    const r = processUpdateQueue(currentlyRenderingFiber, queue, hook.memoizedState, renderLanesForHooks, (s, u) => reducer(s, u.action));
    if (r !== null) {
      newState = r.state;
      // postponed updates keep their lane on the fiber, so a later render (in that lane) finds this work again
      currentlyRenderingFiber.lanes |= r.lanes;
      if (!strictFirstPass) trace('processUpdates', { fiber: currentlyRenderingFiber, hook: name, count: r.applied, skipped: r.skipped, start: r.start, steps: r.steps });
    }
    if (!Object.is(newState, hook.memoizedState)) didReceiveUpdate = true; // the state really changed
    hook.memoizedState = newState;
    queue.lastRenderedState = newState;
    return [newState, queue.dispatch];
  }

  function dispatchSetState(fiber, queue, action) {
    if (executionContext & RenderContext && fiber === currentlyRenderingFiber) throw new Error('Too many re-renders. React limits the number of renders to prevent an infinite loop.');
    const lane = requestUpdateLane();
    const update = { lane, action, next: null };
    // eager bailout (useState only, as in React 18): if nothing is queued and the new state is the same, skip the render entirely
    if (queue.lastRenderedReducer === basicStateReducer && fiber.lanes === NoLanes && (fiber.alternate === null || fiber.alternate.lanes === NoLanes)) {
      const eagerState = queue.lastRenderedReducer(queue.lastRenderedState, action);
      if (Object.is(eagerState, queue.lastRenderedState)) { trace('eagerBailout', { fiber, value: eagerState }); return; }
    }
    enqueueUpdate(queue, update);
    trace('setState', { fiber, lane: laneName(lane), action });
    let root = fiber;
    while (root.return !== null) root = root.return;
    scheduleUpdateOnFiber(root.stateNode, fiber, lane);
  }

  function areHookInputsEqual(next, prev) {
    if (prev === null || next === null) return false;
    for (let i = 0; i < prev.length && i < next.length; i++) if (!Object.is(next[i], prev[i])) return false;
    return true;
  }

  function pushEffect(tag, create, destroy, deps) {
    const fiber = currentlyRenderingFiber;
    const effect = { tag, create, destroy, deps, next: null };
    if (fiber.updateQueue === null) fiber.updateQueue = { lastEffect: null };
    const queue = fiber.updateQueue;
    if (queue.lastEffect === null) { effect.next = effect; queue.lastEffect = effect; }
    else { effect.next = queue.lastEffect.next; queue.lastEffect.next = effect; queue.lastEffect = effect; }
    return effect;
  }

  function effectHook(name, fiberFlags, hookFlags, create, deps) {
    const fiber = resolveFiber(name);
    const nextDeps = deps === undefined ? null : deps;
    if (isMounting) {
      const hook = mountWorkInProgressHook(name);
      fiber.flags |= fiberFlags;
      hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, undefined, nextDeps);
      return;
    }
    const hook = updateWorkInProgressHook(name);
    const prev = currentHook.memoizedState;
    if (nextDeps !== null && areHookInputsEqual(nextDeps, prev.deps)) {
      hook.memoizedState = pushEffect(hookFlags, create, prev.destroy, nextDeps); // no HasEffect: it will not run
      if (!strictFirstPass) trace('effectSkipped', { fiber, hook: name });
      return;
    }
    fiber.flags |= fiberFlags;
    hook.memoizedState = pushEffect(HookHasEffect | hookFlags, create, prev.destroy, nextDeps);
  }
  function useEffect(create, deps) { effectHook('useEffect', Passive, HookPassive, create, deps); }
  function useLayoutEffect(create, deps) { effectHook('useLayoutEffect', Update, HookLayout, create, deps); }

  function useRef(initialValue) {
    resolveFiber('useRef');
    if (isMounting) { const hook = mountWorkInProgressHook('useRef'); hook.memoizedState = { current: initialValue }; return hook.memoizedState; }
    return updateWorkInProgressHook('useRef').memoizedState;
  }

  function memoHook(name, compute, deps) {
    const fiber = resolveFiber(name);
    const nextDeps = deps === undefined ? null : deps;
    if (isMounting) { const hook = mountWorkInProgressHook(name); const value = compute(); hook.memoizedState = [value, nextDeps]; return value; }
    const hook = updateWorkInProgressHook(name);
    const [prevValue, prevDeps] = hook.memoizedState;
    if (nextDeps !== null && areHookInputsEqual(nextDeps, prevDeps)) { if (!strictFirstPass) trace('memoHit', { fiber, hook: name }); return prevValue; }
    const value = compute();
    hook.memoizedState = [value, nextDeps];
    if (!strictFirstPass) trace('memoMiss', { fiber, hook: name });
    return value;
  }
  function useMemo(create, deps) { return memoHook('useMemo', create, deps); }
  function useCallback(callback, deps) { return memoHook('useCallback', () => callback, deps); }
  function useContext(context) { resolveFiber('useContext'); return readContext(context); }

  function startTransition(scope) {
    const prev = isInsideTransition;
    isInsideTransition = true;
    trace('transition', {});
    let result;
    try { result = scope(); } finally { isInsideTransition = prev; }
    return result;
  }
  let pendingActions = 0; // async transitions (actions) still running: optimistic state shows while > 0
  function useTransition() {
    const [isPending, setPending] = useState(false);
    const start = useCallback(scope => {
      setPending(true); // urgent: show the spinner now
      startTransition(() => {
        const result = scope(); // the rest can wait and be interrupted
        if (isThenable(result)) {
          // an async action (React 19): stay pending until its promise settles
          pendingActions++;
          trace('asyncAction', {});
          const done = () => { pendingActions--; trace('actionDone', {}); startTransition(() => setPending(false)); if (pendingActions === 0) flushFormResets(); };
          result.then(done, done);
        } else { setPending(false); queueMicrotask(() => { if (pendingActions === 0) flushFormResets(); }); }
      });
    }, []);
    return [isPending, start];
  }

  // useEffectEvent (React 19.2): a function for effects that always calls the LATEST callback,
  // so the effect does not need it in its dependencies. The new callback is put in place during the commit,
  // before any effect runs (never during render: an abandoned render must not change it).
  function useEffectEvent(callback) {
    const fiber = resolveFiber('useEffectEvent');
    let ref;
    if (isMounting) { ref = { impl: callback }; mountWorkInProgressHook('useEffectEvent').memoizedState = ref; }
    else {
      ref = updateWorkInProgressHook('useEffectEvent').memoizedState;
      fiber.flags |= Update;
      (fiber.eventUpdates || (fiber.eventUpdates = [])).push({ ref, impl: callback });
    }
    return function eventFn(...args) {
      if (executionContext & RenderContext) throw new Error("A function wrapped in useEffectEvent can't be called during rendering.");
      return ref.impl.apply(undefined, args);
    };
  }

  // React Compiler runtime: c(n) = useMemoCache(n). The compiler rewrites a component to keep its values in
  // n numbered slots and recompute a value only when the inputs saved next to it changed.
  // Each render works on a copy, so a render that is thrown away can't corrupt the cache.
  function useMemoCache(size) {
    resolveFiber('useMemoCache');
    if (isMounting) {
      const cache = [];
      for (let i = 0; i < size; i++) cache.push(MEMO_CACHE_SENTINEL);
      mountWorkInProgressHook('useMemoCache').memoizedState = cache;
      return cache;
    }
    const hook = updateWorkInProgressHook('useMemoCache');
    hook.memoizedState = hook.memoizedState.slice();
    return hook.memoizedState;
  }

  let idSeq = 0;
  function useId() {
    resolveFiber('useId');
    if (isMounting) { const hook = mountWorkInProgressHook('useId'); hook.memoizedState = ':r' + (idSeq++).toString(32) + ':'; return hook.memoizedState; }
    return updateWorkInProgressHook('useId').memoizedState;
  }

  // useDeferredValue: urgent renders keep the old value and schedule a Transition render with the new one
  function useDeferredValue(value) {
    const fiber = resolveFiber('useDeferredValue');
    if (isMounting) { mountWorkInProgressHook('useDeferredValue').memoizedState = value; return value; }
    const hook = updateWorkInProgressHook('useDeferredValue');
    const prev = hook.memoizedState;
    if (Object.is(prev, value)) return prev;
    if (includesSomeLane(renderLanesForHooks, TransitionLane)) { hook.memoizedState = value; didReceiveUpdate = true; return value; }
    if (!strictFirstPass) {
      fiber.lanes |= TransitionLane;
      if (workInProgressRoot) workInProgressRoot.pendingLanes |= TransitionLane;
      trace('deferValue', { fiber });
    }
    return prev;
  }

  // useSyncExternalStore: read an outside store during render and re-render when it changes
  function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    const fiber = resolveFiber('useSyncExternalStore');
    const read = (ssrRendering || isHydrating) && getServerSnapshot ? getServerSnapshot : getSnapshot;
    const value = read();
    if (!Object.is(value, read())) throw new Error('The result of getSnapshot should be cached to avoid an infinite loop');
    let inst;
    if (isMounting) { const hook = mountWorkInProgressHook('useSyncExternalStore'); inst = { value, getSnapshot }; hook.memoizedState = inst; }
    else { const hook = updateWorkInProgressHook('useSyncExternalStore'); inst = hook.memoizedState; if (!Object.is(inst.value, value)) didReceiveUpdate = true; inst.value = value; inst.getSnapshot = getSnapshot; }
    effectHook('useSyncExternalStore (subscribe)', Passive, HookPassive, () => {
      const check = () => {
        if (Object.is(inst.getSnapshot(), inst.value)) return;
        trace('storeChanged', { fiber });
        scheduleUpdateOnFiber(rootOf(fiber), fiber, SyncLane);
      };
      check(); // the store may have changed between render and subscribe
      return subscribe(check);
    }, [subscribe]);
    return value;
  }

  function useInsertionEffect(create, deps) { effectHook('useInsertionEffect', Update, HookInsertion, create, deps); }
  function useImperativeHandle(ref, create, deps) {
    effectHook('useImperativeHandle', Update, HookLayout, () => {
      setRef(ref, create());
      return () => setRef(ref, null);
    }, deps ? deps.concat([ref]) : undefined);
  }
  // useDebugValue: a label for a custom hook, shown by React DevTools (here: the Hooks tab). Not a hook slot.
  function useDebugValue(value, format) {
    const fiber = resolveFiber('useDebugValue');
    let hooks = 0;
    for (let h = fiber.memoizedState; h !== null; h = h.next) hooks++;
    (fiber.debugValues || (fiber.debugValues = [])).push({ value: typeof format === 'function' ? format(value) : value, after: hooks });
  }

  // useOptimistic (React 19): show a guess right away while an async action runs; the real state takes over after it
  function useOptimistic(passthrough, reducer) {
    const fiber = resolveFiber('useOptimistic');
    const hook = isMounting ? mountWorkInProgressHook('useOptimistic') : updateWorkInProgressHook('useOptimistic');
    if (isMounting) {
      const queue = { actions: [], dispatch: null };
      queue.dispatch = action => {
        queue.actions.push(action);
        trace('optimistic', { fiber });
        scheduleUpdateOnFiber(rootOf(fiber), fiber, SyncLane);
      };
      hook.queue = queue;
    }
    const queue = hook.queue;
    if (pendingActions === 0 && queue.actions.length) queue.actions = []; // the action finished: drop the guesses
    const shown = queue.actions.reduce((s, a) => (reducer ? reducer(s, a) : a), passthrough);
    hook.memoizedState = shown;
    didReceiveUpdate = true;
    return [shown, queue.dispatch];
  }

  // useActionState (React 19): state + an action that runs in a transition + isPending
  function useActionState(action, initialState) {
    const [state, setState] = useState(initialState);
    const [isPending, start] = useTransition();
    const latest = useRef(state);
    latest.current = state;
    const dispatch = useCallback(payload => start(async () => {
      const next = await action(latest.current, payload);
      startTransition(() => setState(next));
    }), []);
    return [state, dispatch, isPending];
  }

  function forwardRef(render) { return { $$typeof: REACT_FORWARD_REF, render }; }

  function memo(type, compare) { return { $$typeof: REACT_MEMO, type, compare: compare || null }; }

  // development warnings, printed with console.error like React's
  const warned = new Set();
  function warnAboutKeys(returnFiber, children) {
    if (staticChildren.has(children)) return; // children written out one by one in JSX do not need keys
    let owner = returnFiber;
    while (owner !== null && !(owner.tag === FunctionComponent || owner.tag === ClassComponent || owner.tag === ForwardRef || owner.tag === MemoComponent)) owner = owner.return;
    const ownerName = owner ? componentName(owner) || 'Anonymous' : 'Root';
    const els = children.filter(c => c !== null && typeof c === 'object' && c.$$typeof === REACT_ELEMENT);
    if (els.some(c => c.key === null) && !warned.has('key:' + ownerName)) {
      warned.add('key:' + ownerName);
      console.error('Warning: Each child in a list should have a unique "key" prop. Check the render method of `' + ownerName + '`.');
    }
    const seen = new Set();
    els.forEach(c => {
      if (c.key === null) return;
      if (seen.has(c.key) && !warned.has('dup:' + c.key)) {
        warned.add('dup:' + c.key);
        console.error('Warning: Encountered two children with the same key, `' + c.key + '`. Keys should be unique so that components maintain their identity across updates.');
      }
      seen.add(c.key);
    });
  }

  // ---------------------------------------------------------------- child reconciliation (keys!)
  // a short name for a fiber, for the visualizer ("<li key=a>", "Counter", "text")
  function fiberLabel(f) {
    const base = f.tag === HostText ? '"' + String(f.pendingProps).slice(0, 12) + '"' : typeof f.type === 'string' ? '<' + f.type + '>' : componentName(f) || (f.tag === Fragment ? 'Fragment' : f.tag === OffscreenComponent ? 'Offscreen' : f.tag === Profiler ? 'Profiler' : '?');
    return base + (f.key !== null && f.key !== undefined ? ' key=' + f.key : '');
  }
  function childLabels(first) { const out = []; for (let c = first; c !== null; c = c.sibling) out.push(fiberLabel(c)); return out; }
  function reconcileChildren(current, wip, nextChildren) {
    const ops = [];
    ops.diff = []; // the list-diff decisions, one per new child (for the visualizer)
    const before = current !== null ? childLabels(current.child) : [];
    wip.child = current === null
      ? reconcileChildFibers(false, ops, wip, null, nextChildren)
      : reconcileChildFibers(true, ops, wip, current.child, nextChildren);
    if (current !== null && ops.length) {
      const after = [];
      for (let c = wip.child; c !== null; c = c.sibling) after.push({ name: fiberLabel(c), op: c.alternate === null ? 'create' : c.flags & Placement ? 'move' : 'keep' });
      const deleted = (wip.deletions || []).map(fiberLabel);
      trace('reconciled', { fiber: wip, ops, before, after, deleted, diff: ops.diff });
    }
  }

  function reconcileChildFibers(track, ops, returnFiber, currentFirstChild, newChild) {
    const describe = f => (f.tag === HostText ? 'text' : f.tag === OffscreenComponent ? 'Offscreen' : f.tag === HostPortal ? 'portal' : f.tag === SuspenseComponent ? 'Suspense' : typeof f.type === 'string' ? '<' + f.type + '>' : f.type && (f.type.name || (f.type.type && f.type.type.name)) || 'fragment') + (f.key !== null ? ' key=' + f.key : '');
    function deleteChild(child) {
      if (!track) return;
      if (returnFiber.deletions === null) returnFiber.deletions = [child];
      else returnFiber.deletions.push(child);
      returnFiber.flags |= ChildDeletion;
      ops.push('delete ' + describe(child));
    }
    function deleteRemaining(child) { while (child !== null) { deleteChild(child); child = child.sibling; } return null; }
    function useFiber(fiber, props) { const clone = createWorkInProgress(fiber, props); clone.index = 0; clone.sibling = null; return clone; }
    function placeSingle(fiber) { if (track && fiber.alternate === null) { fiber.flags |= Placement; ops.push('create ' + describe(fiber)); } return fiber; }
    let diffPass = 1;
    const note = (fiber, decision, last, newIndex) => { if (ops.diff) ops.diff.push({ name: fiberLabel(fiber), pass: diffPass, oldIndex: fiber.alternate !== null ? fiber.alternate.index : -1, last, newIndex, decision }); };
    function placeChild(fiber, lastPlacedIndex, newIndex) {
      fiber.index = newIndex;
      if (!track) return lastPlacedIndex;
      const current = fiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) { fiber.flags |= Placement; ops.push('move ' + describe(fiber)); note(fiber, 'move', lastPlacedIndex, newIndex); return lastPlacedIndex; }
        ops.push('keep ' + describe(fiber));
        note(fiber, 'keep', lastPlacedIndex, newIndex);
        return oldIndex;
      }
      fiber.flags |= Placement;
      ops.push('create ' + describe(fiber));
      note(fiber, 'create', lastPlacedIndex, newIndex);
      return lastPlacedIndex;
    }
    function updateTextNode(current, text) {
      if (current === null || current.tag !== HostText) { const created = createFiber(HostText, text, null); created.return = returnFiber; return created; }
      const existing = useFiber(current, text);
      existing.return = returnFiber;
      return existing;
    }
    function updateElement(current, element) {
      if (isPortal(element)) {
        if (current !== null && current.tag === HostPortal && current.stateNode.containerInfo === element.containerInfo) {
          const existing = useFiber(current, element.children); existing.return = returnFiber; return existing;
        }
        const created = createFiberFromPortal(element); created.return = returnFiber; return created;
      }
      if (current !== null && current.elementType === element.type) {
        const existing = useFiber(current, element.type === REACT_FRAGMENT ? element.props.children : element.props);
        existing.ref = element.ref;
        existing.return = returnFiber;
        return existing;
      }
      const created = createFiberFromElement(element);
      created.return = returnFiber;
      return created;
    }
    function updateFragment(current, children, key) {
      if (current === null || current.tag !== Fragment) { const created = createFiber(Fragment, children, key); created.return = returnFiber; return created; }
      const existing = useFiber(current, children);
      existing.return = returnFiber;
      return existing;
    }
    const isText = c => typeof c === 'string' || typeof c === 'number';
    const isPortal = c => c !== null && typeof c === 'object' && c.$$typeof === REACT_PORTAL;
    const isElement = c => c !== null && typeof c === 'object' && (c.$$typeof === REACT_ELEMENT || c.$$typeof === REACT_PORTAL);
    const checkChild = c => {
      if (c !== null && typeof c === 'object' && !isElement(c) && !Array.isArray(c)) {
        throw new Error('Objects are not valid as a React child (found: object with keys {' + Object.keys(c).join(', ') + '}). If you meant to render a collection of children, use an array instead.');
      }
    };
    const fromElement = el => (isPortal(el) ? createFiberFromPortal(el) : createFiberFromElement(el));
    function createChild(newChild) {
      checkChild(newChild);
      if (isText(newChild)) { const f = createFiber(HostText, String(newChild), null); f.return = returnFiber; return f; }
      if (isElement(newChild)) { const f = fromElement(newChild); f.return = returnFiber; return f; }
      if (Array.isArray(newChild)) { const f = createFiber(Fragment, newChild, null); f.return = returnFiber; return f; }
      return null;
    }
    function updateSlot(oldFiber, newChild) {
      const key = oldFiber !== null ? oldFiber.key : null;
      if (isText(newChild)) return key !== null ? null : updateTextNode(oldFiber, String(newChild));
      if (isElement(newChild)) return newChild.key === key ? updateElement(oldFiber, newChild) : null;
      if (Array.isArray(newChild)) return key !== null ? null : updateFragment(oldFiber, newChild, null);
      return null;
    }
    function updateFromMap(existing, newIdx, newChild) {
      if (isText(newChild)) return updateTextNode(existing.get(newIdx) || null, String(newChild));
      if (isElement(newChild)) return updateElement(existing.get(newChild.key === null ? newIdx : newChild.key) || null, newChild);
      if (Array.isArray(newChild)) return updateFragment(existing.get(newIdx) || null, newChild, null);
      return null;
    }
    function reconcileChildrenArray(currentFirst, newChildren) {
      warnAboutKeys(returnFiber, newChildren);
      newChildren.forEach(checkChild);
      let first = null, previous = null, oldFiber = currentFirst, lastPlacedIndex = 0, newIdx = 0, nextOldFiber = null;
      const link = f => { if (previous === null) first = f; else previous.sibling = f; previous = f; };
      // pass 1: walk both lists while the keys line up
      for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
        if (oldFiber.index > newIdx) { nextOldFiber = oldFiber; oldFiber = null; } else nextOldFiber = oldFiber.sibling;
        const newFiber = updateSlot(oldFiber, newChildren[newIdx]);
        if (newFiber === null) { if (oldFiber === null) oldFiber = nextOldFiber; break; }
        if (track && oldFiber && newFiber.alternate === null) deleteChild(oldFiber);
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        link(newFiber);
        oldFiber = nextOldFiber;
      }
      if (newIdx === newChildren.length) { deleteRemaining(oldFiber); return first; }
      if (oldFiber === null) {
        diffPass = 'append';
        for (; newIdx < newChildren.length; newIdx++) {
          const created = createChild(newChildren[newIdx]);
          if (created === null) continue;
          lastPlacedIndex = placeChild(created, lastPlacedIndex, newIdx);
          link(created);
        }
        return first;
      }
      // pass 2: the keys diverged, so look the rest up by key (or index) in a map
      diffPass = 2;
      const existing = new Map();
      for (let f = oldFiber; f !== null; f = f.sibling) existing.set(f.key !== null ? f.key : f.index, f);
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = updateFromMap(existing, newIdx, newChildren[newIdx]);
        if (newFiber === null) continue;
        if (track && newFiber.alternate !== null) existing.delete(newFiber.key === null ? newIdx : newFiber.key);
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        link(newFiber);
      }
      if (track) existing.forEach(child => deleteChild(child));
      return first;
    }
    // single child
    checkChild(newChild);
    if (isPortal(newChild)) {
      const old = currentFirstChild;
      if (old !== null && old.tag === HostPortal && old.key === newChild.key && old.stateNode.containerInfo === newChild.containerInfo) {
        deleteRemaining(old.sibling);
        const existing = useFiber(old, newChild.children);
        existing.return = returnFiber;
        return existing;
      }
      deleteRemaining(old);
      const created = createFiberFromPortal(newChild);
      created.return = returnFiber;
      return placeSingle(created);
    }
    if (isElement(newChild)) {
      let child = currentFirstChild;
      while (child !== null) {
        if (child.key === newChild.key) {
          if (child.elementType === newChild.type) {
            deleteRemaining(child.sibling);
            const existing = useFiber(child, newChild.type === REACT_FRAGMENT ? newChild.props.children : newChild.props);
            existing.ref = newChild.ref;
            existing.return = returnFiber;
            if (track) ops.push('keep ' + describe(existing));
            return existing;
          }
          deleteRemaining(child);
          break;
        }
        deleteChild(child);
        child = child.sibling;
      }
      const created = createFiberFromElement(newChild);
      created.return = returnFiber;
      return placeSingle(created);
    }
    if (isText(newChild)) {
      if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
        deleteRemaining(currentFirstChild.sibling);
        const existing = useFiber(currentFirstChild, String(newChild));
        existing.return = returnFiber;
        return existing;
      }
      deleteRemaining(currentFirstChild);
      const created = createFiber(HostText, String(newChild), null);
      created.return = returnFiber;
      return placeSingle(created);
    }
    if (Array.isArray(newChild)) return reconcileChildrenArray(currentFirstChild, newChild);
    return deleteRemaining(currentFirstChild);
  }

  // ---------------------------------------------------------------- render phase: completeWork (build DOM off-screen)
  function completeWork(current, wip) {
    switch (wip.tag) {
      case HostComponent: {
        if (current !== null && wip.stateNode !== null) {
          const payload = diffProperties(current.memoizedProps, wip.pendingProps);
          if (payload.length) { wip.updateQueue = payload; wip.flags |= Update; trace('diffProps', { fiber: wip, keys: payload.map(p => p[0]) }); }
        } else if (current === null && wip.stateNode !== null) {
          // hydration: the server already made this DOM node, React just adopts it
          const dom = wip.stateNode;
          dom.__reactFiber = wip;
          dom.__reactProps = wip.pendingProps;
          if (wip.ref) wip.flags |= Ref;
          if (isHydrating) {
            if (nextHydratable !== null) hydrationMismatch(wip, nextHydratable, 'extra');
            nextHydratable = nextHydratableSibling(dom);
          }
        } else {
          const dom = document.createElement(wip.type);
          dom.__reactFiber = wip;
          dom.__reactProps = wip.pendingProps;
          appendAllChildren(dom, wip);
          setInitialProperties(dom, wip.pendingProps);
          wip.stateNode = dom;
          if (wip.ref) wip.flags |= Ref;
          trace('createDOM', { fiber: wip });
        }
        if (current !== null && current.ref !== wip.ref) wip.flags |= Ref;
        break;
      }
      case HostText: {
        if (current !== null && wip.stateNode !== null) { if (current.memoizedProps !== wip.pendingProps) wip.flags |= Update; }
        else if (wip.stateNode === null) wip.stateNode = document.createTextNode(wip.pendingProps);
        break;
      }
      case ContextProvider: {
        const context = wip.type._context;
        context._currentValue = providerStack.pop();
        changedContexts = changedContexts.filter(c => c !== context);
        break;
      }
      case HostPortal: {
        if (current === null) listenToAllSupportedEvents(wip.stateNode.containerInfo); // events inside the portal reach React too
        break;
      }
      case SuspenseComponent: {
        // selective hydration: this boundary's content is now hydrated; the rest of the page was done before
        if (wip.hydratingBoundary) { wip.hydratingBoundary = false; isHydrating = false; nextHydratable = null; trace('boundaryHydrated', { fiber: wip }); }
        break;
      }
      case OffscreenComponent: {
        if (current !== null && (current.memoizedProps.mode === 'hidden') !== (wip.pendingProps.mode === 'hidden')) wip.flags |= Visibility;
        break;
      }
      default: break;
    }
    bubbleProperties(wip);
  }

  function bubbleProperties(wip) {
    let subtreeFlags = NoFlags, childLanes = NoLanes;
    // children that still belong to the current tree (a skipped subtree) keep old flags: ignore them
    // (like React: a bailout keeps exactly the same child fibers as the current tree, whose flags are already committed)
    const reused = wip.child !== null && (wip.child.return !== wip || (wip.alternate !== null && wip.alternate.child === wip.child));
    for (let child = wip.child; child !== null; child = child.sibling) {
      if (!reused) subtreeFlags |= child.subtreeFlags | child.flags;
      childLanes |= child.lanes | child.childLanes;
    }
    wip.subtreeFlags = subtreeFlags;
    wip.childLanes = childLanes;
  }

  // put the DOM nodes of all host children (through components and fragments) into `parent`
  function appendAllChildren(parent, wip) {
    let node = wip.child;
    while (node !== null) {
      if (node.tag === HostComponent || node.tag === HostText) { if (!isHoistable(node)) parent.appendChild(node.stateNode); } // <title> etc. go to <head> at commit
      else if (node.tag !== HostPortal && node.child !== null) { node = node.child; continue; } // a portal's DOM goes elsewhere
      if (node === wip) return;
      while (node.sibling === null) {
        if (node.return === null || node.return === wip) return;
        node = node.return;
      }
      node = node.sibling;
    }
  }

  const isEvent = key => /^on[A-Z]/.test(key);
  function setProp(dom, key, value, prev) {
    if (key === 'children' || isEvent(key) || key === 'key' || key === 'ref' || typeof value === 'function') return; // functions (like a form action) are never DOM attributes
    if (key === 'style') {
      const next = value || {}, old = prev || {};
      for (const k in old) if (!(k in next)) dom.style[k] = '';
      for (const k in next) dom.style[k] = next[k];
      return;
    }
    if (key === 'className') { dom.className = value == null ? '' : value; return; }
    if (key === 'value' || key === 'checked') { dom[key] = value; return; }
    if (key === 'defaultValue' || key === 'defaultChecked') { if (prev === undefined) dom[key === 'defaultValue' ? 'value' : 'checked'] = value; return; } // only the first value: the user owns it after that
    if (key === 'dangerouslySetInnerHTML') { dom.innerHTML = value && value.__html != null ? value.__html : ''; return; }
    if (value === null || value === undefined || value === false) dom.removeAttribute(key === 'htmlFor' ? 'for' : key);
    else dom.setAttribute(key === 'htmlFor' ? 'for' : key, value === true ? '' : value);
  }
  function setInitialProperties(dom, props) {
    for (const key in props) if (props[key] !== undefined && props[key] !== null) setProp(dom, key, props[key], undefined);
    if (props.value != null && !props.onChange && !props.onInput && !props.readOnly && (dom.tagName === 'INPUT' || dom.tagName === 'TEXTAREA' || dom.tagName === 'SELECT') && !warned.has('readonly')) {
      warned.add('readonly');
      console.error('Warning: You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`.');
    }
  }
  function diffProperties(oldProps, newProps) {
    const payload = [];
    for (const key in oldProps) if (key !== 'children' && !(key in newProps)) payload.push([key, null]);
    for (const key in newProps) {
      if (key === 'children') continue;
      const changed = key === 'style' ? !shallowEqual(oldProps.style, newProps.style) : !Object.is(oldProps[key], newProps[key]);
      if (changed) payload.push([key, newProps[key]]);
    }
    return payload;
  }

  // ---------------------------------------------------------------- commit phase
  let strictMounted = []; // StrictMode components mounted in this commit: their effects run twice in development

  function commitRoot(root, lanes) {
    const finishedWork = root.finishedWork;
    root.finishedWork = null;
    executionContext |= CommitContext;
    trace('commitStart', { root, fiber: finishedWork });
    // the updates this render used are now really consumed
    queueCommits.forEach(e => { e.queue.baseQueue = e.baseQueue; e.queue.baseState = e.baseState; });
    queueCommits = [];
    commitBeforeMutationEffects(finishedWork); // getSnapshotBeforeUpdate: read the DOM before it changes
    commitMutationEffects(root, finishedWork);
    root.current = finishedWork; // the finished work-in-progress tree is now what is on screen
    trace('swap', { root, fiber: finishedWork });
    commitLayoutEffects(finishedWork);
    pendingReappear.splice(0).forEach(reappearEffects); // <Activity> shown again: its layout effects, after the DOM changes
    // hidden <Activity> content that was skipped: render it later, at the lowest priority, after this paint
    pendingPrerender.splice(0).forEach(f => { trace('prerenderScheduled', { fiber: f }); scheduleUpdateOnFiber(root, f, OffscreenLane); });
    // dehydrated Suspense boundaries: hydrate each one later, on its own (unless the user clicks one first)
    pendingDehydrated.splice(0).forEach(f => { trace('hydrationScheduled', { fiber: f }); scheduleUpdateOnFiber(root, f, DefaultLane); });
    if ((finishedWork.subtreeFlags | finishedWork.flags) & Passive || pendingPassiveUnmounts.length || strictMounted.length || pendingPassiveReappear.length) {
      if (pendingPassiveRoot === null) {
        pendingPassiveRoot = root;
        trace('schedulePassive', { root });
        setTimeout(flushPassiveEffects, 0);
      }
    }
    executionContext &= ~CommitContext;
    trace('commitEnd', { root });
  }

  function commitBeforeMutationEffects(fiber) {
    if (fiber.subtreeFlags & Snapshot) for (let c = fiber.child; c !== null; c = c.sibling) commitBeforeMutationEffects(c);
    if (fiber.tag === ClassComponent && fiber.flags & Snapshot && fiber.alternate !== null) {
      const instance = fiber.stateNode;
      instance.__snapshot = instance.getSnapshotBeforeUpdate(fiber.alternate.memoizedProps, fiber.alternate.memoizedState);
      trace('snapshot', { fiber });
    }
  }

  function getHostParent(fiber) {
    for (let p = fiber.return; p !== null; p = p.return) {
      if (p.tag === HostComponent) return p.stateNode;
      if (p.tag === HostRoot || p.tag === HostPortal) return p.stateNode.containerInfo;
    }
    return null;
  }
  // the next DOM node after this fiber that is already in the DOM (so we can insertBefore it)
  function getHostSibling(fiber) {
    let node = fiber;
    siblings: while (true) {
      while (node.sibling === null) {
        if (node.return === null || node.return.tag === HostComponent || node.return.tag === HostRoot || node.return.tag === HostPortal) return null;
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
      while (node.tag !== HostComponent && node.tag !== HostText) {
        if (node.flags & Placement || node.tag === HostPortal) continue siblings;
        if (node.child === null) continue siblings;
        node.child.return = node;
        node = node.child;
      }
      if (!(node.flags & Placement) && !isHoistable(node)) return node.stateNode;
    }
  }
  function collectStrict(fiber) {
    if (!(fiber.mode & StrictModeBit)) return;
    const walk = f => { if (isFnFiber(f) || f.tag === ClassComponent) strictMounted.push(f); for (let c = f.child; c !== null; c = c.sibling) walk(c); };
    walk(fiber);
  }
  // React 19: <title>, <meta> and <link> rendered anywhere are put into document.head (document metadata)
  const isHoistable = f => f.tag === HostComponent && (f.type === 'title' || f.type === 'meta' || f.type === 'link') && !inSvg(f);
  const inSvg = f => { for (let p = f.return; p !== null; p = p.return) if (p.tag === HostComponent && p.type === 'svg') return true; return false; };
  function hoistInside(fiber) {
    const walk = f => {
      if (isStylesheet(f)) { insertStylesheet(f); return; }
      if (isHoistable(f)) { document.head.appendChild(f.stateNode); trace('hoisted', { fiber: f }); return; }
      if (f.tag === HostPortal) return;
      for (let c = f.child; c !== null; c = c.sibling) walk(c);
    };
    walk(fiber);
  }
  // <link rel="stylesheet" precedence="…">: React 19 keeps ONE copy per href, groups sheets by precedence (in the order
  // each precedence was first seen) and never removes them when the component unmounts
  const isStylesheet = f => f.tag === HostComponent && f.type === 'link' && f.memoizedProps && f.memoizedProps.rel === 'stylesheet' && f.memoizedProps.precedence != null;
  const headList = sel => { const list = document.head.querySelectorAll(sel), out = []; for (let i = 0; i < list.length; i++) out.push(list[i]); return out; };
  function insertStylesheet(f) {
    const href = f.memoizedProps.href, prec = String(f.memoizedProps.precedence);
    if (headList('link[data-precedence]').some(l => l.getAttribute('href') === href)) { trace('stylesheetDeduped', { fiber: f, href }); return; }
    const el = f.stateNode;
    el.setAttribute('data-precedence', prec);
    const sheets = headList('link[data-precedence]');
    const group = sheets.filter(l => l.getAttribute('data-precedence') === prec);
    const after = group.length ? group[group.length - 1] : sheets.length ? sheets[sheets.length - 1] : null;
    if (after) document.head.insertBefore(el, after.nextSibling); else document.head.appendChild(el);
    trace('stylesheetInserted', { fiber: f, href, precedence: prec, order: headList('link[data-precedence]').map(l => l.getAttribute('href') + ' (' + l.getAttribute('data-precedence') + ')') });
  }
  function removeHoisted(fiber) {
    for (let c = fiber.child; c !== null; c = c.sibling) {
      if (isStylesheet(c)) continue; // stylesheets stay
      if (isHoistable(c)) { if (c.stateNode.parentNode) c.stateNode.parentNode.removeChild(c.stateNode); } else if (c.tag !== HostPortal) removeHoisted(c);
    }
  }
  function commitPlacement(fiber) {
    const parent = getHostParent(fiber);
    const before = getHostSibling(fiber);
    const insert = (f, into, ref) => {
      if (isHoistable(f)) return; // goes into <head> below
      if (f.tag === HostComponent || f.tag === HostText) { if (ref) into.insertBefore(f.stateNode, ref); else into.appendChild(f.stateNode); return; }
      if (f.tag === HostPortal) return; // a portal's children have their own Placement: they go into the portal's container
      for (let c = f.child; c !== null; c = c.sibling) insert(c, into, ref);
    };
    insert(fiber, parent, before);
    hoistInside(fiber);
    collectStrict(fiber);
    trace('placement', { fiber, before: !!before });
  }
  function commitDeletion(parentFiber, child) {
    const hostParent = getHostParent(child);
    // run cleanups for every component in the removed subtree
    const unmount = f => {
      if (isFnFiber(f)) {
        commitHookEffectListUnmount(HookInsertion, f);
        commitHookEffectListUnmount(HookLayout, f);
        const q = f.updateQueue;
        if (q && q.lastEffect) { let e = q.lastEffect.next; do { if (e.tag & HookPassive && e.destroy) pendingPassiveUnmounts.push({ fiber: f, effect: e }); e = e.next; } while (e !== q.lastEffect.next); }
      }
      if (f.tag === ClassComponent) {
        detachRef(f);
        if (f.stateNode && f.stateNode.componentWillUnmount) { trace('classLifecycle', { fiber: f, method: 'componentWillUnmount' }); f.stateNode.componentWillUnmount(); }
      }
      if (f.tag === HostComponent) detachRef(f);
      for (let c = f.child; c !== null; c = c.sibling) unmount(c);
    };
    unmount(child);
    const remove = (f, from) => {
      if (isHoistable(f)) { if (!isStylesheet(f) && f.stateNode.parentNode) f.stateNode.parentNode.removeChild(f.stateNode); return; } // it lives in <head> (stylesheets stay)
      if (f.tag === HostComponent) removeHoisted(f);
      if (f.tag === HostComponent || f.tag === HostText) { from.removeChild(f.stateNode); return; }
      if (f.tag === HostPortal) { for (let c = f.child; c !== null; c = c.sibling) remove(c, f.stateNode.containerInfo); return; }
      for (let c = f.child; c !== null; c = c.sibling) remove(c, from);
    };
    remove(child, hostParent);
    trace('deletion', { fiber: child });
  }

  // <Activity mode="hidden">: like an unmount for effects (layout cleanups now, useEffect cleanups after paint,
  // componentWillUnmount, refs detached), but the fibers, their state and their DOM are kept
  let pendingReappear = [];
  function eachInside(offscreen, fn) {
    const walk = f => { for (let c = f.child; c !== null; c = c.sibling) { if (c.tag === OffscreenComponent && c.memoizedProps.mode === 'hidden') continue; fn(c); walk(c); } };
    walk(offscreen);
  }
  function disappearEffects(offscreen) {
    trace('activityHide', { fiber: offscreen });
    eachInside(offscreen, f => {
      if (isFnFiber(f)) {
        commitHookEffectListUnmount(HookLayout, f);
        const q = f.updateQueue;
        if (q && q.lastEffect) { let e = q.lastEffect.next; do { if (e.tag & HookPassive && e.destroy) pendingPassiveUnmounts.push({ fiber: f, effect: e, hidden: true }); e = e.next; } while (e !== q.lastEffect.next); }
      }
      if (f.tag === ClassComponent && f.stateNode && f.stateNode.componentWillUnmount) { trace('classLifecycle', { fiber: f, method: 'componentWillUnmount' }); f.stateNode.componentWillUnmount(); }
      if (f.tag === HostComponent || f.tag === ClassComponent) detachRef(f);
    });
  }
  // shown again: effects that were cleaned up run again (layout now, useEffect after paint). Fibers that are new,
  // or whose dependencies changed while hidden, already run through the normal path.
  let pendingPassiveReappear = [];
  function runEffectsWithout(kind, fiber) {
    const q = fiber.updateQueue;
    if (!q || !q.lastEffect) return;
    const first = q.lastEffect.next;
    let e = first;
    do {
      if (e.tag & kind && !(e.tag & HookHasEffect)) {
        trace('effectRun', { fiber, layout: kind === HookLayout, reappear: true });
        const destroy = e.create();
        e.destroy = typeof destroy === 'function' ? destroy : undefined;
      }
      e = e.next;
    } while (e !== first);
  }
  function reappearEffects(offscreen) {
    trace('activityShow', { fiber: offscreen });
    eachInside(offscreen, f => {
      if (f.alternate === null) return; // mounted just now: its effects run normally
      if (isFnFiber(f)) { runEffectsWithout(HookLayout, f); pendingPassiveReappear.push(f); }
      if (f.tag === ClassComponent && f.stateNode && f.stateNode.componentDidMount) { trace('classLifecycle', { fiber: f, method: 'componentDidMount' }); f.stateNode.componentDidMount(); }
      if ((f.tag === HostComponent || f.tag === ClassComponent) && f.ref) attachRef(f);
    });
  }

  // Suspense hides its content (display: none) instead of removing it, so the state survives
  function hideOrShow(offscreen, hide) {
    const walk = f => {
      for (let c = f.child; c !== null; c = c.sibling) {
        if (c.tag === HostComponent) c.stateNode.style.display = hide ? 'none' : '';
        else if (c.tag === HostText) c.stateNode.nodeValue = hide ? '' : c.memoizedProps;
        else if (c.tag !== HostPortal) walk(c);
      }
    };
    walk(offscreen);
    if (offscreen.type !== REACT_ACTIVITY) trace(hide ? 'hideContent' : 'revealContent', { fiber: offscreen.return }); // Activity reports its own step
  }

  function commitMutationEffects(root, fiber) {
    if (fiber.deletions !== null) fiber.deletions.forEach(child => commitDeletion(fiber, child));
    if (fiber.subtreeFlags & (Placement | Update | ChildDeletion | Ref | Visibility)) for (let c = fiber.child; c !== null; c = c.sibling) commitMutationEffects(root, c);
    if (fiber.flags & Placement) { commitPlacement(fiber); fiber.flags &= ~Placement; }
    if (fiber.tag === OffscreenComponent && fiber.prerendered) { fiber.prerendered = false; hideOrShow(fiber, true); } // pre-rendered: in the DOM, but hidden
    if (fiber.flags & Visibility) {
      const hide = fiber.memoizedProps.mode === 'hidden';
      hideOrShow(fiber, hide);
      // <Activity>: hidden content keeps its state and DOM, but its effects are cleaned up; they run again when shown
      if (fiber.type === REACT_ACTIVITY) { if (hide) disappearEffects(fiber); else pendingReappear.push(fiber); }
    }
    if (fiber.flags & Update) {
      if (fiber.tag === HostComponent) {
        const payload = fiber.updateQueue || [];
        const oldProps = fiber.alternate ? fiber.alternate.memoizedProps : {};
        payload.forEach(([key, value]) => setProp(fiber.stateNode, key, value, oldProps[key]));
        fiber.updateQueue = null;
        trace('commitUpdate', { fiber, keys: payload.map(p => p[0]) });
      } else if (fiber.tag === HostText) {
        fiber.stateNode.nodeValue = fiber.memoizedProps;
        trace('commitText', { fiber });
      } else if (isFnFiber(fiber)) {
        if (fiber.eventUpdates) {
          // useEffectEvent: from now on the event function calls this render's callback
          fiber.eventUpdates.forEach(u => { u.ref.impl = u.impl; });
          fiber.eventUpdates = null;
          trace('effectEventUpdated', { fiber });
        }
        commitHookEffectListUnmount(HookInsertion | HookHasEffect, fiber); // useInsertionEffect: before any layout effect
        commitHookEffectListMount(HookInsertion | HookHasEffect, fiber);
        commitHookEffectListUnmount(HookLayout | HookHasEffect, fiber); // layout cleanups run during mutation
      }
    }
    if (fiber.tag === HostComponent && fiber.stateNode) { fiber.stateNode.__reactFiber = fiber; fiber.stateNode.__reactProps = fiber.memoizedProps; }
  }

  function setRef(ref, value) { if (typeof ref === 'function') ref(value); else if (ref) ref.current = value; }
  // React 19: a callback ref may return a cleanup function; React then calls the cleanup instead of ref(null)
  function attachRef(fiber) {
    const ref = fiber.ref;
    if (typeof ref === 'function') { const cleanup = ref(fiber.stateNode); fiber.refCleanup = typeof cleanup === 'function' ? cleanup : null; }
    else if (ref) ref.current = fiber.stateNode;
    trace('refAttached', { fiber });
  }
  function detachRef(fiber) {
    const ref = fiber.ref;
    if (!ref) return;
    const cleanup = fiber.refCleanup || (fiber.alternate !== null ? fiber.alternate.refCleanup : null);
    fiber.refCleanup = null;
    if (fiber.alternate !== null) fiber.alternate.refCleanup = null;
    if (typeof cleanup === 'function') { trace('refCleanup', { fiber }); cleanup(); }
    else if (typeof ref === 'function') ref(null);
    else ref.current = null;
  }

  function commitLayoutEffects(fiber) {
    if (fiber.tag === OffscreenComponent && fiber.memoizedProps.mode === 'hidden') return; // hidden content: no layout effects, no refs
    if (fiber.subtreeFlags & (Update | Ref)) for (let c = fiber.child; c !== null; c = c.sibling) commitLayoutEffects(c);
    if (isFnFiber(fiber) && fiber.flags & Update) commitHookEffectListMount(HookLayout | HookHasEffect, fiber);
    if (fiber.tag === ClassComponent && fiber.flags & Update) commitClassLayout(fiber);
    if (fiber.tag === Profiler && fiber.flags & Update) commitProfiler(fiber);
    if ((fiber.tag === HostComponent || fiber.tag === ClassComponent) && fiber.flags & Ref) {
      if (fiber.alternate !== null && fiber.alternate.ref !== fiber.ref) detachRef(fiber.alternate); // the ref changed: detach the old one
      if (fiber.ref) attachRef(fiber);
    }
  }
  // <Profiler onRender>: called after each commit in which something inside it rendered.
  // ReactLite has no real clock, so it counts 1 ms per component that rendered (actual) and per component inside (base).
  function commitProfiler(fiber) {
    const props = fiber.memoizedProps;
    let base = 0;
    const count = f => { for (let c = f.child; c !== null; c = c.sibling) { if (c.tag === FunctionComponent || c.tag === ClassComponent || c.tag === ForwardRef || c.tag === MemoComponent) base++; count(c); } };
    count(fiber);
    const phase = fiber.alternate === null ? 'mount' : 'update';
    trace('profilerRender', { fiber, phase, actual: fiber.profiled, base });
    if (typeof props.onRender === 'function') props.onRender(props.id, phase, fiber.profiled, base, 0, 0);
  }
  function commitClassLayout(fiber) {
    const instance = fiber.stateNode, prev = fiber.alternate;
    if (prev === null) { if (instance.componentDidMount) { trace('classLifecycle', { fiber, method: 'componentDidMount' }); instance.componentDidMount(); } }
    else if (fiber.classShouldUpdate && instance.componentDidUpdate) {
      trace('classLifecycle', { fiber, method: 'componentDidUpdate' });
      instance.componentDidUpdate(prev.memoizedProps, prev.memoizedState, instance.__snapshot);
      instance.__snapshot = undefined;
    }
    if (fiber.capturedError) {
      const { value, componentStack: stack } = fiber.capturedError;
      fiber.capturedError = null;
      if (instance.componentDidCatch) { trace('classLifecycle', { fiber, method: 'componentDidCatch' }); instance.componentDidCatch(value, { componentStack: stack }); }
      // React 19: every error caught by a boundary is also reported to createRoot(el, { onCaughtError })
      const opts = rootOf(fiber).options;
      if (opts && opts.onCaughtError) { trace('rootErrorOption', { option: 'onCaughtError' }); opts.onCaughtError(value, { componentStack: stack, errorBoundary: instance }); }
    }
    if (fiber.classCallbacks) { const cbs = fiber.classCallbacks; fiber.classCallbacks = null; cbs.forEach(cb => cb.call(instance)); }
  }

  function commitHookEffectListUnmount(flags, fiber) {
    const queue = fiber.updateQueue;
    if (!queue || !queue.lastEffect) return;
    const first = queue.lastEffect.next;
    let effect = first;
    do {
      if ((effect.tag & flags) === flags && effect.destroy) {
        const destroy = effect.destroy;
        effect.destroy = undefined;
        trace('effectCleanup', { fiber, layout: !!(flags & HookLayout), insertion: !!(flags & HookInsertion) });
        destroy();
      }
      effect = effect.next;
    } while (effect !== first);
  }
  function commitHookEffectListMount(flags, fiber) {
    const queue = fiber.updateQueue;
    if (!queue || !queue.lastEffect) return;
    const first = queue.lastEffect.next;
    let effect = first;
    do {
      if ((effect.tag & flags) === flags) {
        trace('effectRun', { fiber, layout: !!(flags & HookLayout), insertion: !!(flags & HookInsertion) });
        const destroy = effect.create();
        if (destroy !== undefined && typeof destroy !== 'function') {
          // React only warns (in development) and ignores the value
          console.error('Warning: An effect function must not return anything besides a function, which is used for clean-up.' + (isThenable(destroy) ? ' It looks like you wrote useEffect(async () => ...) or returned a Promise. Instead, write the async function inside your effect and call it immediately.' : ''));
          effect.destroy = undefined;
        } else effect.destroy = destroy;
      }
      effect = effect.next;
    } while (effect !== first);
  }

  // useEffect callbacks: after the browser has painted. All cleanups run first, then all effects.
  function flushPassiveEffects() {
    const root = pendingPassiveRoot;
    if (root === null) return false;
    pendingPassiveRoot = null;
    trace('passiveStart', { root });
    pendingPassiveUnmounts.splice(0).forEach(({ fiber, effect, hidden }) => {
      const destroy = effect.destroy;
      effect.destroy = undefined;
      if (destroy) { trace('effectCleanup', { fiber, unmount: !hidden, hidden: !!hidden }); destroy(); }
    });
    const walk = (fiber, fn) => {
      if (fiber.tag === OffscreenComponent && fiber.memoizedProps.mode === 'hidden') return; // hidden content: no useEffect
      if (fiber.subtreeFlags & Passive) for (let c = fiber.child; c !== null; c = c.sibling) walk(c, fn);
      if (isFnFiber(fiber) && fiber.flags & Passive) fn(fiber);
    };
    walk(root.current, f => commitHookEffectListUnmount(HookPassive | HookHasEffect, f));
    walk(root.current, f => commitHookEffectListMount(HookPassive | HookHasEffect, f));
    pendingPassiveReappear.splice(0).forEach(f => runEffectsWithout(HookPassive, f)); // <Activity> shown again
    if (strictMounted.length) {
      // StrictMode (development): unmount and mount every new component once more, to check that cleanups work
      const list = strictMounted.splice(0);
      trace('strictEffects', { count: list.length });
      list.forEach(f => { if (isFnFiber(f)) commitHookEffectListUnmount(HookLayout, f); else if (f.stateNode.componentWillUnmount) f.stateNode.componentWillUnmount(); });
      list.forEach(f => { if (isFnFiber(f)) commitHookEffectListUnmount(HookPassive, f); });
      list.forEach(f => { if (isFnFiber(f)) commitHookEffectListMount(HookLayout, f); else if (f.stateNode.componentDidMount) f.stateNode.componentDidMount(); });
      list.forEach(f => { if (isFnFiber(f)) commitHookEffectListMount(HookPassive, f); });
    }
    trace('passiveEnd', { root });
    return true;
  }

  function flushSync(fn) {
    const prev = currentEventLane;
    currentEventLane = SyncLane;
    let result;
    try { if (fn) result = fn(); } finally { currentEventLane = prev; }
    // render any root with sync work right now instead of in a microtask
    roots.forEach(r => { if (r.pendingLanes & SyncLane) performWorkOnRoot(r, true); });
    return result;
  }

  // ---------------------------------------------------------------- events: one listener per type, on the root (and on each portal)
  const roots = [];
  const EVENT_PROPS = {
    click: 'onClick', dblclick: 'onDoubleClick', input: 'onInput', change: 'onChange', submit: 'onSubmit', keydown: 'onKeyDown', keyup: 'onKeyUp',
    mousedown: 'onMouseDown', mouseup: 'onMouseUp', focusin: 'onFocus', focusout: 'onBlur',
  };
  const EVENT_TYPES = Object.keys(EVENT_PROPS);
  const listening = new Set();
  function listenToAllSupportedEvents(container) {
    if (listening.has(container)) return;
    listening.add(container);
    EVENT_TYPES.forEach(type => container.addEventListener(type, nativeEvent => dispatchEvent(type, nativeEvent, container)));
  }
  function dispatchEvent(type, nativeEvent, container) {
    const prop = EVENT_PROPS[type];
    // start at the clicked DOM node (or the closest one React made) and walk up the FIBER tree, not the DOM:
    // that is why events from a portal reach the components that render the portal
    // selective hydration: the click landed in server HTML that is not hydrated yet: hydrate that boundary NOW
    // (Sync priority, before any other boundary), then replay the event on the hydrated components
    for (let n = nativeEvent.target; n && n !== container && !n.__reactFiber; n = n.parentNode) {
      const b = n.__dehydratedBoundary;
      if (!b) continue;
      const boundary = b.memoizedState && b.memoizedState.dehydrated ? b : b.alternate && b.alternate.memoizedState && b.alternate.memoizedState.dehydrated ? b.alternate : null;
      if (!boundary || nativeEvent.__replayed) break;
      trace('selectiveHydration', { fiber: boundary, type });
      const root = rootOf(boundary);
      scheduleUpdateOnFiber(root, boundary, SyncLane);
      performWorkOnRoot(root, true);
      nativeEvent.__replayed = true;
      return dispatchEvent(type, nativeEvent, container);
    }
    let node = nativeEvent.target;
    while (node && !node.__reactFiber) { if (node === container) return; node = node.parentNode; }
    if (!node) return;
    const target = node.__reactFiber;
    let owner = target;
    while (owner !== null && owner.tag !== HostRoot && owner.tag !== HostPortal) owner = owner.return;
    if (owner === null || owner.stateNode.containerInfo !== container) return; // another root / portal listener handles it
    const bubble = [], capture = [];
    for (let f = target; f !== null; f = f.return) {
      if (f.tag !== HostComponent) continue;
      const props = f.stateNode.__reactProps || f.memoizedProps;
      const handler = props[prop] || (type === 'input' ? props.onChange : null);
      if (handler) bubble.push({ node: f.stateNode, handler });
      if (props[prop + 'Capture']) capture.unshift({ node: f.stateNode, handler: props[prop + 'Capture'] });
    }
    // React 19 form actions: <form action={fn}> runs fn(formData) in a transition instead of submitting the page
    let formDom = null;
    if (type === 'submit') for (let f = target; f !== null; f = f.return) if (f.tag === HostComponent && f.type === 'form') { formDom = f.stateNode; break; }
    const formAction = formDom && formDom.__reactProps && typeof formDom.__reactProps.action === 'function' ? formDom.__reactProps.action : null;
      // controlled inputs: after the event (and the Sync re-render), React puts the DOM value back to the value prop
      if ((type === "input" || type === "change") && target.tag === HostComponent) {
        const dom = target.stateNode;
        queueMicrotask(() => { const p = dom.__reactProps; if (p && p.value != null && dom.value !== String(p.value)) { dom.value = p.value; trace("restoreControlled", { fiber: dom.__reactFiber }); } });
      }
    if (!bubble.length && !capture.length && !formAction) return;
    let stopped = false;
    const event = {
      type, target: nativeEvent.target, currentTarget: null, nativeEvent, key: nativeEvent.key, defaultPrevented: false,
      stopPropagation() { stopped = true; }, isPropagationStopped() { return stopped; },
      preventDefault() { event.defaultPrevented = true; nativeEvent.preventDefault(); }, persist() {},
    };
    const path = []; for (let f = target; f !== null; f = f.return) if (f.tag === HostComponent || f.tag === HostRoot || f.tag === HostPortal) { const p = f.tag === HostComponent ? (f.stateNode.__reactProps || f.memoizedProps) : {}; path.push({ name: f.tag === HostRoot ? 'root container' : f.tag === HostPortal ? 'portal container' : fiberLabel(f) + (f.stateNode.id ? ' #' + f.stateNode.id : ''), handler: !!(p[prop] || (type === 'input' && p.onChange)), capture: !!p[prop + 'Capture'] }); }
    trace('event', { type, count: bubble.length + capture.length, capture: capture.length, path, prop });
    const prevLane = currentEventLane;
    currentEventLane = SyncLane; // discrete events (clicks, typing) get the highest priority
    executionContext |= BatchedContext;
    try {
      for (const { node: n, handler } of capture.concat(bubble)) { event.currentTarget = n; handler(event); if (stopped) break; }
      if (formAction && !event.defaultPrevented) { nativeEvent.preventDefault(); runFormAction(formDom, formAction); }
    } finally {
      currentEventLane = prevLane;
      executionContext &= ~BatchedContext;
    }
  }

  // ---------------------------------------------------------------- hydration (hydrateRoot): adopt the server's HTML
  let isHydrating = false, nextHydratable = null;
  const HYDRATION_MISMATCH = { hydrationMismatch: true };
  // comments (like the <!-- --> React puts between two text nodes) are skipped
  function firstHydratable(node) { while (node && node.nodeType === 8) node = node.nextSibling; return node || null; }
  function nextHydratableSibling(node) { return firstHydratable(node.nextSibling); }
  function describeNode(node) { return !node ? 'nothing' : node.nodeType === 3 ? 'the text "' + node.nodeValue + '"' : '<' + String(node.nodeName).toLowerCase() + '>'; }
  function claimHydratable(wip) {
    const node = nextHydratable;
    const ok = wip.tag === HostComponent
      ? node !== null && node.nodeType === 1 && String(node.nodeName).toLowerCase() === wip.type
      : node !== null && node.nodeType === 3 && node.nodeValue === String(wip.pendingProps);
    if (!ok) hydrationMismatch(wip, node, wip.tag === HostText && node && node.nodeType === 3 ? 'text' : 'missing');
    wip.stateNode = node;
    trace('hydrateClaim', { fiber: wip });
    nextHydratable = wip.tag === HostComponent ? firstHydratable(node.firstChild) : nextHydratableSibling(node);
  }
  function mismatchMessage(fiber, node, kind) {
    if (kind === 'text') return 'Warning: Text content did not match. Server: "' + node.nodeValue + '" Client: "' + fiber.pendingProps + '"';
    if (kind === 'extra') return 'Warning: Did not expect server HTML to contain ' + describeNode(node) + '.';
    const want = fiber.tag === HostText ? 'the text "' + fiber.pendingProps + '"' : '<' + fiber.type + '>';
    return 'Warning: Expected server HTML to contain a matching ' + want + ', but found ' + describeNode(node) + '.';
  }
  function hydrationMismatch(fiber, node, kind) {
    console.error(mismatchMessage(fiber, node, kind));
    throw HYDRATION_MISMATCH;
  }
  function failHydration(root, kind, node) {
    if (kind) console.error(mismatchMessage(null, node, kind));
    const failure = 'Hydration failed because the initial UI does not match what was rendered on the server. React throws the server HTML away and renders the whole root on the client.';
    // React 19: hydrateRoot(el, app, { onRecoverableError }) gets errors React recovered from
    if (root.options.onRecoverableError) { trace('rootErrorOption', { option: 'onRecoverableError' }); root.options.onRecoverableError(new Error(failure), { componentStack: '' }); }
    else console.error('Error: ' + failure);
    trace('hydrationFailed', { root });
    const insideLoop = !kind;
    abandonRender();
    renderAbandoned = insideLoop;
    isHydrating = false;
    root.hydrate = false;
    const c = root.containerInfo;
    while (c.firstChild) c.removeChild(c.firstChild);
    root.callbackLane = NoLanes;
    ensureRootIsScheduled(root);
  }

  // ---------------------------------------------------------------- server rendering (react-dom/server)
  let ssrRendering = false;
  const VOID_TAGS = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];
  const UNITLESS = ['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'flex', 'flexGrow', 'flexShrink', 'order', 'zoom', 'gridRow', 'gridColumn'];
  const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  function styleToString(style) {
    return Object.keys(style).filter(k => style[k] != null && style[k] !== '').map(k => kebab(k) + ':' + (typeof style[k] === 'number' && style[k] !== 0 && !UNITLESS.includes(k) ? style[k] + 'px' : style[k])).join(';');
  }
  function renderAttrs(type, props) {
    let out = '';
    for (const key in props) {
      let v = props[key];
      if (key === 'children' || key === 'dangerouslySetInnerHTML' || key === 'key' || key === 'ref' || isEvent(key) || typeof v === 'function' || v === undefined || v === null || v === false) continue;
      if (type === 'textarea' && (key === 'value' || key === 'defaultValue')) continue;
      let name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key === 'defaultValue' ? 'value' : key === 'defaultChecked' ? 'checked' : key;
      if (key === 'style') { v = styleToString(v); if (!v) continue; }
      out += v === true ? ' ' + name + '=""' : ' ' + name + '="' + escapeHtml(v) + '"';
    }
    return out;
  }
  function renderComponentForServer(Component, props) {
    const fiber = createFiber(FunctionComponent, props, null);
    fiber.type = Component;
    const saved = [currentlyRenderingFiber, currentHook, workInProgressHook, isMounting, renderLanesForHooks];
    currentlyRenderingFiber = fiber; currentHook = null; workInProgressHook = null; isMounting = true; renderLanesForHooks = SyncLane;
    try { return Component(props); }
    finally { [currentlyRenderingFiber, currentHook, workInProgressHook, isMounting, renderLanesForHooks] = saved; }
  }
  // markers: <!-- --> between two text nodes, <!--$-->…<!--/$--> around Suspense content (so hydration can find them)
  function serverRender(node, ctx) {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') {
      const text = escapeHtml(node);
      const out = ctx.lastWasText && ctx.markers ? '<!-- -->' + text : text;
      ctx.lastWasText = true;
      return out;
    }
    if (Array.isArray(node)) return node.map(c => serverRender(c, ctx)).join('');
    if (node.$$typeof === REACT_PORTAL) throw new Error('Portals are not currently supported by the server renderer. Render them conditionally so that they only appear on the client render.');
    if (node.$$typeof !== REACT_ELEMENT) throw new Error('Objects are not valid as a React child (found: object with keys {' + Object.keys(node).join(', ') + '}).');
    const { type, props } = node;
    if (typeof type === 'string') {
      ctx.lastWasText = false;
      const open = '<' + type + renderAttrs(type, props) + '>';
      if (VOID_TAGS.includes(type)) return open;
      let inner = props.dangerouslySetInnerHTML ? props.dangerouslySetInnerHTML.__html
        : type === 'textarea' ? escapeHtml(props.value != null ? props.value : props.defaultValue != null ? props.defaultValue : '') : serverRender(props.children, ctx);
      ctx.lastWasText = false;
      return open + inner + '</' + type + '>';
    }
    if (type === REACT_FRAGMENT || type === REACT_STRICT_MODE || type === REACT_PROFILER) return serverRender(props.children, ctx);
    if (type === REACT_SUSPENSE) {
      const saveText = ctx.lastWasText;
      try {
        const html = serverRender(props.children, ctx);
        return ctx.markers ? '<!--$-->' + html + '<!--/$-->' : html;
      } catch (e) {
        if (!isThenable(e)) throw e;
        ctx.lastWasText = saveText;
        if (ctx.stream) {
          // streaming: send the fallback now with a placeholder, and stream the content when the data is ready
          const id = ctx.stream.next++;
          ctx.stream.waiting.push({ id, children: props.children, promise: e });
          trace('streamFallback', { id });
          return '<!--$?--><template id="B:' + id + '"></template>' + serverRender(props.fallback, ctx) + '<!--/$-->';
        }
        if (ctx.waitAll) throw e; // prerender: wait for the data and render again
        // renderToString can't wait: it sends the fallback, and the client renders the content later
        trace('ssrFallback', {});
        const html = serverRender(props.fallback, ctx);
        return ctx.markers ? '<!--$!-->' + html + '<!--/$-->' : html;
      }
    }
    if (type && (type.$$typeof === REACT_PROVIDER || type.$$typeof === REACT_CONTEXT)) {
      const context = type._context, prev = context._currentValue;
      context._currentValue = props.value;
      try { return serverRender(props.children, ctx); } finally { context._currentValue = prev; }
    }
    if (type && type.$$typeof === REACT_CONSUMER) return serverRender(props.children(type._context._currentValue), ctx);
    if (type && type.$$typeof === REACT_MEMO) return serverRender({ $$typeof: REACT_ELEMENT, type: type.type, key: null, ref: node.ref, props }, ctx);
    if (type && type.$$typeof === REACT_FORWARD_REF) return serverRender(renderComponentForServer(p => type.render(p, null), props), ctx);
    if (type && type.$$typeof === REACT_LAZY) return serverRender({ $$typeof: REACT_ELEMENT, type: resolveLazy(type), key: null, ref: null, props }, ctx);
    if (typeof type === 'function' && type.prototype && type.prototype.isReactComponent) {
      const instance = new type(props);
      instance.props = props;
      let state = instance.state === undefined ? null : instance.state;
      if (type.getDerivedStateFromProps) { const part = type.getDerivedStateFromProps(props, state); if (part != null) state = Object.assign({}, state, part); }
      instance.state = state;
      return serverRender(instance.render(), ctx);
    }
    if (typeof type === 'function') return serverRender(renderComponentForServer(type, props), ctx);
    throw new Error('Element type is invalid for the server renderer.');
  }
  function renderToStringImpl(element, markers) {
    const savedIds = idSeq, prevSSR = ssrRendering;
    ssrRendering = true;
    trace('ssrStart', { markers });
    try { const html = serverRender(element, { lastWasText: false, markers }); trace('ssrEnd', { length: html.length }); return html; }
    finally { ssrRendering = prevSSR; idSeq = savedIds; } // the client will generate the same useId values while hydrating
  }
  // streaming SSR (like renderToPipeableStream): the "shell" goes out first, with a fallback for every Suspense
  // boundary that is still waiting; each boundary's HTML follows in its own chunk when its data is ready, with a tiny
  // script ($RC) that swaps it in place of the fallback. The browser shows content as it arrives.
  function renderToPipeableStream(element, options) {
    const opts = options || {};
    const stream = { next: 0, waiting: [] };
    const ctx = { lastWasText: false, markers: true, stream };
    let dest = null, ended = false, pending = 0;
    const out = [];
    const write = chunk => { if (dest) dest.write(chunk); else out.push(chunk); };
    const finish = () => {
      if (ended || pending > 0 || stream.waiting.length) return;
      ended = true;
      trace('streamEnd', {});
      if (opts.onAllReady) opts.onAllReady();
      if (dest && dest.end) dest.end();
    };
    const startWaiting = () => {
      stream.waiting.splice(0).forEach(b => {
        pending++;
        const retry = () => {
          pending--;
          const prevSSR = ssrRendering;
          ssrRendering = true;
          let html;
          try { html = serverRender(b.children, { lastWasText: false, markers: true, stream }); }
          finally { ssrRendering = prevSSR; }
          trace('streamChunk', { id: b.id, length: html.length });
          write('<div hidden id="S:' + b.id + '">' + html + '</div><script>$RC("B:' + b.id + '","S:' + b.id + '")</script>');
          startWaiting(); // the boundary may contain more boundaries that are still waiting
          finish();
        };
        b.promise.then(retry, retry);
      });
    };
    const prevSSR = ssrRendering;
    ssrRendering = true;
    trace('ssrStart', { markers: true, stream: true });
    let shell;
    try { shell = serverRender(element, ctx); } finally { ssrRendering = prevSSR; }
    trace('streamShell', { length: shell.length, waiting: stream.waiting.length });
    write(shell);
    startWaiting();
    queueMicrotask(() => { if (opts.onShellReady) opts.onShellReady(); finish(); });
    return {
      pipe(destination) { dest = destination; out.splice(0).forEach(c => dest.write(c)); if (ended && dest.end) dest.end(); return destination; },
      abort() { ended = true; },
    };
  }
  const ReactDOMServer = {
    renderToString: element => renderToStringImpl(element, true),
    renderToStaticMarkup: element => renderToStringImpl(element, false),
    renderToPipeableStream,
  };

  // ---------------------------------------------------------------- React Server Components (the "Flight" protocol)
  // Server: render server components (they may be async) to a text payload of rows. Client components are only
  // REFERENCES (what "use client" makes the bundler create); server functions are references too ("use server").
  // Client: turn the payload back into React elements, plugging in the real client components from a module map.
  const REACT_CLIENT_REFERENCE = Symbol.for('react.client.reference');
  const REACT_SERVER_REFERENCE = Symbol.for('react.server.reference');
  const serverFunctions = new Map();
  let flightRendering = false;
  function registerClientReference(id) { return { $$typeof: REACT_CLIENT_REFERENCE, $$id: id }; }
  function registerServerReference(fn, id) { fn.$$typeof = REACT_SERVER_REFERENCE; fn.$$id = id; serverFunctions.set(id, fn); return fn; }
  async function renderToFlight(model) {
    const rows = [];
    let nextId = 1;
    const ids = new Map();
    const refRow = (key, make) => { if (!ids.has(key)) { const id = nextId++; ids.set(key, id); rows.push(id + ':' + make()); } return ids.get(key); };
    trace('flightStart', {});
    const prevCache = cacheScope;
    cacheScope = new Map(); // cache() remembers results for this request only
    const serializeProps = async props => { const out = {}; for (const k in props) out[k] = await serialize(props[k], k); return out; };
    async function serialize(node, propName) {
      if (node === undefined || node === null) return null;
      if (typeof node === 'boolean' || typeof node === 'number') return node;
      if (typeof node === 'string') return node[0] === '$' ? '$' + node : node; // "$" starts a reference, so escape it
      if (Array.isArray(node)) { const out = []; for (const c of node) out.push(await serialize(c)); return out; }
      if (typeof node === 'function') {
        if (node.$$typeof === REACT_SERVER_REFERENCE) {
          const id = refRow('fn:' + node.$$id, () => 'F' + JSON.stringify({ id: node.$$id }));
          trace('flightServerRef', { name: node.$$id });
          return '$F' + id;
        }
        throw new Error('Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". (prop: ' + propName + ')');
      }
      if (node.$$typeof === REACT_ELEMENT) {
        const { type, props, key } = node;
        if (typeof type === 'string') return ['$', type, key, await serializeProps(props)];
        if (type && type.$$typeof === REACT_CLIENT_REFERENCE) {
          const id = refRow('client:' + type.$$id, () => 'I' + JSON.stringify([type.$$id]));
          trace('flightClientRef', { name: type.$$id });
          return ['$', '$L' + id, key, await serializeProps(props)];
        }
        if (type === REACT_FRAGMENT) return serialize(props.children);
        if (type === REACT_SUSPENSE) return ['$', '$Sreact.suspense', key, await serializeProps(props)];
        if (typeof type === 'function') {
          // a server component: runs here only (it may await data), its code never reaches the browser
          trace('flightServerComponent', { name: type.name || 'Anonymous' });
          const prev = flightRendering;
          flightRendering = true;
          let result;
          try { result = type(props); } finally { flightRendering = prev; }
          return serialize(isThenable(result) ? await result : result);
        }
        throw new Error('This element type is not supported in Server Components in ReactLite.');
      }
      if (typeof node === 'object') { const out = {}; for (const k in node) out[k] = await serialize(node[k], k); return out; }
      throw new Error('Only plain objects, arrays, strings, numbers, booleans, null, elements and server functions can be sent to the client.');
    }
    let root;
    try { root = await serialize(model); } finally { cacheScope = prevCache; }
    rows.push('0:' + JSON.stringify(root));
    trace('flightEnd', { rows: rows.length });
    return rows.join('\n');
  }
  // the client side: rebuild elements. $L1 = client component from row 1, $F2 = server function from row 2
  function createFromFlight(payload, moduleMap) {
    const rows = new Map();
    payload.split('\n').forEach(line => { const i = line.indexOf(':'); rows.set(line.slice(0, i), line.slice(i + 1)); });
    const refs = {};
    rows.forEach((text, id) => {
      if (text[0] === 'I') {
        const name = JSON.parse(text.slice(1))[0];
        if (!moduleMap || !moduleMap[name]) throw new Error('Could not find the module "' + name + '" in the client module map.');
        refs[id] = moduleMap[name];
      } else if (text[0] === 'F') {
        const fnId = JSON.parse(text.slice(1)).id;
        // calling a server function from the browser = a POST request; arguments and result travel as JSON
        refs[id] = async (...args) => {
          trace('serverCall', { name: fnId });
          const fn = serverFunctions.get(fnId);
          const result = await fn(...JSON.parse(JSON.stringify(args)));
          return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
        };
      }
    });
    const revive = x => {
      if (Array.isArray(x)) {
        if (x.length === 4 && x[0] === '$') {
          const tag = x[1];
          const type = tag.startsWith('$L') ? refs[tag.slice(2)] : tag === '$Sreact.suspense' ? REACT_SUSPENSE : tag;
          const props = revive(x[3]);
          return { $$typeof: REACT_ELEMENT, type, key: x[2], ref: null, props };
        }
        const list = x.map(revive);
        staticChildren.add(list); // the server already checked the keys
        return list;
      }
      if (typeof x === 'string') return x.startsWith('$$') ? x.slice(1) : x.startsWith('$F') ? refs[x.slice(2)] : x;
      if (x !== null && typeof x === 'object') { const out = {}; for (const k in x) out[k] = revive(x[k]); return out; }
      return x;
    };
    trace('flightClient', { rows: rows.size });
    return revive(JSON.parse(rows.get('0')));
  }
  const ReactServer = { renderToFlight, createFromFlight, registerClientReference, registerServerReference };

  // ---------------------------------------------------------------- forms: <form action={fn}>, useFormStatus (React 19)
  class FormDataLite {
    constructor(form) {
      this._list = [];
      if (!form) return;
      form.querySelectorAll('input, select, textarea').forEach(el => {
        const name = el.getAttribute('name');
        if (!name || el.disabled) return;
        const t = (el.getAttribute('type') || '').toLowerCase();
        if (t === 'submit' || t === 'button' || t === 'reset') return;
        if ((t === 'checkbox' || t === 'radio') && !el.checked) return;
        this._list.push([name, (t === 'checkbox' || t === 'radio') && !el.hasAttribute('value') ? 'on' : String(el.value)]);
      });
    }
    get(k) { const e = this._list.find(x => x[0] === k); return e ? e[1] : null; }
    getAll(k) { return this._list.filter(x => x[0] === k).map(x => x[1]); }
    has(k) { return this._list.some(x => x[0] === k); }
    append(k, v) { this._list.push([k, String(v)]); }
    set(k, v) { this._list = this._list.filter(x => x[0] !== k); this._list.push([k, String(v)]); }
    delete(k) { this._list = this._list.filter(x => x[0] !== k); }
    entries() { return this._list.map(x => [x[0], x[1]])[Symbol.iterator](); }
    keys() { return this._list.map(x => x[0])[Symbol.iterator](); }
    values() { return this._list.map(x => x[1])[Symbol.iterator](); }
    forEach(fn) { this._list.forEach(([k, v]) => fn(v, k, this)); }
    [Symbol.iterator]() { return this.entries(); }
  }
  const IDLE_FORM = { pending: false, data: null, method: null, action: null };
  const formStatus = new Map();
  const formListeners = new Set();
  const subscribeFormStatus = cb => { formListeners.add(cb); return () => formListeners.delete(cb); };
  function setFormStatus(form, status) { formStatus.set(form, status); formListeners.forEach(cb => cb()); }
  function useFormStatus() {
    const fiber = resolveFiber('useFormStatus');
    const formOf = () => { for (let f = fiber.return; f !== null; f = f.return) if (f.tag === HostComponent && f.type === 'form') return f.stateNode; return null; };
    return useSyncExternalStore(subscribeFormStatus, () => formStatus.get(formOf()) || IDLE_FORM, () => IDLE_FORM);
  }
  function runFormAction(form, action) {
    const data = new FormDataLite(form);
    trace('formAction', {});
    setFormStatus(form, { pending: true, data, method: 'get', action });
    const finish = () => {
      setFormStatus(form, IDLE_FORM);
      // after a successful action React resets the form's uncontrolled fields
      form.querySelectorAll('input, textarea').forEach(el => { const p = el.__reactProps; if (!p || !('value' in p)) el.value = el.defaultValue; });
    };
    startTransition(() => {
      const result = action(data);
      if (isThenable(result)) {
        pendingActions++;
        const done = () => { pendingActions--; trace('actionDone', {}); finish(); if (pendingActions === 0) flushFormResets(); };
        result.then(done, done);
      } else finish();
    });
  }

  function createPortal(children, container, key) {
    return { $$typeof: REACT_PORTAL, key: key == null ? null : String(key), children, containerInfo: container };
  }

  // ---------------------------------------------------------------- React 19 resource APIs (react-dom)
  // preload / preinit / preconnect / prefetchDNS: tell the browser early what the page will need. Each resource is
  // added to <head> once; asking again for the same one does nothing.
  const resourceKeys = new Set();
  function addResource(key, kind, href, attrs) {
    if (resourceKeys.has(key)) { trace('resourceDeduped', { kind, href }); return; }
    resourceKeys.add(key);
    const tag = kind === 'script' || kind === 'module script' ? 'script' : 'link';
    const el = document.createElement(tag);
    Object.keys(attrs).forEach(k => { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
    trace('resourceHint', { kind, href });
  }
  const preconnect = (href, o) => addResource('preconnect:' + href, 'preconnect', href, { rel: 'preconnect', href, crossorigin: o && o.crossOrigin });
  const prefetchDNS = href => addResource('dns:' + href, 'dns-prefetch', href, { rel: 'dns-prefetch', href });
  const preload = (href, o) => addResource('preload:' + href, 'preload (' + ((o && o.as) || '?') + ')', href, { rel: 'preload', href, as: o && o.as, type: o && o.type, crossorigin: o && o.crossOrigin });
  const preloadModule = href => addResource('modulepreload:' + href, 'modulepreload', href, { rel: 'modulepreload', href });
  function preinit(href, o) {
    const as = o && o.as;
    if (as === 'style') addResource('style:' + href, 'stylesheet', href, { rel: 'stylesheet', href, 'data-precedence': (o && o.precedence) || 'default' });
    else if (as === 'script') addResource('script:' + href, 'script', href, { src: href, async: '' });
    else throw new Error('preinit() needs { as: "style" } or { as: "script" }.');
  }
  const preinitModule = href => addResource('module:' + href, 'module script', href, { src: href, type: 'module', async: '' });

  // requestFormReset(form): reset a form's uncontrolled fields when the current action / transition finishes
  let pendingFormResets = [];
  function resetFormFields(form) { form.querySelectorAll('input, textarea').forEach(el => { const p = el.__reactProps; if (!p || !('value' in p)) el.value = el.defaultValue; }); }
  function flushFormResets() { pendingFormResets.splice(0).forEach(f => { resetFormFields(f); trace('formReset', {}); }); }
  function requestFormReset(form) {
    if (!isInsideTransition && pendingActions === 0) throw new Error('requestFormReset was called outside a transition or action. To fix, move to an action, or wrap with startTransition.');
    pendingFormResets.push(form);
    trace('formResetRequested', {});
  }

  // cache(fn) (server components): within one server request, the same arguments give the same result, so two
  // components asking for the same data share one call. Outside a request it does not remember anything.
  let cacheScope = null;
  const CACHE_RESULT = Symbol('result');
  function cache(fn) {
    return function cached(...args) {
      if (cacheScope === null) return fn(...args);
      let node = cacheScope.get(fn);
      if (!node) { node = new Map(); cacheScope.set(fn, node); }
      for (const a of args) { let next = node.get(a); if (!next) { next = new Map(); node.set(a, next); } node = next; }
      const label = (fn.name || 'fn') + '(' + args.map(a => (typeof a === 'object' && a !== null ? '{…}' : String(a))).join(', ') + ')';
      if (node.has(CACHE_RESULT)) { trace('cacheHit', { name: label }); return node.get(CACHE_RESULT); }
      trace('cacheMiss', { name: label });
      const value = fn(...args);
      node.set(CACHE_RESULT, value);
      return value;
    };
  }

  // react-dom/static prerender(): like renderToString, but it WAITS for every Suspense boundary's data, so the
  // HTML has no fallbacks (for static site generation, at build time)
  async function prerender(element) {
    trace('staticStart', {});
    for (let attempt = 1; attempt <= 30; attempt++) {
      const prevSSR = ssrRendering;
      ssrRendering = true;
      try {
        const html = serverRender(element, { lastWasText: false, markers: true, waitAll: true });
        trace('staticEnd', { length: html.length, attempts: attempt });
        return { prelude: html };
      } catch (e) {
        if (!isThenable(e)) throw e;
        trace('staticWait', { attempt });
        await e;
      } finally { ssrRendering = prevSSR; }
    }
    throw new Error('prerender gave up: the data never became ready.');
  }
  const ReactDOMStatic = { prerender };

  const ReactDOM = {
    createRoot(container, options) { const r = createRoot(container, options); roots.push(r._internalRoot); return r; },
    // hydrateRoot: the container already holds server HTML; the first render adopts it instead of creating DOM
    hydrateRoot(container, element, options) { const r = createRoot(container, options); r._internalRoot.hydrate = true; roots.push(r._internalRoot); r.render(element); return r; },
    flushSync, createPortal, preload, preloadModule, preinit, preinitModule, preconnect, prefetchDNS, requestFormReset,
  };
  const React = {
    version: '18.3 (ReactLite)',
    createElement, cloneElement, isValidElement, Children, Fragment: REACT_FRAGMENT, StrictMode: REACT_STRICT_MODE, Suspense: REACT_SUSPENSE,
    Component, PureComponent, createContext, memo, forwardRef, lazy, startTransition,
    useState, useReducer, useEffect, useLayoutEffect, useInsertionEffect, useRef, useMemo, useCallback, useContext, useTransition,
    useDeferredValue, useId, useSyncExternalStore, useImperativeHandle, useDebugValue, useOptimistic, useActionState, use, useFormStatus,
    Activity: REACT_ACTIVITY, useEffectEvent, Profiler: REACT_PROFILER, cache,
  };
  const ReactCompilerRuntime = { c: useMemoCache }; // import { c as _c } from "react/compiler-runtime"
  return { React, ReactDOM, ReactDOMServer, FormData: FormDataLite, ReactCompilerRuntime, ReactServer, ReactDOMStatic };
};
