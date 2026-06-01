from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "sandbox_mode": settings.sandbox_mode,
        "real_message_sending_enabled": settings.real_message_sending_enabled,
        "real_call_automation_enabled": settings.real_call_automation_enabled,
    }

