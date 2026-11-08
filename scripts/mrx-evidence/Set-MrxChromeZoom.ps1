param([Parameter(Mandatory=$true)][int]$BrowserPid, [Parameter(Mandatory=$true)][ValidateSet(0,2,3,5)][int]$Steps)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MrxZoomInput {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
}
'@
$process = Get-Process -Id $BrowserPid
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero -or $process.ProcessName -ne 'chrome') { throw 'Dedicated Chrome window not found.' }
[MrxZoomInput]::SetForegroundWindow($window) | Out-Null
Start-Sleep -Milliseconds 200
function Send-OwnedChord([byte]$key) {
    [uint32]$owner = 0
    [MrxZoomInput]::GetWindowThreadProcessId([MrxZoomInput]::GetForegroundWindow(), [ref]$owner) | Out-Null
    if ($owner -ne $BrowserPid) { throw 'Dedicated browser lost foreground; no keys were sent.' }
    try { [MrxZoomInput]::keybd_event(0x11,0,0,[UIntPtr]::Zero); [MrxZoomInput]::keybd_event($key,0,0,[UIntPtr]::Zero) }
    finally { [MrxZoomInput]::keybd_event($key,0,2,[UIntPtr]::Zero); [MrxZoomInput]::keybd_event(0x11,0,2,[UIntPtr]::Zero) }
    Start-Sleep -Milliseconds 150
}
Send-OwnedChord 0x30
for ($i=0; $i -lt $Steps; $i++) { Send-OwnedChord 0x6B }
