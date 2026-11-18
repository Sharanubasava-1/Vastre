"""Startup configuration. Never log environment values or credentials."""
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parent / '.env'
DEFAULT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'


def parse_origins(value):
    """Credentialed CORS requires explicit origins, never a wildcard."""
    origins = []
    for entry in value.split(','):
        origin = entry.strip().rstrip('/')
        if not origin:
            continue
        try:
            parts = urlsplit(origin)
            valid = (
                parts.scheme in ('http', 'https') and parts.hostname
                and parts.username is None and parts.password is None
                and not parts.path and not parts.query and not parts.fragment
                and '*' not in origin and '\\' not in origin
                and not any(character.isspace() for character in origin)
            )
            # Accessing port also validates malformed/out-of-range port values.
            parts.port
        except ValueError:
            valid = False
        if not valid:
            raise ValueError('ALLOWED_ORIGINS must contain explicit HTTP(S) origins only.')
        origins.append(f'{parts.scheme}://{parts.netloc.lower()}')
    return tuple(dict.fromkeys(origins))


@dataclass(frozen=True)
class Settings:
    allowed_origins: tuple[str, ...]
    session_hours: int
    firebase_project_id: str
    login_rate_per_min: int = 5
    register_rate_per_hour: int = 5
    google_rate_per_min: int = 20
    login_lockout_failures: int = 10
    login_lockout_min: int = 15
    login_lockout_max_min: int = 60
    login_failure_window_min: int = 60
    admin_idle_min: int = 30
    require_verified_email: bool = False
    email_verification_hours: int = 24
    email_verification_rate_per_hour: int = 3
    public_base_url: str = 'http://localhost:8000'
    csp_mode: str = 'enforce'

    @property
    def session_seconds(self):
        return self.session_hours * 60 * 60


def load_settings(env_file=ENV_FILE):
    # Only backend/.env is loaded, independent of cwd. Deployment env wins.
    # Tests/production can disable file loading with PYTHON_DOTENV_DISABLED=1.
    load_dotenv(dotenv_path=env_file, override=False, encoding='utf-8-sig')
    try:
        hours = int(os.getenv('SESSION_HOURS', '24'))
    except ValueError:
        raise ValueError('SESSION_HOURS must be a positive integer.') from None
    if hours <= 0:
        raise ValueError('SESSION_HOURS must be a positive integer.')
    def positive(name, default):
        try:
            value = int(os.getenv(name, str(default)))
            if value > 0:
                return value
        except ValueError:
            pass
        raise ValueError(f'{name} must be a positive integer.')
    mode = os.getenv('CSP_MODE', 'enforce')
    if mode not in ('report-only', 'enforce'):
        raise ValueError('CSP_MODE must be report-only or enforce.')
    require_verified = os.getenv('REQUIRE_VERIFIED_EMAIL', 'false').lower()
    if require_verified not in ('true', 'false'):
        raise ValueError('REQUIRE_VERIFIED_EMAIL must be true or false.')
    base_url = os.getenv('PUBLIC_BASE_URL', 'http://localhost:8000').rstrip('/')
    if len(parse_origins(base_url)) != 1:
        raise ValueError('PUBLIC_BASE_URL must be one explicit HTTP(S) origin.')
    return Settings(
        allowed_origins=parse_origins(os.getenv('ALLOWED_ORIGINS', DEFAULT_ORIGINS)),
        session_hours=hours,
        firebase_project_id=os.getenv('FIREBASE_PROJECT_ID', '').strip(),
        login_rate_per_min=positive('LOGIN_RATE_PER_MIN', 5),
        register_rate_per_hour=positive('REGISTER_RATE_PER_HOUR', 5),
        google_rate_per_min=positive('GOOGLE_RATE_PER_MIN', 20),
        login_lockout_failures=positive('LOGIN_LOCKOUT_FAILURES', 10),
        login_lockout_min=positive('LOGIN_LOCKOUT_MIN', 15),
        login_lockout_max_min=positive('LOGIN_LOCKOUT_MAX_MIN', 60),
        login_failure_window_min=positive('LOGIN_FAILURE_WINDOW_MIN', 60),
        admin_idle_min=positive('ADMIN_IDLE_MIN', 30),
        require_verified_email=require_verified == 'true',
        email_verification_hours=positive('EMAIL_VERIFICATION_HOURS', 24),
        email_verification_rate_per_hour=positive('EMAIL_VERIFICATION_RATE_PER_HOUR', 3),
        public_base_url=base_url, csp_mode=mode,
    )
