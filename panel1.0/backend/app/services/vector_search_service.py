"""벡터DB 기반 의미 검색 서비스"""
from typing import List, Dict, Any, Optional
from app.services.sql_service import execute_sql_safe
from app.services.llm_service import LlmService


class VectorSearchService:
    """벡터DB를 사용한 의미 기반 검색"""
    
    def __init__(self):
        self.llm_service = LlmService()
    
    def get_query_embedding(self, query_text: str) -> Optional[List[float]]:
        """
        질의 텍스트를 임베딩 벡터로 변환
        TODO: 실제 임베딩 API 연동 (OpenAI, Anthropic 등)
        현재는 플레이스홀더
        """
        # 실제 구현 시 임베딩 API 호출
        # 예: OpenAI embeddings API 또는 Anthropic embeddings
        # 임시로 None 반환 (벡터DB가 설정되지 않은 경우 대비)
        return None
    
    def search_similar_documents(
        self, 
        query_text: str, 
        threshold: float = 0.7,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        벡터DB에서 유사한 문서 검색
        
        Args:
            query_text: 검색할 텍스트
            threshold: 유사도 임계값 (0.0 ~ 1.0)
            limit: 반환할 최대 문서 수
            
        Returns:
            유사한 문서 목록 (document_id, text_content, similarity 포함)
        """
        try:
            # 임베딩 벡터 가져오기
            query_embedding = self.get_query_embedding(query_text)
            
            if not query_embedding:
                # 임베딩을 생성할 수 없으면 텍스트 기반 검색으로 폴백
                return self._text_based_search(query_text, limit)
            
            # 벡터를 PostgreSQL vector 타입 문자열로 변환
            vector_str = '[' + ','.join(str(v) for v in query_embedding) + ']'
            
            # 벡터 유사도 검색
            results = execute_sql_safe(
                query="""
                    SELECT 
                        document_id,
                        text_content,
                        1 - (embedding <=> %(query_vector)s::vector) AS similarity,
                        metadata
                    FROM embeddings.document_embeddings
                    WHERE 1 - (embedding <=> %(query_vector)s::vector) > %(threshold)s
                    ORDER BY embedding <=> %(query_vector)s::vector
                    LIMIT %(limit)s
                """,
                params={
                    'query_vector': vector_str,
                    'threshold': threshold,
                    'limit': limit
                },
                limit=limit
            )
            
            return results
            
        except Exception as e:
            print(f"벡터 검색 오류: {e}")
            # 오류 시 텍스트 기반 검색으로 폴백
            return self._text_based_search(query_text, limit)
    
    def _text_based_search(self, query_text: str, limit: int) -> List[Dict[str, Any]]:
        """
        벡터 검색이 불가능할 때 텍스트 기반 검색으로 폴백
        """
        try:
            # 텍스트 내용에서 키워드 검색
            keywords = query_text.split()
            keyword_conditions = " OR ".join([
                f"text_content ILIKE %(keyword_{i})s" 
                for i in range(len(keywords))
            ])
            
            params = {
                f'keyword_{i}': f'%{kw}%'
                for i, kw in enumerate(keywords)
            }
            params['limit'] = limit
            
            results = execute_sql_safe(
                query=f"""
                    SELECT 
                        document_id,
                        text_content,
                        0.8 AS similarity,  -- 텍스트 검색은 고정 유사도
                        metadata
                    FROM embeddings.document_embeddings
                    WHERE {keyword_conditions}
                    LIMIT %(limit)s
                """,
                params=params,
                limit=limit
            )
            
            return results
            
        except Exception as e:
            print(f"텍스트 기반 검색 오류: {e}")
            return []
    
    def extract_panel_ids_from_semantic_search(
        self, 
        query_text: str,
        semantic_keywords: List[str]
    ) -> List[str]:
        """
        의미 기반 검색을 통해 패널 ID 추출
        
        Args:
            query_text: 원본 질의
            semantic_keywords: 의미 검색이 필요한 키워드 리스트 (예: ['운동 좋아함', '아웃도어 취미'])
            
        Returns:
            조건에 맞는 패널 ID 목록
        """
        panel_ids = []
        
        for keyword in semantic_keywords:
            # 벡터DB에서 유사한 문서 검색
            similar_docs = self.search_similar_documents(keyword, threshold=0.7, limit=100)
            
            # document_id에서 패널 ID 추출
            # document_id 형식에 따라 파싱 필요 (예: "panel_12345" 또는 직접 패널 ID)
            for doc in similar_docs:
                doc_id = doc.get('document_id', '')
                # document_id가 패널 ID인 경우 직접 사용
                # 또는 metadata에서 패널 ID 추출
                if doc_id:
                    panel_ids.append(doc_id)
                elif doc.get('metadata'):
                    metadata = doc.get('metadata', {})
                    if isinstance(metadata, dict):
                        panel_id = metadata.get('panel_id') or metadata.get('respondent_id')
                        if panel_id:
                            panel_ids.append(str(panel_id))
        
        # 중복 제거
        return list(set(panel_ids))

