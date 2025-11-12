import apiClient from '../lib/api/client';

export interface LlmSqlResponse {
  answer: string;
  rows?: Record<string, unknown>[];
  count?: number;
  tool_called?: boolean;
}

export async function sqlSearch(prompt: string, model?: string): Promise<LlmSqlResponse> {
  const body: Record<string, unknown> = { prompt };
  if (model) body.model = model;
  const res = await apiClient.post('/api/llm/sql_search', body);
  return res.data as LlmSqlResponse;
}


