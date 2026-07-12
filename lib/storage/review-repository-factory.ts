import type { SaveReviewRecordData } from "@/lib/review/review-types"

export async function getReviewRepository(userId: string | null) {
  if (userId) {
    const { createSupabaseReviewRepository } = await import("./supabase-review-repository")
    return createSupabaseReviewRepository(userId)
  }

  const { createSqliteReviewRepository } = await import("./sqlite-review-repository")
  return createSqliteReviewRepository()
}

export async function saveReviewWithFallback(userId: string | null, input: SaveReviewRecordData): Promise<void> {
  const repository = await getReviewRepository(userId)
  await repository.save(input)
}

export async function listReviewRecords(
  userId: string | null,
  page: number,
  pageSize: number,
  filters?: { professionType?: string; keyword?: string }
) {
  const repository = await getReviewRepository(userId)
  if (!repository.list) throw new Error("当前审核记录仓储不支持列表查询")
  return repository.list(page, pageSize, filters)
}

export async function getReviewRecord(userId: string | null, id: number) {
  const repository = await getReviewRepository(userId)
  if (!repository.getById) throw new Error("当前审核记录仓储不支持详情查询")
  return repository.getById(id)
}

export async function deleteReviewRecordById(userId: string | null, id: number) {
  const repository = await getReviewRepository(userId)
  if (!repository.delete) throw new Error("当前审核记录仓储不支持删除")
  return repository.delete(id)
}
