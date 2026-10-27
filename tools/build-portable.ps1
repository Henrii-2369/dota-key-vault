$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $projectRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $runtimePath)) { throw 'Missing runtime/node.exe.' }
foreach ($notice in @('runtime\LICENSE.txt', 'runtime\README.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $notice))) { throw "Missing $notice" }
}
$runtimeInfo = & $runtimePath -p 'JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})' | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $runtimeInfo.platform -ne 'win32' -or $runtimeInfo.arch -ne 'x64' -or [int]$runtimeInfo.version.TrimStart('v').Split('.')[0] -lt 22) {
    throw 'Expected Windows x64 Node.js >=22.'
}
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$releaseName = "DOTA-Key-Vault-$version-win-x64-$stamp"
$distPath = Join-Path $projectRoot 'dist'
$releasePath = Join-Path $distPath $releaseName
New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
# Explicit allowlist prevents accidental inclusion of local account data.
foreach ($entry in @('public', 'server', 'runtime', 'README.md', 'README.en.md', 'package.json')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $releasePath -Recurse
}
$docsPath = Join-Path $releasePath 'docs'
New-Item -ItemType Directory -Path $docsPath | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\images') -Destination $docsPath -Recurse
$launcher = Get-ChildItem -LiteralPath $projectRoot -Filter '*.cmd'
if (@($launcher).Count -ne 1) { throw 'Expected exactly one CMD launcher.' }
Copy-Item -LiteralPath $launcher.FullName -Destination $releasePath
$toolsPath = Join-Path $releasePath 'tools'
New-Item -ItemType Directory -Path $toolsPath | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'launch.mjs') -Destination $toolsPath
$zipPath = Join-Path $distPath "$releaseName.zip"
Compress-Archive -LiteralPath $releasePath -DestinationPath $zipPath -CompressionLevel Optimal
Get-FileHash -LiteralPath $zipPath -Algorithm SHA256 | Format-List
Write-Output "Portable release: $zipPath"
