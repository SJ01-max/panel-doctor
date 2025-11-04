"""패널 검색 서비스"""
from typing import Dict, Any, List
from app.db.connection import get_db_connection
from app.services.sql_service import execute_sql_safe


class PanelService:
    """패널 검색 및 관련 비즈니스 로직"""
    
    def search(self, parsed_query: Dict[str, Any]) -> Dict[str, Any]:
        """
        파싱된 쿼리를 기반으로 패널 검색
        
        Args:
            parsed_query: 파싱된 쿼리 딕셔너리
            
        Returns:
            검색 결과 딕셔너리
        """
        # 간단 규칙 기반 자연어 → 조건 매핑 (+ 안전 SELECT)
        # - 키워드 포함 시 대상 테이블 결정
        # - respondent의 경우 간단한 성별/연령대(20/30/40/50대) 조건을 WHERE로 적용
        # - 존재하지 않는 컬럼은 자동 스킵하고 warnings에 기록
        text = str(parsed_query.get('text', '')).lower()
        target_table = None
        if 'respondent' in text:
            target_table = 'public.respondent'
        elif 'question' in text:
            target_table = 'public.question'

        extracted_chips: List[str] = [w for w in parsed_query.get('text', '').split() if w]

        try:
            if target_table is None:
                # public 스키마에서 첫 번째 테이블 선택
                rows = execute_sql_safe(
                    query=(
                        "SELECT table_schema, table_name "
                        "FROM information_schema.tables "
                        "WHERE table_schema='public' "
                        "ORDER BY table_name LIMIT 1"
                    ),
                    limit=1,
                )
                if rows:
                    target_table = f"public.{rows[0]['table_name']}"

            # 질의에 성별/연령 키워드가 포함되어 있는데 대상 테이블이 아직 없으면 respondent로 가정
            if target_table is None:
                has_gender_or_age = any(k in text for k in ['남자','남성','여자','여성','20대','30대','40대','50대'])
                if has_gender_or_age:
                    chk = execute_sql_safe(
                        query=(
                            "SELECT 1 FROM information_schema.tables "
                            "WHERE table_schema='public' AND table_name='respondent'"
                        ),
                        limit=1,
                    )
                    if chk:
                        target_table = 'public.respondent'

            preview_rows: List[Dict[str, Any]] = []
            estimated_count: int = 0
            warnings: List[str] = []

            if target_table:
                where_clauses: List[str] = []
                params: Dict[str, Any] = {}

                # 대상 테이블에 어떤 컬럼이 있는지 미리 조회하여 가드
                cols = execute_sql_safe(
                    query=(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema='public' AND table_name=%(t)s"
                    ),
                    params={"t": target_table.split('.')[-1]},
                    limit=200,
                )
                available_cols = {c['column_name'] for c in cols}

                # 성별 매핑 (DB 값: '남' / '여')
                gender_value = None
                if '남자' in text or '남성' in text or '남 ' in text or text.endswith('남'):
                    gender_value = '남'
                elif '여자' in text or '여성' in text or '여 ' in text or text.endswith('여'):
                    gender_value = '여'
                if gender_value and 'gender' in available_cols:
                    where_clauses.append("gender = %(gender)s")
                    params['gender'] = gender_value
                elif gender_value:
                    warnings.append("gender 컬럼이 없어 성별 필터를 건너뜀")

                # 연령대 매핑 (20/30/40/50대)
                decade_map = {
                    '20대': (20, 29),
                    '30대': (30, 39),
                    '40대': (40, 49),
                    '50대': (50, 59),
                }
                for token, (a, b) in decade_map.items():
                    if token in text:
                        if 'age' in available_cols:
                            where_clauses.append("age BETWEEN %(age_from)s AND %(age_to)s")
                            params['age_from'] = a
                            params['age_to'] = b
                        elif 'birthdate' in available_cols:
                            # birthdate가 있을 경우 현재 나이를 계산하여 범위 필터
                            where_clauses.append(
                                "(EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM birthdate)::int) BETWEEN %(age_from)s AND %(age_to)s"
                            )
                            params['age_from'] = a
                            params['age_to'] = b
                        else:
                            warnings.append("age/birthdate 컬럼이 없어 연령대 필터를 건너뜀")
                        break

                # 미리보기 및 카운트 쿼리 구성
                where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

                preview_rows = execute_sql_safe(
                    query=f"SELECT * FROM {target_table}{where_sql}",
                    params=params,
                    limit=10,
                )
                count_row = execute_sql_safe(
                    query=f"SELECT COUNT(*) AS cnt FROM {target_table}{where_sql}",
                    params=params,
                    limit=1,
                )
                estimated_count = int(count_row[0]['cnt']) if count_row else 0
                panel_ids: List[str] = []
                # respondent 테이블이면 rid 컬럼을 panelIds로 사용 (필터 동일 적용)
                if target_table == 'public.respondent':
                    if 'rid' in available_cols:
                        rid_rows = execute_sql_safe(
                            query=f"SELECT rid FROM {target_table}{where_sql}",
                            params=params,
                            limit=200,
                        )
                        panel_ids = [str(r.get('rid')) for r in rid_rows if 'rid' in r]
                    else:
                        warnings.append("rid 컬럼이 없어 panelIds를 채울 수 없음")
            else:
                return {
                    'extractedChips': extracted_chips,
                    'previewData': [],
                    'estimatedCount': 0,
                    'warnings': ['public 스키마에서 테이블을 찾지 못했습니다.'],
                    'panelIds': []
                }

            # panelIds는 스키마를 몰라서 빈 값으로 반환 (데모)
            return {
                'extractedChips': extracted_chips,
                'previewData': [],
                'estimatedCount': estimated_count,
                'warnings': ([f'미리보기는 {target_table} 기준 10건입니다.'] + warnings),
                'panelIds': panel_ids if target_table == 'public.respondent' else []
            }
        except Exception as e:
            return {
                'extractedChips': extracted_chips,
                'previewData': [],
                'estimatedCount': 0,
                'warnings': [str(e)],
                'panelIds': []
            }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """대시보드 데이터 조회"""
        # 실제 DB 연결이 가능한 경우 간단한 예시 쿼리를 통해 값 확인
        # 실패 시 데모용 정적 데이터를 반환합니다.
        try:
            sample_rows = execute_sql_safe(
                query="SELECT 1 AS value",
                params={},
                limit=1,
                statement_timeout_ms=1000,
            )
            alive = True if sample_rows else False
        except Exception:
            alive = False

        kpi_data: List[Dict[str, Any]] = [
            {
                'title': '총 패널 수',
                'value': '35,000명',
                'change': '+2.5%',
                'icon': 'ri-user-3-line',
                'color': '#18C08F',
            },
            {
                'title': '오늘 처리 건수',
                'value': '127건',
                'change': '+15.3%',
                'icon': 'ri-database-2-line',
                'color': '#2F6BFF',
            },
            {
                'title': '평균 응답 시간',
                'value': '1.2초',
                'change': '-8.1%',
                'icon': 'ri-time-line',
                'color': '#FFC757',
            },
            {
                'title': '질의 성공률',
                'value': '94.2%',
                'change': '+1.8%',
                'icon': 'ri-check-double-line',
                'color': '#00C2A8',
            },
        ]

        recent_queries: List[Dict[str, Any]] = [
            {
                'id': 1,
                'query': '서울 거주 20대 남성 중 운동을 주 3회 이상 하는 사람 100명',
                'chips': ['서울', '20대', '남성', '운동 3회+', '100명'],
                'status': 'success',
                'time': '2분 전',
                'executor': '김데이터',
                'resultCount': 98,
            },
            {
                'id': 2,
                'query': '부산 30대 여성 중 직장인이면서 자녀가 있는 사람',
                'chips': ['부산', '30대', '여성', '직장인', '자녀 있음'],
                'status': 'warning',
                'time': '15분 전',
                'executor': '이분석',
                'resultCount': 156,
            },
            {
                'id': 3,
                'query': '전국 40대 이상 고혈압 환자 중 약물 복용 중인 사람',
                'chips': ['전국', '40대+', '고혈압', '약물 복용'],
                'status': 'success',
                'time': '1시간 전',
                'executor': '박연구',
                'resultCount': 2341,
            },
        ]

        return {
            'kpiData': kpi_data,
            'recentQueries': recent_queries,
            'dbAlive': alive,
        }
