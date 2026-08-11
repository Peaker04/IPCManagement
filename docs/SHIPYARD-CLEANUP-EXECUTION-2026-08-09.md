# Shipyard external-folder cleanup execution — 2026-08-09

Scope: only the legacy external folders classified by
`docs/SHIPYARD-CLEANUP-INVENTORY.md`. No source, Git worktree, runtime process or database was changed.

## Completed

| Former location | Result | New location |
|---|---|---|
| `D:/IPC-browser-use-profile` | Archived | `D:/IPCManagement-archive/20260809/legacy/IPC-browser-use-profile` |
| `D:/IPC-browser-use-visible` | Archived | `D:/IPCManagement-archive/20260809/legacy/IPC-browser-use-visible` |
| `D:/IPCManagement-build` | Archived | `D:/IPCManagement-archive/20260809/legacy/IPCManagement-build` |
| Three `C:/IPCManagement-offsite-rehearsal/*.non-authoritative` or `.invalid-manifest` archives | Quarantined, not deleted | `D:/IPCManagement-archive/20260809/offsite-quarantine/` |

The authoritative recovery rehearsal archive remains at
`C:/IPCManagement-offsite-rehearsal/ipcmanagement-20260728-180557.zip`; its integrity was
rechecked after cleanup. SQL backups in `D:/IPCManagement-backups` remain untouched.

## Intentionally not changed

- `C:/ipc-workspace` and `D:/IPCManagementCurrent` remain junctions to the real checkout.
  Their target was verified before action, but the runtime policy blocked link deletion. Do not
  recursive-delete either path.
- The external Shipyard harness, its generated lanes, the project worktree, databases and
  current artifact evidence remain untouched.

## Preconditions for permanent deletion

After the retention period, delete only the archive/quarantine content after confirming no
browser investigation, recovery evidence or process needs it. Keep the authoritative recovery
archive until an encrypted, independently stored and restore-verified successor exists.
