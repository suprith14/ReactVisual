# React Engine Lab

An interactive tool for learning how React works inside, built on JS Engine Lab. Your React code runs step by step on **ReactLite**, a small React written to work like React 18, inside the same JavaScript engine visualizer. You see:

- **JSX** turned into `React.createElement` calls and element objects
- the **fiber tree**: the current tree and the work-in-progress tree (double buffering), with flags (`Placement`, `Update`, `ChildDeletion`, `Passive`) and pending lanes
- the **render phase**: `beginWork`, the reason each component renders (mount, state, props, context), bailouts and `memo`
- **reconciliation** with keys: keep, move, create and delete, using React's `lastPlacedIndex` rule
- **hooks** as a linked list on each fiber, update queues, batching and the eager bailout
- the **commit phase**: DOM changes, `useLayoutEffect`, refs, the tree swap, then `useEffect` after paint, with cleanups
- **scheduling**: Sync, Default and Transition lanes, time slicing, and urgent updates interrupting a transition
- **events**: one listener per event type on the root, synthetic events, bubbling and `stopPropagation`

Everything from JS Engine Lab (call stack, heap, event loop, the 52 JavaScript lessons and 240+ JavaScript interview questions) is still here.


## Start here: the guided course

Press **🎓 Course** (it also opens on your first visit). It is one path through React in **24 units**, from "what a React element is" to SSR, state libraries and a final project. Every unit has the same steps:

1. **📖 Learn & predict**: read a short lesson, then guess the output before you see it.
2. **👀 Watch it run**: step through the code. The coach bar tells you which part of the ⚛️ React panel to look at.
3. **🗣️ Explain it**: answer an interview question in your own words, then compare with a model answer and tick the key points you covered.
4. **✍️ Write it**: build a component or re-implement the mechanism yourself (checked automatically).

While the course is on, the screen shows **one thing at a time** ("🎯 One screen", the default): only your code while your code runs, only the ⚛️ Inside diagram while React works, and the diagram next to the live page while React changes the page. The view switches by itself as you step. The coach bar button cycles to "Key panels" (code, page and React together) or "All panels". Your progress, notes and explanations are saved in the browser. When the course is done, use the ⚛️ React mock interview, the build challenges and the 200+ interview questions to practise.

### The "Inside" view: React's internals as diagrams

The ⚛️ React panel opens on **Inside**. On every React step it shows:

