/*
 * JS Engine Lab — engine part: Temporal (browser and Node), and Node's Buffer, crypto and stream.
 *
 *  - Temporal: the modern date/time API, wrapped from the browser's own implementation
 *  - Buffer: Buffer.from / alloc / concat / isBuffer, and toString("utf8" | "hex" | "base64")
 *  - crypto: createHash("sha256" | "sha1").update().digest(), randomUUID, randomInt, randomBytes
 *  - stream: Readable, Writable, Transform, PassThrough, pipeline, for await…of, and
 *            fs.createReadStream / fs.createWriteStream. The stream classes are written in
 *            JavaScript (like EventEmitter), so you can step through them.
 */
(function () {
  'use strict';
  const { CONSTRUCT, code, esc, JSObject, ThrowSignal } = window.JSEngine.internals;
  const P = window.JSEngine.Interpreter.prototype;
  const base = { setupPlatform: P.setupPlatform, setupNode: P.setupNode, wrapHost: P.wrapHost, display: P.display, serExtra: P.serExtra, platformGet: P.platformGet };

  // ---------- hashing (synchronous, like Node's crypto.createHash)
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  const primes = (() => { const out = []; for (let k = 2; out.length < 64; k++) if (out.every(p => k % p)) out.push(k); return out; })();
  const frac32 = x => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const K256 = primes.map(p => frac32(Math.cbrt(p)));
  const H256 = primes.slice(0, 8).map(p => frac32(Math.sqrt(p)));
  function pad(bytes, bigEndianLength) {
    const l = bytes.length, size = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(size);
    m.set(bytes);
    m[l] = 0x80;
    const dv = new DataView(m.buffer);
    if (bigEndianLength) { dv.setUint32(size - 4, (l * 8) >>> 0); dv.setUint32(size - 8, Math.floor(l * 8 / 4294967296)); }
    return dv;
  }
  function sha256(bytes) {
    const dv = pad(bytes, true), H = H256.slice(), w = new Uint32Array(64);
    for (let i = 0; i < dv.byteLength; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const x = w[t - 15], y = w[t - 2];
        w[t] = (w[t - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[t - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + w[t]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, k) => { H[k] = (H[k] + v) >>> 0; });
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    H.forEach((v, k) => odv.setUint32(k * 4, v));
    return out;
  }
  function sha1(bytes) {
    const dv = pad(bytes, true), H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0], w = new Uint32Array(80);
    for (let i = 0; i < dv.byteLength; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 80; t++) { const x = w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]; w[t] = (x << 1) | (x >>> 31); }
      let [a, b, c, d, e] = H;
      for (let t = 0; t < 80; t++) {
        const f = t < 20 ? (b & c) | (~b & d) : t < 40 ? b ^ c ^ d : t < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
        const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
        const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[t]) >>> 0;
        e = d; d = c; c = ((b << 30) | (b >>> 2)) >>> 0; b = a; a = tmp;
      }
      [a, b, c, d, e].forEach((v, k) => { H[k] = (H[k] + v) >>> 0; });
    }
    const out = new Uint8Array(20), odv = new DataView(out.buffer);
    H.forEach((v, k) => odv.setUint32(k * 4, v));
    return out;
  }
  const toHex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const toB64 = b => btoa(String.fromCharCode(...b));
  const fromHex = s => new Uint8Array((s.match(/../g) || []).map(h => parseInt(h, 16)));
  const fromB64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const encode = (bytes, enc) => (enc === 'hex' ? toHex(bytes) : enc === 'base64' ? toB64(bytes) : enc === 'latin1' || enc === 'binary' ? String.fromCharCode(...bytes) : new TextDecoder().decode(bytes));

  // ---------- the stream module, written in JavaScript so it can be stepped through
  const STREAM_SRC = `(function (EventEmitter, nextTick) {
  class Readable extends EventEmitter {
    constructor(options) {
      super();
      const o = options || {};
      this._buffer = [];
      this._ended = false;
      this._flowing = false;
      this._scheduled = false;
      this._reader = typeof o.read === "function" ? o.read : null;
      this.readableEnded = false;
    }
    push(chunk) {
      if (chunk === null) this._ended = true;
      else this._buffer.push(chunk);
      if (this._flowing) this._schedule();
      return !this._ended;
    }
    _schedule() {
      if (this._scheduled) return;
      this._scheduled = true;
      nextTick(() => { this._scheduled = false; this._flow(); });
    }
    _flow() {
      while (this._flowing && this._buffer.length) this.emit("data", this._buffer.shift());
      if (!this._flowing) return;
      if (this._ended) {
        if (!this.readableEnded) { this.readableEnded = true; this.emit("end"); this.emit("close"); }
      } else if (this._reader) {
        this._reader.call(this);
        if (this._buffer.length || this._ended) this._schedule();
      }
    }
    on(name, listener) {
      super.on(name, listener);
      if (name === "data") this.resume();
      return this;
    }
    resume() { this._flowing = true; this._schedule(); return this; }
    pause() { this._flowing = false; return this; }
    pipe(dest) {
      this.on("data", chunk => dest.write(chunk));
      this.on("end", () => dest.end());
      return dest;
    }
    [Symbol.asyncIterator]() {
      const queue = [], waiting = [];
      let done = false;
      this.on("data", chunk => { if (waiting.length) waiting.shift()({ value: chunk, done: false }); else queue.push(chunk); });
      this.on("end", () => { done = true; while (waiting.length) waiting.shift()({ value: undefined, done: true }); });
      return {
        next() {
          if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
          if (done) return Promise.resolve({ value: undefined, done: true });
          return new Promise(resolve => waiting.push(resolve));
        },
        [Symbol.asyncIterator]() { return this; },
      };
    }
    static from(iterable) {
      const stream = new Readable();
      for (const item of iterable) stream.push(item);
      stream.push(null);
      return stream;
    }
  }
  class Writable extends EventEmitter {
    constructor(options) {
      super();
      const o = options || {};
      this._writer = typeof o.write === "function" ? o.write : null;
      this.writableEnded = false;
      this.writableFinished = false;
    }
    write(chunk) {
      if (this._writer) this._writer.call(this, chunk, "utf8", () => {});
      return true;
    }
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.write(chunk);
      this.writableEnded = true;
      nextTick(() => { this.writableFinished = true; this.emit("finish"); this.emit("close"); });
      return this;
    }
  }
  class Transform extends Readable {
    constructor(options) {
      super();
      const o = options || {};
      this._transformer = typeof o.transform === "function" ? o.transform : (chunk, enc, cb) => cb(null, chunk);
      this.writableEnded = false;
    }
    write(chunk) {
      this._transformer.call(this, chunk, "utf8", (err, out) => {
        if (err) { this.emit("error", err); return; }
        if (out !== undefined && out !== null) this.push(out);
      });
      return true;
    }
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.write(chunk);
      this.writableEnded = true;
      this.push(null);
      nextTick(() => this.emit("finish"));
      return this;
    }
  }
  class PassThrough extends Transform {}
  function pipeline(...streams) {
    const done = typeof streams[streams.length - 1] === "function" ? streams.pop() : null;
    for (let i = 0; i < streams.length - 1; i++) streams[i].pipe(streams[i + 1]);
    const last = streams[streams.length - 1];
    if (done) last.on("finish", () => done(null));
    return last;
  }
  function fromChunks(chunks, error) {
    if (error) { const failed = new Readable(); nextTick(() => failed.emit("error", error)); return failed; }
    let i = 0;
    return new Readable({ read() { if (i < chunks.length) this.push(chunks[i++]); else this.push(null); } });
  }
  function sink(writeChunk) {
    return new Writable({ write(chunk, enc, cb) { writeChunk(chunk); cb(); } });
  }
  return { Readable, Writable, Transform, PassThrough, pipeline, fromChunks, sink };
})`;

  window.JSEngine.mixin(class {
    // ======================================================== Temporal
    setupPlatform() {
      base.setupPlatform.call(this);
      const T = window.Temporal;
      if (!T) return;
      const ns = this.hiddenObj('Temporal', {});
      const tErr = (e, node) => this.makeError(e && e.name === 'RangeError' ? 'RangeError' : 'TypeError', e && e.message ? e.message : String(e), node);
      ['PlainDate', 'PlainTime', 'PlainDateTime', 'ZonedDateTime', 'Instant', 'Duration', 'PlainYearMonth', 'PlainMonthDay'].forEach(name => {
        const Real = T[name];
        if (!Real) return;
        const ctor = this.native(name, function (s, a, node) {
          if (s !== CONSTRUCT) throw this.makeError('TypeError', `Constructor Temporal.${name} requires 'new'`, node);
          let r;
          try { r = new Real(...a.map(x => this.hostArg(x))); } catch (e) { throw tErr(e, node); }
          this.badge('intl');
          return this.hostObj(r);
        }, { isCtor: true });
        ['from', 'compare'].forEach(st => {
          if (typeof Real[st] !== 'function') return;
          ctor.props.set(st, this.native(st, function (s, a, node) {
            let r;
            try { r = Real[st](...a.map(x => this.hostArg(x))); } catch (e) { throw tErr(e, node); }
            if (st === 'from') this.record(node, `📅 <code>Temporal.${name}.from</code> creates an <b>immutable</b> ${name}: ${code(String(r))}. Its methods return <b>new</b> objects instead of changing it (unlike <code>Date</code>).`, 'heap');
            return this.wrapHost(r);
          }));
        });
        ns.props.set(name, ctor);
      });
      const now = {};
      Object.getOwnPropertyNames(T.Now).forEach(m => {
        if (typeof T.Now[m] === 'function') now[m] = this.native(m, function (s, a, node) { try { return this.wrapHost(T.Now[m](...a.map(x => this.hostArg(x)))); } catch (e) { throw tErr(e, node); } });
      });
      ns.props.set('Now', this.hiddenObj('Temporal.Now', now));
      this.builtins.set('Temporal', ns);
    }

    isTemporal(r) { return !!r && typeof r === 'object' && /^Temporal\./.test(String(r[Symbol.toStringTag] || '')); }

    wrapHost(r) {
      if (this.isTemporal(r)) return this.hostObj(r);
      return base.wrapHost.call(this, r);
    }

    display(v, depth, top, maxDepth) {
      if (v instanceof JSObject && v.host && this.isTemporal(v.host)) return `${v.host[Symbol.toStringTag]} ${v.host.toString()}`;
      return base.display.call(this, v, depth, top, maxDepth);
    }

    serExtra(o, b) {
      if (o.host && this.isTemporal(o.host)) return Object.assign(b, { title: o.host[Symbol.toStringTag], entries: [{ k: 'value', v: { t: 'str', text: o.host.toString() } }] });
      return base.serExtra.call(this, o, b);
    }

    // ======================================================== Node: Buffer, crypto, stream
    bufferFrom(bytes) {
      const o = this.wrapTyped(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
      o.ctorName = 'Buffer';
      o.nodeBuffer = true;
      return o;
    }

    bytesOf(x, enc, node) {
      if (typeof x === 'string') return enc === 'hex' ? fromHex(x) : enc === 'base64' ? fromB64(x) : new TextEncoder().encode(x);
      if (x instanceof JSObject && x.kind === 'typed') return new Uint8Array(x.ta.buffer, x.ta.byteOffset, x.ta.byteLength).slice();
      if (x instanceof JSObject && x.kind === 'array') return Uint8Array.from(x.items.map(v => this.toNumber(v) & 255));
      throw this.makeError('TypeError', `The first argument must be a string, Buffer or array. Received ${this.display(x)}`, node);
    }

    platformGet(obj, key, node) {
      if (obj.nodeBuffer && key === 'toString') {
        return this.method('buffer', 'toString(enc)', function (self, a) { return encode(new Uint8Array(self.ta.buffer, self.ta.byteOffset, self.ta.byteLength), a[0] === undefined ? 'utf8' : this.toStr(a[0])); });
      }
      if (obj.nodeBuffer && key === 'toJSON') return this.method('buffer', 'toJSON', function (self) { return this.fromNative({ type: 'Buffer', data: [...self.ta] }); });
      if (obj.nodeBuffer && key === 'equals') return this.method('buffer', 'equals', function (self, a) { const o = a[0]; return !!(o && o.ta) && toHex(self.ta) === toHex(o.ta); });
      return base.platformGet.call(this, obj, key, node);
    }

    setupNode() {
      base.setupNode.call(this);
      const I = this, B = this.builtins, prevRequire = B.get('require');
      const Buf = this.native('Buffer', function (s, a, node) { throw this.makeError('TypeError', 'Use Buffer.from() or Buffer.alloc() instead of new Buffer()', node); }, { isCtor: true });
      Buf.props.set('from', this.native('from', function (s, a, node) {
        const b = this.bufferFrom(this.bytesOf(a[0], a[1] === undefined ? 'utf8' : this.toStr(a[1]), node));
        this.record(node, `🧱 <code>Buffer.from</code> stores ${b.ta.length} raw byte${b.ta.length === 1 ? '' : 's'} (#${b.id}). Text becomes UTF-8 bytes; <code>toString("hex")</code> or <code>toString("base64")</code> turn them back into text.`, 'heap');
        return b;
      }));
      Buf.props.set('alloc', this.native('alloc', function (s, a) { const n = this.toNumber(a[0]); const b = new Uint8Array(n); if (a[1] !== undefined) b.fill(typeof a[1] === 'number' ? a[1] : this.bytesOf(a[1])[0] || 0); return this.bufferFrom(b); }));
      Buf.props.set('concat', this.native('concat', function (s, a, node) {
        const list = this.iterable(a[0], node).map(x => this.bytesOf(x, 'utf8', node));
        const out = new Uint8Array(list.reduce((n, x) => n + x.length, 0));
        let k = 0;
        list.forEach(x => { out.set(x, k); k += x.length; });
        return this.bufferFrom(out);
      }));
      Buf.props.set('isBuffer', this.native('isBuffer', (s, a) => a[0] instanceof JSObject && !!a[0].nodeBuffer));
      Buf.props.set('byteLength', this.native('byteLength', function (s, a, node) { return this.bytesOf(a[0], a[1] === undefined ? 'utf8' : this.toStr(a[1]), node).length; }));
      B.set('Buffer', Buf);
      B.set('require', this.native('require', function (s, a, node) {
        const name = this.toStr(a[0]).replace(/^node:/, '');
        if (name === 'crypto') return this.nodeCrypto(node);
        if (name === 'stream') return this.nodeStream();
        if (name === 'buffer') return this.hiddenObj('buffer', { Buffer: Buf });
        const mod = prevRequire.fn.call(this, s, a, node);
        if ((name === 'fs') && mod instanceof JSObject && !mod.props.has('createReadStream')) this.addFsStreams(mod);
        return mod;
      }));
    }

    nodeCrypto(node) {
      if (this._crypto) return this._crypto;
      const I = this;
      const hashes = { sha256, sha1 };
      const webCrypto = this.builtins.get('crypto');
      const uuid = webCrypto && webCrypto.props.get('randomUUID');
      this._crypto = this.hiddenObj('crypto', {
        createHash: this.native('createHash', function (s, a, n) {
          const alg = this.toStr(a[0]).toLowerCase().replace('-', '');
          if (!hashes[alg]) throw this.makeError('Error', `Digest method not supported here: ${alg}. Use "sha256" or "sha1".`, n);
          const h = this.alloc('object');
          h.ctorName = 'Hash';
          const parts = [];
          let done = false;
          h.props.set('update', this.native('update', function (s2, a2, n2) {
            if (done) throw this.makeError('Error', 'Digest already called', n2);
            parts.push(this.bytesOf(a2[0], a2[1] === undefined ? 'utf8' : this.toStr(a2[1]), n2));
            return h;
          }));
          h.props.set('digest', this.native('digest', function (s2, a2, n2) {
            if (done) throw this.makeError('Error', 'Digest already called', n2);
            done = true;
            const all = new Uint8Array(parts.reduce((x, p) => x + p.length, 0));
            let k = 0;
            parts.forEach(p => { all.set(p, k); k += p.length; });
            const out = hashes[alg](all);
            this.record(n2, `🔐 <code>digest</code>: ${alg.toUpperCase()} turns ${all.length} byte${all.length === 1 ? '' : 's'} into a fixed ${out.length}-byte fingerprint. The same input always gives the same hash, and you can't go back from the hash to the input.`, 'native');
            return a2[0] === undefined ? this.bufferFrom(out) : encode(out, this.toStr(a2[0]));
          }));
          this.record(n, `🔐 <code>crypto.createHash("${esc(alg)}")</code> creates Hash #${h.id}. Feed it with <code>update()</code>, then call <code>digest()</code> once.`, 'heap');
          return h;
        }),
        randomUUID: uuid || this.native('randomUUID', () => '00000000-0000-4000-8000-000000000000'),
        randomInt: this.native('randomInt', function (s, a) {
          const lo = a.length > 1 ? this.toNumber(a[0]) : 0, hi = a.length > 1 ? this.toNumber(a[1]) : this.toNumber(a[0]);
          return lo + Math.floor(this.rand() * (hi - lo));
        }),
        randomBytes: this.native('randomBytes', function (s, a) { return this.bufferFrom(Array.from({ length: this.toNumber(a[0]) }, () => Math.floor(this.rand() * 256))); }),
        getHashes: this.native('getHashes', () => I.makeArray(['sha1', 'sha256'])),
      });
      this.record(node, '🔐 <code>require("crypto")</code> loads Node\'s crypto module: hashes, random values and UUIDs.', 'native');
      return this._crypto;
    }

    nodeStream() {
      if (this._stream) return this._stream;
      const EE = this.nodeEvents();
      const file = { code: STREAM_SRC, label: 'stream (Node built-in)' };
      const ast = window.acorn.parse(STREAM_SRC, { ecmaVersion: 2022, locations: true, sourceType: 'script', directSourceFile: file });
      const nextTick = this.builtins.get('process').props.get('nextTick');
      this.silent = true;
      try {
        const factory = this.runSync(this.evaluate(ast.body[0].expression, this.globalCtx));
        this._stream = this.callFunction(factory, undefined, [EE, nextTick], null);
      } finally { this.silent = false; }
      this._stream.hidden = true;
      this._stream.label = 'stream';
      this.badge('node');
      return this._stream;
    }

    addFsStreams(fs) {
      const I = this;
      fs.props.set('createReadStream', this.native('createReadStream', function (s, a, node) {
        const opts = a[1] instanceof JSObject ? this.toNative(a[1]) : typeof a[1] === 'string' ? { encoding: a[1] } : {};
        const size = Math.max(1, opts.highWaterMark || 16);
        const r = this.fsOp('readFile', [a[0], 'utf8']);
        const st = this.nodeStream();
        let chunks = [];
        if (!r.error) {
          const text = r.value;
          for (let k = 0; k < text.length; k += size) chunks.push(opts.encoding ? text.slice(k, k + size) : this.makeNodeBuffer(text.slice(k, k + size)));
        }
        this.record(node, r.error
          ? `🌊 <code>fs.createReadStream</code>: the file can't be opened, so the stream will emit an <b>"error"</b> event.`
          : `🌊 <code>fs.createReadStream</code> reads ${code(this.toStr(a[0]))} in <b>chunks</b> of ${size} characters (${chunks.length} chunk${chunks.length === 1 ? '' : 's'}) instead of loading it all at once. Real Node uses 64 KB chunks; here they are small so you can watch them.`, 'webapi');
        return this.callFunction(st.props.get('fromChunks'), undefined, [this.makeArray(chunks), r.error || undefined], node);
      }));
      fs.props.set('createWriteStream', this.native('createWriteStream', function (s, a, node) {
        const path = a[0];
        this.fsOp('writeFile', [path, '']);
        const write = this.native('writeChunk', function (s2, a2) { this.fsOp('appendFile', [path, a2[0]]); });
        this.record(node, `🌊 <code>fs.createWriteStream</code> opens ${code(this.toStr(path))} for writing. Each <code>write(chunk)</code> appends to it; <code>end()</code> finishes and emits "finish".`, 'webapi');
        return this.callFunction(this.nodeStream().props.get('sink'), undefined, [write], node);
      }));
    }
  });

  window.JSEngine.hash = { sha256: s => toHex(sha256(new TextEncoder().encode(s))), sha1: s => toHex(sha1(new TextEncoder().encode(s))) };
})();
