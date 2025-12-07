"""
벡터 검색 서비스 (core_v2 스키마 사용)
768차원 → 256차원 Autoencoder를 사용한 압축 검색
"""
from typing import List, Dict, Any, Optional
import os
import numpy as np
from app.services.data.executor import execute_sql_safe
from app.services.common.singleton import Singleton

# TensorFlow 로그 레벨 설정 (콘솔 정리)
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # 0=all, 1=info, 2=warnings, 3=errors only

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[ERROR] sentence-transformers 라이브러리가 설치되지 않았습니다.")

try:
    import tensorflow as tf
    # tf-keras를 사용하여 Keras 3 호환성 문제 해결
    try:
        import tf_keras as keras
    except ImportError:
        # tf-keras가 없으면 tensorflow.keras 사용
        from tensorflow import keras
    TENSORFLOW_AVAILABLE = True
    # TensorFlow 경고 메시지 억제
    tf.get_logger().setLevel('ERROR')
except ImportError:
    TENSORFLOW_AVAILABLE = False
    print("[ERROR] tensorflow 라이브러리가 설치되지 않았습니다.")


class VectorSearchService(Singleton):
    """
    벡터 검색 서비스 (Singleton)
    core_v2.doc_embedding 사용 (embedding_256 컬럼, 256차원)
    768차원 임베딩을 Autoencoder로 256차원으로 압축하여 검색
    """
    
    _initialized = False
    
    def __init__(self):
        if VectorSearchService._initialized:
            return
        
        self.local_embedding_model = None
        self.encoder_model = None
        self.local_model_name = os.environ.get("LOCAL_EMBEDDING_MODEL", "BM-K/KoSimCSE-roberta-multitask")
        
        # DB에서 임베딩 차원 자동 감지
        self.db_embedding_dimension = self._detect_db_embedding_dimension()
        
        if self.db_embedding_dimension:
            print(f"[INFO] [SINGLETON] DB 임베딩 차원 감지: {self.db_embedding_dimension}차원")
        
        # 로컬 임베딩 모델 로딩 (768차원 생성용)
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
            except Exception as e:
                import traceback
                print(f"[ERROR] 로컬 임베딩 모델 로딩 실패: {e}")
                print(traceback.format_exc())
        else:
            raise RuntimeError("sentence-transformers 라이브러리가 설치되지 않았습니다.")
        
        if not self.local_embedding_model:
            raise RuntimeError(f"임베딩 모델({self.local_model_name}) 로딩에 실패했습니다.")
        
        # Autoencoder 모델 로딩 (768차원 → 256차원 압축용)
        if TENSORFLOW_AVAILABLE:
            try:
                # encoder_tf_256.keras 파일 경로 찾기
                # vector.py 위치: backend/app/services/data/vector.py
                # 목표: backend/scripts/encoder_tf_256.keras
                current_file = os.path.abspath(__file__)
                # backend/app/services/data -> backend/app/services -> backend/app -> backend
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))
                encoder_path = os.path.join(backend_dir, "scripts", "encoder_tf_256.keras")
                
                # 대체 경로들 시도
                possible_paths = [
                    encoder_path,  # backend/scripts/encoder_tf_256.keras
                    os.path.join(backend_dir, "encoder_tf_256.keras"),  # backend/encoder_tf_256.keras
                    os.path.join(os.path.dirname(backend_dir), "scripts", "encoder_tf_256.keras"),  # panel1.0/scripts/encoder_tf_256.keras
                ]
                
                encoder_path = None
                for path in possible_paths:
                    if os.path.exists(path):
                        encoder_path = path
                        break
                
                if not encoder_path:
                    raise FileNotFoundError(
                        f"encoder_tf_256.keras 파일을 찾을 수 없습니다. 시도한 경로:\n" +
                        "\n".join(f"  - {p}" for p in possible_paths)
                    )
                
                print(f"[INFO] [SINGLETON] Autoencoder 모델 로딩 중: {encoder_path}")
                self.encoder_model = keras.models.load_model(encoder_path, compile=False)
                print(f"[OK] [SINGLETON] Autoencoder 모델 초기화 완료 (768차원 → 256차원 압축)")
            except Exception as e:
                import traceback
                print(f"[ERROR] Autoencoder 모델 로딩 실패: {e}")
                print(traceback.format_exc())
                raise RuntimeError(f"Autoencoder 모델 로딩에 실패했습니다: {e}")
        else:
            raise RuntimeError("tensorflow 라이브러리가 설치되지 않았습니다.")
        
        if not self.encoder_model:
            raise RuntimeError("Autoencoder 모델 로딩에 실패했습니다.")
        
        VectorSearchService._initialized = True
    
    def _detect_db_embedding_dimension(self) -> Optional[int]:
        """DB에 저장된 임베딩의 차원을 자동으로 감지 (embedding_256 컬럼)"""
        try:
            result = execute_sql_safe(
                query="""
                    SELECT embedding_256::text as embedding_str
                    FROM core_v2.doc_embedding
                    WHERE embedding_256 IS NOT NULL
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
        distance_threshold: Optional[float] = None,
        semantic_keywords: Optional[List[str]] = None,
        require_keyword_match: bool = False
    ) -> List[Dict[str, Any]]:
        """
        최적화된 하이브리드 검색 SQL 실행 (core_v2 스키마)
        키워드 필터링 + 벡터 정렬을 결합하여 정밀도 향상
        
        Args:
            embedding_input: 임베딩할 텍스트
            filters: 구조화된 필터 (gender, age_range, region)
            limit: 결과 제한 수
            distance_threshold: 유사도 임계값 (선택사항)
            semantic_keywords: 키워드 리스트 (SQL ILIKE 필터링에 사용)
            require_keyword_match: 키워드 매칭이 필수인지 여부 (False면 키워드 필터링 없이도 검색)
        
        Returns:
            검색 결과 리스트
        """
        if not self.local_embedding_model:
            raise RuntimeError("임베딩 모델이 초기화되지 않았습니다.")
        
        if not self.encoder_model:
            raise RuntimeError("Autoencoder 모델이 초기화되지 않았습니다.")
        
        try:
            # 1. 768차원 임베딩 생성 (KoSimCSE)
            embedding_768 = self.local_embedding_model.encode(embedding_input.strip())
            
            # 2. 256차원으로 압축 (Autoencoder)
            # Reshape for model input: (1, 768)
            embedding_768_reshaped = embedding_768.reshape(1, -1)
            embedding_256 = self.encoder_model.predict(embedding_768_reshaped, verbose=0)[0]
            
            # numpy array를 list로 변환
            embedding = embedding_256.tolist()
        except Exception as e:
            raise RuntimeError(f"임베딩 생성 및 압축 실패: {str(e)}")
        
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
            
            # 연령대 필터 (birth_year 사용) - 여러 연령대 지원 (예: "30s,40s")
            # age 또는 age_range 모두 지원
            age_range = filters.get("age_range") or filters.get("age")
            if age_range:
                # 여러 연령대가 쉼표로 구분된 경우 처리
                if isinstance(age_range, str) and "," in age_range:
                    age_ranges = [a.strip() for a in age_range.split(",")]
                    age_conditions = []
                    
                    for idx, age_r in enumerate(age_ranges):
                        param_suffix = f"_{idx}"
                        if age_r == "10s":
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min" + param_suffix + ")s AND %(age_max" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 10
                            params[f"age_max{param_suffix}"] = 19
                        elif age_r == "20s":
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min" + param_suffix + ")s AND %(age_max" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 20
                            params[f"age_max{param_suffix}"] = 29
                        elif age_r == "30s":
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min" + param_suffix + ")s AND %(age_max" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 30
                            params[f"age_max{param_suffix}"] = 39
                        elif age_r == "40s":
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min" + param_suffix + ")s AND %(age_max" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 40
                            params[f"age_max{param_suffix}"] = 49
                        elif age_r == "50s":
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) BETWEEN %(age_min" + param_suffix + ")s AND %(age_max" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 50
                            params[f"age_max{param_suffix}"] = 59
                        elif age_r in ["60s", "60s+"]:
                            age_conditions.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE) - r_info.birth_year) >= %(age_min" + param_suffix + ")s"
                            )
                            params[f"age_min{param_suffix}"] = 60
                    
                    if age_conditions:
                        where_conditions.append(f"({' OR '.join(age_conditions)})")
                else:
                    # 단일 연령대 처리 (기존 로직)
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
        
        # 키워드 필터링 (SQL ILIKE) - 정밀도 향상을 위한 키워드 매칭
        # semantic_keywords가 있으면 json_doc에서 키워드 검색
        # require_keyword_match가 False면 키워드 필터링은 선택사항 (벡터 검색으로도 충분히 의미 매칭 가능)
        # 기본적으로는 키워드 필터링을 사용하되, 벡터 검색으로도 의미 매칭이 가능하므로 선택적으로 적용
        if semantic_keywords and len(semantic_keywords) > 0:
            # 키워드 정제 및 분리
            # 예: "아이폰 사용" → ["아이폰", "사용"] (단어 단위로 분리)
            # 불필요한 일반 동사/조사 제거
            stop_words = {
                '사용', '하는', '하는데', '한다', '한다고', '한다는', '한다면',
                '하는', '하는데', '한다', '한다고', '한다는', '한다면',
                '을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로',
                '와', '과', '의', '도', '만', '부터', '까지', '보다', '처럼',
                '같이', '만큼', '정도', '여부', '경험', '전제품', '해주', '주세요'
            }
            
            all_keywords = []
            for kw in semantic_keywords:
                if not kw or not kw.strip():
                    continue
                # 공백으로 단어 분리
                words = kw.strip().split()
                for word in words:
                    word_clean = word.strip()
                    # 조사 제거 (예: "아이폰을" → "아이폰")
                    # 한국어 조사: 을, 를, 이, 가, 은, 는, 에, 에서, 로, 으로, 와, 과, 의, 도, 만
                    for particle in ['을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과', '의', '도', '만']:
                        if word_clean.endswith(particle):
                            word_clean = word_clean[:-len(particle)]
                            break
                    
                    # 불필요한 단어 제거 (너무 짧거나 일반 동사/조사)
                    if word_clean and len(word_clean) >= 2 and word_clean not in stop_words:
                        all_keywords.append(word_clean)
            
            # 중복 제거
            unique_keywords = list(dict.fromkeys(all_keywords))  # 순서 유지하면서 중복 제거
            
            if unique_keywords:
                # 키워드 간 OR 조건으로 구성 (최소 하나라도 매칭되면 포함)
                # ⚠️ 중요: 질문이 아닌 답변 내용만 매칭하도록 개선
                # 부정 표현이 포함된 경우 제외 (예: "반려동물을 키워본 적 없다")
                keyword_conditions = []
                for i, keyword in enumerate(unique_keywords):
                    param_name = f"keyword_{i}"
                    params[param_name] = f"%{keyword}%"
                    
                    # 부정 표현 패턴: 더 정교한 부정 표현 감지
                    # "없다", "없음", "없습니다", "없어요", "안 한다", "하지 않는다", "키워본 적 없" 등
                    neg_patterns = [
                        f"%{keyword}%없다%",
                        f"%{keyword}%없음%",
                        f"%{keyword}%없습니다%",
                        f"%{keyword}%없어요%",
                        f"%{keyword}%안%",
                        f"%{keyword}%하지%않%",
                        f"%{keyword}%못%",
                        f"%키워본%적%없%",
                        f"%키워본%적%없다%",
                        f"%키워본%적%없음%",
                        f"%키워본%적%없습니다%"
                    ]
                    # 여러 부정 패턴을 OR로 결합
                    neg_conditions = [f"r_json.json_doc ILIKE %(neg_{param_name}_{j})s" for j in range(len(neg_patterns))]
                    for j, pattern in enumerate(neg_patterns):
                        params[f"neg_{param_name}_{j}"] = pattern
                    
                    # 키워드가 포함되어 있으면서, 부정 표현이 없는 경우만 매칭
                    keyword_conditions.append(
                        f"(r_json.json_doc ILIKE %({param_name})s AND "
                        f"NOT ({' OR '.join(neg_conditions)}))"
                    )
                
                if keyword_conditions:
                    # OR 조건으로 결합: (keyword1 OR keyword2 OR ...)
                    where_conditions.append(f"({' OR '.join(keyword_conditions)})")
                    print(f"[DEBUG] 키워드 필터링 적용: {len(unique_keywords)}개 키워드 (OR 조건, 부정 표현 제외)")
                    print(f"[DEBUG] 키워드 목록: {unique_keywords}")
                    print(f"[DEBUG] 원본 semantic_keywords: {semantic_keywords}")
        
        # 유사도 임계값 조건 추가
        if distance_threshold is not None:
            vector_str_escaped = vector_str.replace("'", "''")
            where_conditions.append(
                f"pe.embedding_256 <=> '{vector_str_escaped}'::vector < %(distance_threshold)s"
            )
            params["distance_threshold"] = distance_threshold
        
        where_clause = " AND ".join(where_conditions)
        
        # ★ 최적화된 하이브리드 검색 SQL - Window Function 사용
        # 프론트엔드 호환성을 위해 gender, region, district, birth_year, age_text도 함께 반환
        # 키워드 필터링 + 벡터 정렬 결합
        # COUNT(*) OVER()를 사용하여 별도의 COUNT 쿼리 없이 한 번에 처리
        sql_query = f"""
            SELECT 
                pe.respondent_id,
                r_json.json_doc,
                r_info.gender,
                r_info.region,
                r_info.district,
                r_info.birth_year,
                (pe.embedding_256 <=> %(vector)s::vector) as distance,
                COUNT(*) OVER() as total_count
            FROM core_v2.doc_embedding pe
            JOIN core_v2.respondent r_info ON pe.respondent_id = r_info.respondent_id
            JOIN core_v2.respondent_json r_json ON pe.respondent_id = r_json.respondent_id
            WHERE pe.embedding_256 IS NOT NULL AND r_json.json_doc IS NOT NULL AND {where_clause}
            ORDER BY distance ASC
            LIMIT %(limit)s
        """
        
        params["vector"] = vector_str
        params["limit"] = limit
        
        # 디버깅: SQL 쿼리 로깅 (키워드 필터링 확인용)
        print(f"[DEBUG] 하이브리드 검색 SQL 쿼리:")
        print(f"  WHERE 절: {where_clause}")
        if semantic_keywords:
            print(f"  키워드 필터 파라미터: {[k for k in params.keys() if k.startswith('keyword_')]}")
        
        try:
            from app.db.connection import get_db_connection, return_db_connection
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SET LOCAL statement_timeout = 120000;")
                    
                    # ★ Window Function을 사용하여 COUNT와 SELECT를 한 번에 처리
                    # 별도의 COUNT 쿼리 제거 - 성능 최적화
                    cur.execute(sql_query, params)
                    columns = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    results = [dict(zip(columns, row)) for row in rows]
                    
                    # total_count 추출 (첫 번째 행에서 Window Function 결과)
                    total_count = 0
                    if results and len(results) > 0:
                        total_count = results[0].get('total_count', 0)
                        # total_count 필드 제거 (메타데이터이므로)
                        for result in results:
                            if 'total_count' in result:
                                del result['total_count']
                    
                    # 프론트엔드 호환성을 위해 응답 형식 변환
                    from datetime import datetime
                    current_year = datetime.now().year
                    for result in results:
                        # birth_year → age_text 변환
                        if 'birth_year' in result and result['birth_year']:
                            age = current_year - result['birth_year']
                            # 년생 정보 제거하고 나이만 표시
                            result['age_text'] = f"만 {age}세"
                            # age 필드도 추가 (숫자형)
                            result['age'] = age
                        else:
                            # birth_year가 없으면 기본값 설정
                            result['age_text'] = None
                            result['age'] = None
                        
                        # doc_id 필드 추가 (하위 호환성)
                        if 'respondent_id' in result:
                            result['doc_id'] = result['respondent_id']
                        
                        # content 필드 추가 (json_doc을 content로도 제공)
                        if 'json_doc' in result:
                            result['content'] = result['json_doc']
                        elif 'content' not in result:
                            result['content'] = None
                        
                        # district 필드 보장 (NULL일 수 있음)
                        if 'district' not in result:
                            result['district'] = None
                        
                        # gender 필드 보장
                        if 'gender' not in result:
                            result['gender'] = None
                        
                        # region 필드 보장
                        if 'region' not in result:
                            result['region'] = None
                        
                        # total_count를 메타데이터로 추가
                        result['_total_count'] = total_count
                    
                    # ★ 결과 품질 검증 및 재랭킹 (키워드 매칭 빈도 고려)
                    if semantic_keywords and len(semantic_keywords) > 0:
                        # 키워드 매칭 빈도 계산 및 재랭킹
                        results = self._rerank_by_keyword_match(results, semantic_keywords)
                    
                    print(f"[INFO] 하이브리드 검색 완료: {len(results)}개 결과 (전체: {total_count}개) - Window Function 사용")
                    return results
            finally:
                return_db_connection(conn)
        except Exception as e:
            raise RuntimeError(f"SQL 실행 실패: {str(e)}")
    
    def _rerank_by_keyword_match(
        self, 
        results: List[Dict[str, Any]], 
        semantic_keywords: List[str]
    ) -> List[Dict[str, Any]]:
        """
        키워드 매칭 빈도를 고려한 결과 재랭킹
        
        Args:
            results: 검색 결과 리스트
            semantic_keywords: 의미 키워드 리스트
        
        Returns:
            재랭킹된 결과 리스트
        """
        if not results or not semantic_keywords:
            return results
        
        # 키워드 정제 (조사 제거 등)
        stop_words = {
            '사용', '하는', '하는데', '한다', '한다고', '한다는', '한다면',
            '을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로',
            '와', '과', '의', '도', '만', '부터', '까지', '보다', '처럼',
            '같이', '만큼', '정도', '여부', '경험', '전제품', '해주', '주세요'
        }
        
        clean_keywords = []
        for kw in semantic_keywords:
            if not kw or not kw.strip():
                continue
            words = kw.strip().split()
            for word in words:
                word_clean = word.strip()
                for particle in ['을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과', '의', '도', '만']:
                    if word_clean.endswith(particle):
                        word_clean = word_clean[:-len(particle)]
                        break
                if word_clean and len(word_clean) >= 2 and word_clean not in stop_words:
                    clean_keywords.append(word_clean.lower())
        
        if not clean_keywords:
            return results
        
        # 각 결과에 대해 키워드 매칭 점수 계산
        for result in results:
            json_doc = result.get('json_doc', '') or result.get('content', '')
            if not json_doc:
                result['keyword_match_score'] = 0.0
                continue
            
            json_doc_lower = json_doc.lower()
            match_count = 0
            total_keywords = len(clean_keywords)
            
            # 키워드 매칭 빈도 계산 (부정 표현 제외)
            for keyword in clean_keywords:
                if keyword in json_doc_lower:
                    # 부정 표현 체크
                    keyword_pos = json_doc_lower.find(keyword)
                    if keyword_pos != -1:
                        # 키워드 주변 텍스트 확인 (앞뒤 50자)
                        context_start = max(0, keyword_pos - 50)
                        context_end = min(len(json_doc_lower), keyword_pos + len(keyword) + 50)
                        context = json_doc_lower[context_start:context_end]
                        
                        # 부정 표현 패턴 체크
                        neg_patterns = ['없다', '없음', '없습니다', '없어요', '안', '하지않', '못', '키워본적없']
                        is_negative = any(neg in context for neg in neg_patterns)
                        
                        if not is_negative:
                            match_count += 1
            
            # 키워드 매칭 점수 (0.0 ~ 1.0)
            keyword_match_score = match_count / total_keywords if total_keywords > 0 else 0.0
            result['keyword_match_score'] = keyword_match_score
        
        # 재랭킹: distance와 keyword_match_score를 결합
        # distance는 낮을수록 좋음, keyword_match_score는 높을수록 좋음
        # 최종 점수 = (1 - normalized_distance) * 0.6 + keyword_match_score * 0.4
        for result in results:
            distance = result.get('distance', 2.0)
            keyword_score = result.get('keyword_match_score', 0.0)
            
            # distance 정규화 (0~2 범위를 0~1로)
            normalized_distance = min(1.0, distance / 2.0)
            vector_score = 1.0 - normalized_distance
            
            # 최종 점수 계산 (벡터 60%, 키워드 40%)
            final_score = vector_score * 0.6 + keyword_score * 0.4
            result['_rerank_score'] = final_score
        
        # 재랭킹 점수로 정렬
        results.sort(key=lambda x: x.get('_rerank_score', 0.0), reverse=True)
        
        # 임시 점수 필드 제거
        for result in results:
            if '_rerank_score' in result:
                del result['_rerank_score']
            if 'keyword_match_score' in result:
                del result['keyword_match_score']
        
        return results

