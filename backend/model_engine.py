from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import numpy as np

NOISE_SEED = 42


def load_demo_models():
    """Train two demo classifiers using the same fixed dataset split."""
    data = load_breast_cancer()
    X = data.data
    y = data.target

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    model_v1 = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=2000, C=0.1, random_state=42),
    )

    model_v2 = make_pipeline(
        StandardScaler(),
        LogisticRegression(max_iter=2000, C=1.0, random_state=42),
    )

    model_v1.fit(X_train, y_train)
    model_v2.fit(X_train, y_train)

    return {
        "v1": model_v1,
        "v2": model_v2,
        "X_test": X_test,
        "y_test": y_test,
        "feature_names": data.feature_names.tolist(),
        "target_names": data.target_names.tolist(),
    }


def _scale_columns(X, columns, factor):
    """Return a copy of X with the given columns multiplied by factor."""
    X_new = X.copy()
    for col in columns:
        X_new[:, col] = X_new[:, col] * factor
    return X_new


def build_scenarios(X, feature_names):
    """Build reproducible stress scenarios.

    Every model gets exactly the same stressed data, because the noise
    uses a fixed seed. Demonstration scenarios only.
    """
    idx_radius = feature_names.index("mean radius")
    idx_texture = feature_names.index("mean texture")

    rng = np.random.default_rng(NOISE_SEED)
    noise = rng.normal(0.0, 0.10 * X.std(axis=0), size=X.shape)

    return [
        {
            "name": "scale_up_15",
            "description": "mean radius increased by 15%",
            "changed_feature": "mean radius",
            "X_stressed": _scale_columns(X, [idx_radius], 1.15),
        },
        {
            "name": "scale_down_15",
            "description": "mean radius decreased by 15%",
            "changed_feature": "mean radius",
            "X_stressed": _scale_columns(X, [idx_radius], 0.85),
        },
        {
            "name": "multi_feature_scale_up_15",
            "description": "mean radius and mean texture increased by 15%",
            "changed_feature": "mean radius, mean texture",
            "X_stressed": _scale_columns(X, [idx_radius, idx_texture], 1.15),
        },
        {
            "name": "gaussian_noise_10",
            "description": (
                "Gaussian noise added to all features "
                "(std = 10% of each feature's std, seed 42)"
            ),
            "changed_feature": "all features (noise)",
            "X_stressed": X + noise,
        },
    ]


def evaluate_model(model, X, y, feature_names, version):
    """Evaluate clean data and several stress scenarios."""
    idx_ref = feature_names.index("mean radius")

    clean_predictions = model.predict(X)
    clean_accuracy = float(accuracy_score(y, clean_predictions))
    clean_correct = clean_predictions == y

    scenario_summaries = []
    scenario_failures = {}

    for scenario in build_scenarios(X, feature_names):
        X_stressed = scenario["X_stressed"]
        stressed_predictions = model.predict(X_stressed)
        stressed_correct = stressed_predictions == y
        stressed_accuracy = float(accuracy_score(y, stressed_predictions))

        failures = []
        for i in np.where(~stressed_correct)[0]:
            failures.append({
                "case_id": int(i),
                "actual_label": int(y[i]),
                "predicted_label": int(stressed_predictions[i]),
                "changed_feature": scenario["changed_feature"],
                "original_value": float(X[i, idx_ref]),
                "stressed_value": float(X_stressed[i, idx_ref]),
                "scenario": scenario["name"],
                "failed_on_clean_data": bool(not clean_correct[i]),
            })

        scenario_failures[scenario["name"]] = failures
        scenario_summaries.append({
            "name": scenario["name"],
            "description": scenario["description"],
            "changed_feature": scenario["changed_feature"],
            "stressed_accuracy": round(stressed_accuracy, 4),
            "accuracy_change": round(stressed_accuracy - clean_accuracy, 4),
            "failure_count": len(failures),
            "newly_failed": int(np.sum(clean_correct & ~stressed_correct)),
            "newly_fixed": int(np.sum(~clean_correct & stressed_correct)),
        })

    # Headline numbers use the worst scenario (lowest stressed accuracy).
    worst = min(scenario_summaries, key=lambda s: s["stressed_accuracy"])
    worst_failures = scenario_failures[worst["name"]]
    total_cases = int(len(y))

    return {
        "model_version": version,
        "test_suite": "feature_scale_stress_v1",
        "total_cases": total_cases,
        "accuracy": round(clean_accuracy, 4),
        "stressed_accuracy": worst["stressed_accuracy"],
        "failure_rate": round(
            len(worst_failures) / total_cases if total_cases else 0.0, 4
        ),
        "robustness_score": round(worst["stressed_accuracy"] * 100, 2),
        "worst_scenario": worst["name"],
        "failed_cases": worst_failures,
        "scenarios": scenario_summaries,
        "note": (
            "Demonstration stress test only; "
            "not a universal AI safety guarantee."
        ),
    }


def run_demo_evaluation():
    models = load_demo_models()

    return {
        "v1": evaluate_model(
            models["v1"],
            models["X_test"],
            models["y_test"],
            models["feature_names"],
            "v1",
        ),
        "v2": evaluate_model(
            models["v2"],
            models["X_test"],
            models["y_test"],
            models["feature_names"],
            "v2",
        ),
    }