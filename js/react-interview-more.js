/*
 * React Engine Lab — more React interview questions: class components, error boundaries, Suspense,
 * portals, refs, StrictMode, React 18/19 APIs, tricky output and more "implement it" exercises.
 */
(function () {
  'use strict';
  const R = 'ReactDOM.createRoot(document.getElementById("root"))';
  const Q = (id, cat, level, title, ask, code, why) => ({ id: 'rq-' + id, cat, level, title, ask, code, why });
  const T = (id, level, q, a) => ({ id: 'rth-' + id, cat: 'React theory', kind: 'theory', level, title: q, ask: q, why: a });
  const C = { cls: 'React: class components', err: 'React: errors & Suspense', adv: 'React: refs, portals & advanced APIs', r19: 'React 19 & concurrent', tricky: 'React: tricky output', impl: 'React: implement it', bugs: 'React: find the bug', perf: 'React: performance' };

  const QUESTIONS = [
    // ------------------------------------------------------------ class components
    Q('cls-order', C.cls, 'Medium', 'Lifecycle order: parent and child', 'Put the lifecycle calls in order.',
      `class Child extends React.Component {
  componentDidMount() { console.log("child didMount"); }
  render() { console.log("child render"); return <i>child</i>; }
}
class Parent extends React.Component {
  componentDidMount() { console.log("parent didMount"); }
  render() { console.log("parent render"); return <div><Child /></div>; }
}
${R}.render(<Parent />);`,
      'Render goes <b>down</b> (parent first), commit callbacks go <b>up</b> (child first): a parent is only "mounted" once all its children are in the DOM. Same order as effects in function components.'),
    Q('cls-merge', C.cls, 'Easy', 'setState merges, useState replaces', 'What is the state after each update?',
      `class C extends React.Component {
  state = { a: 1, b: 2 };
  componentDidMount() { this.setState({ a: 10 }); }
  componentDidUpdate() { console.log("class:", JSON.stringify(this.state)); }
  render() { return null; }
}
function F() {
  const [s, setS] = React.useState({ a: 1, b: 2 });
  React.useEffect(() => { setS({ a: 10 }); }, []);
  React.useEffect(() => { console.log("hooks:", JSON.stringify(s)); }, [s]);
  return null;
}
${R}.render(<div><C /><F /></div>);`,
      'Class <code>setState</code> <b>merges</b> the object into the state (shallowly). A <code>useState</code> setter <b>replaces</b> the value, so <code>b</code> is gone. Write <code>setS(s => ({ ...s, a: 10 }))</code> to keep it.'),
    Q('cls-this', C.cls, 'Medium', 'Lost this in a class handler', 'Which handler works?',
      `class Btn extends React.Component {
  state = { n: 0 };
  arrow = () => this.setState({ n: this.state.n + 1 });
  method() { this.setState({ n: this.state.n + 100 }); }
  render() {
    return <div>
      <button id="a" onClick={this.arrow}>arrow</button>
      <button id="m" onClick={this.method}>method</button>
      <p id="p">{this.state.n}</p>
    </div>;
  }
}
${R}.render(<Btn />);
simulateClick("#a", 10);
simulateClick("#m", 20);
setTimeout(() => console.log(document.getElementById("p").textContent), 50);`,
      'Passing <code>this.method</code> passes the bare function: when React calls it, <code>this</code> is <code>undefined</code> (class bodies are strict), so <code>this.setState</code> throws a TypeError. Arrow class fields capture <code>this</code>; or bind in the constructor.'),
    Q('cls-scu', C.cls, 'Medium', 'shouldComponentUpdate returning false', 'What is on the screen, and what is in this.state?',
      `class Frozen extends React.Component {
  state = { n: 0 };
  shouldComponentUpdate() { return false; }
  render() { return <b id="f" onClick={() => this.setState({ n: this.state.n + 1 }, () => console.log("state:", this.state.n))}>{this.state.n}</b>; }
}
${R}.render(<Frozen />);
simulateClick("#f", 10);
simulateClick("#f", 20);
setTimeout(() => console.log("screen:", document.getElementById("f").textContent), 50);`,
      'Returning <code>false</code> skips <code>render</code> and the DOM update, but the new state is still stored and setState callbacks still run. The screen and the state disagree, a classic source of bugs.'),
    Q('cls-gdsfp', C.cls, 'Hard', 'getDerivedStateFromProps', 'What does the component show after the prop changes?',
      `class Email extends React.Component {
  state = { value: this.props.initial, prevInitial: this.props.initial };
  static getDerivedStateFromProps(props, state) {
    if (props.initial !== state.prevInitial) return { value: props.initial, prevInitial: props.initial };
    return null;
  }
  render() { return <p>{this.state.value}</p>; }
}
function App() {
  const [user, setUser] = React.useState("ada@x.com");
  return <div id="d" onClick={() => setUser("bob@x.com")}><Email initial={user} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);
setTimeout(() => console.log(document.getElementById("d").textContent), 50);`,
      '<code>static getDerivedStateFromProps(props, state)</code> runs before every render and can return a state change. Here it resets the state when the prop changes. In function components you usually use a <code>key</code> instead, or compute the value during render.'),
    Q('cls-snapshot', C.cls, 'Hard', 'getSnapshotBeforeUpdate', 'What does the snapshot contain?',
      `class List extends React.Component {
  getSnapshotBeforeUpdate(prevProps) { return document.querySelectorAll("li").length; }
  componentDidUpdate(prevProps, prevState, snapshot) {
    console.log("items before:", snapshot, "after:", document.querySelectorAll("li").length);
  }
  render() { return <ul>{this.props.items.map(i => <li key={i}>{i}</li>)}</ul>; }
}
function App() {
  const [items, setItems] = React.useState([1, 2]);
  return <div id="d" onClick={() => setItems([1, 2, 3, 4])}><List items={items} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);`,
      '<code>getSnapshotBeforeUpdate</code> runs in the commit <b>before</b> the DOM changes, so it can read the old DOM (classic use: keep the scroll position of a chat). Its return value is the third argument of <code>componentDidUpdate</code>, which runs after the change.'),

    // ------------------------------------------------------------ errors & Suspense
    Q('err-boundary-scope', C.err, 'Medium', 'What an error boundary catches', 'Which errors are caught by the boundary?',
      `class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>boundary caught it</p> : this.props.children; }
}
function Widget() {
  const [crash, setCrash] = React.useState(false);
  if (crash) throw new Error("render error");
  return <div>
    <button id="h" onClick={() => { try { throw new Error("handler error"); } catch (e) { console.log("handler: caught with try/catch"); } }}>handler</button>
    <button id="r" onClick={() => setCrash(true)}>render</button>
  </div>;
}
${R}.render(<Boundary><Widget /></Boundary>);
simulateClick("#h", 10);
simulateClick("#r", 20);
setTimeout(() => console.log(document.getElementById("root").textContent), 50);`,
      'Error boundaries catch errors thrown <b>during rendering</b> (and in lifecycles) of their children. Errors in event handlers happen outside rendering, so they need a normal <code>try/catch</code>. Throwing during render on the second click is caught.'),
    Q('err-no-boundary', C.err, 'Medium', 'A render error with no boundary', 'What is left on the page?',
      `function Broken() { throw new Error("oops"); }
function App() {
  const [show, setShow] = React.useState(false);
  return <div><h1>My app</h1><button id="b" onClick={() => setShow(true)}>open</button>{show && <Broken />}</div>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log("page:", JSON.stringify(document.getElementById("root").textContent)), 50);`,
      'Since React 16, an error that no boundary catches <b>unmounts the whole tree</b>: React prefers an empty page to a broken or inconsistent one. That is why apps put an error boundary near the top (and around risky widgets).'),
    Q('err-nested', C.err, 'Medium', 'Which boundary catches?', 'Which fallback is shown?',
      `class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <p>{this.props.name} caught it</p> : this.props.children; }
}
function Bomb() { throw new Error("boom"); }
${R}.render(<Boundary name="outer"><h1>title</h1><Boundary name="inner"><Bomb /></Boundary></Boundary>);
setTimeout(() => console.log(document.getElementById("root").textContent), 20);`,
      'React walks up from the component that threw and uses the <b>nearest</b> boundary. Only that subtree is replaced; the title outside it stays.'),
    Q('suspense-nested', C.err, 'Medium', 'Nested Suspense boundaries', 'What is shown while the comments load?',
      `const posts = new Promise(r => setTimeout(() => r("Post text"), 10));
const comments = new Promise(r => setTimeout(() => r("3 comments"), 60));
function Post() { return <h2>{React.use(posts)}</h2>; }
function Comments() { return <p>{React.use(comments)}</p>; }
${R}.render(
  <React.Suspense fallback={<b>loading page</b>}>
    <Post />
    <React.Suspense fallback={<i>loading comments</i>}><Comments /></React.Suspense>
  </React.Suspense>
);
setTimeout(() => console.log(document.getElementById("root").textContent), 5);
setTimeout(() => console.log(document.getElementById("root").textContent), 30);
setTimeout(() => console.log(document.getElementById("root").textContent), 100);`,
      'Each Suspense boundary waits for what is inside it. The inner boundary lets the post appear as soon as it is ready, while only the comments area shows its own fallback. Place boundaries where you want loading states to appear.'),
    Q('suspense-unstable-promise', C.err, 'Hard', 'Why does this suspend forever?', 'Why does the page never show the user?',
      `let calls = 0;
function User() {
  calls++;
  const user = React.use(new Promise(r => setTimeout(() => r("Ada"), 10)));
  return <b>{user}</b>;
}
${R}.render(<React.Suspense fallback={<i>loading</i>}><User /></React.Suspense>);
setTimeout(() => console.log(document.getElementById("root").textContent, "| renders:", calls > 3 ? "many" : calls), 100);`,
      'Every render creates a <b>new</b> Promise, so when React retries after one resolves, the component throws a fresh pending Promise again: it never finishes. Promises passed to <code>use</code> must be cached (created outside render, by a framework or a cache like a Map).'),
    Q('suspense-hides', C.err, 'Hard', 'Suspense hides, it does not unmount', 'Does the counter keep its value while the fallback shows?',
      `const cache = new Map();
const load = k => { if (!cache.has(k)) cache.set(k, new Promise(r => setTimeout(() => r("data " + k), 30))); return cache.get(k); };
function Counter() { const [n, setN] = React.useState(0); return <b id="c" onClick={() => setN(n + 1)}>{n}</b>; }
function Data({ k }) { return <i>{React.use(load(k))}</i>; }
function App() {
  const [k, setK] = React.useState(0);
  return <div><button id="more" onClick={() => setK(1)}>load</button>
    <React.Suspense fallback={<p>loading</p>}><Counter />{k > 0 && <Data k={k} />}</React.Suspense></div>;
}
${R}.render(<App />);
simulateClick("#c", 10); simulateClick("#c", 11);
simulateClick("#more", 20);
setTimeout(() => console.log(document.getElementById("c").textContent, document.getElementById("c").style.display), 25);
setTimeout(() => console.log(document.getElementById("c").textContent, JSON.stringify(document.getElementById("c").style.display)), 100);`,
      'When visible content suspends, React keeps it mounted in a hidden Offscreen fiber and sets <code>display: none</code> on its DOM. When the data arrives it shows it again: Counter still shows 2.'),

    // ------------------------------------------------------------ refs, portals, advanced
    Q('ref-timing', C.adv, 'Medium', 'When is ref.current set?', 'What is ref.current during render, in the layout effect and in the effect?',
      `function App() {
  const ref = React.useRef(null);
  console.log("render:", ref.current);
  React.useLayoutEffect(() => console.log("layout effect:", ref.current && ref.current.tagName));
  React.useEffect(() => console.log("effect:", ref.current && ref.current.tagName));
  return <input ref={ref} />;
}
${R}.render(<App />);`,
      'React sets DOM refs in the commit\'s layout phase, after the DOM node is inserted. During the first render it is still <code>null</code>; both effects can use it.'),
    Q('callback-ref', C.adv, 'Medium', 'Callback refs', 'When is the callback ref called?',
      `function App() {
  const [show, setShow] = React.useState(true);
  return <div>
    <button id="b" onClick={() => setShow(false)}>hide</button>
    {show && <p ref={node => console.log("ref called with", node ? node.tagName : node)}>hi</p>}
  </div>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'A function ref is called with the DOM node when it is attached, and with <code>null</code> when it is detached (unmount). An inline arrow is a new function each render, so React also calls the old one with null and the new one with the node on every update.'),
    Q('portal-context', C.adv, 'Medium', 'Context through a portal', 'Does the modal see the theme?',
      `const Theme = React.createContext("light");
const box = document.createElement("div"); document.body.appendChild(box);
function Modal() { const t = React.useContext(Theme); return ReactDOM.createPortal(<p id="m">modal theme: {t}</p>, box); }
${R}.render(<Theme.Provider value="dark"><Modal /></Theme.Provider>);
setTimeout(() => console.log(box.textContent, "| inside root:", document.getElementById("root").innerHTML === ""), 20);`,
      'A portal changes where the DOM goes, not where the component sits in the React tree. Context, state and events all follow the React tree.'),
    Q('use-id', C.adv, 'Easy', 'useId for accessible labels', 'Are the ids different for each field?',
      `function Field({ label }) {
  const id = React.useId();
  return <div><label htmlFor={id}>{label}</label><input id={id} /></div>;
}
${R}.render(<form><Field label="Name" /><Field label="Email" /></form>);
setTimeout(() => console.log([...document.querySelectorAll("input")].map(i => i.id).join(" ")), 20);`,
      '<code>useId</code> gives each component instance a unique, stable id (the same on the server and the client, which matters for hydration). Never use it for list keys.'),
    Q('imperative-handle', C.adv, 'Medium', 'Exposing a custom ref API', 'What can the parent call?',
      `const Player = React.forwardRef(function Player(props, ref) {
  const [playing, setPlaying] = React.useState(false);
  React.useImperativeHandle(ref, () => ({ play: () => setPlaying(true) }), []);
  return <p id="p">{playing ? "▶ playing" : "⏸ paused"}</p>;
});
function App() {
  const player = React.useRef(null);
  return <div><Player ref={player} /><button id="b" onClick={() => { player.current.play(); console.log(typeof player.current.pause); }}>play</button></div>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("p").textContent), 50);`,
      '<code>useImperativeHandle</code> replaces <code>ref.current</code> with the object you return: the parent can call <code>play()</code>, and nothing else (no <code>pause</code>, no DOM node).'),
    Q('strict-double', C.adv, 'Medium', 'StrictMode: why do my logs appear twice?', 'How many times does each line print?',
      `function Hello() {
  console.log("render");
  React.useEffect(() => { console.log("effect"); return () => console.log("cleanup"); }, []);
  return <p>hi</p>;
}
${R}.render(<React.StrictMode><Hello /></React.StrictMode>);`,
      'In development, StrictMode renders every component twice and runs every new effect as effect → cleanup → effect. It finds impure renders and missing cleanups. Production builds run everything once.'),
    Q('sync-store-tearing', C.adv, 'Hard', 'useSyncExternalStore with a selector', 'When does the component re-render?',
      `let state = { count: 0, other: 0 }; const subs = new Set();
const store = { get: () => state, sub: cb => { subs.add(cb); return () => subs.delete(cb); }, set: s => { state = s; subs.forEach(cb => cb()); } };
function Count() {
  const count = React.useSyncExternalStore(store.sub, () => store.get().count);
  console.log("Count renders", count);
  return <b>{count}</b>;
}
${R}.render(<Count />);
setTimeout(() => store.set({ ...state, other: 1 }), 10);
setTimeout(() => store.set({ ...state, count: 1 }), 20);`,
      'React compares the <b>snapshot</b> (here just the number) with <code>Object.is</code>. Changing <code>other</code> gives the same snapshot, so there is no re-render. Returning a primitive or a cached object from <code>getSnapshot</code> works like a selector.'),

    // ------------------------------------------------------------ React 19 & concurrent
    Q('r19-use-context', C.r19, 'Easy', 'use() with context', 'Can use() be called inside a condition?',
      `const Theme = React.createContext("light");
function Label({ fancy }) {
  if (fancy) {
    const theme = React.use(Theme);
    return <b>fancy {theme}</b>;
  }
  return <i>plain</i>;
}
${R}.render(<Theme.Provider value="dark"><Label fancy={true} /><Label fancy={false} /></Theme.Provider>);
setTimeout(() => console.log(document.getElementById("root").textContent), 20);`,
      '<code>use</code> is not a normal hook: it can be called inside conditions and loops. With a context it works like <code>useContext</code>; with a Promise it suspends.'),
    Q('r19-optimistic-revert', C.r19, 'Hard', 'useOptimistic when the server fails', 'What does the list show during and after the failed save?',
      `function save(text) { return new Promise((res, rej) => setTimeout(() => rej(new Error("offline")), 30)); }
function Todos() {
  const [todos, setTodos] = React.useState(["milk"]);
  const [shown, addShown] = React.useOptimistic(todos, (list, t) => [...list, t + " (saving…)"]);
  const [, start] = React.useTransition();
  console.log(shown.join(", "));
  return <button id="b" onClick={() => start(async () => {
    addShown("eggs");
    try { await save("eggs"); React.startTransition(() => setTodos(t => [...t, "eggs"])); }
    catch (e) { console.log("failed:", e.message); }
  })}>add</button>;
}
${R}.render(<Todos />);
simulateClick("#b", 10);`,
      'The optimistic item shows while the action runs. The action fails, so the real state never changes; when the action ends, React drops the optimistic value and the list goes back to "milk" automatically.'),
    Q('r19-action-pending', C.r19, 'Medium', 'isPending for an async transition', 'When does isPending become false?',
      `function App() {
  const [isPending, start] = React.useTransition();
  const [done, setDone] = React.useState(false);
  console.log("isPending:", isPending, "done:", done);
  return <button id="b" onClick={() => start(async () => {
    await new Promise(r => setTimeout(r, 30));
    React.startTransition(() => setDone(true));
  })}>save</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'In React 19, an async function passed to <code>startTransition</code> is an <b>action</b>: <code>isPending</code> stays true until its promise settles, then the final state and <code>isPending: false</code> are rendered.'),
    Q('deferred-vs-transition', C.r19, 'Medium', 'useDeferredValue render order', 'In which renders does the slow list update?',
      `const List = React.memo(function List({ q }) { console.log("List renders for", JSON.stringify(q)); return <p>{q}</p>; });
function App() {
  const [q, setQ] = React.useState("");
  const dq = React.useDeferredValue(q);
  return <div><input id="i" value={q} onChange={e => setQ(e.target.value)} /><List q={dq} /></div>;
}
${R}.render(<App />);
simulateTyping("#i", "r", 10);`,
      'The urgent render after typing keeps the old deferred value, so the memo List is skipped and the input updates first. A second, lower-priority render passes the new value to the list.'),
    Q('transition-interrupt-order', C.r19, 'Hard', 'An urgent update during a transition', 'Which values does the slow part render with?',
      `const Slow = React.memo(function Slow({ v }) { console.log("Slow renders", v); return <ul>{[1, 2, 3, 4, 5, 6].map(i => <li key={i}>{v}{i}</li>)}</ul>; });
function App() {
  const [text, setText] = React.useState("");
  const [shown, setShown] = React.useState("");
  const [, start] = React.useTransition();
  return <div><input id="i" value={text} onChange={e => { setText(e.target.value); start(() => setShown(e.target.value)); }} /><Slow v={shown} /></div>;
}
${R}.render(<App />);
simulateTyping("#i", "a", 10);
simulateTyping("#i", "ab", 12);`,
      'The "a" transition starts rendering in time slices, then the second keystroke (urgent) interrupts it. React throws away the unfinished "a" work and finally renders the transition with "ab". Slow may start rendering "a" but never commits it.'),

    // ------------------------------------------------------------ tricky output
    Q('tricky-effect-closure', C.tricky, 'Hard', 'Cleanup sees the old value', 'What does each cleanup log?',
      `function App() {
  const [n, setN] = React.useState(1);
  React.useEffect(() => () => console.log("cleanup for", n), [n]);
  return <button id="b" onClick={() => setN(n + 1)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);`,
      'Each effect and its cleanup belong to one render. The cleanup that runs before render 2\'s effect is render 1\'s cleanup, so it logs 1, then 2.'),
    Q('tricky-setstate-in-render', C.tricky, 'Hard', 'setState during render', 'What happens?',
      `function App() {
  const [n, setN] = React.useState(0);
  setN(n + 1);
  return <p>{n}</p>;
}
${R}.render(<App />);`,
      'Calling a setter directly in the body schedules a render during the render. React renders the component again right away, again and again, until it gives up with "Too many re-renders" (ReactLite throws on the first one, same error). Usual cause: <code>onClick={setOpen(true)}</code> instead of <code>onClick={() => setOpen(true)}</code>.'),
    Q('tricky-key-remount', C.tricky, 'Medium', 'Changing key remounts', 'How many times is each effect logged?',
      `function Widget() {
  React.useEffect(() => { console.log("mount"); return () => console.log("unmount"); }, []);
  return <p>widget</p>;
}
function App() {
  const [v, setV] = React.useState(1);
  return <div id="d" onClick={() => setV(v + 1)}><Widget key={v} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);
simulateClick("#d", 20);`,
      'A new <code>key</code> means a different component instance: React unmounts the old one (cleanup) and mounts a new one (effect) every time the key changes.'),
    Q('tricky-batch-promise', C.tricky, 'Medium', 'Batching across await', 'How many renders happen after the click?',
      `function App() {
  const [a, setA] = React.useState(0);
  const [b, setB] = React.useState(0);
  console.log("render", a, b);
  return <button id="x" onClick={async () => {
    setA(1);
    await Promise.resolve();
    setB(1);
  }}>go</button>;
}
${R}.render(<App />);
simulateClick("#x", 10);`,
      'Updates are batched per "task": <code>setA</code> is in the click (Sync, rendered right after the handler), <code>setB</code> runs later after the <code>await</code>, so it gets its own render. Two renders.'),
    Q('tricky-object-is', C.tricky, 'Easy', 'NaN and -0 in state', 'Which updates cause a render?',
      `function App() {
  const [v, setV] = React.useState(NaN);
  const [z, setZ] = React.useState(0);
  console.log("render");
  return <div>
    <button id="nan" onClick={() => setV(NaN)}>NaN</button>
    <button id="neg" onClick={() => setZ(-0)}>-0</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#nan", 10);
simulateClick("#neg", 20);`,
      'React compares state with <code>Object.is</code>, not <code>===</code>. <code>Object.is(NaN, NaN)</code> is true, so no render. <code>Object.is(0, -0)</code> is false, so setting -0 renders.'),
    Q('tricky-children-fn', C.tricky, 'Medium', 'Render prop children', 'What is rendered?',
      `function Toggle({ children }) {
  const [on, setOn] = React.useState(false);
  return <div id="t" onClick={() => setOn(!on)}>{children(on)}</div>;
}
${R}.render(<Toggle>{on => <b>{on ? "ON" : "OFF"}</b>}</Toggle>);
simulateClick("#t", 10);
setTimeout(() => console.log(document.getElementById("t").textContent), 50);`,
      '<code>children</code> can be anything, including a function. The parent calls it with its state: the "function as child" render-prop pattern.'),
    Q('tricky-default-props', C.tricky, 'Easy', 'Default values for props', 'What does each button say?',
      `function Button({ label = "OK", color }) { return <button>{label}/{color || "none"}</button>; }
${R}.render(<div><Button /><Button label="Save" color="blue" /><Button label={undefined} /><Button label={null} /></div>);
setTimeout(() => console.log([...document.querySelectorAll("button")].map(b => b.textContent).join(" ")), 20);`,
      'Default parameters apply only when the prop is <code>undefined</code>. <code>null</code> is a real value, so the last button has no label text.'),

    // ------------------------------------------------------------ performance
    Q('perf-split-context', C.perf, 'Hard', 'Splitting context to avoid re-renders', 'Which components render when the count changes?',
      `const CountCtx = React.createContext(0);
const DispatchCtx = React.createContext(null);
const Button = React.memo(function Button() {
  const inc = React.useContext(DispatchCtx);
  console.log("Button renders");
  return <button id="b" onClick={inc}>+</button>;
});
const Display = React.memo(function Display() {
  console.log("Display renders", React.useContext(CountCtx));
  return null;
});
function App() {
  const [n, setN] = React.useState(0);
  const inc = React.useCallback(() => setN(x => x + 1), []);
  return <DispatchCtx.Provider value={inc}><CountCtx.Provider value={n}><Button /><Display /></CountCtx.Provider></DispatchCtx.Provider>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'The button only reads the stable <code>inc</code> context, so it does not re-render when the count changes; only <code>Display</code>, which reads the count, does. Splitting "state" and "actions" into two contexts is a common optimisation.'),
    Q('perf-list-memo', C.perf, 'Medium', 'memo items in a list', 'Which rows render when one item changes?',
      `const Row = React.memo(function Row({ item }) { console.log("Row renders", item.id); return <li>{item.text}</li>; });
function App() {
  const [items, setItems] = React.useState([{ id: 1, text: "a" }, { id: 2, text: "b" }, { id: 3, text: "c" }]);
  return <ul id="u" onClick={() => setItems(list => list.map(i => i.id === 2 ? { ...i, text: "B" } : i))}>{items.map(i => <Row key={i.id} item={i} />)}</ul>;
}
${R}.render(<App />);
simulateClick("#u", 10);`,
      'Updating immutably (a new object only for the changed item) keeps the other items\' identity, so <code>memo</code> skips them. Only row 2 renders again.'),

    // ------------------------------------------------------------ find the bug
    Q('bug-onclick-call', C.bugs, 'Easy', 'onClick={handle()}', 'Why is the handler called during render?',
      `function App() {
  const [msg, setMsg] = React.useState("none");
  function greet(name) { console.log("greet called with", name); return () => setMsg("hi " + name); }
  return <div><button id="a" onClick={greet("Ada")}>ok</button><p id="p">{msg}</p></div>;
}
${R}.render(<App />);
simulateClick("#a", 10);
setTimeout(() => console.log(document.getElementById("p").textContent), 50);`,
      '<code>onClick={greet("Ada")}</code> calls <code>greet</code> during render and passes its <b>return value</b> as the handler. It only works here because greet returns a function. Normally write <code>onClick={() => greet("Ada")}</code>.'),
    Q('bug-stale-handler', C.bugs, 'Medium', 'Stale state in a subscription', 'Why does the listener always log 0?',
      `const bus = new Set();
function App() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const listener = () => console.log("listener sees", n);
    bus.add(listener);
    return () => bus.delete(listener);
  }, []);
  return <button id="b" onClick={() => setN(n + 1)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);
setTimeout(() => bus.forEach(l => l()), 50);`,
      'The effect ran once, so its listener closes over the first render\'s <code>n</code> (0). Add <code>n</code> to the dependencies (the cleanup removes the old listener), or read the latest value from a ref.'),
    Q('bug-direct-mutation-class', C.bugs, 'Easy', 'this.state.x = …', 'Why does the screen not change?',
      `class Counter extends React.Component {
  state = { n: 0 };
  render() { return <b id="c" onClick={() => { this.state.n++; console.log("state is", this.state.n); }}>{this.state.n}</b>; }
}
${R}.render(<Counter />);
simulateClick("#c", 10);
setTimeout(() => console.log("screen:", document.getElementById("c").textContent), 50);`,
      'Changing <code>this.state</code> directly does not tell React anything, so no render is scheduled. Always use <code>this.setState</code> (or a <code>useState</code> setter).'),
    Q('bug-cond-hook-early-return', C.bugs, 'Medium', 'Early return before a hook', 'Why does it crash after loading?',
      `function Profile() {
  const [user, setUser] = React.useState(null);
  React.useEffect(() => { setTimeout(() => setUser("Ada"), 10); }, []);
  if (!user) return <p>loading</p>;
  const [tab] = React.useState("info");
  return <p>{user} {tab}</p>;
}
${R}.render(<Profile />);`,
      'The first render returns early and calls 2 hooks; the second render calls 3. React sees a different hook list and throws. Move every hook above the early return.'),

    // ------------------------------------------------------------ implement it
    Q('impl-error-boundary', C.impl, 'Medium', 'Write an error boundary', 'Write the ErrorBoundary class so the output matches.',
      `class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.log("report:", error.message); }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}
