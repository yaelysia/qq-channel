$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = 'v26.7.0'
$base = "https://nodejs.org/dist/$version"
$root = (Resolve-Path '.').Path
$downloads = Join-Path $root '.ci-work/downloads'
$sourceRoot = Join-Path $root '.ci-work/source'
New-Item -ItemType Directory -Force -Path $downloads,$sourceRoot,'evidence' | Out-Null
Write-Output '[A1B] Verify official Node 26.7.0 artifacts'
$checksums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -TimeoutSec 45).Content
if ($checksums -is [byte[]]) { $checksums = [Text.Encoding]::UTF8.GetString($checksums) }
$hashes = @{}
foreach ($line in ($checksums -split "[\r\n]+")) {
  if ($line -match '^([a-fA-F0-9]{64})\s+\*?(.+)$') {
    $hashes[$Matches[2].Trim()] = $Matches[1].ToLowerInvariant()
  }
}
$targets = [ordered]@{
  'node-v26.7.0.tar.gz' = (Join-Path $downloads 'node-v26.7.0.tar.gz')
  'win-x64/node.exe' = (Join-Path $downloads 'node.exe')
  'win-x64/node.lib' = (Join-Path $downloads 'node.lib')
}
foreach ($entry in $targets.GetEnumerator()) {
  $key = $entry.Key
  $output = $entry.Value
  if (-not $hashes.ContainsKey($key)) { throw "Official hash missing: $key" }
  if (-not (Test-Path $output)) {
    Write-Output "[A1B] Download $key"
    Invoke-WebRequest -Uri "$base/$key" -OutFile $output -TimeoutSec 150
  }
  $actual = (Get-FileHash -Algorithm SHA256 -Path $output).Hash.ToLowerInvariant()
  if ($actual -ne $hashes[$key]) { throw "SHA256 mismatch for $key" }
  Write-Output "[A1B] Verified $key sha256=$actual"
}
$known = 'e921fe5307e29bf6fd00000dd594356affd3a7b044e52720c7f10decbdc305b9'
if ($hashes['win-x64/node.exe'] -ne $known) { throw 'Node binary differs from pinned Demiurge runtime' }
$source = Join-Path $sourceRoot 'node-v26.7.0'
if (-not (Test-Path (Join-Path $source 'src/env-inl.h'))) {
  Write-Output '[A1B] Extract exact official Node source'
  & tar.exe -xzf $targets['node-v26.7.0.tar.gz'] -C $sourceRoot
  if ($LASTEXITCODE -ne 0) { throw "Source extraction failed: $LASTEXITCODE" }
}
if (-not (Test-Path (Join-Path $source 'src/env-inl.h'))) { throw 'Node source is incomplete' }
$actualVersion = (& $targets['win-x64/node.exe'] --version)
if ($actualVersion -ne $version) { throw "Unexpected Node runtime: $actualVersion" }
Write-Output "[A1B] Pinned Node runtime ready $actualVersion"
