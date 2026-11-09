/*
 * React Engine Lab — JSX support.
 *
 * Turns  <div className="box">{count}</div>  into  React.createElement("div", { className: "box" }, count)
 * and keeps a position map, so every step still highlights your original JSX.
 * It also turns  import { useState } from "react"  into  const { useState } = React;
 */
(function () {
  'use strict';

  class JSXError extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }

  // output builder: every piece of generated code remembers which part of the source it came from
  function Builder() {
    const parts = [], map = [];
    let len = 0;
    return {
      copy(src, s, e) { if (e <= s) return; parts.push(src.slice(s, e)); map.push({ gs: len, ge: len + (e - s), os: s, oe: e, exact: true }); len += e - s; },
      synth(text, os, oe) { if (!text) return; parts.push(text); map.push({ gs: len, ge: len + text.length, os, oe, exact: false }); len += text.length; },
      add(b) { const r = b.result(); r.map.forEach(m => map.push({ gs: m.gs + len, ge: m.ge + len, os: m.os, oe: m.oe, exact: m.exact })); parts.push(r.code); len += r.code.length; },
      result() { return { code: parts.join(''), map }; },
    };
  }

  const isIdStart = c => /[A-Za-z_$]/.test(c);
  const isId = c => /[\w$]/.test(c);
  const JSX_AFTER = new Set(['(', ',', '=', ':', '?', '[', '{', '}', ';', '!', '&', '|', '>', '+', '-', '*', '%', '~', '^']);
  const JSX_AFTER_WORDS = new Set(['return', 'case', 'yield', 'await', 'default', 'else', 'do', 'in', 'of', 'typeof', 'void']);

  function transform(src) {
    let changed = false;

    // copy JavaScript from s to e, turning JSX inside it into createElement calls
    function js(s, e) {
      const b = Builder();
      let i = s, from = s;
      let lastSig = '', lastWord = '';
      const flush = to => { b.copy(src, from, to); from = to; };
      while (i < e) {
        const c = src[i];
        if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 || j > e ? e : j; continue; }
        if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? e : j + 2; continue; }
        if (c === '"' || c === "'") { i++; while (i < e && src[i] !== c) { if (src[i] === '\\') i++; i++; } i++; lastSig = 'x'; lastWord = ''; continue; }
        if (c === '`') {
          // template literal: JSX may appear inside ${ … }
          i++;
          while (i < e && src[i] !== '`') {
            if (src[i] === '\\') { i += 2; continue; }
            if (src[i] === '$' && src[i + 1] === '{') {
              const close = matchBrace(i + 1, e);
              flush(i + 2);
              b.add(js(i + 2, close));
              from = close;
              i = close + 1;
              continue;
            }
            i++;
          }
          i++; lastSig = 'x'; lastWord = '';
          continue;
        }
        if (c === '/' && (lastSig === '' || (JSX_AFTER.has(lastSig) && lastSig !== '}') || JSX_AFTER_WORDS.has(lastWord))) {
          // a regular expression literal
          i++;
          let cls = false;
          while (i < e && src[i] !== '\n') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
          i++;
          while (i < e && /[a-z]/i.test(src[i])) i++;
          lastSig = 'x'; lastWord = '';
          continue;
        }
        // "<" starts JSX only where an expression can start (after "(", "=", "return", "=>", "&&", …), never after a value (a < b)
        if (c === '<' && (isIdStart(src[i + 1] || '') || src[i + 1] === '>') && (lastSig === '' || JSX_AFTER.has(lastSig) || JSX_AFTER_WORDS.has(lastWord))) {
          flush(i);
          const el = element(i, e);
          b.add(el.b);
          i = el.end;
          from = i;
          changed = true;
          lastSig = ')'; lastWord = '';
          continue;
        }
        if (isIdStart(c)) {
          let j = i + 1;
          while (j < e && isId(src[j])) j++;
          const word = src.slice(i, j);
          // import … from "react" / "react-dom" / "react-dom/client"
          if (word === 'import' && (lastSig === '' || lastSig === ';' || lastSig === '}' || /\n\s*$/.test(src.slice(Math.max(s, i - 40), i)))) {
            const m = /^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+([A-Za-z_$][\w$]*)\s*)?from\s*(['"])(react|react-dom|react-dom\/client|react-dom\/server|react-dom\/static|react\/compiler-runtime)\4\s*;?/.exec(src.slice(i, e));
            if (m) {
              flush(i);
              const global = m[5] === 'react' ? 'React' : m[5] === 'react-dom/server' ? 'ReactDOMServer' : m[5] === 'react/compiler-runtime' ? 'ReactCompilerRuntime' : m[5] === 'react-dom/static' ? 'ReactDOMStatic' : 'ReactDOM';
              const decl = [];
              // "import React from 'react'" needs nothing: React is already a global here
              if (m[1] && m[1] !== global) decl.push(`const ${m[1]} = ${global};`);
              if (m[3] && m[3] !== global) decl.push(`const ${m[3]} = ${global};`);
              if (m[2] && m[2].trim()) decl.push(`const { ${m[2].replace(/\s+as\s+/g, ': ').trim()} } = ${global};`);
              b.synth(decl.join(' ') || ';', i, i + m[0].length);
              i += m[0].length;
              from = i;
              changed = true;
              lastSig = ';'; lastWord = '';
              continue;
            }
          }
          lastWord = word; lastSig = 'x';
          i = j;
          continue;
        }
        if (/\s/.test(c)) { i++; continue; }
        lastSig = c; lastWord = '';
        if (c === '=' && src[i + 1] === '>') { lastSig = '>'; i += 2; continue; }
        i++;
      }
      flush(e);
      return b;
    }

    // index of the "}" matching the "{" at position k (skips strings, templates, comments and nested JSX)
    function matchBrace(k, e) {
      let depth = 0, prev = '{';
      for (let i = k; i < e; i++) {
        const c = src[i];
        // a regex literal (after an operator or bracket): skip it, so "//" or "}" inside it are not misread
        if (c === '/' && src[i + 1] !== '/' && src[i + 1] !== '*' && /[(,=:[!&|?{;+\-*%~^]/.test(prev)) { // not after < > } : those are JSX tags like </div> and />

          let cls = false;
          for (i++; i < e && src[i] !== '\n'; i++) {
            if (src[i] === '\\') { i++; continue; }
            if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break;
          }
          prev = 'x';
          continue;
        }
        if (!/\s/.test(c)) prev = c;
        if (c === '"' || c === "'") { i++; while (i < e && src[i] !== c) { if (src[i] === '\\') i++; i++; } continue; }
        if (c === '`') { i++; while (i < e && src[i] !== '`') { if (src[i] === '\\') i++; else if (src[i] === '$' && src[i + 1] === '{') { i = matchBrace(i + 1, e); } i++; } continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < e && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? e : j + 1; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return i; }
      }
      throw new JSXError('Missing "}" in JSX', k);
    }

    // parse one JSX element (or fragment) at position p; returns generated code and where it ended
    function element(p, e) {
      const b = Builder();
      let i = p + 1;
      const ws = () => { while (i < e && /\s/.test(src[i])) i++; };
      // fragment <> … </>
      if (src[i] === '>') {
        i++;
        const kids = children('', e);
        b.synth('React.createElement(React.Fragment, null', p, i);
        kids.list.forEach(k => { b.synth(', ', k.s, k.e); b.add(k.b); });
        b.synth(')', kids.end - 3, kids.end);
        return { b, end: kids.end };
      }
      const ns = i;
      while (i < e && /[\w$.:-]/.test(src[i])) i++;
      const name = src.slice(ns, i);
      if (!name) throw new JSXError('Expected a tag name after "<"', p);
      const host = /^[a-z]/.test(name) && !name.includes('.');
      b.synth('React.createElement(', p, ns);
      if (host) b.synth(JSON.stringify(name), ns, i); else b.copy(src, ns, i);
      // attributes
      const attrs = [];
      let selfClosing = false;
      for (;;) {
        ws();
        if (src[i] === '/' && src[i + 1] === '>') { selfClosing = true; i += 2; break; }
        if (src[i] === '>') { i++; break; }
        if (i >= e) throw new JSXError(`Unclosed tag <${name}>`, p);
        if (src[i] === '{') {
          const close = matchBrace(i, e);
          let k = i + 1;
          while (/\s/.test(src[k])) k++;
          if (src.slice(k, k + 3) !== '...') throw new JSXError('Only {...spread} is allowed between attributes', i);
          attrs.push({ spread: true, s: k + 3, e: close, os: i, oe: close + 1 });
          i = close + 1;
          continue;
        }
        const as = i;
        while (i < e && /[\w$:-]/.test(src[i])) i++;
        const an = src.slice(as, i);
        if (!an) throw new JSXError(`Unexpected "${src[i]}" in <${name}>`, i);
        ws();
        if (src[i] !== '=') { attrs.push({ name: an, value: 'true', os: as, oe: i, bool: true }); continue; }
        i++;
        ws();
        if (src[i] === '"' || src[i] === "'") {
          const q = src[i], vs = i;
          i++;
          while (i < e && src[i] !== q) i++;
          i++;
          attrs.push({ name: an, str: [vs, i], os: as, oe: i });
        } else if (src[i] === '{') {
          const close = matchBrace(i, e);
          attrs.push({ name: an, expr: [i + 1, close], os: as, oe: close + 1 });
          i = close + 1;
        } else if (src[i] === '<') {
          const el = element(i, e);
          attrs.push({ name: an, el, os: as, oe: el.end });
          i = el.end;
        } else throw new JSXError(`Attribute ${an} needs a "string" or {expression}`, i);
      }
      if (!attrs.length) b.synth(', null', i - 1, i);
      else {
        b.synth(', {', attrs[0].os, attrs[0].os);
        attrs.forEach((a, k) => {
          if (k) b.synth(', ', a.os, a.os);
          if (a.spread) { b.synth('...', a.os, a.s); b.add(js(a.s, a.e)); return; }
          const key = /^[A-Za-z_$][\w$]*$/.test(a.name) ? a.name : JSON.stringify(a.name);
          b.synth(key + ': ', a.os, a.os + a.name.length);
          if (a.bool) b.synth('true', a.os, a.oe);
          else if (a.str) b.copy(src, a.str[0], a.str[1]);
          else if (a.el) b.add(a.el.b);
          else b.add(js(a.expr[0], a.expr[1]));
        });
        b.synth('}', attrs[attrs.length - 1].oe, attrs[attrs.length - 1].oe);
      }
      if (selfClosing) { b.synth(')', i - 2, i); return { b, end: i }; }
      const kids = children(name, e);
      kids.list.forEach(k => { b.synth(', ', k.s, k.e); b.add(k.b); });
      b.synth(')', kids.closeStart, kids.end);
      return { b, end: kids.end };

      // children until </name>
      function children(tag, end) {
        const list = [];
        for (;;) {
          if (i >= end) throw new JSXError(tag ? `Missing </${tag}>` : 'Missing </>', p);
          if (src[i] === '<' && src[i + 1] === '/') {
            const cs = i;
            i += 2;
            const n0 = i;
            while (i < end && /[\w$.:-]/.test(src[i])) i++;
            const closing = src.slice(n0, i);
            ws();
            if (src[i] !== '>') throw new JSXError('Expected ">"', i);
            i++;
            if (closing !== tag) throw new JSXError(`Expected </${tag || ''}> but found </${closing}>`, cs);
            return { list, end: i, closeStart: cs };
          }
          if (src[i] === '<') {
            const el = element(i, end);
            list.push({ b: el.b, s: i, e: el.end });
            i = el.end;
            continue;
          }
          if (src[i] === '{') {
            const close = matchBrace(i, end);
            const inner = src.slice(i + 1, close);
            if (inner.trim() && !/^\s*\/\*[\s\S]*\*\/\s*$/.test(inner)) list.push({ b: js(i + 1, close), s: i, e: close + 1 });
            i = close + 1;
            continue;
          }
          // text: JSX trims whitespace that contains a line break
          const ts = i;
          while (i < end && src[i] !== '<' && src[i] !== '{') i++;
          const raw = src.slice(ts, i);
          const lines = raw.split('\n');
          const text = lines.map((l, k) => {
            let x = l.replace(/\t/g, ' ');
            if (k > 0) x = x.replace(/^\s+/, '');
            if (k < lines.length - 1) x = x.replace(/\s+$/, '');
            return x;
          }).filter((x, k) => x.length || (lines.length === 1)).join(' ');
          if (text.trim() || (lines.length === 1 && text.length)) {
            const tb = Builder();
            tb.synth(JSON.stringify(text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')), ts, i);
            list.push({ b: tb, s: ts, e: i });
          }
        }
      }
    }

    const out = js(0, src.length).result();
    return changed ? { code: out.code, map: out.map, changed } : { code: src, map: null, changed: false };
  }

  // map a position in the generated code back to the original source
  function makeMapper(map) {
    const find = g => {
      let lo = 0, hi = map.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, m = map[mid];
        if (g < m.gs) hi = mid - 1; else if (g >= m.ge) lo = mid + 1; else return m;
      }
      return map[Math.max(0, Math.min(map.length - 1, lo))];
    };
    return {
      start: g => { const m = find(g); return m ? (m.exact ? m.os + (g - m.gs) : m.os) : g; },
      end: g => { const m = find(Math.max(0, g - 1)); return m ? (m.exact ? m.os + (g - m.gs) : m.oe) : g; },
    };
  }

  const hasJSX = src => /<\/?[A-Za-z>]|from\s*['"]react/.test(src);
  window.JSEngine.transformJSX = transform;
  window.JSEngine.jsxMapper = makeMapper;
  window.JSEngine.hasJSX = hasJSX;
  window.JSEngine.JSXError = JSXError;
})();
