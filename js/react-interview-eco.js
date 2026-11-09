/*
 * React Engine Lab — interview questions on SSR, forms, the ecosystem (routing, state, data fetching, testing,
 * Next.js), TypeScript, performance, accessibility, security, architecture and how to answer in an interview.
 */
(function () {
  'use strict';
  const R = 'ReactDOM.createRoot(document.getElementById("root"))';
  const Q = (id, cat, level, title, ask, code, why) => ({ id: 'rq-' + id, cat, level, title, ask, code, why });
  const T = (id, level, q, a) => ({ id: 'rth-' + id, cat: 'React theory', kind: 'theory', level, title: q, ask: q, why: a });
  const C = { ssr: 'React: SSR & hydration', forms: 'React: forms', eco: 'React: ecosystem patterns', ts: 'React: TypeScript', impl: 'React: implement it' };

  const QUESTIONS = [
    Q('ssr-markers', C.ssr, 'Medium', 'What does renderToString produce?', 'Why is there a <!-- --> in the HTML?',
      `function Greeting({ name }) { return <p>Hello, {name}!</p>; }
console.log(ReactDOMServer.renderToString(<Greeting name="Ada" />));
console.log(ReactDOMServer.renderToStaticMarkup(<Greeting name="Ada" />));`,
      '"Hello, ", the name and "!" are three text nodes. In HTML they would merge into one, so <code>renderToString</code> puts <code>&lt;!-- --&gt;</code> comments between them: hydration can then match each text node to its fiber. <code>renderToStaticMarkup</code> is for HTML that will never be hydrated (emails, static pages), so it leaves the markers out.'),
    Q('ssr-effects', C.ssr, 'Easy', 'Effects during server rendering', 'Which lines run on the server?',
      `function Page() {
  console.log("render");
  React.useEffect(() => console.log("useEffect"));
  React.useLayoutEffect(() => console.log("useLayoutEffect"));
  const [n] = React.useState(() => { console.log("initial state"); return 1; });
  return <p onClick={() => console.log("click")}>{n}</p>;
}
console.log(ReactDOMServer.renderToString(<Page />));`,
      'On the server, components render once with their initial state, but there is no DOM and no commit, so neither <code>useEffect</code> nor <code>useLayoutEffect</code> runs, and event handlers are not in the HTML. That is why browser-only code belongs in effects.'),
    Q('ssr-suspense', C.ssr, 'Hard', 'Suspense on the server', 'What HTML is sent when a component suspends?',
      `const never = new Promise(() => {});
function Comments() { return <p>{React.use(never)}</p>; }
console.log(ReactDOMServer.renderToString(<article><h1>Post</h1><React.Suspense fallback={<i>loading comments</i>}><Comments /></React.Suspense></article>));`,
      '<code>renderToString</code> cannot wait, so a suspending boundary is sent as its fallback, wrapped in <code>&lt;!--$!--&gt;</code> markers that tell the client "render this part yourself". Streaming renderers (<code>renderToPipeableStream</code>, used by Next.js) send the fallback first and stream the real HTML when the data is ready.'),
    Q('hydrate-reuse', C.ssr, 'Medium', 'Does hydration recreate the DOM?', 'Is the button after hydration the same element, and does the click work?',
      `function App() { const [n, setN] = React.useState(0); return <button id="b" onClick={() => setN(n + 1)}>{n}</button>; }
const root = document.getElementById("root");
root.innerHTML = ReactDOMServer.renderToString(<App />);
const before = document.getElementById("b");
before.click();
console.log("before hydration:", before.textContent);
ReactDOM.hydrateRoot(root, <App />);
simulateClick("#b", 20);
setTimeout(() => console.log("after:", document.getElementById("b") === before, document.getElementById("b").textContent), 50);`,
      'Before hydration the HTML is just static markup: clicks do nothing. Hydration adopts the existing nodes (same element) and attaches handlers, so the next click works.'),
    Q('hydrate-mismatch', C.ssr, 'Medium', 'A hydration mismatch', 'What happens when the client renders different text?',
      `function Time() { return <p>{typeof isBrowser === "undefined" ? "server time" : "client time"}</p>; }
const root = document.getElementById("root");
root.innerHTML = ReactDOMServer.renderToString(<Time />);
var isBrowser = true;
ReactDOM.hydrateRoot(root, <Time />);
setTimeout(() => console.log(root.textContent), 50);`,
      'The first client render must match the server HTML. Here the text differs: React reports the mismatch, discards the server HTML and renders the root on the client. Fix by rendering the same value first and updating in <code>useEffect</code>.'),
    Q('forms-status', C.forms, 'Medium', 'useFormStatus must be inside the form', 'Why does one button never show "pending"?',
      `function Status() { const { pending } = React.useFormStatus(); return <b>{pending ? "pending" : "idle"} </b>; }
function App() {
  async function save() { await new Promise(r => setTimeout(r, 30)); }
  return <div>
    <Status />
    <form action={save}><Status /><button id="go">save</button></form>
  </div>;
}
${R}.render(<App />);
simulateClick("#go", 10);
setTimeout(() => console.log(document.getElementById("root").textContent), 20);
setTimeout(() => console.log(document.getElementById("root").textContent), 80);`,
      '<code>useFormStatus</code> reads the status of the <b>parent</b> <code>&lt;form&gt;</code>. The first Status is outside any form, so it is always idle. Put it in a component rendered inside the form (typically the submit button).'),
    Q('forms-formdata', C.forms, 'Easy', 'Reading a form with FormData', 'What is logged on submit?',
      `function Login() {
  function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    console.log(JSON.stringify(data));
  }
  return <form onSubmit={onSubmit}>
    <input name="user" defaultValue="ada" />
    <input name="remember" type="checkbox" defaultChecked />
    <input name="newsletter" type="checkbox" />
    <button id="b">log in</button>
  </form>;
}
${R}.render(<Login />);
simulateClick("#b", 10);`,
      'Uncontrolled form: the DOM keeps the values and <code>new FormData(form)</code> reads them by <code>name</code>. Unchecked checkboxes are not included; checked ones without a value give "on". <code>e.preventDefault()</code> stops the page from reloading.'),
    Q('forms-controlled-switch', C.forms, 'Medium', 'Controlled input stuck on its value', 'Why can\'t the user type in the first input?',
      `function App() {
  const [a, setA] = React.useState("fixed");
  const [b, setB] = React.useState("free");
  return <div>
    <input id="a" value={a} />
    <input id="b" value={b} onChange={e => setB(e.target.value)} />
  </div>;
}
${R}.render(<App />);
simulateTyping("#a", "fixedXYZ", 10);
simulateTyping("#b", "freeXYZ", 20);
setTimeout(() => console.log(document.getElementById("a").value, document.getElementById("b").value), 60);`,
      'An input with <code>value</code> is controlled: React owns its value. Without <code>onChange</code> updating state, React puts the old value back after every keystroke (and warns). Use <code>defaultValue</code> for an uncontrolled input, or add <code>onChange</code>.'),
    Q('eco-selector-store', C.eco, 'Hard', 'Selectors in a global store', 'Which components re-render when only the theme changes?',
      `let state = { theme: "light", user: "Ada" }; const subs = new Set();
const store = { set(p) { state = { ...state, ...p }; subs.forEach(f => f()); }, sub: f => (subs.add(f), () => subs.delete(f)) };
const useStore = sel => React.useSyncExternalStore(store.sub, () => sel(state));
function Theme() { const t = useStore(s => s.theme); console.log("Theme renders", t); return null; }
function User() { const u = useStore(s => s.user); console.log("User renders", u); return null; }
function Everything() { const s = useStore(s => s); console.log("Everything renders"); return null; }
${R}.render(<div><Theme /><User /><Everything /></div>);
setTimeout(() => store.set({ theme: "dark" }), 10);`,
      'Each component re-renders only if its selected value changed. Selecting the whole state (<code>s => s</code>) re-renders on every change, like reading a big context. Select the smallest slice you need.'),
    Q('eco-query-dedupe', C.eco, 'Medium', 'Request deduplication', 'How many requests are sent?',
      `let calls = 0;
const inflight = new Map();
function cachedFetch(key) {
  if (!inflight.has(key)) { calls++; inflight.set(key, new Promise(r => setTimeout(() => r(key.toUpperCase()), 20))); }
  return inflight.get(key);
}
function Name({ k }) {
  const [v, setV] = React.useState("…");
  React.useEffect(() => { cachedFetch(k).then(setV); }, [k]);
  return <b>{v} </b>;
}
${R}.render(<div><Name k="ada" /><Name k="ada" /><Name k="bob" /></div>);
setTimeout(() => console.log(document.getElementById("root").textContent, "| requests:", calls), 60);`,
      'Caching the <b>promise</b> by key means components that ask for the same data at the same time share one request: the core idea behind React Query / SWR deduplication.'),
    Q('eco-router-link', C.eco, 'Easy', 'Why routers use preventDefault', 'Does the page reload?',
      `let path = "/";
const listeners = new Set();
const navigate = p => { path = p; listeners.forEach(l => l()); };
const usePath = () => React.useSyncExternalStore(f => (listeners.add(f), () => listeners.delete(f)), () => path);
function Link({ to, children }) { return <a id="link" href={to} onClick={e => { e.preventDefault(); navigate(to); }}>{children}</a>; }
function App() { const p = usePath(); return <div><Link to="/about">about</Link><h1>{p === "/" ? "Home" : "About"}</h1></div>; }
${R}.render(<App />);
simulateClick("#link", 10);
setTimeout(() => console.log(document.querySelector("h1").textContent, path), 40);`,
      'Client-side routing keeps the same page: the link cancels the browser navigation and updates a URL store; React re-renders the matching route. Real routers call <code>history.pushState</code> and listen to <code>popstate</code> for the back button.'),
    Q('ts-generic', C.ts, 'Medium', 'A generic component in TSX', 'What is rendered?',
      `// @lang ts
type Option<T> = { value: T; label: string };
function Select<T extends string | number>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return <div>{options.map(o => <button key={String(o.value)} id={"o" + o.value} onClick={() => onChange(o.value)}>{o.value === value ? "[" + o.label + "]" : o.label}</button>)}</div>;
}
function App() {
  const [size, setSize] = React.useState<number>(1);
  return <Select options={[{ value: 1, label: "S" }, { value: 2, label: "M" }]} value={size} onChange={setSize} />;
}
${R}.render(<App />);
simulateClick("#o2", 10);
setTimeout(() => console.log(document.getElementById("root").textContent), 40);`,
      'A generic component keeps the value type connected: with <code>T = number</code>, <code>onChange</code> receives a number, so passing <code>setSize</code> type-checks. Types are erased at runtime, so the output is plain JavaScript behaviour.'),
    Q('impl-mini-router', C.impl, 'Medium', 'Implement useRoute matching', 'Write matchRoute so the params are extracted.',
      `function matchRoute(pattern, path) {
  const a = pattern.split("/").filter(Boolean), b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
console.log(JSON.stringify(matchRoute("/users/:id", "/users/42")));
console.log(JSON.stringify(matchRoute("/users/:id/posts/:post", "/users/7/posts/hello%20world")));
console.log(matchRoute("/users/:id", "/teams/1"), matchRoute("/", "/"));`,
      'Split both paths into segments; static segments must be equal, <code>:name</code> segments capture the value. Routers add wildcards, optional segments, nested routes and ranking of the best match.'),
    Q('impl-create-store', C.impl, 'Hard', 'Implement a Zustand-like create()', 'Write create so the hook and actions work.',
      `function create(init) {
  let state;
  const listeners = new Set();
  const set = partial => { state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) }; listeners.forEach(l => l()); };
  const get = () => state;
  state = init(set, get);
  const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };
  const useStore = (selector = s => s) => React.useSyncExternalStore(subscribe, () => selector(state));
  useStore.getState = get;
  return useStore;
}
const useBears = create(set => ({ bears: 0, add: () => set(s => ({ bears: s.bears + 1 })) }));
function Bears() { const n = useBears(s => s.bears); return <b id="n">{n}</b>; }
function Button() { const add = useBears(s => s.add); return <button id="add" onClick={add}>add</button>; }
${R}.render(<div><Bears /><Button /></div>);
simulateClick("#add", 10); simulateClick("#add", 20);
setTimeout(() => console.log(document.getElementById("n").textContent, useBears.getState().bears), 50);`,
      'State and listeners live in a closure; <code>set</code> merges and notifies; the hook subscribes with <code>useSyncExternalStore</code> and a selector so components re-render only for their slice.'),
    Q('impl-render-to-string', C.impl, 'Hard', 'Implement a mini renderToString', 'Write toHTML so elements and components become HTML.',
      `function toHTML(el) {
  if (el === null || el === undefined || el === false || el === true) return "";
  if (typeof el === "string" || typeof el === "number") return String(el).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (Array.isArray(el)) return el.map(toHTML).join("");
  if (typeof el.type === "function") return toHTML(el.type(el.props));
  const attrs = Object.entries(el.props).filter(([k, v]) => k !== "children" && typeof v !== "function").map(([k, v]) => " " + (k === "className" ? "class" : k) + '="' + v + '"').join("");
  return "<" + el.type + attrs + ">" + toHTML(el.props.children) + "</" + el.type + ">";
}
const Card = ({ title, children }) => <div className="card"><h2>{title}</h2>{children}</div>;
console.log(toHTML(<Card title="5 < 6"><p onClick={() => {}}>body</p></Card>));`,
      'A server renderer walks elements recursively: text is escaped, function components are called with their props, attributes are serialised (dropping event handlers, renaming <code>className</code>). The real one also handles hooks, context, Suspense and streaming.'),
  ];

  const THEORY = [
    // ---- rendering strategies
    T('csr-ssr-ssg', 'Medium', 'CSR vs SSR vs SSG vs ISR?', '<b>CSR</b> (client-side rendering): the server sends an empty shell and JavaScript renders everything; simple hosting, slow first paint, weak SEO. <b>SSR</b>: HTML rendered per request on the server, then hydrated; fast first paint, needs a server. <b>SSG</b>: HTML rendered at build time; fastest, but data is fixed until the next build. <b>ISR</b> (Next.js): static pages re-generated in the background after a time or on demand. Modern frameworks mix them per route.'),
    T('streaming', 'Hard', 'What is streaming SSR?', 'Instead of waiting for the whole page, the server sends HTML in chunks: first the shell with Suspense fallbacks, then each boundary\'s HTML (with a small script that swaps it in) when its data is ready. Combined with <b>selective hydration</b>, React hydrates the parts that arrive first and prioritises the part the user interacts with. APIs: <code>renderToPipeableStream</code> (Node) and <code>renderToReadableStream</code> (web streams).'),
    T('server-actions', 'Medium', 'What are server actions?', 'Async functions marked <code>"use server"</code> that run on the server but can be called from client components, for example as a form <code>action</code>. The framework turns them into an endpoint and a reference; the client sends the arguments (often <code>FormData</code>) and gets the result. Treat them like public API endpoints: validate input and check permissions.'),
    T('next-app-router', 'Medium', 'Explain the Next.js App Router in one minute.', 'Folders in <code>app/</code> are routes; <code>page.tsx</code> is the page, <code>layout.tsx</code> wraps child routes and keeps state across navigation, <code>loading.tsx</code> is a Suspense fallback, <code>error.tsx</code> an error boundary. Components are <b>Server Components</b> by default (fetch data directly with <code>await</code>); add <code>"use client"</code> for interactivity. Data is cached and revalidated per fetch or route; mutations use server actions and <code>revalidatePath</code>.'),
    // ---- state and data
    T('state-categories', 'Medium', 'What kinds of state are there, and where should each live?', '<b>Local UI state</b> (an open menu, an input) → <code>useState</code> in the component. <b>Shared UI state</b> (theme, current user) → lift it up or use context. <b>Server state</b> (data from an API: cached, can be stale) → a data-fetching library (React Query, SWR, the framework). <b>URL state</b> (filters, tab, page) → the router / search params, so it survives reloads and can be shared. <b>Form state</b> → the form (uncontrolled) or a form library. <b>Global client state</b> (a cart, a complex editor) → Zustand/Redux. Do not copy server data into global state.'),
    T('redux-toolkit', 'Medium', 'How does Redux (Redux Toolkit) work?', 'One store holds the state. Components <code>dispatch</code> actions; pure <b>reducers</b> compute the next state; <code>useSelector</code> subscribes to a slice. Redux Toolkit removes boilerplate: <code>createSlice</code> generates actions and reducers (and lets you "mutate" thanks to Immer), <code>configureStore</code> adds devtools and middleware, <code>createAsyncThunk</code>/RTK Query handle async work. Use it for large, complex client state with many writers and a need for traceability.'),
    T('react-query', 'Medium', 'What does React Query (TanStack Query) give you?', 'A cache for server state: <code>useQuery({ queryKey, queryFn })</code> returns <code>data</code>, <code>isPending</code>, <code>error</code>; it deduplicates requests, caches by key, refetches stale data on focus/reconnect, retries, paginates and supports Suspense. <code>useMutation</code> runs writes, and <code>queryClient.invalidateQueries</code> refreshes affected queries; optimistic updates are built in.'),
    T('context-vs-store', 'Medium', 'Context or a state library?', 'Context is dependency injection: perfect for rarely changing values (theme, locale, auth, a store instance). Every consumer re-renders when the value changes and there are no selectors, so frequently changing, widely read state is better in a store with selectors (Zustand, Redux) or split into several contexts.'),
    T('immutability', 'Easy', 'Why must state be updated immutably?', 'React decides whether something changed with <code>Object.is</code> on the reference. Mutating an object keeps the same reference, so React may skip the render, memo/useMemo/effects see "no change", and earlier renders (closures, history) see the changed data. Create new objects/arrays (<code>...spread</code>, <code>map</code>, <code>filter</code>, or Immer).'),
    // ---- routing and forms
    T('react-router', 'Medium', 'Key ideas of React Router?', 'Routes map URL patterns to elements; nested routes render inside a parent\'s <code>&lt;Outlet&gt;</code> (shared layouts). <code>&lt;Link&gt;</code>/<code>useNavigate</code> change the URL without reloading; <code>useParams</code> and <code>useSearchParams</code> read it. The data router adds <code>loader</code> (fetch before render) and <code>action</code> (form submissions), plus lazy routes, error elements and pending UI.'),
    T('forms-libraries', 'Medium', 'How do you handle complex forms?', 'For simple forms, controlled inputs or uncontrolled inputs with <code>FormData</code>. For big forms, <b>react-hook-form</b> (uncontrolled, registers inputs with refs, few re-renders) with a schema validator like <b>Zod</b>; Formik is the older controlled approach. React 19 actions, <code>useActionState</code> and <code>useFormStatus</code> handle submission and pending state, especially with server actions.'),
    // ---- testing
    T('testing-library', 'Medium', 'How do you test React components?', 'Unit/integration tests with <b>Jest or Vitest + React Testing Library</b>: render the component, find elements like a user (by role, label, text), interact with <code>userEvent</code>, assert on what is visible. Avoid testing state or implementation details. Mock the network (MSW). Use <code>findBy…</code>/<code>waitFor</code> for async UI. Add end-to-end tests (Playwright/Cypress) for critical flows, and test custom hooks with <code>renderHook</code>.'),
    T('act', 'Medium', 'What is act() for?', '<code>act(() => …)</code> wraps code that causes React updates (render, events, timers) and flushes all resulting renders and effects before returning, so assertions see the final UI. Testing Library calls it for you in <code>render</code>, <code>fireEvent</code> and <code>userEvent</code>; you see "not wrapped in act(…)" warnings when an update happens outside it (often a forgotten <code>await</code>).'),
    // ---- TypeScript
    T('ts-children', 'Easy', 'How do you type children and common props in TypeScript?', '<code>children: React.ReactNode</code> (anything renderable); a render function: <code>children: (value: T) =&gt; React.ReactNode</code>. Extend native props with <code>React.ComponentProps&lt;"button"&gt;</code> (or <code>ButtonHTMLAttributes</code>). Event handlers: <code>React.MouseEvent&lt;HTMLButtonElement&gt;</code>, <code>React.ChangeEvent&lt;HTMLInputElement&gt;</code>. Refs: <code>useRef&lt;HTMLDivElement&gt;(null)</code>. Prefer typing props over <code>React.FC</code>.'),
    T('ts-reducer', 'Medium', 'How do you type a reducer?', 'Use a <b>discriminated union</b> for actions: <code>type Action = { type: "add"; item: Item } | { type: "remove"; id: string }</code>. In <code>switch (action.type)</code> TypeScript narrows each case, so <code>action.item</code> only exists where it should; a <code>never</code> check in <code>default</code> catches missing cases.'),
    // ---- performance
    T('perf-tools', 'Medium', 'How do you find and fix performance problems?', 'Measure first: React DevTools <b>Profiler</b> (which components render, why, how long), "Highlight updates", the browser Performance panel, Lighthouse / Web Vitals (LCP, INP, CLS). Fixes, in order: avoid unnecessary state and effects, keep state close to where it is used, pass stable props and <code>memo</code> expensive subtrees, virtualise long lists, split code with <code>lazy</code>, use transitions/<code>useDeferredValue</code> for heavy updates, and move work to the server.'),
    T('react-compiler', 'Medium', 'What is the React Compiler?', 'A build-time compiler (React 19 era) that analyses components and inserts memoization automatically, as if you had written <code>useMemo</code>, <code>useCallback</code> and <code>memo</code> everywhere it is safe. It relies on components and hooks following the rules (pure renders, no mutation of props/state). With it, manual memoization becomes mostly unnecessary.'),
    T('bundle-size', 'Easy', 'How do you keep the JavaScript bundle small?', 'Code-split routes and heavy widgets with <code>lazy</code>/dynamic <code>import()</code>, import only what you use (tree-shaking), check sizes with a bundle analyser, replace heavy libraries, move non-interactive parts to Server Components, and load third-party scripts late.'),
    T('web-vitals', 'Medium', 'What are Core Web Vitals and how does React affect them?', '<b>LCP</b> (largest contentful paint: how fast the main content shows; helped by SSR/SSG, image optimisation), <b>INP</b> (interaction to next paint: responsiveness; helped by transitions, less work per render, smaller hydration), <b>CLS</b> (layout shift: reserve space for images and async content, avoid inserting content above the fold).'),
    // ---- accessibility and security
    T('a11y', 'Medium', 'How do you make React apps accessible?', 'Use semantic HTML (<code>button</code>, <code>a</code>, <code>label</code>, headings) instead of clickable divs; every input needs a label (<code>htmlFor</code> + <code>useId</code>); images need <code>alt</code>; manage focus for modals and route changes (move focus in, trap it, restore it); keyboard support for custom widgets; ARIA only when HTML is not enough (<code>aria-expanded</code>, <code>aria-live</code>). Test with a screen reader and axe/eslint-plugin-jsx-a11y.'),
    T('xss', 'Medium', 'Is React safe from XSS?', 'React escapes strings rendered in JSX, so <code>{userInput}</code> is safe. The risks are: <code>dangerouslySetInnerHTML</code> with unsanitised HTML (use DOMPurify), <code>href</code>/<code>src</code> with <code>javascript:</code> URLs from users, injecting data into <code>&lt;script&gt;</code> during SSR, and third-party scripts. Also keep secrets out of client bundles: everything sent to the browser is public.'),
    // ---- architecture and patterns
    T('folder-structure', 'Easy', 'How do you structure a React project?', 'Group by <b>feature</b> (<code>features/cart/</code> with its components, hooks, api and tests) rather than by file type, keep shared UI in <code>components/ui</code>, and shared logic in <code>hooks/</code> and <code>lib/</code>. Keep components small and focused; extract custom hooks for reusable logic; colocate tests and styles. Consistency matters more than the exact layout.'),
    T('composition', 'Medium', 'Composition vs inheritance in React?', 'React favours composition: pass components as <code>children</code> or props (slots), use compound components, render props and custom hooks to share behaviour. Component inheritance (class A extends MyBase) is discouraged; the only class you extend is <code>React.Component</code>.'),
    T('controlled-components-pattern', 'Medium', 'What is the controlled vs uncontrolled component pattern (for your own components)?', 'A reusable component can own its state (uncontrolled: <code>defaultValue</code>, internal <code>useState</code>) or let the parent own it (controlled: <code>value</code> + <code>onChange</code>). Good libraries support both: use the prop if it is provided, otherwise internal state.'),
    T('hoc-vs-hooks', 'Medium', 'Higher-order components vs hooks?', 'A HOC is a function that takes a component and returns a wrapped one (<code>withAuth(Page)</code>); it adds wrapper layers, can clash prop names and hides where props come from. Custom hooks share the same logic without changing the tree and compose easily. Today hooks are the default; HOCs still appear in older code and for wrapping with providers.'),
    T('styling', 'Easy', 'What are the main ways to style React apps?', 'Plain CSS / CSS Modules (scoped class names), utility CSS like <b>Tailwind</b>, CSS-in-JS (styled-components, Emotion: dynamic styles, runtime cost; they use <code>useInsertionEffect</code>), and zero-runtime options (vanilla-extract, Panda). Component libraries (MUI, Chakra, shadcn/ui on Radix) add accessible primitives.'),
    T('react-native', 'Easy', 'How is React Native different from React DOM?', 'Same React core (components, hooks, reconciliation), different <b>renderer</b>: instead of DOM nodes it creates native views (<code>View</code>, <code>Text</code>, <code>Image</code>), styles with a JS subset of CSS (flexbox), and has its own navigation and platform APIs. It shows that React itself is renderer-agnostic.'),
    // ---- interview technique
    T('answer-framework', 'Easy', 'How should you answer a React concept question in an interview?', 'Use a short structure: (1) a one-sentence definition, (2) <b>why</b> it exists (the problem it solves), (3) how it works underneath (fibers, reconciliation, queues…), (4) a tiny example, (5) a pitfall or trade-off and when you would not use it. Example for keys: "Keys identify list items between renders (definition) so React keeps the right state and DOM node (why); it matches old and new children by key and type during reconciliation (how)… index keys break when items move (pitfall)."'),
    T('machine-coding', 'Medium', 'How do you approach a React machine-coding round?', 'Clarify requirements and edge cases first. Sketch the component tree and the <b>state</b> (minimal, derived values computed during render, where each piece lives). Build the happy path quickly, then handle loading/error/empty states, keyboard and accessibility, and clean-ups (timers, listeners). Talk while you code, test as you go, and finish with what you would improve (performance, tests, tokens).'),
    T('explain-render-cycle', 'Medium', 'Walk through what happens when you call setState.', 'The setter queues an update on the hook and gives it a lane (Sync for a click); React marks the fiber and its parents as having work and schedules a render (a microtask for Sync). In the render phase it walks the tree from the root, bails out where nothing changed, calls the component (processing the queue to get the new state), and reconciles the returned elements with the old fibers using type and key. completeWork prepares DOM changes. The commit phase applies them, swaps the trees, runs layout effects, then after paint the passive effects (cleanups first).'),
    T('common-mistakes', 'Medium', 'What are the most common React mistakes you look for in code review?', 'Missing or index keys in dynamic lists; mutating state; effects used to compute derived data or to "sync" state with props; missing effect dependencies or cleanups (stale closures, leaks, race conditions); new objects/functions passed to memoized children; huge components with mixed concerns; state stored too high (needless re-renders) or duplicated; <code>useEffect(async …)</code>; calling hooks conditionally; not handling loading/error/empty states.'),
    T('you-might-not-need-effect', 'Medium', 'When do you NOT need an effect?', 'To transform data for rendering (compute it during render, <code>useMemo</code> if expensive); to handle user events (put the logic in the handler); to reset state when a prop changes (use a <code>key</code>); to sync two pieces of state (derive one from the other); to notify a parent (call its callback in the handler). Effects are for synchronising with <b>external systems</b>.'),
    T('react-19-summary', 'Medium', 'What is new in React 19?', 'Actions (async transitions, <code>useActionState</code>, <code>useFormStatus</code>, <code>useOptimistic</code>, form <code>action</code> props), the <code>use</code> API (read promises and context, even conditionally), <code>ref</code> as a regular prop (no more <code>forwardRef</code>) and ref cleanup functions, <code>&lt;Context&gt;</code> as a provider, document metadata (<code>&lt;title&gt;</code>, <code>&lt;meta&gt;</code>) rendered anywhere, stylesheet and script support with Suspense, better hydration error messages, and stable Server Components / server actions.'),
    T('react-18-summary', 'Medium', 'What did React 18 introduce?', 'Concurrent rendering through <code>createRoot</code>: automatic batching everywhere, transitions (<code>startTransition</code>, <code>useTransition</code>, <code>useDeferredValue</code>), Suspense on the server with streaming and selective hydration, new hooks (<code>useId</code>, <code>useSyncExternalStore</code>, <code>useInsertionEffect</code>), and stricter StrictMode (double-invoked effects in development).'),
  ];

  window.JS_INTERVIEW.unshift(...THEORY, ...QUESTIONS);
  window.REACT_IV = (window.REACT_IV || []).concat(THEORY, QUESTIONS);
  window.REACT_IV_CATS = (window.REACT_IV_CATS || ['React theory']).concat(Object.values(C).filter(c => !(window.REACT_IV_CATS || []).includes(c)));
  if (window.JSWriteIt) Object.assign(window.JSWriteIt.WRITE_IT, {
    'rq-impl-mini-router': ['matchRoute'], 'rq-impl-create-store': ['create'], 'rq-impl-render-to-string': ['toHTML'],
  });
})();
