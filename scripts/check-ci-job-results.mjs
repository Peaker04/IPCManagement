// Keep the existing required check fail-closed, including cancelled/skipped jobs.
const results = {
  frontend: process.env.FRONTEND_RESULT,
  backend: process.env.BACKEND_RESULT,
  windows: process.env.WINDOWS_RESULT,
}
if (Object.values(results).every(result => result === 'success')) {
  console.log('Verify passed: frontend, backend and Windows contracts succeeded.')
} else {
  console.error('Verify failed:', results)
  process.exitCode = 1
}
