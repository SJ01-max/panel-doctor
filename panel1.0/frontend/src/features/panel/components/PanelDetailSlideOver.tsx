import React, { useEffect, useState, useMemo } from 'react';
import { X, Calendar, MapPin, User, ChevronDown, ChevronUp, Target, Sparkles } from 'lucide-react';
import { getPanelDetail, type PanelDetailData } from '../../../api/panel';

interface PanelDetailSlideOverProps {
  panelId: string | null;
  panelData?: {
    id: string;
    gender: string;
    age: string;
    region: string;
    matchScore?: number;
    content?: string;
    semanticKeywords?: string[];
  } | null;
  query?: string; // 검색 질의 추가
  highlightFields?: string[] | null; // LLM이 추천한 하이라이트 필드 목록
  onClose: () => void;
}

export const PanelDetailSlideOver: React.FC<PanelDetailSlideOverProps> = ({
  panelId,
  panelData,
  query = '',
  highlightFields = null,
  onClose
}) => {
  const [panelDetail, setPanelDetail] = useState<PanelDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['기본 정보', '가족 정보', '최종학력', '직업/직무', '소득', '보유 전자제품', '휴대폰', '자동차', '흡연', '음용'])); // 기본적으로 모든 그룹 펼침
  const [expandedSurveys, setExpandedSurveys] = useState<Set<string>>(new Set()); // 펼쳐진 설문 ID 목록

  // 실제 DB에서 패널 상세 정보 가져오기
  useEffect(() => {
    if (!panelId) {
      setPanelDetail(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    getPanelDetail(panelId)
      .then((data) => {
        setPanelDetail(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('패널 상세 정보 조회 실패:', err);
        setError(err?.message || '패널 상세 정보를 불러올 수 없습니다.');
        setIsLoading(false);
        // 에러 발생 시 panelData로 기본 정보 표시
        if (panelData) {
          setPanelDetail({
            respondent_id: panelData.id,
            gender: panelData.gender,
            birth_year: null,
            age: null,
            age_text: panelData.age,
            region: panelData.region,
            district: null,
            json_doc: null,
            last_response_date: null
          });
        }
      });
  }, [panelId, panelData]);

  // panelDetail이 없으면 panelData로 기본 정보 생성
  const panel = panelDetail || (panelData ? {
    respondent_id: panelData.id,
    gender: panelData.gender,
    birth_year: null,
    age: null,
    age_text: panelData.age,
    region: panelData.region,
    district: null,
    json_doc: null,
    last_response_date: null
  } : null);

  useEffect(() => {
    if (panelId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [panelId]);

  // 검색 질의에서 키워드 추출 함수 (hooks 이전에 정의)
  const extractQueryKeywords = (queryText: string): string[] => {
    if (!queryText || !queryText.trim()) return [];
    
    // 불용어 제거
    const stopWords = new Set([
      '을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과', '의', '도', '만',
      '사용', '하는', '하는데', '한다', '한다고', '한다는', '한다면', '해주', '주세요', '있음', '있습니다',
      '있어요', '있어', '없음', '없습니다', '없어요', '없어', '입니다', '이에요', '예요'
    ]);
    
    // 검색어를 단어로 분리
    const words = queryText
      .toLowerCase()
      .split(/\s+/)
      .map(word => {
        // 조사 제거
        let cleanWord = word.trim();
        for (const particle of ['을', '를', '이', '가', '은', '는', '에', '에서', '로', '으로', '와', '과', '의', '도', '만']) {
          if (cleanWord.endsWith(particle)) {
            cleanWord = cleanWord.slice(0, -particle.length);
            break;
          }
        }
        return cleanWord;
      })
      .filter(word => word.length >= 2 && !stopWords.has(word));
    
    return [...new Set(words)]; // 중복 제거
  };

  // 검색 질의에서 키워드 추출 (hooks는 조건부 return 전에 호출되어야 함)
  const queryKeywords = useMemo(() => {
    // semanticKeywords가 있으면 우선 사용, 없으면 query에서 추출
    if (panelData?.semanticKeywords && panelData.semanticKeywords.length > 0) {
      return panelData.semanticKeywords;
    }
    return extractQueryKeywords(query);
  }, [query, panelData?.semanticKeywords]);

  // 유사 단어 매핑 (키워드 확장용)
  const getSimilarWords = (keyword: string): string[] => {
    const keywordLower = keyword.toLowerCase();
    const similarWords: string[] = [keyword];
    
    // OTT 관련
    if (keywordLower.includes('ott') || keywordLower.includes('스트리밍') || keywordLower.includes('동영상')) {
      similarWords.push('넷플릭스', '유튜브', '스트리밍', '동영상', '영상', '비디오', '플랫폼', '서비스');
    }
    if (keywordLower.includes('넷플릭스') || keywordLower.includes('유튜브')) {
      similarWords.push('ott', '스트리밍', '동영상', '영상');
    }
    
    // 운동 관련
    if (keywordLower.includes('운동') || keywordLower.includes('체력')) {
      similarWords.push('헬스', '피트니스', '트레이닝', '홈트', '달리기', '걷기', '등산', '요가');
    }
    if (keywordLower.includes('헬스') || keywordLower.includes('피트니스')) {
      similarWords.push('운동', '체력', '트레이닝');
    }
    
    // 직장인 관련
    if (keywordLower.includes('직장인') || keywordLower.includes('직장')) {
      similarWords.push('회사', '직업', '근무', '출근', '직원');
    }
    
    // 쇼핑 관련
    if (keywordLower.includes('쇼핑') || keywordLower.includes('구매')) {
      similarWords.push('구매', '소비', '마켓', '상점', '배송');
    }
    
    // 스마트폰/앱 관련
    if (keywordLower.includes('앱') || keywordLower.includes('스마트폰')) {
      similarWords.push('애플리케이션', '어플', '모바일', '스마트폰', '폰');
    }
    
    return Array.from(new Set(similarWords));
  };

  // 텍스트 하이라이팅 함수 (유사 단어 포함)
  const highlightMatchText = (text: string): React.ReactNode => {
    if (!text || queryKeywords.length === 0) return text;
    
    // 키워드 확장 (유사 단어 포함)
    const expandedKeywords: string[] = [];
    queryKeywords.forEach(kw => {
      expandedKeywords.push(kw);
      const similarWords = getSimilarWords(kw);
      similarWords.forEach(sw => {
        if (!expandedKeywords.includes(sw)) {
          expandedKeywords.push(sw);
        }
      });
    });
    
    // 긴 키워드부터 매칭하도록 정렬
    const sortedKeywords = expandedKeywords.sort((a, b) => b.length - a.length);
    const keywordPattern = sortedKeywords
      .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    const regex = new RegExp(`(${keywordPattern})`, 'gi');
    const parts: Array<{ text: string; isMatch: boolean }> = [];
    let lastIndex = 0;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isMatch: false });
      }
      parts.push({ text: match[0], isMatch: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isMatch: false });
    }
    
    if (parts.length === 0) return text;
    
    return (
      <span>
        {parts.map((part, idx) => 
          part.isMatch ? (
            <span key={idx} className="bg-yellow-200 font-bold text-gray-900 px-1 rounded">
              {part.text}
            </span>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        )}
      </span>
    );
  };

  // 매칭된 내용 필터링: 질의와 관련된 질문-답변만 추출 (개선된 버전)
  const extractRelevantContent = useMemo(() => {
    // panelData.content 또는 panel.json_doc 사용
    const contentSource = panelData?.content || (panel?.json_doc ? (typeof panel.json_doc === 'string' ? panel.json_doc : JSON.stringify(panel.json_doc)) : null);
    
    if (!contentSource || queryKeywords.length === 0) return null;
    
    const relevantParts: string[] = [];
    
    // 키워드 확장 (부분 매칭을 위한 변형)
    const expandedKeywords: string[] = [];
    queryKeywords.forEach(keyword => {
      expandedKeywords.push(keyword.toLowerCase());
      // 키워드에서 공백 제거한 버전도 추가 (예: "주 1회 이상" -> "주1회이상")
      expandedKeywords.push(keyword.replace(/\s+/g, '').toLowerCase());
      // 키워드의 주요 단어만 추출 (예: "주 1회 이상 운동" -> "운동", "1회")
      const words = keyword.split(/\s+/).filter(w => w.length >= 2);
      words.forEach(word => {
        if (!expandedKeywords.includes(word.toLowerCase())) {
          expandedKeywords.push(word.toLowerCase());
        }
      });
    });
    
    // 파이프(|)로 구분된 형식인 경우
    if (typeof contentSource === 'string' && contentSource.includes('|')) {
      const parts = contentSource.split('|').filter(p => p.trim());
      
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          const question = parts[i].trim();
          const answer = parts[i + 1].trim();
          const combinedText = `${question} ${answer}`.toLowerCase();
          
          // 확장된 키워드 중 하나라도 포함되면 관련 있다고 판단
          const isRelevant = expandedKeywords.some(keyword => 
            combinedText.includes(keyword)
          );
          
          if (isRelevant && answer && answer !== '-') {
            relevantParts.push(`${question}: ${answer}`);
          }
        }
      }
    } else {
      // 일반 텍스트인 경우 키워드가 포함된 문장만 추출
      const text = typeof contentSource === 'string' ? contentSource : JSON.stringify(contentSource);
      const sentences = text.split(/[.|!?|]/).filter(s => s.trim());
      sentences.forEach(sentence => {
        const sentenceLower = sentence.toLowerCase();
        const isRelevant = expandedKeywords.some(keyword => 
          sentenceLower.includes(keyword)
        );
        if (isRelevant && sentence.trim().length > 10) {
          relevantParts.push(sentence.trim());
        }
      });
    }
    
    return relevantParts.length > 0 ? relevantParts.join(' | ') : null;
  }, [panelData?.content, panel?.json_doc, queryKeywords]);

  if (!panelId || !panel) return null;

  // JSON 문서에서 설문 응답 데이터 추출 (개선된 버전)
  const extractSurveyData = (jsonDoc: any): Array<{ id: string; title: string; date: string; responses: Array<{ question: string; answer: string }> }> => {
    if (!jsonDoc) return [];
    
    const surveys: Array<{ id: string; title: string; date: string; responses: Array<{ question: string; answer: string }> }> = [];
    
    // 문자열인 경우 파이프(|) 구분 형식 처리
    if (typeof jsonDoc === 'string') {
      const parts = jsonDoc.split('|').filter(p => p.trim());
      const responses: Array<{ question: string; answer: string }> = [];
      
      // 질문-답변 쌍 추출
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          const question = parts[i].trim();
          const answer = parts[i + 1].trim();
          
          // 의미 있는 질문-답변만 추가 (빈 값이나 '-' 제외)
          if (question && answer && answer !== '-' && question.length > 2) {
            responses.push({ question, answer });
          }
        }
      }
      
      // 응답이 있으면 하나의 설문으로 그룹화
      if (responses.length > 0) {
        // 설문 제목 추출 시도 (첫 번째 질문에서 추출하거나 기본값 사용)
        const firstQuestion = responses[0]?.question || '';
        let surveyTitle = '설문 응답';
        
        // 질문에서 설문 제목 추출 시도
        if (firstQuestion.includes('설문') || firstQuestion.includes('조사')) {
          surveyTitle = firstQuestion.substring(0, 30) + (firstQuestion.length > 30 ? '...' : '');
        } else if (firstQuestion.length > 0) {
          // 첫 번째 질문의 앞부분을 제목으로 사용
          surveyTitle = firstQuestion.substring(0, 40) + (firstQuestion.length > 40 ? '...' : '');
        }
        
        surveys.push({
          id: 'survey_1',
          title: surveyTitle,
          date: panel?.last_response_date || new Date().toISOString().split('T')[0],
          responses
        });
      }
    }
    // 객체인 경우
    else if (typeof jsonDoc === 'object' && jsonDoc !== null) {
      // polls 배열이 있는 경우
      if (jsonDoc.polls && Array.isArray(jsonDoc.polls)) {
        jsonDoc.polls.forEach((poll: any, idx: number) => {
          const responses: Array<{ question: string; answer: string }> = [];
          
          if (poll.questions && Array.isArray(poll.questions)) {
            poll.questions.forEach((q: any) => {
              if (q.question_text && q.answer) {
                const answerText = typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer);
                if (answerText && answerText !== '-' && answerText !== 'null') {
                  responses.push({
                    question: q.question_text,
                    answer: answerText
                  });
                }
              }
            });
          }
          
          if (responses.length > 0) {
            surveys.push({
              id: `survey_${idx + 1}`,
              title: poll.title || poll.poll_title || poll.poll_code || `설문 ${idx + 1}`,
              date: poll.date || poll.response_date || poll.survey_datetime || new Date().toISOString().split('T')[0],
              responses
            });
          }
        });
      }
      
      // answers 배열이 있는 경우
      if (jsonDoc.answers && Array.isArray(jsonDoc.answers)) {
        // answers를 설문 단위로 그룹화 (question_title 또는 date 기준)
        const groupedAnswers: Record<string, Array<{ question: string; answer: string }>> = {};
        
        jsonDoc.answers.forEach((answer: any) => {
          if (answer.question && answer.answer) {
            const answerText = typeof answer.answer === 'string' ? answer.answer : JSON.stringify(answer.answer);
            if (answerText && answerText !== '-' && answerText !== 'null') {
              const groupKey = answer.question_title || answer.date || answer.response_date || '기타';
              
              if (!groupedAnswers[groupKey]) {
                groupedAnswers[groupKey] = [];
              }
              
              groupedAnswers[groupKey].push({
                question: answer.question,
                answer: answerText
              });
            }
          }
        });
        
        // 그룹화된 answers를 설문으로 변환
        Object.entries(groupedAnswers).forEach(([groupKey, responses], idx) => {
          if (responses.length > 0) {
            surveys.push({
              id: `answer_${idx + 1}`,
              title: groupKey !== '기타' ? groupKey : `응답 ${idx + 1}`,
              date: new Date().toISOString().split('T')[0],
              responses
            });
          }
        });
      }
      
      // 객체의 직접적인 키-값 쌍을 설문으로 변환 (polls, answers가 없는 경우)
      if (surveys.length === 0 && !jsonDoc.polls && !jsonDoc.answers) {
        const responses: Array<{ question: string; answer: string }> = [];
        
        Object.entries(jsonDoc).forEach(([key, value]) => {
          // 메타데이터 키 제외
          if (key === 'respondent_id' || key === 'poll_code' || key === 'survey_datetime') {
            return;
          }
          
          if (value !== null && value !== undefined && value !== '-') {
            const answerText = typeof value === 'string' ? value : JSON.stringify(value);
            if (answerText && answerText.length > 0) {
              responses.push({
                question: key,
                answer: answerText
              });
            }
          }
        });
        
        if (responses.length > 0) {
          surveys.push({
            id: 'survey_1',
            title: '설문 응답',
            date: panel?.last_response_date || new Date().toISOString().split('T')[0],
            responses
          });
        }
      }
    }
    
    // 날짜순으로 정렬 (최신순)
    surveys.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    
    return surveys;
  };

  // 그룹 타이틀별로 항목들을 그룹화
  const groupItemsByTitle = (pairs: Array<{ key: string; value: string; category?: string }>): Record<string, Array<{ key: string; value: string }>> => {
    const grouped: Record<string, Array<{ key: string; value: string }>> = {};
    
    pairs.forEach(pair => {
      const groupTitle = getGroupTitleForKey(pair.key);
      if (!grouped[groupTitle]) {
        grouped[groupTitle] = [];
      }
      grouped[groupTitle].push({ key: pair.key, value: pair.value });
    });
    
    return grouped;
  };

  // 키-값 처리 헬퍼 함수 (중복 제거 및 통합 로직)
  const processKeyValue = (
    key: string,
    value: string,
    category: string,
    pairs: Array<{ key: string; value: string; category?: string }>,
    seenKeys: Set<string>,
    seenKeyOnly: Set<string>,
    categoryValueMap: Record<string, Set<string>>
  ) => {
    // "보유전제품", "보유전자제품" 같은 반복 키는 값만 수집
    if (key.includes('보유전자제품') || key.includes('보유전제품')) {
      const groupTitle = getGroupTitleForKey(key);
      if (!categoryValueMap[groupTitle]) {
        categoryValueMap[groupTitle] = new Set();
      }
      // 값에서 괄호 내용 제거 (예: "무선 이어폰(예: 에어팟, 갤럭시 버즈 등)" -> "무선 이어폰")
      const cleanValue = value.replace(/\([^)]*\)/g, '').trim();
      if (cleanValue && cleanValue !== '-') {
        categoryValueMap[groupTitle].add(cleanValue);
      }
      return;
    }
    
    // 같은 카테고리 내에서 같은 키는 하나만 유지 (값이 다른 경우는 첫 번째 값 사용)
    const keyOnly = `${category}:${key}`;
    if (!seenKeyOnly.has(keyOnly)) {
      seenKeyOnly.add(keyOnly);
      const keyValuePair = `${category}:${key}:${value}`;
      if (!seenKeys.has(keyValuePair)) {
        seenKeys.add(keyValuePair);
        pairs.push({ key, value, category });
      }
    }
  };

  // JSON 문서를 키-값 쌍으로 변환 (파이프 구분 또는 객체 형태)
  const extractKeyValuePairs = (jsonDoc: any): Array<{ key: string; value: string; category?: string }> => {
    if (!jsonDoc) return [];
    
    const pairs: Array<{ key: string; value: string; category?: string }> = [];
    const seenKeys = new Set<string>(); // 중복 제거용 (키-값 쌍)
    const seenKeyOnly = new Set<string>(); // 중복 제거용 (키만, 같은 키는 하나만)
    const categoryValueMap: Record<string, Set<string>> = {}; // 그룹 타이틀별 값 집합 (보유전자제품 등 통합용)
    
    // 문자열인 경우 파이프(|)로 구분된 키-값 쌍 파싱
    if (typeof jsonDoc === 'string') {
      // 파이프로 구분된 형식: "키1|값1|키2|값2|..."
      const parts = jsonDoc.split('|').filter(p => p.trim());
      for (let i = 0; i < parts.length; i += 2) {
        if (i + 1 < parts.length) {
          const rawKey = parts[i].trim();
          const rawValue = parts[i + 1].trim();
          if (rawKey && rawValue && rawValue !== '-') {
            const key = cleanKeyName(rawKey);
            const value = rawValue;
            const category = getGroupTitleForKey(key);
            
            processKeyValue(key, value, category, pairs, seenKeys, seenKeyOnly, categoryValueMap);
          }
        }
      }
    }
    // 객체인 경우 재귀적으로 키-값 추출
    else if (typeof jsonDoc === 'object' && jsonDoc !== null) {
      // 배열인 경우
      if (Array.isArray(jsonDoc)) {
        jsonDoc.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([k, v]) => {
              if (v !== null && v !== undefined) {
                const key = cleanKeyName(k);
                const value = typeof v === 'string' ? v : JSON.stringify(v);
                const category = getGroupTitleForKey(key);
                
                processKeyValue(key, value, category, pairs, seenKeys, seenKeyOnly, categoryValueMap);
              }
            });
          }
        });
      }
      // 일반 객체인 경우
      else {
        Object.entries(jsonDoc).forEach(([k, v]) => {
          // polls, answers 등은 설문 데이터로 처리하므로 제외
          if (k === 'polls' || k === 'answers' || k === 'respondent_id') {
            return;
          }
          
          if (v !== null && v !== undefined) {
            if (typeof v === 'object' && !Array.isArray(v)) {
              // 중첩 객체인 경우 재귀적으로 처리
              Object.entries(v).forEach(([nk, nv]) => {
                if (nv !== null && nv !== undefined) {
                  const key = cleanKeyName(`${k}.${nk}`);
                  const value = typeof nv === 'string' ? nv : JSON.stringify(nv);
                  const category = getGroupTitleForKey(nk);
                  
                  processKeyValue(key, value, category, pairs, seenKeys, seenKeyOnly, categoryValueMap);
                }
              });
            } else if (Array.isArray(v)) {
              // 배열인 경우 값들을 정리하여 표시
              const arrayValues = v
                .map(item => typeof item === 'string' ? item : JSON.stringify(item))
                .filter(item => item && item.trim() && item !== '-')
                .join(', ');
              
              if (arrayValues) {
                const key = cleanKeyName(k);
                const category = getGroupTitleForKey(key);
                
                processKeyValue(key, arrayValues, category, pairs, seenKeys, seenKeyOnly, categoryValueMap);
              }
            } else {
              const key = cleanKeyName(k);
              const value = typeof v === 'string' ? v : String(v);
              const category = getGroupTitleForKey(key);
              
              if (value && value !== '-') {
                processKeyValue(key, value, category, pairs, seenKeys, seenKeyOnly, categoryValueMap);
              }
            }
          }
        });
      }
    }
    
    // 보유전자제품 등 통합된 값들을 추가
    Object.entries(categoryValueMap).forEach(([groupTitle, values]) => {
      if (values.size > 0) {
        const uniqueValues = Array.from(values).sort();
        pairs.push({
          key: groupTitle,
          value: uniqueValues.join(', '),
          category: groupTitle
        });
      }
    });
    
    return pairs;
  };

  // 키워드에 따라 그룹 타이틀 분류
  const getGroupTitleForKey = (key: string): string => {
    const keyLower = key.toLowerCase();
    
    // 기본 정보 (성별, 나이, 지역)
    if (keyLower.includes('성별') || keyLower.includes('나이') || 
        (keyLower.includes('연령') && !keyLower.includes('분포')) || 
        keyLower.includes('지역') || keyLower.includes('출생') || keyLower.includes('birth')) {
      return '기본 정보';
    }
    
    // 가족 정보 (결혼여부, 자녀수, 가족수)
    if (keyLower.includes('결혼') || keyLower.includes('자녀수') || 
        (keyLower.includes('가족수') || keyLower.includes('가족'))) {
      return '가족 정보';
    }
    
    // 최종학력
    if (keyLower.includes('학력') || keyLower.includes('최종학력')) {
      return '최종학력';
    }
    
    // 직업/직무
    if (keyLower.includes('직업') || keyLower.includes('직무')) {
      return '직업/직무';
    }
    
    // 소득 (월평균 개인소득, 월평균 가구소득)
    if (keyLower.includes('소득') || keyLower.includes('income') || 
        keyLower.includes('가구소득') || keyLower.includes('개인소득')) {
      return '소득';
    }
    
    // 보유 전자제품
    if (keyLower.includes('보유전자제품') || keyLower.includes('보유전제품') ||
        (keyLower.includes('전제품') && keyLower.includes('보유')) ||
        keyLower.includes('이어폰') || keyLower.includes('에어팟') || keyLower.includes('버즈') ||
        keyLower.includes('워치') || keyLower.includes('태블릿') || keyLower.includes('노트북') ||
        keyLower.includes('데스크탑') || keyLower.includes('스피커') || keyLower.includes('청소기') ||
        keyLower.includes('tv') || keyLower.includes('티비') || keyLower.includes('세탁기') ||
        keyLower.includes('정수기') || keyLower.includes('냉장고') || keyLower.includes('에어컨') ||
        keyLower.includes('안마의자')) {
      return '보유 전자제품';
    }
    
    // 휴대폰 (보유 휴대폰 단말기 브랜드, 보유 휴대폰 모델명)
    if (keyLower.includes('휴대폰') || keyLower.includes('스마트폰')) {
      return '휴대폰';
    }
    
    // 자동차 (자동차 제조사, 자동차 모델)
    if (keyLower.includes('자동차') || keyLower.includes('차량') || 
        (keyLower.includes('차') && !keyLower.includes('가구수') && !keyLower.includes('보유차량여부')) ||
        keyLower.includes('car')) {
      return '자동차';
    }
    
    // 흡연 (흡연경험, 흡연경험 담배브랜드)
    if (keyLower.includes('흡연') || keyLower.includes('담배')) {
      return '흡연';
    }
    
    // 음용 (음용경험, 음용경험 술)
    if (keyLower.includes('음용') || keyLower.includes('술')) {
      return '음용';
    }
    
    return '기타';
  };
  
  // 키 이름 정제 (전제품 → 전자제품 등)
  const cleanKeyName = (key: string): string => {
    return key
      .replace(/전제품/g, '전자제품')
      .replace(/보유전제품/g, '보유 전자제품')
      .replace(/보유전자제품/g, '보유 전자제품');
  };

  // 키-값 쌍이 검색 질의와 관련이 있는지 확인
  const isRelevantToQuery = (key: string, value: string, queryKeywords: string[]): boolean => {
    if (queryKeywords.length === 0) return true; // 검색어가 없으면 모두 표시
    
    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();
    const combinedText = `${keyLower} ${valueLower}`;
    
    // 키워드 중 하나라도 포함되면 관련 있음
    return queryKeywords.some(keyword => 
      combinedText.includes(keyword) || 
      keyLower.includes(keyword) || 
      valueLower.includes(keyword)
    );
  };
  
  const surveys = extractSurveyData(panel.json_doc);
  const birthYearText = panel.birth_year ? `${panel.birth_year}년생` : '';
  const fullRegion = panel.district ? `${panel.region} ${panel.district}` : panel.region;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide Over Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out"
        style={{ transform: panelId ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#7c5cff] via-[#6b7dff] to-[#5bc3ff] px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-base">패널 상세 정보</h2>
                <p className="text-xs text-white/80">{panel.respondent_id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 rounded-full hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading && (
              <div className="text-center py-8">
                <div className="text-gray-400">로딩 중...</div>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {!isLoading && panel && (
              <>
                {/* 매칭 정보 섹션 (의미 기반 검색 결과에서만 표시) */}
                {panelData?.matchScore !== undefined && panelData.matchScore > 0 && (
                  <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-blue-50 rounded-2xl p-5 border border-violet-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-violet-600" />
                      <h3 className="text-lg font-semibold text-gray-900">이 패널이 뽑힌 이유</h3>
                    </div>
                    
                    {/* Match Score */}
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                          panelData.matchScore >= 90 ? 'bg-green-500' : 
                          panelData.matchScore >= 80 ? 'bg-blue-500' : 
                          'bg-violet-500'
                        }`}>
                          {panelData.matchScore}%
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">Match Score</div>
                          <div className="text-xs text-gray-500">검색 의도와의 유사도</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 매칭 키워드 */}
                    {queryKeywords.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          매칭된 키워드
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {queryKeywords.map((keyword, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 매칭 이유 (하이라이팅된 텍스트) - 질의와 관련된 내용만 표시 */}
                    {extractRelevantContent ? (
                      <div>
                        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          매칭된 내용
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm text-gray-700 leading-relaxed max-h-48 overflow-y-auto">
                          <div className="space-y-2">
                            {extractRelevantContent.split(' | ').map((part, idx) => (
                              <div key={idx} className="pb-2 border-b border-gray-100 last:border-0 last:pb-0">
                                {highlightMatchText(part)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : panelData.content ? (
                      <div>
                        <div className="text-xs text-gray-600 mb-2">매칭된 내용</div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm text-gray-500 italic">
                          질의와 관련된 내용을 찾을 수 없습니다.
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                
                {/* Profile Section */}
                <div className="bg-gradient-to-br from-violet-50 to-white rounded-2xl p-5 border border-violet-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
                      {panel.gender === '남' ? '👨' : '👩'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {panel.gender} · {panel.age_text || '-'} {birthYearText ? `(${birthYearText})` : ''}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin size={14} className="text-indigo-500" />
                          <span>{fullRegion}</span>
                        </div>
                        {panel.last_response_date && (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} className="text-violet-500" />
                            <span>최근 응답: {panel.last_response_date}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">기본 정보</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-gray-500">성별</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{panel.gender}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">연령</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {panel.age_text || '-'} {birthYearText ? `(${birthYearText})` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">지역</span>
                      <p className="text-sm font-medium text-gray-900 mt-1">{fullRegion}</p>
                    </div>
                    {panel.last_response_date && (
                      <div>
                        <span className="text-xs text-gray-500">최근 응답일</span>
                        <p className="text-sm font-medium text-gray-900 mt-1">{panel.last_response_date}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Survey List */}
                {surveys.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-gray-800">
                        참여한 설문 목록
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        총 {surveys.length}개
                      </span>
                    </div>
                    <div className="space-y-4">
                      {surveys.map((survey, idx) => {
                        const isExpanded = expandedSurveys.has(survey.id);
                        const displayResponses = isExpanded ? survey.responses : survey.responses.slice(0, 3);
                        
                        return (
                          <div
                            key={survey.id}
                            className="border border-gray-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-md transition-all bg-gradient-to-br from-white to-gray-50/50"
                          >
                            {/* 설문 헤더 */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                    {idx + 1}
                                  </div>
                                  <h5 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                    {survey.title}
                                  </h5>
                                </div>
                                <div className="flex items-center gap-3 mt-2 ml-10">
                                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <Calendar size={12} className="text-violet-500" />
                                    <span>{survey.date}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                                    <span>{survey.responses.length}개 응답</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* 응답 목록 */}
                            <div className="space-y-2.5 mt-3 ml-10">
                              {displayResponses.map((response, rIdx) => (
                                <div 
                                  key={rIdx} 
                                  className="bg-white rounded-lg p-3 border border-gray-100 hover:border-violet-200 transition-colors"
                                >
                                  <div className="text-xs font-medium text-gray-700 mb-1.5 line-clamp-1">
                                    {response.question}
                                  </div>
                                  <div className="text-xs text-gray-900 font-semibold bg-violet-50/50 rounded px-2 py-1.5 border-l-2 border-violet-400">
                                    {response.answer}
                                  </div>
                                </div>
                              ))}
                              
                              {/* 더보기/접기 버튼 */}
                              {survey.responses.length > 3 && (
                                <button
                                  onClick={() => {
                                    setExpandedSurveys(prev => {
                                      const next = new Set(prev);
                                      if (isExpanded) {
                                        next.delete(survey.id);
                                      } else {
                                        next.add(survey.id);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 mt-2 transition-colors"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={14} />
                                      <span>접기</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />
                                      <span>외 {survey.responses.length - 3}개 응답 더보기</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 상세 응답 데이터 - 구조화된 카드 형태 */}
                {panel.json_doc && (() => {
                  const allKeyValuePairs = extractKeyValuePairs(panel.json_doc);
                  
                  // highlight_fields가 있으면 우선 정렬
                  let sortedPairs = [...allKeyValuePairs];
                  if (highlightFields && highlightFields.length > 0) {
                    sortedPairs.sort((a, b) => {
                      const aInHighlight = highlightFields.some(field => 
                        a.key.includes(field) || field.includes(a.key)
                      );
                      const bInHighlight = highlightFields.some(field => 
                        b.key.includes(field) || field.includes(b.key)
                      );
                      
                      if (aInHighlight && !bInHighlight) return -1;
                      if (!aInHighlight && bInHighlight) return 1;
                      
                      // 둘 다 highlight에 있으면 highlightFields 순서대로
                      if (aInHighlight && bInHighlight) {
                        const aIndex = highlightFields.findIndex(field => 
                          a.key.includes(field) || field.includes(a.key)
                        );
                        const bIndex = highlightFields.findIndex(field => 
                          b.key.includes(field) || field.includes(b.key)
                        );
                        return aIndex - bIndex;
                      }
                      
                      return 0;
                    });
                  }
                  
                  // 검색 질의와 관련된 항목만 필터링
                  const keyValuePairs = queryKeywords.length > 0
                    ? sortedPairs.filter(pair => 
                        isRelevantToQuery(pair.key, pair.value, queryKeywords)
                      )
                    : sortedPairs;
                  
                  // 관련 항목이 없으면 메시지 표시
                  if (keyValuePairs.length === 0 && queryKeywords.length > 0) {
                    return (
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4">상세 응답 데이터</h4>
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-sm mb-2">검색 질의와 관련된 정보가 없습니다.</p>
                          <p className="text-xs">검색어: "{query}"</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // 그룹 타이틀별로 그룹화
                  const groupedByTitle = groupItemsByTitle(keyValuePairs);
                  
                  // 그룹 타이틀 순서 정의
                  const titleOrder = [
                    '기본 정보',
                    '가족 정보',
                    '최종학력',
                    '직업/직무',
                    '소득',
                    '보유 전자제품',
                    '휴대폰',
                    '자동차',
                    '흡연',
                    '음용',
                    '기타'
                  ];
                  
                  if (keyValuePairs.length === 0) {
                    // 키-값 쌍이 없으면 원본 JSON 표시
                    return (
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4">상세 응답 데이터</h4>
                        <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {typeof panel.json_doc === 'string' 
                              ? panel.json_doc 
                              : JSON.stringify(panel.json_doc, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  }
                  
                  // 그룹 타이틀별 아이콘과 색상
                  const titleConfig: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
                    '기본 정보': { icon: '👤', color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
                    '가족 정보': { icon: '👨‍👩‍👧‍👦', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
                    '최종학력': { icon: '🎓', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
                    '직업/직무': { icon: '💼', color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
                    '소득': { icon: '💰', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
                    '보유 전자제품': { icon: '📱', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
                    '휴대폰': { icon: '📱', color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
                    '자동차': { icon: '🚗', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
                    '흡연': { icon: '🚬', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
                    '음용': { icon: '🍷', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
                    '기타': { icon: '📋', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }
                  };
                  
                  // 아코디언 토글 함수
                  const toggleGroup = (title: string) => {
                    setExpandedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(title)) {
                        next.delete(title);
                      } else {
                        next.add(title);
                      }
                      return next;
                    });
                  };

                  return (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <h4 className="text-sm font-semibold text-gray-800 mb-4">상세 응답 데이터</h4>
                      <div className="space-y-2">
                        {titleOrder.map(title => {
                          const items = groupedByTitle[title];
                          if (!items || items.length === 0) return null;
                          
                          const config = titleConfig[title] || titleConfig['기타'];
                          const isExpanded = expandedGroups.has(title);
                          
                          // 한 줄로 표시할 그룹들 (키-값 쌍을 한 줄로)
                          const displayItems = items.map(item => `${item.key}: ${item.value}`).join(', ');
                          
                          return (
                            <div key={title} className="border border-gray-200 rounded-xl overflow-hidden">
                              <button
                                onClick={() => toggleGroup(title)}
                                className={`w-full flex items-center justify-between px-3 py-2 ${config.bgColor} hover:opacity-90 transition-opacity`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{config.icon}</span>
                                  <h5 className={`text-sm font-semibold ${config.color}`}>{title}</h5>
                                  <span className="text-xs text-gray-500">({items.length}개)</span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="p-3 bg-white border-t border-gray-200">
                                  <div className={`rounded-lg p-3 border ${config.borderColor} text-sm text-gray-900 break-words`}>
                                    {displayItems}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

