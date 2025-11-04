"""패널 검색 서비스"""
from typing import Dict, Any, List
from app.db.connection import get_db_connection


class PanelService:
    """패널 검색 및 관련 비즈니스 로직"""
    
    def search(self, parsed_query: Dict[str, Any]) -> Dict[str, Any]:
        """
        파싱된 쿼리를 기반으로 패널 검색
        
        Args:
            parsed_query: 파싱된 쿼리 딕셔너리
            
        Returns:
            검색 결과 딕셔너리
        """
        # TODO: 실제 DB 쿼리 실행
        # 현재는 기본 구조만 반환
        
        return {
            'extractedChips': [],
            'previewData': [],
            'estimatedCount': 0,
            'warnings': [],
            'panelIds': []
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """대시보드 데이터 조회"""
        # TODO: 실제 DB에서 데이터 조회
        # 현재는 프론트엔드 개발/데모를 위해 정적 예시 데이터를 반환합니다.
        # 숫자 포맷과 증감율, 아이콘/색상은 프론트에서 그대로 사용됩니다.

        kpi_data: List[Dict[str, Any]] = [
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
        }
