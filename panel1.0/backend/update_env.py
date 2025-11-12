"""서버 DB 설정으로 .env 파일 업데이트"""
import os
from urllib.parse import quote_plus

env_path = '.env'

# 기존 .env 파일 읽기
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
else:
    lines = []

# 비밀번호 URL 인코딩
password = '7E!JyS6B9I791<nXTtO0?E6#6~i['
password_encoded = quote_plus(password)

# 새로운 설정
# 비밀번호에 # 문자가 있어서 따옴표로 감싸야 함
new_settings = {
    'DATABASE_URL': f'postgresql://postgres:{password_encoded}@database.c3gymesumce0.ap-northeast-2.rds.amazonaws.com:5432/postgres',
    'DB_HOST': 'database.c3gymesumce0.ap-northeast-2.rds.amazonaws.com',
    'DB_PORT': '5432',
    'DB_NAME': 'postgres',
    'DB_USER': 'postgres',
    'DB_PASSWORD': '"7E!JyS6B9I791<nXTtO0?E6#6~i["'  # 따옴표로 감싸서 # 주석 처리 방지
}

# 기존 설정 업데이트 또는 추가
updated_lines = []
keys_updated = set()

for line in lines:
    line_stripped = line.strip()
    if not line_stripped or line_stripped.startswith('#'):
        updated_lines.append(line)
        continue
    
    key = line_stripped.split('=')[0].strip()
    if key in new_settings:
        updated_lines.append(f"{key}={new_settings[key]}\n")
        keys_updated.add(key)
    else:
        updated_lines.append(line)

# 새로운 설정 추가
for key, value in new_settings.items():
    if key not in keys_updated:
        updated_lines.append(f"{key}={value}\n")

# 파일 쓰기
with open(env_path, 'w', encoding='utf-8') as f:
    f.writelines(updated_lines)

print(".env 파일 업데이트 완료!")
print("\n설정된 값:")
for key, value in new_settings.items():
    if 'PASSWORD' in key:
        print(f"  {key}=***")
    else:
        print(f"  {key}={value}")

