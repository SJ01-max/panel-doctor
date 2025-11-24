"""
welcome2 + Excel 35개 메타데이터 생성 및 response 재적재 통합 스크립트
"""

import os
import sys
import glob
import re
import logging
from typing import Optional, List
from decimal import Decimal
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch, RealDictCursor
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def get_connection():
    db_host = os.environ.get('DB_HOST')
    db_port = os.environ.get('DB_PORT', '5432')
    db_name = os.environ.get('DB_NAME')
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    
    if not all([db_host, db_name, db_user, db_password]):
        raise ValueError("필수 환경변수가 설정되지 않았습니다.")
    
    conn = psycopg2.connect(
        host=db_host,
        port=int(db_port),
        database=db_name,
        user=db_user,
        password=db_password,
        connect_timeout=30
    )
    conn.set_client_encoding('UTF8')
    return conn


def truncate_all_tables(conn):
    """모든 메타데이터 및 response 테이블 TRUNCATE"""
    cursor = conn.cursor()
    try:
        cursor.execute("TRUNCATE TABLE core_v2.question_meta CASCADE")
        cursor.execute("TRUNCATE TABLE core_v2.option_meta CASCADE")
        cursor.execute("TRUNCATE TABLE core_v2.response CASCADE")
        conn.commit()
        logger.info("모든 메타데이터 및 response 테이블 TRUNCATE 완료")
    except Exception as e:
        logger.error(f"TRUNCATE 실패: {e}")
        traceback.print_exc()
        raise
    finally:
        cursor.close()


def parse_option_codes(value) -> List[str]:
    """문항 응답 값을 파싱하여 option_code 리스트 반환 (multi-select 분리)"""
    if pd.isna(value) or value == '':
        return []
    
    # 숫자인 경우 정수로 변환 후 문자열로 (1.0 -> "1")
    try:
        if isinstance(value, (int, float)):
            # 정수인 경우 정수로, 실수인 경우 정수 부분만
            int_val = int(value)
            return [str(int_val)]
    except (ValueError, TypeError):
        pass
    
    value_str = str(value).strip()
    if not value_str:
        return []
    
    # 쉼표로 분리
    options = [opt.strip() for opt in value_str.split(',')]
    # 빈 문자열 제거 및 숫자 정규화 (1.0 -> 1)
    normalized_options = []
    for opt in options:
        if opt:
            try:
                # 숫자인 경우 정수로 변환
                float_val = float(opt)
                int_val = int(float_val)
                normalized_options.append(str(int_val))
            except (ValueError, TypeError):
                # 숫자가 아니면 그대로
                normalized_options.append(opt)
    
    return normalized_options


def parse_numeric_value(value) -> Optional[Decimal]:
    """값이 순수 숫자로만 이루어져 있으면 Decimal로 변환, 아니면 None"""
    if pd.isna(value) or value == '':
        return None
    
    value_str = str(value).strip()
    if not value_str:
        return None
    
    # 쉼표 제거 후 숫자 체크
    value_clean = value_str.replace(',', '')
    try:
        num_val = float(value_clean)
        return Decimal(str(num_val))
    except (ValueError, OverflowError):
        return None


def parse_vals_string(vals_str: str) -> dict:
    """
    vals 문자열을 파싱하여 {option_code: option_text} 딕셔너리 반환
    
    예시: "{1:Manager, 2:Sales, 3:Student}" -> {1: 'Manager', 2: 'Sales', 3: 'Student'}
    """
    if pd.isna(vals_str) or not vals_str:
        return {}
    
    vals_str = str(vals_str).strip()
    if not vals_str:
        return {}
    
    # 중괄호 제거
    vals_str = vals_str.strip('{}')
    if not vals_str:
        return {}
    
    result = {}
    
    # 정규식으로 "숫자:텍스트" 패턴 찾기
    # 패턴: 숫자로 시작, 콜론, 그 다음 텍스트 (콜론과 쉼표 사이 또는 끝까지)
    pattern = r'(\d+):([^,}]+)'
    matches = re.findall(pattern, vals_str)
    
    for match in matches:
        option_code = match[0].strip()
        option_text = match[1].strip()
        if option_code and option_text:
            try:
                code_int = int(option_code)
                result[code_int] = option_text
            except ValueError:
                # 숫자가 아니면 문자열로 저장
                result[option_code] = option_text
    
    return result


