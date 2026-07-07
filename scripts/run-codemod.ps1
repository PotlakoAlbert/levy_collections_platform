<#
Helper to run the jscodeshift transform locally.

Usage (PowerShell, run at repo root):
  ./scripts/run-codemod.ps1 -Path src -WhatIf

Options:
  -Path: Path to run the transform against (default: src)
  -DryRun / -WhatIf: perform a dry run (no changes)
#>

param(
  [string]$Path = 'src',
  [switch]$DryRun
)

Write-Host "Running codemod against: $Path"

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Host "npx not found. Ensure Node.js is installed and available on PATH." -ForegroundColor Red
  exit 1
}

$dry = ''
if ($DryRun) { $dry = '--dry' }

$cmd = "npx jscodeshift -t scripts/jscodeshift/replace-console-log-to-logger.js $Path --extensions=js,jsx,ts,tsx $dry"
Write-Host "Command: $cmd"
Invoke-Expression $cmd
