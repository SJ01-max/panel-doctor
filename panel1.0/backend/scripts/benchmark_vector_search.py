"""
벡터 검색 성능 벤치마크 스크립트
768차원 vs 256차원 벡터 검색 성능 비교

사용법:
    python benchmark_vector_search.py

요구사항:
    - sentence-transformers
    - psycopg2
    - pgvector
    - tf-keras (256차원 인코더용, 선택사항)
    - numpy
"""
import time
from typing import List, Tuple, Set, Optional

import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

# 256차원 인코더 로드 (선택사항)
# ==========================================
# 인코더 모델 경로 설정 방법:
# 1. 기본값: 스크립트와 같은 디렉토리의 encoder_tf_256.keras 사용
# 2. 다른 위치에 있다면 아래 경로를 수정하세요
#    예시: ENCODER_PATH = "C:/path/to/encoder_tf_256.keras"
#    또는: ENCODER_PATH = "../model_cache/encoders/encoder_tf_256.keras"
# ==========================================
import os
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENCODER_PATH = os.path.join(_SCRIPT_DIR, "encoder_tf_256.keras")  # 스크립트와 같은 디렉토리

encoder = None
try:
    import tf_keras as keras
    
    if ENCODER_PATH:
        try:
            if not os.path.exists(ENCODER_PATH):
                print(f"⚠️ 인코더 모델 파일을 찾을 수 없습니다: {ENCODER_PATH}")
                print("   ℹ️ 256차원 벤치마크는 건너뜁니다.")
                encoder = None
            else:
                encoder = keras.models.load_model(ENCODER_PATH)
                print(f"✅ Encoder model loaded from: {ENCODER_PATH}")
        except Exception as e:
            print(f"⚠️ Encoder load failed: {e}")
            import traceback
            traceback.print_exc()
            encoder = None
    else:
        print("ℹ️ ENCODER_PATH가 설정되지 않았습니다.")
        print("   ℹ️ 256차원 벤치마크를 원하시면 ENCODER_PATH를 설정하세요.")
        encoder = None
except ImportError:
    print("⚠️ tf-keras가 설치되지 않았습니다.")
    print("   ℹ️ 설치 방법: pip install tf-keras")
    print("   ℹ️ 256차원 벤치마크는 건너뜁니다.")
    encoder = None

# ==========================================
# 데이터베이스 연결 설정
# ==========================================
DB_CONFIG = {
    "host": "database.c3gymesumce0.ap-northeast-2.rds.amazonaws.com",
    "port": 5432,
    "dbname": "postgres",
    "user": "postgres",
    "password": "xi*VtLL<WD7sZsIbbIZCdF(yMS?y"
}

# ==========================================
# 테스트 쿼리 정의
# ==========================================
TEST_QUERIES = [
    {
        "name": "30s_male_smoker",
        "nl_query": "30대 남자 중 흡연하는 사람",
        "gt_sql": """
            SELECT r.respondent_id
            FROM core_v2.respondent r
            JOIN core_v2.respondent_flags f USING (respondent_id)
            WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - r.birth_year) BETWEEN 30 AND 39
              AND r.gender = '남'
              AND f.is_smoker = TRUE
        """
    },
    {
        "name": "40s_female_seoul_drinker",
        "nl_query": "40대 여자 중 서울 거주하면서 술 마시는 사람",
        "gt_sql": """
            SELECT r.respondent_id
            FROM core_v2.respondent r
            JOIN core_v2.respondent_flags f USING (respondent_id)
            WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - r.birth_year) BETWEEN 40 AND 49
              AND r.gender = '여'
              AND r.region = '서울'
              AND f.is_drinker = TRUE
        """
    },
    {
        "name": "50plus_male_nonsmoker_gyeonggi",
        "nl_query": "50대 이상이면서 경기도에 사는 비흡연자",
        "gt_sql": """
            SELECT r.respondent_id
            FROM core_v2.respondent r
            JOIN core_v2.respondent_flags f USING (respondent_id)
            WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - r.birth_year) >= 50
              AND r.gender = '남'
              AND r.region = '경기'
              AND (f.is_smoker = FALSE OR f.is_smoker IS NULL)
        """
    },
    {
        "name": "20s_female_iphone",
        "nl_query": "아이폰 사용하는 20대 여자",
        "gt_sql": """
            SELECT r.respondent_id
            FROM core_v2.respondent r
            JOIN core_v2.survey_qa_flat_simple s USING (respondent_id)
            WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - r.birth_year) BETWEEN 20 AND 29
              AND r.gender = '여'
              AND s.question_label = '보유 휴대폰 단말기 브랜드'
              AND s.answer_text ILIKE '%아이폰%'
        """
    },
]

