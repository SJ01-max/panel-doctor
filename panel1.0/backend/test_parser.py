"""개선된 파서 테스트 스크립트"""
from dotenv import load_dotenv
load_dotenv()

from app.services.enhanced_query_parser import EnhancedQueryParser
import json

# 테스트 쿼리
test_queries = [
    "서울 경기에서 20대 남자 100명 추출해줘",
    "부산 30대 여성 중 운동 좋아하는 사람",
    "인천 거주 40대 이상 남성"
]

parser = EnhancedQueryParser()

print("=" * 60)
print("개선된 파서 테스트")
print("=" * 60)

for query in test_queries:
    print(f"\n질의: {query}")
    print("-" * 60)
    
    try:
        result = parser.parse(query)
        
        print(f"추출된 칩: {result.get('extracted_chips', [])}")
        print(f"필터: {json.dumps(result.get('filters', {}), indent=2, ensure_ascii=False)}")
        print(f"커버리지 점수: {result.get('coverage_score', 0):.2f}")
        
        if result.get('sql'):
            print(f"생성된 SQL: {result['sql'][:100]}...")
        
        if result.get('warnings'):
            print(f"경고: {result['warnings']}")
            
    except Exception as e:
        print(f"❌ 오류: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 60)
print("테스트 완료")
print("=" * 60)

