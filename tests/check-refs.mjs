/**
 * tests/check-refs.mjs
 * Static analyzer to sweep for unresolved function calls and broken inline event handlers.
 * Plain Node.js ESM - zero external dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_FILES = ['app.js', 'sw.js', 'firebase-messaging-sw.js'];
const HTML_FILE = 'index.html';

// Global built-ins always available in modern JS / Web / SW runtimes
const KNOWN_GLOBALS = new Set([
  'Object', 'Array', 'Function', 'Boolean', 'Symbol', 'Number', 'BigInt', 'Math', 'Date', 'String', 'RegExp',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Reflect', 'Proxy', 'Intl', 'JSON', 'isNaN', 'isFinite',
  'parseFloat', 'parseInt', 'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'structuredClone',
  'atob', 'btoa', 'fetch', 'Headers', 'Request', 'Response', 'URL', 'URLSearchParams', 'AbortController',
  'AbortSignal', 'Event', 'CustomEvent', 'EventTarget', 'Blob', 'File', 'FileReader', 'FormData', 'crypto',
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'localStorage', 'sessionStorage',
  'alert', 'prompt', 'confirm', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'matchMedia',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'Image', 'Audio', 'Notification', 'caches',
  'self', 'importScripts', 'clients', 'registration', 'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
  'createImageBitmap', 'firebase', 'lucide', 'resolve', 'reject'
]);

const RESERVED_WORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'await', 'import', 'super', 'case', 'new', 'function', 'yield', 'async'
]);

function cleanSource(src) {
  let out = '';
  let i = 0;
  const len = src.length;
  const templateStack = [];

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    if (templateStack.length > 0) {
      if (ch === '{') {
        templateStack[templateStack.length - 1]++;
        out += ch;
        i++;
        continue;
      } else if (ch === '}') {
        templateStack[templateStack.length - 1]--;
        if (templateStack[templateStack.length - 1] === 0) {
          templateStack.pop();
          out += ' ';
          i++;
          while (i < len) {
            if (src[i] === '\\') {
              i += 2;
            } else if (src[i] === '`') {
              i++;
              break;
            } else if (src[i] === '$' && src[i + 1] === '{') {
              templateStack.push(1);
              i += 2;
              out += ' ';
              break;
            } else {
              i++;
            }
          }
          continue;
        } else {
          out += ch;
          i++;
          continue;
        }
      }
    }

    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i + 2);
      if (end === -1) break;
      out += '\n';
      i = end + 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) break;
      const newlines = src.slice(i, end + 2).match(/\n/g);
      out += newlines ? newlines.join('') : ' ';
      i = end + 2;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < len) {
        if (src[i] === '\\') {
          i += 2;
        } else if (src[i] === quote) {
          i++;
          break;
        } else if (src[i] === '\n') {
          break;
        } else {
          i++;
        }
      }
      out += ' "" ';
      continue;
    }

    if (ch === '`') {
      i++;
      while (i < len) {
        if (src[i] === '\\') {
          i += 2;
        } else if (src[i] === '`') {
          i++;
          break;
        } else if (src[i] === '$' && src[i + 1] === '{') {
          templateStack.push(1);
          i += 2;
          out += ' ';
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function analyzeFile(filePath) {
  const code = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  const cleaned = cleanSource(code);
  const declared = new Set(KNOWN_GLOBALS);

  // 1. Imports
  const importRegex = /import\s+(?:\{([^}]+)\}|([a-zA-Z0-9_$]+))\s+from/g;
  let m;
  while ((m = importRegex.exec(cleaned)) !== null) {
    if (m[1]) {
      m[1].split(',').forEach(item => {
        const parts = item.trim().split(/\s+as\s+/);
        const name = parts[parts.length - 1].trim();
        if (name) declared.add(name);
      });
    } else if (m[2]) {
      declared.add(m[2].trim());
    }
  }

  // 2. Functions
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s*([a-zA-Z0-9_$]+)\s*\(/g;
  while ((m = funcRegex.exec(cleaned)) !== null) {
    declared.add(m[1]);
  }

  // 3. Variables
  const varRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/g;
  while ((m = varRegex.exec(cleaned)) !== null) {
    declared.add(m[1]);
  }

  // 4. Destructuring (declarations and assignment)
  const destrRegex = /(?:export\s+)?(?:const|let|var)\s+\{([^}]+)\}\s*=/g;
  while ((m = destrRegex.exec(cleaned)) !== null) {
    m[1].split(',').forEach(part => {
      const p = part.trim().split(/\s*:\s*/);
      const id = p[p.length - 1].trim().split(/\s*=\s*/)[0].trim();
      if (/^[a-zA-Z0-9_$]+$/.test(id)) declared.add(id);
    });
  }

  // 5. Classes
  const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/g;
  while ((m = classRegex.exec(cleaned)) !== null) {
    declared.add(m[1]);
  }

  // 6. Catch bindings
  const catchRegex = /catch\s*\(\s*([a-zA-Z0-9_$]+)\s*\)/g;
  while ((m = catchRegex.exec(cleaned)) !== null) {
    declared.add(m[1]);
  }

  // 7. Arrow function & callback params: (a, b) => or ({ a, b }) =>
  const paramRegex = /\(([^)]*)\)\s*(?:=>|\{)/g;
  while ((m = paramRegex.exec(cleaned)) !== null) {
    const rawParams = m[1].replace(/[{}[\]]/g, '');
    rawParams.split(',').forEach(arg => {
      const raw = arg.trim().split(/\s*:\s*/).pop().split(/\s*=\s*/)[0].trim();
      if (/^[a-zA-Z0-9_$]+$/.test(raw)) declared.add(raw);
    });
  }

  // Single param arrow: a =>
  const singleParamRegex = /(?:^|[=,;({])\s*([a-zA-Z0-9_$]+)\s*=>/g;
  while ((m = singleParamRegex.exec(cleaned)) !== null) {
    if (!RESERVED_WORDS.has(m[1])) declared.add(m[1]);
  }

  // 8. Object method definitions: methodName(arg) {
  const methodRegex = /(?:^|[{,;\s])([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/g;
  while ((m = methodRegex.exec(cleaned)) !== null) {
    declared.add(m[1]);
  }

  // 9. Scan for call expressions: foo(...) where foo is not preceded by a dot
  const callRegex = /(?<![.\w$])([a-zA-Z0-9_$]+)\s*\(/g;
  const unresolved = new Map();

  while ((m = callRegex.exec(cleaned)) !== null) {
    const name = m[1];
    if (RESERVED_WORDS.has(name)) continue;
    if (!declared.has(name)) {
      const lineNum = cleaned.substring(0, m.index).split('\n').length;
      if (!unresolved.has(name)) unresolved.set(name, []);
      unresolved.get(name).push(lineNum);
    }
  }

  return { filePath, declaredCount: declared.size, unresolved };
}

function checkInlineHandlers() {
  const html = fs.readFileSync(path.join(ROOT, HTML_FILE), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const handlerRegex = /\son[a-zA-Z]+\s*=\s*['"]([^'"]+)['"]/g;
  const issues = [];

  for (const [sourceName, content] of [[HTML_FILE, html], ['app.js', appJs]]) {
    let m;
    while ((m = handlerRegex.exec(content)) !== null) {
      const handlerBody = m[1].trim();
      // Safe handlers: window.*, this.*, event.*
      const isWindowOrThis = /^(?:window\.|this\.|event\.)/.test(handlerBody);
      // Pure property assignment: e.g. this.style.display='none'
      const isSimpleAssign = /^[a-zA-Z0-9_$.]+\s*=\s*/.test(handlerBody);
      if (!isWindowOrThis && !isSimpleAssign) {
        // Must extract the invoked function identifier
        const fnMatch = /^([a-zA-Z0-9_$]+)\s*\(/.exec(handlerBody);
        if (fnMatch) {
          const fnName = fnMatch[1];
          if (!KNOWN_GLOBALS.has(fnName)) {
            issues.push({ source: sourceName, handler: m[0], functionName: fnName });
          }
        }
      }
    }
  }

  return issues;
}

let hasErrors = false;
console.log('=== COC Media Team Reference Sweep ===');

for (const f of TARGET_FILES) {
  const result = analyzeFile(f);
  if (result.unresolved.size > 0) {
    hasErrors = true;
    console.error(`FAIL: ${result.filePath} has unresolved function calls:`);
    for (const [ident, lines] of result.unresolved.entries()) {
      console.error(`  - ${ident} called at lines: ${lines.join(', ')}`);
    }
  } else {
    console.log(`PASS: ${result.filePath} verified (all function calls resolved, ${result.declaredCount} symbols checked)`);
  }
}

const inlineIssues = checkInlineHandlers();
if (inlineIssues.length > 0) {
  hasErrors = true;
  console.error(`FAIL: Detected potentially broken inline HTML event handlers:`);
  inlineIssues.forEach(iss => {
    console.error(`  - In ${iss.source}: ${iss.handler} calls undefined window.${iss.functionName}`);
  });
} else {
  console.log('PASS: All inline event handlers safe & verified');
}

if (hasErrors) {
  console.error('\nREFERENCE CHECK FAILED.');
  process.exit(1);
} else {
  console.log('\nALL REFERENCE CHECKS PASSED (exit code 0).\n');
  process.exit(0);
}
