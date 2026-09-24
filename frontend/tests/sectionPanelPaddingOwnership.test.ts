import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { readProductionSources } from './uiCanonSourceInventory';

type Finding = { path: string; line: number; className: string };

const canonicalModules = new Set(['@/components/common', '@/components/common/SectionPanel']);
const baseToken = (token: string) => token.split(':').at(-1) ?? token;
const arbitraryLength = (token: string) => token.match(/\[([0-9.]+)(px|rem|em)\]$/)?.[1];
const nonzeroArbitraryLength = (token: string) => {
  const value = arbitraryLength(token);
  return value === undefined || Number.parseFloat(value) !== 0;
};
const hasHorizontalPadding = (value: string) => value.split(/\s+/).some((token) => {
  const base = baseToken(token);
  return /^(?:p|px)-(?!0$)\S+/.test(base) && nonzeroArbitraryLength(base);
});
const hasEffectiveBorder = (value: string) => value.split(/\s+/).some((token) => {
  const base = baseToken(token);
  return base === 'border'
    || (/^border-(?:[1-9]\d*|\[[0-9.]+(?:px|rem|em)\])$/.test(base) && nonzeroArbitraryLength(base))
    || (/^border-(?:x|y|t|r|b|l)(?:-(?:[1-9]\d*|\[[0-9.]+(?:px|rem|em)\]))?$/.test(base) && nonzeroArbitraryLength(base));
});

function acceptedNames(file: ts.SourceFile, sourcePath: string) {
  const names = new Set<string>();
  file.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) return;
    const moduleName = String(statement.moduleSpecifier.text);
    const relativeCanonical = sourcePath.startsWith('src/components/common/') && moduleName === './SectionPanel';
    if (!canonicalModules.has(moduleName) && !relativeCanonical) return;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    bindings.elements.forEach((element) => {
      if ((element.propertyName?.text ?? element.name.text) === 'SectionPanel') names.add(element.name.text);
    });
  });
  return names;
}

function classLiteral(node: ts.JsxOpeningLikeElement, file: ts.SourceFile) {
  const attribute = node.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText(file) === 'className');
  if (!attribute?.initializer) return '';
  if (ts.isStringLiteralLike(attribute.initializer)) return attribute.initializer.text;
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return '';
  const expression = attribute.initializer.expression;
  if (ts.isStringLiteralLike(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isCallExpression(expression) && expression.expression.getText(file) === 'cn') {
    return expression.arguments.filter(ts.isStringLiteralLike).map((argument) => argument.text).join(' ');
  }
  return '';
}

function hasFalsePadded(node: ts.JsxOpeningElement, file: ts.SourceFile) {
  return node.attributes.properties.some((property) =>
    ts.isJsxAttribute(property)
      && property.name.getText(file) === 'padded'
      && property.initializer
      && ts.isJsxExpression(property.initializer)
      && property.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword);
}

const meaningful = (children: readonly ts.JsxChild[]) => children.filter((child) =>
  (!ts.isJsxText(child) || child.getText().trim().length > 0)
    && (!ts.isJsxExpression(child) || Boolean(child.expression)));

function renderedRoot(child: ts.JsxChild): ts.JsxElement | ts.JsxSelfClosingElement | undefined {
  if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) return child;
  if (ts.isJsxFragment(child)) {
    const children = meaningful(child.children);
    return children.length === 1 ? renderedRoot(children[0]) : undefined;
  }
  if (ts.isJsxExpression(child) && child.expression) {
    let expression = child.expression;
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
    if (ts.isJsxFragment(expression)) {
      const children = meaningful(expression.children);
      return children.length === 1 ? renderedRoot(children[0]) : undefined;
    }
    return ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression) ? expression : undefined;
  }
  return undefined;
}

function inspectSource(path: string, source: string): Finding[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sectionPanelNames = acceptedNames(file, path);
  const findings: Finding[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && sectionPanelNames.has(node.openingElement.tagName.getText(file)) && !hasFalsePadded(node.openingElement, file)) {
      const children = meaningful(node.children);
      const child = children.length === 1 ? renderedRoot(children[0]) : undefined;
      if (child) {
        const opening = ts.isJsxElement(child) ? child.openingElement : child;
        const value = classLiteral(opening, file);
        if (hasHorizontalPadding(value) && !hasEffectiveBorder(value)) {
          const position = file.getLineAndCharacterOfPosition(opening.getStart(file));
          findings.push({ path, line: position.line + 1, className: value });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return findings;
}

const inspectFixture = (body: string, importLine = "import { SectionPanel } from '@/components/common'") => inspectSource('fixture.tsx', `${importLine}; ${body}`);

describe('SectionPanel padding ownership', () => {
  it('rejects whole-body base, responsive, template, fragment, and expression padding', () => {
    expect(inspectFixture('<SectionPanel><div className="px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className="sm:px-5" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className={`md:p-4`} /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><><div className="px-4" /></></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel>{(<div className="px-4" />)}</SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel>{/* body */}<div className="px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel>{(<><div className="px-4" /></>)}</SectionPanel>')).toHaveLength(1);
  });

  it('resolves aliases and ignores unrelated local components and partial first children', () => {
    expect(inspectFixture('<Panel><div className="px-4" /></Panel>', "import { SectionPanel as Panel } from '@/components/common'")).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className="px-4" /></SectionPanel>', 'const SectionPanel = (props: unknown) => props')).toEqual([]);
    expect(inspectFixture('<SectionPanel><div className="px-4" /><table /></SectionPanel>')).toEqual([]);
  });

  it('allows effective bordered surfaces and explicit unpadded composition but rejects fake surfaces', () => {
    expect(inspectFixture('<SectionPanel><div className="border bg-slate-50 px-4" /></SectionPanel>')).toEqual([]);
    expect(inspectFixture('<SectionPanel><div className="sm:border-b px-4" /></SectionPanel>')).toEqual([]);
    expect(inspectFixture('<SectionPanel padded={false}><div className="px-4" /></SectionPanel>')).toEqual([]);
    expect(inspectFixture('<SectionPanel><div className="border-0 px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className="bg-transparent px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className="border-[red] px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectFixture('<SectionPanel><div className="px-[0px]" /></SectionPanel>')).toEqual([]);
    expect(inspectFixture('<SectionPanel><div className="border-[0px] px-4" /></SectionPanel>')).toHaveLength(1);
    expect(inspectSource('src/components/common/Relative.tsx', "import { SectionPanel } from './SectionPanel'; <SectionPanel><div className=\"px-4\" /></SectionPanel>")).toHaveLength(1);
  });

  it('has no unexplained duplicate horizontal padding in production SectionPanel bodies', () => {
    const findings = readProductionSources().flatMap(({ path, sourceFile }) => inspectSource(path, sourceFile.getFullText()));
    expect(findings).toEqual([]);
  });
});
