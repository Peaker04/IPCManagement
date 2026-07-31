export type PcSourceGuard = {
  sourcePath: string
  source: string
  fragments: readonly string[]
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

export const findProductionPcImports = (
  productionSources: Readonly<Record<string, string>>,
  forbiddenNames: readonly string[],
) => Object.entries(productionSources)
  .filter(([, source]) => forbiddenNames.some((name) => source.includes(name)))
  .map(([file]) => file)
  .sort()
