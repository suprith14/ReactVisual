/*
 * React Engine Lab — every React concept in one straight list.
 * The header button opens the list; clicking a concept runs its code at once.
 * A small pill on the lesson line goes to the previous / next concept.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const api = () => window.JSLabAPI;

  // the order: the course data's units, flattened (each unit title becomes a small group heading)
  const GROUPS = (window.REACT_COURSE || []).filter(u => u.lessons.length).map(u => ({ title: u.title, lessons: u.lessons.slice() }));
  const ORDER = GROUPS.flatMap(g => g.lessons);
  const LV = () => window.REACT_LEVELS || [];
  const lesson = id => LV().find(l => l.id === id);
  const current = () => { const id = api() && api().currentLessonId(); return ORDER.indexOf(id); };

  function open(i) {
    if (i < 0 || i >= ORDER.length) return;
    const m = $('conceptList');
    if (m) m.classList.add('hidden');
    api().openLesson(ORDER[i]);
    setTimeout(pill, 0);
  }

  // ------------------------------------------------------------------ the list
  function ensureModal() {
    let m = $('conceptList');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'conceptList';
    m.className = 'modal hidden';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-label', 'React concepts');
    m.innerHTML = '<div class="modal-card cl-card"><button class="close" data-clclose aria-label="Close">✕</button><div class="cbody"></div></div>';
    document.body.appendChild(m);
    return m;
  }
  function showList() {
    const m = ensureModal(), now = current();
    let n = 0;
    const html = GROUPS.map(g => `<h3 class="cl-group">${esc(g.title)}</h3>` + g.lessons.map(id => {
      const i = n++, l = lesson(id);
      if (!l) return '';
      return `<button class="cl-item${i === now ? ' now' : ''}" data-ci="${i}"><span class="cl-n">${i + 1}</span><span class="cl-t"><b>${esc(l.title)}</b><small>${esc(l.goal || '')}</small></span></button>`;
    }).join('')).join('');
    m.querySelector('.cbody').innerHTML = `<h2 class="modal-title">⚛️ React concepts</h2><p class="cl-intro">${ORDER.length} concepts, from the basics to the internals. Click one: its code runs and you step through what React does.</p>${html}`;
    m.classList.remove('hidden');
    const cur = m.querySelector('.cl-item.now');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ------------------------------------------------------------------ the pill: ◀ n / total ▶ ☰
  function pill() {
    let p = $('coach');
    if (!p) {
      p = document.createElement('div');
      p.id = 'coach';
      p.className = 'coach hidden';
      p.setAttribute('role', 'group');
      p.setAttribute('aria-label', 'React concepts');
      const anchor = document.querySelector('.phasebar .level-info');
      if (!anchor) return;
      anchor.parentNode.insertBefore(p, anchor.nextSibling);
    }
    const i = current();
    if (i < 0) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    p.innerHTML = `<button class="btn small" id="cPrev" title="Previous concept"${i === 0 ? ' disabled' : ''}>◀</button>
      <button class="coach-now" id="cList" title="All React concepts">Concept ${i + 1} / ${ORDER.length}</button>
      <button class="btn small primary" id="cNext" title="Next concept"${i === ORDER.length - 1 ? ' disabled' : ''}>▶</button>`;
  }

  function resume() {
    if (!$('btnCourse')) {
      const b = document.createElement('button');
      b.id = 'btnCourse';
      b.className = 'btn primary';
      b.textContent = '⚛️ React concepts';
      b.title = 'Every React concept in one list';
      const ref = $('btnInterview');
      ref.parentNode.insertBefore(b, ref);
    }
    pill();
    // the pill follows whatever lesson is loaded
    const title = $('levelTitle');
    if (title && window.MutationObserver) new MutationObserver(pill).observe(title, { childList: true, characterData: true, subtree: true });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#btnCourse') || t.closest('#cList')) { showList(); return; }
    if (t.closest('#cPrev')) { open(current() - 1); return; }
    if (t.closest('#cNext')) { open(current() + 1); return; }
    const item = t.closest('.cl-item');
    if (item) { open(+item.dataset.ci); return; }
    if (t.closest('[data-clclose]')) $('conceptList').classList.add('hidden');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = $('conceptList'); if (m) m.classList.add('hidden'); } });

  window.ReactConcepts = { ORDER, GROUPS, showList, open, resume, current };
})();
