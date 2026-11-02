// @vitest-environment node
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { es } from './es'

// Every literal t('...') and pluralize(n, '...') in the app needs a Spanish entry,
// so a new English string can't ship untranslated.
function collect() {
  const keys = new Set<string>()
  const words = new Set<string>()
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f)
      if (fs.statSync(p).isDirectory()) {
        if (!/node_modules|\.next|i18n/.test(p)) walk(p)
      } else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) {
        const sf = ts.createSourceFile(
          p,
          fs.readFileSync(p, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        )
        const visit = (n: ts.Node) => {
          if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
            const [a0, a1] = n.arguments
            const lit = (a?: ts.Expression) =>
              a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
                ? a.text
                : undefined
            if (n.expression.text === 't' && lit(a0) !== undefined) keys.add(lit(a0)!)
            if ((n.expression.text === 'pluralize' || n.expression.text === 'tn') && lit(a1))
              words.add(lit(a1)!)
          }
          ts.forEachChild(n, visit)
        }
        visit(sf)
      }
    }
  }
  for (const d of ['lib', 'components', 'app']) walk(path.join(process.cwd(), d))
  return { keys: [...keys], words: [...words] }
}

describe('Spanish dictionary', () => {
  const { keys, words } = collect()

  it('covers every English string', () => {
    expect(keys.length).toBeGreaterThan(500)
    expect(keys.filter((k) => !(k in es))).toEqual([])
  })

  it('covers every counted word', () => {
    expect(words.filter((w) => !es[`#${w}`]?.includes('|'))).toEqual([])
  })

  it('keeps the same placeholders', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    const bad = Object.entries(es).filter(([k, v]) => !k.startsWith('#') && names(k) !== names(v))
    expect(bad).toEqual([])
  })
})
