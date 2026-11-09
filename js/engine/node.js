/*
 * JS Engine Lab — engine part: Node.js built-in modules `path`, `fs`, `fs/promises` and `http`.
 *
 *  - path: pure string helpers for file paths (POSIX style, like Linux / macOS)
 *  - fs: a virtual disk. Sync calls block the thread; callback and promise calls are handed to
 *    Node's I/O threads and their results come back in the event loop's POLL phase
 *  - http: createServer + listen, and fetch('http://localhost:PORT/...') reaches that server, so a
 *    whole client + server conversation runs in one program
 *  - data files: `// @file notes.txt` sections are files on the disk (Node) or on the server (browser)
 */
(function () {
  'use strict';
  const { esc, code, trunc, JSObject, ThrowSignal } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { setupNode: P.setupNode, mockFor: P.mockFor, platformGet: P.platformGet, display: P.display, platformRoots: P.platformRoots };
  const CWD = '/home/user/app';
  const clip = t => (t.length > 400 ? t.slice(0, 400) + '…' : t);
  const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 500: 'Internal Server Error' };

  // ---- POSIX path helpers (the same rules Node's `path` module uses on Linux)
  function normalize(p) {
    if (p === '') return '.';
    const abs = p.startsWith('/'), trail = p.endsWith('/');
    const out = [];
    for (const part of p.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!abs) out.push('..'); }
      else out.push(part);
    }
    let r = (abs ? '/' : '') + out.join('/');
    if (!r) r = abs ? '/' : '.';
    if (trail && r !== '/') r += '/';
    return r;
  }
  const join = parts => { const j = parts.filter(x => x !== '').join('/'); return j ? normalize(j) : '.'; };
  function resolve(parts) {
    let r = '';
    for (let i = parts.length - 1; i >= 0 && !r.startsWith('/'); i--) if (parts[i]) r = parts[i] + (r ? '/' + r : '');
    if (!r.startsWith('/')) r = CWD + (r ? '/' + r : '');
    r = normalize(r);
    return r.length > 1 && r.endsWith('/') ? r.slice(0, -1) : r;
  }
  const dirname = p => { const s = p.replace(/\/+$/, ''); const i = s.lastIndexOf('/'); return i < 0 ? '.' : i === 0 ? '/' : s.slice(0, i); };
  const basename = (p, ext) => { let b = p.replace(/\/+$/, '').split('/').pop(); if (ext && b.endsWith(ext) && b !== ext) b = b.slice(0, -ext.length); return b; };
  const extname = p => { const b = basename(p); const i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i); };
  function relative(from, to) {
    const a = resolve([from]).split('/').filter(Boolean), b = resolve([to]).split('/').filter(Boolean);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
  }

  window.JSEngine.mixin(class {
    setupNode() {
      base.setupNode.call(this);
      const B = this.builtins, origRequire = B.get('require');
      this.initDisk();
      B.set('require', this.native('require', function (s, a, node) {
        const name = this.toStr(a[0]).replace(/^node:/, '');
        if (name === 'path') return this.nodePath(node);
        if (name === 'fs') return this.nodeFs(node);
        if (name === 'fs/promises') return this.nodeFs(node).props.get('promises');
        if (name === 'http') return this.nodeHttp(node);
        if (['events', 'util', 'timers/promises'].includes(name)) return origRequire.fn.call(this, s, a, node);
        throw this.makeError('Error', `Cannot find module '${name}'. Simulated built-ins: path, fs, fs/promises, http, events, util, timers/promises.`, node);
      }));
    }

    // ======================================================== the virtual disk
    initDisk() {
      this.disk = new Map();
      this.diskDirs = new Set(['/', '/home', '/home/user', CWD]);
      this.diskFile(CWD + '/package.json', '{\n  "name": "my-app",\n  "version": "1.0.0",\n  "main": "main.js"\n}\n', true);
      (this.dataFiles || []).forEach(f => this.diskFile(resolve([f.name]), f.text, false));
    }
    diskFile(p, text, builtin) {
      this.disk.set(p, { text, builtin, changed: false });
      for (let d = dirname(p); !this.diskDirs.has(d); d = dirname(d)) this.diskDirs.add(d);
    }
    serFiles() {
      if (!this._fs && !(this.dataFiles && this.dataFiles.length)) return null;
      if (!this.disk) return this.dataFiles.map(f => ({ name: f.name, size: f.text.length, text: clip(f.text), where: 'server' }));
      return [...this.disk.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([p, f]) => ({
        name: p.startsWith(CWD + '/') ? p.slice(CWD.length + 1) : p, size: f.text.length, text: clip(f.text), changed: f.changed, where: 'disk',
      }));
    }

    fsError(codeName, syscall, p) {
      const msgs = { ENOENT: 'no such file or directory', EISDIR: 'illegal operation on a directory', EEXIST: 'file already exists', ENOTDIR: 'not a directory' };
      const e = this.makeErrorObj('Error', `${codeName}: ${msgs[codeName]}, ${syscall} '${p}'`);
      e.props.set('errno', { ENOENT: -2, EISDIR: -21, EEXIST: -17, ENOTDIR: -20 }[codeName]);
      e.props.set('code', codeName);
      e.props.set('syscall', syscall);
      e.props.set('path', p);
      return e;
    }

    // the actual file operations. Each returns { value } or { error }.
    fsOp(op, a) {
      const p = resolve([this.toStr(a[0])]);
      const encOf = x => (typeof x === 'string' ? x : x instanceof JSObject ? this.getMember(x, 'encoding') : undefined);
      const textOf = x => (x instanceof JSObject && x.kind === 'typed' ? new TextDecoder().decode(x.ta) : this.toStr(x));
      const f = this.disk.get(p);
      switch (op) {
        case 'readFile': {
          if (this.diskDirs.has(p)) return { error: this.fsError('EISDIR', 'read', p) };
          if (!f) return { error: this.fsError('ENOENT', 'open', p) };
          const enc = encOf(a[1]);
          return { value: enc == null ? this.makeNodeBuffer(f.text) : f.text, p };
        }
        case 'writeFile': case 'appendFile': {
          if (!this.diskDirs.has(dirname(p))) return { error: this.fsError('ENOENT', 'open', p) };
          if (this.diskDirs.has(p)) return { error: this.fsError('EISDIR', 'open', p) };
          const text = (op === 'appendFile' && f ? f.text : '') + textOf(a[1]);
          this.diskFile(p, text, false);
          this.disk.get(p).changed = true;
          return { value: undefined, p };
        }
        case 'unlink':
          if (!f) return { error: this.fsError('ENOENT', 'unlink', p) };
          this.disk.delete(p);
          return { value: undefined, p };
        case 'readdir': {
          if (!this.diskDirs.has(p)) return { error: this.fsError(f ? 'ENOTDIR' : 'ENOENT', 'scandir', p) };
          const kids = new Set();
          [...this.disk.keys(), ...this.diskDirs].forEach(x => { if (x !== p && dirname(x) === p) kids.add(basename(x)); });
          return { value: this.makeArray([...kids].sort()), p };
        }
        case 'mkdir': {
          const rec = a[1] instanceof JSObject && this.truthy(this.getMember(a[1], 'recursive'));
          if (this.diskDirs.has(p)) return rec ? { value: undefined, p } : { error: this.fsError('EEXIST', 'mkdir', p) };
          if (!rec && !this.diskDirs.has(dirname(p))) return { error: this.fsError('ENOENT', 'mkdir', p) };
          for (let d = p; !this.diskDirs.has(d); d = dirname(d)) this.diskDirs.add(d);
          return { value: rec ? p : undefined, p };
        }
        case 'stat': {
          const isDir = this.diskDirs.has(p);
          if (!f && !isDir) return { error: this.fsError('ENOENT', 'stat', p) };
          const st = this.alloc('object');
          st.ctorName = 'Stats';
          st.props.set('size', isDir ? 4096 : new TextEncoder().encode(f.text).length);
          st.props.set('isFile', this.native('isFile', () => !isDir));
          st.props.set('isDirectory', this.native('isDirectory', () => isDir));
          return { value: st, p };
        }
        default: return { error: this.makeErrorObj('Error', `fs.${op} is not simulated`) };
      }
    }

    makeNodeBuffer(text) {
      const o = this.wrapTyped(new TextEncoder().encode(text));
      o.ctorName = 'Buffer';
      o.nodeBuffer = true;
      return o;
    }

    opText(op, a) {
      const p = this.toStr(a[0]);
      return { readFile: `reads ${code(p)}`, writeFile: `writes ${code(p)}`, appendFile: `appends to ${code(p)}`, unlink: `deletes ${code(p)}`, readdir: `lists the folder ${code(p)}`, mkdir: `creates the folder ${code(p)}`, stat: `looks up ${code(p)}` }[op];
    }

    nodeFs(node) {
      if (this._fs) return this._fs;
      const I = this;
      this.badge('fs');
      const ops = ['readFile', 'writeFile', 'appendFile', 'unlink', 'readdir', 'mkdir', 'stat'];
      const fs = {};
      // 1) sync: the whole thread waits until the disk answers
      ops.forEach(op => {
        fs[op + 'Sync'] = this.native(op + 'Sync', function (s, a, n) {
          const r = this.fsOp(op, a);
          if (r.error) {
            this.record(n, `💾 <code>fs.${op}Sync</code> fails: ${esc(this.getMember(r.error, 'message'))}. A sync call <b>throws</b> the error, so use try/catch.`, 'error');
            throw new ThrowSignal(r.error, n);
          }
          this.record(n, `💾 <code>fs.${op}Sync</code> ${this.opText(op, a)} <b>synchronously</b>: the whole JavaScript thread <b>stops and waits</b> for the disk. Nothing else (timers, requests) can run meanwhile. Fine for start-up scripts, bad inside a server.${op === 'readFile' && r.value instanceof JSObject ? ' No encoding was given, so you get raw bytes (a <b>Buffer</b>), not text.' : ''}`, 'native');
          return r.value;
        });
      });
      fs.existsSync = this.native('existsSync', function (s, a) { const p = resolve([this.toStr(a[0])]); return this.disk.has(p) || this.diskDirs.has(p); });
      // 2) callbacks: Node's I/O threads do the work; the callback waits in the poll phase
      ops.forEach(op => {
        fs[op] = this.native(op, function (s, a, n) {
          const args = a.slice(), cb = args.pop();
          if (!this.isCallable(cb)) throw this.makeError('TypeError', `The "cb" argument must be of type function. Received ${this.display(cb)}`, n);
          this.ioTask(op, args, n, r => this.callFunction(cb, undefined, r.error ? [r.error] : [null, r.value], cb.node || n, 'queue'), [cb], `fs.${op}`, `the callback ${code(this.fnLabel(cb))}`);
        });
      });
      // 3) promises
      const prom = {};
      ops.forEach(op => {
        prom[op] = this.native(op, function (s, a, n) {
          const p = this.newPromise();
          this.ioTask(op, a.slice(), n, r => {
            if (r.error) { p.alreadyResolved = true; this.settle(p, 'rejected', r.error, null); }
            else this.resolvePromise(p, r.value, null);
          }, [p], `fs.promises.${op}`, `Promise #${p.id}`);
          return p;
        });
      });
      fs.promises = this.hiddenObj('fs/promises', prom);
      this._fs = this.hiddenObj('fs', fs);
      this.record(node, '💾 <code>require("fs")</code> loads Node\'s <b>file system</b> module. It has three styles: <code>readFileSync</code> (blocks), <code>readFile(path, callback)</code> and <code>fs.promises.readFile</code> (both run in the background).', 'native');
      return this._fs;
    }

    // hand a file operation to the "libuv thread pool"; its result comes back in the poll phase
    ioTask(op, args, node, finish, refs, label, who) {
      const delay = op === 'readdir' || op === 'stat' ? 2 : 5;
      const t = { id: ++this.timerSeq, cb: null, args: [], delay, start: this.time, fireAt: this.time + delay, label: `💾 ${label}(${trunc(this.toStr(args[0]), 18)})`, kind: 'io', refs: args.filter(x => x instanceof JSObject).concat(refs) };
      t.doneMsg = () => `💾 The disk finished: ${this.opText(op, args)}. The result waits for the event loop's <b>poll phase</b>.`;
      t.internal = () => {
        const r = this.fsOp(op, args);
        this.record(null, r.error
          ? `💾 ${code(label)} failed (${esc(this.getMember(r.error, 'code'))}). The error is handed to ${who}.`
          : `💾 ${code(label)} is done. The result is handed to ${who}.`, r.error ? 'error' : 'eventloop');
        finish(r);
      };
      this.webApis.push(t);
      this.record(node, `💾 <code>${label}</code> ${this.opText(op, args)} <b>in the background</b> (Node passes it to its I/O thread pool) and returns at once. JavaScript keeps running; ${who} gets the result later.`, 'webapi');
    }

    platformGet(obj, key, node) {
      if (obj.nodeBuffer && key === 'toString') {
        return this.method('buffer', 'toString', self => new TextDecoder().decode(self.ta));
      }
      return base.platformGet.call(this, obj, key, node);
    }

    display(v, depth, top, maxDepth) {
      if (v instanceof JSObject && v.nodeBuffer) {
        const b = [...v.ta.slice(0, 12)].map(x => x.toString(16).padStart(2, '0')).join(' ');
        return `<Buffer ${b}${v.ta.length > 12 ? ` ... ${v.ta.length - 12} more bytes` : ''}>`;
      }
      return base.display.call(this, v, depth, top, maxDepth);
    }

    // ======================================================== path
    nodePath(node) {
      if (this._path) return this._path;
      const I = this;
      const strs = a => a.map(x => { if (typeof x !== 'string') throw I.makeError('TypeError', `The "path" argument must be of type string. Received ${I.display(x)}`, node); return x; });
      const fn = (name, impl) => this.native(name, function (s, a, n) {
        const r = impl(strs(a));
        this.record(n, `🧭 <code>path.${name}(${esc(a.map(x => JSON.stringify(x)).join(', '))})</code> → ${code(JSON.stringify(r))}. It only works on the <b>text</b> of the path; it never touches the disk.`, 'native');
        return typeof r === 'object' ? this.fromNative(r) : r;
      });
      this._path = this.hiddenObj('path', {
        sep: '/', delimiter: ':',
        join: fn('join', a => join(a)),
        resolve: fn('resolve', a => resolve(a)),
        normalize: fn('normalize', a => normalize(a[0])),
        dirname: fn('dirname', a => dirname(a[0])),
        basename: fn('basename', a => basename(a[0], a[1])),
        extname: fn('extname', a => extname(a[0])),
        isAbsolute: fn('isAbsolute', a => a[0].startsWith('/')),
        relative: fn('relative', a => relative(a[0], a[1])),
        parse: fn('parse', a => { const p = a[0]; const b = basename(p), e = extname(p); return { root: p.startsWith('/') ? '/' : '', dir: p.includes('/') ? dirname(p) : '', base: b, ext: e, name: e ? b.slice(0, -e.length) : b }; }),
        format: this.native('format', function (s, a) { const o = this.toNative(a[0]) || {}; const b = o.base || (o.name || '') + (o.ext || ''); return o.dir ? (o.dir.endsWith('/') ? o.dir : o.dir + '/') + b : (o.root || '') + b; }),
      });
      return this._path;
    }

    // ======================================================== http
    nodeHttp(node) {
      if (this._http) return this._http;
      this.badge('http');
      this.httpServers = this.httpServers || new Map();
      this._http = this.hiddenObj('http', {
        STATUS_CODES: this.hiddenObj('STATUS_CODES', STATUS),
        createServer: this.native('createServer', function (s, a, n) {
          const srv = this.alloc('object');
          srv.ctorName = 'Server';
          srv.handler = this.isCallable(a[0]) ? a[0] : null;
          srv.props.set('listening', false);
          srv.props.set('listen', this.native('listen', function (s2, a2, n2) {
            const port = this.toNumber(a2[0]);
            const cb = a2.find(x => this.isCallable(x));
            if (this.httpServers.has(port)) {
              const e = this.makeErrorObj('Error', `listen EADDRINUSE: address already in use :::${port}`);
              e.props.set('code', 'EADDRINUSE');
              throw new ThrowSignal(e, n2);
            }
            this.httpServers.set(port, srv);
            srv.port = port;
            srv.props.set('listening', true);
            this.changedProp = { id: srv.id, key: 'listening' };
            this.record(n2, `🖥️ <code>server.listen(${port})</code> asks the operating system to send every connection on port ${port} to this server. ${cb ? `When it is ready, ${code(this.fnLabel(cb))} runs. ` : ''}(A real server keeps the Node process alive until <code>server.close()</code>.)`, 'webapi');
            if (cb) {
              const t = { id: ++this.timerSeq, cb, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: `🖥️ listening on :${port}`, kind: 'io', refs: [cb] };
              t.doneMsg = () => `🖥️ Port ${port} is open. The "listening" callback waits in the poll phase.`;
              this.webApis.push(t);
            }
            return srv;
          }));
          srv.props.set('close', this.native('close', function (s2, a2, n2) {
            this.httpServers.delete(srv.port);
            srv.props.set('listening', false);
            this.changedProp = { id: srv.id, key: 'listening' };
            this.record(n2, `🖥️ <code>server.close()</code> stops accepting new connections on port ${srv.port}.`, 'webapi');
            const cb = a2[0];
            if (this.isCallable(cb)) this.webApis.push({ id: ++this.timerSeq, cb, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: '🖥️ server closed', kind: 'io', refs: [cb] });
            return srv;
          }));
          srv.props.set('on', this.native('on', function (s2, a2) { if (this.toStr(a2[0]) === 'request' && this.isCallable(a2[1])) srv.handler = a2[1]; return srv; }));
          this.record(n, `🖥️ <code>http.createServer</code> makes Server #${srv.id}. ${srv.handler ? `${code(this.fnLabel(srv.handler))} will run once for <b>every request</b> that arrives.` : ''} It does nothing until you call <code>listen</code>.`, 'heap');
          return srv;
        }),
      });
      this.record(node, '🖥️ <code>require("http")</code> loads Node\'s <b>HTTP</b> module, used to build web servers.', 'native');
      return this._http;
    }

    // fetch('http://localhost:PORT/...') → a server created with http.createServer
    localFetch(url, method, body, opts, node) {
      const m = /^https?:\/\/[^/:]+(?::(\d+))?(\/[^#]*)?/i.exec(url);
      const port = m[1] ? +m[1] : 80, path = m[2] || '/';
      const srv = this.httpServers.get(port);
      const p = this.newPromise();
      const hdrIn = opts ? this.natArg(this.getMember(opts, 'headers')) : undefined;
      if (!srv) {
        const t = { id: ++this.timerSeq, cb: null, args: [], delay: 1, start: this.time, fireAt: this.time + 1, label: `🌐 ${method} :${port}${path}`, kind: 'fetch', refs: [p] };
        t.doneMsg = () => `🌐 Nothing is listening on port ${port}: the connection is <b>refused</b>.`;
        t.internal = () => {
          const e = this.makeErrorObj('TypeError', 'fetch failed');
          const c = this.makeErrorObj('Error', `connect ECONNREFUSED 127.0.0.1:${port}`);
          c.props.set('code', 'ECONNREFUSED');
          e.props.set('cause', c);
          p.alreadyResolved = true;
          this.settle(p, 'rejected', e, null);
        };
        this.webApis.push(t);
        this.record(node, `🌐 <code>fetch</code> tries ${code(url)}, but no server listens on port ${port} (did you call <code>listen</code>?). The Promise will reject.`, 'webapi');
        return p;
      }
      // step 1: the request travels to the server
      const t = { id: ++this.timerSeq, cb: null, args: [], delay: 2, start: this.time, fireAt: this.time + 2, label: `🖥️ request ${method} ${path}`, kind: 'io', refs: [p, srv] };
      t.doneMsg = () => `🖥️ The request ${code(method + ' ' + path)} reaches the server on port ${port}. Its "request" event waits in the poll phase.`;
      t.internal = () => this.serveRequest(srv, { method, url, path, body, headers: hdrIn }, p);
      this.webApis.push(t);
      this.record(node, `🌐 <code>fetch</code> sends ${code(method + ' ' + url)} to <b>your own server</b> in this program and returns Promise #${p.id}. The client and the server share one thread, so they take turns through the event loop.`, 'webapi');
      return p;
    }

    serveRequest(srv, rq, p) {
      const I = this;
      const req = this.alloc('object');
      req.ctorName = 'IncomingMessage';
      req.props.set('method', rq.method);
      req.props.set('url', rq.path);
      req.props.set('headers', this.fromNative(Object.assign({ host: 'localhost:' + srv.port }, Object.fromEntries(Object.entries(rq.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)])))));
      const listeners = { data: [], end: [] };
      req.props.set('on', this.native('on', function (s, a) { const ev = this.toStr(a[0]); if (listeners[ev] && this.isCallable(a[1])) listeners[ev].push(a[1]); return req; }));

      const res = this.alloc('object');
      res.ctorName = 'ServerResponse';
      res.props.set('statusCode', 200);
      const out = { headers: {}, body: '', ended: false };
      const setH = (k, v) => { out.headers[this.toStr(k).toLowerCase()] = this.toStr(v); };
      res.props.set('setHeader', this.native('setHeader', function (s, a) { setH(a[0], a[1]); return res; }));
      res.props.set('writeHead', this.native('writeHead', function (s, a, n) {
        res.props.set('statusCode', this.toNumber(a[0]));
        const h = a.find((x, i) => i > 0 && x instanceof JSObject);
        if (h) this.ownKeys(h).forEach(k => setH(k, this.getMember(h, k)));
        this.record(n, `🖥️ <code>res.writeHead(${this.toNumber(a[0])})</code> sets the status code and headers of the answer.`, 'native');
        return res;
      }));
      res.props.set('write', this.native('write', function (s, a) { out.body += this.toStr(a[0]); return true; }));
      res.props.set('end', this.native('end', function (s, a, n) {
        if (out.ended) return res;
        out.ended = true;
        if (a[0] !== undefined) out.body += this.toStr(a[0]);
        const status = this.toNumber(this.getMember(res, 'statusCode'));
        this.record(n, `🖥️ <code>res.end()</code> sends the answer: <b>${status}</b> with ${out.body.length} characters. It now travels back to the client.`, 'webapi');
        const t = { id: ++this.timerSeq, cb: null, args: [], delay: 2, start: this.time, fireAt: this.time + 2, label: `🌐 response ${status}`, kind: 'fetch', refs: [p] };
        t.doneMsg = () => `🌐 The client receives the server's <b>${status}</b> answer.`;
        t.internal = () => {
          const r = this.makeRealResponse(rq.url, { status, statusText: STATUS[status] || '', headers: Object.entries(out.headers), body: out.body, url: rq.url });
          this.record(null, `📬 fetch's Promise #${p.id} is fulfilled with Response #${r.id} (status ${status}).`, 'promise');
          this.resolvePromise(p, r, null);
        };
        this.webApis.push(t);
        return res;
      }));

      this.record(null, `🖥️ The server's handler runs for ${code(rq.method + ' ' + rq.path)}: Node gives it <code>req</code> #${req.id} (what the client asked) and <code>res</code> #${res.id} (used to answer).`, 'eventloop');
      if (srv.handler) this.callFunction(srv.handler, srv, [req, res], srv.handler.node || null, 'queue');
      // the request body arrives as a stream: "data" chunks, then "end"
      if (rq.body !== undefined && listeners.data.length) listeners.data.forEach(f => I.callFunction(f, req, [rq.body], f.node || null, 'queue'));
      listeners.end.forEach(f => I.callFunction(f, req, [], f.node || null, 'queue'));
    }

    platformRoots(markV, markS, root) {
      base.platformRoots.call(this, markV, markS, root);
      (this.httpServers || new Map()).forEach((srv, port) => root(`the server on port ${port}`, () => markV(srv)));
      if (this._fs) root('require("fs")', () => markV(this._fs));
    }

    // browser mode: `// @file data.json` sections are served by the pretend server
    mockFor(url) {
      const m = base.mockFor.call(this, url);
      if (m || !this.dataFiles || !this.dataFiles.length || /^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) return m;
      const name = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0].replace(/^\.?\//, '');
      const f = this.dataFiles.find(x => x.name === name || x.name.replace(/^\.?\//, '') === name);
      return f ? { status: 200, delay: 40, data: null, raw: f.text } : null;
    }
  });
})();
