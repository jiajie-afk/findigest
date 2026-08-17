# Install a Startup shortcut so FinDigest Vite keepalive starts on Windows login.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# This script lives in FinDigest/scripts → project root is parent of scripts
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$startup = [Environment]::GetFolderPath('Startup')
$lnkPath = Join-Path $startup 'FinDigest Dev Server.lnk'
$target = Join-Path $root 'scripts\run-vite-keepalive.cmd'

$w = New-Object -ComObject WScript.Shell
$lnk = $w.CreateShortcut($lnkPath)
$lnk.TargetPath = $target
$lnk.WorkingDirectory = $root.Path
$lnk.WindowStyle = 7  # minimized
$lnk.Description = 'FinDigest local Vite keepalive (127.0.0.1:5173)'
$lnk.Save()
Write-Host "Installed: $lnkPath"
Write-Host "Will start minimized on next Windows login."
