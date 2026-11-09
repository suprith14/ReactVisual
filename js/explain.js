/*
 * "Explain this line": turns the syntax on one line into plain English.
 * Uses the same Acorn parser as the engine.
 */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const c = s => '<code>' + esc(s) + '</code>';
  let SRC = '';
  const src = n => SRC.slice(n.start, n.end);
  const short = (n, max = 40) => { const s = src(n).replace(/\s+/g, ' '); return s.length > max ? s.slice(0, max - 1) + '…' : s; };

  function describe(e) {
    if (!e) return 'nothing';
    switch (e.type) {
      case 'Literal':
        if (e.regex) return `the regular expression ${c(src(e))}`;
        if (typeof e.value === 'string') return `the text ${c(src(e))}`;
        if (typeof e.value === 'number') return `the number ${c(src(e))}`;
        if (e.bigint) return `the BigInt ${c(src(e))}`;
        return c(String(e.value));
      case 'Identifier': return `the value of ${c(e.name)}`;
      case 'TemplateLiteral': return `a template string (text with ${c('${…}')} slots filled in)`;
      case 'ArrayExpression': return `a new <b>array</b> with ${e.elements.length} item${e.elements.length === 1 ? '' : 's'}`;
      case 'ObjectExpression': return `a new <b>object</b> with ${e.properties.length} propert${e.properties.length === 1 ? 'y' : 'ies'}`;
      case 'ArrowFunctionExpression': return `an <b>arrow function</b>${e.async ? ' (async)' : ''} taking (${e.params.map(src).join(', ')})`;
      case 'FunctionExpression': return `a ${e.async ? 'async ' : ''}${e.generator ? 'generator ' : ''}<b>function</b> taking (${e.params.map(src).join(', ')})`;
      case 'ClassExpression': return 'a <b>class</b>';
      case 'CallExpression': return describeCall(e);
      case 'NewExpression': return `a new ${c(short(e.callee, 20))} object (created with ${c('new')})`;
      case 'AwaitExpression': return `the result of <b>waiting</b> for ${describe(e.argument)} (the function pauses here)`;
      case 'BinaryExpression': {
        const ops = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'remainder after dividing by', '**': 'to the power of', '===': 'is exactly equal to', '!==': 'is not exactly equal to', '==': 'is loosely equal to', '!=': 'is loosely not equal to', '<': 'is less than', '>': 'is greater than', '<=': 'is at most', '>=': 'is at least', instanceof: 'is an instance of', in: 'is a key in' };
        return `${c(short(e.left, 18))} ${ops[e.operator] || e.operator} ${c(short(e.right, 18))}`;
      }
      case 'LogicalExpression': return `${c(short(e.left, 18))} ${e.operator === '&&' ? 'AND' : e.operator === '||' ? 'OR (first truthy value)' : '?? (fallback if null/undefined)'} ${c(short(e.right, 18))}`;
      case 'ConditionalExpression': return `${c(short(e.consequent, 15))} if ${c(short(e.test, 20))} is true, otherwise ${c(short(e.alternate, 15))}`;
      case 'MemberExpression': return `the property ${c(e.computed ? '[' + short(e.property, 15) + ']' : e.property.name)} of ${c(short(e.object, 20))}`;
      case 'UnaryExpression': return e.operator === 'typeof' ? `the type of ${c(short(e.argument))} as text` : e.operator === '!' ? `the opposite (NOT) of ${c(short(e.argument))}` : c(src(e));
      case 'YieldExpression': return `a value handed out by ${c(e.delegate ? 'yield*' : 'yield')} (the generator pauses here)`;
      default: return c(short(e));
    }
  }

  function describeCall(e) {
    const callee = short(e.callee, 30);
    const n = e.arguments.length;
    const args = n ? ` with ${n} argument${n > 1 ? 's' : ''}` : '';
    if (/^console\.(log|info|warn|error)$/.test(callee)) return `<b>printing</b> ${e.arguments.map(a => c(short(a, 22))).join(', ') || 'an empty line'} to the Console`;
    if (callee === 'setTimeout' || callee === 'setInterval') return `handing a function to the browser's ${c(callee)} timer (${e.arguments[1] ? c(src(e.arguments[1])) + 'ms' : '0ms'}), which runs it later from the Callback Queue`;
    if (callee === 'fetch') return `a <b>network request</b> to ${c(short(e.arguments[0] || e, 30))}, which returns a Promise right away`;
    if (/\.then$/.test(callee)) return `registering a callback that runs when the promise is <b>fulfilled</b> (as a microtask)`;
    if (/\.catch$/.test(callee)) return 'registering a callback that runs if the promise is <b>rejected</b>';
    if (/\.addEventListener$/.test(callee)) return `registering a listener for the ${c(e.arguments[0] ? src(e.arguments[0]) : '?')} event`;
    const m = callee.match(/\.(map|filter|reduce|forEach|find|some|every|sort)$/);
    if (m) return `the array method ${c('.' + m[1] + '()')}, which calls your callback for each item`;
    if (e.callee.type === 'MemberExpression') return `calling the method ${c(callee)}${args} (inside it, ${c('this')} is ${c(short(e.callee.object, 15))})`;
    return `calling ${c(callee)}${args}. A new Execution Context is pushed on the Call Stack`;
  }

  const kindNote = {
    var: 'var is function-scoped and hoisted as <code>undefined</code>.',
    let: 'let is block-scoped and can be reassigned later.',
    const: 'const is block-scoped and can never be reassigned (but objects inside can still change).',
  };

  function explainStmt(n) {
    switch (n.type) {
      case 'VariableDeclaration': {
        const parts = n.declarations.map(d => {
          const name = src(d.id);
          const isPattern = d.id.type !== 'Identifier';
          return `${isPattern ? 'unpacks (destructures) ' + c(name) : 'creates the variable ' + c(name)}${d.init ? ' and stores ' + describe(d.init) : ' (no value yet, so it is <code>undefined</code>)'}`;
        });
        return `📦 <b>Declaration</b>: ${parts.join('; ')}.<br><small>${kindNote[n.kind]}</small>`;
      }
      case 'FunctionDeclaration':
        return `🛠️ <b>Function declaration</b>: defines ${n.async ? 'an async ' : ''}${n.generator ? 'generator ' : ''}function ${c(n.id.name)} with parameter${n.params.length === 1 ? '' : 's'} (${n.params.map(src).join(', ') || 'none'}).<br><small>It is hoisted completely, so it can be called before this line. Nothing runs until it is <i>called</i>.</small>`;
      case 'ClassDeclaration': {
        const methods = n.body.body.filter(m => m.type === 'MethodDefinition' && m.kind !== 'constructor').map(m => (m.static ? 'static ' : '') + (m.kind === 'method' ? '' : m.kind + ' ') + src(m.key));
        return `🏛️ <b>Class</b> ${c(n.id.name)}${n.superClass ? ' that <b>extends</b> ' + c(src(n.superClass)) : ''}${methods.length ? ', with methods ' + methods.map(x => c(x)).join(', ') : ''}.<br><small>Use ${c('new ' + n.id.name + '(...)')} to create objects from it.</small>`;
      }
      case 'ExpressionStatement': {
        const e = n.expression;
        if (e.type === 'AssignmentExpression') return `✏️ <b>Assignment</b>: ${c(src(e.left))} ${e.operator === '=' ? 'gets' : 'is updated with ' + c(e.operator) + ' using'} ${describe(e.right)}.`;
        if (e.type === 'UpdateExpression') return `➕ ${c(src(e.argument))} goes ${e.operator === '++' ? 'up' : 'down'} by 1.`;
        if (e.type === 'CallExpression') return `📞 This line is ${describeCall(e)}.`;
        if (e.type === 'AwaitExpression') return `⏸️ This line waits for ${describe(e.argument)}.`;
        return `🧮 Evaluates ${describe(e)}.`;
      }
      case 'ReturnStatement': return `↩️ <b>Return</b>: the function stops here and hands back ${describe(n.argument)} to whoever called it.`;
      case 'IfStatement': return `🤔 <b>If</b>: checks whether ${c(short(n.test))} is truthy. If yes, it runs the first block${n.alternate ? ', otherwise the <code>else</code> part' : ', otherwise it skips it'}.`;
      case 'ForStatement': return `🔁 <b>For loop</b>: setup ${c(n.init ? short(n.init, 20) : '(none)')} runs once; before each round it checks ${c(n.test ? short(n.test, 20) : 'true')}; after each round it runs ${c(n.update ? short(n.update, 15) : '(nothing)')}.`;
      case 'ForOfStatement': return `🔁 <b>${n.await ? 'for await…of' : 'for…of'}</b>: takes each <b>value</b> of ${c(short(n.right, 20))} in turn as ${c(src(n.left))}.`;
      case 'ForInStatement': return `🔁 <b>for…in</b>: takes each <b>key</b> (property name) of ${c(short(n.right, 20))} in turn as ${c(src(n.left))}.`;
      case 'WhileStatement': return `🔁 <b>While loop</b>: repeats the body as long as ${c(short(n.test))} is truthy.`;
      case 'DoWhileStatement': return `🔁 <b>Do…while</b>: runs the body once, then repeats while ${c(short(n.test))} is truthy.`;
      case 'TryStatement': return `🛟 <b>Try</b>: runs the block, and if any error is thrown inside, jumps to <code>catch</code>${n.finalizer ? '. The <code>finally</code> block always runs at the end' : ''}.`;
      case 'ThrowStatement': return `💥 <b>Throw</b>: raises ${describe(n.argument)} as an error. Execution stops and JS looks for the nearest <code>catch</code>.`;
      case 'SwitchStatement': return `🔀 <b>Switch</b>: compares ${c(short(n.discriminant))} with each <code>case</code> using ===.`;
      case 'BreakStatement': return '🛑 <b>break</b>: exits the nearest loop or switch.';
      case 'ContinueStatement': return '⏩ <b>continue</b>: skips to the next round of the loop.';
      case 'ImportDeclaration': return `📥 <b>Import</b>: makes ${n.specifiers.map(s => c(s.local.name)).join(', ')} from ${c(n.source.value)} available here. These are live, read-only links.`;
      case 'ExportNamedDeclaration': return `📤 <b>Export</b>: ${n.declaration ? explainStmt(n.declaration).replace(/^.*?:\s*/, '') + ' Other modules can import it.' : 'shares ' + n.specifiers.map(s => c(src(s))).join(', ') + ' with other modules.'}`;
      case 'ExportDefaultDeclaration': return `📤 <b>Default export</b>: ${describe(n.declaration)} becomes what ${c('import x from …')} gets.`;
      case 'BlockStatement': return '🧱 <b>Block</b> <code>{ }</code>: groups statements. <code>let</code>/<code>const</code> inside live only here.';
      default: return `${c(n.type)}`;
    }
  }

  // find the statement that best matches a line
  function findStatement(ast, line) {
    let starting = null, containing = null;
    const walk = node => {
      if (!node || typeof node.type !== 'string') return;
      const isStmt = /Statement|Declaration$/.test(node.type) && node.type !== 'Program';
      if (isStmt && node.loc.start.line === line && !starting) starting = node;
      if (isStmt && node.loc.start.line <= line && node.loc.end.line >= line) containing = node;
      for (const k in node) {
        if (k === 'loc') continue;
        const v = node[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object' && typeof v.type === 'string') walk(v);
      }
    };
    walk(ast);
    return starting || containing;
  }

  window.JSExplain = {
    explainLine(source, line) {
      SRC = source;
      if (!window.acorn) return null;
      const lineText = source.split('\n')[line - 1] || '';
      if (!lineText.trim()) return null;
      if (/^\s*\/\/\s*@file/.test(lineText)) return `📁 This marks the start of a new <b>module file</b> called ${c(lineText.replace(/.*@file\s+/, '').trim())}.`;
      if (/^\s*\/\//.test(lineText)) return '💬 A <b>comment</b>: notes for humans. JavaScript ignores it completely.';
      if (/^\s*[})\]]+[;,)]*\s*$/.test(lineText)) return '🔚 A closing bracket: the end of a block, function, object or call that started above.';
      let ast;
      try { ast = window.acorn.parse(source, { ecmaVersion: 2022, locations: true, sourceType: 'module', allowImportExportEverywhere: true, allowReturnOutsideFunction: true }); }
      catch (e) {
        try { ast = window.acorn.parse(source, { ecmaVersion: 2022, locations: true, sourceType: 'script' }); } catch (e2) { return null; }
      }
      const st = findStatement(ast, line);
      if (!st) return null;
      let html = explainStmt(st);
      if (st.loc.start.line !== line) html = `<small>(Part of the statement that starts on line ${st.loc.start.line}.)</small><br>` + html;
      return html;
    },
  };
})();
