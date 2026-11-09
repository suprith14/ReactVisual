/* Levels: each one teaches a single idea about how JavaScript runs. */
window.JS_LEVELS = [
  {
    id: 'hoisting', emoji: '🪄', title: 'Hoisting Magic', concept: 'Creation phase', stars: 1,
    goal: 'See why you can use a var or a function before the line that declares it.',
    code: `console.log(greeting);
console.log(sayHi());

var greeting = "Hello";

function sayHi() {
  return "Hi from a hoisted function!";
}

console.log(greeting);`,
  },
  {
    id: 'callstack', emoji: '📚', title: 'The Call Stack', concept: 'Execution contexts', stars: 1,
    goal: 'Watch functions get pushed on and popped off the stack.',
    code: `function multiply(a, b) {
  return a * b;
}

function square(n) {
  const result = multiply(n, n);
  return result;
}

function printSquare(x) {
  const s = square(x);
  console.log(\`\${x} squared is \${s}\`);
}

printSquare(4);`,
  },
  {
    id: 'scope', emoji: '🔗', title: 'Scope Chain Climb', concept: 'Lexical scope', stars: 2,
    goal: 'When a variable is missing, JS climbs outward to find it.',
    code: `const planet = "Earth";

function outer() {
  const city = "Paris";

  function inner() {
    const street = "Rue Cler";
    console.log(street, city, planet);
  }

  inner();
}

outer();`,
  },
  {
    id: 'tdz', emoji: '⏳', title: 'var, let, const & the TDZ', concept: 'Block scope', stars: 2,
    goal: 'var ignores blocks; let/const stay inside them and cannot be used early.',
    code: `var a = 1;
let b = 2;
const c = 3;

if (true) {
  var a = 10;   // the SAME a — var ignores blocks
  let b = 20;   // a NEW b that lives only in this block
  console.log(a, b, c);
}

console.log(a, b, c);
console.log(d); // TDZ! d exists but is not ready yet
let d = 4;`,
  },
  {
    id: 'closure', emoji: '🎒', title: 'Closure Backpack', concept: 'Closures', stars: 3,
    goal: 'A function remembers the variables of the place it was born.',
    code: `function makeCounter() {
  let count = 0;
  return function increment() {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter());
console.log(counter());
console.log(counter());`,
  },
  {
    id: 'loops', emoji: '🔁', title: 'Loop Runner', concept: 'Loops', stars: 1,
    goal: 'Follow a for-loop round by round.',
    code: `const fruits = ["🍎", "🍌", "🍇"];
let basket = "";

for (let i = 0; i < fruits.length; i++) {
  basket += fruits[i];
}

console.log(basket);`,
  },
  {
    id: 'references', emoji: '📦', title: 'Heap & References', concept: 'Objects vs primitives', stars: 2,
    goal: 'Objects are shared by reference; primitives are copied by value.',
    code: `const hero = { name: "Ada", level: 1 };
const sameHero = hero;   // copies the REFERENCE

sameHero.level = 99;
console.log(hero.level); // 99 — same object!

let score = 10;
let copy = score;        // copies the VALUE
copy = 50;
console.log(score);      // still 10`,
  },
  {
    id: 'this', emoji: '👉', title: 'Who is "this"?', concept: 'this keyword', stars: 2,
    goal: 'this is the object in front of the dot when a method is called.',
    code: `const player = {
  name: "Zed",
  hp: 100,
  hit(damage) {
    this.hp = this.hp - damage;
    return this.name + " has " + this.hp + " HP";
  }
};

console.log(player.hit(30));
console.log(player.hit(25));`,
  },
  {
    id: 'recursion', emoji: '🪆', title: 'Recursion Tower', concept: 'Recursion', stars: 3,
    goal: 'A function that calls itself builds a tall stack, then unwinds it.',
    code: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const answer = factorial(4);
console.log(answer);`,
  },
  {
    id: 'callbacks', emoji: '🗺️', title: 'Callbacks: map & filter', concept: 'Higher-order functions', stars: 2,
    goal: 'Built-in methods call YOUR function for each item.',
    code: `const numbers = [1, 2, 3, 4];

const doubled = numbers.map(n => n * 2);
const big = doubled.filter(n => n > 4);

console.log(doubled);
console.log(big);`,
  },
  {
    id: 'eventloop', emoji: '🔄', title: 'The Event Loop', concept: 'Async & setTimeout', stars: 3,
    goal: 'Why does a 0ms timer still run last?',
    code: `console.log("1. Start");

setTimeout(function timerA() {
  console.log("4. Timer A (0ms)");
}, 0);

setTimeout(function timerB() {
  console.log("5. Timer B (1000ms)");
}, 1000);

console.log("2. Still running...");
console.log("3. End of script");`,
  },
  {
    id: 'varlet', emoji: '🧩', title: 'var vs let in Loops', concept: 'Closures + event loop', stars: 3,
    goal: 'The famous interview puzzle: why does var print 4, 4, 4?',
    code: `for (var i = 1; i <= 3; i++) {
  setTimeout(() => console.log("var i:", i), 100);
}

for (let j = 1; j <= 3; j++) {
  setTimeout(() => console.log("let j:", j), 200);
}`,
  },
  {
    id: 'microtasks', emoji: '⚡', title: 'Promises Jump the Queue', concept: 'Microtask Queue', stars: 3,
    goal: 'Why does .then() run before a 0ms setTimeout?',
    code: `console.log("1. Script start");

setTimeout(() => console.log("5. setTimeout (callback queue)"), 0);

Promise.resolve()
  .then(() => console.log("3. First .then (microtask)"))
  .then(() => console.log("4. Second .then (microtask)"));

console.log("2. Script end");`,
  },
  {
    id: 'promises', emoji: '🍕', title: 'Making a Promise', concept: 'resolve, reject, .then, .catch', stars: 3,
    goal: 'Build your own Promise and watch it go from pending to fulfilled or rejected.',
    code: `function orderPizza(flavor) {
  return new Promise((resolve, reject) => {
    console.log("Kitchen starts on " + flavor);
    setTimeout(() => {
      if (flavor === "pineapple") {
        reject(new Error("We don't do that here"));
      } else {
        resolve(flavor + " pizza 🍕");
      }
    }, 1000);
  });
}

orderPizza("cheese")
  .then(pizza => console.log("Got:", pizza))
  .catch(err => console.log("Oops:", err.message));

orderPizza("pineapple")
  .then(pizza => console.log("Got:", pizza))
  .catch(err => console.log("Oops:", err.message));`,
  },
  {
    id: 'asyncawait', emoji: '⏸️', title: 'Async / Await', concept: 'Pausing functions', stars: 3,
    goal: 'await pauses only its own function, and the rest of the program keeps running.',
    code: `function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeTea() {
  console.log("2. Boil the water...");
  await wait(1000);
  console.log("4. Water boiled, add tea");
  return "🍵";
}

console.log("1. Start");
makeTea().then(tea => console.log("5. Ready:", tea));
console.log("3. I'm not blocked!");`,
  },
  {
    id: 'asyncerrors', emoji: '🛟', title: 'Await + try/catch', concept: 'Async errors', stars: 3,
    goal: 'A rejected promise makes await throw, so a normal try/catch can handle it.',
    code: `function fetchUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === 1) resolve({ id: 1, name: "Ada" });
      else reject(new Error("User " + id + " not found"));
    }, 500);
  });
}

