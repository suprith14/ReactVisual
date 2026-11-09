/*
 * React Engine Lab — the React panel: React's phase, the fiber trees (current and work-in-progress),
 * each component's hooks as a linked list, and a log of everything React did so far.
 * It reads snap.react, which js/engine/react.js saves with every step.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = (k, d) => { try { const v = localStorage.getItem('rl.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem('rl.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

  const UI = { tab: get('tab2', 'inside'), tree: 'auto', last: null };
  const STAGES = [
    { id: 'trigger', label: 'Trigger', tip: 'setState / root.render puts an update in a queue and schedules work' },
    { id: 'render', label: 'Render', tip: 'React calls your components and builds the work-in-progress tree. No DOM changes. Can pause.' },
    { id: 'commit', label: 'Commit', tip: 'React applies every DOM change at once. Synchronous, never paused.' },
    { id: 'passive', label: 'Effects', tip: 'useEffect callbacks run after the browser has painted.' },
  ];
  const FLAG = { Placement: ['＋', 'insert'], Update: ['✎', 'update'], ChildDeletion: ['✕', 'delete'], Passive: ['⏱', 'effect'], Ref: ['↗', 'ref'], DidCapture: ['⚠', 'delete'], Snapshot: ['📷', 'ref'], Visibility: ['👁', 'update'] };
  const LANES = [[1, 'Sync'], [16, 'Default'], [64, 'Transition']];
  const laneText = l => LANES.filter(([b]) => l & b).map(([, n]) => n).join(' + ');

  // which React stage this step belongs to (the trigger stage is the time between an update and the render)
  function stageOf(snap) {
    const r = snap.react;
    if (r.phase === 'render' || r.phase === 'commit' || r.phase === 'passive') return r.phase;
    if (snap.kind === 'react' && /adds an <b>update|puts an <b>update|schedule|startTransition|root listener/.test(snap.msg)) return 'trigger';
    return r.roots.some(x => x.pendingLanes) ? 'trigger' : 'idle';
  }

  function fiberHTML(f, ctx, depth) {
    const hit = id => id === f.id || id === f.alt;
    const cls = ['fb', 'tag-' + f.tag];
    if (ctx.r.wip != null && hit(ctx.r.wip) && ctx.r.phase === 'render') cls.push('now');
    else if (ctx.r.phase === 'render' && ctx.r.bailed.some(hit)) cls.push('bailed');
    else if (ctx.r.phase === 'render' && ctx.r.worked.some(hit)) cls.push('worked');
    if (ctx.changed.has(f.id)) cls.push('fresh');
    const flags = ctx.showFlags ? f.flags.map(n => `<span class="rl-fl rl-fl-${FLAG[n] ? FLAG[n][1] : 'x'}" title="${esc(n)} flag: ${esc(flagTip(n))}">${FLAG[n] ? FLAG[n][0] : ''} ${esc(n)}</span>`).join('') : '';
    const lanes = f.lanes ? `<span class="rl-ln" title="This fiber has an update waiting (lanes)">● ${esc(laneText(f.lanes))}</span>` : '';
    const child = !f.lanes && f.childLanes ? `<span class="rl-ln sub" title="Something below has an update (childLanes)">↓ work below</span>` : '';
    const del = f.deletions && f.deletions.length ? `<span class="rl-fl rl-fl-delete" title="Children that will be removed in the commit">✕ removes ${esc(f.deletions.join(', '))}</span>` : '';
    const hooks = f.hooks && f.hooks.length && ctx.inlineHooks
      ? `<div class="fb-hooks">${f.hooks.map(h => `<span class="hk hk-${esc(h.name)}">${esc(h.name)} <b>${esc(trim(h.value, 26))}</b></span>`).join('<i>→</i>')}</div>` : '';
    const props = f.props ? `<span class="fb-props">${esc(trim(f.props, 40))}</span>` : '';
    const kids = f.kids.length && depth < 25 ? `<ul>${f.kids.map(k => `<li>${fiberHTML(k, ctx, depth + 1)}</li>`).join('')}</ul>` : '';
    return `<div class="${cls.join(' ')}" title="${esc(f.tagName)} · fiber #${f.id}${f.alt != null ? ' (alternate #' + f.alt + ')' : ''}"><span class="fb-name">${esc(f.name)}</span>${props}${lanes}${child}${flags}${del}${hooks}</div>${kids}`;
  }
  const trim = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
  function flagTip(n) {
    return { Placement: 'insert this DOM node in the commit', Update: 'change props or text in the commit', ChildDeletion: 'remove some children in the commit', Passive: 'has useEffect work to run after paint', Ref: 'attach a ref in the commit', DidCapture: 'a child threw (an error or a Promise): render again with the error UI or fallback', Snapshot: 'call getSnapshotBeforeUpdate before the DOM changes', Visibility: 'hide or show content (Suspense)' }[n] || '';
  }

  // fibers that look different from the previous step (to flash them)
  function changedIds(tree, prevTree) {
    const out = new Set();
    const index = new Map();
    const walk = (f, fn) => { if (!f) return; fn(f); f.kids.forEach(k => walk(k, fn)); };
    walk(prevTree, f => index.set(f.id, JSON.stringify([f.flags, f.hooks, f.props, f.lanes])));
    if (!prevTree) return out;
    walk(tree, f => { if (index.get(f.id) !== JSON.stringify([f.flags, f.hooks, f.props, f.lanes])) out.add(f.id); });
    return out;
  }

  function fibersTab(snap, prev) {
    const r = snap.react, root = r.roots[0];
    const hasWip = !!root.wip;
    const mode = UI.tree === 'auto' ? (hasWip ? 'wip' : 'current') : UI.tree === 'wip' && !hasWip ? 'current' : UI.tree;
    const tree = mode === 'wip' ? root.wip : root.current;
    const pr = prev && prev.react && prev.react.roots[0];
    const prevTree = pr ? (mode === 'wip' ? pr.wip : pr.current) : null;
    const ctx = { r, changed: changedIds(tree, prevTree), showFlags: mode === 'wip' || r.phase === 'commit', inlineHooks: true };
    const sw = `<div class="rl-switch" role="group" aria-label="Which fiber tree">
      <button class="chip${mode === 'current' ? ' on' : ''}" data-tree="current" title="The tree that matches what is on screen now">current <small>on screen</small></button>
      <button class="chip${mode === 'wip' ? ' on' : ''}" data-tree="wip"${hasWip ? '' : ' disabled'} title="The tree React is building during a render">work-in-progress${hasWip ? '' : ' <small>none</small>'}</button>
      <button class="chip${UI.tree === 'auto' ? ' on' : ''}" data-tree="auto" title="Show the work-in-progress tree while React renders">auto</button></div>`;
    const note = mode === 'wip'
      ? '<div class="rl-note">React builds this copy fiber by fiber (<b>double buffering</b>). When it is complete, the commit swaps it in as the current tree.</div>'
      : r.phase === 'render' ? '' : '<div class="rl-note">Each component and element is a <b>fiber</b>: a small object with <code>child</code>, <code>sibling</code> and <code>return</code> links, its props, its hooks and its pending work.</div>';
    const legend = `<div class="rl-legend"><span class="lg now">rendering now</span><span class="lg worked">rendered</span><span class="lg bailed">skipped (bailout)</span><span class="rl-ln">● has an update</span></div>`;
    return sw + (tree ? `<div class="rl-tree"><ul><li>${fiberHTML(tree, ctx, 0)}</li></ul></div>` : '<div class="empty">No fibers yet.</div>') + legend + note;
  }

  function hooksTab(snap, prev) {
    const comps = [];
    const walk = f => { if (!f) return; if (f.hooks) comps.push(f); f.kids.forEach(walk); };
    const root = snap.react.roots[0];
    walk(root.wip || root.current);
    if (!comps.length) return '<div class="empty">No function components yet.</div>';
    const focus = snap.react.wip;
    // the hooks of the previous step, to mark the values that just changed
    const before = new Map();
    const index = f => { if (!f) return; before.set(f.id, f.hooks); f.kids.forEach(index); };
    if (prev && prev.react) prev.react.roots.forEach(r => { index(r.current); index(r.wip); });
    const oldHook = (f, k) => { const list = before.get(f.id) || (f.alt != null ? before.get(f.alt) : null); return list ? list[k] : null; };
    return '<div class="rl-note">Hooks are stored on the fiber as a <b>linked list</b>, in call order. React finds "your" state by position, which is why hooks must run in the same order every render.</div>'
      + comps.map(f => `<div class="rl-comp${focus === f.id || focus === f.alt ? ' now' : ''}"><div class="rl-comp-name">${esc(f.name)} <small>fiber #${f.id} · memoizedState →</small></div>
        <div class="rl-list">${f.hooks.length ? f.hooks.map((h, k) => { const o = oldHook(f, k), chg = o && o.name === h.name && o.value !== h.value; return `<div class="rl-hook hk-${esc(h.name)}${chg ? ' chg' : ''}"${chg ? ` title="changed in this step: was ${esc(trim(o.value, 40))}"` : ''}><small>#${k}</small><b>${esc(h.name)}</b><code>${esc(trim(h.value, 40))}</code>${chg ? `<s class="rl-was">${esc(trim(o.value, 20))}</s>` : ''}${h.note ? `<em>${esc(h.note)}</em>` : ''}</div>`; }).join('<span class="rl-next">next →</span>') + '<span class="rl-next">null</span>' : '<span class="fn-meta">no hooks</span>'}</div></div>`).join('');
  }

  function logTab(i, trace) {
    const rows = [];
    for (let n = 0; n <= i && n < trace.length; n++) {
      const t = trace[n];
      if (t.kind !== 'react') continue;
      rows.push(`<button class="rl-log${n === i ? ' on' : ''}" data-step="${n}"><small>${n + 1}</small>${t.msg.replace(/<(?!\/?(b|code)>)[^>]+>/g, '')}</button>`);
    }
    return rows.length ? `<div class="rl-logs">${rows.slice(-120).join('')}</div>` : '<div class="empty">React has not done anything yet.</div>';
  }

  function render(snap, prev, i, trace) {
    const panel = $('reactPanel');
    if (!panel) return;
    const dk = snap.reactDetail && snap.reactDetail.kind;
    document.body.dataset.stage = snap.kind !== 'react' ? 'code' : dk === 'commit' || dk === 'swap' || dk === 'paint' ? 'react-page' : 'react';
    const show = document.getElementById('coachShow');
    if (show) show.textContent = !document.body.classList.contains('course-stage') ? '' : document.body.dataset.stage === 'code' ? '📍 Showing: your code' : document.body.dataset.stage === 'react' ? '📍 Showing: React inside' : '📍 Showing: React changing the page';
    if (!snap.react) {
      const any = trace.some(t => t.react);
      panel.classList.toggle('hidden', !any);
      if (any) { $('rlStages').innerHTML = stagesHTML('idle', null); $('reactBody').innerHTML = '<div class="empty">React has not started yet: <code>createRoot</code> creates it.</div>'; }
      return;
    }
    panel.classList.remove('hidden');
    UI.last = { snap, prev, i, trace };
    const stage = stageOf(snap);
    $('rlStages').innerHTML = stagesHTML(stage, snap.react.lane);
    document.querySelectorAll('#reactPanel [data-rtab]').forEach(b => b.classList.toggle('on', b.dataset.rtab === UI.tab));
    const body = $('reactBody');
    body.innerHTML = UI.tab === 'inside' && window.ReactInside ? window.ReactInside.render(snap, i, trace, prev) : UI.tab === 'hooks' ? hooksTab(snap, prev) : UI.tab === 'log' ? logTab(i, trace) : fibersTab(snap, prev);
    const now = body.querySelector('.fb.now, .rl-comp.now, .rl-log.on');
    if (now) now.scrollIntoView({ block: 'nearest' });
  }
  function stagesHTML(stage, lane) {
    return STAGES.map(s => `<span class="rl-stage${s.id === stage ? ' on' : ''} st-${s.id}" title="${esc(s.tip)}">${esc(s.label)}${s.id === stage && lane && s.id === 'render' ? ` <small>${esc(lane)}</small>` : ''}</span>`).join('<i class="rl-arrow">→</i>');
  }
  function rerender() { if (UI.last) render(UI.last.snap, null, UI.last.i, UI.last.trace); }

  document.addEventListener('click', e => {
    const tab = e.target.closest('#reactPanel [data-rtab]');
    if (tab) { UI.tab = tab.dataset.rtab; put('tab2', UI.tab); rerender(); return; }
    const tr = e.target.closest('#reactPanel [data-tree]');
    if (tr) { UI.tree = tr.dataset.tree; rerender(); return; }
    const st = e.target.closest('#reactPanel [data-step]');
    if (st && window.JSLabGo) window.JSLabGo(+st.dataset.step);
    // jump to the previous / next step where React itself works
    const jump = e.target.closest('#reactPanel [data-rjump]');
    if (jump && window.JSLabGo && UI.last) {
      const dir = +jump.dataset.rjump, tr = UI.last.trace;
      for (let k = UI.last.i + dir; k >= 0 && k < tr.length; k += dir) if (tr[k].kind === 'react') { window.JSLabGo(k); break; }
    }
  });

  window.ReactPanel = { render };
})();