TOP_K = 100  # 벡터 검색에서 가져올 결과 개수


# ==========================================
# 유틸리티 함수
# ==========================================
def precision_recall_at_k(pred_ids: List[int], gt_ids: List[int]) -> Tuple[float, float]:
    """
    Precision@K와 Recall@K 계산
    
    Args:
        pred_ids: 예측된 respondent_id 리스트
        gt_ids: Ground truth respondent_id 리스트
    
    Returns:
        (precision, recall) 튜플
    """
    pred_set: Set[int] = set(pred_ids)
    gt_set: Set[int] = set(gt_ids)

    if not pred_set:
        return 0.0, 0.0

    inter = pred_set & gt_set
    precision = len(inter) / len(pred_set)
    recall = len(inter) / len(gt_set) if gt_set else 0.0
    return precision, recall


def fetch_ground_truth(cur, sql: str) -> List[int]:
    """
    Ground truth respondent_id 리스트 조회
    
    Args:
        cur: 데이터베이스 커서
        sql: Ground truth를 조회하는 SQL 쿼리
    
    Returns:
        respondent_id 리스트
    """
    cur.execute(sql)
    rows = cur.fetchall()
    return [r[0] for r in rows]


def search_by_vector_768(cur, q_emb: np.ndarray, top_k: int = TOP_K) -> List[Tuple[int, float]]:
    """
    768차원 임베딩으로 벡터 검색 수행
    
    Args:
        cur: 데이터베이스 커서
        q_emb: 768차원 쿼리 임베딩 (numpy array)
        top_k: 반환할 결과 개수
    
    Returns:
        [(respondent_id, distance), ...] 리스트
    """
    cur.execute("""
        SELECT respondent_id,
               embedding_768 <=> %s::vector AS distance
        FROM core_v2.doc_embedding
        WHERE embedding_768 IS NOT NULL
        ORDER BY distance
        LIMIT %s
    """, (q_emb, top_k))

    return cur.fetchall()


def search_by_vector_256(cur, q_emb_256: np.ndarray, top_k: int = TOP_K) -> List[Tuple[int, float]]:
    """
    256차원 임베딩으로 벡터 검색 수행
    
    Args:
        cur: 데이터베이스 커서
        q_emb_256: 256차원 쿼리 임베딩 (numpy array)
        top_k: 반환할 결과 개수
    
    Returns:
        [(respondent_id, distance), ...] 리스트
    """
    cur.execute("""
        SELECT respondent_id,
               embedding_256 <=> %s::vector AS distance
        FROM core_v2.doc_embedding
        WHERE embedding_256 IS NOT NULL
        ORDER BY distance
        LIMIT %s
    """, (q_emb_256, top_k))

    return cur.fetchall()


def timed_search_768(cur, q_emb: np.ndarray, top_k: int = TOP_K) -> Tuple[List[Tuple[int, float]], float]:
    """
    768차원 벡터 검색 수행 및 시간 측정
    
    Returns:
        (검색 결과, 소요 시간(ms)) 튜플
    """
    start = time.perf_counter()
    res = search_by_vector_768(cur, q_emb, top_k)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return res, elapsed_ms


def timed_search_256(cur, q_emb_256: np.ndarray, top_k: int = TOP_K) -> Tuple[List[Tuple[int, float]], float]:
    """
    256차원 벡터 검색 수행 및 시간 측정
    
    Returns:
        (검색 결과, 소요 시간(ms)) 튜플
    """
    start = time.perf_counter()
    res = search_by_vector_256(cur, q_emb_256, top_k)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return res, elapsed_ms


