#!/usr/bin/env node
// Kletron rebrand helper: lists the string literals of TS/TSX/JS files through the TypeScript
// compiler AST (never identifiers), with a "skip" reason when the literal is data, not display.
// Usage: node ts-literals.cjs <root> < files.txt  -> one JSON object per file on stdout.
'use strict'
const fs = require('fs')
const path = require('path')
const ts = require(require.resolve('typescript', { paths: [process.cwd(), path.resolve(process.argv[2] || '.')] }))

const MATCHERS = new Set(['startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf', 'replace', 'replaceAll',
  'split', 'match', 'matchAll', 'search', 'test', 'has', 'get', 'getItem', 'setItem', 'removeItem', 'querySelector',
  'querySelectorAll', 'getElementById', 'getAttribute', 'require', 'resolve', 'join', 'env', 'getenv', 'on', 'once',
  'handle', 'send', 'invoke', 'emit', 'off', 'removeListener', 'addEventListener', 'RegExp', 'which', 'spawn',
  'execFile', 'execFileSync', 'spawnSync', 'exec', 'execSync'])
const DATA_ATTRS = /^(className|class|id|key|name|type|role|htmlFor|data-.*|testId|href|src|value|lang|dir|rel|target)$/

function skipReason(node) {
  const p = node.parent
  if (!p) return null
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return 'module-specifier'
  if (ts.isLiteralTypeNode(p)) return 'type'
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature?.(p) || ts.isMethodDeclaration(p) || ts.isEnumMember(p)) && p.name === node) return 'property-key'
  if (ts.isComputedPropertyName(p)) return 'property-key'
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return 'subscript'
  if (ts.isCaseClause(p)) return 'switch-case'
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return 'comparison'
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.arguments && p.arguments.includes(node)) {
    const e = p.expression
    const name = ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : ''
    if (MATCHERS.has(name) || e.kind === ts.SyntaxKind.ImportKeyword) return `matcher:${name || 'import'}`
  }
  if (ts.isJsxAttribute(p) && DATA_ATTRS.test(p.name.getText())) return 'data-attribute'
  return null
}

const root = path.resolve(process.argv[2] || '.')
const files = fs.readFileSync(0, 'utf8').split('\n').filter(Boolean)
const NEEDLES = JSON.parse(process.env.KLETRON_REBRAND_NEEDLES || '["Hermes"]')
for (const rel of files) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : rel.endsWith('.ts') || rel.endsWith('.mts') || rel.endsWith('.cts') ? ts.ScriptKind.TS : rel.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const spans = []
  // TypeScript offsets are UTF-16 code units; Python slices by code point: convert (emoji, astral chars).
  const cpAt = /[\uD800-\uDBFF]/.test(text) ? (() => {
    const m = new Int32Array(text.length + 1); let c = 0
    for (let i = 0; i < text.length; i++) { m[i] = c; const u = text.charCodeAt(i); if (!(u >= 0xDC00 && u <= 0xDFFF && i > 0 && text.charCodeAt(i - 1) >= 0xD800 && text.charCodeAt(i - 1) <= 0xDBFF)) c++ ; else m[i] = c }
    m[text.length] = c; return m
  })() : null
  const cp = i => (cpAt ? cpAt[i] : i)
  const visit = node => {
    let start = -1, end = -1
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) { start = node.getStart(sf) + 1; end = node.getEnd() - 1 }
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      start = node.getStart(sf) + 1; end = node.getEnd() - (ts.isTemplateTail(node) ? 1 : 2)
    } else if (ts.isJsxText(node)) { start = node.getStart(sf); end = node.getEnd() }
    else if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) { start = node.getStart(sf) + 1; end = node.getEnd() - (node.getText(sf).length - node.getText(sf).lastIndexOf('/')) }
    if (start >= 0 && NEEDLES.some(n => text.slice(start, end).includes(n))) {
      const lit = ts.isTemplateHead(node) ? node.parent : ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.parent.parent : node
      const skip = node.kind === ts.SyntaxKind.RegularExpressionLiteral ? 'regex'
        : lit.parent && ts.isTaggedTemplateExpression(lit.parent) ? 'tagged-template' : skipReason(lit)
      spans.push({ start: cp(start), end: cp(end), line: sf.getLineAndCharacterOfPosition(start).line + 1, skip })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  process.stdout.write(JSON.stringify({ file: rel, spans }) + '\n')
}
