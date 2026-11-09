/*
 * JS Engine Lab — common JavaScript interview questions.
 * Each one loads into the visualizer so you can predict the answer, then watch it run.
 * The expected output is not stored here: the app shows what the engine prints.
 */
window.JS_INTERVIEW = [
  // ------------------------------------------------------------ scope & hoisting
  {
    id: 'hoisting', cat: 'Scope & hoisting', title: 'Hoisting: var, functions, let', level: 'Easy', ask: 'What does this print?',
    why: '<code>var x</code> is hoisted and set to <code>undefined</code>. Function <b>declarations</b> are hoisted with their body, so <code>hello()</code> works early. <code>var greet = function…</code> only hoists the variable, so calling it early is a <b>TypeError</b> ("not a function"). <code>let</code> is hoisted too but stays in the <b>Temporal Dead Zone</b>, so reading it early is a <b>ReferenceError</b>.',
    code: `console.log(x);
var x = 5;

console.log(hello());
function hello() { return "hoisted!"; }

try { greet(); } catch (e) { console.log(e.name); }
var greet = function () { return "hi"; };

try { console.log(y); } catch (e) { console.log(e.name); }
let y = 1;`,
  },
  {
    id: 'shadowing', cat: 'Scope & hoisting', title: 'Shadowing + hoisting trap', level: 'Medium', ask: 'Why is the first log undefined, not "global"?',
    why: 'Inside <code>show</code>, <code>var name</code> is hoisted to the top of the <b>function</b>. The local <code>name</code> exists (as <code>undefined</code>) from the first line and <b>shadows</b> the global one, so the engine never looks outside.',
    code: `var name = "global";

function show() {
  console.log(name);
  var name = "local";
  console.log(name);
}

show();`,
  },
  {
    id: 'blockscope', cat: 'Scope & hoisting', title: 'Block scope: var vs let vs const', level: 'Easy', ask: 'Which variables exist outside the block?',
    why: '<code>var</code> is <b>function-scoped</b>, so it leaks out of the <code>if</code> block. <code>let</code> and <code>const</code> are <b>block-scoped</b> and disappear when the block ends. <code>const</code> stops <b>reassignment</b>, not mutation: you can still push into a const array.',
    code: `if (true) {
  var v = "var leaks";
  let l = "let stays";
  const c = "const stays";
}
console.log(v, typeof l, typeof c);

const arr = [1];
arr.push(2);
try { arr = []; } catch (e) { console.log(e.name); }
console.log(arr.join());`,
  },
  {
    id: 'tdz', cat: 'Scope & hoisting', title: 'Temporal Dead Zone', level: 'Medium', ask: 'Does the inner console.log print 1?',
    why: 'No. The inner <code>let x</code> is hoisted to the top of its block, so inside the block <code>x</code> means the <b>inner</b> one, which is still in the TDZ. The outer <code>x = 1</code> is shadowed, so you get a <b>ReferenceError</b>.',
    code: `let x = 1;
{
  try {
    console.log(x);
  } catch (e) {
    console.log(e.name);
  }
  let x = 2;
  console.log(x);
}
console.log(x);`,
  },
  {
    id: 'implicitglobal', cat: 'Scope & hoisting', title: 'var a = b = 5', level: 'Medium', ask: 'What are typeof a and typeof b outside the function?',
    why: 'It reads as <code>var a = (b = 5)</code>. <code>a</code> is a local <code>var</code>, but <code>b</code> was never declared, so in sloppy mode assigning it creates an <b>accidental global</b>. In strict mode it would throw a ReferenceError.',
    code: `(function () {
  var a = b = 5;
})();

console.log(typeof a, typeof b, b);`,
  },

  // ------------------------------------------------------------ closures
  {
    id: 'loopclosure', cat: 'Closures', title: 'setTimeout in a loop (var vs let)', level: 'Easy', ask: 'What does each loop print?',
    why: 'With <code>var</code> there is <b>one</b> <code>i</code> for the whole loop. The callbacks run later, after the loop has finished, so all of them see <code>3</code>. <code>let</code> creates a <b>new binding every round</b>, so each closure keeps its own value. The IIFE fix passes the current value into a new function scope.',
    code: `for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 0);
}

for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 0);
}

for (var k = 0; k < 3; k++) {
  ((k) => setTimeout(() => console.log("IIFE:", k), 0))(k);
}`,
  },
  {
    id: 'counter', cat: 'Closures', title: 'Counter with private state', level: 'Easy', ask: 'Do c1 and c2 share the count?',
    why: 'Every call to <code>makeCounter</code> creates a <b>new scope</b> with its own <code>count</code>. The returned functions keep it alive through a <b>closure</b>. Nothing outside can reach <code>count</code> directly; that is how closures make private state.',
    code: `function makeCounter() {
  let count = 0;
  return {
    inc: () => ++count,
    dec: () => --count,
    get: () => count,
  };
}

const c1 = makeCounter();
const c2 = makeCounter();
c1.inc();
c1.inc();
c2.inc();
console.log(c1.get(), c2.get());
console.log(typeof count);`,
  },
  {
    id: 'modulepattern', cat: 'Closures', title: 'Module pattern (IIFE)', level: 'Easy', ask: 'Can code outside change balance?',
    why: 'The IIFE runs once and returns an object whose methods close over <code>balance</code>. The variable is private: only <code>deposit</code> and the getter can touch it. Before ES modules, this was the standard way to hide data.',
    code: `const bank = (function () {
  let balance = 100;
  return {
    deposit(n) { balance += n; return balance; },
    get balance() { return balance; },
  };
})();

bank.deposit(50);
bank.balance = 0;          // ignored: there is only a getter
console.log(bank.balance, typeof balance);`,
  },
  {
    id: 'once', cat: 'Closures', title: 'Implement once()', level: 'Medium', ask: 'Implement once(fn): fn may run only the first time.',
    why: 'The returned function closes over <code>done</code> and <code>result</code>. The first call runs <code>fn</code> and caches the result; later calls just return the cache. <code>fn.apply(this, args)</code> keeps <code>this</code> and the arguments.',
    code: `function once(fn) {
  let done = false, result;
  return function (...args) {
    if (!done) {
      done = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const init = once(() => {
  console.log("initialising...");
  return 42;
});
console.log(init(), init(), init());`,
  },
  {
    id: 'memoize', cat: 'Closures', title: 'Implement memoize()', level: 'Medium', ask: 'How many times does slowSquare really run?',
    why: 'The cache (a <code>Map</code>) lives in the closure. A repeated argument is answered from the cache, so <code>slowSquare</code> only runs for <b>new</b> inputs: 2 times here, not 3.',
    code: `function memoize(fn) {
  const cache = new Map();
  return n => {
    if (cache.has(n)) return cache.get(n);
    const result = fn(n);
    cache.set(n, result);
    return result;
  };
}

let calls = 0;
const slowSquare = n => { calls++; return n * n; };
const fastSquare = memoize(slowSquare);

console.log(fastSquare(4), fastSquare(4), fastSquare(5));
console.log("real calls:", calls);`,
  },

  // ------------------------------------------------------------ this & functions
  {
    id: 'thisrules', cat: 'this & functions', title: 'this: method, detached, arrow', level: 'Medium', ask: 'What is this in each call?',
    why: '<code>this</code> depends on <b>how</b> a function is called, not where it is written. <code>user.regular()</code> has <code>user</code> before the dot. A detached call has nothing before the dot, so in strict mode <code>this</code> is <code>undefined</code> and reading <code>.name</code> throws. An <b>arrow</b> function has no own <code>this</code>; it borrows it from <code>later()</code>, which was called on <code>user</code>.',
    code: `"use strict";
const user = {
  name: "Ada",
  regular() { return this.name; },
  later() {
    setTimeout(() => console.log("arrow inside method:", this.name), 0);
  },
};

console.log(user.regular());
const detached = user.regular;
try { detached(); } catch (e) { console.log("detached:", e.name); }
user.later();`,
  },
  {
    id: 'callapplybind', cat: 'this & functions', title: 'call, apply and bind', level: 'Easy', ask: 'What is the difference between call, apply and bind?',
    why: '<code>call</code> runs the function now with a chosen <code>this</code> and arguments listed one by one. <code>apply</code> is the same, but takes the arguments as an <b>array</b>. <code>bind</code> does <b>not</b> run the function; it returns a new one with <code>this</code> (and maybe some arguments) fixed for good, so even <code>.call(bob)</code> can\'t change it.',
    code: `function intro(greeting, punct) {
  return greeting + ", I am " + this.name + punct;
}
const ada = { name: "Ada" };
const bob = { name: "Bob" };

console.log(intro.call(ada, "Hi", "!"));
console.log(intro.apply(bob, ["Hello", "."]));

const adaIntro = intro.bind(ada, "Hey");
console.log(adaIntro("?"));
console.log(adaIntro.call(bob, "!"));`,
  },
  {
    id: 'bindpolyfill', cat: 'this & functions', title: 'Polyfill: Function.prototype.bind', level: 'Hard', ask: 'Implement your own bind.',
    why: 'Inside the method, <code>this</code> is the function being bound. The polyfill returns a new function that calls it with <code>apply</code>, using the saved context and the preset arguments followed by the new ones.',
    code: `Function.prototype.myBind = function (ctx, ...preset) {
  const fn = this;
  return function (...args) {
    return fn.apply(ctx, [...preset, ...args]);
  };
};

function volume(l, w, h) { return this.unit + ": " + l * w * h; }
const inCm = volume.myBind({ unit: "cm3" }, 2);
console.log(inCm(3, 4));
console.log(inCm(1, 1));`,
  },
  {
    id: 'newreturn', cat: 'this & functions', title: 'What does new return?', level: 'Hard', ask: 'What do new A() and new B() give?',
    why: '<code>new</code> creates a fresh object as <code>this</code> and returns it, unless the constructor returns <b>another object</b>. Returning a primitive like <code>5</code> is ignored.',
    code: `function A() { this.x = 1; return { y: 2 }; }
function B() { this.x = 1; return 5; }

console.log(JSON.stringify(new A()));
console.log(JSON.stringify(new B()));`,
  },
  {
    id: 'curry', cat: 'this & functions', title: 'Currying: sum(1)(2)(3)', level: 'Medium', ask: 'Implement curry(fn) and an infinite add(1)(2)(3)().',
    why: '<code>curry</code> collects arguments until it has as many as <code>fn.length</code> (the number of parameters), then calls <code>fn</code>. Each partial call returns a new closure that remembers the arguments so far. The infinite <code>add</code> keeps returning functions until it is called with no argument.',
    code: `const sum = a => b => c => a + b + c;
console.log(sum(1)(2)(3));

function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}
const add3 = curry((a, b, c) => a + b + c);
console.log(add3(1)(2)(3), add3(1, 2)(3), add3(1)(2, 3));

function add(a) {
  return b => (b === undefined ? a : add(a + b));
}
console.log(add(1)(2)(3)());`,
  },
  {
    id: 'compose', cat: 'this & functions', title: 'compose and pipe', level: 'Medium', ask: 'Why do pipe and compose give different results?',
    why: '<code>pipe</code> applies the functions <b>left to right</b> (double, then inc: 5→10→11). <code>compose</code> applies them <b>right to left</b> (inc, then double: 5→6→12). Both are a <code>reduce</code> over the list of functions.',
    code: `const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);
const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);

const double = n => n * 2;
const inc = n => n + 1;

console.log(pipe(double, inc)(5));
console.log(compose(double, inc)(5));`,
  },

  // ------------------------------------------------------------ types & coercion
  {
    id: 'typeof', cat: 'Types & coercion', title: 'typeof quirks', level: 'Easy', ask: 'What does typeof return for each value?',
    why: '<code>typeof null</code> is <code>"object"</code>, a bug from the first version of JavaScript that can never be fixed. Arrays are objects too, so use <code>Array.isArray</code>. <code>NaN</code> is a <code>"number"</code>. Functions are the only objects with their own typeof result.',
    code: `console.log(typeof null, typeof undefined);
console.log(typeof [], typeof {}, typeof function () {});
console.log(typeof NaN, typeof 10n, typeof Symbol("id"));
console.log(Array.isArray([]), null instanceof Object);`,
  },
  {
    id: 'equality', cat: 'Types & coercion', title: '== vs ===', level: 'Easy', ask: 'Which comparisons are true?',
    why: '<code>===</code> never converts types. <code>==</code> converts first: strings and booleans become numbers (<code>""</code> → 0), and objects become primitives (<code>[1]</code> → "1" → 1). <code>null == undefined</code> is a special rule. <code>NaN</code> is not equal to anything, not even itself; use <code>Number.isNaN</code> or <code>Object.is</code>.',
    code: `console.log(0 == "0", 0 == "", "" == "0");
console.log(null == undefined, null === undefined, null == 0);
console.log(NaN == NaN, Number.isNaN(NaN), Object.is(NaN, NaN));
console.log([1] == 1, [] == false, !![]);`,
  },
  {
    id: 'coercion', cat: 'Types & coercion', title: 'Type coercion puzzles', level: 'Medium', ask: 'Predict every value.',
    why: '<code>+</code> with a string <b>joins</b>; the other math operators convert to <b>numbers</b>. <code>[] + []</code> turns both arrays into <code>""</code>. <code>[] + {}</code> gives <code>"[object Object]"</code>. Unary <code>+</code> converts strictly (<code>"42px"</code> → NaN), while <code>parseInt</code> reads digits until it can\'t.',
    code: `console.log(1 + "2", "5" - 2, "3" * "4", true + 1, null + 1, undefined + 1);
console.log(JSON.stringify([] + []), [] + {}, [1, 2] + [3]);
console.log(+"", +"42px", parseInt("42px"), Number(" 7 "));`,
  },
  {
    id: 'float', cat: 'Types & coercion', title: '0.1 + 0.2 !== 0.3', level: 'Easy', ask: 'Why is 0.1 + 0.2 not 0.3?',
    why: 'Numbers are 64-bit binary floating point (IEEE 754). <code>0.1</code> and <code>0.2</code> can\'t be stored exactly in binary, so their sum is a tiny bit off. Compare with a tolerance (<code>Number.EPSILON</code>) or round for display. Above 2<sup>53</sup>, integers lose precision too; use <code>BigInt</code>.',
    code: `console.log(0.1 + 0.2, 0.1 + 0.2 === 0.3);
console.log((0.1 + 0.2).toFixed(2), Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
console.log(Number.MAX_SAFE_INTEGER, 2 ** 53 + 1 === 2 ** 53);`,
  },
  {
    id: 'sort', cat: 'Types & coercion', title: '[10, 1, 5].sort()', level: 'Easy', ask: 'Why does sort() put 100 before 25?',
    why: 'Without a compare function, <code>sort</code> converts the items to <b>strings</b> and sorts them alphabetically, so <code>"100"</code> comes before <code>"25"</code>. Pass <code>(a, b) => a - b</code> to sort numbers. <code>sort</code> also changes the array <b>in place</b>.',
    code: `const nums = [10, 1, 5, 100, 25];
console.log(nums.sort().join());
console.log(nums.sort((a, b) => a - b).join());
console.log(["b", "a", "C"].sort().join());`,
  },
  {
    id: 'references', cat: 'Types & coercion', title: 'Objects are passed by reference', level: 'Easy', ask: 'What is a.n at each point?',
    why: '<code>b = a</code> copies the <b>reference</b>, not the object, so both names point to the same object in the heap. Inside <code>change</code>, mutating <code>obj.n</code> changes that shared object, but <b>reassigning</b> <code>obj</code> only changes the local variable. Two separate object literals are never <code>===</code>.',
    code: `const a = { n: 1 };
const b = a;
b.n = 2;
console.log(a.n);

function change(obj) {
  obj.n = 3;
  obj = { n: 99 };
}
change(a);
console.log(a.n);
console.log({ x: 1 } === { x: 1 }, a === b);`,
  },
  {
    id: 'copy', cat: 'Types & coercion', title: 'Shallow vs deep copy', level: 'Medium', ask: 'Which copies share the skills array?',
    why: 'Spread (<code>{...obj}</code>) makes a <b>shallow</b> copy: top-level values are copied, but nested objects are still shared. <code>structuredClone</code> (or a JSON round-trip, which loses functions and Dates) makes a <b>deep</b> copy.',
    code: `const original = { name: "Ada", skills: ["js"] };
const shallow = { ...original };
const deep = structuredClone(original);

shallow.name = "Bob";
shallow.skills.push("css");

console.log(original.name, original.skills.join());
console.log(deep.skills.join());
console.log(JSON.parse(JSON.stringify(original)).skills.length);`,
  },
  {
    id: 'objectkeys', cat: 'Types & coercion', title: 'Object keys: order and objects as keys', level: 'Hard', ask: 'What does store[key1] print?',
    why: 'Integer-like keys come first in ascending order, then string keys in insertion order. Object keys are always <b>strings</b>: both objects become <code>"[object Object]"</code>, so the second write overwrites the first. A <code>Map</code> keeps real object keys.',
    code: `const o = { b: 1, 2: "two", a: 2, 1: "one" };
console.log(Object.keys(o).join());

const key1 = {}, key2 = { id: 2 };
const store = {};
store[key1] = "first";
store[key2] = "second";
console.log(store[key1], Object.keys(store).join());

const m = new Map([[key1, "first"], [key2, "second"]]);
console.log(m.get(key1), m.size);`,
  },

  // ------------------------------------------------------------ event loop & promises
  {
    id: 'microvsmacro', cat: 'Event loop & promises', title: 'Microtasks vs timers', level: 'Easy', ask: 'In what order do the numbers print?',
    why: 'Synchronous code runs first (1, 5). When the stack is empty, the event loop empties the <b>microtask queue</b> (promise callbacks and <code>queueMicrotask</code>: 3, 4) <b>before</b> it takes the next task from the callback queue (the timer: 2), even a 0ms one.',
    code: `console.log("1: sync");
setTimeout(() => console.log("2: timeout"), 0);
Promise.resolve().then(() => console.log("3: promise"));
queueMicrotask(() => console.log("4: microtask"));
console.log("5: sync");`,
  },
  {
    id: 'async1', cat: 'Event loop & promises', title: 'The classic async/await puzzle', level: 'Hard', ask: 'Write down the full output order.',
    why: 'An async function runs <b>synchronously</b> until its first <code>await</code>, so "async1 start" and "async2" print right away. The Promise executor is synchronous too ("promise1"). After "script end", the microtasks run: the rest of async1 ("async1 end"), then "promise2". The timer is a task, so it comes last.',
    code: `async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end");
}
async function async2() {
  console.log("async2");
}

console.log("script start");
setTimeout(() => console.log("setTimeout"), 0);
async1();
new Promise(resolve => {
  console.log("promise1");
  resolve();
}).then(() => console.log("promise2"));
console.log("script end");`,
  },
  {
    id: 'executor', cat: 'Event loop & promises', title: 'Is the Promise executor async?', level: 'Easy', ask: 'Does "B" print before "E"?',
    why: 'Yes. The function passed to <code>new Promise</code> runs <b>immediately and synchronously</b>. Only the <code>.then</code> callbacks are asynchronous (microtasks), so "D" prints last.',
    code: `console.log("A");
const p = new Promise(resolve => {
  console.log("B: executor runs immediately");
  resolve("D");
  console.log("C: still sync");
});
p.then(v => console.log(v));
console.log("E");`,
  },
  {
    id: 'nested', cat: 'Event loop & promises', title: 'Timers and promises inside each other', level: 'Hard', ask: 'Predict the order of all five lines.',
    why: 'Microtasks first: "promise 1", which adds a <b>third</b> timer at the back of the queue. Then the first timer runs, and its promise callback runs <b>right after it</b>, before the next timer. The microtask queue is emptied after <b>every</b> task.',
    code: `setTimeout(() => {
  console.log("timeout 1");
  Promise.resolve().then(() => console.log("promise inside timeout"));
}, 0);

setTimeout(() => console.log("timeout 2"), 0);

Promise.resolve().then(() => {
  console.log("promise 1");
  setTimeout(() => console.log("timeout from promise"), 0);
});`,
  },
  {
    id: 'chain', cat: 'Event loop & promises', title: 'Promise chain with errors', level: 'Medium', ask: 'Which callbacks run, and with what value?',
    why: 'Each <code>.then</code> receives what the previous one <b>returned</b>. A thrown error skips the following <code>.then</code> callbacks until a <code>.catch</code>. Whatever <code>catch</code> returns <b>continues the chain</b> as a normal value. <code>finally</code> always runs and passes the value through.',
    code: `Promise.resolve(1)
  .then(x => { console.log("a", x); return x + 1; })
  .then(x => { console.log("b", x); throw new Error("oops"); })
  .then(() => console.log("c (skipped)"))
  .catch(e => { console.log("caught", e.message); return 10; })
  .then(x => console.log("d", x))
  .finally(() => console.log("finally"));`,
  },
  {
    id: 'interleave', cat: 'Event loop & promises', title: 'Two promise chains interleave', level: 'Medium', ask: 'Is it 1 2 3 4 or 1 3 2 4?',
    why: 'Each <code>.then</code> is scheduled only when the previous step <b>finishes</b>. Round one queues the callbacks for 1 and 3. Running 1 queues 2, and running 3 queues 4. The microtask queue is first in, first out: 1, 3, 2, 4.',
    code: `Promise.resolve()
  .then(() => console.log(1))
  .then(() => console.log(2));

Promise.resolve()
  .then(() => console.log(3))
  .then(() => console.log(4));`,
  },
  {
    id: 'timerorder', cat: 'Event loop & promises', title: 'Timers with different delays', level: 'Easy', ask: 'Does the order of setTimeout calls matter?',
    why: 'Timers fire by their <b>due time</b>, not by the order they were created. A delay is a <b>minimum</b> wait: the callback runs once the time has passed <b>and</b> the call stack is empty.',
    code: `setTimeout(() => console.log("200ms"), 200);
setTimeout(() => console.log("0ms"), 0);
setTimeout(() => console.log("100ms"), 100);
console.log("sync");`,
  },
  {
    id: 'asyncerrors', cat: 'Event loop & promises', title: 'Error handling in async code', level: 'Medium', ask: 'Which lines print, and in what order?',
    why: 'An error thrown in an async function <b>rejects</b> its promise. You catch it with <code>try/catch</code> around <code>await</code>, or with <code>.catch</code> on the promise. "sync end" prints first because everything else is a microtask.',
    code: `async function fails() {
  throw new Error("nope");
}

async function main() {
  try {
    await fails();
  } catch (e) {
    console.log("caught:", e.message);
  }
  const r = await fails().catch(e => "recovered from " + e.message);
  console.log(r);
}

main();
fails().then(() => console.log("never")).catch(e => console.log("chain catch:", e.message));
console.log("sync end");`,
  },
  {
    id: 'foreachasync', cat: 'Event loop & promises', title: 'async inside forEach (pitfall)', level: 'Hard', ask: 'Why does "forEach done" print first?',
    why: '<code>forEach</code> ignores the promises its callback returns, so it can\'t wait for them; the loop finishes immediately. Use <code>for...of</code> with <code>await</code> to go one at a time, or <code>Promise.all(arr.map(...))</code> to run them in parallel and wait for all.',
    code: `const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withForEach() {
  [1, 2].forEach(async n => {
    await sleep(10);
    console.log("forEach item", n);
  });
  console.log("forEach done (too early!)");
}

async function withForOf() {
  for (const n of [1, 2]) {
    await sleep(10);
    console.log("for...of item", n);
  }
  console.log("for...of done");
}

withForEach().then(withForOf);`,
  },
  {
    id: 'combinators', cat: 'Event loop & promises', title: 'Promise.all, race, allSettled, any', level: 'Medium', ask: 'When does each one settle?',
    why: '<code>all</code> waits for <b>every</b> promise (and rejects on the first failure). <code>race</code> settles with the <b>first</b> to settle. <code>allSettled</code> waits for all and never rejects. <code>any</code> fulfills with the first <b>success</b> and ignores failures.',
    code: `const wait = (ms, v, fail) =>
  new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));

Promise.all([wait(20, "a"), wait(10, "b")])
  .then(r => console.log("all:", r.join()));
Promise.race([wait(20, "slow"), wait(10, "fast")])
  .then(v => console.log("race:", v));
Promise.allSettled([wait(5, "ok"), wait(15, "bad", true)])
  .then(r => console.log("allSettled:", r.map(x => x.status).join()));
Promise.any([wait(5, "x", true), wait(25, "y")])
  .then(v => console.log("any:", v));`,
  },

  // ------------------------------------------------------------ async patterns
  {
    id: 'debounce', cat: 'Async patterns', title: 'Implement debounce', level: 'Medium', ask: 'Implement debounce(fn, ms). How many saves happen?',
    why: 'Each call <b>cancels</b> the pending timer and starts a new one, so <code>fn</code> only runs after the calls stop for <code>ms</code>. The quick calls collapse into one save ("Hello"), and the later call makes a second one. It\'s used for search boxes and autosave.',
    code: `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const save = debounce(text => console.log("saved:", text), 100);
save("H");
save("He");
setTimeout(() => save("Hello"), 50);
setTimeout(() => save("Hello!"), 300);`,
  },
  {
    id: 'throttle', cat: 'Async patterns', title: 'Implement throttle', level: 'Medium', ask: 'Implement throttle(fn, ms). Which calls get through?',
    why: 'Throttle runs <code>fn</code> at most <b>once per</b> <code>ms</code>: the first call runs, then calls are ignored until the timer reopens the gate. Debounce waits for quiet; throttle keeps a steady rate (scroll and resize handlers).',
    code: `function throttle(fn, ms) {
  let waiting = false;
  return (...args) => {
    if (waiting) return;
    fn(...args);
    waiting = true;
    setTimeout(() => { waiting = false; }, ms);
  };
}

const onScroll = throttle(n => console.log("scroll", n), 100);
for (let i = 1; i <= 3; i++) onScroll(i);
setTimeout(() => onScroll(4), 50);
setTimeout(() => onScroll(5), 150);`,
  },
  {
    id: 'sequential', cat: 'Async patterns', title: 'Sequential vs parallel await', level: 'Medium', ask: 'Which version finishes first, and why?',
    why: 'Awaiting one call before starting the next is <b>sequential</b>: about 100 + 100ms. Starting both first and awaiting <code>Promise.all</code> runs them in <b>parallel</b>: about 100ms. Watch the clock in the top bar.',
    code: `const sleep = (ms, label) =>
  new Promise(r => setTimeout(() => { console.log("done", label); r(label); }, ms));

async function sequential() {
  await sleep(100, "A1");
  await sleep(100, "A2");
  console.log("sequential finished");
}

async function parallel() {
  await Promise.all([sleep(100, "B1"), sleep(100, "B2")]);
  console.log("parallel finished");
}

sequential();
parallel();`,
  },
  {
    id: 'retry', cat: 'Async patterns', title: 'Retry a failing request', level: 'Medium', ask: 'Implement retry(fn, times).',
    why: 'A loop with <code>try { return await fn() }</code>: a success returns straight away, and a failure is caught and the loop tries again. Real code usually waits longer between tries (exponential backoff).',
    code: `let attempts = 0;
function flaky() {
  attempts++;
  return attempts < 3
    ? Promise.reject(new Error("fail " + attempts))
    : Promise.resolve("ok on try " + attempts);
}

async function retry(fn, times) {
  for (let i = 1; i <= times; i++) {
    try {
      return await fn();
    } catch (e) {
      console.log("retrying after", e.message);
    }
  }
  throw new Error("gave up");
}

retry(flaky, 5).then(v => console.log(v));`,
  },
  {
    id: 'timeout', cat: 'Async patterns', title: 'Promise with a timeout', level: 'Medium', ask: 'Implement withTimeout(promise, ms).',
    why: '<code>Promise.race</code> between the real promise and a timer that <b>rejects</b>. Whichever settles first wins. The losing promise keeps running in the background; with <code>fetch</code>, use an <code>AbortController</code> to really cancel it.',
    code: `function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms));
  return Promise.race([promise, timeout]);
}

const fast = new Promise(r => setTimeout(() => r("fast data"), 50));
const slow = new Promise(r => setTimeout(() => r("slow data"), 200));

withTimeout(fast, 100).then(v => console.log("got", v));
withTimeout(slow, 100).catch(e => console.log("error:", e.message));`,
  },
  {
    id: 'promiseall', cat: 'Async patterns', title: 'Polyfill: Promise.all', level: 'Hard', ask: 'Implement Promise.all yourself.',
    why: 'Keep the results <b>by index</b> (not in finishing order) and count how many are done. Resolve when the count reaches the length, and reject on the first failure. <code>Promise.resolve(p)</code> also accepts plain values like <code>2</code>.',
    code: `function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let done = 0;
    if (promises.length === 0) resolve(results);
    promises.forEach((p, i) => {
      Promise.resolve(p).then(value => {
        results[i] = value;
        done++;
        if (done === promises.length) resolve(results);
      }, reject);
    });
  });
}

const wait = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
promiseAll([wait(30, "a"), 2, wait(10, "c")]).then(r => console.log(r.join()));
promiseAll([wait(10, 1), Promise.reject(new Error("boom"))])
  .catch(e => console.log("failed:", e.message));`,
  },

  // ------------------------------------------------------------ implement it
  {
    id: 'flatten', cat: 'Implement it', title: 'Flatten a nested array', level: 'Medium', ask: 'Flatten [1, [2, [3, [4]], 5]] without .flat().',
    why: 'Recursion: for each item, if it is an array, flatten it and add its items, otherwise add the item itself. The built-in <code>.flat(depth)</code> only goes one level deep by default; <code>.flat(Infinity)</code> goes all the way.',
    code: `function flatten(arr) {
  return arr.reduce(
    (out, x) => (Array.isArray(x) ? out.concat(flatten(x)) : out.concat(x)),
    []
  );
}

const nested = [1, [2, [3, [4]], 5]];
console.log(flatten(nested).join());
console.log(nested.flat().length, nested.flat(Infinity).join());`,
  },
  {
    id: 'deepclone', cat: 'Implement it', title: 'Deep clone', level: 'Medium', ask: 'Write deepClone without structuredClone.',
    why: 'Primitives are returned as they are. Arrays and objects are rebuilt, and every value is cloned <b>recursively</b>, so no nested object is shared. A full version also handles Dates, Maps and circular references (with a <code>WeakMap</code> of objects already seen).',
    code: `function deepClone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = deepClone(value[key]);
  return copy;
}

const a = { n: 1, list: [1, { x: 2 }] };
const b = deepClone(a);
b.list[1].x = 99;
console.log(a.list[1].x, b.list[1].x, a.list !== b.list);`,
  },
  {
    id: 'deepequal', cat: 'Implement it', title: 'Deep equality', level: 'Medium', ask: 'Write deepEqual(a, b).',
    why: 'If <code>===</code> already says yes, you are done. Otherwise both must be non-null objects with the same number of keys, and every key must be deep-equal, which is checked recursively.',
    code: `function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
}

console.log(deepEqual({ x: [1, 2], y: { z: 3 } }, { x: [1, 2], y: { z: 3 } }));
console.log(deepEqual({ x: 1 }, { x: "1" }), deepEqual([1, 2], [1, 2, 3]));`,
  },
  {
    id: 'emitter', cat: 'Implement it', title: 'Event emitter (pub/sub)', level: 'Medium', ask: 'Implement on, off and emit.',
    why: 'Store a list of listener functions per event name. <code>emit</code> calls each one with the arguments, <b>synchronously</b> and in order. Returning an "unsubscribe" function from <code>on</code> is a handy pattern.',
    code: `class Emitter {
  constructor() { this.events = {}; }
  on(name, fn) {
    if (!this.events[name]) this.events[name] = [];
    this.events[name].push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    this.events[name] = (this.events[name] || []).filter(f => f !== fn);
  }
  emit(name, ...args) {
    (this.events[name] || []).forEach(fn => fn(...args));
  }
}

const chat = new Emitter();
const stop = chat.on("msg", (who, text) => console.log(who + ": " + text));
chat.on("msg", () => console.log("(ding)"));
chat.emit("msg", "Ada", "hi");
stop();
chat.emit("msg", "Bob", "anyone?");`,
  },
  {
    id: 'lru', cat: 'Implement it', title: 'LRU cache', level: 'Hard', ask: 'Build a cache that drops the least recently used item.',
    why: 'A <code>Map</code> remembers insertion order. On <code>get</code>, delete and re-insert the key to mark it as most recent. On <code>put</code>, if the cache is too big, delete the <b>first</b> key (<code>map.keys().next().value</code>), which is the oldest.',
    code: `class LRUCache {
  constructor(limit) {
    this.limit = limit;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  put(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
  }
}

const cache = new LRUCache(2);
cache.put("a", 1);
cache.put("b", 2);
cache.get("a");
cache.put("c", 3);   // "b" is dropped
console.log(cache.get("b"), cache.get("a"), cache.get("c"), [...cache.map.keys()].join());`,
  },
  {
    id: 'mappolyfill', cat: 'Implement it', title: 'Polyfills: map, filter, reduce', level: 'Medium', ask: 'Implement Array.prototype.map, filter and reduce.',
    why: 'Inside a prototype method, <code>this</code> is the array. Loop over it, call the callback with <code>(item, index, array)</code> and build the result. <code>reduce</code> uses the first item as the start value when none is given.',
    code: `Array.prototype.myMap = function (fn) {
  const out = [];
  for (let i = 0; i < this.length; i++) out.push(fn(this[i], i, this));
  return out;
};
Array.prototype.myFilter = function (fn) {
  const out = [];
  for (let i = 0; i < this.length; i++) if (fn(this[i], i, this)) out.push(this[i]);
  return out;
};
Array.prototype.myReduce = function (fn, init) {
  let acc = init, i = 0;
  if (acc === undefined) { acc = this[0]; i = 1; }
  for (; i < this.length; i++) acc = fn(acc, this[i], i, this);
  return acc;
};

console.log([1, 2, 3].myMap(n => n * 2).join());
console.log([1, 2, 3, 4].myFilter(n => n % 2 === 0).join());
console.log([1, 2, 3].myReduce((a, b) => a + b));`,
  },
  {
    id: 'groupby', cat: 'Implement it', title: 'Group by and count', level: 'Easy', ask: 'Group words by first letter, and count letters.',
    why: '<code>reduce</code> (or a loop) builds an object: create the bucket the first time a key is seen, then add to it. The <code>(freq[ch] || 0) + 1</code> pattern counts occurrences.',
    code: `const words = ["apple", "banana", "avocado", "cherry", "blueberry"];
const byLetter = words.reduce((acc, w) => {
  const k = w[0];
  acc[k] = acc[k] || [];
  acc[k].push(w);
  return acc;
}, {});
console.log(JSON.stringify(byLetter));

const freq = {};
for (const ch of "mississippi") freq[ch] = (freq[ch] || 0) + 1;
console.log(JSON.stringify(freq));`,
  },

  // ------------------------------------------------------------ OOP
  {
    id: 'prototype', cat: 'Objects & classes', title: 'Prototype inheritance', level: 'Hard', ask: 'How does Dog inherit from Animal without class?',
    why: '<code>Animal.call(this, name)</code> runs the parent constructor on the new object. <code>Object.create(Animal.prototype)</code> links <code>Dog.prototype</code> to <code>Animal.prototype</code>, so method lookups climb the <b>prototype chain</b>. Own properties live on the object; shared methods live on the prototype.',
    code: `function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return this.name + " makes a sound"; };

function Dog(name) { Animal.call(this, name); }
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
Dog.prototype.speak = function () { return this.name + " barks"; };

const d = new Dog("Rex");
console.log(d.speak());
console.log(Animal.prototype.speak.call(d));
console.log(d instanceof Dog, d instanceof Animal);
console.log(Object.getPrototypeOf(d) === Dog.prototype);
console.log(d.hasOwnProperty("name"), d.hasOwnProperty("speak"));`,
  },
  {
    id: 'classes', cat: 'Objects & classes', title: 'Classes: private, static, extends', level: 'Medium', ask: 'What is the balance, and what does the error say?',
    why: '<code>#balance</code> is truly private: only code inside the class can read it. <code>static count</code> belongs to the class, not to instances. <code>super(owner)</code> must run before using <code>this</code> in a subclass. Returning <code>this</code> lets you chain calls. Classes are just functions underneath.',
    code: `class Account {
  #balance = 0;
  static count = 0;
  constructor(owner) {
    this.owner = owner;
    Account.count++;
  }
  deposit(n) {
    if (n <= 0) throw new RangeError("amount must be positive");
    this.#balance += n;
    return this;
  }
  get balance() { return this.#balance; }
}

class Savings extends Account {
  constructor(owner, rate) {
    super(owner);
    this.rate = rate;
  }
  addInterest() { return this.deposit(this.balance * this.rate); }
}

const s = new Savings("Ada", 0.1);
s.deposit(100).addInterest();
console.log(s.owner, s.balance, Account.count);
try { s.deposit(-5); } catch (e) { console.log(e.name, e.message); }
console.log(s instanceof Account, typeof Account);`,
  },
  {
    id: 'freeze', cat: 'Objects & classes', title: 'Object.freeze is shallow', level: 'Medium', ask: 'Can you change config.nested.size?',
    why: '<code>Object.freeze</code> stops changes to the object\'s <b>own</b> properties; in strict mode a write throws a TypeError. Nested objects are <b>not</b> frozen, so <code>config.nested.size</code> can still change. A "deep freeze" freezes every level recursively.',
    code: `"use strict";
const config = Object.freeze({ mode: "dark", nested: { size: 1 } });

try { config.mode = "light"; } catch (e) { console.log(e.name); }
config.nested.size = 2;
console.log(config.mode, config.nested.size, Object.isFrozen(config));`,
  },
  {
    id: 'generators', cat: 'Objects & classes', title: 'Generators: infinite id maker', level: 'Medium', ask: 'How can an infinite loop not freeze the page?',
    why: 'A generator <b>pauses</b> at every <code>yield</code> and only continues when someone calls <code>.next()</code>. The <code>while (true)</code> loop runs one step at a time, on demand. <code>take</code> stops after <code>n</code> values.',
    code: `function* idMaker() {
  let id = 1;
  while (true) yield id++;
}

const ids = idMaker();
console.log(ids.next().value, ids.next().value, ids.next().value);

function* take(n, it) {
  for (const x of it) {
    if (n-- <= 0) return;
    yield x;
  }
}
console.log([...take(3, idMaker())].join());`,
  },

  // ------------------------------------------------------------ algorithms
  {
    id: 'fizzbuzz', cat: 'Coding problems', title: 'FizzBuzz', level: 'Easy', ask: 'Print 1–15, with Fizz for multiples of 3, Buzz for 5, FizzBuzz for both.',
    why: 'Check the <b>combined</b> case first (divisible by 15), otherwise "Fizz" would win. <code>%</code> gives the remainder.',
    code: `const out = [];
for (let i = 1; i <= 15; i++) {
  if (i % 15 === 0) out.push("FizzBuzz");
  else if (i % 3 === 0) out.push("Fizz");
  else if (i % 5 === 0) out.push("Buzz");
  else out.push(i);
}
console.log(out.join(" "));`,
  },
  {
    id: 'palindrome', cat: 'Coding problems', title: 'Reverse a string / palindrome', level: 'Easy', ask: 'Reverse a string and check for palindromes.',
    why: 'Strings are immutable, so split into an array, reverse it and join it back. For a palindrome check, first lowercase the text and remove everything that isn\'t a letter or digit.',
    code: `const reverse = s => s.split("").reverse().join("");

const isPalindrome = s => {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean === reverse(clean);
};

console.log(reverse("hello"));
console.log(isPalindrome("A man, a plan, a canal: Panama"), isPalindrome("hello"));`,
  },
  {
    id: 'anagram', cat: 'Coding problems', title: 'Anagram check', level: 'Easy', ask: 'Are two words anagrams?',
    why: 'Two words are anagrams when they have the same letters, so their <b>sorted</b> letters are equal. For long strings, counting letters with an object is faster (O(n) instead of O(n log n)).',
    code: `const sortLetters = s => s.toLowerCase().replace(/\\s/g, "").split("").sort().join("");
const isAnagram = (a, b) => sortLetters(a) === sortLetters(b);

console.log(isAnagram("listen", "silent"));
console.log(isAnagram("Dormitory", "dirty room"));
console.log(isAnagram("abc", "abd"));`,
  },
  {
    id: 'twosum', cat: 'Coding problems', title: 'Two Sum', level: 'Medium', ask: 'Find the indexes of two numbers that add up to target.',
    why: 'A <code>Map</code> remembers every number seen so far and its index. For each number, check whether its "partner" (<code>target - n</code>) is already in the map. That is one pass, O(n), instead of trying every pair (O(n²)).',
    code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

console.log(twoSum([2, 7, 11, 15], 9).join());
console.log(twoSum([3, 2, 4], 6).join());
console.log(twoSum([1, 2], 10));`,
  },
  {
    id: 'fibonacci', cat: 'Coding problems', title: 'Fibonacci: recursive vs loop', level: 'Medium', ask: 'Why is the recursive version so slow?',
    why: 'The recursive version recomputes the same values again and again: it makes about 2<sup>n</sup> calls. Watch the Call Stack grow and shrink. The loop keeps just the last two numbers, which is O(n) time and O(1) memory. Memoizing the recursive version also makes it O(n).',
    code: `function fibSlow(n) {
  return n < 2 ? n : fibSlow(n - 1) + fibSlow(n - 2);
}

function fibFast(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

console.log(fibSlow(6), fibFast(6), fibFast(50));`,
  },
  {
    id: 'factorial', cat: 'Coding problems', title: 'Factorial with recursion', level: 'Easy', ask: 'Write factorial(n) recursively. What happens on the stack?',
    why: 'Each call waits for <code>factorial(n - 1)</code>, so 5 frames pile up on the Call Stack. When the <b>base case</b> (<code>n <= 1</code>) returns, the frames pop one by one, multiplying on the way back. Without a base case you would get "Maximum call stack size exceeded".',
    code: `function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));`,
  },
  {
    id: 'dedupe', cat: 'Coding problems', title: 'Remove duplicates', level: 'Easy', ask: 'Remove duplicates from an array, keeping the order.',
    why: 'A <code>Set</code> only keeps unique values and remembers insertion order, so <code>[...new Set(list)]</code> is the short answer. The <code>filter</code> version keeps an item only where it appears <b>first</b>, but it is O(n²).',
    code: `const list = [3, 1, 3, 2, 1];
console.log([...new Set(list)].join());
console.log(list.filter((x, i) => list.indexOf(x) === i).join());`,
  },
  {
    id: 'secondlargest', cat: 'Coding problems', title: 'Second largest number', level: 'Easy', ask: 'Find the second largest number in one pass.',
    why: 'Keep the two biggest values seen so far. A new maximum pushes the old one down to second place. The <code>n < first</code> check skips duplicates of the maximum. Sorting would also work, but it is O(n log n).',
    code: `function secondLargest(arr) {
  let first = -Infinity, second = -Infinity;
  for (const n of arr) {
    if (n > first) {
      second = first;
      first = n;
    } else if (n > second && n < first) {
      second = n;
    }
  }
  return second;
}

console.log(secondLargest([5, 1, 9, 9, 7]));`,
  },
  {
    id: 'chunk', cat: 'Coding problems', title: 'Chunk an array', level: 'Easy', ask: 'Split an array into groups of size n.',
    why: 'Step through the array <code>size</code> items at a time and <code>slice</code> out each piece. <code>slice</code> never goes past the end, so the last chunk can be shorter.',
    code: `function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

console.log(JSON.stringify(chunk([1, 2, 3, 4, 5], 2)));`,
  },
  {
    id: 'binarysearch', cat: 'Coding problems', title: 'Binary search', level: 'Medium', ask: 'Find a number in a sorted array in O(log n).',
    why: 'Look at the middle item: if it is too small, the answer can only be in the right half, and if it is too big, in the left half. Each round halves the search area, so 1,000,000 items need only about 20 rounds. It only works on <b>sorted</b> data.',
    code: `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

const sorted = [1, 3, 5, 7, 9, 11];
console.log(binarySearch(sorted, 7), binarySearch(sorted, 4));`,
  },
  {
    id: 'brackets', cat: 'Coding problems', title: 'Balanced brackets', level: 'Medium', ask: 'Check that every bracket is closed in the right order.',
    why: 'Use an array as a <b>stack</b>: push opening brackets, and when a closing bracket comes, pop and check that it matches. At the end the stack must be empty. It\'s the same last-in-first-out idea as the Call Stack.',
    code: `function isBalanced(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if ("([{".includes(ch)) stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

console.log(isBalanced("{[()]}"), isBalanced("([)]"), isBalanced("(("));`,
  },
];
