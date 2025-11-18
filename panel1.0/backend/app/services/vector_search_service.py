"""벡터DB 기반 의미 검색 서비스 (KURE v1 임베딩 전용)"""
from typing import List, Dict, Any, Optional
import os
from app.services.sql_service import execute_sql_safe
from app.services.llm_service import LlmService

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[ERROR] sentence-transformers 라이브러리가 설치되지 않았습니다. pip install sentence-transformers 실행 필요")


class VectorSearchService:
    """
    벡터DB를 사용한 의미 기반 검색 서비스
    
    KURE v1 임베딩 모델만 사용합니다 (1024 차원).
    DB에 저장된 임베딩과 동일한 모델을 사용하여 검색 정확도를 보장합니다.
    """
    
    def __init__(self):
        self.llm_service = LlmService()
        self.local_embedding_model = None
        
        # KURE v1 모델 (1024 차원) - 한국어 특화 임베딩 모델
        # 환경변수 LOCAL_EMBEDDING_MODEL로 변경 가능 (기본값: nlpai-lab/KURE-v1)
        self.local_model_name = os.environ.get("LOCAL_EMBEDDING_MODEL", "nlpai-lab/KURE-v1")
        
        # DB에서 임베딩 차원 자동 감지 (먼저 실행)
        self.db_embedding_dimension = self._detect_db_embedding_dimension()
        
        if self.db_embedding_dimension:
            print(f"[INFO] DB 임베딩 차원 감지: {self.db_embedding_dimension}차원")
        
        # 로컬 모델 로딩
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                print(f"[INFO] 로컬 임베딩 모델 로딩 중: {self.local_model_name}")
                # device 설정 및 모델 로딩
                import torch
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
                print(f"   사용 디바이스: {device}")
                
                # 모델 로딩 (trust_remote_code=True로 설정하여 커스텀 모델 지원)
                self.local_embedding_model = SentenceTransformer(
                    self.local_model_name,
                    device=device,
                    trust_remote_code=True
                )
                
                local_dim = self.local_embedding_model.get_sentence_embedding_dimension()
                print(f"[OK] 로컬 임베딩 모델 초기화 완료 (모델: {self.local_model_name}, 차원: {local_dim})")
                
                if self.db_embedding_dimension and local_dim != self.db_embedding_dimension:
                    print(f"[WARN] 경고: DB 임베딩 차원({self.db_embedding_dimension})과 로컬 모델 차원({local_dim})이 다릅니다!")
                    print(f"   [WARN] 차원 불일치로 인해 검색 정확도가 떨어질 수 있습니다.")
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"[ERROR] 로컬 임베딩 모델 로딩 실패: {e}")
                print(f"   상세 오류:\n{error_trace}")
                # 모델이 없을 경우 다른 모델 시도하지 않음 (명시적으로 실패 처리)
        else:
            raise RuntimeError("sentence-transformers 라이브러리가 설치되지 않았습니다. pip install sentence-transformers torch 실행 필요")
        
        if not self.local_embedding_model:
            raise RuntimeError(f"KURE v1 임베딩 모델({self.local_model_name}) 로딩에 실패했습니다. 임베딩 서비스를 사용할 수 없습니다.")
    
    def _detect_db_embedding_dimension(self) -> Optional[int]:
        """
        DB에 저장된 임베딩의 차원을 자동으로 감지합니다.
        core.doc_embedding 테이블의 embedding 컬럼 차원을 확인합니다.
        """
        try:
            result = execute_sql_safe(
                query="""
                    SELECT embedding::text as embedding_str
                    FROM core.doc_embedding
                    WHERE embedding IS NOT NULL
                    LIMIT 1
                """,
                limit=1
            )
            
            if result and result[0].get('embedding_str'):
                embedding_str = result[0]['embedding_str']
                embedding_str = embedding_str.strip('[]')
                if embedding_str:
                    dimension = len(embedding_str.split(','))
                    return dimension
            return None
        except Exception as e:
            print(f"[ERROR] DB 임베딩 차원 감지 실패: {e}")
            return None
    
    def get_query_embedding(self, query_text: str) -> Optional[List[float]]:
        """
        질의 텍스트를 임베딩 벡터로 변환
        로컬 sentence-transformers 모델 사용
        """
        if not query_text or not query_text.strip():
            return None
        
        # 로컬 임베딩 모델 사용
        if self.local_embedding_model:
            try:
                embedding = self.local_embedding_model.encode(query_text.strip()).tolist()
                return embedding
            except Exception as e:
                print(f"[ERROR] 로컬 임베딩 생성 실패: {e}")
                return None
        
        # 모델이 없으면 None 반환 (텍스트 기반 검색으로 폴백)
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
            
            # 벡터 유사도 검색 (core.doc_embedding 테이블 사용)
            # 실제 테이블 구조: doc_id, model_name, created_at, embedding
            results = execute_sql_safe(
                query="""
                    SELECT 
                        doc_id as id,
                        model_name as content,
                        1 - (embedding <=> %(query_vector)s::vector) AS similarity
                    FROM core.doc_embedding
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
            # model_name에서 키워드 검색 (실제 테이블 구조에 맞게)
            keywords = query_text.split()
            keyword_conditions = " OR ".join([
                f"model_name ILIKE %(keyword_{i})s" 
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
                        doc_id as id,
                        model_name as content,
                        0.8 AS similarity  -- 텍스트 검색은 고정 유사도
                    FROM core.doc_embedding
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
            
            # id에서 패널 ID 추출
            # id 형식에 따라 파싱 필요 (예: "panel_12345" 또는 직접 패널 ID)
            for doc in similar_docs:
                doc_id = doc.get('id', '') or doc.get('doc_id', '') or doc.get('document_id', '')
                # id가 패널 ID인 경우 직접 사용
                if doc_id:
                    panel_ids.append(str(doc_id))
        
        # 중복 제거
        return list(set(panel_ids))
    
    def execute_semantic_search_sql(
        self,
        sql_query: str,
        embedding_input: str,
        embedding_model: str = None  # 사용하지 않음 (로컬 모델만 사용)
    ) -> List[Dict[str, Any]]:
        """
        SQL 쿼리의 <VECTOR> 플레이스홀더를 실제 임베딩 벡터로 교체하고 실행합니다.
        
        Args:
            sql_query: <VECTOR> 플레이스홀더가 포함된 SQL 쿼리
            embedding_input: 임베딩할 텍스트
            embedding_model: 사용하지 않음 (로컬 모델만 사용)
            
        Returns:
            SQL 실행 결과
        """
        # 로컬 모델로 임베딩 생성
        if not self.local_embedding_model:
            raise RuntimeError("임베딩 모델이 초기화되지 않았습니다. sentence-transformers를 설치하세요.")
        
        try:
            embedding = self.local_embedding_model.encode(embedding_input.strip()).tolist()
        except Exception as e:
            raise RuntimeError(f"로컬 임베딩 생성 실패: {str(e)}")
        
        # 벡터를 PostgreSQL vector 타입 문자열로 변환
        vector_str = '[' + ','.join(str(v) for v in embedding) + ']'
        
        # SQL 실행 (semantic search는 직접 DB 연결 사용)
        # execute_sql_safe는 벡터 값이 포함된 SQL을 검증하지 못하므로 직접 실행
        try:
            from app.db.connection import get_db_connection, return_db_connection
            import re
            
            # 기본적인 SELECT 검증만 수행
            normalized_sql = sql_query.strip().lower()
            if not normalized_sql.startswith('select'):
                raise ValueError("SELECT 쿼리만 허용됩니다.")
            
            # 성능 최적화: LIMIT 보장 및 쿼리 구조 개선
            working_sql = sql_query.strip()
            
            # 1. 모든 임계값 필터링 제거 (distance < X, 1 - distance > X 등)
            # 다양한 패턴 제거
            threshold_patterns = [
                r'WHERE\s+1\s*-\s*\([^)]+embedding[^)]+\)\s*>\s*[\d.]+',
                r'WHERE\s+\([^)]+embedding[^)]+\)\s*<\s*[\d.]+',
                r'WHERE\s+distance\s*<\s*[\d.]+',
                r'WHERE\s+distance\s*>\s*[\d.]+',
                r'AND\s+1\s*-\s*\([^)]+embedding[^)]+\)\s*>\s*[\d.]+',
                r'AND\s+\([^)]+embedding[^)]+\)\s*<\s*[\d.]+',
                r'AND\s+distance\s*[<>=]+\s*[\d.]+',
            ]
            
            for pattern in threshold_patterns:
                working_sql = re.sub(pattern, '', working_sql, flags=re.IGNORECASE)
            
            # WHERE가 비어있거나 AND만 남으면 정리
            working_sql = re.sub(r'WHERE\s+AND\s+', 'WHERE ', working_sql, flags=re.IGNORECASE)
            working_sql = re.sub(r'WHERE\s+ORDER\s+BY', 'ORDER BY', working_sql, flags=re.IGNORECASE)
            working_sql = re.sub(r'\s+AND\s+ORDER\s+BY', ' ORDER BY', working_sql, flags=re.IGNORECASE)
            
            # 2. ORDER BY distance 보장 (없으면 추가)
            if 'ORDER BY' not in working_sql.upper():
                # SELECT ... FROM ... JOIN ... 끝에 ORDER BY distance 추가
                working_sql = re.sub(
                    r'(FROM\s+core\.doc_embedding_view[^;]+JOIN[^;]+)(\s*;)?$',
                    r'\1 ORDER BY distance',
                    working_sql,
                    flags=re.IGNORECASE | re.MULTILINE | re.DOTALL
                )
                print(f"[INFO] ORDER BY distance 추가됨")
            
            # 3. LIMIT 10 강제 보장 (가장 중요!)
            # 기존 LIMIT 제거 후 항상 LIMIT 10 추가
            working_sql = re.sub(r'\s+LIMIT\s+\d+', '', working_sql, flags=re.IGNORECASE)
            
            # ORDER BY distance 뒤에 LIMIT 10 추가
            if 'ORDER BY' in working_sql.upper():
                # ORDER BY distance ... 끝에 LIMIT 10 추가
                working_sql = re.sub(
                    r'(ORDER\s+BY[^;]+?)(\s*;)?$',
                    r'\1 LIMIT 10\2',
                    working_sql,
                    flags=re.IGNORECASE | re.MULTILINE | re.DOTALL
                )
                print(f"[INFO] LIMIT 10 강제 추가됨")
            else:
                # ORDER BY가 없으면 끝에 추가 (비정상 케이스)
                working_sql = f"{working_sql.rstrip(';')} LIMIT 10;"
                print(f"[WARN] ORDER BY가 없어 LIMIT만 추가됨")
            
            # 4. WHERE 절이 ORDER BY 전에 오는지 확인 (hybrid 쿼리)
            # WHERE가 ORDER BY 뒤에 있으면 앞으로 이동
            if re.search(r'ORDER\s+BY.*WHERE', working_sql, re.IGNORECASE | re.DOTALL):
                print(f"[WARN] WHERE 절이 ORDER BY 뒤에 있습니다. 쿼리 구조를 확인하세요.")
            
            # 5. <VECTOR> 플레이스홀더를 실제 벡터로 교체
            final_sql = working_sql.replace('<VECTOR>', vector_str)
            
            # 6. 최종 SQL 검증
            if 'LIMIT 10' not in final_sql.upper():
                raise ValueError("LIMIT 10이 SQL에 없습니다. 쿼리 생성 실패.")
            
            if 'ORDER BY' not in final_sql.upper():
                raise ValueError("ORDER BY가 SQL에 없습니다. 쿼리 생성 실패.")
            
            # 7. 쿼리 실행 (성능 최적화)
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    # statement_timeout 설정 (20초 - HNSW 인덱스 사용 시 충분)
                    cur.execute("SET LOCAL statement_timeout = 20000;")
                    
                    # 쿼리 실행 시간 측정
                    import time
                    start_time = time.time()
                    
                    # 디버깅: 실행할 SQL 로그 출력
                    print(f"[DEBUG] 최종 SQL: {final_sql[:400]}...")
                    
                    cur.execute(final_sql)
                    columns = [desc[0] for desc in cur.description]
                    
                    # 결과 가져오기
                    rows = cur.fetchall()
                    
                    execution_time = time.time() - start_time
                    
                    # 느린 쿼리 로깅
                    if execution_time > 1.0:
                        print(f"[WARN] 느린 쿼리 감지: {execution_time:.2f}초")
                        print(f"[WARN] SQL: {final_sql[:500]}")
                    
                    results = [dict(zip(columns, row)) for row in rows]
                    print(f"[INFO] 검색 완료: {len(results)}개 결과 ({execution_time:.3f}초)")
                    
                    return results
            finally:
                return_db_connection(conn)
        except Exception as e:
            raise RuntimeError(f"SQL 실행 실패: {str(e)}")

