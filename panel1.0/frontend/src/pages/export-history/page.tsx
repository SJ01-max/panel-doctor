import React, { useState, useEffect } from 'react';
import { Download, Eye, Search, Filter, CheckCircle2, XCircle, Clock, FileText, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { 
  getExportHistory, 
  getExportStats, 
  downloadExport,
  type ExportHistory,
  type ExportStats
} from '../../api/export';

/**
 * 내보내기 이력 페이지
 * 최근 내보내기 기록을 확인하고 재다운로드할 수 있습니다.
 */
export default function ExportHistoryPage() {
  const [filters, setFilters] = useState({
    period: '30',
    fileType: 'all',
    status: 'all',
    search: '',
  });

  return (
    <div className="p-8 space-y-8">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">내보내기 이력</h1>
        <p className="text-gray-500 text-sm">
          최근 내보내기 기록을 확인하고 재다운로드할 수 있습니다.
        </p>
      </div>

      {/* 섹션들 */}
      <FilterBar onFilterChange={setFilters} />
      <SummaryCards />
      <HistoryTable filters={filters} />
      <DetailDrawer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             1) 필터 바 (Filter Bar)                         */
/* -------------------------------------------------------------------------- */
function FilterBar({ onFilterChange }: { onFilterChange: (filters: any) => void }) {
  const [period, setPeriod] = useState('30');
  const [fileType, setFileType] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    onFilterChange({ period, fileType, status, search: searchQuery });
  }, [period, fileType, status, searchQuery, onFilterChange]);

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* 기간 필터 */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-white"
          >
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="90">최근 90일</option>
            <option value="all">전체</option>
          </select>
        </div>

        {/* 파일 유형 필터 */}
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-white w-full md:w-auto"
        >
          <option value="all">전체 파일 유형</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="pdf">PDF</option>
        </select>

        {/* 상태 필터 */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-white w-full md:w-auto"
        >
          <option value="all">전체 상태</option>
          <option value="success">성공</option>
          <option value="failed">실패</option>
          <option value="processing">처리 중</option>
        </select>

        {/* 검색 입력 */}
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="파일명, 설명 검색"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all bg-white"
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           2) 상단 Summary Cards                             */
/* -------------------------------------------------------------------------- */
function SummaryCards() {
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await getExportStats();
        setStats(data);
      } catch (error) {
        console.error('통계 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const summary = [
    {
      label: '총 내보내기 수',
      value: stats?.total?.toLocaleString() || '0',
      color: 'blue',
      icon: FileText,
      bgGradient: 'from-blue-50 to-blue-100/50',
      textColor: 'text-blue-600',
    },
    {
      label: '성공',
      value: stats?.success?.toLocaleString() || '0',
      color: 'green',
      icon: CheckCircle2,
      bgGradient: 'from-green-50 to-green-100/50',
      textColor: 'text-green-600',
    },
    {
      label: '실패',
      value: stats?.failed?.toLocaleString() || '0',
      color: 'red',
      icon: XCircle,
      bgGradient: 'from-red-50 to-red-100/50',
      textColor: 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {summary.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.bgGradient}`}>
                <Icon className={`w-5 h-5 ${stat.textColor}`} />
              </div>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <p className="text-gray-500 text-sm font-medium mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.textColor}`}>
              {isLoading ? '-' : stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          3) 내보내기 이력 테이블                           */
/* -------------------------------------------------------------------------- */
function HistoryTable({ filters }: { filters: any }) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [history, setHistory] = useState<ExportHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const data = await getExportHistory({
          period: filters.period === 'all' ? undefined : filters.period,
          file_type: filters.fileType === 'all' ? undefined : filters.fileType,
          status: filters.status === 'all' ? undefined : filters.status,
          search: filters.search || undefined,
        });
        setHistory(data);
      } catch (error) {
        console.error('내보내기 이력 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, [filters]);

  const rows = history.map((item) => {
    // export_type을 한글로 변환
    const typeMap: Record<string, string> = {
      'target_group': '타겟 그룹 내보내기',
      'panel_search': '패널 검색 결과',
      'report': '리포트',
    };
    
    // 날짜 포맷팅
    const date = new Date(item.created_at);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    return {
      id: item.id,
      date: formattedDate,
      file: item.file_name,
      type: typeMap[item.export_type] || item.export_type,
      count: item.panel_count > 0 ? `${item.panel_count.toLocaleString()}명` : '-',
      status: item.status as 'success' | 'failed' | 'processing',
      size: item.file_size_mb ? `${item.file_size_mb}MB` : '-',
      description: item.description || '',
      exportItem: item, // 원본 데이터 보관
    };
  });

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
    } else if (fileName.endsWith('.pdf')) {
      return <File className="w-4 h-4 text-red-500" />;
    }
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const handleDownload = async (row: typeof rows[0]) => {
    if (row.status === 'processing') {
      alert('파일이 아직 생성 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (row.status === 'failed') {
      alert('파일 생성에 실패했습니다. 다시 내보내기를 시도해주세요.');
      return;
    }
    
    try {
      await downloadExport(row.id);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const handleViewDetail = (rowId: number) => {
    setSelectedRow(selectedRow === rowId ? null : rowId);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">내보내기 기록</h2>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : (
          <span className="text-sm text-gray-500">총 {rows.length}건</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="ml-2 text-gray-500">데이터 로딩 중...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          내보내기 이력이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-3 px-4 font-semibold text-gray-700">날짜</th>
              <th className="py-3 px-4 font-semibold text-gray-700">파일명</th>
              <th className="py-3 px-4 font-semibold text-gray-700">유형</th>
              <th className="py-3 px-4 font-semibold text-gray-700">패널 수</th>
              <th className="py-3 px-4 font-semibold text-gray-700">크기</th>
              <th className="py-3 px-4 font-semibold text-gray-700">상태</th>
              <th className="py-3 px-4 font-semibold text-gray-700 text-center">옵션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                } hover:bg-violet-50/50`}
              >
                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{row.date}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {getFileIcon(row.file)}
                    <span className="font-medium text-gray-900">{row.file}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">{row.type}</td>
                <td className="py-3 px-4 text-gray-700">{row.count}</td>
                <td className="py-3 px-4 text-gray-600">{row.size}</td>
                <td className="py-3 px-4">
                  {row.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      성공
                    </span>
                  ) : row.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      <XCircle className="w-3 h-3" />
                      실패
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                      <Clock className="w-3 h-3" />
                      처리 중
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleDownload(row)}
                      disabled={row.status === 'processing'}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      다운로드
                    </button>
                    <button
                      onClick={() => handleViewDetail(row.id)}
                      className="flex items-center gap-1 text-gray-600 hover:text-gray-700 text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      상세보기
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* 선택된 행의 상세 정보 (인라인 표시) */}
      {selectedRow !== null && (
        <div className="mt-4 p-4 bg-violet-50/50 border border-violet-100 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {rows.find((r) => r.id === selectedRow)?.description}
              </p>
              <p className="text-xs text-gray-500">
                생성 시간: {rows.find((r) => r.id === selectedRow)?.date}
              </p>
              {rows.find((r) => r.id === selectedRow)?.exportItem?.metadata && (
                <div className="mt-2 text-xs text-gray-600">
                  <p>메타데이터: {JSON.stringify(rows.find((r) => r.id === selectedRow)?.exportItem?.metadata)}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedRow(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                      4) 상세 보기 Drawer (슬라이드 패널)                    */
/* -------------------------------------------------------------------------- */
function DetailDrawer() {
  /*
    상세 보기 Drawer는 오른쪽에서 slide-in 되는 UI입니다.
    현재는 구조만 잡아놓고 비활성 상태로 둡니다.
    추후 open/close 상태를 연결하여 사용할 수 있습니다.
  */

  return (
    <div className="hidden">
      {/* 
        여기에 상세 정보 UI가 들어갑니다.
        예시 구조:
        
        <div className="fixed inset-0 z-50">
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl">
            <div className="p-6">
              <h3>상세 정보</h3>
              ...
            </div>
          </div>
        </div>
      */}
    </div>
  );
}

