# ModelTrap X

AI model stress-testing and report integrity platform.

ModelTrap X compares two model versions (v1 and v2) under controlled stress scenarios, produces a reproducible evaluation report, hashes it with SHA-256, and can record that hash on a blockchain so any later change to the report can be detected.

## What it does

1. **Stress test**: runs both models on clean data and on stressed data (feature scale up/down, multi-feature scale up, Gaussian noise).
2. **Report**: builds a JSON report and computes its SHA-256 hash from canonical JSON.
3. **Verify**: recomputes the hash and compares it with the expected one. A one-character change in the report gives a different hash.
4. **Blockchain record**: stores the hash in a `ReportRegistry` smart contract with the timestamp and the submitter address, and can check a report against that record.

## Architecture

| Part | Tech | Folder |
|------|------|--------|
| Frontend | React + TypeScript (Vite) | `frontend` |
| Backend | Python, FastAPI | `backend` |
| Smart contract | Solidity 0.8.24, Hardhat 2 | `blockchain` |

Main API endpoints:

- `GET /api/evaluate`: run the stress test, return report and hash
- `POST /api/verify`: verify a report against a hash
- `POST /api/register`: register the report hash on-chain (hash is recomputed by the server, a wrong hash is rejected)
- `POST /api/verify-onchain`: check a report against the on-chain record

## How to run (4 terminals)

Terminal 1, local blockchain (keep open):

```powershell
cd blockchain
npx hardhat node
```

Terminal 2, deploy the contract (run again after every node restart):

```powershell
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Terminal 3, backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

Terminal 4, frontend (must run on port 5173, the backend CORS allows only this origin):

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Demo flow

1. Run stress test
2. Verify report, then Tamper & verify (test)
3. Register on blockchain
4. Verify on-chain
5. Tamper & verify on-chain (test)

Do not click "Run stress test" between steps 3 and 5: every run creates a new report with a new timestamp, so a new hash.

## Tests

```powershell
cd backend
python -m pytest -q          # 12 tests
cd ../blockchain
npx hardhat test             # 6 tests
```

## Limitations

- The blockchain only proves that a hash was recorded at a certain time by a certain address. It does **not** prove that the evaluation itself was correct.
- The chain is a local Hardhat test network. It resets when the node stops.
- The backend contains Hardhat's public test private key for the demo. Never use it, or any real key stored in code, on a real network.
- The test set has 143 cases, so one case is about 0.7 points. Small differences between models are not strong evidence.
- This is a demonstration stress test, not a universal AI safety guarantee.