def load_welcome2_meta(conn, question_text_map_override=None):
    """
    welcome2 메타데이터 생성
    
    Args:
        question_text_map_override: {question_code: question_text} 딕셔너리.
                                    제공되면 이 값을 우선 사용 (예: {'Q1': '성별', 'Q2': '연령'})
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # welcome2_data의 컬럼명 조회 (질문 코드 기준)
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'staging'
              AND table_name = 'welcome2_data'
              AND column_name != 'mb_sn'
              AND LOWER(column_name) LIKE 'q%'
            ORDER BY ordinal_position
        """)
        question_columns = [row['column_name'] for row in cursor.fetchall()]
        
        logger.info(f"welcome2_data 질문 컬럼: {len(question_columns)}개")
        
        # 사용자가 제공한 질문 텍스트 맵이 있으면 우선 사용
        question_text_map = {}
        if question_text_map_override:
            question_text_map = question_text_map_override.copy()
            logger.info(f"사용자 제공 welcome2 질문 텍스트: {len(question_text_map)}개")
        
        # welcome2_label에서 질문 텍스트 추출 시도 (사용자 제공 데이터가 없을 때만)
        if not question_text_map:
            try:
                # welcome2_label 테이블 구조 확인
                cursor.execute("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'staging'
                      AND table_name = 'welcome2_label'
                    ORDER BY ordinal_position
                """)
                label_columns = [row['column_name'] for row in cursor.fetchall()]
                
                # "문항" 컬럼이 있는지 확인
                question_text_col = None
                variable_name_col = None
                for col in label_columns:
                    col_lower = str(col).lower()
                    if '문항' in col_lower or 'question' in col_lower or 'text' in col_lower:
                        question_text_col = col
                    if '변수' in col_lower or 'variable' in col_lower or 'name' in col_lower:
                        variable_name_col = col
                
                if question_text_col and variable_name_col:
                    # "문항" 컬럼과 "변수명" 컬럼이 있는 경우
                    cursor.execute(f"""
                        SELECT "{variable_name_col}", "{question_text_col}"
                        FROM staging.welcome2_label
                        WHERE "{variable_name_col}" IS NOT NULL
                          AND "{question_text_col}" IS NOT NULL
                    """)
                    rows = cursor.fetchall()
                    for row in rows:
                        var_name = str(row[variable_name_col]).strip()
                        q_text = str(row[question_text_col]).strip()
                        # 변수명이 Q로 시작하고, 질문 텍스트가 옵션 텍스트가 아닌 경우
                        if var_name.upper().startswith('Q') and q_text and len(q_text) > 0:
                            # 옵션 텍스트 패턴 제외 (숫자로 시작하거나 "1 ", "2 " 같은 패턴)
                            if not re.match(r'^\d+\s', q_text) and not q_text.isdigit():
                                question_code = var_name.upper()
                                question_text_map[question_code] = q_text
                                logger.info(f"  {question_code}: 질문 텍스트 발견 - {q_text[:80]}...")
                else:
                    # 각 Q 컬럼의 첫 번째 행에서 질문 텍스트 찾기
                    # welcome2_label의 모든 행을 확인
                    cursor.execute("""
                        SELECT *
                        FROM staging.welcome2_label
                        ORDER BY id
                        LIMIT 50
                    """)
                    label_rows = cursor.fetchall()
                    
                    # 각 질문 컬럼에 대해 질문 텍스트 찾기
                    for col in question_columns:
                        col_lower = str(col).lower()
                        if col_lower.startswith('q'):
                            question_code = col.upper() if col[0] == 'q' else col
                            # welcome2_label에 동일한 컬럼명이 있으면 해당 컬럼의 값들을 확인
                            if col in label_columns or question_code in label_columns:
                                label_col = col if col in label_columns else question_code
                                
                                # 각 행을 확인하여 질문 텍스트 후보 찾기
                                # 질문 텍스트는 보통 첫 번째 행에 있고, 옵션 텍스트는 숫자로 시작하지 않음
                                for row in label_rows:
                                    question_text_val = row.get(label_col)
                                    if question_text_val and pd.notna(question_text_val):
                                        question_text_str = str(question_text_val).strip()
                                        # 질문 텍스트 후보 판별:
                                        # 1. 숫자로 시작하지 않음 (옵션은 "1 미혼", "2 기혼" 형식)
                                        # 2. 길이가 적절함 (너무 짧지 않음)
                                        # 3. 옵션 텍스트 패턴이 아님
                                        if (len(question_text_str) >= 2 and 
                                            not re.match(r'^\d+\s', question_text_str) and 
                                            not question_text_str.isdigit() and
                                            not question_text_str.startswith('(')):
                                            # 이미 찾은 질문 텍스트가 없거나, 더 긴 텍스트를 우선
                                            if question_code not in question_text_map or len(question_text_str) > len(question_text_map[question_code]):
                                                question_text_map[question_code] = question_text_str
                                                logger.info(f"  {question_code}: 질문 텍스트 발견 - {question_text_str[:80]}...")
                                                break  # 첫 번째로 찾은 질문 텍스트 사용
            except Exception as e:
                logger.warning(f"welcome2_label에서 질문 텍스트 추출 시도 실패: {e}")
                import traceback
                traceback.print_exc()
        
        # question_meta 레코드 생성
        question_records = []
        for col in question_columns:
            col_lower = str(col).lower()
            if col_lower.startswith('q'):
                question_code = col.upper() if col[0] == 'q' else col
                question_text = question_text_map.get(question_code)  # 있으면 사용, 없으면 None
                question_records.append({
                    'poll_code': 'welcome2',
                    'question_code': question_code,
                    'question_text': question_text
                })
        
        if question_text_map:
            logger.info(f"welcome2_label에서 {len(question_text_map)}개 질문 텍스트 매핑 발견")
        
        if question_records:
            insert_sql = """
                INSERT INTO core_v2.question_meta
                (poll_code, question_code, question_text)
                VALUES (%(poll_code)s, %(question_code)s, %(question_text)s)
                ON CONFLICT (poll_code, question_code) DO UPDATE SET
                    question_text = EXCLUDED.question_text
            """
            execute_batch(cursor, insert_sql, question_records, page_size=10000)
            logger.info(f"welcome2 question_meta inserted = {len(question_records)} rows")
        
        # option_meta: welcome2_data에서 실제 응답값의 모든 unique 값 수집
        # welcome2_label은 참고용이고, 실제 응답값이 option_meta가 되어야 함
        option_map = {}  # {question_code: set(option_code)}
        
        # welcome2_data에서 각 질문별 unique 응답값 수집 (multi-select 분리 포함)
        for col in question_columns:
            col_lower = str(col).lower()
            if col_lower.startswith('q'):
                question_code = col.upper() if col[0] == 'q' else col
                
                cursor.execute(f"""
                    SELECT DISTINCT "{col}"
                    FROM staging.welcome2_data
                    WHERE "{col}" IS NOT NULL
                      AND "{col}" != ''
                """)
                unique_rows = cursor.fetchall()
                unique_values = [row[col] for row in unique_rows]
                
                option_codes = set()
                for value in unique_values:
                    if pd.notna(value):
                        # multi-select 분리
                        codes = parse_option_codes(value)
                        for code in codes:
                            if code:
                                option_codes.add(str(code).strip())
                
                if option_codes:
                    option_map[question_code] = option_codes
        
        logger.info(f"welcome2_data에서 {len(option_map)}개 질문의 옵션 코드 발견")
        
        # core.poll_option에서 직접 데이터 가져오기
        # core.poll_option 구조: poll_code(실제로는 질문 코드), q_no, opt_no, opt_text
        # core_v2.option_meta 구조: poll_code, question_code, option_code, option_text
        # 매핑: 
        #   - core.poll_option.poll_code -> core_v2.option_meta.question_code (Q9_2, Q11_1 등)
        #   - core.poll_option.opt_no -> core_v2.option_meta.option_code
        #   - core.poll_option.opt_text -> core_v2.option_meta.option_text
        #   - poll_code는 'welcome2'로 고정
        try:
            # core.poll_option에서 welcome2 관련 질문 코드 찾기
            # welcome2_data의 컬럼명과 매칭되는 질문 코드들 조회
            # 먼저 welcome2_data의 컬럼명 목록 가져오기
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'staging'
                  AND table_name = 'welcome2_data'
                  AND column_name != 'mb_sn'
                  AND LOWER(column_name) LIKE 'q%'
                ORDER BY ordinal_position
            """)
            welcome2_question_cols = [row['column_name'] for row in cursor.fetchall()]
            
            if not welcome2_question_cols:
                logger.warning("welcome2_data에서 질문 컬럼을 찾을 수 없습니다.")
                raise Exception("welcome2_data 질문 컬럼 없음")
            
            # 컬럼명 목록을 SQL IN 절에 사용 (대소문자 구분 없이)
            question_cols_upper = [col.upper() for col in welcome2_question_cols]
            question_cols_lower = [col.lower() for col in welcome2_question_cols]
            
            # SQL 쿼리에서 IN 절 사용
            placeholders = ','.join(['%s'] * len(question_cols_upper))
            cursor.execute(f"""
                SELECT DISTINCT poll_code as question_code, opt_no, opt_text
                FROM core.poll_option
                WHERE UPPER(poll_code) IN ({placeholders})
                   OR LOWER(poll_code) IN ({placeholders})
                ORDER BY poll_code, opt_no
            """, question_cols_upper + question_cols_lower)
            poll_option_rows = cursor.fetchall()
            
            logger.info(f"core.poll_option에서 {len(poll_option_rows)}개 옵션 발견 (질문 컬럼: {len(welcome2_question_cols)}개)")
            
            if len(poll_option_rows) == 0:
                logger.warning("core.poll_option에 welcome2 관련 데이터가 없습니다. welcome2_data 기반으로 생성합니다.")
                raise Exception("core.poll_option에 welcome2 데이터 없음")
            
            # option_meta 레코드 생성
            option_records = []
            for row in poll_option_rows:
                question_code = str(row['question_code']).strip().upper()
                opt_no = row['opt_no']
                opt_text = row['opt_text']
                
                # opt_no를 option_code로 변환 (문자열)
                option_code = str(opt_no)
                
                # opt_text가 NULL이면 option_code 사용
                if pd.isna(opt_text) or not opt_text:
                    option_text = option_code
                else:
                    option_text = str(opt_text).strip()
                
                option_records.append({
                    'poll_code': 'welcome2',
                    'question_code': question_code,
                    'option_code': option_code,
                    'option_text': option_text
                })
            
            if option_records:
                insert_sql = """
                    INSERT INTO core_v2.option_meta
                    (poll_code, question_code, option_code, option_text)
                    VALUES (%(poll_code)s, %(question_code)s, %(option_code)s, %(option_text)s)
                    ON CONFLICT (poll_code, question_code, option_code) DO UPDATE SET
                        option_text = EXCLUDED.option_text
                """
                execute_batch(cursor, insert_sql, option_records, page_size=10000)
                logger.info(f"welcome2 option_meta inserted = {len(option_records)} rows (core.poll_option에서)")
        except Exception as e:
            logger.warning(f"core.poll_option에서 옵션 메타데이터 추출 실패: {e}")
            traceback.print_exc()
            # 실패 시 기존 로직 사용 (welcome2_data 기반)
            logger.info("기존 로직으로 fallback: welcome2_data 기반 option_meta 생성")
            option_records = []
            for question_code, option_codes in option_map.items():
                for option_code in option_codes:
                    option_records.append({
                        'poll_code': 'welcome2',
                        'question_code': question_code,
                        'option_code': option_code,
                        'option_text': option_code  # fallback: option_code 그대로 사용
                    })
            
            if option_records:
                insert_sql = """
                    INSERT INTO core_v2.option_meta
                    (poll_code, question_code, option_code, option_text)
                    VALUES (%(poll_code)s, %(question_code)s, %(option_code)s, %(option_text)s)
                    ON CONFLICT (poll_code, question_code, option_code) DO NOTHING
                """
                execute_batch(cursor, insert_sql, option_records, page_size=10000)
                logger.info(f"welcome2 option_meta inserted = {len(option_records)} rows (fallback)")
        
    except Exception as e:
        logger.error(f"welcome2 메타데이터 적재 실패: {e}")
        traceback.print_exc()
        raise
    finally:
        cursor.close()


