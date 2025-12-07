export interface PanelDetail {
  id: string;
  gender: string;
  age: string;
  birthYear: string;
  region: string;
  lastResponseDate: string;
  surveys: Array<{
    id: string;
    title: string;
    date: string;
    responses: Array<{
      question: string;
      answer: string;
    }>;
  }>;
  aiSummary: string;
}

export const mockPanelDetails: Record<string, PanelDetail> = {
  'w100059715520037': {
    id: 'w100059715520037',
    gender: '남',
    age: '만 48세',
    birthYear: '1977년생',
    region: '서울 강남구',
    lastResponseDate: '2024-10-12',
    surveys: [
      {
        id: 'survey_001',
        title: '운동 및 건강 라이프스타일 설문',
        date: '2024-10-12',
        responses: [
          { question: '주당 운동 빈도', answer: '주 3회 이상' },
          { question: '주요 운동 종목', answer: '헬스장, 러닝' },
          { question: '운동 목적', answer: '건강 유지, 체력 향상' }
        ]
      },
      {
        id: 'survey_002',
        title: '소비 패턴 및 브랜드 선호도',
        date: '2024-09-28',
        responses: [
          { question: '월 평균 소비 금액', answer: '200-300만원' },
          { question: '주요 소비 카테고리', answer: '건강식품, 운동용품' },
          { question: '브랜드 충성도', answer: '높음' }
        ]
      },
      {
        id: 'survey_003',
        title: '디지털 기기 사용 현황',
        date: '2024-09-15',
        responses: [
          { question: '스마트폰 사용 기간', answer: '10년 이상' },
          { question: '주요 앱 카테고리', answer: '건강/운동, 쇼핑' },
          { question: '웨어러블 기기 보유', answer: '스마트워치 보유' }
        ]
      },
      {
        id: 'survey_004',
        title: '여가 활동 및 취미',
        date: '2024-08-30',
        responses: [
          { question: '주요 여가 활동', answer: '운동, 독서, 영화 감상' },
          { question: '취미 소비 비중', answer: '월 50만원 이상' },
          { question: 'SNS 사용 빈도', answer: '주 2-3회' }
        ]
      },
      {
        id: 'survey_005',
        title: '건강 관리 및 의료 서비스',
        date: '2024-08-15',
        responses: [
          { question: '건강 검진 빈도', answer: '연 1회' },
          { question: '건강 관리 앱 사용', answer: '사용 중' },
          { question: '건강식품 섭취', answer: '정기적으로 섭취' }
        ]
      }
    ],
    aiSummary: '이 패널은 운동 및 건강 관리에 높은 관심을 보이며, 주 3회 이상의 규칙적인 운동을 실천하고 있습니다. 건강식품과 운동용품에 대한 소비가 활발하며, 스마트워치 등 웨어러블 기기를 활용한 건강 관리에 적극적입니다. 최근 3개월간 응답이 지속적으로 유지되어 높은 참여도를 보입니다.'
  },
  'w100059715520038': {
    id: 'w100059715520038',
    gender: '여',
    age: '만 29세',
    birthYear: '1996년생',
    region: '서울 강동구',
    lastResponseDate: '2024-10-10',
    surveys: [
      {
        id: 'survey_001',
        title: '뷰티 및 패션 라이프스타일',
        date: '2024-10-10',
        responses: [
          { question: '월 평균 화장품 구매액', answer: '50-100만원' },
          { question: '주요 구매 채널', answer: '온라인 쇼핑몰, 오프라인 매장' },
          { question: '브랜드 선호도', answer: '프리미엄 브랜드 선호' }
        ]
      },
      {
        id: 'survey_002',
        title: '소셜 미디어 사용 패턴',
        date: '2024-09-25',
        responses: [
          { question: '주요 SNS 플랫폼', answer: '인스타그램, 틱톡' },
          { question: '콘텐츠 소비 시간', answer: '일 2-3시간' },
          { question: '인플루언서 팔로우', answer: '뷰티, 패션 인플루언서' }
        ]
      }
    ],
    aiSummary: '이 패널은 뷰티 및 패션에 높은 관심을 보이며, 프리미엄 브랜드를 선호합니다. 소셜 미디어를 적극 활용하며, 인플루언서의 추천에 영향을 받는 경향이 있습니다.'
  }
};

// 기본 패널 리스트 데이터 생성 함수
export const generateMockPanelList = (count: number = 20): Array<{
  id: string;
  gender: string;
  age: string;
  region: string;
  birthYear?: string;
  lastResponseDate?: string;
}> => {
  const genders = ['남', '여'];
  const regions = ['서울 강남구', '서울 강동구', '서울 마포구', '서울 구로구', '서울 송파구'];
  const birthYears = ['1975', '1977', '1980', '1992', '1996', '1998', '2000'];
  
  return Array.from({ length: count }, (_, i) => {
    const birthYear = birthYears[Math.floor(Math.random() * birthYears.length)];
    const currentYear = new Date().getFullYear();
    const age = currentYear - parseInt(birthYear);
    
    return {
      id: `w1000597155200${String(37 + i).padStart(2, '0')}`,
      gender: genders[Math.floor(Math.random() * genders.length)],
      age: `만 ${age}세`,
      region: regions[Math.floor(Math.random() * regions.length)],
      birthYear: `${birthYear}년생`,
      lastResponseDate: `2024-${String(10 - Math.floor(i / 5)).padStart(2, '0')}-${String(12 - (i % 5)).padStart(2, '0')}`
    };
  });
};

