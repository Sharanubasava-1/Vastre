"""Shared security policy; no credentials or provider exceptions are logged."""
import hashlib
import math
import time
from urllib.parse import urlsplit

from fastapi import HTTPException

RATE_MESSAGE = 'Too many attempts. Please wait a little and try again.'
COMMON_PASSWORDS = {'password123', 'password1234', '1234567890', '12345678901',
                    'qwerty12345', 'qwertyuiop', 'letmein123', 'admin123456', 'welcome123'}


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def peer_ip(request):
    return str(request.client.host)[:45] if request is not None and request.client else None


def audit(c, event, uid=None, request=None, detail=None):
    c.execute('INSERT INTO audit_log(ts,user_id,event,ip,detail) VALUES (?,?,?,?,?)',
              (int(time.time()), uid, event, peer_ip(request),detail))


def validate_password(password):
    if not isinstance(password, str) or not 10 <= len(password) <= 128:
        raise HTTPException(400, 'Use a password with 10 to 128 characters.')
    if password.casefold() in COMMON_PASSWORDS:
        raise HTTPException(400, 'Choose a less common password.')


def source_origin(value):
    try:
        parts = urlsplit(value)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
            return None
        port = parts.port
        host = parts.hostname.lower()
        if ':' in host:
            host = f'[{host}]'
        return f'{parts.scheme}://{host}' + (f':{port}' if port and port != (443 if parts.scheme == 'https' else 80) else '')
    except ValueError:
        return None


def csrf_allowed(request, settings):
    if request.headers.get('x-requested-with') != 'vastre':
        return False
    # A present but invalid/foreign Origin must never fall back to Referer.
    if 'origin' in request.headers:
        try:
            parts = urlsplit(request.headers['origin'])
            if parts.path or parts.query or parts.fragment:
                return False
        except ValueError:
            return False
    origin = source_origin(request.headers.get('origin', request.headers.get('referer', '')))
    allowed = {source_origin(value) for value in settings.allowed_origins}
    allowed.add(source_origin(str(request.base_url)))
    return origin is not None and origin in allowed


def rate_limit(c, key, limit, seconds):
    now = int(time.time())
    c.execute('DELETE FROM auth_limits WHERE expires<=?', (now,))
    row = c.execute('SELECT * FROM auth_limits WHERE key=?', (key,)).fetchone()
    if row is not None and row['hits'] >= limit:
        return max(1, row['expires'] - now)
    c.execute('''INSERT INTO auth_limits(key,hits,expires) VALUES (?,1,?)
                 ON CONFLICT(key) DO UPDATE SET hits=hits+1''', (key, now + seconds))
    return 0


def lockout_remaining(c, email, settings):
    now = int(time.time())
    c.execute('DELETE FROM auth_failures WHERE started<=? AND locked_until<=?',
              (now - settings.login_failure_window_min * 60, now))
    row = c.execute('SELECT locked_until FROM auth_failures WHERE key=?', (digest(email),)).fetchone()
    return max(0, row['locked_until'] - now) if row else 0


def record_failure(c, email, settings):
    key, now = digest(email), int(time.time())
    c.execute('''INSERT INTO auth_failures(key,failures,started,locked_until) VALUES (?,1,?,0)
                 ON CONFLICT(key) DO UPDATE SET failures=failures+1''', (key, now))
    count = c.execute('SELECT failures FROM auth_failures WHERE key=?', (key,)).fetchone()[0]
    if count % settings.login_lockout_failures == 0:
        multiplier = 2 ** min(10, count // settings.login_lockout_failures - 1)
        minutes = min(settings.login_lockout_max_min, settings.login_lockout_min * multiplier)
        c.execute('UPDATE auth_failures SET locked_until=? WHERE key=?', (now + minutes * 60, key))


def too_many(seconds):
    return HTTPException(429, RATE_MESSAGE, headers={'Retry-After': str(max(1, math.ceil(seconds)))})


def content_security_policy():
    google = 'https://apis.google.com https://accounts.google.com https://*.googleapis.com https://*.firebaseapp.com'
    razorpay = 'https://checkout.razorpay.com https://api.razorpay.com'
    return '; '.join([
        "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
        "form-action 'self'", f"script-src 'self' {google} {razorpay} https://cdn.razorpay.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https://images.unsplash.com https://source.unsplash.com https://*.googleusercontent.com https://*.razorpay.com",
        f"connect-src 'self' {google} {razorpay} https://lumberjack.razorpay.com https://*.googleusercontent.com",
        f"frame-src 'self' {google} {razorpay}",
        "worker-src 'self' blob:",
    ])


def security_headers(settings, secure):
    return {
        'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        ('Content-Security-Policy' if settings.csp_mode == 'enforce' else 'Content-Security-Policy-Report-Only'): content_security_policy(),
        **({'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'} if secure else {}),
    }
