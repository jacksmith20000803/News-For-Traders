# Run this once after switching to Neon PostgreSQL
Set-Location $PSScriptRoot\..

Write-Host "Pushing schema to Neon..." -ForegroundColor Cyan
npx prisma db push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating Prisma client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Seeding demo data..." -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done! Start the dev server with: npm run dev" -ForegroundColor Green