async function showUser(id) {
  try {
    const user = await fetchUser(id);
    console.log("Found:", user.name);
  } catch (err) {
    console.log("Error:", err.message);
  } finally {
    console.log("Done with user", id);
  }
}

showUser(1);
showUser(2);`,
  },
  {
    id: 'classes', emoji: '🏛️', title: 'Classes & Inheritance', concept: 'class, extends, super', stars: 2,
    goal: 'A class is a constructor function plus a prototype. extends links prototypes together.',
    code: `class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return this.name + " makes a sound";
  }
}

class Dog extends Animal {
  constructor(name, trick) {
    super(name);
    this.trick = trick;
  }
  speak() {
    return super.speak() + ", woof!";
  }
}

const rex = new Dog("Rex", "sit");
console.log(rex.speak());
console.log(rex instanceof Animal);`,
  },
  {
    id: 'privacy', emoji: '🔐', title: 'Private Fields & Getters', concept: '#private, get, set, static', stars: 3,
    goal: 'Hide data with #fields and control access with getters and setters.',
    code: `class BankAccount {
  #balance = 0;
  static bank = "JS Bank";

  deposit(amount) {
    this.#balance += amount;
    return this;
  }

  get balance() {
    return "$" + this.#balance;
  }

  set balance(value) {
    console.log("Nope! Use deposit()");
  }
}

