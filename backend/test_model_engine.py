from model_engine import run_demo_evaluation


def test_stress_test_is_reproducible():
    assert run_demo_evaluation() == run_demo_evaluation()


def test_each_model_has_four_distinct_scenarios():
    results = run_demo_evaluation()
    for model in results.values():
        names = [s["name"] for s in model["scenarios"]]
        assert len(names) == 4
        assert len(set(names)) == 4


def test_headline_matches_worst_scenario():
    results = run_demo_evaluation()
    for model in results.values():
        worst_accuracy = min(s["stressed_accuracy"] for s in model["scenarios"])
        assert model["stressed_accuracy"] == worst_accuracy

        worst = next(
            s for s in model["scenarios"] if s["name"] == model["worst_scenario"]
        )
        assert len(model["failed_cases"]) == worst["failure_count"]