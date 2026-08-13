import unittest
from urllib.parse import parse_qs, urlparse

from Server.auth import (
    build_auth_url,
    generate_oauth_state,
    oauth_state_matches,
)


class OAuthStateSecurityTests(unittest.TestCase):
    def test_generated_states_are_long_and_unique(self):
        first = generate_oauth_state()
        second = generate_oauth_state()

        self.assertGreaterEqual(len(first), 32)
        self.assertGreaterEqual(len(second), 32)
        self.assertNotEqual(first, second)

    def test_state_must_match_exactly(self):
        state = generate_oauth_state()

        self.assertTrue(oauth_state_matches(state, state))
        self.assertFalse(oauth_state_matches(state, state + "x"))
        self.assertFalse(oauth_state_matches(state, ""))
        self.assertFalse(oauth_state_matches(None, state))

    def test_auth_url_contains_the_supplied_state(self):
        state = generate_oauth_state()
        query = parse_qs(urlparse(build_auth_url(state)).query)

        self.assertEqual(query["state"], [state])

    def test_auth_url_requires_state(self):
        with self.assertRaises(ValueError):
            build_auth_url("")


if __name__ == "__main__":
    unittest.main()