- **The pipeline** (10 numbered stations): Trigger → Update queued → Scheduled → Render → Reconcile → Commit: DOM → Swap trees → Layout effects → Paint → useEffect, with the current station lit.
- **A diagram of exactly what React does at that moment**, built from React's real data: the update object joining the hook's circular queue and the lanes marked up to the root; the lane bits; the queue being replayed (base state → update → new state, with skipped updates); the work loop (fibers numbered in `beginWork` order, ✓ when `completeWork` is done, the `workInProgress` pointer); old vs new children in reconciliation (keep / move / create / delete); the list of DOM operations in the commit; the tree swap; the order of effects and cleanups; an event's path from the target up to the root listener; the boundary search for errors and Suspense; hydration.
- **The lane check, as bits**: on every `beginWork`, bailout and skipped subtree, `renderLanes`, `fiber.lanes` and `fiber.childLanes` are drawn as 7 lane bits (React 18 values: Sync 1, Input 4, Default 16, Transition 64), with the decision React takes: do the work, clone the children, or skip the whole subtree.
- **The scheduler**: when work is scheduled (microtask for Sync, a Scheduler task at Normal priority for Default and Transition, with the priority/timeout table), the time slice being filled fiber by fiber, `shouldYield()` stopping it, the browser's turn, the next slice resuming, and an urgent update interrupting a paused Transition render (the old slices are thrown away and the render restarts from the root).
- **📂 In React's source**: the real React functions this step matches and the module they live in (for example `performUnitOfWork()` → `beginWork()` → `renderWithHooks()`). Each one links to a search of github.com/facebook/react, so you can read the real code. ReactLite uses the same names where it can, so the two map one to one.
- **"In one sentence"**: the mechanism of this step in one sentence.
- **🔸 Changed in this step**: what differs from the previous step (a hook value old → new, a new flag, new pending work, new fibers). The Hooks tab marks the same values and shows the old one.
- **Fiber → DOM**: on a commit step that touches one element, the Page panel outlines that element with what happens to it (insert, update, text, hide, show, adopt) and an arrow goes to it from the React panel.
- **Phase bands on the timeline**: in React programs a second row under the step bar shows React's phase at each step (your code, update, render, commit, effects), labelled on long stretches. Hover for the phase, click to jump.
- **The component being rendered**: while React renders a component, its whole function is marked in the code with "⚛️ React renders Name"; when React skips it (bailout, memo), it is greyed with "⏭ React skips Name".
- **⏸ Stop at React** (button next to "Next breakpoint"): while playing, pause where React starts a render, a commit, its effects, or all three.
- **Animated queues**: a new update slides into the hook's queue, and the queue is replayed one update at a time.
- **Short narration**: long explanations show their first sentence; **more ▾** shows the rest (remembered).
- **🏋️ Practice** (header button, next to React concepts): every React interview task in one list: 117 code questions (predict the output, find the bug, implement it) and the 18 build challenges as the "machine coding round", in learning order, easier first. Each opens straight into doing it, and **💡 need a hint?** opens the matching React concept.
- **📚 Guides** (header button, next to Practice): the cheat sheet (hooks, what happens on setState, lifecycles ↔ hooks, where state lives, top gotchas), the interview-day checklist with the must-know questions, and **React system design**: six designs worked through (news feed, autocomplete, chat, dashboard with filters, multi-step checkout, kanban), each with requirements, the component tree, where every piece of state lives, the API, performance, accessibility and testing.
- **React in one picture**: the first concept follows one click through all seven stages (trigger → update → schedule → render → commit → paint → effects), and names the concepts that zoom into each stage.
- **⚖️ Compare** (next to "Lesson & quiz", on concepts where the difference matters: index keys, memo, effect dependencies, useMemo, startTransition, updater functions): runs the concept and a version with one change side by side, with the console, React's work (renders, skipped components, DOM changes, effects) and the final page, plus a one-line explanation.
- **Simple by default**: each step shows one sentence and the main picture. **More detail ▾** adds the pipeline, the lane bits, the scheduler table, the source links and the summary sentence (remembered per browser).
- **◀ / ▶ React step** buttons that skip your own code's steps and jump straight between React's steps.

### One panel at a time

Outside the course, the right side shows **only the panel that is working at this step**: the **Call Stack** for function calls, scopes and memory; the **Heap** when an object is created; **Web APIs & queues** for timers, promises and the event loop; **React** for React steps. The "Showing" strip in the top bar lights the active panel; click one to pin it, click again (or "auto") to follow the steps again. Turn it off in **View → One panel at a time** (key **O**).
## React features

- **⚛️ React panel** (next to the Heap), shown when a program uses React:
  - the stage of React's work loop: Trigger → Render → Commit → Effects
  - **Fibers**: the tree, with the fiber being worked on, rendered and skipped fibers, flags, lanes, props and hooks. Switch between the current and work-in-progress trees, or let it follow the render (auto).
  - **Hooks**: each component's hooks as a linked list, with values, dependencies and queued updates
  - **Log**: every React action so far; click one to jump to it
