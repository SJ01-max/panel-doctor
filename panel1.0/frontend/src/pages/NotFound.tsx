
import { useNavigate } from 'react-router-dom';
import Button from '../components/base/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-24 h-24 bg-[#2F6BFF]/10 rounded-full flex items-center justify-center mx-auto mb-8">
          <i className="ri-error-warning-line text-[#2F6BFF] text-4xl"></i>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">페이지를 찾을 수 없습니다</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          홈페이지로 돌아가서 다시 시도해보세요.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate(-1)} variant="secondary">
            <i className="ri-arrow-left-line mr-2"></i>
            이전 페이지
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            <i className="ri-home-line mr-2"></i>
            홈으로 가기
          </Button>
        </div>
      </div>
    </div>
  );
}
