<#
PowerShell helper: stop tracking .env files and add .env to .gitignore.
Run this locally on a machine with `git` installed. This script is non-destructive
and keeps local copies of your .env files while removing them from the index.

Usage (PowerShell):
  ./scripts/untrack-env.ps1
#>

Write-Host "== Untrack .env helper =="

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "git is not available on this machine. Install git and re-run this script." -ForegroundColor Red
  exit 1
}

$root = Resolve-Path -LiteralPath .
Write-Host "Repository root: $root"

# Ensure .gitignore contains .env entries
$gitignore = Join-Path $root '.gitignore'
if (-not (Get-Content $gitignore | Select-String "^\.env$" -Quiet)) {
  Add-Content -Path $gitignore -Value "`n# Ignore environment files containing secrets`n.env`n**/.env`n.env.local`n.env.*.local"
  Write-Host "Appended .env patterns to .gitignore"
} else {
  Write-Host ".env already appears in .gitignore"
}

# Remove from index (keeps local files)
Write-Host "Removing tracked .env files from git index (keeps local copies)..."
git rm --cached .env 2>$null | Out-Null
git rm --cached artifacts/api-server/.env 2>$null | Out-Null

# Commit if anything changed
$status = git status --porcelain
if ($status) {
  git add .gitignore
  git commit -m "chore(secrets): stop tracking .env files and add .gitignore" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit did not run or nothing to commit" -ForegroundColor Yellow
  } else {
    Write-Host "Committed changes. Next: follow SECURITY_REMOVE_SECRETS.md to purge history and rotate keys." -ForegroundColor Yellow
  }
} else {
  Write-Host "No changes to commit. .env entries may already be untracked." -ForegroundColor Green
}

Write-Host "Done. Please rotate the exposed credentials immediately and follow the steps in SECURITY_REMOVE_SECRETS.md"
