from fastapi.testclient import TestClient

from app.main import app


def test_health_check_defaults_to_sandbox_mode() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "SB Backend",
        "version": "0.1.0",
        "environment": "development",
        "sandbox_mode": True,
        "real_message_sending_enabled": False,
        "real_call_automation_enabled": False,
    }