function Flaky({ fail }) { if (fail) throw new Error("bad data"); return <b>fine</b>; }
${R}.render(<div><ErrorBoundary fallback={<i>sorry</i>}><Flaky fail={true} /></ErrorBoundary><ErrorBoundary fallback={<i>sorry</i>}><Flaky fail={false} /></ErrorBoundary></div>);
setTimeout(() => console.log(document.getElementById("root").textContent), 20);`,
      'Two parts: <code>getDerivedStateFromError</code> turns the error into state during render (so the fallback can be shown), and <code>componentDidCatch</code> runs in the commit for side effects like logging.'),
    Q('impl-use-interval', C.impl, 'Medium', 'Custom hook: useInterval (Dan Abramov\'s version)', 'Write useInterval so the callback always sees fresh state.',
      `function useInterval(callback, ms) {
  const saved = React.useRef(callback);
  React.useEffect(() => { saved.current = callback; });
  React.useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
function Ticker() {
  const [n, setN] = React.useState(0);
  useInterval(() => setN(n + 1), n >= 3 ? null : 10);
  return <b id="t">{n}</b>;
}
${R}.render(<Ticker />);
setTimeout(() => console.log(document.getElementById("t").textContent), 100);`,
      'The interval is created once (deps <code>[ms]</code>), but it calls the <b>latest</b> callback through a ref that an effect updates after every render, so there is no stale closure. Passing <code>null</code> stops it.'),
    Q('impl-use-media-store', C.impl, 'Hard', 'Custom hook on useSyncExternalStore', 'Write useOnline with useSyncExternalStore.',
      `const network = { online: true, subs: new Set(), set(v) { this.online = v; this.subs.forEach(f => f()); } };
function useOnline() {
  return React.useSyncExternalStore(
    cb => { network.subs.add(cb); return () => network.subs.delete(cb); },
    () => network.online
  );
}
function Status() { const online = useOnline(); return <p id="s">{online ? "🟢 online" : "🔴 offline"}</p>; }
${R}.render(<Status />);
setTimeout(() => console.log(document.getElementById("s").textContent), 5);
setTimeout(() => network.set(false), 10);
setTimeout(() => console.log(document.getElementById("s").textContent), 40);`,
      'A store hook needs a <code>subscribe</code> function that returns an unsubscribe, and a <code>getSnapshot</code> that returns a primitive or cached value. (In real code define <code>subscribe</code> outside the component so it does not re-subscribe every render.)'),
    Q('impl-mini-memo', C.impl, 'Medium', 'Implement memoization of a component', 'Write memoize so the expensive render is reused.',
      `function memoize(render) {
  let lastProps = null, lastResult = null;
  return props => {
    const same = lastProps && Object.keys(props).length === Object.keys(lastProps).length && Object.keys(props).every(k => Object.is(props[k], lastProps[k]));
    if (same) { console.log("reused"); return lastResult; }
    lastProps = props;
    lastResult = render(props);
    return lastResult;
  };
}
const view = memoize(({ name }) => { console.log("rendering", name); return "<b>" + name + "</b>"; });
console.log(view({ name: "Ada" }));
console.log(view({ name: "Ada" }));
console.log(view({ name: "Bob" }));`,
      'This is the idea behind <code>React.memo</code>: remember the last props and result, compare props shallowly with <code>Object.is</code>, and return the saved result when nothing changed.'),
    Q('impl-event-delegation', C.impl, 'Medium', 'Implement event delegation like React', 'Write delegate() so one root listener handles every click.',
      `function delegate(root, handlers) {
  root.addEventListener("click", e => {
    for (let node = e.target; node && node !== root; node = node.parentNode) {
      const h = handlers[node.id];
      if (h) h(node.id);
    }
  });
}
const root = document.createElement("div");
document.body.appendChild(root);
root.innerHTML = '<div id="card"><button id="like">like</button></div>';
delegate(root, { like: id => console.log("handler", id), card: id => console.log("handler", id) });
simulateClick("#like", 10);`,
      'One listener on the root; on each event walk from <code>event.target</code> up to the root and call the handlers registered for each node: bubbling, done by hand. React does the same, but walks the <b>fiber</b> tree and reads handlers from props.'),
  ];

  const THEORY = [
    T('lifecycle-mapping', 'Medium', 'How do class lifecycles map to hooks?', '<code>constructor</code> → <code>useState</code> initialiser · <code>componentDidMount</code> → <code>useEffect(fn, [])</code> · <code>componentDidUpdate</code> → <code>useEffect(fn, [deps])</code> · <code>componentWillUnmount</code> → the effect cleanup · <code>shouldComponentUpdate</code> → <code>React.memo</code> · <code>getDerivedStateFromProps</code> → compute during render or reset with <code>key</code> · <code>getSnapshotBeforeUpdate</code> → no hook (use a layout effect) · error boundaries → still a class.'),
    T('purecomponent', 'Easy', 'What is PureComponent?', 'A class component with a built-in <code>shouldComponentUpdate</code> that shallowly compares props and state. It is the class version of <code>React.memo</code>, with the same pitfall: new objects or functions as props defeat it.'),
    T('error-boundary-limits', 'Medium', 'What do error boundaries not catch?', 'Errors in event handlers, in asynchronous code (timers, promises), during server rendering, and errors thrown in the boundary itself. Use try/catch in handlers and async code, and put boundaries at several levels.'),
    T('suspense-how', 'Hard', 'How does Suspense work internally?', 'A component suspends by <b>throwing a Promise</b> during render (<code>use</code>, <code>lazy</code> and data libraries do this). React catches it in the work loop, finds the nearest Suspense fiber, renders its fallback, and calls <code>.then</code> on the promise to retry later. Already-visible content is kept in a hidden Offscreen fiber (state preserved). In a transition, React keeps the old UI instead of showing the fallback.'),
    T('lazy', 'Easy', 'What does React.lazy do?', '<code>lazy(() => import("./X"))</code> returns a component that loads its code the first time it renders. While the import is pending it suspends, so it must be inside <code>&lt;Suspense&gt;</code>. Used for code splitting by route or feature.'),
    T('portals', 'Easy', 'What are portals for?', '<code>createPortal(children, domNode)</code> renders children into another DOM node (modals, tooltips, toasts) while keeping them in the same React tree: context works and events bubble to React parents.'),
    T('strictmode-why', 'Medium', 'Why does StrictMode run effects twice?', 'To simulate a component being unmounted and mounted again (React may do this for features like Offscreen/Activity and fast refresh). If an effect has no correct cleanup, the double run shows the bug immediately. It only happens in development.'),
    T('use-hook', 'Medium', 'What is the use() API (React 19)?', '<code>use(resource)</code> reads a Promise or a context. With a Promise it returns the value or suspends; with a context it is like <code>useContext</code>. Unlike hooks, it can be called inside conditions and loops. The Promise must be cached, not created during render.'),
    T('actions', 'Medium', 'What are Actions in React 19?', 'Async functions run in a transition (<code>startTransition(async () => …)</code>, <code>&lt;form action={fn}&gt;</code>, <code>useActionState</code>). React tracks the pending state, handles errors, and works with <code>useOptimistic</code> for instant feedback and <code>useFormStatus</code> for nested form buttons.'),
    T('useoptimistic', 'Medium', 'What does useOptimistic do?', 'It shows a temporary "optimistic" value while an action is pending (like a liked heart or a new message) and automatically switches back to the real state when the action ends, including when it fails.'),
    T('rsc-vs-ssr', 'Hard', 'Server Components vs server-side rendering?', 'SSR renders your components to <b>HTML</b> on the server for a fast first paint; all components still ship as JavaScript and hydrate in the browser. Server Components run <b>only</b> on the server and never ship their code; their output is a serialized tree that client components fit into. They are often used together.'),
    T('hydration-mismatch', 'Medium', 'What causes a hydration mismatch?', 'The first client render differs from the server HTML: using <code>Date.now()</code>, random values, <code>window</code> or <code>localStorage</code> during render, or invalid HTML nesting. Fix: make the first render identical and move browser-only values into an effect (or use <code>useId</code> for ids).'),
    T('tearing', 'Hard', 'What is tearing, and how does React prevent it?', 'With concurrent rendering, a render can be paused while an external store changes, so different components could show different values in the same frame. <code>useSyncExternalStore</code> forces a synchronous re-render when the snapshot changes, so the UI never tears.'),
    T('automatic-batching', 'Easy', 'What changed with batching in React 18?', 'Before React 18, only updates inside React event handlers were batched; updates in timeouts, promises and native handlers each caused a render. With <code>createRoot</code>, all updates are batched automatically.'),
    T('keys-not-props', 'Easy', 'Can a component read its own key?', 'No. <code>key</code> (and <code>ref</code>, before React 19) are used by React and removed from props. Pass the value again under another name (<code>id={item.id}</code>) if the child needs it.'),
    T('controlled-vs-uncontrolled-warning', 'Medium', 'Why does React warn about switching from uncontrolled to controlled?', 'An input with <code>value={undefined}</code> is uncontrolled; later giving it a string makes it controlled. React cannot decide who owns the value. Always pass a defined value (<code>value={text ?? ""}</code>) or use <code>defaultValue</code> for uncontrolled inputs.'),
    T('reconciliation-complexity', 'Hard', 'Why is React\'s diff O(n) and not O(n³)?', 'A general tree diff is O(n³). React uses two heuristics: elements of different types produce different trees (so it never tries to match across types), and keys identify children among siblings. It only compares children at the same level, in one pass.'),
    T('fiber-why', 'Hard', 'Why did React rewrite its core as Fiber?', 'The old reconciler recursed through the whole tree in one go and could not stop, blocking input for long updates. Fiber turns each unit of work into an object linked by child/sibling/return, so React can pause, resume, prioritise (lanes) and abandon work. This made concurrent features (transitions, Suspense, time slicing) possible.'),
    T('scheduler', 'Hard', 'What does React\'s scheduler do?', 'It runs render work in small chunks (about 5 ms) as macrotasks via MessageChannel, checks <code>shouldYield</code> between fibers so the browser can handle input and paint, and picks the most urgent lane first. Sync work (discrete events) is flushed in a microtask instead.'),
    T('effect-vs-event', 'Medium', 'Should this logic go in an effect or an event handler?', 'If it happens because the user did something (submit, click, buy), put it in the event handler. If it must happen because the component is <b>shown</b> (connect to a chat room, sync a widget), use an effect. Effects for "when X changes, set Y" are usually unnecessary: compute Y during render.'),
  ];

  window.JS_INTERVIEW.unshift(...THEORY, ...QUESTIONS);
  window.REACT_IV = (window.REACT_IV || []).concat(THEORY, QUESTIONS);
  window.REACT_IV_CATS = (window.REACT_IV_CATS || ['React theory']).concat(Object.values(C).filter(c => !(window.REACT_IV_CATS || []).includes(c)));
  if (window.JSWriteIt) Object.assign(window.JSWriteIt.WRITE_IT, {
    'rq-impl-error-boundary': ['ErrorBoundary'], 'rq-impl-use-interval': ['useInterval'], 'rq-impl-use-media-store': ['useOnline'],
    'rq-impl-mini-memo': ['memoize'], 'rq-impl-event-delegation': ['delegate'],
  });
})();
