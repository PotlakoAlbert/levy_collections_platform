<#
Setup helper for Windows (PowerShell)

This script performs the following (interactive):
- Parses the root `.env` and exports vars to the script process
- Copies `.env` to `artifacts/api-server/.env`
- Installs dependencies via `pnpm install` (optional)
- Runs DB migrations (`pnpm --filter @workspace/db run push`) and seed (optional)
- Optionally runs a local Redis container via Docker (if needed)
- Optionally starts the API server in a new PowerShell window

Usage: Open PowerShell in the repo root and run:
  .\scripts\setup-windows.ps1

Note: This script is interactive and will prompt before destructive actions.
#>

function Write-Info($m) { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m) { Write-Host "[ERROR] $m" -ForegroundColor Red }

Write-Info "Levy Collection Manager - Windows setup helper"

# Ensure we are running from repository root (expects package.json here)
if (-not (Test-Path "package.json")) {
  Write-Err "package.json not found. Run this script from the repository root."
  exit 1
}

#-------------------------------
# Helper: parse .env and set environment variables for this process
#-------------------------------
function Import-DotEnv($path) {
  if (-not (Test-Path $path)) { Write-Err ".env file not found at $path"; return $false }

  Write-Info "Parsing $path and exporting variables into this session"
  $lines = Get-Content $path -ErrorAction Stop
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -eq "" -or $trim.StartsWith('#')) { continue }
    if ($trim -match '^[ \t]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $k = $matches[1]
      $v = $matches[2].Trim()
      # remove surrounding quotes if present
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      # Set for this process only (child processes inherit)
      $env:$k = $v
      Write-Host "  Set $k" -ForegroundColor DarkCyan
    } else {
      Write-Warn "Skipping invalid line: $line"
    }
  }
  return $true
}

# Import root .env
$rootEnv = Join-Path (Get-Location) ".env"
if (-not (Import-DotEnv $rootEnv)) { exit 1 }

# Copy to API artifact package
$apiEnvPath = Join-Path (Get-Location) "artifacts\api-server\.env"
try {
  Copy-Item -Path $rootEnv -Destination $apiEnvPath -Force -ErrorAction Stop
  Write-Info "Copied .env -> artifacts/api-server/.env"
} catch {
  Write-Warn "Could not copy .env to artifacts/api-server: $_"
}

#-------------------------------
# Tool checks
#-------------------------------
function Check-Command($cmd) {
  try { $null = & $cmd -v 2>$null; return $true } catch { return $false }
}

Write-Info "Checking Node.js..."
try { $nodeV = (& node -v) -split "\r?\n" | Select-Object -First 1 } catch { $nodeV = $null }
if (-not $nodeV) { Write-Err "Node.js not found on PATH. Install Node >= 20 and retry."; exit 1 }
Write-Info "Node version: $nodeV"

Write-Info "Ensuring pnpm is available via Corepack..."
try {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Info "Enabling corepack and preparing pnpm..."
    & corepack enable
    & corepack prepare pnpm@latest --activate
  }
} catch {
  Write-Warn "Corepack/pnpm setup failed: $_"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Warn "pnpm not found. You can install from https://pnpm.io/installation or enable corepack."
}

#-------------------------------
# Install dependencies (optional)
#-------------------------------
$runInstall = Read-Host "Run 'pnpm install' now? (Y/n)"
if ($runInstall -in @('','Y','y','Yes','yes')) {
  Write-Info "Installing dependencies (this may take a while)..."
  & pnpm install
  if ($LASTEXITCODE -ne 0) { Write-Warn "pnpm install returned exit code $LASTEXITCODE" }
} else { Write-Info "Skipped pnpm install" }

#-------------------------------
# Database migrations and seed
#-------------------------------
$runDb = Read-Host "Run DB push (drizzle) and seed now? (Y/n)"
if ($runDb -in @('','Y','y','Yes','yes')) {
  Write-Info "Running migrations: pnpm --filter @workspace/db run push"
  & pnpm --filter @workspace/db run push
  if ($LASTEXITCODE -ne 0) { Write-Warn "DB push returned exit code $LASTEXITCODE" }

  Write-Info "Running seed: pnpm --filter @workspace/db run seed"
  & pnpm --filter @workspace/db run seed
  if ($LASTEXITCODE -ne 0) { Write-Warn "DB seed returned exit code $LASTEXITCODE" }
} else { Write-Info "Skipped DB migrations/seed" }

#-------------------------------
# Redis / job queue
#-------------------------------
$redisUrl = $env:REDIS_URL
if (-not $redisUrl -or $redisUrl -match "localhost|127.0.0.1") {
  Write-Warn "REDIS_URL not configured to external host or points to localhost. A local Redis container is recommended for workers."
  $runRedis = Read-Host "Start a local Redis Docker container (redis:7) now? (Y/n)"
  if ($runRedis -in @('','Y','y','Yes','yes')) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
      Write-Err "Docker CLI not found. Install Docker Desktop or provide a REDIS_URL pointing to a running Redis instance." 
    } else {
      Write-Info "Starting Redis container (leaves existing container if name clash)..."
      # Pull and run only if container not running
      try {
        $exists = (& docker ps -a --filter "name=levy-redis" --format "{{.Names}}")
        if ($exists -and $exists -match 'levy-redis') {
          Write-Info "Container 'levy-redis' already exists. Attempting to start..."
          & docker start levy-redis
        } else {
          & docker run -p 6379:6379 --name levy-redis -d redis:7
        }
      } catch { Write-Warn "Docker run/start failed: $_" }
    }
  } else { Write-Info "Skipped starting Docker Redis" }
} else { Write-Info "REDIS_URL is configured: $($redisUrl.Substring(0,[Math]::Min(80,$redisUrl.Length)))" }

#-------------------------------
# Start API server (dev) in new PowerShell window
#-------------------------------
$startApi = Read-Host "Start API dev server in a new PowerShell window now? (Y/n)"
if ($startApi -in @('','Y','y','Yes','yes')) {
  $repo = (Get-Location).Path
  $cmd = "cd `"$repo`"; pnpm --filter @workspace/api-server run dev"
  Write-Info "Launching API dev server in a new PowerShell window..."
  Start-Process -FilePath pwsh -ArgumentList "-NoExit", "-Command", $cmd -WorkingDirectory $repo
  Start-Sleep -Seconds 1
  Write-Info "New window launched. Watch console for logs and worker initialization."  
} else { Write-Info "Skipped launching API server" }

#-------------------------------
# Final notes and quick checks
#-------------------------------
Write-Info "Setup helper finished. Quick checks you can run:"
Write-Host "  curl http://localhost:8080/api/healthz"
Write-Host "  curl http://localhost:8080/api/queue-health"
Write-Host "  curl http://localhost:8080/api/whatsapp-info"

Write-Info "If you want me to run this script now, tell me and I can execute it in the terminal." 
