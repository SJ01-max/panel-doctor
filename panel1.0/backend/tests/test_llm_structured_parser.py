"""
LLM Structured Parser 테스트
"""
import unittest
from unittest.mock import Mock, patch
from app.services.llm.parser import LlmStructuredParser


class TestLlmStructuredParser(unittest.TestCase):
    """LLM 구조화 파서 테스트"""
    
    def setUp(self):
        self.parser = LlmStructuredParser()
    
    def test_parse_basic(self):
        """기본 파싱 테스트"""
        # 실제 LLM 호출은 하지 않고 구조만 확인
        # 실제 테스트는 통합 테스트에서 수행
        self.assertIsNotNone(self.parser)
    
    def test_extract_json(self):
        """JSON 추출 테스트"""
        text = '```json\n{"filters": {"age": "20s"}, "semantic_keywords": []}\n```'
        result = self.parser._extract_json(text)
        self.assertIn("filters", result)
        self.assertIn("semantic_keywords", result)
    
    def test_validate_and_normalize(self):
        """검증 및 정규화 테스트"""
        parsed = {
            "filters": {"age": "20s"},
            "semantic_keywords": ["운동"]
        }
        result = self.parser._validate_and_normalize(parsed)
        self.assertEqual(result["search_mode"], "auto")
        self.assertIn("intent", result)


if __name__ == '__main__':
    unittest.main()

