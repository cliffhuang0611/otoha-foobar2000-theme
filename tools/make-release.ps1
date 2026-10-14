<#
    make-release.ps1 -- assemble the release zip.

    Version comes from OTOHA_VERSION in theme\otoha\main.js, so
    there is one place to bump and no way for the zip name and the panel to disagree.

    Usage:
        .\tools\make-release.ps1
        .\tools\make-release.ps1 -OutDir 'D:\somewhere'
#>
param(
    [string]$OutDir
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $repo 'dist' }

# ---- version ----------------------------------------------------------------
$mainJs = Get-Content (Join-Path $repo 'theme\otoha\main.js') -Raw
if ($mainJs -notmatch "OTOHA_VERSION\s*=\s*'([0-9]+\.[0-9]+\.[0-9]+)'") { throw "couldn't read OTOHA_VERSION from theme\otoha\main.js" }
$version = $Matches[1]
Write-Host "Otoha v$version"

# ---- required inputs --------------------------------------------------------
$need = @{
    'theme'      = Join-Path $repo 'theme\otoha'
    'components' = Join-Path $repo 'components'
    'fcl'        = Join-Path $repo 'dist-config\otoha-layout.fcl'
    'installer'  = Join-Path $repo 'tools\install.ps1'
}
foreach ($k in $need.Keys) { if (-not (Test-Path $need[$k])) { throw "missing $k : $($need[$k])" } }

# ---- stage ------------------------------------------------------------------
$stage = Join-Path $env:TEMP ("otoha-release-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Force -Path $stage | Out-Null

# Only scripts and component binaries are staged; configuration is imported from the layout FCL.
$null = robocopy $need['theme'] (Join-Path $stage 'profile\otoha') /E /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw 'staging theme failed' }
$null = robocopy $need['components'] (Join-Path $stage 'profile\user-components-x64') /E /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw 'staging components failed' }
$global:LASTEXITCODE = 0   # robocopy returns 1 for "files copied"; don't let it look like failure

# extras\ : the layout on its own, for people who already run Columns UI and want only the
# panel layout replaced -- via install.bat, or by importing it themselves.
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'extras') | Out-Null
Copy-Item $need['fcl'] (Join-Path $stage 'extras\otoha-layout.fcl') -Force

Copy-Item (Join-Path $repo 'tools\install.ps1') $stage -Force
Copy-Item (Join-Path $repo 'tools\install.bat') $stage -Force

# Licences travel with the binaries: the bundle redistributes two third-party components,
# and LGPL-3.0 (Columns UI) requires the licence text to be conveyed with them. Their own
# licence files already sit inside components\ and so ride along with the copy above.
Copy-Item (Join-Path $repo 'LICENSE') $stage -Force
Copy-Item (Join-Path $repo 'THIRD-PARTY-NOTICES.md') $stage -Force
Copy-Item (Join-Path $repo 'README.md') $stage -Force
Copy-Item (Join-Path $repo 'CHANGELOG.md') $stage -Force

# ---- install notes ----------------------------------------------------------
@"
Otoha v$version -- a local music theme for foobar2000
by cliffhuang0611, based on Verdant by superziper

INSTALL
  1. Install foobar2000 v2, 64-bit. A separate portable copy is useful for testing.
  2. Close foobar2000. Copy profile/otoha to your profile's otoha folder.
     Copy missing component folders from profile/user-components-x64 as well.
  3. Start foobar2000 and select Columns UI under Preferences > Display.
  4. Import extras/otoha-layout.fcl in Columns UI preferences, including Main Layout,
     Toolbar Layout, and Misc Layout. Add music under Preferences > Media Library.

  Standard profile: %APPDATA%\foobar2000-v2
  Portable profile: <foobar2000 folder>\profile
  No CFG or SQLite profile settings are included. Keep your existing profile settings.
  See README.md for removal, reinstallation, and optional installer backup instructions.

REQUIREMENTS
  foobar2000 v2 (64-bit), Windows 10 or 11.
  Fonts: none to install -- it uses Segoe UI / Segoe MDL2 Assets, both built in.
  Components: Columns UI, JSplitter -- all bundled, installed only if missing.

FIRST RUN
  Otoha reads foobar's Media Library. On a new foobar that library is empty, so
  Home, All Songs and the artist views will be blank until you add a music folder
  under Preferences > Media Library. That is expected, not a broken install.

TUNING
  Right-click the panel > Properties:
    Display: UI scale (0 = auto)   0 follows your display; set 1.0 for compact, higher for 4K
    Scrolling: wheel step (px)     how far one wheel notch scrolls
  Reload the panel (right-click > Reload) after changing either.

UNINSTALL
  Follow the Remove Otoha section in README.md: replace the Otoha layout using
  Columns UI Quick setup (or choose Default UI), then close foobar2000 and
  remove <profile>\otoha\. Backup restoration is a separate operation.

NOTES
  Otoha restyles your local library. It does not connect to Spotify's service.
  Not affiliated with or endorsed by Spotify; "Spotify" is a trademark of Spotify AB.
"@ | Set-Content -Path (Join-Path $stage 'README-INSTALL.txt') -Encoding utf8

# ---- zip --------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$zip = Join-Path $OutDir "Otoha-v$version.zip"
if (Test-Path $zip) { [System.IO.File]::Delete($zip) }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
[System.IO.Directory]::Delete($stage, $true)

$mb = [math]::Round((Get-Item $zip).Length/1MB, 1)
Write-Host ""
Write-Host ("  {0}  ({1} MB)" -f $zip, $mb) -ForegroundColor Green
