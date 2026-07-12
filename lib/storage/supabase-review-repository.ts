import { deleteReviewRecord, getReviewRecordById, getReviewRecords, saveReviewRecord } from "@/lib/db"
import type { SaveReviewRecordData } from "@/lib/review/review-types"
import type { ReviewRepository } from "./review-repository"

export function createSupabaseReviewRepository(userId: string): ReviewRepository {
  return {
    save(input: SaveReviewRecordData) {
      return saveReviewRecord({ ...input, userId })
    },
    list(page = 1, pageSize = 10, filters?: { professionType?: string; keyword?: string }) {
      return getReviewRecords(userId, page, pageSize, filters)
    },
    getById(id: number) {
      return getReviewRecordById(id, userId)
    },
    delete(id: number) {
      return deleteReviewRecord(id, userId)
    },
  }
}
