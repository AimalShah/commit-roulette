/**
 * Turns (player code, test code, language) into the single script Judge0 runs.
 *
 * Why one file: the ce.judge0.com instance drops the multi-file `files` array
 * and writes `source_code` to /box/script.js alone, so a `./solution` import
 * dies with ERR_MODULE_NOT_FOUND. Verified, not assumed — docs/PLAN.md §0.
 *
 * The transforms below are deliberately narrow. This is a fixed, hand-checked
 * seed set (PRD §6 cuts arbitrary execution), not a general sandbox, so a
 * bounded documented transform is the right trade — and it is what lets the
 * existing Vitest-dialect test bodies stay verbatim.
 */

import { HARNESS_JS } from './harness/js.ts'
import { HARNESS_PY } from './harness/python.ts'

/** Judge0 language ids on ce.judge0.com, verified present. */
export const JUDGE0_LANGUAGE_IDS = {
  javascript: 102, // JavaScript (Node.js 22.08.0)
  python: 100, // Python (3.12.5)
} as const

export type Language = keyof typeof JUDGE0_LANGUAGE_IDS

const JS_IMPORT_FROM_SOLUTION =
  /^\s*import\s+[\s\S]*?from\s+['"]\.\/solution['"];?\s*$/gm
const PY_IMPORT_FROM_SOLUTION = /^\s*from\s+[\s\S]*?import\s+[^\n]*$\n?/gm

/**
 * Flattens ESM into one module scope. Node parses /box/script.js as an ES
 * module, so `export function foo` is legal but `import ... from './solution'`
 * is not resolvable — the declaration has to lose its `export` and the import
 * has to disappear entirely.
 */
function flattenJs(code: string): string {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^(\s*)export\s+default\s+/gm, '$1const __default = ')
    .replace(/^(\s*)export\s+(?=(async\s+)?(function|class|const|let|var)\b)/gm, '$1')
}

export function buildJsScript(solution: string, testCode: string): string {
  return [
    HARNESS_JS,
    flattenJs(solution),
    testCode.replace(JS_IMPORT_FROM_SOLUTION, ''),
    'await __run()',
  ].join('\n\n')
}

export function buildPythonScript(solution: string, testCode: string): string {
  return [
    HARNESS_PY,
    solution,
    testCode.replace(PY_IMPORT_FROM_SOLUTION, ''),
    '__collect_public()',
    '__run()',
  ].join('\n\n')
}

export function buildScript(
  language: Language,
  solution: string,
  testCode: string,
): string {
  return language === 'python'
    ? buildPythonScript(solution, testCode)
    : buildJsScript(solution, testCode)
}
