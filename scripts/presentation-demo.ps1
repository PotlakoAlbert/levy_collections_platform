<#
  Levy Collection Manager - Presentation Demo Helper (Windows PowerShell)

  Run from repo root BEFORE your presentation:
    .\scripts\presentation-demo.ps1 -Action preflight

  During the demo (simulate debtor WhatsApp reply):
    .\scripts\presentation-demo.ps1 -Action whatsapp-reply

  Full end-to-end automation flow:
    .\scripts\presentation-demo.ps1 -Action full-flow
#>

param(
  [ValidateSet("preflight", "whatsapp-reply", "full-flow", "health")]
  [string]$Action = "preflight",
  [string]$ApiBase = "http://localhost:8080/api",
  [string]$PhoneNumber = "27725985706",
  [string]$MessageText = "I can pay R500 per month"
)

function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   FAIL: $msg" -ForegroundColor Red }

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $uri = "$ApiBase$Path"
  $params = @{
    Uri         = $uri
    Method      = $Method
    ContentType = "application/json"
    ErrorAction = "Stop"
  }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
  return Invoke-RestMethod @params
}

switch ($Action) {
  "health" {
    Write-Step "Health check"
    $h = Invoke-Api -Method GET -Path "/healthz"
    Write-Ok "API status: $($h.status)"
    $a = Invoke-Api -Method GET -Path "/automation-status"
    Write-Ok "Job mode: $($a.jobProcessingMode) | WhatsApp: $($a.whatsappMode) | AI: $($a.aiProvider)"
  }

  "preflight" {
    Write-Step "Presentation preflight checks"
    try {
      $h = Invoke-Api -Method GET -Path "/healthz"
      Write-Ok "API reachable - $($h.status)"
    } catch {
      Write-Fail "API not running at $ApiBase"
      Write-Host "   Start it: pnpm --filter @workspace/api-server run dev" -ForegroundColor Yellow
      exit 1
    }

    try {
      $wa = Invoke-Api -Method GET -Path "/whatsapp-info"
      Write-Ok "WhatsApp service: $($wa.status) (mode: $($wa.mode))"
    } catch {
      Write-Fail "WhatsApp info endpoint failed: $_"
    }

    try {
      $ai = Invoke-Api -Method GET -Path "/ai-info"
      Write-Ok "AI service: $($ai.status) (provider: $($ai.provider))"
    } catch {
      Write-Fail "AI info endpoint failed: $_"
    }

    try {
      $sys = Invoke-Api -Method GET -Path "/test-automations/system-status"
      Write-Ok "System: $($sys.system.debtors) debtors, $($sys.system.matters) matters"
    } catch {
      Write-Fail "System status failed: $_"
    }

    Write-Host ""
    Write-Host "Login: admin@law.co.za / Admin123!" -ForegroundColor White
    Write-Host "Frontend: pnpm --filter @workspace/levy-platform run dev -> http://localhost:3000" -ForegroundColor White
    Write-Host "Demo phone (Potlako): $PhoneNumber" -ForegroundColor White
    Write-Host ""
    Write-Host "Simulate debtor reply:" -ForegroundColor White
    Write-Host "  .\scripts\presentation-demo.ps1 -Action whatsapp-reply" -ForegroundColor DarkGray
  }

  "whatsapp-reply" {
    Write-Step "Simulating debtor WhatsApp reply"
    Write-Host "   Phone: $PhoneNumber"
    Write-Host "   Message: $MessageText"
    $result = Invoke-Api -Method POST -Path "/test-whatsapp-webhook" -Body @{
      phoneNumber = $PhoneNumber
      messageText = $MessageText
    }
    Write-Ok $result.message
    $result | ConvertTo-Json -Depth 5
  }

  "full-flow" {
    Write-Step "Running full automation flow (LOD + WhatsApp + bot reply)"
    $result = Invoke-Api -Method POST -Path "/test-automations/run-full-flow" -Body @{
      phoneNumber = $PhoneNumber
    }
    $ref = $result.matter.reference
    Write-Ok "Flow complete for matter $ref"
    $result.verification | Format-List
    $result | ConvertTo-Json -Depth 6
  }
}
