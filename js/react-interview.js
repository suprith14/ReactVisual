/*
 * React Engine Lab — React interview questions: predict-the-output, "implement it" and theory flashcards.
 * Code questions run on ReactLite inside the visualizer, so you can watch React's internals for each answer.
 * The expected output is not stored: the app shows what the engine prints (same as React 18).
 */
(function () {
  'use strict';
  const R = 'ReactDOM.createRoot(document.getElementById("root"))';
  const Q = (id, cat, level, title, ask, code, why) => ({ id: 'rq-' + id, cat, level, title, ask, code, why });
  const T = (id, level, q, a) => ({ id: 'rth-' + id, cat: 'React theory', kind: 'theory', level, title: q, ask: q, why: a });
  const C = { render: 'React: rendering', state: 'React: state & batching', keys: 'React: reconciliation & keys', hooks: 'React: hooks', effects: 'React: effects', perf: 'React: performance', ctx: 'React: context', events: 'React: events & forms', conc: 'React: concurrency', impl: 'React: implement it', bugs: 'React: find the bug' };

  const QUESTIONS = [
    // ------------------------------------------------------------ rendering
    Q('render-order', C.render, 'Easy', 'Render order of parent and children', 'In which order do the components render, and when do their effects run?',
      `function Child({ name }) {
  console.log("render", name);
  React.useEffect(() => console.log("effect", name));
  return <i>{name}</i>;
}
function Parent() {
  console.log("render Parent");
  React.useEffect(() => console.log("effect Parent"));
  return <div><Child name="A" /><Child name="B" /></div>;
}
${R}.render(<Parent />);`,
      'Rendering goes <b>top-down</b> (a parent must run to know its children), so Parent, A, B. Effects run after the commit in <b>tree order from the leaves</b>: children before their parent, siblings in order: A, B, Parent.'),
    Q('render-sync', C.render, 'Easy', 'Is root.render synchronous?', 'Which line prints first?',
      `function App() { console.log("App renders"); return <p>hi</p>; }
${R}.render(<App />);
console.log("after render()");
Promise.resolve().then(() => console.log("microtask"));`,
      'With <code>createRoot</code>, <code>render()</code> only schedules work with the <b>Default</b> lane. React renders in a later task from its scheduler, after the current script and its microtasks.'),
    Q('element-identity', C.render, 'Medium', 'Same element object → no re-render', 'Does Child render again when the parent re-renders?',
      `function Child() { console.log("Child renders"); return <b>child</b>; }
const saved = <Child />;
function Parent() {
  const [n, setN] = React.useState(0);
  return <div id="p" onClick={() => setN(n + 1)}>{n}{saved}</div>;
}
${R}.render(<Parent />);
simulateClick("#p", 10);`,
      'The element <code>saved</code> is created once, outside the component. On re-render React sees the <b>same element object</b>, so the props object is the same (<code>===</code>) and Child bails out. This is why passing <code>children</code> from above avoids re-renders.'),
    Q('children-prop', C.render, 'Medium', 'children passed from above', 'Which components render when the counter changes?',
      `function Slow() { console.log("Slow renders"); return <p>slow</p>; }
function Counter({ children }) {
  const [n, setN] = React.useState(0);
  console.log("Counter renders", n);
  return <div><button id="b" onClick={() => setN(n + 1)}>{n}</button>{children}</div>;
}
function App() { return <Counter><Slow /></Counter>; }
${R}.render(<App />);
simulateClick("#b", 10);`,
      '<code>&lt;Slow /&gt;</code> is created by <code>App</code>, which does not re-render. Counter receives the same <code>children</code> element, so React bails out on Slow. Moving state down and passing content as children is a free optimisation.'),
    Q('component-inside', C.render, 'Hard', 'Component defined inside a component', 'Why does the input lose its text?',
      `function App() {
  const [n, setN] = React.useState(0);
  function Field() {
    const [text, setText] = React.useState("typed");
    return <span>{text}</span>;
  }
  return <div id="d" onClick={() => setN(n + 1)}><Field /> {n}</div>;
}
${R}.render(<App />);
setTimeout(() => console.log(document.getElementById("d").textContent), 5);
simulateClick("#d", 10);
setTimeout(() => console.log(document.getElementById("d").textContent), 30);`,
      '<code>Field</code> is a <b>new function</b> every render, so its element type changes. Reconciliation sees a different type, deletes the old fiber (and its state) and mounts a new one. Here the text survives because it is the initial state, but any typed text would be lost. Define components at the top level.'),
    Q('return-null', C.render, 'Easy', 'Returning null still runs hooks', 'Does the effect run when the component renders nothing?',
      `function Hidden({ show }) {
  React.useEffect(() => console.log("effect runs, show =", show));
  if (!show) return null;
  return <p>visible</p>;
}
${R}.render(<Hidden show={false} />);`,
      'Returning <code>null</code> means "no DOM", but the component is still mounted: its fiber exists and its hooks and effects run. Only the early return must come <b>after</b> all hook calls.'),
    Q('falsy-render', C.render, 'Easy', 'Rendering 0 with &&', 'What does the page show?',
      `function List({ items }) {
  return <div id="d">{items.length && <ul>{items.map(x => <li key={x}>{x}</li>)}</ul>}</div>;
}
${R}.render(<List items={[]} />);
setTimeout(() => console.log(JSON.stringify(document.getElementById("d").textContent)), 10);`,
      '<code>0 && …</code> evaluates to <code>0</code>, and React renders numbers. <code>false</code>, <code>null</code>, <code>undefined</code> and <code>true</code> render nothing, but <code>0</code> appears as text. Use <code>items.length > 0 && …</code>.'),
    Q('fragments', C.render, 'Easy', 'Fragments and keys', 'What HTML is produced?',
      `function Pairs() {
  const rows = [["a", 1], ["b", 2]];
  return <dl id="d">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>;
}
${R}.render(<Pairs />);
setTimeout(() => console.log(document.getElementById("d").innerHTML), 10);`,
      'A Fragment groups children without adding a DOM node. The short form <code>&lt;&gt;…&lt;/&gt;</code> cannot take a key, so in lists use <code>&lt;React.Fragment key=…&gt;</code>.'),

    // ------------------------------------------------------------ state & batching
    Q('snapshot', C.state, 'Easy', 'State is a snapshot', 'What does the handler log?',
      `function App() {
  const [n, setN] = React.useState(0);
  return <button id="b" onClick={() => {
    setN(n + 5);
    console.log("in handler:", n);
    setTimeout(() => console.log("in timeout:", n), 20);
  }}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log("on screen:", document.getElementById("b").textContent), 50);`,
      'Each render has its own <code>n</code>. The handler and the timeout both close over the render where <code>n</code> was 0. The setter only affects the <b>next</b> render, which shows 5.'),
    Q('triple-set', C.state, 'Easy', 'setCount(count + 1) three times', 'What is the count after one click?',
      `function App() {
  const [c, setC] = React.useState(0);
  return <button id="b" onClick={() => { setC(c + 1); setC(c + 1); setC(c + 1); }}>{c}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("b").textContent), 50);`,
      'All three calls compute <code>0 + 1</code>, so the queue is "set 1" three times. Use <code>setC(x => x + 1)</code> to chain on the latest value.'),
    Q('mixed-updates', C.state, 'Medium', 'Values and updaters mixed', 'What is the final number?',
      `function App() {
  const [n, setN] = React.useState(0);
  return <button id="b" onClick={() => {
    setN(n + 5);
    setN(x => x + 1);
    setN(42);
    setN(x => x * 2);
  }}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("b").textContent), 50);`,
      'React processes the queue in order, starting from 0: "set 5" → 5, <code>x => x + 1</code> → 6, "set 42" → 42, <code>x => x * 2</code> → 84.'),
    Q('batch-timeout', C.state, 'Medium', 'Automatic batching in a timeout', 'How many renders happen after the timeout?',
      `function App() {
  const [a, setA] = React.useState(0);
  const [b, setB] = React.useState(0);
  console.log("render", a, b);
  React.useEffect(() => {
    setTimeout(() => { setA(1); setB(1); }, 10);
  }, []);
  return <p>{a}{b}</p>;
}
${R}.render(<App />);`,
      'Since React 18, updates are batched <b>everywhere</b>, including timeouts, promises and native handlers. Both updates are rendered together: one render with <code>1 1</code>. (React 17 rendered twice here.)'),
    Q('same-value', C.state, 'Medium', 'Setting the same value', 'Does the component render again?',
      `function App() {
  const [user, setUser] = React.useState({ name: "Ada" });
  const [n, setN] = React.useState(1);
  console.log("render");
  return <div>
    <button id="same" onClick={() => setN(1)}>same number</button>
    <button id="copy" onClick={() => setUser({ ...user })}>copy object</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#same", 10);
simulateClick("#copy", 20);`,
      'React compares with <code>Object.is</code>. Setting <code>1</code> again is equal, so React bails out without rendering. A copied object is a <b>new reference</b>, so it renders, even though the content is the same.'),
    Q('mutate-state', C.state, 'Medium', 'Mutating state in place', 'Why does the list not update on screen?',
      `function App() {
  const [items, setItems] = React.useState(["a"]);
  return <ul id="u" onClick={() => { items.push("b"); setItems(items); }}>
    {items.map(x => <li key={x}>{x}</li>)}
  </ul>;
}
${R}.render(<App />);
simulateClick("#u", 10);
setTimeout(() => console.log(document.getElementById("u").children.length), 50);`,
      '<code>push</code> changes the same array, and <code>setItems(items)</code> passes the same reference. <code>Object.is(old, new)</code> is true, so React skips the render. Always create a new array: <code>setItems([...items, "b"])</code>.'),
    Q('lazy-init', C.state, 'Easy', 'Lazy initial state', 'How many times is "expensive" printed?',
      `function expensive() { console.log("expensive"); return 1; }
function App() {
  const [a, setA] = React.useState(expensive());
  const [b] = React.useState(() => expensive());
  return <button id="b" onClick={() => setA(a + 1)}>{a + b}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      '<code>useState(expensive())</code> calls the function on <b>every render</b>; React just ignores the result after the first one. <code>useState(() => expensive())</code> passes a function that React calls only on mount. So: 2 at mount, then 1 more for the first form.'),
    Q('derived-state', C.state, 'Medium', 'State copied from props', 'Why does the label not follow the prop?',
      `function Label({ text }) {
  const [value] = React.useState(text);
  return <b>{value}</b>;
}
function App() {
  const [t, setT] = React.useState("first");
  return <div id="d" onClick={() => setT("second")}><Label text={t} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);
setTimeout(() => console.log(document.getElementById("d").textContent), 50);`,
      'The initial value of <code>useState</code> is used only at mount. Later props are ignored. Use the prop directly (<code>{text}</code>), or reset the child with a <code>key</code> when you really want a fresh copy.'),

    // ------------------------------------------------------------ reconciliation & keys
    Q('key-reset', C.keys, 'Medium', 'Using key to reset state', 'What does the input show after switching users?',
      `function Profile({ user }) {
  const [draft] = React.useState("draft of " + user);
  return <p>{draft}</p>;
}
function App() {
  const [user, setUser] = React.useState("ada");
  return <div id="d" onClick={() => setUser("bob")}>
    <Profile user={user} />
    <Profile key={user} user={user} />
  </div>;
}
${R}.render(<App />);
simulateClick("#d", 10);
setTimeout(() => console.log(document.getElementById("d").innerHTML), 50);`,
      'The first Profile keeps its fiber (same type, same position), so its state stays "draft of ada". The second has <code>key={user}</code>: a new key means a new fiber, so React unmounts the old one and mounts a fresh one with "draft of bob".'),
    Q('index-key-input', C.keys, 'Hard', 'Index keys and prepending', 'Which note is attached to which name after adding to the front?',
      `function Row({ name }) {
  const [note] = React.useState(name + "'s note");
  return <li>{name}: {note}</li>;
}
function App() {
  const [names, setNames] = React.useState(["Ada", "Bob"]);
  return <ul id="u" onClick={() => setNames(["Cy", ...names])}>
    {names.map((n, i) => <Row key={i} name={n} />)}
  </ul>;
}
${R}.render(<App />);
simulateClick("#u", 10);
setTimeout(() => console.log([...document.querySelectorAll("li")].map(li => li.textContent).join(" | ")), 50);`,
      'With index keys, key 0 is now "Cy" but keeps the fiber that had Ada\'s state, and so on. Only the last row (key 2) is new. Every row shows the wrong note. Stable ids as keys fix it.'),
    Q('keys-moves', C.keys, 'Medium', 'How React moves keyed items', 'Which items does React move?',
      `function App() {
  const [xs, setXs] = React.useState(["a", "b", "c", "d"]);
  return <ul id="u" onClick={() => setXs(["d", "a", "b", "c"])}>{xs.map(x => <li key={x}>{x}</li>)}</ul>;
}
${R}.render(<App />);
simulateClick("#u", 10);`,
      'React keeps the last old index it placed (<code>lastPlacedIndex</code>). "d" (old index 3) stays, which sets it to 3; then "a", "b" and "c" have smaller old indexes, so all three are <b>moved</b>. Moving the last item to the front costs 3 moves; moving the first to the end costs only 1. See the reconciliation step in the narrator.'),
    Q('type-change', C.keys, 'Easy', 'Changing the element type', 'Is the state kept?',
      `function Counter() { const [n, setN] = React.useState(0); return <b id="c" onClick={() => setN(n + 1)}>{n}</b>; }
function App() {
  const [warn, setWarn] = React.useState(false);
  return <div>
    {warn ? <p className="warn"><Counter /></p> : <p><Counter /></p>}
    <button id="t" onClick={() => setWarn(true)}>warn</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#c", 10);
simulateClick("#t", 20);
setTimeout(() => console.log(document.getElementById("c").textContent), 50);`,
      'Both branches render a <code>&lt;p&gt;</code> in the same place, so React sees the same type: it keeps the fiber, updates <code>className</code>, and Counter keeps its state (1). Only the <b>type</b> and <b>key</b> matter, not which branch of the code made the element.'),
    Q('conditional-position', C.keys, 'Hard', 'Same component, different position', 'Does the counter keep its state when the banner appears?',
      `function Counter() { const [n, setN] = React.useState(0); return <b id="c" onClick={() => setN(n + 1)}>{n}</b>; }
function App() {
  const [banner, setBanner] = React.useState(false);
  return <div>
    {banner && <p>banner</p>}
    <Counter />
    <button id="t" onClick={() => setBanner(true)}>show</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#c", 10);
simulateClick("#t", 20);
setTimeout(() => console.log(document.getElementById("c").textContent), 50);`,
      '<code>{banner && …}</code> is always a child slot: it is <code>false</code> (an empty slot) or the <code>&lt;p&gt;</code>. Counter stays the second child either way, so its fiber and state (1) are kept.'),

    // ------------------------------------------------------------ hooks
    Q('hooks-order', C.hooks, 'Medium', 'Hook inside a condition', 'What goes wrong on the second render?',
      `function App() {
  const [first, setFirst] = React.useState(true);
  if (first) { React.useState("extra"); }
  const [name] = React.useState("Ada");
  console.log("name =", name);
  return <button id="b" onClick={() => setFirst(false)}>go</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'Hooks are matched by <b>call order</b>. On the second render, <code>name</code> reads hook #1, which holds "extra". Then React sees fewer hooks than last time and throws. This is why hooks must never be conditional.'),
    Q('useref-render', C.hooks, 'Easy', 'Changing a ref does not render', 'What is on the screen after the clicks?',
      `function App() {
  const clicks = React.useRef(0);
  return <button id="b" onClick={() => { clicks.current++; console.log("ref is", clicks.current); }}>{clicks.current}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);
setTimeout(() => console.log("screen:", document.getElementById("b").textContent), 50);`,
      'A ref is a plain mutable object kept by React. Changing <code>.current</code> does not schedule a render, so the screen still shows 0. Use state for anything that is displayed.'),
    Q('usememo-deps', C.hooks, 'Medium', 'useMemo with an object dependency', 'How many times is the value computed?',
      `function App() {
  const [n, setN] = React.useState(0);
  const options = { sort: "asc" };
  const sorted = React.useMemo(() => { console.log("sorting"); return [3, 1, 2].sort(); }, [options]);
  return <button id="b" onClick={() => setN(n + 1)}>{sorted.join()}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);`,
      '<code>options</code> is a new object each render, so the dependency is never equal (<code>Object.is</code>) and the memo recomputes every time. Move constant objects outside the component or memoize them too.'),
    Q('usecallback-identity', C.hooks, 'Medium', 'useCallback and function identity', 'Which functions are the same between renders?',
      `const seen = [];
function App() {
  const [n, setN] = React.useState(0);
  const plain = () => n;
  const stable = React.useCallback(() => n, []);
  const withDep = React.useCallback(() => n, [n]);
  seen.push([plain, stable, withDep]);
  if (seen.length === 2) console.log(seen[0][0] === seen[1][0], seen[0][1] === seen[1][1], seen[0][2] === seen[1][2], seen[1][1]());
  return <button id="b" onClick={() => setN(n + 1)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'A plain arrow is recreated every render. <code>useCallback(fn, [])</code> returns the first function forever, so it also keeps the first render\'s <code>n</code> (0): a stale closure. With <code>[n]</code> it changes when <code>n</code> changes.'),
    Q('usereducer-bail', C.hooks, 'Medium', 'Reducer returning the same state', 'How many renders after the click?',
      `function reducer(s, a) { return a === "noop" ? s : s + 1; }
function App() {
  const [s, dispatch] = React.useReducer(reducer, 0);
  console.log("render", s);
  return <div>
    <button id="n" onClick={() => dispatch("noop")}>noop</button>
    <button id="i" onClick={() => dispatch("inc")}>inc</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#n", 10);
simulateClick("#i", 20);`,
      'Unlike <code>useState</code>, a <code>dispatch</code> cannot be skipped in advance (React 18 does not run the reducer early), so the component <b>runs again</b> and logs "render 0". Then React sees the reducer returned the same state and <b>bails out</b>: the new JSX is thrown away and nothing is committed. Returning a new value (<code>s + 1</code>) renders normally.'),
    Q('custom-hook-state', C.hooks, 'Easy', 'Do custom hooks share state?', 'What do the two counters show?',
      `function useCounter() { const [n, setN] = React.useState(0); return [n, () => setN(x => x + 1)]; }
function A() { const [n, inc] = useCounter(); return <b id="a" onClick={inc}>{n}</b>; }
function B() { const [n] = useCounter(); return <b id="bb">{n}</b>; }
${R}.render(<div><A /><B /></div>);
simulateClick("#a", 10);
simulateClick("#a", 20);
setTimeout(() => console.log(document.getElementById("a").textContent, document.getElementById("bb").textContent), 50);`,
      'A custom hook is just a function; its <code>useState</code> belongs to the component that calls it. A and B each have their own state.'),
    Q('use-previous', C.hooks, 'Medium', 'usePrevious with a ref', 'What does each render log?',
      `function usePrevious(value) {
  const ref = React.useRef();
  React.useEffect(() => { ref.current = value; });
  return ref.current;
}
function App() {
  const [n, setN] = React.useState(1);
  const prev = usePrevious(n);
  console.log("now", n, "before", prev);
  return <button id="b" onClick={() => setN(n * 10)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);`,
      'During render the ref still holds the value saved by the <b>previous</b> render\'s effect. The effect updates it after the commit, ready for the next render.'),

    // ------------------------------------------------------------ effects
    Q('effect-deps-order', C.effects, 'Medium', 'Effect order with cleanup', 'What is the full log order?',
      `function App() {
  const [n, setN] = React.useState(0);
  console.log("render", n);
  React.useEffect(() => {
    console.log("effect", n);
    return () => console.log("cleanup", n);
  }, [n]);
  return <button id="b" onClick={() => setN(n + 1)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'Render 1 → commit → effect 0. Click → render 1 → commit → <b>cleanup 0</b> (with the old closure) → effect 1. The cleanup always runs before the next effect of the same hook.'),
    Q('effect-no-deps', C.effects, 'Easy', 'Effect without a dependency array', 'How often does each effect run?',
      `function App() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => console.log("every render"));
  React.useEffect(() => console.log("only on mount"), []);
  React.useEffect(() => console.log("when n changes"), [n]);
  return <button id="b" onClick={() => setN(n + 1)}>{n}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'No array → after every render. <code>[]</code> → once after mount. <code>[n]</code> → after mount and whenever <code>n</code> changed.'),
    Q('effect-loop', C.effects, 'Medium', 'Effect that sets its own dependency', 'How many renders happen?',
      `function App() {
  const [n, setN] = React.useState(0);
  console.log("render", n);
  React.useEffect(() => {
    if (n < 3) setN(n + 1);
  }, [n]);
  return <p>{n}</p>;
}
${R}.render(<App />);`,
      'Each effect changes <code>n</code>, which triggers another render and another effect, until the condition stops it. Without the <code>if</code>, this would loop forever. Prefer computing values during render instead.'),
    Q('stale-interval', C.effects, 'Hard', 'Stale state in a timer', 'Why does the counter stop at 1?',
      `function Ticker() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    let k = 0;
    const tick = () => { setN(n + 1); if (++k < 3) setTimeout(tick, 10); };
    setTimeout(tick, 10);
  }, []);
  return <b id="t">{n}</b>;
}
${R}.render(<Ticker />);
setTimeout(() => console.log(document.getElementById("t").textContent), 100);`,
      'The effect ran once, in the first render, where <code>n</code> is 0. Every tick sets <code>0 + 1</code>. Fix it with <code>setN(x => x + 1)</code>, or by adding <code>n</code> to the deps (and cleaning up the timer).'),
    Q('fetch-race', C.effects, 'Hard', 'Race condition when fetching', 'Which user is shown at the end?',
      `function fakeFetch(id, ms) { return new Promise(res => setTimeout(() => res("user " + id), ms)); }
function Profile({ id }) {
  const [user, setUser] = React.useState("loading");
  React.useEffect(() => {
    let ignore = false;
    fakeFetch(id, id === 1 ? 50 : 10).then(u => { if (!ignore) setUser(u); });
    return () => { ignore = true; };
  }, [id]);
  return <p id="p">{user}</p>;
}
function App() {
  const [id, setId] = React.useState(1);
  return <div><button id="next" onClick={() => setId(2)}>next</button><Profile id={id} /></div>;
}
${R}.render(<App />);
simulateClick("#next", 5);
setTimeout(() => console.log(document.getElementById("p").textContent), 100);`,
      'Request 1 is slow and finishes <b>after</b> request 2. Without the <code>ignore</code> flag it would overwrite "user 2" with "user 1". The cleanup of the old effect marks its request as stale. (An <code>AbortController</code> works too.)'),
    Q('layout-vs-effect', C.effects, 'Medium', 'useLayoutEffect, useEffect and microtasks', 'Put the logs in order.',
      `function App() {
  React.useEffect(() => console.log("useEffect"));
  React.useLayoutEffect(() => {
    console.log("useLayoutEffect");
    Promise.resolve().then(() => console.log("microtask from layout"));
  });
  return <p>hi</p>;
}
${R}.render(<App />);`,
      'Layout effects run synchronously inside the commit, before the browser paints. The microtask runs as soon as that task (the render and commit) finishes. Passive effects (<code>useEffect</code>) are scheduled for a <b>later task</b>, so even a microtask queued by a layout effect runs before them.'),
    Q('unmount-cleanup', C.effects, 'Easy', 'Cleanup on unmount', 'What is logged when the component disappears?',
      `function Chat() {
  React.useEffect(() => {
    console.log("connect");
    return () => console.log("disconnect");
  }, []);
  return <p>chat</p>;
}
function App() {
  const [open, setOpen] = React.useState(true);
  return <div><button id="b" onClick={() => setOpen(false)}>close</button>{open && <Chat />}</div>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'When a component is removed, React runs the cleanup of each of its effects during the commit of the deletion.'),

    // ------------------------------------------------------------ performance
    Q('memo-object-prop', C.perf, 'Medium', 'memo with an object prop', 'Why does the memo child still render?',
      `const Card = React.memo(function Card({ style }) { console.log("Card renders"); return <p>{style.color}</p>; });
function App() {
  const [n, setN] = React.useState(0);
  return <div id="d" onClick={() => setN(n + 1)}><Card style={{ color: "red" }} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);`,
      '<code>style={{ … }}</code> is a new object every render. <code>memo</code> compares props with <code>Object.is</code>, so it sees a change. Hoist the object or <code>useMemo</code> it.'),
    Q('memo-custom-compare', C.perf, 'Medium', 'memo with a custom comparison', 'When does Price render?',
      `const Price = React.memo(function Price({ value }) {
  console.log("Price renders", value);
  return <b>{value.toFixed(0)}</b>;
}, (prev, next) => Math.round(prev.value) === Math.round(next.value));
function App() {
  const [v, setV] = React.useState(1.1);
  return <div id="d" onClick={() => setV(v + 0.2)}><Price value={v} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);
simulateClick("#d", 20);
simulateClick("#d", 30);`,
      'The second argument of <code>memo</code> returns <b>true when the props are equal</b> (skip). Here Price renders only when the rounded value changes: 1.1 → 1.3 (skip) → 1.5 (renders, rounds to 2) → 1.7 (skip).'),
    Q('context-rerender', C.perf, 'Hard', 'Context value as a new object', 'Why does the reader re-render when nothing it uses changed?',
      `const Ctx = React.createContext(null);
const Reader = React.memo(function Reader() {
  const { user } = React.useContext(Ctx);
  console.log("Reader renders");
  return <i>{user}</i>;
});
function App() {
  const [n, setN] = React.useState(0);
  return <Ctx.Provider value={{ user: "Ada" }}>
    <button id="b" onClick={() => setN(n + 1)}>{n}</button>
    <Reader />
  </Ctx.Provider>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'The Provider gets a <b>new object</b> each render, so the context value changed (<code>Object.is</code>) and React schedules every reader, even through <code>memo</code>. Memoize the value: <code>useMemo(() => ({ user }), [user])</code>.'),
    Q('state-colocation', C.perf, 'Medium', 'Moving state down', 'Which components render while typing?',
      `function Big() { console.log("Big renders"); return <p>big</p>; }
function Search() {
  const [q, setQ] = React.useState("");
  return <input id="q" value={q} onChange={e => setQ(e.target.value)} />;
}
function App() { return <div><Search /><Big /></div>; }
${R}.render(<App />);
simulateTyping("#q", "abc", 10);`,
      'The state lives in <code>Search</code>, so only Search renders on each keystroke. If it lived in App, Big would render every time. Keep state close to where it is used.'),

    // ------------------------------------------------------------ context
    Q('context-default', C.ctx, 'Easy', 'Context without a Provider', 'What value does the component read?',
      `const Lang = React.createContext("en");
function Hello() { const l = React.useContext(Lang); return <p>{l === "fr" ? "Bonjour" : "Hello"}</p>; }
${R}.render(<div><Hello /><Lang.Provider value="fr"><Hello /></Lang.Provider></div>);
setTimeout(() => console.log(document.getElementById("root").textContent), 10);`,
      'Without a Provider above, <code>useContext</code> returns the default value passed to <code>createContext</code>. Inside the Provider it gets the Provider\'s value.'),
    Q('context-nearest', C.ctx, 'Easy', 'Nested Providers', 'Which value wins?',
      `const Theme = React.createContext("light");
function Show() { return <b>{React.useContext(Theme)} </b>; }
${R}.render(
  <Theme.Provider value="dark">
    <Show />
    <Theme.Provider value="blue"><Show /></Theme.Provider>
    <Show />
  </Theme.Provider>
);
setTimeout(() => console.log(document.getElementById("root").textContent), 10);`,
      'A component reads the <b>nearest</b> Provider above it. The inner Provider only affects its own subtree.'),

    // ------------------------------------------------------------ events & forms
    Q('event-order', C.events, 'Medium', 'Bubbling through React handlers', 'In which order do the handlers run?',
      `function App() {
  return <div onClick={() => console.log("div")}>
    <section onClick={() => console.log("section")}>
      <button id="b" onClick={() => console.log("button")}>go</button>
    </section>
  </div>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      'React collects the handlers from the target up to the root and calls them in that order, like native bubbling: button, section, div.'),
    Q('stop-propagation', C.events, 'Easy', 'stopPropagation in React', 'Which handlers run?',
      `function App() {
  return <div onClick={() => console.log("outer")}>
    <button id="b" onClick={e => { e.stopPropagation(); console.log("inner"); }}>go</button>
  </div>;
}
${R}.render(<App />);
simulateClick("#b", 10);`,
      '<code>e.stopPropagation()</code> on the synthetic event stops React from calling the handlers further up.'),
    Q('controlled-transform', C.events, 'Easy', 'Controlled input that filters input', 'What ends up in the input?',
      `function Digits() {
  const [v, setV] = React.useState("");
  return <input id="i" value={v} onChange={e => setV(e.target.value.replace(/\\D/g, ""))} />;
}
${R}.render(<Digits />);
simulateTyping("#i", "a1b2c3", 10);
setTimeout(() => console.log(document.getElementById("i").value), 50);`,
      'The state decides what the input shows: <code>onChange</code> keeps only digits, and the commit writes the filtered value back into the DOM input.'),
    Q('form-submit', C.events, 'Medium', 'Form state as one object', 'What is submitted?',
      `function Form() {
  const [form, setForm] = React.useState({ name: "", city: "" });
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  return <div>
    <input id="n" value={form.name} onChange={set("name")} />
    <input id="c" value={form.city} onChange={set("city")} />
    <button id="s" onClick={() => console.log(JSON.stringify(form))}>send</button>
  </div>;
}
${R}.render(<Form />);
simulateTyping("#n", "Ada", 10);
simulateTyping("#c", "London", 20);
simulateClick("#s", 30);`,
      'Each field updates its own key with an updater and a spread copy, so the other key is kept. A curried handler (<code>set("name")</code>) avoids one function per field.'),

    // ------------------------------------------------------------ concurrency
    Q('transition-pending', C.conc, 'Medium', 'useTransition and isPending', 'What does the page show right after the click, and at the end?',
      `function App() {
  const [tab, setTab] = React.useState("home");
  const [isPending, start] = React.useTransition();
  return <div>
    <button id="b" onClick={() => start(() => setTab("posts"))}>posts</button>
    <p id="p">{isPending ? "loading " : ""}{tab}</p>
  </div>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("p").textContent), 11);
setTimeout(() => console.log(document.getElementById("p").textContent), 100);`,
      'Starting a transition first renders urgently with <code>isPending = true</code> (old tab still shown), then renders the new tab in the Transition lane, where isPending is false again.'),
    Q('transition-vs-sync', C.conc, 'Hard', 'Urgent update during a transition', 'Which render finishes first?',
      `function App() {
  const [text, setText] = React.useState("");
  const [list, setList] = React.useState([]);
  const [, start] = React.useTransition();
  console.log("render", JSON.stringify(text), list.length);
  return <input id="i" value={text} onChange={e => {
    setText(e.target.value);
    start(() => setList([1, 2, 3, 4, 5, 6, 7, 8]));
  }} />;
}
${R}.render(<App />);
simulateTyping("#i", "x", 10);`,
      'The keystroke updates <code>text</code> with the Sync lane, which renders first. The list update waits in the Transition lane and renders afterwards, in time slices.'),
    Q('flushsync-dom', C.conc, 'Medium', 'Reading the DOM after setState', 'What does each log print?',
      `function App() {
  const [items, setItems] = React.useState([1]);
  const ref = React.useRef(null);
  return <ul id="u" ref={ref} onClick={() => {
    setItems([1, 2]);
    console.log("before:", ref.current.children.length);
    ReactDOM.flushSync(() => setItems([1, 2, 3]));
    console.log("after flushSync:", ref.current.children.length);
  }}>{items.map(i => <li key={i}>{i}</li>)}</ul>;
}
${R}.render(<App />);
simulateClick("#u", 10);`,
      'setState does not touch the DOM; it renders after the handler. <code>flushSync</code> forces a render and commit right away.'),

    // ------------------------------------------------------------ find the bug
    Q('bug-missing-key', C.bugs, 'Easy', 'Checkbox stays on the wrong row', 'Why does the checked box move to another item after deleting the first one?',
      `function Item({ label }) {
  const [checked, setChecked] = React.useState(false);
  return <li id={"li-" + label} onClick={() => setChecked(true)}>{checked ? "☑" : "☐"} {label}</li>;
}
function App() {
  const [items, setItems] = React.useState(["milk", "eggs"]);
  return <div>
    <button id="del" onClick={() => setItems(items.slice(1))}>delete first</button>
    <ul>{items.map((x, i) => <Item key={i} label={x} />)}</ul>
  </div>;
}
${R}.render(<App />);
simulateClick("#li-milk", 10);
simulateClick("#del", 20);
setTimeout(() => console.log(document.querySelector("ul").textContent), 50);`,
      'The index is used as key. After deleting "milk", "eggs" has key 0 and receives the fiber (and checked state) that belonged to "milk". Use <code>key={x}</code>.'),
    Q('bug-object-deps', C.bugs, 'Medium', 'Effect runs on every render', 'Why does "subscribe" print on every click?',
      `function Feed({ filter }) {
  React.useEffect(() => {
    console.log("subscribe", filter.tag);
    return () => console.log("unsubscribe", filter.tag);
  }, [filter]);
  return <p>{filter.tag}</p>;
}
function App() {
  const [n, setN] = React.useState(0);
  return <div id="d" onClick={() => setN(n + 1)}><Feed filter={{ tag: "react" }} /></div>;
}
${R}.render(<App />);
simulateClick("#d", 10);`,
      'The <code>filter</code> object is new on every render, so the dependency always changes. Depend on <code>filter.tag</code> (a string) instead, or memoize the object in the parent.'),
    Q('bug-async-setstate', C.bugs, 'Medium', 'Updating an unmounted component', 'Why does the late answer not appear anywhere, and how do you avoid the wasted work?',
      `function Slow() {
  const [v, setV] = React.useState("…");
  React.useEffect(() => {
    const t = setTimeout(() => { console.log("timer fired"); setV("done"); }, 30);
    return () => { clearTimeout(t); console.log("timer cleared"); };
  }, []);
  return <p>{v}</p>;
}
function App() {
  const [show, setShow] = React.useState(true);
  return <div><button id="b" onClick={() => setShow(false)}>hide</button>{show && <Slow />}</div>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log("end"), 60);`,
      'The component was removed before the timer fired. The cleanup clears the timer, so the stale update never happens. Always cancel timers, subscriptions and requests in the cleanup.'),

    // ------------------------------------------------------------ implement it
    Q('impl-create-element', C.impl, 'Medium', 'Implement createElement and render to a string', 'Write h() and toHTML() so the output matches.',
      `function h(type, props, ...children) {
  return { type, props: { ...(props || {}), children: children.flat() } };
}
function toHTML(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node.type === "function") return toHTML(node.type(node.props));
  const attrs = Object.entries(node.props).filter(([k]) => k !== "children").map(([k, v]) => " " + (k === "className" ? "class" : k) + '="' + v + '"').join("");
  return "<" + node.type + attrs + ">" + node.props.children.map(toHTML).join("") + "</" + node.type + ">";
}
const Item = ({ text }) => h("li", null, text);
const tree = h("ul", { className: "list" }, ["a", "b"].map(t => h(Item, { text: t })));
console.log(toHTML(tree));`,
      'An element is just <code>{ type, props }</code> with <code>children</code> inside props. Rendering walks the tree: strings become text, function types are <b>called with their props</b> (that is all a component is), and host types become tags. React does the same, but builds fibers and real DOM nodes instead of a string.'),
    Q('impl-usestate', C.impl, 'Hard', 'Implement useState with a hooks array', 'Write useState and render so that the counters keep their own values.',
      `const hooks = [];
let index = 0;
function useState(initial) {
  const i = index++;
  if (hooks[i] === undefined) hooks[i] = initial;
  const set = v => { hooks[i] = typeof v === "function" ? v(hooks[i]) : v; };
  return [hooks[i], set];
}
function render(Component) { index = 0; return Component(); }

function Counter() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(10);
  return { a, b, incA: () => setA(x => x + 1), incB: () => setB(b + 5) };
}
let ui = render(Counter);
ui.incA(); ui.incA(); ui.incB();
ui = render(Counter);
console.log(ui.a, ui.b);`,
      'This is the core idea of hooks: state lives <b>outside</b> the function, in a list, and each <code>useState</code> call takes the next slot. Resetting the index before each render is what makes call order matter. React keeps the list on the fiber and also schedules a re-render when you call the setter.'),
    Q('impl-shallow-equal', C.impl, 'Easy', 'Implement shallowEqual (what memo uses)', 'Write shallowEqual so the output matches.',
      `function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}
const f = () => {};
console.log(shallowEqual({ x: 1, f }, { x: 1, f }), shallowEqual({ x: [] }, { x: [] }), shallowEqual({ x: NaN }, { x: NaN }), shallowEqual({ a: 1 }, { a: 1, b: 2 }));`,
      'Same keys, and every value equal by <code>Object.is</code>: one level deep only. That is why a new array or function prop breaks <code>memo</code>, and why <code>NaN</code> counts as equal to itself.'),
    Q('impl-use-toggle', C.impl, 'Easy', 'Custom hook: useToggle', 'Write useToggle so the output matches.',
      `function useToggle(initial = false) {
  const [on, setOn] = React.useState(initial);
  const toggle = React.useCallback(() => setOn(v => !v), []);
  return [on, toggle];
}
function App() {
  const [on, toggle] = useToggle();
  return <button id="b" onClick={toggle}>{on ? "ON" : "OFF"}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
simulateClick("#b", 20);
simulateClick("#b", 30);
setTimeout(() => console.log(document.getElementById("b").textContent), 60);`,
      'An updater (<code>v => !v</code>) keeps the toggle correct even when clicks are batched, and <code>useCallback</code> with <code>[]</code> keeps <code>toggle</code> stable for memo children.'),
    Q('impl-use-debounce', C.impl, 'Medium', 'Custom hook: useDebounce', 'Write useDebounce so only the last value arrives.',
      `function useDebounce(value, ms) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
function Search() {
  const [q, setQ] = React.useState("");
  const dq = useDebounce(q, 50);
  React.useEffect(() => { if (dq) console.log("search for", dq); }, [dq]);
  return <input id="q" value={q} onChange={e => setQ(e.target.value)} />;
}
${R}.render(<Search />);
simulateTyping("#q", "r", 10);
simulateTyping("#q", "re", 20);
simulateTyping("#q", "react", 30);`,
      'Each new value cleans up the previous timer and starts a new one, so only the value that stays unchanged for <code>ms</code> is stored. The cleanup does the debouncing.'),
    Q('impl-use-local-storage', C.impl, 'Medium', 'Custom hook: useLocalStorage', 'Write useLocalStorage so the value is saved and read back.',
      `function useLocalStorage(key, initial) {
  const [value, setValue] = React.useState(() => {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : initial;
  });
  React.useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}
localStorage.removeItem("todos");
function App() {
  const [todos, setTodos] = useLocalStorage("todos", ["read"]);
  return <button id="b" onClick={() => setTodos([...todos, "code"])}>{todos.length}</button>;
}
${R}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log(localStorage.getItem("todos")), 50);`,
      'Lazy initial state reads storage only once (on mount). An effect writes the value after every change, outside the render, which keeps rendering pure.'),
    Q('impl-use-fetch', C.impl, 'Hard', 'Custom hook: useFetch with loading and errors', 'Write useFetch so the states appear in this order.',
      `function api(url) {
  return new Promise((res, rej) => setTimeout(() => url === "/ok" ? res({ name: "Ada" }) : rej(new Error("404")), 20));
}
function useFetch(url) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });
  React.useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: null });
    api(url).then(data => live && setState({ loading: false, data, error: null }))
      .catch(error => live && setState({ loading: false, data: null, error: error.message }));
    return () => { live = false; };
  }, [url]);
  return state;
}
function Show({ url }) {
  const { loading, data, error } = useFetch(url);
  console.log(url, loading ? "loading" : error ? "error " + error : "got " + data.name);
  return null;
}
${R}.render(<div><Show url="/ok" /><Show url="/missing" /></div>);`,
      'The hook keeps <code>loading</code>, <code>data</code> and <code>error</code> together, restarts when the URL changes, and ignores answers that arrive after a cleanup (stale requests).'),
    Q('impl-reducer-store', C.impl, 'Medium', 'Implement a tiny store (like Redux)', 'Write createStore so the output matches.',
      `function createStore(reducer, state) {
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(action) { state = reducer(state, action); listeners.forEach(l => l()); },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}
const store = createStore((s, a) => a.type === "inc" ? { count: s.count + 1 } : s, { count: 0 });
const off = store.subscribe(() => console.log("changed to", store.getState().count));
store.dispatch({ type: "inc" });
store.dispatch({ type: "inc" });
off();
store.dispatch({ type: "inc" });
console.log("final", store.getState().count);`,
      'A store is state + a reducer + a set of listeners. <code>subscribe</code> returns the unsubscribe function, exactly what an effect cleanup needs (React\'s <code>useSyncExternalStore</code> works with this shape).'),
    Q('impl-keyed-diff', C.impl, 'Hard', 'Implement a keyed list diff', 'Write diff so it reports which keys to keep, move, create and delete.',
      `function diff(oldKeys, newKeys) {
  const oldIndex = new Map(oldKeys.map((k, i) => [k, i]));
  const ops = [];
  let lastPlaced = 0;
  newKeys.forEach(k => {
    if (!oldIndex.has(k)) { ops.push("create " + k); return; }
    const i = oldIndex.get(k);
    if (i < lastPlaced) ops.push("move " + k);
    else { ops.push("keep " + k); lastPlaced = i; }
  });
  oldKeys.filter(k => !newKeys.includes(k)).forEach(k => ops.push("delete " + k));
  return ops.join(", ");
}
console.log(diff(["a", "b", "c"], ["c", "a", "b", "d"]));
console.log(diff(["a", "b", "c", "d"], ["b", "c", "d", "a"]));`,
      'This is React\'s <code>lastPlacedIndex</code> rule: an item whose old position is before the last kept one must move; otherwise it stays and becomes the new reference point. Moving the first item to the end costs one move; moving the last item to the front moves all the others.'),
  ];

  const THEORY = [
    T('virtual-dom', 'Easy', 'What is the virtual DOM, and is it what makes React fast?', 'The "virtual DOM" is the tree of React elements your components return: plain objects describing the UI. React compares the new tree with the previous one (using fibers) and applies only the differences to the real DOM. It is not magic speed: direct DOM code can be faster. Its value is that you describe the UI for any state and React works out the minimal updates.'),
    T('fiber', 'Medium', 'What is a fiber?', 'A fiber is React\'s internal record for one component or element: its type, key, props, state (the hooks list), a link to its DOM node, effect flags and pending lanes. Fibers are linked with <code>child</code>, <code>sibling</code> and <code>return</code>, which lets React walk the tree with a loop and <b>pause</b> between fibers. Each fiber has an <code>alternate</code>: the current and work-in-progress versions (double buffering).'),
    T('render-commit', 'Medium', 'What happens in the render phase and in the commit phase?', '<b>Render</b>: React calls components, reconciles children and marks changes with flags. It must be pure: no DOM changes, no side effects, and it can be paused, restarted or thrown away. <b>Commit</b>: React applies the changes to the DOM (mutation), runs <code>useLayoutEffect</code> and attaches refs (layout), swaps the current tree, then schedules <code>useEffect</code> (passive). The commit is synchronous and cannot be interrupted.'),
    T('reconciliation', 'Medium', 'How does reconciliation decide what to keep?', 'React compares children one level at a time. Same <b>type</b> and same <b>key</b> → keep the fiber and DOM node, update props. Different type → unmount the old subtree and mount a new one (state is lost). In lists it matches by key, and uses the last placed index to decide what to move. This heuristic is O(n) instead of a general O(n³) tree diff.'),
    T('keys', 'Easy', 'Why do lists need keys, and why not the index?', 'Keys tell React which item is which across renders, so it can keep state and DOM nodes with the right item when the list is reordered, filtered or prepended. The index changes when items move, so state ends up on the wrong item. Use a stable id from the data; the index is only fine for static lists that never reorder.'),
    T('batching', 'Easy', 'What is batching?', 'React groups multiple state updates into a single render. Since React 18 this is automatic everywhere: event handlers, timeouts, promises, native events. Updates are queued on their hooks and applied in order during the next render. Use <code>flushSync</code> to opt out in rare cases.'),
    T('setstate-async', 'Easy', 'Is setState synchronous or asynchronous?', 'Neither in the usual sense: calling it is synchronous (it queues an update right away), but the component does not re-render until React processes the queue, after the current event (a microtask for Sync updates) or in a scheduler task. The variable in the current render never changes; you see the new value in the next render.'),
    T('rules-of-hooks', 'Easy', 'What are the rules of hooks, and why do they exist?', 'Call hooks only at the top level of a function component or custom hook: never in conditions, loops, nested functions or after an early return, and never from plain functions. React stores hooks as a linked list on the fiber and matches them by call order, so the order must be the same on every render.'),
    T('useeffect-vs-layout', 'Medium', 'useEffect vs useLayoutEffect?', '<code>useLayoutEffect</code> runs synchronously after the DOM is updated and before the browser paints: use it to measure the DOM and fix layout without a flicker. <code>useEffect</code> usually runs after paint, in a separate task, so it does not block the screen; use it for everything else (subscriptions, fetching, logging). One detail interviewers like: when the update came from a discrete event such as a click or a key press, React may run the effects before the browser paints, so never rely on useEffect running after paint for visual fixes: that is what useLayoutEffect is for.'),
    T('effect-cleanup', 'Easy', 'When does an effect cleanup run?', 'Before the effect runs again (because a dependency changed), and when the component unmounts. In one commit React runs all cleanups first, then all new effects. The cleanup sees the values of the render that created it.'),
    T('deps-array', 'Easy', 'What does the dependency array do?', 'It tells React when to re-run an effect (or recompute a memo): after a render where some dependency is different by <code>Object.is</code>. No array → every render; <code>[]</code> → only on mount. Every value from the component used inside should be listed; missing ones cause stale closures.'),
    T('stale-closure', 'Medium', 'What is a stale closure in React?', 'A function created in one render keeps that render\'s props and state. If it lives longer, for example a timer or a subscription created by an effect with missing deps, it keeps reading old values. Fixes: list the dependencies, use updater functions (<code>setX(x => …)</code>), or keep the latest value in a ref.'),
    T('memo-usememo-usecallback', 'Medium', 'React.memo vs useMemo vs useCallback?', '<code>React.memo(Component)</code> skips rendering a component when its props are shallowly equal. <code>useMemo(fn, deps)</code> caches a computed value inside a component. <code>useCallback(fn, deps)</code> caches a function (same as <code>useMemo(() => fn, deps)</code>). The hooks mostly matter for expensive work and for keeping props stable for memo children.'),
    T('when-rerender', 'Medium', 'When does a component re-render?', 'When its state changes, when its parent re-renders (unless it is memo and its props are equal, or the element object is the same), or when a context it reads changes. Changing a ref, a variable outside React, or a prop object\'s contents in place does not cause a render.'),
    T('controlled', 'Easy', 'Controlled vs uncontrolled inputs?', 'Controlled: React state holds the value (<code>value</code> + <code>onChange</code>), so you can validate or transform every keystroke. Uncontrolled: the DOM holds the value and you read it with a ref when needed (<code>defaultValue</code>). Controlled is the default choice; uncontrolled is simpler for file inputs and big forms.'),
    T('lifting-state', 'Easy', 'What does "lifting state up" mean?', 'Moving state to the closest common parent of the components that need it, then passing the value down as props and a callback to change it. It keeps one source of truth.'),
    T('context-use', 'Medium', 'When should you use context, and what is the catch?', 'For values many components at different depths need: theme, current user, locale. The catch: every component reading the context re-renders when the value changes, and a new object as value changes on every render. Memoize the value, split contexts by how often they change, or use a store for frequently changing data.'),
    T('lanes', 'Hard', 'What are lanes?', 'Lanes are bits that mark the priority of an update: Sync (clicks, typing), Default (other updates), Transition (<code>startTransition</code>), and more. Each fiber has <code>lanes</code> (its own pending work) and <code>childLanes</code> (work below it). React renders the highest-priority lane first and can skip updates of lower lanes for later.'),
    T('concurrent', 'Hard', 'What is concurrent rendering?', 'React can prepare a render in small time slices, yield to the browser between them, and pause, resume or abandon the work-in-progress tree. Urgent updates can interrupt a transition. Because the render phase has no side effects and the commit is all-or-nothing, the user never sees a half-finished UI.'),
    T('transition', 'Medium', 'What do startTransition and useTransition do?', 'They mark updates as non-urgent (the Transition lane). React renders urgent updates (like the input value) first and keeps the old UI on screen while the transition renders, possibly interrupted by newer input. <code>useTransition</code> also gives <code>isPending</code> to show a loading hint.'),
    T('usedeferredvalue', 'Medium', 'What is useDeferredValue?', 'It returns a copy of a value that "lags behind" during urgent updates: React first renders with the old value, then re-renders with the new one in a transition. Use it when you do not control the setState call, for example to keep a slow list responsive to a fast-changing prop.'),
    T('synthetic-events', 'Medium', 'How do React events work?', 'React adds one listener per event type on the root container (event delegation). When an event arrives, it finds the fiber of the target, collects the matching handlers walking up the fiber tree, and calls them with a synthetic event that wraps the native one. Since React 17 the listeners are on the root container, not on <code>document</code>.'),
    T('strict-mode', 'Medium', 'What does StrictMode do?', 'In development only, it renders components twice and runs effects mount → cleanup → mount, to reveal impure renders and missing cleanups. It also warns about deprecated APIs. It has no effect in production builds.'),
    T('keys-reset', 'Medium', 'How can you reset a component\'s state?', 'Give it a different <code>key</code>: React treats it as a new component, unmounts the old one and mounts a fresh one with initial state. Rendering a different element type at that position does the same.'),
    T('refs', 'Easy', 'What are refs for?', 'A ref is a mutable box (<code>{ current }</code>) that keeps its value between renders without causing renders. Uses: DOM access (focus, measure, scroll), timer ids, previous values, instance-like variables. Do not use refs for data that should appear on screen.'),
    T('forwardref', 'Medium', 'How do you pass a ref to your own component?', 'In React 19, <code>ref</code> is a normal prop for function components. Before that, wrap the component in <code>forwardRef((props, ref) => …)</code> and attach the ref to an inner element. <code>useImperativeHandle</code> exposes a custom object instead of the DOM node.'),
    T('suspense', 'Medium', 'What is Suspense?', '<code>&lt;Suspense fallback={…}&gt;</code> shows a fallback while something inside is not ready: code loaded with <code>React.lazy</code>, or data from a Suspense-enabled library or <code>use(promise)</code>. A component "suspends" by throwing a promise during render; React shows the nearest fallback and retries when the promise resolves.'),
    T('error-boundary', 'Medium', 'What is an error boundary?', 'A class component with <code>static getDerivedStateFromError</code> and/or <code>componentDidCatch</code> that catches errors thrown while rendering its children and shows a fallback UI. It does not catch errors in event handlers, async code or the boundary itself.'),
    T('server-components', 'Hard', 'What are React Server Components?', 'Components that run only on the server (or at build time). They can read databases and files directly, send no JavaScript to the browser, and render to a serialized tree. Client components (marked <code>"use client"</code>) are hydrated in the browser and can use state and effects. Server components can render client components, not the other way round (except as children).'),
    T('hydration', 'Medium', 'What is hydration?', 'The server sends HTML so the page shows quickly; in the browser, React renders the same tree and attaches its fibers and event listeners to the existing DOM instead of recreating it. The server and client output must match, or React reports a hydration mismatch.'),
    T('pure-render', 'Easy', 'Why must components be pure?', 'React may call a component many times, in any order, pause the render or throw it away (concurrent rendering, StrictMode). A pure component returns the same JSX for the same props, state and context and changes nothing outside. Side effects belong in event handlers or effects.'),
    T('derive-not-sync', 'Medium', 'Do you need an effect to compute a value from props or state?', 'No. Compute it during render (<code>const total = items.reduce(…)</code>), with <code>useMemo</code> if it is expensive. Copying it into state with an effect causes an extra render and can get out of sync.'),
    T('usesyncexternalstore', 'Hard', 'What is useSyncExternalStore for?', 'Subscribing to a store outside React (Redux, browser APIs, your own store) safely with concurrent rendering. You give it <code>subscribe</code> and <code>getSnapshot</code>; React reads a consistent snapshot during render and re-renders when the store notifies it.'),
    T('class-vs-function', 'Easy', 'Class components vs function components?', 'Function components with hooks are the standard: less code, logic reusable through custom hooks, no <code>this</code>. Classes still work and are needed only for error boundaries. Lifecycle mapping: <code>componentDidMount</code>/<code>componentDidUpdate</code>/<code>componentWillUnmount</code> ≈ <code>useEffect</code> with deps and cleanup.'),
    T('double-buffering', 'Hard', 'What is double buffering in React?', 'React keeps two trees: <code>current</code> (on screen) and <code>workInProgress</code> (being built). Each fiber points to its twin through <code>alternate</code>. A render fills the work-in-progress tree, reusing the old alternates; the commit makes it current with one assignment (<code>root.current = finishedWork</code>). This lets React build, pause or discard a render without touching what users see.'),
    T('bailout', 'Hard', 'What is a bailout?', 'When React reaches a fiber whose props object is the same and that has no pending update or context change, it does not call the component. If nothing below has work (<code>childLanes</code> is empty) it skips the whole subtree; otherwise it clones the children and continues down to where the work is.'),
  ];

  window.JS_INTERVIEW = window.JS_INTERVIEW || [];
  window.JS_INTERVIEW.unshift(...THEORY, ...QUESTIONS);
  window.REACT_IV = THEORY.concat(QUESTIONS);
  window.REACT_IV_CATS = ['React theory'].concat(Object.values(C));
  // "write it yourself": these functions lose their bodies, the test code under them stays
  if (window.JSWriteIt) Object.assign(window.JSWriteIt.WRITE_IT, {
    'rq-impl-create-element': ['h', 'toHTML'], 'rq-impl-usestate': ['useState', 'render'], 'rq-impl-shallow-equal': ['shallowEqual'],
    'rq-impl-use-toggle': ['useToggle'], 'rq-impl-use-debounce': ['useDebounce'], 'rq-impl-use-local-storage': ['useLocalStorage'],
    'rq-impl-use-fetch': ['useFetch'], 'rq-impl-reducer-store': ['createStore'], 'rq-impl-keyed-diff': ['diff'],
  });
})();
