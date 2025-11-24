"""
respondent_json → panel_embedding 임베딩 생성 스크립트
BM-K/KoSimCSE-roberta-multitask 모델을 사용하여 respondent_json의 텍스트를 임베딩하고
core_v2.panel_embedding 테이블에 저장
"""

import os
import time
import logging
import psycopg2
from psycopg2.extras import execute_batch
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from tqdm import tqdm

# 1. 환경 변수 로드
load_dotenv()

# 2. 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 설정
MODEL_NAME = 'BM-K/KoSimCSE-roberta-multitask'
BATCH_SIZE = 64
DB_SCHEMA = 'core_v2'
SOURCE_TABLE = 'respondent_json'
TARGET_TABLE = 'panel_embedding'

def get_db_connection():
    """데이터베이스 연결 반환"""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", 5432)
    )

def fetch_data(conn):
    """데이터 조회"""
    query = f"""
        SELECT respondent_id, json_doc 
        FROM {DB_SCHEMA}.{SOURCE_TABLE}
        WHERE json_doc IS NOT NULL AND json_doc != ''
        ORDER BY respondent_id
    """
    with conn.cursor() as cursor:
        logger.info("데이터 조회 중...")
        cursor.execute(query)
        rows = cursor.fetchall()
        logger.info(f"총 {len(rows):,}건의 데이터 조회 완료")
        return rows

def main():
    start_time = time.time()
    conn = None
    total_processed = 0
    total_failed = 0
    
    try:
        # 모델 로드
        logger.info(f"모델 로딩 중... ({MODEL_NAME})")
        model = SentenceTransformer(MODEL_NAME)
        logger.info("모델 로딩 완료!")
        
        # DB 연결
        conn = get_db_connection()
        rows = fetch_data(conn)
        
        if not rows:
            logger.warning("데이터가 없습니다.")
            return

        # SQL 쿼리 (명시적 vector 캐스팅)
        upsert_query = f"""
            INSERT INTO {DB_SCHEMA}.{TARGET_TABLE} (respondent_id, embedding, updated_at)
            VALUES (%s, %s::vector, NOW()) 
            ON CONFLICT (respondent_id) 
            DO UPDATE SET 
                embedding = EXCLUDED.embedding,
                updated_at = NOW();
        """

        with conn.cursor() as cursor:
            # 배치 처리
            for i in tqdm(range(0, len(rows), BATCH_SIZE), desc="Embedding"):
                batch = rows[i : i + BATCH_SIZE]
                
                try:
                    ids = [r[0] for r in batch]
                    texts = [r[1] for r in batch]
                    
                    # 임베딩 생성 (배치)
                    embeddings = model.encode(
                        texts, 
                        normalize_embeddings=True, 
                        show_progress_bar=False
                    )
                    
                    # 벡터 문자열 변환
                    batch_records = []
                    for r_id, vec in zip(ids, embeddings):
                        batch_records.append((r_id, str(vec.tolist())))
                    
                    # DB 저장
                    execute_batch(cursor, upsert_query, batch_records, page_size=BATCH_SIZE)
                    conn.commit()
                    
                    total_processed += len(batch)
                    
                except Exception as e:
                    # 배치 단위 에러 처리 (해당 배치만 실패, 나머지는 계속 진행)
                    logger.error(f"배치 {i//BATCH_SIZE + 1} 처리 실패: {e}")
                    total_failed += len(batch)
                    conn.rollback()
                    continue

        # 최종 통계
        elapsed_time = time.time() - start_time
        logger.info("=" * 60)
        logger.info("임베딩 적재 완료!")
        logger.info(f"  총 처리: {total_processed:,}건")
        if total_failed > 0:
            logger.warning(f"  실패: {total_failed:,}건")
        logger.info(f"  소요 시간: {elapsed_time:.2f}초")
        if total_processed > 0:
            logger.info(f"  평균 속도: {total_processed/elapsed_time:.1f}건/초")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"치명적 오류: {e}", exc_info=True)
        if conn: 
            conn.rollback()
    finally:
        if conn: 
            conn.close()
            logger.info("DB 연결 종료")

if __name__ == "__main__":
    main()

