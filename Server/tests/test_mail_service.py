import unittest
from unittest.mock import ANY, Mock

from Server.webapp.services import mail_service


class FakeSMTP:
    def __init__(self, **connection):
        self.connection = connection
        self.ehlo_calls = 0
        self.starttls_calls = 0
        self.login_call = None
        self.message = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def ehlo(self):
        self.ehlo_calls += 1

    def starttls(self, *, context):
        self.starttls_calls += 1
        self.tls_context = context

    def login(self, username, password):
        self.login_call = (username, password)

    def send_message(self, message):
        self.message = message


class MailServiceTests(unittest.TestCase):
    def _enabled_environment(self):
        return {
            "SMTP_ENABLED": "1",
            "SMTP_HOST": "smtp.example.test",
            "SMTP_PORT": "2525",
            "SMTP_SECURITY": "starttls",
            "SMTP_USERNAME": "mailer",
            "SMTP_PASSWORD": "test-secret",
            "SMTP_FROM_EMAIL": "performance@example.test",
            "SMTP_FROM_NAME": "Performance System",
            "SMTP_TIMEOUT_SECONDS": "7",
            "FRONTEND_LOGIN_URL": "https://performance.example.test/login",
        }

    def test_disabled_smtp_returns_disabled_without_network_attempt(self):
        smtp_factory = Mock()

        result = mail_service.send_access_approval_email(
            recipient_name="Ada Lovelace",
            recipient_email="ada@udec.cl",
            environment={"SMTP_ENABLED": "0"},
            smtp_factory=smtp_factory,
        )

        self.assertEqual(
            result,
            {"sent": False, "status": "DISABLED"},
        )
        smtp_factory.assert_not_called()

    def test_starttls_sends_transactional_approval_message(self):
        server = FakeSMTP()
        smtp_factory = Mock(return_value=server)

        result = mail_service.send_access_approval_email(
            recipient_name="Ada Lovelace",
            recipient_email="ada@udec.cl",
            environment=self._enabled_environment(),
            smtp_factory=smtp_factory,
        )

        self.assertEqual(
            result,
            {"sent": True, "status": "SENT"},
        )
        smtp_factory.assert_called_once_with(
            host="smtp.example.test",
            port=2525,
            timeout=7,
        )
        self.assertEqual(server.ehlo_calls, 2)
        self.assertEqual(server.starttls_calls, 1)
        self.assertEqual(
            server.login_call,
            ("mailer", "test-secret"),
        )
        self.assertEqual(server.message["To"], "ada@udec.cl")
        self.assertEqual(
            server.message["Subject"],
            "Performance System — solicitud de acceso aprobada",
        )
        body = server.message.get_content()
        self.assertIn("Ada Lovelace", body)
        self.assertIn("ada@udec.cl", body)
        self.assertIn(
            "https://performance.example.test/login",
            body,
        )
        self.assertNotIn("test-secret", body)

    def test_ssl_sends_and_authenticates_over_encrypted_connection(self):
        environment = self._enabled_environment()
        environment["SMTP_SECURITY"] = "ssl"
        server = FakeSMTP()
        smtp_factory = Mock()
        smtp_ssl_factory = Mock(return_value=server)

        result = mail_service.send_access_approval_email(
            recipient_name="Ada Lovelace",
            recipient_email="ada@udec.cl",
            environment=environment,
            smtp_factory=smtp_factory,
            smtp_ssl_factory=smtp_ssl_factory,
        )

        self.assertEqual(
            result,
            {"sent": True, "status": "SENT"},
        )
        smtp_factory.assert_not_called()
        smtp_ssl_factory.assert_called_once_with(
            host="smtp.example.test",
            port=2525,
            timeout=7,
            context=ANY,
        )
        self.assertEqual(server.starttls_calls, 0)
        self.assertEqual(
            server.login_call,
            ("mailer", "test-secret"),
        )
        self.assertEqual(server.message["To"], "ada@udec.cl")

    def test_none_sends_without_authentication(self):
        environment = self._enabled_environment()
        environment.update(
            {
                "SMTP_SECURITY": "none",
                "SMTP_USERNAME": "",
                "SMTP_PASSWORD": "",
            }
        )
        server = FakeSMTP()
        smtp_factory = Mock(return_value=server)
        smtp_ssl_factory = Mock()

        result = mail_service.send_access_approval_email(
            recipient_name="Ada Lovelace",
            recipient_email="ada@udec.cl",
            environment=environment,
            smtp_factory=smtp_factory,
            smtp_ssl_factory=smtp_ssl_factory,
        )

        self.assertEqual(
            result,
            {"sent": True, "status": "SENT"},
        )
        smtp_factory.assert_called_once_with(
            host="smtp.example.test",
            port=2525,
            timeout=7,
        )
        smtp_ssl_factory.assert_not_called()
        self.assertEqual(server.ehlo_calls, 0)
        self.assertEqual(server.starttls_calls, 0)
        self.assertIsNone(server.login_call)
        self.assertEqual(server.message["To"], "ada@udec.cl")

    def test_none_with_credentials_fails_without_network_attempt(self):
        environment = self._enabled_environment()
        environment["SMTP_SECURITY"] = "none"
        smtp_factory = Mock()
        smtp_ssl_factory = Mock()

        with self.assertLogs(mail_service.LOGGER, level="WARNING"):
            result = mail_service.send_access_approval_email(
                recipient_name="Ada Lovelace",
                recipient_email="ada@udec.cl",
                environment=environment,
                smtp_factory=smtp_factory,
                smtp_ssl_factory=smtp_ssl_factory,
            )

        self.assertEqual(
            result,
            {"sent": False, "status": "FAILED"},
        )
        smtp_factory.assert_not_called()
        smtp_ssl_factory.assert_not_called()

    def test_smtp_exception_is_sanitized_as_failed_result(self):
        smtp_factory = Mock(
            side_effect=OSError("connection refused")
        )

        with self.assertLogs(mail_service.LOGGER, level="WARNING") as logs:
            result = mail_service.send_access_approval_email(
                recipient_name="Ada Lovelace",
                recipient_email="ada@udec.cl",
                environment=self._enabled_environment(),
                smtp_factory=smtp_factory,
            )

        self.assertEqual(
            result,
            {"sent": False, "status": "FAILED"},
        )
        self.assertNotIn("smtp.example.test", " ".join(logs.output))
        self.assertNotIn("test-secret", " ".join(logs.output))

    def test_incomplete_enabled_configuration_fails_without_network(self):
        smtp_factory = Mock()

        with self.assertLogs(mail_service.LOGGER, level="WARNING"):
            result = mail_service.send_access_approval_email(
                recipient_name="Ada Lovelace",
                recipient_email="ada@udec.cl",
                environment={"SMTP_ENABLED": "1"},
                smtp_factory=smtp_factory,
            )

        self.assertEqual(
            result,
            {"sent": False, "status": "FAILED"},
        )
        smtp_factory.assert_not_called()


if __name__ == "__main__":
    unittest.main()
