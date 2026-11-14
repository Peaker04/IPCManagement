export function retiredRunner(kind) {
  throw new Error(kind === 'mrx-db'
    ? 'Retired runner. Use scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 for an explicitly authorized, run-owned disposable target.'
    : 'Retired visual audit. Use a maintained frontend/tests/browser spec with a verified build, actor and server mode.');
}
