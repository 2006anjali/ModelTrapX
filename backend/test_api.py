import copy

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def get_payload():
    response = client.get("/api/evaluate")
    assert response.status_code == 200
    return response.json()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_evaluate_returns_report_and_hash():
    payload = get_payload()
    assert payload["hash_algorithm"] == "SHA-256"
    assert len(payload["sha256"]) == 64
    results = payload["report"]["results"]
    assert "v1" in results and "v2" in results
    assert results["v1"]["total_cases"] == 143


def test_verify_accepts_original_report():
    payload = get_payload()
    response = client.post(
        "/api/verify",
        json={"report": payload["report"], "expected_hash": payload["sha256"]},
    )
    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_verify_detects_tampered_report():
    payload = get_payload()
    tampered = copy.deepcopy(payload["report"])
    tampered["results"]["v2"]["accuracy"] = 0.999
    response = client.post(
        "/api/verify",
        json={"report": tampered, "expected_hash": payload["sha256"]},
    )
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_verify_rejects_badly_formatted_hash():
    payload = get_payload()
    response = client.post(
        "/api/verify",
        json={"report": payload["report"], "expected_hash": "abc123"},
    )
    assert response.status_code == 422


def test_verify_demo_is_valid():
    response = client.get("/api/verify-demo")
    assert response.status_code == 200
    assert response.json()["valid"] is True