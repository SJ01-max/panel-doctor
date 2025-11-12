"""SQL 실행 유틸리티 (SELECT 전용, 안전장치 포함)"""
from typing import Any, Dict, List, Sequence
import re
from contextlib import contextmanager
from app.db.connection import get_db_connection, return_db_connection


_FORBIDDEN_PATTERNS = [
    r";",  # 다중문장 차단
    r"--",  # 라인 주석 차단
    r"/\*",  # 블록 주석 시작 차단
    r"\\\\",  # 백슬래시 이스케이프 남용 차단
]

_ALLOWED_FIRST_WORDS = {"select", "with"}


def _assert_safe_select(query: str) -> None:
    normalized = query.strip().lower()
    if not any(normalized.startswith(w) for w in _ALLOWED_FIRST_WORDS):
        raise ValueError("SELECT/WITH로 시작하는 읽기 전용 쿼리만 허용됩니다.")
    for pat in _FORBIDDEN_PATTERNS:
        if re.search(pat, normalized):
            raise ValueError("위험한 구문(세미콜론/주석/이스케이프)이 포함되어 있습니다.")


@contextmanager
def _db_cursor_with_timeout(statement_timeout_ms: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 쿼리 타임아웃 (ms)
            cur.execute(f"SET LOCAL statement_timeout = {int(statement_timeout_ms)};")
            yield conn, cur
    finally:
        return_db_connection(conn)


def execute_sql_safe(
    query: str,
    params: Dict[str, Any] | Sequence[Any] | None = None,
    *,
    limit: int = 200,
    statement_timeout_ms: int = 5000,
) -> List[Dict[str, Any]]:
    """
    안전한 읽기 전용 SQL 실행 함수.
    - SELECT/WITH만 허용
    - 세미콜론/주석 차단
    - 서버측 statement_timeout 적용
    - 결과는 최대 limit 행으로 제한
    """
    if not query:
        raise ValueError("쿼리가 비어 있습니다.")

    _assert_safe_select(query)

    limited_query = f"WITH _orig AS ({query}) SELECT * FROM _orig LIMIT {int(limit)}"

    with _db_cursor_with_timeout(statement_timeout_ms) as (conn, cur):
        cur.execute(limited_query, params or None)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        result = [dict(zip(columns, row)) for row in rows]
        return result


