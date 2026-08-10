import { spawn } from 'node:child_process'

const npmExecPath = process.env.npm_execpath

if (!npmExecPath) {
  throw new Error('npm_execpath is required to launch the canonical frontend unit suite.')
}

const child = spawn(
  process.execPath,
  [npmExecPath, 'run', 'test:unit', '-w', 'frontend', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=1024',
    },
  },
)

child.once('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
