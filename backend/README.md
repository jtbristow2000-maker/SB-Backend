# SB Backend

Sandbox-first backend for the small business automation platform.

This service will own call/message intake, provider webhooks, profile creation, AI extraction contracts, migrations, tests, and dashboard API contracts. The WinForms dashboard in `../dashboard/` remains GUI-owned and is not part of this backend scaffold.

## Stack

- FastAPI for HTTP APIs.
- Pydantic Settings for environment-based config.
- SQLAlchemy models with Alembic migrations.
- Pytest + FastAPI TestClient for tests.

## Safety Defaults

The backend starts in safe local mode:

- `SANDBOX_MODE=true`
- `REAL_MESSAGE_SENDING_ENABLED=false`
- `REAL_CALL_AUTOMATION_ENABLED=false`
- provider values default to sandbox/fake settings

No real calls or messages should be sent unless those flags are explicitly approved and changed.

## Local Setup

From this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Run tests:

```powershell
python -m pytest
```

Create or update the local dev database:

```powershell
python -m alembic upgrade head
```

Run the API:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
GET http://127.0.0.1:8000/health
```
