/*
 * JS Engine Lab — interview questions, part 3:
 * design patterns, how frameworks work, functional programming, advanced algorithms,
 * more browser questions, testing, and theory flashcards (kind: 'theory', no code).
 */
window.JS_INTERVIEW.push(
  // ------------------------------------------------------------ design patterns
  {
    id: 'singleton', cat: 'Design patterns', title: 'Singleton', level: 'Easy', ask: 'Make sure only one Config object ever exists.',
    why: 'A <b>singleton</b> hands out the same instance every time: the first call creates it and later calls return the stored one. In JavaScript a module, or an IIFE that returns an object, is a singleton too, because it is created only once. Use it sparingly: global shared state makes code harder to test.',
    code: `class Config {
  static #instance = null;
  static getInstance() {
    if (!Config.#instance) Config.#instance = new Config();
    return Config.#instance;
  }
  constructor() { this.settings = { theme: "dark" }; }
}
const a = Config.getInstance();
const b = Config.getInstance();
a.settings.theme = "light";
console.log(a === b, b.settings.theme);

const counter = (() => {
  let n = 0;
  return { next: () => ++n };
})();
console.log(counter.next(), counter.next());`,
  },
  {
    id: 'factory', cat: 'Design patterns', title: 'Factory', level: 'Easy', ask: 'Create objects without the caller naming the class.',
    why: 'A <b>factory</b> function decides which class to create from its input, so callers don\'t depend on concrete classes and new types can be added in one place. A lookup object is cleaner than a long <code>if/else</code> chain.',
    code: `class Car { constructor() { this.wheels = 4; } describe() { return "car with " + this.wheels + " wheels"; } }
class Bike { constructor() { this.wheels = 2; } describe() { return "bike with " + this.wheels + " wheels"; } }

const vehicles = { car: Car, bike: Bike };
function createVehicle(type) {
  const Vehicle = vehicles[type];
  if (!Vehicle) throw new Error("Unknown vehicle: " + type);
  return new Vehicle();
}
console.log(createVehicle("car").describe());
console.log(createVehicle("bike").describe());
try { createVehicle("boat"); } catch (e) { console.log(e.message); }`,
  },
  {
    id: 'observer', cat: 'Design patterns', title: 'Observer', level: 'Medium', ask: 'Notify every subscriber when something changes.',
    why: 'The <b>subject</b> keeps a list of observer functions and calls each one on <code>notify</code>. Returning an "unsubscribe" function from <code>subscribe</code> avoids memory leaks. DOM events, RxJS and store subscriptions all follow this pattern.',
    code: `class Subject {
  #observers = new Set();
  subscribe(fn) {
    this.#observers.add(fn);
    return () => this.#observers.delete(fn);
  }
  notify(data) { this.#observers.forEach(fn => fn(data)); }
}
const price = new Subject();
const unsubscribeA = price.subscribe(p => console.log("A sees", p));
price.subscribe(p => console.log("B sees", p));
price.notify(10);
unsubscribeA();
price.notify(12);`,
  },
  {
    id: 'strategy', cat: 'Design patterns', title: 'Strategy', level: 'Easy', ask: 'Swap the algorithm at run time.',
    why: 'Each <b>strategy</b> is a function with the same signature, stored in an object. The caller picks one by name and falls back to a default, which removes a big <code>switch</code> and makes adding a strategy a one-line change.',
    code: `const shipping = {
  standard: weight => 5 + weight * 0.5,
  express: weight => 15 + weight,
  free: () => 0,
};
function cost(method, weight) {
  const strategy = shipping[method] || shipping.standard;
  return strategy(weight).toFixed(2);
}
console.log(cost("standard", 4), cost("express", 4), cost("free", 4), cost("unknown", 2));`,
  },
  {
    id: 'decorator', cat: 'Design patterns', title: 'Decorator (wrapping functions)', level: 'Medium', ask: 'Add logging to a function without changing it.',
    why: 'A <b>decorator</b> takes a function and returns a new function that does something extra before or after calling the original. Decorators stack: <code>withTiming(withLogging(add))</code>. <code>fn.apply(this, args)</code> keeps <code>this</code> and the arguments intact.',
    code: `function withLogging(fn) {
  return function (...args) {
    console.log("calling", fn.name, "with", args.join(", "));
    const result = fn.apply(this, args);
    console.log(fn.name, "returned", result);
    return result;
  };
}
function withTiming(fn, label) {
  return (...args) => {
    const r = fn(...args);
    console.log(label, "done");
    return r;
  };
}
function add(a, b) { return a + b; }
withLogging(add)(2, 3);
withTiming(withLogging(add), "timing:")(1, 1);`,
  },
  {
    id: 'middleware', cat: 'Design patterns', title: 'Middleware chain (like Express)', level: 'Hard', ask: 'Build app.use(fn) with next().',
    why: 'Each middleware gets <code>(req, next)</code>. Calling <code>next()</code> runs the next function in the list; <b>not</b> calling it stops the chain (here, the auth check). Code after <code>next()</code> runs on the way back out, like an onion. Express and Koa work exactly like this.',
    code: `function createApp() {
  const stack = [];
  return {
    use(fn) { stack.push(fn); return this; },
    handle(req) {
      let i = 0;
      const next = () => {
        const fn = stack[i++];
        if (fn) fn(req, next);
      };
      next();
      return req;
    },
  };
}
const app = createApp()
  .use((req, next) => { req.log.push("logger"); next(); req.log.push("logger after"); })
  .use((req, next) => {
    if (!req.user) { req.log.push("auth: blocked"); return; }
    req.log.push("auth ok");
    next();
  })
  .use((req, next) => { req.log.push("handler"); next(); });

console.log(app.handle({ user: "ada", log: [] }).log.join(" > "));
console.log(app.handle({ log: [] }).log.join(" > "));`,
  },
  {
    id: 'command', cat: 'Design patterns', title: 'Command with undo', level: 'Medium', ask: 'Implement undo for an editor.',
    why: 'Each action is an object with <code>do</code> and <code>undo</code>. The editor runs commands and keeps them on a <b>history stack</b>; undo pops the last one and reverses it. Text editors, drawing apps and Redux devtools use this idea.',
    code: `class Editor {
  text = "";
  history = [];
  run(cmd) { cmd.do(this); this.history.push(cmd); }
  undo() { const cmd = this.history.pop(); if (cmd) cmd.undo(this); }
}
const type = s => ({
  do: e => { e.text += s; },
  undo: e => { e.text = e.text.slice(0, -s.length); },
});
const ed = new Editor();
ed.run(type("Hello"));
ed.run(type(" world"));
console.log(ed.text);
ed.undo();
console.log(ed.text);
ed.undo();
ed.undo();
console.log(JSON.stringify(ed.text));`,
  },
  {
    id: 'adapter', cat: 'Design patterns', title: 'Adapter', level: 'Easy', ask: 'Use an old API with a new interface.',
    why: 'An <b>adapter</b> wraps an existing API and translates it to the shape the rest of your code expects. When the old API changes, only the adapter needs updating.',
    code: `const oldApi = {
  getUserData: id => ({ first_name: "Ada", last_name: "Lovelace", id }),
};
const userAdapter = {
  getUser(id) {
    const raw = oldApi.getUserData(id);
    return { id: raw.id, fullName: raw.first_name + " " + raw.last_name };
  },
};
console.log(JSON.stringify(userAdapter.getUser(7)));`,
  },

  // ------------------------------------------------------------ how frameworks work
  {
    id: 'usestate', cat: 'How frameworks work', title: 'Build React\'s useState', level: 'Hard', ask: 'How does React remember state between renders?',
    why: 'Hooks are stored in an <b>array</b> in a closure, and each <code>useState</code> call takes the next slot (<code>index++</code>). Every render resets the index to 0, so the hooks must be called in the <b>same order</b> each time. That is the reason for the "rules of hooks": no hooks inside <code>if</code> or loops. <code>setState</code> updates the slot and renders again.',
    code: `const React = (() => {
  let hooks = [], index = 0, component;
  function useState(initial) {
    const i = index++;
    if (hooks[i] === undefined) hooks[i] = initial;
    const setState = value => {
      hooks[i] = typeof value === "function" ? value(hooks[i]) : value;
      render();
    };
    return [hooks[i], setState];
  }
  function render(c) {
    if (c) component = c;
    index = 0;
    return component();
  }
  return { useState, render };
})();

let ui;
function Counter() {
  const [count, setCount] = React.useState(0);
  const [name, setName] = React.useState("Ada");
  ui = { click: () => setCount(c => c + 1), rename: n => setName(n) };
  console.log("render:", name, "clicked", count, "times");
}
React.render(Counter);
ui.click();
ui.click();
ui.rename("Grace");`,
  },
  {
    id: 'useeffect', cat: 'How frameworks work', title: 'useEffect dependencies', level: 'Hard', ask: 'When does an effect run again?',
    why: 'Each effect remembers its dependency list from the last render. It runs again only if some dependency <b>changed</b> (compared with <code>Object.is</code>). That is why a missing dependency leads to stale data, and a new object created on every render makes the effect run every time.',
    code: `function createHooks() {
  const deps = [];
  let i = 0;
  return {
    reset() { i = 0; },
    useEffect(fn, list) {
      const old = deps[i];
      const changed = !old || list.some((d, k) => !Object.is(d, old[k]));
      if (changed) { fn(); deps[i] = list; }
      i++;
    },
  };
}
const hooks = createHooks();
function render(userId, theme) {
  hooks.reset();
  hooks.useEffect(() => console.log("fetch user", userId), [userId]);
  hooks.useEffect(() => console.log("apply theme", theme), [theme]);
}
render(1, "dark");
render(1, "light");
render(2, "light");`,
  },
  {
    id: 'vdom', cat: 'How frameworks work', title: 'Virtual DOM diff', level: 'Hard', ask: 'Which real DOM changes are needed?',
    why: 'A virtual DOM is a tree of plain objects. On every update the framework builds a new tree and <b>diffs</b> it with the old one, producing a minimal list of patches (create, remove, replace, set attribute). Only those patches touch the slow real DOM.',
    code: `const h = (tag, props, ...children) => ({ tag, props: props || {}, children });

function diff(oldNode, newNode, path = "root") {
  const patches = [];
  if (!oldNode) patches.push("CREATE " + path);
  else if (!newNode) patches.push("REMOVE " + path);
  else if (typeof oldNode !== typeof newNode || (typeof oldNode === "string" && oldNode !== newNode) || oldNode.tag !== newNode.tag) {
    patches.push("REPLACE " + path);
  } else if (typeof newNode === "object") {
    for (const key of new Set([...Object.keys(oldNode.props), ...Object.keys(newNode.props)])) {
      if (oldNode.props[key] !== newNode.props[key]) patches.push("SET " + key + "=" + newNode.props[key] + " on " + path);
    }
    const len = Math.max(oldNode.children.length, newNode.children.length);
    for (let i = 0; i < len; i++) patches.push(...diff(oldNode.children[i], newNode.children[i], path + "." + i));
  }
  return patches;
}
const before = h("ul", { class: "list" }, h("li", null, "Apples"), h("li", null, "Pears"));
const after = h("ul", { class: "list big" }, h("li", null, "Apples"), h("li", null, "Plums"), h("li", null, "Kiwis"));
diff(before, after).forEach(p => console.log(p));`,
  },
  {
    id: 'reactivity', cat: 'How frameworks work', title: 'Vue-style reactivity with Proxy', level: 'Hard', ask: 'How does the effect know to re-run?',
    why: 'While an effect runs, the <code>get</code> trap <b>records</b> which keys it read. Later the <code>set</code> trap re-runs only the effects that depend on the changed key. Changing <code>name</code> runs nothing, because no effect read it. Vue 3, MobX and Solid are built on this idea.',
    code: `let activeEffect = null;
const deps = new Map();
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      if (activeEffect) {
        if (!deps.has(key)) deps.set(key, new Set());
        deps.get(key).add(activeEffect);
      }
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      (deps.get(key) || []).forEach(fn => fn());
      return true;
    },
  });
}
function effect(fn) { activeEffect = fn; fn(); activeEffect = null; }

const state = reactive({ count: 1, name: "Ada" });
effect(() => console.log("count is", state.count));
state.count++;
state.count = 10;
state.name = "Grace";`,
  },
  {
    id: 'reduxstore', cat: 'How frameworks work', title: 'Build a Redux store', level: 'Medium', ask: 'Implement createStore(reducer).',
    why: 'The store holds one state value. <code>dispatch(action)</code> computes the next state with a <b>pure reducer</b> and tells the subscribers. Reducers never mutate: they return a new array or object, which is why <code>before</code> is still the old, empty state.',
    code: `function createStore(reducer, initial) {
  let state = initial;
  const listeners = [];
  return {
    getState: () => state,
    dispatch(action) { state = reducer(state, action); listeners.forEach(l => l()); return action; },
    subscribe(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
  };
}
function todos(state, action) {
  switch (action.type) {
    case "add": return [...state, { text: action.text, done: false }];
    case "toggle": return state.map((t, i) => (i === action.index ? { ...t, done: !t.done } : t));
    default: return state;
  }
}
const store = createStore(todos, []);
const before = store.getState();
store.subscribe(() => {
  const s = store.getState();
  console.log("now", s.length, "todos, done:", s.filter(t => t.done).length);
});
store.dispatch({ type: "add", text: "learn JS" });
store.dispatch({ type: "add", text: "learn Redux" });
store.dispatch({ type: "toggle", index: 0 });
console.log(before.length, before === store.getState());`,
  },
  {
    id: 'batching', cat: 'How frameworks work', title: 'Batching updates with a microtask', level: 'Hard', ask: 'Three setState calls, one render. How?',
    why: 'Updates are merged into a pending object, and the render is scheduled <b>once</b> with <code>queueMicrotask</code>. It runs after the current code finishes but before any timer, so all synchronous updates land in a single render. React and Vue batch updates this way.',
    code: `function createBatcher(render) {
  let scheduled = false, pending = {};
  return update => {
    Object.assign(pending, update);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const u = pending;
      pending = {};
      render(u);
    });
  };
}
const setState = createBatcher(u => console.log("render once with", JSON.stringify(u)));
setState({ a: 1 });
setState({ b: 2 });
setState({ a: 3 });
console.log("three updates queued");
setTimeout(() => setState({ c: 4 }), 0);`,
  },
  {
    id: 'router', cat: 'How frameworks work', title: 'A tiny router with :params', level: 'Medium', ask: 'Match "/users/:id" and extract the id.',
    why: 'Each pattern is turned into a regular expression: every <code>:name</code> becomes a capture group <code>([^/]+)</code>, and the names are remembered. The first route that matches gets an object of its parameters. React Router and Express routes work this way.',
    code: `function createRouter(routes) {
  return path => {
    for (const [pattern, handler] of Object.entries(routes)) {
      const names = [];
      const re = new RegExp("^" + pattern.replace(/:(\\w+)/g, (_, n) => { names.push(n); return "([^/]+)"; }) + "$");
      const m = path.match(re);
      if (m) return handler(Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
    }
    return "404 for " + path;
  };
}
const route = createRouter({
  "/": () => "home",
  "/users/:id": p => "user " + p.id,
  "/posts/:postId/comments/:cid": p => "comment " + p.cid + " on post " + p.postId,
});
console.log(route("/"), "|", route("/users/42"), "|", route("/posts/7/comments/3"), "|", route("/nope"));`,
  },

  // ------------------------------------------------------------ functional programming
  {
    id: 'pureimmutable', cat: 'Functional programming', title: 'Pure functions and immutable updates', level: 'Medium', ask: 'Update nested state without mutating it.',
    why: 'A <b>pure</b> function returns the same output for the same input and changes nothing outside itself; <code>impureAdd</code> depends on and changes <code>total</code>. For immutable updates, copy every level you change with spread, and share the rest. That keeps old versions intact, which is great for undo and change detection.',
    code: `const state = { user: { name: "Ada", tags: ["js"] }, count: 1 };
const next = {
  ...state,
  user: { ...state.user, tags: [...state.user.tags, "fp"] },
  count: state.count + 1,
};
console.log(state.user.tags.join(), next.user.tags.join(), state.count, next.count);
console.log(state.user === next.user, state === next);

let total = 0;
const impureAdd = n => (total += n);
const pureAdd = (a, b) => a + b;
console.log(impureAdd(2), impureAdd(2), pureAdd(2, 2), pureAdd(2, 2));`,
  },
  {
    id: 'partialzip', cat: 'Functional programming', title: 'partial, zip and unzip', level: 'Medium', ask: 'Implement partial application and zip.',
    why: '<code>partial</code> fixes some arguments now and takes the rest later; unlike currying, it doesn\'t need one call per argument. <code>zip</code> combines arrays position by position, and unzipping is just zipping the pairs again.',
    code: `const partial = (fn, ...preset) => (...later) => fn(...preset, ...later);
const greet = (greeting, name, punct) => greeting + ", " + name + punct;
const hello = partial(greet, "Hello");
console.log(hello("Ada", "!"), partial(greet, "Hi", "Bob")("?"));

const zip = (...arrays) => arrays[0].map((_, i) => arrays.map(a => a[i]));
console.log(JSON.stringify(zip([1, 2, 3], ["a", "b", "c"], [true, false, true])));
const unzip = pairs => zip(...pairs);
console.log(JSON.stringify(unzip([[1, "a"], [2, "b"]])));`,
  },
  {
    id: 'lazypipeline', cat: 'Functional programming', title: 'Lazy pipelines with generators', level: 'Hard', ask: 'Why are only 5 numbers looked at, from an infinite list?',
    why: 'Generators are <b>lazy</b>: each stage pulls one value at a time from the stage before, only when it is asked. <code>take</code> stops after 3 results, so the infinite <code>naturals()</code> only produces the 5 numbers needed. <code>map</code>/<code>filter</code> on arrays would process everything first.',
    code: `function* naturals() { let n = 1; while (true) yield n++; }
function* map(it, fn) { for (const x of it) yield fn(x); }
function* filter(it, fn) { for (const x of it) if (fn(x)) yield x; }
function* take(it, n) {
  if (n <= 0) return;
  for (const x of it) {
    yield x;
    if (--n <= 0) return;
  }
}
let checked = 0;
const squares = map(naturals(), n => { checked++; return n * n; });
const result = take(filter(squares, n => n % 2 === 1), 3);
console.log([...result].join(), "numbers looked at:", checked);`,
  },
  {
    id: 'maybe', cat: 'Functional programming', title: 'Maybe: safe chaining', level: 'Hard', ask: 'Read a deep property without crashing on null.',
    why: 'A <b>Maybe</b> wraps a value; <code>map</code> only runs the function when there is a value, otherwise it passes "nothing" along. You get a safe chain of steps and one fallback at the end. Optional chaining (<code>?.</code>) is the built-in version for property access.',
    code: `const Maybe = value => ({
  map: fn => (value == null ? Maybe(null) : Maybe(fn(value))),
  getOrElse: fallback => (value == null ? fallback : value),
});
const city = u => Maybe(u)
  .map(x => x.profile)
  .map(x => x.address)
  .map(x => x.city)
  .map(c => c.toUpperCase())
  .getOrElse("unknown");

console.log(city({ profile: { address: { city: "paris" } } }), city({ profile: null }), city(null));`,
  },
  {
    id: 'reduceall', cat: 'Functional programming', title: 'map, filter and countBy with reduce', level: 'Medium', ask: 'Implement map and filter using only reduce.',
    why: '<code>reduce</code> is the most general array method: <code>map</code> adds a transformed item to the result, and <code>filter</code> adds the item only when it passes. Spreading creates a new array each step, which is fine for small data and keeps the code pure.',
    code: `const mapR = (arr, fn) => arr.reduce((out, x, i) => [...out, fn(x, i)], []);
const filterR = (arr, fn) => arr.reduce((out, x) => (fn(x) ? [...out, x] : out), []);
const countBy = (arr, fn) => arr.reduce((acc, x) => {
  const k = fn(x);
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
console.log(mapR([1, 2, 3], n => n * 10).join(), filterR([1, 2, 3, 4], n => n > 2).join());
console.log(JSON.stringify(countBy(["one", "two", "three"], w => w.length)));`,
  },

  // ------------------------------------------------------------ advanced algorithms
  {
    id: 'trie', cat: 'Advanced algorithms', title: 'Trie (prefix tree) for autocomplete', level: 'Hard', ask: 'Find every word that starts with "car".',
    why: 'Each node is an object whose keys are the next letters, and <code>end</code> marks a complete word. A lookup takes one step per letter of the word, however many words are stored. For autocomplete, walk down to the prefix node, then collect every word below it.',
    code: `class Trie {
  constructor() { this.root = {}; }
  insert(word) {
    let node = this.root;
    for (const ch of word) node = node[ch] = node[ch] || {};
    node.end = true;
  }
  find(s) {
    let node = this.root;
    for (const ch of s) { node = node[ch]; if (!node) return null; }
    return node;
  }
  has(word) { const n = this.find(word); return !!(n && n.end); }
  startsWith(prefix) {
    const out = [];
    const walk = (node, path) => {
      if (node.end) out.push(path);
      for (const ch of Object.keys(node)) if (ch !== "end") walk(node[ch], path + ch);
    };
    const n = this.find(prefix);
    if (n) walk(n, prefix);
    return out;
  }
}
const t = new Trie();
["car", "cart", "care", "dog"].forEach(w => t.insert(w));
console.log(t.has("car"), t.has("ca"), t.startsWith("car").join());`,
  },
  {
    id: 'dijkstra', cat: 'Advanced algorithms', title: 'Dijkstra shortest path', level: 'Hard', ask: 'Cheapest route from A to D with weighted edges.',
    why: 'Repeatedly pick the unvisited node with the <b>smallest known distance</b>, then try to improve its neighbours through it. <code>prev</code> remembers where each best distance came from, so you can walk back to rebuild the path. A priority queue makes the "pick smallest" step fast.',
    code: `const graph = { A: { B: 4, C: 1 }, B: { D: 1 }, C: { B: 2, D: 5 }, D: {} };

function dijkstra(start) {
  const dist = { [start]: 0 }, prev = {}, done = new Set();
  while (true) {
    let node = null;
    for (const n of Object.keys(dist)) if (!done.has(n) && (node === null || dist[n] < dist[node])) node = n;
    if (node === null) break;
    done.add(node);
    for (const [next, w] of Object.entries(graph[node])) {
      const d = dist[node] + w;
      if (dist[next] === undefined || d < dist[next]) { dist[next] = d; prev[next] = node; }
    }
  }
  return { dist, prev };
}
const { dist, prev } = dijkstra("A");
const path = ["D"];
while (prev[path[0]]) path.unshift(prev[path[0]]);
console.log(JSON.stringify(dist), path.join(" -> "));`,
  },
  {
    id: 'toposort', cat: 'Advanced algorithms', title: 'Topological sort (dependency order)', level: 'Hard', ask: 'In what order should these modules load?',
    why: 'A depth-first search adds a node to the order only <b>after</b> all its dependencies, so dependencies always come first. Marking nodes as "visiting" detects cycles: meeting a node that is still being visited means there is a loop. Bundlers and package managers do this.',
    code: `const deps = { app: ["router", "store"], router: ["utils"], store: ["utils"], utils: [] };

function topoSort(graph) {
  const order = [], state = {};
  function visit(n) {
    if (state[n] === "done") return;
    if (state[n] === "visiting") throw new Error("cycle at " + n);
    state[n] = "visiting";
    graph[n].forEach(visit);
    state[n] = "done";
    order.push(n);
  }
  Object.keys(graph).forEach(visit);
  return order;
}
console.log(topoSort(deps).join(" -> "));
try { topoSort({ a: ["b"], b: ["a"] }); } catch (e) { console.log(e.message); }`,
  },
  {
    id: 'ratelimit', cat: 'Advanced algorithms', title: 'Rate limiter (sliding window)', level: 'Hard', ask: 'Allow at most 3 requests per second.',
    why: 'Keep the timestamps of recent requests. Before each new one, drop the timestamps older than the window; if fewer than <code>limit</code> are left, allow the request and record it. APIs use this to protect servers. (The time is passed in so the result is predictable.)',
    code: `function createLimiter(limit, windowMs) {
  const hits = [];
  return now => {
    while (hits.length && hits[0] <= now - windowMs) hits.shift();
    if (hits.length >= limit) return false;
    hits.push(now);
    return true;
  };
}
const allow = createLimiter(3, 1000);
const times = [0, 100, 200, 300, 900, 1050, 1150, 1250];
console.log(times.map(t => t + ":" + (allow(t) ? "ok" : "blocked")).join(" "));`,
  },
  {
    id: 'deepmerge', cat: 'Advanced algorithms', title: 'Deep merge', level: 'Medium', ask: 'Merge user settings into defaults, keeping nested values.',
    why: 'Spread only merges the <b>top level</b>: <code>user.theme</code> replaces the whole default theme. Deep merge recurses into objects that exist on both sides and copies everything else (arrays are replaced, not merged).',
    code: `const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function deepMerge(target, ...sources) {
  const out = { ...target };
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
    }
  }
  return out;
}
const defaults = { theme: { color: "blue", font: { size: 12, family: "sans" } }, plugins: ["a"] };
const user = { theme: { font: { size: 16 } }, plugins: ["b"] };
console.log(JSON.stringify(deepMerge(defaults, user)));
console.log(JSON.stringify({ ...defaults, ...user }.theme));`,
  },
  {
    id: 'roman', cat: 'Advanced algorithms', title: 'Roman numerals', level: 'Medium', ask: 'Convert numbers to and from Roman numerals.',
    why: 'To convert to Roman numerals, greedily take the biggest symbol that fits, including the subtractive pairs (CM, IV...). To convert back, add each symbol\'s value, but <b>subtract</b> it when a bigger symbol follows (the I in IV).',
    code: `const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function toRoman(n) {
  let out = "";
  for (const [value, sym] of ROMAN) while (n >= value) { out += sym; n -= value; }
  return out;
}
function fromRoman(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) total += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]];
  return total;
}
console.log(toRoman(1994), toRoman(2024), fromRoman("MCMXCIV"), fromRoman("XLII"));`,
  },
  {
    id: 'compress', cat: 'Advanced algorithms', title: 'String compression', level: 'Easy', ask: 'Turn "aaabccdddd" into "a3b1c2d4".',
    why: 'Walk the string; for each run of the same character, write the character and the run length. Return the original if "compressed" is not shorter. To decompress, a regex with a callback repeats each letter.',
    code: `function compress(s) {
  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += s[i] + (j - i);
    i = j;
  }
  return out.length < s.length ? out : s;
}
const decompress = s => s.replace(/(\\D)(\\d+)/g, (_, ch, n) => ch.repeat(Number(n)));
console.log(compress("aaabccdddd"), compress("abc"), decompress("a3b1c2d4"));`,
  },
  {
    id: 'nqueens', cat: 'Advanced algorithms', title: 'N-Queens (backtracking)', level: 'Hard', ask: 'How many ways can 4 queens sit on a 4×4 board safely?',
    why: '<b>Backtracking</b>: place a queen in a row, recurse to the next row, and when that fails, <b>undo</b> the placement and try the next column. Sets of used columns and diagonals (<code>row - c</code> and <code>row + c</code>) make each safety check O(1). Watch the call stack go up and down.',
    code: `function nQueens(n) {
  let count = 0;
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  function place(row) {
    if (row === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(row - c) || d2.has(row + c)) continue;
      cols.add(c); d1.add(row - c); d2.add(row + c);
      place(row + 1);
      cols.delete(c); d1.delete(row - c); d2.delete(row + c);
    }
  }
  place(0);
  return count;
}
console.log(nQueens(4), nQueens(1));`,
  },
  {
    id: 'sudoku', cat: 'Advanced algorithms', title: 'Valid Sudoku', level: 'Medium', ask: 'Check rows, columns and boxes in one pass.',
    why: 'For each filled cell, build three keys, "row r has v", "column c has v" and "box b has v", and keep them in one Set. Seeing any key twice means the board is invalid. One pass, O(cells). (A 4×4 board keeps the steps short; 9×9 works the same way.)',
    code: `function isValidSudoku(board) {
  const n = board.length, box = Math.sqrt(n);
  const seen = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = board[r][c];
      if (v === ".") continue;
      const keys = ["r" + r + v, "c" + c + v, "b" + Math.floor(r / box) + Math.floor(c / box) + v];
      if (keys.some(k => seen.has(k))) return false;
      keys.forEach(k => seen.add(k));
    }
  }
  return true;
}
console.log(isValidSudoku([["1", "2", ".", "."], [".", ".", "1", "."], ["2", ".", ".", "3"], [".", "4", ".", "."]]));
console.log(isValidSudoku([["1", "2", ".", "."], ["2", ".", ".", "."], [".", ".", ".", "."], [".", ".", ".", "."]]));`,
  },
  {
    id: 'ttlcache', cat: 'Advanced algorithms', title: 'Cache with expiry (TTL)', level: 'Medium', ask: 'Entries should expire after 100ms.',
    why: 'Store each value with its <b>expiry time</b>. On <code>get</code>, if the time has passed, delete the entry and report a miss. Checking lazily on read avoids running timers for every key. Real caches mix this with a size limit (LRU).',
    code: `class TTLCache {
  constructor(ttl) { this.ttl = ttl; this.map = new Map(); }
  set(key, value, now) { this.map.set(key, { value, expires: now + this.ttl }); }
  get(key, now) {
    const hit = this.map.get(key);
    if (!hit) return "miss";
    if (now >= hit.expires) { this.map.delete(key); return "expired"; }
    return hit.value;
  }
}
const cache = new TTLCache(100);
cache.set("user", "Ada", 0);
console.log(cache.get("user", 50), cache.get("user", 100), cache.get("user", 120), cache.get("x", 0), cache.map.size);`,
  },

  // ------------------------------------------------------------ browser (more)
  {
    id: 'rafvstimeout', cat: 'Browser & DOM', title: 'requestAnimationFrame vs setTimeout', level: 'Medium', ask: 'Which callback runs first?',
    why: 'Microtasks run first, as always. A 0ms timer is due at once, but a <code>requestAnimationFrame</code> callback waits for the <b>next repaint</b> (about every 16.7ms at 60 frames per second). Use rAF for animations, so they are drawn in step with the screen.',
    expect: ['sync', 'microtask', 'timeout 0ms', 'animation frame'],
    code: `setTimeout(() => console.log("timeout 0ms"), 0);
requestAnimationFrame(() => console.log("animation frame"));
Promise.resolve().then(() => console.log("microtask"));
console.log("sync");`,
  },
  {
    id: 'sessionstorage', cat: 'Browser & DOM', title: 'sessionStorage vs localStorage', level: 'Easy', ask: 'What is the difference?',
    why: 'Both store strings with the same API. <code>localStorage</code> stays until it is cleared, even after the browser restarts. <code>sessionStorage</code> lives only as long as the tab. Neither is sent to the server; cookies are. A missing key gives <code>null</code> (typeof "object").',
    expect: ['dark hello', '1 1 object', 'null'],
    code: `localStorage.setItem("theme", "dark");
sessionStorage.setItem("draft", "hello");
console.log(localStorage.getItem("theme"), sessionStorage.getItem("draft"));
console.log(localStorage.length, sessionStorage.length, typeof sessionStorage.getItem("nothing"));
sessionStorage.removeItem("draft");
console.log(sessionStorage.getItem("draft"));
localStorage.clear();`,
  },
  {
    id: 'aborttimeout', cat: 'Browser & DOM', title: 'fetch with a timeout (AbortController)', level: 'Hard', ask: 'Cancel a request that takes too long.',
    why: 'Pass <code>controller.signal</code> to <code>fetch</code> and call <code>controller.abort()</code> from a timer. The fetch promise rejects with an <b>AbortError</b>, and the request really stops (unlike <code>Promise.race</code>). <code>finally</code> clears the timer either way.',
    expect: ['timed out after 50ms', 'got 200'],
    code: `async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return "got " + res.status;
  } catch (e) {
    return e.name === "AbortError" ? "timed out after " + ms + "ms" : "failed";
  } finally {
    clearTimeout(timer);
  }
}
fetchWithTimeout("/api/users/1", 1000).then(r => console.log(r));
fetchWithTimeout("/api/users/1", 50).then(r => console.log(r));`,
  },
  {
    id: 'urlparams', cat: 'Browser & DOM', title: 'URL and URLSearchParams', level: 'Easy', ask: 'Build a query string safely.',
    why: '<code>URLSearchParams</code> encodes values for you (a space becomes +, & becomes %26), so you never concatenate query strings by hand. <code>new URL()</code> splits a URL into parts, and its <code>searchParams</code> stay in sync when you change them.',
    code: `const params = new URLSearchParams({ q: "js engine", page: 2 });
params.append("tag", "a&b");
console.log(params.toString());

const url = new URL("https://shop.example/search?" + params);
console.log(url.searchParams.get("q"), url.searchParams.get("page"), url.searchParams.getAll("tag").length);
url.searchParams.set("page", "3");
console.log(url.pathname, url.search);`,
  },
  {
    id: 'searchdebounce', cat: 'Browser & DOM', title: 'Debounced search box', level: 'Medium', ask: 'Three keystrokes, how many searches?',
    why: 'Every "input" event clears the previous timer and starts a new 300ms one. Only after the user <b>stops typing</b> for 300ms does a search run, with the latest value. That saves a request per keystroke.',
    expect: ['search for: js engine'],
    code: `// @file index.html
<input id="search" placeholder="Search">

// @file main.js
const input = document.getElementById("search");
let timer;
input.addEventListener("input", e => {
  clearTimeout(timer);
  timer = setTimeout(() => console.log("search for:", e.target.value), 300);
});
simulateTyping("#search", "j", 0);
simulateTyping("#search", "js", 100);
simulateTyping("#search", "js engine", 200);`,
  },

  // ------------------------------------------------------------ testing
  {
    id: 'testframework', cat: 'Testing', title: 'Build a tiny test framework', level: 'Medium', ask: 'Implement describe, it and expect.',
    why: '<code>expect(actual)</code> returns matcher functions that <b>throw</b> when the check fails. <code>it</code> runs a test inside <code>try/catch</code> and records pass or fail, so one failing test doesn\'t stop the rest. Jest and Mocha work the same way, with nicer output.',
    code: `const results = [];
function expect(actual) {
  return {
    toBe: expected => {
      if (actual !== expected) throw new Error("expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual));
    },
    toEqual: expected => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("not deep equal");
    },
    toThrow: () => {
      try { actual(); } catch (e) { return; }
      throw new Error("expected a throw");
    },
  };
}
function it(name, fn) {
  try { fn(); results.push("PASS " + name); }
  catch (e) { results.push("FAIL " + name + ": " + e.message); }
}
function describe(name, fn) { results.push(name); fn(); }

const sum = (a, b) => a + b;
describe("sum", () => {
  it("adds numbers", () => expect(sum(1, 2)).toBe(3));
  it("joins strings", () => expect(sum("a", "b")).toBe("ab"));
  it("is wrong on purpose", () => expect(sum(0.1, 0.2)).toBe(0.3));
  it("works on arrays", () => expect([1, 2].map(n => sum(n, 1))).toEqual([2, 3]));
  it("throws on null.x", () => expect(() => null.x).toThrow());
});
results.forEach(r => console.log(r));`,
  },
  {
    id: 'spies', cat: 'Testing', title: 'Spies and mocks', level: 'Medium', ask: 'Check that a function was called with the right arguments.',
    why: 'A <b>spy</b> wraps a function and records every call, so a test can check how it was used. A <b>mock</b> replaces a real dependency (like <code>fetch</code>) with a fake that returns known data. Passing dependencies in as parameters (<code>send</code>) makes code easy to test.',
    code: `function spy(fn = () => {}) {
  const calls = [];
  const wrapper = (...args) => { calls.push(args); return fn(...args); };
  wrapper.calls = calls;
  return wrapper;
}
function notifyUsers(users, send) {
  users.filter(u => u.active).forEach(u => send(u.email, "Hello " + u.name));
}
const send = spy();
notifyUsers([{ name: "Ada", email: "a@x", active: true }, { name: "Bob", email: "b@x", active: false }], send);
console.log(send.calls.length, JSON.stringify(send.calls[0]));

const fakeFetch = spy(url => Promise.resolve({ ok: true, url }));
fakeFetch("/api").then(r => console.log("mocked", r.url, fakeFetch.calls.length));`,
  },
  {
    id: 'faketimers', cat: 'Testing', title: 'Fake timers', level: 'Hard', ask: 'Test timer code without waiting.',
    why: 'A fake clock replaces <code>setTimeout</code> with a list of callbacks and a pretend "now". <code>tick(ms)</code> moves time forward and runs whatever became due, in order, instantly. Jest\'s <code>useFakeTimers</code> does this, so tests of debounce or polling run in milliseconds.',
    code: `function createFakeClock() {
  let now = 0;
  const timers = [];
  return {
    setTimeout: (fn, ms) => timers.push({ at: now + ms, fn }),
    tick(ms) {
      now += ms;
      timers.sort((a, b) => a.at - b.at);
      while (timers.length && timers[0].at <= now) timers.shift().fn();
    },
  };
}
const clock = createFakeClock();
const log = [];
clock.setTimeout(() => log.push("after 100"), 100);
clock.setTimeout(() => log.push("after 50"), 50);
clock.tick(60);
console.log(log.join());
clock.tick(60);
console.log(log.join());`,
  },
);

