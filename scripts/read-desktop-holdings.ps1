param(
  [switch]$Launch,
  [switch]$CopyWindow
)
# Local-only holdings pickup. ASCII-only so Windows PowerShell 5.1 can parse it.
# Does NOT read broker credential files or send orders.
# Never SendKeys on login / QR / updater windows.
# Write-Output (not [Console]::Out) so Node can capture stdout when windowsHide=true.
$ErrorActionPreference = 'SilentlyContinue'

Add-Type -AssemblyName System.Windows.Forms | Out-Null

$code = @'
using System;
using System.Runtime.InteropServices;
public static class FdWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue | Out-Null

function Get-Clip {
  try { return [string][System.Windows.Forms.Clipboard]::GetText() } catch { return '' }
}

function Contains-Code([string]$s, [int[]]$codes) {
  if (-not $s) { return $false }
  foreach ($ch in $s.ToCharArray()) {
    if ($codes -contains [int]$ch) { return $true }
  }
  return $false
}

$notes = New-Object System.Collections.Generic.List[string]
$clipboard = Get-Clip
$windowCopy = ''
$tradeRunning = $false
$launched = $false
$processName = ''

$procNames = @('maintrade', 'stockway', 'xiadan', 'hexin')
$runningList = @(Get-Process -Name $procNames -ErrorAction SilentlyContinue)
$running = $runningList | Where-Object { $_.ProcessName -eq 'maintrade' -or $_.ProcessName -eq 'xiadan' -or $_.ProcessName -eq 'hexin' } | Select-Object -First 1
if (-not $running) { $running = $runningList | Select-Object -First 1 }
if ($running) {
  $tradeRunning = $true
  $processName = $running.ProcessName
}

$allTitle = (($runningList | ForEach-Object { [string]$_.MainWindowTitle }) -join ' ')

# 登 U+767B — login / QR page. Also skip updater.
$onLogin = $allTitle -match 'login|signin' -or (Contains-Code $allTitle @(0x767B))
$updating = $allTitle -match 'update|Upgrade|setup'

if (-not $tradeRunning) {
  $exe = 'C:\eastmoney\dfcf\maintrade.exe'
  if ($Launch -and (Test-Path -LiteralPath $exe)) {
    Start-Process -FilePath $exe | Out-Null
    $launched = $true
    $notes.Add('LAUNCHED')
  } else {
    $notes.Add('NO_TRADE')
  }
} elseif ($updating) {
  $notes.Add('UPDATING')
} elseif ($onLogin) {
  $notes.Add('ON_LOGIN')
} elseif (-not $CopyWindow) {
  $notes.Add('SKIP_COPY')
} else {
  $hwnd = $running.MainWindowHandle
  $title = [string]$running.MainWindowTitle
  if ($hwnd -and $hwnd -ne [IntPtr]::Zero) {
    if ([FdWin]::IsIconic($hwnd)) { [FdWin]::ShowWindow($hwnd, 9) | Out-Null }
    [FdWin]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 450
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 180
    [System.Windows.Forms.SendKeys]::SendWait('^c')
    Start-Sleep -Milliseconds 350
    $windowCopy = Get-Clip
    if (-not $windowCopy) { $notes.Add('COPY_EMPTY') } else { $notes.Add('COPY_OK') }
  } else {
    $notes.Add('NO_WINDOW')
  }
}

# File pickup is done in Node (lib/localHoldings.js) so this script stays fast
# and never walks Documents. $files kept for JSON shape compatibility.
$result = [pscustomobject]@{
  clipboard    = $clipboard
  windowCopy   = $windowCopy
  files        = @()
  tradeRunning = $tradeRunning
  launched     = $launched
  processName  = $processName
  notes        = @($notes)
}
$ErrorActionPreference = 'Continue'
$json = $result | ConvertTo-Json -Depth 6 -Compress
Write-Output $json
