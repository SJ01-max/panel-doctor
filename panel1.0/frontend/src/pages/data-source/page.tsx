import React, { useState, useEffect } from 'react';
import { FileText, Database, AlertCircle, Clock, CheckCircle2, XCircle, Eye, RefreshCw, Trash2, Loader2, X } from 'lucide-react';
import { 
  getDataSourceStats, 
  getDataSourceTables, 
  getSchemaInfo, 
  getErrorLogs, 
  getLoadHistory,
  getTablePreview,
  type DataSourceStats,
  type DataSourceTable,
  type SchemaInfo,
  type ErrorLog,
  type LoadHistoryItem,
  type TablePreview
} from '../../api/data-source';

/**
 * 데이터 소스 관리 페이지
 * 패널 데이터 적재 현황과 데이터 구조를 확인할 수 있습니다.
 */
export default function DataSourcePage() {
  return (
    <div className="p-8 space-y-8">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">데이터 소스</h1>
        <p className="text-gray-500 text-sm">
          패널 데이터 적재 현황과 데이터 구조를 한눈에 확인할 수 있습니다.
        </p>
      </div>

      {/* 섹션들 */}
      <TopSummary />
      <DataSourceList />
      <SchemaMap />
      <ErrorLogs />
      <LoadHistory />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             1) 상단 KPI Summary                            */
/* -------------------------------------------------------------------------- */
function TopSummary() {
  const [stats, setStats] = useState<DataSourceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await getDataSourceStats();
        setStats(data);
      } catch (error) {
        console.error('통계 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  const statItems = [
    { 
      label: "총 파일 수", 
      value: stats?.totalFiles?.toLocaleString() || "0",
      icon: FileText,
      color: "blue",
      bgGradient: "from-blue-50 to-blue-100/50",
      textColor: "text-blue-600"
    },
    { 
      label: "총 문항 수", 
      value: stats?.totalQuestions?.toLocaleString() || "0",
      icon: Database,
      color: "indigo",
      bgGradient: "from-indigo-50 to-indigo-100/50",
      textColor: "text-indigo-600"
    },
    { 
      label: "총 패널 수", 
      value: stats?.totalPanels?.toLocaleString() || "0",
      icon: Database,
      color: "violet",
      bgGradient: "from-violet-50 to-violet-100/50",
      textColor: "text-violet-600"
    },
    { 
      label: "마지막 업데이트", 
      value: stats?.lastUpdated || "-",
      icon: Clock,
      color: "cyan",
      bgGradient: "from-cyan-50 to-cyan-100/50",
      textColor: "text-cyan-600"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((stat) => {
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
              {isLoading ? "-" : stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           2) 데이터 소스 카드 리스트                         */
/* -------------------------------------------------------------------------- */

function DataSourceList() {
  const [tables, setTables] = useState<DataSourceTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewTable, setPreviewTable] = useState<{ schema: string; table: string } | null>(null);
  const [previewData, setPreviewData] = useState<TablePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    action: 'reload' | 'delete' | null;
    table: { schema: string; table: string } | null;
  }>({
    isOpen: false,
    action: null,
    table: null,
  });

  useEffect(() => {
    const loadTables = async () => {
      try {
        setIsLoading(true);
        const data = await getDataSourceTables();
        setTables(data);
      } catch (error) {
        console.error('테이블 목록 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTables();
  }, []);

  // 테이블 정보를 파일 카드 형식으로 변환
  const files = tables.map((table) => {
    // 행 수를 기반으로 대략적인 파일 크기 추정 (1행 ≈ 2KB)
    const estimatedSizeMB = (table.rows * 2 / 1024).toFixed(1);
    return {
      name: `${table.schema}.${table.name}`,
      schema: table.schema,
      tableName: table.name,
      rows: table.rows,
      columns: table.columns,
      size: `${estimatedSizeMB}MB`,
      status: table.status === 'success' ? 'success' as const : 'error' as const,
      updatedAt: null, // 실제 업데이트 시간은 추적하지 않음
    };
  });

  const handlePreview = async (schema: string, tableName: string) => {
    try {
      setIsLoadingPreview(true);
      setPreviewTable({ schema, table: tableName });
      const data = await getTablePreview(schema, tableName, 100);
      setPreviewData(data);
    } catch (error) {
      console.error('미리보기 로드 실패:', error);
      alert('미리보기를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewTable(null);
    setPreviewData(null);
  };

  const handleReload = (schema: string, tableName: string) => {
    setPasswordModal({
      isOpen: true,
      action: 'reload',
      table: { schema, table: tableName },
    });
  };

  const handleDelete = (schema: string, tableName: string) => {
    setPasswordModal({
      isOpen: true,
      action: 'delete',
      table: { schema, table: tableName },
    });
  };

  const closePasswordModal = () => {
    setPasswordModal({
      isOpen: false,
      action: null,
      table: null,
    });
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">데이터 소스 목록</h2>
        <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-full border border-green-200">
          실시간 필터 미리보기 지원 예정
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="ml-2 text-gray-500">데이터 로딩 중...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          데이터 소스가 없습니다.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {files.map((file) => (
          <div
            key={file.name}
            className="bg-white/50 border border-gray-200/50 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">{file.name}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    크기: <span className="font-medium">{file.size}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    행 수: <span className="font-medium">{file.rows.toLocaleString()} rows</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    컬럼 수: <span className="font-medium">{file.columns} cols</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 mb-4">
              {file.status === "success" ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  정상 적재
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200">
                  <XCircle className="w-4 h-4" />
                  오류
                </div>
              )}
            </div>

            {file.updatedAt && (
              <p className="text-xs text-gray-400 mb-4">업데이트: {file.updatedAt}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button 
                onClick={() => handlePreview(file.schema, file.tableName)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-violet-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                미리보기
              </button>
              <button 
                onClick={() => handleReload(file.schema, file.tableName)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                재적재
              </button>
              <button 
                onClick={() => handleDelete(file.schema, file.tableName)}
                className="px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* 미리보기 모달 */}
      {previewTable && (
        <PreviewModal
          table={previewTable}
          data={previewData}
          isLoading={isLoadingPreview}
          onClose={closePreview}
        />
      )}

      {/* 비밀번호 입력 모달 */}
      {passwordModal.isOpen && (
        <PasswordModal
          action={passwordModal.action}
          table={passwordModal.table}
          onClose={closePasswordModal}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            미리보기 모달 컴포넌트                            */
/* -------------------------------------------------------------------------- */

interface PreviewModalProps {
  table: { schema: string; table: string };
  data: TablePreview | null;
  isLoading: boolean;
  onClose: () => void;
}

function PreviewModal({ table, data, isLoading, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {table.schema}.{table.table} 미리보기
            </h3>
            {data && (
              <p className="text-sm text-gray-500 mt-1">
                전체 {data.totalRows.toLocaleString()}개 행 중 {data.previewedRows.toLocaleString()}개 표시
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              <span className="ml-2 text-gray-500">데이터 로딩 중...</span>
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {data.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={data.columns.length}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    data.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        {data.columns.map((col) => {
                          const value = row[col];
                          const displayValue =
                            value === null || value === undefined
                              ? '-'
                              : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value);
                          
                          return (
                            <td
                              key={col}
                              className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-xs truncate"
                              title={displayValue}
                            >
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              데이터를 불러올 수 없습니다.
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            비밀번호 입력 모달                               */
/* -------------------------------------------------------------------------- */

interface PasswordModalProps {
  action: 'reload' | 'delete' | null;
  table: { schema: string; table: string } | null;
  onClose: () => void;
}

function PasswordModal({ action, table, onClose }: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 비밀번호 (하드코딩 - 실제 환경에서는 환경변수나 설정에서 가져와야 함)
  const CORRECT_PASSWORD = 'admin123';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (password !== CORRECT_PASSWORD) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);

    // 실제 동작은 하지 않고, 성공 메시지만 표시
    setTimeout(() => {
      setIsSubmitting(false);
      const actionText = action === 'reload' ? '재적재' : '삭제';
      alert(`${actionText} 작업이 승인되었습니다.\n(실제 동작은 구현되지 않았습니다.)`);
      onClose();
      setPassword('');
    }, 500);
  };

  const actionText = action === 'reload' ? '재적재' : '삭제';
  const actionDescription = 
    action === 'reload' 
      ? '이 작업은 데이터를 다시 적재합니다.' 
      : '이 작업은 데이터를 영구적으로 삭제합니다. 되돌릴 수 없습니다.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {actionText} 확인
            </h3>
            {table && (
              <p className="text-sm text-gray-500 mt-1">
                {table.schema}.{table.table}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <p className="text-sm font-medium text-gray-700">
                {actionDescription}
              </p>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              계속하려면 관리자 비밀번호를 입력해주세요.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
              placeholder="비밀번호를 입력하세요"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                action === 'delete'
                  ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
                  : 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-300'
              }`}
            >
              {isSubmitting ? '처리 중...' : actionText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            3) 데이터 스키마 맵                              */
/* -------------------------------------------------------------------------- */

function SchemaMap() {
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchemas = async () => {
      try {
        setIsLoading(true);
        const data = await getSchemaInfo();
        setSchemas(data);
      } catch (error) {
        console.error('스키마 정보 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchemas();
  }, []);

  // 기본 스키마 (fallback)
  const defaultSchemas: SchemaInfo[] = [
    { table: "panel.respondent", fields: ["respondent_id", "gender", "birth_year", "region", "district"] },
    { table: "panel.response", fields: ["respondent_id", "question_id", "answer", "survey_datetime"] },
    { table: "panel.question", fields: ["question_id", "q_text", "q_type", "options"] },
  ];

  const displaySchemas = schemas.length > 0 ? schemas : defaultSchemas;
  const colorMap: Record<number, "violet" | "indigo" | "blue"> = {
    0: "violet",
    1: "indigo",
    2: "blue",
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">데이터 구조 (Schema Map)</h2>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="ml-2 text-gray-500">스키마 정보 로딩 중...</span>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {displaySchemas.map((schema, index) => (
            <SchemaBox
              key={schema.table}
              title={schema.table}
              fields={schema.fields}
              color={colorMap[index as keyof typeof colorMap] || "gray"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaBox({ 
  title, 
  fields,
  color = "gray"
}: { 
  title: string; 
  fields: string[];
  color?: "violet" | "indigo" | "blue" | "gray";
}) {
  const colorClasses = {
    violet: "bg-violet-50 border-violet-200",
    indigo: "bg-indigo-50 border-indigo-200",
    blue: "bg-blue-50 border-blue-200",
    gray: "bg-gray-50 border-gray-200",
  };

  const textColorClasses = {
    violet: "text-violet-700",
    indigo: "text-indigo-700",
    blue: "text-blue-700",
    gray: "text-gray-700",
  };

  return (
    <div className={`p-5 rounded-xl border ${colorClasses[color]}`}>
      <p className={`font-bold mb-3 ${textColorClasses[color]}`}>{title}</p>
      <ul className="space-y-2">
        {fields.map((field) => (
          <li key={field} className="text-sm text-gray-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            <code className="text-xs font-mono bg-white/50 px-2 py-0.5 rounded border border-gray-200">
              {field}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               4) 에러 로그                                   */
/* -------------------------------------------------------------------------- */

function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setIsLoading(true);
        const data = await getErrorLogs();
        setLogs(data);
      } catch (error) {
        console.error('에러 로그 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLogs();
  }, []);

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">에러 로그</h2>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-500">{logs.length}개 오류</span>
            </>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">모든 데이터가 정상입니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log, index) => (
            <div
              key={index}
              className="bg-red-50/50 border border-red-200 p-4 rounded-xl flex items-start gap-3 hover:bg-red-50 transition-colors"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <strong className="text-sm font-semibold text-gray-900">{log.file}</strong>
                  <span className="text-xs text-gray-400">{log.timestamp}</span>
                </div>
                <p className="text-sm text-red-600">{log.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               5) 적재 이력                                   */
/* -------------------------------------------------------------------------- */

function LoadHistory() {
  const [history, setHistory] = useState<LoadHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const data = await getLoadHistory();
        setHistory(data);
      } catch (error) {
        console.error('적재 이력 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">적재 이력</h2>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : (
          <span className="text-sm text-gray-500">최근 {history.length}건</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
          <span className="ml-2 text-gray-500">적재 이력 로딩 중...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          적재 이력이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-3 px-2 font-semibold text-gray-700">시간</th>
                <th className="py-3 px-2 font-semibold text-gray-700">파일명</th>
                <th className="py-3 px-2 font-semibold text-gray-700 text-right">처리량</th>
                <th className="py-3 px-2 font-semibold text-gray-700 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
              <tr 
                key={i} 
                className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
              >
                <td className="py-3 px-2 text-gray-600">{row.time}</td>
                <td className="py-3 px-2">
                  <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                    {row.file}
                  </code>
                </td>
                <td className="py-3 px-2 text-right text-gray-600">
                  {row.rows !== "-" ? `${row.rows} rows` : "-"}
                </td>
                <td className="py-3 px-2 text-center">
                  {row.status === "성공" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      성공
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-200">
                      <XCircle className="w-3.5 h-3.5" />
                      실패
                    </span>
                  )}
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

