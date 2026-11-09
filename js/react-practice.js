/*
 * React Engine Lab — interview practice: one list of every hands-on React task.
 *   🎯 predict: read the code, type what it prints, check it (then step through React's work)
 *   ✍️ write:   implement it yourself until Check solution passes
 *   🧩 build:   the machine-coding round: build a component from a task description
 * Theory cards are not in the list; each task has a "need a hint?" link to the matching React concept.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const api = () => window.JSLabAPI;

  // topics in learning order, each with the concept a hint opens
  const TOPICS = [
    ['React: rendering', 'r-firstrender'], ['React: state & batching', 'r-state'], ['React: events & forms', 'r-events'],
    ['React: reconciliation & keys', 'r-reconcile'], ['React: hooks', 'r-hookslist'], ['React: effects', 'r-effect'],
    ['React: context', 'r-context'], ['React: performance', 'r-memo'], ['React: refs, portals & advanced APIs', 'r-portal'],
    ['React: class components', 'r-class'], ['React: errors & Suspense', 'r-boundary'], ['React: concurrency', 'r-transition'],
    ['React 19 & concurrent', 'r-actionstate'], ['React: forms', 'r-forms'], ['React: SSR & hydration', 'r-ssr'],
    ['React: ecosystem patterns', 'r-store'], ['React: TypeScript', 'r-typescript'], ['React: implement it', 'r-customhook'],
    ['React: find the bug', 'r-overview'], ['React: tricky output', 'r-batching'], ['Machine coding round', null],
  ];
  const KIND = { predict: ['🎯', 'predict the output'], write: ['✍️', 'write the code'], build: ['🧩', 'build the component'] };
  const RANK = { Easy: 1, Medium: 2, Hard: 3 };
  const label = t => t.replace(/^React: /, '').replace(/^React 19/, 'React 19');

  let groups = null, order = null;
  function build() {
    if (order) return;
    const byTopic = new Map(TOPICS.map(([t]) => [t, []]));
    const topicOf = t => { if (!byTopic.has(t)) byTopic.set(t, []); return byTopic.get(t); };
    (window.REACT_IV || []).filter(q => q.kind !== 'theory' && q.code).forEach(q => {
      const write = api().canWrite(q);
      topicOf(q.cat).push({ key: (write ? 'w:' : 'q:') + q.id, kind: write ? 'write' : 'predict', id: q.id, title: q.title, ask: q.ask || '', rank: RANK[q.level] || 2, topic: q.cat });
    });
    (window.REACT_CHALLENGES || []).forEach(c => {
      topicOf('Machine coding round').push({ key: 'c:' + c.id, kind: 'build', id: c.id, title: c.title.replace(/^React: /, ''), ask: String(c.task || '').replace(/<[^>]+>/g, '').slice(0, 110), rank: typeof c.difficulty === 'number' ? c.difficulty : 2, topic: 'Machine coding round', lesson: c.concept });
    });
    const hint = new Map(TOPICS);
    groups = [];
    byTopic.forEach((items, topic) => {
      if (!items.length) return;
      items.sort((a, b) => a.rank - b.rank);
      items.forEach(x => { if (!x.lesson) x.lesson = hint.get(topic) || null; });
      groups.push({ topic, items });
    });
    order = groups.flatMap(g => g.items);
  }
  const current = () => { const k = api() && api().currentKey(); return order ? order.findIndex(x => x.key === k) : -1; };

  function open(i) {
    build();
    const t = order[i];
    if (!t) return;
    const m = $('practiceList');
    if (m) m.classList.add('hidden');
    if (t.kind === 'predict') api().openPredict(t.id);
    else if (t.kind === 'write') api().openWriteIt(t.id);
    else api().openChallenge(t.id);
    setTimeout(pill, 0);
  }

  function showList() {
    build();
    let m = $('practiceList');
    if (!m) {
      m = document.createElement('div');
      m.id = 'practiceList';
      m.className = 'modal hidden';
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-label', 'React practice');
      m.innerHTML = '<div class="modal-card pl-card"><button class="close" data-plclose aria-label="Close">✕</button><div class="cbody"></div></div>';
      document.body.appendChild(m);
    }
    const now = current();
    let n = 0;
    const html = groups.map(g => `<h3 class="pl-group">${esc(label(g.topic))}</h3>` + g.items.map(t => {
      const i = n++;
      return `<button class="pl-item${i === now ? ' now' : ''}" data-pi="${i}"><span class="pl-n">${i + 1}</span><span class="pl-k" title="${esc(KIND[t.kind][1])}">${KIND[t.kind][0]}</span><span class="pl-t"><b>${esc(t.title)}</b><small>${esc(KIND[t.kind][1])} · ${esc(t.ask)}</small></span></button>`;
    }).join('')).join('');
    m.querySelector('.cbody').innerHTML = `<h2 class="modal-title">🏋️ React practice</h2>
      <p class="pl-intro">${order.length} interview tasks. 🎯 predict what React prints · ✍️ write it yourself · 🧩 build a component (the machine-coding round). Check your answer, then press ▶ to watch React do it.</p>${html}`;
    m.classList.remove('hidden');
    const cur = m.querySelector('.pl-item.now');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  function pill() {
    build();
    let p = $('practicePill');
    if (!p) {
      p = document.createElement('div');
      p.id = 'practicePill';
      p.className = 'pp hidden';
      p.setAttribute('role', 'group');
      p.setAttribute('aria-label', 'React practice');
      const anchor = document.querySelector('.phasebar .level-info');
      if (!anchor) return;
      anchor.parentNode.insertBefore(p, anchor.nextSibling);
    }
    const i = current();
    if (i < 0) { p.classList.add('hidden'); return; }
    const t = order[i];
    p.classList.remove('hidden');
    p.innerHTML = `<button class="btn small" id="ppPrev" title="Previous task"${i === 0 ? ' disabled' : ''}>◀</button>
      <button class="pp-now" id="ppList" title="All practice tasks">${KIND[t.kind][0]} Task ${i + 1} / ${order.length}</button>
      <button class="btn small primary" id="ppNext" title="Next task"${i === order.length - 1 ? ' disabled' : ''}>▶</button>
      ${t.lesson ? '<button class="pp-hint" id="ppHint" title="Open the React concept about this">💡 need a hint?</button>' : ''}`;
  }

  function resume() {
    if (!$('btnPractice')) {
      const b = document.createElement('button');
      b.id = 'btnPractice';
      b.className = 'btn primary';
      b.textContent = '🏋️ Practice';
      b.title = 'Every React interview task in one list';
      const ref = $('btnInterview');
      ref.parentNode.insertBefore(b, ref);
      // the React path window (cheat sheet, interview day, system design) is opened from here
      const g = document.createElement('button');
      g.id = 'btnGuides';
      g.className = 'btn';
      g.textContent = '📚 Guides';
      g.title = 'Cheat sheet, interview day checklist and React system design';
      ref.parentNode.insertBefore(g, ref);
    }
    pill();
    const title = $('levelTitle');
    if (title && window.MutationObserver) new MutationObserver(pill).observe(title, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#btnPractice') || t.closest('#ppList')) { showList(); return; }
    if (t.closest('#ppPrev')) { open(current() - 1); return; }
    if (t.closest('#ppNext')) { open(current() + 1); return; }
    if (t.closest('#ppHint')) { const x = order[current()]; if (x && x.lesson) api().showLesson(x.lesson); return; }
    const item = t.closest('.pl-item');
    if (item) { open(+item.dataset.pi); return; }
    if (t.closest('[data-plclose]')) $('practiceList').classList.add('hidden');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('practiceList'); if (m) m.classList.add('hidden'); } });

  window.ReactPractice = { showList, open, resume, list: () => { build(); return order; } };
})();
