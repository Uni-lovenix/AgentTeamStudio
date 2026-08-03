param(
  [string]$Installer = "",
  [string]$InstallRoot = "$env:LOCALAPPDATA\Programs\Agent Team Studio"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

if (-not $Installer) {
  $Installer = Join-Path $repo "dist\AgentTeamStudio-0.1.0-win-x64.exe"
}

if (-not (Test-Path $Installer)) {
  throw "Windows installer not found: $Installer"
}

Write-Host "[windows-smoke] Installing $Installer"
Start-Process -FilePath $Installer -ArgumentList "/S" -Wait

$exe = Join-Path $InstallRoot "Agent Team Studio.exe"
if (-not (Test-Path $exe)) {
  throw "Installed app not found: $exe"
}

$output = Join-Path $env:TEMP "agent-team-studio-smoke-$PID.json"
if (Test-Path $output) {
  Remove-Item -Force $output
}

$env:AGENT_TEAM_STUDIO_SMOKE = "1"
$env:AGENT_TEAM_STUDIO_SMOKE_OUTPUT = $output

Write-Host "[windows-smoke] Launching $exe"
$process = Start-Process -FilePath $exe -PassThru
$deadline = (Get-Date).AddMinutes(2)
while (-not (Test-Path $output) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
}

if (-not (Test-Path $output)) {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
  throw "Smoke output file was not created: $output"
}

if (-not $process.HasExited) {
  Wait-Process -Id $process.Id -Timeout 30
}

$result = Get-Content -Raw $output | ConvertFrom-Json
Write-Host "[windows-smoke] Result: $($result | ConvertTo-Json -Compress)"

$checks = @(
  ($result.ipcChannels -eq 15),
  ($result.windowLoaded -eq $true),
  ($result.generated -eq $true),
  ($result.exported -eq $true),
  ($result.harnessValid -eq $true)
)

if ($checks -contains $false) {
  throw "Windows smoke failed: $($result.message)"
}

Write-Host "[windows-smoke] PASS"
