import { useState, useEffect } from 'react';
import Card from '../../components/base/Card';
import Badge from '../../components/base/Badge';
import { getDashboardData } from '../../api/panel';
import type { KpiData, RecentQuery } from '../../types/panel';

export default function PanelDashboard() {
  const [kpiData, setKpiData] = useState<KpiData[]>([]);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [dbAlive, setDbAlive] = useState(false);
  const [dbStats, setDbStats] = useState<Record<string, number | null>>({});
  const [tableSamples, setTableSamples] = useState<Record<string, any[]>>({});
  const [dbSchema, setDbSchema] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDashboardData(); 
        setKpiData(data.kpiData);
        setRecentQueries(data.recentQueries);
        setDbAlive((data as any).dbAlive || false);
        setDbStats((data as any).dbStats || {});
        setTableSamples((data as any).tableSamples || {});
        
        // DB 스키마 상세 정보 로드
        try {
          const apiClient = (await import('../../lib/api/client')).default;
          const schemaRes = await apiClient.get('/api/tools/db_schema');
          setDbSchema(schemaRes.data);
        } catch (e) {
          console.warn('스키마 정보 로드 실패:', e);
        }
      } catch (err: any) {
        setError(err.message || '데이터를 불러오는 데 실패했습니다.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  if (isLoading) {
    return <div className="p-6 text-center">데이터를 불러오는 중...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((item) => (
          <Card key={item.title}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">{item.title}</span>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                style={{ backgroundColor: `${item.color}1A`, color: item.color }}
              >
                <i className={item.icon}></i>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            <div className="text-sm text-gray-500 mt-1">
              <span className={item.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                {item.change}
              </span>
              <span className="ml-1">vs 어제</span>
            </div>
          </Card>
        ))}
      </div>

      {/* DB 상태 및 통계 섹션 */}
      {dbAlive && Object.keys(dbStats).length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ri-database-2-line text-[#2F6BFF]"></i>
            데이터베이스 상태
            <Badge variant="success" className="ml-2">연결됨</Badge>
          </h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">테이블별 데이터 건수</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(dbStats).map(([table, count]) => (
                <div key={table} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="text-sm text-gray-600 mb-1">{table}</div>
                  <div className="text-xl font-bold text-gray-900">
                    {count !== null ? count.toLocaleString() : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 샘플 데이터 미리보기 */}
          {Object.keys(tableSamples).length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">샘플 데이터 미리보기</h3>
              <div className="space-y-4">
                {Object.entries(tableSamples).map(([table, samples]) => (
                  <div key={table} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 font-medium text-gray-700">{table} (최대 3건)</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {samples.length > 0 && Object.keys(samples[0]).map((col) => (
                              <th key={col} className="px-4 py-2 text-left text-gray-600 font-medium">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {samples.map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              {Object.entries(row).map(([col, val]) => (
                                <td key={col} className="px-4 py-2 text-gray-800">
                                  {val !== null && val !== undefined ? String(val).substring(0, 50) : 'NULL'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {!dbAlive && (
        <Card>
          <div className="flex items-center gap-2 text-red-600">
            <i className="ri-error-warning-line"></i>
            <span>데이터베이스 연결 실패</span>
          </div>
        </Card>
      )}

      {/* DB 스키마 상세 정보 */}
      {dbSchema && dbSchema.tables && dbSchema.tables.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="ri-file-list-3-line text-[#2F6BFF]"></i>
            데이터베이스 스키마 상세
          </h2>
          
          <div className="space-y-4">
            {dbSchema.tables.map((table: any) => (
              <div key={table.name} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{table.name}</span>
                    {table.has_pk && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">PK</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      행 수: <span className="font-bold text-gray-900">
                        {table.row_count !== null ? table.row_count.toLocaleString() : 'N/A'}
                      </span>
                    </span>
                    <span className="text-gray-600">
                      컬럼 수: <span className="font-bold text-gray-900">{table.column_count}</span>
                    </span>
                  </div>
                </div>
                
                {table.columns && table.columns.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">컬럼명</th>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">타입</th>
                          <th className="px-4 py-2 text-left text-gray-600 font-medium">NULL 허용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((col: any, idx: number) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-900 font-medium">{col.column_name}</td>
                            <td className="px-4 py-2 text-gray-600">{col.data_type}</td>
                            <td className="px-4 py-2 text-gray-600">
                              {col.is_nullable === 'YES' ? (
                                <span className="text-orange-600">YES</span>
                              ) : (
                                <span className="text-green-600">NO</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {table.error && (
                  <div className="px-4 py-2 text-red-600 text-sm">오류: {table.error}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 최근 질의 목록 섹션 */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">최근 질의 목록</h2>
        <div className="space-y-4">
          {recentQueries.map((query) => (
            <div key={query.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-gray-900 font-medium mb-2">{query.query}</p>
                  <div className="flex flex-wrap gap-2">
                    {query.chips.map((chip, chipIndex) => (
                      <span 
                        key={chipIndex}
                        className="px-2 py-1 bg-[#2F6BFF]/10 text-[#2F6BFF] rounded-full text-xs font-medium"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <Badge variant={query.status === 'success' ? 'success' : 'warning'}>
                  {query.status === 'success' ? '성공' : '경고'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span>{query.time}</span>
                  <span>실행자: {query.executor}</span>
                </div>
                <span className="font-medium text-gray-700">{query.resultCount.toLocaleString()}명 추출</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
