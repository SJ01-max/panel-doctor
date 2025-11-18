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
        embedding_model: str = None,  # 사용하지 않음 (로컬 모델만 사용)
        limit: int | None = 10,  # LIMIT 값 (기본값 10, None이면 LIMIT 없음)
        distance_threshold: float | None = None  # 유사도 임계값 (None이면 필터링 없음, distance < threshold인 결과만 반환)
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
            
            # 3. LIMIT 설정 (파라미터로 받은 limit 값 사용)
            # 디버깅: LIMIT 처리 전 SQL 확인
            print(f"[DEBUG] LIMIT 처리 전 SQL: {working_sql[:300]}...")
            print(f"[DEBUG] 설정할 LIMIT 값: {limit} (None이면 LIMIT 없음)")
            
            # 기존 LIMIT 모두 제거 (간단한 방법)
            # ORDER BY distance LIMIT 10 -> ORDER BY distance 로 변경
            working_sql = re.sub(
                r'\s+LIMIT\s+\d+',
                '',
                working_sql,
                flags=re.IGNORECASE
            )
            
            print(f"[DEBUG] LIMIT 제거 후 SQL: {working_sql[:300]}...")
            
            # LIMIT이 None이 아니면 ORDER BY 뒤에 LIMIT 추가
            if limit is not None:
                # ORDER BY 뒤에 LIMIT 추가 (더 유연한 패턴 매칭)
                if 'ORDER BY' in working_sql.upper():
                    # ORDER BY 뒤에 LIMIT이 없으면 추가
                    # ORDER BY distance, ORDER BY e.embedding <=> '<VECTOR>' 등 모든 패턴 지원
                    if 'LIMIT' not in working_sql.upper():
                        # 세미콜론이 있으면 제거하고 LIMIT 추가
                        working_sql = re.sub(
                            r'(ORDER\s+BY[^;]+?)(\s*;)?$',
                            f'\\1 LIMIT {limit}',
                            working_sql,
                            flags=re.IGNORECASE | re.MULTILINE | re.DOTALL
                        )
                        # 끝에 세미콜론 추가 (없으면)
                        if not working_sql.rstrip().endswith(';'):
                            working_sql = working_sql.rstrip() + ';'
                        print(f"[INFO] LIMIT {limit} 강제 추가됨")
                        print(f"[DEBUG] LIMIT 추가 후 SQL: {working_sql[:300]}...")
                    else:
                        print(f"[INFO] LIMIT이 이미 존재함")
                else:
                    # ORDER BY가 없으면 끝에 추가 (비정상 케이스)
                    working_sql = f"{working_sql.rstrip(';')} LIMIT {limit};"
                    print(f"[WARN] ORDER BY가 없어 LIMIT만 추가됨")
            else:
                # LIMIT이 None이면 LIMIT 없이 실행 (전체 결과 반환)
                print(f"[INFO] LIMIT 없음 - 전체 결과 반환")
                # 세미콜론만 추가 (없으면)
                if not working_sql.rstrip().endswith(';'):
                    working_sql = working_sql.rstrip() + ';'
            
            # 4. WHERE 절이 ORDER BY 전에 오는지 확인 (hybrid 쿼리)
            # WHERE가 ORDER BY 뒤에 있으면 앞으로 이동
            if re.search(r'ORDER\s+BY.*WHERE', working_sql, re.IGNORECASE | re.DOTALL):
                print(f"[WARN] WHERE 절이 ORDER BY 뒤에 있습니다. 쿼리 구조를 확인하세요.")
            
            # 5. JOIN 구조 검증 (필수, 더 유연하게)
            sql_normalized = working_sql.lower().replace(' ', '').replace('\n', '').replace('\t', '')
            
            print(f"[DEBUG] JOIN 검증 - 정규화된 SQL 시작 부분: {sql_normalized[:200]}...")
            
            if 'core.doc_embedding_view' not in sql_normalized or 'core.doc_embedding' not in sql_normalized:
                raise ValueError("SQL에 필수 JOIN 구조가 없습니다. core.doc_embedding_view와 core.doc_embedding JOIN이 필요합니다.")
            
            # 기본 JOIN 패턴 확인 (더 유연하게)
            has_join = (
                'joincore.doc_embedding' in sql_normalized and
                'v.doc_id' in sql_normalized and
                'e.doc_id' in sql_normalized
            )
            
            # 또는 더 일반적인 패턴: JOIN이 있고 doc_id로 연결
            has_join_alternative = (
                'join' in sql_normalized and
                'core.doc_embedding' in sql_normalized and
                'v.doc_id' in sql_normalized and
                'e.doc_id' in sql_normalized
            )
            
            print(f"[DEBUG] JOIN 검증 결과 - has_join: {has_join}, has_join_alternative: {has_join_alternative}")
            
            if not has_join and not has_join_alternative:
                # 더 유연한 검증: JOIN이 있고 doc_id로 연결되면 OK
                has_join_pattern = (
                    'join' in sql_normalized and
                    'core.doc_embedding' in sql_normalized and
                    ('doc_id' in sql_normalized or 'docid' in sql_normalized)
                )
                
                print(f"[DEBUG] JOIN 검증 - has_join_pattern: {has_join_pattern}")
                
                if not has_join_pattern:
                    print(f"[WARN] JOIN 조건이 명확하지 않습니다. 원본 SQL: {working_sql[:300]}...")
                    # JOIN이 없으면 추가 시도
                    if 'fromcore.doc_embedding_viewv' in sql_normalized or 'fromcore.doc_embedding_view' in sql_normalized:
                        # JOIN 절이 빠진 경우 자동 추가 시도
                        working_sql = re.sub(
                            r'(FROM\s+core\.doc_embedding_view\s+v)(\s+WHERE|\s+ORDER)',
                            r'\1 JOIN core.doc_embedding e ON v.doc_id = e.doc_id\2',
                            working_sql,
                            flags=re.IGNORECASE,
                            count=1
                        )
                        print(f"[INFO] JOIN 절 자동 추가됨")
                    else:
                        # 더 자세한 오류 메시지
                        print(f"[ERROR] JOIN 구조 분석:")
                        print(f"  - 'join' in SQL: {'join' in sql_normalized}")
                        print(f"  - 'core.doc_embedding' in SQL: {'core.doc_embedding' in sql_normalized}")
                        print(f"  - 'v.doc_id' in SQL: {'v.doc_id' in sql_normalized}")
                        print(f"  - 'e.doc_id' in SQL: {'e.doc_id' in sql_normalized}")
                        print(f"  - 원본 SQL: {working_sql[:500]}")
                        raise ValueError("SQL에 올바른 JOIN 구조가 없습니다. 'FROM core.doc_embedding_view v JOIN core.doc_embedding e ON v.doc_id = e.doc_id'가 필요합니다.")
            else:
                print(f"[INFO] JOIN 구조 검증 통과")
            
            # 6. <VECTOR> 플레이스홀더 검증 및 교체
            if '<VECTOR>' not in working_sql:
                raise ValueError("SQL에 <VECTOR> 플레이스홀더가 없습니다.")
            
            # <VECTOR>가 올바른 위치에 있는지 확인 (embedding <=> '<VECTOR>'::vector)
            if "embedding <=> '<VECTOR>'::vector" not in working_sql.replace(' ', '').lower():
                print(f"[WARN] <VECTOR> 플레이스홀더 위치가 예상과 다를 수 있습니다.")
            
            final_sql = working_sql.replace('<VECTOR>', vector_str)
            
            # 6-1. 유사도 임계값 적용 (COUNT 쿼리인 경우)
            if distance_threshold is not None:
                # WHERE 절에 벡터 거리 조건 추가
                # PostgreSQL에서는 SELECT 절의 별칭(distance)을 WHERE 절에서 직접 사용할 수 없으므로
                # 직접 벡터 거리를 계산해야 함: e.embedding <=> '<VECTOR>'::vector < threshold
                # 벡터 문자열을 추출 (이미 <VECTOR>가 vector_str로 교체됨)
                # 벡터 문자열의 작은따옴표를 이스케이프 처리
                vector_str_escaped = vector_str.replace("'", "''")
                
                if 'WHERE' in final_sql.upper():
                    # 기존 WHERE 절이 있으면 AND로 추가
                    # 벡터 거리 계산식을 직접 사용
                    where_condition = f" AND e.embedding <=> '{vector_str_escaped}'::vector < {distance_threshold}"
                    final_sql = re.sub(
                        r'(WHERE\s+[^O]+?)(\s+ORDER\s+BY)',
                        r'\1' + where_condition + r'\2',
                        final_sql,
                        flags=re.IGNORECASE | re.DOTALL,
                        count=1
                    )
                else:
                    # WHERE 절이 없으면 추가
                    # 벡터 거리 계산식을 직접 사용
                    where_condition = f" WHERE e.embedding <=> '{vector_str_escaped}'::vector < {distance_threshold}"
                    final_sql = re.sub(
                        r'(\s+ORDER\s+BY\s+distance)',
                        where_condition + r'\1',
                        final_sql,
                        flags=re.IGNORECASE,
                        count=1
                    )
                print(f"[INFO] 유사도 임계값 적용: e.embedding <=> '<VECTOR>'::vector < {distance_threshold}")
            
            # 7. 최종 SQL 검증 (강화)
            # 벡터 문자열이 매우 길 수 있으므로, 앞부분과 끝부분을 따로 확인
            sql_start = final_sql[:200]
            sql_end = final_sql[-200:] if len(final_sql) > 200 else final_sql
            print(f"[DEBUG] 최종 SQL (검증 전) - 시작: {sql_start}...")
            print(f"[DEBUG] 최종 SQL (검증 전) - 끝: ...{sql_end}")
            
            # 검증: 전체 SQL에서 확인 (벡터가 길어도 ORDER BY는 끝부분에 있어야 함)
            final_sql_upper = final_sql.upper()
            
            # 집계 함수 사용 금지 검증 (COUNT, SUM, AVG 등)
            aggregate_patterns = [r'\bCOUNT\s*\(', r'\bSUM\s*\(', r'\bAVG\s*\(', r'\bMAX\s*\(', r'\bMIN\s*\(']
            for pattern in aggregate_patterns:
                if re.search(pattern, final_sql_upper):
                    raise ValueError(f"집계 함수({pattern})는 사용할 수 없습니다. 실제 문서 행을 반환해야 합니다.")
            
            # LIMIT 검증 (LIMIT이 None이 아닌 경우에만 검증)
            # COUNT 쿼리인 경우 LIMIT이 없을 수 있음
            if limit is not None:
                if not re.search(r'LIMIT\s+\d+', final_sql_upper):
                    print(f"[ERROR] LIMIT 검증 실패. SQL 끝부분: {sql_end}")
                    raise ValueError("LIMIT이 SQL에 없습니다. 쿼리 생성 실패.")
            else:
                # LIMIT이 None인 경우 LIMIT이 없어야 함
                if re.search(r'LIMIT\s+\d+', final_sql_upper):
                    print(f"[WARN] COUNT 쿼리인데 LIMIT이 있습니다. LIMIT 제거 중...")
                    final_sql = re.sub(r'\s+LIMIT\s+\d+', '', final_sql, flags=re.IGNORECASE)
                    if not final_sql.rstrip().endswith(';'):
                        final_sql = final_sql.rstrip() + ';'
            
            if 'ORDER BY' not in final_sql_upper:
                print(f"[ERROR] ORDER BY 검증 실패. SQL 끝부분: {sql_end}")
                raise ValueError("ORDER BY가 SQL에 없습니다. 쿼리 생성 실패.")
            
            # ORDER BY distance 검증 (더 유연하게 - distance 별칭 또는 직접 계산 모두 허용)
            # ORDER BY distance 또는 ORDER BY e.embedding <=> ... 모두 허용
            has_order_by_distance = (
                'ORDER BY DISTANCE' in final_sql_upper or
                re.search(r'ORDER\s+BY\s+.*embedding\s*<=>', final_sql_upper) is not None
            )
            if not has_order_by_distance:
                print(f"[ERROR] ORDER BY distance 검증 실패. SQL 끝부분: {sql_end}")
                print(f"[ERROR] SQL 전체 길이: {len(final_sql)}")
                print(f"[ERROR] ORDER BY 위치: {final_sql_upper.find('ORDER BY')}")
                raise ValueError("ORDER BY distance 또는 ORDER BY embedding <=> 가 SQL에 없습니다.")
            
            print(f"[DEBUG] 최종 SQL 검증 통과")
            
            # WHERE 절이 ORDER BY 전에 있는지 확인
            where_pos = final_sql.upper().find('WHERE')
            order_by_pos = final_sql.upper().find('ORDER BY')
            if where_pos > 0 and order_by_pos > 0 and where_pos > order_by_pos:
                raise ValueError("WHERE 절이 ORDER BY 뒤에 있습니다. WHERE는 ORDER BY 전에 와야 합니다.")
            
            # 7. 쿼리 실행 (성능 최적화)
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    # statement_timeout 설정 (120초 - 대용량 데이터나 인덱스 미사용 시 대비)
                    # HNSW 인덱스가 있으면 1초 이내 완료되지만, 없거나 JOIN이 느리면 시간이 걸릴 수 있음
                    cur.execute("SET LOCAL statement_timeout = 120000;")
                    
                    # HNSW 인덱스 및 doc_id 인덱스 존재 여부 확인 (성능 최적화를 위해)
                    try:
                        # HNSW 인덱스 확인
                        cur.execute("""
                            SELECT indexname 
                            FROM pg_indexes 
                            WHERE schemaname = 'core' 
                              AND tablename = 'doc_embedding' 
                              AND indexname LIKE '%hnsw%'
                            LIMIT 1
                        """)
                        has_hnsw = cur.fetchone() is not None
                        if not has_hnsw:
                            print("[WARN] HNSW 인덱스가 없습니다. 쿼리가 느릴 수 있습니다.")
                            print("[WARN] 인덱스 생성: CREATE INDEX idx_doc_embedding_hnsw ON core.doc_embedding USING hnsw (embedding vector_cosine_ops);")
                        else:
                            print("[INFO] HNSW 인덱스 확인됨")
                        
                        # doc_id 인덱스 확인 (JOIN 성능에 중요)
                        cur.execute("""
                            SELECT indexname 
                            FROM pg_indexes 
                            WHERE schemaname = 'core' 
                              AND tablename IN ('doc_embedding', 'doc_embedding_view')
                              AND (indexname LIKE '%doc_id%' OR indexdef LIKE '%doc_id%')
                            LIMIT 2
                        """)
                        doc_id_indexes = cur.fetchall()
                        if len(doc_id_indexes) < 2:
                            print("[WARN] doc_id 인덱스가 부족합니다. JOIN 성능이 저하될 수 있습니다.")
                            print("[WARN] 인덱스 생성:")
                            print("[WARN]   CREATE INDEX IF NOT EXISTS idx_doc_embedding_doc_id ON core.doc_embedding(doc_id);")
                            print("[WARN]   CREATE INDEX IF NOT EXISTS idx_doc_embedding_view_doc_id ON core.doc_embedding_view(doc_id);")
                        else:
                            print("[INFO] doc_id 인덱스 확인됨 (JOIN 최적화)")
                    except Exception as idx_check_error:
                        print(f"[WARN] 인덱스 확인 실패 (무시): {idx_check_error}")
                    
                    # 인덱스 사용 강제 (HNSW 인덱스가 있으면 사용하도록)
                    # enable_seqscan = off로 설정하면 인덱스가 없으면 에러 발생하므로 주의
                    # 대신 인덱스 사용을 권장하도록 설정
                    try:
                        cur.execute("SET LOCAL enable_seqscan = on;")  # 인덱스가 없어도 동작하도록
                        cur.execute("SET LOCAL random_page_cost = 1.1;")  # 인덱스 사용을 더 선호
                        cur.execute("SET LOCAL enable_hashjoin = on;")  # 해시 조인 활성화
                        cur.execute("SET LOCAL work_mem = '256MB';")  # 조인 작업 메모리 증가
                    except Exception as idx_error:
                        print(f"[WARN] 인덱스 설정 실패 (무시): {idx_error}")
                    
                    # 실행 계획 확인 (EXPLAIN만 사용 - ANALYZE 제거로 실제 실행 방지)
                    # 단, distance_threshold가 적용된 경우 EXPLAIN이 실패할 수 있으므로 스킵
                    if distance_threshold is None:
                        try:
                            explain_sql = "EXPLAIN " + final_sql
                            cur.execute(explain_sql)
                            explain_result = cur.fetchall()
                            explain_text = "\n".join([row[0] for row in explain_result])
                            print(f"[DEBUG] 실행 계획:\n{explain_text[:800]}...")  # 처음 800자만 출력
                            
                            # 인덱스 사용 여부 확인
                            if "Index Scan" in explain_text or "Index Only Scan" in explain_text or "Bitmap Index Scan" in explain_text:
                                print("[INFO] 인덱스 스캔 사용 중")
                            elif "Seq Scan" in explain_text:
                                print("[WARN] Sequential Scan 사용 중 - 인덱스가 활용되지 않고 있습니다!")
                                print("[WARN] doc_id 인덱스 확인 필요: CREATE INDEX IF NOT EXISTS idx_doc_embedding_doc_id ON core.doc_embedding(doc_id);")
                        except Exception as explain_error:
                            print(f"[WARN] 실행 계획 확인 실패 (무시): {explain_error}")
                    else:
                        print(f"[INFO] 유사도 임계값이 적용되어 실행 계획 확인을 스킵합니다.")
                    
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

