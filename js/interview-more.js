/*
 * JS Engine Lab — more interview questions (every common topic).
 * Questions with `expect` use the browser page, Node.js or modules, so the tests check them
 * against the listed output instead of running them as a plain script.
 */
window.JS_INTERVIEW.push(
  // ------------------------------------------------------------ tricky output
  {
    id: 'parseintmap', cat: 'Tricky output', title: '["1","2","3"].map(parseInt)', level: 'Hard', ask: 'Why is the answer 1, NaN, NaN?',
    why: '<code>map</code> calls its callback with <b>(item, index, array)</b>. So it runs <code>parseInt("1", 0)</code> (radix 0 means "guess", giving 1), <code>parseInt("2", 1)</code> (radix 1 is invalid, so NaN) and <code>parseInt("3", 2)</code> (3 is not a binary digit, so NaN). Wrap it: <code>s => parseInt(s, 10)</code>, or use <code>Number</code>.',
    code: `console.log(["1", "2", "3"].map(parseInt).join());
console.log(["1", "2", "3"].map(Number).join());
console.log(["1", "2", "3"].map(s => parseInt(s, 10)).join());`,
  },
  {
    id: 'banana', cat: 'Tricky output', title: '"b" + "a" + +"a" + "a"', level: 'Medium', ask: 'Predict each line.',
    why: '<code>+"a"</code> is the <b>unary plus</b>: it converts "a" to a number, which is <code>NaN</code>, and joining gives "baNaNa". <code>typeof</code> always returns a string, so <code>typeof typeof 1</code> is "string". <code>"10" + 1</code> joins to "101", then <code>- 1</code> converts back to a number. <code>3 > 2 > 1</code> becomes <code>true > 1</code>, which is <code>1 > 1</code>.',
    code: `console.log("b" + "a" + +"a" + "a");
console.log(typeof typeof 1);
console.log("10" + 1 - 1, "10" - 1 + 1);
console.log(1 < 2 < 3, 3 > 2 > 1);`,
  },
  {
    id: 'weirdcompare', cat: 'Tricky output', title: '[] == ![] and Math.max()', level: 'Hard', ask: 'How can [] == ![] be true?',
    why: '<code>![]</code> is <code>false</code> (every object is truthy). Then <code>[] == false</code> converts both to numbers: <code>[]</code> becomes "" and then 0, and <code>false</code> becomes 0. Two separate arrays are never equal. <code>Math.max()</code> with no arguments is <code>-Infinity</code> (the starting point for "find the biggest").',
    code: `console.log([] == ![], [] == [], [0] == false);
console.log(Math.max(), Math.min(), Math.max() < Math.min());
console.log(null + undefined, [] + null + 1, {} + []);`,
  },
  {
    id: 'zeroes', cat: 'Tricky output', title: '-0, Infinity and NaN', level: 'Medium', ask: 'Which of these are true?',
    why: '<code>===</code> treats <code>0</code> and <code>-0</code> as equal, but <code>Object.is</code> does not. Dividing by zero gives <code>Infinity</code> (only 0/0 is NaN). <code>includes</code> can find NaN, but <code>indexOf</code> uses <code>===</code> and can\'t.',
    code: `console.log(0 === -0, Object.is(0, -0));
console.log(1 / 0, -1 / 0, 0 / 0);
console.log([NaN].includes(NaN), [NaN].indexOf(NaN));
console.log(Number.MIN_VALUE > 0, 0.1 * 3);`,
  },
  {
    id: 'arraylength', cat: 'Tricky output', title: 'Array length is writable', level: 'Medium', ask: 'What happens when you write past the end, or set length?',
    why: 'Writing to index 5 makes the array 6 long; the gap is empty (reads give <code>undefined</code>). Setting <code>length</code> <b>smaller</b> deletes items, which is why <code>arr.length = 0</code> empties an array. An assignment expression returns the assigned value.',
    code: `const a = [1, 2, 3];
a[5] = 6;
console.log(a.length, a[4]);
a.length = 2;
console.log(a.join(), a.length);
const b = [1, 2, 3];
console.log(b.length = 0, b[0]);`,
  },
  {
    id: 'functionprops', cat: 'Tricky output', title: 'Function length and names', level: 'Hard', ask: 'What are f.length and typeof inner?',
    why: '<code>length</code> counts the parameters <b>before</b> the first default value or rest parameter. A named function expression\'s name (<code>inner</code>) exists only <b>inside</b> that function, so outside, <code>typeof inner</code> is "undefined".',
    code: `function f(a, b = 2, ...rest) {}
console.log(f.length, (function (x, y) {}).length);

const g = function inner() { return typeof inner; };
console.log(g(), typeof inner, g.name);`,
  },

  // ------------------------------------------------------------ scope / closures / this (more)
  {
    id: 'lexicalscope', cat: 'Scope & hoisting', title: 'Lexical vs dynamic scope', level: 'Medium', ask: 'Does show() print 1 or 2?',
    why: 'JavaScript uses <b>lexical</b> scope: a function looks up variables where it was <b>written</b>, not where it is called. <code>show</code> was written in the global scope, so it sees the global <code>x = 1</code>, even when <code>run</code> calls it.',
    code: `let x = 1;
function show() { console.log(x); }
function run() {
  let x = 2;
  show();
}
run();`,
  },
  {
    id: 'closurefns', cat: 'Closures', title: 'Array of functions with var', level: 'Easy', ask: 'Why does every function return 3?',
    why: 'All three functions close over the <b>same</b> <code>var i</code>. They are called after the loop, when <code>i</code> is 3. The IIFE gives each function its own <code>n</code>, captured at that moment (or simply use <code>let</code>).',
    code: `var fns = [];
for (var i = 0; i < 3; i++) fns.push(function () { return i; });
console.log(fns.map(f => f()).join());

const fixed = [];
for (var j = 0; j < 3; j++) fixed.push(((n) => () => n)(j));
console.log(fixed.map(f => f()).join());`,
  },
  {
    id: 'adder', cat: 'Closures', title: 'Function factories', level: 'Easy', ask: 'What do add5 and add10 return?',
    why: 'Each call to <code>makeAdder</code> returns a new function that remembers its own <code>x</code>. That is a closure: a function together with the variables of the place where it was created.',
    code: `function makeAdder(x) {
  return y => x + y;
}
const add5 = makeAdder(5);
const add10 = makeAdder(10);
console.log(add5(2), add10(2), makeAdder(1)(1));

function multiplier(factor) {
  return arr => arr.map(n => n * factor);
}
console.log(multiplier(3)([1, 2, 3]).join());`,
  },
  {
    id: 'lostthis', cat: 'this & functions', title: 'Losing this in callbacks', level: 'Medium', ask: 'Which calls keep the right this?',
    why: 'Class bodies are always strict, so a method taken off its object (<code>loose()</code>) gets <code>this = undefined</code> and throws. An arrow function in a class field captures <code>this</code> when the object is created, so it works anywhere. <code>bind</code> fixes <code>this</code> for callbacks. Calling through an array (<code>arr[0]()</code>) makes the array <code>this</code>.',
    code: `class Timer {
  constructor() {
    this.ticks = 0;
    this.tickArrow = () => ++this.ticks;
  }
  tick() { return ++this.ticks; }
}
const t = new Timer();
const { tickArrow } = t;
console.log(tickArrow(), tickArrow());

const loose = t.tick;
try { loose(); } catch (e) { console.log(e.name); }
console.log([1, 2].map(t.tick.bind(t)).join());

const button = { handlers: [] };
button.handlers.push(function () { return this === button; });
console.log(button.handlers[0]());`,
  },

  // ------------------------------------------------------------ strings & arrays
  {
    id: 'stringmethods', cat: 'Strings & arrays', title: 'String methods', level: 'Easy', ask: 'Predict slice, substring and friends.',
    why: '<code>slice</code> accepts negative indexes (counted from the end); <code>substring</code> treats negatives as 0 (and swaps its arguments if needed). <code>at(-1)</code> reads the last character. Every string method returns a <b>new</b> string: strings can\'t be changed in place.',
    code: `const s = "JavaScript";
console.log(s.slice(-6), s.substring(4), s.substring(-3, 4));
console.log(s.at(-1), s[0], s.charAt(100) === "");
console.log(s.toUpperCase(), s.includes("Script"), s.indexOf("a"), s.lastIndexOf("a"));
console.log("a-b-c".split("-").join("+"), "ab".repeat(3), "5".padStart(3, "0"));
console.log("  trim me  ".trim() + "|", "x".concat("y", "z"));`,
  },
  {
    id: 'immutablestrings', cat: 'Strings & arrays', title: 'Strings are immutable', level: 'Easy', ask: 'Does str[0] = "H" work?',
    why: 'No. Strings are primitives and can\'t be changed; writing to an index is silently ignored (in strict mode it throws). You build a <b>new</b> string instead. <code>replace</code> with a string only replaces the <b>first</b> match; <code>replaceAll</code> replaces every one.',
    code: `let str = "hello";
str[0] = "H";
console.log(str);
str = "H" + str.slice(1);
console.log(str);
console.log(str.replace("l", "L"), str.replaceAll("l", "L"));`,
  },
  {
    id: 'titlecase', cat: 'Strings & arrays', title: 'Title case and camelCase', level: 'Easy', ask: 'Convert "the QUICK brown fOX" and "background-color-dark".',
    why: 'Split into words, uppercase the first letter, lowercase the rest and join. For camelCase, <code>replace</code> with a <b>function</b> receives each match and its groups, and returns the replacement.',
    code: `const titleCase = s => s.toLowerCase().split(" ")
  .map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
console.log(titleCase("the QUICK brown fOX"));

const camel = s => s.replace(/-(\\w)/g, (_, c) => c.toUpperCase());
console.log(camel("background-color-dark"));`,
  },
  {
    id: 'mutating', cat: 'Strings & arrays', title: 'Mutating vs non-mutating methods', level: 'Medium', ask: 'Which methods change the original array?',
    why: '<code>push</code>, <code>pop</code>, <code>shift</code>, <code>unshift</code>, <code>splice</code>, <code>sort</code> and <code>reverse</code> <b>change</b> the array. <code>slice</code>, <code>concat</code>, <code>map</code>, <code>filter</code> and <code>toSorted</code> return a <b>new</b> one. <code>splice(start, count, ...items)</code> returns the removed items.',
    code: `const arr = [1, 2, 3];
const copy = arr.slice();
arr.push(4);
arr.unshift(0);
console.log(arr.join(), copy.join());

const removed = arr.splice(1, 2, "a", "b", "c");
console.log(arr.join(), removed.join());
console.log(arr.pop(), arr.shift(), arr.join());

const mapped = arr.map(x => x + "!");
console.log(arr.join(), mapped.join());`,
  },
  {
    id: 'fillref', cat: 'Strings & arrays', title: 'Array(3).fill([]) trap', level: 'Medium', ask: 'Why does pushing into one row change all rows?',
    why: '<code>fill([])</code> creates <b>one</b> array and puts the same reference in every slot. <code>Array.from({ length: 3 }, () => [])</code> calls the function each time, so you get three different arrays. <code>Array(7)</code> makes an empty array of length 7, but <code>Array.of(7)</code> makes <code>[7]</code>.',
    code: `const grid = Array(3).fill([]);
grid[0].push("x");
console.log(JSON.stringify(grid));

const fixed = Array.from({ length: 3 }, () => []);
fixed[0].push("x");
console.log(JSON.stringify(fixed));

console.log(Array.from({ length: 4 }, (_, i) => i * i).join(), Array.of(7).length, Array(7).length);`,
  },
  {
    id: 'findfilter', cat: 'Strings & arrays', title: 'find, filter, some, every', level: 'Easy', ask: 'What does each search method return?',
    why: '<code>find</code> returns the first <b>item</b> (or <code>undefined</code>), and <code>filter</code> returns an <b>array</b> of all matches. <code>findIndex</code> returns the position (or -1). <code>some</code> and <code>every</code> return booleans and stop early.',
    code: `const users = [{ name: "Ada", age: 36 }, { name: "Bob", age: 17 }, { name: "Cy", age: 17 }];
console.log(users.find(u => u.age === 17).name);
console.log(users.filter(u => u.age === 17).length);
console.log(users.findIndex(u => u.age > 40), users.some(u => u.age < 18), users.every(u => u.age > 10));
console.log(users.map(u => u.name).indexOf("Cy"), users.find(u => u.age > 99));`,
  },
  {
    id: 'setops', cat: 'Strings & arrays', title: 'Intersection, union, difference', level: 'Easy', ask: 'Combine two arrays like sets.',
    why: 'Put one array in a <code>Set</code> for fast O(1) <code>has</code> lookups, then <code>filter</code> the other. For the union, spread both into a new Set to drop duplicates.',
    code: `const a = [1, 2, 3, 4], b = [3, 4, 5];
const setB = new Set(b);
console.log(a.filter(x => setB.has(x)).join());
console.log([...new Set([...a, ...b])].join());
console.log(a.filter(x => !setB.has(x)).join());`,
  },
  {
    id: 'sortobjects', cat: 'Strings & arrays', title: 'Sort objects by several keys', level: 'Medium', ask: 'Sort by age, then by name.',
    why: 'A compare function returns a negative number, 0 or a positive number. <code>a.age - b.age || a.name.localeCompare(b.name)</code> uses the name only when the ages are equal (0 is falsy). Copy first (<code>[...people]</code>) or use <code>toSorted</code> to keep the original order.',
    code: `const people = [
  { name: "Cy", age: 30 },
  { name: "Ada", age: 25 },
  { name: "Bob", age: 30 },
];
const byAge = [...people].sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
console.log(byAge.map(p => p.name).join());

const byName = people.toSorted((a, b) => a.name.localeCompare(b.name));
console.log(byName.map(p => p.name).join(), people[0].name);`,
  },
  {
    id: 'rotate', cat: 'Strings & arrays', title: 'Rotate an array', level: 'Easy', ask: 'Rotate [1,2,3,4,5] right by 2.',
    why: 'Take the last <code>k</code> items and put them in front of the rest. <code>k % length</code> handles rotations bigger than the array.',
    code: `const rotate = (arr, k) => {
  k = k % arr.length;
  return [...arr.slice(-k), ...arr.slice(0, -k)];
};
console.log(rotate([1, 2, 3, 4, 5], 2).join(), rotate([1, 2, 3], 4).join());`,
  },
  {
    id: 'reduce', cat: 'Strings & arrays', title: 'reduce in practice', level: 'Medium', ask: 'Sum, max, cart total and object building with reduce.',
    why: '<code>reduce</code> carries an <b>accumulator</b> through the array: each call returns the new accumulator. Without a start value, the first item is used. It can build any result: a number, an object or another array.',
    code: `const nums = [3, 7, 2, 9];
console.log(nums.reduce((a, b) => a + b, 0));
console.log(nums.reduce((m, n) => (n > m ? n : m)));

const cart = [{ price: 5, qty: 2 }, { price: 3, qty: 4 }];
console.log(cart.reduce((sum, item) => sum + item.price * item.qty, 0));

const pairs = [["a", 1], ["b", 2]];
console.log(JSON.stringify(Object.fromEntries(pairs)));
console.log(JSON.stringify(pairs.reduce((o, [k, v]) => ({ ...o, [k]: v * 10 }), {})));`,
  },

  // ------------------------------------------------------------ modern syntax
  {
    id: 'destructuring', cat: 'Modern syntax (ES6+)', title: 'Destructuring', level: 'Medium', ask: 'What does each variable get?',
    why: 'Destructuring copies values out by <b>shape</b>: nested patterns, renaming (<code>id: userId</code>), defaults (used only for <code>undefined</code>), rest (<code>...others</code>) and holes (<code>[, second]</code>). <code>[p, q] = [q, p]</code> swaps two variables.',
    code: `const user = { id: 7, profile: { name: "Ada", langs: ["js", "py"] } };
const { id, profile: { name, langs: [first, ...others] }, role = "guest" } = user;
console.log(id, name, first, others.length, role);

const { id: userId, ...rest } = user;
console.log(userId, Object.keys(rest).join());

let p = 1, q = 2;
[p, q] = [q, p];
console.log(p, q);

const [, second = "none", third = "default"] = ["a", "b"];
console.log(second, third);`,
  },
  {
    id: 'restspread', cat: 'Modern syntax (ES6+)', title: 'Rest, spread and arguments', level: 'Easy', ask: 'What is the difference between rest and arguments?',
    why: 'Rest parameters (<code>...nums</code>) collect the arguments into a <b>real array</b>. The old <code>arguments</code> object only looks like an array, and arrow functions don\'t have one. Spread does the reverse: it expands an array, object or string into separate items.',
    code: `function sum(...nums) { return nums.reduce((a, b) => a + b, 0); }
console.log(sum(1, 2, 3), sum(...[4, 5]), sum());

function oldStyle() {
  return arguments.length + " args, array? " + Array.isArray(arguments);
}
console.log(oldStyle(1, 2));

const merged = { ...{ a: 1, b: 2 }, ...{ b: 3 } };
console.log(JSON.stringify(merged), Math.max(...[1, 9, 4]), [..."hi"].join("|"));`,
  },
  {
    id: 'defaultparams', cat: 'Modern syntax (ES6+)', title: 'Default parameters', level: 'Hard', ask: 'When do default values run?',
    why: 'A default is evaluated at <b>call time</b>, every time, and only when the argument is <code>undefined</code> (not <code>null</code>). Later defaults can use earlier parameters. Parameters have a TDZ too: <code>x = y</code> fails because <code>y</code> is not ready yet.',
    code: `let calls = 0;
const next = () => ++calls;
function f(a, b = next(), c = a + b) { return [a, b, c].join(); }
console.log(f(1), f(1), f(1, 10));
console.log(f(1, undefined, null), f(1, null));

function g(x = y, y = 2) { return x; }
try { g(); } catch (e) { console.log(e.name); }`,
  },
  {
    id: 'optional', cat: 'Modern syntax (ES6+)', title: '?. and ?? vs ||', level: 'Medium', ask: 'Why is port 0 replaced by || but not by ???',
    why: '<code>||</code> falls back on <b>any falsy</b> value (0, "", false). <code>??</code> only falls back on <code>null</code> or <code>undefined</code>, so a real 0 or "" is kept. <code>?.</code> stops the whole chain and gives <code>undefined</code> when the left side is null or undefined. <code>??=</code> assigns only if the variable is null or undefined.',
    code: `const cfg = { server: { port: 0, host: "" }, retry: null };
console.log(cfg.server?.port, cfg.db?.url, cfg.db?.url.toUpperCase());
console.log(cfg.server.port || 8080, cfg.server.port ?? 8080);
console.log(cfg.server.host || "localhost", cfg.server.host ?? "localhost");
console.log(cfg.retry ?? 3, cfg.missing?.(), typeof cfg.fn?.call);

let count = null;
count ??= 10;
count ||= 99;
console.log(count);`,
  },
  {
    id: 'truthy', cat: 'Modern syntax (ES6+)', title: 'Truthy, falsy and short-circuit', level: 'Easy', ask: 'Which values are falsy?',
    why: 'There are only a few falsy values: <code>0</code>, <code>""</code>, <code>null</code>, <code>undefined</code>, <code>NaN</code> and <code>false</code> (plus <code>-0</code> and <code>0n</code>). Everything else is truthy, even "0", "false", [] and {}. <code>||</code> and <code>&&</code> return one of their <b>operands</b>, not a boolean.',
    code: `const values = [0, "", null, undefined, NaN, false, "0", "false", [], {}, -1, " "];
console.log(values.map(v => (v ? "T" : "F")).join(""));
console.log(Boolean([]), !!"0", !!NaN);
console.log(0 || "a", 1 && "b", null && "c", "" || null || "last");`,
  },
  {
    id: 'symbols', cat: 'Modern syntax (ES6+)', title: 'Symbols', level: 'Medium', ask: 'Why is the symbol key hidden from keys and JSON?',
    why: 'Every <code>Symbol()</code> is unique, which makes it a key that can never clash with other code. Symbol keys are skipped by <code>Object.keys</code>, <code>for...in</code> and <code>JSON.stringify</code>. <code>Symbol.for</code> uses a global registry, so the same name gives the same symbol.',
    code: `const id = Symbol("id");
const user = { name: "Ada", [id]: 123 };
console.log(user[id], Object.keys(user).join(), JSON.stringify(user));
console.log(Symbol("x") === Symbol("x"), Symbol.for("x") === Symbol.for("x"));
console.log(id.toString(), id.description);`,
  },
  {
    id: 'iterable', cat: 'Modern syntax (ES6+)', title: 'Make a class iterable', level: 'Medium', ask: 'How do for...of and spread work on your own object?',
    why: '<code>for...of</code>, spread and destructuring call <code>obj[Symbol.iterator]()</code> and then <code>.next()</code> until <code>done</code> is true. A generator method is the easiest way to write that iterator.',
    code: `class Range {
  constructor(from, to) { this.from = from; this.to = to; }
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  }
}
const r = new Range(1, 4);
console.log([...r].join(), Math.max(...r));
for (const n of new Range(3, 5)) console.log("n =", n);

const it = [10, 20][Symbol.iterator]();
console.log(JSON.stringify(it.next()), JSON.stringify(it.next()), JSON.stringify(it.next()));`,
  },
  {
    id: 'mapobject', cat: 'Modern syntax (ES6+)', title: 'Map vs plain object', level: 'Medium', ask: 'Why does the Map have 3 keys but the object only 1?',
    why: 'Object keys are always strings (or symbols), so <code>1</code> and <code>"1"</code> become the same key. A <code>Map</code> keeps keys of <b>any type</b> (numbers, booleans, objects), remembers insertion order and has <code>size</code>. Use it for counting and caches.',
    code: `const m = new Map();
m.set(1, "number one").set("1", "string one").set(true, "yes");
console.log(m.size, m.get(1), m.get("1"));

const o = {};
o[1] = "number one";
o["1"] = "string one";
console.log(Object.keys(o).length, o[1]);
console.log([...m.keys()].map(k => typeof k).join());

const counts = new Map();
for (const w of "a b a c a".split(" ")) counts.set(w, (counts.get(w) || 0) + 1);
console.log([...counts].map(([k, v]) => k + "=" + v).join(" "));`,
  },
  {
    id: 'weakmap', cat: 'Modern syntax (ES6+)', title: 'WeakMap for private data', level: 'Hard', ask: 'Why use a WeakMap here instead of a Map?',
    why: 'A <code>WeakMap</code> holds its keys <b>weakly</b>: when nothing else references a Person, the entry can be garbage-collected with it, so there is no memory leak. Keys must be objects, and you can\'t list them, which also keeps the data private.',
    code: `const secrets = new WeakMap();
class Person {
  constructor(name, pin) {
    this.name = name;
    secrets.set(this, pin);
  }
  check(pin) { return secrets.get(this) === pin; }
}
const p = new Person("Ada", 1234);
console.log(p.check(1234), p.check(1), Object.keys(p).join(), secrets.has(p));
try { secrets.set("text", 1); } catch (e) { console.log(e.name); }`,
  },
  {
    id: 'tagged', cat: 'Modern syntax (ES6+)', title: 'Template literals and tags', level: 'Hard', ask: 'What does a tag function receive?',
    why: 'A tag function gets the <b>fixed text parts</b> as an array and the <code>\${…}</code> values as the remaining arguments, and it can build any result. Libraries use this for safe HTML, SQL and CSS. Plain template literals can span lines and run any expression.',
    code: `function highlight(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? "[" + values[i] + "]" : ""), "");
}
const item = "coffee", price = 3.5;
console.log(highlight\`One \${item} costs \${price}\`);
console.log(\`2 + 3 = \${2 + 3}\`, \`multi
line\`.split("\\n").length);`,
  },
  {
    id: 'getset', cat: 'Modern syntax (ES6+)', title: 'Getters, setters and defineProperty', level: 'Medium', ask: 'What do the getter and the hidden property print?',
    why: 'A <b>getter</b> runs a function when the property is read, and a <b>setter</b> runs when it is written, so a value can be computed from other values. <code>Object.defineProperty</code> can make a property <b>non-enumerable</b>: it is still readable, but hidden from <code>keys</code> and <code>JSON</code>.',
    code: `const temp = {
  celsius: 25,
  get fahrenheit() { return this.celsius * 9 / 5 + 32; },
  set fahrenheit(f) { this.celsius = (f - 32) * 5 / 9; },
};
console.log(temp.fahrenheit);
temp.fahrenheit = 212;
console.log(temp.celsius);

const user = { name: "Ada" };
Object.defineProperty(user, "id", { value: 1, enumerable: false });
console.log(user.id, Object.keys(user).join(), JSON.stringify(user));`,
  },

  // ------------------------------------------------------------ errors
  {
    id: 'finally', cat: 'Errors', title: 'try / catch / finally order', level: 'Hard', ask: 'What does override() return?',
    why: '<code>finally</code> <b>always</b> runs, even after a <code>return</code> or a throw, which makes it the place for cleanup. If <code>finally</code> itself returns, that value <b>replaces</b> the earlier return (avoid this). An error thrown in <code>catch</code> still runs <code>finally</code> first.',
    code: `function test() {
  try {
    console.log("try");
    return "from try";
  } finally {
    console.log("finally runs anyway");
  }
}
console.log(test());

function override() {
  try { return 1; } finally { return 2; }
}
console.log(override());

function rethrow() {
  try { throw new Error("A"); }
  catch (e) { throw new Error("B from catch"); }
  finally { console.log("cleanup"); }
}
try { rethrow(); } catch (e) { console.log(e.message); }`,
  },
  {
    id: 'customerror', cat: 'Errors', title: 'Custom error classes', level: 'Medium', ask: 'Write a ValidationError with an extra field.',
    why: 'Extend <code>Error</code>, call <code>super(message)</code> and set <code>name</code>, so logs show "ValidationError". Extra properties (like <code>field</code>) carry details. <code>instanceof</code> lets a <code>catch</code> handle each error type differently.',
    code: `class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}
function validate(user) {
  if (!user.email) throw new ValidationError("email", "Email is required");
  return true;
}
try {
  validate({});
} catch (e) {
  console.log(e.name, e.field, e.message);
  console.log(e instanceof ValidationError, e instanceof Error);
  console.log(String(e));
}`,
  },
  {
    id: 'errortypes', cat: 'Errors', title: 'Built-in error types', level: 'Easy', ask: 'Which error does each line throw?',
    why: 'You can throw <b>any</b> value, but <code>Error</code> objects carry a message and a stack trace. <b>TypeError</b>: wrong type (reading a property of null). <b>ReferenceError</b>: undeclared name. <b>RangeError</b>: number out of range. <b>SyntaxError</b>: invalid code or JSON.',
    code: `try { throw "just a string"; } catch (e) { console.log(typeof e, e); }
try { throw { code: 42 }; } catch (e) { console.log(e.code, e instanceof Error); }
try { null.x; } catch (e) { console.log(e.name); }
try { undefinedFunction(); } catch (e) { console.log(e.name); }
try { (1).toFixed(200); } catch (e) { console.log(e.name); }
try { JSON.parse("{bad json}"); } catch (e) { console.log(e.name); }`,
  },
  {
    id: 'asyncthrow', cat: 'Errors', title: 'try/catch around setTimeout', level: 'Medium', ask: 'Does the catch block catch the error?',
    why: 'No. <code>try/catch</code> only sees errors thrown <b>while it is on the call stack</b>. The callback runs later, as a new task, after the try block has finished, so the error is uncaught. Put the try/catch <b>inside</b> the callback, or use promises with <code>await</code>.',
    expect: ['try/catch already finished', 'Uncaught Error: thrown later'],
    code: `try {
  setTimeout(() => {
    throw new Error("thrown later");
  }, 0);
} catch (e) {
  console.log("caught:", e.message);
}
console.log("try/catch already finished");`,
  },
  {
    id: 'unhandled', cat: 'Errors', title: 'Unhandled promise rejection', level: 'Medium', ask: 'What happens to a rejection nobody handles?',
    why: 'If a rejected promise has no <code>.catch</code> by the time the microtasks are done, the runtime reports an <b>unhandled rejection</b> (in Node it can crash the process). Code keeps running in the browser. Always end promise chains with <code>.catch</code> or wrap <code>await</code> in try/catch.',
    expect: ['Uncaught (in promise) Error: nobody caught me', 'the program keeps running'],
    code: `Promise.reject(new Error("nobody caught me"));
setTimeout(() => console.log("the program keeps running"), 0);`,
  },

  // ------------------------------------------------------------ objects
  {
    id: 'inhasown', cat: 'Objects', title: 'in vs hasOwn vs for...in', level: 'Medium', ask: 'Which checks see inherited properties?',
    why: '<code>in</code> and <code>for...in</code> also look up the <b>prototype chain</b>. <code>hasOwnProperty</code> / <code>Object.hasOwn</code> and <code>Object.keys</code> only see the object\'s <b>own</b> properties. <code>Object.create(null)</code> makes an object with no prototype at all, so not even <code>toString</code>.',
    code: `const parent = { inherited: true };
const child = Object.create(parent);
child.own = 1;
console.log("own" in child, "inherited" in child);
console.log(child.hasOwnProperty("inherited"), Object.hasOwn(child, "own"));
console.log(Object.keys(child).join());

const keys = [];
for (const k in child) keys.push(k);
console.log(keys.join());

const bare = Object.create(null);
console.log(typeof bare.toString, "toString" in {});`,
  },
  {
    id: 'entries', cat: 'Objects', title: 'Transform objects with entries', level: 'Easy', ask: 'Double every price without a loop.',
    why: 'Turn the object into <code>[key, value]</code> pairs with <code>Object.entries</code>, use the array methods, then rebuild it with <code>Object.fromEntries</code>.',
    code: `const prices = { apple: 1.2, bread: 2.5, milk: 0.99 };
const doubled = Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v * 2]));
console.log(JSON.stringify(doubled));

const cheap = Object.entries(prices).filter(([, v]) => v < 2).map(([k]) => k);
console.log(cheap.join(), Object.values(prices).length);

const inverted = Object.fromEntries(Object.entries({ a: "x", b: "y" }).map(([k, v]) => [v, k]));
console.log(JSON.stringify(inverted));`,
  },
  {
    id: 'chaining', cat: 'Objects', title: 'Method chaining (builder)', level: 'Easy', ask: 'How does calc.add(3).mul(4) work?',
    why: 'Each method changes the object and <b>returns <code>this</code></b>, so the next method is called on the same object. Query builders and jQuery work this way. <code>String(obj)</code> calls the object\'s own <code>toString</code>.',
    code: `class Calc {
  constructor(v = 0) { this.v = v; }
  add(n) { this.v += n; return this; }
  mul(n) { this.v *= n; return this; }
  result() { return this.v; }
}
console.log(new Calc(2).add(3).mul(4).result());

const query = {
  parts: [],
  where(c) { this.parts.push(c); return this; },
  toString() { return "WHERE " + this.parts.join(" AND "); },
};
console.log(String(query.where("age > 18").where("active")));`,
  },
  {
    id: 'proxyvalidate', cat: 'Objects', title: 'Proxy for validation', level: 'Hard', ask: 'How can an object reject bad values?',
    why: 'A <code>Proxy</code> wraps an object, and its <b>traps</b> (<code>get</code>, <code>set</code>, ...) run on every access. Here <code>set</code> checks the type before storing, and <code>get</code> gives a default for missing keys. Vue\'s reactivity is built on this.',
    code: `const user = new Proxy({}, {
  set(target, key, value) {
    if (key === "age" && typeof value !== "number") throw new TypeError("age must be a number");
    target[key] = value;
    return true;
  },
  get(target, key) {
    return key in target ? target[key] : "<" + String(key) + " missing>";
  },
});
user.age = 30;
console.log(user.age, user.name);
try { user.age = "old"; } catch (e) { console.log(e.message); }`,
  },

  // ------------------------------------------------------------ dates, regex, JSON
  {
    id: 'jsonquirks', cat: 'Dates, regex & JSON', title: 'JSON.stringify quirks', level: 'Hard', ask: 'What survives JSON.stringify?',
    why: '<code>undefined</code> and functions are <b>dropped</b> from objects (and become <code>null</code> in arrays). <code>NaN</code> and <code>Infinity</code> become <code>null</code>. Dates become ISO strings. A <code>toJSON</code> method controls the output. The second argument filters keys (an array) or transforms values (a function), and the third adds indentation.',
    code: `const data = { a: undefined, b: () => 1, c: NaN, d: [undefined, () => 2], e: new Date(0), f: Infinity };
console.log(JSON.stringify(data));
console.log(JSON.stringify({ toJSON() { return "custom"; } }));
console.log(JSON.stringify({ x: 1, y: 2, z: 3 }, ["x", "z"]));
console.log(JSON.stringify({ n: 1, s: "a" }, (k, v) => (typeof v === "number" ? v * 100 : v)));
console.log(JSON.stringify([1, [2]], null, 1).split("\\n").length);`,
  },
  {
    id: 'dates', cat: 'Dates, regex & JSON', title: 'Date pitfalls', level: 'Medium', ask: 'Why does setMonth(1) on January 31 land in March?',
    why: 'Months are <b>0-based</b> (0 = January), but days start at 1. Dates <b>overflow</b>: February 31 rolls over to March 2. Two Date objects are never <code>===</code>; compare <code>getTime()</code>. Subtracting dates gives milliseconds.',
    code: `const d = new Date(2024, 0, 31);
console.log(d.getMonth(), d.getDate(), d.getDay());
d.setMonth(1);
console.log(d.getMonth(), d.getDate());
console.log(new Date(2024, 1, 29).getDate(), new Date(2023, 1, 29).getMonth());

const a = new Date(2024, 0, 1), b = new Date(2024, 0, 1);
console.log(a === b, a.getTime() === b.getTime(), (new Date(2024, 0, 11) - a) / 86400000);`,
  },
  {
    id: 'regex', cat: 'Dates, regex & JSON', title: 'Regular expressions', level: 'Hard', ask: 'Why does re.test() alternate between true and false?',
    why: '<code>match</code> with <code>/g</code> returns every match. Replacements can use groups (<code>$1</code>, <code>$2</code>). A regex with the <code>g</code> flag is <b>stateful</b>: <code>test</code> remembers <code>lastIndex</code> and continues from there, so repeated calls give different results. Named groups (<code>?&lt;year&gt;</code>) make results readable.',
    code: `const text = "Call 555-1234 or 555-9876 today";
console.log(text.match(/\\d{3}-\\d{4}/g).join(" | "));
console.log(text.replace(/(\\d{3})-(\\d{4})/g, "$2-$1"));

const email = /^[^\\s@]+@[^\\s@]+\\.[a-z]{2,}$/i;
console.log(email.test("ada@example.com"), email.test("bad@email"));

const re = /a/g;
console.log(re.test("aa"), re.test("aa"), re.test("aa"), re.lastIndex);

const { groups } = "2024-03-15".match(/(?<year>\\d{4})-(?<month>\\d{2})/);
console.log(groups.year, groups.month);`,
  },

  // ------------------------------------------------------------ objects & classes (more)
  {
    id: 'protomethods', cat: 'Objects & classes', title: 'Prototype methods vs arrow fields', level: 'Hard', ask: 'Do two instances share their methods?',
    why: 'Normal class methods live <b>once</b> on the prototype, so all instances share them, and changing the prototype affects every instance. Arrow-function class fields are created <b>per instance</b> (more memory, but <code>this</code> is bound). That is why <code>a.wag !== b.wag</code>.',
    code: `class Dog {
  bark() { return "woof"; }
  wag = () => "wag";
}
const a = new Dog(), b = new Dog();
console.log(a.bark === b.bark, a.wag === b.wag);
console.log(Object.keys(a).join(), typeof Dog.prototype.bark, typeof Dog.prototype.wag);

Dog.prototype.bark = function () { return "WOOF"; };
console.log(a.bark(), b.bark());`,
  },
  {
    id: 'mixins', cat: 'Objects & classes', title: 'Mixins with Object.assign', level: 'Medium', ask: 'How can a class get methods from several sources?',
    why: 'JavaScript classes have one parent, but you can copy methods from plain objects onto the <b>prototype</b> with <code>Object.assign</code>. The methods are inherited (on the prototype), not own properties.',
    code: `const canFly = { fly() { return this.name + " flies"; } };
const canSwim = { swim() { return this.name + " swims"; } };

class Duck {
  constructor(name) { this.name = name; }
}
Object.assign(Duck.prototype, canFly, canSwim);

const d = new Duck("Donald");
console.log(d.fly(), d.swim(), "fly" in d, d.hasOwnProperty("fly"));`,
  },
  {
    id: 'polymorphism', cat: 'Objects & classes', title: 'Overriding and super', level: 'Medium', ask: 'Which area() runs for each shape?',
    why: '<code>describe</code> is written once in <code>Shape</code>, but <code>this.area()</code> calls the version of the <b>actual object\'s</b> class (polymorphism). <code>super.describe()</code> calls the parent\'s version from an override. <code>this.constructor.name</code> is the class name.',
    code: `class Shape {
  area() { return 0; }
  describe() { return this.constructor.name + " with area " + this.area().toFixed(2); }
}
class Circle extends Shape {
  constructor(r) { super(); this.r = r; }
  area() { return Math.PI * this.r ** 2; }
}
class Square extends Shape {
  constructor(s) { super(); this.s = s; }
  area() { return this.s ** 2; }
  describe() { return super.describe() + " (a square)"; }
}
for (const s of [new Circle(1), new Square(2), new Shape()]) console.log(s.describe());`,
  },
  {
    id: 'statics', cat: 'Objects & classes', title: 'Static members and factories', level: 'Medium', ask: 'Can an instance call a static method?',
    why: 'Static members belong to the <b>class itself</b>, not to instances, so <code>t.fromF</code> is undefined. They suit factories (<code>fromF</code>) and shared counters. A <code>toString</code> method controls how an object turns into a string.',
    code: `class Temperature {
  static count = 0;
  static fromF(f) { return new Temperature(((f - 32) * 5) / 9); }
  constructor(c) { this.c = c; Temperature.count++; }
  toString() { return this.c.toFixed(1) + " C"; }
}
const t = Temperature.fromF(212);
console.log(String(t), "" + new Temperature(21.456), Temperature.count);
console.log(typeof t.fromF, typeof Temperature.fromF);`,
  },
  {
    id: 'generatorchat', cat: 'Objects & classes', title: 'Two-way generators', level: 'Hard', ask: 'Where does the value passed to next() go?',
    why: 'The value passed to <code>next(value)</code> becomes the <b>result of the paused <code>yield</code></b> expression. The first <code>next()</code> only starts the generator, so its argument is ignored. <code>return</code> gives the final value with <code>done: true</code>.',
    code: `function* conversation() {
  const name = yield "What is your name?";
  const lang = yield "Hi " + name + "! Favourite language?";
  return name + " likes " + lang;
}
const chat = conversation();
console.log(chat.next().value);
console.log(chat.next("Ada").value);
console.log(JSON.stringify(chat.next("JavaScript")));
console.log(JSON.stringify(chat.next()));`,
  },

  // ------------------------------------------------------------ event loop (more)
  {
    id: 'asyncreturn', cat: 'Event loop & promises', title: 'What does an async function return?', level: 'Medium', ask: 'Is getNumber() a number?',
    why: 'An async function <b>always</b> returns a Promise; its <code>return</code> value becomes the result. Returning another promise adopts it (which costs extra microtask ticks). <code>await</code> on a plain value still pauses for one tick.',
    code: `async function getNumber() { return 42; }
async function getPromise() { return Promise.resolve(7); }

const r = getNumber();
console.log(r instanceof Promise, typeof r.then);
getNumber().then(v => console.log("value", v));

(async () => {
  console.log("awaited", await getPromise());
  console.log("await plain value:", await 5);
})();
console.log("sync code first");`,
  },
  {
    id: 'awaitorder', cat: 'Event loop & promises', title: 'Several awaits interleaving', level: 'Hard', ask: 'Write the full order.',
    why: 'Each <code>await</code> pauses its function and queues the rest as a microtask. Functions take turns one microtask at a time, in the order their continuations were queued, so the output zig-zags between <code>a</code>, <code>b</code> and the promise chain.',
    code: `async function a() {
  console.log("a1");
  await null;
  console.log("a2");
  await null;
  console.log("a3");
}
async function b() {
  console.log("b1");
  await null;
  console.log("b2");
}
a();
b();
Promise.resolve().then(() => console.log("p1")).then(() => console.log("p2"));
console.log("sync");`,
  },
  {
    id: 'resolvedthen', cat: 'Event loop & promises', title: '.then on an already resolved promise', level: 'Medium', ask: 'Does then run immediately if the promise is already resolved?',
    why: 'No. <code>.then</code> callbacks are <b>always</b> asynchronous, even on a settled promise; they wait for the current code to finish. <code>Promise.resolve(p)</code> returns <code>p</code> itself when <code>p</code> is a real promise, but <code>new Promise</code> always makes a new one.',
    code: `const p = Promise.resolve("done");
p.then(v => console.log("then 1:", v));
console.log("after then 1");
p.then(v => console.log("then 2:", v));
console.log(Promise.resolve(p) === p, new Promise(r => r(p)) === p);`,
  },
  {
    id: 'timerargs', cat: 'Event loop & promises', title: 'setTimeout details', level: 'Medium', ask: 'What is this in a callback passed as obj.show?',
    why: 'Extra arguments to <code>setTimeout</code> are passed to the callback. <code>clearTimeout</code> cancels a timer before it fires. Passing <code>obj.show</code> passes the function <b>without</b> its object, so <code>this</code> is lost; wrap it in an arrow function (or <code>bind</code>).',
    code: `setTimeout((a, b) => console.log("args:", a, b), 10, "x", "y");

const id = setTimeout(() => console.log("never runs"), 5);
clearTimeout(id);

const obj = { show() { console.log("this is obj?", this === obj); } };
setTimeout(obj.show, 0);
setTimeout(() => obj.show(), 0);`,
  },
  {
    id: 'blocking', cat: 'Event loop & promises', title: 'Long sync code delays timers', level: 'Easy', ask: 'Can a 0ms timer interrupt a loop?',
    why: 'No. JavaScript runs one task at a time to completion. The timer is ready almost immediately, but it waits until the loop and the rest of the script are done and the call stack is empty. Heavy work belongs in chunks or a Web Worker.',
    code: `setTimeout(() => console.log("timer (0ms) finally runs"), 0);
let total = 0;
for (let i = 0; i < 200; i++) total += i;
console.log("long loop done:", total);`,
  },
  {
    id: 'interval', cat: 'Event loop & promises', title: 'setInterval and clearInterval', level: 'Easy', ask: 'How many times does the interval run?',
    why: '<code>setInterval</code> repeats its callback every <code>ms</code> until <code>clearInterval</code> is called with its id. Here the callback clears it after the fourth run. Forgetting to clear intervals is a common memory leak.',
    code: `let progress = 0;
const timer = setInterval(() => {
  progress += 25;
  console.log("progress", progress + "%");
  if (progress >= 100) {
    clearInterval(timer);
    console.log("done, interval cleared");
  }
}, 50);`,
  },

  // ------------------------------------------------------------ async patterns (more)
  {
    id: 'promisify', cat: 'Async patterns', title: 'Implement promisify', level: 'Medium', ask: 'Turn a callback API into a promise API.',
    why: 'Return a function that creates a Promise and calls the original with an extra <b>error-first callback</b> <code>(err, result)</code>: reject on an error, resolve otherwise. Node has this built in as <code>util.promisify</code>.',
    code: `function promisify(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
  });
}
function divideLater(a, b, cb) {
  setTimeout(() => (b === 0 ? cb(new Error("divide by zero")) : cb(null, a / b)), 10);
}
const divide = promisify(divideLater);
divide(10, 2).then(r => console.log("result", r));
divide(1, 0).catch(e => console.log("error", e.message));`,
  },
  {
    id: 'pool', cat: 'Async patterns', title: 'Limit concurrency (promise pool)', level: 'Hard', ask: 'Run 4 tasks with at most 2 at a time.',
    why: 'Start <code>limit</code> "workers". Each worker loops: take the next task index, await it, repeat. When one finishes, it picks up the next task straight away, so at most 2 run at once. <code>Promise.all</code> waits for every worker.',
    code: `const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runWithLimit(tasks, limit) {
  const results = [];
  let next = 0;
  async function worker(id) {
    while (next < tasks.length) {
      const i = next++;
      console.log("worker", id, "starts task", i);
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, (_, id) => worker(id)));
  return results;
}

const tasks = [30, 10, 20, 10].map((ms, i) => () => sleep(ms).then(() => "t" + i));
runWithLimit(tasks, 2).then(r => console.log("all done:", r.join()));`,
  },
  {
    id: 'dedupe-requests', cat: 'Async patterns', title: 'Cache in-flight requests', level: 'Hard', ask: 'Three calls, but only two network requests. How?',
    why: 'Cache the <b>promise</b>, not the result. The second caller for the same id gets the same pending promise, so they share one request. This is how data libraries avoid duplicate fetches.',
    code: `let requests = 0;
const fetchUser = id => {
  requests++;
  return new Promise(r => setTimeout(() => r({ id, name: "User " + id }), 20));
};
const cache = new Map();
function getUser(id) {
  if (!cache.has(id)) cache.set(id, fetchUser(id));
  return cache.get(id);
}
Promise.all([getUser(1), getUser(1), getUser(2)]).then(users => {
  console.log(users.map(u => u.name).join(), "requests:", requests);
});`,
  },
  {
    id: 'sequencereduce', cat: 'Async patterns', title: 'Run promises in order with reduce', level: 'Medium', ask: 'Run async tasks one after another.',
    why: 'Start from <code>Promise.resolve()</code> and chain each task onto the previous one with <code>.then</code>, so each waits for the last. The modern way is a <code>for...of</code> loop with <code>await</code>.',
    code: `const delays = [30, 10, 20];
const wait = (ms, label) => new Promise(r => setTimeout(() => { console.log("finished", label); r(); }, ms));

delays
  .reduce((chain, ms, i) => chain.then(() => wait(ms, "#" + i)), Promise.resolve())
  .then(() => console.log("all in order"));`,
  },
  {
    id: 'settledpolyfill', cat: 'Async patterns', title: 'Polyfills: allSettled and race', level: 'Hard', ask: 'Implement Promise.allSettled and Promise.race.',
    why: '<code>allSettled</code>: turn each promise into one that <b>always fulfills</b> with a status object, then use <code>Promise.all</code>. <code>race</code>: attach the same <code>resolve</code> / <code>reject</code> to every promise; the first one to call it wins, because a promise settles only once.',
    code: `function allSettled(promises) {
  return Promise.all(promises.map(p => Promise.resolve(p).then(
    value => ({ status: "fulfilled", value }),
    reason => ({ status: "rejected", reason: reason.message })
  )));
}
function race(promises) {
  return new Promise((resolve, reject) =>
    promises.forEach(p => Promise.resolve(p).then(resolve, reject)));
}
const wait = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
allSettled([wait(10, "ok"), Promise.reject(new Error("bad")), 3]).then(r => console.log(JSON.stringify(r)));
race([wait(30, "slow"), wait(5, "fast")]).then(v => console.log("winner:", v));`,
  },

  // ------------------------------------------------------------ implement it (more)
  {
    id: 'lodashget', cat: 'Implement it', title: 'Safe get and flatten keys', level: 'Medium', ask: 'Implement get(obj, "a.b.c", fallback).',
    why: 'Split the path and walk down with <code>reduce</code>, stopping safely when a level is null or undefined (<code>o == null</code> checks both). Flattening is the reverse: recurse into plain objects and join the keys with dots.',
    code: `function get(obj, path, fallback) {
  const value = path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
  return value === undefined ? fallback : value;
}
const data = { user: { address: { city: "Paris" }, tags: ["a", "b"] } };
console.log(get(data, "user.address.city"), get(data, "user.tags.1"), get(data, "user.phone.number", "n/a"));

function flattenKeys(obj, prefix = "") {
  return Object.keys(obj).reduce((out, k) => {
    const key = prefix ? prefix + "." + k : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) Object.assign(out, flattenKeys(obj[k], key));
    else out[key] = obj[k];
    return out;
  }, {});
}
console.log(JSON.stringify(flattenKeys({ a: 1, b: { c: 2, d: { e: 3 } } })));`,
  },
  {
    id: 'deepfreeze', cat: 'Implement it', title: 'Deep freeze', level: 'Medium', ask: 'Make an object completely read-only.',
    why: '<code>Object.freeze</code> is shallow, so freeze every nested object first (recursively), then the object itself. In strict mode any write to a frozen object throws a TypeError.',
    code: `"use strict";
function deepFreeze(obj) {
  Object.values(obj).forEach(v => { if (v && typeof v === "object") deepFreeze(v); });
  return Object.freeze(obj);
}
const settings = deepFreeze({ theme: { color: "dark" }, list: [1] });
try { settings.theme.color = "light"; } catch (e) { console.log(e.name); }
try { settings.list.push(2); } catch (e) { console.log(e.name); }
console.log(settings.theme.color, settings.list.length);`,
  },
  {
    id: 'mynew', cat: 'Implement it', title: 'Implement new and instanceof', level: 'Hard', ask: 'Write myNew(Ctor, ...args) and myInstanceOf(obj, Ctor).',
    why: '<code>new</code> does four things: create an object linked to <code>Ctor.prototype</code>, run the constructor with it as <code>this</code>, and return it (unless the constructor returned an object). <code>instanceof</code> walks up the prototype chain looking for <code>Ctor.prototype</code>.',
    code: `function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);
  const result = Ctor.apply(obj, args);
  return result !== null && typeof result === "object" ? result : obj;
}
function myInstanceOf(obj, Ctor) {
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
function Car(brand) { this.brand = brand; }
Car.prototype.honk = function () { return this.brand + " beep"; };

const c = myNew(Car, "Volvo");
console.log(c.honk(), c instanceof Car, myInstanceOf(c, Car), myInstanceOf(c, Array));`,
  },
  {
    id: 'mycall', cat: 'Implement it', title: 'Polyfill: call', level: 'Hard', ask: 'Implement Function.prototype.call.',
    why: 'Temporarily put the function <b>on the object</b> (under a unique Symbol key, so nothing is overwritten), call it as a method so <code>this</code> is the object, then remove it again. <code>apply</code> is the same with an array of arguments.',
    code: `Function.prototype.myCall = function (ctx, ...args) {
  ctx = ctx ?? globalThis;
  const key = Symbol("fn");
  ctx[key] = this;
  const result = ctx[key](...args);
  delete ctx[key];
  return result;
};
function greet(greeting) { return greeting + ", " + this.name; }
console.log(greet.myCall({ name: "Ada" }, "Hello"));`,
  },
  {
    id: 'template', cat: 'Implement it', title: 'Tiny template engine', level: 'Medium', ask: 'Replace {{ name }} placeholders with data.',
    why: 'A global regex finds every placeholder, and a <b>replace callback</b> receives the captured key and returns its value. Missing keys become an empty string.',
    code: `function render(template, data) {
  return template.replace(/{{\\s*(\\w+)\\s*}}/g, (_, key) => (key in data ? data[key] : ""));
}
console.log(render("Hi {{ name }}, you have {{count}} new {{thing}}", { name: "Ada", count: 3 }));`,
  },

  // ------------------------------------------------------------ data structures
  {
    id: 'stackqueue', cat: 'Data structures', title: 'Stack and queue', level: 'Medium', ask: 'Build a stack, and a queue from two stacks.',
    why: 'A <b>stack</b> is last-in-first-out (push/pop at the end). A <b>queue</b> is first-in-first-out. <code>shift()</code> is O(n), so the two-stack queue reverses the inbox into an outbox only when needed: each item moves once, which is O(1) on average.',
    code: `class Stack {
  #items = [];
  push(x) { this.#items.push(x); return this; }
  pop() { return this.#items.pop(); }
  peek() { return this.#items[this.#items.length - 1]; }
  get size() { return this.#items.length; }
}
class Queue {
  #inbox = [];
  #outbox = [];
  enqueue(x) { this.#inbox.push(x); }
  dequeue() {
    if (!this.#outbox.length) while (this.#inbox.length) this.#outbox.push(this.#inbox.pop());
    return this.#outbox.pop();
  }
}
const s = new Stack().push(1).push(2).push(3);
console.log(s.pop(), s.peek(), s.size);

const q = new Queue();
q.enqueue("a"); q.enqueue("b"); q.enqueue("c");
console.log(q.dequeue(), q.dequeue());
q.enqueue("d");
console.log(q.dequeue(), q.dequeue());`,
  },
  {
    id: 'linkedlist', cat: 'Data structures', title: 'Linked list: append and reverse', level: 'Hard', ask: 'Reverse a singly linked list in place.',
    why: 'Each node points to the next one. To reverse, walk the list once with three pointers (<code>prev</code>, <code>cur</code>, <code>next</code>) and flip each <code>next</code> pointer backwards. That is O(n) time and O(1) extra memory. Watch the objects in the Heap.',
    code: `class ListNode {
  constructor(value, next = null) { this.value = value; this.next = next; }
}
class LinkedList {
  constructor() { this.head = null; }
  append(value) {
    const node = new ListNode(value);
    if (!this.head) { this.head = node; return this; }
    let cur = this.head;
    while (cur.next) cur = cur.next;
    cur.next = node;
    return this;
  }
  reverse() {
    let prev = null, cur = this.head;
    while (cur) {
      const next = cur.next;
      cur.next = prev;
      prev = cur;
      cur = next;
    }
    this.head = prev;
    return this;
  }
  toArray() {
    const out = [];
    for (let n = this.head; n; n = n.next) out.push(n.value);
    return out;
  }
}
const list = new LinkedList().append(1).append(2).append(3);
console.log(list.toArray().join(" -> "));
console.log(list.reverse().toArray().join(" -> "));`,
  },
  {
    id: 'bst', cat: 'Data structures', title: 'Binary search tree', level: 'Hard', ask: 'Insert values, then traverse the tree in order and by level.',
    why: 'In a BST, smaller values go left and bigger ones right. <b>In-order</b> traversal (left, node, right) therefore gives sorted output. <b>Breadth-first</b> traversal uses a queue and visits level by level. The height is 1 + the taller subtree.',
    code: `class TreeNode {
  constructor(v) { this.v = v; this.left = null; this.right = null; }
}
function insert(root, v) {
  if (!root) return new TreeNode(v);
  if (v < root.v) root.left = insert(root.left, v);
  else root.right = insert(root.right, v);
  return root;
}
const inorder = (n, out = []) => {
  if (n) { inorder(n.left, out); out.push(n.v); inorder(n.right, out); }
  return out;
};
const height = n => (n ? 1 + Math.max(height(n.left), height(n.right)) : 0);

let root = null;
for (const v of [8, 3, 10, 1, 6, 14]) root = insert(root, v);
console.log(inorder(root).join(), height(root));

function bfs(start) {
  const out = [], queue = [start];
  while (queue.length) {
    const n = queue.shift();
    out.push(n.v);
    if (n.left) queue.push(n.left);
    if (n.right) queue.push(n.right);
  }
  return out;
}
console.log(bfs(root).join());`,
  },
  {
    id: 'graph', cat: 'Data structures', title: 'Graph: BFS shortest path and DFS', level: 'Hard', ask: 'Find the shortest path from A to F.',
    why: '<b>BFS</b> explores level by level with a queue, so the first time it reaches the goal it has used the fewest edges. <b>DFS</b> goes as deep as possible first (recursion or a stack). A <code>Set</code> of visited nodes prevents infinite loops.',
    code: `const graph = { A: ["B", "C"], B: ["D"], C: ["D", "E"], D: ["F"], E: ["F"], F: [] };

function shortestPath(start, goal) {
  const queue = [[start]], seen = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === goal) return path;
    for (const next of graph[node]) {
      if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
  }
  return null;
}
function dfs(node, seen = new Set()) {
  seen.add(node);
  graph[node].forEach(n => { if (!seen.has(n)) dfs(n, seen); });
  return [...seen];
}
console.log(shortestPath("A", "F").join(" -> "));
console.log(dfs("A").join());`,
  },
  {
    id: 'matrix', cat: 'Data structures', title: 'Matrix: transpose and spiral', level: 'Hard', ask: 'Print a 3×3 matrix in spiral order.',
    why: 'Transpose: row <code>c</code> of the result is column <code>c</code> of the input. Spiral: keep four borders (top, bottom, left, right), walk along each edge, then move that border inwards until they cross.',
    code: `const m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
const transpose = mat => mat[0].map((_, c) => mat.map(row => row[c]));
console.log(JSON.stringify(transpose(m)));

function spiral(mat) {
  const out = [];
  let top = 0, bottom = mat.length - 1, left = 0, right = mat[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) out.push(mat[top][c]);
    top++;
    for (let r = top; r <= bottom; r++) out.push(mat[r][right]);
    right--;
    if (top <= bottom) { for (let c = right; c >= left; c--) out.push(mat[bottom][c]); bottom--; }
    if (left <= right) { for (let r = bottom; r >= top; r--) out.push(mat[r][left]); left++; }
  }
  return out;
}
console.log(spiral(m).join());`,
  },

  // ------------------------------------------------------------ sorting & searching
  {
    id: 'bubblesort', cat: 'Sorting & searching', title: 'Bubble sort', level: 'Easy', ask: 'Implement bubble sort with an early exit.',
    why: 'Repeatedly swap neighbours that are in the wrong order; after each pass the biggest remaining value has "bubbled" to the end. If a pass makes no swaps, the array is sorted. Worst case O(n²).',
    code: `function bubbleSort(input) {
  const a = [...input];
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}
console.log(bubbleSort([5, 1, 4, 2, 8]).join());`,
  },
  {
    id: 'quicksort', cat: 'Sorting & searching', title: 'Quick sort', level: 'Medium', ask: 'Implement quick sort.',
    why: 'Pick a <b>pivot</b>, split the rest into "smaller" and "bigger or equal", sort both parts recursively and join them around the pivot. On average O(n log n). Watch the Call Stack grow with each recursive split.',
    code: `function quickSort(a) {
  if (a.length <= 1) return a;
  const [pivot, ...rest] = a;
  return [
    ...quickSort(rest.filter(x => x < pivot)),
    pivot,
    ...quickSort(rest.filter(x => x >= pivot)),
  ];
}
console.log(quickSort([3, 6, 1, 8, 2, 9, 2]).join());`,
  },
  {
    id: 'mergesort', cat: 'Sorting & searching', title: 'Merge sort', level: 'Medium', ask: 'Implement merge sort.',
    why: 'Split the array in half until each piece has one item, then <b>merge</b> the sorted halves by repeatedly taking the smaller front item. Always O(n log n), and stable (equal items keep their order).',
    code: `function mergeSort(a) {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  const left = mergeSort(a.slice(0, mid));
  const right = mergeSort(a.slice(mid));
  const out = [];
  while (left.length && right.length) out.push(left[0] <= right[0] ? left.shift() : right.shift());
  return [...out, ...left, ...right];
}
console.log(mergeSort([38, 27, 43, 3, 9, 82, 10]).join());`,
  },

  // ------------------------------------------------------------ coding problems (more)
  {
    id: 'kadane', cat: 'Coding problems', title: 'Maximum subarray (Kadane)', level: 'Medium', ask: 'Find the largest sum of a contiguous subarray.',
    why: 'At each item, decide: extend the current run, or start fresh from this item (when the run so far is negative). Track the best sum seen. One pass, O(n).',
    code: `function maxSubarray(nums) {
  let best = nums[0], current = nums[0];
  for (let i = 1; i < nums.length; i++) {
    current = Math.max(nums[i], current + nums[i]);
    best = Math.max(best, current);
  }
  return best;
}
console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]), maxSubarray([-3, -1, -2]));`,
  },
  {
    id: 'longestunique', cat: 'Coding problems', title: 'Longest substring without repeats', level: 'Hard', ask: 'Sliding window: longest run of unique characters.',
    why: 'Keep a <b>window</b> <code>[start, i]</code> with no repeats and a Map of each character\'s last position. When a character repeats inside the window, move <code>start</code> just past its previous position. O(n).',
    code: `function longestUnique(s) {
  const last = new Map();
  let start = 0, best = 0;
  for (let i = 0; i < s.length; i++) {
    if (last.has(s[i]) && last.get(s[i]) >= start) start = last.get(s[i]) + 1;
    last.set(s[i], i);
    best = Math.max(best, i - start + 1);
  }
  return best;
}
console.log(longestUnique("abcabcbb"), longestUnique("bbbbb"), longestUnique("pwwkew"));`,
  },
  {
    id: 'groupanagrams', cat: 'Coding problems', title: 'Group anagrams', level: 'Medium', ask: 'Group words that are anagrams of each other.',
    why: 'Anagrams have the same sorted letters, so use the sorted word as a <b>Map key</b> and collect words per key. A Map keeps the groups in first-seen order.',
    code: `function groupAnagrams(words) {
  const groups = new Map();
  for (const w of words) {
    const key = [...w].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return [...groups.values()];
}
console.log(JSON.stringify(groupAnagrams(["eat", "tea", "tan", "ate", "nat", "bat"])));`,
  },
  {
    id: 'firstunique', cat: 'Coding problems', title: 'First unique / most frequent character', level: 'Easy', ask: 'Find the first non-repeating and the most common character.',
    why: 'Count every character in one pass with an object, then walk the string again and return the first one with count 1. Tracking the best count while counting finds the most frequent one in the same loop.',
    code: `function firstUnique(s) {
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of s) if (count[ch] === 1) return ch;
  return null;
}
function mostFrequent(s) {
  const count = {};
  let best = "";
  for (const ch of s) {
    count[ch] = (count[ch] || 0) + 1;
    if (!best || count[ch] > count[best]) best = ch;
  }
  return best;
}
console.log(firstUnique("swiss"), firstUnique("aabb"), mostFrequent("javascript"));`,
  },
  {
    id: 'missingzeros', cat: 'Coding problems', title: 'Missing number / move zeros', level: 'Easy', ask: 'Find the missing number from 0..n; move zeros to the end.',
    why: 'The numbers 0..n add up to <code>n(n+1)/2</code>, so the missing one is that total minus the actual sum. To move zeros, copy every non-zero forward with a write pointer, then fill the rest with zeros: O(n), in place.',
    code: `const missing = nums => (nums.length * (nums.length + 1)) / 2 - nums.reduce((a, b) => a + b, 0);
console.log(missing([3, 0, 1]), missing([0, 1, 2, 4, 5, 6, 3, 8, 9]));

function moveZeros(nums) {
  let insert = 0;
  for (const n of nums) if (n !== 0) nums[insert++] = n;
  while (insert < nums.length) nums[insert++] = 0;
  return nums;
}
console.log(moveZeros([0, 1, 0, 3, 12]).join());`,
  },
  {
    id: 'primes', cat: 'Coding problems', title: 'Primes and the sieve', level: 'Medium', ask: 'Check a prime; list all primes up to 30.',
    why: 'To test <code>n</code>, you only need divisors up to √n. The <b>Sieve of Eratosthenes</b> marks the multiples of each prime as "not prime", starting at <code>i*i</code>. Whatever stays unmarked is prime.',
    code: `function isPrime(n) {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
function sieve(limit) {
  const prime = Array(limit + 1).fill(true);
  prime[0] = prime[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (prime[i]) for (let j = i * i; j <= limit; j += i) prime[j] = false;
  }
  return prime.map((p, i) => (p ? i : null)).filter(x => x !== null);
}
console.log(isPrime(1), isPrime(17), isPrime(21));
console.log(sieve(30).join());`,
  },
  {
    id: 'numbers', cat: 'Coding problems', title: 'GCD, digits, reverse integer', level: 'Easy', ask: 'Classic number helpers.',
    why: 'Euclid\'s algorithm: <code>gcd(a, b) = gcd(b, a % b)</code> until <code>b</code> is 0, and the LCM is <code>a*b / gcd</code>. For digit tricks, converting to a string and back is the simplest approach. <code>Math.sign</code> keeps the minus sign.',
    code: `const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const lcm = (a, b) => (a * b) / gcd(a, b);
console.log(gcd(48, 18), lcm(4, 6));

const sumDigits = n => String(Math.abs(n)).split("").reduce((s, d) => s + Number(d), 0);
const reverseInt = n => Math.sign(n) * Number(String(Math.abs(n)).split("").reverse().join(""));
console.log(sumDigits(1234), reverseInt(-123), reverseInt(1200));`,
  },
  {
    id: 'stock', cat: 'Coding problems', title: 'Best time to buy and sell', level: 'Easy', ask: 'Maximum profit from one buy and one sell.',
    why: 'Walk through the prices once, remembering the <b>lowest price so far</b>. Selling today would earn <code>price - min</code>; keep the best of those. O(n) instead of trying every pair.',
    code: `function maxProfit(prices) {
  let minPrice = Infinity, best = 0;
  for (const p of prices) {
    minPrice = Math.min(minPrice, p);
    best = Math.max(best, p - minPrice);
  }
  return best;
}
console.log(maxProfit([7, 1, 5, 3, 6, 4]), maxProfit([7, 6, 4, 3, 1]));`,
  },
  {
    id: 'intervals', cat: 'Coding problems', title: 'Merge overlapping intervals', level: 'Medium', ask: 'Merge [[8,10],[1,3],[2,6],[15,18]].',
    why: 'Sort by start time. Then each interval either overlaps the last merged one (start ≤ last end: extend its end) or starts a new group. O(n log n) because of the sort.',
    code: `function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0]];
  for (const [start, end] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}
console.log(JSON.stringify(mergeIntervals([[8, 10], [1, 3], [2, 6], [15, 18]])));`,
  },
  {
    id: 'stairs', cat: 'Coding problems', title: 'Climbing stairs (dynamic programming)', level: 'Medium', ask: 'How many ways to climb n stairs taking 1 or 2 steps?',
    why: 'The ways to reach step n are the ways to reach n-1 plus the ways to reach n-2: it is Fibonacci. Memoization (top-down) or two variables in a loop (bottom-up) avoid recomputing, giving O(n).',
    code: `function climbStairs(n) {
  let one = 1, two = 1;
  for (let i = 2; i <= n; i++) [one, two] = [one + two, one];
  return one;
}
const memo = {};
function ways(n) {
  if (n <= 1) return 1;
  if (memo[n]) return memo[n];
  return (memo[n] = ways(n - 1) + ways(n - 2));
}
console.log(climbStairs(5), ways(5), climbStairs(10));`,
  },
  {
    id: 'permutations', cat: 'Coding problems', title: 'Permutations and subsets', level: 'Hard', ask: 'List all permutations of "abc" and all subsets of [1,2,3].',
    why: 'Permutations: pick each character as the first one, then recursively permute the rest (n! results). Subsets: start with <code>[[]]</code> and, for each item, add a copy of every existing subset with that item (2<sup>n</sup> results).',
    code: `function permutations(str) {
  if (str.length <= 1) return [str];
  const out = [];
  for (let i = 0; i < str.length; i++) {
    for (const p of permutations(str.slice(0, i) + str.slice(i + 1))) out.push(str[i] + p);
  }
  return out;
}
const subsets = arr => arr.reduce((all, x) => all.concat(all.map(s => [...s, x])), [[]]);

console.log(permutations("abc").join());
console.log(JSON.stringify(subsets([1, 2, 3])));`,
  },
  {
    id: 'wordtricks', cat: 'Coding problems', title: 'Reverse words, vowels, pangram', level: 'Easy', ask: 'Three quick string problems.',
    why: '<code>split(/\\s+/)</code> splits on runs of whitespace. <code>match</code> with a global, case-insensitive regex finds every vowel (and returns <code>null</code> when there are none, hence <code>|| []</code>). A pangram has 26 distinct letters, which a Set counts.',
    code: `const reverseWords = s => s.trim().split(/\\s+/).reverse().join(" ");
const countVowels = s => (s.match(/[aeiou]/gi) || []).length;
const isPangram = s => new Set(s.toLowerCase().replace(/[^a-z]/g, "")).size === 26;

console.log(reverseWords("  the sky   is blue "));
console.log(countVowels("Hello World"), countVowels("xyz"));
console.log(isPangram("The quick brown fox jumps over the lazy dog"));`,
  },
  {
    id: 'deepsum', cat: 'Coding problems', title: 'Recursion on nested data', level: 'Medium', ask: 'Sum every number in a nested structure.',
    why: 'Recursion handles data of any depth: arrays and objects call the function again on their contents, and plain values are the <b>base case</b>. <code>countdown</code> builds its result while the calls return.',
    code: `function deepSum(value) {
  if (Array.isArray(value)) return value.reduce((s, v) => s + deepSum(v), 0);
  if (value && typeof value === "object") return deepSum(Object.values(value));
  return typeof value === "number" ? value : 0;
}
console.log(deepSum([1, [2, { a: 3, b: [4, "x"] }], 5]));

function countdown(n) {
  if (n === 0) return ["liftoff"];
  return [n, ...countdown(n - 1)];
}
console.log(countdown(3).join(" "));`,
  },

  // ------------------------------------------------------------ browser & DOM
  {
    id: 'bubbling', cat: 'Browser & DOM', title: 'Event bubbling and stopPropagation', level: 'Medium', ask: 'In what order do the listeners run?',
    why: 'A click travels <b>down</b> from the window to the target (the capture phase, for listeners added with <code>true</code>), then <b>bubbles back up</b> through every parent. <code>e.target</code> is the element that was clicked. <code>stopPropagation()</code> stops the bubbling, so the outer bubble listener no longer runs.',
    expect: ['outer: capture', 'button: target', 'outer: bubble, target = btn', '--- with stopPropagation ---', 'outer: capture', 'button: target'],
    code: `// @file index.html
<div id="outer"><button id="btn">Click me</button></div>

// @file main.js
const outer = document.getElementById("outer");
const btn = document.getElementById("btn");
outer.addEventListener("click", () => console.log("outer: capture"), true);
outer.addEventListener("click", e => console.log("outer: bubble, target =", e.target.id));
btn.addEventListener("click", () => console.log("button: target"));
btn.click();

btn.addEventListener("click", e => e.stopPropagation());
console.log("--- with stopPropagation ---");
btn.click();`,
  },
  {
    id: 'delegation', cat: 'Browser & DOM', title: 'Event delegation', level: 'Medium', ask: 'Why does the item added later still react to clicks?',
    why: 'One listener on the <b>parent</b> handles clicks for all its children, because clicks bubble up. <code>e.target</code> tells you which item was clicked. It works for items added later and saves a listener per item.',
    expect: ['clicked Added later -> done', 'clicked Learn JS -> done'],
    code: `// @file index.html
<ul id="todos"><li>Learn JS</li><li>Build app</li></ul>

// @file main.js
const list = document.getElementById("todos");
list.addEventListener("click", e => {
  if (e.target.tagName === "LI") {
    e.target.classList.toggle("done");
    console.log("clicked", e.target.textContent, "->", e.target.className);
  }
});
const li = document.createElement("li");
li.textContent = "Added later";
list.appendChild(li);
simulateClick("#todos li:last-child", 10);
simulateClick("#todos li:first-child", 20);`,
  },
  {
    id: 'storage', cat: 'Browser & DOM', title: 'localStorage only stores strings', level: 'Easy', ask: 'What type does getItem return?',
    why: 'Everything is converted to a <b>string</b>: the number 5 becomes "5" (so <code>+ 1</code> joins), and an object becomes "[object Object]". Store objects with <code>JSON.stringify</code> and read them with <code>JSON.parse</code>. A missing key gives <code>null</code>.',
    expect: ['string 51 6', '[object Object]', 'Ada null'],
    code: `localStorage.setItem("count", 5);
const raw = localStorage.getItem("count");
console.log(typeof raw, raw + 1, Number(raw) + 1);

localStorage.setItem("user", { name: "Ada" });
console.log(localStorage.getItem("user"));

localStorage.setItem("user", JSON.stringify({ name: "Ada" }));
console.log(JSON.parse(localStorage.getItem("user")).name, localStorage.getItem("missing"));
localStorage.clear();`,
  },
  {
    id: 'fetchawait', cat: 'Browser & DOM', title: 'fetch with error handling', level: 'Medium', ask: 'Why do we check res.ok?',
    why: '<code>fetch</code> only rejects when there is <b>no response</b> (offline, CORS). A 404 or 500 is still a response, so check <code>res.ok</code> (or <code>res.status</code>) and throw yourself. <code>res.json()</code> is async too.',
    code: `async function loadUser(id) {
  try {
    const res = await fetch("/api/users/" + id);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const user = await res.json();
    return user.name;
  } catch (e) {
    return "failed: " + e.message;
  }
}
loadUser(1).then(name => console.log(name));
loadUser(99).then(name => console.log(name));
console.log("requests sent");`,
  },

  // ------------------------------------------------------------ Node.js
  {
    id: 'nodeorder', cat: 'Node.js', title: 'nextTick, promises, timers, setImmediate', level: 'Hard', ask: 'Predict the order in Node.js.',
    why: 'After the script, Node empties the <b>nextTick queue</b> first, then the <b>promise microtasks</b>. Then the event loop runs its phases: <b>timers</b> (setTimeout) and later <b>check</b> (setImmediate). (In the main script the timeout/immediate order can vary in real Node; inside an I/O callback setImmediate always comes first.)',
    expect: ['1 sync', '2 sync', '3 nextTick', '4 promise', '4b microtask', '5 timeout', '6 immediate'],
    code: `// @env node
console.log("1 sync");
setTimeout(() => console.log("5 timeout"), 0);
setImmediate(() => console.log("6 immediate"));
Promise.resolve().then(() => console.log("4 promise"));
process.nextTick(() => console.log("3 nextTick"));
queueMicrotask(() => console.log("4b microtask"));
console.log("2 sync");`,
  },
  {
    id: 'nodeio', cat: 'Node.js', title: 'setImmediate vs setTimeout inside I/O', level: 'Hard', ask: 'Which runs first inside a readFile callback?',
    why: 'The file callback runs in the <b>poll</b> phase. The next phase is <b>check</b>, so <code>setImmediate</code> runs before the loop comes back round to the <b>timers</b> phase. Inside I/O callbacks this order is guaranteed.',
    expect: ['file read', 'immediate', 'timeout'],
    code: `// @env node
const fs = require("fs");
fs.readFile("package.json", "utf8", () => {
  console.log("file read");
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});`,
  },
  {
    id: 'nodepath', cat: 'Node.js', title: 'path module', level: 'Easy', ask: 'What do join, extname and resolve return?',
    why: '<code>path.join</code> joins segments and resolves <code>..</code>. <code>extname</code> returns the <b>last</b> extension. <code>resolve</code> builds an absolute path from the current working directory. Use them instead of joining strings by hand, so code works on every OS.',
    expect: ['/users/bob/file.txt', '.png report', '/home/user/app/src/index.js'],
    code: `// @env node
const path = require("path");
console.log(path.join("/users", "ada", "..", "bob", "file.txt"));
console.log(path.extname("photo.final.png"), path.basename("/a/b/report.pdf", ".pdf"));
console.log(path.resolve("src", "index.js"));`,
  },
  {
    id: 'nodeemitter', cat: 'Node.js', title: 'EventEmitter on and once', level: 'Easy', ask: 'How many times does each listener run?',
    why: '<code>on</code> listens every time; <code>once</code> removes itself after the first event. <code>emit</code> calls the listeners <b>synchronously</b>, in the order they were added, before the next line runs.',
    expect: ['listener got 1', 'once got 1', 'listener got 2', 'after emits'],
    code: `// @env node
const EventEmitter = require("events");
const bus = new EventEmitter();
bus.on("order", id => console.log("listener got", id));
bus.once("order", id => console.log("once got", id));
bus.emit("order", 1);
bus.emit("order", 2);
console.log("after emits");`,
  },

  // ------------------------------------------------------------ modules
  {
    id: 'esmodules', cat: 'Modules', title: 'ES modules: hoisting and live bindings', level: 'Hard', ask: 'Which file logs first, and does count update?',
    why: '<code>import</code> statements are <b>hoisted</b>: imported modules run before any line of the importing file. Imports are <b>live bindings</b>, not copies, so after <code>increment()</code> you see the new value. They are read-only: assigning to an import throws.',
    expect: ['counter.js runs first', 'main.js body', 'default export 0', 'after increment: 1', 'TypeError'],
    code: `// @file counter.js
console.log("counter.js runs first");
export let count = 0;
export function increment() { count++; }
export default "default export";

// @file main.js
console.log("main.js body");
import label, { count, increment } from "./counter.js";
console.log(label, count);
increment();
console.log("after increment:", count);
try { count = 10; } catch (e) { console.log(e.name); }`,
  },

  // ------------------------------------------------------------ memory
  {
    id: 'weakvsstrong', cat: 'Memory & performance', title: 'Map keeps objects alive', level: 'Medium', ask: 'After user = null, can the object be garbage-collected?',
    why: 'Not while the <code>Map</code> holds it: a Map key is a <b>strong</b> reference, so the object stays in memory (a classic leak in caches). A <code>WeakMap</code> key doesn\'t keep it alive. Turn on the <b>GC view</b> in the Heap panel to see what is still reachable.',
    code: `let user = { name: "Ada" };
const strong = new Map([[user, "metadata"]]);
const weak = new WeakMap();
weak.set(user, "metadata");
user = null;
console.log(strong.size, [...strong.keys()][0].name);
console.log("the Map still holds the object; the WeakMap would let it go");`,
  },
  {
    id: 'closureleak', cat: 'Memory & performance', title: 'Closures that keep big data alive', level: 'Medium', ask: 'Why is bigData still in memory?',
    why: 'The returned function uses <code>bigData</code>, so its closure keeps the whole array alive as long as the function exists. Keep only what you need (here, just the length), or drop the reference (<code>handler = null</code>) when you are done.',
    code: `function createHandler() {
  const bigData = new Array(1000).fill("x");
  return () => bigData.length;
}
function createLeanHandler() {
  const bigData = new Array(1000).fill("x");
  const size = bigData.length;
  return () => size;
}
let handler = createHandler();
const lean = createLeanHandler();
console.log(handler(), lean());
handler = null;
console.log("handler released");`,
  },
);
