import apiClient from '../lib/api/client';

export interface LlmSqlResponse {
  answer: string;
  rows?: Record<string, unknown>[];
  count?: number;
  tool_called?: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sqlSearch(
  prompt: string, 
  model?: string, 
  conversationHistory?: ConversationMessage[],
  panelSearchResult?: {
    estimatedCount?: number;
    distributionStats?: {
      gender?: Array<{label: string; value: number}>;
      age?: Array<{label: string; value: number}>;
      region?: Array<{label: string; value: number}>;
    };
    extractedChips?: string[];
    previousPanelIds?: string[];
  }
): Promise<LlmSqlResponse> {
  const body: Record<string, unknown> = { prompt };
  if (model) body.model = model;
  if (conversationHistory && conversationHistory.length > 0) {
    body.conversation_history = conversationHistory;
  }
  if (panelSearchResult) {
    body.panel_search_result = panelSearchResult;
  }
  const res = await apiClient.post('/api/llm/sql_search', body);
  return res.data as LlmSqlResponse;
}


