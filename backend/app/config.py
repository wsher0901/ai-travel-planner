import logging

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

logger = logging.getLogger("roam.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    google_maps_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit_per_user_per_day: int = 10
    environment: str = "development"

    @model_validator(mode="after")
    def _validate_keys(self) -> "Settings":
        # Warn if the configured provider's API key is missing
        key_map = {
            "gemini": ("gemini_api_key", self.gemini_api_key),
            "groq": ("groq_api_key", self.groq_api_key),
            "claude": ("anthropic_api_key", self.anthropic_api_key),
            "openrouter": ("openrouter_api_key", self.openrouter_api_key),
        }
        if self.ai_provider in key_map:
            field_name, value = key_map[self.ai_provider]
            if not value:
                logger.warning(
                    f"ai_provider='{self.ai_provider}' but {field_name} is empty. "
                    "AI calls will fail unless another rung is available."
                )

        # Warn about missing Supabase credentials outside test environments
        if self.environment not in ("test", "testing"):
            if not self.supabase_url:
                logger.warning("supabase_url is not set — DB writes will fail.")
            if not self.supabase_service_key:
                logger.warning("supabase_service_key is not set — DB writes will fail.")

        return self


settings = Settings()
