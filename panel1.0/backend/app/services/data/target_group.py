"""타겟 그룹 데이터 서비스"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
from app.db.connection import get_db_connection, return_db_connection


class TargetGroupService:
    """타겟 그룹 데이터 접근 서비스"""
    
    def __init__(self):
        self.table_name = "target_groups"
        self.schema = "public"
    
    def _ensure_table_exists(self):
        """타겟 그룹 테이블이 없으면 생성"""
        conn = get_db_connection()
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
                            name VARCHAR(255) NOT NULL,
                            summary TEXT,
                            size INTEGER DEFAULT 0,
                            tags TEXT[],  -- PostgreSQL 배열 타입
                            filters JSONB,  -- 필터 조건을 JSON으로 저장
                            description TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            created_by VARCHAR(100)
                        );
                    """)
                    
                    # 인덱스 생성
                    cursor.execute(f"""
                        CREATE INDEX idx_{self.table_name}_created_at 
                        ON {self.schema}.{self.table_name}(created_at DESC);
                    """)
                    
                    cursor.execute(f"""
                        CREATE INDEX idx_{self.table_name}_name 
                        ON {self.schema}.{self.table_name}(name);
                    """)
                    
                    conn.commit()
                    print(f"[INFO] 타겟 그룹 테이블 생성 완료: {self.schema}.{self.table_name}")
                else:
                    print(f"[INFO] 타겟 그룹 테이블 이미 존재: {self.schema}.{self.table_name}")
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] 테이블 생성/확인 실패: {e}")
            raise
        finally:
            return_db_connection(conn)
    
    def get_all(self) -> List[Dict[str, Any]]:
        """모든 타겟 그룹 조회"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT 
                        id, name, summary, size, tags, filters, 
                        description, created_at, updated_at, created_by
                    FROM {self.schema}.{self.table_name}
                    ORDER BY created_at DESC
                """)
                
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                
                result = []
                for row in rows:
                    row_dict = dict(zip(columns, row))
                    # JSONB를 dict로 변환
                    if row_dict.get('filters'):
                        if isinstance(row_dict['filters'], str):
                            row_dict['filters'] = json.loads(row_dict['filters'])
                    else:
                        row_dict['filters'] = {}
                    
                    # 날짜를 문자열로 변환
                    if row_dict.get('created_at'):
                        row_dict['created_at'] = row_dict['created_at'].isoformat()[:10]
                    if row_dict.get('updated_at'):
                        row_dict['updated_at'] = row_dict['updated_at'].isoformat()[:10]
                    
                    result.append(row_dict)
                
                return result
        finally:
            return_db_connection(conn)
    
    def get_by_id(self, group_id: int) -> Optional[Dict[str, Any]]:
        """ID로 타겟 그룹 조회"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT 
                        id, name, summary, size, tags, filters, 
                        description, created_at, updated_at, created_by
                    FROM {self.schema}.{self.table_name}
                    WHERE id = %s
                """, (group_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(columns, row))
                
                # JSONB를 dict로 변환
                if row_dict.get('filters'):
                    if isinstance(row_dict['filters'], str):
                        row_dict['filters'] = json.loads(row_dict['filters'])
                else:
                    row_dict['filters'] = {}
                
                # 날짜를 문자열로 변환
                if row_dict.get('created_at'):
                    row_dict['created_at'] = row_dict['created_at'].isoformat()[:10]
                if row_dict.get('updated_at'):
                    row_dict['updated_at'] = row_dict['updated_at'].isoformat()[:10]
                
                return row_dict
        finally:
            return_db_connection(conn)
    
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """타겟 그룹 생성"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # filters를 JSONB로 변환
                filters_json = json.dumps(data.get('filters', {}))
                
                cursor.execute(f"""
                    INSERT INTO {self.schema}.{self.table_name}
                    (name, summary, size, tags, filters, description, created_by)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
                    RETURNING id, name, summary, size, tags, filters, 
                              description, created_at, updated_at, created_by
                """, (
                    data.get('name'),
                    data.get('summary'),
                    data.get('size', 0),
                    data.get('tags', []),
                    filters_json,
                    data.get('description'),
                    data.get('created_by')
                ))
                
                row = cursor.fetchone()
                conn.commit()
                
                columns = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(columns, row))
                
                # JSONB를 dict로 변환
                if row_dict.get('filters'):
                    if isinstance(row_dict['filters'], str):
                        row_dict['filters'] = json.loads(row_dict['filters'])
                else:
                    row_dict['filters'] = {}
                
                # 날짜를 문자열로 변환
                if row_dict.get('created_at'):
                    row_dict['created_at'] = row_dict['created_at'].isoformat()[:10]
                if row_dict.get('updated_at'):
                    row_dict['updated_at'] = row_dict['updated_at'].isoformat()[:10]
                
                return row_dict
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] 타겟 그룹 생성 실패: {e}")
            raise
        finally:
            return_db_connection(conn)
    
    def update(self, group_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """타겟 그룹 수정"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # 업데이트할 필드만 동적으로 구성
                update_fields = []
                update_values = []
                
                if 'name' in data:
                    update_fields.append("name = %s")
                    update_values.append(data['name'])
                
                if 'summary' in data:
                    update_fields.append("summary = %s")
                    update_values.append(data['summary'])
                
                if 'size' in data:
                    update_fields.append("size = %s")
                    update_values.append(data['size'])
                
                if 'tags' in data:
                    update_fields.append("tags = %s")
                    update_values.append(data['tags'])
                
                if 'filters' in data:
                    update_fields.append("filters = %s::jsonb")
                    update_values.append(json.dumps(data['filters']))
                
                if 'description' in data:
                    update_fields.append("description = %s")
                    update_values.append(data['description'])
                
                # updated_at 항상 업데이트
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                
                if not update_fields:
                    # 업데이트할 필드가 없으면 기존 데이터 반환
                    return self.get_by_id(group_id)
                
                update_values.append(group_id)
                
                cursor.execute(f"""
                    UPDATE {self.schema}.{self.table_name}
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                    RETURNING id, name, summary, size, tags, filters, 
                              description, created_at, updated_at, created_by
                """, update_values)
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                conn.commit()
                
                columns = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(columns, row))
                
                # JSONB를 dict로 변환
                if row_dict.get('filters'):
                    if isinstance(row_dict['filters'], str):
                        row_dict['filters'] = json.loads(row_dict['filters'])
                else:
                    row_dict['filters'] = {}
                
                # 날짜를 문자열로 변환
                if row_dict.get('created_at'):
                    row_dict['created_at'] = row_dict['created_at'].isoformat()[:10]
                if row_dict.get('updated_at'):
                    row_dict['updated_at'] = row_dict['updated_at'].isoformat()[:10]
                
                return row_dict
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] 타겟 그룹 수정 실패: {e}")
            raise
        finally:
            return_db_connection(conn)
    
    def delete(self, group_id: int) -> bool:
        """타겟 그룹 삭제"""
        self._ensure_table_exists()
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    DELETE FROM {self.schema}.{self.table_name}
                    WHERE id = %s
                """, (group_id,))
                
                deleted = cursor.rowcount > 0
                conn.commit()
                return deleted
        except Exception as e:
            conn.rollback()
            print(f"[ERROR] 타겟 그룹 삭제 실패: {e}")
            raise
        finally:
            return_db_connection(conn)
    
    def get_stats(self) -> Dict[str, Any]:
        """타겟 그룹 통계 조회"""
        try:
            self._ensure_table_exists()
        except Exception as e:
            print(f"[WARN] 테이블 확인 실패 (통계 조회 계속 시도): {e}")
            # 테이블 확인 실패해도 통계 조회는 시도
        
        try:
            conn = get_db_connection()
        except Exception as e:
            print(f"[ERROR] DB 연결 실패: {e}")
            # 연결 실패 시 기본값 반환
            return {
                'totalGroups': 0,
                'totalSize': 0,
                'averageSize': 0,
                'latestCreatedAt': None,
                'largestGroup': None
            }
        
        try:
            with conn.cursor() as cursor:
                # 전체 통계 조회
                cursor.execute(f"""
                    SELECT 
                        COUNT(*) as total_groups,
                        COALESCE(SUM(size), 0) as total_size,
                        COALESCE(AVG(size), 0) as average_size,
                        MAX(created_at) as latest_created_at
                    FROM {self.schema}.{self.table_name}
                """)
                
                stats_row = cursor.fetchone()
                
                # 가장 큰 그룹 조회
                cursor.execute(f"""
                    SELECT id, name, size
                    FROM {self.schema}.{self.table_name}
                    ORDER BY size DESC
                    LIMIT 1
                """)
                
                largest_row = cursor.fetchone()
                
                result = {
                    'totalGroups': stats_row[0] or 0,
                    'totalSize': int(stats_row[1] or 0),
                    'averageSize': int(stats_row[2] or 0),
                    'latestCreatedAt': stats_row[3].isoformat()[:10] if stats_row[3] else None,
                    'largestGroup': None
                }
                
                if largest_row:
                    result['largestGroup'] = {
                        'id': largest_row[0],
                        'name': largest_row[1],
                        'size': largest_row[2]
                    }
                
                return result
        finally:
            return_db_connection(conn)

