import type { SaveReviewRecordData } from "@/lib/review/review-types"
import type { ReviewRecord } from "@/lib/db"

export interface ReviewRepository {
  save(input: SaveReviewRecordData): Promise<string>
  list?(page?: number, pageSize?: number, filters?: { professionType?: string; keyword?: string }): Promise<{ records: ReviewRecord[]; total: number }>
  getById?(id: string): Promise<ReviewRecord | null>
  delete?(id: string): Promise<boolean>
}
