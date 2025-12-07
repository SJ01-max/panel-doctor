"""
Singleton 패턴 유틸리티
- LlmService와 VectorSearchService를 Singleton으로 관리
"""
from typing import Optional, TypeVar, Type

T = TypeVar('T')


class Singleton:
    """Singleton 메타클래스"""
    _instances: dict = {}
    
    def __new__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__new__(cls)
        return cls._instances[cls]
    
    @classmethod
    def get_instance(cls) -> Optional[T]:
        """Singleton 인스턴스 반환"""
        return cls._instances.get(cls)
    
    @classmethod
    def reset_instance(cls):
        """Singleton 인스턴스 초기화 (테스트용)"""
        if cls in cls._instances:
            del cls._instances[cls]

