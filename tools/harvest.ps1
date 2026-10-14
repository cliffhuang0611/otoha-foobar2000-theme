<#
    harvest.ps1 -- pull the shippable configuration out of the clean-room rig.

    The dev profile cannot produce these: it started life as a Georgia-ReBORN drop-in, so its
    Columns UI config carries another theme's presets, cached lyrics and absolute D:\ paths.
    The rig at D:\sandbox\fb2k-vanilla is a throwaway portable foobar whose profile contains
    nothing but the two components and Otoha.

    Run this with the rig's foobar CLOSED -- foobar only flushes its configuration on exit,
    so harvesting a running instance captures stale files.

    Usage:
        .\tools\harvest.ps1
        .\tools\harvest.ps1 -Rig 'D:\sandbox\fb2k-vanilla'
#>
param(
    [string]$Rig = 'D:\sandbox\fb2k-vanilla'
)

$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $Rig 'profile'
$dest       = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist-config'

if (-not (Test-Path $profileDir)) { throw "rig profile not found: $profileDir" }

# foobar keeps a `running` marker in the profile for the lifetime of the process
if (Test-Path (Join-Path $profileDir 'running')) {
    throw "the rig's foobar2000 looks like it is still running -- close it first, or the harvested config will be stale"
}
if (Get-Process -Name 'foobar2000' -ErrorAction SilentlyContinue) {
    Write-Warning 'a foobar2000 process is running. If it is the rig, close it and re-run.'
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$wanted = @(
    @{ From = 'configuration\foo_ui_columns.dll.cfg';   Why = 'the layout: one full-window JSplitter panel bound to otoha\main.js' }
    @{ From = 'configuration\foo_uie_jsplitter.dll.cfg';Why = 'JSplitter component settings' }
)

$got = @()
foreach ($w in $wanted) {
    $src = Join-Path $profileDir $w.From
    if (Test-Path $src) {
        Copy-Item $src -Destination (Join-Path $dest (Split-Path -Leaf $w.From)) -Force
        $got += [pscustomobject]@{ File = (Split-Path -Leaf $w.From); KB = [math]::Round((Get-Item $src).Length/1KB,1); Purpose = $w.Why }
    } else {
        Write-Host ("  skipped (absent): {0}" -f $w.From) -ForegroundColor DarkGray
    }
}
$got | Format-Table -AutoSize

# ---- privacy audit -------------------------------------------------------------------
# These files ship to strangers, so anything machine-specific in them is a bug. Two classes,
# both of which have actually occurred: absolute paths (a scanned folder, an artwork cache),
# and screen geometry that could open an oversized window on smaller displays.
Write-Host 'auditing harvested files for machine-specific data...'
$leaks = 0
foreach ($f in Get-ChildItem $dest -File) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $ascii = [System.Text.Encoding]::ASCII.GetString($bytes)
    $utf16 = [System.Text.Encoding]::Unicode.GetString($bytes)
    foreach ($text in @($ascii, $utf16)) {
        foreach ($m in [regex]::Matches($text, '[A-Za-z]:\\[^\x00-\x1f"<>|]{0,80}')) {
            Write-Host ("  PATH      {0}: {1}" -f $f.Name, $m.Value) -ForegroundColor Yellow
            $leaks++
        }
        foreach ($m in [regex]::Matches($text, '\{[^{}]{0,60}(?:width|height)[^{}]{0,60}\}')) {
            Write-Host ("  GEOMETRY  {0}: {1}" -f $f.Name, $m.Value) -ForegroundColor Yellow
            $leaks++
        }
        foreach ($m in [regex]::Matches($text, '(?<![\d.])(?:2560|1440|3840|2160|1920|1080|1366|768)(?![\d.])')) {
            Write-Host ("  SCREEN?   {0}: {1} -- a display dimension; check it isn't this machine's" -f $f.Name, $m.Value) -ForegroundColor Yellow
            $leaks++
        }
    }
}
if ($leaks -eq 0) { Write-Host '  clean: nothing machine-specific found' -ForegroundColor Green }
else { Write-Host ("  {0} finding(s) -- review before shipping" -f $leaks) -ForegroundColor Yellow }

# ---- sanity check: is the panel actually bound to the theme? --------------------------
$cui = Join-Path $dest 'foo_ui_columns.dll.cfg'
if (Test-Path $cui) {
    $txt = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($cui))
    if ($txt -match 'otoha\\\\main\.js' -or $txt -match 'otoha\\main\.js') {
        Write-Host '  layout OK: panel is bound to otoha\main.js' -ForegroundColor Green
    } else {
        Write-Warning '  layout does NOT reference otoha\main.js -- is the panel still on an inline script?'
    }
}

Write-Host ""
Write-Host "harvested into: $dest"
Write-Host "still to export by hand: dist-config\otoha-layout.fcl (Columns UI Preferences > Export, layout only)"
