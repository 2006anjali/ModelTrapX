import hashlib
import json
from datetime import datetime, timezone


def normalize_numbers(value):
    """Make number formatting consistent before hashing.

    JavaScript turns 0.0 into 0 when JSON passes through a browser.
    Python would then treat it as an integer and produce a different
    hash. To avoid that, any float that is a whole number (for example
    0.0 or 1.0) is converted to an int before hashing, both when the
    report is created and when it is verified.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else value
    if isinstance(value, dict):
        return {key: normalize_numbers(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalize_numbers(item) for item in value]
    return value


def compute_report_hash(report):
    """Return the SHA-256 hash of a report using canonical JSON."""
    canonical_json = json.dumps(
        normalize_numbers(report),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def create_evaluation_report(evaluation_results):
    """Create a reproducible report and its SHA-256 hash."""

    report = {
        "project": "ModelTrap X",
        "report_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "test_suite": "feature_scale_stress_v1",
        "results": evaluation_results,
    }

    return {
        "report": report,
        "sha256": compute_report_hash(report),
        "hash_algorithm": "SHA-256",
    }


def verify_report_hash(report, expected_hash):
    """Verify a report against its expected SHA-256 hash."""

    actual_hash = compute_report_hash(report)

    return {
        "valid": actual_hash == expected_hash,
        "expected_hash": expected_hash,
        "actual_hash": actual_hash,
        "hash_algorithm": "SHA-256",
    }
