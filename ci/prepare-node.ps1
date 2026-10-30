$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = 'v22.11.0'
$base = "https://nodejs.org/dist/$version"
$root = (Resolve-Path '.').Path
$downloads = Join-Path $root '.ci-work/downloads'
$sourceRoot = Join-Path $root '.ci-work/source'
New-Item -ItemType Directory -Force -Path $downloads,$sourceRoot,'evidence' | Out-Null
Write-Output '[A1B] Verify official Node 22.11.0 artifacts'
$checksums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -TimeoutSec 45).Content
if ($checksums -is [byte[]]) { $checksums = [Text.Encoding]::UTF8.GetString($checksums) }
$hashes = @{}
foreach ($line in ($checksums -split "[\r\n]+")) {
  if ($line -match '^([a-fA-F0-9]{64})\s+\*?(.+)$') {
    $hashes[$Matches[2].Trim()] = $Matches[1].ToLowerInvariant()
  }
}
$targets = [ordered]@{
  'node-v22.11.0.tar.gz' = (Join-Path $downloads 'node-v22.11.0.tar.gz')
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
$known = '7447c4ece014aa41fb2ff866c993c708e5a8213a00913cc2ac5049ea3ffc230d'
if ($hashes['win-x64/node.exe'] -ne $known) { throw 'Node binary differs from pinned Demiurge runtime' }
$source = Join-Path $sourceRoot 'node-v22.11.0'
if (-not (Test-Path (Join-Path $source 'src/env-inl.h'))) {
  Write-Output '[A1B] Extract exact official Node source'
  & tar.exe -xzf $targets['node-v22.11.0.tar.gz'] -C $sourceRoot
  if ($LASTEXITCODE -ne 0) { throw "Source extraction failed: $LASTEXITCODE" }
}
if (-not (Test-Path (Join-Path $source 'src/env-inl.h'))) { throw 'Node source is incomplete' }
$actualVersion = (& $targets['win-x64/node.exe'] --version)
if ($actualVersion -ne $version) { throw "Unexpected Node runtime: $actualVersion" }
Write-Output "[A1B] Pinned Node runtime ready $actualVersion"
