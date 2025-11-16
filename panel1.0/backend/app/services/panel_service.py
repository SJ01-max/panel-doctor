"""패널 검색 서비스"""
from typing import Dict, Any, List
import re
from app.db.connection import get_db_connection
from app.services.sql_service import execute_sql_safe


class PanelService:
    """패널 검색 및 관련 비즈니스 로직"""
    
    def search(self, parsed_query: Dict[str, Any], previous_panel_ids: List[str] | None = None) -> Dict[str, Any]:
        """
        파싱된 쿼리를 기반으로 패널 검색
        
        Args:
            parsed_query: 파싱된 쿼리 딕셔너리
            previous_panel_ids: 이전 추출 결과의 패널 ID 목록 (후속 질의 시 사용)
            
        Returns:
            검색 결과 딕셔너리
        """
        # 간단 규칙 기반 자연어 → 조건 매핑 (+ 안전 SELECT)
        # - 키워드 포함 시 대상 테이블 결정
        # - 실제 데이터는 core.join_clean 테이블에 있음
        # - 성별/연령대(20/30/40/50대) 조건을 WHERE로 적용
        # - 존재하지 않는 컬럼은 자동 스킵하고 warnings에 기록
        text = str(parsed_query.get('text', '')).lower()
        target_table = None
        
        # 질문 관련 키워드가 있으면 question 테이블 검색
        if 'question' in text or '질문' in text:
            # core.poll_question 테이블 확인
            chk = execute_sql_safe(
                query=(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema='core' AND table_name='poll_question'"
                ),
                limit=1,
            )
            if chk:
                target_table = 'core.poll_question'
        else:
            # 기본적으로 core.join_clean 테이블 사용 (실제 패널 데이터)
            chk = execute_sql_safe(
                query=(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema='core' AND table_name='join_clean'"
                ),
                limit=1,
            )
            if chk:
                target_table = 'core.join_clean'

        extracted_chips: List[str] = [w for w in parsed_query.get('text', '').split() if w]
        
        # 목표 수 추출 (예: "100명" -> 100)
        target_limit: int = None
        limit_match = re.search(r'(\d{1,4})\s*명', text)
        if limit_match:
            target_limit = int(limit_match.group(1))
            # extracted_chips에서 "100명" 같은 패턴을 찾아서 목표 수로 표시
            for i, chip in enumerate(extracted_chips):
                if '명' in chip and re.search(r'\d+', chip):
                    extracted_chips[i] = f"{chip}(목표)"

        try:
            # 대상 테이블이 없으면 경고
            if target_table is None:
                return {
                    'extractedChips': extracted_chips,
                    'previewData': [],
                    'estimatedCount': 0,
                    'warnings': ['core.join_clean 테이블을 찾을 수 없습니다.'],
                    'panelIds': [],
                    'samplePanels': [],
                    'distributionStats': {'gender': [], 'age': [], 'region': []},
                    'sqlQuery': ''
                }

            preview_rows: List[Dict[str, Any]] = []
            estimated_count: int = 0
            warnings: List[str] = []

            if target_table:
                where_clauses: List[str] = []
                params: Dict[str, Any] = {}
                
                # 대상 테이블에 어떤 컬럼이 있는지 미리 조회하여 가드
                schema_name, table_name = target_table.split('.')
                cols = execute_sql_safe(
                    query=(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema=%(schema)s AND table_name=%(tbl)s"
                    ),
                    params={"schema": schema_name, "tbl": table_name},
                    limit=200,
                )
                available_cols = {c['column_name'] for c in cols}
                
                # 이전 추출 결과가 있으면 WHERE 조건에 추가
                if previous_panel_ids and len(previous_panel_ids) > 0:
                    # respondent_id IN (...) 조건 추가
                    # SQL injection 방지를 위해 파라미터화된 쿼리 사용
                    if 'respondent_id' in available_cols:
                        # IN 절 사용 (튜플로 변환하여 안전하게 처리)
                        # psycopg2는 튜플을 IN 절에 안전하게 바인딩할 수 있음
                        where_clauses.append("respondent_id IN %(previous_panel_ids)s")
                        params['previous_panel_ids'] = tuple(previous_panel_ids)

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
                # age_text 컬럼에서 연령대 추출 (예: "1987년 06월 29일 (만 38 세)")
                decade_map = {
                    '20대': (20, 29),
                    '30대': (30, 39),
                    '40대': (40, 49),
                    '50대': (50, 59),
                }
                for token, (a, b) in decade_map.items():
                    if token in text:
                        if 'age_text' in available_cols:
                            # age_text에서 연령 추출하여 필터링
                            # age_text 형식: "1987년 06월 29일 (만 38 세)"
                            where_clauses.append(
                                "CAST(SUBSTRING(age_text FROM '만 (\\d+) 세') AS INTEGER) BETWEEN %(age_from)s AND %(age_to)s"
                            )
                            params['age_from'] = a
                            params['age_to'] = b
                        elif 'age' in available_cols:
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
                            warnings.append("age/age_text/birthdate 컬럼이 없어 연령대 필터를 건너뜀")
                        break
                
                # 지역 필터 (region 컬럼)
                region_keywords = {
                    '서울': '서울',
                    '부산': '부산',
                    '대구': '대구',
                    '인천': '인천',
                    '광주': '광주',
                    '대전': '대전',
                    '울산': '울산',
                    '경기': '경기',
                    '강원': '강원',
                    '충북': '충북',
                    '충남': '충남',
                    '전북': '전북',
                    '전남': '전남',
                    '경북': '경북',
                    '경남': '경남',
                    '제주': '제주',
                }
                for keyword, region_value in region_keywords.items():
                    if keyword in text and 'region' in available_cols:
                        where_clauses.append("region LIKE %(region)s")
                        params['region'] = f'%{region_value}%'
                        break

                # 미리보기 및 카운트 쿼리 구성
                where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
                
                # LIMIT 적용 (목표 수가 있으면 사용, 없으면 제한 없음 - 매우 큰 값 사용)
                # execute_sql_safe가 항상 LIMIT을 추가하므로, 제한 없이 가져오려면 매우 큰 값 사용
                limit_value = target_limit if target_limit else 999999
                limit_sql = f" LIMIT {limit_value}" if target_limit else ""

                # previewData 생성 (필터 정보를 구조화)
                preview_data: List[Dict[str, Any]] = []
                
                # 성별 필터
                if gender_value and 'gender' in available_cols:
                    preview_data.append({
                        'columnHuman': '성별',
                        'columnRaw': 'gender',
                        'operator': '=',
                        'value': gender_value
                    })
                
                # 연령대 필터
                for token, (a, b) in decade_map.items():
                    if token in text:
                        if 'age_text' in available_cols:
                            preview_data.append({
                                'columnHuman': '연령',
                                'columnRaw': 'age_text',
                                'operator': 'BETWEEN',
                                'value': f'{a}-{b}세'
                            })
                        elif 'age' in available_cols:
                            preview_data.append({
                                'columnHuman': '연령',
                                'columnRaw': 'age',
                                'operator': 'BETWEEN',
                                'value': f'{a}-{b}세'
                            })
                        break
                
                # 지역 필터
                for keyword, region_value in region_keywords.items():
                    if keyword in text and 'region' in available_cols:
                        preview_data.append({
                            'columnHuman': '지역',
                            'columnRaw': 'region',
                            'operator': 'LIKE',
                            'value': region_value
                        })
                        break

                # 스키마와 테이블명을 따옴표로 감싸서 쿼리 실행
                preview_rows = execute_sql_safe(
                    query=f'SELECT * FROM "{schema_name}"."{table_name}"{where_sql}',
                    params=params,
                    limit=10,
                )
                # 전체 카운트 (LIMIT 없이)
                count_row = execute_sql_safe(
                    query=f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{table_name}"{where_sql}',
                    params=params,
                    limit=1,
                )
                estimated_count = int(count_row[0]['cnt']) if count_row else 0
                
                # 목표 수가 있으면 경고 추가
                if target_limit and estimated_count > target_limit:
                    warnings.append(f'조건에 맞는 패널이 {estimated_count}명이지만, 요청하신 {target_limit}명으로 제한합니다.')
                elif target_limit and estimated_count < target_limit:
                    warnings.append(f'조건에 맞는 패널이 {estimated_count}명으로 요청하신 {target_limit}명보다 적습니다.')
                
                panel_ids: List[str] = []
                sample_panels: List[Dict[str, Any]] = []
                distribution_stats: Dict[str, Any] = {
                    'gender': [],
                    'age': [],
                    'region': []
                }
                # 실제 SQL 쿼리 (디버깅용 - 실제 실행된 쿼리 포함)
                # COUNT 쿼리
                count_query = f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{table_name}"{where_sql}'
                # 실제 추출 쿼리 (execute_sql_safe가 LIMIT을 추가하므로 쿼리에는 LIMIT 포함하지 않음)
                if target_limit:
                    actual_sql_query: str = f'SELECT respondent_id FROM "{schema_name}"."{table_name}"{where_sql} LIMIT {limit_value}'
                else:
                    actual_sql_query: str = count_query
                
                # 디버깅: 실제 적용된 필터 조건 로그
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"[패널 검색] 적용된 필터: {where_clauses}")
                logger.info(f"[패널 검색] 파라미터: {params}")
                logger.info(f"[패널 검색] COUNT 쿼리: {count_query}")
                logger.info(f"[패널 검색] 실제 추출 쿼리: {actual_sql_query}")
                
                # core.join_clean 테이블이면 respondent_id 컬럼을 panelIds로 사용
                if target_table == 'core.join_clean':
                    if 'respondent_id' in available_cols:
                        # 목표 수만큼만 가져오기
                        # execute_sql_safe가 자체적으로 LIMIT을 추가하므로, 쿼리에는 LIMIT을 포함하지 않고 limit 파라미터만 전달
                        rid_rows = execute_sql_safe(
                            query=f'SELECT respondent_id FROM "{schema_name}"."{table_name}"{where_sql}',
                            params=params,
                            limit=limit_value,
                        )
                        panel_ids = [str(r.get('respondent_id')) for r in rid_rows if 'respondent_id' in r]
                        
                        # 패널 샘플 데이터 (상위 5명, 목표 수보다 작으면 목표 수만큼)
                        sample_limit = min(5, limit_value) if target_limit else 5
                        # execute_sql_safe가 자체적으로 LIMIT을 추가하므로, 쿼리에는 LIMIT을 포함하지 않고 limit 파라미터만 전달
                        sample_rows = execute_sql_safe(
                            query=f'SELECT respondent_id, gender, age_text, region FROM "{schema_name}"."{table_name}"{where_sql}',
                            params=params,
                            limit=sample_limit,
                        )
                        for row in sample_rows:
                            sample_panels.append({
                                'id': str(row.get('respondent_id', '')),
                                'gender': row.get('gender', 'N/A'),
                                'age': row.get('age_text', 'N/A'),
                                'region': row.get('region', 'N/A')
                            })
                        
                        # 성별 분포 통계
                        if 'gender' in available_cols:
                            gender_stats = execute_sql_safe(
                                query=f'SELECT gender, COUNT(*) AS cnt FROM "{schema_name}"."{table_name}"{where_sql} GROUP BY gender',
                                params=params,
                                limit=10,
                            )
                            distribution_stats['gender'] = [
                                {'label': row.get('gender', 'N/A'), 'value': int(row.get('cnt', 0))}
                                for row in gender_stats
                            ]
                        
                        # 연령대 분포 통계
                        if 'age_text' in available_cols:
                            age_stats = execute_sql_safe(
                                query=(
                                    f'SELECT '
                                    f'CASE '
                                    f'  WHEN CAST(SUBSTRING(age_text FROM \'만 (\\d+) 세\') AS INTEGER) BETWEEN 20 AND 29 THEN \'20대\' '
                                    f'  WHEN CAST(SUBSTRING(age_text FROM \'만 (\\d+) 세\') AS INTEGER) BETWEEN 30 AND 39 THEN \'30대\' '
                                    f'  WHEN CAST(SUBSTRING(age_text FROM \'만 (\\d+) 세\') AS INTEGER) BETWEEN 40 AND 49 THEN \'40대\' '
                                    f'  WHEN CAST(SUBSTRING(age_text FROM \'만 (\\d+) 세\') AS INTEGER) >= 50 THEN \'50대+\' '
                                    f'  ELSE \'기타\' '
                                    f'END AS age_group, '
                                    f'COUNT(*) AS cnt '
                                    f'FROM "{schema_name}"."{table_name}"{where_sql} '
                                    f'GROUP BY age_group'
                                ),
                                params=params,
                                limit=10,
                            )
                            distribution_stats['age'] = [
                                {'label': row.get('age_group', 'N/A'), 'value': int(row.get('cnt', 0))}
                                for row in age_stats if row.get('age_group')
                            ]
                        
                        # 지역 분포 통계
                        if 'region' in available_cols:
                            region_stats = execute_sql_safe(
                                query=f'SELECT region, COUNT(*) AS cnt FROM "{schema_name}"."{table_name}"{where_sql} GROUP BY region ORDER BY cnt DESC LIMIT 10',
                                params=params,
                                limit=10,
                            )
                            distribution_stats['region'] = [
                                {'label': row.get('region', 'N/A'), 'value': int(row.get('cnt', 0))}
                                for row in region_stats
                            ]
                    else:
                        warnings.append("respondent_id 컬럼이 없어 panelIds를 채울 수 없음")
            else:
                return {
                    'extractedChips': extracted_chips,
                    'previewData': [],
                    'estimatedCount': 0,
                    'warnings': ['public 스키마에서 테이블을 찾지 못했습니다.'],
                    'panelIds': [],
                    'samplePanels': [],
                    'distributionStats': {'gender': [], 'age': [], 'region': []},
                    'sqlQuery': ''
                }

            # 디버깅 정보 추가
            debug_info = {
                'appliedFilters': where_clauses,
                'filterParams': params,
                'countQuery': f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{table_name}"{where_sql}',
                'extractQuery': actual_sql_query if target_limit else None,
            }
            
            return {
                'extractedChips': extracted_chips,
                'previewData': preview_data,
                'estimatedCount': estimated_count,
                'warnings': ([f'미리보기는 {target_table} 기준 10건입니다.'] + warnings),
                'panelIds': panel_ids,
                'samplePanels': sample_panels,
                'distributionStats': distribution_stats,
                'sqlQuery': actual_sql_query,
                'debugInfo': debug_info  # 디버깅 정보 추가
            }
        except Exception as e:
            return {
                'extractedChips': extracted_chips,
                'previewData': [],
                'estimatedCount': 0,
                'warnings': [str(e)],
                'panelIds': [],
                'samplePanels': [],
                'distributionStats': {'gender': [], 'age': [], 'region': []},
                'sqlQuery': ''
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

        # 실제 DB 테이블 통계 조회
        db_stats: Dict[str, Any] = {}
        table_samples: Dict[str, List[Dict[str, Any]]] = {}
        
        if alive:
            try:
                # 모든 스키마의 주요 테이블 목록 조회 (core, staging, public 등)
                tables = execute_sql_safe(
                    query=(
                        "SELECT table_schema, table_name FROM information_schema.tables "
                        "WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') "
                        "  AND table_type='BASE TABLE' "
                        "ORDER BY table_schema, table_name"
                    ),
                    limit=50,
                )
                
                for tbl in tables:
                    schema_name = tbl['table_schema']
                    tbl_name = tbl['table_name']
                    full_table_name = f"{schema_name}.{tbl_name}"
                    
                    try:
                        # 테이블 건수 조회 (스키마 포함)
                        count_row = execute_sql_safe(
                            query=f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{tbl_name}"',
                            limit=1,
                        )
                        db_stats[full_table_name] = int(count_row[0]['cnt']) if count_row else 0
                        
                        # 샘플 데이터 3건 미리보기
                        if db_stats[full_table_name] > 0:
                            sample = execute_sql_safe(
                                query=f'SELECT * FROM "{schema_name}"."{tbl_name}" LIMIT 3',
                                limit=3,
                            )
                            table_samples[full_table_name] = sample
                    except Exception as e:
                        db_stats[full_table_name] = None
                        print(f"테이블 {full_table_name} 조회 실패: {e}")
            except Exception as e:
                print(f"테이블 목록 조회 실패: {e}")
                pass

        # KPI 데이터 (실제 DB 통계 반영)
        kpi_data: List[Dict[str, Any]] = []
        
        if alive and db_stats:
            # core.join_clean 테이블 (정제된 패널 데이터)
            join_clean_count = db_stats.get('core.join_clean', 0)
            if join_clean_count > 0:
                kpi_data.append({
                    'title': '총 패널 수 (join_clean)',
                    'value': f'{join_clean_count:,}명',
                    'change': '',
                    'icon': 'ri-user-3-line',
                    'color': '#18C08F',
                })
            
            # core.docs_json 테이블 (LLM용 JSON 데이터)
            docs_json_count = db_stats.get('core.docs_json', 0)
            if docs_json_count > 0:
                kpi_data.append({
                    'title': 'JSON 문서 수 (docs_json)',
                    'value': f'{docs_json_count:,}건',
                    'change': '',
                    'icon': 'ri-database-2-line',
                    'color': '#2F6BFF',
                })
            
            # staging._merged_join 테이블
            merged_join_count = db_stats.get('staging._merged_join', 0)
            if merged_join_count > 0:
                kpi_data.append({
                    'title': '병합 조인 데이터',
                    'value': f'{merged_join_count:,}건',
                    'change': '',
                    'icon': 'ri-file-merge-line',
                    'color': '#FFC757',
                })
            
            # staging._merged_summary 테이블
            merged_summary_count = db_stats.get('staging._merged_summary', 0)
            if merged_summary_count > 0:
                kpi_data.append({
                    'title': '병합 요약 데이터',
                    'value': f'{merged_summary_count:,}건',
                    'change': '',
                    'icon': 'ri-file-list-3-line',
                    'color': '#00C2A8',
                })
            
            # 기타 테이블들
            for tbl_name, count in db_stats.items():
                if tbl_name not in ['core.join_clean', 'core.docs_json', 'staging._merged_join', 'staging._merged_summary'] and count is not None and count > 0:
                    kpi_data.append({
                        'title': f'{tbl_name}',
                        'value': f'{count:,}건',
                        'change': '',
                        'icon': 'ri-database-2-line',
                        'color': '#9CA3AF',
                    })
        
        # DB 연결 실패 시 데모 데이터
        if not kpi_data:
            kpi_data = [
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
            'dbStats': db_stats,
            'tableSamples': table_samples,
        }
