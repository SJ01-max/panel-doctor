"""
벡터 검색 서비스 (core_v2 스키마 사용)
"""
from typing import List, Dict, Any, Optional
import os
from app.services.data.executor import execute_sql_safe
from app.services.common.singleton import Singleton

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[ERROR] sentence-transformers 라이브러리가 설치되지 않았습니다.")


class VectorSearchService(Singleton):
    """
    벡터 검색 서비스 (Singleton)
    core_v2.panel_embedding 사용 (768차원)
    """
    
    _initialized = False
    
    def __init__(self):
        if VectorSearchService._initialized:
            return
        
        self.local_embedding_model = None
        self.local_model_name = os.environ.get("LOCAL_EMBEDDING_MODEL", "BM-K/KoSimCSE-roberta-multitask")
        
        # DB에서 임베딩 차원 자동 감지
        self.db_embedding_dimension = self._detect_db_embedding_dimension()
        
        if self.db_embedding_dimension:
            print(f"[INFO] [SINGLETON] DB 임베딩 차원 감지: {self.db_embedding_dimension}차원")
        
        # 로컬 모델 로딩
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                print(f"[INFO] [SINGLETON] 로컬 임베딩 모델 로딩 중: {self.local_model_name}")
                import torch
                device = 'cuda' if torch.cuda.is_available() else 'cpu'
                print(f"   사용 디바이스: {device}")
                
                self.local_embedding_model = SentenceTransformer(
                    self.local_model_name,
                    device=device
                )
                
                local_dim = self.local_embedding_model.get_sentence_embedding_dimension()
                print(f"[OK] [SINGLETON] 로컬 임베딩 모델 초기화 완료 (모델: {self.local_model_name}, 차원: {local_dim})")
                
                if self.db_embedding_dimension and local_dim != self.db_embedding_dimension:
                    print(f"[WARN] 경고: DB 임베딩 차원({self.db_embedding_dimension})과 로컬 모델 차원({local_dim})이 다릅니다!")
            except Exception as e:
                import traceback
                print(f"[ERROR] 로컬 임베딩 모델 로딩 실패: {e}")
                print(traceback.format_exc())
        else:
            raise RuntimeError("sentence-transformers 라이브러리가 설치되지 않았습니다.")
        
        if not self.local_embedding_model:
            raise RuntimeError(f"임베딩 모델({self.local_model_name}) 로딩에 실패했습니다.")
        
        VectorSearchService._initialized = True
    
    def _detect_db_embedding_dimension(self) -> Optional[int]:
        """DB에 저장된 임베딩의 차원을 자동으로 감지"""
        try:
            result = execute_sql_safe(
                query="""
                    SELECT embedding::text as embedding_str
                    FROM core_v2.panel_embedding
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
        """질의 텍스트를 임베딩 벡터로 변환"""
        if not query_text or not query_text.strip():
            return None
        
        if self.local_embedding_model:
            try:
                embedding = self.local_embedding_model.encode(query_text.strip()).tolist()
                return embedding
            except Exception as e:
                print(f"[ERROR] 로컬 임베딩 생성 실패: {e}")
                return None
        
        return None
    
    def execute_hybrid_search_sql(
        self,
        embedding_input: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 5,
        distance_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        최적화된 하이브리드 검색 SQL 실행 (core_v2 스키마)
        
        Args:
            embedding_input: 임베딩할 텍스트
            filters: 구조화된 필터 (gender, age_range, region)
            limit: 결과 제한 수
            distance_threshold: 유사도 임계값 (선택사항)
        
        Returns:
            검색 결과 리스트
        """
        if not self.local_embedding_model:
            raise RuntimeError("임베딩 모델이 초기화되지 않았습니다.")
        
        try:
            embedding = self.local_embedding_model.encode(embedding_input.strip()).tolist()
        except Exception as e:
            raise RuntimeError(f"임베딩 생성 실패: {str(e)}")
        
        # 벡터를 PostgreSQL vector 타입 문자열로 변환
        vector_str = '[' + ','.join(str(v) for v in embedding) + ']'
        
        # WHERE 절 생성
        where_conditions = ["1=1"]  # 기본 조건
        params = {}
        
        if filters:
            # 성별 필터
            if filters.get("gender"):
                gender = filters["gender"]
                if gender in ["M", "남"]:
                    where_conditions.append("r_info.gender = %(gender)s")
                    params["gender"] = "남"
                elif gender in ["F", "여"]:
                    where_conditions.append("r_info.gender = %(gender)s")
                    params["gender"] = "여"
            
            # 연령대 필터 (birth_year 사용)
            # age 또는 age_range 모두 지원
            age_range = filters.get("age_range") or filters.get("age")
            if age_range:
                if age_range == "10s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    params["age_min"] = 10
                    params["age_max"] = 19
                elif age_range == "20s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    params["age_min"] = 20
                    params["age_max"] = 29
                elif age_range == "30s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    params["age_min"] = 30
                    params["age_max"] = 39
                elif age_range == "40s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    params["age_min"] = 40
                    params["age_max"] = 49
                elif age_range == "50s":
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min)s AND %(age_max)s"
                    )
                    params["age_min"] = 50
                    params["age_max"] = 59
                elif age_range in ["60s", "60s+"]:
                    where_conditions.append(
                        "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) >= %(age_min)s"
                    )
                    params["age_min"] = 60
            
            # 지역 필터
            if filters.get("region"):
                region = filters["region"]
                where_conditions.append("r_info.region LIKE %(region)s")
                params["region"] = f"%{region}%"
        
        # 유사도 임계값 조건 추가
        if distance_threshold is not None:
            vector_str_escaped = vector_str.replace("'", "''")
            where_conditions.append(
                f"pe.embedding <=> '{vector_str_escaped}'::vector < %(distance_threshold)s"
            )
            params["distance_threshold"] = distance_threshold
        
        where_clause = " AND ".join(where_conditions)
        
        # 최적화된 하이브리드 검색 SQL
        # 프론트엔드 호환성을 위해 gender, region, age_text도 함께 반환
        sql_query = f"""
            SELECT 
                pe.respondent_id,
                r_json.json_doc,
                r_info.gender,
                r_info.region,
                r_info.birth_year,
                (pe.embedding <=> %(vector)s::vector) as distance
            FROM core_v2.panel_embedding pe
            JOIN core_v2.respondent r_info ON pe.respondent_id = r_info.respondent_id
            JOIN core_v2.respondent_json r_json ON pe.respondent_id = r_json.respondent_id
            WHERE {where_clause}
            ORDER BY distance ASC
            LIMIT %(limit)s
        """
        
        params["vector"] = vector_str
        params["limit"] = limit
        
        try:
            from app.db.connection import get_db_connection, return_db_connection
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL statement_timeout = 120000;")
                    cur.execute(sql_query, params)
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    results = [dict(zip(columns, row)) for row in rows]
                    
                    # 프론트엔드 호환성을 위해 응답 형식 변환
                    from datetime import datetime
                    current_year = datetime.now().year
                    for result in results:
                        # birth_year → age_text 변환
                        if 'birth_year' in result and result['birth_year']:
                            age = current_year - result['birth_year']
                            # 년생 정보 제거하고 나이만 표시
                            result['age_text'] = f"만 {age}세"
                        # doc_id 필드 추가 (하위 호환성)
                        if 'respondent_id' in result:
                            result['doc_id'] = result['respondent_id']
                        # content 필드 추가 (json_doc을 content로도 제공)
                        if 'json_doc' in result:
                            result['content'] = result['json_doc']
                    
                    print(f"[INFO] 하이브리드 검색 완료: {len(results)}개 결과")
                    return results
            finally:
                return_db_connection(conn)
        except Exception as e:
            raise RuntimeError(f"SQL 실행 실패: {str(e)}")

