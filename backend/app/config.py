from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    groq_api_key: str = ""
    anthropic_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    google_maps_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit_per_user_per_day: int = 10
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()