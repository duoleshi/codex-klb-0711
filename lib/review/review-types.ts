import type OpenAI from "openai"

export interface ProgressEvent {
  type?: string
  stage: string
  message: string
  current?: number
  total?: number
  percent?: number
}

export interface ReviewProgressHandlers {
  sendProgress: (event: ProgressEvent) => void
  sendResult: (data: unknown) => void
  sendError: (error: string) => void
  close: () => void
}

export interface ReviewModelConfig {
  client: OpenAI
  modelName: string
  maxOutputTokens: number
}

export interface RunReviewPipelineInput extends ReviewProgressHandlers {
  file: File
  modelParam: string
  userId: string | null
  lockedProfessionId?: string
}

export interface SaveReviewRecordData {
  filename: string
  file_size: number
  profession_types: string[]
  document_content: string
  review_result: string
  review_conclusion: string
  knowledge_file: string
  tokens_used?: number
  model: string
}
