"""애플리케이션 진입점"""
import os
from dotenv import load_dotenv
from app import create_app

# .env 파일에서 환경 변수 로드 (인코딩 명시)
try:
    load_dotenv(encoding='utf-8')
except UnicodeDecodeError:
    # UTF-8 실패 시 다른 인코딩 시도
    try:
        load_dotenv(encoding='cp949')  # Windows 한글 인코딩
    except:
        load_dotenv(encoding='utf-8-sig')  # BOM 포함 UTF-8

app = create_app()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
