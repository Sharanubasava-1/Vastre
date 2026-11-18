"""Verify Firebase Google credentials without storing or logging raw tokens."""
import math
import time

from google.auth.transport.requests import Request
from google.oauth2 import id_token

FAILURE = 'Google sign-in failed. Please try again.'


class GoogleSignInFailed(Exception):
    """Safe public failure; deliberately contains no provider exception detail."""


def verify_google_token(token, project_id):
    try:
        if not project_id or not isinstance(token, str) or not token or len(token) > 16384:
            raise ValueError()
        claims = id_token.verify_firebase_token(token, Request(), audience=project_id)
        if not isinstance(claims, dict):
            raise ValueError()
        expiration = claims.get('exp')
        subject = claims.get('sub')
        email = claims.get('email')
        firebase = claims.get('firebase')
        if (
            claims.get('iss') != f'https://securetoken.google.com/{project_id}'
            or claims.get('aud') != project_id
            or isinstance(expiration, bool) or not isinstance(expiration, (int, float))
            or not math.isfinite(expiration) or expiration <= time.time()
            or not isinstance(firebase, dict) or firebase.get('sign_in_provider') != 'google.com'
            or claims.get('email_verified') is not True
            or not isinstance(subject, str) or not subject.strip() or len(subject) > 128
            or not isinstance(email, str) or not 3 <= len(email.strip()) <= 254
            or email.strip().count('@') != 1 or any(char.isspace() for char in email.strip())
        ):
            raise ValueError()
        name = claims.get('name')
        picture = claims.get('picture')
        return {
            'sub': subject, 'email': email.strip().lower(),
            'auth_time': claims.get('auth_time'),
            'name': name.strip()[:80] if isinstance(name, str) and name.strip() else 'Customer',
            'picture': picture if isinstance(picture, str) and picture.startswith('https://') and len(picture) <= 2048 else None,
        }
    except Exception:
        # No logging or exception chaining: provider messages may contain credentials.
        raise GoogleSignInFailed(FAILURE) from None
