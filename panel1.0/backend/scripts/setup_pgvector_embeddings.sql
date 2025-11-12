-- ============================================
-- pgvector 확장 설치 및 임베딩 테이블 생성 스크립트
-- ============================================
-- 참고: 새 DB를 만들 필요 없이 기존 DB에 확장만 설치하면 됩니다.
--       데이터 분리를 위해 별도 스키마를 사용하는 것을 권장합니다.

-- ============================================
-- 1단계: pgvector 확장 설치
-- ============================================
-- 기존 DB에 pgvector 확장 설치 (새 DB 불필요)
CREATE EXTENSION IF NOT EXISTS vector;

-- 확장 설치 확인
SELECT * FROM pg_extension WHERE extname = 'vector';

-- ============================================
-- 2단계: 임베딩 데이터용 스키마 생성 (선택사항)
-- ============================================
-- 데이터 분리를 위해 별도 스키마 사용 권장
CREATE SCHEMA IF NOT EXISTS embeddings;

-- ============================================
-- 3단계: 임베딩 테이블 생성
-- ============================================
-- 임베딩 JSON 파일 구조에 맞게 테이블 생성
-- 예시 구조: {id, text, embedding: [0.1, 0.2, ...], metadata: {...}}

DROP TABLE IF EXISTS embeddings.document_embeddings CASCADE;

CREATE TABLE embeddings.document_embeddings (
    -- 기본 식별자
    id BIGSERIAL PRIMARY KEY,
    
    -- 원본 문서 ID (JSON 파일의 id와 매핑)
    document_id TEXT NOT NULL,
    
    -- 원본 텍스트 (임베딩된 텍스트)
    text_content TEXT,
    
    -- 임베딩 벡터 (pgvector의 vector 타입 사용)
    -- 차원 수는 실제 임베딩 모델에 맞게 조정 (예: 1536 for OpenAI, 768 for BERT)
    embedding vector(1536),  -- ⚠️ 실제 임베딩 차원에 맞게 수정 필요
    
    -- 메타데이터 (JSONB로 유연하게 저장)
    metadata JSONB,
    
    -- 원본 JSON 데이터 전체 (필요시)
    original_json JSONB,
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 인덱스용
    CONSTRAINT unique_document_id UNIQUE(document_id)
);

-- 테이블 설명 추가
COMMENT ON TABLE embeddings.document_embeddings IS 
'임베딩 벡터 저장 테이블: 문서 ID, 텍스트, 벡터, 메타데이터 포함';

COMMENT ON COLUMN embeddings.document_embeddings.embedding IS 
'vector 타입: pgvector 확장을 사용한 임베딩 벡터 (차원: 1536, 실제 모델에 맞게 조정 필요)';

-- ============================================
-- 4단계: 성능 최적화 인덱스 생성
-- ============================================

-- 벡터 유사도 검색용 HNSW 인덱스 (고성능)
-- 참고: HNSW는 PostgreSQL 17+ 또는 pgvector 0.5.0+ 필요
-- 이전 버전은 ivfflat 인덱스 사용
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector_hnsw 
ON embeddings.document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 대안: ivfflat 인덱스 (구버전 pgvector용)
-- CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector_ivfflat 
-- ON embeddings.document_embeddings 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- 문서 ID 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id 
ON embeddings.document_embeddings(document_id);

-- 메타데이터 검색용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_document_embeddings_metadata 
ON embeddings.document_embeddings USING gin(metadata);

-- ============================================
-- 5단계: 유사도 검색 함수 (선택사항)
-- ============================================

-- 코사인 유사도로 가장 유사한 문서 검색
CREATE OR REPLACE FUNCTION embeddings.search_similar(
    query_embedding vector(1536),  -- ⚠️ 실제 차원에 맞게 수정
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    document_id TEXT,
    text_content TEXT,
    similarity float,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.document_id,
        de.text_content,
        1 - (de.embedding <=> query_embedding) AS similarity,  -- 코사인 거리 → 유사도
        de.metadata
    FROM embeddings.document_embeddings de
    WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding  -- 거리 기준 정렬
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION embeddings.search_similar IS 
'임베딩 벡터 유사도 검색 함수: 쿼리 벡터와 가장 유사한 문서 반환';

-- ============================================
-- 6단계: 데이터 적재 예시 (Python 스크립트 사용 권장)
-- ============================================

-- DBeaver에서 직접 적재하는 방법:
-- 1. JSON 파일을 읽어서 Python 스크립트로 파싱
-- 2. 각 레코드를 INSERT 또는 COPY로 적재

-- 예시 INSERT (실제 JSON 구조에 맞게 수정 필요):
/*
INSERT INTO embeddings.document_embeddings (document_id, text_content, embedding, metadata, original_json)
VALUES (
    'doc_001',
    '원본 텍스트 내용',
    '[0.1, 0.2, 0.3, ...]'::vector,  -- 벡터 배열을 vector 타입으로 변환
    '{"source": "file1", "category": "panel"}'::jsonb,
    '{"id": "doc_001", "text": "...", "embedding": [...]}'::jsonb
);
*/

-- ============================================
-- 7단계: 사용 예시 쿼리
-- ============================================

-- 예시 1: 벡터 유사도 검색 (코사인 거리)
/*
SELECT 
    document_id,
    text_content,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity,
    metadata
FROM embeddings.document_embeddings
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
*/

-- 예시 2: 함수 사용
/*
SELECT * FROM embeddings.search_similar(
    query_embedding := '[0.1, 0.2, ...]'::vector,
    match_threshold := 0.7,
    match_count := 10
);
*/

-- 예시 3: 메타데이터 필터링 + 벡터 검색
/*
SELECT 
    document_id,
    text_content,
    1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM embeddings.document_embeddings
WHERE metadata->>'category' = 'panel'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
*/

-- ============================================
-- 주의사항
-- ============================================
-- 1. embedding vector(1536)의 차원 수를 실제 임베딩 모델에 맞게 수정하세요
--    - OpenAI text-embedding-ada-002: 1536
--    - OpenAI text-embedding-3-small: 1536
--    - OpenAI text-embedding-3-large: 3072
--    - BERT-base: 768
--    - Sentence-BERT: 384 또는 768
--
-- 2. HNSW 인덱스는 PostgreSQL 17+ 또는 pgvector 0.5.0+ 필요
--    구버전은 ivfflat 인덱스 사용
--
-- 3. 대량 데이터 적재 시 COPY 명령 사용 권장 (INSERT보다 빠름)
--
-- 4. 인덱스 생성은 데이터 적재 후에 하는 것이 더 빠를 수 있습니다

