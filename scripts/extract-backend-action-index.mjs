import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function unique(values) {
  return [...new Set(values)];
}

function policiesFrom(attributes) {
  return [...attributes.matchAll(/\bAuthorize(?:\s*\(\s*([^\]]*?)\s*\))?/g)].map((match) => {
    const policy = match[1]?.match(/Policy\s*=\s*(?:"([^"]+)"|[\w.]+\.([A-Za-z0-9_]+))/);
    return policy?.[1] || policy?.[2] || 'AUTHENTICATED';
  });
}

function routeFrom(attributes) {
  return attributes.match(/\bRoute\s*\(\s*"([^"]+)"\s*\)/)?.[1] || '';
}

function combineRoute(controllerRoute, actionRoute) {
  return [controllerRoute, actionRoute].filter(Boolean).join('/').replace(/\/{2,}/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

function controllerDeclaration(source) {
  const match = source.match(/([\s\S]*?)public\s+(?:sealed\s+)?(?:partial\s+)?class\s+(\w+Controller)\b/);
  if (!match) return null;
  return { controller: match[2], route: routeFrom(match[1]), policies: policiesFrom(match[1]) };
}

export function extractControllerActions(source, sourcePath, inheritedMetadata = {}) {
  const declaration = controllerDeclaration(source);
  if (!declaration) return [];
  const controller = declaration.controller;
  const controllerRoute = (declaration.route || inheritedMetadata.route || '').replace('[controller]', controller.replace(/Controller$/, '').toLowerCase());
  const classPolicies = unique([...(inheritedMetadata.policies || []), ...declaration.policies]);
  const actions = [];
  const actionPattern = /(\[Http(?:Get|Post|Put|Patch|Delete)[\s\S]*?)public\s+(?:async\s+)?([\s\S]*?)\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:\{|=>)/g;
  for (const match of source.matchAll(actionPattern)) {
    const [, attributes, returnType, sourceMethod, parameters] = match;
    const http = attributes.match(/\bHttp(Get|Post|Put|Patch|Delete)(?:\s*\(\s*"([^"]*)"[^)]*\))?/);
    if (!http) continue;
    const [, verb, actionRoute = ''] = http;
    const responseTypes = unique([
      ...[...attributes.matchAll(/typeof\s*\(([^)]+)\)/g)].flatMap((item) => [...item[1].matchAll(/\b([A-Z]\w*Dto)\b/g)].map((dto) => dto[1])),
      ...[...returnType.matchAll(/\b([A-Z]\w*Dto)\b/g)].map((item) => item[1]),
    ]);
    const requestTypes = unique([...parameters.matchAll(/\[FromBody\]\s*([A-Z]\w*)/g)].map((item) => item[1]));
    actions.push({
      actionId: `${controller.replace(/Controller$/, '')}.${sourceMethod.replace(/Async$/, '')}`,
      controller,
      sourceMethod,
      source: sourcePath.replaceAll('\\', '/'),
      httpMethod: verb.toUpperCase(),
      route: combineRoute(controllerRoute, actionRoute),
      policies: unique([...classPolicies, ...policiesFrom(attributes)]),
      requestTypes,
      responseTypes,
    });
  }
  return actions;
}

function controllerFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) files.push(...controllerFiles(absolute));
    else if (/Controller(?:\.[^.]+)?\.cs$/.test(entry)) files.push(absolute);
  }
  return files;
}

export function buildBackendActionIndex(repoRoot) {
  const root = resolve(repoRoot);
  const featureRoot = join(root, 'backend/src/IPCManagement.Api/Features');
  const files = controllerFiles(featureRoot);
  const sources = files.map((absolute) => ({ absolute, source: readFileSync(absolute, 'utf8') }));
  const metadata = new Map();
  for (const item of sources) {
    const declaration = controllerDeclaration(item.source);
    if (!declaration) continue;
    const current = metadata.get(declaration.controller) || { route: '', policies: [] };
    metadata.set(declaration.controller, {
      route: declaration.route || current.route,
      policies: unique([...current.policies, ...declaration.policies]),
    });
  }
  const actions = sources.flatMap(({ absolute, source }) => {
    const declaration = controllerDeclaration(source);
    return extractControllerActions(source, relative(root, absolute), declaration ? metadata.get(declaration.controller) : undefined);
  });
  return { version: 1, actions: actions.sort((a, b) => a.actionId.localeCompare(b.actionId) || a.route.localeCompare(b.route)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = process.cwd();
  const output = process.argv[2] || 'docs/backend-action-index.json';
  writeFileSync(resolve(output), `${JSON.stringify(buildBackendActionIndex(repoRoot), null, 2)}\n`);
  console.log(`Backend action index written: ${output}`);
}
