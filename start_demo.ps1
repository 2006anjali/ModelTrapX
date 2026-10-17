$root = "C:\Users\Anjali\Desktop\ModelTrapX"

# Free ports from old runs (5173 must be free: backend CORS allows only it)
foreach ($port in 8545, 8000, 5173, 5174) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2

# 1) Local blockchain
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\blockchain'; npx hardhat node"

# Wait until the node answers on port 8545
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    if (Test-NetConnection 127.0.0.1 -Port 8545 -InformationLevel Quiet -WarningAction SilentlyContinue) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { Write-Host "Hardhat node did not start. Check its window." -ForegroundColor Red; exit 1 }

# 2) Deploy contract (writes deployment.json)
Set-Location "$root\blockchain"
npx hardhat run scripts/deploy.js --network localhost

# 3) Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\.venv\Scripts\Activate.ps1; uvicorn main:app --reload"

# 4) Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Start-Sleep -Seconds 6
Start-Process "http://localhost:5173"
Write-Host "Demo started. Close the three new windows to stop everything." -ForegroundColor Green