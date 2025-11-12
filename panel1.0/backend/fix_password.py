"""비밀번호 주석 문제 해결"""
import os

env_path = '.env'

# .env 파일 읽기
with open(env_path, 'r', encoding='utf-8') as f:
    content = f.read()

# DB_PASSWORD 라인 찾아서 수정
lines = content.split('\n')
new_lines = []
password_fixed = False

for line in lines:
    if line.strip().startswith('DB_PASSWORD='):
        # 이미 따옴표로 감싸져 있는지 확인
        if not (line.strip().startswith('DB_PASSWORD="') or line.strip().startswith("DB_PASSWORD='")):
            # 따옴표로 감싸기
            new_lines.append('DB_PASSWORD="7E!JyS6B9I791<nXTtO0?E6#6~i["')
            password_fixed = True
        else:
            # 이미 올바르게 설정되어 있음
            new_lines.append(line)
    else:
        new_lines.append(line)

# 파일 쓰기
with open(env_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

if password_fixed:
    print("비밀번호가 따옴표로 감싸졌습니다.")
else:
    print("비밀번호는 이미 올바르게 설정되어 있습니다.")

# 확인
from dotenv import load_dotenv
load_dotenv()
pwd = os.environ.get('DB_PASSWORD', '')
print(f"\n비밀번호 확인:")
print(f"  길이: {len(pwd)}")
print(f"  전체: {repr(pwd)}")
print(f"  마지막 5자: {pwd[-5:] if len(pwd) >= 5 else pwd}")

if len(pwd) == 28 and pwd.endswith('#6~i['):
    print("\n비밀번호가 올바르게 읽혔습니다!")
else:
    print("\n비밀번호가 올바르게 읽히지 않았습니다.")

