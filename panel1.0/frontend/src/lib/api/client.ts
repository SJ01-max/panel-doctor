import axios, { type AxiosResponse, type AxiosError } from 'axios';

// API 기본 URL 설정 (환경 변수 우선, 없으면 기본값)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 필요시 타임아웃, 인증 토큰 등 추가
});

// 요청/응답 인터셉터 (로깅, 에러 공통 처리 등)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // 공통 에러 처리 로직
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
