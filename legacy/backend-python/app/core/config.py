from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SB Backend"
    app_version: str = "0.1.0"
    app_env: str = "development"
    sandbox_mode: bool = True
    public_base_url: str = "http://localhost:8000"
    database_url: str = "sqlite:///./data/dev.db"

    real_message_sending_enabled: bool = False
    real_call_automation_enabled: bool = False

    call_provider: str = "sandbox"
    sms_provider: str = "sandbox"
    transcription_provider: str = "sandbox"
    ai_extraction_provider: str = "sandbox"
    storage_provider: str = "local"
    local_storage_dir: str = "./data/uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

