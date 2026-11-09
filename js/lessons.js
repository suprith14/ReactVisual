/*
 * Lessons and "predict the output" quizzes, one per level.
 * lesson: short explanation (HTML). quiz: question shown BEFORE the code runs.
 */
window.JS_LESSONS = {
  hoisting: {
    lesson: `<p>Before JavaScript runs your code it does a quick <b>creation phase</b>: it reads the whole file and makes a memory slot for every declaration. Moving declarations "to the top" like this is called <b>hoisting</b>.</p>
<ul><li><code>var x</code> → the slot is created and set to <code>undefined</code>.</li>
<li><code>function f() {}</code> → the <b>whole function</b> is stored, so you can call it before its line.</li>
<li><code>let</code> / <code>const</code> / <code>class</code> → the slot exists but is <b>uninitialized</b> (see the TDZ level).</li></ul>
<pre>sayHi();            // works!
function sayHi() { console.log("hi"); }
console.log(n);     // undefined, not an error
var n = 5;</pre>
<p class="tip">⚠️ Common mistake: thinking <code>var</code> values are hoisted. Only the <i>name</i> is hoisted; the value arrives when its line runs.</p>`,
    quiz: { q: 'What does the first <code>console.log(greeting)</code> print?', options: ['"Hello"', 'undefined', 'ReferenceError', 'null'], answer: 1, why: '<code>var greeting</code> is hoisted with the value <code>undefined</code>. The string "Hello" is only stored when line 4 runs.' },
  },
  callstack: {
    lesson: `<p>Every time a function is called, JavaScript creates an <b>Execution Context</b>: a box holding that call's own variables, its parameters and its <code>this</code>. The box is <b>pushed</b> on the <b>Call Stack</b>.</p>
<ul><li>Only the <b>top</b> box runs. The others wait.</li>
<li>When a function <code>return</code>s, its box is <b>popped</b> and the one below continues exactly where it paused.</li>
<li>This is "last in, first out", like a stack of plates.</li></ul>
<pre>function a() { b(); }   // a waits while b runs
function b() { return 1; }
a();</pre>
<p class="tip">💡 A "Maximum call stack size exceeded" error means boxes were pushed forever, usually recursion with no stopping point.</p>`,
    quiz: { q: 'When <code>multiply</code> is running, how many Execution Contexts are on the Call Stack?', options: ['1', '2', '3', '4'], answer: 3, why: 'Global → printSquare() → square() → multiply(). Four boxes, with multiply on top.' },
  },
  scope: {
    lesson: `<p><b>Scope</b> means "where can this variable be seen?". JavaScript uses <b>lexical scope</b>: what matters is where a function is <i>written</i>, not where it is called.</p>
<ul><li>A function can see its own variables plus every variable of the functions around it, all the way out to Global.</li>
<li>When a name isn't found locally, JS climbs this <b>scope chain</b> outward, one level at a time.</li>
<li>Outer code can <b>never</b> look inside an inner function.</li></ul>
<pre>const a = 1;
function outer() { const b = 2;
  function inner() { console.log(a, b); } // sees both
  inner(); }</pre>`,
    quiz: { q: 'Where does <code>inner()</code> find the variable <code>planet</code>?', options: ["In inner()'s own memory", "In outer()'s memory", 'In the Global memory', "It can't find it, so it's an error"], answer: 2, why: "planet isn't in inner() or outer(), so JS climbs the scope chain all the way to Global." },
  },
  tdz: {
    lesson: `<p><code>var</code> belongs to the whole <b>function</b> and ignores <code>{ }</code> blocks. <code>let</code> and <code>const</code> belong only to the <b>block</b> (the nearest <code>{ }</code>) they are written in.</p>
<ul><li><code>let</code>/<code>const</code> are hoisted too, but stay <b>uninitialized</b> until their line runs. That gap is the <b>Temporal Dead Zone (TDZ)</b>.</li>
<li>Touching them in the TDZ throws <code>ReferenceError: Cannot access 'x' before initialization</code>.</li>
<li><code>const</code> can't be reassigned, but an object inside it can still change.</li></ul>
<pre>{ let x = 1; }  console.log(x); // ❌ x only lives in the block
const list = []; list.push(1);   // ✅ allowed (same array)</pre>
<p class="tip">✅ Modern rule: use <code>const</code> by default, <code>let</code> when you must reassign, and avoid <code>var</code>.</p>`,
    quiz: { q: 'What does the <b>second</b> <code>console.log(a, b, c)</code> print?', options: ['10 20 3', '1 2 3', '10 2 3', '1 20 3'], answer: 2, why: 'The block wrote to the <b>same</b> <code>var a</code> (now 10), but <code>let b = 20</code> was a separate block-only variable. Outside the block, b is still 2.' },
  },
  closure: {
    lesson: `<p>A <b>closure</b> is a function together with the variables from the place it was created. Even after the outer function has <b>finished</b>, the inner function keeps those variables alive, like carrying a 🎒 backpack.</p>
<ul><li>Each call of the outer function makes a <b>new</b> backpack.</li>
<li>The variables are not copies: changes stay in the backpack for the next call.</li>
<li>Closures are how you make private state, counters, "once" functions and event handlers.</li></ul>
<pre>function makeCounter() { let n = 0; return () => ++n; }
const c = makeCounter(); c(); c(); // 2</pre>`,
    quiz: { q: 'What do the three <code>console.log(counter())</code> lines print?', options: ['1 1 1', '0 1 2', '1 2 3', 'undefined ×3'], answer: 2, why: "count lives in makeCounter's closure backpack. Each call adds 1 to the same variable." },
  },
  loops: {
    lesson: `<p>A <code>for</code> loop has three parts: <b>setup</b> (runs once), <b>check</b> (runs before every round) and <b>update</b> (runs after every round).</p>
<pre>for (let i = 0; i &lt; 3; i++) { /* body */ }
for (const item of array) { }     // values of an array / string / Map / Set
for (const key in object) { }     // keys of an object
while (condition) { }             // repeat while true</pre>
<ul><li><code>break</code> leaves the loop. <code>continue</code> jumps to the next round.</li>
<li>With <code>let</code>, every round gets a fresh copy of <code>i</code>.</li></ul>
<p class="tip">⚠️ Off-by-one errors are the #1 loop bug: is it <code>&lt;</code> or <code>&lt;=</code>?</p>`,
    quiz: { q: 'How many times is the check <code>i &lt; fruits.length</code> evaluated?', options: ['2', '3', '4', 'Infinite'], answer: 2, why: 'It is true for i = 0, 1 and 2, then false for i = 3. That is 4 checks, and the 4th one stops the loop.' },
  },
  references: {
    lesson: `<p><b>Primitives</b> (numbers, strings, booleans, null, undefined, symbols, bigints) are copied by <b>value</b>. <b>Objects</b> (including arrays and functions) live in the <b>Heap</b>, and variables only hold a <b>reference</b> (an arrow) to them.</p>
<ul><li><code>const b = a</code> with an object copies the <b>arrow</b>, so both names point to the same object.</li>
<li><code>===</code> on objects asks "same object?", not "same contents?".</li>
<li>To really copy an object: <code>{ ...obj }</code> or <code>structuredClone(obj)</code>.</li></ul>
<pre>const a = { n: 1 }; const b = a; b.n = 2; // a.n is 2 too!
{ n: 1 } === { n: 1 }                   // false</pre>`,
    quiz: { q: 'What does <code>console.log(hero.level)</code> print?', options: ['1', '99', 'undefined', 'Error: hero is const'], answer: 1, why: 'sameHero and hero hold the same reference (#1). Changing the object through one name changes it for both. <code>const</code> only stops reassigning the variable.' },
  },
  this: {
    lesson: `<p><code>this</code> is decided by <b>how a function is called</b>, not where it is written:</p>
<ul><li><code>obj.method()</code> → <code>this</code> is <code>obj</code> (the thing before the dot).</li>
<li>a plain call <code>fn()</code> → <code>window</code> (or <code>undefined</code> in strict mode).</li>
<li><code>new Fn()</code> → the brand-new object.</li>
<li><code>fn.call(x)</code>, <code>fn.apply(x)</code>, <code>fn.bind(x)</code> → <code>x</code>.</li>
<li><b>Arrow functions</b> have no own <code>this</code>: they borrow it from where they were created.</li></ul>
<pre>const f = player.hit; f(30); // ❌ this is no longer player!</pre>`,
    quiz: { q: 'Inside <code>player.hit(30)</code>, what is <code>this</code>?', options: ['window', 'the player object', 'the hit function', 'undefined'], answer: 1, why: '<code>player</code> is in front of the dot, so <code>this === player</code>.' },
  },
  recursion: {
    lesson: `<p>A <b>recursive</b> function calls itself on a smaller problem. Every call gets its own Execution Context, so the stack grows like a tower, then unwinds as each call returns.</p>
<ul><li>You always need a <b>base case</b> that stops the recursion (here <code>n &lt;= 1</code>).</li>
<li>Each step must move <b>toward</b> the base case (<code>n - 1</code>).</li></ul>
<pre>function countdown(n) { if (n === 0) return; console.log(n); countdown(n - 1); }</pre>
<p class="tip">⚠️ Forget the base case and you get "Maximum call stack size exceeded".</p>`,
    quiz: { q: 'What is the most <code>factorial</code> contexts on the stack at the same time?', options: ['1', '2', '4', '24'], answer: 2, why: 'factorial(4) → (3) → (2) → (1). That is 4 contexts stacked before the first one returns.' },
  },
  callbacks: {
    lesson: `<p>A <b>callback</b> is a function you pass to another function, so <i>it</i> can call yours later. <code>map</code>, <code>filter</code>, <code>forEach</code>, <code>reduce</code>, <code>find</code> and <code>sort</code> all take callbacks.</p>
<pre>[1, 2, 3].map(n => n * 2)          // [2, 4, 6]  (new array)
[1, 2, 3].filter(n => n > 1)       // [2, 3]     (keep if true)
[1, 2, 3].reduce((sum, n) => sum + n, 0) // 6   (combine)
[1, 2, 3].forEach(n => console.log(n))  // just run it</pre>
<ul><li><code>map</code>/<code>filter</code> return a <b>new</b> array and don't change the old one.</li>
<li>An arrow with no <code>{ }</code> returns its expression automatically.</li></ul>`,
    quiz: { q: 'What does <code>console.log(big)</code> print?', options: ['[3, 4]', '[6, 8]', '[2, 4, 6, 8]', '[5, 6, 7, 8]'], answer: 1, why: 'doubled is [2, 4, 6, 8]. Keeping only the values greater than 4 leaves [6, 8].' },
  },
  eventloop: {
    lesson: `<p>JavaScript has <b>one</b> Call Stack, so it does one thing at a time. Slow jobs (timers, network, clicks) are handed to the browser's <b>Web APIs</b>.</p>
<ol><li><code>setTimeout(cb, ms)</code> gives <code>cb</code> to the browser and JS moves on immediately.</li>
<li>When the timer ends, <code>cb</code> waits in the <b>Callback Queue</b>.</li>
<li>The <b>Event Loop</b> moves it onto the stack <b>only when the stack is empty</b>.</li></ol>
<p class="tip">💡 That's why <code>setTimeout(fn, 0)</code> still runs <i>after</i> all the normal code: "0ms" means "as soon as possible", not "right now".</p>`,
    quiz: { q: 'In what order are the lines printed?', options: ['1, 4, 5, 2, 3', '1, 2, 3, 4, 5', '1, 4, 2, 3, 5', '4, 5, 1, 2, 3'], answer: 1, why: 'All synchronous code (1, 2, 3) runs first. Timer callbacks only get the stack after it is empty: A (0ms), then B (1000ms).' },
  },
  varlet: {
    lesson: `<p>This famous puzzle combines <b>closures</b>, <b>scope</b> and the <b>event loop</b>.</p>
<ul><li>With <code>var</code> there is <b>one</b> <code>i</code> for the whole loop. By the time the timers run, the loop has finished and <code>i</code> is 4.</li>
<li>With <code>let</code> each round gets a <b>new</b> <code>j</code>, so each arrow function's closure remembers its own value.</li></ul>
<p class="tip">✅ Use <code>let</code> in loops. This exact bug used to be very common.</p>`,
    quiz: { q: 'What do the three <code>var</code> timers print?', options: ['1, 2, 3', '4, 4, 4', '3, 3, 3', '0, 1, 2'], answer: 1, why: 'All three arrows share the same var i. The loop finishes (i = 4) long before any timer runs.' },
  },
  microtasks: {
    lesson: `<p>There are <b>two</b> waiting lines:</p>
<ul><li>⚡ <b>Microtask Queue</b>: Promise callbacks (<code>.then</code>, <code>await</code>, <code>queueMicrotask</code>).</li>
<li>📥 <b>Callback Queue</b> (task queue): timers, clicks, network responses.</li></ul>
<p>Every time the stack empties, the Event Loop runs <b>all</b> microtasks, including new ones added along the way, before it takes <b>one</b> task.</p>
<p class="tip">💡 Order to remember: synchronous code → all microtasks → one task → all microtasks → …</p>`,
    quiz: { q: 'Which runs first: the first <code>.then</code> or the 0ms <code>setTimeout</code>?', options: ['The setTimeout', 'The .then', 'They run at the same time', 'It is random'], answer: 1, why: 'Promise callbacks are microtasks, and the Microtask Queue is always emptied before the Callback Queue.' },
  },
  promises: {
    lesson: `<p>A <b>Promise</b> is an object for a value that will arrive later. It is always in one of three states: <b>pending</b> → <b>fulfilled</b> (with a value) or <b>rejected</b> (with an error). It can settle only once.</p>
<pre>const p = new Promise((resolve, reject) => {
  // the executor runs RIGHT AWAY
  setTimeout(() => resolve("done"), 1000);
});
p.then(value => ...)     // runs when fulfilled
 .catch(err => ...)      // runs when rejected
 .finally(() => ...);    // runs either way</pre>
<ul><li><code>.then</code> returns a <b>new</b> promise, which is why you can chain them.</li>
<li>Returning a value from <code>.then</code> passes it to the next <code>.then</code>.</li></ul>`,
    quiz: { q: 'What is printed first?', options: ['"Got: cheese pizza 🍕"', '"Kitchen starts on cheese"', '"Oops: …"', 'Nothing until 1 second has passed'], answer: 1, why: 'The function you pass to <code>new Promise</code> runs immediately (synchronously). Only resolve/reject happen later.' },
  },
  asyncawait: {
    lesson: `<p><code>async</code>/<code>await</code> is a nicer way to write promise code:</p>
<ul><li>An <code>async</code> function <b>always returns a Promise</b>.</li>
<li><code>await p</code> <b>pauses only this function</b> until <code>p</code> settles, and the rest of the program keeps running.</li>
<li>When it resumes, <code>await</code> gives you the value, or <b>throws</b> if the promise was rejected.</li></ul>
<pre>async function load() {
  const data = await getData();  // pause here
  return data.length;            // resolves load()'s promise
}</pre>
<p class="tip">⚠️ <code>await</code> doesn't block the browser. It only parks the async function and takes it off the Call Stack.</p>`,
    quiz: { q: 'Which line prints right after "2. Boil the water..."?', options: ['"4. Water boiled, add tea"', '"3. I\'m not blocked!"', '"5. Ready: 🍵"', '"1. Start"'], answer: 1, why: 'At <code>await</code>, makeTea() pauses and leaves the stack, so the global code continues with line 3.' },
  },
  asyncerrors: {
    lesson: `<p>If an awaited promise <b>rejects</b>, <code>await</code> throws an error at that line. So normal <code>try/catch/finally</code> works with async code:</p>
<pre>async function safe() {
  try { const r = await risky(); }
  catch (err) { console.log("failed:", err.message); }
  finally { console.log("always runs"); }
}</pre>
<ul><li>No try/catch? The async function's own promise rejects. If nobody handles it, you get <b>"Uncaught (in promise)"</b>.</li></ul>`,
    quiz: { q: 'What happens for <code>showUser(2)</code>?', options: ['The program crashes', '"Error: User 2 not found", then "Done with user 2"', 'Only "Done with user 2"', '"Found: undefined"'], answer: 1, why: 'The rejected promise makes <code>await</code> throw, the catch block prints the message, and finally always runs.' },
  },
  classes: {
    lesson: `<p>A <code>class</code> is a blueprint for objects. Under the hood it is a <b>constructor function</b> plus a <b>prototype</b> object that holds the shared methods.</p>
<pre>class Animal {
  constructor(name) { this.name = name; } // runs on "new"
  speak() { return this.name + "..."; }   // on Animal.prototype
}
class Dog extends Animal {
  constructor(name) { super(name); }      // parent first!
  speak() { return super.speak() + " woof"; }
}</pre>
<ul><li><code>new</code> creates an object linked to the prototype, then runs the constructor.</li>
<li><code>extends</code> links prototypes into a <b>prototype chain</b>. Missing methods are looked up one link higher.</li>
<li>In a child class, call <code>super()</code> <b>before</b> using <code>this</code>.</li></ul>`,
    quiz: { q: 'Where is the method <code>speak</code> stored?', options: ['Inside every Dog object', 'On Dog.prototype (and Animal.prototype)', 'In the Global memory', 'On the rex variable'], answer: 1, why: 'Methods live once on the prototype and every instance shares them. That is why rex itself only shows name and trick in the Heap.' },
  },
  privacy: {
    lesson: `<ul><li><code>#field</code>: <b>private</b>. Only code inside the class can read it, and the name is a syntax error elsewhere.</li>
<li><code>get prop()</code>: runs code when the property is <b>read</b> (looks like a normal property).</li>
<li><code>set prop(v)</code>: runs code when the property is <b>assigned</b>.</li>
<li><code>static</code>: belongs to the class itself (<code>BankAccount.bank</code>), not to instances.</li>
<li>Returning <code>this</code> from a method allows <b>chaining</b>: <code>acc.deposit(5).deposit(10)</code>.</li></ul>`,
    quiz: { q: 'What does <code>acc.balance = 1000000</code> do?', options: ['Sets the balance to $1000000', 'Calls the setter, which only prints "Nope! Use deposit()"', 'Throws an error', 'Creates a new property'], answer: 1, why: 'Assigning to a property with a setter runs the setter function. Here it refuses to change #balance.' },
  },
  generators: {
    lesson: `<p>A <b>generator</b> (<code>function*</code>) is a function that can <b>pause</b>. Calling it doesn't run the body. It returns a generator object.</p>
<ul><li>Each <code>.next()</code> runs the body until the next <code>yield</code>, then pauses and returns <code>{ value, done: false }</code>.</li>
<li>Its local variables are kept between pauses.</li>
<li>When the body ends you get <code>{ value: undefined, done: true }</code>.</li>
<li><code>yield</code> can also <b>receive</b> a value: <code>const x = yield 1;</code> gets whatever you pass to <code>.next(x)</code>.</li></ul>
<p class="tip">💡 Generators make infinite or lazy sequences easy, because values are computed only when asked for.</p>`,
    quiz: { q: 'The generator has <code>while (true)</code>. Why doesn\'t it freeze?', options: ['JavaScript stops it after 3 rounds', 'It pauses at every yield until .next() is called again', 'while(true) is ignored in generators', 'It runs in the background'], answer: 1, why: 'Each .next() runs only until the next yield, so the loop advances one step at a time.' },
  },
  iterators: {
    lesson: `<p>The <b>iteration protocol</b> is how <code>for…of</code>, spread <code>...</code> and destructuring work. An object is <b>iterable</b> if it has a <code>[Symbol.iterator]()</code> method returning an <b>iterator</b>: an object with <code>next()</code> that returns <code>{ value, done }</code>.</p>
<pre>const range = {
  *[Symbol.iterator]() { yield 1; yield 2; } // easiest: a generator
};
[...range]  // [1, 2]</pre>
<p>Arrays, strings, Maps and Sets are already iterable. Plain objects are not, so use <code>Object.entries(obj)</code>.</p>`,
    quiz: { q: 'What does <code>[...new Countdown(2)]</code> become?', options: ['[2, 1]', '[1, 2]', '[2, 1, 0]', 'An error: objects are not iterable'], answer: 0, why: 'Spread calls the [Symbol.iterator] generator, which yields 2 then 1 and then stops.' },
  },
  asyncgen: {
    lesson: `<p>An <b>async generator</b> (<code>async function*</code>) can both <code>await</code> and <code>yield</code>, so it produces values <b>over time</b>, like a stream. Each <code>.next()</code> returns a <b>Promise</b> of <code>{ value, done }</code>.</p>
<pre>for await (const msg of stream()) { ... } // waits for each value</pre>
<p><code>for await</code> also works on an array of promises, waiting for each in order.</p>`,
    quiz: { q: 'How long until "Stream ended" prints?', options: ['Immediately', 'About 500ms', 'About 1000ms', 'Never'], answer: 2, why: 'There are two <code>await wait(500)</code> pauses, so about 1 second in total.' },
  },
  mapset: {
    lesson: `<ul><li><b>Set</b>: a collection of <b>unique</b> values. <code>add</code>, <code>has</code>, <code>delete</code>, <code>size</code>. Great for removing duplicates: <code>[...new Set(arr)]</code>.</li>
<li><b>Map</b>: key → value pairs where <b>any</b> value can be a key (even objects). <code>set</code>, <code>get</code>, <code>has</code>, <code>delete</code>, <code>size</code>. It remembers insertion order.</li></ul>
<pre>const m = new Map(); m.set("a", 1).set("b", 2);
for (const [key, value] of m) { }</pre>
<p class="tip">💡 Use a Map instead of an object when keys are not simple strings, or when you add and remove keys often.</p>`,
    quiz: { q: 'What is <code>unique.size</code>?', options: ['6', '3', '2', '4'], answer: 1, why: 'A Set drops duplicates. The only distinct values are 🍕, 🍔 and 🌮.' },
  },
  regex: {
    lesson: `<p>A <b>regular expression</b> is a pattern for matching text: <code>/pattern/flags</code>.</p>
<ul><li><code>\\d</code> digit, <code>\\w</code> letter/digit/_, <code>\\s</code> space, <code>.</code> any character</li>
<li><code>+</code> one or more, <code>*</code> zero or more, <code>?</code> optional, <code>{3}</code> exactly 3</li>
<li><code>( )</code> capture group (available as <code>$1</code> in replace), <code>^</code> start, <code>$</code> end</li>
<li>flags: <code>g</code> all matches, <code>i</code> ignore case</li></ul>
<pre>/^\\w+@\\w+\\.\\w+$/.test("a@b.com")       // true
"2024-01-05".replace(/(\\d+)-(\\d+)-(\\d+)/, "$3/$2/$1")</pre>`,
    quiz: { q: 'What does <code>text.replace(phone, "$1-XXXX")</code> give?', options: ['"Call 555-XXXX or 555-XXXX"', '"Call XXXX or XXXX"', '"Call 555-XXXX or 555-9876"', '"Call $1-XXXX or $1-XXXX"'], answer: 0, why: 'The g flag replaces every match, and $1 inserts the first group (555).' },
  },
  interval: {
    lesson: `<p><code>setInterval(fn, ms)</code> asks the browser to queue <code>fn</code> <b>every</b> <code>ms</code> milliseconds until you call <code>clearInterval(id)</code>.</p>
<ul><li>Keep the id it returns, or you can never stop it.</li>
<li>Like every timer, the callback only runs when the Call Stack is free.</li></ul>
<p class="tip">💡 For animations, <code>requestAnimationFrame</code> is better: it runs right before each screen repaint.</p>`,
    quiz: { q: 'What prints first?', options: ['"3..."', '"Countdown started"', '"🚀 Liftoff!"', '"0..."'], answer: 1, why: 'setInterval only schedules. The synchronous console.log runs first, and the first tick happens after 1000ms.' },
  },
  strict: {
    lesson: `<p><code>"use strict"</code> at the top of a file or function turns on <b>strict mode</b>, which turns silent mistakes into errors:</p>
<ul><li>Assigning to an undeclared variable → <code>ReferenceError</code> (no accidental globals from typos).</li>
<li>Writing to a frozen object or a getter-only property → <code>TypeError</code>.</li>
<li><code>this</code> in a plain function call is <code>undefined</code>, not <code>window</code>.</li></ul>
<p>Classes and modules are <b>always</b> strict.</p>`,
    quiz: { q: 'What happens at <code>totl = 100</code> in strict mode?', options: ['A global variable totl is created', 'ReferenceError: totl is not defined', 'Nothing', 'SyntaxError'], answer: 1, why: 'Sloppy mode would silently create a global. Strict mode reports the typo as an error.' },
  },
  modules: {
    lesson: `<p>Modules split code into files. Each module has its <b>own private memory</b>. Only what you <code>export</code> can be used elsewhere.</p>
<pre>// math.js
export const PI = 3.14;           // named export
export default function sq(x) {}  // default export (one per file)
// main.js
import sq, { PI } from "./math.js";
import * as math from "./math.js"; // everything as an object</pre>
<ul><li>Imported modules run <b>first</b>, and only once.</li>
<li>Imports are <b>live, read-only links</b>: if the exporting module changes a variable, importers see the new value.</li>
<li>In this visualizer, start each file with a line like <code>// @file math.js</code>.</li></ul>`,
    quiz: { q: 'Which module runs first?', options: ['main.js', 'math.js', 'Both at the same time', 'Whichever is written first'], answer: 1, why: 'main.js imports from math.js, so math.js has to run first.' },
  },
  fetch: {
    lesson: `<p><code>fetch(url)</code> asks a server for data. It returns a <b>Promise</b> right away, and the request travels while your code continues.</p>
<pre>const res = await fetch("/api/users/1");
if (!res.ok) { /* 404, 500... */ }
const data = await res.json();   // reading the body is async too</pre>
<ul><li><code>fetch</code> only rejects on <b>network failure</b>. HTTP errors like 404 still <b>fulfill</b>, so check <code>res.ok</code>.</li>
<li>Two <code>await</code>s: one for the response headers, one for the body.</li>
<li>Pretend server routes here: <code>/api/users</code>, <code>/api/users/1-3</code>, <code>/api/todos</code>, <code>/api/slow</code>, <code>/api/error</code>.</li></ul>`,
    quiz: { q: 'What prints first?', options: ['"Hello, Ada Lovelace"', '"Requests sent!"', '"Request failed: 404"', 'Nothing, fetch blocks'], answer: 1, why: 'Both showUser() calls pause at their first await, so the global code prints "Requests sent!" before any response arrives.' },
  },
  dom: {
    lesson: `<p>The <b>DOM</b> is the page as JavaScript objects. You find elements and change them:</p>
<pre>const el = document.getElementById("output");
el.textContent = "Hi!";
button.addEventListener("click", event => { ... });</pre>
<ul><li><code>addEventListener</code> doesn't run your function. It <b>registers</b> it with the browser.</li>
<li>When the user clicks, the browser puts a <b>click task</b> in the Callback Queue, and your listener runs when the stack is free.</li>
<li><code>simulateClick(selector, ms)</code> is a helper in this visualizer to pretend a user clicked.</li></ul>`,
    quiz: { q: 'When does the click listener run for the first time?', options: ['Right when addEventListener is called', 'At about 500ms, when the click event is queued', 'Never', 'Before "Waiting for clicks..."'], answer: 1, why: 'Listeners only run when the event happens. The first pretend click is at 500ms.' },
  },
  proxy: {
    lesson: `<p>A <b>Proxy</b> wraps an object and lets a <b>handler</b> intercept operations through <b>traps</b>:</p>
<ul><li><code>get(target, key)</code>: reading a property</li>
<li><code>set(target, key, value)</code>: writing (return true if handled)</li>
<li><code>has</code> (the <code>in</code> operator), <code>deleteProperty</code>, <code>ownKeys</code>, <code>apply</code> (calling a function)</li></ul>
<p><b>Reflect</b> has matching methods that do the default action: <code>Reflect.get(target, key)</code>. It's handy inside traps.</p>
<p class="tip">💡 Used for validation, default values, logging, and reactive frameworks like Vue.</p>`,
    quiz: { q: 'What does <code>guarded.email</code> give?', options: ['undefined', '"🤷 no email"', 'An error', '"Ada"'], answer: 1, why: 'The get trap runs and returns a fallback text for keys the object does not have.' },
  },
  combinators: {
    lesson: `<p>Four ways to wait for several promises:</p>
<ul><li><code>Promise.all</code>: all must succeed; rejects as soon as <b>one</b> fails.</li>
<li><code>Promise.allSettled</code>: waits for <b>every</b> one and never rejects. You get <code>{status: "fulfilled", value}</code> or <code>{status: "rejected", reason}</code> for each, which is perfect for "show what loaded".</li>
<li><code>Promise.any</code>: the <b>first success</b> wins; rejects with an <code>AggregateError</code> only if <b>all</b> fail (e.g. try several mirrors).</li>
<li><code>Promise.race</code>: the first to <b>settle</b>, success or failure (e.g. a timeout).</li></ul>`,
    quiz: { q: 'What does <code>Promise.any</code> print?', options: ['first success: mirror A', 'first success: mirror B', 'An AggregateError', 'Nothing'], answer: 1, why: 'mirror A fails at 150ms, which any() ignores. mirror B succeeds at 250ms, so it wins.' },
  },
  descriptors: {
    lesson: `<p>Each property has three hidden switches (its <b>descriptor</b>), which you can read with <code>Object.getOwnPropertyDescriptor</code>:</p>
<ul><li><code>writable</code>: can the value change?</li>
<li><code>enumerable</code>: does it show up in <code>Object.keys</code>, <code>for…in</code>, spread and <code>JSON.stringify</code>?</li>
<li><code>configurable</code>: can it be deleted or redefined?</li></ul>
<p>Normal assignments make all three <code>true</code>; <code>Object.defineProperty</code> defaults them to <code>false</code>. Whole-object locks: <code>preventExtensions</code> (no new properties) → <code>seal</code> (also no deleting) → <code>freeze</code> (also no changes).</p>
<p class="tip">⚠️ Outside strict mode, writing to a read-only property fails <b>silently</b>.</p>`,
    quiz: { q: 'What does <code>JSON.stringify(config)</code> give?', options: ['{"version":3,"secret":"abc123"}', '{"version":3}', '{"version":3,"secret":"hacked"}', 'An error'], answer: 1, why: 'secret is not enumerable, so JSON.stringify (like Object.keys) skips it.' },
  },
  binary: {
    lesson: `<p>An <b>ArrayBuffer</b> is a block of raw bytes. You read and write it through <b>views</b>:</p>
<ul><li>Typed arrays (<code>Uint8Array</code>, <code>Int16Array</code>, <code>Float64Array</code>, …) treat the bytes as numbers of a fixed size. Values that don't fit <b>wrap around</b> (Uint8: 256 → 0, -1 → 255).</li>
<li>Several views can share <b>the same buffer</b>: writing through one changes what the others see.</li>
<li><code>TextEncoder</code> turns text into UTF-8 bytes: plain letters take 1 byte, "é" takes 2, emoji take 4.</li></ul>
<p>Used for files, images, audio, WebSockets and WebAssembly.</p>`,
    quiz: { q: 'What is stored after <code>bytes[1] = 256</code>?', options: ['256', '255', '0', 'An error'], answer: 2, why: 'A Uint8 slot holds 0–255. 256 wraps around to 0 (only the lowest 8 bits are kept).' },
  },
  urlabort: {
    lesson: `<ul><li><code>new URL(text)</code> parses an address into parts (<code>hostname</code>, <code>pathname</code>, <code>searchParams</code>…). Changing <code>url.searchParams</code> updates <code>url.href</code> with correct escaping, which is safer than gluing strings together.</li>
<li><code>AbortController</code> cancels work: pass <code>controller.signal</code> to <code>fetch</code>, then call <code>controller.abort()</code>. The fetch promise rejects with an <code>AbortError</code>.</li>
<li><code>AbortSignal.timeout(ms)</code> gives a signal that aborts by itself, which makes a request timeout a one-liner.</li></ul>`,
    quiz: { q: 'What does the fetch print?', options: ['loaded 200', 'cancelled: AbortError', 'cancelled: TypeError', 'Nothing at all'], answer: 1, why: 'The request needs 2s, but abort() runs at 500ms, so the promise rejects with an AbortError.' },
  },
  lazyimport: {
    lesson: `<p><code>import("./file.js")</code> (with parentheses) loads a module <b>while the program runs</b> and returns a <b>promise</b> of its exports.</p>
<ul><li>Static <code>import … from</code> lines always load before any code runs; dynamic <code>import()</code> loads only when that line is reached.</li>
<li>Apps use it for <b>code splitting</b>: don't download the chart library until the user opens the chart.</li>
<li>A module still runs only <b>once</b>, even if imported many times.</li></ul>`,
    quiz: { q: 'When does "chart.js is running now" print?', options: ['First, before "app started"', 'Only when showChart runs, after ~300ms', 'Never', 'Right after "app started", at 0ms'], answer: 1, why: 'chart.js is only loaded by import(), which runs inside showChart after the 300ms timer.' },
  },
  workers: {
    lesson: `<p>JavaScript runs one thing at a time on the <b>main thread</b>. A <b>Web Worker</b> is a second thread for heavy work, so the page stays responsive.</p>
<ul><li>A worker has its <b>own memory</b>: no shared variables, no DOM.</li>
<li>Threads talk with <code>postMessage(data)</code> and receive it in <code>onmessage</code> as <code>event.data</code>.</li>
<li>Messages are <b>copied</b> (structured clone), so changing the array in the worker does not change yours. Functions can't be sent.</li></ul>
<p class="tip">💡 In a real browser both threads run at the same time. Here, when two threads have work at once, they take turns one statement at a time (watch the thread lanes under the Call Stack). The <b>Shared Memory</b> lesson shows what happens when they share data.</p>`,
    quiz: { q: 'Which line prints first?', options: ['"sum of squares: 30"', '"the main thread stays free…"', 'They print at exactly the same time', 'An error: workers cannot see numbers'], answer: 1, why: 'postMessage only queues the message. The main thread keeps running its code, and the answer arrives later as an event.' },
  },
  nodeloop: {
    lesson: `<p>Node.js uses the same JavaScript engine, but a different event loop (<b>libuv</b>) that runs in <b>phases</b>:</p>
<ol><li><b>timers</b>: expired <code>setTimeout</code> / <code>setInterval</code></li><li><b>poll</b>: I/O callbacks (files, network)</li><li><b>check</b>: <code>setImmediate</code></li></ol>
<p>Between every callback Node empties two queues: first <code>process.nextTick</code>, then promise microtasks.</p>
<p class="tip">⚠️ In the main script, the order of <code>setTimeout(…, 0)</code> vs <code>setImmediate</code> can vary in real Node. Inside an I/O callback, setImmediate always comes first.</p>`,
    quiz: { q: 'Which runs first after the script ends?', options: ['the promise', 'process.nextTick', 'setTimeout', 'setImmediate'], answer: 1, why: "Node's nextTick queue is emptied before the promise microtask queue." },
  },
  emitter: {
    lesson: `<p>An <b>EventEmitter</b> lets an object announce named events: <code>emitter.on(name, fn)</code> subscribes and <code>emitter.emit(name, ...args)</code> calls every subscriber. Streams, servers and sockets in Node are all emitters.</p>
<ul><li><code>emit</code> calls the listeners <b>synchronously</b>, right away and in order. It is not like the event loop.</li>
<li><code>once</code> listens only for the first time.</li>
<li>Extend it with <code>class Oven extends EventEmitter</code> to give your own objects events.</li></ul>`,
    quiz: { q: 'How many times does "(that was the first batch)" print?', options: ['0', '1', '2', 'It depends on timing'], answer: 1, why: 'once() removes its listener after the first "done" event.' },
  },
  sharedmem: {
    lesson: `<p>Normally a message to a worker is <b>copied</b>. A <code>SharedArrayBuffer</code> is the exception: every thread that receives it sees the <b>same bytes</b>. Now two threads can change one value at the same moment.</p>
<ul><li><code>counter[0]++</code> is really <b>read → add → write</b>. If thread B reads between A's read and A's write, one update is <b>lost</b>. This is a <b>data race</b>.</li>
<li><code>Atomics.add(arr, i, n)</code>, <code>Atomics.sub</code>, <code>Atomics.compareExchange</code> and the others do the whole read-modify-write as <b>one indivisible step</b>.</li>
<li><code>Atomics.wait(arr, i, value)</code> puts a <b>worker</b> to sleep until another thread calls <code>Atomics.notify(arr, i)</code>. The main thread may not block, so it uses <code>Atomics.waitAsync</code>.</li></ul>
<p>Watch the extra <b>thread lanes</b> under the Call Stack: each worker has its own stack, and the 🔀 steps show where the threads take turns.</p>
<p class="tip">⚠️ Here the threads take turns exactly one statement at a time, which shows the worst case clearly. On real CPU cores the timing is unpredictable, so a race may lose no updates on one run and many on the next. That is why races are so hard to debug. Swap the two lines for <code>Atomics.add</code> and you get 6 every time.<br>Real browsers only allow SharedArrayBuffer on pages that are "cross-origin isolated" (COOP/COEP headers).</p>`,
    quiz: { q: 'Two threads each run "counter[0]++" 1000 times on shared memory. What can the final value be?', options: ['Always exactly 2000', 'Anything up to 2000, often less', 'Always 1000', 'It throws an error'], answer: 1, why: 'Without Atomics, a read and a write from one thread can interleave with the other thread, so increments get lost. With Atomics.add it is always 2000.' },
  },
  nodefs: {
    lesson: `<p>Node's <code>fs</code> module reads and writes files. Every function comes in three styles:</p>
<ul><li><code>fs.readFileSync(path, "utf8")</code>: <b>blocks</b> the thread until the disk answers. Fine for start-up scripts, bad in a server, because no other request can be handled meanwhile.</li>
<li><code>fs.readFile(path, "utf8", (err, data) => …)</code>: Node's I/O threads do the work, and the <b>error-first callback</b> runs later in the <b>poll phase</b>.</li>
<li><code>await fs.promises.readFile(path, "utf8")</code>: the same work, wrapped in a Promise. This is the modern style.</li></ul>
<p>Without an encoding you get a <b>Buffer</b> (raw bytes); call <code>.toString()</code> to get text. A missing file gives an error with <code>err.code === "ENOENT"</code>.</p>
<p>Use <code>path.join(__dirname, "file.txt")</code> to build paths safely. Write <code>// @file name.txt</code> to add files to the virtual disk; you can watch them change in the <b>Disk</b> view.</p>`,
    quiz: { q: 'Which line prints first?', options: ['"callback read: …"', '"now 3 todos"', '"script done, the file work is still running"', '"caught ENOENT"'], answer: 2, why: 'Only readFileSync waits. The callback and promise versions run in the background, so the rest of the script finishes first and their results arrive in the poll phase.' },
  },
  nodehttp: {
    lesson: `<p><code>http.createServer(handler)</code> makes a web server. <code>server.listen(3000)</code> opens a port, and Node calls <code>handler(req, res)</code> <b>once per request</b>:</p>
<ul><li><code>req.method</code>, <code>req.url</code>, <code>req.headers</code> describe the request. The body arrives as a <b>stream</b>: <code>req.on("data")</code> chunks, then <code>req.on("end")</code>.</li>
<li><code>res.writeHead(status, headers)</code> then <code>res.end(body)</code> send the answer. Forgetting <code>res.end</code> leaves the client waiting forever.</li>
<li>One thread serves every client: while a request waits for I/O, the event loop handles others. That's why handlers must never block.</li></ul>
<p>Here the client (<code>fetch</code>) and the server run in the same program, so you can follow a request out through the event loop and back.</p>
<p class="tip">💡 Frameworks like Express are built on exactly this <code>(req, res)</code> handler.</p>`,
    quiz: { q: 'What does fetch return for the "/nope" request?', options: ['It rejects with an error', 'A Response with status 404', 'undefined', 'It waits forever'], answer: 1, why: 'The server answered, just with 404. fetch only rejects when there is no answer at all (for example, nothing listening on the port).' },
  },
  internals: {
    lesson: `<p>Engines like V8 make property access fast with tricks you can't see, simulated here when you turn on <b>Internals</b>:</p>
<ul><li><b>Hidden classes (shapes):</b> objects that get the same properties in the <b>same order</b> share one internal layout.</li>
<li><b>Inline caches:</b> each <code>obj.x</code> in your code remembers where <code>x</code> was for the shapes it has seen. With 1 shape it is <i>monomorphic</i> (fastest), with a few <i>polymorphic</i>, and with many <i>megamorphic</i> (slow).</li>
<li><b>JIT:</b> functions that run often get compiled to machine code.</li></ul>
<p class="tip">✅ Practical rule: create objects the same way (a class or constructor), and don't add or delete properties later.</p>`,
    quiz: { q: 'Do <code>a</code> and <code>c</code> share a hidden class?', options: ['Yes, both have x and y', 'No, the properties were added in a different order', 'Yes, all plain objects share one', 'Hidden classes only exist for arrays'], answer: 1, why: 'a got x then y; c got y then x. Different order means a different shape.' },
  },
  realnet: {
    lesson: `<p><code>fetch("https://…")</code> talks to a <b>real server</b>. This app requests it once, then replays the program with the real answer and the real timing, so you can still step backward.</p>
<ul><li>The request leaves immediately. Your code keeps running (that's why "request sent" prints first).</li>
<li>Browsers only allow pages to read another site's data if that site agrees (<b>CORS</b> headers). Many public APIs do; when one doesn't, <code>fetch</code> rejects with <code>TypeError: Failed to fetch</code>.</li>
<li>Always handle failures with <code>try/catch</code> and check <code>res.ok</code> for HTTP errors.</li></ul>
<p class="tip">💡 Good test APIs: <code>jsonplaceholder.typicode.com</code>, <code>api.github.com/users/&lt;name&gt;</code>.</p>`,
    quiz: { q: 'Which line is printed first?', options: ['status: 200', '"request sent, the page stays responsive"', 'The user name', 'Network problem'], answer: 1, why: 'loadUser pauses at its first await while the request travels, so the global code continues and prints its line first.' },
  },
  webpage: {
    lesson: `<p>Add a <code>// @file index.html</code> section to write your own page, and a <code>// @file script.js</code> section for the code. The page is a <b>real DOM</b>, so all CSS selectors, <code>classList</code>, <code>style</code> and attributes work.</p>
<ul><li>Events <b>bubble</b>: a click on an <code>&lt;li&gt;</code> also reaches its parent <code>&lt;ul&gt;</code>. Putting one listener on the parent and checking <code>event.target</code> is called <b>event delegation</b>, and it also works for items added later.</li>
<li><code>event.target</code> is the element clicked; <code>event.currentTarget</code> is the element whose listener is running.</li>
<li><b>Click or type in the Page preview</b>: your action is added as a real event, and the program re-runs with it so you can step through what your click caused.</li></ul>`,
    quiz: { q: 'You click "Bread". Which listener runs?', options: ['None, the <li> has no listener', 'The one on the <ul>, through bubbling', 'The one on the Add button', 'Both listeners'], answer: 1, why: 'The click starts at the <li> and bubbles up to the <ul>, where the delegated listener checks event.target.' },
  },
  storage: {
    lesson: `<ul><li><code>alert</code>, <code>confirm</code> and <code>prompt</code> show dialogs that <b>block</b> the whole page: no code, timers or clicks run until the user answers. That's why real apps prefer custom in-page dialogs.</li>
<li><code>localStorage</code> stores <b>strings</b> per website and keeps them after the page closes. <code>sessionStorage</code> is cleared when the tab closes. Store objects with <code>JSON.stringify</code> and read them back with <code>JSON.parse</code>.</li>
<li>In this app, you answer each dialog once (a real dialog appears), and your answers are replayed when stepping. localStorage persists between runs, so run it twice to see "Visit number 2".</li></ul>`,
    quiz: { q: 'What type does <code>localStorage.getItem("visits")</code> return?', options: ['number', 'string (or null if missing)', 'object', 'undefined'], answer: 1, why: 'Web Storage only stores strings, which is why the code wraps it in Number(...). A missing key gives null.' },
  },
  tla: {
    lesson: `<p>Inside a <b>module</b> you can use <code>await</code> at the top level, outside any function. The module pauses there like an async function.</p>
<ul><li>Every module that imports it <b>waits</b> until it has finished, so importers never see half-initialized exports.</li>
<li>The event loop keeps running in the meantime: timers, network responses and other work continue.</li>
<li>Typical uses: loading configuration, connecting to a database, or <code>await import()</code> of an optional dependency.</li></ul>
<p class="tip">⚠️ Use it sparingly. A slow top-level await delays <i>every</i> module that depends on it.</p>`,
    quiz: { q: 'In what order are the three lines printed?', options: ['main, config: loading, config: ready', 'config: loading, config: ready, main', 'config: loading, main, config: ready', 'main only'], answer: 1, why: 'main.js imports config.js, so config runs first. Its top-level await pauses config, and main must wait until config has completely finished.' },
  },
  platform: {
    lesson: `<ul><li><b>Intl</b> formats numbers, currencies, dates, lists and plurals with the rules of a locale: <code>new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })</code>.</li>
<li><b>WeakRef</b> refers to an object <i>without</i> keeping it alive. If nothing else references it, the garbage collector may remove it, and <code>ref.deref()</code> returns <code>undefined</code>. <b>FinalizationRegistry</b> lets you run cleanup after an object is collected. Real engines decide <i>when</i> to collect, so never rely on exact timing.</li>
<li><b>eval(string)</b> parses and runs text as code at runtime, and <b>new Function(args, body)</b> builds a function from text. They are slow, hard to debug and dangerous with user input, so prefer real functions and <code>JSON.parse</code>.</li></ul>`,
    quiz: { q: 'What does <code>ref.deref()</code> most likely give inside the timer?', options: ['{ user: "Ada" }', 'undefined, because the object was garbage-collected', 'null', 'A TypeError'], answer: 1, why: 'After <code>session = null</code>, only the WeakRef points to the object, which does not keep it alive. The collector removes it, so deref() returns undefined. (Real browsers collect whenever they like; this visualizer collects predictably.)' },
  },
  errors: {
    lesson: `<p><code>throw</code> stops normal execution and sends an error <b>up the Call Stack</b>. Each function on the way is popped, until a <code>try</code> with a <code>catch</code> handles it.</p>
<pre>try { risky(); }
catch (err) { console.log(err.name, err.message); }
finally { /* always runs */ }</pre>
<ul><li>Built-in error types include <code>Error</code>, <code>TypeError</code>, <code>ReferenceError</code> and <code>RangeError</code>, and you can make your own with <code>class MyError extends Error</code>.</li>
<li>If nothing catches it, it's an <b>uncaught</b> error and the script stops.</li></ul>`,
    quiz: { q: 'Is "Caught: Cannot divide by zero!" printed?', options: ['No, the program crashes', 'Yes, the catch block handles it', 'Only if finally exists', 'Yes, but 5 is printed first'], answer: 1, why: 'divide(5, 0) throws, its context is popped, and the catch block receives the error. (5 was already printed by the first call.)' },
  },
  patterns: {
    lesson: `<p>Design patterns are proven shapes for code. Two you will meet in every codebase:</p>
<ul><li><b>Observer</b> (publish/subscribe): an object keeps a list of listener functions and calls them all when something changes. <code>subscribe</code> returns an "unsubscribe" function so listeners can be removed (forgetting this is a classic memory leak). DOM events, Redux, Vue and RxJS are all observers.</li>
<li><b>Factory</b>: a function that builds and returns a configured object or function, here a logger with a prefix. Callers don't need to know how it is made.</li>
<li><b>Module</b> (encapsulation): the <code>#state</code> and <code>#listeners</code> private fields can only be reached through the class's methods.</li></ul>
<p>Watch <code>setState</code>: it creates a <b>new</b> state object (immutable update) and then loops over the listeners. After <code>stopA()</code>, only B is called.</p>
<p class="tip">💡 Interview tip: implement Observer, Singleton, Factory, Strategy, Decorator and Middleware yourself in the Interview menu (Design patterns), with "Write it yourself".</p>`,
    quiz: { q: 'How many lines does the program print?', options: ['2', '3', '4', 'It throws because #listeners is private'], answer: 1, why: 'The first setState calls A and B (2 lines). After stopA(), the second setState only calls B (1 line). That makes 3 lines.' },
  },
  mutationobs: {
    lesson: `<p>A <code>MutationObserver</code> watches part of the page and tells you when it changes: children added or removed, attributes changed, or text edited.</p>
<ul><li>Changes are <b>not</b> reported one by one as they happen. They are collected, and your callback receives them <b>all together</b>, as an array of records.</li>
<li>The callback runs as a <b>microtask</b>: after the current script finishes, before any timer, and before a promise callback that was queued <b>after</b> the first change.</li>
<li>Use it for "react when the DOM changes" code: lazy-loading, editors, third-party widgets. Call <code>disconnect()</code> when you are done.</li></ul>
<p class="tip">💡 Watch the microtask queue: the observer job appears there at the first change, ahead of the promise reaction.</p>`,
    quiz: { q: 'What prints right after "script done"?', options: ['promise callback', 'observer saw 2 changes', 'observer saw 1 changes', 'Nothing: observers run in a timer'], answer: 1, why: 'Both changes are batched into one microtask, which was queued at the first change, before the promise callback.' },
  },
  commonjs: {
    lesson: `<p>Node's original module system is <b>CommonJS</b>:</p>
<ul><li><code>require("./file.js")</code> runs that file <b>synchronously, right now</b>, and returns its <code>module.exports</code>.</li>
<li>Every file is wrapped in a function that receives <code>module</code>, <code>exports</code>, <code>require</code>, <code>__filename</code> and <code>__dirname</code>, so its variables stay private.</li>
<li>A module runs <b>once</b>: later <code>require</code> calls return the <b>cached</b> exports object, which is why "math.js is loading" prints a single time and <code>require(...) === math</code> is true.</li>
<li><code>exports.x = …</code> adds to the exports object; <code>module.exports = …</code> replaces it. (Writing <code>exports = …</code> breaks the link: a classic interview question.)</li></ul>
<p class="tip">💡 Compare with ES modules (<code>import</code>), which are loaded <b>before</b> the importing file runs and give live, read-only bindings. See the Modules lesson.</p>`,
    quiz: { q: 'How many times is "math.js is loading" printed?', options: ['0', '1', '2', '3'], answer: 1, why: 'The first require runs the file; every later require (from greet.js and main.js) gets the cached module.exports.' },
  },
  typescript: {
    lesson: `<p><b>TypeScript</b> is JavaScript plus <b>types</b>. Types help your editor catch mistakes before the code runs, then they are <b>erased</b>: what runs is plain JavaScript.</p>
<ul><li><code>name: string</code>, <code>id: number</code>, <code>(): string</code>: annotations on variables, parameters and return values.</li>
<li><code>interface</code> and <code>type</code> describe the shape of objects; <code>email?</code> is optional; <code>"active" | "banned"</code> is a union of allowed values.</li>
<li><b>Generics</b> (<code>Repo&lt;T&gt;</code>) make a class or function work for many types while keeping them checked.</li>
<li><code>!</code> (non-null) and <code>as</code> (assertion) only tell the compiler what you know; they do <b>nothing</b> at run time.</li></ul>
<p>Watch the code panel: the engine highlights your TypeScript, but notice there are no steps for the interface or the type: they don't exist at run time. (Start any program with <code>// @lang ts</code> to use TypeScript here. Type errors are not checked: this shows how the code <b>runs</b>.)</p>`,
    quiz: { q: 'What happens to "interface User" when the code runs?', options: ['It creates a User class', 'It checks every object at run time', 'Nothing: types are erased before running', 'It throws if an object has extra fields'], answer: 2, why: 'Interfaces and type annotations exist only for the compiler and editor. The JavaScript that runs has no trace of them.' },
  },
  streams: {
    lesson: `<p>A <b>stream</b> handles data in <b>chunks</b> as it arrives, so a 2 GB file never has to fit in memory.</p>
<ul><li><b>Readable</b> produces chunks (<code>fs.createReadStream</code>, HTTP requests); listen with <code>.on("data")</code> and <code>.on("end")</code>, or <code>for await (const chunk of stream)</code>.</li>
<li><b>Transform</b> changes each chunk on the way (compress, parse, uppercase); call <code>done(null, newChunk)</code>.</li>
<li><b>Writable</b> consumes chunks (files, HTTP responses).</li>
<li><code>pipeline(a, b, c, callback)</code> connects them and calls back when everything finished (or failed).</li></ul>
<p>Chunks move with <code>process.nextTick</code> here, so "pipeline started" prints first. The chunks are tiny (12 characters) so you can watch each one; real file streams use 64 KB.</p>`,
    quiz: { q: 'Why use a stream instead of fs.readFile for a huge log file?', options: ['Streams are always faster', 'Only a few chunks are in memory at once', 'readFile cannot read text', 'Streams run on another thread'], answer: 1, why: 'readFile loads the whole file into memory; a stream processes it chunk by chunk, so memory use stays small whatever the file size.' },
  },
  sandbox: {
    lesson: `<p>Free play! Write any JavaScript and press 🚀 Run. Tips:</p>
<ul><li>Click a line number to set a <b>breakpoint</b> (▶ Play stops there).</li>
<li>Click a line of code to jump to it and read a plain-English explanation.</li>
<li>Use <code>// @file name.js</code> lines to write several modules.</li>
<li>Try <code>fetch("/api/todos")</code> or <code>document.getElementById("btn")</code>.</li></ul>`,
    quiz: null,
  },
};