def load_welcome_2nd_meta(conn, excel_file: str):
    """welcome_2nd.xlsx 메타데이터 생성 (Type B)"""
    file_name = os.path.basename(excel_file)
    poll_code = os.path.splitext(file_name)[0]
    
    logger.info(f"처리 중 (Type B): {file_name}")
    
    cursor = conn.cursor()
    
    try:
        # Meta Sheet 읽기 (Sheet1 또는 'label' 시트)
        meta_sheet_name = None
        try:
            # 먼저 'label' 시트 시도
            df_meta = pd.read_excel(excel_file, sheet_name='label', engine='openpyxl')
            meta_sheet_name = 'label'
        except:
            try:
                # Sheet1 시도
                df_meta = pd.read_excel(excel_file, sheet_name=1, engine='openpyxl')
                meta_sheet_name = 1
            except:
                # Sheet0 시도
                df_meta = pd.read_excel(excel_file, sheet_name=0, engine='openpyxl')
                meta_sheet_name = 0
        
        if df_meta.empty:
            logger.warning(f"  {file_name}: Meta 시트에 데이터가 없습니다.")
            return
        
        # 컬럼명 확인 및 정규화
        df_meta.columns = df_meta.columns.str.strip()
        
        # 필수 컬럼 확인
        required_cols = ['variable', 'label', 'vals']
        missing_cols = [col for col in required_cols if col not in df_meta.columns]
        if missing_cols:
            logger.warning(f"  {file_name}: 필수 컬럼이 없습니다: {missing_cols}")
            return
        
        # question_meta 및 option_meta 레코드 생성
        question_records = []
        option_records = []
        
        for _, row in df_meta.iterrows():
            variable = row.get('variable')
            label = row.get('label')
            vals = row.get('vals')
            
            if pd.isna(variable) or not variable:
                continue
            
            question_code = str(variable).strip().upper()
            question_text = str(label).strip() if pd.notna(label) else None
            
            # question_meta 추가
            question_records.append({
                'poll_code': poll_code,
                'question_code': question_code,
                'question_text': question_text
            })
            
            # vals 파싱하여 option_meta 생성
            if pd.notna(vals) and vals:
                option_map = parse_vals_string(vals)
                for option_code, option_text in option_map.items():
                    option_records.append({
                        'poll_code': poll_code,
                        'question_code': question_code,
                        'option_code': str(option_code),
                        'option_text': str(option_text)
                    })
        
        # DB에 삽입
        if question_records:
            insert_sql = """
                INSERT INTO core_v2.question_meta
                (poll_code, question_code, question_text)
                VALUES (%(poll_code)s, %(question_code)s, %(question_text)s)
                ON CONFLICT (poll_code, question_code) DO UPDATE SET
                    question_text = EXCLUDED.question_text
            """
            execute_batch(cursor, insert_sql, question_records, page_size=10000)
            logger.info(f"  {file_name} question_meta inserted = {len(question_records)} rows")
        
        if option_records:
            insert_sql = """
                INSERT INTO core_v2.option_meta
                (poll_code, question_code, option_code, option_text)
                VALUES (%(poll_code)s, %(question_code)s, %(option_code)s, %(option_text)s)
                ON CONFLICT (poll_code, question_code, option_code) DO NOTHING
            """
            execute_batch(cursor, insert_sql, option_records, page_size=10000)
            logger.info(f"  {file_name} option_meta inserted = {len(option_records)} rows")
        
    except Exception as e:
        logger.error(f"  {file_name} 처리 실패: {e}")
        traceback.print_exc()
        raise
    finally:
        cursor.close()


