-- ============================================
-- pgvector HNSW 인덱스 생성 스크립트
-- ============================================
-- 성능 최적화: 벡터 유사도 검색 속도 향상
-- PostgreSQL 17+ 또는 pgvector 0.5.0+ 필요

-- 1. HNSW 인덱스 생성 (코사인 거리 최적화)
CREATE INDEX IF NOT EXISTS idx_doc_embedding_hnsw
ON core.doc_embedding
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. doc_id 인덱스 (JOIN 성능 향상)
CREATE INDEX IF NOT EXISTS idx_doc_embedding_doc_id
ON core.doc_embedding(doc_id);

-- 3. doc_embedding_view의 doc_id 인덱스 (JOIN 성능 향상)
CREATE INDEX IF NOT EXISTS idx_doc_embedding_view_doc_id
ON core.doc_embedding_view(doc_id);

-- 4. 인덱스 생성 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'core'
  AND tablename IN ('doc_embedding', 'doc_embedding_view')
ORDER BY tablename, indexname;

-- 참고:
-- - HNSW 인덱스는 대용량 데이터에서 매우 빠른 검색을 제공합니다
-- - 인덱스 생성 시간은 데이터 양에 따라 다를 수 있습니다 (수 분 ~ 수 시간)
-- - 인덱스 생성 중에는 테이블에 대한 쓰기 작업이 느려질 수 있습니다

