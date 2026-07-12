import type { SaveReviewRecordData } from "@/lib/review/review-types"
import type { ReviewRecord } from "@/lib/db"

export interface ReviewRepository {
  save(input: SaveReviewRecordData): Promise<number>
  list?(page?: number, pageSize?: number, filters?: { professionType?: string; keyword?: string }): Promise<{ records: ReviewRecord[]; total: number }>
  getById?(id: number): Promise<ReviewRecord | null>
  delete?(id: number): Promise<boolean>
}
