/*
 * React Engine Lab — the "React path": a study roadmap (lessons + challenges in order, with progress),
 * a one-page cheat sheet, and an interview-day checklist linking to the questions.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const read = k => { try { return JSON.parse(localStorage.getItem('rql.' + k)) || []; } catch (e) { return []; } };

  const STAGES = [
    { title: '1 · JSX and the first render', why: 'What components and elements really are, and how React gets them on the page.', lessons: ['r-jsx', 'r-firstrender', 'r-fiber'], challenges: ['rc-counter', 'rc-password'] },
    { title: '2 · State, events and forms', why: 'useState, batching, updater functions, event delegation, controlled inputs, lifting state.', lessons: ['r-state', 'r-batching', 'r-updater', 'r-events', 'r-controlled', 'r-lifting', 'r-forms'], challenges: ['rc-todo', 'rc-validation', 'rc-autocomplete'] },
    { title: '3 · Lists and reconciliation', why: 'How React decides what to keep, move, create and delete; why keys matter.', lessons: ['r-reconcile', 'r-keys', 'r-indexkeys', 'r-commit'], challenges: ['rc-pagination'] },
    { title: '4 · Effects and refs', why: 'Syncing with the outside world: timing, dependencies, cleanups, stale closures.', lessons: ['r-effect', 'r-cleanup', 'r-layout', 'r-ref', 'r-stale', 'r-unmount'], challenges: ['rc-debounce', 'rc-fetch', 'rc-stopwatch', 'rc-traffic', 'rc-progress'] },
    { title: '5 · Hooks in depth', why: 'The hooks linked list, reducers, memoization, custom hooks, refs to components, external stores.', lessons: ['r-hookslist', 'r-reducer', 'r-memohooks', 'r-customhook', 'r-forwardref', 'r-syncstore'], challenges: ['rc-cart', 'rc-stars'] },
    { title: '6 · Performance', why: 'Why components re-render and how to avoid the expensive ones.', lessons: ['r-props', 'r-memo', 'r-context', 'r-deferred', 'r-virtual'], challenges: [] },
    { title: '7 · Concurrent React', why: 'Lanes, transitions, time slicing, flushSync and React 19 actions.', lessons: ['r-lanes', 'r-transition', 'r-flushsync', 'r-suspensetransition', 'r-optimistic', 'r-actionstate'], challenges: [] },
    { title: '8 · Classes, errors and Suspense', why: 'Lifecycles, error boundaries, Suspense, lazy loading, StrictMode and React\'s warnings.', lessons: ['r-class', 'r-classstate', 'r-boundary', 'r-suspense', 'r-lazy', 'r-strict', 'r-warnings'], challenges: [] },
    { title: '9 · Patterns and building real UIs', why: 'Composition, portals, context + reducer architecture: the machine-coding round.', lessons: ['r-children', 'r-portal', 'r-patterns', 'r-todo'], challenges: ['rc-tabs', 'rc-accordion', 'rc-tree', 'rc-modal', 'rc-tictactoe'] },
    { title: '10 · SSR and the ecosystem', why: 'Server rendering, hydration, Server Components, routers, stores, data fetching, testing, TypeScript.', lessons: ['r-ssr', 'r-hydration', 'r-rsc', 'r-router', 'r-store', 'r-query', 'r-testing', 'r-typescript'], challenges: [] },
  ];

  const MUST_KNOW = [
    ['rth-virtual-dom', 'Virtual DOM and why React uses it'], ['rth-fiber', 'What a fiber is'], ['rth-render-commit', 'Render phase vs commit phase'],
    ['rth-reconciliation', 'How reconciliation works'], ['rth-keys', 'Keys, and why not the index'], ['rth-explain-render-cycle', 'What happens when you call setState'],
    ['rth-batching', 'Batching'], ['rth-setstate-async', 'Is setState synchronous?'], ['rth-rules-of-hooks', 'Rules of hooks and why'],
    ['rth-useeffect-vs-layout', 'useEffect vs useLayoutEffect'], ['rth-deps-array', 'The dependency array'], ['rth-stale-closure', 'Stale closures'],
    ['rth-you-might-not-need-effect', 'When you do not need an effect'], ['rth-memo-usememo-usecallback', 'memo vs useMemo vs useCallback'], ['rth-when-rerender', 'When a component re-renders'],
    ['rth-context-use', 'Context and its pitfalls'], ['rth-state-categories', 'Where each kind of state should live'], ['rth-controlled', 'Controlled vs uncontrolled'],
    ['rth-concurrent', 'Concurrent rendering'], ['rth-transition', 'startTransition / useTransition'], ['rth-suspense-how', 'How Suspense works'],
    ['rth-error-boundary', 'Error boundaries'], ['rth-csr-ssr-ssg', 'CSR vs SSR vs SSG'], ['rth-hydration', 'Hydration'], ['rth-server-components', 'Server Components'],
    ['rth-perf-tools', 'Finding performance problems'], ['rth-testing-library', 'Testing components'], ['rth-react-18-summary', 'What React 18 changed'], ['rth-react-19-summary', 'What is new in React 19'],
    ['rth-answer-framework', 'How to structure your answers'], ['rth-machine-coding', 'How to approach the coding round'],
  ];

  function roadmapHTML() {
    const levels = window.JS_LEVELS || [], chals = window.JS_CHALLENGES || [], ivs = window.JS_INTERVIEW || [];
    const done = new Set(read('completed')), solved = new Set(read('solved'));
    let total = 0, got = 0;
    const stages = STAGES.map(st => {
      const items = st.lessons.map(id => {
        const i = levels.findIndex(l => l.id === id);
        if (i < 0) return '';
        total++; if (done.has(id)) got++;
        return `<a class="rm-item" href="?level=${i + 1}">📖 ${esc(levels[i].emoji || '')} ${esc(levels[i].title)}</a>`;
      }).concat(st.challenges.map(id => {
        const i = chals.findIndex(c => c.id === id);
        if (i < 0) return '';
        total++; if (solved.has(id)) got++;
        return `<a class="rm-item chal" href="?challenge=${i + 1}">✍️ Build: ${esc(chals[i].title.replace(/^React: /, ''))}</a>`;
      })).join('');
      return `<section class="rm-stage"><h3>${esc(st.title)}</h3><p>${esc(st.why)}</p><div class="rm-items">${items}</div></section>`;
    }).join('');
    const reactQs = ivs.filter(q => /^r(q|th)-/.test(q.id)).length;
    return `<div class="rm-progress"><b>${got} / ${total}</b> steps done<div class="rm-bar"><i style="width:${total ? Math.round(got / total * 100) : 0}%"></i></div></div>
      <p class="rm-note">Work top to bottom. For each lesson: answer the quiz first, then step through the code and watch the ⚛️ React panel. After each stage, solve its build challenges without looking at the solution. Then practise with the <a href="?interview=list">${reactQs} React interview questions</a> and the ⚛️ React mock interview.</p>${stages}`;
  }

  function cheatHTML() {
    const row = (a, b, c) => `<tr><td><code>${a}</code></td><td>${b}</td><td>${c}</td></tr>`;
    return `<h3>Hooks</h3><table class="rm-table"><tr><th>Hook</th><th>Use it for</th><th>Watch out</th></tr>
      ${row('useState(init)', 'local state; setter queues an update', 'value is a snapshot; use <code>set(x =&gt; …)</code> when it depends on the old value; never mutate')}
      ${row('useReducer(fn, init)', 'related state, many update types', 'reducer must be pure and return a new object')}
      ${row('useEffect(fn, deps)', 'sync with external systems after paint', 'list every dependency; return a cleanup; not for derived data')}
      ${row('useLayoutEffect', 'measure/fix the DOM before paint', 'blocks painting; prefer useEffect')}
      ${row('useRef(init)', 'DOM nodes, timers, values that must not re-render', 'changing .current does not render')}
      ${row('useMemo / useCallback', 'expensive values, stable identities for memo children', 'deps compared with Object.is; new objects break it')}
      ${row('useContext(Ctx)', 'shared values (theme, user)', 'every reader re-renders when the value changes')}
      ${row('useTransition / startTransition', 'non-urgent updates that can be interrupted', 'not for controlled input values')}
      ${row('useDeferredValue(v)', 'a lagging copy for slow children', 'pair with memo')}
      ${row('useSyncExternalStore', 'subscribe to stores outside React', 'getSnapshot must return a cached value')}
      ${row('useId', 'accessible ids, SSR-safe', 'not for list keys')}
      ${row('useImperativeHandle', 'expose a custom API through a ref', 'needs forwardRef (before React 19)')}
      ${row('use(promise | ctx)', 'read data with Suspense / context (React 19)', 'the promise must be cached')}
      ${row('useOptimistic / useActionState / useFormStatus', 'React 19 actions and forms', 'useFormStatus only works inside the form')}
      </table>
      <h3>What happens on setState</h3><ol class="rm-steps">
        <li>The setter puts an update in the hook's queue with a <b>lane</b> (Sync for clicks, Default otherwise, Transition in startTransition).</li>
        <li>React marks the fiber and its parents (<code>lanes</code> / <code>childLanes</code>) and schedules a render (microtask for Sync, task otherwise). Updates in the same event are <b>batched</b>.</li>
        <li><b>Render phase</b>: starting at the root, React skips subtrees with no work (bailouts) and calls components that have work; the hook processes its queue to get the new state.</li>
        <li><b>Reconciliation</b>: new elements vs old fibers, matched by type and key → keep / move / create / delete, marked with flags.</li>
        <li><code>completeWork</code> prepares DOM changes off-screen. Concurrent renders can pause here, or be interrupted and restarted.</li>
        <li><b>Commit</b> (synchronous): DOM mutations → swap <code>root.current</code> → layout effects and refs.</li>
        <li>After paint: <b>passive effects</b> (all cleanups, then all effects).</li></ol>
      <h3>Class lifecycles ↔ hooks</h3><table class="rm-table"><tr><th>Class</th><th>Hooks</th></tr>
        <tr><td><code>constructor</code>, <code>state = …</code></td><td><code>useState(() =&gt; init)</code></td></tr>
        <tr><td><code>componentDidMount</code></td><td><code>useEffect(fn, [])</code></td></tr>
        <tr><td><code>componentDidUpdate</code></td><td><code>useEffect(fn, [deps])</code></td></tr>
        <tr><td><code>componentWillUnmount</code></td><td>the cleanup function</td></tr>
        <tr><td><code>shouldComponentUpdate</code> / <code>PureComponent</code></td><td><code>React.memo</code></td></tr>
        <tr><td><code>getDerivedStateFromError</code> / <code>componentDidCatch</code></td><td>no hook: error boundaries stay classes</td></tr></table>
      <h3>Where should this state live?</h3><table class="rm-table"><tr><th>Kind</th><th>Where</th></tr>
        <tr><td>Used by one component</td><td><code>useState</code> in it</td></tr>
        <tr><td>Shared by siblings</td><td>lift to the closest common parent</td></tr>
        <tr><td>App-wide, rarely changes</td><td>context</td></tr>
        <tr><td>App-wide, changes often, many readers</td><td>a store with selectors (Zustand, Redux)</td></tr>
        <tr><td>Data from the server</td><td>a query cache (React Query, SWR, framework loaders)</td></tr>
        <tr><td>Filters, tabs, pages</td><td>the URL (search params)</td></tr>
        <tr><td>Can be computed from other state</td><td>nowhere: compute it during render</td></tr></table>
      <h3>Top gotchas</h3><ul class="rm-steps">
        <li>Index or missing keys → state on the wrong item. Mutated state → no re-render.</li>
        <li>Missing deps / cleanup → stale values, leaks, race conditions. <code>useEffect(async …)</code> is wrong.</li>
        <li>New objects/functions as props → <code>memo</code> does nothing. Context value <code>{{ … }}</code> → every reader re-renders.</li>
        <li><code>0 &amp;&amp; &lt;List/&gt;</code> renders "0". <code>onClick={f()}</code> calls f during render.</li>
        <li>Components defined inside components → remounted every render. Hooks after an early return → crash.</li>
        <li>Different first render on server and client → hydration mismatch (use effects for browser-only values).</li></ul>`;
  }

  function interviewHTML() {
    const ivs = window.JS_INTERVIEW || [];
    const items = MUST_KNOW.filter(([id]) => ivs.some(q => q.id === id)).map(([id, label], i) => `<a class="rm-item" href="?interview=${encodeURIComponent(id)}">${i + 1}. ${esc(label)}</a>`).join('');
    return `<h3>Answer like this</h3><ol class="rm-steps">
        <li><b>Define</b> it in one sentence.</li><li>Say <b>why</b> it exists (the problem it solves).</li>
        <li>Explain <b>how it works inside</b> (fibers, queues, lanes, reconciliation): this is where this lab helps you stand out.</li>
        <li>Give a <b>tiny example</b> or the code you would write.</li><li>Finish with a <b>pitfall or trade-off</b>, and when you would not use it.</li></ol>
      <h3>Must-know questions</h3><p class="rm-note">Open each one and say the answer out loud before reading it.</p><div class="rm-items cols">${items}</div>
      <h3>Coding round checklist</h3><ul class="rm-steps">
        <li>Repeat the requirements and ask about edge cases (empty, loading, error, many items).</li>
        <li>Sketch the component tree and the <b>minimal state</b>; derive everything else.</li>
        <li>Build the happy path first, then loading / error / empty states, then cleanups (timers, listeners, requests).</li>
        <li>Use keys, controlled inputs, and accessible elements (<code>button</code>, <code>label</code>).</li>
        <li>Talk while you code; test as you go; end with what you would improve.</li></ul>
      <p class="rm-note">Practice: everything is inside 🎓 Learn React. The Write it and Practise steps of each unit hold the build challenges and interview questions, and the last unit is a mock interview.</p>`;
  }

  // React system design: six designs worked through in React terms (open one at a time)
  const DESIGNS = [
    { t: 'News feed with infinite scroll', req: 'A list of posts; like; comment count; write a post; "3 new posts" banner; endless scrolling.',
      tree: '<FeedPage>\n  <Composer />          optimistic create\n  <NewPostsBanner />    new posts arrive by SSE / polling\n  <VirtualList>         TanStack Virtual / react-window\n    <PostCard>          memo\n      <LikeButton />    optimistic toggle\n      <CommentPreview />',
      state: [['Posts', 'React Query useInfiniteQuery (cursor pages)'], ['Draft text', 'local state in Composer'], ['New-posts count', 'SSE events written into the query cache'], ['Current user', 'context'], ['Like on one post', 'setQueryData on that one post (optimistic, rollback on error)']],
      api: 'GET /feed?cursor=…&limit=20 → { items, nextCursor }\nPOST /posts · POST /posts/:id/like\nGET /feed/stream (SSE)',
      perf: 'Virtualise the list; memo PostCard; prefetch the next page before the end (IntersectionObserver rootMargin); lazy images with sizes; update one post, not the list.',
      a11y: 'role="feed" with articles (aria-posinset / aria-setsize); announce new posts politely (aria-live); keep focus when more posts load.',
      test: 'LikeButton rolls back when the API fails (MSW); E2E: scroll loads page 2; a post appears after "Post".' },
    { t: 'Autocomplete / typeahead', req: 'Suggestions while typing; keyboard selection; recent searches; fast on slow networks.',
      tree: '<Combobox>\n  <input role="combobox" />\n  <Listbox role="listbox">\n    <Option role="option" />  (highlighted match)',
      state: [['Typed text', 'local state (controlled input)'], ['Debounced text', 'a useDebounce hook (or useDeferredValue)'], ['Results', 'React Query keyed by the debounced text, keep previous data'], ['Open / active index', 'local state'], ['Recent searches', 'localStorage']],
      api: 'GET /search?q=…&limit=8 (pass the AbortSignal)',
      perf: 'Debounce 200–300ms; cancel stale requests; cache by query; minimum 2 characters; memoise the highlighted rendering.',
      a11y: 'The ARIA combobox pattern: aria-expanded, aria-controls, aria-activedescendant; ↑ ↓ Enter Esc; announce "5 results".',
      test: 'user-event typing with fake timers; only one request after fast typing; a late slow response does not overwrite a newer one.' },
    { t: 'Chat app', req: 'Rooms; message history; live messages; sending with "sending… / failed" states; typing indicator; unread counts.',
      tree: '<ChatLayout>\n  <RoomList />            unread badges\n  <RoomView>\n    <MessageList />       virtualised, newest at the bottom\n    <TypingIndicator />\n    <Composer />',
      state: [['Rooms and messages', 'query cache, updated by WebSocket events'], ['Pending messages', 'added with a client id; matched when the server echoes them'], ['Connection status', 'context (online / reconnecting)'], ['Draft per room', 'local state, saved to localStorage'], ['Unread counts', 'derived from last-read ids']],
      api: 'GET /rooms/:id/messages?before=… (history)\nWebSocket events: message:new · message:ack · typing',
      perf: 'Virtualise long rooms; batch bursts of WebSocket updates; memo message rows; only auto-scroll if the user is at the bottom.',
      a11y: 'role="log" with aria-live="polite"; the composer is a labelled textarea; Enter sends, Shift+Enter adds a line.',
      test: 'A mock WebSocket server; sending offline shows "failed" with Retry; no duplicate after the echo arrives.' },
    { t: 'Analytics dashboard with filters', req: 'Filters (date range, region); KPI cards; charts; a sortable, paginated table; shareable links.',
      tree: '<DashboardPage>\n  <FilterBar />\n  <KpiRow />            <Suspense> each\n  <ChartPanel />        chart library lazy-loaded\n  <DataTable />         sort / paginate',
      state: [['Filters, sort, page', 'the URL search params (shareable, back button works)'], ['Widget data', 'React Query, the filters in each query key'], ['Totals and aggregates', 'derived with useMemo, not stored'], ['Chart hover / tooltips', 'local state inside the chart']],
      api: 'GET /metrics?from=…&to=…&region=… (one endpoint per widget, loaded in parallel)',
      perf: 'Parallel queries; a Suspense boundary and skeleton per widget; lazy-load the chart library; useDeferredValue while filters change; virtualise big tables.',
      a11y: 'Every chart has a text or table alternative; filters are real form controls with labels; sort buttons announce the order (aria-sort).',
      test: 'Changing a filter updates the URL and refetches; a copied URL restores the same view.' },
    { t: 'Multi-step checkout', req: 'Cart → shipping → payment → review → done; validation; survives a refresh; no double payments.',
      tree: '<Checkout>\n  <StepIndicator />\n  <CartStep /> <ShippingStep /> <PaymentStep /> <ReviewStep />',
      state: [['Current step', 'useReducer as a state machine (only allowed transitions)'], ['Form fields', 'React Hook Form + one zod schema per step'], ['Progress on refresh', 'sessionStorage (never card data)'], ['The cart', 'React Query (server state)'], ['Submitting', 'a mutation with an idempotency key']],
      api: 'GET /cart · POST /orders (Idempotency-Key header) · the payment provider\'s own fields (Stripe Elements)',
      perf: 'Lazy-load the payment SDK only on the payment step; prefetch the next step.',
      a11y: 'An error summary at the top with links to fields; focus the first error; aria-describedby for messages; the step indicator is a list with aria-current.',
      test: 'E2E: the happy path and a declined card; double-clicking Pay sends one order.' },
    { t: 'Kanban board', req: 'Columns and cards; drag cards between columns; keyboard moves; changes saved; other users\' changes appear.',
      tree: '<Board>\n  <Column>          memo\n    <Card />        memo, draggable',
      state: [['Board data', 'normalised: { cardsById, columns: [{ id, cardIds }] } in useReducer or Zustand'], ['Drag in progress', 'local state of the drag library (dnd-kit)'], ['Saving', 'optimistic update, rollback on error']],
      api: 'PATCH /cards/:id { columnId, position } (fractional positions avoid renumbering every card)',
      perf: 'Normalised data so a move only touches two columns; memo columns and cards; stable ids as keys.',
      a11y: 'Keyboard dragging and screen-reader announcements ("Card moved to Done, position 2"); dnd-kit has both built in.',
      test: 'Unit-test the reducer\'s move action; E2E drag with the keyboard.' },
  ];
  function designHTML() {
    const block = d => `<details class="rm-design"><summary><b>${esc(d.t)}</b></summary>
      <p><b>Requirements:</b> ${esc(d.req)}</p>
      <p><b>Component tree</b></p><pre class="rm-pre">${esc(d.tree)}</pre>
      <p><b>State: where each piece lives</b></p><table class="rm-table">${d.state.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
      <p><b>API</b></p><pre class="rm-pre">${esc(d.api)}</pre>
      <p><b>Performance:</b> ${esc(d.perf)}</p><p><b>Accessibility:</b> ${esc(d.a11y)}</p><p><b>Testing:</b> ${esc(d.test)}</p></details>`;
    return `<h3>Design it in React terms</h3><ol class="rm-steps">
        <li><b>Requirements</b>: the 3–4 core features; who uses it, on which devices; real-time? offline? how much data?</li>
        <li><b>Component tree</b>: draw it; say which parts are memoised, lazy or inside Suspense.</li>
        <li><b>State</b>: for each piece say where it lives (local, lifted, URL, context, store, query cache) or that it is derived.</li>
        <li><b>Data and API</b>: endpoints, pagination, real-time updates, errors.</li>
        <li><b>Performance, accessibility, testing</b>: the few that matter most here, with trade-offs.</li></ol>
      <p class="rm-note">There is no single right design: interviewers want clear reasons. Open one design, cover it, say your own answer, then compare.</p>
      ${DESIGNS.map(block).join('')}`;
  }

  let tab = 'cheat';
  function render() {
    const body = $('roadmapBody');
    if (!body) return;
    document.querySelectorAll('#roadmapModal [data-rmtab]').forEach(b => b.classList.toggle('on', b.dataset.rmtab === tab));
    body.innerHTML = tab === 'cheat' ? cheatHTML() : tab === 'interview' ? interviewHTML() : tab === 'design' ? designHTML() : roadmapHTML();
  }
  function open(t) { if (t) tab = t; render(); $('roadmapModal').classList.remove('hidden'); }
  document.addEventListener('click', e => {
    if (e.target.closest('#btnRoadmap') || e.target.closest('#btnGuides')) { open(); return; }
    const o = e.target.closest('[data-cheat]');
    if (o) { const map = $('courseMap'); if (map) map.classList.add('hidden'); open(o.dataset.cheat); return; }
    const t = e.target.closest('#roadmapModal [data-rmtab]');
    if (t) { tab = t.dataset.rmtab; render(); }
  });
  window.ReactRoadmap = { STAGES, MUST_KNOW, DESIGNS, render, open, tab: () => tab };
})();
