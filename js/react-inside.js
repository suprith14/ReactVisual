/*
 * React Engine Lab — the "Inside" view of the React panel.
 * Top: React's whole pipeline, with the station of the current step lit.
 * Below: a diagram of exactly what React is doing at this step (from snap.reactDetail), what to notice,
 * and the one-sentence answer to say in an interview.
 */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const STATIONS = [
    { id: 'trigger', label: 'Trigger', tip: 'a click, a timer, root.render…' },
    { id: 'update', label: 'Update queued', tip: 'setState adds an update to the hook\'s queue' },
    { id: 'schedule', label: 'Scheduled', tip: 'the update has a lane (priority); React plans a render' },
    { id: 'render', label: 'Render', tip: 'work loop: beginWork ↓ calls components, completeWork ↑ prepares DOM' },
    { id: 'reconcile', label: 'Reconcile', tip: 'new elements vs old fibers: keep, move, create, delete' },
    { id: 'mutation', label: 'Commit: DOM', tip: 'all DOM changes applied at once' },
    { id: 'swap', label: 'Swap trees', tip: 'root.current = the finished tree' },
    { id: 'layout', label: 'Layout effects', tip: 'useLayoutEffect, refs, componentDidMount — before paint' },
    { id: 'paint', label: 'Paint', tip: 'the browser shows the new screen' },
    { id: 'passive', label: 'useEffect', tip: 'passive effects run after paint' },
  ];
  function stationOf(d, phase) {
    if (!d) return -1;
    switch (d.kind) {
      case 'event': case 'root': return 0;
      case 'update': return 1;
      case 'schedule': return 2;
      case 'queue': case 'workloop': case 'complete': case 'boundary': case 'context': return 3;
      case 'reconcile': return 4;
      case 'commit': return 5;
      case 'swap': return 6;
      case 'effects': return d.passive ? 9 : 7;
      case 'paint': return 8;
      case 'server': return 3;
      default: return -1;
    }
  }

  // what to say in an interview about this step (one sentence)
  const SAY = {
    root: 'createRoot makes a FiberRoot and a HostRoot fiber and attaches one listener per event type on the container (event delegation).',
    event: 'React listens once on the root; it walks from the target fiber up to the root collecting handlers, calls them with a synthetic event, and gives their updates the Sync lane so they are batched.',
    update: 'setState doesn\'t change the variable: it appends an update to the hook\'s circular queue, marks the fiber\'s lanes and its parents\' childLanes, and schedules a render.',
    schedule: 'Each update has a lane (a priority bit). Sync work renders in a microtask after the event; Default and Transition work runs in a scheduler task, and transitions can be time-sliced and interrupted.',
    queue: 'During render, useState processes its queue in order from the base state; lower-priority updates are skipped and kept (rebased) for a later render, so the final result is as if all ran in order.',
    workloop: 'The work loop walks the fiber tree depth-first: beginWork on the way down (call the component or bail out if nothing changed), completeWork on the way up; it can pause between fibers.',
    complete: 'completeWork creates or diffs DOM nodes off-screen and records an Update flag; nothing touches the page until the commit.',
    reconcile: 'Reconciliation matches new elements with old fibers by type and key: same → keep the fiber and state, moved → Placement, new → create, missing → delete.',
    commit: 'The commit applies all recorded flags in one synchronous pass, so the user never sees a half-updated UI.',
    swap: 'Double buffering: the finished work-in-progress tree becomes current with one assignment; the old tree stays as the alternate for the next render.',
    effects: 'Layout effects run synchronously after the DOM changes and before paint; passive effects (useEffect) run after paint, all cleanups first, then all new effects, children before parents.',
    paint: 'After the commit the browser paints; React has scheduled the useEffect callbacks for a later task.',
    boundary: 'When a component throws during render, React walks up to the nearest Suspense boundary (for a Promise) or error boundary (for an Error), throws away the unfinished work below it and renders it again with the fallback.',
    context: 'When a provider value changes, React walks the subtree below it, checks the list of contexts each fiber reads, and gives every reader the render lane (and childLanes up the path), so readers re-render even below a memo that bails out.',
    server: 'On the server React renders HTML strings; hydrateRoot later adopts that DOM node by node instead of creating it, then attaches handlers.',
  };

  // ---------------------------------------------------------------- where this step lives in the real React source
  // [function, module] pairs; modules are files in github.com/facebook/react (packages/react-reconciler unless named)
  const SOURCE = {
    createRoot: [['createRoot', 'ReactDOMRoot'], ['createFiberRoot', 'ReactFiberRoot'], ['listenToAllSupportedEvents', 'DOMPluginEventSystem']],
    rootRender: [['updateContainer', 'ReactFiberReconciler'], ['enqueueUpdate', 'ReactFiberClassUpdateQueue']],
    setState: [['dispatchSetState', 'ReactFiberHooks'], ['enqueueConcurrentHookUpdate', 'ReactFiberConcurrentUpdates'], ['scheduleUpdateOnFiber', 'ReactFiberWorkLoop']],
    eagerBailout: [['dispatchSetState', 'ReactFiberHooks'], ['objectIs', 'shared/objectIs']],
    classSetState: [['enqueueSetState', 'ReactFiberClassComponent'], ['scheduleUpdateOnFiber', 'ReactFiberWorkLoop']],
    forceUpdate: [['enqueueForceUpdate', 'ReactFiberClassComponent']],
    scheduleSync: [['ensureRootIsScheduled', 'ReactFiberRootScheduler'], ['scheduleImmediateRootScheduleTask', 'ReactFiberRootScheduler']],
    scheduleTask: [['ensureRootIsScheduled', 'ReactFiberRootScheduler'], ['scheduleCallback', 'scheduler/Scheduler'], ['performWorkOnRootViaSchedulerTask', 'ReactFiberRootScheduler']],
    transition: [['startTransition', 'ReactFiberHooks'], ['requestUpdateLane', 'ReactFiberWorkLoop']],
    renderStart: [['performWorkOnRoot', 'ReactFiberWorkLoop'], ['prepareFreshStack', 'ReactFiberWorkLoop'], ['createWorkInProgress', 'ReactFiber']],
    resume: [['renderRootConcurrent', 'ReactFiberWorkLoop'], ['workLoopConcurrent', 'ReactFiberWorkLoop']],
    yield: [['workLoopConcurrent', 'ReactFiberWorkLoop'], ['shouldYield', 'scheduler/Scheduler']],
    interrupt: [['performWorkOnRoot', 'ReactFiberWorkLoop'], ['prepareFreshStack', 'ReactFiberWorkLoop']],
    beginWork: [['performUnitOfWork', 'ReactFiberWorkLoop'], ['beginWork', 'ReactFiberBeginWork'], ['renderWithHooks', 'ReactFiberHooks']],
    rendered: [['reconcileChildren', 'ReactFiberBeginWork']],
    bailout: [['attemptEarlyBailoutIfNoUpdate', 'ReactFiberBeginWork'], ['bailoutOnAlreadyFinishedWork', 'ReactFiberBeginWork'], ['cloneChildFibers', 'ReactChildFiber']],
    bailoutSubtree: [['bailoutOnAlreadyFinishedWork', 'ReactFiberBeginWork'], ['includesSomeLane', 'ReactFiberLane']],
    renderBailout: [['updateFunctionComponent', 'ReactFiberBeginWork'], ['bailoutHooks', 'ReactFiberHooks']],
    memoBailout: [['updateMemoComponent', 'ReactFiberBeginWork'], ['shallowEqual', 'shared/shallowEqual']],
    contextChanged: [['updateContextProvider', 'ReactFiberBeginWork'], ['propagateContextChange', 'ReactFiberNewContext']],
    processUpdates: [['updateReducer', 'ReactFiberHooks'], ['processUpdateQueue', 'ReactFiberClassUpdateQueue']],
    effectSkipped: [['updateEffectImpl', 'ReactFiberHooks'], ['areHookInputsEqual', 'ReactFiberHooks']],
    memoHit: [['updateMemo', 'ReactFiberHooks'], ['areHookInputsEqual', 'ReactFiberHooks']],
    memoMiss: [['updateMemo', 'ReactFiberHooks']],
    reconciled: [['reconcileChildFibers', 'ReactChildFiber'], ['reconcileChildrenArray', 'ReactChildFiber']],
    diffProps: [['completeWork', 'ReactFiberCompleteWork'], ['updateHostComponent', 'ReactFiberCompleteWork']],
    createDOM: [['completeWork', 'ReactFiberCompleteWork'], ['createInstance', 'ReactFiberConfigDOM'], ['appendAllChildren', 'ReactFiberCompleteWork']],
    commitStart: [['commitRoot', 'ReactFiberWorkLoop'], ['commitMutationEffects', 'ReactFiberCommitWork']],
    placement: [['commitPlacement', 'ReactFiberCommitHostEffects'], ['insertOrAppendPlacementNode', 'ReactFiberCommitHostEffects']],
    deletion: [['commitDeletionEffects', 'ReactFiberCommitWork']],
    commitUpdate: [['commitUpdate', 'ReactFiberConfigDOM'], ['updateProperties', 'ReactDOMComponent']],
    commitText: [['commitTextUpdate', 'ReactFiberConfigDOM']],
    swap: [['commitRoot', 'ReactFiberWorkLoop']],
    refAttached: [['commitAttachRef', 'ReactFiberCommitEffects']],
    schedulePassive: [['commitRoot', 'ReactFiberWorkLoop'], ['flushPassiveEffects', 'ReactFiberWorkLoop']],
    commitEnd: [['commitRoot', 'ReactFiberWorkLoop']],
    passiveStart: [['flushPassiveEffects', 'ReactFiberWorkLoop'], ['commitPassiveUnmountEffects', 'ReactFiberCommitWork'], ['commitPassiveMountEffects', 'ReactFiberCommitWork']],
    passiveEnd: [['flushPassiveEffects', 'ReactFiberWorkLoop']],
    effectRun: [['commitHookEffectListMount', 'ReactFiberCommitEffects']],
    effectCleanup: [['commitHookEffectListUnmount', 'ReactFiberCommitEffects']],
    event: [['dispatchEvent', 'ReactDOMEventListener'], ['accumulateSinglePhaseListeners', 'DOMPluginEventSystem'], ['processDispatchQueue', 'DOMPluginEventSystem']],
    classMount: [['constructClassInstance', 'ReactFiberClassComponent'], ['mountClassInstance', 'ReactFiberClassComponent']],
    classSkip: [['checkShouldComponentUpdate', 'ReactFiberClassComponent']],
    classLifecycle: [['commitLayoutEffectOnFiber', 'ReactFiberCommitWork'], ['commitClassLayoutLifecycles', 'ReactFiberCommitEffects']],
    snapshot: [['commitBeforeMutationEffects', 'ReactFiberCommitWork']],
    strictRender: [['renderWithHooks', 'ReactFiberHooks']],
    strictEffects: [['doubleInvokeEffectsInDEV', 'ReactFiberWorkLoop']],
    caughtError: [['throwException', 'ReactFiberThrow'], ['createClassErrorUpdate', 'ReactFiberThrow'], ['unwindWork', 'ReactFiberUnwindWork']],
    uncaughtError: [['throwException', 'ReactFiberThrow'], ['createRootErrorUpdate', 'ReactFiberThrow']],
    suspend: [['throwException', 'ReactFiberThrow'], ['attachPingListener', 'ReactFiberThrow']],
    suspendedTransition: [['throwException', 'ReactFiberThrow'], ['renderDidSuspendDelayIfPossible', 'ReactFiberWorkLoop']],
    retry: [['pingSuspendedRoot', 'ReactFiberWorkLoop'], ['retryTimedOutBoundary', 'ReactFiberWorkLoop']],
    showFallback: [['updateSuspenseComponent', 'ReactFiberBeginWork'], ['mountSuspenseFallbackChildren', 'ReactFiberBeginWork']],
    showContent: [['updateSuspenseComponent', 'ReactFiberBeginWork']],
    hideContent: [['hideOrUnhideAllChildren', 'ReactFiberCommitWork'], ['hideInstance', 'ReactFiberConfigDOM']],
    revealContent: [['hideOrUnhideAllChildren', 'ReactFiberCommitWork'], ['unhideInstance', 'ReactFiberConfigDOM']],
    refCleanup: [['safelyDetachRef', 'ReactFiberCommitEffects']],
    contextPropagated: [['propagateContextChange', 'ReactFiberNewContext']],
    dehydrated: [['mountDehydratedSuspenseComponent', 'ReactFiberBeginWork']],
    hydrationScheduled: [['scheduleUpdateOnFiber', 'ReactFiberWorkLoop']],
    hydrateBoundary: [['updateDehydratedSuspenseComponent', 'ReactFiberBeginWork'], ['reenterHydrationStateFromDehydratedSuspenseInstance', 'ReactFiberHydrationContext']],
    boundaryHydrated: [['popHydrationState', 'ReactFiberHydrationContext']],
    selectiveHydration: [['attemptSynchronousHydration', 'ReactFiberReconciler'], ['queueDiscreteEvent', 'ReactDOMEventReplaying']],
    resourceHint: [['preload', 'ReactDOMFloat'], ['preinit', 'ReactDOMFloat']],
    resourceDeduped: [['preload', 'ReactDOMFloat']],
    stylesheetInserted: [['insertStylesheet', 'ReactFiberConfigDOM']],
    stylesheetDeduped: [['getResource', 'ReactFiberConfigDOM']],
    cacheHit: [['cache', 'react/ReactCacheImpl']],
    cacheMiss: [['cache', 'react/ReactCacheImpl']],
    staticStart: [['prerender', 'react-dom/static']],
    staticWait: [['prerender', 'react-dom/static']],
    staticEnd: [['prerender', 'react-dom/static']],
    formResetRequested: [['requestFormReset', 'ReactFiberHooks']],
    formReset: [['resetFormInstance', 'ReactFiberConfigDOM']],
    rootErrorOption: [['logCaughtError', 'ReactFiberErrorLogger'], ['logUncaughtError', 'ReactFiberErrorLogger']],
    prerenderScheduled: [['scheduleUpdateOnFiber', 'ReactFiberWorkLoop']],
    prerender: [['updateOffscreenComponent', 'ReactFiberBeginWork']],
    flightStart: [['renderToReadableStream', 'react-server-dom-webpack/server'], ['createRequest', 'react-server/ReactFlightServer']],
    flightServerComponent: [['renderFunctionComponent', 'react-server/ReactFlightServer']],
    flightClientRef: [['registerClientReference', 'react-server-dom-webpack/server'], ['serializeClientReference', 'react-server/ReactFlightServer']],
    flightServerRef: [['registerServerReference', 'react-server-dom-webpack/server'], ['serializeServerReference', 'react-server/ReactFlightServer']],
    flightEnd: [['createRequest', 'react-server/ReactFlightServer']],
    flightClient: [['createFromReadableStream', 'react-server-dom-webpack/client'], ['parseModelString', 'react-client/ReactFlightClient']],
    serverCall: [['callServer', 'react-server-dom-webpack/client'], ['decodeReply', 'react-server-dom-webpack/server']],
    hoisted: [['getHoistableRoot', 'ReactFiberConfigDOM'], ['mountHoistable', 'ReactFiberConfigDOM']],
    profilerRender: [['commitProfilerUpdate', 'ReactFiberCommitEffects']],
    streamFallback: [['renderSuspenseBoundary', 'react-server/ReactFizzServer']],
    streamShell: [['renderToPipeableStream', 'ReactDOMFizzServerNode'], ['flushCompletedQueues', 'react-server/ReactFizzServer']],
    streamChunk: [['flushCompletedBoundary', 'react-server/ReactFizzServer'], ['writeCompletedBoundaryInstruction', 'ReactFizzConfigDOM']],
    streamEnd: [['flushCompletedQueues', 'react-server/ReactFizzServer']],
    activityHide: [['hideOrUnhideAllChildren', 'ReactFiberCommitWork'], ['recursivelyTraverseDisappearLayoutEffects', 'ReactFiberCommitWork'], ['disconnectPassiveEffect', 'ReactFiberCommitWork']],
    activityShow: [['recursivelyTraverseReappearLayoutEffects', 'ReactFiberCommitWork'], ['recursivelyTraverseReconnectPassiveEffects', 'ReactFiberCommitWork']],
    effectEventUpdated: [['updateEvent', 'ReactFiberHooks'], ['commitUseEffectEventMount', 'ReactFiberCommitEffects']],
    lazyResolved: [['mountLazyComponent', 'ReactFiberBeginWork'], ['lazyInitializer', 'react/ReactLazy']],
    deferValue: [['updateDeferredValueImpl', 'ReactFiberHooks']],
    storeChanged: [['subscribeToStore', 'ReactFiberHooks'], ['forceStoreRerender', 'ReactFiberHooks']],
    optimistic: [['dispatchOptimisticSetState', 'ReactFiberHooks']],
    asyncAction: [['startTransition', 'ReactFiberHooks'], ['entangleAsyncAction', 'ReactFiberAsyncAction']],
    actionDone: [['entangleAsyncAction', 'ReactFiberAsyncAction']],
    ssrStart: [['renderToString', 'react-dom/server'], ['renderNode', 'react-server/ReactFizzServer']],
    ssrEnd: [['renderToString', 'react-dom/server']],
    ssrFallback: [['renderSuspenseBoundary', 'react-server/ReactFizzServer']],
    hydrateStart: [['hydrateRoot', 'ReactDOMRoot'], ['enterHydrationState', 'ReactFiberHydrationContext']],
    hydrateClaim: [['tryToClaimNextHydratableInstance', 'ReactFiberHydrationContext']],
    hydrateEnd: [['popHydrationState', 'ReactFiberHydrationContext']],
    hydrationFailed: [['throwOnHydrationMismatch', 'ReactFiberHydrationContext']],
    restoreControlled: [['restoreStateOfTarget', 'ReactDOMControlledComponent']],
    formAction: [['startHostTransition', 'ReactFiberHooks'], ['extractEvents', 'FormActionEventPlugin']],
  };
  const srcLink = fn => 'https://github.com/search?type=code&q=' + encodeURIComponent('repo:facebook/react ' + fn);
  function sourceHTML(kind) {
    const list = SOURCE[kind];
    if (!list) return '';
    return `<div class="in-src"><b>📂 In React's source</b><span>${list.map(([fn, mod]) => `<a href="${srcLink(fn)}" target="_blank" rel="noopener" title="Search facebook/react for ${esc(fn)}"><code>${esc(fn)}()</code><small>${esc(mod)}</small></a>`).join('<i>→</i>')}</span></div>`;
  }

  // ---------------------------------------------------------------- lanes as bits (React 18 values: Sync 1, InputContinuous 4, Default 16, Transition 64)
  const LANE_BITS = [[6, 'Transition'], [5, 'hydration'], [4, 'Default'], [3, 'hydration'], [2, 'Input'], [1, 'hydration'], [0, 'Sync']];
  function laneRow(label, value, cls) {
    const v = value || 0;
    // the Offscreen lane is bit 29: show it as its own cell only when it is used
    if (v & (1 << 29)) return `<div class="lb-row ${cls || ''}"><span class="lb-l">${label}</span><span class="lb-bits"><span class="lb-bit on" title="bit 29: Offscreen lane (lowest priority)"><b>1</b><small>Offscreen</small></span><span class="lb-bit dim"><b>…</b><small></small></span>${LANE_BITS.map(([b, n]) => `<span class="lb-bit${v & (1 << b) ? ' on' : ''}${n === 'hydration' ? ' dim' : ''}"><b>${v & (1 << b) ? 1 : 0}</b><small>${n === 'hydration' ? '' : esc(n)}</small></span>`).join('')}</span><code>bit 29 + 0b${(v & 127).toString(2).padStart(7, '0')}</code></div>`;
    const cells = LANE_BITS.map(([b, n]) => `<span class="lb-bit${v & (1 << b) ? ' on' : ''}${n === 'hydration' ? ' dim' : ''}" title="bit ${b}: ${n}${n === 'hydration' ? ' lane (not used here)' : ' lane'}"><b>${v & (1 << b) ? 1 : 0}</b><small>${n === 'hydration' ? '' : esc(n)}</small></span>`).join('');
    return `<div class="lb-row ${cls || ''}"><span class="lb-l">${label}</span><span class="lb-bits">${cells}</span><code>0b${v.toString(2).padStart(7, '0')}</code></div>`;
  }
  // beginWork's first question: does this fiber, or anything below it, have work in this render?
  function laneCheckHTML(d) {
    const b = d.bits;
    if (!b || !b.renderLanes) return '';
    const own = (b.lanes & b.renderLanes) !== 0, below = (b.childLanes & b.renderLanes) !== 0;
    const outcome = d.trace === 'bailoutSubtree' ? 'skip' : d.trace === 'bailout' ? 'clone' : 'render';
    const q1 = d.reason === 'mount' ? 'no old fiber (first render: mount)' : b.sameProps ? 'same props object ✓' : 'new props object ✗';
    return `<div class="lc-box"><div class="lc-title">The lane check in <code>beginWork</code>: does <b>${esc(d.name)}</b> have work in this render?</div>
      ${laneRow('renderLanes', b.renderLanes, 'rl')}
      ${laneRow('fiber.lanes', b.lanes, own ? 'hit' : '')}
      ${laneRow('fiber.childLanes', b.childLanes, below ? 'hit' : '')}
      <ol class="lc-steps">
        <li class="${outcome === 'render' ? 'take' : 'pass'}"><code>lanes &amp; renderLanes</code> = ${own ? '<b>not 0</b>: it has an update' : '0: no update of its own'} · ${q1}${outcome === 'render' ? ' → <b>do its work</b> (call the component, or diff a DOM element\'s children)' : ''}</li>
        ${outcome === 'render' ? '' : `<li class="take"><code>childLanes &amp; renderLanes</code> = ${below ? '<b>not 0</b>: something below has work → <b>clone the children</b>, keep going down' : '0: nothing below has work → <b>skip the whole subtree</b> (return null)'}</li>`}
      </ol></div>`;
  }
  // the time slice: how many fibers this slice has done
  function sliceHTML(n, size, slices) {
    if (!size || !slices) return '';
    const cells = Array.from({ length: size }, (_, k) => `<span class="sl-u${k < n ? ' used' : ''}${k === n - 1 ? ' now' : ''}"></span>`).join('');
    return `<div class="sl-row"><span>Time slice <b>${slices}</b></span><span class="sl-cells">${cells}</span><small>${n} of ${size} fibers (real React: about 5 ms, then <code>shouldYield()</code> returns true)</small></div>`;
  }

  // ---------------------------------------------------------------- the scheduler: tasks, slices, yielding, interruption
  function schedHTML(d) {
    const s = d.sched;
    if (!s) return '';
    const lane = s.lane;
    const row = d.trace === 'transition' ? laneRow('update lane', 64, 'hit') : laneRow('root.pendingLanes', s.pending, 'rl');
    const box = (cls, t, small) => `<span class="sc-b ${cls}"><b>${t}</b>${small ? `<small>${small}</small>` : ''}</span>`;
    const arrow = '<i>→</i>';
    let cap = '', line = '';
    switch (d.trace) {
      case 'scheduleSync':
        cap = 'The highest pending lane is <b>Sync</b>, so React does not use the scheduler queue: it queues a <b>microtask</b>. Every setState made in the same event handler is already in the queue, so they all go into <b>one render</b>.';
        line = box('done', 'event handler', 'your code (a task)') + arrow + box('now', 'microtask', 'Sync render') + arrow + box('', 'paint') ;
        break;
      case 'scheduleTask':
        cap = `The highest pending lane is <b>${esc(lane)}</b>: React asks its <b>Scheduler</b> for a task at <b>Normal</b> priority. The Scheduler keeps tasks in a min-heap sorted by deadline and runs them with <code>MessageChannel</code> (here: <code>setTimeout</code>), so the browser can paint and handle input first.`;
        line = box('done', 'current task', 'your code') + arrow + box('', 'paint / input', 'browser') + arrow + box('now', 'scheduler task', `render (${esc(lane)})`);
        return `<div class="in-cap">${cap}</div>${row}<div class="sc-line">${line}</div>
          <table class="sc-tab"><tr><th>Scheduler priority</th><th>timeout</th><th>used for</th></tr>
            <tr><td>Immediate</td><td>-1 ms (already late)</td><td>a fallback for Sync work (normally a microtask)</td></tr>
            <tr><td>UserBlocking</td><td>250 ms</td><td>continuous input (drag, scroll)</td></tr>
            <tr class="on"><td>Normal</td><td>5000 ms</td><td>Default and Transition renders</td></tr>
            <tr><td>Idle</td><td>never</td><td>offscreen work</td></tr></table>
          <div class="in-sub">If a task waits past its timeout it becomes <b>expired</b> and runs without yielding, so low-priority work can't starve forever.</div>`;
      case 'transition':
        cap = 'Inside <code>startTransition</code>, <code>requestUpdateLane()</code> returns a <b>Transition</b> lane (bit 6) instead of Sync or Default.';
        break;
      case 'renderStart':
        cap = lane === 'Transition' ? 'A <b>Transition</b> render starts: it will run in <b>time slices</b> and check <code>shouldYield()</code> between fibers.' : `A <b>${esc(lane)}</b> render starts: it runs to the end without stopping (<code>workLoopSync</code>).`;
        line = lane === 'Transition' ? box('now', 'slice 1', 'workLoopConcurrent') + arrow + box('', '…') : box('now', 'whole render', 'workLoopSync, no yielding');
        break;
      case 'yield': {
        const slices = [];
        for (let k = 1; k <= s.slices; k++) slices.push(box(k === s.slices ? 'now' : 'done', 'slice ' + k, s.size + ' fibers'));
        cap = `Slice <b>${s.slices}</b> is used up (${s.used} of ${s.size} fibers). <code>shouldYield()</code> returned true, so <code>workLoopConcurrent</code> stops. The work-in-progress tree and the <code>workInProgress</code> pointer are kept, and React posts a new scheduler task to continue.`;
        line = slices.join(arrow) + arrow + box('gap', 'browser turn', 'clicks, typing, paint can happen') + arrow + box('', 'slice ' + (s.slices + 1), 'continues here');
        break;
      }
      case 'resume': {
        const slices = [];
        for (let k = 1; k <= s.slices + 1; k++) slices.push(box(k === s.slices + 1 ? 'now' : 'done', 'slice ' + k));
        cap = `The next scheduler task runs. The pending lane is still <b>${esc(lane)}</b> and the paused tree belongs to it, so React continues from the <code>workInProgress</code> pointer instead of starting again.`;
        line = slices.join(arrow);
        break;
      }
      case 'interrupt': {
        const slices = [];
        for (let k = 1; k <= Math.max(1, s.slices); k++) slices.push(box('gone', 'slice ' + k, esc(s.from)));
        cap = `A <b>${esc(lane)}</b> update arrived while the <b>${esc(s.from)}</b> render was paused. ${esc(lane)} is a lower bit = higher priority, so React throws the unfinished tree away (<code>prepareFreshStack</code>) and renders the urgent update first. The ${esc(s.from)} lane stays in <code>pendingLanes</code>: that render will <b>start again from the root</b> afterwards.`;
        line = slices.join(arrow) + arrow + box('now', esc(lane) + ' render', 'from scratch') + arrow + box('', esc(s.from) + ' again', 'restart from the root');
        break;
      }
      default: return '';
    }
    return `<div class="in-cap">${cap}</div>${row}${line ? `<div class="sc-line">${line}</div>` : ''}`;
  }

  // ---------------------------------------------------------------- diagrams
  function treeOf(r) { const root = r.roots[0]; return root ? root.wip || root.current : null; }
  function findPath(tree, id) {
    const path = [];
    const walk = f => { if (!f) return false; path.push(f); if (f.id === id || f.alt === id) return true; for (const k of f.kids) if (walk(k)) return true; path.pop(); return false; };
    return walk(tree) ? path : [];
  }
  function workloopHTML(d, r) {
    const tree = treeOf(r);
    if (!tree) return '';
    const order = new Map(); r.worked.forEach((id, i) => { if (!order.has(id)) order.set(id, i + 1); });
    const done = new Set(r.completed || []);
    const bailed = new Set(r.bailed);
    const hit = (f, set) => set.has(f.id) || set.has(f.alt);
    const num = f => order.get(f.id) || order.get(f.alt);
    const rows = [];
    const walk = (f, depth) => {
      if (!f || rows.length > 40) return;
      const now = r.wip != null && (f.id === r.wip || f.alt === r.wip);
      const n = num(f);
      const status = hit(f, bailed) ? 'skipped' : n ? (hit(f, done) ? 'done' : 'begun') : 'todo';
      rows.push(`<div class="wl-row ${status}${now ? ' now' : ''}" style="--d:${depth}"><span class="wl-n">${n || ''}</span><span class="wl-name">${esc(f.name)}</span>${hit(f, done) && !hit(f, bailed) ? '<span class="wl-up">✓ complete</span>' : ''}${hit(f, bailed) ? '<span class="wl-skip">skipped</span>' : ''}${now ? '<span class="wl-ptr">◀ workInProgress</span>' : ''}</div>`);
      f.kids.forEach(k => walk(k, depth + 1));
    };
    walk(tree, 0);
    const sub = {
      renderStart: 'A new render starts from the root: React clones the current HostRoot as the first work-in-progress fiber.',
      beginWork: d.reason ? `beginWork on <b>${esc(d.name)}</b> (reason: ${esc(d.reason)}).` : `beginWork on <b>${esc(d.name)}</b>.`,
      bailout: `<b>${esc(d.name)}</b> has no work itself, but a child does: React clones its children without calling it.`,
      bailoutSubtree: `Nothing changed in <b>${esc(d.name)}</b> or below: the whole subtree is reused.`,
      memoBailout: `memo: props of <b>${esc(d.name)}</b> are shallowly equal, so it is skipped.`,
      renderBailout: `<b>${esc(d.name)}</b> ran but nothing changed: its new children are thrown away.`,
      yield: 'Time slice over: React stops here and lets the browser work. It will continue from the workInProgress pointer.',
      resume: 'React resumes the paused render from the same workInProgress fiber.',
      interrupt: 'An urgent update arrived: the unfinished tree is thrown away and React starts again.',
      rendered: `<b>${esc(d.name)}</b> returned new elements; next React reconciles them.`,
    }[d.sub] || '';
    const b = d.bits;
    const extra = (d.sched ? schedHTML(d) : '') + (b ? laneCheckHTML(d) + sliceHTML(b.slice, b.size, b.slices) : '');
    return `${d.sched ? '' : `<div class="in-cap">${sub}</div>`}${extra}
      <div class="wl-legend"><span>1, 2, 3… = order of <code>beginWork</code> (going down)</span><span>✓ = <code>completeWork</code> done (coming back up)</span></div>
      <div class="wl-tree">${rows.join('')}</div>`;
  }
  function updateHTML(d) {
    const chain = d.path.slice().reverse();
    return `<div class="in-cap">${d.sub === 'eagerBailout' ? 'The new value is the same as the current one (<code>Object.is</code>), so React drops the update without scheduling anything.' : d.sub === 'rootRender' ? 'root.render puts an update with the element on the HostRoot.' : `A new <b>update</b> object is added to the queue of <b>${esc(d.comp)}</b>.`}</div>
      <div class="up-box"><div class="up-obj"><small>update</small><code>{ lane: ${esc(d.lane || '?')}, action: ${esc(d.action)} }</code></div><span class="up-arrow">→</span><div class="up-q"><small>${esc(d.comp)}'s hook queue</small><div class="up-ring"><span class="u old">…</span><span class="u new">${esc(d.action)}</span><span class="loop">↺ circular list</span></div></div></div>
      ${d.sub === 'eagerBailout' ? '' : `<div class="in-sub">Then React marks the path up to the root, so the next render knows where the work is:</div>
      <div class="up-path">${chain.map((n, i) => `<span class="up-node${i === chain.length - 1 ? ' me' : ''}">${esc(n)}<small>${i === chain.length - 1 ? 'lanes |= ' + esc(d.lane) : 'childLanes |= ' + esc(d.lane)}</small></span>`).join('<i>→</i>')}</div>`}`;
  }
  function scheduleHTML(d) {
    if (d.sched) return schedHTML(d);
    const bits = [[1, 'Sync', 'clicks, typing → microtask'], [16, 'Default', 'root.render, timers → task'], [64, 'Transition', 'startTransition → task, time-sliced']];
    return `<div class="in-cap">${d.sub === 'transition' ? 'Updates made inside startTransition will use the <b>Transition</b> lane.' : `The highest pending lane is <b>${esc(d.lane)}</b>: React ${d.sub === 'scheduleSync' ? 'queues a <b>microtask</b> (renders right after the event handler)' : 'schedules a <b>task</b> (a macrotask from its scheduler)'}.`}</div>
      <div class="ln-row">${bits.map(([b, n, how]) => `<div class="ln-cell${d.pending & b ? ' on' : ''}${n === d.lane ? ' cur' : ''}"><b>${n}</b><code>bit ${Math.log2(b)}</code><small>${how}</small></div>`).join('')}</div>
      <div class="in-sub">root.pendingLanes = <code>0b${(d.pending || 0).toString(2).padStart(7, '0')}</code> (lower bit = higher priority)</div>`;
  }
  function queueHTML(d) {
    const cells = [`<div class="qs-state"><small>base state</small><code>${esc(d.start)}</code></div>`];
    d.steps.forEach(s => {
      cells.push(`<div class="qs-up${s.skipped ? ' skip' : ''}"><small>${esc(s.lane)}${s.skipped ? ' · skipped' : ''}</small><code>${esc(s.action)}</code></div>`);
      cells.push(`<div class="qs-state${s.skipped ? ' skip' : ''}"><small>${s.skipped ? 'unchanged' : 'state'}</small><code>${esc(s.after)}</code></div>`);
    });
    return `<div class="in-cap"><code>${esc(d.hook)}</code> in <b>${esc(d.comp)}</b> replays its queue, one update at a time:</div>
      <div class="qs-row">${cells.join('<i>→</i>')}</div>
      <div class="in-sub">${d.steps.some(s => s.skipped) ? 'Skipped updates (lower priority) stay in the queue and will be applied in a later render, in the same order.' : 'The last state is what the component sees in this render.'}</div>`;
  }
  // reconcileChildrenArray, one row per new child: which pass found it, its old index, and the lastPlacedIndex rule
  function diffHTML(d) {
    const rows = d.diff || [];
    if (rows.length < 2) return '';
    const interesting = rows.some(r => r.pass === '2' || r.decision === 'move');
    const passName = p => (p === '1' ? '1: same position' : p === '2' ? '2: look up by key' : 'append');
    const why = r => r.decision === 'create' ? 'no old fiber with this key → new fiber, insert'
      : r.decision === 'move' ? `old index ${r.oldIndex} &lt; lastPlacedIndex ${r.last} → it was before a kept item, so it must <b>move</b>`
        : `old index ${r.oldIndex} ≥ lastPlacedIndex ${r.last} → stays where it is; lastPlacedIndex = ${r.oldIndex}`;
    return `<div class="df-box${interesting ? ' show' : ''}"><div class="df-title">How React decided (<code>reconcileChildrenArray</code>): pass 1 walks old and new children side by side until a key differs; pass 2 puts the rest of the old children in a Map by key and looks each new child up.</div>
      <table class="df-tab"><tr><th>new #</th><th>child</th><th>found in pass</th><th>decision</th><th>rule</th></tr>
      ${rows.map(r => `<tr class="${esc(r.decision)}"><td>${r.newIndex}</td><td>${esc(r.name)}</td><td>${passName(r.pass)}</td><td><b>${esc(r.decision)}</b></td><td>${why(r)}</td></tr>`).join('')}</table>
      <div class="df-note">Old children never looked up are deleted. Only items that end up <i>before</i> one already kept are moved, so moving one item to the end moves just that one, while moving the last item to the front moves all the others.</div></div>`;
  }
  function reconcileHTML(d) {
    const opOf = name => (d.after.find(a => a.name === name) || {}).op;
    return `<div class="in-cap">Children of <b>${esc(d.parent)}</b>: the old fibers (left) are matched with the new elements (right) by <b>type and key</b>.</div>
      <div class="rc-grid">
        <div class="rc-col"><small>before (current fibers)</small>${d.before.map(n => `<div class="rc-item ${d.deleted.includes(n) ? 'del' : opOf(n) || 'keep'}">${esc(n)}${d.deleted.includes(n) ? '<em>delete</em>' : ''}</div>`).join('') || '<div class="rc-item none">none</div>'}</div>
        <div class="rc-mid">→</div>
        <div class="rc-col"><small>after (new fibers)</small>${d.after.map(a => `<div class="rc-item ${a.op}">${esc(a.name)}<em>${esc(a.op)}</em></div>`).join('')}</div>
      </div>
      ${diffHTML(d)}
      <div class="rc-legend"><span class="keep">keep: reuse fiber, DOM and state</span><span class="move">move: same fiber, new position (Placement)</span><span class="create">create: new fiber</span><span class="del">delete: removed in the commit</span></div>`;
  }
  function commitHTML(d) {
    return `<div class="in-cap">${d.sub === 'commitStart' ? 'The render is complete. React now walks the flags and applies every DOM change, in one synchronous pass:' : 'DOM operations done so far in this commit:'}</div>
      <ol class="cm-list">${d.list.map((m, i) => `<li class="${i === d.list.length - 1 ? 'now' : ''}"><b>${esc(m.op)}</b> ${esc(m.name)}${m.extra ? ' <small>(' + esc(m.extra) + ')</small>' : ''}</li>`).join('') || '<li class="none">…</li>'}</ol>`;
  }
  function swapHTML(d) {
    return `<div class="in-cap">${d.mutations} DOM change${d.mutations === 1 ? '' : 's'} applied. Now one assignment makes the new tree the one on screen:</div>
      <div class="sw-box"><div class="sw-tree old"><b>old tree</b><small>becomes the <i>alternate</i> (reused next render)</small></div>
        <div class="sw-root"><code>root.current</code><span class="sw-arrow">⟶</span></div>
        <div class="sw-tree new"><b>finished work-in-progress</b><small>now <i>current</i>: what is on screen</small></div></div>
      <div class="in-sub">Each fiber has an <code>alternate</code> pointer to its twin in the other tree, so React reuses objects instead of allocating new ones.</div>`;
  }
  function effectsHTML(d) {
    const list = d.list.filter(e => d.passive ? !e.layout : e.layout);
    return `<div class="in-cap">${d.passive ? 'After paint: <b>all cleanups first</b>, then all new effects (children before parents).' : 'During the commit, right after the DOM changes and <b>before paint</b>:'}</div>
      <ol class="ef-list">${list.map((e, i) => `<li class="${e.what}${i === list.length - 1 ? ' now' : ''}"><span>${e.what === 'cleanup' ? '🧹 cleanup' : '▶ run'}</span><code>${esc(e.hook)}</code> in <b>${esc(e.name)}</b>${e.unmount ? ' <small>(unmount)</small>' : ''}</li>`).join('') || '<li class="none">nothing yet</li>'}</ol>`;
  }
  function paintHTML(d) {
    return `<div class="in-cap">${d.sub === 'schedulePassive' ? 'There is <code>useEffect</code> work: React schedules it for a task <b>after the browser paints</b>.' : 'The commit is done. The browser paints the new screen now.'}</div>
      <div class="pt-row"><span class="done">render</span><i>→</i><span class="done">commit</span><i>→</i><span class="cur">🖌️ paint</span><i>→</i><span>useEffect</span></div>`;
  }
  function eventHTML(d) {
    return `<div class="in-cap">A <b>${esc(d.type)}</b> event reached the <b>root listener</b>. React walks from the target up the fiber tree and collects <code>${esc(d.prop)}</code> handlers:</div>
      <div class="ev-path">${d.path.map((p, i) => `<div class="ev-node${p.handler ? ' has' : ''}${i === 0 ? ' target' : ''}"><span>${i === 0 ? '🎯 ' : ''}${esc(p.name)}</span>${p.handler ? `<em>${esc(d.prop)} ✓</em>` : ''}${p.capture ? `<em>${esc(d.prop)}Capture ✓</em>` : ''}</div>`).join('<div class="ev-up">↑ bubbles</div>')}</div>
      <div class="in-sub">Handlers are called in this order (capture handlers first, from the top). Updates inside get the <b>Sync</b> lane and are batched into one render.</div>`;
  }
  function boundaryHTML(d) {
    const chain = d.path;
    const target = d.boundary;
    const text = {
      suspend: `<b>${esc(d.from)}</b> threw a <b>Promise</b> (not ready). React walks up to the nearest <b>Suspense</b> and shows its fallback.`,
      suspendedTransition: `<b>${esc(d.from)}</b> suspended during a transition: React keeps the old screen and waits instead of showing a fallback.`,
      caughtError: `<b>${esc(d.from)}</b> threw <b>${esc(d.message)}</b>. React walks up to the nearest <b>error boundary</b> and renders it again with the error.`,
      uncaughtError: `<b>${esc(d.from)}</b> threw <b>${esc(d.message)}</b> and no boundary caught it: the whole app is removed.`,
      showFallback: `<b>${esc(d.from)}</b> renders its fallback; the content is kept hidden (state preserved).`,
      showContent: `<b>${esc(d.from)}</b>: data is ready, the content is shown again.`,
      retry: `The Promise resolved: React renders <b>${esc(d.from)}</b> again.`,
    }[d.sub] || '';
    return `<div class="in-cap">${text}</div>
      ${chain.length ? `<div class="bd-path">${chain.map(n => `<span class="${n === target ? 'hit' : n === chain[0] ? 'from' : ''}">${esc(n)}${n === target ? ' <em>← boundary</em>' : ''}</span>`).join('<i>↑</i>')}</div>` : ''}`;
  }
  function completeHTML(d, r) {
    return `<div class="in-cap"><code>completeWork</code> on <b>${esc(d.name)}</b> (coming back up the tree):</div>
      <div class="cp-box">${d.sub === 'createDOM' ? 'creates the DOM element <b>off-screen</b> and appends its children\'s DOM nodes into it' : `compares old and new props → changed: <code>${esc(d.keys.join(', '))}</code> → stores an <b>update payload</b> and the <b>Update</b> flag for the commit`}</div>
      <div class="in-sub">Where React is in the work loop:</div>` + workloopHTML({ sub: '' }, Object.assign({}, r, { wip: d.id }));
  }
  function serverHTML(d) {
    const t = { ssrStart: 'renderToString: components run once, the result is an HTML string (no DOM, no effects).', ssrEnd: 'The HTML is ready to send to the browser.', ssrFallback: 'Something suspended on the server: the fallback HTML is sent instead.', hydrateStart: 'hydrateRoot: React renders, but adopts the existing server DOM instead of creating nodes.', hydrateClaim: `<b>${esc(d.name)}</b> matched the next server node: React reuses it.`, hydrateEnd: 'Every node matched: the page is now interactive.', hydrationFailed: 'Mismatch: React throws the server HTML away and renders on the client.', streamFallback: 'A boundary is waiting: the fallback is written with a placeholder, and the stream goes on.', streamShell: 'The shell (the page with fallbacks) is sent now: the browser can already show it.', streamChunk: 'Data ready: the HTML of this boundary is sent as one more chunk, and a small script swaps it in.', streamEnd: 'All boundaries sent: the stream ends.', flightStart: 'Server: render the server components into the RSC payload.', flightServerComponent: 'A server component runs on the server; only its output is sent.', flightClientRef: 'A client component: the server sends a reference and its props, not its code.', flightServerRef: 'A server function: the browser gets a reference it can call.', flightEnd: 'The payload is ready to send.', flightClient: 'Browser: the payload becomes React elements; references become the real client components.', serverCall: 'The browser calls a server function: a request to the server.' }[d.sub] || '';
    const more = {
      dehydrated: `<b>${esc(d.name)}</b> stays plain server HTML for now (dehydrated): the rest of the page is hydrated first.`,
      hydrationScheduled: `A separate render will hydrate <b>${esc(d.name)}</b> later, on its own.`,
      hydrateBoundary: `Hydrating only <b>${esc(d.name)}</b> now.`,
      boundaryHydrated: `<b>${esc(d.name)}</b> is hydrated: its handlers work.`,
      selectiveHydration: `The user interacted with <b>${esc(d.name)}</b> before it was hydrated: React hydrates it first, at Sync priority, then replays the event.`,
      resourceHint: 'A resource tag goes into the head, so the browser starts loading early.', resourceDeduped: 'Already requested: not added again.',
      stylesheetInserted: 'The stylesheet joins its precedence group in the head.', stylesheetDeduped: 'This stylesheet is already in the head: one copy only.',
      cacheMiss: 'cache: first call in this request, so it runs and is remembered.', cacheHit: 'cache: same arguments in the same request: the remembered result is reused.',
      staticStart: 'prerender: render to static HTML and wait for all data.', staticWait: 'Something suspended: wait for the data, then render again.', staticEnd: 'Static HTML ready: no fallbacks.',
      formResetRequested: 'The form will be reset when the action finishes.', formReset: 'Action finished: the form fields are reset.',
    }[d.sub];
    const steps = ['dehydrated', 'hydrationScheduled', 'hydrateBoundary', 'boundaryHydrated', 'selectiveHydration'].includes(d.sub)
      ? `<div class="pt-row">${[['hydrate the page', ['dehydrated', 'hydrationScheduled']], ['boundary waits (server HTML)', ['dehydrated', 'hydrationScheduled']], [d.sub === 'selectiveHydration' ? '⚡ clicked: hydrate it NOW' : 'hydrate the boundary', ['hydrateBoundary', 'selectiveHydration']], ['interactive', ['boundaryHydrated']]].map(([label, on]) => `<span class="${on.includes(d.sub) ? 'cur' : ''}">${esc(label)}</span>`).join('<i>→</i>')}</div>` : '';
    return `<div class="in-cap">${t || more || ''}</div>${steps}`;
  }
  // the context walk: every fiber below the provider, readers marked
  function contextHTML(d) {
    const rows = d.walk.map(w => `<div class="wl-row ${w.reads ? 'done' : 'todo'}" style="--d:${w.depth}"><span class="wl-n">${w.reads ? '✓' : ''}</span><span class="wl-name">${esc(w.name)}</span>${w.reads ? '<span class="wl-up">reads the context → gets the render lane</span>' : ''}</div>`).join('');
    const readers = d.walk.filter(w => w.reads).length;
    return `<div class="in-cap">The value of <b>${esc(d.provider)}</b> changed. React walks <b>down</b> the whole subtree and checks each fiber's list of contexts it reads (<code>fiber.dependencies</code>): ${readers} reader${readers === 1 ? '' : 's'} found.</div>
      <div class="wl-tree">${rows || '<div class="wl-row">nothing below</div>'}</div>
      <div class="in-sub">Each reader gets the render lane, and every parent above it gets <code>childLanes</code>. So the render goes down to it even if a <code>memo</code> parent bails out.</div>`;
  }

  // what is different from the previous step: hook values, new flags, new pending work, new fibers
  function changesOf(snap, prev) {
    if (!prev || !prev.react || !snap.react) return [];
    const walk = (f, fn) => { if (!f) return; fn(f); f.kids.forEach(k => walk(k, fn)); };
    const before = new Map();
    prev.react.roots.forEach(r => { walk(r.current, f => before.set(f.id, f)); walk(r.wip, f => before.set(f.id, f)); });
    const root = snap.react.roots[0];
    const out = [];
    let fresh = 0;
    walk(root && (root.wip || root.current), f => {
      const p = before.get(f.id) || (f.alt != null ? before.get(f.alt) : null);
      if (!p) { fresh++; return; }
      (f.hooks || []).forEach((h, k) => {
        const o = (p.hooks || [])[k];
        if (o && o.name === h.name && o.value !== h.value) out.push(`<b>${esc(f.name)}</b> ${esc(h.name)}: <s>${esc(trimTo(o.value, 18))}</s> → <code>${esc(trimTo(h.value, 18))}</code>`);
      });
      const added = f.flags.filter(x => !p.flags.includes(x));
      if (added.length) out.push(`<b>${esc(f.name)}</b> gets flag ${added.map(x => `<code>${esc(x)}</code>`).join(' ')}`);
      if (f.lanes && !p.lanes) out.push(`<b>${esc(f.name)}</b> now has an update waiting`);
    });
    if (fresh && fresh < 40) out.push(`＋ ${fresh} new fiber${fresh === 1 ? '' : 's'}`);
    return out;
  }
  const trimTo = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  function changesHTML(snap, prev) {
    const list = changesOf(snap, prev);
    if (!list.length) return '';
    return `<div class="in-chg"><b>🔸 Changed in this step</b><span>${list.slice(0, 4).join('<i>·</i>')}${list.length > 4 ? ` <i>·</i> +${list.length - 4} more` : ''}</span></div>`;
  }

  function render(snap, i, trace, prev) {
    const r = snap.react, d = snap.reactDetail;
    const st = stationOf(d, r.phase);
    let nav = '';
    if (trace) {
      const reactSteps = trace.reduce((a, t, k) => (t.kind === 'react' ? a.concat(k) : a), []);
      const pos = reactSteps.filter(k => k <= i).length;
      nav = `<div class="in-nav"><button class="btn small" data-rjump="-1" title="Previous step where React works">◀ React step</button><span>${snap.kind === 'react' ? `React step <b>${pos}</b> of ${reactSteps.length}` : 'your code is running'}</span><button class="btn small primary" data-rjump="1" title="Next step where React works">React step ▶</button></div>`;
    }
    const pipe = nav + `<div class="pipe">${STATIONS.map((s, i) => `<div class="pipe-st${i === st ? ' now' : i < st ? ' past' : ''}" title="${esc(s.tip)}"><span>${i + 1}</span>${esc(s.label)}</div>`).join('')}</div>`;
    if (!d) {
      return pipe + `<div class="in-empty">${snap.kind === 'react' ? '' : 'This step is <b>your</b> code running (not React). Step on to the next ⚛️ step to see React work.'}</div>${r.phase === 'render' ? workloopHTML({ sub: '' }, r) : ''}`;
    }
    const body = {
      workloop: workloopHTML, context: contextHTML, update: updateHTML, schedule: scheduleHTML, queue: queueHTML, reconcile: reconcileHTML, commit: commitHTML, swap: swapHTML,
      effects: effectsHTML, paint: paintHTML, event: eventHTML, boundary: boundaryHTML, complete: completeHTML, server: serverHTML,
      root: () => '<div class="in-cap">React is created: a <b>FiberRoot</b> (bookkeeping for this app) and the first fiber, the <b>HostRoot</b>. Listeners for every event type are added to the container.</div>',
    }[d.kind];
    const say = SAY[d.kind];
    return wrap(pipe + changesHTML(snap, prev) + `<div class="in-body">${body ? body(d, r) : ''}</div>` + sourceHTML(d.trace) + (say ? `<div class="in-say"><b>💬 In one sentence</b><span>${esc(say)}</span></div>` : ''));
  }

  // simple by default: one sentence and the main picture; "More detail" shows lane bits, the scheduler table,
  // the pipeline, React's source and the summary sentence
  const MORE_KEY = 'rql.insideMore';
  const moreOn = () => { try { return localStorage.getItem(MORE_KEY) === '1'; } catch (e) { return false; } };
  function wrap(html) {
    const on = moreOn();
    return `<div class="in-wrap${on ? ' more' : ''}">${html}<button class="btn small in-more-btn" data-inmore aria-expanded="${on}">${on ? 'Less detail ▴' : 'More detail ▾'}</button></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-inmore]');
    if (!b) return;
    const w = b.closest('.in-wrap'), on = !w.classList.contains('more');
    try { localStorage.setItem(MORE_KEY, on ? '1' : '0'); } catch (err) { /* private mode */ }
    w.classList.toggle('more', on);
    b.textContent = on ? 'Less detail ▴' : 'More detail ▾';
    b.setAttribute('aria-expanded', String(on));
  });

  window.ReactInside = { render, STATIONS, stationOf, changesOf };
})();
