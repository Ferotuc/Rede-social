$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instala Node.js 24 LTS antes de continuar.' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
if (-not (Test-Path -LiteralPath 'backend/.env')) { Copy-Item -LiteralPath 'backend/.env.example' -Destination 'backend/.env' }
if (-not (Test-Path -LiteralPath 'frontend/.env')) { Copy-Item -LiteralPath 'frontend/.env.example' -Destination 'frontend/.env' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el proyecto.' }
Write-Host 'Para el backend, ejecuta en esta terminal: npm run dev:api'
Write-Host 'En una segunda terminal en esta misma carpeta: npm run dev:web'
Write-Host 'Abre http://localhost:5173. Swagger: http://localhost:3001/api/docs'
