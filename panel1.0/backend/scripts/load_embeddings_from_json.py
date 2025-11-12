"""
임베딩 JSON 파일을 pgvector DB에 적재하는 스크립트

사용법:
    python load_embeddings_from_json.py <json_file_path> [--batch-size 100] [--dimension 1536]

예시:
    python load_embeddings_from_json.py embeddings.json --batch-size 100 --dimension 1536
"""

import json
import sys
import os
import argparse
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import execute_batch

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.config import Config


def load_json_file(file_path: str) -> List[Dict[str, Any]]:
    """JSON 파일 로드"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # JSON이 배열인 경우 그대로, 객체인 경우 리스트로 변환
        if isinstance(data, dict):
            # 단일 객체인 경우
            if 'id' in data or 'document_id' in data:
                return [data]
            # 중첩 구조인 경우 (예: {"documents": [...]})
            for key in ['documents', 'data', 'items', 'embeddings']:
                if key in data and isinstance(data[key], list):
                    return data[key]
            return [data]
        elif isinstance(data, list):
            return data
        else:
            raise ValueError(f"지원하지 않는 JSON 형식: {type(data)}")
    except Exception as e:
        print(f"❌ JSON 파일 로드 실패: {e}")
        sys.exit(1)


def parse_embedding(embedding_data: Any, dimension: int) -> str:
    """
    임베딩 데이터를 PostgreSQL vector 타입 문자열로 변환
    
    Args:
        embedding_data: 리스트 또는 문자열 형태의 임베딩 벡터
        dimension: 벡터 차원 수
    
    Returns:
        PostgreSQL vector 타입 문자열 (예: '[0.1,0.2,0.3]')
    """
    if isinstance(embedding_data, str):
        # 문자열인 경우 JSON 파싱 시도
        try:
            embedding_data = json.loads(embedding_data)
        except:
            # 쉼표로 분리된 숫자 문자열인 경우
            embedding_data = [float(x.strip()) for x in embedding_data.split(',')]
    
    if not isinstance(embedding_data, list):
        raise ValueError(f"임베딩 데이터가 리스트가 아닙니다: {type(embedding_data)}")
    
    if len(embedding_data) != dimension:
        raise ValueError(
            f"임베딩 차원 불일치: 예상 {dimension}, 실제 {len(embedding_data)}"
        )
    
    # PostgreSQL vector 형식으로 변환: '[0.1,0.2,0.3]'
    vector_str = '[' + ','.join(str(float(x)) for x in embedding_data) + ']'
    return vector_str


def insert_embeddings(
    conn: psycopg2.extensions.connection,
    records: List[Dict[str, Any]],
    dimension: int
) -> int:
    """
    임베딩 데이터를 DB에 삽입
    
    Returns:
        삽입된 레코드 수
    """
    cur = conn.cursor()
    
    inserted_count = 0
    
    for record in records:
        try:
            # JSON 구조에 맞게 필드 추출 (다양한 형식 지원)
            document_id = record.get('id') or record.get('document_id') or record.get('_id')
            text_content = record.get('text') or record.get('content') or record.get('text_content')
            embedding_data = record.get('embedding') or record.get('vector') or record.get('embeddings')
            metadata = record.get('metadata') or {}
            original_json = record
            
            if not document_id:
                print(f"⚠️  document_id가 없는 레코드 건너뜀: {record.get('id', 'unknown')}")
                continue
            
            if not embedding_data:
                print(f"⚠️  embedding이 없는 레코드 건너뜀: {document_id}")
                continue
            
            # 임베딩 벡터 변환
            vector_str = parse_embedding(embedding_data, dimension)
            
            # 메타데이터를 JSONB로 변환
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            metadata_jsonb = json.dumps(metadata, ensure_ascii=False)
            original_jsonb = json.dumps(original_json, ensure_ascii=False)
            
            # INSERT 쿼리 실행
            cur.execute("""
                INSERT INTO embeddings.document_embeddings 
                    (document_id, text_content, embedding, metadata, original_json)
                VALUES (%s, %s, %s::vector, %s::jsonb, %s::jsonb)
                ON CONFLICT (document_id) DO UPDATE SET
                    text_content = EXCLUDED.text_content,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    original_json = EXCLUDED.original_json,
                    updated_at = CURRENT_TIMESTAMP
            """, (document_id, text_content, vector_str, metadata_jsonb, original_jsonb))
            
            inserted_count += 1
            
        except Exception as e:
            print(f"❌ 레코드 삽입 실패 (document_id: {document_id}): {e}")
            continue
    
    conn.commit()
    cur.close()
    
    return inserted_count


def main():
    parser = argparse.ArgumentParser(
        description='임베딩 JSON 파일을 pgvector DB에 적재'
    )
    parser.add_argument(
        'json_file',
        type=str,
        help='임베딩 JSON 파일 경로'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='배치 크기 (기본값: 100)'
    )
    parser.add_argument(
        '--dimension',
        type=int,
        default=1536,
        help='임베딩 벡터 차원 수 (기본값: 1536)'
    )
    parser.add_argument(
        '--schema',
        type=str,
        default='embeddings',
        help='스키마 이름 (기본값: embeddings)'
    )
    
    args = parser.parse_args()
    
    print(f"📂 JSON 파일 로드 중: {args.json_file}")
    records = load_json_file(args.json_file)
    print(f"✅ {len(records)}개 레코드 로드 완료")
    
    # DB 연결
    print("🔌 데이터베이스 연결 중...")
    try:
        db_config = Config.get_db_config()
        conn = psycopg2.connect(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password']
        )
        print("✅ 데이터베이스 연결 성공")
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        sys.exit(1)
    
    # 배치 단위로 삽입
    total_inserted = 0
    batch_count = (len(records) + args.batch_size - 1) // args.batch_size
    
    for i in range(0, len(records), args.batch_size):
        batch = records[i:i + args.batch_size]
        batch_num = (i // args.batch_size) + 1
        
        print(f"📦 배치 {batch_num}/{batch_count} 처리 중... ({len(batch)}개 레코드)")
        
        inserted = insert_embeddings(conn, batch, args.dimension)
        total_inserted += inserted
        
        print(f"✅ 배치 {batch_num} 완료: {inserted}개 레코드 삽입")
    
    conn.close()
    
    print(f"\n🎉 완료! 총 {total_inserted}/{len(records)}개 레코드 삽입됨")


if __name__ == '__main__':
    main()