- The phase banner shows React's phase (for example **REACT RENDER PHASE (Sync)**) and the component being rendered.
- React's own work is one step per action, and its call-stack frames are folded into one block. **View → Inside React** (key **K**) re-records the program so you can step through every line of ReactLite itself.
- **⚛️ React concepts** (the one header button): a straight, numbered list of all 83 React concepts, from JSX to the internals. Click one and its code runs at once; step through it with the normal controls. A small pill next to the title (◀ Concept n / 83 ▶) goes to the previous or next concept. No course steps, progress or scores.
- **83 React lessons** in eight parts (Rendering · Hooks & effects · Scheduling & the commit · Classes, errors & Suspense · Advanced patterns & React 19 · SSR, forms & the ecosystem · The commit in detail & React 19.2 · Every other concept), each with an explanation and a predict-the-output quiz. Part 6 covers server rendering and hydration, hydration mismatches, Server Components (the RSC payload, client references and server functions), form actions, and builds tiny versions of a router, a Zustand store, React Query and a testing library, plus TypeScript with React and list virtualization. Part 7 covers the four parts of the commit (before mutation, mutation, layout, passive), `useId`, `<Activity>` (hide without losing state: effects clean up, state stays) and `useEffectEvent`. Part 8 adds: updating objects and arrays in state, preserving and resetting state with keys, "you might not need an effect", fetch race conditions, uncontrolled inputs, higher-order components, React 19 refs (ref as a prop, ref cleanups), React 19 context (`<Context value>`, `use(context)`), document metadata, `<Profiler>`, the React Compiler (`useMemoCache` cache slots), streaming SSR, what error boundaries don't catch, how React diffs a list (two passes and `lastPlacedIndex`, with a decision table in the Inside view), `<Activity>` preparing hidden content at the Offscreen lane, the React 19 error options of `createRoot`, what React DevTools shows (`useDebugValue`), selective hydration (a dehydrated Suspense boundary hydrated first when clicked, and the click replayed), resource loading (`preconnect`, `preload`, `preinit` and stylesheets with `precedence`), `cache()` in server components, static pre-rendering (`prerender` from `react-dom/static`) and `requestFormReset`. The context concept now shows React walking down the tree to find the readers.
- **18 React build challenges** (kept in the code, not shown in the app) (the machine-coding round): counter, password toggle, todo list, tabs, accordion, star rating, debounced search, fetch with loading/error, pagination, stopwatch, form validation, traffic light, tic-tac-toe, recursive file explorer, cart with useReducer, progress bar, autocomplete and a portal modal. The checker renders your `App`, clicks and types like a user, and compares the page.
- **207 React interview questions** (kept in the code, not shown in the app): 90 theory flashcards and 117 code questions, including SSR and hydration, forms, ecosystem patterns (stores, routers, data fetching), TypeScript, Next.js, testing, performance, accessibility, security, architecture and interview technique. Seventeen "implement it" questions work in **Write it yourself** mode.
- React's development warnings are shown like the real ones: missing and duplicate keys, objects as children, async effect functions, hook order, too many re-renders.
- Programs can use JSX directly, `React.*` / `ReactDOM.*`, or `import { useState } from "react"` and `import { createRoot } from "react-dom/client"`. A React program starts with an empty `<div id="root">` page.