const acc = new BankAccount();
acc.deposit(50).deposit(25);
acc.balance = 1000000;
console.log(acc.balance, BankAccount.bank);`,
  },
  {
    id: 'generators', emoji: '🔂', title: 'Generators', concept: 'function*, yield', stars: 3,
    goal: 'A generator pauses at every yield and resumes when you call .next().',
    code: `function* idMaker() {
  let id = 1;
  while (true) {
    yield id;
    id++;
  }
}

const ids = idMaker();
console.log(ids.next().value);
console.log(ids.next().value);
console.log(ids.next().value);`,
  },
  {
    id: 'iterators', emoji: '➡️', title: 'Make Anything Iterable', concept: 'Symbol.iterator, for…of, spread', stars: 3,
    goal: 'for…of and ... work on any object that has a [Symbol.iterator] method.',
    code: `class Countdown {
  constructor(from) {
    this.from = from;
  }
  *[Symbol.iterator]() {
    for (let n = this.from; n > 0; n--) {
      yield n;
    }
  }
}

for (const n of new Countdown(3)) {
  console.log(n);
}
console.log([...new Countdown(2)]);`,
  },
  {
    id: 'asyncgen', emoji: '🌊', title: 'Async Streams', concept: 'async function*, for await', stars: 3,
    goal: 'An async generator yields values over time, and for await waits for each one.',
    code: `const wait = ms => new Promise(r => setTimeout(r, ms));

async function* streamMessages() {
  yield "Hello";
  await wait(500);
  yield "from";
  await wait(500);
  yield "the stream!";
}

async function main() {
  for await (const msg of streamMessages()) {
    console.log(msg);
  }
  console.log("Stream ended");
}

main();`,
  },
  {
    id: 'mapset', emoji: '🗂️', title: 'Map & Set', concept: 'Collections', stars: 2,
    goal: 'Set keeps unique values; Map stores key → value pairs.',
    code: `const votes = ["🍕", "🍔", "🍕", "🌮", "🍕", "🍔"];

const unique = new Set(votes);
console.log("Options:", unique.size);

const tally = new Map();
for (const v of votes) {
  tally.set(v, (tally.get(v) || 0) + 1);
}
console.log(tally.get("🍕"), "votes for pizza");`,
  },
  {
    id: 'regex', emoji: '🔤', title: 'Regular Expressions', concept: 'Pattern matching', stars: 2,
    goal: 'Find, test and replace text using patterns.',
    code: `const text = "Call 555-1234 or 555-9876";
const phone = /(\\d{3})-(\\d{4})/g;

console.log(phone.test(text));
console.log(text.match(phone));
console.log(text.replace(phone, "$1-XXXX"));`,
  },
  {
    id: 'interval', emoji: '🚀', title: 'setInterval Countdown', concept: 'Repeating timers', stars: 2,
    goal: 'setInterval keeps putting the callback in the queue until you clear it.',
    code: `let count = 3;

const timer = setInterval(() => {
  console.log(count + "...");
  count--;
  if (count === 0) {
    clearInterval(timer);
    console.log("🚀 Liftoff!");
  }
}, 1000);

console.log("Countdown started");`,
  },
  {
    id: 'strict', emoji: '🔒', title: 'Strict Mode', concept: '"use strict"', stars: 2,
    goal: 'Strict mode turns silent mistakes into real errors.',
    code: `"use strict";

function showThis() {
  return this;
}
console.log(showThis()); // undefined in strict mode

try {
  totl = 100; // typo! no let or const
} catch (err) {
  console.log(err.name + ": " + err.message);
}

const settings = Object.freeze({ theme: "dark" });
try {
  settings.theme = "light";
} catch (err) {
  console.log(err.name);
}`,
  },
  {
    id: 'modules', emoji: '📦', title: 'Modules: import & export', concept: 'Splitting code into files', stars: 3,
    goal: 'Each file is a module with private memory. Imports are live links to exports.',
    code: `// @file math.js
