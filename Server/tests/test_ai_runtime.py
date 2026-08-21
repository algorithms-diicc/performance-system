import tempfile
import unittest

from Server.webapp.services.ai_runtime import (
    AIInvalidLanguageError,
    AIProviderError,
    build_ai_context_hash,
    build_provider_shaped_response,
    normalize_ai_language,
    parse_openai_structured_output,
    read_valid_ai_cache,
    write_ai_cache,
)


class AIRuntimeTests(unittest.TestCase):
    def test_language_normalization_is_shared_es_en_contract(self):
        self.assertEqual(normalize_ai_language("es-CL"), "es")
        self.assertEqual(normalize_ai_language("en_US"), "en")

        with self.assertRaises(AIInvalidLanguageError):
            normalize_ai_language("fr")

    def test_provider_envelope_round_trip_uses_real_parser_contract(self):
        content = {
            "summary": "evidence-backed",
            "items": [{"metric": "DurationTime"}],
        }

        response = build_provider_shaped_response(content)

        self.assertEqual(
            parse_openai_structured_output(response),
            content,
        )

    def test_parser_rejects_incomplete_and_refusal(self):
        with self.assertRaises(AIProviderError):
            parse_openai_structured_output(
                {"status": "incomplete"}
            )

        with self.assertRaises(AIProviderError):
            parse_openai_structured_output(
                {
                    "status": "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {
                                    "type": "refusal",
                                    "refusal": "no",
                                }
                            ],
                        }
                    ],
                }
            )

    def test_context_hash_separates_schema_prompt_mode_and_language(self):
        base = dict(
            context={"metrics": {"DurationTime": 1}},
            prompt_version="prompt-a",
            schema_version="1.0",
            model="model-a",
            provider="mock",
            transport_mode="mock",
            language="es",
        )

        original = build_ai_context_hash(**base)

        for key, value in (
            ("prompt_version", "prompt-b"),
            ("schema_version", "2.0"),
            ("model", "model-b"),
            ("provider", "openai"),
            ("transport_mode", "openai"),
            ("language", "en"),
        ):
            changed = dict(base)
            changed[key] = value
            self.assertNotEqual(
                original,
                build_ai_context_hash(**changed),
                msg=key,
            )

    def test_cache_requires_full_runtime_identity(self):
        payload = {
            "schema_version": "1.0",
            "prompt_version": "prompt-a",
            "model": "model-a",
            "provider": "mock",
            "transport_mode": "mock",
            "language": "es",
            "context_hash": "abc",
            "content": {"summary": "x"},
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            path = temp_dir + "/cache.json"
            write_ai_cache(path, payload)

            cached = read_valid_ai_cache(
                cache_path=path,
                context_hash="abc",
                schema_version="1.0",
                prompt_version="prompt-a",
                model="model-a",
                provider="mock",
                transport_mode="mock",
                language="es",
            )
            self.assertEqual(cached["content"]["summary"], "x")

            stale = read_valid_ai_cache(
                cache_path=path,
                context_hash="abc",
                schema_version="2.0",
                prompt_version="prompt-a",
                model="model-a",
                provider="mock",
                transport_mode="mock",
                language="es",
            )
            self.assertIsNone(stale)


if __name__ == "__main__":
    unittest.main()
