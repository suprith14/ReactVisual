/*
 * React Engine Lab — React levels, lessons and quizzes.
 * They are put in front of the JavaScript levels, in three parts (see WORLDS below).
 * Every program runs on ReactLite (js/react/reactlite.js), which works like React 18.
 */
(function () {
  'use strict';
  const L = (id, emoji, title, concept, stars, goal, code, lesson, quiz) => ({ level: { id, emoji, title, concept, stars, goal, code }, lesson: { lesson, quiz } });
  const ROOT = `ReactDOM.createRoot(document.getElementById("root"))`;

  const ALL = [
    // ================================================================ Part R1 · Rendering
    L('r-jsx', '🧩', 'JSX is just function calls', 'createElement, elements', 1,
      'See what JSX turns into: plain objects that describe the UI.',
      `const el = <h1 className="title">Hello {"Ada"}</h1>;
console.log(el.type, el.props.className);
console.log(el.props.children);

const list = <ul>{[1, 2].map(n => <li key={n}>{n}</li>)}</ul>;
console.log(list.props.children.length, list.props.children[0].key);`,
      `<p>JSX is not HTML. Before your code runs, every tag becomes a call to <code>React.createElement(type, props, ...children)</code>. The result is a <b>React element</b>: a small, plain object that <i>describes</i> what you want on screen.</p>
<pre>&lt;h1 className="t"&gt;Hi&lt;/h1&gt;
// becomes
React.createElement("h1", { className: "t" }, "Hi")
// returns
{ $$typeof: Symbol(react.element), type: "h1", key: null, props: { className: "t", children: "Hi" } }</pre>
<ul><li>Elements are cheap and <b>immutable</b>. React makes new ones on every render.</li>
<li>Lower-case tags become strings (<code>"h1"</code>); capitalised ones are your components (<code>App</code>).</li>
<li><code>key</code> and <code>ref</code> are taken out of the props.</li></ul>
<p class="tip">💡 In the Heap panel the element objects stay hidden (they are React's), but the narrator shows each <code>createElement</code> call.</p>`,
      { q: 'What does <code>console.log(el.props.children)</code> print?', options: ['Hello Ada', "[ 'Hello ', 'Ada' ]", 'undefined', 'an h1 element'], answer: 1, why: 'The text and the <code>{"Ada"}</code> expression are two separate children, so <code>children</code> is an array of two strings.' }),

    L('r-firstrender', '🌱', 'The first render', 'createRoot, mount, commit', 1,
      'Follow React from root.render() to the page: render phase, then commit.',
      `function Greeting({ name }) {
  console.log("render Greeting");
  return <p>Hello, {name}!</p>;
}

const root = ${ROOT};
root.render(<Greeting name="Ada" />);
console.log("render() returned");`,
      `<p><code>createRoot</code> creates a <b>FiberRoot</b> and the first fiber, the <b>HostRoot</b>. <code>root.render(el)</code> does <b>not</b> render: it adds an update and asks the scheduler to do the work in a new task.</p>
<p>Then React works in two phases:</p>
<ol><li><b>Render phase</b>: React calls your components and builds a tree of <b>fibers</b>. It creates DOM nodes, but keeps them <b>off-screen</b>. This phase can be paused.</li>
<li><b>Commit phase</b>: React puts everything on the page in one go. It never pauses here.</li></ol>
<p>Watch the ⚛️ React panel: the stages light up, and the Fibers tab shows the tree growing.</p>
<p class="tip">💡 That is why "render() returned" prints <b>before</b> "render Greeting": with <code>createRoot</code>, the first render happens in a later task.</p>`,
      { q: 'Which line is printed first?', options: ['render Greeting', 'render() returned', 'both at the same time', 'neither'], answer: 1, why: '<code>root.render</code> only schedules the work. The component runs later, in a task from React\'s scheduler.' }),

    L('r-fiber', '🌳', 'Fibers: child, sibling, return', 'The fiber tree', 2,
      'See how every component and element becomes a fiber, linked by child, sibling and return.',
      `function Title() { return <h1>Shop</h1>; }
function Item({ name }) { return <li>{name}</li>; }
function App() {
  return <main>
    <Title />
    <ul><Item name="Tea" /><Item name="Cake" /></ul>
  </main>;
}
${ROOT}.render(<App />);`,
      `<p>For each element React keeps a <b>fiber</b>: a long-lived object with the component's type, props, state (hooks) and pending work.</p>
<ul><li><code>child</code> → its first child, <code>sibling</code> → the next child of the same parent, <code>return</code> → its parent.</li>
<li>React walks this tree <b>depth-first</b> with a loop (no recursion): <code>beginWork</code> going down, <code>completeWork</code> coming back up.</li>
<li>Host fibers (<code>&lt;li&gt;</code>) own a DOM node; component fibers (<code>Item</code>) own hooks.</li></ul>
<pre>App → main → Title → h1
            ↘ ul → Item → li
                  ↘ Item → li</pre>
<p class="tip">💡 Look at the order of the "completeWork" steps: a parent completes only after all its children, so its DOM node can take its children's DOM nodes inside it.</p>`,
      { q: 'Which DOM element does React create first (in completeWork)?', options: ['<main>', '<ul>', '<h1> inside Title', 'the <li> for Cake'], answer: 2, why: 'Depth-first: React goes down App → main → Title → h1. The h1 has only text inside, so it is the first element to complete. <code>&lt;main&gt;</code> completes last, after all its children.' }),

    L('r-state', '🔢', 'useState and re-rendering', 'State updates', 1,
      'Click the button and watch the update travel: queue → render → commit.',
      `function Counter() {
  const [count, setCount] = React.useState(0);
  console.log("render with count =", count);
  return <button id="btn" onClick={() => setCount(count + 1)}>Clicked {count}</button>;
}
${ROOT}.render(<Counter />);
simulateClick("#btn", 10);
simulateClick("#btn", 20);`,
      `<p><code>useState</code> returns the current value and a <b>setter</b>. Calling the setter does not change the variable. It:</p>
<ol><li>puts an <b>update</b> in the hook's queue,</li>
<li>marks the fiber and its parents as having work (<b>lanes</b>),</li>
<li>schedules a render.</li></ol>
<p>In the next render, <code>Counter</code> runs again from the top. <code>useState</code> processes the queue and returns the <b>new</b> value. React compares the new elements with the old fibers and only changes the text node on the page.</p>
<p class="tip">⚠️ Each render has its own <code>count</code>. It is a constant inside that render, never changed in place.</p>`,
      { q: 'How many times is "render with count =" printed?', options: ['1', '2', '3', '4'], answer: 2, why: 'Once for the first render, then once after each of the two clicks.' }),

    L('r-batching', '📦', 'Batching', 'One render for many updates', 2,
      'Call setState three times in one click and see how many renders happen.',
      `function App() {
  const [a, setA] = React.useState(0);
  const [b, setB] = React.useState(0);
  console.log("render", a, b);
  return <button id="btn" onClick={() => {
    setA(1);
    setB(1);
    setA(2);
    console.log("handler done");
  }}>go</button>;
}
${ROOT}.render(<App />);
simulateClick("#btn", 10);`,
      `<p>React <b>batches</b> updates: all the setState calls made during one event are collected, and React renders <b>once</b> at the end.</p>
<ul><li>Updates from a click get the <b>Sync</b> lane. React renders them in a <b>microtask</b> right after the handler.</li>
<li>Since React 18 this also works inside <code>setTimeout</code>, promises and native event handlers (<b>automatic batching</b>).</li>
<li>Each hook applies its queued updates <b>in order</b>: <code>a</code> becomes 1, then 2.</li></ul>
<p class="tip">💡 Need the DOM updated right now, in the middle of a handler? <code>ReactDOM.flushSync(() => setX(1))</code> renders immediately (see its level).</p>`,
      { q: 'What does the second render print?', options: ['render 1 0', 'render 1 1', 'render 2 1', 'There are three more renders'], answer: 2, why: 'All three updates are batched into one render. The queue of <code>a</code> holds 1 then 2, so <code>a</code> ends at 2; <code>b</code> is 1.' }),

    L('r-updater', '🔁', 'Updater functions', 'setX(x => x + 1)', 2,
      'See why setCount(count + 1) three times adds only one.',
      `function App() {
  const [n, setN] = React.useState(0);
  const [m, setM] = React.useState(0);
  return <div>
    <button id="plain" onClick={() => { setN(n + 1); setN(n + 1); setN(n + 1); }}>n</button>
    <button id="fn" onClick={() => { setM(x => x + 1); setM(x => x + 1); setM(x => x + 1); }}>m</button>
    <p>{n} {m}</p>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#plain", 10);
simulateClick("#fn", 20);
setTimeout(() => console.log(document.querySelector("p").textContent), 50);`,
      `<p>Inside one render, <code>n</code> is a fixed value (a <b>snapshot</b>). <code>setN(n + 1)</code> three times queues "set to 1" three times.</p>
<p>An <b>updater function</b> is different: React calls it with the <b>latest</b> state while it processes the queue:</p>
<pre>queue: [x => x + 1, x => x + 1, x => x + 1]
0 → 1 → 2 → 3</pre>
<p class="tip">💡 Use the updater form whenever the new state depends on the old one, especially in timers and effects, where the variable may be stale.</p>`,
      { q: 'What is printed at the end?', options: ['3 3', '1 3', '1 1', '3 1'], answer: 1, why: 'The plain calls all compute 0 + 1, so n is 1. The updater functions chain, so m is 3.' }),

    L('r-reconcile', '⚖️', 'Reconciliation', 'Same type → update, new type → remount', 2,
      'Change an element type and see React throw away the old subtree and its state.',
      `function Counter() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => () => console.log("Counter unmounted"), []);
  return <b id="inc" onClick={() => setN(n + 1)}>count {n}</b>;
}
function App() {
  const [fancy, setFancy] = React.useState(false);
  return <main>
    {fancy ? <section><Counter /></section> : <div><Counter /></div>}
    <button id="swap" onClick={() => setFancy(!fancy)}>swap</button>
  </main>;
}
${ROOT}.render(<App />);
simulateClick("#inc", 10);
simulateClick("#swap", 20);
setTimeout(() => console.log(document.getElementById("inc").textContent), 50);`,
      `<p>After a render, React compares the new elements with the existing fibers, child by child. This is <b>reconciliation</b>:</p>
<ul><li><b>Same type, same key</b> → keep the fiber (and its DOM node and state); only update the props.</li>
<li><b>Different type</b> (<code>div</code> → <code>section</code>, or <code>A</code> → <code>B</code>) → delete the old fiber with everything below it, and create a new one.</li></ul>
<p>So the <code>Counter</code> inside the <code>&lt;div&gt;</code> loses its state when the wrapper becomes a <code>&lt;section&gt;</code>, even though it is "the same component".</p>
<p class="tip">⚠️ Never define a component inside another component: it becomes a new type on every render, so its state resets every time.</p>`,
      { q: 'What does the last line print?', options: ['count 1', 'count 0', 'count 2', 'an error'], answer: 1, why: 'The wrapper type changed, so React unmounted the old Counter (state 1) and mounted a new one with state 0.' }),

    L('r-keys', '🔑', 'Keys and moving items', 'key, lastPlacedIndex', 2,
      'Reorder a list and see React keep and move the same DOM nodes.',
      `function List() {
  const [items, setItems] = React.useState(["a", "b", "c"]);
  return <ul id="list" onClick={() => setItems(["c", "a", "b", "d"])}>
    {items.map(x => <li key={x}>{x}</li>)}
  </ul>;
}
${ROOT}.render(<List />);
let firstLi;
setTimeout(() => { firstLi = document.querySelector("li"); }, 5);
simulateClick("#list", 10);
setTimeout(() => {
  const lis = document.querySelectorAll("li");
  console.log(lis[1] === firstLi, lis.length);
}, 50);`,
      `<p>For a list, React matches old and new children by <b>key</b>. Same key and type → the same fiber and DOM node are kept, even if the item moved.</p>
<p>React walks the new list and remembers the last old position it kept in place (<code>lastPlacedIndex</code>):</p>
<ul><li><code>c</code> was at 2 → keep (lastPlacedIndex = 2)</li>
<li><code>a</code> was at 0 &lt; 2 → <b>move</b></li>
<li><code>b</code> was at 1 &lt; 2 → <b>move</b></li>
<li><code>d</code> is new → <b>create</b></li></ul>
<p class="tip">💡 Keys must be <b>stable and unique among siblings</b>: an id from your data, not <code>Math.random()</code> and usually not the index.</p>`,
      { q: 'What is printed?', options: ['false 4', 'true 4', 'true 3', 'false 3'], answer: 1, why: 'The <code>&lt;li&gt;</code> for "a" is the same DOM node, now in second place: React moved it instead of recreating it. There are 4 items.' }),

    L('r-indexkeys', '⚠️', 'The index-as-key bug', 'Why keys matter for state', 3,
      'Remove the first item when keys are indexes and see state stick to the wrong item.',
      `function Row({ label }) {
  const [note] = React.useState("note for " + label);
  return <li>{label}: {note}</li>;
}
function App() {
  const [rows, setRows] = React.useState(["Ada", "Linus"]);
  return <ul id="u" onClick={() => setRows(["Linus"])}>
    {rows.map((r, i) => <Row key={i} label={r} />)}
  </ul>;
}
${ROOT}.render(<App />);
simulateClick("#u", 10);
setTimeout(() => console.log(document.querySelector("li").textContent), 50);`,
      `<p>With <code>key={i}</code>, the key belongs to the <b>position</b>, not to the item. After removing "Ada":</p>
<ul><li>key 0 is still there → React keeps the first <code>Row</code> fiber, with <b>Ada's state</b>, and just gives it the new label "Linus".</li>
<li>key 1 is gone → React deletes the second fiber, the one that had Linus's state.</li></ul>
<p>The label is right, but the state is wrong. The same happens with inputs, focus, animations and effects.</p>
<p class="tip">✅ Fix: <code>key={r}</code> (or an id). Try it in the editor and run again.</p>`,
      { q: 'What does the remaining row show?', options: ['Linus: note for Linus', 'Linus: note for Ada', 'Ada: note for Ada', 'nothing'], answer: 1, why: 'The row with key 0 is reused: it keeps the state it was created with ("note for Ada") but gets the new label.' }),

    L('r-props', '🧬', 'Why did my child re-render?', 'Props, parents, bailouts', 2,
      'See that a parent render re-renders every child, even with the same props values.',
      `function Child({ label }) {
  console.log("render Child", label);
  return <span>{label}</span>;
}
function Parent() {
  const [n, setN] = React.useState(0);
  console.log("render Parent", n);
  return <div id="p" onClick={() => setN(n + 1)}>
    <Child label="same" />
  </div>;
}
${ROOT}.render(<Parent />);
simulateClick("#p", 10);`,
      `<p>When a component renders, it creates <b>new element objects</b> for its children, so every child gets a <b>new props object</b> (<code>{ label: "same" }</code> is a new object each time).</p>
<p>React's default check is <code>oldProps === newProps</code>, which is false, so the child renders too. Look at the narrator: <i>"renders because its parent re-rendered and passed a new props object"</i>.</p>
<ul><li>Components that did not re-render and have no update are <b>skipped</b> (a bailout).</li>
<li>To skip a child whose props are <i>equal</i>, wrap it in <code>React.memo</code> (next level).</li></ul>
<p class="tip">💡 Re-rendering is usually cheap: React still changes only what differs in the DOM. Measure before optimising.</p>`,
      { q: 'After the click, does Child render again?', options: ['No, its props are the same', 'Yes, because its parent rendered', 'Only if label changes', 'Only in development mode'], answer: 1, why: 'The parent creates a new props object for Child, and a plain component has no props comparison, so it renders again.' }),

    L('r-memo', '🧠', 'React.memo', 'Shallow props comparison', 2,
      'Wrap a child in memo and see React skip it while its props are shallowly equal.',
      `const Child = React.memo(function Child({ label, onPick }) {
  console.log("render Child");
  return <span onClick={onPick}>{label}</span>;
});
function Parent() {
  const [n, setN] = React.useState(0);
  const pick = React.useCallback(() => console.log("picked"), []);
  return <div>
    <button id="a" onClick={() => setN(n + 1)}>{n}</button>
    <Child label="tea" onPick={pick} />
    <Child label="cake" onPick={() => {}} />
  </div>;
}
${ROOT}.render(<Parent />);
simulateClick("#a", 10);`,
      `<p><code>React.memo(Component)</code> compares the old and new props <b>shallowly</b>: every prop with <code>Object.is</code>. If they are all equal (and the child has no update of its own), React skips it.</p>
<ul><li>The first child gets <code>pick</code> from <code>useCallback</code>: the <b>same function</b> each render → skipped.</li>
<li>The second child gets a new arrow function every render → props differ → it renders.</li></ul>
<p class="tip">⚠️ <code>memo</code> is useless if you pass new objects, arrays or functions each time. Keep them stable with <code>useMemo</code> / <code>useCallback</code>.</p>`,
      { q: 'How many times is "render Child" printed in total?', options: ['2', '3', '4', '1'], answer: 1, why: 'Both children render at mount (2). After the click only the second child renders, because its onPick prop is a new function (3).' }),

    L('r-context', '📡', 'Context', 'Provider, useContext, propagation', 3,
      'Change a context value and see it reach a reader even through a memo component.',
      `const Theme = React.createContext("light");
function Label() {
  const theme = React.useContext(Theme);
  console.log("render Label", theme);
  return <i>{theme}</i>;
}
const Panel = React.memo(function Panel() {
  console.log("render Panel");
  return <Label />;
});
function App() {
  const [theme, setTheme] = React.useState("light");
  return <Theme.Provider value={theme}>
    <button id="t" onClick={() => setTheme("dark")}>dark</button>
    <Panel />
  </Theme.Provider>;
}
${ROOT}.render(<App />);
simulateClick("#t", 10);`,
      `<p>A <code>Provider</code> gives a value to everything below it. <code>useContext</code> reads the value of the nearest Provider above.</p>
<p>When the value changes (by <code>Object.is</code>), React searches the subtree for components that read this context and gives them work in this render. They render even if a parent bailed out, like the memo <code>Panel</code> here.</p>
<p class="tip">⚠️ <code>value={{ user, setUser }}</code> creates a new object every render, so every reader re-renders. Wrap it in <code>useMemo</code>, or split the context.</p>`,
      { q: 'After the click, what is printed?', options: ['render Panel, render Label dark', 'render Label dark', 'nothing', 'render Panel'], answer: 1, why: 'Panel is memo and its props did not change, so it is skipped. Label reads the context, so React gives it work and it renders with "dark".' }),

    // ================================================================ Part R2 · Hooks & effects
    L('r-hookslist', '🔗', 'Hooks are a linked list', 'Rules of hooks', 2,
      'See each hook stored by its call order, and what happens when the order changes.',
      `function Form() {
  const [name, setName] = React.useState("Ada");
  if (name === "Ada") {
    React.useState("only sometimes");
  }
  const [age] = React.useState(36);
  console.log(name, age);
  return <button id="b" onClick={() => setName("Bob")}>{name}</button>;
}
${ROOT}.render(<Form />);
simulateClick("#b", 10);`,
      `<p>A component's hooks are kept on its fiber as a <b>linked list</b>: <code>memoizedState → hook 1 → hook 2 → …</code>. React has no names for them, only the <b>order</b> they are called in.</p>
<p>On every render, React walks the list in step with your calls: the first <code>useState</code> gets the first hook, and so on. If a hook is skipped, every later hook gets someone else's state, or React notices that the count changed and throws.</p>
<p>The rules of hooks follow from this: call hooks <b>at the top level</b>, never inside conditions, loops or after an early return.</p>
<p class="tip">💡 Open the React panel → <b>Hooks</b> tab to see the list for each component.</p>`,
      { q: 'What happens after the click?', options: ['It prints "Bob 36"', 'age gets the wrong hook (it prints "Bob only sometimes"), then React throws an error', 'React skips the missing hook and it works', 'Nothing happens'], answer: 1, why: 'The second render skips a hook, so <code>age</code> reads hook #1, which belongs to "only sometimes". When the component returns, React sees 2 hooks instead of 3 and throws "Rendered fewer hooks than expected".' }),

    L('r-effect', '⏱️', 'useEffect', 'After paint, dependencies', 2,
      'See when an effect runs, and how dependencies decide whether it runs again.',
      `function App() {
  const [count, setCount] = React.useState(0);
  const [other, setOther] = React.useState(0);
  React.useEffect(() => {
    console.log("effect: count is", count);
  }, [count]);
  console.log("render", count, other);
  return <div>
    <button id="c" onClick={() => setCount(count + 1)}>count</button>
    <button id="o" onClick={() => setOther(other + 1)}>other</button>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#c", 10);
simulateClick("#o", 20);`,
      `<p><code>useEffect(fn, deps)</code> runs <code>fn</code> <b>after</b> React has committed and the browser had a chance to paint. React schedules all effects for later (a passive effects task).</p>
<ul><li>No deps array → after every render.</li>
<li><code>[]</code> → only after the first render (mount).</li>
<li><code>[count]</code> → when <code>count</code> changed since the last render (compared with <code>Object.is</code>).</li></ul>
<p>Effects are for <b>syncing with the outside world</b>: subscriptions, timers, fetching, manual DOM work. Not for computing values from props or state (do that during render).</p>`,
      { q: 'How many times does the effect run?', options: ['1', '2', '3', '0'], answer: 1, why: 'After mount (count 0) and after the count click (count 1). The "other" click changes no dependency, so the effect is skipped.' }),

    L('r-cleanup', '🧹', 'Effect cleanup', 'Order of cleanups', 2,
      'See the previous effect clean up before the next one runs, and on unmount.',
      `function Clock({ city }) {
  React.useEffect(() => {
    console.log("subscribe", city);
    return () => console.log("unsubscribe", city);
  }, [city]);
  return <p>{city}</p>;
}
function App() {
  const [city, setCity] = React.useState("Paris");
  const [show, setShow] = React.useState(true);
  return <div>
    <button id="c" onClick={() => setCity("Tokyo")}>Tokyo</button>
    <button id="h" onClick={() => setShow(false)}>hide</button>
    {show && <Clock city={city} />}
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#c", 10);
simulateClick("#h", 20);`,
      `<p>An effect can return a <b>cleanup</b> function. React calls it:</p>
<ul><li><b>before running the effect again</b> (with the old values: the closure of the old render),</li>
<li>and when the component is <b>removed</b> (unmount).</li></ul>
<p>Within one commit, React first runs <b>all</b> cleanups, then <b>all</b> new effects.</p>
<p class="tip">⚠️ Forgetting a cleanup leaks subscriptions and timers. In development, React 18 Strict Mode mounts, unmounts and mounts again to help you find this.</p>`,
      { q: 'What is printed, in order?', options: ['subscribe Paris, subscribe Tokyo, unsubscribe Tokyo', 'subscribe Paris, unsubscribe Paris, subscribe Tokyo, unsubscribe Tokyo', 'subscribe Paris, unsubscribe Tokyo, subscribe Tokyo', 'subscribe Paris, subscribe Tokyo'], answer: 1, why: 'The city change cleans up the Paris effect first (its cleanup still sees "Paris"), then runs the new one. Hiding unmounts Clock, so the Tokyo cleanup runs.' }),

    L('r-layout', '📐', 'useLayoutEffect vs useEffect', 'Commit sub-phases', 3,
      'Compare the timing of layout effects, effects, microtasks and timers.',
      `function Box() {
  React.useLayoutEffect(() => console.log("layout effect (before paint)"));
  React.useEffect(() => console.log("effect (after paint)"));
  console.log("render");
  return <div>box</div>;
}
const root = ${ROOT};
ReactDOM.flushSync(() => root.render(<Box />));
console.log("after flushSync");
Promise.resolve().then(() => console.log("microtask"));
setTimeout(() => console.log("timeout"), 0);`,
      `<p>The commit phase has three parts:</p>
<ol><li><b>Mutation</b>: React changes the DOM.</li>
<li><b>Layout</b>: <code>useLayoutEffect</code> callbacks and refs run, <b>synchronously</b>, before the browser can paint. Good for measuring the DOM and fixing it without a flicker.</li>
<li><b>Passive</b>: <code>useEffect</code> callbacks run later, in a separate task.</li></ol>
<p>Children's effects run before their parent's.</p>
<p class="tip">💡 Prefer <code>useEffect</code>. Layout effects block painting, so use them only when the user would otherwise see a jump.</p>`,
      { q: 'Which comes right after "render"?', options: ['effect (after paint)', 'layout effect (before paint)', 'after flushSync', 'microtask'], answer: 1, why: 'flushSync renders and commits immediately; layout effects run during the commit, before flushSync returns. useEffect waits for a later task.' }),

    L('r-ref', '📌', 'useRef', 'Mutable box, DOM refs', 2,
      'Count renders without causing renders, and reach a DOM node with ref.',
      `function App() {
  const [text, setText] = React.useState("");
  const renders = React.useRef(0);
  const box = React.useRef(null);
  renders.current++;
  React.useEffect(() => {
    console.log("renders:", renders.current, "box:", box.current.tagName);
  });
  return <div>
    <input id="i" ref={box} value={text} onChange={e => setText(e.target.value)} />
  </div>;
}
${ROOT}.render(<App />);
simulateTyping("#i", "hi", 10);`,
      `<p><code>useRef(initial)</code> returns the <b>same object</b> <code>{ current }</code> on every render. Changing <code>.current</code> does <b>not</b> trigger a render.</p>
<ul><li>Use it for values that must survive renders but are not shown: timer ids, previous values, counters.</li>
<li>Pass it as <code>ref</code> to an element and React sets <code>ref.current</code> to the DOM node during the commit (and back to <code>null</code> when it is removed).</li></ul>
<p class="tip">⚠️ Do not read or write <code>ref.current</code> during render for things you display: the screen will not update.</p>`,
      { q: 'What does the last effect print?', options: ['renders: 1 box: INPUT', 'renders: 2 box: INPUT', 'renders: 3 box: INPUT', 'box is null'], answer: 1, why: 'One render at mount, one after typing "hi" (one input event). The ref points to the input element.' }),

    L('r-memohooks', '💾', 'useMemo and useCallback', 'Caching between renders', 2,
      'See a slow calculation skipped while its dependencies stay the same.',
      `function slowSquare(n) { console.log("computing", n); return n * n; }
function App() {
  const [n, setN] = React.useState(3);
  const [dark, setDark] = React.useState(false);
  const square = React.useMemo(() => slowSquare(n), [n]);
  const onSave = React.useCallback(() => console.log(n), [n]);
  return <div>
    <p>{square}</p>
    <button id="theme" onClick={() => setDark(!dark)}>theme</button>
    <button id="inc" onClick={() => setN(n + 1)}>+1</button>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#theme", 10);
simulateClick("#inc", 20);`,
      `<p><code>useMemo(fn, deps)</code> stores the result of <code>fn</code> on the hook and returns the saved value while the deps are equal. <code>useCallback(fn, deps)</code> is the same thing for a function: <code>useMemo(() => fn, deps)</code>.</p>
<ul><li>Use them for <b>expensive</b> calculations, or to keep an object or function <b>identity</b> stable for <code>memo</code> children and effect deps.</li>
<li>They are a performance hint, not a guarantee: the cache is per component instance.</li></ul>
<p class="tip">💡 The narrator shows <i>"same dependencies, so React returns the value saved last time"</i> on a hit.</p>`,
      { q: 'How many times is "computing" printed?', options: ['1', '2', '3', '0'], answer: 1, why: 'At mount (3) and after the +1 click (4). The theme click changes no dependency, so the saved value is returned.' }),

    L('r-reducer', '🎛️', 'useReducer', 'Actions and reducers', 2,
      'Manage related state with a reducer and dispatch actions.',
      `function reducer(state, action) {
  switch (action.type) {
    case "add": return { ...state, items: [...state.items, action.item] };
    case "clear": return { ...state, items: [] };
    default: return state;
  }
}
function Cart() {
  const [state, dispatch] = React.useReducer(reducer, { items: [] });
  console.log("items:", state.items.join(",") || "none");
  return <div>
    <button id="add" onClick={() => { dispatch({ type: "add", item: "tea" }); dispatch({ type: "add", item: "cake" }); }}>add</button>
    <button id="clr" onClick={() => dispatch({ type: "clear" })}>clear</button>
  </div>;
}
${ROOT}.render(<Cart />);
simulateClick("#add", 10);
simulateClick("#clr", 20);`,
      `<p><code>useReducer(reducer, initial)</code> is <code>useState</code> with the update logic moved into one pure function: <code>(state, action) => newState</code>.</p>
<ul><li><code>dispatch(action)</code> queues the action, exactly like a setState update. Dispatches in one event are batched.</li>
<li>During the render, React runs the reducer once per queued action, in order.</li>
<li>The reducer must be <b>pure</b> and return a <b>new</b> object; mutating the old one would make React think nothing changed.</li></ul>`,
      { q: 'What does the second render print?', options: ['items: tea', 'items: tea,cake', 'items: cake', 'items: none'], answer: 1, why: 'Both dispatches are batched into one render; the reducer runs twice in order, so both items are added.' }),

    L('r-stale', '🕰️', 'Stale closures', 'Effects that capture old state', 3,
      'See a timer callback read an old value, and fix it with an updater.',
      `function Timer() {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    setTimeout(() => {
      console.log("timer sees count =", count);
      setCount(c => c + 1);
    }, 30);
  }, []);
  return <button id="b" onClick={() => setCount(count + 10)}>{count}</button>;
}
${ROOT}.render(<Timer />);
simulateClick("#b", 10);
setTimeout(() => console.log("final:", document.getElementById("b").textContent), 100);`,
      `<p>Every render creates new functions, and each one closes over the variables of <b>its</b> render. The effect above runs only once (deps <code>[]</code>), so its timer callback belongs to the <b>first</b> render, where <code>count</code> is 0, forever.</p>
<ul><li>Reading state in a long-lived callback gives you the old value: a <b>stale closure</b>.</li>
<li>Updater functions (<code>setCount(c => c + 1)</code>) always get the latest state, so the update is still correct.</li>
<li>Other fixes: put the value in the deps, or keep the latest value in a ref.</li></ul>`,
      { q: 'What does the timer print, and what is final?', options: ['count = 10, final: 11', 'count = 0, final: 11', 'count = 0, final: 1', 'count = 10, final: 1'], answer: 1, why: 'The timer belongs to the first render, so it sees 0. The updater function uses the latest state, 10, so final is 11.' }),

    L('r-controlled', '⌨️', 'Controlled inputs', 'value + onChange', 2,
      'Let React own an input value, and transform it as the user types.',
      `function Form() {
  const [name, setName] = React.useState("");
  return <form>
    <input id="name" value={name} onChange={e => setName(e.target.value.toUpperCase())} />
    <p>Hello, {name || "stranger"}</p>
  </form>;
}
${ROOT}.render(<Form />);
simulateTyping("#name", "ada", 10);
setTimeout(() => console.log(document.getElementById("name").value, "|", document.querySelector("p").textContent), 50);`,
      `<p>A <b>controlled</b> input gets its <code>value</code> from state, and <code>onChange</code> writes the state. React is the single source of truth:</p>
<ol><li>The user types → the browser fires an input event → React's root listener calls your <code>onChange</code>.</li>
<li><code>setName</code> queues a Sync update; React re-renders right after the event.</li>
<li>The commit writes the new <code>value</code> into the DOM input.</li></ol>
<p class="tip">💡 In React, <code>onChange</code> fires on every keystroke (like the DOM's <code>input</code> event), not only when the field loses focus.</p>`,
      { q: 'What is printed?', options: ['ada | Hello, ada', 'ADA | Hello, ADA', 'ada | Hello, ADA', ' | Hello, stranger'], answer: 1, why: 'The state stores the upper-cased text, and the commit writes it back into the input, so both show ADA.' }),

    L('r-lifting', '⬆️', 'Lifting state up', 'Shared state, props down, events up', 2,
      'Share state between two siblings by moving it to their parent.',
      `function Celsius({ value, onChange }) {
  return <input id="c" value={value} onChange={e => onChange(Number(e.target.value))} />;
}
function Fahrenheit({ celsius }) {
  return <p>{celsius * 9 / 5 + 32} °F</p>;
}
function App() {
  const [c, setC] = React.useState(0);
  return <div>
    <Celsius value={c} onChange={setC} />
    <Fahrenheit celsius={c} />
  </div>;
}
${ROOT}.render(<App />);
simulateTyping("#c", "100", 10);
setTimeout(() => console.log(document.querySelector("p").textContent), 50);`,
      `<p>Data flows <b>down</b> through props; events flow <b>up</b> through callbacks. When two components need the same state, move it to their closest common parent and pass it down.</p>
<ul><li><code>App</code> owns <code>c</code>; <code>Celsius</code> gets the value and a function to change it.</li>
<li>One update in <code>App</code> re-renders both children with the new value.</li></ul>
<p class="tip">💡 Keep state as low as possible, but as high as needed. If many distant components need it, use context or a store.</p>`,
      { q: 'What is printed?', options: ['32 °F', '212 °F', '100 °F', '0 °F'], answer: 1, why: '100 °C × 9 / 5 + 32 = 212 °F. The state lives in App, so the sibling sees the new value.' }),

    // ================================================================ Part R3 · Scheduling & the commit
    L('r-lanes', '🚦', 'Lanes and priorities', 'Sync, Default, Transition', 3,
      'Compare an update from a click (Sync) with one from a timer (Default).',
      `function App() {
  const [n, setN] = React.useState(0);
  console.log("render", n);
  return <button id="b" onClick={() => {
    setN(1);
    Promise.resolve().then(() => console.log("microtask after click"));
  }}>{n}</button>;
}
const root = ${ROOT};
root.render(<App />);
simulateClick("#b", 10);
setTimeout(() => {
  root.render(<App />);
  console.log("timer: render scheduled");
}, 20);`,
      `<p>Every update gets a <b>lane</b>: a bit that says how urgent it is. Lower bits win.</p>
<ul><li><b>Sync</b> (1): discrete events such as clicks and key presses. React renders in a microtask right after the event.</li>
<li><b>Default</b> (16): updates outside events, such as <code>root.render</code> or a timer. React renders in a new task from its scheduler.</li>
<li><b>Transition</b> (64): <code>startTransition</code> updates. They can be split into time slices and interrupted.</li></ul>
<p>Watch the ● marks on fibers in the React panel: they are the pending lanes, and <code>childLanes</code> show that work is waiting further down.</p>`,
      { q: 'After the click, which prints first?', options: ['render 1', 'microtask after click', 'they never print', 'timer: render scheduled'], answer: 0, why: 'React queued its Sync render as a microtask first (during setN), so it runs before the promise callback that was queued after it.' }),

    L('r-transition', '🐢', 'startTransition', 'Time slicing and interruption', 3,
      'Type twice while a slow list renders and see React drop the stale work.',
      `function App() {
  const [text, setText] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [isPending, startTransition] = React.useTransition();
  function onChange(e) {
    const v = e.target.value;
    setText(v);                                   // urgent
    startTransition(() => setItems([1, 2, 3, 4, 5, 6].map(i => v + i)));  // can wait
  }
  return <div>
    <input id="q" value={text} onChange={onChange} />
    <p>{isPending ? "updating…" : "ready"}</p>
    <ul>{items.map(x => <li key={x}>{x}</li>)}</ul>
  </div>;
}
${ROOT}.render(<App />);
simulateTyping("#q", "a", 10);
simulateTyping("#q", "ab", 13);
setTimeout(() => console.log(document.querySelectorAll("li").length, document.querySelector("li").textContent), 200);`,
      `<p>Updates inside <code>startTransition</code> get the <b>Transition</b> lane. React renders them <b>concurrently</b>:</p>
<ul><li>It works in small <b>time slices</b> and yields to the browser between them, so typing stays responsive.</li>
<li>If an urgent update arrives while a transition is paused, React <b>throws away</b> the unfinished work-in-progress tree, renders the urgent update, then starts the transition again with the newest data.</li>
<li><code>isPending</code> is true while the transition waits.</li></ul>
<p class="tip">💡 Look for "⏸️ Time slice used up" and "Interrupted!" steps in the timeline. The page never shows a half-built list, because the commit is all-or-nothing.</p>`,
      { q: 'What is printed at the end?', options: ['6 a1', '6 ab1', '12 a1', '0'], answer: 1, why: 'The "a" transition was interrupted and thrown away; only the latest transition ("ab") is committed.' }),

    L('r-events', '🖱️', 'Event delegation', 'Root listener, synthetic events', 2,
      'See one listener on the root handle clicks for every element.',
      `function App() {
  return <div onClick={() => console.log("div")}>
    <button id="a" onClick={() => console.log("button a")}>A</button>
    <button id="b" onClick={e => { console.log("button b"); e.stopPropagation(); }}>B</button>
  </div>;
}
const container = document.getElementById("root");
ReactDOM.createRoot(container).render(<App />);
container.addEventListener("click", () => console.log("native listener on root"));
simulateClick("#a", 10);
simulateClick("#b", 20);`,
      `<p>React does not add a listener to each element. <code>createRoot</code> adds <b>one listener per event type</b> on the root container. When an event arrives, React:</p>
<ol><li>looks at <code>event.target</code> and walks up the <b>fiber</b> tree to the root,</li>
<li>collects the <code>onClick</code> props it finds on the way,</li>
<li>calls them from the deepest one up, with a <b>synthetic event</b> object that wraps the native one.</li></ol>
<p><code>e.stopPropagation()</code> stops the React handlers above. The native event has already reached the root, because that is where React listens.</p>`,
      { q: 'What is printed for the click on B?', options: ['button b, div', 'button b', 'button b, native listener on root', 'native listener on root, button b'], answer: 2, why: 'React handles the event on the root and stops at B because of stopPropagation, so the div handler does not run. The native root listener was added after React\'s, so it runs too, after React: "button b" then "native listener on root".' }),

    L('r-commit', '🔁', 'Double buffering and the commit', 'current, alternate, swap', 3,
      'Watch React build a second tree and swap it in with one assignment.',
      `function Row({ text }) { return <li>{text}</li>; }
function App() {
  const [rows, setRows] = React.useState(["one"]);
  return <ul id="u" onClick={() => setRows(["one", "two"])}>
    {rows.map(r => <Row key={r} text={r} />)}
  </ul>;
}
${ROOT}.render(<App />);
simulateClick("#u", 10);
setTimeout(() => console.log(document.getElementById("u").children.length), 50);`,
      `<p>React keeps up to <b>two</b> fibers for every component: the <b>current</b> one (what is on screen) and the <b>work-in-progress</b> one being built. They point to each other through <code>alternate</code>.</p>
<ul><li>A render clones current fibers into the work-in-progress tree, reusing the old alternates.</li>
<li>Changes are marked with <b>flags</b>: <code>Placement</code>, <code>Update</code>, <code>ChildDeletion</code>, <code>Passive</code>.</li>
<li>The commit applies the flags, then does <code>root.current = finishedWork</code>. One pointer swap, and the new tree is the current one.</li></ul>
<p class="tip">💡 Switch the Fibers tab between <b>current</b> and <b>work-in-progress</b> during a render to see both trees.</p>`,
      { q: 'Which flag does the new "two" row get?', options: ['Update', 'Placement', 'ChildDeletion', 'Passive'], answer: 1, why: 'It is a new fiber whose DOM node must be inserted, so it gets the Placement flag. The printed number is 2.' }),

    L('r-flushsync', '⚡', 'flushSync', 'Render right now', 3,
      'Force React to render inside a handler so you can read the new DOM.',
      `function Chat() {
  const [msgs, setMsgs] = React.useState(["hi"]);
  return <div>
    <ul id="list">{msgs.map(m => <li key={m}>{m}</li>)}</ul>
    <button id="send" onClick={() => {
      setMsgs(ms => [...ms, "batched"]);
      console.log("without flushSync:", document.getElementById("list").children.length);
      ReactDOM.flushSync(() => setMsgs(ms => [...ms, "flushed"]));
      console.log("with flushSync:", document.getElementById("list").children.length);
    }}>send</button>
  </div>;
}
${ROOT}.render(<Chat />);
simulateClick("#send", 10);`,
      `<p>Normally React renders <i>after</i> your handler, so the DOM still shows the old state while it runs. <code>ReactDOM.flushSync(fn)</code> runs <code>fn</code> and then renders and commits <b>immediately</b>, together with any updates already waiting.</p>
<p>Use it rarely: for example, to scroll to a new message or to measure the DOM right after a change.</p>
<p class="tip">⚠️ flushSync gives up batching and can hurt performance. It cannot be called during a render.</p>`,
      { q: 'What do the two logs print?', options: ['1 and 2', '1 and 3', '2 and 3', '3 and 3'], answer: 1, why: 'The first update is still waiting, so the list has 1 item. flushSync renders both waiting updates at once: 3 items.' }),

    L('r-unmount', '🚪', 'Conditional rendering and unmount', 'Deletion, cleanup, state loss', 2,
      'Hide and show a component and see its state disappear with it.',
      `function Panel() {
  const [opened, setOpened] = React.useState(0);
  React.useEffect(() => {
    console.log("mount");
    return () => console.log("unmount");
  }, []);
  return <b id="p" onClick={() => setOpened(opened + 1)}>clicked {opened}</b>;
}
function App() {
  const [show, setShow] = React.useState(true);
  return <div>
    <button id="t" onClick={() => setShow(!show)}>toggle</button>
    {show ? <Panel /> : null}
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#p", 10);
simulateClick("#t", 20);
simulateClick("#t", 30);
setTimeout(() => console.log(document.getElementById("p").textContent), 60);`,
      `<p><code>{show ? &lt;Panel /&gt; : null}</code>: when the element disappears, reconciliation finds no match for the old fiber and marks it for <b>deletion</b> (<code>ChildDeletion</code> on the parent).</p>
<ul><li>In the commit, React removes its DOM nodes and runs every effect cleanup inside it.</li>
<li>Its fiber, and with it all its state, is gone. Showing it again <b>mounts</b> a brand-new one.</li></ul>
<p class="tip">💡 To keep state while hiding, keep the component mounted and hide it with CSS, or move the state up.</p>`,
      { q: 'What is printed at the end?', options: ['clicked 1', 'clicked 0', 'nothing, Panel is hidden', 'clicked 2'], answer: 1, why: 'Hiding unmounted Panel and lost its state; showing it again mounted a new Panel with 0.' }),

    L('r-customhook', '🪝', 'Custom hooks', 'Reusing stateful logic', 2,
      'Write useToggle and see that every component gets its own state.',
      `function useToggle(initial) {
  const [on, setOn] = React.useState(initial);
  const toggle = React.useCallback(() => setOn(v => !v), []);
  return [on, toggle];
}
function Switch({ id }) {
  const [on, toggle] = useToggle(false);
  return <button id={id} onClick={toggle}>{on ? "ON" : "off"}</button>;
}
function App() {
  return <div><Switch id="s1" /><Switch id="s2" /></div>;
}
${ROOT}.render(<App />);
simulateClick("#s1", 10);
setTimeout(() => console.log(document.getElementById("s1").textContent, document.getElementById("s2").textContent), 50);`,
      `<p>A custom hook is a plain function whose name starts with <code>use</code> and that calls other hooks. There is no magic: its hooks are simply added to the hook list of the <b>component that calls it</b>.</p>
<ul><li>Each component that calls <code>useToggle</code> gets its <b>own</b> state.</li>
<li>Custom hooks share <b>logic</b>, not state. To share state, lift it up or use context.</li></ul>
<p class="tip">💡 In the Hooks tab, <code>Switch</code> shows <code>useState → useCallback</code>: the hooks from inside <code>useToggle</code>.</p>`,
      { q: 'What is printed?', options: ['ON ON', 'ON off', 'off ON', 'off off'], answer: 1, why: 'Each Switch has its own useState inside useToggle; only the first one was clicked.' }),

    L('r-todo', '✅', 'A whole app: todo list', 'Everything together', 3,
      'Follow a small app through add, toggle and remove, with keys, effects and memo.',
      `const Item = React.memo(function Item({ todo, onToggle, onRemove }) {
  return <li className={todo.done ? "done" : ""}>
    <span id={"t" + todo.id} onClick={() => onToggle(todo.id)}>{todo.text}</span>
    <button id={"x" + todo.id} onClick={() => onRemove(todo.id)}>✕</button>
  </li>;
});
function App() {
  const [todos, setTodos] = React.useState([{ id: 1, text: "Learn fibers", done: false }]);
  const [text, setText] = React.useState("");
  const left = todos.filter(t => !t.done).length;
  React.useEffect(() => { document.title = left + " left"; }, [left]);
  const onToggle = React.useCallback(id => setTodos(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t)), []);
  const onRemove = React.useCallback(id => setTodos(ts => ts.filter(t => t.id !== id)), []);
  return <div>
    <input id="new" value={text} onChange={e => setText(e.target.value)} />
    <button id="add" onClick={() => { setTodos(ts => [...ts, { id: ts.length + 1, text, done: false }]); setText(""); }}>add</button>
    <ul>{todos.map(t => <Item key={t.id} todo={t} onToggle={onToggle} onRemove={onRemove} />)}</ul>
    <p>{left} left</p>
  </div>;
}
${ROOT}.render(<App />);
simulateTyping("#new", "Learn hooks", 10);
simulateClick("#add", 20);
simulateClick("#t1", 30);
simulateClick("#x2", 40);
setTimeout(() => console.log(document.title, "|", document.querySelector("ul").textContent), 80);`,
      `<p>This level puts the pieces together. Things to watch:</p>
<ul><li><b>Controlled input</b>: every keystroke is a Sync update.</li>
<li><b>Updater functions</b> in the callbacks, so <code>useCallback(…, [])</code> can stay stable without stale state.</li>
<li><code>memo(Item)</code>: when one todo changes, only that item renders; the others keep the same <code>todo</code> object and bail out.</li>
<li><b>Keys</b> by id: removing an item deletes exactly that fiber.</li>
<li>The <b>effect</b> runs only when the number of open todos changes.</li></ul>`,
      { q: 'What is printed at the end?', options: ['1 left | Learn fibers✕', '0 left | Learn fibers✕', '1 left | Learn hooks✕', '0 left | '], answer: 1, why: '"Learn hooks" was added then removed, and "Learn fibers" was toggled to done, so 0 are left and only "Learn fibers" stays.' }),

    // ================================================================ Part R4 · Classes, errors & Suspense
    L('r-class', '🏛️', 'Class components and lifecycles', 'constructor, render, didMount, didUpdate, willUnmount', 2,
      'Follow a class component through mount, update and unmount, and see every lifecycle method in order.',
      `class Clock extends React.Component {
  constructor(props) {
    super(props);
    this.state = { ticks: 0 };
    console.log("1. constructor");
  }
  componentDidMount() { console.log("3. componentDidMount"); }
  componentDidUpdate(prevProps, prevState) { console.log("componentDidUpdate:", prevState.ticks, "->", this.state.ticks); }
  componentWillUnmount() { console.log("componentWillUnmount"); }
  render() {
    console.log("2. render", this.state.ticks);
    return <b id="t" onClick={() => this.setState({ ticks: this.state.ticks + 1 })}>{this.state.ticks}</b>;
  }
}
function App() {
  const [on, setOn] = React.useState(true);
  return <div><button id="off" onClick={() => setOn(false)}>remove</button>{on && <Clock />}</div>;
}
${ROOT}.render(<App />);
simulateClick("#t", 10);
simulateClick("#off", 20);`,
      `<p>A class component extends <code>React.Component</code>. React creates it with <code>new</code> once, keeps the <b>instance</b> on the fiber (<code>fiber.stateNode</code>) and calls its methods:</p>
<ul><li><b>Mount</b>: <code>constructor</code> → <code>static getDerivedStateFromProps</code> → <code>render</code> → (DOM) → <code>componentDidMount</code></li>
<li><b>Update</b>: <code>getDerivedStateFromProps</code> → <code>shouldComponentUpdate</code> → <code>render</code> → <code>getSnapshotBeforeUpdate</code> → (DOM) → <code>componentDidUpdate(prevProps, prevState, snapshot)</code></li>
<li><b>Unmount</b>: <code>componentWillUnmount</code></li></ul>
<p>The <code>Did</code> methods run in the commit's layout phase, like <code>useLayoutEffect</code>.</p>
<table class="mini"><tr><td><code>componentDidMount</code></td><td>≈ <code>useEffect(fn, [])</code></td></tr><tr><td><code>componentDidUpdate</code></td><td>≈ <code>useEffect(fn, [deps])</code></td></tr><tr><td><code>componentWillUnmount</code></td><td>≈ the cleanup function</td></tr></table>
<p class="tip">💡 New code uses function components. You still meet classes in older codebases and in error boundaries.</p>`,
      { q: 'What is printed after the click?', options: ['componentDidUpdate: 0 -> 1, then 2. render 1', '2. render 1, then componentDidUpdate: 0 -> 1', 'only 2. render 1', 'componentDidMount again'], answer: 1, why: 'render runs in the render phase; componentDidUpdate runs after the DOM is updated, with the previous state (0) as an argument.' }),

    L('r-classstate', '🧮', 'this.setState: merge, batching, callbacks', 'setState, PureComponent, shouldComponentUpdate', 2,
      'See setState merge objects, batch, run its callback, and how PureComponent skips renders.',
      `class Profile extends React.Component {
  state = { name: "Ada", age: 36 };
  birthday = () => {
    this.setState({ age: this.state.age + 1 });
    this.setState(s => ({ age: s.age + 1 }), () => console.log("callback sees", this.state.age));
    console.log("right after setState:", this.state.age);
  };
  render() {
    console.log("render", this.state.name, this.state.age);
    return <div><button id="b" onClick={this.birthday}>birthday</button><Badge label="VIP" /></div>;
  }
}
class Badge extends React.PureComponent {
  render() { console.log("Badge render"); return <i>{this.props.label}</i>; }
}
${ROOT}.render(<Profile />);
simulateClick("#b", 10);`,
      `<ul><li><code>this.setState(partial)</code> <b>merges</b> the object into the state (only one level deep). <code>useState</code> setters replace the value instead.</li>
<li>It is queued and batched like hooks: <code>this.state</code> is still the old value right after the call.</li>
<li>The updater form <code>setState(s => …)</code> gets the latest state; the second argument is a <b>callback</b> that runs after the commit.</li>
<li><code>shouldComponentUpdate(nextProps, nextState)</code> can return <code>false</code> to skip a render. <code>PureComponent</code> does it for you with a shallow comparison, like <code>React.memo</code>.</li></ul>
<p class="tip">⚠️ Methods passed as handlers lose <code>this</code>. Use an arrow function class field (<code>birthday = () => …</code>) or <code>bind</code> in the constructor.</p>`,
      { q: 'What is the age in the second render?', options: ['37', '38', '36', '39'], answer: 1, why: 'The object update sets 37 (36 + 1), then the updater runs on the latest state: 38. Both are batched into one render.' }),

    L('r-boundary', '🛡️', 'Error boundaries', 'getDerivedStateFromError, componentDidCatch', 2,
      'Make a component crash while rendering and catch it with an error boundary.',
      `class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.log("logged:", error.message); }
  render() {
    if (this.state.error) return <p id="msg">Something went wrong: {this.state.error.message}</p>;
    return this.props.children;
  }
}
function Price({ value }) {
  if (value < 0) throw new Error("negative price");
  return <b>{value} €</b>;
}
function Shop() {
  const [price, setPrice] = React.useState(10);
  return <div>
    <button id="bad" onClick={() => setPrice(-1)}>break it</button>
    <ErrorBoundary><Price value={price} /></ErrorBoundary>
    <p>the rest of the page still works</p>
  </div>;
}
${ROOT}.render(<Shop />);
simulateClick("#bad", 10);
setTimeout(() => console.log(document.getElementById("root").textContent), 50);`,
      `<p>When a component throws while <b>rendering</b>, React looks up the tree for the nearest <b>error boundary</b>: a class component with</p>
<ul><li><code>static getDerivedStateFromError(error)</code> → returns new state, so the boundary renders a fallback UI,</li>
<li>and/or <code>componentDidCatch(error, info)</code> → runs in the commit; use it to log the error and <code>info.componentStack</code>.</li></ul>
<p>React throws away the unfinished work below the boundary and renders the boundary again with the error. The rest of the app keeps working.</p>
<p><b>Not caught</b>: errors in event handlers, timers and promises (use <code>try/catch</code>), and errors in the boundary itself. With <b>no</b> boundary, React 18 removes the whole app from the page.</p>
<p class="tip">💡 There is no hook for this: error boundaries are the one thing that still needs a class (or a library like <code>react-error-boundary</code>).</p>`,
      { q: 'What does the page say at the end?', options: ['nothing, the app is gone', 'break itSomething went wrong: negative pricethe rest of the page still works', 'break it-1 €the rest of the page still works', 'an uncaught error'], answer: 1, why: 'The boundary catches the render error and shows its fallback. The button and the paragraph outside the boundary are untouched.' }),

    L('r-suspense', '⏳', 'Suspense and use()', 'Suspending, fallbacks, retries', 3,
      'Read a Promise with use() and watch Suspense show a fallback until the data arrives.',
      `function fetchUser() {
  return new Promise(resolve => setTimeout(() => resolve({ name: "Ada" }), 40));
}
const userPromise = fetchUser(); // created once, outside the component

function User() {
  const user = React.use(userPromise);   // suspends until the promise resolves
  return <h2>Hello {user.name}</h2>;
}
function App() {
  return <React.Suspense fallback={<p>Loading…</p>}>
    <User />
  </React.Suspense>;
}
${ROOT}.render(<App />);
setTimeout(() => console.log(document.getElementById("root").innerHTML), 20);
setTimeout(() => console.log(document.getElementById("root").innerHTML), 100);`,
      `<p>A component <b>suspends</b> by throwing a Promise during render. <code>use(promise)</code> (React 19) does this for you: it returns the value if the promise is done, otherwise it throws it.</p>
<ol><li>React catches the promise, goes up to the nearest <code>&lt;Suspense&gt;</code> and renders its <code>fallback</code>.</li>
<li>It calls <code>.then</code> on the promise. When it resolves, React renders the boundary again (a "retry").</li>
<li>This time <code>use</code> returns the value and the real content replaces the fallback.</li></ol>
<p>Inside, React keeps the content in an <b>Offscreen</b> fiber. If content that was already visible suspends later, React hides it with <code>display: none</code> and keeps its state.</p>
<p class="tip">⚠️ The promise must be <b>stable</b>: create it outside the component, or cache it. A new promise on every render would suspend forever.</p>`,
      { q: 'What is printed at 20 ms?', options: ['<h2>Hello Ada</h2>', '<p>Loading…</p>', 'an empty string', 'an error'], answer: 1, why: 'At 20 ms the promise is still pending, so User suspends and Suspense shows the fallback. At 100 ms the content is there.' }),

    L('r-lazy', '📦', 'lazy() and code splitting', 'Loading components on demand', 2,
      'Load a component only when it is first rendered, with a fallback while its code downloads.',
      `const Chart = React.lazy(() => new Promise(resolve =>
  setTimeout(() => resolve({ default: function Chart() { return <div className="chart">📈 chart</div>; } }), 30)));

function Dashboard() {
  const [show, setShow] = React.useState(false);
  return <div>
    <button id="b" onClick={() => setShow(true)}>show chart</button>
    {show && <React.Suspense fallback={<p>loading chart code…</p>}><Chart /></React.Suspense>}
  </div>;
}
${ROOT}.render(<Dashboard />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("root").textContent), 20);
setTimeout(() => console.log(document.getElementById("root").textContent), 100);`,
      `<p><code>React.lazy(() => import("./Chart"))</code> creates a placeholder component. The first time it renders, it calls the function, which starts downloading the code, and <b>suspends</b> until the module arrives. Later renders use the loaded component directly.</p>
<ul><li>The import function must resolve to a module with a <code>default</code> export.</li>
<li>Wrap lazy components in <code>&lt;Suspense&gt;</code>.</li>
<li>Split by route or by heavy, rarely used features (charts, editors, modals).</li></ul>`,
      { q: 'What is shown at 20 ms?', options: ['show chart📈 chart', 'show chartloading chart code…', 'show chart', 'nothing'], answer: 1, why: 'The code is still loading, so the lazy component suspends and its Suspense shows the fallback.' }),

    L('r-suspensetransition', '🧊', 'Suspense with transitions', 'Keeping the old UI while loading', 3,
      'Navigate with and without startTransition, and compare: fallback vs old screen kept.',
      `const cache = new Map();
function getPage(name) {
  if (!cache.has(name)) cache.set(name, new Promise(res => setTimeout(() => res("📄 " + name + " page"), 40)));
  return cache.get(name);
}
function Page({ name }) { return <h2>{React.use(getPage(name))}</h2>; }
function App() {
  const [page, setPage] = React.useState("home");
  const [isPending, startTransition] = React.useTransition();
  return <div>
    <button id="plain" onClick={() => setPage("about")}>about (plain)</button>
    <button id="smooth" onClick={() => startTransition(() => setPage("blog"))}>blog (transition)</button>
    <p id="state">{isPending ? "loading…" : "idle"}</p>
    <React.Suspense fallback={<h2>⏳ fallback</h2>}><Page name={page} /></React.Suspense>
  </div>;
}
${ROOT}.render(<App />);
// hidden content stays in the DOM with display: none, so only visible headings are read
const visible = () => [...document.querySelectorAll("h2")].filter(h => h.style.display !== "none").map(h => h.textContent).join(" + ");
const show = t => setTimeout(() => console.log(t + "ms:", visible(), "|", document.getElementById("state").textContent), t);
show(60);
simulateClick("#plain", 70); show(80); show(130);
simulateClick("#smooth", 140); show(150); show(200);`,
      `<p>When content that is <b>already on screen</b> suspends:</p>
<ul><li>With a normal update, React hides it and shows the <b>fallback</b>: a flash of loading UI.</li>
<li>Inside a <b>transition</b>, React <b>keeps the old screen</b> and throws the new render away until the data is ready. <code>isPending</code> is true meanwhile, so you can dim the page or show a small spinner.</li></ul>
<p>That is why routers wrap navigation in <code>startTransition</code>. Fallbacks are still used for content that appears for the first time.</p>`,
      { q: 'What is shown at 150 ms, during the blog transition?', options: ['⏳ fallback | idle', '📄 about page | loading…', '📄 blog page | idle', '📄 home page | loading…'], answer: 1, why: 'The transition keeps the current screen (about) while the blog data loads, and isPending makes the status say "loading…".' }),

    L('r-portal', '🌀', 'Portals', 'createPortal, events through the React tree', 2,
      'Render a modal into another DOM node and see its click still bubble to its React parent.',
      `const modalRoot = document.createElement("div");
modalRoot.id = "modal-root";
document.body.appendChild(modalRoot);

function Modal({ children }) {
  return ReactDOM.createPortal(<div className="modal">{children}</div>, modalRoot);
}
function App() {
  const [clicks, setClicks] = React.useState(0);
  return <div id="app" onClick={() => setClicks(c => c + 1)}>
    <p>clicks seen by App: {clicks}</p>
    <Modal><button id="ok">OK</button></Modal>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#ok", 10);
setTimeout(() => console.log(document.getElementById("root").textContent, "|", modalRoot.innerHTML), 50);`,
      `<p><code>ReactDOM.createPortal(children, domNode)</code> renders children into a <b>different DOM node</b>, for example to escape a parent's <code>overflow: hidden</code> or <code>z-index</code> (modals, tooltips, toasts).</p>
<ul><li>In the <b>DOM</b>, the button lives inside <code>#modal-root</code>, outside the app.</li>
<li>In the <b>React tree</b>, the portal is still a child of <code>App</code>. Context works, and events bubble through the <b>fiber</b> tree, so <code>App</code>'s <code>onClick</code> runs.</li></ul>
<p>React adds its event listeners to the portal container too, then walks up the fibers from the clicked element.</p>`,
      { q: 'Does App see the click on the modal button?', options: ['No, the button is outside #app in the DOM', 'Yes: React events bubble through the React tree', 'Only with stopPropagation', 'Only in StrictMode'], answer: 1, why: 'React walks the fiber tree from the target, and the portal fiber is App\'s child, so App\'s handler runs: "clicks seen by App: 1".' }),

    L('r-strict', '🧪', 'StrictMode', 'Double render and double effects (development)', 2,
      'See StrictMode call your component and effects twice, and why that finds bugs.',
      `let connections = 0;
function Chat() {
  console.log("render Chat");
  React.useEffect(() => {
    connections++;
    console.log("connect → open connections:", connections);
    return () => { connections--; console.log("disconnect → open connections:", connections); };
  }, []);
  return <p>chat</p>;
}
${ROOT}.render(<React.StrictMode><Chat /></React.StrictMode>);
setTimeout(() => console.log("final open connections:", connections), 50);`,
      `<p><code>&lt;React.StrictMode&gt;</code> turns on extra checks in <b>development</b> (it does nothing in production builds):</p>
<ul><li>Components (and <code>useState</code>/<code>useMemo</code> initialisers) are called <b>twice</b>. A pure component gives the same result both times.</li>
<li>New components are mounted, <b>unmounted and mounted again</b>, so every effect runs: effect → cleanup → effect. If your cleanup is missing, you see the bug right away (here: two open connections instead of one).</li></ul>
<p class="tip">💡 "My effect runs twice in development" is StrictMode. The fix is a correct cleanup, not removing StrictMode.</p>`,
      { q: 'How many connections are open at the end?', options: ['0', '1', '2', '3'], answer: 1, why: 'connect → disconnect → connect: the cleanup works, so one connection is open. Without the cleanup it would be 2.' }),

    // ================================================================ Part R5 · Advanced patterns & React 19
    L('r-forwardref', '🎯', 'forwardRef and useImperativeHandle', 'Refs to your own components', 3,
      'Give a parent a ref to a child component and expose only the methods you choose.',
      `const FancyInput = React.forwardRef(function FancyInput(props, ref) {
  const input = React.useRef(null);
  React.useImperativeHandle(ref, () => ({
    clear() { input.current.value = ""; },
    read() { return input.current.value; },
  }), []);
  return <input id="i" ref={input} defaultValue={props.start} />;
});
function Form() {
  const api = React.useRef(null);
  return <div>
    <FancyInput ref={api} start="hello" />
    <button id="b" onClick={() => { console.log("read:", api.current.read()); api.current.clear(); console.log("after clear:", JSON.stringify(api.current.read())); }}>go</button>
  </div>;
}
${ROOT}.render(<Form />);
simulateClick("#b", 10);`,
      `<p>A <code>ref</code> on a function component does nothing by default: function components have no instance. <code>forwardRef((props, ref) => …)</code> receives the ref as a second argument, so you can pass it to a DOM element inside.</p>
<p><code>useImperativeHandle(ref, () => api, deps)</code> sets <code>ref.current</code> to your own object (in the layout phase) instead of the DOM node, so the parent can only call what you allow.</p>
<p class="tip">💡 In React 19, <code>ref</code> is a normal prop for function components and <code>forwardRef</code> is no longer needed. You will still see it everywhere.</p>`,
      { q: 'What do the two logs print?', options: ['read: hello, after clear: ""', 'read: undefined, after clear: undefined', 'an error: api.current is null', 'read: hello, after clear: "hello"'], answer: 0, why: 'The parent gets the object from useImperativeHandle. read() returns the input value, clear() empties it.' }),

    L('r-syncstore', '📡', 'useSyncExternalStore', 'Subscribing to outside data', 3,
      'Connect React components to a store that lives outside React.',
      `function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set: next => { state = next; listeners.forEach(l => l()); },
    subscribe: l => { listeners.add(l); return () => listeners.delete(l); },
  };
}
const cart = createStore({ items: 0 });
function CartBadge() {
  const c = React.useSyncExternalStore(cart.subscribe, cart.get);
  return <b>🛒 {c.items} </b>;
}
${ROOT}.render(<div><CartBadge /><CartBadge /></div>);
setTimeout(() => cart.set({ items: 1 }), 10);
setTimeout(() => cart.set({ items: 2 }), 20);
setTimeout(() => console.log(document.getElementById("root").textContent), 50);`,
      `<p><code>useSyncExternalStore(subscribe, getSnapshot)</code> is how libraries (Redux, Zustand, browser APIs) plug into React:</p>
<ul><li>During render it calls <code>getSnapshot()</code> to read the current value.</li>
<li>After mount it calls <code>subscribe(callback)</code>. When the store calls the callback, React compares the new snapshot (<code>Object.is</code>) and re-renders with the <b>Sync</b> lane.</li>
<li>It returns the unsubscribe function as the cleanup.</li></ul>
<p>Store updates are never time-sliced, so all components always show the same value: no "tearing".</p>
<p class="tip">⚠️ <code>getSnapshot</code> must return the same object while nothing changed. Returning a new object each time causes an infinite loop.</p>`,
      { q: 'What is printed?', options: ['🛒 0 🛒 0 ', '🛒 2 🛒 2 ', '🛒 1 🛒 2 ', '🛒 2 🛒 0 '], answer: 1, why: 'Both badges subscribe to the same store and re-render on each change, so both show 2.' }),

    L('r-deferred', '🐌', 'useDeferredValue', 'A lagging copy of a value', 3,
      'Type fast while a slow list renders with a deferred copy of the text.',
      `function SlowList({ text }) {
  console.log("SlowList renders for", JSON.stringify(text));
  return <ul>{[1, 2, 3].map(i => <li key={i}>{text} {i}</li>)}</ul>;
}
const MemoList = React.memo(SlowList);
function Search() {
  const [text, setText] = React.useState("");
  const deferred = React.useDeferredValue(text);
  console.log("Search renders: text =", JSON.stringify(text), "deferred =", JSON.stringify(deferred));
  return <div>
    <input id="q" value={text} onChange={e => setText(e.target.value)} />
    <MemoList text={deferred} />
  </div>;
}
${ROOT}.render(<Search />);
simulateTyping("#q", "a", 10);`,
      `<p><code>useDeferredValue(value)</code> returns a copy that lags behind during urgent updates:</p>
<ol><li>You type: an urgent render runs. <code>text</code> is new, <code>deferred</code> is still the <b>old</b> value, so the <code>memo</code> list is skipped and the input updates instantly.</li>
<li>React then schedules a <b>Transition</b> render where <code>deferred</code> catches up and the list renders. That render can be interrupted by more typing.</li></ol>
<p>Use it when you can't wrap the state update in <code>startTransition</code> yourself (for example the value comes from props).</p>
<p class="tip">💡 It only helps if the slow part is skipped in the urgent render: wrap it in <code>memo</code>.</p>`,
      { q: 'In the urgent render after typing "a", what is deferred?', options: ['"a"', '"" (the old value)', 'undefined', 'a Promise'], answer: 1, why: 'The urgent render keeps the old value (""), so the memo list bails out. A transition render then updates it to "a".' }),

    L('r-children', '🧱', 'Children, cloneElement and composition', 'Patterns: children, render props, compound components', 2,
      'Build a Tabs component with React.Children and cloneElement, plus a render prop.',
      `function Tabs({ children }) {
  const [active, setActive] = React.useState(0);
  return <div>
    {React.Children.map(children, (child, i) =>
      React.cloneElement(child, { selected: i === active, onSelect: () => setActive(i) }))}
  </div>;
}
function Tab({ label, selected, onSelect }) {
  return <button id={"tab-" + label} onClick={onSelect}>{selected ? "[" + label + "]" : label}</button>;
}
function MouseInfo({ render }) { return render({ x: 3, y: 4 }); }
function App() {
  return <div>
    <Tabs><Tab label="A" /><Tab label="B" /><Tab label="C" /></Tabs>
    <MouseInfo render={pos => <p>mouse at {pos.x},{pos.y}</p>} />
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#tab-B", 10);
setTimeout(() => console.log(document.getElementById("root").textContent, React.Children.count([1, [2, 3], null])), 50);`,
      `<p>Ways to share structure and logic between components:</p>
<ul><li><b>children</b>: the simplest. The parent renders whatever you put inside it.</li>
<li><code>React.Children.map/count/toArray</code> walk <code>children</code> safely (they flatten arrays and skip <code>null</code>). <code>React.cloneElement(el, extraProps)</code> copies an element with more props: the classic <b>compound component</b> pattern (Tabs, Menu, Select).</li>
<li><b>Render props</b>: pass a function that returns JSX (<code>render={pos => …}</code>).</li>
<li><b>Higher-order components</b>: <code>withX(Component)</code> returns a wrapper. Today custom hooks usually replace both.</li></ul>`,
      { q: 'What does React.Children.count([1, [2, 3], null]) return?', options: ['2', '3', '4', '1'], answer: 1, why: 'Children utilities flatten nested arrays and skip null: 1, 2, 3.' }),

    L('r-optimistic', '✨', 'useOptimistic and async actions', 'React 19: actions, pending, optimistic UI', 3,
      'Show a like immediately while the server request is still running.',
      `function fakeServer(likes) { return new Promise(res => setTimeout(() => res(likes + 1), 40)); }
function LikeButton() {
  const [likes, setLikes] = React.useState(10);
  const [optimisticLikes, addOptimistic] = React.useOptimistic(likes, (current, add) => current + add);
  const [isPending, startTransition] = React.useTransition();
  console.log("render: likes =", likes, "shown =", optimisticLikes, isPending ? "(pending)" : "");
  function like() {
    startTransition(async () => {
      addOptimistic(1);                         // show it now
      const saved = await fakeServer(likes);    // wait for the server
      React.startTransition(() => setLikes(saved));
    });
  }
  return <button id="b" onClick={like}>❤️ {optimisticLikes}</button>;
}
${ROOT}.render(<LikeButton />);
simulateClick("#b", 10);`,
      `<p>In React 19, the function passed to <code>startTransition</code> can be <b>async</b>: an <b>action</b>. <code>isPending</code> stays true until its promise settles.</p>
<p><code>useOptimistic(state, updateFn)</code> returns a value that shows your <b>guess</b> while an action runs. When the action finishes, the guesses are dropped and the real state (from the server) is shown. If the request fails, the UI goes back automatically.</p>
<p class="tip">⚠️ State updates after an <code>await</code> are no longer inside the transition, so wrap them in <code>startTransition</code> again (a current React limitation).</p>`,
      { q: 'What does the button show while the request is running?', options: ['❤️ 10', '❤️ 11', '❤️ 12', '❤️ 0'], answer: 1, why: 'The optimistic value (10 + 1) shows immediately; after the server answers, the real likes are 11 too.' }),

    L('r-actionstate', '📝', 'useActionState', 'React 19: form actions', 3,
      'Submit a form through an async action and show its pending state and result.',
      `async function subscribe(prevState, email) {
  await new Promise(r => setTimeout(r, 30));
  if (!email.includes("@")) return { ok: false, message: "invalid email" };
  return { ok: true, message: "subscribed " + email };
}
function Newsletter() {
  const [state, submit, isPending] = React.useActionState(subscribe, { ok: null, message: "" });
  console.log(isPending ? "pending…" : "result: " + (state.message || "-"));
  return <div>
    <button id="bad" onClick={() => submit("nope")}>bad</button>
    <button id="good" onClick={() => submit("ada@example.com")}>good</button>
  </div>;
}
${ROOT}.render(<Newsletter />);
simulateClick("#bad", 10);
simulateClick("#good", 100);`,
      `<p><code>useActionState(action, initialState)</code> returns <code>[state, dispatch, isPending]</code>:</p>
<ul><li><code>dispatch(payload)</code> runs <code>action(previousState, payload)</code> inside a transition,</li>
<li><code>isPending</code> is true while it runs,</li>
<li>whatever the action returns becomes the new <code>state</code> (errors, messages, saved data).</li></ul>
<p>With a real <code>&lt;form action={dispatch}&gt;</code>, the payload is the <code>FormData</code>, and it works with server actions too.</p>`,
      { q: 'What is the last line printed?', options: ['pending…', 'result: invalid email', 'result: subscribed ada@example.com', 'result: -'], answer: 2, why: 'The second action succeeds, and its return value becomes the state.' }),

    L('r-warnings', '🚨', 'React warnings and common errors', 'Keys, objects as children, async effects', 2,
      'Trigger the warnings and errors React shows most often, and read what they mean.',
      `function List() {
  return <ul>{["a", "b"].map(x => <li>{x}</li>)}</ul>;
}
function Effect() {
  React.useEffect(async () => { console.log("effect ran"); }, []);
  return null;
}
function Bad() {
  const user = { name: "Ada" };
  return <p>{user}</p>;
}
${ROOT}.render(<div><List /><Effect /></div>);
setTimeout(() => {
  const other = document.createElement("div");
  document.body.appendChild(other);
  ReactDOM.createRoot(other).render(<Bad />);
}, 20);`,
      `<p>React's most common development messages:</p>
<ul><li><b>Each child in a list should have a unique "key" prop</b>: add <code>key</code> to elements made in <code>map</code>.</li>
<li><b>Encountered two children with the same key</b>: keys must be unique among siblings.</li>
<li><b>Objects are not valid as a React child</b>: you rendered an object. Render one of its fields (<code>{user.name}</code>) or <code>JSON.stringify</code> it.</li>
<li><b>An effect function must not return anything besides a function</b>: <code>useEffect(async () => …)</code> returns a Promise. Define the async function inside the effect and call it.</li>
<li><b>Rendered fewer/more hooks than expected</b>: a hook inside a condition or after an early return.</li>
<li><b>Too many re-renders</b>: <code>setState</code> called directly in the render body (for example <code>onClick={setOpen(true)}</code> instead of <code>onClick={() => setOpen(true)}</code>).</li></ul>`,
      { q: 'Why is "Objects are not valid as a React child" thrown?', options: ['user has no key', '<p>{user}</p> renders the whole object', 'Bad has no return', 'useEffect is async'], answer: 1, why: 'React can render strings, numbers, elements and arrays, but not plain objects. Use {user.name}.' }),

    L('r-patterns', '🧭', 'Thinking in React: a full feature', 'Context + reducer + memo + effects', 3,
      'Combine context, a reducer, memo and an effect into a small shopping cart.',
      `const CartContext = React.createContext(null);
function cartReducer(state, action) {
  switch (action.type) {
    case "add": return { ...state, [action.id]: (state[action.id] || 0) + 1 };
    case "remove": { const next = { ...state }; delete next[action.id]; return next; }
    default: return state;
  }
}
function CartProvider({ children }) {
  const [cart, dispatch] = React.useReducer(cartReducer, {});
  const value = React.useMemo(() => ({ cart, dispatch }), [cart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
const Product = React.memo(function Product({ id }) {
  const { dispatch } = React.useContext(CartContext);
  return <button id={"add-" + id} onClick={() => dispatch({ type: "add", id })}>add {id}</button>;
});
function Summary() {
  const { cart } = React.useContext(CartContext);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  React.useEffect(() => { document.title = count + " items"; }, [count]);
  return <p>{count} items: {JSON.stringify(cart)}</p>;
}
${ROOT}.render(<CartProvider><Product id="tea" /><Product id="cake" /><Summary /></CartProvider>);
simulateClick("#add-tea", 10); simulateClick("#add-tea", 20); simulateClick("#add-cake", 30);
setTimeout(() => console.log(document.title, "|", document.querySelector("p").textContent), 60);`,
      `<p>A common real-world structure:</p>
<ul><li>A <b>reducer</b> holds the logic (pure, easy to test).</li>
<li>A <b>Provider</b> shares <code>{ cart, dispatch }</code> through <b>context</b>; <code>useMemo</code> keeps the value stable.</li>
<li>Any component reads it with <code>useContext</code>, with no prop drilling.</li>
<li>An <b>effect</b> syncs the count to something outside React (the page title).</li></ul>
<p class="tip">💡 Every reader re-renders when the context value changes. For big apps, split the context (state vs. dispatch) or use an external store with selectors.</p>`,
      { q: 'What is printed?', options: ['3 items | 3 items: {"tea":2,"cake":1}', '2 items | 2 items: {"tea":1,"cake":1}', '0 items | 0 items: {}', '3 items | 3 items: {"tea":3}'], answer: 0, why: 'Two "add tea" and one "add cake" actions: tea 2, cake 1, so 3 items.' }),

    // ================================================================ Part R6 · SSR, forms & the ecosystem
    L('r-ssr', '🖥️', 'Server rendering and hydration', 'renderToString, hydrateRoot', 3,
      'Render HTML on the "server", then hydrate it in the browser and watch React adopt the existing DOM.',
      `function Counter({ start }) {
  const [n, setN] = React.useState(start);
  React.useEffect(() => console.log("effect: runs only in the browser"), []);
  return <div id="box"><p>Count: {n}</p><button id="b" onClick={() => setN(n + 1)}>+1</button></div>;
}

// 1. on the server: components → HTML string (no DOM, no effects, no events)
const html = ReactDOMServer.renderToString(<Counter start={5} />);
console.log("server HTML:", html);

// 2. the browser receives that HTML and shows it right away
const root = document.getElementById("root");
root.innerHTML = html;
const serverBox = document.getElementById("box");

// 3. hydration: React renders again in the browser and ADOPTS the existing nodes
ReactDOM.hydrateRoot(root, <Counter start={5} />);
simulateClick("#b", 20);
setTimeout(() => console.log("same DOM node:", document.getElementById("box") === serverBox, "| now:", root.textContent), 60);`,
      `<p><b>Server-side rendering (SSR)</b> runs your components on the server and sends real HTML, so the user sees content before the JavaScript has loaded (faster first paint, better SEO).</p>
<ol><li><code>renderToString(element)</code> renders to a string. Hooks give their initial values, effects never run, handlers are dropped. React adds <code>&lt;!-- --&gt;</code> between neighbouring text nodes so the client can tell them apart.</li>
<li>The browser shows the HTML, but buttons do nothing yet.</li>
<li><code>hydrateRoot(container, element)</code> renders again on the client. Instead of creating DOM nodes, React walks the existing DOM and <b>claims</b> each node for its fiber, attaching event handlers. Then effects run and the page is interactive.</li></ol>
<p class="tip">💡 Frameworks (Next.js, Remix) do this for you, often with <b>streaming</b> (<code>renderToPipeableStream</code>) so Suspense boundaries can arrive later.</p>`,
      { q: 'Is the <code>#box</code> element after hydration the same node the server HTML created?', options: ['No, React recreates the DOM', 'Yes, hydration reuses the server nodes', 'Only the text nodes are reused', 'Only in development'], answer: 1, why: 'Hydration adopts the existing DOM nodes; it only attaches fibers and event handlers. The log prints true.' }),

    L('r-hydration', '💧', 'Hydration mismatches', 'Why they happen and how to fix them', 3,
      'Render different content on the server and the client, see the mismatch, then fix it with an effect.',
      `function Greeting() {
  // ❌ different on the server and the client (like Date.now(), Math.random(), window, localStorage)
  const where = typeof isClient !== "undefined" ? "client" : "server";
  return <p>Rendered on the {where}</p>;
}
function FixedGreeting() {
  // ✅ same first render everywhere; the browser-only part comes in an effect
  const [where, setWhere] = React.useState("server");
  React.useEffect(() => setWhere("client"), []);
  return <p>Fixed: rendered on the {where}</p>;
}
const a = document.createElement("div"), b = document.createElement("div");
document.body.append(a, b);
a.innerHTML = ReactDOMServer.renderToString(<Greeting />);
b.innerHTML = ReactDOMServer.renderToString(<FixedGreeting />);
var isClient = true; // now we are "in the browser"
ReactDOM.hydrateRoot(a, <Greeting />);
ReactDOM.hydrateRoot(b, <FixedGreeting />);
setTimeout(() => console.log(a.textContent, "|", b.textContent), 60);`,
      `<p>Hydration expects the <b>first client render</b> to produce exactly the server's HTML. If it doesn't, React 18 reports a mismatch and throws the server HTML away, rendering the whole root on the client (slower, and the page can flicker).</p>
<p>Common causes:</p>
<ul><li><code>Date.now()</code>, <code>new Date().toLocaleString()</code>, <code>Math.random()</code> during render,</li>
<li>reading <code>window</code>, <code>localStorage</code> or the screen size during render,</li>
<li>invalid HTML nesting (<code>&lt;div&gt;</code> inside <code>&lt;p&gt;</code>), browser extensions changing the page.</li></ul>
<p><b>Fix</b>: render the same thing first, then switch to the browser-only value in <code>useEffect</code> (it runs only on the client, after hydration). For ids use <code>useId</code>. For a single intentional difference, <code>suppressHydrationWarning</code>.</p>`,
      { q: 'What does the first container show at the end?', options: ['Rendered on the server', 'Rendered on the client (after a mismatch and a full client render)', 'nothing', 'both texts'], answer: 1, why: 'The client text differs, so hydration fails and React re-renders that root on the client: "Rendered on the client".' }),

    L('r-rsc', '🗄️', 'Server Components and server functions', 'The RSC payload (Flight), "use client", "use server"', 3,
      'Render server components to the RSC payload, let the browser plug in client components, and call a server function.',
      `// ================= server (this code never reaches the browser) =================
const db = { posts: [{ id: 1, title: "Hello RSC" }, { id: 2, title: "Server first" }], likes: 0 };
// "use client" in LikeButton.js makes the bundler give the server only a REFERENCE:
const LikeButton = ReactServer.registerClientReference("LikeButton");
// "use server" turns a function into one the browser can call over the network:
async function likePost(id) { db.likes++; return "liked " + id + " (" + db.likes + " total)"; }
ReactServer.registerServerReference(likePost, "likePost");
async function PostList() {
  const posts = await new Promise(r => setTimeout(() => r(db.posts), 10)); // await the database directly
  return <ul>{posts.map(p => <li key={p.id}>{p.title} <LikeButton id={p.id} onLike={likePost} /></li>)}</ul>;
}
// ================= browser =================
function LikeButtonImpl({ id, onLike }) {            // the real client component, from the JS bundle
  const [msg, setMsg] = React.useState("");
  return <button id={"like" + id} onClick={async () => setMsg(await onLike(id))}>❤️ {msg}</button>;
}
ReactServer.renderToFlight(<PostList />).then(payload => {
  console.log(payload);                              // what travels over the network
  const tree = ReactServer.createFromFlight(payload, { LikeButton: LikeButtonImpl });
  ReactDOM.createRoot(document.getElementById("root")).render(tree);
});
simulateClick("#like2", 50);
setTimeout(() => console.log(document.getElementById("root").textContent), 80);`,
      `<p><b>React Server Components</b> (Next.js App Router, React Router, Waku) split components in two kinds:</p>
<ul><li><b>Server components</b> (the default): run only on the server, can be <code>async</code> and read the database or files directly. Their code is never sent to the browser, only their output. They can't use state, effects or event handlers.</li>
<li><b>Client components</b> (<code>"use client"</code> at the top of the file): normal components. The server doesn't run them: it sends a <b>reference</b> and their props.</li>
<li><b>Server functions</b> (<code>"use server"</code>): functions the browser can call. The browser gets a reference; calling it sends a request, the server runs it and returns the result.</li></ul>
<p>The server writes the <b>RSC payload</b> (the "Flight" format), one row per line:</p>
<ul><li><code>1:I["LikeButton"]</code>: an import of a client component (in real React: the file and chunk to load);</li>
<li><code>2:F{"id":"likePost"}</code>: a server function;</li>
<li><code>0:[...]</code>: the tree. <code>["$","li","1",{...}]</code> is an element (type, key, props); <code>"$L1"</code> means "the client component in row 1", <code>"$F2"</code> the server function in row 2.</li></ul>
<p>The browser turns the rows back into elements and renders them, with the real <code>LikeButtonImpl</code> from its bundle. Props sent to client components must be serialisable: passing a normal function throws, only server functions are allowed.</p>
<p class="tip">ReactLite runs both sides in one page and its payload is simplified. Real React streams the rows (<code>react-server-dom-webpack</code> and friends), and the bundler creates the references from the directives.</p>`,
      { q: 'What does the browser receive for LikeButton?', options: ['Its source code inside the payload', 'Only a reference ($L1) and its props; the code comes from the client bundle', 'Its rendered HTML only', 'Nothing'], answer: 1, why: 'The server never runs a client component: it writes an import row (I) and a $L reference with the props.' }),

    L('r-forms', '📨', 'Forms: actions, useFormStatus, FormData', 'React 19 forms, controlled vs uncontrolled', 2,
      'Submit a form through an action, show a pending button with useFormStatus, and read fields with FormData.',
      `function SubmitButton() {
  const { pending } = React.useFormStatus();   // reads the status of the PARENT <form>
  return <button id="send" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>;
}
function Signup() {
  const [saved, setSaved] = React.useState(null);
  async function signup(formData) {               // receives the form fields
    await new Promise(r => setTimeout(r, 30));    // pretend server call
    React.startTransition(() => setSaved(formData.get("email") + (formData.get("news") ? " + newsletter" : "")));
  }
  console.log("render:", saved || "not saved");
  return <form action={signup}>
    <input id="email" name="email" defaultValue="" />
    <input type="checkbox" name="news" defaultChecked />
    <SubmitButton />
  </form>;
}
${ROOT}.render(<Signup />);
simulateTyping("#email", "ada@example.com", 10);
simulateClick("#send", 20);
setTimeout(() => console.log("input after the action:", JSON.stringify(document.getElementById("email").value)), 100);`,
      `<p>Two ways to own form data:</p>
<ul><li><b>Controlled</b>: <code>value</code> + <code>onChange</code> + state. Validate and transform on every keystroke.</li>
<li><b>Uncontrolled</b>: the DOM keeps the value (<code>defaultValue</code>); read it on submit with <code>new FormData(form)</code> or a ref. Less code and fewer renders (react-hook-form works this way).</li></ul>
<p><b>React 19 form actions</b>: <code>&lt;form action={fn}&gt;</code> calls <code>fn(formData)</code> in a transition instead of reloading the page. While it runs, <code>useFormStatus()</code> in any component <b>inside</b> the form returns <code>{ pending: true, data }</code>, which is handy for submit buttons. After a successful action React resets the uncontrolled fields. Combine with <code>useActionState</code> for the result and errors.</p>`,
      { q: 'What does the submit button show while the action is running?', options: ['Save', 'Saving… (disabled)', 'nothing, the page reloads', 'an error'], answer: 1, why: 'useFormStatus reports pending: true for its parent form while the action runs.' }),

    L('r-router', '🧭', 'How routers work: build a tiny one', 'Routes, links, URL as external state', 3,
      'Build a mini router with a URL store, useSyncExternalStore, context for params, and Link components.',
      `// the URL is state that lives OUTSIDE React: a small store (React Router uses the history API the same way)
const history = {
  path: "/", listeners: new Set(),
  push(p) { this.path = p; this.listeners.forEach(l => l()); },
  subscribe(l) { history.listeners.add(l); return () => history.listeners.delete(l); },
  get() { return history.path; },
};
const usePath = () => React.useSyncExternalStore(history.subscribe, history.get);
const ParamsContext = React.createContext({});
function match(pattern, path) {
  const a = pattern.split("/"), b = path.split("/");
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = b[i];
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
function Routes({ routes }) {
  const path = usePath();
  for (const [pattern, Page] of routes) {
    const params = match(pattern, path);
    if (params) return <ParamsContext.Provider value={params}><Page /></ParamsContext.Provider>;
  }
  return <p>404</p>;
}
function Link({ to, children }) {
  return <a id={"go" + to.replace(/\\//g, "-")} href={to} onClick={e => { e.preventDefault(); history.push(to); }}>{children}</a>;
}
const Home = () => <h1>Home</h1>;
const User = () => <h1>User {React.useContext(ParamsContext).id}</h1>;
function App() {
  return <div><nav><Link to="/">home</Link> <Link to="/users/42">user 42</Link></nav><Routes routes={[["/", Home], ["/users/:id", User]]} /></div>;
}
${ROOT}.render(<App />);
simulateClick("#go-users-42", 10);
setTimeout(() => console.log(history.path, "|", document.querySelector("h1").textContent), 50);`,
      `<p>A client-side router is mostly three pieces:</p>
<ol><li>The <b>URL as external state</b>: React Router listens to the history API (<code>pushState</code>, <code>popstate</code>). Here a tiny store plus <code>useSyncExternalStore</code> plays that role.</li>
<li><b>Matching</b>: compare the path with patterns like <code>/users/:id</code> and extract params, given to pages through <b>context</b> (<code>useParams</code>).</li>
<li><b>Links</b>: an <code>&lt;a&gt;</code> whose click calls <code>preventDefault()</code> (no page reload) and pushes the new URL.</li></ol>
<p>Real routers add nested routes and layouts (<code>&lt;Outlet&gt;</code>), data loaders, lazy routes with Suspense, and transitions for navigation.</p>`,
      { q: 'Why does the Link call e.preventDefault()?', options: ['To stop event bubbling', 'To stop the browser from loading a new page; React re-renders instead', 'It is required by React', 'To make the link accessible'], answer: 1, why: 'Without it the browser would navigate and reload the whole page. The router updates the URL state and React renders the new route.' }),

    L('r-store', '🗃️', 'State management: build a tiny Zustand', 'External stores, selectors, Redux-style reducers', 3,
      'Create a global store hook with selectors, so components re-render only for the data they use.',
      `function create(init) {
  let state;
  const listeners = new Set();
  const setState = partial => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next };
    listeners.forEach(l => l());
  };
  state = init(setState, () => state);
  const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };
  // the hook: each component picks the slice it needs (a "selector")
  return selector => React.useSyncExternalStore(subscribe, () => selector(state));
}
const useCart = create(set => ({
  items: 0, user: "Ada",
  add: () => set(s => ({ items: s.items + 1 })),
  rename: name => set({ user: name }),
}));
function CartCount() { const items = useCart(s => s.items); console.log("CartCount renders", items); return <b>{items} items</b>; }
function UserName() { const user = useCart(s => s.user); console.log("UserName renders", user); return <i>{user}</i>; }
function Buttons() {
  const add = useCart(s => s.add), rename = useCart(s => s.rename);
  return <div><button id="add" onClick={add}>add</button><button id="ren" onClick={() => rename("Grace")}>rename</button></div>;
}
${ROOT}.render(<div><CartCount /><UserName /><Buttons /></div>);
simulateClick("#add", 10);
simulateClick("#ren", 20);`,
      `<p>Global state libraries keep state <b>outside</b> React and let components subscribe:</p>
<ul><li><b>Zustand</b> (built here in 15 lines): a store with <code>set</code>, and a hook that takes a <b>selector</b>. <code>useSyncExternalStore</code> re-renders a component only when <i>its</i> selected value changes.</li>
<li><b>Redux / Redux Toolkit</b>: one store, changes only through dispatched <b>actions</b> and pure <b>reducers</b> (slices with Immer), <code>useSelector</code> and <code>useDispatch</code>, devtools with time travel.</li>
<li><b>Context + useReducer</b>: built in, fine for low-frequency state, but every reader re-renders on each change (no selectors).</li></ul>
<p class="tip">💡 Server data (lists from an API) usually belongs in a data-fetching cache (next lesson), not in a global store.</p>`,
      { q: 'Does UserName re-render when an item is added?', options: ['Yes, the store changed', 'No: its selected value (user) did not change', 'Only with React.memo', 'Only in StrictMode'], answer: 1, why: 'useSyncExternalStore compares the selected snapshot; s.user stayed "Ada", so UserName is not re-rendered.' }),

    L('r-query', '📥', 'Data fetching: build a tiny React Query', 'Cache, dedupe, loading and error states, refetch', 3,
      'Write a useQuery hook with a shared cache: two components ask for the same data and only one request is sent.',
      `let requests = 0;
function fetchUser(id) {
  requests++;
  return new Promise((res, rej) => setTimeout(() => (id === 404 ? rej(new Error("not found")) : res({ id, name: "User " + id })), 20));
}
const cache = new Map(); // key → { status, data, error, promise, listeners }
function getEntry(key) {
  if (!cache.has(key)) cache.set(key, { status: "idle", data: undefined, error: null, promise: null, listeners: new Set() });
  return cache.get(key);
}
function fetchQuery(key, fn) {
  const e = getEntry(key);
  if (e.promise) return e.promise; // dedupe: one request for many components
  e.status = e.data === undefined ? "loading" : "refreshing";
  e.listeners.forEach(l => l());
  e.promise = fn().then(d => { e.data = d; e.error = null; e.status = "success"; }, err => { e.error = err; e.status = "error"; })
    .finally(() => { e.promise = null; e.listeners.forEach(l => l()); });
  return e.promise;
}
function useQuery(key, fn) {
  const e = getEntry(key);
  const status = React.useSyncExternalStore(l => { e.listeners.add(l); return () => e.listeners.delete(l); }, () => e.status);
  React.useEffect(() => { if (e.status === "idle") fetchQuery(key, fn); }, [key]);
  return { status, data: e.data, error: e.error, refetch: () => fetchQuery(key, fn) };
}
function Profile({ id }) {
  const q = useQuery("user:" + id, () => fetchUser(id));
  if (q.status === "idle" || q.status === "loading") return <p>loading…</p>;
  if (q.status === "error") return <p>error: {q.error.message}</p>;
  return <p>{q.data.name} {q.status === "refreshing" ? "(refreshing)" : ""}</p>;
}
${ROOT}.render(<div><Profile id={1} /><Profile id={1} /><Profile id={404} /></div>);
setTimeout(() => console.log(document.getElementById("root").textContent, "| requests:", requests), 60);`,
      `<p>Server data is different from UI state: it lives elsewhere, can be stale, and is shared by many components. Libraries like <b>TanStack Query</b> (React Query) and <b>SWR</b> handle it:</p>
<ul><li>a <b>cache</b> keyed by a query key (<code>["user", 1]</code>),</li>
<li><b>deduplication</b>: many components, one request,</li>
<li><code>loading</code> / <code>error</code> / <code>success</code> states, and background <b>refetching</b> of stale data (stale-while-revalidate),</li>
<li>retries, pagination, <b>mutations</b> with cache invalidation and optimistic updates.</li></ul>
<p>Our version: a Map of entries, <code>useSyncExternalStore</code> to subscribe to an entry, and an effect to start the first fetch. In React 19 with Suspense you can also <code>use()</code> a cached promise.</p>`,
      { q: 'How many requests are made for the two Profile id={1} components and the id={404} one?', options: ['3', '2', '1', '4'], answer: 1, why: 'The two id=1 components share one cache entry, so its request is deduplicated: one for user 1 and one for 404.' }),

    L('r-testing', '🧪', 'Testing React components', 'Render, act, events, assertions (Testing Library style)', 2,
      'Write tests like React Testing Library: render, find by text, click, and check what the user sees.',
      `// a tiny "testing library"
function render(ui) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);
  ReactDOM.flushSync(() => root.render(ui));        // act(): render and commit right now
  return {
    getByText: text => [...container.querySelectorAll("*")].find(el => el.children.length === 0 && el.textContent === text) || (() => { throw new Error("Unable to find an element with the text: " + text); })(),
    queryByText: text => [...container.querySelectorAll("*")].find(el => el.textContent === text) || null,
    unmount: () => ReactDOM.flushSync(() => root.unmount()),
  };
}
const fireEvent = { click: el => ReactDOM.flushSync(() => el.click()) };
function test(name, fn) { try { fn(); console.log("✓", name); } catch (e) { console.log("✗", name, "→", e.message); } }
function expect(v) { return { toBe: w => { if (v !== w) throw new Error("expected " + JSON.stringify(w) + " but got " + JSON.stringify(v)); }, toBeTruthy: () => { if (!v) throw new Error("expected a truthy value"); } }; }

// the component under test
function Counter() {
  const [n, setN] = React.useState(0);
  return <div><p>Count: {n}</p><button onClick={() => setN(n + 1)}>Increment</button></div>;
}
test("starts at 0", () => { const s = render(<Counter />); expect(s.getByText("Count: 0")).toBeTruthy(); });
test("clicking increments", () => {
  const s = render(<Counter />);
  fireEvent.click(s.getByText("Increment"));
  fireEvent.click(s.getByText("Increment"));
  expect(s.queryByText("Count: 2") !== null).toBe(true);
});
test("a failing test shows a clear message", () => { const s = render(<Counter />); s.getByText("Count: 99"); });`,
      `<p>The <b>React Testing Library</b> idea: test what the <b>user</b> sees and does, not implementation details (state, hooks, component names).</p>
<ul><li><code>render(&lt;App /&gt;)</code> mounts into a detached container.</li>
<li>Queries by role, label or text: <code>getByRole("button", { name: "Save" })</code>, <code>getByText</code>, <code>findBy…</code> (async, waits), <code>queryBy…</code> (returns null instead of throwing).</li>
<li><code>fireEvent</code> or better <code>userEvent</code> simulate interaction; both wrap updates in <b><code>act()</code></b>, so React finishes rendering and running effects before you assert (here <code>flushSync</code> does that job).</li>
<li>Mock network calls (MSW, or mocking <code>fetch</code>), and use <code>await findByText</code> for async UI.</li></ul>
<p>Run with Jest or Vitest. Add end-to-end tests (Playwright, Cypress) for full user flows.</p>`,
      { q: 'Why wrap the click in act() / flushSync?', options: ['To make it faster', 'So React finishes the re-render (and effects) before the assertion runs', 'act() is required to call click()', 'To avoid StrictMode'], answer: 1, why: 'React renders updates asynchronously; act() flushes them so the DOM is up to date when you check it.' }),

    L('r-typescript', '🔷', 'TypeScript with React', 'Typing props, state, events, refs, generic components', 2,
      'Type a small React app: props interfaces, useState generics, event handlers, refs and a generic List component.',
      `// @lang ts
type Todo = { id: number; title: string; done: boolean };
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;       // callback props
  children?: React.ReactNode;           // anything renderable
}
function TodoItem({ todo, onToggle, children }: TodoItemProps) {
  return <li id={"t" + todo.id} onClick={() => onToggle(todo.id)}>{todo.done ? "✓" : "○"} {todo.title} {children}</li>;
}
// a generic component: works for any item type
function List<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  return <ul>{items.map(render)}</ul>;
}
function App() {
  const [todos, setTodos] = React.useState<Todo[]>([{ id: 1, title: "Type the props", done: false }]);
  const input = React.useRef<HTMLInputElement>(null);
  const toggle = (id: number): void => setTodos(ts => ts.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => console.log("typed:", e.target.value);
  return <div>
    <input id="i" ref={input} onChange={onChange} />
    <List items={todos} render={t => <TodoItem key={t.id} todo={t} onToggle={toggle} />} />
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
simulateTyping("#i", "hi", 10);
simulateClick("#t1", 20);
setTimeout(() => console.log(document.getElementById("root")!.textContent), 50);`,
      `<p>TypeScript types disappear at runtime (the visualizer strips them, like the compiler), but they catch mistakes while you write code:</p>
<ul><li><b>Props</b>: an <code>interface</code> or <code>type</code>; optional props with <code>?</code>; <code>children?: React.ReactNode</code>.</li>
<li><b>State</b>: <code>useState&lt;Todo[]&gt;([])</code> when the type can't be inferred (empty arrays, <code>null</code> initial values: <code>useState&lt;User | null&gt;(null)</code>).</li>
<li><b>Events</b>: <code>React.ChangeEvent&lt;HTMLInputElement&gt;</code>, <code>React.MouseEvent&lt;HTMLButtonElement&gt;</code>, <code>React.FormEvent</code>.</li>
<li><b>Refs</b>: <code>useRef&lt;HTMLInputElement&gt;(null)</code>.</li>
<li><b>Generic components</b>: <code>function List&lt;T&gt;(props: { items: T[]; render: (t: T) =&gt; ReactNode })</code>.</li>
<li>Reuse element props: <code>React.ComponentProps&lt;"button"&gt;</code>; type reducers with a discriminated union of actions.</li></ul>`,
      { q: 'How do you type state that starts as null and later holds a User?', options: ['useState(null as User)', 'useState<User | null>(null)', 'useState<User>()', 'useState<any>(null)'], answer: 1, why: 'A union type with null tells TypeScript both shapes are possible, so you must check for null before using it.' }),

    L('r-virtual', '📜', 'Virtualizing long lists', 'Render only what is visible (windowing)', 3,
      'Render 10,000 rows by drawing only the 5 that fit in the viewport, and scroll by changing one number.',
      `const ROW = 20, HEIGHT = 100; // 5 rows are visible
// 10,000 rows, made on demand (like data you page through): only the visible ones are ever created
const rows = { length: 10000, slice(a, b) { const out = []; for (let i = a; i < b; i++) out.push("Row " + i); return out; } };
function VirtualList({ items }) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const start = Math.floor(scrollTop / ROW);
  const end = Math.min(items.length, start + Math.ceil(HEIGHT / ROW));
  const visible = items.slice(start, end);
  console.log("rendering rows", start, "to", end - 1, "of", items.length);
  return <div>
    <button id="down" onClick={() => setScrollTop(t => t + 5000 * ROW)}>scroll far down</button>
    <div style={{ height: HEIGHT, overflow: "auto" }}>
      <div style={{ height: items.length * ROW, position: "relative" }}>
        {visible.map((text, i) => <div key={start + i} style={{ position: "absolute", top: (start + i) * ROW, height: ROW }}>{text}</div>)}
      </div>
    </div>
  </div>;
}
${ROOT}.render(<VirtualList items={rows} />);
simulateClick("#down", 10);
setTimeout(() => console.log("DOM rows:", document.querySelectorAll("[style*='absolute']").length, "| first:", document.querySelector("[style*='absolute']").textContent), 50);`,
      `<p>Rendering thousands of DOM nodes is slow no matter how fast React is. <b>Virtualization</b> (windowing) renders only the rows in view:</p>
<ul><li>an outer box with a fixed height and <code>overflow: auto</code>,</li>
<li>an inner box as tall as <i>all</i> rows, so the scrollbar is right,</li>
<li>only the visible rows, absolutely positioned at <code>index × rowHeight</code>, computed from <code>scrollTop</code> (in a real app from the <code>onScroll</code> event).</li></ul>
<p>Libraries: <code>react-window</code>, <code>react-virtuoso</code>, <code>@tanstack/react-virtual</code>. Use stable keys (the item index or id) so rows are reused.</p>`,
      { q: 'How many row elements are in the DOM after scrolling?', options: ['10,000', '5', '0', '50'], answer: 1, why: 'Only the rows that fit in the 100px viewport (100 / 20 = 5) are rendered, whatever the scroll position.' }),

    // ---- part 7: the commit in detail, and React 19.2
    L('r-commitphases', '🧾', 'The four parts of the commit', 'Before mutation → mutation → layout → passive', 3,
      'See the exact order in which React reads the DOM, changes it, runs layout effects and runs useEffect.',
      `class Box extends React.Component {
  getSnapshotBeforeUpdate() {
    console.log("1 before mutation: old text", document.getElementById("t").textContent);
    return null;
  }
  componentDidUpdate() { console.log("3 layout: componentDidUpdate"); }
  render() { return <p id="t">{this.props.n}</p>; }
}
function App() {
  const [n, setN] = React.useState(0);
  const ref = React.useRef(null);
  React.useInsertionEffect(() => { if (n) console.log("2 mutation: useInsertionEffect, new text", document.getElementById("t").textContent); });
  React.useLayoutEffect(() => { if (n) console.log("3 layout: useLayoutEffect, ref", ref.current.id); });
  React.useEffect(() => { if (n) console.log("4 passive: useEffect"); });
  return <div><Box n={n} /><button id="b" ref={ref} onClick={() => setN(n + 1)}>+</button></div>;
}
${ROOT}.render(<App />);
simulateClick("#b", 10);`,
      `<p>The commit is not one step. React walks the finished tree <b>four times</b>, each time for a different job:</p>
<ol><li><b>Before mutation</b>: <code>getSnapshotBeforeUpdate</code> reads the DOM while it still shows the <i>old</i> UI (for example a scroll position).</li>
<li><b>Mutation</b>: every DOM insert, update and removal. <code>useInsertionEffect</code> runs here (for CSS-in-JS), and layout cleanups too. Then <code>root.current</code> is switched to the new tree.</li>
<li><b>Layout</b>: refs are attached, then <code>useLayoutEffect</code>, <code>componentDidMount</code> and <code>componentDidUpdate</code> run, children before parents. The browser has not painted yet, so you can measure and change the DOM without a flicker.</li>
<li><b>Passive</b>: after the browser paints, in a later task: <code>useEffect</code> cleanups, then <code>useEffect</code> callbacks.</li></ol>
<p class="tip">Parts 1 to 3 run in one go and can't be interrupted. Part 4 is scheduled separately, so slow effects don't delay the paint.</p>`,
      { q: 'Which line prints first after the click?', options: ['useLayoutEffect', 'useEffect', 'getSnapshotBeforeUpdate (old text 0)', 'useInsertionEffect'], answer: 2, why: 'Before mutation comes first: the DOM still shows 0. Then mutation (insertion effect sees 1), layout (child before parent), and finally passive.' }),

    L('r-useid', '🆔', 'useId', 'Stable ids for accessibility', 2,
      'Give each label and input a unique id that is the same on the server and the client.',
      `function Field({ label }) {
  const id = React.useId();
  return <div>
    <label htmlFor={id}>{label}</label>
    <input id={id} />
  </div>;
}
function App() {
  return <form><Field label="Name" /><Field label="Email" /></form>;
}
${ROOT}.render(<App />);
setTimeout(() => console.log([...document.querySelectorAll("input")].map(i => i.id).join(" ")), 20);`,
      `<p><code>useId()</code> returns a string that is unique for this component instance and stays the same on every render (it is stored in the hook, like state).</p>
<ul><li>Use it to connect elements: <code>&lt;label htmlFor&gt;</code> with <code>&lt;input id&gt;</code>, <code>aria-describedby</code>, and so on.</li>
<li>Real React builds the id from the component's <b>position in the tree</b>, not from a global counter. The server and the browser have the same tree, so they produce the same ids and hydration matches. (ReactLite uses a simple counter, and the exact format of the id differs between React versions.)</li>
<li>Don't use it for list <b>keys</b>: keys must come from your data.</li></ul>`,
      { q: 'Why not use a global counter (let n = 0; n++) for ids?', options: ['It is slower', 'Server and client could count in a different order, so hydration would not match', 'React forbids variables', 'Counters cannot be strings'], answer: 1, why: 'useId depends only on the tree position, which is the same on server and client. A counter depends on the order code runs in.' }),

    L('r-activity', '🙈', '<Activity>: hide without losing state', 'Offscreen, effects stop, state stays', 3,
      'Hide a part of the page with Activity and see its effects clean up while its state is kept.',
      `function Timer() {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    console.log("effect: start");
    return () => console.log("cleanup: stop");
  }, []);
  return <button id="inc" onClick={() => setN(n + 1)}>count {n}</button>;
}
function App() {
  const [tab, setTab] = React.useState("a");
  return <div>
    <button id="tab" onClick={() => setTab(tab === "a" ? "b" : "a")}>switch</button>
    <React.Activity mode={tab === "a" ? "visible" : "hidden"}>
      <Timer />
    </React.Activity>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#inc", 10);
simulateClick("#tab", 20);
setTimeout(() => console.log("hidden: display =", document.getElementById("inc").style.display), 30);
simulateClick("#tab", 40);
setTimeout(() => console.log("visible again:", document.getElementById("inc").textContent), 60);`,
      `<p><code>&lt;Activity mode="hidden"&gt;</code> (React 19.2) is the same <b>Offscreen</b> fiber that Suspense uses to hide its content, but you control it.</p>
<ul><li><b>Hidden</b>: the DOM stays but gets <code>display: none</code>; every effect inside is <b>cleaned up</b> (as if it unmounted); the fibers and their <b>state are kept</b>.</li>
<li><b>Visible again</b>: the DOM is shown and the effects <b>run again</b>, with the old state.</li>
<li>Compare with <code>{show &amp;&amp; &lt;Timer /&gt;}</code>: there, hiding <b>deletes</b> the fiber, and the state is lost.</li></ul>
<p class="tip">Content that starts hidden and was never shown is still rendered in the background at the lowest priority, so it is ready when shown: see the concept "Activity: preparing hidden content".</p>`,
      { q: 'What does the button show when it is visible again?', options: ['count 0', 'count 1', 'nothing, it was removed', 'count 2'], answer: 1, why: 'Hiding kept the fiber and its state (1). Only the effect was cleaned up and started again.' }),

    L('r-effectevent', '🔗', 'useEffectEvent', 'Read the latest values from an effect', 3,
      'Read the latest props in an effect without adding them to its dependencies.',
      `function Chat({ room, theme }) {
  const onConnected = React.useEffectEvent(() => {
    console.log("connected to " + room + " (theme: " + theme + ")");
  });
  React.useEffect(() => {
    console.log("connect " + room);
    const t = setTimeout(onConnected, 5);
    return () => { clearTimeout(t); console.log("disconnect " + room); };
  }, [room]);
  return <p>{room}</p>;
}
function App() {
  const [theme, setTheme] = React.useState("light");
  return <div>
    <button id="b" onClick={() => setTheme("dark")}>dark</button>
    <Chat room="general" theme={theme} />
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#b", 2);`,
      `<p>The effect must reconnect when <code>room</code> changes, but not when <code>theme</code> changes. If it read <code>theme</code> directly, the linter would ask you to add it to the dependencies, and changing the theme would reconnect.</p>
<p><code>useEffectEvent(fn)</code> (React 19.2) returns a function that always calls the <b>latest</b> <code>fn</code>:</p>
<ul><li>Inside, the hook keeps a box <code>{ impl }</code>. Each render gives it a new callback, and React puts it in the box <b>during the commit</b>, before any effect runs (never during render, because a render can be thrown away).</li>
<li>So the timer, started with the first render's values, prints the <b>new</b> theme.</li>
<li>Call it only from effects (not during render, and don't put it in dependency arrays).</li></ul>`,
      { q: 'Which theme does the timer print?', options: ['light', 'dark', 'undefined', 'it never prints'], answer: 1, why: 'The click re-rendered Chat with theme dark, and the commit pointed the event function at the new callback before the timer fired. The effect did not run again (room did not change).' }),

    // ---- part 8: every remaining concept
    L('r-immutable', '🧊', 'Updating objects and arrays in state', 'Immutability and Object.is', 2,
      'Mutate a state object and see nothing happen; copy it and see React re-render.',
      `function App() {
  const [user, setUser] = React.useState({ name: "Ada", tags: ["admin"] });
  console.log("render", user.name, user.tags.join(","));
  return <div>
    <button id="mutate" onClick={() => { user.name = "Bob"; setUser(user); }}>mutate</button>
    <button id="copy" onClick={() => setUser({ ...user, tags: [...user.tags, "dev"] })}>copy</button>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#mutate", 10);
simulateClick("#copy", 20);`,
      `<p>React decides whether state changed with <code>Object.is(old, new)</code>. It never looks inside the object.</p>
<ul><li><b>mutate</b>: <code>user.name = "Bob"</code> changes the same object, then <code>setUser(user)</code> passes that same object. <code>Object.is</code> says "same", so React <b>bails out</b>: no render, and the screen is now out of date.</li>
<li><b>copy</b>: <code>{ ...user, tags: [...user.tags, "dev"] }</code> is a new object with a new array, so React renders. It also shows the mutated name, because the old object was changed in place.</li></ul>
<p>Rule: treat state as read-only. Copy with spread (<code>{...obj}</code>, <code>[...arr]</code>), <code>map</code>, <code>filter</code>, <code>concat</code>, or <code>structuredClone</code>; libraries like Immer write the copy for you.</p>`,
      { q: 'How many times does App render in total?', options: ['1', '2', '3', '4'], answer: 1, why: 'Once on mount, and once for "copy". The mutate click passes the same object, so React skips the render.' }),

    L('r-resetstate', '🔁', 'Preserving and resetting state', 'Same position keeps state, a new key resets it', 2,
      'See state survive when props change, and reset it on purpose with a key.',
      `function Counter({ id, label }) {
  const [n, setN] = React.useState(0);
  return <button id={id} onClick={() => setN(n + 1)}>{label}: {n}</button>;
}
function App() {
  const [who, setWho] = React.useState("Ada");
  return <div>
    <button id="swap" onClick={() => setWho(who === "Ada" ? "Bob" : "Ada")}>swap</button>
    <Counter id="same" label={who} />
    <Counter id="keyed" key={who} label={who} />
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#same", 10);
simulateClick("#keyed", 12);
simulateClick("#swap", 20);
setTimeout(() => console.log(document.getElementById("same").textContent, "/", document.getElementById("keyed").textContent), 40);`,
      `<p>State belongs to a <b>position in the tree</b> (a fiber), not to the component's props.</p>
<ul><li>The first Counter is the same type at the same position after the swap, so React keeps its fiber, and with it the count. Only the label changes.</li>
<li>The second Counter has <code>key={who}</code>. A different key means "a different component": React deletes the old fiber (state gone) and mounts a new one at 0.</li></ul>
<p>Use a key to reset a form or a chat when the user switches to another item. Never use a random key (<code>key={Math.random()}</code>): it remounts on every render.</p>`,
      { q: 'What do the two buttons show after the swap?', options: ['Bob: 1 / Bob: 1', 'Bob: 0 / Bob: 0', 'Bob: 1 / Bob: 0', 'Ada: 1 / Bob: 0'], answer: 2, why: 'The unkeyed Counter keeps its fiber and state (1). The keyed one got a new key, so it was remounted with 0.' }),

    L('r-derived', '🧮', 'You might not need an effect', 'Derive values during render', 2,
      'Compare copying props into state with an effect against computing the value during render.',
      `function WithEffect({ items }) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => setCount(items.length), [items]);
  console.log("effect version renders, count =", count);
  return <p>{count}</p>;
}
function Derived({ items }) {
  const count = items.length; // just compute it
  console.log("derived version renders, count =", count);
  return <p>{count}</p>;
}
const items = ["a", "b", "c"];
${ROOT}.render(<div><WithEffect items={items} /><Derived items={items} /></div>);`,
      `<p>The effect version renders <b>twice</b>: first with the wrong value (0), commits it to the screen, then the effect sets state and React renders and commits again.</p>
<p>The derived version computes the value <b>during render</b>: one render, always right, no extra state to keep in sync.</p>
<ul><li>If a value can be computed from props or state, compute it (use <code>useMemo</code> only if it is expensive).</li>
<li>To reset state when a prop changes, use a <code>key</code> instead of an effect.</li>
<li>Effects are for synchronising with things <b>outside</b> React: the network, timers, subscriptions, the DOM.</li></ul>`,
      { q: 'How many times does WithEffect render?', options: ['1', '2', '3', 'it loops forever'], answer: 1, why: 'Once with 0, then the effect sets 3 and it renders again. The dependency [items] does not change, so it stops there.' }),

    L('r-race', '🏁', 'Fetching in effects: race conditions', 'The ignore flag in the cleanup', 3,
      'Switch quickly between two requests and see a slow, stale response being ignored.',
      `const delays = { a: 30, b: 10 };
function fetchUser(id) {
  return new Promise(resolve => setTimeout(() => resolve("user " + id), delays[id]));
}
function Profile({ id }) {
  const [user, setUser] = React.useState("loading");
  React.useEffect(() => {
    let ignore = false;
    fetchUser(id).then(u => {
      if (!ignore) setUser(u);
      else console.log("ignored stale", u);
    });
    return () => { ignore = true; };
  }, [id]);
  return <p id="p">{user}</p>;
}
function App() {
  const [id, setId] = React.useState("a");
  return <div><button id="b" onClick={() => setId("b")}>b</button><Profile id={id} /></div>;
}
${ROOT}.render(<App />);
simulateClick("#b", 5);
setTimeout(() => console.log("shown:", document.getElementById("p").textContent), 60);`,
      `<p>Request <b>a</b> is slow (30 ms) and request <b>b</b> is fast (10 ms). After the click, b answers first, then a arrives late. Without protection, the late a would overwrite b: the screen would show the wrong user.</p>
<ul><li>Each effect run has its own <code>ignore</code> variable (a closure).</li>
<li>When <code>id</code> changes, React runs the <b>cleanup</b> of the old effect first, which sets <i>its</i> <code>ignore</code> to true.</li>
<li>So the old request's answer is dropped. <code>AbortController</code> does the same and also cancels the request.</li></ul>
<p>Data libraries (React Query, SWR) and frameworks do this for you, plus caching and de-duplication.</p>`,
      { q: 'What is shown at the end?', options: ['user a', 'user b', 'loading', 'user a, then user b'], answer: 1, why: 'The cleanup of the effect for "a" set its ignore flag, so the late answer for a is dropped and "user b" stays.' }),

    L('r-uncontrolled', '📝', 'Uncontrolled inputs and defaultValue', 'The DOM keeps the value; read it with a ref', 2,
      'Let the input keep its own value, and read it with a ref when you need it.',
      `function Form() {
  const inputRef = React.useRef(null);
  const [saved, setSaved] = React.useState("");
  return <div>
    <input id="name" defaultValue="Ada" ref={inputRef} />
    <button id="save" onClick={() => setSaved(inputRef.current.value)}>save</button>
    <p id="out">{saved}</p>
  </div>;
}
${ROOT}.render(<Form />);
simulateTyping("#name", "Grace", 10);
simulateClick("#save", 20);
setTimeout(() => {
  console.log("saved:", document.getElementById("out").textContent);
  console.log("input still shows:", document.getElementById("name").value);
}, 40);`,
      `<p>An <b>uncontrolled</b> input has no <code>value</code> prop: the DOM keeps what the user typed. <code>defaultValue</code> only sets the starting value, once, on mount.</p>
<ul><li>React does not re-render while you type (there is no state for it).</li>
<li>Read the value when you need it: with a <code>ref</code>, or from the form with <code>new FormData(form)</code>.</li>
<li>Re-renders do not reset it: <code>defaultValue</code> is ignored after the first render.</li></ul>
<p>Controlled (<code>value</code> + <code>onChange</code>): React owns the value, good for validation and formatting as you type. Uncontrolled: simpler and faster for plain forms. Switching one input between the two triggers a warning.</p>`,
      { q: 'After the re-render caused by "save", what does the input show?', options: ['Ada (defaultValue again)', 'Grace', 'empty', 'an error'], answer: 1, why: 'defaultValue is only used on mount. The DOM keeps what the user typed.' }),

    L('r-hoc', '🎁', 'Higher-order components', 'A function that wraps a component', 2,
      'Wrap a component in a function that adds behaviour, and see the extra layer in the tree.',
      `function withLogger(Component) {
  function WithLogger(props) {
    console.log("render", Component.name, "with", JSON.stringify(props));
    return <Component {...props} />;
  }
  return WithLogger;
}
function Hello({ name }) {
  return <b>Hello {name}</b>;
}
const LoggedHello = withLogger(Hello); // create it once, outside render
${ROOT}.render(<LoggedHello name="Ada" />);
setTimeout(() => console.log(document.getElementById("root").innerHTML), 20);`,
      `<p>A <b>higher-order component</b> (HOC) is a function that takes a component and returns a new one that renders it with extra props or behaviour (<code>connect()</code> in old Redux, <code>withRouter</code>).</p>
<ul><li>The Fibers tab shows an extra fiber: <code>WithLogger</code> → <code>Hello</code>. Every HOC adds a layer.</li>
<li>Create it <b>once</b>, outside render. <code>withLogger(Hello)</code> inside a component makes a new component type on every render, so React remounts it and loses its state.</li>
<li>Pass the props through (<code>{...props}</code>), and forward refs if needed.</li></ul>
<p>Today custom hooks usually replace HOCs: <code>const user = useUser()</code> shares logic without extra layers or name clashes.</p>`,
      { q: 'Why must withLogger(Hello) not be called inside the render of a component?', options: ['It is slow', 'It returns a new component type each time, so React remounts it and loses state', 'Hooks are not allowed', 'It throws'], answer: 1, why: 'React compares element types with ===. A new function each render is a new type, so the old subtree is deleted and a new one mounted.' }),

    L('r-ref19', '🎯', 'ref as a prop and ref cleanups', 'React 19 refs', 2,
      'Pass a ref to a function component as a normal prop, and clean up a callback ref.',
      `function MyInput({ placeholder, ref }) {
  return <input placeholder={placeholder} ref={ref} />; // React 19: no forwardRef needed
}
function App() {
  const inputRef = React.useRef(null);
  const [show, setShow] = React.useState(true);
  return <div>
    <MyInput placeholder="name" ref={inputRef} />
    {show && <div ref={node => {
      console.log("attached", node.textContent);
      return () => console.log("cleanup");          // React 19: called instead of ref(null)
    }}>box</div>}
    <button id="read" onClick={() => console.log("inputRef points to the input:", inputRef.current.placeholder)}>read</button>
    <button id="hide" onClick={() => setShow(false)}>hide</button>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#read", 10);
simulateClick("#hide", 20);`,
      `<p>Two React 19 changes:</p>
<ul><li><b>ref is a prop</b> of function components: <code>function MyInput({ ref })</code>. <code>forwardRef</code> still works but is no longer needed. (Class components still get the ref as their instance.)</li>
<li><b>Callback refs can return a cleanup</b>. React calls the ref with the node after it is in the DOM (layout phase), and calls the returned function when the node is removed or the ref changes, instead of calling the ref with <code>null</code>.</li></ul>
<p>Refs are attached in the commit's <b>layout</b> part, before <code>useLayoutEffect</code> runs, and detached during the mutation part.</p>`,
      { q: 'When does "cleanup" print?', options: ['Right after "attached"', 'When the div is removed', 'Never', 'On every click'], answer: 1, why: 'The cleanup returned by the callback ref runs when React detaches the ref: here, when the div is deleted.' }),

    L('r-context19', '🎨', '<Context> as a provider and use(context)', 'React 19 context', 2,
      'Provide a context with <Theme value> and read it with use(), even after an early return.',
      `const Theme = React.createContext("light");
function Label() {
  const theme = React.use(Theme);
  return <b>{theme}</b>;
}
function Panel({ show }) {
  if (!show) return <i>hidden</i>;
  const theme = React.use(Theme); // use() can be called after an early return
  return <p>panel {theme}</p>;
}
${ROOT}.render(
  <Theme value="dark">
    <Label />
    <Panel show={true} />
  </Theme>
);
setTimeout(() => console.log(document.getElementById("root").innerHTML), 20);`,
      `<p>In React 19 the context object <b>is</b> the provider: <code>&lt;Theme value="dark"&gt;</code> instead of <code>&lt;Theme.Provider&gt;</code>. It makes the same ContextProvider fiber.</p>
<ul><li><code>use(Theme)</code> reads the nearest provider's value, like <code>useContext</code>, and records the dependency on the fiber, so a change of the value re-renders it.</li>
<li>Unlike other hooks, <code>use</code> may be called inside <code>if</code> and after an early return. (It still must be called during render.)</li></ul>`,
      { q: 'What does Label render?', options: ['light', 'dark', 'undefined', 'an error: use() is for promises'], answer: 1, why: 'The nearest provider above Label gives "dark". use() accepts a context as well as a promise.' }),

    L('r-metadata', '📄', 'Document metadata: <title> and <meta>', 'React 19 hoists them into <head>', 2,
      'Render a <title> inside a component and see React put it in the document head.',
      `function BlogPost({ title }) {
  return <article>
    <title>{title}</title>
    <meta name="author" content="Ada" />
    <h1>{title}</h1>
  </article>;
}
${ROOT}.render(<BlogPost title="Hello React 19" />);
setTimeout(() => {
  const inHead = [...document.head.children];
  console.log("title in <head>:", inHead.some(e => e.tagName === "TITLE" && e.textContent === "Hello React 19"));
  console.log("meta in <head>:", inHead.some(e => e.tagName === "META" && e.getAttribute("content") === "Ada"));
  console.log("body:", document.getElementById("root").innerHTML);
}, 20);`,
      `<p>React 19 treats <code>&lt;title&gt;</code>, <code>&lt;meta&gt;</code> and <code>&lt;link&gt;</code> as <b>document metadata</b>: wherever they are rendered, React puts their DOM node into <code>&lt;head&gt;</code>, and removes it when the component unmounts.</p>
<ul><li>So a page component can set its own title without a library like react-helmet.</li>
<li>The fiber stays where you wrote it (see the Fibers tab); only its DOM node lives in the head.</li>
<li>Stylesheets with <code>precedence</code> and scripts with <code>async</code> get extra treatment in real React (ordering and de-duplication); ReactLite only moves the nodes.</li></ul>`,
      { q: 'Where is the <title> element in the DOM?', options: ['inside <article>', 'in <head>', 'nowhere, it is ignored', 'in both'], answer: 1, why: 'React 19 hoists title, meta and link elements into document.head.' }),

    L('r-profiler', '⏱️', 'Profiler: measuring renders', 'onRender after each commit', 3,
      'Wrap a list in <Profiler> and see which commits rendered how much of it.',
      `function Item({ n }) { return <li>{n}</li>; }
const MemoItem = React.memo(Item);
function List({ count }) {
  return <ul>{[1, 2, 3].map(i => <MemoItem key={i} n={i} />)}<li>{count}</li></ul>;
}
function App() {
  const [count, setCount] = React.useState(0);
  const onRender = (id, phase, actual, base) => console.log(id, phase, "- rendered", actual, "of", base, "components");
  return <div>
    <button id="b" onClick={() => setCount(count + 1)}>+</button>
    <React.Profiler id="list" onRender={onRender}>
      <List count={count} />
    </React.Profiler>
  </div>;
}
${ROOT}.render(<App />);
simulateClick("#b", 10);`,
      `<p><code>&lt;Profiler id onRender&gt;</code> calls <code>onRender(id, phase, actualDuration, baseDuration, startTime, commitTime)</code> after every commit in which something inside it rendered.</p>
<ul><li><b>phase</b>: <code>"mount"</code> the first time, then <code>"update"</code>.</li>
<li><b>actualDuration</b>: time spent rendering the subtree in this commit. Memoization makes it smaller.</li>
<li><b>baseDuration</b>: how long the whole subtree would take without any memoization (the worst case).</li></ul>
<p class="tip">ReactLite has no real clock, so it counts <b>1 per component</b> instead of milliseconds. You can still see memo working: the update rendered only List, not the three memo items. In real apps use the React DevTools Profiler, which uses the same data.</p>`,
      { q: 'What does the update print?', options: ['rendered 4 of 4', 'rendered 1 of 4', 'rendered 0 of 4', 'nothing'], answer: 1, why: 'List re-renders because its count prop changed; the three MemoItems get the same props and are skipped.' }),

    L('r-compiler', '🤖', 'React Compiler: automatic memoization', 'useMemoCache and cache slots', 3,
      'Read the code the React Compiler generates, and watch it skip work with its cache slots.',
      `import { c as _c } from "react/compiler-runtime";
// What the React Compiler makes of:
//   function Total({ items }) {
//     const total = items.reduce((s, x) => s + x, 0);
//     return <b>{total}</b>;
//   }
function Total({ items }) {
  const $ = _c(4);                 // 4 cache slots, kept on the fiber
  let total;
  if ($[0] !== items) {            // input changed? recompute
    console.log("computing total");
    total = items.reduce((s, x) => s + x, 0);
    $[0] = items;
    $[1] = total;
  } else total = $[1];             // same input: reuse
  let el;
  if ($[2] !== total) {
    el = <b>{total}</b>;
    $[2] = total;
    $[3] = el;
  } else el = $[3];                // the SAME element object as last time
  return el;
}
const items = [1, 2, 3];
function App() {
  const [n, setN] = React.useState(0);
  return <div><button id="b" onClick={() => setN(n + 1)}>{n}</button><Total items={items} /></div>;
}
${ROOT}.render(<App />);
simulateClick("#b", 10);
setTimeout(() => console.log("shown:", document.querySelector("b").textContent), 30);`,
      `<p>The <b>React Compiler</b> (a Babel plugin, stable since 2025) rewrites your components at build time so you don't write <code>useMemo</code>, <code>useCallback</code> or <code>memo</code> yourself.</p>
<ul><li><code>_c(4)</code> (<code>useMemoCache</code>) gives the component an array of 4 slots, stored on its fiber like a hook. They start as a "not computed" sentinel.</li>
<li>For each value, the compiler saves the inputs next to the result and recomputes only when an input changed (<code>!==</code>).</li>
<li>It also caches JSX: returning the <b>same element object</b> lets React bail out of the child without comparing props.</li></ul>
<p>It only works if your components follow the rules (pure render, no mutation of props or state): the same rules this whole lab is about.</p>`,
      { q: 'How many times is "computing total" printed?', options: ['0', '1', '2', 'on every click'], answer: 1, why: 'On the re-render, items is the same array, so slot 0 matches and the saved total is reused.' }),

    L('r-streaming', '🌊', 'Streaming server rendering', 'Shell first, Suspense content later', 3,
      'Stream a page: the shell with a fallback goes out first, the slow part follows in its own chunk.',
      `const comments = new Promise(resolve => setTimeout(() => resolve(["Ada", "Grace"]), 30));
function Comments() {
  const names = React.use(comments); // suspends until the data is ready
  return <ul>{names.map(n => <li key={n}>{n}</li>)}</ul>;
}
function Page() {
  return <main>
    <h1>Blog post</h1>
    <React.Suspense fallback={<p>Loading comments…</p>}>
      <Comments />
    </React.Suspense>
  </main>;
}
const { pipe } = ReactDOMServer.renderToPipeableStream(<Page />, {
  onShellReady() {
    console.log("shell ready");
    pipe({ write: chunk => console.log("chunk:", chunk), end: () => console.log("end") });
  },
});`,
      `<p><code>renderToString</code> must finish everything before it sends anything. <b>Streaming</b> (<code>renderToPipeableStream</code> in Node, <code>renderToReadableStream</code> in edge runtimes) sends HTML as it becomes ready:</p>
<ol><li>The <b>shell</b>: everything outside waiting Suspense boundaries, with each boundary's <b>fallback</b> and a placeholder <code>&lt;template id="B:0"&gt;</code>. The browser shows it at once.</li>
<li>When a boundary's data arrives, React renders it and sends one more chunk: the HTML in a hidden <code>&lt;div id="S:0"&gt;</code> plus a tiny script, <code>$RC("B:0","S:0")</code>, that moves it into place and removes the fallback. No JavaScript bundle is needed for that.</li>
<li>On the client, <code>hydrateRoot</code> can hydrate each boundary as soon as it arrives (<b>selective hydration</b>), starting with the one the user clicks.</li></ol>
<p>Frameworks like Next.js do this for you (<code>loading.js</code> is a Suspense fallback).</p>`,
      { q: 'What does the first chunk contain where the comments will go?', options: ['the comments', 'nothing', 'the fallback "Loading comments…"', 'an error'], answer: 2, why: 'The shell is sent before the data is ready, with the Suspense fallback in place of the comments.' }),

    L('r-boundarylimits', '🧱', 'What error boundaries do not catch', 'Render errors only', 3,
      'See a boundary catch a render error but not an error in an event handler.',
      `class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error ? <p>caught: {this.state.error.message}</p> : this.props.children;
  }
}
function Buttons() {
  const [crash, setCrash] = React.useState(false);
  if (crash) throw new Error("render crash");
  return <div>
    <button id="click" onClick={() => {
      try { throw new Error("click crash"); }
      catch (e) { console.log("handler errors are yours to catch:", e.message); }
    }}>handler</button>
    <button id="later" onClick={() => setTimeout(() => setCrash(true), 5)}>later</button>
  </div>;
}
${ROOT}.render(<Boundary><Buttons /></Boundary>);
simulateClick("#click", 10);
simulateClick("#later", 20);
setTimeout(() => console.log(document.getElementById("root").textContent), 50);`,
      `<p>An error boundary only catches errors thrown <b>while React renders</b> (and in lifecycle methods and constructors) of the components <b>below</b> it. It does not catch:</p>
<ul><li>errors in <b>event handlers</b>: they run outside rendering; use <code>try/catch</code>;</li>
<li>errors in <b>async code</b> (timers, promises): catch them, or put the error into state so that the next render throws it, as the "later" button does;</li>
<li>errors in <b>server rendering</b>, and errors in the boundary itself (only a boundary above it can catch those).</li></ul>
<p>React 19 adds <code>createRoot(el, { onCaughtError, onUncaughtError })</code> to report errors to a logging service.</p>`,
      { q: 'What is on the page at the end?', options: ['the two buttons', 'caught: click crash', 'caught: render crash', 'an empty page'], answer: 2, why: 'The handler error was caught by try/catch. The timer set state, the next render threw, and the boundary caught that render error.' }),

    L('r-listdiff', '🧩', 'How React diffs a list', 'Two passes and lastPlacedIndex', 3,
      'Move one item to the end, then to the front, and see why one is cheap and the other is not.',
      `function App() {
  const [items, setItems] = React.useState(["a", "b", "c", "d"]);
  return <div>
    <button id="end" onClick={() => setItems(["b", "c", "d", "a"])}>a to the end</button>
    <button id="back" onClick={() => setItems(["a", "b", "c", "d"])}>a back to the front</button>
    <ul>{items.map(x => <li key={x}>{x}</li>)}</ul>
  </div>;
}
${ROOT}.render(<App />);
const nodes = () => [...document.querySelectorAll("li")];
let first;
setTimeout(() => { first = nodes(); }, 5);
simulateClick("#end", 10);
setTimeout(() => console.log("order:", nodes().map(n => n.textContent).join(""), "/ same DOM nodes:", nodes().every(n => first.includes(n))), 20);
simulateClick("#back", 30);
setTimeout(() => console.log("order:", nodes().map(n => n.textContent).join("")), 40);`,
      `<p><code>reconcileChildrenArray</code> is React's list diff. It is not a full "minimum moves" algorithm: it is one quick pass and one lookup pass.</p>
<ol><li><b>Pass 1</b>: walk old and new children side by side while the keys match (the common case: nothing moved).</li>
<li>At the first mismatch, put the remaining old children in a <b>Map by key</b>, and for each new child look it up: found → reuse the fiber; not found → create one. Old children never looked up are deleted.</li>
<li>Moves: React remembers <code>lastPlacedIndex</code>, the highest old index kept so far. A reused child whose old index is <b>smaller</b> must move; otherwise it stays and becomes the new <code>lastPlacedIndex</code>.</li></ol>
<p>So "a to the end" moves 1 node (a), but "a back to the front" moves 3 (b, c and d), because a is kept first at old index 3. Step to each reconciliation and open the Inside tab: the table shows each decision.</p>`,
      { q: 'Moving the LAST item to the FRONT: how many DOM moves?', options: ['1', 'all the others', '0', 'every item is recreated'], answer: 1, why: 'The moved item is kept first with a high old index, so every following item has a smaller old index and must move.' }),

    L('r-prerender', '🌙', 'Activity: preparing hidden content', 'The Offscreen lane', 3,
      'Start a panel hidden and see React render it in the background, without running its effects.',
      `function Details() {
  console.log("render Details");
  React.useEffect(() => { console.log("Details effect"); }, []);
  return <p id="d">details</p>;
}
function App() {
  const [open, setOpen] = React.useState(false);
  console.log("render App");
  return <div>
    <button id="open" onClick={() => setOpen(true)}>open</button>
    <React.Activity mode={open ? "visible" : "hidden"}>
      <Details />
    </React.Activity>
  </div>;
}
${ROOT}.render(<App />);
setTimeout(() => {
  const d = document.getElementById("d");
  console.log("before opening: in the DOM", !!d, "| display", d.style.display);
}, 20);
simulateClick("#open", 30);`,
      `<p>When an <code>&lt;Activity mode="hidden"&gt;</code> starts hidden, React first renders and paints only what is visible. Then it schedules another render at the <b>Offscreen lane</b> (bit 29, the lowest priority) to prepare the hidden part in the background:</p>
<ul><li>the hidden components render and their DOM is created, but kept with <code>display: none</code>;</li>
<li>their <b>effects do not run</b> while hidden (no subscriptions or requests for things nobody sees);</li>
<li>when it becomes visible, the DOM is already there: React shows it and runs the effects.</li></ul>
<p>Use it for the next tab or page the user will probably open, so the switch is instant. Being the lowest priority, this work never delays anything the user is waiting for.</p>`,
      { q: 'When does "Details effect" print?', options: ['During the background render', 'Only after the panel is opened', 'Never', 'Before render App'], answer: 1, why: 'Effects never run inside hidden content. They run when the Activity becomes visible.' }),

    L('r-rooterrors', '📮', 'Reporting errors: onCaughtError and onUncaughtError', 'React 19 root options', 2,
      'Send caught and uncaught render errors to your own logging code with createRoot options.',
      `class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>something went wrong</p> : this.props.children; }
}
function Bad() { throw new Error("broken widget"); }
const log = [];
const root = ReactDOM.createRoot(document.getElementById("root"), {
  onCaughtError: (error, info) => console.log("caught by a boundary:", error.message, "| boundary:", info.errorBoundary.constructor.name),
  onUncaughtError: (error) => console.log("not caught:", error.message, "-> the app was removed"),
});
root.render(<Boundary><Bad /></Boundary>);
setTimeout(() => root.render(<Bad />), 20);
setTimeout(() => console.log("page:", JSON.stringify(document.getElementById("root").innerHTML)), 40);`,
      `<p>In React 19, <code>createRoot</code> and <code>hydrateRoot</code> take options to report errors, for example to Sentry:</p>
<ul><li><code>onCaughtError(error, { componentStack, errorBoundary })</code>: an error boundary caught a render error (the boundary still shows its fallback);</li>
<li><code>onUncaughtError(error, { componentStack })</code>: no boundary caught it, so React removed the whole app;</li>
<li><code>onRecoverableError(error)</code>: React recovered by itself, for example after a hydration mismatch it rendered on the client instead.</li></ul>
<p>Without these options React logs caught and recoverable errors with <code>console.error</code> and reports uncaught ones like any uncaught error (<code>window.onerror</code>).</p>`,
      { q: 'Which option receives the error when there is no error boundary?', options: ['onCaughtError', 'onUncaughtError', 'onRecoverableError', 'componentDidCatch'], answer: 1, why: 'Nothing caught it, so React unmounts the app and calls onUncaughtError.' }),

    L('r-devtools', '🔎', 'What React DevTools shows', 'Components, hooks, useDebugValue, Profiler', 2,
      'Label a custom hook with useDebugValue and find everything DevTools shows in this lab.',
      `function useOnlineStatus() {
  const [online, setOnline] = React.useState(true);
  React.useDebugValue(online ? "Online" : "Offline"); // a label for DevTools
  return [online, setOnline];
}
function StatusBar() {
  const [online, setOnline] = useOnlineStatus();
  return <button id="b" onClick={() => setOnline(!online)}>{online ? "✅ online" : "❌ offline"}</button>;
}
${ROOT}.render(<StatusBar />);
simulateClick("#b", 10);
setTimeout(() => console.log(document.getElementById("b").textContent), 20);`,
      `<p><b>React DevTools</b> (a browser extension) reads the same fiber tree you see in this lab:</p>
<ul><li><b>Components</b> panel = the <b>Fibers</b> tab here: every component with its props, state and the component that rendered it.</li>
<li><b>Hooks</b> = the <b>Hooks</b> tab: each hook in call order. <code>useDebugValue(value, format?)</code> adds a label to a custom hook: here "Online" / "Offline" next to <code>useOnlineStatus</code>. Use it in shared hooks only; <code>format</code> is called only when DevTools looks, for expensive labels.</li>
<li><b>Profiler</b> panel = the <code>&lt;Profiler&gt;</code> data: which commit rendered which components and why ("props changed", "hook 1 changed").</li>
<li>"Highlight updates when components render" shows the same thing as the render steps here.</li></ul>`,
      { q: 'Does useDebugValue change what the user sees?', options: ['Yes, it shows a label on the page', 'No, it only labels the hook in DevTools', 'It re-renders the component', 'It logs to the console'], answer: 1, why: 'useDebugValue has no effect on rendering: it only gives DevTools a label for the custom hook.' }),

    L('r-selectivehydration', '⚡', 'Selective hydration', 'Hydrate the part the user touches first', 3,
      'Click inside a Suspense boundary before it is hydrated and see React hydrate it first and replay the click.',
      `function Comments() {
  const [likes, setLikes] = React.useState(0);
  return <button id="like" onClick={() => setLikes(likes + 1)}>likes {likes}</button>;
}
function Page() {
  return <main>
    <h1>Post</h1>
    <React.Suspense fallback={<p>…</p>}>
      <Comments />
    </React.Suspense>
  </main>;
}
const root = document.getElementById("root");
root.innerHTML = ReactDOMServer.renderToString(<Page />); // the HTML the server sent
ReactDOM.hydrateRoot(root, <Page />);
simulateClick("#like", 0); // the user clicks before that part is hydrated
setTimeout(() => console.log(document.getElementById("like").textContent), 30);`,
      `<p>Hydration does not have to happen all at once. Each <b>Suspense boundary</b> can be hydrated on its own:</p>
<ol><li>React hydrates the page outside the boundaries first. Each server-rendered boundary (<code>&lt;!--$--&gt;…&lt;!--/$--&gt;</code>) is left as plain server HTML: it is <b>dehydrated</b>.</li>
<li>After that commit, React schedules one more render per boundary to hydrate it later.</li>
<li>If the user clicks inside a boundary that is not hydrated yet, React hydrates <b>that</b> one right away, at Sync priority, then <b>replays</b> the click on the now-working components. The click is not lost.</li></ol>
<p>With streaming, boundaries are hydrated as their HTML arrives. Wrapping slow or heavy parts in <code>&lt;Suspense&gt;</code> lets the rest of the page become interactive sooner.</p>`,
      { q: 'What does the button show after the early click?', options: ['likes 0: the click was lost', 'likes 1: React hydrated the boundary and replayed the click', 'an error', 'nothing'], answer: 1, why: 'React noticed the click on dehydrated HTML, hydrated that boundary first, then ran the click on it.' }),

    L('r-resources', '🔗', 'Loading resources: preload and stylesheet precedence', 'React 19 resource APIs', 2,
      'Tell the browser early what it will need, and render stylesheets anywhere without duplicates.',
      `function Page() {
  ReactDOM.preconnect("https://cdn.example.com");
  ReactDOM.preload("https://cdn.example.com/font.woff2", { as: "font" });
  return <div>
    <link rel="stylesheet" href="/base.css" precedence="low" />
    <Card />
    <Card />
  </div>;
}
function Card() {
  return <section>
    <link rel="stylesheet" href="/card.css" precedence="high" />
    card
  </section>;
}
${ROOT}.render(<Page />);
setTimeout(() => {
  const links = [...document.head.children].filter(e => e.tagName === "LINK");
  console.log(links.map(l => l.getAttribute("rel") + " " + l.getAttribute("href")).join(" | "));
}, 20);`,
      `<p>React 19 adds functions in <code>react-dom</code> that add hints to <code>&lt;head&gt;</code> so the browser can start early, each only once:</p>
<ul><li><code>preconnect(url)</code>, <code>prefetchDNS(url)</code>: open the connection to another server now.</li>
<li><code>preload(url, { as })</code>: download a font, image or script you will need soon. <code>preinit(url, { as: "style" | "script" })</code>: download <i>and</i> apply it.</li></ul>
<p>A <code>&lt;link rel="stylesheet" precedence="…"&gt;</code> can be rendered by any component:</p>
<ul><li>React puts it in the head <b>once</b>, however many components render it (both Cards use card.css: one tag);</li>
<li>it groups sheets by <code>precedence</code>, in the order each precedence was first seen, so the CSS order is predictable;</li>
<li>it does not remove it when the component unmounts. (Real React also waits for the sheet to load before showing the content that needs it.)</li></ul>`,
      { q: 'How many <link> tags for card.css end up in the head?', options: ['0', '1', '2', 'one per render'], answer: 1, why: 'Stylesheets with a precedence are de-duplicated by href: two Cards, one tag.' }),

    L('r-cache', '🗃️', 'cache(): one request, one fetch', 'Sharing data between server components', 3,
      'Let two server components ask for the same user and see the database queried only once.',
      `let queries = 0;
const getUser = React.cache(async id => {
  queries++;
  await new Promise(r => setTimeout(r, 5)); // the database
  return { id, name: "Ada" };
});
async function Avatar({ id }) {
  const user = await getUser(id);
  return <img alt={user.name} />;
}
async function Name({ id }) {
  const user = await getUser(id);
  return <b>{user.name}</b>;
}
function Profile() {
  return <div><Avatar id={1} /><Name id={1} /></div>;
}
ReactServer.renderToFlight(<Profile />).then(payload => {
  console.log("database queries:", queries);
  console.log(payload);
});`,
      `<p>In server components, several components often need the same data. Passing it down as props gets clumsy; fetching it in each one would query twice.</p>
<ul><li><code>cache(fn)</code> returns a wrapped function. During one server request, calling it again with the same arguments returns the <b>same result</b> (here the same Promise) instead of running <code>fn</code> again.</li>
<li>Arguments are compared like <code>Object.is</code>: primitives by value, objects by identity.</li>
<li>The memory lasts for <b>one request</b> only, so users never see each other's data, and it does nothing outside server components.</li></ul>
<p>Define the cached function once, at module level, and share it: calling <code>cache()</code> inside a component creates a new, empty cache each time.</p>`,
      { q: 'How many database queries run?', options: ['0', '1', '2', 'one per render'], answer: 1, why: 'Both components call getUser(1) in the same request; the second call gets the cached result.' }),

    L('r-static', '🏗️', 'Static pre-rendering: prerender()', 'react-dom/static waits for the data', 2,
      'Compare renderToString, which sends fallbacks, with prerender, which waits for all the data.',
      `import { prerender } from "react-dom/static";
let posts = null;
const loading = new Promise(r => setTimeout(() => { posts = ["Hello", "World"]; r(); }, 20));
function Posts() {
  if (posts === null) throw loading; // not ready yet: suspend
  return <ul>{posts.map(p => <li key={p}>{p}</li>)}</ul>;
}
const page = <main><h1>Blog</h1><React.Suspense fallback={<p>Loading…</p>}><Posts /></React.Suspense></main>;
console.log("renderToString:", ReactDOMServer.renderToString(page));
prerender(page).then(({ prelude }) => console.log("prerender:", prelude));`,
      `<p>Three ways to make HTML on the server:</p>
<ul><li><code>renderToString</code>: renders once, can't wait: a suspended boundary is sent as its <b>fallback</b>, and the browser renders the content later.</li>
<li><b>Streaming</b> (<code>renderToPipeableStream</code>): sends the fallback first, then the content in a later chunk of the same response.</li>
<li><code>prerender</code> (<code>react-dom/static</code>, React 19): <b>waits</b> for every boundary, so the HTML is complete. Use it at build time (static site generation): the file can be served to everyone from a CDN.</li></ul>
<p>React 19.2 adds <b>partial pre-rendering</b>: pre-render the static shell at build time, then <code>resume</code> it per request to fill in the dynamic parts. In real React, <code>prelude</code> is a stream; here it is a string.</p>`,
      { q: 'Does the prerender HTML contain "Loading…"?', options: ['Yes', 'No: it waited for the posts', 'Both versions do', 'It is empty'], answer: 1, why: 'prerender waits for the suspended data and renders again, so the final HTML has the list instead of the fallback.' }),

    L('r-formreset', '🧽', 'requestFormReset', 'Reset a form after an action', 2,
      'Save a field in an action and reset the form when the action finishes.',
      `function Note() {
  const [isPending, startTransition] = React.useTransition();
  const formRef = React.useRef(null);
  const [saved, setSaved] = React.useState("");
  function save() {
    startTransition(async () => {
      const text = document.getElementById("note").value;
      await new Promise(r => setTimeout(r, 10)); // send it to the server
      setSaved(text);
      ReactDOM.requestFormReset(formRef.current); // clear the form when the action is done
    });
  }
  return <form ref={formRef}>
    <input id="note" name="note" defaultValue="" />
    <button id="save" type="button" onClick={save}>save</button>
    <p id="out">{isPending ? "saving…" : saved}</p>
  </form>;
}
${ROOT}.render(<Note />);
simulateTyping("#note", "buy milk", 5);
simulateClick("#save", 10);
setTimeout(() => console.log("saved:", document.getElementById("out").textContent, "| field now:", JSON.stringify(document.getElementById("note").value)), 40);`,
      `<p>When a form is submitted through <code>&lt;form action={fn}&gt;</code>, React 19 resets its uncontrolled fields automatically after the action succeeds.</p>
<p>When you run an action yourself (a button with <code>startTransition</code>, as here), call <code>ReactDOM.requestFormReset(form)</code>:</p>
<ul><li>it must be called inside an action or transition, otherwise it throws;</li>
<li>React does not reset at once: it waits until the action has finished, so the user does not lose the input while it is still being saved.</li></ul>`,
      { q: 'What is in the field at the end?', options: ['"buy milk"', 'an empty string', '"saving…"', 'undefined'], answer: 1, why: 'requestFormReset reset the uncontrolled input to its defaultValue ("") when the action finished.' }),

    L('r-overview', '🗺️', 'React in one picture', 'The whole journey of one click', 1,
      'Follow one click all the way through React: update, render, commit, paint, effects. Every other concept zooms into one part of this.',
      `function Counter() {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    console.log("effect: count is", count);
  }, [count]);
  console.log("render, count =", count);
  return <button id="b" onClick={() => setCount(count + 1)}>clicked {count}</button>;
}
${ROOT}.render(<Counter />);
simulateClick("#b", 10);`,
      `<p>Everything React does follows the same path. Step through this program and watch the React panel: its numbered pipeline lights up each part in turn.</p>
<div class="ov-flow">
  <div class="ov-st"><b>1 · Trigger</b><span>a click, a timer, <code>root.render</code></span><em>Events · Event delegation</em></div>
  <div class="ov-st"><b>2 · Update queued</b><span><code>setCount</code> adds an update to the hook's queue and marks the fiber and its parents</span><em>useState · Batching · Updater functions</em></div>
  <div class="ov-st"><b>3 · Scheduled</b><span>the update has a <b>lane</b> (priority): a microtask for a click, a task for the rest</span><em>Lanes · startTransition</em></div>
  <div class="ov-st"><b>4 · Render</b><span>React calls your components and builds a new fiber tree next to the old one. Nothing on screen changes yet; it can pause.</span><em>Fibers · Hooks · Reconciliation · Keys · memo</em></div>
  <div class="ov-st"><b>5 · Commit</b><span>all DOM changes at once, then refs and <code>useLayoutEffect</code>. Never paused.</span><em>The four parts of the commit · Double buffering</em></div>
  <div class="ov-st"><b>6 · Paint</b><span>the browser shows the new screen</span><em>useLayoutEffect vs useEffect</em></div>
  <div class="ov-st"><b>7 · Effects</b><span><code>useEffect</code>: cleanups first, then the new effects</span><em>useEffect · Effect cleanup</em></div>
</div>
<p>When something surprises you in a later concept, find where it sits on this path: "is this happening in the render or in the commit?" answers most React questions.</p>`,
      { q: 'When does "effect: count is 1" print?', options: ['Before the render', 'During the render', 'After the commit and paint', 'Never'], answer: 2, why: 'useEffect runs last: after React has committed the new DOM and the browser has painted it.' }),
  ];

  const levels = ALL.map(x => x.level);
  window.REACT_LEVELS = levels;
  window.JS_LESSONS = window.JS_LESSONS || {};
  window.JS_LEVELS.unshift(...levels);
  ALL.forEach(x => { window.JS_LESSONS[x.level.id] = x.lesson; });
  window.REACT_LEVEL_IDS = levels.map(l => l.id);
  const part = (name, from, to) => ({ name, ids: levels.slice(from, to).map(l => l.id) });
  window.REACT_WORLDS = [
    part('React 1 · Rendering', 0, 12),
    part('React 2 · Hooks & effects', 12, 22),
    part('React 3 · Scheduling & the commit', 22, 30),
    part('React 4 · Classes, errors & Suspense', 30, 38),
    part('React 5 · Advanced patterns & React 19', 38, 46),
    part('React 6 · SSR, forms & the ecosystem', 46, 56),
    part('React 7 · The commit in detail & React 19.2', 56, 60),
    part('React 8 · Every other concept', 60, 83),
  ];
})();
