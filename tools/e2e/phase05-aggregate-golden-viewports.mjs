import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/viewports')
const expected = [[1920, 1080], [1440, 900], [1366, 768], [1365, 900], [1280, 900]]
const viewports = []

for (const [width, height] of expected) {
  const source = JSON.parse(await readFile(path.join(output, `result-${width}.json`), 'utf8'))
  if (source.verdict !== 'PASS' || source.lane !== 'ipc_lane7' || source.protectedLaneConnectionAttempts !== 0 || source.viewports.length !== 1) {
    throw new Error(`Viewport evidence ${width}x${height} is not a lane7 PASS`)
  }
  const [row] = source.viewports
  if (row.width !== width || row.height !== height || row.pass !== true || row.cls > 0.1) {
    throw new Error(`Viewport evidence ${width}x${height} does not match the canonical gate`)
  }
  viewports.push(row)
}

const distinctTimeOrigins = new Set(viewports.map((row) => row.timeOrigin)).size === expected.length
const cleanRuntime = viewports.every((row) =>
  row.consoleErrors.length === 0 &&
  row.pageErrors.length === 0 &&
  row.requestFailures.length === 0 &&
  row.failedResponses.length === 0
)
const result = {
  verdict: distinctTimeOrigins && cleanRuntime ? 'PASS' : 'FAIL',
  lane: 'ipc_lane7',
  protectedLaneConnectionAttempts: 0,
  distinctTimeOrigins,
  viewports,
}

await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
if (result.verdict !== 'PASS') process.exitCode = 1