export const PI = 3.14159;
export function area(r) {
  return PI * r * r;
}
export default function round2(x) {
  return Math.round(x * 100) / 100;
}

// @file main.js
import round2, { area, PI } from "./math.js";

console.log("PI is", PI);
console.log(round2(area(2)));`,
  },
  {
    id: 'fetch', emoji: '🌐', title: 'Fetching Data', concept: 'fetch + async/await', stars: 3,
    goal: 'Ask a (pretend) server for data without freezing the page.',
    code: `// A pretend server answers: /api/users, /api/users/1, /api/todos, /api/error
async function showUser(id) {
  const response = await fetch("/api/users/" + id);
  if (!response.ok) {
    console.log("Request failed:", response.status);
    return;
  }
  const user = await response.json();
  console.log("Hello,", user.name);
}

showUser(1);
showUser(99);
console.log("Requests sent!");`,
  },
  {
    id: 'dom', emoji: '🖱️', title: 'Events on a Page', concept: 'DOM + addEventListener', stars: 2,
    goal: 'Listeners wait in the browser until an event (like a click) queues them.',
    code: `// A pretend page has: #title, #btn, #name, #output
const button = document.getElementById("btn");
const output = document.getElementById("output");
let clicks = 0;

button.addEventListener("click", () => {
  clicks++;
  output.textContent = "Clicked " + clicks + " times";
  console.log(output.textContent);
});

console.log("Waiting for clicks...");
simulateClick("#btn", 500);   // pretend the user clicks
simulateClick("#btn", 1500);`,
  },
  {
    id: 'proxy', emoji: '🪤', title: 'Proxy Guards', concept: 'Proxy & Reflect', stars: 3,
    goal: 'A Proxy sits in front of an object and can intercept every read and write.',
    code: `const user = { name: "Ada", age: 36 };

const guarded = new Proxy(user, {
  get(target, key) {
    return key in target ? target[key] : "🤷 no " + key;
  },
  set(target, key, value) {
    if (key === "age" && typeof value !== "number") {
      console.log("❌ age must be a number");
      return true;
    }
    target[key] = value;
    return true;
  }
});

console.log(guarded.name, guarded.email);
guarded.age = "old";
guarded.age = 37;
console.log(user.age);`,
  },
  {
    id: 'realnet', emoji: '🛰️', title: 'A Real API', concept: 'fetch over the internet', stars: 3,
    goal: 'Request real data from a public API and watch the response arrive.',
    code: `// This calls a real public test API (it allows requests from any site).
async function loadUser(id) {
  try {
    const res = await fetch("https://jsonplaceholder.typicode.com/users/" + id);
    console.log("status:", res.status);
    const user = await res.json();
    console.log(user.name, "works at", user.company.name);
  } catch (err) {
    console.log("Network problem:", err.message);
  }
}

loadUser(1);
console.log("request sent, the page stays responsive");`,
  },
  {
    id: 'webpage', emoji: '🧩', title: 'Your Own Web Page', concept: 'HTML + DOM + event delegation', stars: 3,
    goal: 'Write HTML, attach one listener to a parent, then click items in the Page preview yourself.',
    code: `// @file index.html
<h1>Shopping list</h1>
<ul id="list">
  <li>Apples</li>
  <li>Bread</li>
</ul>
<input id="item" placeholder="New item">
<button id="add">Add</button>

// @file script.js
const list = document.querySelector("#list");

// one listener on the <ul> handles clicks on every <li> (event delegation)
list.addEventListener("click", event => {
  if (event.target.tagName === "LI") {
    event.target.classList.toggle("done");
    console.log("toggled", event.target.textContent);
  }
});

document.querySelector("#add").addEventListener("click", () => {
  const input = document.querySelector("#item");
  const li = document.createElement("li");
  li.textContent = input.value || "Something";
  list.appendChild(li);
  input.value = "";
});

