param(
  [string]$Blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Script = Join-Path $PSScriptRoot "build-machining-kit.py"

Push-Location $ProjectRoot
try {
  & $Blender --background --python-exit-code 1 --python $Script
  if ($LASTEXITCODE -ne 0) { throw "Machining Kit v1 export failed." }
} finally {
  Pop-Location
}
