[CmdletBinding()]
param(
  [switch]$SkipLint,
  [switch]$SkipTests,
  [switch]$KeepStaging
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $projectRoot
try {
  $factoryArgs = @("run", "factory", "--")
  if ($SkipLint) { $factoryArgs += "--skip-lint" }
  if ($SkipTests) { $factoryArgs += "--skip-tests" }
  if ($KeepStaging) { $factoryArgs += "--keep-staging" }
  & npm.cmd @factoryArgs
  if ($LASTEXITCODE -ne 0) { throw "Game factory failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}
