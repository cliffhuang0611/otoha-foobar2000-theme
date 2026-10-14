<#
    Otoha -- installer for foobar2000
    A local music theme. https://github.com/cliffhuang0611/otoha-foobar2000-theme

    Usage
        double-click install.bat
      or
        powershell -ExecutionPolicy Bypass -File .\install.ps1
        .\install.ps1 -FoobarRoot 'D:\foobar2000'      # if auto-detection picks the wrong one

    What it does
        - finds your foobar2000 (portable or standard)
        - optionally backs up replaced files with -Backup (newest three sets retained)
        - copies the theme into <profile>\otoha\
        - installs any of the two required components you don't already have
        - applies the layout, by whichever of two routes suits your setup

    What it will NOT do
        Overwrite anything that already exists except its own theme folder. Your library,
        playlists, output device, DSPs and component settings are left alone. If you already
        run Columns UI, even your colours, fonts and playlist columns survive -- only the
        panel layout is replaced.
#>
[CmdletBinding()]
param(
    [string]$FoobarRoot,
    [switch]$SkipComponents,
    [switch]$Backup,
    [ValidateRange(1,20)][int]$KeepBackups = 3
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# robocopy exit codes: < 8 is success (1 = files copied, 0 = nothing to do); >= 8 is failure,
# and 16 in particular is often transient -- antivirus scanning a just-extracted download holds
# handles on the source files for a few seconds. Retry before giving up, and if it really is
# broken, show robocopy's own words rather than a bare number.
function Copy-Tree($from, $to, $mirror) {
    $args = @($from, $to, '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:2')
    $args += $(if ($mirror) { '/MIR' } else { '/E' })
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $out = & robocopy @args 2>&1
        if ($LASTEXITCODE -lt 8) { $global:LASTEXITCODE = 0; return }
        if ($attempt -lt 3) { Start-Sleep -Seconds ($attempt * 2) }
    }
    $code = $LASTEXITCODE
    $global:LASTEXITCODE = 0
    throw ("could not copy`n    from : $from`n    to   : $to`n  robocopy exit $code`n  " +
           ($out | Where-Object { $_ -match '\S' } | Select-Object -Last 4) -join "`n  ")
}

