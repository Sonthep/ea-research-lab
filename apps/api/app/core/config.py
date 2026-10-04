from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./ea_lab.db"
    api_cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 100
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
