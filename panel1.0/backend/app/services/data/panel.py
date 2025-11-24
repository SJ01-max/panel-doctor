"""
패널 데이터 서비스 (core_v2 스키마)
"""
from typing import Dict, Any, List
from app.services.data.executor import execute_sql_safe

# Stopword 필터 (설문조사 맥락에서 의미 없는 단어들)
STOPWORDS = {
    '있다', '없다', '같다', '그렇다', '아니다',  # Common verbs
    '브랜드', '제품', '서비스', '이용', '사용', '구매', '경우', '정도',  # General nouns
    '모델명', '시리즈', '개인소득', '월평균', '직업', '직무', '질문', '응답', '선택', '기타',  # Survey meta words
    '모름', '해당없음', '무응답', '최근', '가장', '주로', '평소'  # Adverbs/Nulls
}


class PanelDataService:
    """패널 데이터 접근 서비스 (core_v2 스키마)"""
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """대시보드 데이터 조회 (core_v2 스키마)"""
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

        db_stats: Dict[str, Any] = {}
        table_samples: Dict[str, List[Dict[str, Any]]] = {}
        
        if alive:
            try:
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
                        count_row = execute_sql_safe(
                            query=f'SELECT COUNT(*) AS cnt FROM "{schema_name}"."{tbl_name}"',
                            limit=1,
                        )
                        db_stats[full_table_name] = int(count_row[0]['cnt']) if count_row else 0
                        
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

        kpi_data: List[Dict[str, Any]] = []
        
        if alive and db_stats:
            # core_v2.respondent 테이블
            respondent_count = db_stats.get('core_v2.respondent', 0)
            if respondent_count > 0:
                kpi_data.append({
                    'title': '총 패널 수 (respondent)',
                    'value': f'{respondent_count:,}명',
                    'change': '',
                    'icon': 'ri-user-3-line',
                    'color': '#18C08F',
                })
            
            # core_v2.respondent_json 테이블
            json_count = db_stats.get('core_v2.respondent_json', 0)
            if json_count > 0:
                kpi_data.append({
                    'title': 'JSON 문서 수 (respondent_json)',
                    'value': f'{json_count:,}건',
                    'change': '',
                    'icon': 'ri-database-2-line',
                    'color': '#2F6BFF',
                })
            
            # core_v2.panel_embedding 테이블
            embedding_count = db_stats.get('core_v2.panel_embedding', 0)
            if embedding_count > 0:
                kpi_data.append({
                    'title': '임베딩 벡터 수 (panel_embedding)',
                    'value': f'{embedding_count:,}건',
                    'change': '',
                    'icon': 'ri-file-merge-line',
                    'color': '#FFC757',
                })

        if not kpi_data:
            kpi_data = [
                {
                    'title': '총 패널 수',
                    'value': '35,000명',
                    'change': '+2.5%',
                    'icon': 'ri-user-3-line',
                    'color': '#18C08F',
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
        ]

        panel_summary: Dict[str, Any] = {
            'totalPanels': 0,
            'genderDistribution': [],
            'ageDistribution': [],
            'regionDistribution': []
        }
        
        if alive:
            try:
                # 총 패널 수
                total_count_row = execute_sql_safe(
                    query='SELECT COUNT(*) AS cnt FROM "core_v2"."respondent"',
                    limit=1,
                )
                panel_summary['totalPanels'] = int(total_count_row[0]['cnt']) if total_count_row else 0
                
                # 성별 분포
                gender_stats = execute_sql_safe(
                    query='SELECT gender, COUNT(*) AS cnt FROM "core_v2"."respondent" GROUP BY gender',
                    limit=10,
                )
                
                gender_map = {
                    '남': '남성',
                    '여': '여성',
                    'M': '남성',
                    'F': '여성'
                }
                
                gender_totals = {'남성': 0, '여성': 0}
                
                for row in gender_stats:
                    gender_raw = row.get('gender')
                    if gender_raw is None:
                        continue
                    gender_value = str(gender_raw).strip()
                    if not gender_value:
                        continue
                    
                    gender_display = gender_map.get(gender_value, gender_value)
                    count = int(row.get('cnt', 0))
                    
                    if gender_display == '남성' or gender_value in ['남', 'M']:
                        gender_totals['남성'] += count
                    elif gender_display == '여성' or gender_value in ['여', 'F']:
                        gender_totals['여성'] += count
                
                panel_summary['genderDistribution'] = []
                if gender_totals['남성'] > 0:
                    panel_summary['genderDistribution'].append({
                        'name': '남성',
                        'value': gender_totals['남성'],
                        'color': '#2F6BFF'
                    })
                if gender_totals['여성'] > 0:
                    panel_summary['genderDistribution'].append({
                        'name': '여성',
                        'value': gender_totals['여성'],
                        'color': '#8B5CF6'
                    })
                
                # 연령대 분포 (10대부터 80대+까지 모든 연령대)
                try:
                    print("[DEBUG] 연령대 분포 쿼리 실행 시작")
                    # GROUP BY에서 숫자 위치 사용 (execute_sql_safe의 WITH 래핑과 충돌 방지)
                    age_stats = execute_sql_safe(
                        query=(
                            'SELECT '
                            '  CASE '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 10 AND 19 THEN \'10대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 20 AND 29 THEN \'20대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 30 AND 39 THEN \'30대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 40 AND 49 THEN \'40대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 50 AND 59 THEN \'50대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 60 AND 69 THEN \'60대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 70 AND 79 THEN \'70대\' '
                            '    WHEN (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) >= 80 THEN \'80대+\' '
                            '    ELSE NULL '
                            '  END AS age_group, '
                            '  COUNT(*) AS cnt '
                            'FROM "core_v2"."respondent" '
                            'WHERE birth_year IS NOT NULL '
                            '  AND (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) BETWEEN 10 AND 120 '
                            'GROUP BY 1 '
                            'HAVING 1 IS NOT NULL '
                            'ORDER BY 1'
                        ),
                        limit=20,  # 모든 연령대 포함을 위해 충분히 큰 값으로 설정
                    )
                    
                    print(f"[DEBUG] 연령대 분포 쿼리 실행 결과: {len(age_stats) if age_stats else 0}개 행")
                    if age_stats:
                        print(f"[DEBUG] 연령대 분포 원본 데이터: {age_stats[:5]}")  # 처음 5개만 출력
                        
                    if age_stats:
                        age_distribution = [
                            {
                                'age': row.get('age_group', 'N/A'),
                                'count': int(row.get('cnt', 0))
                            }
                            for row in age_stats if row.get('age_group')
                        ]
                        print(f"[DEBUG] 연령대 분포 조회 결과: {len(age_distribution)}개 - {[item['age'] for item in age_distribution]}")
                        panel_summary['ageDistribution'] = age_distribution
                    else:
                        print("[DEBUG] 연령대 분포 조회 결과 없음 (age_stats가 None이거나 빈 리스트)")
                        panel_summary['ageDistribution'] = []
                except Exception as e:
                    import traceback
                    print(f"[ERROR] 연령대 분포 조회 오류: {e}")
                    print(f"[ERROR] 트레이스백: {traceback.format_exc()}")
                    panel_summary['ageDistribution'] = []
                
                # 지역 분포
                try:
                    region_stats = execute_sql_safe(
                        query=(
                            'SELECT region, COUNT(*) AS cnt '
                            'FROM "core_v2"."respondent" '
                            'WHERE region IS NOT NULL AND region != \'\' '
                            'GROUP BY region '
                            'ORDER BY cnt DESC '
                            'LIMIT 4'
                        ),
                        limit=4,
                    )
                    
                    colors = ['#2F6BFF', '#5B8DEF', '#8B5CF6', '#A8A8A8']
                    panel_summary['regionDistribution'] = [
                        {
                            'name': (row.get('region', 'N/A') or 'N/A')[:15],
                            'value': int(row.get('cnt', 0)),
                            'color': colors[i % len(colors)]
                        }
                        for i, row in enumerate(region_stats) if row.get('region')
                    ]
                except Exception as e:
                    print(f"지역 분포 조회 오류: {e}")
                    panel_summary['regionDistribution'] = []
                
                # 키워드 추출 (json_doc 텍스트에서 자주 나오는 키워드)
                try:
                    print("[DEBUG] 키워드 추출 시작")
                    # JSON 텍스트에서 자주 나오는 키워드 추출
                    # 성능 최적화: LIMIT으로 샘플링 및 타임아웃 증가
                    # 불필요한 질문 문구 제외하고 실제 관심사 키워드만 추출
                    keyword_stats = execute_sql_safe(
                        query=(
                            'SELECT '
                            '  keyword, '
                            '  COUNT(*) as cnt '
                            'FROM ('
                            '  SELECT '
                            '    regexp_split_to_table(LOWER(json_doc::text), \'[^가-힣a-zA-Z0-9]+\') as keyword '
                            '  FROM ('
                            '    SELECT json_doc '
                            '    FROM "core_v2"."respondent_json" '
                            '    WHERE json_doc IS NOT NULL '
                            '    LIMIT 5000 '
                            '  ) AS sample_data '
                            ') AS keywords '
                            'WHERE keyword != \'\' '
                            '  AND LENGTH(keyword) >= 2 '
                            '  AND LENGTH(keyword) <= 10 '
                            '  AND keyword NOT IN ('
                            '    \'null\', \'true\', \'false\', \'json\', \'doc\', \'poll\', \'question\', \'answer\', \'option\', \'code\', \'text\', \'value\', \'numeric\', '
                            '    \'respondent\', \'id\', \'gender\', \'region\', \'district\', \'carrier\', \'birth\', \'year\', \'age\', \'polls\', \'answers\', '
                            '    \'대\', \'세\', \'년\', \'월\', \'일\', \'시\', \'분\', \'초\', '
                            '    \'여러분은\', \'여러분이\', \'무엇인가요\', \'무엇\', \'어떤\', \'가장\', \'주로\', \'위해\', \'보유\', \'경험\', '
                            '    \'흡연경험\', \'월평균\', \'성별\', \'나이\', \'지역\', \'질문\', \'응답\', \'선택\', \'항목\', '
                            '    \'다음\', \'이상\', \'이하\', \'미만\', \'초과\', \'중\', \'및\', \'또는\', \'그리고\', \'모두\', '
                            '    \'있습니까\', \'있나요\', \'있습니다\', \'있어요\', \'하십니까\', \'하나요\', \'하세요\', '
                            '    \'입니다\', \'입니까\', \'인가요\', \'인지\', \'인가\', \'인지요\', '
                            '    \'선택해주세요\', \'선택\', \'주세요\', \'해주세요\', \'해주시\', \'해주\', '
                            '    \'보유전제품\', \'보유차량여부\', \'결혼여부\', \'최종학력\', \'음용경험\', \'여부\', '
                            '    \'얼마나\', \'어느\', \'어디\', \'언제\', \'누구\', \'왜\', \'어떻게\', '
                            '    \'단말기\', \'기기\', \'제품\', \'상품\', \'서비스\', \'회사\', \'업체\', '
                            '    \'경우\', \'때문\', \'이유\', \'원인\', \'결과\', \'효과\', \'영향\' '
                            '  ) '
                            '  AND keyword NOT LIKE \'%는%\' '
                            '  AND keyword NOT LIKE \'%이%\' '
                            '  AND keyword NOT LIKE \'%가%\' '
                            '  AND keyword NOT LIKE \'%을%\' '
                            '  AND keyword NOT LIKE \'%를%\' '
                            '  AND keyword NOT LIKE \'%의%\' '
                            '  AND keyword NOT LIKE \'%에%\' '
                            '  AND keyword NOT LIKE \'%에서%\' '
                            '  AND keyword NOT LIKE \'%으로%\' '
                            '  AND keyword NOT LIKE \'%로%\' '
                            '  AND keyword NOT LIKE \'%와%\' '
                            '  AND keyword NOT LIKE \'%과%\' '
                            '  AND keyword NOT LIKE \'%도%\' '
                            '  AND keyword NOT LIKE \'%만%\' '
                            '  AND keyword NOT LIKE \'%부터%\' '
                            '  AND keyword NOT LIKE \'%까지%\' '
                            '  AND keyword NOT LIKE \'%보다%\' '
                            '  AND keyword NOT LIKE \'%처럼%\' '
                            '  AND keyword NOT LIKE \'%같이%\' '
                            '  AND keyword NOT LIKE \'%만큼%\' '
                            '  AND keyword NOT LIKE \'%정도%\' '
                            '  AND keyword NOT LIKE \'%여부%\' '
                            '  AND keyword NOT LIKE \'%경험%\' '
                            '  AND keyword NOT LIKE \'%전제품%\' '
                            '  AND keyword NOT LIKE \'%해주%\' '
                            '  AND keyword NOT LIKE \'%주세요%\' '
                            '  AND keyword NOT LIKE \'%학력%\' '
                            '  AND keyword NOT LIKE \'%차량%\' '
                            '  AND keyword NOT LIKE \'%결혼%\' '
                            '  AND keyword NOT LIKE \'%음용%\' '
                            '  AND keyword NOT LIKE \'%단말%\' '
                            '  AND keyword NOT LIKE \'%기기%\' '
                            '  AND keyword NOT LIKE \'%제품%\' '
                            '  AND keyword NOT LIKE \'%상품%\' '
                            '  AND keyword NOT LIKE \'%서비스%\' '
                            '  AND keyword NOT LIKE \'%회사%\' '
                            '  AND keyword NOT LIKE \'%업체%\' '
                            '  AND keyword NOT LIKE \'%경우%\' '
                            '  AND keyword NOT LIKE \'%때문%\' '
                            '  AND keyword NOT LIKE \'%이유%\' '
                            '  AND keyword NOT LIKE \'%원인%\' '
                            '  AND keyword NOT LIKE \'%결과%\' '
                            '  AND keyword NOT LIKE \'%효과%\' '
                            '  AND keyword NOT LIKE \'%영향%\' '
                            '  AND keyword NOT LIKE \'%얼마%\' '
                            '  AND keyword NOT LIKE \'%어느%\' '
                            '  AND keyword NOT LIKE \'%어디%\' '
                            '  AND keyword NOT LIKE \'%언제%\' '
                            '  AND keyword NOT LIKE \'%누구%\' '
                            '  AND keyword NOT LIKE \'%왜%\' '
                            '  AND keyword NOT LIKE \'%어떻게%\' '
                            'GROUP BY keyword '
                            'HAVING COUNT(*) >= 5 '
                            'ORDER BY cnt DESC '
                            'LIMIT 20'
                        ),
                        limit=20,
                        statement_timeout_ms=30000,  # 30초로 증가
                    )
                    
                    print(f"[DEBUG] 키워드 추출 결과: {len(keyword_stats) if keyword_stats else 0}개")
                    if keyword_stats:
                        print(f"[DEBUG] 키워드 샘플 (필터링 전): {[row.get('keyword', '') for row in keyword_stats[:10]]}")
                    
                    if keyword_stats:
                        # Stopword 필터 적용 (Python에서 필터링)
                        filtered_keywords = [
                            row for row in keyword_stats 
                            if row.get('keyword', '').lower() not in STOPWORDS
                        ]
                        print(f"[DEBUG] Stopword 필터링 후: {len(filtered_keywords)}개")
                        if filtered_keywords:
                            print(f"[DEBUG] 필터링된 키워드 샘플: {[row.get('keyword', '') for row in filtered_keywords[:10]]}")
                        
                        # 상위 키워드만 선택 (최대 15-20개)
                        top_keywords = filtered_keywords[:20] if filtered_keywords else []
                        panel_summary['trendingKeywords'] = [
                            {
                                'keyword': row.get('keyword', ''),
                                'count': int(row.get('cnt', 0))
                            }
                            for row in top_keywords
                        ]
                    else:
                        print("[DEBUG] 키워드 추출 결과 없음")
                        panel_summary['trendingKeywords'] = []
                except Exception as e:
                    import traceback
                    print(f"[ERROR] 키워드 추출 오류: {e}")
                    print(f"[ERROR] 트레이스백: {traceback.format_exc()}")
                    panel_summary['trendingKeywords'] = []
                
            except Exception as e:
                print(f"패널 통계 조회 실패: {e}")
        
        return {
            'kpiData': kpi_data,
            'recentQueries': recent_queries,
            'dbAlive': alive,
            'dbStats': db_stats,
            'tableSamples': table_samples,
            'panelSummary': panel_summary,
        }
    
    def get_health_data(self) -> Dict[str, Any]:
        """데이터 품질 진단 데이터 조회 (core_v2 스키마)"""
        try:
            # 1. 전체 패널 수
            total_result = execute_sql_safe(
                query='SELECT COUNT(*) AS total FROM "core_v2"."respondent"',
                limit=1,
            )
            total = int(total_result[0]['total']) if total_result else 0
            
            if total == 0:
                return {
                    'score': 0,
                    'total': 0,
                    'complete': 0,
                    'profileCompleteness': 0,
                    'contactValidity': 0,
                    'marketingConsent': 0,
                }
            
            # 2. 프로필 완성도: 필수 필드(birth_year, gender, region)가 모두 채워진 비율
            profile_complete_result = execute_sql_safe(
                query=(
                    'SELECT COUNT(*) AS complete_count '
                    'FROM "core_v2"."respondent" '
                    'WHERE birth_year IS NOT NULL '
                    '  AND gender IS NOT NULL '
                    '  AND region IS NOT NULL'
                ),
                limit=1,
            )
            profile_complete = int(profile_complete_result[0]['complete_count']) if profile_complete_result else 0
            profile_completeness = round((profile_complete / total) * 100, 1) if total > 0 else 0
            
            # 3. 연락처 유효성: district(상세 주소)가 있는 비율 (연락처 정보의 일부로 간주)
            contact_valid_result = execute_sql_safe(
                query=(
                    'SELECT COUNT(*) AS valid_count '
                    'FROM "core_v2"."respondent" '
                    'WHERE district IS NOT NULL '
                    '  AND district != \'\''
                ),
                limit=1,
            )
            contact_valid = int(contact_valid_result[0]['valid_count']) if contact_valid_result else 0
            contact_validity = round((contact_valid / total) * 100, 1) if total > 0 else 0
            
            # 4. 마케팅 수신 동의: json_doc에 마케팅 관련 키워드가 있는 비율 (샘플링)
            # 실제로는 json_doc 구조를 확인해야 하지만, 일단 샘플링으로 추정
            marketing_sample_result = execute_sql_safe(
                query=(
                    'SELECT COUNT(*) AS sample_count '
                    'FROM ('
                    '  SELECT DISTINCT respondent_id '
                    '  FROM "core_v2"."respondent_json" '
                    '  WHERE json_doc::text LIKE \'%마케팅%\' '
                    '     OR json_doc::text LIKE \'%수신%\' '
                    '     OR json_doc::text LIKE \'%동의%\' '
                    '  LIMIT 10000'
                    ') AS sample'
                ),
                limit=1,
            )
            marketing_sample = int(marketing_sample_result[0]['sample_count']) if marketing_sample_result else 0
            
            # json_doc이 있는 총 패널 수 (샘플링)
            json_total_result = execute_sql_safe(
                query=(
                    'SELECT COUNT(DISTINCT respondent_id) AS json_count '
                    'FROM "core_v2"."respondent_json" '
                    'LIMIT 10000'
                ),
                limit=1,
            )
            json_total = int(json_total_result[0]['json_count']) if json_total_result else 0
            marketing_consent = round((marketing_sample / json_total) * 100, 1) if json_total > 0 else 0
            
            # 5. 전체 점수 계산 (가중 평균)
            # 프로필 완성도 50%, 연락처 유효성 30%, 마케팅 동의 20%
            overall_score = round(
                (profile_completeness * 0.5) + 
                (contact_validity * 0.3) + 
                (marketing_consent * 0.2),
                0
            )
            
            return {
                'score': int(overall_score),
                'total': total,
                'complete': profile_complete,
                'profileCompleteness': profile_completeness,
                'contactValidity': contact_validity,
                'marketingConsent': marketing_consent,
            }
            
        except Exception as e:
            print(f"[ERROR] 데이터 품질 진단 오류: {e}")
            import traceback
            print(f"[ERROR] 트레이스백: {traceback.format_exc()}")
            return {
                'score': 0,
                'total': 0,
                'complete': 0,
                'profileCompleteness': 0,
                'contactValidity': 0,
                'marketingConsent': 0,
            }

