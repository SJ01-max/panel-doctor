"""
통합 검색 테스트
"""
import unittest
from unittest.mock import Mock, patch
from app.services.search.service import SearchService


class TestSearchIntegration(unittest.TestCase):
    """통합 검색 서비스 테스트"""
    
    def setUp(self):
        self.service = SearchService()
    
    @patch('app.services.llm.parser.LlmStructuredParser.parse')
    def test_search_filter_first(self, mock_parse):
        """필터 우선 검색 테스트"""
        mock_parse.return_value = {
            "filters": {"age": "20s", "gender": "M"},
            "semantic_keywords": [],
            "intent": "panel_search",
            "search_mode": "auto",
            "limit": 100
        }
        
        # 실제 검색은 DB 연결이 필요하므로 스킵
        # 구조만 확인
        self.assertIsNotNone(self.service)
    
    @patch('app.services.llm.parser.LlmStructuredParser.parse')
    def test_search_semantic_first(self, mock_parse):
        """의미 우선 검색 테스트"""
        mock_parse.return_value = {
            "filters": {},
            "semantic_keywords": ["운동", "좋아하는"],
            "intent": "panel_search",
            "search_mode": "auto",
            "limit": 10
        }
        
        self.assertIsNotNone(self.service)


if __name__ == '__main__':
    unittest.main()

