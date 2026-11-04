/**
 * tests/check-scope.mjs
 * Static scope analyzer using Node's internal acorn parser.
 * Detects unresolved identifier references and temporal dead zone (TDZ) violations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let acorn, walk;

try {
  acorn = require('internal/deps/acorn/acorn/dist/acorn');
  walk = require('internal/deps/acorn/acorn-walk/dist/walk');
} catch (e) {
  console.error('Failed to load internal acorn:', e.message);
  process.exit(1);
}

const ROOT = process.cwd();

const COMMON_GLOBALS = new Set([
  // Standard ECMAScript Globals
  'Object', 'Function', 'Array', 'Number', 'parseFloat', 'parseInt', 'Infinity', 'NaN', 'undefined',
  'Boolean', 'String', 'Symbol', 'Date', 'Promise', 'RegExp', 'Error', 'AggregateError', 'EvalError',
  'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'globalThis', 'JSON', 'Math',
  'Intl', 'ArrayBuffer', 'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'Uint8ClampedArray', 'BigInt64Array', 'BigUint64Array', 'DataView',
  'Map', 'BigInt', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'escape', 'unescape', 'eval', 'isFinite', 'isNaN',

  // Standard Web / Browser / DOM Globals
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'console', 'fetch',
  'Headers', 'Request', 'Response', 'FormData', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader',
  'Image', 'Audio', 'Event', 'CustomEvent', 'EventTarget', 'performance', 'Performance', 'AbortController',
  'AbortSignal', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'requestAnimationFrame',
  'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'structuredClone', 'crypto', 'CryptoKey', 'SubtleCrypto', 'atob', 'btoa', 'TextEncoder', 'TextDecoder',
  'createImageBitmap', 'matchMedia', 'getComputedStyle', 'history', 'screen', 'alert', 'prompt', 'confirm',
  'Notification', 'caches', 'indexedDB', 'CSS', 'HTMLElement', 'Element', 'Node',
  'HTMLInputElement', 'HTMLButtonElement', 'HTMLTextAreaElement', 'HTMLSelectElement',

  // Third-party CDN libraries loaded globally in index.html
  'lucide'
]);

const WORKER_GLOBALS = new Set([
  ...COMMON_GLOBALS,
  'self', 'clients', 'importScripts', 'registration', 'skipWaiting', 'firebase'
]);

class Scope {
  constructor(parent = null, type = 'block') {
    this.parent = parent;
    this.type = type; // 'module', 'function', 'block', 'catch', 'for'
    this.bindings = new Map();
    this.functionScope = (type === 'function' || type === 'module') ? this : (parent ? parent.functionScope : this);
  }

  declare(name, kind, loc) {
    this.bindings.set(name, { kind, loc });
  }

  declareVar(name, loc) {
    this.functionScope.declare(name, 'var', loc);
  }

  has(name) {
    if (this.bindings.has(name)) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    return null;
  }
}

function extractPatternBindings(node, callback) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier':
      callback(node.name, node.loc);
      break;
    case 'AssignmentPattern':
      extractPatternBindings(node.left, callback);
      break;
    case 'RestElement':
      extractPatternBindings(node.argument, callback);
      break;
    case 'ArrayPattern':
      node.elements.forEach(el => extractPatternBindings(el, callback));
      break;
    case 'ObjectPattern':
      node.properties.forEach(prop => {
        if (prop.type === 'Property') {
          extractPatternBindings(prop.value, callback);
        } else if (prop.type === 'RestElement') {
          extractPatternBindings(prop.argument, callback);
        }
      });
      break;
  }
}

function analyzeFile(relativePath, sourceType = 'module') {
  const fullPath = path.join(ROOT, relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');

  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType,
      locations: true
    });
  } catch (err) {
    console.error(`Parse error in ${relativePath}:`, err.message);
    return [{ file: relativePath, line: err.loc?.line || 1, col: err.loc?.column || 0, name: err.message }];
  }

  const globalScope = new Scope(null, sourceType);
  const allowedGlobals = sourceType === 'module' ? COMMON_GLOBALS : WORKER_GLOBALS;

  let currentScope = globalScope;
  const references = []; // { name, loc, scope, isTopLevel }
  let functionNesting = 0;

  // Manual recursive AST traversal to maintain exact scopes
  function visit(node) {
    if (!node || typeof node !== 'object') return;

    const prevScope = currentScope;

    switch (node.type) {
      case 'Program': {
        // Collect top-level imports and hoisted function declarations
        for (const stmt of node.body) {
          if (stmt.type === 'ImportDeclaration') {
            for (const spec of stmt.specifiers) {
              globalScope.declare(spec.local.name, 'import', spec.local.loc);
            }
          } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
            globalScope.declare(stmt.id.name, 'function', stmt.id.loc);
          } else if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) {
            if (stmt.declaration.type === 'FunctionDeclaration' && stmt.declaration.id) {
              globalScope.declare(stmt.declaration.id.name, 'function', stmt.declaration.id.loc);
            }
          }
        }
        for (const stmt of node.body) {
          visit(stmt);
        }
        return;
      }

      case 'FunctionDeclaration': {
        if (node.id && currentScope !== globalScope) {
          currentScope.declare(node.id.name, 'function', node.id.loc);
        }
        currentScope = new Scope(prevScope, 'function');
        functionNesting++;
        // Parameters
        for (const param of node.params) {
          extractPatternBindings(param, (name, loc) => {
            currentScope.declare(name, 'param', loc);
          });
        }
        visit(node.body);
        functionNesting--;
        currentScope = prevScope;
        return;
      }

      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        currentScope = new Scope(prevScope, 'function');
        functionNesting++;
        if (node.id) {
          currentScope.declare(node.id.name, 'function-name', node.id.loc);
        }
        for (const param of node.params) {
          extractPatternBindings(param, (name, loc) => {
            currentScope.declare(name, 'param', loc);
          });
        }
        visit(node.body);
        functionNesting--;
        currentScope = prevScope;
        return;
      }

      case 'BlockStatement': {
        currentScope = new Scope(prevScope, 'block');
        for (const stmt of node.body) {
          visit(stmt);
        }
        currentScope = prevScope;
        return;
      }

      case 'CatchClause': {
        currentScope = new Scope(prevScope, 'catch');
        if (node.param) {
          extractPatternBindings(node.param, (name, loc) => {
            currentScope.declare(name, 'catch-param', loc);
          });
        }
        visit(node.body);
        currentScope = prevScope;
        return;
      }

      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement': {
        currentScope = new Scope(prevScope, 'for');
        if (node.init || node.left) {
          visit(node.init || node.left);
        }
        if (node.test) visit(node.test);
        if (node.update) visit(node.update);
        if (node.right) visit(node.right);
        visit(node.body);
        currentScope = prevScope;
        return;
      }

      case 'VariableDeclaration': {
        const kind = node.kind; // 'var', 'let', 'const'
        for (const decl of node.declarations) {
          if (decl.init) visit(decl.init);
          extractPatternBindings(decl.id, (name, loc) => {
            if (kind === 'var') {
              currentScope.declareVar(name, loc);
            } else {
              currentScope.declare(name, kind, loc);
            }
          });
        }
        return;
      }

      case 'ClassDeclaration': {
        if (node.id) {
          currentScope.declare(node.id.name, 'class', node.id.loc);
        }
        if (node.superClass) visit(node.superClass);
        currentScope = new Scope(prevScope, 'class');
        visit(node.body);
        currentScope = prevScope;
        return;
      }

      case 'ClassExpression': {
        currentScope = new Scope(prevScope, 'class');
        if (node.id) {
          currentScope.declare(node.id.name, 'class-name', node.id.loc);
        }
        if (node.superClass) visit(node.superClass);
        visit(node.body);
        currentScope = prevScope;
        return;
      }

      case 'UnaryExpression': {
        if (node.operator === 'typeof' && node.argument.type === 'Identifier') {
          // typeof x is explicitly exempt per prompt
          return;
        }
        visit(node.argument);
        return;
      }

      case 'MemberExpression': {
        visit(node.object);
        if (node.computed) {
          visit(node.property);
        }
        return;
      }

      case 'Property': {
        if (node.computed) {
          visit(node.key);
        }
        // In shorthand { foo }, foo is both key and value reference
        visit(node.value);
        return;
      }

      case 'ImportDeclaration': {
        // Specifiers are declarations, already handled
        return;
      }

      case 'ExportNamedDeclaration': {
        if (node.declaration) {
          visit(node.declaration);
        } else if (!node.source) {
          // export { a, b as c }; -> local reference to a, b
          for (const spec of node.specifiers) {
            references.push({
              name: spec.local.name,
              loc: spec.local.loc,
              scope: currentScope,
              isTopLevel: functionNesting === 0
            });
          }
        }
        return;
      }

      case 'Identifier': {
        references.push({
          name: node.name,
          loc: node.loc,
          scope: currentScope,
          isTopLevel: functionNesting === 0
        });
        return;
      }
    }

    // Default: visit all child nodes
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item.type === 'string') visit(item);
        }
      } else if (child && typeof child.type === 'string') {
        visit(child);
      }
    }
  }

  visit(ast);

  // Now resolve all references against scope hierarchy
  const findings = [];

  for (const ref of references) {
    const { name, loc, scope, isTopLevel } = ref;

    if (allowedGlobals.has(name)) {
      continue;
    }

    const binding = scope.get(name);
    if (!binding) {
      findings.push({
        file: relativePath,
        line: loc.start.line,
        col: loc.start.column,
        name,
        type: 'UNDEFINED'
      });
    } else if (isTopLevel && (binding.kind === 'let' || binding.kind === 'const' || binding.kind === 'class')) {
      // Check for TDZ violation at module top-level
      if (loc.start.line < binding.loc.start.line || (loc.start.line === binding.loc.start.line && loc.start.column < binding.loc.start.column)) {
        findings.push({
          file: relativePath,
          line: loc.start.line,
          col: loc.start.column,
          name,
          type: 'TDZ_VIOLATION'
        });
      }
    }
  }

  return findings;
}

console.log('=== REAL UNDEFINED-IDENTIFIER SCANNER ===');

const TARGETS = [
  { file: 'app.js', type: 'module' },
  { file: 'sw.js', type: 'script' },
  { file: 'firebase-messaging-sw.js', type: 'script' }
];

let totalFindings = 0;

for (const target of TARGETS) {
  const issues = analyzeFile(target.file, target.type);
  if (issues.length > 0) {
    totalFindings += issues.length;
    console.error(`\nFindings in ${target.file}:`);
    for (const issue of issues) {
      console.error(`${issue.file}:${issue.line}:${issue.col} ${issue.name} (${issue.type})`);
    }
  } else {
    console.log(`PASS: ${target.file} has 0 undefined references or TDZ violations.`);
  }
}

if (totalFindings > 0) {
  console.error(`\nTOTAL FINDINGS: ${totalFindings}`);
  process.exit(1);
} else {
  console.log('\nZERO FINDINGS. All identifiers cleanly declared & scoped (exit code 0).\n');
  process.exit(0);
}
