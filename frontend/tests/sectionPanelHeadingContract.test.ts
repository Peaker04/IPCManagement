import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

type Classification = {
  path: string
  occurrence: number
  title: string
  classification: 'route-primary' | 'nested-detail' | 'conditional' | 'headingless'
  headingLevel?: 2 | 3 | 4
  headingLevelByState?: { standalone: 2 | 3 | 4; nested: 2 | 3 | 4 }
  rationale: string
}

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'sectionPanelHeadingClassification.json'), 'utf8')) as {
  defaultHeadingLevel: 2 | 3 | 4
  callsites: Classification[]
}

const productionTsxFiles = () => fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx') && !/\.(?:test|spec)\.tsx$/.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))
  .sort()

const attribute = (node: ts.JsxAttributes, name: string) => node.properties.find(
  (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
)

const explicitHeadingLevel = (attributes: ts.JsxAttributes, sourceFile: ts.SourceFile) => {
  const heading = attribute(attributes, 'headingLevel')
  if (!heading?.initializer || !ts.isJsxExpression(heading.initializer) || !heading.initializer.expression) return undefined
  const expression = heading.initializer.expression
  if (ts.isNumericLiteral(expression)) return Number(expression.text)
  return expression.getText(sourceFile)
}

const discoverCallsites = () => productionTsxFiles().flatMap((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Array<{ path: string; occurrence: number; hasTitle: boolean; explicitLevel?: number | string }> = []
  let occurrence = 0

  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sourceFile) === 'SectionPanel') {
      occurrence += 1
      found.push({
        path: path.relative(frontendRoot, file).replaceAll('\\', '/'),
        occurrence,
        hasTitle: Boolean(attribute(node.attributes, 'title')),
        explicitLevel: explicitHeadingLevel(node.attributes, sourceFile),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
})

const keyOf = ({ path: owner, occurrence }: { path: string; occurrence: number }) => `${owner}#${occurrence}`

describe('SectionPanel semantic heading classification', () => {
  it('classifies every production callsite and keeps nested/detail levels explicit', () => {
    const discovered = discoverCallsites()
    expect(discovered.map(keyOf).sort()).toEqual(manifest.callsites.map(keyOf).sort())

    const expectedByKey = new Map(manifest.callsites.map((item) => [keyOf(item), item]))
    for (const callsite of discovered) {
      const expected = expectedByKey.get(keyOf(callsite))!
      if (expected.classification === 'headingless') {
        expect(callsite.hasTitle, keyOf(callsite)).toBe(false)
        continue
      }
      expect(callsite.hasTitle, keyOf(callsite)).toBe(true)
      if (expected.classification === 'nested-detail') {
        expect(callsite.explicitLevel, keyOf(callsite)).toBe(expected.headingLevel)
      } else if (expected.classification === 'conditional') {
        expect(callsite.explicitLevel, keyOf(callsite)).toBe('standalone ? 2 : 3')
      } else {
        expect(callsite.explicitLevel ?? manifest.defaultHeadingLevel, keyOf(callsite)).toBe(2)
      }
    }
  })

  it('keeps the manifest bounded to the current 65 production callsites', () => {
    expect(manifest.callsites).toHaveLength(65)
    expect(manifest.callsites.filter(({ classification }) => classification === 'route-primary')).toHaveLength(60)
    expect(manifest.callsites.filter(({ classification }) => classification === 'nested-detail')).toHaveLength(3)
    expect(manifest.callsites.filter(({ classification }) => classification === 'conditional')).toHaveLength(1)
    expect(manifest.callsites.filter(({ classification }) => classification === 'headingless')).toHaveLength(1)
  })
})
