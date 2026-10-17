import json
from pathlib import Path

from web3 import Web3

RPC_URL = "http://127.0.0.1:8545"
DEPLOYMENT_FILE = Path(__file__).resolve().parent.parent / "blockchain" / "deployment.json"
# Hardhat account #0 (public test key, only for local demo)
PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def _contract():
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        raise RuntimeError("Blockchain node is not running at " + RPC_URL)
    data = json.loads(DEPLOYMENT_FILE.read_text(encoding="utf-8"))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(data["address"]), abi=data["abi"]
    )
    return w3, contract


def _to_bytes32(sha256_hex):
    return bytes.fromhex(sha256_hex.removeprefix("0x"))


def register_hash(sha256_hex, test_suite, metadata=""):
    w3, contract = _contract()
    account = w3.eth.account.from_key(PRIVATE_KEY)
    tx = contract.functions.registerReport(
        _to_bytes32(sha256_hex), test_suite, metadata
    ).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return {"tx_hash": tx_hash.hex(), "block_number": receipt.blockNumber}


def check_hash(sha256_hex):
    w3, contract = _contract()
    key = _to_bytes32(sha256_hex)
    if not contract.functions.isRegistered(key).call():
        return {"registered": False}
    submitter, timestamp, suite, meta = contract.functions.getReport(key).call()
    return {
        "registered": True,
        "submitter": submitter,
        "timestamp": timestamp,
        "test_suite": suite,
        "metadata": meta,
    }