// ------------------------------------------------------------ theory flashcards (no code)
(function () {
  const T = (id, level, q, a) => ({ id: 'th-' + id, cat: 'Theory flashcards', kind: 'theory', level, title: q, ask: q, why: a });
  window.JS_INTERVIEW.push(
    T('nullundef', 'Easy', 'What is the difference between null and undefined?', '<code>undefined</code> means "no value was given": an unassigned variable, a missing property or argument, a function with no <code>return</code>. <code>null</code> is a value you set <b>on purpose</b> to mean "empty". <code>typeof undefined</code> is "undefined", but <code>typeof null</code> is "object" (an old bug). <code>null == undefined</code> is true, but <code>===</code> is false.'),
    T('equality', 'Easy', 'Explain == vs ===.', '<code>===</code> (strict equality) compares type and value with <b>no conversion</b>. <code>==</code> converts types first using coercion rules (e.g. <code>"5" == 5</code> is true, <code>0 == ""</code> is true). Prefer <code>===</code>; the common exception is <code>x == null</code> to check for both null and undefined.'),
    T('closure', 'Easy', 'What is a closure?', 'A closure is a function together with the variables of the scope where it was <b>created</b>. The function keeps access to them even after that outer function has returned. Uses: private state (counters, modules), function factories, callbacks and memoization. Watch for closures keeping large data alive longer than needed.'),
    T('hoisting', 'Easy', 'What is hoisting?', 'Before code runs, the engine\'s <b>creation phase</b> sets up memory for every declaration in a scope. <code>var</code> is created as <code>undefined</code>, and function declarations are created with their full body. <code>let</code>, <code>const</code> and <code>class</code> are hoisted too, but stay in the Temporal Dead Zone until their line runs, so reading them early throws.'),
    T('varletconst', 'Easy', 'var vs let vs const?', '<code>var</code>: function-scoped, can be redeclared, hoisted as undefined, and becomes a property of <code>window</code> at the top level. <code>let</code>: block-scoped and can be reassigned. <code>const</code>: block-scoped and can\'t be reassigned (but objects it points to can still change). Both have a TDZ. Use <code>const</code> by default and <code>let</code> when you need to reassign.'),
    T('tdz', 'Medium', 'What is the Temporal Dead Zone?', 'The time between entering a scope and the line where a <code>let</code>/<code>const</code>/<code>class</code> is declared. The binding exists (it shadows outer names) but is not initialised, so any access throws a <b>ReferenceError</b>. It catches bugs that <code>var</code>\'s silent <code>undefined</code> would hide.'),
    T('eventloop', 'Medium', 'Explain the event loop.', 'JavaScript runs on one thread with a <b>call stack</b>. Slow work (timers, network, events) is handed to the host (browser or Node). When it finishes, a callback is queued. The event loop waits until the stack is empty, then runs <b>all microtasks</b> (promise callbacks), then takes <b>one task</b> from the callback queue, and repeats. Long synchronous code blocks everything.'),
    T('microtask', 'Medium', 'Microtasks vs macrotasks (tasks)?', '<b>Microtasks</b>: promise <code>then/catch/finally</code>, <code>await</code> continuations, <code>queueMicrotask</code>, MutationObserver. <b>Tasks</b>: <code>setTimeout</code>, <code>setInterval</code>, I/O, UI events. After each task, the microtask queue is emptied <b>completely</b> before the next task (or a repaint), so <code>Promise.resolve().then(...)</code> beats <code>setTimeout(..., 0)</code>.'),
    T('promise', 'Easy', 'What is a Promise?', 'An object representing a value that will be available later. It is <b>pending</b>, then settles once as <b>fulfilled</b> (with a value) or <b>rejected</b> (with a reason), and never changes again. <code>.then</code> returns a new promise, which allows chaining; <code>.catch</code> handles errors; <code>.finally</code> always runs. Combinators: <code>all</code>, <code>allSettled</code>, <code>race</code>, <code>any</code>.'),
    T('asyncawait', 'Easy', 'async/await vs promises?', '<code>async/await</code> is syntax on top of promises. An <code>async</code> function always returns a promise; <code>await</code> pauses only that function until the promise settles, without blocking the thread. It reads like synchronous code and works with <code>try/catch</code>. Run independent work in parallel with <code>await Promise.all([...])</code> instead of awaiting one after another.'),
    T('this', 'Medium', 'How is this determined?', 'It depends on <b>how the function is called</b>: 1) <code>new F()</code> gives the new object; 2) <code>call</code>/<code>apply</code>/<code>bind</code> give the object you pass; 3) <code>obj.method()</code> gives <code>obj</code>; 4) a plain call gives <code>undefined</code> in strict mode (the global object otherwise). <b>Arrow functions</b> have no own <code>this</code>: they use the <code>this</code> of where they were written.'),
    T('callapplybind', 'Easy', 'call vs apply vs bind?', 'All three set <code>this</code>. <code>fn.call(obj, a, b)</code> calls now with arguments listed one by one. <code>fn.apply(obj, [a, b])</code> calls now with an array of arguments. <code>fn.bind(obj, a)</code> does not call; it returns a new function with <code>this</code> (and optionally the first arguments) fixed permanently.'),
    T('arrow', 'Easy', 'Arrow functions vs regular functions?', 'Arrow functions have no own <code>this</code>, <code>arguments</code>, <code>super</code> or <code>new.target</code>; they borrow them from the surrounding code. They can\'t be used with <code>new</code> and have no <code>prototype</code>. Use them for callbacks; use regular functions (or methods) when you need a dynamic <code>this</code>, like object methods and constructors.'),
    T('prototype', 'Medium', 'What is prototypal inheritance?', 'Every object has a hidden link (<code>[[Prototype]]</code>, reachable with <code>Object.getPrototypeOf</code>) to another object. When a property is missing, the engine looks it up along this <b>prototype chain</b>. Methods shared by all instances live on <code>Constructor.prototype</code>. <code>class</code> and <code>extends</code> are syntax that sets up these links.'),
    T('classvsfn', 'Medium', 'class vs constructor function?', 'Classes are mostly syntax over constructor functions and prototypes, with differences: class bodies are always strict, classes must be called with <code>new</code>, they are not hoisted like function declarations (they have a TDZ), and they support <code>extends</code>/<code>super</code>, static members and private <code>#fields</code>.'),
    T('execcontext', 'Medium', 'What is an execution context?', 'The environment a piece of code runs in. Each one holds its variables (scope), <code>this</code>, and a link to the outer scope. The engine creates one for the global code and one <b>for every function call</b>, in two phases: creation (hoisting) and execution. They sit on the <b>call stack</b>: pushed on call, popped on return.'),
    T('lexical', 'Medium', 'What is lexical scope / the scope chain?', 'Scope is decided by <b>where code is written</b>, not where it is called. Each scope links to its outer scope; a variable lookup starts in the current scope and climbs outwards to the global scope, and if it is not found you get a ReferenceError. Inner scopes can read outer variables, never the other way round.'),
    T('primref', 'Easy', 'Primitives vs reference types?', 'Primitives (<code>string, number, bigint, boolean, undefined, null, symbol</code>) are immutable and copied by value. Objects (including arrays and functions) live in the heap; variables hold a <b>reference</b> to them, so copying a variable copies the reference and both see changes. <code>===</code> on objects compares references, not contents.'),
    T('shallowdeep', 'Easy', 'Shallow vs deep copy?', 'A shallow copy (<code>{...obj}</code>, <code>Object.assign</code>, <code>arr.slice()</code>) copies the top level only; nested objects are still shared. A deep copy duplicates every level: <code>structuredClone(obj)</code> (handles Dates, Maps and cycles), or <code>JSON.parse(JSON.stringify(obj))</code> (loses functions, undefined and Dates).'),
    T('passby', 'Medium', 'Is JavaScript pass-by-value or by reference?', 'Always <b>pass-by-value</b>, but for objects the value <b>is a reference</b>. A function can mutate an object passed to it (the caller sees it), but reassigning the parameter only changes the local variable, never the caller\'s.'),
    T('currying', 'Medium', 'What is currying?', 'Turning a function of several arguments into a chain of functions taking one argument each: <code>f(a, b, c)</code> becomes <code>f(a)(b)(c)</code>. It enables partial application (pre-filling arguments) and composition. It is built with closures that collect arguments until there are enough (<code>fn.length</code>).'),
    T('hof', 'Easy', 'What is a higher-order function?', 'A function that <b>takes</b> a function as an argument or <b>returns</b> one. Examples: <code>map</code>, <code>filter</code>, <code>reduce</code>, <code>setTimeout</code>, <code>addEventListener</code>, <code>debounce</code>, <code>memoize</code>. It works because functions are first-class values in JavaScript.'),
    T('pure', 'Easy', 'What is a pure function?', 'A function whose result depends only on its arguments, and which has <b>no side effects</b> (no changing outside variables, no I/O, no mutation of its inputs). Pure functions are easy to test, cache and reason about. Side effects still exist, but are pushed to the edges of a program.'),
    T('debthrottle', 'Medium', 'Debounce vs throttle?', '<b>Debounce</b>: wait until calls stop for X ms, then run once with the last call (search boxes, autosave, resize end). <b>Throttle</b>: run at most once every X ms, however often it is called (scroll, mousemove, game loops). Both reduce work caused by rapid events.'),
    T('events', 'Medium', 'Event capturing, bubbling and delegation?', 'A DOM event travels <b>down</b> from the window to the target (capture), fires on the target, then <b>bubbles up</b> through the parents. <code>addEventListener(type, fn, true)</code> listens during capture. <code>stopPropagation()</code> stops the journey. <b>Delegation</b> puts one listener on a parent and uses <code>event.target</code> to handle many children, including ones added later.'),
    T('dom', 'Easy', 'What is the DOM? What is a virtual DOM?', 'The <b>DOM</b> is the browser\'s live tree of objects for the page, which JavaScript reads and changes. Changing it can trigger expensive layout and paint. A <b>virtual DOM</b> (React) is a lightweight copy in plain objects; the framework diffs the old and new copies and applies only the minimal real changes.'),
    T('storage', 'Easy', 'localStorage vs sessionStorage vs cookies?', '<code>localStorage</code>: about 5–10MB, persists until cleared, same origin, never sent to the server. <code>sessionStorage</code>: the same, but only for that tab\'s lifetime. <b>Cookies</b>: about 4KB, sent with <b>every request</b> to the server, can expire, and can be <code>HttpOnly</code> (hidden from JS) and <code>Secure</code>. All storage APIs hold strings only.'),
    T('cors', 'Medium', 'What is CORS?', 'Cross-Origin Resource Sharing. Browsers block a page from reading responses from <b>another origin</b> (scheme + host + port) unless that server allows it with headers like <code>Access-Control-Allow-Origin</code>. For non-simple requests, the browser first sends a <b>preflight</b> <code>OPTIONS</code> request. CORS is enforced by the browser, not the server, so it doesn\'t protect APIs from other clients.'),
    T('json', 'Easy', 'What is JSON? What can\'t it hold?', 'A text format for data: objects, arrays, strings, numbers, booleans and null. <code>JSON.stringify</code> turns a value into text, and <code>JSON.parse</code> turns text back. It can\'t hold functions, <code>undefined</code>, symbols, <code>NaN</code>/<code>Infinity</code> (they become null), Dates (they become strings), Maps or Sets, or circular references (that throws).'),
    T('gc', 'Medium', 'How does garbage collection work? What causes leaks?', 'Engines use <b>mark-and-sweep</b>: starting from the roots (globals, the call stack), they mark everything reachable, and free the rest. Leaks happen when unneeded objects stay <b>reachable</b>: forgotten timers or event listeners, growing caches and Maps, closures holding big data, detached DOM nodes still referenced, accidental globals. Use WeakMap/WeakRef where appropriate.'),
    T('workers', 'Medium', 'What are Web Workers and when would you use one?', 'Background threads with their own memory and event loop. They can\'t touch the DOM. They talk to the page with <code>postMessage</code>, and messages are copied (structured clone) unless you transfer them or use a SharedArrayBuffer. Use them for CPU-heavy work (parsing, image processing, crypto) so the UI stays responsive.'),
    T('strict', 'Easy', 'What does "use strict" change?', 'It turns silent mistakes into errors: assigning to undeclared variables throws, writes to read-only properties throw, duplicate parameter names are banned, <code>this</code> is <code>undefined</code> in plain calls (not the global object), and <code>with</code> is forbidden. Classes and ES modules are always strict.'),
    T('modules', 'Medium', 'ES modules vs CommonJS?', '<b>ESM</b> (<code>import</code>/<code>export</code>): static, analysed before running (so tree-shaking works), live read-only bindings, asynchronous loading, top-level <code>await</code>, strict by default. <b>CommonJS</b> (<code>require</code>/<code>module.exports</code>, the traditional Node format): dynamic, synchronous, exports a copied value. Browsers support only ESM natively.'),
    T('generators', 'Medium', 'What are generators and iterators?', 'An <b>iterator</b> is an object with <code>next()</code> returning <code>{ value, done }</code>; an <b>iterable</b> has <code>[Symbol.iterator]()</code>, which <code>for...of</code> and spread use. A <b>generator</b> (<code>function*</code>) makes iterators easily: it pauses at each <code>yield</code> and resumes on <code>next()</code>. Uses: lazy or infinite sequences, custom iteration, and (historically) async flows.'),
    T('symbol', 'Medium', 'What is a Symbol used for?', 'A unique, unforgeable primitive. It is used as a property key that won\'t clash with other keys and is hidden from <code>for...in</code>, <code>Object.keys</code> and JSON. Built-in "well-known" symbols customise language behaviour: <code>Symbol.iterator</code>, <code>Symbol.toPrimitive</code>, <code>Symbol.hasInstance</code>, <code>Symbol.toStringTag</code>.'),
    T('mapset', 'Easy', 'Map vs Object, Set vs Array?', '<b>Map</b>: any key type (objects too), keeps insertion order, has <code>size</code>, fast adds and deletes, no inherited keys. Good for dictionaries and caches. <b>Object</b>: string/symbol keys, JSON-friendly, good for fixed-shape records. <b>Set</b>: unique values with O(1) <code>has</code>; <b>Array</b>: ordered and indexed, allows duplicates, and its <code>includes</code> is O(n).'),
    T('weak', 'Hard', 'What are WeakMap, WeakSet and WeakRef?', 'They hold objects <b>weakly</b>: they don\'t prevent garbage collection. WeakMap/WeakSet keys must be objects, and the collections can\'t be iterated or sized. Use them to attach data to objects you don\'t own (private data, caches per DOM node) without leaks. <code>WeakRef</code> lets you hold an object that may disappear; <code>FinalizationRegistry</code> runs cleanup after collection (timing not guaranteed).'),
    T('polyfill', 'Easy', 'Polyfill vs transpiler?', 'A <b>polyfill</b> adds a missing <b>API</b> at run time with plain JS (e.g. <code>Array.prototype.includes</code>, <code>Promise</code>). A <b>transpiler</b> (Babel, TypeScript, esbuild) rewrites new <b>syntax</b> into older syntax ahead of time (e.g. optional chaining, classes). New syntax can\'t be polyfilled; it must be transpiled.'),
    T('spreadrest', 'Easy', 'Spread vs rest?', 'The same <code>...</code> syntax with opposite jobs. <b>Spread</b> expands an iterable or object into separate elements or properties: <code>f(...args)</code>, <code>[...a, ...b]</code>, <code>{...obj}</code>. <b>Rest</b> collects the remaining items into an array or object: <code>function f(...args)</code>, <code>const [first, ...others] = arr</code>.'),
    T('nullish', 'Easy', 'Optional chaining and nullish coalescing?', '<code>a?.b</code> returns <code>undefined</code> instead of throwing when <code>a</code> is null or undefined (also <code>a?.[k]</code> and <code>fn?.()</code>). <code>a ?? b</code> uses <code>b</code> only when <code>a</code> is null or undefined, unlike <code>||</code>, which also replaces <code>0</code>, <code>""</code> and <code>false</code>. Use <code>??</code> for defaults where 0 or "" are valid.'),
    T('asyncerrors', 'Medium', 'How do you handle errors in async code?', 'With <code>async/await</code>, wrap <code>await</code> in <code>try/catch</code> (and use <code>finally</code> for cleanup). With promise chains, end with <code>.catch</code>. A <code>try/catch</code> around <code>setTimeout</code> or around code that doesn\'t await can\'t catch later errors. Listen for <code>unhandledrejection</code> (browser) / <code>process.on("unhandledRejection")</code> (Node) as a safety net, and remember fetch doesn\'t reject on HTTP 404/500.'),
    T('xss', 'Medium', 'What is XSS and how do you prevent it?', 'Cross-site scripting: an attacker gets their script to run in your page, usually by injecting HTML into it. Prevent it by never inserting untrusted data as HTML: use <code>textContent</code> instead of <code>innerHTML</code>, escape output (frameworks do this by default), sanitise any HTML you must render (DOMPurify), add a Content-Security-Policy, and mark session cookies <code>HttpOnly</code>.'),
    T('rendering', 'Hard', 'Reflow vs repaint? How do you keep pages fast?', 'A <b>reflow</b> (layout) recalculates element sizes and positions, which is expensive. A <b>repaint</b> redraws pixels without changing layout. Avoid "layout thrashing" (reading <code>offsetHeight</code> right after writing styles, in a loop), batch DOM writes, animate <code>transform</code>/<code>opacity</code> (handled by the compositor), use <code>requestAnimationFrame</code>, and debounce resize and scroll handlers.'),
    T('nodeloop', 'Hard', 'How is Node\'s event loop different from the browser\'s?', 'Node (libuv) runs in <b>phases</b>: timers → pending callbacks → poll (I/O) → check (<code>setImmediate</code>) → close callbacks. Between callbacks it empties the <code>process.nextTick</code> queue first, then promise microtasks. There is no rendering step and no DOM. File and DNS work runs in a thread pool.'),
    T('immutability', 'Medium', 'Why does immutability matter?', 'Never changing existing data (creating new copies instead) makes changes easy to detect (a reference check: <code>old !== new</code>), enables undo/redo and time travel, avoids bugs from shared mutable state, and makes functions predictable. React and Redux rely on it. <code>Object.freeze</code> enforces it (shallowly); libraries like Immer make it convenient.'),
    T('coercion', 'Medium', 'What is type coercion?', 'Automatic conversion between types. Implicit: <code>"5" * 2</code> gives 10, <code>"5" + 2</code> gives "52", <code>if ("")</code> is falsy, and <code>==</code> converts. Explicit: <code>Number(x)</code>, <code>String(x)</code>, <code>Boolean(x)</code>, <code>parseInt</code>. Objects convert using <code>Symbol.toPrimitive</code>, <code>valueOf</code> and <code>toString</code>. Know the 8 falsy values and prefer explicit conversion.'),
    T('iife', 'Easy', 'What is an IIFE and why use it?', 'An Immediately Invoked Function Expression: <code>(function () { ... })()</code>. It runs once and creates a <b>private scope</b>, which was used to avoid polluting globals and to build modules before ES modules existed. It is still handy for a one-off async block: <code>(async () => { ... })()</code>.'),
    T('newkeyword', 'Medium', 'What exactly does new do?', '1) Creates an empty object. 2) Links its prototype to <code>Constructor.prototype</code>. 3) Runs the constructor with <code>this</code> set to that object. 4) Returns the object, unless the constructor explicitly returns a different <b>object</b>.'),
    T('pubsub', 'Easy', 'What is the publish/subscribe pattern?', 'Publishers emit named events without knowing who listens; subscribers register handlers for the events they care about. A central emitter or event bus connects them, which decouples the parts of an app. Examples: DOM events, Node\'s EventEmitter, message brokers. Always provide unsubscribe to avoid leaks.'),
  );
})();
