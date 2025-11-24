"""
통합 ETL 파이프라인: welcome_data/welcome2_data + 엑셀 35개 파일
→ core_v2.respondent + core_v2.response 적재

사용법:
    python etl_load_all.py

환경변수 설정 (.env 파일 또는 시스템 환경변수):
    DB_HOST=your_host
    DB_PORT=5432
    DB_NAME=your_database
    DB_USER=your_user
    DB_PASSWORD=your_password

데이터베이스 스키마:
    - staging.welcome_data: 패널 기본정보
    - staging.welcome2_data: 패널 기본정보 + 설문 응답
    - core_v2.respondent: 패널 기본정보 (respondent_id, gender, birth_year, region, district)
    - core_v2.response: 설문 응답 데이터 (respondent_id, poll_code, question_code, option_code, numeric_value)
"""

import os
import sys
import glob
import re
from typing import Optional, List, Tuple, Dict, Any
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch, RealDictCursor
import traceback

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# python-dotenv 사용 (선택사항)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv가 없어도 환경변수 직접 설정 가능


def get_connection():
    """환경변수에서 DB 연결 정보를 읽어 PostgreSQL 연결 생성"""
    db_host = os.environ.get('DB_HOST')
    db_port = os.environ.get('DB_PORT', '5432')
    db_name = os.environ.get('DB_NAME')
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    
    if not all([db_host, db_name, db_user, db_password]):
        raise ValueError(
            "필수 환경변수가 설정되지 않았습니다. "
            "DB_HOST, DB_NAME, DB_USER, DB_PASSWORD를 설정해주세요."
        )
    
    try:
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
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        raise


def extract_birth_year(age_text: Optional[str]) -> Optional[int]:
    """
    age_text에서 출생년도 추출
    
    예시:
    - "1993" → 1993
    - "1993년 06월 28일 (만 32 세)" → 1993
    """
    if not age_text:
        return None
    
    age_str = str(age_text).strip()
    if not age_str:
        return None
    
    # "1993" 형식 (숫자만)
    if age_str.isdigit() and len(age_str) == 4:
        try:
            year = int(age_str)
            if 1900 <= year <= 2100:  # 유효한 연도 범위
                return year
        except ValueError:
            pass
    
    # "1993년 06월 28일 (만 32 세)" 형식
    match = re.search(r'(\d{4})년', age_str)
    if match:
        try:
            year = int(match.group(1))
            if 1900 <= year <= 2100:
                return year
        except ValueError:
            pass
    
    return None


def parse_option_codes(value) -> List[str]:
    """문항 응답 값을 파싱하여 option_code 리스트 반환"""
    if pd.isna(value) or value == '':
        return []
    
    value_str = str(value).strip()
    if not value_str:
        return []
    
    # 쉼표로 분리
    options = [opt.strip() for opt in value_str.split(',')]
    # 빈 문자열 제거
    options = [opt for opt in options if opt]
    return options


def parse_numeric_value(value) -> Optional[float]:
    """값이 순수 숫자로만 이루어져 있으면 float로 변환, 아니면 None"""
    if pd.isna(value) or value == '':
        return None
    
    try:
        value_str = str(value).strip()
        # 순수 숫자(정수 또는 소수)인지 확인
        if value_str.replace('.', '').replace('-', '').isdigit():
            return float(value_str)
    except Exception:
        pass
    
    return None


