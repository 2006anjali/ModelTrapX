import copy
import json

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def browser_style(value):
    """Imitate JavaScript: whole-number floats like 0.0 become 0."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: browser_style(v) for k, v in value.items()}
    if isinstance(value, list):
        return [browser_style(v) for v in value]
    return value


def get_payload():
    response = client.get("/api/evaluate")
    assert response.status_code == 200
    return response.json()


def test_report_contains_whole_number_floats():
    # Makes sure this test is meaningful: the report really has values like 0.0.
    payload = get_payload()
    assert json.dumps(browser_style(payload["report"])) != json.dumps(payload["report"])


def test_original_report_verifies_after_browser_roundtrip():
    payload = get_payload()
    response = client.post(
        "/api/verify",
        json={
            "report": browser_style(payload["report"]),
            "expected_hash": payload["sha256"],
        },
    )
    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_tampered_report_is_still_rejected_after_browser_roundtrip():
    payload = get_payload()
    tampered = copy.deepcopy(payload["report"])
    tampered["results"]["v2"]["accuracy"] = 0.999
    response = client.post(
        "/api/verify",
        json={
            "report": browser_style(tampered),
            "expected_hash": payload["sha256"],
        },
    )
    assert response.status_code == 200
    assert response.json()["valid"] is False
