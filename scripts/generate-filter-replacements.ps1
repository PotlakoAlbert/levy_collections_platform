<#
Generate a git-filter-repo replacements file from local .env values.

Usage (PowerShell, run at repo root):
  ./scripts/generate-filter-replacements.ps1

This script is intentionally conservative: it only adds keys that look like secrets
(contain words like KEY, TOKEN, SECRET, PASSWORD, ACCESS, SESSION, DATABASE_URL, REDIS_URL, WHATSAPP, GEMINI, DEEPSEEK).

Output: `scripts/replacements-local.txt` (ignored by .gitignore)
DO NOT commit `replacements-local.txt` — use it locally when running `git filter-repo`.
#>

function Write-Info($m) { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }

$cwd = (Get-Location).Path
Write-Info "Generating replacements file from .env files in $cwd"

$envFiles = @('.env', 'artifacts/api-server/.env')
$found = @{}

foreach ($f in $envFiles) {
  $path = Join-Path $cwd $f
  if (-not (Test-Path $path)) { continue }
  Write-Info "Reading $f"
  $lines = Get-Content $path -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
    # split at first '=' to allow values containing '='
    $idx = $trim.IndexOf('=')
    if ($idx -lt 0) { continue }
    $key = $trim.Substring(0,$idx).Trim()
    $value = $trim.Substring($idx+1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1,$value.Length-2)
    }
    if (-not $value) { continue }

    # Heuristic: only treat keys that look like secrets
    if ($key -match 'KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|REDIS_URL|ACCESS|SESSION|WHATSAPP|GEMINI|DEEPSEEK|DB' -or $key.ToUpper().Contains('KEY')) {
      if (-not $found.ContainsKey($key)) { $found[$key] = $value }
    }
  }
}

if ($found.Count -eq 0) {
  Write-Warn "No secret-like keys found in .env files. No replacements written."
  exit 0
}

$out = Join-Path $cwd 'scripts/replacements-local.txt'
Write-Info "Writing replacements to $out (this file is ignored by .gitignore)"

@(
  '# git-filter-repo replacements (generated locally). Do NOT commit this file.'
) | Out-File -FilePath $out -Encoding utf8

foreach ($k in $found.Keys) {
  $v = $found[$k]
  $rep = "${v}==>REDACTED_${($k.ToUpper() -replace '[^A-Z0-9_]','_')}"
  $rep | Out-File -FilePath $out -Append -Encoding utf8
  Write-Host "  Added replacement for $k" -ForegroundColor DarkCyan
}

Write-Info "Done. Next steps (manual):"
Write-Host "  1) Review scripts/replacements-local.txt locally (it contains your secret values)."
Write-Host "  2) Run: git filter-repo --replace-text scripts/replacements-local.txt"
Write-Host "  3) Run garbage collection and force-push the cleaned repo (coordinate with your team)."

exit 0
