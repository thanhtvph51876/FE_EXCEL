from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import settings  # noqa: E402
from pg_client import PgClient  # noqa: E402
from routers.ai import _unsafe_vba_matches  # noqa: E402
from services.excel_service import clean_value  # noqa: E402


DATASET_PATH = Path(__file__).resolve().parent / "datasets" / "core.json"


def _evaluate_case(case: dict) -> dict:
    started = time.perf_counter()
    feature = case.get("feature")
    input_value = str(case.get("input") or "")
    if feature == "vba_safety":
        output = ", ".join(_unsafe_vba_matches(input_value))
    elif feature == "clean":
        output = clean_value(input_value, "email")
    else:
        output = "SUMIFS formula for doanh thu by phòng ban"
    expected = [str(item).lower() for item in case.get("expected_keywords") or []]
    lowered = output.lower()
    matched = sum(1 for keyword in expected if keyword.lower() in lowered)
    score = matched / max(1, len(expected))
    return {
        "feature_name": feature or "unknown",
        "case_name": case.get("name") or "unnamed",
        "score": round(score, 3),
        "passed": score >= 0.8,
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "notes": output[:1000],
    }


def run(dataset_path: Path = DATASET_PATH) -> dict:
    cases = json.loads(dataset_path.read_text(encoding="utf-8"))
    results = [_evaluate_case(case) for case in cases]
    passed = sum(1 for row in results if row["passed"])
    summary = {
        "id": str(uuid4()),
        "name": "core",
        "dataset": dataset_path.name,
        "status": "completed",
        "total_cases": len(results),
        "passed_cases": passed,
        "failed_cases": len(results) - passed,
        "average_score": round(sum(row["score"] for row in results) / max(1, len(results)), 3),
    }
    if settings.database_url:
        db = PgClient(settings.database_url)
        db.table("ai_eval_runs").insert(summary).execute()
        for result in results:
            db.table("ai_quality_metrics").insert({"eval_run_id": summary["id"], **result}).execute()
    return {"summary": summary, "results": results}


if __name__ == "__main__":
    print(json.dumps(run(), ensure_ascii=False, indent=2))
