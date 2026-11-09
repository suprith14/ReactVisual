/*
 * JS Engine Lab — engine part: the browser environment.
 *
 *  - a real DOM (a hidden HTML document) with full CSS selectors, events that bubble, classList, style, attributes
 *  - real network requests: the app fetches every real URL once, then re-runs the program with the answers
 *  - alert / confirm / prompt: the user answers once, the answer is replayed
 *  - localStorage / sessionStorage, navigator, location, XMLHttpRequest
 *
 * Programs are recorded first and replayed afterwards (that is what makes stepping backward possible),
 * so anything that comes from outside — network data, dialog answers, clicks — is collected by the app
 * and handed to the engine in `opts` before the final run.
 */
(function () {
  'use strict';
  const { CONSTRUCT, esc, code, trunc, JSObject, Accessor } = window.JSEngine.internals;

  const DEFAULT_PAGE = '<h1 id="title">My Page</h1>\n<button id="btn">Click me</button>\n<input id="name" placeholder="Your name">\n<p id="output"></p>';
  const PRIMITIVE_PROPS = new Set(['id', 'className', 'textContent', 'innerText', 'innerHTML', 'outerHTML', 'value', 'checked', 'disabled', 'hidden', 'title', 'href', 'src', 'alt', 'placeholder', 'type', 'name', 'tagName', 'nodeName', 'nodeType', 'childElementCount', 'selectedIndex', 'tabIndex', 'lang', 'dir']);
  const NODE_PROPS = new Set(['parentElement', 'parentNode', 'firstChild', 'lastChild', 'nextSibling', 'previousSibling', 'firstElementChild', 'lastElementChild', 'nextElementSibling', 'previousElementSibling', 'body', 'head', 'documentElement', 'activeElement']);
  const LIST_PROPS = new Set(['children', 'childNodes']);

  window.JSEngine.mixin(class {
    setupBrowser() {
      const I = this, B = this.builtins, o = this.opts;
      this.netMisses = [];
      this.dialogMisses = [];
      this.dialogIdx = 0;
      this.nodeObjs = new Map();
      this.listeners = new Map();

      // ---- the page: a real (hidden) HTML document
      const doc = document.implementation.createHTMLDocument('My Page');
      doc.body.innerHTML = o.pageHTML != null ? o.pageHTML : DEFAULT_PAGE;
      this.page = { doc, touched: o.pageHTML != null };
      // `document` itself is a built-in (not shown in the Heap); elements are wrapped when the program touches them
      const docObj = new JSObject(-1, 'object');
      docObj.domNode = doc; docObj.hidden = true; docObj.label = 'document'; docObj.ctorName = 'HTMLDocument';
      this.nodeObjs.set(doc, docObj);
      B.set('document', docObj);
      B.set('Event', this.eventCtor('Event'));
      B.set('CustomEvent', this.eventCtor('CustomEvent'));

      // scripted user actions (visualizer helpers) and clicks the user made in the page preview
      const schedule = (type, target, delay, node, value, fromUser) => {
        this.page.touched = true;
        // a selector is looked up again when the event happens: the element may not exist yet (e.g. React renders it later)
        let el = typeof target === 'string' ? doc.querySelector(target) : target;
        if (!el && !this.reactWanted) throw this.makeError('TypeError', `No element matches ${target}`, node);
        const label = el ? this.describeNode(el) : String(target);
        const t = { id: ++this.timerSeq, cb: null, args: [], delay, start: this.time, fireAt: this.time + delay, label: `${type} on ${label}${fromUser ? ' (you)' : ''}`, kind: 'event' };
        t.doneMsg = () => `🖱️ Time is now <b>${this.time}ms</b>: the user ${type === 'click' ? 'clicks' : 'types into'} ${code(label)}! The browser puts a <b>"${type}" event task</b> in the Callback Queue.`;
        t.internal = () => {
          if (typeof target === 'string') el = doc.querySelector(target) || (el && el.isConnected ? el : null);
          if (!el) { this.record(null, `🤷 Nothing on the page matches ${code(target)} any more, so the ${esc(type)} does nothing.`, 'eventloop'); return; }
          if (value !== undefined) el.value = value;
          this.dispatch(el, type, null, 'queue');
        };
        this.webApis.push(t);
        this.badge('dom');
        if (!fromUser) this.record(node, `🎬 (Visualizer helper) Pretend the user will ${type === 'click' ? 'click' : 'type into'} ${code(label)} at ${this.time + delay}ms.`, 'webapi');
      };
      B.set('simulateClick', this.native('simulateClick', (s, a, node) => schedule('click', I.toStr(a[0]), a[1] === undefined ? 0 : I.toNumber(a[1]), node)));
      B.set('simulateTyping', this.native('simulateTyping', (s, a, node) => schedule('input', I.toStr(a[0]), a[2] === undefined ? 0 : I.toNumber(a[2]), node, I.toStr(a[1]))));
      this.userEvents = (o.events || []).slice();

      // ---- dialogs: the first time, the app asks the real user; afterwards the answer is replayed
      const dialog = kind => this.native(kind, function (s, a, node) {
        const message = a.length ? this.toStr(a[0]) : '';
        const idx = this.dialogIdx++;
        let answer = (o.answers || [])[idx];
        if (answer === undefined) {
          this.dialogMisses.push({ kind, message, def: kind === 'prompt' && a.length > 1 ? this.toStr(a[1]) : '' });
          answer = kind === 'confirm' ? false : kind === 'prompt' ? null : true;
        }
        const value = kind === 'alert' ? undefined : answer;
        this.page.dialog = { kind, message, answer: kind === 'alert' ? 'OK' : String(value) };
        this.badge('dom');
        this.record(node, `🔔 <code>${kind}()</code> opens a dialog and <b>blocks</b> all JavaScript until the user responds — nothing else can run, not even timers. ${kind === 'alert' ? 'The user pressed OK.' : `The user answered ${this.valText(value)}.`}`, 'webapi');
        this.page.dialog = null;
        return value;
      });
      ['alert', 'confirm', 'prompt'].forEach(k => B.set(k, dialog(k)));

      // ---- storage: localStorage survives between runs (the app saves it), sessionStorage does not
      this.storageOut = Object.assign({}, o.storage || {});
      B.set('localStorage', this.makeStorage('localStorage', this.storageOut));
      B.set('sessionStorage', this.makeStorage('sessionStorage', {}));

      // ---- navigator & location (read from the real browser where it makes sense)
      const nav = this.hiddenObj('navigator', {
        language: navigator.language, userAgent: navigator.userAgent, onLine: true,
        hardwareConcurrency: navigator.hardwareConcurrency || 4, platform: navigator.platform || '', cookieEnabled: true,
      });
      nav.props.set('languages', new Accessor(this.native('get languages', () => I.makeArray((navigator.languages || [navigator.language]).slice())), null));
      B.set('navigator', nav);
      const loc = { href: 'https://my-page.example/index.html', origin: 'https://my-page.example', protocol: 'https:', host: 'my-page.example', hostname: 'my-page.example', pathname: '/index.html', search: '', hash: '' };
      const locObj = this.hiddenObj('location', loc);
      locObj.props.set('reload', this.native('reload', function (s, a, node) { this.record(node, '🔄 <code>location.reload()</code> would restart the page. (Not simulated: the program keeps running.)', 'webapi'); }));
      locObj.props.set('assign', this.native('assign', function (s, a, node) { this.record(node, `🧭 Navigating to ${code(this.toStr(a[0]))} would leave this page. (Not simulated.)`, 'webapi'); }));
      B.set('location', locObj);

      // ---- XMLHttpRequest: the older callback-style network API
      B.set('XMLHttpRequest', this.native('XMLHttpRequest', function (s) {
        if (s !== CONSTRUCT) throw this.makeError('TypeError', "Failed to construct 'XMLHttpRequest': Please use the 'new' operator", null);
        return this.makeXHR();
      }, { isCtor: true }));
    }

    // clicks / typing the user did in the page preview become event tasks at the time they happened
    registerUserEvents() {
      (this.opts.events || []).forEach(ev => {
        const t = { id: ++this.timerSeq, cb: null, args: [], delay: ev.at, start: 0, fireAt: ev.at, label: `${ev.type} (you)`, kind: 'event' };
        t.doneMsg = () => `🖱️ Time is now <b>${this.time}ms</b>: <b>you</b> ${ev.type === 'click' ? 'clicked' : 'typed into'} the page. The browser puts a "${ev.type}" event task in the Callback Queue.`;
        t.internal = () => {
          const el = this.nodeAtPath(ev.path);
          if (!el) { this.record(null, '🖱️ The element you clicked is no longer on the page, so nothing happens.', 'eventloop'); return; }
          if (ev.value !== undefined) el.value = ev.value;
          this.dispatch(el, ev.type, null, 'queue');
        };
        this.webApis.push(t);
        this.page.touched = true;
      });
    }
    nodeAtPath(path) {
      let n = this.page.doc.body;
      for (const i of path) { n = n && n.children[i]; }
      return n || null;
    }

    // ======================================================== DOM wrappers
    wrapNode(n) {
      if (n == null) return null;
      if (this.nodeObjs.has(n)) return this.nodeObjs.get(n);
      const o = this.alloc('object');
      o.ctorName = n.nodeType === 9 ? 'HTMLDocument' : n.nodeType === 3 ? 'Text' : n.constructor.name;
      o.domNode = n;
      this.nodeObjs.set(n, o);
      return o;
    }
    unwrap(v) {
      if (v instanceof JSObject && v.domNode) return v.domNode;
      return this.natArg(v);
    }
    describeNode(n) {
      if (!n || n.nodeType !== 1) return n && n.nodeType === 9 ? 'document' : 'node';
      return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].join('.') : '');
    }
    wrapResult(r) {
      if (r instanceof Node) return this.wrapNode(r);
      if (r instanceof NodeList || r instanceof HTMLCollection) return this.makeArray([...r].filter(x => x.nodeType === 1 || x.nodeType === 3).map(x => this.wrapNode(x)));
      if (r && typeof r === 'object') return this.fromNative(JSON.parse(JSON.stringify(r)));
      return r;
    }

    domGet(obj, key, node) {
      const n = obj.domNode, I = this;
      if (typeof key !== 'string') return undefined;
      if (key === 'addEventListener') {
        return this.method('dom', 'addEventListener', function (self, a, call) {
          const type = this.toStr(a[0]);
          if (!this.isCallable(a[1])) throw this.makeError('TypeError', 'The listener must be a function', call);
          const opt = a[2] instanceof JSObject ? this.natArg(a[2]) : { capture: !!a[2] };
          const list = this.listeners.get(self.domNode) || [];
          list.push({ type, fn: a[1], once: !!opt.once, capture: !!opt.capture });
          this.listeners.set(self.domNode, list);
          this.page.touched = true;
          this.badge('dom');
          this.record(call, `👂 <code>addEventListener</code> registers ${code(this.fnLabel(a[1]))} as a <b>"${esc(type)}"</b> listener on ${code(this.describeNode(self.domNode))}. It does not run now: the browser will queue it whenever that event happens${self.domNode.children && self.domNode.children.length ? ' here or on any element inside it (events <b>bubble</b> up)' : ''}.`, 'webapi');
        });
      }
      if (key === 'removeEventListener') return this.method('dom', 'removeEventListener', (self, a) => { const l = this.listeners.get(self.domNode) || []; this.listeners.set(self.domNode, l.filter(x => !(x.type === I.toStr(a[0]) && x.fn === a[1]))); });
      if (key === 'click') return this.method('dom', 'click', function (self, a, call) {
        this.record(call, `🖱️ <code>.click()</code> fires the click event <b>right now</b>: the listeners run synchronously, not through the queue.`, 'native');
        this.dispatch(self.domNode, 'click', null, null, call);
      });
      if (key === 'dispatchEvent') return this.method('dom', 'dispatchEvent', function (self, a, call) {
        const ev = a[0];
        this.dispatch(self.domNode, this.toStr(this.getMember(ev, 'type')), ev, null, call);
        return !ev.defaultPrevented;
      });
      if (key === 'classList' && n.classList) return this.domList(obj, 'classList');
      if (key === 'style' && n.style) return this.domList(obj, 'style');
      if (key === 'dataset' && n.dataset) return this.fromNative(Object.assign({}, n.dataset));
      if (PRIMITIVE_PROPS.has(key) || (key in n && ['string', 'number', 'boolean'].includes(typeof n[key]) && !/^on/.test(key))) return n[key];
      if (NODE_PROPS.has(key)) return this.wrapNode(n[key]);
      if (LIST_PROPS.has(key)) return this.wrapResult(n[key]);
      if (typeof n[key] === 'function') {
        return this.method('dom', key, function (self, a, call) {
          let r;
          try { r = self.domNode[key](...a.map(x => this.unwrap(x))); }
          catch (e) { throw this.makeError(e.name === 'SyntaxError' ? 'SyntaxError' : 'TypeError', e.message, call); }
          if (/^(append|prepend|appendChild|insertBefore|replaceChildren|remove|removeChild|replaceWith|before|after|insertAdjacent|setAttribute|removeAttribute|toggleAttribute)/.test(key)) {
            this.page.touched = true;
            this.changedProp = { id: self.id, key: 'html' };
            this.record(call, `🧩 <code>.${esc(key)}()</code> changes the <b>DOM</b> — the page updates right away.`, 'heap');
          }
          if (key === 'createElement' || key === 'createTextNode') this.record(call, `🧱 <code>document.${key}</code> makes a new ${code(this.describeNode(r))} #${this.wrapNode(r).id}. It exists in memory but is <b>not on the page</b> until you append it.`, 'heap');
          return this.wrapResult(r);
        });
      }
      return undefined;
    }

    domSet(obj, key, value, node) {
      const n = obj.domNode;
      if (typeof key !== 'string' || !(key in n) || typeof n[key] === 'function') { obj.props.set(key, value); return; }
      if (/^on/.test(key)) { // el.onclick = fn — same as a single listener
        const list = (this.listeners.get(n) || []).filter(l => !l.prop || l.type !== key.slice(2));
        if (this.isCallable(value)) list.push({ type: key.slice(2), fn: value, prop: true });
        this.listeners.set(n, list);
        this.page.touched = true;
        this.record(node, `👂 Setting ${code(key)} registers a "${esc(key.slice(2))}" handler on ${code(this.describeNode(n))}.`, 'webapi');
        return;
      }
      n[key] = value instanceof JSObject ? this.unwrap(value) : value;
      this.page.touched = true;
      this.changedProp = { id: obj.id, key: 'html' };
      this.record(node, `🖌️ Setting ${code(key)} on ${code(this.describeNode(n))} changes what the page shows → ${code(trunc(String(n[key]), 40))}`, 'heap');
    }

    // classList / style: small live views onto the real element
    domList(obj, which) {
      const key = which + '#' + obj.id;
      if (this.cache.has(key)) return this.cache.get(key);
      const v = this.alloc('object');
      v.ctorName = which === 'style' ? 'CSSStyleDeclaration' : 'DOMTokenList';
      v.domView = { el: obj.domNode, which, owner: obj };
      this.cache.set(key, v);
      return v;
    }
    domViewGet(v, key) {
      const { el, which, owner } = v.domView;
      if (which === 'style') return typeof key === 'string' && typeof el.style[key] === 'string' ? el.style[key] : undefined;
      if (key === 'length') return el.classList.length;
      if (['add', 'remove', 'toggle', 'contains', 'replace'].includes(key)) {
        return this.method('classList', key, function (self, a, call) {
          const r = self.domView.el.classList[key](...a.map(x => this.toStr(x)));
          if (key !== 'contains') { this.page.touched = true; this.changedProp = { id: owner.id, key: 'html' }; this.record(call, `🎨 <code>classList.${key}</code> → class is now ${code(self.domView.el.className || '(none)')}`, 'heap'); }
          return r;
        });
      }
      return undefined;
    }
    domViewSet(v, key, value, node) {
      const { el, which, owner } = v.domView;
      if (which !== 'style') return;
      el.style[key] = this.toStr(value);
      this.page.touched = true;
      this.changedProp = { id: owner.id, key: 'html' };
      this.record(node, `🎨 <code>style.${esc(key)}</code> = ${code(this.toStr(value))} on ${code(this.describeNode(el))}.`, 'heap');
    }

    eventCtor(name) {
      return this.native(name, function (s, a) {
        const ev = this.alloc('object');
        ev.ctorName = name;
        ev.props.set('type', this.toStr(a[0]));
        const init = a[1] instanceof JSObject ? a[1] : null;
        ev.props.set('bubbles', init ? this.truthy(this.getMember(init, 'bubbles')) : false);
        if (name === 'CustomEvent') ev.props.set('detail', init ? this.getMember(init, 'detail') : null);
        return ev;
      }, { isCtor: true });
    }

    // run the listeners for an event: target first, then each ancestor (bubbling)
    dispatch(el, type, ev, how, callNode) {
      // browsers do not fire mouse clicks on disabled form controls
      if (type === 'click' && el.disabled) {
        this.record(callNode || null, `🚫 ${code(this.describeNode(el))} is <b>disabled</b>, so the browser fires no click event at all.`, how === 'queue' ? 'eventloop' : 'native');
        return;
      }
      if (!ev) {
        ev = this.alloc('object');
        ev.ctorName = type === 'click' ? 'PointerEvent' : type === 'input' ? 'InputEvent' : 'Event';
        ev.props.set('type', type);
        ev.props.set('bubbles', true);
      }
      const bubbles = this.truthy(ev.props.get('bubbles'));
      ev.props.set('target', this.wrapNode(el));
      ev.props.set('timeStamp', this.time);
      ev.props.set('preventDefault', this.native('preventDefault', () => { ev.defaultPrevented = true; ev.props.set('defaultPrevented', true); }));
      ev.props.set('stopPropagation', this.native('stopPropagation', () => { ev.stopped = true; }));
      const path = [];
      for (let n = el; n; n = n.parentNode) path.push(n);
      const lsOf = (n, pick) => (this.listeners.get(n) || []).filter(l => l.type === type && pick(l));
      // capture phase (window → parent of target), target phase, then bubble phase (parent → window)
      const hits = [
        ...path.slice(1).reverse().map(n => ({ n, phase: 'capture', ls: lsOf(n, l => l.capture) })),
        { n: el, phase: 'target', ls: lsOf(el, () => true) },
        ...(bubbles ? path.slice(1).map(n => ({ n, phase: 'bubble', ls: lsOf(n, l => !l.capture) })) : []),
      ].filter(h => h.ls.length);
      if (how === 'queue') {
        const total = hits.reduce((s, h) => s + h.ls.length, 0);
        this.record(null, total
          ? `🖱️ The "${esc(type)}" event task runs on ${code(this.describeNode(el))}. ${total} listener${total > 1 ? 's' : ''} will be called with event object #${ev.id}${hits.some(h => h.n !== el) ? ' — some sit on <b>parent</b> elements and are reached by <b>bubbling</b>' : ''}.`
          : `🖱️ The "${esc(type)}" event happens on ${code(this.describeNode(el))}, but <b>nobody is listening</b> — nothing runs.`, 'eventloop');
      }
      for (const h of hits) {
        if (h.phase === 'capture') this.record(callNode || null, `⬇️ <b>Capture phase</b>: before reaching ${code(this.describeNode(el))}, the event travels <b>down</b> through ${code(this.describeNode(h.n))}, which listens with <code>capture: true</code>.`, 'native');
        else if (h.n !== el) this.record(callNode || null, `🫧 The event <b>bubbles up</b> from ${code(this.describeNode(el))} to ${code(this.describeNode(h.n))}, where a listener is waiting. <code>event.target</code> is still the element that was clicked — this is how <b>event delegation</b> works.`, 'native');
        ev.props.set('currentTarget', this.wrapNode(h.n));
        for (const l of h.ls) {
          if (l.once) this.listeners.set(h.n, (this.listeners.get(h.n) || []).filter(x => x !== l));
          this.callFunction(l.fn, this.wrapNode(h.n), [ev], l.fn.node || callNode || null, how || undefined);
        }
        if (ev.stopped) { this.record(null, '✋ <code>stopPropagation()</code> was called, so the event goes no further.', 'flow'); break; }
      }
      // default action: clicking a submit button inside a form submits the form (a "submit" event)
      if (type === 'click' && !ev.defaultPrevented && el.closest) {
        const btn = el.closest('button, input[type="submit"]');
        const form = btn && btn.closest('form');
        if (form && (btn.tagName !== 'BUTTON' || (btn.getAttribute('type') || 'submit').toLowerCase() === 'submit')) {
          this.record(callNode || null, `📨 The clicked button is inside a <code>&lt;form&gt;</code>, so the browser's <b>default action</b> is to submit it: a <b>"submit"</b> event is fired on the form (call <code>event.preventDefault()</code> to stop the page from reloading).`, 'native');
          this.dispatch(form, 'submit', null, how, callNode);
        }
      }
    }

    // a copy of the page for this step, with elements that have listeners marked
    serPage() {
      if (!this.page || !this.page.touched) return null;
      const doc = this.page.doc;
      const clone = doc.body.cloneNode(true);
      const a = [doc.body, ...doc.body.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
      a.forEach((n, i) => {
        const l = this.listeners.get(n);
        if (l && l.length && b[i] && b[i].setAttribute) b[i].setAttribute('data-jsl', [...new Set(l.map(x => x.type))].join(' '));
        const w = this.nodeObjs.get(n);
        if (w && b[i] && b[i].setAttribute) b[i].setAttribute('data-ref', w.id);
        // the element React changes in this commit step (the visualizer outlines it and links it to its fiber)
        const hit = this.rx && this.rx.hit;
        if (hit && n === hit.node && b[i] && b[i].setAttribute) b[i].setAttribute('data-react-hit', hit.op);
      });
      let html = clone.innerHTML;
      if (html.length > 30000) html = html.slice(0, 30000) + '<p>… (page truncated)</p>';
      const storage = this.storageTouched ? Object.entries(this.storageOut).slice(0, 20) : null;
      return { html, title: doc.title, dialog: this.page.dialog || null, storage };
    }

    // ======================================================== storage
    makeStorage(name, data) {
      const st = this.hiddenObj(name, {});
      st.isStorage = true; st.storeData = data; st.storeName = name;
      return st;
    }
    storageGet(st, key) {
      const I = this, d = st.storeData;
      const methods = {
        getItem: (s, a) => { I.storageTouched = true; const k = I.toStr(a[0]); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
        setItem: function (s, a, node) { this.storageTouched = true; const k = this.toStr(a[0]); d[k] = this.toStr(a[1]); this.record(node, `💾 <code>${st.storeName}.setItem</code> saves ${code(k)} = ${code(trunc(d[k], 40))}. Values are always stored as <b>strings</b>${st.storeName === 'localStorage' ? ', and localStorage keeps them even after the page is closed (run this again and it is still there)' : ''}.`, 'heap'); },
        removeItem: (s, a) => { I.storageTouched = true; delete d[I.toStr(a[0])]; },
        clear: () => { I.storageTouched = true; Object.keys(d).forEach(k => delete d[k]); },
        key: (s, a) => Object.keys(d)[I.toNumber(a[0])] ?? null,
      };
      if (methods[key]) return this.method(st.storeName, key, methods[key]);
      if (key === 'length') return Object.keys(d).length;
      if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
      return undefined;
    }

    // ======================================================== real network
    realFetch(url, method, headers, body, node) {
      const key = method + ' ' + url + (body ? ' ' + body : '');
      const cache = this.opts.netCache;
      const entry = cache && cache.get(key);
      const p = this.newPromise();
      this.badge('fetch');
      if (!entry) {
        // not fetched yet: the app will fetch it for real and run the program again
        this.netMisses.push({ key, url, method, headers, body });
        this.record(node, `🌐 <code>fetch</code> to the <b>real internet</b>: ${code(method + ' ' + url)}. (Getting the real answer, then replaying…)`, 'webapi');
        return p;
      }
      const delay = Math.max(1, Math.min(entry.latency || 1, 8000));
      const t = { id: ++this.timerSeq, cb: null, args: [], delay, start: this.time, fireAt: this.time + delay, label: `${method} ${trunc(url, 40)}`, kind: 'fetch', refs: [p] };
      t.doneMsg = () => entry.error
        ? `🌐 Time is now <b>${this.time}ms</b>: the request to ${code(url)} <b>failed</b> (${esc(entry.error)}). The browser queues the failure.`
        : `🌐 Time is now <b>${this.time}ms</b>: the real server answered <b>${entry.status}</b> after ${delay}ms. The browser queues a "response arrived" task.`;
      t.internal = () => {
        if (entry.error) {
          this.record(null, `❌ fetch's Promise #${p.id} is <b>rejected</b> with <code>TypeError: Failed to fetch</code>. This usually means no internet connection or the server does not allow requests from other sites (<b>CORS</b>). Unlike HTTP errors (404, 500), network failures <b>do</b> reject.`, 'promise');
          p.alreadyResolved = true;
          this.settle(p, 'rejected', this.makeErrorObj('TypeError', 'Failed to fetch'), null);
          return;
        }
        const r = this.makeRealResponse(url, entry);
        this.record(null, `📬 The network task runs: Response #${r.id} (status ${entry.status}) fulfills fetch's Promise #${p.id}.${entry.status >= 400 ? ' ⚠️ HTTP errors do not reject — check <code>response.ok</code>.' : ''}`, 'promise');
        this.resolvePromise(p, r, null);
      };
      this.webApis.push(t);
      this.bindAbort(t, p, this.fetchOpts, node);
      this.record(node, `🌐 <code>fetch</code> sends ${code(method + ' ' + url)} over the <b>real internet</b> and immediately returns Promise #${p.id}. The real request took ${delay}ms, which is replayed here.`, 'webapi');
      return p;
    }

    makeRealResponse(url, entry) {
      const r = this.alloc('object');
      r.ctorName = 'Response';
      r.props.set('ok', entry.status >= 200 && entry.status < 300);
      r.props.set('status', entry.status);
      r.props.set('statusText', entry.statusText || '');
      r.props.set('url', entry.url || url);
      const hdrs = this.hiddenObj('Headers', {});
      hdrs.props.set('get', this.native('get', (s, a) => { const h = (entry.headers || []).find(x => x[0].toLowerCase() === this.toStr(a[0]).toLowerCase()); return h ? h[1] : null; }));
      r.props.set('headers', hdrs);
      let used = false;
      const reader = (name, conv) => this.native(name, function (s, a, node) {
        if (used) throw this.makeError('TypeError', `Failed to execute '${name}' on 'Response': body stream already read`, node);
        used = true;
        const p = this.newPromise();
        this.record(node, `📖 <code>response.${name}()</code> reads the body (${entry.body.length} characters) and returns another Promise #${p.id}.`, 'promise');
        try { this.resolvePromise(p, conv(), node); }
        catch (e) { p.alreadyResolved = true; this.settle(p, 'rejected', this.makeErrorObj('SyntaxError', `Unexpected token in JSON: ${e.message}`), node); }
        return p;
      });
      r.props.set('json', reader('json', () => this.fromNative(JSON.parse(entry.body))));
      r.props.set('text', reader('text', () => entry.body));
      return r;
    }

    // ======================================================== XMLHttpRequest (built on the same network code)
    makeXHR() {
      const x = this.alloc('object');
      x.ctorName = 'XMLHttpRequest';
      x.props.set('readyState', 0); x.props.set('status', 0); x.props.set('responseText', '');
      const req = {};
      x.props.set('open', this.native('open', (s, a) => { req.method = this.toStr(a[0]).toUpperCase(); req.url = this.toStr(a[1]); x.props.set('readyState', 1); }));
      x.props.set('setRequestHeader', this.native('setRequestHeader', () => {}));
      x.props.set('send', this.native('send', function (s, a, node) {
        const p = this.callFunction(this.builtins.get('fetch'), undefined, [req.url, this.fromNative({ method: req.method, body: a[0] == null ? undefined : this.toStr(a[0]) })], node);
        // when the response arrives, fill in the XHR and call its handlers (callback style)
        this.promiseThen(p, res => {
          const status = this.getMember(res, 'status');
          const textFn = this.getMember(res, 'text');
          const tp = this.callFunction(textFn, res, [], null);
          this.promiseThen(tp, text => {
            x.props.set('status', status); x.props.set('responseText', text); x.props.set('readyState', 4);
            this.changedProp = { id: x.id, key: 'readyState' };
            ['onreadystatechange', 'onload'].forEach(h => { const fn = x.props.get(h); if (this.isCallable(fn)) this.callFunction(fn, x, [], fn.node || null); });
          }, null, null, false, [x], 'XHR body');
        }, err => {
          const fn = x.props.get('onerror');
          if (this.isCallable(fn)) this.callFunction(fn, x, [err], fn.node || null);
        }, null, false, [x], 'XHR response');
      }));
      return x;
    }

    serBrowser(o, base) {
      if (o.domNode) {
        const n = o.domNode;
        if (n.nodeType === 9) return Object.assign(base, { title: 'document', entries: [] });
        const ls = this.listeners.get(n) || [];
        const entries = [];
        if (n.nodeType === 1) {
          entries.push({ k: 'tag', v: { t: 'str', text: '<' + n.tagName.toLowerCase() + '>' } });
          if (n.id) entries.push({ k: 'id', v: this.serValue(n.id) });
          if (n.className) entries.push({ k: 'class', v: this.serValue(n.className) });
          entries.push({ k: 'textContent', v: this.serValue(trunc(n.textContent, 30)) });
          if ('value' in n && n.tagName !== 'BUTTON' && n.tagName !== 'LI') entries.push({ k: 'value', v: this.serValue(n.value) });
          entries.push({ k: 'listeners', v: { t: 'num', text: ls.map(l => l.type).join(', ') || 'none' } });
          entries.push({ k: 'on page', v: this.serValue(this.page.doc.body.contains(n)) });
        } else entries.push({ k: 'text', v: this.serValue(trunc(n.textContent, 30)) });
        return Object.assign(base, { title: o.ctorName, entries });
      }
      if (o.domView) return Object.assign(base, { title: o.ctorName, entries: [{ k: o.domView.which === 'style' ? 'style' : 'classes', v: this.serValue(o.domView.which === 'style' ? o.domView.el.getAttribute('style') || '' : o.domView.el.className) }] });
      return null;
    }

    browserRoots(markV, root) {
      if (!this.page) return;
      const doc = this.page.doc;
      this.nodeObjs.forEach((w, n) => { if (n === doc || doc.body.contains(n)) root(`the page (${this.describeNode(n)})`, () => markV(w)); });
      this.listeners.forEach((ls, n) => { if (n === doc || doc.contains(n)) root(`a listener on ${this.describeNode(n)}`, () => ls.forEach(l => markV(l.fn))); });
    }
  });
})();