def load_excel35_meta(conn, base_dir: str):
    """Excel 35개 메타데이터 생성 (Type A)"""
    pattern = os.path.join(base_dir, "qpoll_join_*.xlsx")
    excel_files = glob.glob(pattern)
    excel_files.sort()
    
    if not excel_files:
        logger.warning(f"엑셀 파일을 찾을 수 없습니다: {pattern}")
        return
    
    logger.info(f"발견된 엑셀 파일: {len(excel_files)}개")
    
    cursor = conn.cursor()
    
    total_question_meta = 0
    total_option_meta = 0
    
    try:
        for excel_file in excel_files:
            file_name = os.path.basename(excel_file)
            poll_code = os.path.splitext(file_name)[0]
            
            logger.info(f"처리 중: {file_name}")
            
            try:
                # Sheet1에서 실제 질문 컬럼 확인 먼저 ("문항1", "문항2" 등)
                df_sheet1 = pd.read_excel(
                    excel_file,
                    sheet_name=0,
                    header=1,
                    engine='openpyxl'
                )
                
                # "문항1", "문항2", ... 컬럼 찾기
                question_cols = []
                for col in df_sheet1.columns:
                    col_str = str(col)
                    match = re.search(r'(?:문항|Q)(\d+)', col_str, re.IGNORECASE)
                    if match:
                        question_num = int(match.group(1))
                        question_cols.append((question_num, col))
                
                question_cols.sort(key=lambda x: x[0])
                
                if not question_cols:
                    logger.warning(f"  {file_name}: 질문 컬럼('문항1', 'Q1' 등)을 찾을 수 없습니다.")
                    continue
                
                # Sheet2 읽기 (header=None으로 읽어서 구조 파악)
                df_sheet2_raw = pd.read_excel(
                    excel_file,
                    sheet_name=1,
                    header=None,
                    engine='openpyxl'
                )
                
                if df_sheet2_raw.empty or len(df_sheet2_raw) < 1:
                    logger.warning(f"  {file_name}: Sheet2에 데이터가 없습니다.")
                    continue
                
                # 첫 번째 행에서 헤더 찾기
                first_row = df_sheet2_raw.iloc[0]
                question_title_col_idx = None
                option_col_indices = {}  # {option_num: col_idx}
                
                for col_idx, val in enumerate(first_row):
                    if pd.notna(val):
                        val_str = str(val).strip()
                        if '설문제목' in val_str or ('문항' in val_str and '보기' not in val_str):
                            question_title_col_idx = col_idx
                        elif '보기' in val_str and 'CNT' not in val_str:
                            match = re.search(r'보기(\d+)', val_str)
                            if match:
                                option_num = int(match.group(1))
                                option_col_indices[option_num] = col_idx
                
                # 헤더를 찾지 못한 경우, 두 번째 행도 확인
                if question_title_col_idx is None and len(df_sheet2_raw) > 1:
                    second_row = df_sheet2_raw.iloc[1]
                    for col_idx, val in enumerate(second_row):
                        if pd.notna(val):
                            val_str = str(val).strip()
                            if '설문제목' in val_str or ('문항' in val_str and '보기' not in val_str):
                                question_title_col_idx = col_idx
                            elif '보기' in val_str and 'CNT' not in val_str:
                                match = re.search(r'보기(\d+)', val_str)
                                if match:
                                    option_num = int(match.group(1))
                                    if option_num not in option_col_indices:
                                        option_col_indices[option_num] = col_idx
                
                if question_title_col_idx is None:
                    logger.warning(f"  {file_name}: Sheet2에서 '설문제목' 컬럼을 찾을 수 없습니다.")
                    continue
                
                if not option_col_indices:
                    logger.warning(f"  {file_name}: Sheet2에서 '보기' 컬럼을 찾을 수 없습니다.")
                    continue
                
                # option_columns를 (option_num, col_idx) 튜플 리스트로 생성
                option_columns = sorted(option_col_indices.items())
                
                # Sheet1에서 실제 응답값의 unique option_code 수집 (response와 일치시키기 위해)
                response_option_map = {}  # {question_code: {option_code: count}}
                for question_num, col_name in question_cols:
                    question_code = f"Q{question_num}"
                    if question_code not in response_option_map:
                        response_option_map[question_code] = set()
                    
                    for value in df_sheet1[col_name]:
                        if pd.notna(value) and value != '':
                            codes = parse_option_codes(value)
                            for code in codes:
                                if code:
                                    # 원본 그대로 저장 (숫자 변환하지 않음)
                                    response_option_map[question_code].add(str(code).strip())
                
                # question_meta 및 option_meta 레코드 생성
                question_records = []
                option_records = []
                
                # Sheet2에서 각 질문 행 찾기
                # 질문 행: question_title_col_idx에 질문 텍스트가 있고, option_col_indices 중 하나 이상에 옵션 텍스트가 있는 행
                question_rows = []  # [(row_idx, question_text, option_text_map)]
                
                for row_idx in range(len(df_sheet2_raw)):
                    row_data = df_sheet2_raw.iloc[row_idx]
                    
                    # 질문 텍스트 확인
                    question_text_val = None
                    if question_title_col_idx < len(row_data):
                        question_text_val = row_data.iloc[question_title_col_idx]
                    
                    # 헤더 행인지 확인 (질문 텍스트가 "설문제목"이면 헤더)
                    if pd.notna(question_text_val):
                        question_text_str = str(question_text_val).strip()
                        if question_text_str in ['설문제목', '문항']:
                            continue  # 헤더 행은 건너뛰기
                    
                    # 옵션 텍스트 확인
                    option_text_map = {}  # {option_num: option_text}
                    has_option = False
                    for option_num, col_idx in option_columns:
                        if col_idx < len(row_data):
                            option_text_val = row_data.iloc[col_idx]
                            if pd.notna(option_text_val):
                                option_text = str(option_text_val).strip()
                                # 숫자가 아닌 실제 텍스트인지 확인 (헤더 텍스트 제외)
                                if (option_text and 
                                    not option_text.isdigit() and 
                                    option_text != '' and
                                    '보기' not in option_text and
                                    'CNT' not in option_text and
                                    '총참여자수' not in option_text and
                                    option_text not in ['설문제목', '문항']):
                                    option_text_map[option_num] = option_text
                                    has_option = True
                    
                    # 질문 텍스트가 있고 옵션도 있으면 질문 행으로 인식
                    if pd.notna(question_text_val) and has_option:
                        question_text = str(question_text_val).strip()
                        # 헤더 행이 아닌지 확인 (질문 텍스트가 "설문제목", "문항" 등이 아닌지)
                        if (question_text and 
                            question_text not in ['설문제목', '문항', '총참여자수'] and
                            len(question_text) > 2):  # 너무 짧은 텍스트 제외
                            question_rows.append((row_idx, question_text, option_text_map))
                
                # Sheet1에서 찾은 질문 개수와 Sheet2에서 찾은 질문 개수 매칭
                if len(question_rows) == 0:
                    logger.warning(f"  {file_name}: Sheet2에서 질문 행을 찾을 수 없습니다. 기본값으로 진행합니다.")
                    # 질문 행을 찾지 못했을 때, Sheet1의 질문 개수만큼 기본 질문 텍스트 생성
                    for q_idx, (question_num, _) in enumerate(question_cols):
                        question_rows.append((None, f"질문 {question_num}", {}))
                elif len(question_rows) != len(question_cols):
                    logger.warning(f"  {file_name}: Sheet1 질문 수({len(question_cols)})와 Sheet2 질문 행 수({len(question_rows)})가 다릅니다.")
                    # 더 작은 개수로 진행
                    min_count = min(len(question_rows), len(question_cols))
                    question_rows = question_rows[:min_count]
                    question_cols = question_cols[:min_count]
                
                # 각 질문에 대해 메타데이터 생성
                for q_idx, (question_num, _) in enumerate(question_cols):
                    question_code = f"Q{question_num}"
                    
                    if q_idx < len(question_rows):
                        row_idx, question_text, option_text_map = question_rows[q_idx]
                    else:
                        question_text = "질문 텍스트 없음"
                        option_text_map = {}
                    
                    question_records.append({
                        'poll_code': poll_code,
                        'question_code': question_code,
                        'question_text': question_text
                    })
                    
                    # response의 실제 option_code에 대해 option_meta 생성
                    if question_code in response_option_map:
                        for option_code in response_option_map[question_code]:
                            # option_code가 숫자인 경우 보기 번호로 매핑
                            option_text = None
                            try:
                                option_num = int(float(option_code))
                                # 현재 질문의 option_text_map에서 보기 텍스트 찾기
                                option_text = option_text_map.get(option_num)
                                
                                # option_text가 없으면 다른 질문 행의 option_text_map에서 찾기 시도
                                if not option_text:
                                    # 모든 질문 행의 option_text_map을 확인
                                    for _, _, other_option_map in question_rows:
                                        if option_num in other_option_map:
                                            other_text = other_option_map[option_num]
                                            if other_text and not other_text.isdigit():
                                                option_text = other_text
                                                break
                                
                                # 여전히 없으면 option_code를 그대로 사용 (텍스트 응답)
                                if not option_text:
                                    option_text = option_code
                                # option_text가 숫자면 option_code 사용
                                elif option_text.isdigit():
                                    option_text = option_code
                            except (ValueError, TypeError):
                                # 숫자가 아니면 텍스트 응답으로 간주
                                option_text = option_code
                            
                            option_records.append({
                                'poll_code': poll_code,
                                'question_code': question_code,
                                'option_code': option_code,  # response의 실제 값
                                'option_text': option_text
                            })
                
                # question_meta 배치 삽입
                if question_records:
                    insert_sql = """
                        INSERT INTO core_v2.question_meta
                        (poll_code, question_code, question_text)
                        VALUES (%(poll_code)s, %(question_code)s, %(question_text)s)
                        ON CONFLICT (poll_code, question_code) DO UPDATE SET
                            question_text = EXCLUDED.question_text
                    """
                    execute_batch(cursor, insert_sql, question_records, page_size=10000)
                    total_question_meta += len(question_records)
                    logger.info(f"  {file_name} question_meta inserted = {len(question_records)} rows")
                
                # option_meta 배치 삽입
                if option_records:
                    insert_sql = """
                        INSERT INTO core_v2.option_meta
                        (poll_code, question_code, option_code, option_text)
                        VALUES (%(poll_code)s, %(question_code)s, %(option_code)s, %(option_text)s)
                        ON CONFLICT (poll_code, question_code, option_code) DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, option_records, page_size=10000)
                    total_option_meta += len(option_records)
                    logger.info(f"  {file_name} option_meta inserted = {len(option_records)} rows")
            
            except Exception as e:
                logger.error(f"  {file_name} 처리 실패: {e}")
                traceback.print_exc()
                continue
        
        logger.info(f"excel35 question_meta total inserted = {total_question_meta} rows")
        logger.info(f"excel35 option_meta total inserted = {total_option_meta} rows")
    
    finally:
        cursor.close()


def load_welcome_2nd_response(conn, excel_file: str, cursor=None):
    """welcome_2nd.xlsx 응답 데이터 적재 (Type B)"""
    file_name = os.path.basename(excel_file)
    poll_code = os.path.splitext(file_name)[0]
    
    logger.info(f"응답 적재 중 (Type B): {file_name}")
    
    if cursor is None:
        cursor = conn.cursor()
        should_close = True
    else:
        should_close = False
    
    try:
        # Data Sheet 읽기 (Sheet0 또는 'data' 시트)
        try:
            df_data = pd.read_excel(excel_file, sheet_name='data', engine='openpyxl')
        except:
            try:
                df_data = pd.read_excel(excel_file, sheet_name=0, engine='openpyxl')
            except Exception as e:
                logger.error(f"  {file_name}: Data 시트를 읽을 수 없습니다: {e}")
                return
        
        if df_data.empty:
            logger.warning(f"  {file_name}: Data 시트에 데이터가 없습니다.")
            return
        
        # 컬럼명 정규화
        df_data.columns = df_data.columns.str.strip()
        
        # respondent_id 컬럼 확인 (id 또는 mb_sn)
        respondent_id_col = None
        if 'id' in df_data.columns:
            respondent_id_col = 'id'
        elif 'mb_sn' in df_data.columns:
            respondent_id_col = 'mb_sn'
        else:
            logger.warning(f"  {file_name}: 'id' 또는 'mb_sn' 컬럼을 찾을 수 없습니다.")
            return
        
        # 질문 컬럼 찾기 (Q로 시작하는 컬럼)
        question_cols = [col for col in df_data.columns if str(col).upper().startswith('Q')]
        
        if not question_cols:
            logger.warning(f"  {file_name}: 질문 컬럼을 찾을 수 없습니다.")
            return
        
        # option_meta에서 옵션 코드 확인 (option_code가 숫자인지 텍스트인지 판단)
        cursor.execute("""
            SELECT question_code, option_code
            FROM core_v2.option_meta
            WHERE poll_code = %s
        """, (poll_code,))
        option_meta_rows = cursor.fetchall()
        option_code_map = {}  # {question_code: set(option_codes)}
        for row in option_meta_rows:
            q_code = row[0]
            opt_code = row[1]
            if q_code not in option_code_map:
                option_code_map[q_code] = set()
            option_code_map[q_code].add(opt_code)
        
        # response 레코드 생성
        response_records = []
        for _, row in df_data.iterrows():
            respondent_id = row.get(respondent_id_col)
            if pd.isna(respondent_id) or not respondent_id:
                continue
            
            respondent_id = str(respondent_id).strip()
            
            for col in question_cols:
                value = row.get(col)
                if pd.isna(value) or value == '':
                    continue
                
                question_code = str(col).strip().upper()
                
                # _ETC 컬럼 처리 (텍스트 응답)
                if '_ETC' in question_code:
                    # 텍스트는 numeric_value에 NULL, option_code에 텍스트 저장
                    option_code = str(value).strip()
                    numeric_val = None
                    response_records.append((
                        respondent_id,
                        poll_code,
                        question_code,
                        option_code,
                        numeric_val
                    ))
                else:
                    # 일반 질문: multi-select 분리
                    option_codes = parse_option_codes(value)
                    
                    for option_code in option_codes:
                        if not option_code:
                            continue
                        
                        # option_code가 option_meta에 있는지 확인
                        is_valid_option = False
                        if question_code in option_code_map:
                            is_valid_option = option_code in option_code_map[question_code]
                        
                        # numeric_value 결정
                        numeric_val = None
                        if is_valid_option:
                            # option_meta에 있으면 option_code로 처리
                            numeric_val = None
                        else:
                            # option_meta에 없으면 숫자로 변환 시도
                            numeric_val = parse_numeric_value(option_code)
                        
                        response_records.append((
                            respondent_id,
                            poll_code,
                            question_code,
                            option_code,
                            numeric_val
                        ))
        
        # 배치 삽입
        if response_records:
            insert_sql = """
                INSERT INTO core_v2.response
                (respondent_id, poll_code, question_code, option_code, numeric_value)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """
            execute_batch(cursor, insert_sql, response_records, page_size=10000)
            logger.info(f"  {file_name} response inserted = {len(response_records)} rows")
        
    except Exception as e:
        logger.error(f"  {file_name} 응답 적재 실패: {e}")
        traceback.print_exc()
        raise
    finally:
        if should_close:
            cursor.close()


def reload_all_response(conn, base_dir: str):
    """모든 response 재적재"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    welcome2_count = 0
    excel35_count = 0
    welcome_2nd_count = 0
    
    try:
        # 1) TRUNCATE
        cursor.execute("TRUNCATE TABLE core_v2.response CASCADE")
        logger.info("core_v2.response 테이블 TRUNCATE 완료")
        
        # 2) welcome2 response 적재
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'staging'
              AND table_name = 'welcome2_data'
              AND (LOWER(column_name) LIKE 'q%' OR column_name = 'mb_sn')
            ORDER BY ordinal_position
        """)
        welcome2_data_cols = [row['column_name'] for row in cursor.fetchall()]
        
        if 'mb_sn' not in welcome2_data_cols:
            logger.warning("staging.welcome2_data에 'mb_sn' 컬럼이 없습니다.")
        else:
            # 컬럼명 -> question_code 매핑
            column_to_qcode = {}
            for col in welcome2_data_cols:
                if col != 'mb_sn':
                    question_code = col.upper() if col[0] == 'q' else col
                    column_to_qcode[col] = question_code
            
            # welcome2_data 조회
            cursor.execute(f"""
                SELECT {', '.join([f'"{c}"' for c in welcome2_data_cols])}
                FROM staging.welcome2_data
                WHERE mb_sn IS NOT NULL
            """)
            data_rows = cursor.fetchall()
            
            logger.info(f"welcome2_data 조회: {len(data_rows)}개")
            
            # response 레코드 생성 (multi-select 분리)
            response_records = []
            for row in data_rows:
                respondent_id = str(row.get('mb_sn')).strip() if row.get('mb_sn') else None
                if not respondent_id:
                    continue
                
                for col, value in row.items():
                    if col == 'mb_sn':
                        continue
                    
                    if pd.isna(value) or value == '':
                        continue
                    
                    col_lower = str(col).lower()
                    if col_lower.startswith('q'):
                        question_code = col.upper() if col[0] == 'q' else col
                        option_codes = parse_option_codes(value)
                        
                        for option_code in option_codes:
                            if option_code:
                                numeric_val = parse_numeric_value(option_code)
                                response_records.append((
                                    respondent_id,
                                    'welcome2',
                                    question_code,
                                    option_code,
                                    numeric_val
                                ))
            
            # 배치 삽입
            if response_records:
                insert_sql = """
                    INSERT INTO core_v2.response
                    (respondent_id, poll_code, question_code, option_code, numeric_value)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """
                execute_batch(cursor, insert_sql, response_records, page_size=10000)
                cursor.execute("SELECT COUNT(*) as cnt FROM core_v2.response WHERE poll_code = 'welcome2'")
                welcome2_count = cursor.fetchone()['cnt']
                logger.info(f"welcome2 response inserted = {welcome2_count} rows")
        
        # 3) welcome_2nd.xlsx response 적재 (Type B)
        welcome_pattern = os.path.join(base_dir, "*welcome*.xlsx")
        welcome_files = glob.glob(welcome_pattern)
        welcome_files = [f for f in welcome_files if 'welcome_2nd' in os.path.basename(f).lower() or 'welcome2nd' in os.path.basename(f).lower()]
        
        for excel_file in welcome_files:
            try:
                load_welcome_2nd_response(conn, excel_file, cursor)
                cursor.execute("SELECT COUNT(*) as cnt FROM core_v2.response WHERE poll_code = %s", (os.path.splitext(os.path.basename(excel_file))[0],))
                welcome_2nd_count += cursor.fetchone()['cnt']
            except Exception as e:
                logger.error(f"welcome_2nd 응답 적재 실패: {e}")
                traceback.print_exc()
        
        # 4) excel35 response 적재 (Type A)
        pattern = os.path.join(base_dir, "qpoll_join_*.xlsx")
        excel_files = glob.glob(pattern)
        excel_files.sort()
        
        logger.info(f"발견된 엑셀 파일 (Type A): {len(excel_files)}개")
        
        for excel_file in excel_files:
            file_name = os.path.basename(excel_file)
            poll_code = os.path.splitext(file_name)[0]
            
            try:
                # Sheet1 읽기 (설문 응답 데이터)
                df = pd.read_excel(
                    excel_file,
                    sheet_name=0,
                    header=1,
                    engine='openpyxl'
                )
                
                if df.empty:
                    continue
                
                # "고유번호" 컬럼 찾기
                respondent_col = None
                for col in df.columns:
                    if '고유번호' in str(col):
                        respondent_col = col
                        break
                
                if not respondent_col:
                    logger.warning(f"  {file_name}: '고유번호' 컬럼을 찾을 수 없습니다.")
                    continue
                
                # "문항1", "문항2", ... 또는 "Q1", "Q2", ... 컬럼 찾기
                question_columns = []
                for col in df.columns:
                    col_str = str(col)
                    # "문항1" 또는 "Q1" 형태 찾기
                    match = re.search(r'(?:문항|Q)(\d+)', col_str, re.IGNORECASE)
                    if match:
                        question_num = int(match.group(1))
                        question_columns.append((question_num, col))
                
                question_columns.sort(key=lambda x: x[0])
                
                if not question_columns:
                    logger.warning(f"  {file_name}: 질문 컬럼을 찾을 수 없습니다.")
                    continue
                
                # response 레코드 생성 (multi-select 분리)
                response_records = []
                for idx, row in df.iterrows():
                    respondent_id = str(row[respondent_col]).strip() if pd.notna(row[respondent_col]) else None
                    if not respondent_id:
                        continue
                    
                    for question_num, col_name in question_columns:
                        question_code = f"Q{question_num}"
                        value = row[col_name]
                        
                        if pd.isna(value) or value == '':
                            continue
                        
                        option_codes = parse_option_codes(value)
                        for option_code in option_codes:
                            if option_code:
                                numeric_val = parse_numeric_value(option_code)
                                response_records.append((
                                    respondent_id,
                                    poll_code,
                                    question_code,
                                    option_code,
                                    numeric_val
                                ))
                
                # 배치 삽입
                if response_records:
                    insert_sql = """
                        INSERT INTO core_v2.response
                        (respondent_id, poll_code, question_code, option_code, numeric_value)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, response_records, page_size=10000)
                    logger.info(f"  {file_name} response inserted = {len(response_records)} rows")
            
            except Exception as e:
                logger.error(f"  {file_name} 처리 실패: {e}")
                traceback.print_exc()
                continue
        
        # excel35 총합 계산
        cursor.execute("SELECT COUNT(*) as cnt FROM core_v2.response WHERE poll_code != 'welcome2'")
        excel35_count = cursor.fetchone()['cnt']
        
        # 최종 count
        cursor.execute("SELECT COUNT(*) as cnt FROM core_v2.response")
        total_count = cursor.fetchone()['cnt']
        
        logger.info(f"excel35 response inserted = {excel35_count} rows")
        logger.info(f"total response = {total_count} rows")
        
    except Exception as e:
        logger.error(f"response 재적재 실패: {e}")
        traceback.print_exc()
        raise
    finally:
        cursor.close()


