import { useState, useEffect } from 'react';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import Badge from '../../components/base/Badge';
import type { PanelSearchResult } from '../../types/panel';
import type { LlmSqlResponse } from '../../api/llm';

interface ReportEntry {
  id: string;
  query: string;
  timestamp: string;
  results: PanelSearchResult;
  llm: LlmSqlResponse | null;
}

// 조건 카테고리 추출 헬퍼
const extractConditionCategory = (chips: string[]) => {
  const conditions: {
    region?: string;
    age?: string;
    gender?: string;
    count?: string;
    others?: string[];
  } = { others: [] };

  chips.forEach(chip => {
    if (chip.includes('서울') || chip.includes('경기') || chip.includes('부산') || chip.includes('대전') || chip.includes('인천') || chip.includes('지역')) {
      conditions.region = chip;
    } else if (chip.includes('대') || chip.includes('세') || /\d+대/.test(chip)) {
      conditions.age = chip;
    } else if (chip.includes('남') || chip.includes('여') || chip.includes('성별')) {
      conditions.gender = chip;
    } else if (chip.includes('명') || chip.includes('개') || /\d+명/.test(chip)) {
      conditions.count = chip;
    } else {
      conditions.others?.push(chip);
    }
  });

  return conditions;
};

// 간단한 막대 그래프 컴포넌트
const SimpleBarChart = ({ data, label, color }: { data: { label: string; value: number }[], label: string, color: string }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-700 mb-3">{label}</div>
      {data.map((item, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{item.label}</span>
            <span className="font-semibold text-gray-900">{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${color}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};

// 리포트 상세 컴포넌트
const ReportDetail = ({ 
  entry, 
  onBack 
}: { 
  entry: ReportEntry; 
  onBack: () => void;
}) => {
  const [showPanelSamples, setShowPanelSamples] = useState(false);
  const results = entry.results;
  const llm = entry.llm;
  const conditions = results ? extractConditionCategory(results.extractedChips) : null;
  const extractedPanels = results?.panelIds?.slice(0, 10).map((id, idx) => ({
    id: id,
    name: `패널 ${idx + 1}`,
    index: idx + 1
  })) || [];
  const totalPanelCount = results?.panelIds?.length || 0;
  const genderDistribution = results?.distributionStats?.gender || [];
  const ageDistribution = results?.distributionStats?.age || [];

  const handleDownloadIds = () => {
    if (!results || !results.panelIds || results.panelIds.length === 0) return;
    
    const header = "panel_id (mb_sn)\n";
    const csvContent = "data:text/csv;charset=utf-8," + header + results.panelIds.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `panel_ids_${entry.id}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    if (!results || !results.panelIds || results.panelIds.length === 0) return;
    
    const header = "panel_id (mb_sn)\n";
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + header + results.panelIds.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `panel_ids_${entry.id}.xlsx`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 리포트 헤더 */}
      <Card className="backdrop-blur-sm bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white animate-slide-up border-0 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Button
                onClick={onBack}
                variant="secondary"
                size="sm"
                className="bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30"
              >
                <i className="ri-arrow-left-line mr-2"></i>
                목록으로
              </Button>
            </div>
            <h2 className="text-2xl font-bold mb-1 flex items-center">
              <i className="ri-file-chart-2-line mr-3"></i>
              패널 추출 리포트
            </h2>
            <p className="text-white/80 text-sm mb-2">
              질의: {entry.query}
            </p>
            <p className="text-white/80 text-sm">
              생성 시간: {new Date(entry.timestamp).toLocaleString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadIds}
              disabled={!results.panelIds || !Array.isArray(results.panelIds) || results.panelIds.length === 0}
              variant="secondary"
              size="sm"
              className="bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30"
            >
              <i className="ri-download-line mr-2"></i>
              리포트 다운로드
            </Button>
          </div>
        </div>
      </Card>

      {/* 핵심 지표 요약 */}
      <Card className="backdrop-blur-sm bg-white/90 animate-slide-up border-2 border-gray-100 shadow-lg">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 flex items-center mb-1">
            <i className="ri-dashboard-3-line mr-2 text-[#2F6BFF]"></i>
            핵심 지표 요약
          </h3>
          <p className="text-sm text-gray-500">추출된 패널의 주요 통계 정보</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 조건에 맞는 총 패널 수 */}
          <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200/50 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-md">
                <i className="ri-group-line text-white text-xl"></i>
              </div>
              <Badge variant="info" className="text-xs">전체 매칭</Badge>
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] bg-clip-text text-transparent mb-1">
              {(results.estimatedCount || 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 font-medium">조건에 맞는 총 패널 수</div>
            <div className="mt-3 pt-3 border-t border-blue-200/50">
              <div className="flex items-center text-xs text-gray-500">
                <i className="ri-information-line mr-1"></i>
                필터 조건 기준
              </div>
            </div>
          </div>
          
          {/* 실제 추출된 패널 수 */}
          <div className="relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-green-200/50 hover:border-green-300 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-md">
                <i className="ri-checkbox-circle-line text-white text-xl"></i>
              </div>
              <Badge variant="success" className="text-xs">추출 완료</Badge>
            </div>
            {results.panelIds && results.panelIds.length > 0 ? (
              <>
                <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">
                  {results.panelIds.length.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 font-medium">실제 추출된 패널 수</div>
                {conditions?.count && (
                  <div className="mt-3 pt-3 border-t border-green-200/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">목표 수</span>
                      <span className="text-xs font-semibold text-green-700">{conditions.count}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-300 mb-1">0</div>
                <div className="text-sm text-gray-400">추출된 패널 없음</div>
              </>
            )}
          </div>

          {/* 추출률 */}
          <div className="relative bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 rounded-xl p-6 border-2 border-purple-200/50 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-md">
                <i className="ri-percent-line text-white text-xl"></i>
              </div>
              <Badge variant="neutral" className="text-xs">효율성</Badge>
            </div>
            {results.estimatedCount > 0 ? (
              <>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                  {((results.panelIds?.length || 0) / results.estimatedCount * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 font-medium">추출률</div>
                <div className="mt-3 pt-3 border-t border-purple-200/50">
                  <div className="flex items-center text-xs text-gray-500">
                    <i className="ri-bar-chart-line mr-1"></i>
                    {results.panelIds?.length || 0} / {results.estimatedCount}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-300 mb-1">0%</div>
                <div className="text-sm text-gray-400">데이터 없음</div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* AI 필터 해석 */}
      {llm && llm.answer && (
        <Card className="backdrop-blur-sm bg-white/90 animate-slide-up">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
            <i className="ri-robot-line mr-2 text-[#8B5CF6]"></i>
            AI 필터 해석 (Reasoning)
          </h3>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-sm">
              {llm.answer}
            </div>
          </div>
        </Card>
      )}

      {/* 추출된 조건 및 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 추출된 조건 */}
        <Card className="backdrop-blur-sm bg-white/90 animate-slide-up">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
            <i className="ri-file-list-3-line mr-2 text-[#2F6BFF]"></i>
            추출된 조건
          </h3>
          
          {conditions && (
            <div className="space-y-4">
              {conditions.region && (
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                      <i className="ri-map-pin-line text-white text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">지역</div>
                      <div className="font-bold text-gray-900">{conditions.region}</div>
                    </div>
                  </div>
                </div>
              )}

              {conditions.age && (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <i className="ri-calendar-line text-white text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">연령</div>
                      <div className="font-bold text-gray-900">{conditions.age}</div>
                    </div>
                  </div>
                </div>
              )}

              {conditions.gender && (
                <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                      <i className="ri-user-line text-white text-lg"></i>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">성별</div>
                      <div className="font-bold text-gray-900">{conditions.gender}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* 분포 통계 */}
        <div className="space-y-6">
          {genderDistribution.length > 0 && (
            <Card className="backdrop-blur-sm bg-white/90 animate-slide-up">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                <i className="ri-pie-chart-line mr-2 text-purple-600"></i>
                성별 분포
              </h3>
              {genderDistribution.length === 1 ? (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {genderDistribution[0].value.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {genderDistribution[0].label === '남' ? '남성' : genderDistribution[0].label === '여' ? '여성' : genderDistribution[0].label}
                    </div>
                  </div>
                </div>
              ) : (
                <SimpleBarChart 
                  data={genderDistribution} 
                  label="성별"
                  color="bg-gradient-to-r from-pink-500 to-rose-500"
                />
              )}
            </Card>
          )}

          {ageDistribution.length > 0 && (
            <Card className="backdrop-blur-sm bg-white/90 animate-slide-up">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                <i className="ri-bar-chart-2-line mr-2 text-blue-600"></i>
                연령대 분포
              </h3>
              {ageDistribution.length === 1 ? (
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {ageDistribution[0].value.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {ageDistribution[0].label}
                    </div>
                  </div>
                </div>
              ) : (
                <SimpleBarChart 
                  data={ageDistribution} 
                  label="연령대"
                  color="bg-gradient-to-r from-blue-500 to-cyan-500"
                />
              )}
            </Card>
          )}
        </div>
      </div>

      {/* 데이터 다운로드 및 샘플 */}
      <Card className="backdrop-blur-sm bg-white/90 animate-slide-up border-2 border-gray-100 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center mb-1">
              <i className="ri-database-2-line mr-2 text-[#2F6BFF]"></i>
              추출된 패널 데이터
            </h3>
            <p className="text-sm text-gray-500">총 {totalPanelCount.toLocaleString()}개의 패널이 추출되었습니다</p>
          </div>
          {totalPanelCount > 0 && (
            <Badge variant="success" className="text-sm px-3 py-1">
              <i className="ri-check-line mr-1"></i>
              추출 완료
            </Badge>
          )}
        </div>

        {totalPanelCount > 0 ? (
          <>
            {/* 다운로드 버튼 그룹 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <Button
                onClick={handleDownloadIds}
                disabled={!results.panelIds || !Array.isArray(results.panelIds) || results.panelIds.length === 0}
                variant="secondary"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <i className="ri-file-text-line mr-2"></i>
                CSV 다운로드
                <span className="ml-2 text-xs opacity-90">({totalPanelCount.toLocaleString()}개)</span>
              </Button>
              
              <Button
                onClick={handleDownloadExcel}
                disabled={!results.panelIds || !Array.isArray(results.panelIds) || results.panelIds.length === 0}
                variant="secondary"
                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-600 hover:to-emerald-600 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <i className="ri-file-excel-2-line mr-2"></i>
                Excel 다운로드
                <span className="ml-2 text-xs opacity-90">({totalPanelCount.toLocaleString()}개)</span>
              </Button>
              
              {extractedPanels.length > 0 && (
                <Button
                  onClick={() => setShowPanelSamples(!showPanelSamples)}
                  variant="secondary"
                  className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 hover:from-pink-600 hover:to-rose-600 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <i className={`ri-${showPanelSamples ? 'eye-off' : 'eye'}-line mr-2`}></i>
                  {showPanelSamples ? '샘플 접기' : '샘플 보기'}
                  <span className="ml-2 text-xs opacity-90">(최대 10개)</span>
                </Button>
              )}
            </div>

            {/* 패널 샘플 리스트 */}
            {showPanelSamples && extractedPanels.length > 0 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                    <i className="ri-list-check mr-2 text-indigo-600"></i>
                    패널 샘플 미리보기
                  </h4>
                  <Badge variant="info" className="text-xs">
                    {extractedPanels.length} / {totalPanelCount.toLocaleString()}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extractedPanels.map((panel) => (
                    <div 
                      key={panel.id}
                      className="p-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl border-2 border-indigo-200/50 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                          {panel.index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500 mb-1">패널 ID</div>
                          <div className="text-sm font-mono text-gray-800 truncate font-semibold" title={panel.id}>
                            {panel.id}
                          </div>
                        </div>
                        <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-indigo-600 transition-colors"></i>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPanelCount > 10 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border-2 border-blue-200/50 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <i className="ri-information-line text-blue-600"></i>
                      <span>
                        전체 <strong className="text-gray-900">{totalPanelCount.toLocaleString()}개</strong> 패널 중 
                        샘플 <strong className="text-gray-900">{extractedPanels.length}개</strong>만 표시됩니다.
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      전체 데이터는 CSV/Excel 다운로드를 통해 확인하실 수 있습니다.
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-inbox-line text-4xl text-gray-400"></i>
            </div>
            <div className="text-lg font-semibold text-gray-600 mb-2">추출된 패널이 없습니다</div>
            <div className="text-sm text-gray-500">
              질의 조건을 수정하여 다시 검색해주세요.
            </div>
          </div>
        )}
      </Card>

      {/* 참고 사항 */}
      {results.warnings && results.warnings.length > 0 && (
        <Card className="backdrop-blur-sm bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 animate-slide-up border-2 border-yellow-300/50 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center shadow-md">
              <i className="ri-alert-line text-white text-lg"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-yellow-900">리포트 참고 사항</h3>
              <p className="text-xs text-yellow-700/80">추출 과정에서 확인된 중요 정보</p>
            </div>
          </div>
          <div className="space-y-3">
            {results.warnings.map((warning, index) => (
              <div 
                key={index} 
                className="p-4 bg-white/80 backdrop-blur-sm border-2 border-yellow-200/50 text-yellow-900 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-information-line text-white text-xs"></i>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium leading-relaxed">{warning}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const HISTORY_STORAGE_KEY = 'panel_extraction_history';

export default function ReportView() {
  const [history, setHistory] = useState<ReportEntry[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportEntry | null>(null);

  useEffect(() => {
    // 로컬 스토리지에서 히스토리 불러오기
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse history:', e);
        setHistory([]);
      }
    }
  }, []);

  const handleDeleteReport = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSelectReport = (entry: ReportEntry) => {
    setSelectedReport(entry);
  };

  // 리포트 상세 보기
  if (selectedReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <ReportDetail 
          entry={selectedReport} 
          onBack={() => setSelectedReport(null)}
        />
      </div>
    );
  }

  // 리포트 목록
  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
        <Card className="backdrop-blur-sm bg-white/90 animate-fade-in">
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-file-chart-line text-5xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">리포트가 없습니다</h2>
            <p className="text-gray-600 mb-6">
              자연어 질의를 통해 패널을 추출하면 리포트가 생성됩니다.
            </p>
            <Button
              onClick={() => {
                // 자연어 질의 페이지로 이동
                window.location.href = '/?tab=panel&menu=query';
              }}
              variant="primary"
              className="bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white"
            >
              <i className="ri-edit-box-line mr-2"></i>
              자연어 질의로 이동
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      {/* 리포트 목록 헤더 */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] bg-clip-text text-transparent mb-2">
              패널 추출 리포트
            </h1>
            <p className="text-gray-600">최근 추출한 패널 리포트 목록입니다</p>
          </div>
          <Badge variant="info" className="text-sm px-3 py-1">
            총 {history.length}개
          </Badge>
        </div>
      </div>

      {/* 리포트 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {history.map((entry) => {
          const conditions = extractConditionCategory(entry.results.extractedChips);
          const panelCount = entry.results.panelIds?.length || 0;
          const estimatedCount = entry.results.estimatedCount || 0;
          
          return (
            <Card
              key={entry.id}
              onClick={() => handleSelectReport(entry)}
              className="backdrop-blur-sm bg-white/90 animate-slide-up border-2 border-gray-100 shadow-lg hover:shadow-xl hover:border-[#2F6BFF]/30 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ri-file-chart-2-line text-white text-lg"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-[#2F6BFF] transition-colors">
                        리포트 #{history.indexOf(entry) + 1}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(entry.timestamp).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  {/* 질의 내용 */}
                  <div className="mb-4 p-3 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1 flex items-center">
                      <i className="ri-question-line mr-1"></i>
                      질의 내용
                    </div>
                    <div className="text-sm font-medium text-gray-800 line-clamp-2">
                      {entry.query}
                    </div>
                  </div>

                  {/* 주요 조건 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {conditions.region && (
                      <Badge variant="info" className="text-xs">
                        <i className="ri-map-pin-line mr-1"></i>
                        {conditions.region}
                      </Badge>
                    )}
                    {conditions.age && (
                      <Badge variant="info" className="text-xs">
                        <i className="ri-calendar-line mr-1"></i>
                        {conditions.age}
                      </Badge>
                    )}
                    {conditions.gender && (
                      <Badge variant="info" className="text-xs">
                        <i className="ri-user-line mr-1"></i>
                        {conditions.gender}
                      </Badge>
                    )}
                  </div>

                  {/* 통계 요약 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-500 mb-1">전체 매칭</div>
                      <div className="text-lg font-bold text-blue-600">
                        {estimatedCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="text-xs text-gray-500 mb-1">추출 완료</div>
                      <div className="text-lg font-bold text-green-600">
                        {panelCount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => handleDeleteReport(entry.id, e)}
                  className="ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 flex-shrink-0"
                  title="리포트 삭제"
                >
                  <i className="ri-delete-bin-line text-lg"></i>
                </button>
              </div>

              {/* 하단 액션 */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  <i className="ri-time-line mr-1"></i>
                  {new Date(entry.timestamp).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-gradient-to-r from-[#2F6BFF] to-[#8B5CF6] text-white border-0 hover:from-[#2F6BFF]/90 hover:to-[#8B5CF6]/90"
                >
                  <i className="ri-eye-line mr-1"></i>
                  상세 보기
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
