"""Email adapters never send real mail in tests."""
import os
from unittest.mock import MagicMock, patch

import pytest

from backend.email_delivery import EmailDeliveryUnavailable, send_email


def test_development_console_delivery_and_production_fails_closed(caplog):
    with patch.dict(os.environ, {}, clear=True):
        send_email('customer@example.test','Verification','public-test-verification-link')
    assert 'public-test-verification-link' in caplog.text
    caplog.clear()
    with patch.dict(os.environ, {'COOKIE_SECURE':'true'}, clear=True):
        with pytest.raises(EmailDeliveryUnavailable):
            send_email('customer@example.test','Verification','private-production-link')
    assert 'private-production-link' not in caplog.text


def test_smtp_uses_tls_auth_and_suppresses_provider_errors(caplog):
    env = {'SMTP_HOST':'smtp.example.test','SMTP_PORT':'587','SMTP_STARTTLS':'true',
           'SMTP_USERNAME':'public-fixture-user','SMTP_PASSWORD':'private-smtp-sentinel',
           'SMTP_FROM':'store@example.test'}
    smtp = MagicMock()
    with patch.dict(os.environ, env, clear=True), patch('backend.email_delivery.smtplib.SMTP') as factory, patch('backend.email_delivery.ssl.create_default_context') as tls_context:
        factory.return_value.__enter__.return_value = smtp
        send_email('customer@example.test','Verification','public-test-body')
    smtp.starttls.assert_called_once_with(context=tls_context.return_value)
    smtp.login.assert_called_once_with(env['SMTP_USERNAME'],env['SMTP_PASSWORD'])
    assert smtp.send_message.call_args.args[0]['From'] == 'store@example.test'
    with patch.dict(os.environ, env, clear=True), patch('backend.email_delivery.smtplib.SMTP',side_effect=RuntimeError('private-smtp-sentinel')):
        with pytest.raises(EmailDeliveryUnavailable) as error:
            send_email('customer@example.test','Verification','private-link')
    assert str(error.value) == 'Email could not be sent. Please try again later.'
    assert 'private-smtp-sentinel' not in caplog.text