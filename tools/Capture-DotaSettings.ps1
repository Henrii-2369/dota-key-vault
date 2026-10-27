[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SteamRoot,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9_-]+$')]
    [string]$Label
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedSteamRoot = (Resolve-Path -LiteralPath $SteamRoot).Path
$userdataRoot = Join-Path $resolvedSteamRoot 'userdata'
$captureId = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'), $Label
$captureRoot = Join-Path $projectRoot "experiments\local\$captureId"
New-Item -ItemType Directory -Path $captureRoot | Out-Null

# Read only a fixed set of settings files; never copy chat or authentication files.
$records = @()
foreach ($accountDirectory in Get-ChildItem -LiteralPath $userdataRoot -Directory) {
    if ($accountDirectory.Name -notmatch '^\d+$') { continue }
    $appRoot = Join-Path $accountDirectory.FullName '570'
    if (-not (Test-Path -LiteralPath $appRoot)) { continue }
    $relativeFiles = @(
        'remote\cfg\dotakeys_personal.lst',
        'remote\user_keys.vcfg',
        'remote\user_convars.vcfg',
        'local\cfg\machine_convars.vcfg',
        'local\cfg\user_keys_0_slot0.vcfg',
        'local\cfg\user_keys_0_slot1.vcfg',
        'local\cfg\user_keys_0_slot2.vcfg',
        'local\cfg\user_keys_0_slot3.vcfg',
        'local\cfg\user_convars_0_slot0.vcfg'
    )
    foreach ($relativeFile in $relativeFiles) {
        $sourceFile = Join-Path $appRoot $relativeFile
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { continue }
        $snapshotRelative = Join-Path $accountDirectory.Name $relativeFile
        $destination = Join-Path $captureRoot $snapshotRelative
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        $sourceHashBefore = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        Copy-Item -LiteralPath $sourceFile -Destination $destination
        $snapshotHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        $sourceHashAfter = (Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $sourceInfo = Get-Item -LiteralPath $sourceFile
        $records += [pscustomobject]@{
            AccountDirectory = $accountDirectory.Name
            RelativePath = $relativeFile
            SourcePath = $sourceFile
            SnapshotPath = $snapshotRelative
            SHA256 = $snapshotHash
            Length = (Get-Item -LiteralPath $destination).Length
            SourceLastWriteUtc = $sourceInfo.LastWriteTimeUtc.ToString('o')
            StableDuringCapture = ($sourceHashBefore -eq $snapshotHash -and $snapshotHash -eq $sourceHashAfter)
        }
    }
}
$processes = @(Get-Process -Name dota2 -ErrorAction SilentlyContinue | Select-Object ProcessName, Id)
$manifest = [ordered]@{
    Label = $Label
    CapturedAtUtc = [DateTime]::UtcNow.ToString('o')
    SteamRoot = $resolvedSteamRoot
    DotaProcesses = $processes
    Files = $records
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $captureRoot 'manifest.json') -Encoding utf8
[pscustomobject]@{
    Snapshot = $captureRoot
    FileCount = $records.Count
    DotaRunning = ($processes.Count -gt 0)
    AllFilesStable = (@($records | Where-Object { -not $_.StableDuringCapture }).Count -eq 0)
} | ConvertTo-Json

