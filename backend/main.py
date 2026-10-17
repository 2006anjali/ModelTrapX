
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model_engine import run_demo_evaluation
from report_service import (
    create_evaluation_report,
    verify_report_hash,
)

app = FastAPI(
    title="ModelTrap X API",
    description="AI Model Stress-Testing and Report Integrity",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class VerifyRequest(BaseModel):
    report: dict
    expected_hash: str = Field(
        min_length=64,
        max_length=64,
        pattern=r"^[0-9a-fA-F]{64}$",
    )


@app.get("/")
def home():
    return {
        "project": "ModelTrap X",
        "status": "running",
        "message": "AI stress-testing API is ready",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/evaluate")
def evaluate():
    results = run_demo_evaluation()
    return create_evaluation_report(results)


@app.post("/api/verify")
def verify(request: VerifyRequest):
    try:
        return verify_report_hash(
            request.report,
            request.expected_hash,
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid report data",
        )


@app.get("/api/verify-demo")
def verify_demo():
    try:
        payload = create_evaluation_report(
            run_demo_evaluation()
        )

        return verify_report_hash(
            payload["report"],
            payload["sha256"],
        )
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid report data",
        )



from chain_routes import router as chain_router  # noqa: E402
app.include_router(chain_router)
