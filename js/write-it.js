/*
 * JS Engine Lab — "Write it yourself" mode for interview questions.
 * For each implement-style question, the functions listed below get their bodies removed.
 * The test code under them stays, and the expected output comes from running the reference solution.
 */
(function () {
  'use strict';
  const WRITE_IT = {
    once: ['once'], memoize: ['memoize'], bindpolyfill: ['myBind'], curry: ['curry', 'add'], compose: ['pipe', 'compose'], counter: ['makeCounter'],
    adder: ['makeAdder', 'multiplier'], debounce: ['debounce'], throttle: ['throttle'], retry: ['retry'], timeout: ['withTimeout'],
    promiseall: ['promiseAll'], promisify: ['promisify'], pool: ['runWithLimit'], 'dedupe-requests': ['getUser'], settledpolyfill: ['allSettled', 'race'],
    flatten: ['flatten'], deepclone: ['deepClone'], deepequal: ['deepEqual'], emitter: ['Emitter'], lru: ['LRUCache'],
    mappolyfill: ['myMap', 'myFilter', 'myReduce'], lodashget: ['get', 'flattenKeys'], deepfreeze: ['deepFreeze'], mynew: ['myNew', 'myInstanceOf'],
    mycall: ['myCall'], template: ['render'], palindrome: ['reverse', 'isPalindrome'], anagram: ['sortLetters', 'isAnagram'], twosum: ['twoSum'],
    fibonacci: ['fibSlow', 'fibFast'], factorial: ['factorial'], secondlargest: ['secondLargest'], chunk: ['chunk'], binarysearch: ['binarySearch'],
    brackets: ['isBalanced'], titlecase: ['titleCase', 'camel'], rotate: ['rotate'], stackqueue: ['Stack', 'Queue'], linkedlist: ['LinkedList'],
    bst: ['insert', 'inorder', 'height', 'bfs'], graph: ['shortestPath', 'dfs'], matrix: ['transpose', 'spiral'], bubblesort: ['bubbleSort'],
    quicksort: ['quickSort'], mergesort: ['mergeSort'], kadane: ['maxSubarray'], longestunique: ['longestUnique'], groupanagrams: ['groupAnagrams'],
    firstunique: ['firstUnique', 'mostFrequent'], missingzeros: ['missing', 'moveZeros'], primes: ['isPrime', 'sieve'], numbers: ['gcd', 'lcm', 'sumDigits', 'reverseInt'],
    stock: ['maxProfit'], intervals: ['mergeIntervals'], stairs: ['climbStairs', 'ways'], permutations: ['permutations', 'subsets'],
    wordtricks: ['reverseWords', 'countVowels', 'isPangram'], deepsum: ['deepSum', 'countdown'], singleton: ['Config'], factory: ['createVehicle'],
    observer: ['Subject'], strategy: ['cost'], decorator: ['withLogging', 'withTiming'], middleware: ['createApp'], command: ['Editor'],
    useeffect: ['createHooks'], vdom: ['diff'], reactivity: ['reactive', 'effect'], reduxstore: ['createStore', 'todos'], batching: ['createBatcher'],
    router: ['createRouter'], partialzip: ['partial', 'zip'], lazypipeline: ['map', 'filter', 'take'], maybe: ['Maybe'], reduceall: ['mapR', 'filterR', 'countBy'],
    trie: ['Trie'], dijkstra: ['dijkstra'], toposort: ['topoSort'], ratelimit: ['createLimiter'], deepmerge: ['deepMerge'], roman: ['toRoman', 'fromRoman'],
    compress: ['compress', 'decompress'], nqueens: ['nQueens'], sudoku: ['isValidSudoku'], ttlcache: ['TTLCache'], testframework: ['expect', 'it', 'describe'],
    spies: ['spy'], faketimers: ['createFakeClock'],
  };

  // replace every function body the learner should write with an empty one
  function makeStarter(src, names) {
    let ast, map = { start: p => p, end: p => p };
    try { ast = window.acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true }); }
    catch (e) {
      // JSX: parse the transformed code and map every position back to the original
      const E = window.JSEngine;
      if (!E || !E.transformJSX) return null;
      try {
        const r = E.transformJSX(src);
        ast = window.acorn.parse(r.code, { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true });
        map = E.jsxMapper(r.map);
      } catch (e2) { return null; }
    }
    const want = new Set(names);
    const edits = [];
    const indentAt = pos => { const ls = src.lastIndexOf('\n', pos - 1) + 1; return (/^\s*/.exec(src.slice(ls)) || [''])[0]; };
    const blank = (fnNode, at) => {
      const ind = indentAt(map.start(at));
      const b = fnNode.body;
      edits.push({ s: map.start(b.start), e: map.end(b.end), text: `{\n${ind}  // your code here\n${ind}}` });
    };
    const blankClass = cls => {
      cls.body.body.forEach(m => {
        if (m.type === 'MethodDefinition' && m.kind !== 'constructor') blank(m.value, m.start);
      });
    };
    ast.body.forEach(st => {
      if (st.type === 'FunctionDeclaration' && st.id && want.has(st.id.name)) blank(st, st.start);
      else if (st.type === 'ClassDeclaration' && st.id && want.has(st.id.name)) blankClass(st);
      else if (st.type === 'VariableDeclaration') {
        st.declarations.forEach(d => {
          if (d.id.type !== 'Identifier' || !want.has(d.id.name) || !d.init) return;
          if (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression') blank(d.init, st.start);
          else if (d.init.type === 'ClassExpression') blankClass(d.init);
        });
      } else if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression') {
        const a = st.expression;
        const name = a.left.type === 'MemberExpression' && !a.left.computed && a.left.property.name;
        if (name && want.has(name) && (a.right.type === 'FunctionExpression' || a.right.type === 'ArrowFunctionExpression')) blank(a.right, st.start);
      }
    });
    if (!edits.length) return null;
    let out = src;
    edits.sort((x, y) => y.s - x.s).forEach(ed => { out = out.slice(0, ed.s) + ed.text + out.slice(ed.e); });
    return out;
  }

  const plain = html => String(html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

  // turn an interview question into a checked exercise
  function writeItChallenge(q) {
    const names = WRITE_IT[q.id];
    if (!names || !q.code) return null;
    const starter = makeStarter(q.code, names);
    if (!starter) return null;
    const r = new window.JSEngine.Interpreter(q.code, { seed: 1 }).run();
    if (r.error) return null;
    const lines = r.trace[r.trace.length - 1].console.map(l => l.text);
    const why = plain(q.why).split(/(?<=\.)\s+/);
    const fnList = names.map(n => `<code>${n}</code>`).join(', ');
    return {
      id: 'iv:' + q.id, fromInterview: q, emoji: '✍️', title: q.title, difficulty: { Easy: 1, Medium: 2, Hard: 3 }[q.level] || 2, concept: null,
      task: `<b>${q.ask}</b> Write ${fnList} so the program prints exactly this. The test code under the function${names.length > 1 ? 's' : ''} is already there.
        <pre class="wi-expect">${lines.map(l => l.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))).join('\n') || '(nothing)'}</pre>`,
      starter, expectOutput: lines, solution: q.code,
      hints: [`Write ${names.join(', ')}. Everything below the function${names.length > 1 ? 's' : ''} is test code: read it to see how ${names.length > 1 ? 'they are' : 'it is'} called.`].concat(why.slice(0, 3)),
    };
  }

  window.JSWriteIt = { WRITE_IT, makeStarter, writeItChallenge, has: id => !!WRITE_IT[id] };
})();
