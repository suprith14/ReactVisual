/*
 * React Engine Lab — ready-made side-by-side runs for the "why" concepts.
 * Version A is the concept's own code; version B changes one thing (edits = exact text replacements).
 * The Compare window runs both and shows the console, React's work (renders, skips, DOM changes) and the final page.
 */
(function () {
  'use strict';
  window.REACT_PAIRS = {
    'r-indexkeys': {
      a: 'key = index (the bug)', b: 'key = the name',
      edits: [['key={i}', 'key={r}']],
      why: 'With index keys, the state of the first row (index 0) stays at index 0 and is given to Linus. With the name as key, Ada\'s fiber (and her note) is deleted and Linus keeps his own.',
    },
    'r-memo': {
      a: 'Child wrapped in memo', b: 'no memo',
      edits: [['const Child = React.memo(function Child({ label, onPick }) {', 'const Child = function Child({ label, onPick }) {'], ['return <span onClick={onPick}>{label}</span>;\n});', 'return <span onClick={onPick}>{label}</span>;\n};']],
      why: 'Without memo, every Child renders again when Parent renders. With memo, the Child with the same props (and a stable useCallback function) is skipped; the one that gets a new arrow function each render still renders.',
    },
    'r-effect': {
      a: 'useEffect(…, [count])', b: 'useEffect(…) with no dependency array',
      edits: [['  }, [count]);', '  });']],
      why: 'With [count], the effect runs only when count changed. With no array, it runs after every render, including the one caused by "other".',
    },
    'r-memohooks': {
      a: 'useMemo(() => slowSquare(n), [n])', b: 'slowSquare(n) on every render',
      edits: [['const square = React.useMemo(() => slowSquare(n), [n]);', 'const square = slowSquare(n);']],
      why: 'Without useMemo the slow calculation runs on every render, even when only the theme changed.',
    },
    'r-transition': {
      a: 'list update inside startTransition', b: 'list update without startTransition',
      edits: [['startTransition(() => setItems([1, 2, 3, 4, 5, 6].map(i => v + i)));', 'setItems([1, 2, 3, 4, 5, 6].map(i => v + i));']],
      why: 'Without startTransition the list update has the same urgent priority as the input, so React renders it at once, in one go. With it, the list renders later in time slices, and the stale render for "a" is thrown away when "ab" arrives.',
    },
    'r-updater': {
      a: 'setN(n + 1) three times', b: 'setN(x => x + 1) three times',
      edits: [['onClick={() => { setN(n + 1); setN(n + 1); setN(n + 1); }}', 'onClick={() => { setN(x => x + 1); setN(x => x + 1); setN(x => x + 1); }}']],
      why: 'n + 1 uses the n of this render three times (0 + 1). The updater gets the result of the previous update each time (1, 2, 3).',
    },
  };
  // apply the edits; null if one of them does not match the code (so a pair never shows a wrong version)
  window.REACT_PAIRS_APPLY = function (code, pair) {
    let out = code;
    for (const [from, to] of pair.edits) { if (!out.includes(from)) return null; out = out.split(from).join(to); }
    return out;
  };
})();