def main():
    """메인 함수"""
    conn = None
    base_dir = r"C:\paneldata\excel"
    
    # welcome2 질문 텍스트 매핑 (사용자 제공)
    welcome2_question_text_map = {
        'Q1': '결혼여부',
        'Q2': '자녀수',
        'Q3': '가족수',
        'Q4': '최종학력',
        'Q5': '직업',
        'Q5_1': '직무',
        'Q6': '월평균 개인소득',
        'Q7': '월평균 가구소득',
        'Q8': '보유전제품',
        'Q9_1': '보유 휴대폰 단말기 브랜드',
        'Q9_2': '보유 휴대폰 모델명',
        'Q10': '보유차량여부',
        'Q11_1': '자동차 제조사',
        'Q11_2': '자동차 모델',
        'Q12': '흡연경험',
        'Q12_1': '흡연경험 담배브랜드',
        'Q12_1_ETC': '흡연경험 담배브랜드(기타브랜드)',
        'Q12_2': '궐련형 전자담배/가열식 전자담배 이용경험',
        'Q12_2_ETC': '흡연경험 담배 브랜드(기타내용)',
        'Q13': '음용경험 술',
        'Q13_ETC': '음용경험 술(기타내용)'
    }
    
    try:
        conn = get_connection()
        logger.info("데이터베이스 연결 성공")
        
        # 1) TRUNCATE
        truncate_all_tables(conn)
        
        # 2) welcome2 메타 생성 (사용자 제공 질문 텍스트 사용)
        load_welcome2_meta(conn, question_text_map_override=welcome2_question_text_map)
        conn.commit()
        
        # 3) welcome_2nd.xlsx 메타데이터 생성 (Type B)
        welcome_pattern = os.path.join(base_dir, "*welcome*.xlsx")
        welcome_files = glob.glob(welcome_pattern)
        welcome_files = [f for f in welcome_files if 'welcome_2nd' in os.path.basename(f).lower() or 'welcome2nd' in os.path.basename(f).lower()]
        
        for excel_file in welcome_files:
            try:
                load_welcome_2nd_meta(conn, excel_file)
            except Exception as e:
                logger.error(f"welcome_2nd 메타데이터 적재 실패: {e}")
                traceback.print_exc()
        conn.commit()
        
        # 4) excel35 메타 생성 (Type A)
        load_excel35_meta(conn, base_dir)
        conn.commit()
        
        # 5) response 재적재
        reload_all_response(conn, base_dir)
        conn.commit()
        
        logger.info("모든 작업 완료 및 커밋")
    
    except Exception as e:
        logger.error(f"오류 발생: {e}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        sys.exit(1)
    finally:
        if conn:
            conn.close()
            logger.info("데이터베이스 연결 종료")


if __name__ == "__main__":
    main()