Supported React API (React 18 behaviour plus the React 19 and 19.2 additions below):
- **Components**: function components, class components (`Component`, `PureComponent`, every lifecycle including `getDerivedStateFromProps`, `getSnapshotBeforeUpdate`, `shouldComponentUpdate`, `contextType`, `defaultProps`), error boundaries (`getDerivedStateFromError`, `componentDidCatch`), `memo`, `forwardRef`, `lazy`, `Fragment`, `Activity` (React 19.2: hidden content keeps its state, its effects are cleaned up and run again when shown; hidden content that was never shown is pre-rendered at the Offscreen lane, without effects), `StrictMode` (double render and double effects), `Suspense` (fallbacks, hidden content that keeps its state, transitions that keep the old UI).
- **Hooks**: `useState`, `useReducer`, `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useRef`, `useMemo`, `useCallback`, `useContext`, `useTransition` (sync and async actions), `useDeferredValue`, `useId`, `useSyncExternalStore`, `useImperativeHandle`, `useDebugValue`, from React 19 `use`, `useOptimistic`, `useActionState`, from React 19.2 `useEffectEvent`, and the React Compiler runtime (`import { c } from "react/compiler-runtime"`, the memo cache).
- **Server and forms**: `ReactDOMServer.renderToString` / `renderToStaticMarkup` / `renderToPipeableStream` (streaming: the shell with fallbacks first, then one chunk per Suspense boundary with `$RC`) (with React's text and Suspense markers), `ReactDOM.hydrateRoot` (adopts the server DOM; mismatch warnings and client-render fallback), `<form action={fn}>`, `useFormStatus`, `FormData`, controlled-input restore and React's read-only warning, TSX (TypeScript + JSX). React 19: `ref` as a prop of function components, callback refs that return a cleanup, `<Context value>` as a provider, `<title>` / `<meta>` / `<link>` hoisted into `<head>`, `<Profiler onRender>` (ReactLite counts 1 per rendered component instead of milliseconds), `createRoot` / `hydrateRoot` options `onCaughtError`, `onUncaughtError`, `onRecoverableError`, `useDebugValue` labels (shown in the Hooks tab), and React Server Components through a `ReactServer` global: `registerClientReference(id)`, `registerServerReference(fn, id)`, `renderToFlight(element)` (server components may be async; writes I, F and 0 rows) and `createFromFlight(payload, modules)` (server functions are called with JSON arguments).
- **Other**: `createContext` (Provider and Consumer), `createElement`, `cloneElement`, `isValidElement`, `Children`, `startTransition`, `createRoot` (`render`, `unmount`), `createPortal` (events bubble through the React tree), `flushSync`, capture-phase handlers (`onClickCapture`).
- Updates live in base queues like React's, so interrupted, thrown-away or suspended renders never lose an update.

Not included: a real network, server and bundler for Server Components (ReactLite runs both sides in one page and its payload is simplified), and the React DevTools extension itself (the Fibers and Hooks tabs show the same data).

React files: `js/engine/jsx.js` (JSX transform with a position map), `js/react/reactlite.js` (ReactLite), `js/engine/react.js` (turns ReactLite's reports into steps and snapshots), `js/react-panel.js` (the panel), `js/react-lessons.js` and `js/react-interview.js`. The tests check every React lesson and question against React 18's output.

---

The rest of this file describes the JavaScript engine lab this project is built on.

## JS Engine Lab

An interactive tool for learning exactly how JavaScript executes. Every program is shown step by step:

- the **creation phase** (hoisting) and the **execution phase**
- the **call stack** and the **memory and scopes** of each execution context
- the **heap**, with garbage collection
- **Web APIs**, the **microtask and callback queues**, and the **event loop**

Lessons, prediction quizzes and auto-checked coding challenges take you from understanding the engine to writing the code yourself.

## How to run

Open `index.html` in any modern browser. No install or build step is needed.

The editor (CodeMirror) and the fonts are stored in `vendor/`, so everything works offline.

Open `tests.html` after changing the engine. It runs every lesson, feature program and challenge, and compares the output with real JavaScript in your browser, and every React lesson and question with React 18 (currently 674 checks, including one that every React lesson is inside the course). `ui-tests.html` clicks through the app (41 checks).

## Learning workflow

1. **Lessons**: 52 lessons in three parts.
   - **Part 1, how code runs:** hoisting, the call stack, scope, the TDZ, closures, `this`, recursion, errors, strict mode
   - **Part 2, asynchronous JavaScript:** the event loop, microtasks, promises, async/await, `fetch` (pretend and real), DOM events, your own web page, dialogs and storage, `Promise.allSettled`/`any`, `URL`/`AbortController`, Web Workers, shared memory and `Atomics`, the Node.js event loop, `EventEmitter`, files (`fs`/`path`) and an HTTP server
   - **Part 3, objects, iteration and the platform:** classes, private fields, generators, iterators, async streams, Map/Set, RegExp, Proxy, property descriptors, binary data, modules, top-level await, lazy `import()`, `Intl`/`WeakRef`/`eval`, and engine internals (hidden classes, inline caches, JIT)

   Each lesson opens with an explanation and a **predict-the-output** question.
2. **Step through** the real execution. The explanation bar describes every step.
3. **Click any line** for a plain-English explanation and to jump to when it runs.
4. **Challenges**: 33 exercises you solve yourself, checked against tests, with hints and a sample solution. **Run ▶** steps through your own solution.
5. **Interview questions** (🎤 Interview in the top bar): 245 items in 27 topics (196 runnable code questions and 49 theory flashcards): scope, closures, `this`, coercion, tricky output, strings and arrays, objects, ES6+ syntax, classes, errors, the event loop, async patterns (debounce, throttle, retry, promise pools), the browser and DOM, Node.js, modules, dates/regex/JSON, memory, polyfills and "implement it" tasks, data structures (linked list, tree, graph), sorting, coding problems, design patterns, how frameworks work (useState, useEffect, virtual DOM, reactivity, Redux, routers), functional programming, testing (a mini test framework, spies, fake timers) and advanced algorithms (trie, Dijkstra, topological sort, rate limiter, N-Queens). You can search them, pick a topic, filter by Easy / Medium / Hard, or open a random one you have not tried. Each question loads into the visualizer. Predict the answer, then open **Answer** for the output and the explanation, or press ▶ to watch it run. Link to one with `?interview=<id>`, or to the list with `?interview=list`.
   - **Predict mode:** type the output you expect, then check it line by line against the real output (XP for exact answers). **Flashcards:** answer, reveal the model answer, then mark "I knew it" or "Review again".
   - **Mock interview:** 5 random questions (Easy, Medium, Medium, Hard and a flashcard) in 15 minutes, with a timer bar and a scorecard at the end.
   - **Progress:** solved counts per topic, bookmarks (★), a "to review" list and private notes per question. Filter the list by Not solved, Bookmarked or To review; search also looks in your notes.
   - **✍️ Write it yourself:** 98 implement-style questions (debounce, Promise.all, LRU cache, deep clone, Trie, Dijkstra, useState, Redux…) become exercises: the function bodies are removed, the test code stays, and **Check solution** compares your output with the reference. When a check fails, **common-mistake hints** point at typical bugs (async in forEach, a missing return in map, off-by-one loops, sort without a compare function, missing base cases…).
6. **Progress**: XP, ranks and achievements, saved in your browser.

## The workspace

| Panel | Shows |
|---|---|
| Code | The current line, the exact expression being evaluated, breakpoints (click a line number), the line explainer, and code run by `eval` / `new Function` |
| Call Stack | Execution contexts: phase, `this`, local memory, block scopes, closures and the scope chain. Paused async functions, generators and modules are listed below the stack, and module memory stays visible |
| Heap | Objects, arrays, functions, classes, promises, Map/Set, Proxy, WeakRef, Intl and DOM objects. In the View menu, **Reference arrows** draw references from variables, **Garbage collection** shows which root keeps each object alive, and **Heap as a graph** shows a diagram |
| Web APIs | Timers (TMR), intervals (INT), network requests (NET), DOM events (EVT), animation frames (RAF), finalizer cleanup (GC) |
| Queues | The microtask queue (always drained first), the callback queue and the event loop |
| Console / Page | Program output, and a simulated web page when the code uses `document` |

**Controls:**
- <kbd>→</kbd> / <kbd>←</kbd> step, <kbd>Space</kbd> play/pause
- <kbd>↓</kbd> step over, <kbd>↑</kbd> step out, <kbd>B</kbd> next breakpoint
- <kbd>Home</kbd> / <kbd>End</kbd> jump to the start or end
- <kbd>Ctrl</kbd>+<kbd>Enter</kbd> run, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> check a challenge
- **Share** copies a link that contains your code. Light/dark theme and sound are in the top bar
- Animations follow your system's reduced-motion setting

**Link options:**
- `?level=5&step=20` opens lesson 5 at step 20
- `?challenge=3` opens challenge 3
- `?code=…` opens shared code
- `&lesson=quiz` opens the lesson's quiz
- `&theme=light` uses the light theme
- `&arrows=1` turns on the arrows

## The browser environment

Execution is recorded first and then replayed, which is what makes stepping backward and breakpoints possible. Anything that comes from outside the program is collected between runs, and the program is then re-run with it, so the recording stays exact:

- **Real network:** `fetch("https://…")` and `XMLHttpRequest` reach the real internet.
  - Each request is made once, and the program is replayed with the real response and the real response time.
  - The server must allow cross-site requests (CORS headers), as public test APIs like `jsonplaceholder.typicode.com` do.
  - Failed requests reject with `TypeError: Failed to fetch`, like in a real browser.
- **Real page:**
  - Add a `// @file index.html` section to write your own HTML, and a `// @file script.js` section for the code.
  - The page is a real DOM: every CSS selector, `classList`, `style`, attributes, `createElement`/`append`, `onclick`, and events that bubble (delegation, `stopPropagation`, `currentTarget`), plus `Event`/`CustomEvent` with `dispatchEvent`.
  - **Click or type in the Page preview** and the program re-runs with your event at that moment.
- **Dialogs:** `alert`, `confirm` and `prompt` show real dialogs the first time. Your answers are then replayed.
- **Storage:** `localStorage` persists between runs (a "clear" link is shown under the page), while `sessionStorage` starts empty each run.
- **Also available:** `navigator` (real language and user agent) and `location` (a pretend address).
- **Step limit:** 5,000, 20,000 or 50,000 steps, chosen in Reference.

The pretend server and helpers are still there for predictable lessons:

- **`fetch`** answers these routes:
  - `/api/users` and `/api/users/1`, `2`, `3`
  - `/api/todos`
  - `/api/slow` (2 s)
  - `/api/error` (500)
  - any other route returns 404, and `POST` returns 201

  Add your own routes with `mockFetch("/api/x", data, { status, delay })`.
- **DOM:**
  - the page has `#title`, `#btn`, `#name` and `#output`
  - supported: `getElementById`, `querySelector(All)`, `createElement`, `appendChild`, `textContent`, `value`, `addEventListener`, `.click()`
  - `simulateClick(sel, ms)` and `simulateTyping(sel, text, ms)` pretend a user acts at a given time
- **Modules:** start each file with a line like `// @file math.js`. The entry is `main.js`, or the last file. Top-level `await` is supported.
- **Garbage collection** is a predictable mark-and-sweep, so `WeakRef` and `FinalizationRegistry` behave the same on every run. Real engines collect whenever they choose.

## Other environments and views

- **Node.js mode:** start the code with `// @env node`. You get:
  - `process.nextTick` (its own queue, drained before promises)
  - `setImmediate` and Node's event-loop phases (timers → poll → check), shown in the status bar
  - `require("events")` (a real `EventEmitter`, stepped through like your own code), `require("util")` (`promisify`, `inspect`) and `require("timers/promises")`
  - `require("path")`: `join`, `resolve`, `basename`, `dirname`, `extname`, `relative`, `parse`, `format`
  - `require("fs")` and `require("fs/promises")` on a virtual disk at `/home/user/app`: sync calls block the thread, while callback and promise calls finish in the poll phase. Supported: `readFile`, `writeFile`, `appendFile`, `unlink`, `readdir`, `mkdir`, `stat` and `existsSync`. Missing files give `ENOENT` errors, and reads without an encoding return a `Buffer`. The **Disk** view shows the files and marks the ones your code wrote.
  - `require("http")`: `createServer`, `listen`, `close`, `req.on("data"/"end")` and `res.writeHead`/`setHeader`/`write`/`end`. `fetch("http://localhost:PORT/...")` reaches your server, so a client and a server run in one program.
  - browser-only globals are removed
- **Web Workers:** a `// @file worker.js` section (the file name must contain "worker") runs on its own "thread", started with `new Worker("worker.js")`.
  - It has its own global memory, shown separately.
  - `postMessage` sends structured-clone **copies**.
  - Every worker has **its own call stack**, shown as a lane under the main Call Stack. Several workers with work at the same time take turns **one statement at a time**, so you can see how parallel threads interleave.
  - `SharedArrayBuffer` is shared (not copied) between threads, so data races can happen. `Atomics` (`add`, `sub`, `and`, `or`, `xor`, `load`, `store`, `exchange`, `compareExchange`, `wait`, `waitAsync`, `notify`) fixes them. `Atomics.wait` puts a worker to sleep until another thread calls `notify`.
  - Two workers made from the same file get distinct names (`worker.js`, `worker.js #2`).
- **Data files:** any `// @file name.txt` or `// @file data.json` section that isn't JavaScript becomes a file. It goes on the disk in Node mode, and the pretend server serves it to `fetch("data.json")` in browser mode.
- **TypeScript:** start the code with `// @lang ts` (or name a section `// @file main.ts`). Types, interfaces, type aliases, generics, `as`, `!`, `?`, access modifiers and `implements` are blanked out with spaces before running, so every highlight still lines up with your TypeScript. Enums, namespaces and constructor parameter properties give a clear error instead.
- **Temporal:** `Temporal.PlainDate`, `PlainDateTime`, `ZonedDateTime`, `Instant`, `Duration` and `Temporal.Now`, using the browser's own implementation (when the browser has one).
- **More Node modules:** `crypto` (`createHash` with SHA-256/SHA-1, `randomUUID`, `randomInt`, `randomBytes`), a global `Buffer` (`from`, `alloc`, `concat`, `toString("hex" | "base64")`), and `stream` (`Readable`, `Writable`, `Transform`, `PassThrough`, `pipeline`, `for await`, `fs.createReadStream` / `createWriteStream`; written in JavaScript so you can step through them).
- **Engine internals** (View menu), all clearly simulated:
  - **hidden classes**: objects with the same properties added in the same order share a shape
  - **inline caches**: each property read shows how many shapes it has seen (monomorphic, polymorphic or megamorphic)
  - **hot functions**: call counts, with a note when a real engine would compile the function (JIT)
- **Predictable randomness:** `Math.random` and `crypto` use a seed, so every re-run of the same code (for example while fetching real data) is identical. Editing the code picks a new seed.

## Visual tools

- **🧭 Guided tour:** on the first visit, a 10-step tour highlights each part of the screen (code, controls, timeline, narrator, stack, heap, queues, View menu, Lessons/Interview) with a short tip. Use ← → or the buttons, and Esc to skip. Replay it from the **?** window, or open the app with `?tour`.
- **👁 View menu** (next to the lesson title): every display option in one place, with presets: **Minimal** (just the panels), **Beginner** (values and flow arrows, the default), **Standard** (+ reference arrows) and **Full detail** (+ garbage collection and engine internals). Keys: `1`–`4` for the presets; `V`, `F`, `X`, `R`, `T`, `A`, `G`, `C`, `N` toggle single options.
- **Expression evaluation** (under the code): the current line broken into its parts, inner parts first, each with its value; the parts computed in this step are highlighted. Example: `"10" + 1 - 1` → `"101"` → `100`.
- **Array view** (in the heap): arrays of up to 30 numbers or strings become bars or cells, with index pointers (`i`, `j`, `lo`, `hi`, `mid`, `left`, `right`…) above them, and the cells read or written in this step highlighted. Made for sorting, two pointers, binary search and sliding windows.
- **Call tree** (top of the Call Stack): every function call as a tree with its arguments; finished calls show their return value, the running call is highlighted and the waiting ones are dashed. Shows exactly why naive recursion such as `fib` repeats work.
- **✓ true / ✗ false** next to every `if`, loop and ternary condition, with "truthy" / "falsy" for non-boolean values.
- **Timeline strip** (above the controls): one coloured tick per step (calls, returns, loops, the event loop, errors; breakpoints are red dots). Hover for details, click to jump.
- **Inline values** (View menu): each line shows the latest value it produced at its end, like `s = 16` or `⟶ printed text`.
- **Flow arrows** (View menu): animated arrows for where each step jumps in the code and how it moves through the engine (stack, heap, Web APIs, queues, console), including scope-chain lookups.
- **Event loop ring**: a token moves between the stations (script → microtasks → task → render; in Node: ticks, timers, poll, check).
- **Heap as a graph** (View menu): the heap as a graph of references, from the variables on the stack; unreachable objects fade.
- **Compare** (footer): run two versions of the code side by side and see where the output differs.
- **📈 Big-O lab** (footer): runs code for growing input sizes, counts the engine steps, plots them and estimates the complexity (O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ)). Presets compare linear vs binary search, bubble vs merge sort, naive vs memoized Fibonacci and nested loops vs a Set; **Use my code** measures your own function. Setup code is not counted (`startMeasure()` marks where counting starts).
- **⏺ Record**: records a WebM video of the run (the browser asks which tab to share). **⬇ Steps**: downloads every step as a Markdown table.
- **?**: keyboard shortcuts.
- Changed values slide in, and promises change colour as they settle.

## Install and back up

- **Install as an app:** when the folder is served over http(s) (for example `npx serve` or GitHub Pages), an **📲 Install** button appears; the service worker (`sw.js`) keeps every file cached so it works offline.
- **Progress → Export / Import:** downloads or restores a JSON file with your XP, badges, solved questions, spaced-repetition schedule, bookmarks, notes and drafts.

## Project structure

- `index.html`, `css/styles.css`, `css/fonts.css`: the interface (dark and light themes, phone layout, keyboard focus rings, screen-reader announcements for each step)
- `js/app-config.js`: badges, step kinds, lesson groups, view options, tour steps and lab presets (pure data)
- `js/write-it.js`: builds the write-it-yourself exercises
- `js/app.js`: rendering, playback, breakpoints, lessons, quizzes, challenges, progress and sharing
- `js/examples.js`, `js/lessons.js`, `js/challenges.js`, `js/interview.js`, `js/interview-more.js`, `js/interview-extra.js`: course content
- `js/explain.js`: the line explainer
- `js/engine/`: the interpreter, which records a snapshot of the whole engine state at every step:
  - `core.js`: data types, snapshots and garbage collection
  - `builtins.js`: globals, the simulated browser, Proxy and Reflect
  - `classes.js`: classes and generators
  - `promises.js`: promises and microtasks
  - `methods.js`: methods of built-in types
  - `members.js`: property access, scopes and hoisting
  - `program.js`: scripts, modules, top-level await, the event loop, calls and async/await
  - `statements.js` and `expressions.js`
  - `extras.js`: `eval`, `new Function`, `WeakRef`, `FinalizationRegistry`, `Intl` and `mockFetch`
  - `threads.js`: worker threads with their own stacks, the statement-by-statement scheduler, `SharedArrayBuffer` and `Atomics`
  - `node.js`: Node's `path`, `fs`, `fs/promises` and `http`, plus data files
  - `evalviz.js`: records sub-expression values, array reads/writes and return values for the evaluation tree, array view and call tree; also the step counter for the Big-O lab
  - `nodeplus.js`: Temporal, Buffer, crypto and stream
  - `typescript.js`: the TypeScript type stripper
  - `observers.js`: `MutationObserver` (real records, delivered as microtasks), simulated `ResizeObserver` / `IntersectionObserver`, and CommonJS `require("./file.js")` in Node mode
  - `protos.js`: `Array.prototype`, `Function.prototype`, `String.prototype` and `Number.prototype` you can extend (polyfills), `reduceRight`, `Object.is` and the spec order of object keys
  - `platform.js`: `Promise.allSettled`/`any`, property descriptors, newer array/object helpers, `structuredClone`, typed arrays and binary data, `URL`, `AbortController`, `crypto`, `Symbol.hasInstance`/`toStringTag`, dynamic `import()`, Web Workers, Node.js mode, and engine internals, real network replay, dialogs, storage, `navigator`/`location` and `XMLHttpRequest`
- `sw.js`, `manifest.webmanifest`, `icon.svg`: offline cache and app install
- `vendor/`: the Acorn parser, CodeMirror and the fonts (for offline use)
- `tests.html`: the engine test suite (lessons, features, challenges, interview questions, the snapshot cache, write-it-yourself exercises)
- `ui-tests.html`: interface tests that click through the real app (menus, practice modes, tools). Open it over a local web server.

## Language coverage

Essentially the complete language:

- scope, hoisting, the TDZ, closures, strict mode
- every function form, `this`, `call`/`apply`/`bind`, `arguments`, `new.target`
- objects, getters and setters, destructuring, spread, tagged templates
- classes (fields, `#private`, static blocks, extending `Error`/`Array`/`Map`/`Set`), prototypes
- `Symbol` (`iterator`, `asyncIterator`, `toPrimitive`)
- generators, iterators, async generators, `for await`
- promises and thenables, async/await
- timers, `requestAnimationFrame`, modules with top-level await
- Map/Set/WeakMap/WeakSet, WeakRef/FinalizationRegistry
- RegExp, Date, `Intl`, BigInt, Proxy/Reflect, JSON, Math
- `eval`, `new Function`, and the main `console` methods
- `Promise.allSettled`/`any`/`withResolvers`, `AggregateError`, `Error` `cause`
- property descriptors, `seal`/`preventExtensions`, `Object.groupBy`/`hasOwn`, `toSorted`/`toReversed`/`toSpliced`/`with`, `structuredClone`
- `ArrayBuffer`, typed arrays, `DataView`, `TextEncoder`/`TextDecoder`, `URL`/`URLSearchParams`, `AbortController`/`AbortSignal.timeout`, `crypto`
- dynamic `import()`, Web Workers with shared memory and `Atomics`, and Node.js mode with `path`, `fs` and `http`

**Limits:**
- Real network requests only work with servers that allow cross-site requests (CORS).
- Responses are capped at 200 KB.
- Navigating away (`location.assign`, `reload`) is not simulated.
- Programs stop at the chosen step limit.
- Thread interleaving is deterministic (one statement per turn). Real threads are unpredictable, so a race can lose a different number of updates on each run. A worker only takes turns inside its top-level code and its message handlers; `Atomics.wait` blocks only when it is called directly in that code.
- Node's `fs` works on a virtual disk that resets on every run, and `http` servers can only be reached from the same program.
