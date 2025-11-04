"""네트워크 연결 테스트 (DB 연결 전 단계)"""
import socket
import sys

def test_port_connection(host, port, timeout=5):
    """포트 연결 테스트"""
    try:
        print(f"🔌 {host}:{port} 연결 테스트 중...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:
            print(f"✅ 포트 {port} 연결 성공!")
            return True
        else:
            print(f"❌ 포트 {port} 연결 실패 (코드: {result})")
            return False
    except socket.timeout:
        print(f"⏱️ 연결 타임아웃 (5초)")
        print(f"   원인: 방화벽 차단 또는 서버 응답 없음")
        return False
    except Exception as e:
        print(f"❌ 오류: {e}")
        return False

def test_ping(host):
    """Ping 테스트 (Windows)"""
    import subprocess
    try:
        print(f"🏓 {host} ping 테스트 중...")
        result = subprocess.run(
            ['ping', '-n', '1', '-w', '1000', host],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"✅ Ping 성공!")
            return True
        else:
            print(f"❌ Ping 실패")
            return False
    except Exception as e:
        print(f"⚠️ Ping 테스트 오류: {e}")
        return False

if __name__ == '__main__':
    host = sys.argv[1] if len(sys.argv) > 1 else '192.168.65.1'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 5432
    
    print(f"📋 네트워크 테스트")
    print(f"   대상: {host}:{port}")
    print()
    
    # Ping 테스트
    ping_ok = test_ping(host)
    print()
    
    # 포트 연결 테스트
    port_ok = test_port_connection(host, port)
    
    print()
    print("=" * 50)
    if ping_ok and port_ok:
        print("✅ 네트워크 연결 정상 - DB 연결 가능")
    elif ping_ok and not port_ok:
        print("⚠️ 호스트는 접근 가능하지만 포트가 차단됨")
        print("   가능한 원인:")
        print("   1. PostgreSQL 서버가 실행 중이지 않음")
        print("   2. 방화벽에서 포트 5432 차단")
        print("   3. PostgreSQL이 외부 접근을 허용하지 않음")
    elif not ping_ok:
        print("❌ 호스트에 접근 불가")
        print("   가능한 원인:")
        print("   1. 다른 네트워크에 있음 (학교 와이파이)")
        print("   2. IP 주소가 잘못됨")
        print("   3. 호스트가 꺼져있음")
    else:
        print("❌ 네트워크 연결 실패")
