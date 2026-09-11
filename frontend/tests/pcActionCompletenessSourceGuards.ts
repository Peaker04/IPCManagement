export type PcSourceGuard = {
  sourcePath: string
  source: string
  fragments: readonly string[]
}

export type PcSourceRangeProbe = {
  descriptor: string
  source: string
  fragment: string
}

export const assertUniquePcSourceFragments = (guards: readonly PcSourceGuard[]) => {
  guards.forEach(({ sourcePath, source, fragments }) => {
    fragments.forEach((fragment) => {
      const matches = source.split(fragment).length - 1
      if (matches !== 1) {
        throw new Error(`${sourcePath} must contain exactly one PC source fragment: ${fragment}`)
      }
    })
  })
}

export const assertPcSourceRangeProbes = (probes: readonly PcSourceRangeProbe[]) => {
  probes.forEach(({ descriptor, source, fragment }) => {
    const normalizedDescriptor = descriptor.split(' — ')[0]
    const match = /^(.+):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/.exec(normalizedDescriptor)
    if (!match) throw new Error(`Invalid PC source descriptor: ${descriptor}`)
    const lines = source.split(/\r?\n/)
    const selected = match[2].split(',').flatMap((part) => {
      const [startText, endText = startText] = part.split('-')
      const start = Number(startText)
      const end = Number(endText)
      if (start < 1 || end < start || end > lines.length) {
        throw new Error(`PC source descriptor is out of bounds: ${descriptor}`)
      }
      return lines.slice(start - 1, end)
    }).join('\n')
    const matches = selected.split(fragment).length - 1
    if (matches !== 1) {
      throw new Error(`PC source range ${descriptor} must contain exactly one guarded fragment: ${fragment}`)
    }
  })
}

export const findProductionPcImports = (
  productionSources: Readonly<Record<string, string>>,
  forbiddenNames: readonly string[],
) => Object.entries(productionSources)
  .filter(([, source]) => forbiddenNames.some((name) => source.includes(name)))
  .map(([file]) => file)
  .sort()
