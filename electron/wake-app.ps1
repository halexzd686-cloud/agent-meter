param([string]$ExecutablePath,[string]$ProcessName)
$ErrorActionPreference = 'Stop'
if (-not $ProcessName -and $ExecutablePath) { $ProcessName = [System.IO.Path]::GetFileNameWithoutExtension($ExecutablePath) }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AgentMeterWindows {
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd,int nCmdShow);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
$target = Get-Process -Name $processName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if ($target) {
 [void][AgentMeterWindows]::ShowWindowAsync($target.MainWindowHandle,9)
 [void][AgentMeterWindows]::SetForegroundWindow($target.MainWindowHandle)
 Write-Output 'activated'
} else {
 if (-not $ExecutablePath -or -not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) { exit 2 }
 Start-Process -FilePath $ExecutablePath -WindowStyle Normal
 Write-Output 'started'
}
