import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface TableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface ModernTableProps {
  columns: TableColumn[];
  data: any[];
  onRowClick?: (row: any) => void;
  highlightFilter?: { type: string; value: string } | null;
}

export const ModernTable = ({ columns, data, onRowClick, highlightFilter }: ModernTableProps) => {
  const shouldHighlight = (row: any) => {
    if (!highlightFilter) return false;
    
    const { type, value } = highlightFilter;
    const normalizedValue = value.toLowerCase();
    
    if (type === 'gender') {
      const rowGender = (row.gender || '').toLowerCase();
      return rowGender.includes(normalizedValue) || normalizedValue.includes(rowGender);
    } else if (type === 'age') {
      const rowAge = (row.age || '').toLowerCase();
      return rowAge.includes(normalizedValue) || normalizedValue.includes(rowAge);
    } else if (type === 'region') {
      const rowRegion = (row.region || '').toLowerCase();
      return rowRegion.includes(normalizedValue) || normalizedValue.includes(rowRegion);
    }
    
    return false;
  };
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const handleCopy = async (text: string, cellId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCell(cellId);
      setTimeout(() => setCopiedCell(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm p-12 text-center">
        <p className="text-slate-400 font-medium">데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-200/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-4 text-xs uppercase font-semibold text-slate-400 tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50">
            {data.map((row, rowIndex) => {
              const isHighlighted = shouldHighlight(row);
              return (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors cursor-pointer group animate-fade-in ${
                  isHighlighted 
                    ? 'bg-violet-50/80 border-l-4 border-violet-500' 
                    : 'hover:bg-slate-50/50'
                }`}
                style={{ animationDelay: `${rowIndex * 50}ms` }}
              >
                {columns.map((column) => {
                  const cellId = `${rowIndex}-${column.key}`;
                  const value = row[column.key];
                  const displayValue = column.render ? column.render(value, row) : value;
                  const textValue = typeof displayValue === 'string' ? displayValue : String(value || '');

                  return (
                    <td
                      key={column.key}
                      className="px-6 py-4 text-sm text-slate-700 font-sans font-tabular-nums relative group/cell"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1">{displayValue}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(textValue, cellId);
                          }}
                          className="opacity-0 group-hover/cell:opacity-100 transition-all duration-200 p-1.5 hover:bg-slate-100 rounded-lg hover:scale-110 active:scale-95"
                        >
                          {copiedCell === cellId ? (
                            <Check size={14} className="text-green-600" />
                          ) : (
                            <Copy size={14} className="text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </div>
                    </td>
                  );
                })}
                </tr>
              );
            })}
            </tbody>
        </table>
      </div>
    </div>
  );
};

