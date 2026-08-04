param(
  [string]$Blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Script = Join-Path $PSScriptRoot "create_machine_kit.py"

Push-Location $ProjectRoot
try {
  & $Blender --background --python-exit-code 1 --python $Script
  if ($LASTEXITCODE -ne 0) { throw "Blender machine-kit export failed." }
} finally {
  Pop-Location
}

Write-Host "Created assets-src/blender/toolpath-machine-kit.blend"
Write-Host "Created five privacy-safe machine GLBs under public/assets/machines"
