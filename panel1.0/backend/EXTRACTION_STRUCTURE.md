# 패널 추출 구조 설명서

## 📊 현재 추출 구조

### 1. 전체 흐름

```
사용자 입력: "서울 20대 남자 100명"
    ↓
[1단계] EnhancedQueryParser.parse()
    - 자연어를 구조화된 쿼리로 변환
    - LLM을 사용하여 JSON 구조 추출
    ↓
[2단계] PanelService.search()
    - 파싱된 쿼리를 받아서 실제 DB 쿼리 생성
    - 규칙 기반 필터 매핑
    ↓
[3단계] PostgreSQL 쿼리 실행
    - core.join_clean 테이블에서 데이터 추출
    - WHERE 조건 적용
    - LIMIT 적용 (목표 수)
    ↓
[4단계] 결과 반환
    - 패널 ID 목록
    - 샘플 데이터
    - 분포 통계
```

## 🗄️ 사용하는 DB 테이블 및 컬럼

### 주요 테이블: `core.join_clean`

이 테이블이 **실제 패널 데이터**를 담고 있는 메인 테이블입니다.

#### 주요 컬럼 구조:

| 컬럼명 | 타입 | 설명 | 예시 값 |
|--------|------|------|---------|
| `respondent_id` | TEXT/VARCHAR | 패널 고유 ID | "w291516899167465" |
| `gender` | TEXT/VARCHAR | 성별 | '남' 또는 '여' |
| `region` | TEXT/VARCHAR | 거주 지역 (시/구 단위) | "서울특별시 성북구", "경기도 평택시" |
| `age_text` | TEXT/VARCHAR | 나이 텍스트 | "1987년 06월 29일 (만 38 세)" |
| `age` | INTEGER | 나이 (숫자) | 38 |
| `birthdate` | DATE | 생년월일 | 1987-06-29 |
| `survey_datetime` | TIMESTAMP | 설문 시각 | 2024-01-15 10:30:00 |
| `q_concat` | TEXT | 질문 답변 번호 연결 | "1,2,3,5,7" |

### 보조 테이블들:

- `core.poll_question`: 질문 텍스트 (질문 관련 검색 시 사용)
- `core.docs_json`: 상세 답변 데이터 (JSONB 형식)

## 🔍 추출 로직 상세

### 1. 테이블 선택

```python
# 질문 관련 키워드가 있으면
if 'question' in text or '질문' in text:
    target_table = 'core.poll_question'
else:
    # 기본: 패널 데이터 테이블
    target_table = 'core.join_clean'
```

### 2. 필터 조건 생성 (WHERE 절)

#### 성별 필터
```python
# 자연어: "남자", "남성", "여자", "여성"
# → DB 값: '남' 또는 '여'
WHERE gender = '남'
```

#### 연령대 필터
```python
# 자연어: "20대", "30대", "40대", "50대"
# → age_text에서 정규식으로 나이 추출
# age_text 형식: "1987년 06월 29일 (만 38 세)"
WHERE CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29
```

#### 지역 필터
```python
# 자연어: "서울", "경기", "부산" 등
# → region 컬럼에서 LIKE 검색
# DB에는 시/구 단위로 저장됨 (예: "서울특별시 성북구")
WHERE region LIKE '%서울%'
```

#### 목표 수 (LIMIT)
```python
# 자연어: "100명"
# → SQL LIMIT 절
LIMIT 100
```

### 3. 실제 실행되는 SQL 예시

**입력**: "서울 20대 남자 100명"

**생성되는 SQL**:
```sql
SELECT respondent_id 
FROM "core"."join_clean"
WHERE region LIKE '%서울%'
  AND CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29
  AND gender = '남'
LIMIT 100
```

### 4. 추가 쿼리들

#### 전체 카운트
```sql
SELECT COUNT(*) AS cnt 
FROM "core"."join_clean"
WHERE [조건들]
```

#### 패널 샘플 (상위 5명)
```sql
SELECT respondent_id, gender, age_text, region 
FROM "core"."join_clean"
WHERE [조건들]
LIMIT 5
```

#### 성별 분포 통계
```sql
SELECT gender, COUNT(*) AS cnt 
FROM "core"."join_clean"
WHERE [조건들]
GROUP BY gender
```

#### 연령대 분포 통계
```sql
SELECT 
  CASE 
    WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 20 AND 29 THEN '20대'
    WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 30 AND 39 THEN '30대'
    WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) BETWEEN 40 AND 49 THEN '40대'
    WHEN CAST(SUBSTRING(age_text FROM '만 (\d+) 세') AS INTEGER) >= 50 THEN '50대+'
    ELSE '기타'
  END AS age_group,
  COUNT(*) AS cnt
FROM "core"."join_clean"
WHERE [조건들]
GROUP BY age_group
```

#### 지역 분포 통계
```sql
SELECT region, COUNT(*) AS cnt 
FROM "core"."join_clean"
WHERE [조건들]
GROUP BY region 
ORDER BY cnt DESC 
LIMIT 10
```

## 📝 데이터 흐름

### 입력 → 출력

1. **사용자 입력**: "서울 20대 남자 100명"

2. **파싱 결과**:
   ```python
   {
     'text': '서울 20대 남자 100명',
     'extracted_chips': ['서울', '20대', '남자', '100명(목표)'],
     'filters': {...}
   }
   ```

3. **DB 쿼리 실행**:
   - 조건에 맞는 총 패널 수: 756명
   - LIMIT 100 적용
   - 실제 추출: 100명

4. **반환 데이터**:
   ```json
   {
     "extractedChips": ["서울", "20대", "남자", "100명(목표)"],
     "previewData": [
       {"columnHuman": "지역", "columnRaw": "region", "operator": "LIKE", "value": "서울"},
       {"columnHuman": "연령", "columnRaw": "age_text", "operator": "BETWEEN", "value": "20-29세"},
       {"columnHuman": "성별", "columnRaw": "gender", "operator": "=", "value": "남"}
     ],
     "estimatedCount": 756,
     "panelIds": ["w291516899167465", "w462602481665114", ...],  // 100개
     "samplePanels": [
       {"id": "w291516899167465", "gender": "남", "age": "만 25 세", "region": "서울특별시 성북구"},
       ...
     ],
     "distributionStats": {
       "gender": [{"label": "남", "value": 60}, {"label": "여", "value": 40}],
       "age": [{"label": "20대", "value": 100}],
       "region": [{"label": "서울특별시 성북구", "value": 15}, ...]
     },
     "sqlQuery": "SELECT respondent_id FROM \"core\".\"join_clean\" WHERE ... LIMIT 100"
   }
   ```

## ⚠️ 주의사항

1. **지역 필터링**: 
   - DB에는 시/구 단위로 저장됨 (예: "서울특별시 성북구")
   - 자연어에서는 "서울"만 입력해도 `LIKE '%서울%'`로 검색
   - 정확한 매칭이 아닌 부분 일치 검색

2. **연령 추출**:
   - `age_text` 컬럼에서 정규식으로 나이 추출
   - 형식: "1987년 06월 29일 (만 38 세)"
   - `SUBSTRING(age_text FROM '만 (\d+) 세')`로 숫자만 추출

3. **목표 수 vs 실제 매칭 수**:
   - `estimatedCount`: 조건에 맞는 전체 패널 수 (LIMIT 없이)
   - `panelIds.length`: 실제 추출된 패널 수 (LIMIT 적용)

4. **컬럼 존재 여부 확인**:
   - `information_schema.columns`로 테이블의 실제 컬럼 확인
   - 존재하지 않는 컬럼은 자동 스킵하고 경고 메시지 추가

