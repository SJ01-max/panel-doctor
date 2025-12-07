"""
검색 전략 선택기 테스트
"""
import unittest
from app.services.search.strategy.selector import StrategySelector


class TestStrategySelector(unittest.TestCase):
    """검색 전략 선택기 테스트"""
    
    def test_filter_only(self):
        """필터만 있는 경우 → filter_first"""
        parsed = {
            "filters": {"age": "20s", "gender": "M"},
            "semantic_keywords": []
        }
        strategy = StrategySelector.select_search_mode(parsed)
        self.assertEqual(strategy, "filter_first")
    
    def test_semantic_only(self):
        """의미 키워드만 있는 경우 → semantic_first"""
        parsed = {
            "filters": {},
            "semantic_keywords": ["운동", "좋아하는"]
        }
        strategy = StrategySelector.select_search_mode(parsed)
        self.assertEqual(strategy, "semantic_first")
    
    def test_hybrid(self):
        """필터 + 의미 키워드 모두 있는 경우 → hybrid"""
        parsed = {
            "filters": {"age": "30s", "gender": "F"},
            "semantic_keywords": ["운동", "좋아하는"]
        }
        strategy = StrategySelector.select_search_mode(parsed)
        self.assertEqual(strategy, "hybrid")
    
    def test_empty(self):
        """둘 다 없는 경우 → filter_first (기본값)"""
        parsed = {
            "filters": {},
            "semantic_keywords": []
        }
        strategy = StrategySelector.select_search_mode(parsed)
        self.assertEqual(strategy, "filter_first")


if __name__ == '__main__':
    unittest.main()