# ==========================================
# 메인 벤치마크 루프
# ==========================================
def main():
    """메인 벤치마크 실행 함수"""
    # 1) KoSimCSE 모델 로드
    print("🔹 Loading KoSimCSE model...")
    model = SentenceTransformer("BM-K/KoSimCSE-roberta-multitask")
    print("✅ KoSimCSE model loaded.")

    # 2) 데이터베이스 연결
    print("🔹 Connecting to database...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        register_vector(conn)  # pgvector 확장 등록 (numpy 배열 자동 변환)
        cur = conn.cursor()
        print("✅ Database connected.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return

    # 3) 256차원 인코더 사용 가능 여부 확인
    use_256 = encoder is not None
    if not use_256:
        print("⚠️ 256-dimension encoder not available. Skipping 256-dim benchmarks.")
    else:
        print("✅ 256-dimension encoder available.")

    print("=" * 80)

    # 4) 각 테스트 쿼리에 대해 벤치마크 실행
    for test in TEST_QUERIES:
        name = test["name"]
        nl_query = test["nl_query"]
        gt_sql = test["gt_sql"]

        print(f"\n🧪 Test: {name}")
        print(f"   자연어 질의: {nl_query}")

        # Ground truth 조회
        try:
            gt_ids = fetch_ground_truth(cur, gt_sql)
            print(f"   GT 개수: {len(gt_ids)}명")
        except Exception as e:
            print(f"   ❌ Ground truth 조회 실패: {e}")
            continue

        if not gt_ids:
            print("   ⚠️ 이 쿼리는 ground truth가 0명이라 스킵합니다.")
            continue

        # ==========================================
        # 768차원 벤치마크
        # ==========================================
        # 인코딩 시간 측정
        t0 = time.perf_counter()
        q_emb_768 = model.encode(nl_query, convert_to_numpy=True)  # shape: (768,)
        encode_768_ms = (time.perf_counter() - t0) * 1000.0

        # 검색 시간 측정
        res_768, search_768_ms = timed_search_768(cur, q_emb_768, TOP_K)
        pred_ids_768 = [r[0] for r in res_768]
        p768, r768 = precision_recall_at_k(pred_ids_768, gt_ids)

        print(f"   📊 768차원 결과: P@{TOP_K} = {p768:.3f}, R@{TOP_K} = {r768:.3f}")
        print(f"   ⚡ 768차원: 인코딩 {encode_768_ms:.2f} ms, 검색 {search_768_ms:.2f} ms")
        print("   ▶ 768차원 Top 5 예시:")
        for rid, dist in res_768[:5]:
            print(f"      - {rid} (dist={dist:.4f})")

        # ==========================================
        # 256차원 벤치마크 (인코더가 있을 때만)
        # ==========================================
        if use_256:
            try:
                # 768차원 임베딩을 256차원으로 축소 + 인코딩 시간 측정
                t1 = time.perf_counter()
                # encoder.predict는 배치 입력을 받으므로 reshape 필요
                q_emb_256 = encoder.predict(q_emb_768.reshape(1, -1), verbose=0)[0]  # shape: (256,)
                encode_256_ms = (time.perf_counter() - t1) * 1000.0

                # 검색 시간 측정
                res_256, search_256_ms = timed_search_256(cur, q_emb_256, TOP_K)
                pred_ids_256 = [r[0] for r in res_256]
                p256, r256 = precision_recall_at_k(pred_ids_256, gt_ids)

                print(f"   📊 256차원 결과: P@{TOP_K} = {p256:.3f}, R@{TOP_K} = {r256:.3f}")
                print(f"   ⚡ 256차원: 인코딩 {encode_256_ms:.2f} ms, 검색 {search_256_ms:.2f} ms")
                print("   ▶ 256차원 Top 5 예시:")
                for rid, dist in res_256[:5]:
                    print(f"      - {rid} (dist={dist:.4f})")
            except Exception as e:
                print(f"   ❌ 256차원 벤치마크 실행 실패: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("   ⏭️  256차원 벤치마크 건너뜀 (인코더 없음)")

        print("-" * 80)

    # 5) 연결 종료
    cur.close()
    conn.close()
    print("\n✅ 모든 테스트 완료!")


if __name__ == "__main__":
    main()

