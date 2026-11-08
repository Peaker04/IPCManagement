import { execFileSync } from 'node:child_process';

export type OwnedProcess = { pid: number; startTimeUtcTicks: string };

export function readProcessIdentity(pid: number): OwnedProcess | null {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid owned process PID.');
  const ticks = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -ne $p) { $p.StartTime.ToUniversalTime().Ticks }`,
  ], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  if (!ticks) return null;
  if (!/^\d+$/.test(ticks)) throw new Error('Invalid process creation identity.');
  return { pid, startTimeUtcTicks: ticks };
}

export async function stopOwnedProcesses(processes: readonly OwnedProcess[]): Promise<void> {
  const errors: unknown[] = [];
  for (const owned of processes) {
    try {
      if (!Number.isSafeInteger(owned.pid) || owned.pid <= 0 || owned.pid === process.pid
        || typeof owned.startTimeUtcTicks !== 'string' || !/^\d+$/.test(owned.startTimeUtcTicks)) {
        throw new Error('Invalid owned process identity.');
      }
      // Keep the OS handle open across identity check and kill, so PID reuse cannot change the target.
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${owned.pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { exit 0 }; try { $handle=$p.SafeHandle; if ($p.StartTime.ToUniversalTime().Ticks.ToString() -cne '${owned.startTimeUtcTicks}') { throw 'Process creation identity changed; refusing to stop it.' }; $p.Kill(); if (-not $p.WaitForExit(5000)) { throw 'Owned process did not stop.' } } finally { $p.Dispose() }`,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Not every owned process could be released.');
}
