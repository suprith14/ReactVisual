/*
 * React Engine Lab — adds the two lessons that are not in the main course data,
 * so every React lesson is inside the one learning path.
 */
(function () {
  'use strict';
  const C = window.REACT_COURSE;
  if (!C) return;
  const add = (id, lessons) => { const u = C.find(x => x.id === id); if (u) u.lessons = u.lessons.concat(lessons); };
  add('u-concurrent', ['r-flushsync']);
  add('u-errors', ['r-classstate']);
  add('u-commit', ['r-commitphases']);
  add('u-composition', ['r-useid']);
  add('u-suspense', ['r-activity']);
  add('u-fetching', ['r-effectevent', 'r-race']);
  add('u-state', ['r-immutable']);
  add('u-lists', ['r-resetstate', 'r-listdiff']);
  add('u-effects', ['r-derived']);
  add('u-events', ['r-uncontrolled']);
  add('u-composition', ['r-hoc']);
  add('u-refs', ['r-ref19']);
  add('u-context', ['r-context19']);
  add('u-react19', ['r-metadata', 'r-resources', 'r-formreset']);
  add('u-perf', ['r-profiler', 'r-compiler']);
  add('u-ssr', ['r-streaming', 'r-selectivehydration', 'r-static', 'r-cache']);
  add('u-errors', ['r-boundarylimits', 'r-rooterrors']);
  add('u-suspense', ['r-prerender']);
  add('u-custom-hooks', ['r-devtools']);
})();
// the first concept: the whole journey of one click, before zooming into each part
(function () {
  const C = window.REACT_COURSE;
  if (!C || C.some(u => u.id === 'u-overview')) return;
  C.unshift({ id: 'u-overview', title: 'React in one picture', phase: 'Foundations', goal: 'See the whole path of one update before zooming in.', lessons: ['r-overview'], watch: 'the pipeline in the Inside tab lighting up 1 → 7 as one click travels through React.' });
})();