simulateClick("#list li:nth-child(2)", 300); // try clicking items in the Page preview too!`,
  },
  {
    id: 'storage', emoji: '💾', title: 'Dialogs & Storage', concept: 'prompt, confirm, localStorage', stars: 2,
    goal: 'Ask the user with real dialogs, and remember the answer in localStorage between runs.',
    code: `let name = localStorage.getItem("name");

if (!name) {
  name = prompt("What is your name?", "Ada");
  localStorage.setItem("name", name);
}

const visits = Number(localStorage.getItem("visits") || 0) + 1;
localStorage.setItem("visits", visits);

console.log("Welcome back, " + name + "! Visit number " + visits);

if (confirm("Forget your name?")) {
  localStorage.removeItem("name");
  console.log("Forgotten. Run again and you'll be asked again.");
}`,
  },
  {
    id: 'tla', emoji: '⏳', title: 'Top-level await in Modules', concept: 'Async module loading', stars: 3,
    goal: 'A module can await at the top level; every module that imports it waits.',
    code: `// @file config.js
console.log("config: loading");
const res = await fetch("/api/users/1");
export const admin = await res.json();
console.log("config: ready");

// @file main.js
import { admin } from "./config.js";
console.log("main runs only after config:", admin.name);`,
  },
  {
    id: 'platform', emoji: '🧰', title: 'Intl, WeakRef & eval', concept: 'Platform APIs', stars: 3,
    goal: 'Format values for any locale, hold objects weakly, and run code from strings.',
    code: `const price = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
console.log(price.format(1234.5));

let session = { user: "Ada" };
const ref = new WeakRef(session);
session = null;            // nothing strong points to it now

const total = eval("2 + 3 * 4");   // a string run as code
console.log("eval:", total);

setTimeout(() => {
  console.log("still there?", ref.deref());
}, 100);`,
  },
  {
    id: 'combinators', emoji: '🧺', title: 'Promise.allSettled & any', concept: 'Promise combinators', stars: 3,
    goal: 'Wait for everything (allSettled) or take the first success (any).',
    code: `const wait = (ms, value, fail) => new Promise((resolve, reject) =>
  setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));

const tasks = [wait(300, "profile"), wait(100, "photos", true), wait(200, "friends")];

Promise.allSettled(tasks).then(results => {
  for (const r of results) console.log(r.status, r.value ?? r.reason.message);
});

Promise.any([wait(150, "mirror A", true), wait(250, "mirror B")])
  .then(fastest => console.log("first success:", fastest));`,
  },
  {
    id: 'descriptors', emoji: '🔧', title: 'Property Descriptors', concept: 'defineProperty, seal', stars: 3,
    goal: 'Every property has hidden settings: writable, enumerable, configurable.',
    code: `const config = { version: 3 };

Object.defineProperty(config, "secret", {
  value: "abc123",
  enumerable: false,  // hidden from keys / JSON
  writable: false     // read-only
});

config.secret = "hacked";        // silently ignored (an error in strict mode)
console.log(config.secret);
console.log(Object.keys(config), JSON.stringify(config));

const user = Object.seal({ name: "Ada" });
user.age = 36;                   // can't add to a sealed object
user.name = "Grace";             // but existing values can change
console.log(user);`,
  },
  {
    id: 'binary', emoji: '🔢', title: 'Bytes & Typed Arrays', concept: 'ArrayBuffer, Uint8Array, TextEncoder', stars: 3,
    goal: 'See how numbers and text are stored as raw bytes.',
    code: `const bytes = new Uint8Array(4);
bytes[0] = 255;
bytes[1] = 256;   // too big for one byte: wraps around to 0
bytes[2] = -1;    // wraps to 255
console.log(bytes);

// two views of the SAME memory
const buffer = new ArrayBuffer(4);
const asBytes = new Uint8Array(buffer);
const asNumber = new Uint32Array(buffer);
asNumber[0] = 1000;
console.log(asBytes);   // 1000 = 232 + 3 × 256 (little-endian)

const encoded = new TextEncoder().encode("Hi 👋");
console.log(encoded.length, "bytes for", "Hi 👋".length, "UTF-16 units");`,
  },
  {
    id: 'urlabort', emoji: '🛑', title: 'URL & Cancelling Requests', concept: 'URL, AbortController', stars: 3,
    goal: 'Build addresses safely and cancel a request that is no longer needed.',
    code: `const url = new URL("https://shop.example.com/search?q=shoes&page=1");
url.searchParams.set("page", "2");
console.log(url.hostname, url.searchParams.get("q"), url.href);

const controller = new AbortController();
fetch("/api/slow", { signal: controller.signal })   // takes 2 seconds
  .then(res => console.log("loaded", res.status))
  .catch(err => console.log("cancelled:", err.name));

setTimeout(() => controller.abort(), 500);   // e.g. the user navigated away`,
  },
  {
    id: 'lazyimport', emoji: '🚚', title: 'Lazy Loading with import()', concept: 'Dynamic import', stars: 3,
    goal: 'Load a module only when it is actually needed.',
    code: `// @file chart.js
console.log("chart.js is running now");
export function draw(values) {
  return values.map(v => "#".repeat(v)).join(" ");
}

// @file main.js
console.log("app started (chart.js not loaded yet)");

async function showChart() {
  const { draw } = await import("./chart.js");   // loaded on demand
  console.log(draw([3, 5, 2]));
}

setTimeout(showChart, 300);   // e.g. when the user opens the chart tab`,
  },
  {
    id: 'workers', emoji: '🧵', title: 'Web Workers', concept: 'Threads & messages', stars: 3,
    goal: 'Move heavy work to another thread; talk to it only with copied messages.',
    code: `// @file worker.js
// Runs on its own thread with its own memory.
self.onmessage = event => {
  const numbers = event.data;
  let total = 0;
  for (const n of numbers) total += n * n;
  postMessage(total);
};

// @file main.js
const worker = new Worker("worker.js");
const numbers = [1, 2, 3, 4];

worker.onmessage = event => {
  console.log("sum of squares:", event.data);
};

worker.postMessage(numbers);   // a COPY is sent
console.log("the main thread stays free while the worker counts");`,
  },
  {
    id: 'nodeloop', emoji: '🟢', title: "Node.js Event Loop", concept: 'nextTick, setImmediate, phases', stars: 3,
    goal: "Node has extra queues and runs its loop in phases.",
    code: `// @env node
console.log("1. script start");

setTimeout(() => console.log("5. setTimeout (timers phase)"), 0);
setImmediate(() => console.log("6. setImmediate (check phase)"));

Promise.resolve().then(() => console.log("4. promise (microtask)"));
process.nextTick(() => console.log("3. nextTick (before promises)"));

console.log("2. script end");`,
  },
  {
    id: 'emitter', emoji: '📣', title: 'Node EventEmitter', concept: 'require("events")', stars: 2,
    goal: 'Objects that announce events, the backbone of Node.js APIs.',
    code: `// @env node
const EventEmitter = require("events");

class Oven extends EventEmitter {
  bake(item) {
    console.log("baking", item);
    setTimeout(() => this.emit("done", item), 1000);
  }
}

const oven = new Oven();
oven.on("done", item => console.log(item, "is ready!"));
oven.once("done", () => console.log("(that was the first batch)"));

oven.bake("bread");
oven.bake("cookies");`,
  },
  {
    id: 'sharedmem', emoji: '🔗', title: 'Shared Memory & Races', concept: 'SharedArrayBuffer, Atomics', stars: 3,
    goal: 'Two threads change the same memory at once. Watch updates get lost, then fix it with Atomics.',
    code: `// @file counter.worker.js
// Each worker adds 1 to the shared counter, 3 times.
self.onmessage = event => {
  const counter = new Int32Array(event.data);
  for (let i = 0; i < 3; i++) {
    // counter[0]++ is really TWO steps: read, then write.
    const old = counter[0];
    counter[0] = old + 1;
    // the safe version is one indivisible step:
    // Atomics.add(counter, 0, 1);
  }
  postMessage("done");
};

// @file main.js
const memory = new SharedArrayBuffer(4);   // 4 bytes that threads share
const counter = new Int32Array(memory);
let finished = 0;

for (let n = 0; n < 2; n++) {
  const worker = new Worker("counter.worker.js");
  worker.onmessage = () => {
    finished++;
    if (finished === 2) console.log("expected 6, got", counter[0]);
  };
  worker.postMessage(memory);   // shared, NOT copied
}`,
  },
  {
    id: 'nodefs', emoji: '💾', title: 'Node.js Files', concept: 'fs: sync, callbacks, promises', stars: 2,
    goal: 'Read and write files three ways, and see which ones block the thread.',
    code: `// @env node
// @file todo.txt
buy milk
learn the event loop

// @file main.js
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "todo.txt");

// 1) sync: the whole thread waits for the disk
const text = fs.readFileSync(file, "utf8");
console.log("sync read:", text.split("\\n")[0]);

// 2) callback: the result comes back in the poll phase
fs.readFile(file, "utf8", (err, data) => {
  if (err) return console.log("error:", err.code);
  console.log("callback read:", data.length, "chars");
});

// 3) promises + await, with error handling
(async () => {
  await fs.promises.appendFile(file, "write tests\\n");
  const lines = (await fs.promises.readFile(file, "utf8")).trim().split("\\n");
  console.log("now", lines.length, "todos");
  try {
    await fs.promises.readFile("missing.txt", "utf8");
  } catch (err) {
    console.log("caught", err.code);
  }
})();

console.log("script done, the file work is still running");`,
  },
  {
    id: 'nodehttp', emoji: '🖥️', title: 'Node.js HTTP Server', concept: 'http.createServer + fetch', stars: 3,
    goal: 'Build a tiny REST API and call it from the same program.',
    code: `// @env node
const http = require("http");
const todos = [{ id: 1, title: "learn Node" }];

// the server: this function runs once for every request
const server = http.createServer((req, res) => {
  console.log("server got", req.method, req.url);
  if (req.method === "GET" && req.url === "/todos") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(todos));
  } else if (req.method === "POST" && req.url === "/todos") {
    let body = "";
    req.on("data", chunk => body += chunk);   // the body arrives as a stream
    req.on("end", () => {
      todos.push({ id: todos.length + 1, title: JSON.parse(body).title });
      res.writeHead(201);
      res.end("created");
    });
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});

// the client: talks to the server with fetch
server.listen(3000, async () => {
  const added = await fetch("http://localhost:3000/todos", {
    method: "POST",
    body: JSON.stringify({ title: "build an API" }),
  });
  console.log("client got", added.status, await added.text());

  const list = await fetch("http://localhost:3000/todos");
  console.log("client got", (await list.json()).length, "todos");

  const missing = await fetch("http://localhost:3000/nope");
  console.log("client got", missing.status);
  server.close();
});`,
  },
  {
    id: 'internals', emoji: '⚙️', title: 'Under the Hood: Hidden Classes', concept: 'Shapes, inline caches, JIT', stars: 3,
    goal: 'Why creating objects consistently makes code faster (turn on Internals in the Heap).',
    code: `// Turn on "Internals" in the Heap panel.
function Point(x, y) {
  this.x = x;   // shape {x}
  this.y = y;   // shape {x, y}
}

const a = new Point(1, 2);
const b = new Point(3, 4);      // same properties, same order → same hidden class
const c = { y: 5, x: 6 };       // different order → a different hidden class

function getX(p) { return p.x; } // this property read has an inline cache

let sum = 0;
for (let i = 0; i < 25; i++) sum += getX(i % 2 ? a : b);   // one shape: fast
sum += getX(c);                                              // a second shape: polymorphic
console.log(sum);`,
  },
  {
    id: 'errors', emoji: '💥', title: 'Errors & try/catch', concept: 'Exceptions', stars: 2,
    goal: 'A thrown error flies up the stack until something catches it.',
    code: `function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero!");
  }
  return a / b;
}

try {
  console.log(divide(10, 2));
  console.log(divide(5, 0));
} catch (err) {
  console.log("Caught:", err.message);
}`,
  },
  {
    id: 'patterns', emoji: '🧩', title: 'Design Patterns in Practice', concept: 'Observer, factory, module', stars: 3,
    goal: 'Build a tiny store with subscribers, the same idea behind Redux, Vue and DOM events.',
    code: `// Observer: a store tells its subscribers whenever it changes
class Store {
  #state;
  #listeners = [];
  constructor(initial) { this.#state = initial; }
  subscribe(fn) {
    this.#listeners.push(fn);
    return () => { this.#listeners = this.#listeners.filter(l => l !== fn); };
  }
  setState(update) {
    this.#state = { ...this.#state, ...update };
    this.#listeners.forEach(fn => fn(this.#state));
  }
}

// Factory: a function that builds configured functions
function createLogger(prefix) {
  return state => console.log(prefix, JSON.stringify(state));
}

const store = new Store({ count: 0 });
const stopA = store.subscribe(createLogger("A:"));
store.subscribe(createLogger("B:"));
store.setState({ count: 1 });
stopA();                  // unsubscribe A
store.setState({ count: 2 });`,
  },
  {
    id: 'mutationobs', emoji: '🔭', title: 'Watching the DOM', concept: 'MutationObserver timing', stars: 3,
    goal: 'DOM changes are collected and reported together, as one microtask.',
    code: `// @file index.html
<ul id="list"><li>first</li></ul>

// @file main.js
const list = document.getElementById("list");
const observer = new MutationObserver(records => {
  console.log("observer saw", records.length, "changes");
  records.forEach(r => console.log(" -", r.type + (r.attributeName ? " " + r.attributeName : "")));
});
observer.observe(list, { childList: true, attributes: true });

const li = document.createElement("li");
li.textContent = "second";
list.appendChild(li);              // change 1
list.setAttribute("class", "big"); // change 2

Promise.resolve().then(() => console.log("promise callback"));
console.log("script done");`,
  },
  {
    id: 'commonjs', emoji: '📦', title: 'Node.js Modules (require)', concept: 'CommonJS, module.exports, caching', stars: 2,
    goal: 'Split Node code into files with require and module.exports.',
    code: `// @env node
// @file math.js
console.log("math.js is loading");
function add(a, b) { return a + b; }
module.exports = { add, PI: 3.14 };

// @file greet.js
const { add } = require("./math.js");   // already loaded: comes from the cache
exports.hello = name => "Hello " + name + ", 2 + 2 = " + add(2, 2);

// @file main.js
console.log("main starts");
const math = require("./math.js");       // runs math.js now
const { hello } = require("./greet.js");
console.log(math.PI, math.add(1, 2));
console.log(hello("Ada"));
console.log(require("./math.js") === math);`,
  },
  {
    id: 'typescript', emoji: '🔷', title: 'TypeScript Basics', concept: 'Types are erased before running', stars: 2,
    goal: 'TypeScript adds types for your editor; the engine runs the same code with the types removed.',
    code: `// @lang ts
interface User {
  id: number;
  name: string;
  email?: string;            // optional
}

type Status = "active" | "banned";

function describe(user: User, status: Status = "active"): string {
  return user.name + " (" + status + ")";
}

class Repo<T extends { id: number }> {
  private items: T[] = [];
  add(item: T): this { this.items.push(item); return this; }
  find(id: number): T | undefined { return this.items.find(x => x.id === id); }
}

const repo = new Repo<User>().add({ id: 1, name: "Ada" }).add({ id: 2, name: "Bob" });
const bob = repo.find(2)!;          // "!" = "I know it is not undefined"
console.log(describe(bob, "banned"));
console.log((repo.find(3) as User | undefined)?.name ?? "not found");`,
  },
  {
    id: 'streams', emoji: '🌊', title: 'Node.js Streams', concept: 'Readable → Transform → Writable', stars: 3,
    goal: 'Process data piece by piece instead of loading everything into memory.',
    code: `// @env node
// @file log.txt
GET /home
POST /login
GET /about
// @file main.js
const fs = require("fs");
const { Transform, Writable, pipeline } = require("stream");

// a Transform changes each chunk as it flows through
const shout = new Transform({
  transform(chunk, enc, done) { done(null, chunk.toUpperCase()); },
});

const received = [];
const collect = new Writable({
  write(chunk, enc, done) { received.push(chunk); done(); },
});

pipeline(
  fs.createReadStream("log.txt", { encoding: "utf8", highWaterMark: 12 }),
  shout,
  collect,
  () => console.log(received.length, "chunks:", received.join("").trim().split("\\n").join(" | "))
);
console.log("pipeline started: chunks arrive later");`,
  },
  {
    id: 'sandbox', emoji: '🧪', title: 'Sandbox', concept: 'Your own code', stars: 0,
    goal: 'Write anything you like and press Run.',
    code: `// Write your own JavaScript here, then press 🚀 Run
function greet(name) {
  return "Hello, " + name + "!";
}

const names = ["Ana", "Ben"];
for (const n of names) {
  console.log(greet(n));
}`,
  },
];
