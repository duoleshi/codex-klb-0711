import {
  deleteReviewRecordFromSqlite,
  getReviewRecordByIdFromSqlite,
  getReviewRecordsFromSqlite,
  saveReviewRecordToSqlite,
} from "@/lib/db"
import type { SaveReviewRecordData } from "@/lib/review/review-types"
import type { ReviewRepository } from "./review-repository"

export function createSqliteReviewRepository(): ReviewRepository {
  return {
    save(input: SaveReviewRecordData) {
      return saveReviewRecordToSqlite(input)
    },
    list(page = 1, pageSize = 10, filters?: { professionType?: string; keyword?: string }) {
      return getReviewRecordsFromSqlite(page, pageSize, filters)
    },
    getById(id: number) {
      return getReviewRecordByIdFromSqlite(id)
    },
    delete(id: number) {
      return deleteReviewRecordFromSqlite(id)
    },
  }
}
