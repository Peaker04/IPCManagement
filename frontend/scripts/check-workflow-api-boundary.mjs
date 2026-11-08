import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('src')
const target = '@/api/workflowApi'
const files = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) files.push(file)
  }
}

await walk(root)
const consumers = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/import\s+(type\s+)?[\s\S]*?from\s+['"]@\/api\/workflowApi['"]/g)) {
    consumers.push({
      file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
      kind: match[1] ? 'type-only' : 'runtime',
    })
  }
}

const runtime = consumers.filter((entry) => entry.kind === 'runtime')
const typeOnly = consumers.filter((entry) => entry.kind === 'type-only')
console.log(JSON.stringify({
  target,
  total: consumers.length,
  runtimeCount: runtime.length,
  typeOnlyCount: typeOnly.length,
  runtime,
  typeOnly,
}, null, 2))

if (runtime.length === 0) process.exit(0)
