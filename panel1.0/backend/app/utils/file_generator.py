"""
파일 생성 유틸리티 (CSV, Excel, PDF)
"""
import os
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime
import traceback


# 파일 저장 디렉토리
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'exports')

# exports 디렉토리가 없으면 생성
os.makedirs(EXPORT_DIR, exist_ok=True)


def generate_csv(
    data: List[Dict[str, Any]],
    file_name: str,
    columns: Optional[List[str]] = None
) -> tuple[str, int]:
    """
    CSV 파일 생성
    
    Args:
        data: 데이터 리스트 (dict 리스트)
        file_name: 파일명 (확장자 제외)
        columns: 컬럼 순서 (None이면 data의 모든 키 사용)
    
    Returns:
        (file_path, file_size_bytes)
    """
    try:
        if not data:
            raise ValueError("데이터가 비어있습니다.")
        
        # DataFrame 생성
        df = pd.DataFrame(data)
        
        # 컬럼 순서 지정
        if columns:
            # 존재하는 컬럼만 사용
            available_columns = [col for col in columns if col in df.columns]
            if available_columns:
                df = df[available_columns]
        
        # 파일 경로
        file_path = os.path.join(EXPORT_DIR, f"{file_name}.csv")
        
        # CSV 저장 (UTF-8 BOM 포함)
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
        
        # 파일 크기
        file_size = os.path.getsize(file_path)
        
        return file_path, file_size
    
    except Exception as e:
        print(f"[ERROR] CSV 생성 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        raise


def generate_excel(
    data: List[Dict[str, Any]],
    file_name: str,
    columns: Optional[List[str]] = None,
    sheet_name: str = "Sheet1"
) -> tuple[str, int]:
    """
    Excel 파일 생성
    
    Args:
        data: 데이터 리스트 (dict 리스트)
        file_name: 파일명 (확장자 제외)
        columns: 컬럼 순서 (None이면 data의 모든 키 사용)
        sheet_name: 시트 이름
    
    Returns:
        (file_path, file_size_bytes)
    """
    try:
        if not data:
            raise ValueError("데이터가 비어있습니다.")
        
        # DataFrame 생성
        df = pd.DataFrame(data)
        
        # 컬럼 순서 지정
        if columns:
            # 존재하는 컬럼만 사용
            available_columns = [col for col in columns if col in df.columns]
            if available_columns:
                df = df[available_columns]
        
        # 파일 경로
        file_path = os.path.join(EXPORT_DIR, f"{file_name}.xlsx")
        
        # Excel 저장
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        # 파일 크기
        file_size = os.path.getsize(file_path)
        
        return file_path, file_size
    
    except Exception as e:
        print(f"[ERROR] Excel 생성 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        raise


def generate_pdf(
    data: List[Dict[str, Any]],
    file_name: str,
    title: str = "Report",
    columns: Optional[List[str]] = None
) -> tuple[str, int]:
    """
    PDF 파일 생성 (간단한 텍스트 기반)
    
    Note: reportlab이 설치되어 있지 않으면 텍스트 기반 PDF를 생성합니다.
    
    Args:
        data: 데이터 리스트 (dict 리스트)
        file_name: 파일명 (확장자 제외)
        title: 리포트 제목
        columns: 컬럼 순서
    
    Returns:
        (file_path, file_size_bytes)
    """
    try:
        # reportlab이 있으면 사용, 없으면 간단한 텍스트 PDF 생성
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib import colors
            
            file_path = os.path.join(EXPORT_DIR, f"{file_name}.pdf")
            doc = SimpleDocTemplate(file_path, pagesize=letter)
            elements = []
            styles = getSampleStyleSheet()
            
            # 제목
            elements.append(Paragraph(title, styles['Title']))
            elements.append(Spacer(1, 12))
            
            # 데이터가 있으면 테이블 생성
            if data:
                # 컬럼 헤더
                if columns:
                    headers = columns
                else:
                    headers = list(data[0].keys())
                
                # 테이블 데이터
                table_data = [headers]
                for row in data[:100]:  # PDF는 최대 100행만 표시
                    table_data.append([str(row.get(col, '')) for col in headers])
                
                # 테이블 생성
                table = Table(table_data)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                elements.append(table)
            
            # PDF 생성
            doc.build(elements)
            
        except ImportError:
            # reportlab이 없으면 간단한 텍스트 파일 생성
            print("[WARN] reportlab이 설치되어 있지 않습니다. 텍스트 파일을 생성합니다.")
            file_path = os.path.join(EXPORT_DIR, f"{file_name}.txt")
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"{title}\n")
                f.write("=" * 50 + "\n\n")
                
                if data:
                    if columns:
                        headers = columns
                    else:
                        headers = list(data[0].keys())
                    
                    # 헤더
                    f.write("\t".join(headers) + "\n")
                    f.write("-" * 50 + "\n")
                    
                    # 데이터
                    for row in data:
                        f.write("\t".join([str(row.get(col, '')) for col in headers]) + "\n")
        
        # 파일 크기
        file_size = os.path.getsize(file_path)
        
        return file_path, file_size
    
    except Exception as e:
        print(f"[ERROR] PDF 생성 실패: {e}")
        print(f"[ERROR] 상세 오류:\n{traceback.format_exc()}")
        raise


def format_file_size(size_bytes: int) -> str:
    """파일 크기를 읽기 쉬운 형식으로 변환"""
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f}KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f}MB"

