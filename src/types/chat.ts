export type MessageRole = 'user' | 'assistant';

export interface DetectionResult {
  id: string;
  ts_utc: string;
  station: string;
  brand: string;
  creative_id: string;
  duration_sec: number;
  confidence: number;
  transcript: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  detections?: DetectionResult[];
  isError: boolean;
}

export interface AnthropicMessage {
  role: MessageRole;
  content: string;
}
