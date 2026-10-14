<#
    deploy.ps1 -- dev sync: copies theme\otoha\ into the foobar2000 profile.

    The shipped installer copies the exact same folder to the exact same place, so what
    you iterate on here is what users get -- there is no build step and no second code path.

    Usage:
        .\tools\deploy.ps1              # one-shot copy
        .\tools\deploy.ps1 -Watch       # copy now, then re-copy whenever a source file changes

    The profile is auto-detected (portable install via the registry, else %APPDATA%\foobar2000-v2).
    Override it with -FoobarProfile, or set OTOHA_PROFILE once and forget about it.

    First time only, point the panel at the deployed copy:
        right-click the JSplitter panel > Configure > Script source: File
        > otoha\main.js   (paths are relative to the profile folder)

    After that, iterate with: edit -> deploy -> right-click panel > Reload.
    console.log output goes to foobar's console (View > Console).
#>
param(
    [switch]$Watch,
    [string]$FoobarProfile
)

$ErrorActionPreference = 'Stop'
$src = Join-Path (Split-Path -Parent $PSScriptRoot) 'theme\otoha'
if (-not (Test-Path $src)) { throw "theme source not found: $src" }

# Find the profile rather than hardcoding one: this script is public, and one developer's
# folder layout is both useless to everyone else and nobody else's business.
#   1. -FoobarProfile
#   2. $env:OTOHA_PROFILE   (set this once and forget it)
#   3. a portable install found via the registry
#   4. %APPDATA%\foobar2000-v2
if (-not $FoobarProfile) { $FoobarProfile = $env:OTOHA_PROFILE }
if (-not $FoobarProfile) {
    foreach ($key in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\foobar2000',
                     'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\foobar2000') {
        try {
            $loc = (Get-ItemProperty -Path $key -ErrorAction Stop).InstallLocation
            if ($loc -and (Test-Path (Join-Path $loc 'portable_mode_enabled'))) {
                $FoobarProfile = Join-Path $loc 'profile'; break
            }
        } catch { }
    }
}
if (-not $FoobarProfile) {
    $appdata = Join-Path $env:APPDATA 'foobar2000-v2'
    if (Test-Path $appdata) { $FoobarProfile = $appdata }
}
if (-not $FoobarProfile -or -not (Test-Path $FoobarProfile)) {
    throw ("couldn't find a foobar2000 profile. Pass one:`n" +
           "    .\tools\deploy.ps1 -FoobarProfile 'D:\foobar2000\profile'`n" +
           "  or set it once:`n" +
           "    setx OTOHA_PROFILE D:\foobar2000\profile")
}

$dest = Join-Path $FoobarProfile 'otoha'

function Sync-Theme {
    # /MIR so a module deleted here also disappears from the profile -- a stale .js left behind
    # would still be include()d and would silently shadow the current code.
    $null = robocopy $src $dest /MIR /NFL /NDL /NJH /NJS /NP
    # robocopy is not a normal exit-code citizen: 0 = nothing to do, 1 = files copied,
    # anything >= 8 is a real failure. Clear it so a successful copy doesn't look like one.
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
    $global:LASTEXITCODE = 0
    $n = (Get-ChildItem -Recurse -File $src).Count
    Write-Host ("[{0}] deployed {1} files -> {2}" -f (Get-Date -Format 'HH:mm:ss'), $n, $dest)
}

Sync-Theme

if ($Watch) {
    Write-Host 'Watching theme\otoha for changes -- edit + save, then reload the panel. Ctrl+C to stop.'
    function Source-State {
        (Get-ChildItem -Recurse $src -File | Sort-Object FullName | ForEach-Object {
            '{0}|{1}|{2}' -f $_.FullName, $_.Length, $_.LastWriteTimeUtc.Ticks
        }) -join "`n"
    }
    $last = Source-State
    while ($true) {
        Start-Sleep -Seconds 1
        $cur = Source-State
        if ($cur -ne $last) { Sync-Theme; $last = $cur }
    }
}
