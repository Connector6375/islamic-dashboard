<#
.SYNOPSIS
  One-way mirror of a PUBLIC GitHub branch into a local folder (Windows).
  Needs nothing installed: no Git, no account. Files are copied over; files deleted on GitHub are NOT
  deleted locally (so it is safe to point at a folder that already holds other things).

.EXAMPLE
  # one run
  powershell -ExecutionPolicy Bypass -File .\sync-from-github.ps1 -Target "G:\My Drive\Claude\01 School\Classroom & Activities\islamic-dashboard"

.EXAMPLE
  # one run + schedule it every 15 minutes while you are signed in
  powershell -ExecutionPolicy Bypass -File .\sync-from-github.ps1 -Target "D:\Projects\islamic-dashboard" -Install -EveryMinutes 15

.EXAMPLE
  # stop the schedule
  powershell -ExecutionPolicy Bypass -File .\sync-from-github.ps1 -Uninstall

  Keep this file where it is after -Install: the scheduled task runs it from there.
  Log: %LOCALAPPDATA%\github-mirror\<repo>\sync.log
#>
param(
  [string]$Repo = 'Connector6375/islamic-dashboard',
  [string]$Branch = 'ccr-f7a4ee6e-6ltht5',
  [string]$Target,
  [switch]$Install,
  [int]$EveryMinutes = 15,
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Slug = $Repo.Replace('/', '-')
$TaskName = "GitHub mirror - $Slug"
$Work = Join-Path $env:LOCALAPPDATA "github-mirror\$Slug"
$LogFile = Join-Path $Work 'sync.log'
New-Item -ItemType Directory -Force -Path $Work | Out-Null

function Write-Log([string]$Message) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Log "scheduled task '$TaskName' removed"
  return
}
if (-not $Target) { throw 'Pass -Target "<folder to mirror into>"' }

function Sync-Repo {
  # 1. newest commit of the branch (GitHub returns just the hash for this media type)
  $headers = @{ Accept = 'application/vnd.github.sha'; 'User-Agent' = 'github-mirror' }
  $sha = ([string](Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/$Branch" -Headers $headers)).Trim()
  if ($sha -notmatch '^[0-9a-f]{40}$') { throw "unexpected answer from GitHub: $sha" }

  $stamp = Join-Path $Work 'last-sync.txt'
  if ((Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $sha) -and (Test-Path $Target)) {
    Write-Log "up to date ($sha)"
    return
  }

  # 2. download that exact commit and unpack it
  $zip = Join-Path $Work 'snapshot.zip'
  $tmp = Join-Path $Work 'unpacked'
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/$sha.zip" -OutFile $zip
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $tmp)
  $inner = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1

  # 3. copy over (hidden folders such as .claude included; nothing in Target is deleted)
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
  & robocopy $inner.FullName $Target /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }

  Set-Content -Path $stamp -Value $sha
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Write-Log "synced $Repo@$Branch $sha -> $Target"
}

if ($Install) {
  $self = $MyInvocation.MyCommand.Path
  $arg = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -Repo "{1}" -Branch "{2}" -Target "{3}"' -f $self, $Repo, $Branch, $Target
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Log "scheduled every $EveryMinutes min as '$TaskName'"
}

try { Sync-Repo } catch { Write-Log "ERROR: $($_.Exception.Message)"; exit 1 }
