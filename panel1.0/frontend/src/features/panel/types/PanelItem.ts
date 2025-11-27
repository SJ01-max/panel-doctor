export interface PanelItem {
  id: string;
  gender: string;
  age: string;
  region: string;
  birthYear?: string;
  lastResponseDate?: string;
  matchScore?: number; // 적합도 점수 (0-100)
  content?: string; // 패널의 json_doc 내용 (매칭 이유 표시용)
  semanticKeywords?: string[]; // 검색에 사용된 키워드
}

