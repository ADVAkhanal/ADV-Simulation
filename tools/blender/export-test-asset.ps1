param(
  [string]$Blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Script = Join-Path $PSScriptRoot "create_toolpath_test_asset.py"

Push-Location $ProjectRoot
try {
  & $Blender --background --python-exit-code 1 --python $Script
  if ($LASTEXITCODE -ne 0) { throw "Blender test-asset export failed." }
} finally {
  Pop-Location
}

Write-Host "Created assets-src/blender/toolpath-mcp-test.blend"
Write-Host "Created public/assets/test/toolpath-mcp-test.glb"
