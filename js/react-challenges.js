/*
 * React Engine Lab — React "machine coding" challenges, like the live-coding round of a frontend interview.
 * You write the component; the checker renders <App />, clicks and types like a user, and compares what is on the page.
 * Every test starts with a fresh page, so each one renders your App again.
 */
(function () {
  'use strict';
  const mount = 'ReactDOM.createRoot(document.getElementById("root")).render(<App />);\n';
  const at = (ms, expr) => `setTimeout(() => console.log(${expr}), ${ms});`;
  const text = sel => `document.querySelector("${sel}").textContent`;
  const C = (o) => Object.assign({ emoji: '⚛️', difficulty: 2 }, o);

  const CHALLENGES = [
    C({
      id: 'rc-counter', emoji: '🔢', title: 'React: Counter with limits', difficulty: 1, concept: 'r-state',
      task: 'Build <code>App</code>: a number in <code>#count</code> (starts at 0), and buttons <code>#inc</code> (+1), <code>#dec</code> (−1, but never below 0) and <code>#reset</code>.',
      starter: 'function App() {\n  // useState for the count\n  return <div>\n    <p id="count">0</p>\n    <button id="inc">+</button>\n    <button id="dec">-</button>\n    <button id="reset">reset</button>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#inc", 10); simulateClick("#inc", 20); simulateClick("#dec", 30);\n' + at(60, text('#count')), expect: '1' },
        { run: mount + 'simulateClick("#dec", 10); simulateClick("#dec", 20);\n' + at(60, text('#count')), expect: '0' },
        { run: mount + 'simulateClick("#inc", 10); simulateClick("#inc", 20); simulateClick("#reset", 30);\n' + at(60, text('#count')), expect: '0' },
      ],
      hints: ['const [count, setCount] = React.useState(0);', 'For −1: setCount(c => Math.max(0, c - 1))', 'Show {count} inside #count and add onClick to each button.'],
      solution: 'function App() {\n  const [count, setCount] = React.useState(0);\n  return <div>\n    <p id="count">{count}</p>\n    <button id="inc" onClick={() => setCount(c => c + 1)}>+</button>\n    <button id="dec" onClick={() => setCount(c => Math.max(0, c - 1))}>-</button>\n    <button id="reset" onClick={() => setCount(0)}>reset</button>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-password', emoji: '👁️', title: 'React: Show / hide password', difficulty: 1, concept: 'r-state',
      task: 'An input <code>#pw</code> with <code>type="password"</code> and a button <code>#toggle</code> labelled <code>Show</code>. Clicking switches the input to <code>type="text"</code> and the label to <code>Hide</code>, and back.',
      starter: 'function App() {\n  return <div>\n    <input id="pw" type="password" />\n    <button id="toggle">Show</button>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#toggle", 10);\n' + at(40, 'document.getElementById("pw").getAttribute("type") + " " + ' + text('#toggle')), expect: 'text Hide' },
        { run: mount + 'simulateClick("#toggle", 10); simulateClick("#toggle", 20);\n' + at(40, 'document.getElementById("pw").getAttribute("type") + " " + ' + text('#toggle')), expect: 'password Show' },
      ],
      hints: ['Keep a boolean: const [visible, setVisible] = React.useState(false);', 'type={visible ? "text" : "password"}'],
      solution: 'function App() {\n  const [visible, setVisible] = React.useState(false);\n  return <div>\n    <input id="pw" type={visible ? "text" : "password"} />\n    <button id="toggle" onClick={() => setVisible(v => !v)}>{visible ? "Hide" : "Show"}</button>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-todo', emoji: '✅', title: 'React: Todo list', difficulty: 2, concept: 'r-todo',
      task: 'Type in <code>#new</code> and click <code>#add</code> to add a todo as an <code>&lt;li&gt;</code> inside <code>#list</code> (ignore empty text, then clear the input). Clicking a todo\'s text (a <code>span</code>) toggles the class <code>done</code> on its <code>li</code>; its <code>button.del</code> removes it.',
      starter: 'function App() {\n  return <div>\n    <input id="new" />\n    <button id="add">add</button>\n    <ul id="list"></ul>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateTyping("#new", "milk", 10); simulateClick("#add", 20); simulateTyping("#new", "eggs", 30); simulateClick("#add", 40);\n' + at(80, '[...document.querySelectorAll("#list li span")].map(s => s.textContent).join(",") + " | " + JSON.stringify(document.getElementById("new").value)'), expect: 'milk,eggs | ""' },
        { run: mount + 'simulateClick("#add", 10);\n' + at(40, 'document.querySelectorAll("#list li").length'), expect: '0' },
        { run: mount + 'simulateTyping("#new", "a", 10); simulateClick("#add", 20); simulateTyping("#new", "b", 30); simulateClick("#add", 40);\nsetTimeout(() => document.querySelector("#list li span").click(), 60);\nsetTimeout(() => document.querySelectorAll("#list li .del")[1].click(), 70);\n' + at(100, '[...document.querySelectorAll("#list li")].map(li => li.textContent.replace("✕", "") + ":" + li.className).join(",")'), expect: 'a:done' },
      ],
      hints: ['Two pieces of state: the input text and the array of todos ({ id, text, done }).', 'Give each todo an id (Date.now() or a counter) and use it as the key.', 'Toggle: todos.map(t => t.id === id ? { ...t, done: !t.done } : t). Delete: todos.filter(t => t.id !== id).'],
      solution: 'let nextId = 1;\nfunction App() {\n  const [text, setText] = React.useState("");\n  const [todos, setTodos] = React.useState([]);\n  function add() {\n    if (!text.trim()) return;\n    setTodos(ts => [...ts, { id: nextId++, text: text.trim(), done: false }]);\n    setText("");\n  }\n  return <div>\n    <input id="new" value={text} onChange={e => setText(e.target.value)} />\n    <button id="add" onClick={add}>add</button>\n    <ul id="list">{todos.map(t => <li key={t.id} className={t.done ? "done" : ""}>\n      <span onClick={() => setTodos(ts => ts.map(x => x.id === t.id ? { ...x, done: !x.done } : x))}>{t.text}</span>\n      <button className="del" onClick={() => setTodos(ts => ts.filter(x => x.id !== t.id))}>✕</button>\n    </li>)}</ul>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-tabs', emoji: '🗂️', title: 'React: Tabs', difficulty: 2, concept: 'r-children',
      task: 'Render <code>App</code> with three tabs from the array <code>TABS</code>. Each tab is a button <code>#tab-0</code>, <code>#tab-1</code>, <code>#tab-2</code>; the active one has the class <code>active</code>. Only the active tab\'s content is shown in <code>#panel</code>. The first tab starts active.',
      starter: 'const TABS = [\n  { label: "Home", content: "Welcome!" },\n  { label: "Profile", content: "Ada Lovelace" },\n  { label: "Settings", content: "Dark mode: on" },\n];\nfunction App() {\n  return <div>\n    {/* buttons */}\n    <div id="panel"></div>\n  </div>;\n}\n',
      tests: [
        { run: mount + at(20, text('#panel') + ' + " | " + document.querySelector(".active").textContent'), expect: 'Welcome! | Home' },
        { run: mount + 'simulateClick("#tab-2", 10);\n' + at(40, text('#panel') + ' + " | " + document.querySelectorAll(".active").length + " " + document.querySelector(".active").id'), expect: 'Dark mode: on | 1 tab-2' },
      ],
      hints: ['const [active, setActive] = React.useState(0);', 'TABS.map((t, i) => <button key={t.label} id={"tab-" + i} className={i === active ? "active" : ""} onClick={() => setActive(i)}>{t.label}</button>)'],
      solution: 'const TABS = [\n  { label: "Home", content: "Welcome!" },\n  { label: "Profile", content: "Ada Lovelace" },\n  { label: "Settings", content: "Dark mode: on" },\n];\nfunction App() {\n  const [active, setActive] = React.useState(0);\n  return <div>\n    {TABS.map((t, i) => <button key={t.label} id={"tab-" + i} className={i === active ? "active" : ""} onClick={() => setActive(i)}>{t.label}</button>)}\n    <div id="panel">{TABS[active].content}</div>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-accordion', emoji: '🪗', title: 'React: Accordion (one open at a time)', difficulty: 2, concept: 'r-lifting',
      task: 'Show the sections in <code>FAQ</code>. Each has a header button <code>#h-0</code>, <code>#h-1</code>, … Clicking a header opens its answer (a <code>&lt;p class="answer"&gt;</code>) and closes any other; clicking the open header again closes it. All start closed.',
      starter: 'const FAQ = [\n  { q: "What is JSX?", a: "Syntax for createElement calls." },\n  { q: "What is a hook?", a: "A function that lets components keep state." },\n  { q: "What is a key?", a: "An id that keeps list items stable." },\n];\nfunction App() {\n  return <div></div>;\n}\n',
      tests: [
        { run: mount + at(20, 'document.querySelectorAll(".answer").length'), expect: '0' },
        { run: mount + 'simulateClick("#h-1", 10);\n' + at(40, '[...document.querySelectorAll(".answer")].map(p => p.textContent).join("|")'), expect: 'A function that lets components keep state.' },
        { run: mount + 'simulateClick("#h-0", 10); simulateClick("#h-2", 20);\n' + at(40, '[...document.querySelectorAll(".answer")].map(p => p.textContent).join("|")'), expect: 'An id that keeps list items stable.' },
        { run: mount + 'simulateClick("#h-0", 10); simulateClick("#h-0", 20);\n' + at(40, 'document.querySelectorAll(".answer").length'), expect: '0' },
      ],
      hints: ['Store which index is open: const [open, setOpen] = React.useState(null);', 'onClick={() => setOpen(open === i ? null : i)}', '{open === i && <p className="answer">{item.a}</p>}'],
      solution: 'const FAQ = [\n  { q: "What is JSX?", a: "Syntax for createElement calls." },\n  { q: "What is a hook?", a: "A function that lets components keep state." },\n  { q: "What is a key?", a: "An id that keeps list items stable." },\n];\nfunction App() {\n  const [open, setOpen] = React.useState(null);\n  return <div>{FAQ.map((item, i) => <section key={item.q}>\n    <button id={"h-" + i} onClick={() => setOpen(open === i ? null : i)}>{item.q}</button>\n    {open === i && <p className="answer">{item.a}</p>}\n  </section>)}</div>;\n}\n',
    }),
    C({
      id: 'rc-stars', emoji: '⭐', title: 'React: Star rating', difficulty: 2, concept: 'r-state',
      task: 'Five buttons <code>#star-1</code> … <code>#star-5</code> inside <code>#stars</code>. Each shows <code>★</code> if its number is ≤ the rating, else <code>☆</code>. Clicking a star sets the rating; clicking the current rating again clears it to 0. Also show the rating in <code>#value</code>.',
      starter: 'function App() {\n  return <div>\n    <div id="stars"></div>\n    <p id="value">0</p>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#star-3", 10);\n' + at(40, text('#stars') + ' + " " + ' + text('#value')), expect: '★★★☆☆ 3' },
        { run: mount + 'simulateClick("#star-4", 10); simulateClick("#star-4", 20);\n' + at(40, text('#stars') + ' + " " + ' + text('#value')), expect: '☆☆☆☆☆ 0' },
        { run: mount + 'simulateClick("#star-5", 10); simulateClick("#star-2", 20);\n' + at(40, text('#value')), expect: '2' },
      ],
      hints: ['[1, 2, 3, 4, 5].map(n => <button key={n} id={"star-" + n} …>{n <= rating ? "★" : "☆"}</button>)', 'onClick={() => setRating(r => (r === n ? 0 : n))}'],
      solution: 'function App() {\n  const [rating, setRating] = React.useState(0);\n  return <div>\n    <div id="stars">{[1, 2, 3, 4, 5].map(n => <button key={n} id={"star-" + n} onClick={() => setRating(r => (r === n ? 0 : n))}>{n <= rating ? "★" : "☆"}</button>)}</div>\n    <p id="value">{rating}</p>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-debounce', emoji: '⏳', title: 'React: Debounced search', difficulty: 3, concept: 'r-cleanup',
      task: 'An input <code>#q</code> filters <code>FRUITS</code> (case-insensitive, "includes") into <code>&lt;li&gt;</code>s inside <code>#results</code>. The filter must only update <b>300 ms after the user stops typing</b> (debounce with <code>useEffect</code> + <code>setTimeout</code> + cleanup).',
      starter: 'const FRUITS = ["Apple", "Banana", "Grape", "Pineapple", "Mango"];\nfunction App() {\n  return <div>\n    <input id="q" />\n    <ul id="results"></ul>\n  </div>;\n}\n',
      tests: [
        { run: mount + at(20, 'document.querySelectorAll("#results li").length'), expect: '5' },
        { run: mount + 'simulateTyping("#q", "ap", 10);\n' + at(150, 'document.querySelectorAll("#results li").length') + '\n' + at(400, '[...document.querySelectorAll("#results li")].map(li => li.textContent).join(",")'), expect: '5\nApple,Grape,Pineapple' },
        { run: mount + 'simulateTyping("#q", "m", 10); simulateTyping("#q", "ma", 200); simulateTyping("#q", "man", 400);\n' + at(600, 'document.querySelectorAll("#results li").length') + '\n' + at(800, '[...document.querySelectorAll("#results li")].map(li => li.textContent).join(",")'), expect: '5\nMango' },
      ],
      hints: ['Keep two states: what is typed (query) and the debounced value used for filtering.', 'React.useEffect(() => { const t = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(t); }, [query]);', 'The cleanup cancels the previous timer every time the query changes.'],
      solution: 'const FRUITS = ["Apple", "Banana", "Grape", "Pineapple", "Mango"];\nfunction App() {\n  const [query, setQuery] = React.useState("");\n  const [debounced, setDebounced] = React.useState("");\n  React.useEffect(() => {\n    const t = setTimeout(() => setDebounced(query), 300);\n    return () => clearTimeout(t);\n  }, [query]);\n  const shown = FRUITS.filter(f => f.toLowerCase().includes(debounced.toLowerCase()));\n  return <div>\n    <input id="q" value={query} onChange={e => setQuery(e.target.value)} />\n    <ul id="results">{shown.map(f => <li key={f}>{f}</li>)}</ul>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-fetch', emoji: '🌐', title: 'React: Fetch with loading and error states', difficulty: 2, concept: 'r-effect',
      task: '<code>App</code> receives a prop <code>url</code>. Show <code>Loading…</code> in <code>#status</code> while fetching it, then the user names as <code>&lt;li&gt;</code>s in <code>#users</code> and <code>#status</code> empty. If the response is not ok, show <code>Error: 500</code> (the status code) in <code>#status</code>. (The pretend server answers <code>/api/users</code> after 300 ms and <code>/api/error</code> with status 500.)',
      starter: 'function App({ url }) {\n  return <div>\n    <p id="status"></p>\n    <ul id="users"></ul>\n  </div>;\n}\n',
      tests: [
        { run: 'ReactDOM.createRoot(document.getElementById("root")).render(<App url="/api/users" />);\n' + at(100, text('#status')) + '\n' + at(500, '[...document.querySelectorAll("#users li")].map(li => li.textContent).join(",") + "|" + ' + text('#status')), expect: 'Loading…\nAda Lovelace,Linus,Grace Hopper|' },
        { run: 'ReactDOM.createRoot(document.getElementById("root")).render(<App url="/api/error" />);\n' + at(600, text('#status')), expect: 'Error: 500' },
      ],
      hints: ['State: status ("loading" | "done" | "error"), data and error.', 'React.useEffect(() => { fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(…).catch(…); }, [url]);', 'Use an "ignore" flag in the cleanup to avoid race conditions.'],
      solution: 'function App({ url }) {\n  const [state, setState] = React.useState({ loading: true, users: [], error: null });\n  React.useEffect(() => {\n    let ignore = false;\n    setState({ loading: true, users: [], error: null });\n    fetch(url)\n      .then(r => { if (!r.ok) throw new Error("Error: " + r.status); return r.json(); })\n      .then(users => { if (!ignore) setState({ loading: false, users, error: null }); })\n      .catch(e => { if (!ignore) setState({ loading: false, users: [], error: e.message }); });\n    return () => { ignore = true; };\n  }, [url]);\n  return <div>\n    <p id="status">{state.loading ? "Loading…" : state.error || ""}</p>\n    <ul id="users">{state.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-pagination', emoji: '📄', title: 'React: Pagination', difficulty: 2, concept: 'r-state',
      task: 'Show the numbers 1–23 from <code>ITEMS</code>, 5 per page, as <code>&lt;li&gt;</code>s in <code>#items</code>. Buttons <code>#prev</code> and <code>#next</code> change page (disabled on the first / last page) and <code>#info</code> shows <code>Page 1 of 5</code>.',
      starter: 'const ITEMS = Array.from({ length: 23 }, (_, i) => i + 1);\nconst PER_PAGE = 5;\nfunction App() {\n  return <div>\n    <ul id="items"></ul>\n    <button id="prev">prev</button>\n    <span id="info"></span>\n    <button id="next">next</button>\n  </div>;\n}\n',
      tests: [
        { run: mount + at(20, '[...document.querySelectorAll("#items li")].map(li => li.textContent).join(",") + " | " + ' + text('#info') + ' + " | " + document.getElementById("prev").disabled'), expect: '1,2,3,4,5 | Page 1 of 5 | true' },
        { run: mount + 'for (let i = 0; i < 6; i++) simulateClick("#next", 10 + i * 10);\n' + at(120, '[...document.querySelectorAll("#items li")].map(li => li.textContent).join(",") + " | " + ' + text('#info') + ' + " | " + document.getElementById("next").disabled'), expect: '21,22,23 | Page 5 of 5 | true' },
        { run: mount + 'simulateClick("#next", 10); simulateClick("#next", 20); simulateClick("#prev", 30);\n' + at(60, text('#info')), expect: 'Page 2 of 5' },
      ],
      hints: ['const pages = Math.ceil(ITEMS.length / PER_PAGE);', 'ITEMS.slice((page - 1) * PER_PAGE, page * PER_PAGE)', '<button disabled={page === 1} …>'],
      solution: 'const ITEMS = Array.from({ length: 23 }, (_, i) => i + 1);\nconst PER_PAGE = 5;\nfunction App() {\n  const [page, setPage] = React.useState(1);\n  const pages = Math.ceil(ITEMS.length / PER_PAGE);\n  const shown = ITEMS.slice((page - 1) * PER_PAGE, page * PER_PAGE);\n  return <div>\n    <ul id="items">{shown.map(n => <li key={n}>{n}</li>)}</ul>\n    <button id="prev" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>prev</button>\n    <span id="info">Page {page} of {pages}</span>\n    <button id="next" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>next</button>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-stopwatch', emoji: '⏱️', title: 'React: Stopwatch', difficulty: 3, concept: 'r-ref',
      task: 'A stopwatch counting tenths of a second: <code>#time</code> shows <code>0.0</code>, <code>#start</code> starts it (one tick every 100 ms), <code>#stop</code> pauses, <code>#reset</code> stops and returns to <code>0.0</code>. Starting twice must not make it run twice as fast.',
      starter: 'function App() {\n  return <div>\n    <p id="time">0.0</p>\n    <button id="start">start</button>\n    <button id="stop">stop</button>\n    <button id="reset">reset</button>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#start", 0); simulateClick("#stop", 350);\n' + at(600, text('#time')), expect: '0.3' },
        { run: mount + 'simulateClick("#start", 0); simulateClick("#start", 50); simulateClick("#stop", 450);\n' + at(600, text('#time')), expect: '0.4' },
        { run: mount + 'simulateClick("#start", 0); simulateClick("#reset", 250);\n' + at(500, text('#time')), expect: '0.0' },
      ],
      hints: ['Keep the tenths in state and the interval id in a ref: const timer = React.useRef(null);', 'start: if (timer.current) return; timer.current = setInterval(() => setTenths(t => t + 1), 100);', 'stop: clearInterval(timer.current); timer.current = null;  Show (tenths / 10).toFixed(1). Clear the interval on unmount too.'],
      solution: 'function App() {\n  const [tenths, setTenths] = React.useState(0);\n  const timer = React.useRef(null);\n  const stop = () => { clearInterval(timer.current); timer.current = null; };\n  const start = () => { if (timer.current) return; timer.current = setInterval(() => setTenths(t => t + 1), 100); };\n  React.useEffect(() => stop, []);\n  return <div>\n    <p id="time">{(tenths / 10).toFixed(1)}</p>\n    <button id="start" onClick={start}>start</button>\n    <button id="stop" onClick={stop}>stop</button>\n    <button id="reset" onClick={() => { stop(); setTenths(0); }}>reset</button>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-validation', emoji: '📝', title: 'React: Form validation', difficulty: 2, concept: 'r-forms',
      task: 'A form with <code>#email</code>, <code>#password</code> and a submit button <code>#submit</code>. On submit (no page reload): if the email has no <code>@</code> show <code>Invalid email</code> in <code>#email-error</code>; if the password is shorter than 6 characters show <code>Password too short</code> in <code>#password-error</code>. If both are valid, show <code>Welcome EMAIL</code> in <code>#result</code>.',
      starter: 'function App() {\n  return <form>\n    <input id="email" />\n    <p id="email-error"></p>\n    <input id="password" type="password" />\n    <p id="password-error"></p>\n    <button id="submit">sign up</button>\n    <p id="result"></p>\n  </form>;\n}\n',
      tests: [
        { run: mount + 'simulateTyping("#email", "ada", 10); simulateTyping("#password", "123", 20); simulateClick("#submit", 30);\n' + at(60, text('#email-error') + ' + "|" + ' + text('#password-error') + ' + "|" + ' + text('#result')), expect: 'Invalid email|Password too short|' },
        { run: mount + 'simulateTyping("#email", "ada@x.com", 10); simulateTyping("#password", "secret1", 20); simulateClick("#submit", 30);\n' + at(60, text('#email-error') + ' + "|" + ' + text('#password-error') + ' + "|" + ' + text('#result')), expect: '||Welcome ada@x.com' },
      ],
      hints: ['Controlled inputs: state for email and password, plus an errors object.', '<form onSubmit={e => { e.preventDefault(); … }}>', 'const errors = {}; if (!email.includes("@")) errors.email = "Invalid email"; …'],
      solution: 'function App() {\n  const [email, setEmail] = React.useState("");\n  const [password, setPassword] = React.useState("");\n  const [errors, setErrors] = React.useState({});\n  const [result, setResult] = React.useState("");\n  function onSubmit(e) {\n    e.preventDefault();\n    const next = {};\n    if (!email.includes("@")) next.email = "Invalid email";\n    if (password.length < 6) next.password = "Password too short";\n    setErrors(next);\n    setResult(Object.keys(next).length ? "" : "Welcome " + email);\n  }\n  return <form onSubmit={onSubmit}>\n    <input id="email" value={email} onChange={e => setEmail(e.target.value)} />\n    <p id="email-error">{errors.email}</p>\n    <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />\n    <p id="password-error">{errors.password}</p>\n    <button id="submit">sign up</button>\n    <p id="result">{result}</p>\n  </form>;\n}\n',
    }),
    C({
      id: 'rc-traffic', emoji: '🚦', title: 'React: Traffic light', difficulty: 3, concept: 'r-cleanup',
      task: 'Show the current colour in <code>#light</code>. It starts <code>red</code> and cycles red (300 ms) → green (200 ms) → yellow (100 ms) → red … forever. Use one <code>setTimeout</code> per colour in an effect, with cleanup.',
      starter: 'const DURATION = { red: 300, green: 200, yellow: 100 };\nconst NEXT = { red: "green", green: "yellow", yellow: "red" };\nfunction App() {\n  return <p id="light">red</p>;\n}\n',
      tests: [
        { run: mount + at(150, text('#light')) + '\n' + at(400, text('#light')) + '\n' + at(550, text('#light')) + '\n' + at(650, text('#light')), expect: 'red\ngreen\nyellow\nred' },
      ],
      hints: ['const [color, setColor] = React.useState("red");', 'React.useEffect(() => { const t = setTimeout(() => setColor(NEXT[color]), DURATION[color]); return () => clearTimeout(t); }, [color]);'],
      solution: 'const DURATION = { red: 300, green: 200, yellow: 100 };\nconst NEXT = { red: "green", green: "yellow", yellow: "red" };\nfunction App() {\n  const [color, setColor] = React.useState("red");\n  React.useEffect(() => {\n    const t = setTimeout(() => setColor(NEXT[color]), DURATION[color]);\n    return () => clearTimeout(t);\n  }, [color]);\n  return <p id="light">{color}</p>;\n}\n',
    }),
    C({
      id: 'rc-tictactoe', emoji: '⭕', title: 'React: Tic-tac-toe', difficulty: 3, concept: 'r-lifting',
      task: 'Nine buttons <code>#c0</code> … <code>#c8</code>. X plays first, players alternate. Clicking a filled cell or playing after a win does nothing. <code>#status</code> shows <code>Next: X</code>, <code>Next: O</code>, <code>Winner: X</code> or <code>Draw</code>.',
      starter: 'const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];\nfunction App() {\n  return <div>\n    <p id="status">Next: X</p>\n  </div>;\n}\n',
      tests: [
        { run: mount + '[0, 3, 1, 4, 2, 5].forEach((c, i) => simulateClick("#c" + c, 10 + i * 10));\n' + at(120, text('#status') + ' + " " + [...Array(9)].map((_, i) => document.getElementById("c" + i).textContent || ".").join("")'), expect: 'Winner: X XXXOO....' },
        { run: mount + 'simulateClick("#c4", 10); simulateClick("#c4", 20);\n' + at(50, text('#status')), expect: 'Next: O' },
        { run: mount + '[0, 1, 2, 4, 3, 5, 7, 6, 8].forEach((c, i) => simulateClick("#c" + c, 10 + i * 10));\n' + at(150, text('#status')), expect: 'Draw' },
      ],
      hints: ['State: an array of 9 cells (null | "X" | "O"). Whose turn = count of filled cells is even → X.', 'winner = LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c])', 'Derive the status from the cells; don\'t store it separately.'],
      solution: 'const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];\nfunction App() {\n  const [cells, setCells] = React.useState(Array(9).fill(null));\n  const line = LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c]);\n  const winner = line ? cells[line[0]] : null;\n  const filled = cells.filter(Boolean).length;\n  const next = filled % 2 === 0 ? "X" : "O";\n  const status = winner ? "Winner: " + winner : filled === 9 ? "Draw" : "Next: " + next;\n  function play(i) {\n    if (cells[i] || winner) return;\n    setCells(cs => cs.map((v, j) => (j === i ? next : v)));\n  }\n  return <div>\n    {cells.map((v, i) => <button key={i} id={"c" + i} onClick={() => play(i)}>{v}</button>)}\n    <p id="status">{status}</p>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-tree', emoji: '🌲', title: 'React: File explorer (recursive component)', difficulty: 3, concept: 'r-fiber',
      task: 'Render <code>TREE</code> recursively. A folder shows a button with its name (<code>id="f-NAME"</code>); clicking it expands or collapses its children (all folders start collapsed). Files are <code>&lt;span class="file"&gt;</code>. Children go in a <code>&lt;ul&gt;</code> of <code>&lt;li&gt;</code>s.',
      starter: 'const TREE = { name: "src", children: [\n  { name: "components", children: [{ name: "Button.jsx" }, { name: "Modal.jsx" }] },\n  { name: "App.jsx" },\n  { name: "utils", children: [{ name: "format.js" }] },\n] };\nfunction App() {\n  return <div></div>;\n}\n',
      tests: [
        { run: mount + at(20, 'document.querySelectorAll(".file").length + " " + document.querySelectorAll("button").length'), expect: '0 1' },
        { run: mount + 'simulateClick("#f-src", 10); simulateClick("#f-components", 20);\n' + at(50, '[...document.querySelectorAll(".file")].map(f => f.textContent).join(",")'), expect: 'Button.jsx,Modal.jsx,App.jsx' },
        { run: mount + 'simulateClick("#f-src", 10); simulateClick("#f-utils", 20); simulateClick("#f-utils", 30);\n' + at(60, '[...document.querySelectorAll(".file")].map(f => f.textContent).join(",")'), expect: 'App.jsx' },
      ],
      hints: ['Write a Node component that renders itself for each child: function Node({ node }) { … node.children.map(c => <Node key={c.name} node={c} />) }', 'Each folder keeps its own open state with useState: that is why it is a separate component.', 'A node with no children array is a file.'],
      solution: 'const TREE = { name: "src", children: [\n  { name: "components", children: [{ name: "Button.jsx" }, { name: "Modal.jsx" }] },\n  { name: "App.jsx" },\n  { name: "utils", children: [{ name: "format.js" }] },\n] };\nfunction Node({ node }) {\n  const [open, setOpen] = React.useState(false);\n  if (!node.children) return <span className="file">{node.name}</span>;\n  return <div>\n    <button id={"f-" + node.name} onClick={() => setOpen(o => !o)}>{open ? "▾" : "▸"} {node.name}</button>\n    {open && <ul>{node.children.map(c => <li key={c.name}><Node node={c} /></li>)}</ul>}\n  </div>;\n}\nfunction App() {\n  return <Node node={TREE} />;\n}\n',
    }),
    C({
      id: 'rc-cart', emoji: '🛒', title: 'React: Shopping cart with useReducer', difficulty: 3, concept: 'r-reducer',
      task: 'Products in <code>PRODUCTS</code> each have a button <code>#add-ID</code>. A <code>useReducer</code> cart supports <code>add</code> and <code>remove</code> (buttons <code>#remove-ID</code> appear for items in the cart). <code>#count</code> shows the number of items and <code>#total</code> the total price like <code>$7.50</code>.',
      starter: 'const PRODUCTS = [{ id: "tea", price: 2.5 }, { id: "cake", price: 4 }];\nfunction cartReducer(state, action) {\n  return state;\n}\nfunction App() {\n  return <div>\n    <p id="count">0</p>\n    <p id="total">$0.00</p>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#add-tea", 10); simulateClick("#add-tea", 20); simulateClick("#add-cake", 30);\n' + at(60, text('#count') + ' + " " + ' + text('#total')), expect: '3 $9.00' },
        { run: mount + 'simulateClick("#add-tea", 10); simulateClick("#add-cake", 20); simulateClick("#remove-tea", 30);\n' + at(60, text('#count') + ' + " " + ' + text('#total') + ' + " " + !!document.getElementById("remove-tea")'), expect: '1 $4.00 false' },
        { run: 'console.log(JSON.stringify(cartReducer({ tea: 1 }, { type: "add", id: "tea" })), JSON.stringify(cartReducer({ tea: 1 }, { type: "remove", id: "tea" })))', expect: '{"tea":2} {}' },
      ],
      hints: ['State shape: { [productId]: quantity }.', 'add: { ...state, [id]: (state[id] || 0) + 1 }. remove: decrease, and delete the key when it reaches 0.', 'total = PRODUCTS.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price, 0).toFixed(2)'],
      solution: 'const PRODUCTS = [{ id: "tea", price: 2.5 }, { id: "cake", price: 4 }];\nfunction cartReducer(state, action) {\n  switch (action.type) {\n    case "add": return { ...state, [action.id]: (state[action.id] || 0) + 1 };\n    case "remove": {\n      const next = { ...state };\n      if (next[action.id] > 1) next[action.id]--; else delete next[action.id];\n      return next;\n    }\n    default: return state;\n  }\n}\nfunction App() {\n  const [cart, dispatch] = React.useReducer(cartReducer, {});\n  const count = Object.values(cart).reduce((a, b) => a + b, 0);\n  const total = PRODUCTS.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price, 0);\n  return <div>\n    {PRODUCTS.map(p => <div key={p.id}>\n      <button id={"add-" + p.id} onClick={() => dispatch({ type: "add", id: p.id })}>add {p.id}</button>\n      {cart[p.id] ? <button id={"remove-" + p.id} onClick={() => dispatch({ type: "remove", id: p.id })}>remove</button> : null}\n    </div>)}\n    <p id="count">{count}</p>\n    <p id="total">${total.toFixed(2)}</p>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-progress', emoji: '📶', title: 'React: Progress bar', difficulty: 2, concept: 'r-cleanup',
      task: 'After clicking <code>#go</code>, the progress in <code>#pct</code> goes up by 10% every 100 ms until <code>100%</code>, then <code>#msg</code> shows <code>Done</code> and the timer stops. The bar <code>#bar</code> has its <code>style.width</code> set to the same percentage.',
      starter: 'function App() {\n  return <div>\n    <button id="go">start</button>\n    <div id="bar" style={{ width: "0%" }}></div>\n    <p id="pct">0%</p>\n    <p id="msg"></p>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#go", 0);\n' + at(450, text('#pct') + ' + " " + document.getElementById("bar").style.width'), expect: '40% 40%' },
        { run: mount + 'simulateClick("#go", 0);\n' + at(1500, text('#pct') + ' + " " + ' + text('#msg')), expect: '100% Done' },
      ],
      hints: ['const [pct, setPct] = React.useState(0); const [running, setRunning] = React.useState(false);', 'In an effect that depends on [running]: start setInterval, and clear it in the cleanup.', 'Use setPct(p => Math.min(100, p + 10)) and stop when it reaches 100.'],
      solution: 'function App() {\n  const [pct, setPct] = React.useState(0);\n  const [running, setRunning] = React.useState(false);\n  React.useEffect(() => {\n    if (!running) return;\n    const id = setInterval(() => setPct(p => Math.min(100, p + 10)), 100);\n    return () => clearInterval(id);\n  }, [running]);\n  React.useEffect(() => { if (pct === 100) setRunning(false); }, [pct]);\n  return <div>\n    <button id="go" onClick={() => setRunning(true)}>start</button>\n    <div id="bar" style={{ width: pct + "%" }}></div>\n    <p id="pct">{pct}%</p>\n    <p id="msg">{pct === 100 ? "Done" : ""}</p>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-autocomplete', emoji: '🔎', title: 'React: Autocomplete', difficulty: 3, concept: 'r-controlled',
      task: 'An input <code>#city</code>. When it has text, show matching <code>CITIES</code> (starting with the text, case-insensitive, at most 3) as <code>&lt;li&gt;</code>s in <code>#suggestions</code>. Clicking a suggestion puts it in the input and hides the list.',
      starter: 'const CITIES = ["Paris", "Pune", "Prague", "Porto", "Berlin", "Bern"];\nfunction App() {\n  return <div>\n    <input id="city" />\n    <ul id="suggestions"></ul>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateTyping("#city", "p", 10);\n' + at(40, '[...document.querySelectorAll("#suggestions li")].map(li => li.textContent).join(",")'), expect: 'Paris,Pune,Prague' },
        { run: mount + 'simulateTyping("#city", "be", 10);\nsetTimeout(() => document.querySelectorAll("#suggestions li")[1].click(), 30);\n' + at(60, 'document.getElementById("city").value + " " + document.querySelectorAll("#suggestions li").length'), expect: 'Bern 0' },
        { run: mount + at(20, 'document.querySelectorAll("#suggestions li").length'), expect: '0' },
      ],
      hints: ['Store the text and a flag "open".', 'const matches = text ? CITIES.filter(c => c.toLowerCase().startsWith(text.toLowerCase())).slice(0, 3) : [];', 'On click: setText(city); setOpen(false). Typing sets open back to true.'],
      solution: 'const CITIES = ["Paris", "Pune", "Prague", "Porto", "Berlin", "Bern"];\nfunction App() {\n  const [text, setText] = React.useState("");\n  const [open, setOpen] = React.useState(false);\n  const matches = open && text ? CITIES.filter(c => c.toLowerCase().startsWith(text.toLowerCase())).slice(0, 3) : [];\n  return <div>\n    <input id="city" value={text} onChange={e => { setText(e.target.value); setOpen(true); }} />\n    <ul id="suggestions">{matches.map(c => <li key={c} onClick={() => { setText(c); setOpen(false); }}>{c}</li>)}</ul>\n  </div>;\n}\n',
    }),
    C({
      id: 'rc-modal', emoji: '🪟', title: 'React: Modal with a portal', difficulty: 2, concept: 'r-portal',
      task: 'A button <code>#open</code> opens a modal rendered with <code>ReactDOM.createPortal</code> directly into <code>document.body</code> (not inside <code>#root</code>): a <code>&lt;div class="modal"&gt;</code> with the text <code>Hello!</code> and a button <code>#close</code> that closes it.',
      starter: 'function Modal({ onClose }) {\n  return null;\n}\nfunction App() {\n  return <div>\n    <button id="open">open</button>\n  </div>;\n}\n',
      tests: [
        { run: mount + 'simulateClick("#open", 10);\n' + at(40, '!!document.querySelector("body > .modal") + " " + !!document.querySelector("#root .modal") + " " + document.querySelector(".modal").textContent.replace("close", "").trim()'), expect: 'true false Hello!' },
        { run: mount + 'simulateClick("#open", 10); simulateClick("#close", 20);\n' + at(50, 'document.querySelectorAll(".modal").length'), expect: '0' },
      ],
      hints: ['return ReactDOM.createPortal(<div className="modal">…</div>, document.body);', 'Keep const [open, setOpen] = React.useState(false) in App and render {open && <Modal onClose={() => setOpen(false)} />}.'],
      mustUse: [{ re: /createPortal/, msg: 'Use ReactDOM.createPortal' }],
      solution: 'function Modal({ onClose }) {\n  return ReactDOM.createPortal(<div className="modal">\n    <p>Hello!</p>\n    <button id="close" onClick={onClose}>close</button>\n  </div>, document.body);\n}\nfunction App() {\n  const [open, setOpen] = React.useState(false);\n  return <div>\n    <button id="open" onClick={() => setOpen(true)}>open</button>\n    {open && <Modal onClose={() => setOpen(false)} />}\n  </div>;\n}\n',
    }),
  ];

  window.JS_CHALLENGES = window.JS_CHALLENGES || [];
  window.JS_CHALLENGES.unshift(...CHALLENGES);
  window.REACT_CHALLENGES = CHALLENGES;
})();
