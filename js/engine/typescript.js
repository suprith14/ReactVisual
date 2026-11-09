/*
 * JS Engine Lab — TypeScript support ("// @lang ts" or "// @file name.ts").
 *
 * TypeScript is JavaScript plus types. This removes the type syntax by overwriting it with spaces,
 * so every remaining character keeps its exact position: the engine runs the plain JavaScript
 * while the editor still highlights your TypeScript code line by line.
 *
 * Supported: type annotations (variables, parameters, return types, class fields), interfaces,
 * type aliases, generics (<T>), "as" / "satisfies", non-null "!", optional "?", access modifiers,
 * "implements", "import type" and abstract classes. Not supported (a clear error explains why):
 * enums, namespaces and constructor parameter properties.
 */
(function () {
  'use strict';
  const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
  const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '=>', '==', '===', '!=', '!==', '&&', '||', '??', 'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);
  const MODIFIERS = new Set(['public', 'private', 'protected', 'readonly', 'abstract', 'override', 'declare']);
  const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'await', 'yield', 'new', 'delete', 'void', 'in', 'of', 'instanceof']);

  class TSError extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }

  function tokenize(src) {
    const toks = [];
    let i = 0, nl = false;
    const prevSig = () => toks[toks.length - 1];
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { nl = true; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (src.slice(i, e < 0 ? src.length : e).includes('\n')) nl = true; i = e < 0 ? src.length : e + 2; continue; }
      const s = i;
      let t, v;
      if (c === '"' || c === "'") {
        i++;
        while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++; }
        i++; t = 'str';
      } else if (c === '`') {
        i++;
        let depth = 0;
        while (i < src.length) {
          if (src[i] === '\\') { i += 2; continue; }
          if (depth === 0 && src[i] === '`') break;
          if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
          if (depth && src[i] === '}') depth--;
          i++;
        }
        i++; t = 'tpl';
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        while (i < src.length && /[\w.]/.test(src[i])) i++;
        t = 'num';
      } else if (/[A-Za-z_$#]/.test(c)) {
        i++;
        while (i < src.length && /[\w$]/.test(src[i])) i++;
        t = 'id';
      } else if (c === '/' && (!prevSig() || REGEX_AFTER.has(prevSig().v))) {
        i++;
        let cls = false;
        while (i < src.length && src[i] !== '\n') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false;
          else if (src[i] === '/' && !cls) break;
          i++;
        }
        i++;
        while (i < src.length && /[a-z]/i.test(src[i])) i++;
        t = 'regex';
      } else {
        const p = PUNCT.find(x => src.startsWith(x, i));
        i += p ? p.length : 1;
        t = 'punc';
      }
      v = src.slice(s, i);
      toks.push({ t, v, s, e: i, nl });
      nl = false;
    }
    return toks;
  }

  function stripTypes(src) {
    const toks = tokenize(src);
    const out = src.split('');
    const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '; };
    const blankToks = (a, b) => { if (a <= b) blank(toks[a].s, toks[b].e); };
    const n = toks.length;
    const V = k => (k >= 0 && k < n ? toks[k].v : null);
    // matching brackets
    const match = new Array(n).fill(-1);
    const st = [];
    for (let k = 0; k < n; k++) {
      const v = toks[k].v;
      if (toks[k].t !== 'punc') continue;
      if (v === '(' || v === '[' || v === '{') st.push(k);
      else if (v === ')' || v === ']' || v === '}') { const o = st.pop(); if (o !== undefined) { match[o] = k; match[k] = o; } }
    }
    const endsType = k => toks[k] && (toks[k].t === 'id' || toks[k].t === 'str' || toks[k].t === 'num' || [']', ')', '}', '>', '>>', '>>>'].includes(toks[k].v));
    // skip a type starting at token k; returns the index of the first token after it
    const skipType = (k, stops) => {
      let depth = 0, angle = 0, first = k;
      for (; k < n; k++) {
        const v = toks[k].v, t = toks[k].t;
        if (depth === 0 && angle === 0 && k > first) {
          if (stops.has(v) && t === 'punc') return k;
          if (v === '{' && endsType(k - 1) && stops.has('{')) return k;
          if (toks[k].nl && !['|', '&', '.', '[', '<', '?'].includes(v) && endsType(k - 1) && !['|', '&', ':', ',', '<', '=>', '?'].includes(V(k - 1))) return k;
        }
        if (t !== 'punc') continue;
        if (v === '(' || v === '[' || v === '{') depth++;
        else if (v === ')' || v === ']' || v === '}') { if (depth === 0) return k; depth--; }
        else if (v === '<') angle++;
        else if (v === '>' || v === '>>' || v === '>>>') { const c = v.length; if (angle === 0 && depth === 0) return k; angle = Math.max(0, angle - c); }
      }
      return k;
    };
    // generic <...> starting at token k: returns the closing index if it looks like type arguments
    const genericEnd = k => {
      let angle = 0;
      for (let j = k; j < n && j < k + 80; j++) {
        const v = toks[j].v;
        if (v === '<') angle++;
        else if (v === '>' || v === '>>' || v === '>>>') { angle -= v.length; if (angle <= 0) return angle === 0 ? j : -1; }
        else if (toks[j].t === 'punc' && !['[', ']', ',', '|', '&', '.', '{', '}', ':', ';', '(', ')', '=>', '?', '='].includes(v)) return -1;
        else if (toks[j].t === 'id' && ['in', 'instanceof'].includes(v)) return -1;
      }
      return -1;
    };
    // which "(" open a parameter list?
    const isParams = k => {
      const close = match[k];
      if (close < 0) return false;
      const before = V(k - 1);
      if (before && CONTROL.has(before)) return false;
      const after = V(close + 1);
      if (after === '=>') return true;
      if (after === '{') return toks[k - 1] && (toks[k - 1].t === 'id' || before === '>' || before === ']' || toks[k - 1].t === 'str');
      if (after === ':') {
        const end = skipType(close + 2, new Set(['{', '=>', ';', ',', ')']));
        return V(end) === '{' || V(end) === '=>';
      }
      return false;
    };
    // braces that open a class body
    const classBody = new Set();
    for (let k = 0; k < n; k++) {
      if (toks[k].v !== 'class' || toks[k].t !== 'id') continue;
      let j = k + 1, angle = 0;
      while (j < n && !(toks[j].v === '{' && angle === 0)) {
        const w = toks[j].v;
        if (w === '<') angle++;
        else if (w === '>' || w === '>>' || w === '>>>') angle = Math.max(0, angle - w.length);
        else if ((w === '(' || w === '[' || (w === '{' && angle > 0)) && match[j] > 0) j = match[j];
        j++;
      }
      if (j < n) classBody.add(j);
    }
    const depthOf = new Array(n);
    const ctx = [];
    for (let k = 0; k < n; k++) {
      depthOf[k] = ctx.length ? ctx[ctx.length - 1] : null;
      const v = toks[k].v;
      if (toks[k].t !== 'punc') continue;
      if (v === '{' || v === '(' || v === '[') ctx.push({ open: k, kind: v === '{' ? (classBody.has(k) ? 'class' : 'block') : v === '(' ? (isParams(k) ? 'params' : 'paren') : 'bracket' });
      else if (v === ')' || v === ']' || v === '}') ctx.pop();
    }
    const stmtStart = k => k === 0 || [';', '{', '}'].includes(V(k - 1)) || toks[k].nl;
    let k = 0;
    while (k < n) {
      const tk = toks[k], v = tk.v, c = depthOf[k];
      if (tk.t === 'id') {
        // interface X { ... }  and  type X = ...;
        const exp = v === 'export' && (V(k + 1) === 'interface' || V(k + 1) === 'type' || (V(k + 1) === 'declare'));
        const kw = exp ? k + 1 : k;
        if ((V(kw) === 'interface') && toks[kw + 1] && toks[kw + 1].t === 'id' && stmtStart(k)) {
          let j = kw;
          while (j < n && V(j) !== '{') j++;
          blankToks(k, match[j] >= 0 ? match[j] : j);
          k = (match[j] >= 0 ? match[j] : j) + 1;
          continue;
        }
        if (V(kw) === 'type' && toks[kw + 1] && toks[kw + 1].t === 'id' && (V(kw + 2) === '=' || V(kw + 2) === '<') && stmtStart(k)) {
          // type Name<T, U extends X = Y> = …  : skip the type parameters first
          let eq = kw + 2;
          if (V(eq) === '<') {
            let depth = 0;
            for (; eq < n; eq++) {
              if (V(eq) === '<') depth++;
              else if (V(eq) === '>') { depth--; if (depth === 0) { eq++; break; } }
              else if (V(eq) === '>>') { depth -= 2; if (depth <= 0) { eq++; break; } }
              else if ((V(eq) === '(' || V(eq) === '[' || V(eq) === '{') && match[eq] >= 0) eq = match[eq];
            }
          }
          const end = skipType(eq + 1, new Set([';']));
          const last = V(end) === ';' ? end : end - 1;
          blankToks(k, last);
          k = last + 1;
          continue;
        }
        if (v === 'declare' && stmtStart(k)) {
          let j = k + 1;
          while (j < n && V(j) !== ';' && !(toks[j].nl && j > k + 1)) { if (V(j) === '{') j = match[j]; j++; }
          blankToks(k, V(j) === ';' ? j : j - 1);
          k = j + 1;
          continue;
        }
        if ((v === 'enum' || v === 'namespace' || v === 'module') && stmtStart(k) && toks[k + 1] && toks[k + 1].t === 'id' && (V(k + 2) === '{' || v === 'enum')) {
          throw new TSError(`"${v}" is not supported here: ${v === 'enum' ? 'use a plain object, e.g. const Color = { Red: 0, Green: 1 }' : 'use ES modules or a plain object'}.`, tk.s);
        }
        // import type { ... } from "..."   /   export type { ... }
        if ((v === 'import' || v === 'export') && V(k + 1) === 'type' && (V(k + 2) === '{' || (toks[k + 2] && toks[k + 2].t === 'id'))) {
          let j = k;
          while (j < n && V(j) !== ';' && !(toks[j].nl && j > k)) j++;
          blankToks(k, V(j) === ';' ? j : j - 1);
          k = j + 1;
          continue;
        }
        // abstract class
        if (v === 'abstract' && V(k + 1) === 'class') { blankToks(k, k); k++; continue; }
        // implements A, B {
        if (v === 'implements') { let j = k; while (j < n && V(j) !== '{') j++; blankToks(k, j - 1); k = j; continue; }
        // modifiers inside a class body (and parameter properties, which change behaviour)
        if (MODIFIERS.has(v) && toks[k + 1] && (toks[k + 1].t === 'id' || V(k + 1) === '[') && !['(', '=', ':', ';', ',', ')'].includes(V(k + 1))) {
          if (c && c.kind === 'params') throw new TSError(`Constructor parameter properties ("${v} ${V(k + 1)}") are not supported. Write the parameter without "${v}" and assign this.${V(k + 1)} = ${V(k + 1)} in the constructor.`, tk.s);
          if (c && c.kind === 'class') {
            if (v === 'abstract' || v === 'declare') {
              // abstract members have no body: remove the whole member
              let j = k;
              while (j < n && V(j) !== ';' && V(j) !== '{' && !(toks[j].nl && j > k + 1 && V(j - 1) !== ':')) j++;
              if (V(j) === ';' || V(j) !== '{') { blankToks(k, V(j) === ';' ? j : j - 1); k = j + 1; continue; }
            }
            blankToks(k, k); k++; continue;
          }
        }
        // function name<T>(  /  class Name<T>  /  method<T>(
        if (V(k + 1) === '<' && (V(k - 1) === 'function' || V(k - 1) === 'class' || (c && c.kind === 'class') || V(k - 1) === 'extends')) {
          const ge = genericEnd(k + 1);
          if (ge > 0) { blankToks(k + 1, ge); k = ge + 1; continue; }
        }
        // call(…) type arguments: fn<number>(x), new Map<string, number>()
        if (V(k + 1) === '<') {
          const ge = genericEnd(k + 1);
          if (ge > 0 && V(ge + 1) === '(') { blankToks(k + 1, ge); k = ge + 1; continue; }
        }
        // x as Type  /  x satisfies Type
        if ((v === 'as' || v === 'satisfies') && k > 0 && endsType(k - 1) && toks[k + 1] && (toks[k + 1].t === 'id' || ['{', '[', '(', '<'].includes(V(k + 1)) || toks[k + 1].t === 'str')) {
          let inImport = false;
          for (let j = k - 1; j >= 0 && j > k - 40; j--) { if (V(j) === '{' && (V(j - 1) === 'import' || V(j - 1) === 'export')) { inImport = true; break; } if (V(j) === ';' || V(j) === '}') break; }
          if (!inImport && !(V(k - 1) === '*' && (V(k - 2) === 'import' || V(k - 2) === 'export'))) {
            const end = skipType(k + 1, new Set([')', ']', '}', ',', ';', '=', '?', ':', '&&', '||', '??', '+', '-', '*', '/', '%', '===', '!==', '==', '!=', '<', '>', '<=', '>=']));
            blankToks(k, end - 1);
            k = end;
            continue;
          }
        }
        // let / const / var name: Type = …
        if (v === 'let' || v === 'const' || v === 'var') {
          let j = k + 1;
          for (;;) {
            if (toks[j] && (V(j) === '{' || V(j) === '[')) j = match[j];
            if (V(j + 1) === '!') { blankToks(j + 1, j + 1); j++; }
            if (V(j + 1) === ':') {
              const end = skipType(j + 2, new Set(['=', ';', ',']));
              blankToks(j + 1, end - 1);
              j = end;
            } else j++;
            // more declarators: skip the initializer to the next top-level comma
            let d = 0;
            while (j < n) {
              const w = V(j);
              if (['(', '[', '{'].includes(w)) d++;
              else if ([')', ']', '}'].includes(w)) { if (d === 0) break; d--; }
              else if (d === 0 && (w === ';' || w === ',' || (toks[j].nl && j > k + 1 && endsType(j - 1) && !['.', '?.', '+', '-', '*', '/', '&&', '||', '??', '?', ':', '=>', '(', '['].includes(w) && !['=', '(', ',', '=>', '+', '-', '*', '/', '&&', '||', '??', '?', ':'].includes(V(j - 1))))) break;
              j++;
            }
            if (V(j) === ',' && toks[j + 1] && (toks[j + 1].t === 'id' || V(j + 1) === '{' || V(j + 1) === '[')) { j++; continue; }
            break;
          }
          k++;
          continue;
        }
      }
      if (tk.t === 'punc') {
        // parameter annotations:  (a: number, b?: string = "x", ...rest: T[])
        if (c && c.kind === 'params' && (v === ':' || (v === '?' && V(k + 1) === ':'))) {
          if (v === '?') { blankToks(k, k); k++; continue; }
          const end = skipType(k + 1, new Set([',', ')', '=']));
          blankToks(k, end - 1);
          k = end;
          continue;
        }
        // return types:  ): Type {   /   ): Type =>
        if (v === ')' && V(k + 1) === ':' && match[k] >= 0 && depthOf[k + 1] !== undefined) {
          const open = match[k];
          if (isParams(open)) {
            const end = skipType(k + 2, new Set(['{', '=>', ';']));
            blankToks(k + 1, end - 1);
            k = end;
            continue;
          }
        }
        // class fields:  name: Type = …;   name?: Type;   name!: Type;
        if (c && c.kind === 'class' && (v === ':' || ((v === '?' || v === '!') && V(k + 1) === ':'))) {
          if (v !== ':') { blankToks(k, k); k++; continue; }
          const end = skipType(k + 1, new Set(['=', ';']));
          blankToks(k, end - 1);
          k = end;
          continue;
        }
        // non-null assertion  value!.x   value!)
        if (v === '!' && k > 0 && endsType(k - 1) && !toks[k].nl && ['.', ')', ']', ',', ';', '[', '?.', '='].includes(V(k + 1)) && toks[k - 1].e === tk.s) {
          if (!(V(k + 1) === '=' && toks[k + 1].s === tk.e)) { blankToks(k, k); k++; continue; }
        }
        // generic arrow functions:  <T>(x: T) => x
        if (v === '<' && ['=', '(', ',', ':', 'return', '=>', '?', '&&', '||'].includes(V(k - 1))) {
          const ge = genericEnd(k);
          if (ge > 0 && V(ge + 1) === '(' && isParams(ge + 1)) { blankToks(k, ge); k = ge + 1; continue; }
        }
      }
      k++;
    }
    return out.join('');
  }

  const isTS = src => /^\s*\/\/\s*@lang\s+(ts|typescript)\b/m.test(src) || /^\s*\/\/\s*@file\s+\S+\.(ts|mts|cts)\s*$/m.test(src);
  window.JSEngine.stripTypes = stripTypes;
  window.JSEngine.isTypeScript = isTS;
  window.JSEngine.TSError = TSError;
})();
