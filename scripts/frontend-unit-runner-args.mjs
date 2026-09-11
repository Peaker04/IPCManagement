export function normalizeForwardedArgs(argv) {
  let index = 0
  while (argv[index] === '--') index += 1
  return argv.slice(index)
}

export function buildFrontendUnitNpmArgs(argv) {
  const forwarded = normalizeForwardedArgs(argv)
  return [
    'run',
    'test:unit',
    '-w',
    'frontend',
    ...(forwarded.length > 0 ? ['--', ...forwarded] : []),
  ]
}
