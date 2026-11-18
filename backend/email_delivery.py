"""Email delivery seam: development console or optional SMTP, never auth secrets."""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)


class EmailDeliveryUnavailable(Exception):
    pass


def send_email(to, subject, body):
    # Only verification emails belong here; never pass ID tokens/passwords/cookies.
    host = os.getenv('SMTP_HOST','').strip()
    if not host and os.getenv('COOKIE_SECURE') != 'true':
        logger.warning('Development email to %s: %s\n%s', to, subject, body)
        return
    try:
        if not host:
            raise ValueError()
        port = int(os.getenv('SMTP_PORT','587'))
        tls = os.getenv('SMTP_STARTTLS','true').lower()
        if tls not in ('true','false') or not 1 <= port <= 65535:
            raise ValueError()
        message = EmailMessage()
        message['To'], message['From'], message['Subject'] = to, os.getenv('SMTP_FROM','no-reply@vastre.example'), subject
        message.set_content(body)
        with smtplib.SMTP(host,port,timeout=10) as smtp:
            if tls == 'true':
                smtp.starttls(context=ssl.create_default_context())
            if os.getenv('SMTP_USERNAME'):
                smtp.login(os.environ['SMTP_USERNAME'],os.getenv('SMTP_PASSWORD',''))
            smtp.send_message(message)
    except Exception:
        # Do not leak SMTP credentials, addresses or provider error strings.
        raise EmailDeliveryUnavailable('Email could not be sent. Please try again later.') from None
