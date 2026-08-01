import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export type CanonSource = {
  path: string
  sourceFile: ts.SourceFile
}

export type CanonFinding = {
  path: string
  line: number
  kind: string
  text: string
}

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')

const walk = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(fullPath) : [fullPath]
})

const isProductionSource = (file: string) => {
  const normalized = file.replaceAll('\\', '/')
  return /\.(?:ts|tsx)$/.test(file)
    && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file)
    && !normalized.endsWith('.d.ts')
    && !normalized.includes('/shared/api/contracts/')
}

export const readProductionSources = (): CanonSource[] => walk(sourceRoot)
  .filter(isProductionSource)
  .map((file) => ({
    path: path.relative(frontendRoot, file).replaceAll('\\', '/'),
    sourceFile: ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS),
  }))

const sourceFinding = (source: CanonSource, node: ts.Node, kind: string): CanonFinding => ({
  path: source.path,
  line: source.sourceFile.getLineAndCharacterOfPosition(node.getStart(source.sourceFile)).line + 1,
  kind,
  text: node.getText(source.sourceFile),
})

const visit = (source: CanonSource, predicate: (node: ts.Node) => string | undefined) => {
  const findings: CanonFinding[] = []
  const walkNode = (node: ts.Node) => {
    const kind = predicate(node)
    if (kind) findings.push(sourceFinding(source, node, kind))
    ts.forEachChild(node, walkNode)
  }
  walkNode(source.sourceFile)
  return findings
}

export const findJsxTags = (sources: CanonSource[], tagName: string): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return undefined
    return node.tagName.getText(source.sourceFile) === tagName ? `jsx:${tagName}` : undefined
  }),
)

export const findJsxTagsWithinAncestor = (
  sources: CanonSource[],
  tagName: string,
  ancestorTagName: string,
): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return undefined
    if (node.tagName.getText(source.sourceFile) !== tagName) return undefined

    let ancestor = node.parent
    while (ancestor) {
      if (ts.isJsxOpeningElement(ancestor) && ancestor.tagName.getText(source.sourceFile) === ancestorTagName) {
        return `jsx:${tagName}:within:${ancestorTagName}`
      }
      if (ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText(source.sourceFile) === ancestorTagName) {
        return `jsx:${tagName}:within:${ancestorTagName}`
      }
      ancestor = ancestor.parent
    }
    return undefined
  }),
)

export const findJsxTagsWithStringAttribute = (
  sources: CanonSource[],
  tagName: string,
  attributeName: string,
  attributeValue: string,
): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return undefined
    if (node.tagName.getText(source.sourceFile) !== tagName) return undefined
    const attribute = node.attributes.properties.find((property) =>
      ts.isJsxAttribute(property) && property.name.getText(source.sourceFile) === attributeName,
    )
    if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer || !ts.isStringLiteral(attribute.initializer)) return undefined
    return attribute.initializer.text === attributeValue
      ? `jsx:${tagName}:${attributeName}=${attributeValue}`
      : undefined
  }),
)

export const findCall = (sources: CanonSource[], owner: string, member: string): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined
    return node.expression.expression.getText(source.sourceFile) === owner && node.expression.name.text === member
      ? `call:${owner}.${member}`
      : undefined
  }),
)

export const findMethodCalls = (sources: CanonSource[], member: string): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined
    return node.expression.name.text === member ? `method:${member}` : undefined
  }),
)

export const findDatePresentationCalls = (sources: CanonSource[]): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (ts.isNewExpression(node)
      && node.expression.getText(source.sourceFile) === 'Intl.DateTimeFormat'
      && node.arguments?.some((argument) => ts.isStringLiteralLike(argument) && argument.text === 'vi-VN')) {
      return 'date-presentation:Intl.DateTimeFormat'
    }

    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined
    if (['toLocaleDateString', 'toLocaleTimeString'].includes(node.expression.name.text)) {
      return `date-presentation:${node.expression.name.text}`
    }
    if (node.expression.name.text !== 'toLocaleString') return undefined
    const receiver = node.expression.expression
    return ts.isNewExpression(receiver) && receiver.expression.getText(source.sourceFile) === 'Date'
      ? `date-presentation:${node.expression.name.text}`
      : undefined
  }),
)

export const findIdentifier = (sources: CanonSource[], identifier: string): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => ts.isIdentifier(node) && node.text === identifier ? `identifier:${identifier}` : undefined),
)

export const findProductionImportsFromTests = (sources: CanonSource[]): CanonFinding[] => sources.flatMap((source) =>
  visit(source, (node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return undefined
    const modulePath = node.moduleSpecifier.text.replaceAll('\\', '/')
    return /(?:^|\/)tests(?:\/|$)|\.(?:test|spec)(?:\.|$)/.test(modulePath)
      ? 'production-imports-test-inventory'
      : undefined
  }),
)

export const findingLocations = (findings: CanonFinding[]) => findings.map(({ path: file, line }) => `${file}:${line}`)
