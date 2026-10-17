from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from blockchain_service import check_hash, register_hash
from report_service import compute_report_hash

router = APIRouter(prefix="/api")


class ChainRequest(BaseModel):
    report: dict
    expected_hash: str = Field(
        min_length=64,
        max_length=64,
        pattern=r"^[0-9a-fA-F]{64}$",
    )


def _chain_call(func, *args):
    try:
        return func(*args)
    except (RuntimeError, FileNotFoundError, ConnectionError):
        raise HTTPException(
            status_code=503,
            detail="Blockchain unavailable. Start the node and deploy the contract.",
        )


@router.post("/register")
def register(request: ChainRequest):
    try:
        actual_hash = compute_report_hash(request.report)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid report data")

    if actual_hash != request.expected_hash.lower():
        raise HTTPException(
            status_code=400,
            detail="Hash does not match the report",
        )

    existing = _chain_call(check_hash, actual_hash)
    if existing["registered"]:
        raise HTTPException(
            status_code=409,
            detail="Report already registered on-chain",
        )

    test_suite = str(request.report.get("test_suite", "unknown"))
    metadata = "ModelTrap X report v" + str(request.report.get("report_version", "?"))
    tx = _chain_call(register_hash, actual_hash, test_suite, metadata)

    return {
        "sha256": actual_hash,
        "tx_hash": tx["tx_hash"],
        "block_number": tx["block_number"],
    }


@router.post("/verify-onchain")
def verify_onchain(request: ChainRequest):
    try:
        actual_hash = compute_report_hash(request.report)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid report data")

    hash_matches = actual_hash == request.expected_hash.lower()
    on_chain = _chain_call(check_hash, actual_hash)

    return {
        "valid": hash_matches and on_chain["registered"],
        "hash_matches": hash_matches,
        "expected_hash": request.expected_hash.lower(),
        "actual_hash": actual_hash,
        "on_chain": on_chain,
    }

@router.get("/contract-info")
def contract_info():
    import json
    from blockchain_service import DEPLOYMENT_FILE

    try:
        data = json.loads(DEPLOYMENT_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="Contract not deployed. Run deploy.js first.",
        )
    return {"address": data["address"], "abi": data["abi"]}