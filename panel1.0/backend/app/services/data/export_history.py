"""
내보내기 이력 데이터 서비스
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
from app.db.connection import get_db_connection, return_db_connection


class ExportHistoryService:
    """내보내기 이력 데이터 접근 서비스"""
    
    def __init__(self):
        self.table_name = "export_history"
        self.schema = "public"
    
    def _ensure_table_exists(self):
        """내보내기 이력 테이블이 없으면 생성"""
        try:
            conn = get_db_connection()
        except Exception as e:
            print(f"[ERROR] DB 연결 실패 (_ensure_table_exists): {e}")
            raise
        
        try:
            with conn.cursor() as cursor:
                # 테이블 존재 여부 확인
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = %s 
                        AND table_name = %s
                    );
                """, (self.schema, self.table_name))
                
                exists = cursor.fetchone()[0]
                
                if not exists:
                    # 테이블 생성
                    cursor.execute(f"""
                        CREATE TABLE {self.schema}.{self.table_name} (
                            id SERIAL PRIMARY KEY,
                            file_name VARCHAR(255) NOT NULL,
                            file_type VARCHAR(50) NOT NULL,  -- 'csv', 'excel', 'pdf'
                            export_type VARCHAR(100) NOT NULL,  -- 'target_group', 'panel_search', 'report', etc.
                            panel_count INTEGER DEFAULT 0,
                            file_size BIGINT DEFAULT 0,  -- bytes
                            file_path TEXT,  -- 저장된 파일 경로
                            status VARCHAR(50) DEFAULT 'processing',  -- 'success', 'failed', 'processing'
                            description TEXT,
                            metadata JSONB,  -- 추가 메타데이터 (필터 조건, 검색 쿼리 등)
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP,
                            created_by VARCHAR(100)
                        );
                    """)
                    
                    # 인덱스 생성
                    cursor.execute(f"""
                        CREATE INDEX idx_{self.table_name}_created_at 
                        ON {self.schema}.{self.table_name}(created_at DESC);
                    """)
                    
                    cursor.execute(f"""
                        CREATE INDEX idx_{self.table_name}_status 
                        ON {self.schema}.{self.table_name}(status);
                    """)
                    
                    cursor.execute(f"""
                        CREATE INDEX idx_{self.table_name}_file_type 
                        ON {self.schema}.{self.table_name}(file_type);
                    """)
                    
                    conn.commit()
                    print(f"[INFO] {self.schema}.{self.table_name} 테이블 생성 완료")
        finally:
            return_db_connection(conn)
    
    def create(
        self,
        file_name: str,
        file_type: str,
        export_type: str,
        panel_count: int = 0,
        description: str = None,
        metadata: Dict[str, Any] = None,
        created_by: str = None
    ) -> int:
        """내보내기 이력 생성"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    INSERT INTO {self.schema}.{self.table_name}
                    (file_name, file_type, export_type, panel_count, description, metadata, created_by, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'processing')
                    RETURNING id
                """, (
                    file_name,
                    file_type,
                    export_type,
                    panel_count,
                    description,
                    json.dumps(metadata) if metadata else None,
                    created_by
                ))
                
                export_id = cursor.fetchone()[0]
                conn.commit()
                return export_id
        finally:
            return_db_connection(conn)
    
    def update_status(
        self,
        export_id: int,
        status: str,
        file_path: str = None,
        file_size: int = None,
        error_message: str = None
    ):
        """내보내기 상태 업데이트"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                update_fields = ["status = %s"]
                params = [status]
                
                if file_path:
                    update_fields.append("file_path = %s")
                    params.append(file_path)
                
                if file_size is not None:
                    update_fields.append("file_size = %s")
                    params.append(file_size)
                
                if status == 'success':
                    update_fields.append("completed_at = CURRENT_TIMESTAMP")
                elif status == 'failed' and error_message:
                    # 에러 메시지를 description에 추가
                    update_fields.append("description = COALESCE(description, '') || %s")
                    params.append(f"\n에러: {error_message}")
                
                params.append(export_id)
                
                cursor.execute(f"""
                    UPDATE {self.schema}.{self.table_name}
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                """, params)
                
                conn.commit()
        finally:
            return_db_connection(conn)
    
    def get_all(
        self,
        limit: int = 100,
        offset: int = 0,
        period_days: int = None,
        file_type: str = None,
        status: str = None,
        search_query: str = None
    ) -> List[Dict[str, Any]]:
        """내보내기 이력 목록 조회 (필터링 지원)"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                where_conditions = []
                params = []
                
                # 기간 필터
                if period_days:
                    where_conditions.append("created_at >= CURRENT_DATE - INTERVAL '%s days'")
                    params.append(period_days)
                
                # 파일 유형 필터
                if file_type and file_type != 'all':
                    where_conditions.append("file_type = %s")
                    params.append(file_type)
                
                # 상태 필터
                if status and status != 'all':
                    where_conditions.append("status = %s")
                    params.append(status)
                
                # 검색 쿼리
                if search_query:
                    where_conditions.append("(file_name ILIKE %s OR description ILIKE %s)")
                    params.extend([f'%{search_query}%', f'%{search_query}%'])
                
                where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
                
                params.extend([limit, offset])
                
                cursor.execute(f"""
                    SELECT 
                        id, file_name, file_type, export_type, panel_count, 
                        file_size, file_path, status, description, metadata,
                        created_at, completed_at, created_by
                    FROM {self.schema}.{self.table_name}
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, params)
                
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                
                result = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    
                    # JSONB를 dict로 변환
                    if row_dict.get('metadata'):
                        if isinstance(row_dict['metadata'], str):
                            row_dict['metadata'] = json.loads(row_dict['metadata'])
                    else:
                        row_dict['metadata'] = {}
                    
                    # 날짜를 문자열로 변환
                    if row_dict.get('created_at'):
                        row_dict['created_at'] = row_dict['created_at'].isoformat()
                    if row_dict.get('completed_at'):
                        row_dict['completed_at'] = row_dict['completed_at'].isoformat()
                    
                    # 파일 크기를 MB로 변환
                    if row_dict.get('file_size'):
                        row_dict['file_size_mb'] = round(row_dict['file_size'] / (1024 * 1024), 2)
                    else:
                        row_dict['file_size_mb'] = None
                    
                    result.append(row_dict)
                
                return result
        finally:
            return_db_connection(conn)
    
    def get_by_id(self, export_id: int) -> Optional[Dict[str, Any]]:
        """ID로 내보내기 이력 조회"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT 
                        id, file_name, file_type, export_type, panel_count, 
                        file_size, file_path, status, description, metadata,
                        created_at, completed_at, created_by
                    FROM {self.schema}.{self.table_name}
                    WHERE id = %s
                """, (export_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(columns, row))
                
                # JSONB를 dict로 변환
                if row_dict.get('metadata'):
                    if isinstance(row_dict['metadata'], str):
                        row_dict['metadata'] = json.loads(row_dict['metadata'])
                else:
                    row_dict['metadata'] = {}
                
                # 날짜를 문자열로 변환
                if row_dict.get('created_at'):
                    row_dict['created_at'] = row_dict['created_at'].isoformat()
                if row_dict.get('completed_at'):
                    row_dict['completed_at'] = row_dict['completed_at'].isoformat()
                
                # 파일 크기를 MB로 변환
                if row_dict.get('file_size'):
                    row_dict['file_size_mb'] = round(row_dict['file_size'] / (1024 * 1024), 2)
                else:
                    row_dict['file_size_mb'] = None
                
                return row_dict
        finally:
            return_db_connection(conn)
    
    def get_stats(self) -> Dict[str, Any]:
        """내보내기 통계 조회"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'success') as success,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        COUNT(*) FILTER (WHERE status = 'processing') as processing
                    FROM {self.schema}.{self.table_name}
                """)
                
                row = cursor.fetchone()
                columns = [desc[0] for desc in cursor.description]
                stats = dict(zip(columns, row))
                
                return {
                    'total': stats.get('total', 0),
                    'success': stats.get('success', 0),
                    'failed': stats.get('failed', 0),
                    'processing': stats.get('processing', 0)
                }
        finally:
            return_db_connection(conn)