def load_from_welcome(conn):
    """
    welcome_data → respondent (기본정보 생성)
    welcome2_data → respondent 보강 + response (WELCOME2 설문)
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # ============================================================
        # 1. welcome_data → respondent
        # ============================================================
        print("\n" + "=" * 60)
        print("1단계: welcome_data → respondent")
        print("=" * 60)
        
        try:
            query_welcome = """
                SELECT DISTINCT ON (mb_sn)
                    mb_sn,
                    gender,
                    age_text,
                    region,
                    district
                FROM staging.welcome_data
                WHERE mb_sn IS NOT NULL
                ORDER BY mb_sn
            """
            cursor.execute(query_welcome)
            welcome_rows = cursor.fetchall()
            print(f"  ✓ welcome_data 조회: {len(welcome_rows)}개 레코드")
            
            if welcome_rows:
                respondent_records = []
                for row in welcome_rows:
                    mb_sn = row.get('mb_sn')
                    if not mb_sn:
                        continue
                    
                    respondent_id = str(mb_sn).strip()
                    gender = row.get('gender')
                    if gender:
                        gender = str(gender).strip()
                    else:
                        gender = None
                    
                    birth_year = extract_birth_year(row.get('age_text'))
                    region = row.get('region')
                    if region:
                        region = str(region).strip()
                    else:
                        region = None
                    
                    district = row.get('district')
                    if district:
                        district = str(district).strip()
                    else:
                        district = None
                    
                    respondent_records.append({
                        'respondent_id': respondent_id,
                        'gender': gender,
                        'birth_year': birth_year,
                        'region': region,
                        'district': district
                    })
                
                # 배치 삽입 (ON CONFLICT DO NOTHING)
                if respondent_records:
                    insert_sql = """
                        INSERT INTO core_v2.respondent 
                        (respondent_id, gender, birth_year, region, district)
                        VALUES (%(respondent_id)s, %(gender)s, %(birth_year)s, %(region)s, %(district)s)
                        ON CONFLICT (respondent_id) DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, respondent_records, page_size=1000)
                    print(f"  ✓ respondent 적재: {len(respondent_records)}개 레코드")
        except Exception as e:
            print(f"  ❌ welcome_data 처리 실패: {e}")
            traceback.print_exc()
        
        # ============================================================
        # 2. welcome2_data → respondent 보강 + response
        # ============================================================
        print("\n" + "=" * 60)
        print("2단계: welcome2_data → respondent 보강 + response")
        print("=" * 60)
        
        try:
            # welcome2_data의 컬럼 조회
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'staging' 
                  AND table_name = 'welcome2_data'
                ORDER BY ordinal_position
            """)
            columns = [row['column_name'] for row in cursor.fetchall()]
            print(f"  ✓ welcome2_data 컬럼 수: {len(columns)}개")
            
            # mb_sn과 Q1~Qn 컬럼 분리
            mb_sn_col = 'mb_sn' if 'mb_sn' in columns else None
            question_columns = [col for col in columns if col.startswith('Q') and col[1:].isdigit()]
            question_columns.sort(key=lambda x: int(x[1:]))  # Q1, Q2, Q3 ... 순서로 정렬
            
            print(f"  ✓ 질문 컬럼 수: {len(question_columns)}개")
            
            if not mb_sn_col:
                print("  ⚠️  mb_sn 컬럼이 없습니다. 건너뜀.")
            else:
                # welcome2_data 조회
                if question_columns:
                    select_cols = 'mb_sn, ' + ', '.join(question_columns)
                else:
                    select_cols = 'mb_sn'
                
                query_welcome2 = f"""
                    SELECT DISTINCT ON (mb_sn)
                        {select_cols}
                    FROM staging.welcome2_data
                    WHERE mb_sn IS NOT NULL
                    ORDER BY mb_sn
                """
                cursor.execute(query_welcome2)
                welcome2_rows = cursor.fetchall()
                print(f"  ✓ welcome2_data 조회: {len(welcome2_rows)}개 레코드")
                
                # respondent 보강 (NULL 값으로 INSERT)
                respondent_records = []
                for row in welcome2_rows:
                    mb_sn = row.get('mb_sn')
                    if not mb_sn:
                        continue
                    
                    respondent_id = str(mb_sn).strip()
                    respondent_records.append({
                        'respondent_id': respondent_id,
                        'gender': None,
                        'birth_year': None,
                        'region': None,
                        'district': None
                    })
                
                if respondent_records:
                    insert_sql = """
                        INSERT INTO core_v2.respondent 
                        (respondent_id, gender, birth_year, region, district)
                        VALUES (%(respondent_id)s, %(gender)s, %(birth_year)s, %(region)s, %(district)s)
                        ON CONFLICT (respondent_id) DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, respondent_records, page_size=1000)
                    print(f"  ✓ respondent 보강: {len(respondent_records)}개 레코드")
                
                # response 적재 (WELCOME2 설문)
                poll_code = "WELCOME2"
                response_records = []
                
                for row in welcome2_rows:
                    mb_sn = row.get('mb_sn')
                    if not mb_sn:
                        continue
                    
                    respondent_id = str(mb_sn).strip()
                    
                    # 각 질문 컬럼 처리
                    for question_col in question_columns:
                        question_code = question_col  # Q1, Q2, ...
                        value = row.get(question_col)
                        
                        # 값이 비어있지 않은 경우만 처리
                        if pd.isna(value) or value == '':
                            continue
                        
                        # option_code 파싱
                        option_codes = parse_option_codes(value)
                        if not option_codes:
                            continue
                        
                        # numeric_value 파싱
                        numeric_val = parse_numeric_value(value)
                        
                        # 각 option_code에 대해 레코드 생성
                        for option_code in option_codes:
                            response_records.append({
                                'respondent_id': respondent_id,
                                'poll_code': poll_code,
                                'question_code': question_code,
                                'option_code': option_code,
                                'numeric_value': numeric_val
                            })
                
                # 배치 삽입 (ON CONFLICT DO NOTHING)
                if response_records:
                    insert_sql = """
                        INSERT INTO core_v2.response 
                        (respondent_id, poll_code, question_code, option_code, numeric_value)
                        VALUES (%(respondent_id)s, %(poll_code)s, %(question_code)s, %(option_code)s, %(numeric_value)s)
                        ON CONFLICT (respondent_id, poll_code, question_code, option_code) 
                        DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, response_records, page_size=1000)
                    print(f"  ✓ response 적재: {len(response_records)}개 레코드")
        
        except Exception as e:
            print(f"  ❌ welcome2_data 처리 실패: {e}")
            traceback.print_exc()
    
    finally:
        cursor.close()


def get_poll_code_from_sheet(excel_file: str) -> Optional[str]:
    """엑셀 파일의 두 번째 시트 이름을 poll_code로 반환"""
    try:
        xl_file = pd.ExcelFile(excel_file, engine='openpyxl')
        if len(xl_file.sheet_names) < 2:
            print(f"  ⚠️  경고: {os.path.basename(excel_file)}에 시트가 2개 미만입니다. (시트 수: {len(xl_file.sheet_names)})")
            return None
        # 두 번째 시트 이름이 poll_code
        poll_code = xl_file.sheet_names[1]
        return poll_code
    except Exception as e:
        print(f"  ❌ 시트 이름 읽기 실패 ({os.path.basename(excel_file)}): {e}")
        return None


def load_from_excel_files(conn):
    """
    엑셀 35개 파일 → respondent 보강 + response 적재
    """
    print("\n" + "=" * 60)
    print("3단계: 엑셀 35개 파일 → respondent 보강 + response")
    print("=" * 60)
    
    # 엑셀 파일 폴더 경로
    excel_folder = r"C:\paneldata\excel"
    
    if not os.path.exists(excel_folder):
        print(f"  ❌ 폴더가 존재하지 않습니다: {excel_folder}")
        return
    
    # 엑셀 파일 목록 가져오기
    pattern = os.path.join(excel_folder, "qpoll_join_*.xlsx")
    excel_files = glob.glob(pattern)
    excel_files.sort()  # 정렬하여 일관된 순서로 처리
    
    if not excel_files:
        print(f"  ❌ 엑셀 파일을 찾을 수 없습니다: {pattern}")
        return
    
    print(f"  ✓ 발견된 엑셀 파일: {len(excel_files)}개")
    
    cursor = conn.cursor()
    
    # 제외할 컬럼 목록
    exclude_columns = {"구분", "고유번호", "성별", "나이", "지역", "설문일시"}
    
    try:
        for file_idx, excel_file in enumerate(excel_files, 1):
            print(f"\n  📄 [{file_idx}/{len(excel_files)}] 처리 중: {os.path.basename(excel_file)}")
            
            try:
                # 두 번째 시트 이름 가져오기 (poll_code)
                poll_code = get_poll_code_from_sheet(excel_file)
                if not poll_code:
                    print(f"    ⚠️  poll_code를 찾을 수 없습니다. 건너뜀.")
                    continue
                
                print(f"    ✓ poll_code: {poll_code}")
                
                # 첫 번째 시트 읽기 (header=1)
                df = pd.read_excel(
                    excel_file,
                    sheet_name=0,  # 첫 번째 시트
                    header=1,      # 두 번째 행을 헤더로 사용
                    engine='openpyxl'
                )
                
                if df.empty:
                    print(f"    ⚠️  데이터가 비어있습니다. 건너뜀.")
                    continue
                
                print(f"    ✓ 행 수: {len(df)}")
                
                # 필수 컬럼 확인
                if '고유번호' not in df.columns:
                    print(f"    ❌ '고유번호' 컬럼이 없습니다. 건너뜀.")
                    continue
                
                # 질문 컬럼 찾기 (제외 컬럼을 제외한 모든 컬럼)
                question_columns = [col for col in df.columns if col not in exclude_columns]
                print(f"    ✓ 질문 컬럼 수: {len(question_columns)}개")
                
                # respondent 보강 및 response 적재
                respondent_records = []
                response_records = []
                
                for idx, row in df.iterrows():
                    try:
                        # respondent_id 추출
                        respondent_id = str(row['고유번호']).strip()
                        if not respondent_id or pd.isna(row['고유번호']):
                            continue
                        
                        # respondent 보강 (기존 값이 NULL일 경우 UPDATE는 선택사항이므로 DO NOTHING 사용)
                        gender = row.get('성별')
                        if gender and not pd.isna(gender):
                            gender = str(gender).strip()
                        else:
                            gender = None
                        
                        birth_year = extract_birth_year(row.get('나이'))
                        
                        region = row.get('지역')
                        if region and not pd.isna(region):
                            region = str(region).strip()
                        else:
                            region = None
                        
                        district = None  # 엑셀에는 district 컬럼이 없을 수 있음
                        
                        # respondent INSERT (ON CONFLICT DO NOTHING)
                        respondent_records.append({
                            'respondent_id': respondent_id,
                            'gender': gender,
                            'birth_year': birth_year,
                            'region': region,
                            'district': district
                        })
                        
                        # response 적재
                        for q_idx, col_name in enumerate(question_columns, start=1):
                            question_code = f"Q{q_idx}"  # Q1, Q2, Q3, ...
                            value = row[col_name]
                            
                            # 값이 비어있지 않은 경우만 처리
                            if pd.isna(value) or value == '':
                                continue
                            
                            # option_code 파싱
                            option_codes = parse_option_codes(value)
                            if not option_codes:
                                continue
                            
                            # numeric_value 파싱
                            numeric_val = parse_numeric_value(value)
                            
                            # 각 option_code에 대해 레코드 생성
                            for option_code in option_codes:
                                response_records.append({
                                    'respondent_id': respondent_id,
                                    'poll_code': poll_code,
                                    'question_code': question_code,
                                    'option_code': option_code,
                                    'numeric_value': numeric_val
                                })
                    
                    except Exception as e:
                        print(f"    ❌ 행 처리 실패 (행: {idx+2}): {e}")
                        traceback.print_exc()
                        continue
                
                # respondent 배치 삽입
                if respondent_records:
                    insert_sql = """
                        INSERT INTO core_v2.respondent 
                        (respondent_id, gender, birth_year, region, district)
                        VALUES (%(respondent_id)s, %(gender)s, %(birth_year)s, %(region)s, %(district)s)
                        ON CONFLICT (respondent_id) DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, respondent_records, page_size=1000)
                    print(f"    ✓ respondent 보강: {len(respondent_records)}개 레코드")
                
                # response 배치 삽입
                if response_records:
                    insert_sql = """
                        INSERT INTO core_v2.response 
                        (respondent_id, poll_code, question_code, option_code, numeric_value)
                        VALUES (%(respondent_id)s, %(poll_code)s, %(question_code)s, %(option_code)s, %(numeric_value)s)
                        ON CONFLICT (respondent_id, poll_code, question_code, option_code) 
                        DO NOTHING
                    """
                    execute_batch(cursor, insert_sql, response_records, page_size=1000)
                    print(f"    ✓ response 적재: {len(response_records)}개 레코드")
                
                print(f"    ✓ 완료: {os.path.basename(excel_file)}")
            
            except Exception as e:
                print(f"    ❌ 파일 처리 실패 ({os.path.basename(excel_file)}): {e}")
                traceback.print_exc()
                continue
        
        print(f"\n  ✓ 모든 엑셀 파일 처리 완료")
    
    finally:
        cursor.close()


def main():
    """메인 함수"""
    print("=" * 60)
    print("통합 ETL 파이프라인 시작")
    print("welcome_data/welcome2_data + 엑셀 35개 → core_v2.respondent + core_v2.response")
    print("=" * 60)
    
    # DB 연결
    try:
        conn = get_connection()
        print("✓ 데이터베이스 연결 성공")
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        sys.exit(1)
    
    try:
        # 1단계: welcome_data → respondent
        load_from_welcome(conn)
        
        # 2단계: welcome2_data → respondent 보강 + response (이미 load_from_welcome에 포함)
        
        # 3단계: 엑셀 35개 → respondent 보강 + response
        load_from_excel_files(conn)
        
        # 커밋
        conn.commit()
        print("\n" + "=" * 60)
        print("✓ 모든 작업 완료 및 커밋")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        traceback.print_exc()
        conn.rollback()
        print("❌ 롤백 완료")
        sys.exit(1)
    
    finally:
        conn.close()
        print("✓ 데이터베이스 연결 종료")


if __name__ == "__main__":
    main()

