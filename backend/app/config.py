from functools import lru_cache
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class TableRegistry(BaseSettings):
    """
    Dynamic Table Registry.
    Zero table names are hardcoded in the codebase.
    All table names are dynamically resolved from environment variables.
    """
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    employees: str = Field(default="employees", alias="TABLE_EMPLOYEES")
    refresh_tokens: str = Field(default="refresh_tokens", alias="TABLE_REFRESH_TOKENS")
    office_locations: str = Field(default="office_locations", alias="TABLE_OFFICE_LOCATIONS")
    attendance: str = Field(default="attendance", alias="TABLE_ATTENDANCE")
    breaks: str = Field(default="breaks", alias="TABLE_BREAKS")
    leave_balances: str = Field(default="leave_balances", alias="TABLE_LEAVE_BALANCES")
    leave_requests: str = Field(default="leave_requests", alias="TABLE_LEAVE_REQUESTS")
    field_sessions: str = Field(default="field_sessions", alias="TABLE_FIELD_SESSIONS")
    field_visits: str = Field(default="field_visits", alias="TABLE_FIELD_VISITS")
    tasks: str = Field(default="tasks", alias="TABLE_TASKS")
    audit_log: str = Field(default="audit_log", alias="TABLE_AUDIT_LOG")


class Settings(BaseSettings):
    """
    Core Application Settings.
    Completely decoupled from any specific Supabase project or client tenant.
    All configuration is loaded via environment variables at runtime.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    # General App Info
    app_name: str = "FSM Master Core Platform"
    app_env: str = "development"
    debug: bool = True
    port: int = 8000
    allowed_origins: str = "*"

    # Database Configuration
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/fsm_core",
        alias="DATABASE_URL"
    )
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_echo: bool = False

    # Security & Tokens
    jwt_secret: str = Field(
        default="fsm-master-core-development-secret-key-32-chars-min",
        alias="JWT_SECRET"
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Spatial & Geofencing Parameters
    default_geofence_radius_meters: int = 150
    max_accuracy_threshold_meters: float = 100.0
    max_allowed_speed_kmh: float = 140.0

    # Dynamic Table Registry Instance
    tables: TableRegistry = Field(default_factory=TableRegistry)

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_async_db_url(cls, v: Optional[str]) -> str:
        if not v:
            return "postgresql+asyncpg://postgres:postgres@localhost:5432/fsm_core"
        # Ensure asyncpg driver is used for standard postgresql URLs
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins(self) -> List[str]:
        if self.allowed_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Cached singleton settings instance."""
    return Settings()