function Say    ($m) { Write-Host $m }
function Step   ($m) { Write-Host "`n$m" -ForegroundColor Cyan }
function Ok     ($m) { Write-Host "  $m" -ForegroundColor Green }
function Note   ($m) { Write-Host "  $m" -ForegroundColor DarkGray }
function Warn   ($m) { Write-Host "  $m" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# 0. locate the payload. Works both from the release zip (install.ps1 beside
#    profile\ and extras\) and from a repo checkout (tools\install.ps1).
# ---------------------------------------------------------------------------
#    The zip's profile\ is a complete drop-in, so extracting it over a fresh portable install
#    IS the installation. This script exists for the other case: a foobar that is already set
#    up, where dropping files in wholesale would throw away someone's configuration. It applies
#    the same payload, but checks each piece against what is already there first.
$repoRoot = Split-Path -Parent $ScriptDir
$layouts = @(
    [pscustomobject]@{ Theme=(Join-Path $ScriptDir 'profile\otoha');    Comp=(Join-Path $ScriptDir 'profile\user-components-x64'); Cfg=(Join-Path $ScriptDir 'profile\configuration'); Fcl=(Join-Path $ScriptDir 'extras\otoha-layout.fcl') }
    [pscustomobject]@{ Theme=(Join-Path $repoRoot  'theme\otoha');      Comp=(Join-Path $repoRoot  'components');                 Cfg=(Join-Path $repoRoot  'dist-config');          Fcl=(Join-Path $repoRoot  'dist-config\otoha-layout.fcl') }
)
$payload = $layouts | Where-Object { Test-Path $_.Theme } | Select-Object -First 1
if (-not $payload) { throw "can't find the theme payload next to this script -- is the zip fully extracted?" }

Say ""
Say "  Otoha -- a local music theme for foobar2000"
Say "  by cliffhuang0611, based on Verdant by superziper"
Say ""

# ---------------------------------------------------------------------------
# 1. find foobar2000
# ---------------------------------------------------------------------------
Step '[1/6] Looking for foobar2000'

function Get-FoobarTarget {
    param([string]$Explicit)

    if ($Explicit) {
        $exe = Join-Path $Explicit 'foobar2000.exe'
        if (-not (Test-Path $exe)) { throw "no foobar2000.exe in $Explicit" }
        $isPortable = Test-Path (Join-Path $Explicit 'portable_mode_enabled')
        $prof = if ($isPortable) { Join-Path $Explicit 'profile' } else { Join-Path $env:APPDATA 'foobar2000-v2' }
        return [pscustomobject]@{ Root=$Explicit; Exe=$exe; Profile=$prof; Portable=$isPortable }
    }

    # extracted inside a portable install?
    foreach ($d in @($ScriptDir, $repoRoot, (Split-Path -Parent $repoRoot))) {
        if ($d -and (Test-Path (Join-Path $d 'portable_mode_enabled'))) {
            return [pscustomobject]@{ Root=$d; Exe=(Join-Path $d 'foobar2000.exe'); Profile=(Join-Path $d 'profile'); Portable=$true }
        }
    }

    # standard install: registry, then the usual folders
    $roots = @()
    foreach ($key in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\foobar2000',
                     'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\foobar2000',
                     'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\foobar2000') {
        try {
            $loc = (Get-ItemProperty -Path $key -ErrorAction Stop).InstallLocation
            if ($loc) { $roots += $loc }
        } catch { }
    }
    $roots += @((Join-Path $env:ProgramFiles 'foobar2000'), (Join-Path ${env:ProgramFiles(x86)} 'foobar2000'))
    foreach ($r in $roots) {
        if ($r -and (Test-Path (Join-Path $r 'foobar2000.exe'))) {
            $portable = Test-Path (Join-Path $r 'portable_mode_enabled')
            $prof = if ($portable) { Join-Path $r 'profile' } else { Join-Path $env:APPDATA 'foobar2000-v2' }
            return [pscustomobject]@{ Root=$r; Exe=(Join-Path $r 'foobar2000.exe'); Profile=$prof; Portable=$portable }
        }
    }
    return $null
}

$fb = Get-FoobarTarget -Explicit $FoobarRoot
if (-not $fb) {
    Warn 'could not find foobar2000 automatically.'
    Say  ''
    Say  '  Re-run pointing at your foobar folder, e.g.'
    Say  "     .\install.ps1 -FoobarRoot 'D:\foobar2000'"
    Say  '  (the folder containing foobar2000.exe)'
    exit 1
}
Ok ("found: {0}" -f $fb.Root)
Note ("install type : {0}" -f $(if ($fb.Portable) { 'portable' } else { 'standard' }))
Note ("profile      : {0}" -f $fb.Profile)

if (-not (Test-Path $fb.Profile)) { New-Item -ItemType Directory -Force -Path $fb.Profile | Out-Null }

# ---------------------------------------------------------------------------
# 2. refuse to run while foobar is open -- it rewrites its configuration on exit
#    and would overwrite whatever we just installed
# ---------------------------------------------------------------------------
Step '[2/6] Checking foobar2000 is closed'
# Only THIS install matters: foobar rewrites its configuration on exit, so an instance using
# the profile we are about to write would undo the install. A foobar running from somewhere
# else is somebody else's profile and no threat, so it warrants a warning, not a refusal.
$targetRunning = Test-Path (Join-Path $fb.Profile 'running')
$others = @()
foreach ($p in @(Get-Process -Name 'foobar2000' -ErrorAction SilentlyContinue)) {
    $path = $null
    try { $path = $p.Path } catch { }   # a process we can't inspect: assume it isn't ours
    if ($path -and ($path -eq $fb.Exe)) { $targetRunning = $true } else { $others += $path }
}
if ($targetRunning) {
    Warn 'foobar2000 is running on the profile being installed to.'
    Say  ''
    Say  '  Close it and run this again. foobar rewrites its configuration when it exits,'
    Say  '  which would undo the install.'
    exit 1
}
if ($others.Count) { Note ("another foobar2000 is running elsewhere ({0}) -- not touching it" -f ($others -join ', ')) }
Ok 'closed'

# ---------------------------------------------------------------------------
# 3. back up anything about to be replaced
# ---------------------------------------------------------------------------
Step '[3/6] Backup policy'
$stamp = Get-Date -Format 'yyyyMMdd_HHmmssfff'
$backupDir = $null
$backupRoot = Join-Path $fb.Profile 'otoha-backup'
$restored = New-Object System.Collections.ArrayList
$added = New-Object System.Collections.ArrayList
if ($Backup) { Note "Backups requested; keeping the newest $KeepBackups managed sets." }
else { Note 'Automatic backups disabled. Back up your profile manually if wanted, or use -Backup.' }

function Save-Existing($path) {
    if (-not $Backup -or -not (Test-Path -LiteralPath $path)) { return $false }
    if (-not $script:backupDir) {
        $script:backupDir = Join-Path $backupRoot ('managed-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
        New-Item -ItemType Directory -Path $script:backupDir | Out-Null
        @{theme='Otoha';schema=1} | ConvertTo-Json | Set-Content (Join-Path $script:backupDir 'otoha-backup.json') -Encoding utf8
    }
    Copy-Item -LiteralPath $path -Destination (Join-Path $script:backupDir (Split-Path -Leaf $path)) -Recurse -Force
    [void]$restored.Add($path)
    return $true
}

# ---------------------------------------------------------------------------
# 4. the theme itself -- always ours, always replaced
# ---------------------------------------------------------------------------
Step '[4/6] Installing the theme'
$themeDest = Join-Path $fb.Profile 'otoha'
if (Test-Path $themeDest) { Note 'replacing an existing otoha\ folder'; Save-Existing $themeDest | Out-Null }
else { [void]$added.Add($themeDest) }
Copy-Tree $payload.Theme $themeDest $true
Ok ("theme -> {0}" -f $themeDest)

# ---------------------------------------------------------------------------
# 5. components -- only the ones that are missing, never a downgrade
# ---------------------------------------------------------------------------
Step '[5/6] Components'
$compDest = Join-Path $fb.Profile 'user-components-x64'
if ($SkipComponents) {
    Note 'skipped (-SkipComponents)'
} elseif (-not (Test-Path $payload.Comp)) {
    Note 'no bundled components in this package'
} else {
    New-Item -ItemType Directory -Force -Path $compDest | Out-Null
    foreach ($c in Get-ChildItem $payload.Comp -Directory) {
        $target = Join-Path $compDest $c.Name
        if (Test-Path $target) {
            Note ("{0} -- already installed, left alone" -f $c.Name)
        } else {
            Copy-Tree $c.FullName $target $false
            [void]$added.Add($target)
            Ok ("{0} -- installed" -f $c.Name)
        }
    }
}

# ---------------------------------------------------------------------------
# 6. the layout. Two routes, chosen by what the target already has.
# ---------------------------------------------------------------------------
Step '[6/6] Applying the layout'
$cfgDir      = Join-Path $fb.Profile 'configuration'
$cuiCfg      = Join-Path $cfgDir 'foo_ui_columns.dll.cfg'
$hasCui      = Test-Path $cuiCfg
$manualSteps = New-Object System.Collections.ArrayList
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null

if ($hasCui) {
    # --- route B: they already use Columns UI. Replace ONLY the layout, via the
    #     component's own import, so their colours/fonts/columns/filters survive.
    Note 'existing Columns UI configuration found -- importing the layout only'
    if (-not (Test-Path $payload.Fcl)) { throw "layout file missing: $($payload.Fcl)" }
    Save-Existing $cuiCfg | Out-Null
    & $fb.Exe '/columnsui:import-quiet' $payload.Fcl
    Start-Sleep -Seconds 2
    Ok 'layout imported (foobar2000 is starting up with it)'
    Note 'your colours, fonts, playlist columns and other settings were not touched'
} else {
    # Fresh installations create their own component settings; only import the layout.
    [void]$manualSteps.Add('Preferences > Display > select Columns UI, then restart foobar2000')
    [void]$manualSteps.Add('Preferences > Display > Columns UI > Import configuration: ' + $payload.Fcl)

}

# ---------------------------------------------------------------------------
# uninstall script
# ---------------------------------------------------------------------------
# Restoration helpers exist only when an explicitly requested backup contains replaced files.
if ($backupDir) {
$un = @()
$un += "# Undo the Otoha install of $stamp. Close foobar2000 first."
$un += '$ErrorActionPreference = ''Stop'''
$un += ('$targetExe = ' + "'" + $fb.Exe.Replace("'", "''") + "'")
$un += ('$targetProfile = ' + "'" + $fb.Profile.Replace("'", "''") + "'")
$un += 'if ((Test-Path (Join-Path $targetProfile "running")) -or @(Get-Process -Name foobar2000 -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $targetExe }).Count) { Write-Host "close this foobar2000 installation first"; exit 1 }'
$un += '$backup = Split-Path -Parent $MyInvocation.MyCommand.Path'
foreach ($a in $added) {
    $literal = "'" + $a.Replace("'", "''") + "'"
    $un += ('if (Test-Path -LiteralPath ' + $literal + ') { Remove-Item -LiteralPath ' + $literal + ' -Recurse -Force; Write-Host ("Removed: " + ' + $literal + ') }')
}
foreach ($r in $restored) {
    $leaf = "'" + (Split-Path -Leaf $r).Replace("'", "''") + "'"
    $destination = "'" + $r.Replace("'", "''") + "'"
    $un += ('$source = Join-Path $backup ' + $leaf)
    $un += 'if (-not (Test-Path -LiteralPath $source)) { throw "Backup missing: $source" }'
    $un += 'if ((Get-Item -LiteralPath $source).PSIsContainer) {'
    $un += ('  & robocopy $source ' + $destination + ' /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null')
    $un += '  if ($LASTEXITCODE -ge 8) { throw "Backup restoration failed." }; $global:LASTEXITCODE = 0'
    $un += ('} else { Copy-Item -LiteralPath $source -Destination ' + $destination + ' -Force }')
    $un += ('Write-Host ("Restored: " + ' + $destination + ')')
}
$un += 'Write-Host "Otoha installation backup restored."'
$un -join "`r`n" | Set-Content -Path (Join-Path $backupDir 'restore-backup.ps1') -Encoding utf8
@'
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore-backup.ps1"
set "otoha_exit=%ERRORLEVEL%"
echo.
pause
exit /b %otoha_exit%
'@ | Set-Content -Path (Join-Path $backupDir 'restore-backup.bat') -Encoding ascii

    $managed = @(Get-ChildItem -LiteralPath $backupRoot -Directory | Where-Object {
        if ($_.Name -notmatch '^managed-[0-9]{8}_[0-9]{9}-[a-f0-9]{8}$') { return $false }
        $marker=Join-Path $_.FullName 'otoha-backup.json'
        if (-not (Test-Path -LiteralPath $marker)) { return $false }
        try { $meta=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json; return $meta.theme -eq 'Otoha' -and $meta.schema -eq 1 }
        catch { return $false }
    } | Sort-Object Name -Descending)
    foreach ($old in @($managed | Select-Object -Skip $KeepBackups)) {
        Note ('Removing oldest managed backup: ' + $old.FullName)
        Remove-Item -LiteralPath $old.FullName -Recurse -Force
    }
}

# ---------------------------------------------------------------------------
# done
# ---------------------------------------------------------------------------
Say ''
Say '  ------------------------------------------------------------'
Ok  'Otoha installed.'
Say ''
if ($manualSteps.Count) {
    Warn 'One step left for you:'
    foreach ($m in $manualSteps) { Say ("     - {0}" -f $m) }
    Say ''
}
Say  '  Start foobar2000 to see it.'
if ($backupDir) { Note ('Backup + restore-backup.bat: {0}' -f $backupDir) }
else { Note 'No backup folder or restoration helper was created.' }
Say  ''
Note 'Otoha reads your Media Library: if Home and All Songs look empty, add a'
Note 'music folder under Preferences > Media Library.'
Say  ''
