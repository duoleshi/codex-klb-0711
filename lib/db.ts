import { createClient } from "@supabase/supabase-js"
import initSqlJs from "sql.js"
import fs from "fs"
import path from "path"

// Supabase 客户端（使用 service role key 绕过 RLS，仅在 API 路由中使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Sqlite 数据库路径
const SQLITE_DB_PATH = path.join(process.cwd(), "data", "review.db")

// 获取 Sqlite 数据库实例
async function getSqliteDb() {
  const SQL = await initSqlJs()

  // 确保目录存在
  const dbDir = path.dirname(SQLITE_DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // 如果数据库文件存在，读取它；否则创建新的
  if (fs.existsSync(SQLITE_DB_PATH)) {
    const fileBuffer = fs.readFileSync(SQLITE_DB_PATH)
    return new SQL.Database(fileBuffer)
  } else {
    const db = new SQL.Database()
    // 创建表结构
    db.run(`
      CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        file_size INTEGER,
        profession_types TEXT,
        document_content TEXT,
        review_result TEXT,
        review_conclusion TEXT,
        knowledge_file TEXT,
        tokens_used INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        model TEXT
      )
    `)
    saveSqliteDb(db)
    return db
  }
}

// 保存 Sqlite 数据库到文件
function saveSqliteDb(db: initSqlJs.Database) {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(SQLITE_DB_PATH, buffer)
}

// 审核记录接口
export interface ReviewRecord {
  id: number
  filename: string
  file_size: number | null
  profession_types: string | null
  document_content: string | null
  review_result: string
  review_conclusion: string | null
  knowledge_file: string | null
  tokens_used: number | null
  model: string | null
  user_id: string | null
  created_at: string
}

// 创建审核记录的输入接口
export interface CreateReviewInput {
  filename: string
  file_size?: number
  profession_types?: string[]
  document_content?: string
  review_result: string
  review_conclusion?: string
  knowledge_file?: string
  tokens_used?: number
  model?: string
  userId: string
}

/**
 * 保存审核记录
 */
export async function saveReviewRecord(input: CreateReviewInput): Promise<number> {
  // 先清理旧记录
  await cleanupOldRecords(input.userId)

  const { data, error } = await supabase
    .from("review_records")
    .insert({
      filename: input.filename,
      file_size: input.file_size || null,
      profession_types: input.profession_types ? JSON.stringify(input.profession_types) : null,
      document_content: input.document_content || null,
      review_result: input.review_result,
      review_conclusion: input.review_conclusion || null,
      knowledge_file: input.knowledge_file || null,
      tokens_used: input.tokens_used || null,
      model: input.model || null,
      user_id: input.userId,
    })
    .select("id")
    .single()

  if (error) {
    console.error("保存审核记录失败:", error)
    throw new Error("保存审核记录失败: " + error.message)
  }

  return data.id
}

/**
 * 获取审核记录列表（分页）
 */
export async function getReviewRecords(
  userId: string,
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    professionType?: string
    keyword?: string
  }
): Promise<{ records: ReviewRecord[]; total: number }> {
  const offset = (page - 1) * pageSize

  // 构建查询 - 只查当前用户的记录
  let query = supabase
    .from("review_records")
    .select("*", { count: "exact" })
    .eq("user_id", userId)

  if (filters?.professionType) {
    query = query.like("profession_types", `%"${filters.professionType}"%`)
  }

  if (filters?.keyword) {
    query = query.like("filename", `%${filters.keyword}%`)
  }

  // 获取数据（带分页）
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("获取审核记录失败:", error)
    return { records: [], total: 0 }
  }

  const records: ReviewRecord[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    filename: row.filename as string,
    file_size: row.file_size as number | null,
    profession_types: row.profession_types as string | null,
    document_content: row.document_content as string | null,
    review_result: row.review_result as string,
    review_conclusion: row.review_conclusion as string | null,
    knowledge_file: row.knowledge_file as string | null,
    tokens_used: row.tokens_used as number | null,
    model: row.model as string | null,
    user_id: row.user_id as string | null,
    created_at: row.created_at as string,
  }))

  return { records, total: count || 0 }
}

/**
 * 获取单条审核记录
 */
export async function getReviewRecordById(id: number, userId: string): Promise<ReviewRecord | null> {
  const { data, error } = await supabase
    .from("review_records")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id as number,
    filename: data.filename as string,
    file_size: data.file_size as number | null,
    profession_types: data.profession_types as string | null,
    document_content: data.document_content as string | null,
    review_result: data.review_result as string,
    review_conclusion: data.review_conclusion as string | null,
    knowledge_file: data.knowledge_file as string | null,
    tokens_used: data.tokens_used as number | null,
    model: data.model as string | null,
    user_id: data.user_id as string | null,
    created_at: data.created_at as string,
  }
}

/**
 * 删除审核记录
 */
export async function deleteReviewRecord(id: number, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("review_records")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    console.error("删除记录失败:", error)
    return false
  }

  return true
}

/**
 * 清理旧记录（保留最新100条，删除30天前的记录）
 */
export async function cleanupOldRecords(userId: string): Promise<void> {
  // 获取当前用户记录数
  const { count } = await supabase
    .from("review_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  const currentCount = count || 0

  if (currentCount <= 100) {
    // 删除30天前的记录
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    await supabase
      .from("review_records")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", thirtyDaysAgo.toISOString())
  } else {
    // 只保留最新的100条
    const { data } = await supabase
      .from("review_records")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(99, 99)

    if (data && data.length > 0) {
      const thresholdId = data[0].id
      await supabase
        .from("review_records")
        .delete()
        .eq("user_id", userId)
        .lt("id", thresholdId)
    }
  }
}

export { extractConclusion } from "./review/report-summary"

// ═══════════════════════════════════════════════════════════════════════════
// Sqlite 相关函数（用于未登录用户）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 保存审核记录到 Sqlite（未登录用户）
 */
export async function saveReviewRecordToSqlite(input: Omit<CreateReviewInput, "userId">): Promise<number> {
  const db = await getSqliteDb()

  const result = db.run(
    `INSERT INTO review_records (filename, file_size, profession_types, document_content, review_result, review_conclusion, knowledge_file, tokens_used, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [
      input.filename,
      input.file_size || null,
      input.profession_types ? JSON.stringify(input.profession_types) : null,
      input.document_content || null,
      input.review_result,
      input.review_conclusion || null,
      input.knowledge_file || null,
      input.tokens_used || null,
      input.model || null,
    ]
  )

  const id = result.lastInsertRowId as number
  saveSqliteDb(db)
  db.close()

  return id
}

/**
 * 从 Sqlite 获取审核记录列表（未登录用户）
 */
export async function getReviewRecordsFromSqlite(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    professionType?: string
    keyword?: string
  }
): Promise<{ records: ReviewRecord[]; total: number }> {
  const db = await getSqliteDb()
  const offset = (page - 1) * pageSize

  // 构建查询条件
  let whereClause = "1=1"
  const params: (string | number)[] = []

  if (filters?.professionType) {
    whereClause += " AND profession_types LIKE ?"
    params.push(`%"${filters.professionType}"%`)
  }

  if (filters?.keyword) {
    whereClause += " AND filename LIKE ?"
    params.push(`%${filters.keyword}%`)
  }

  // 获取总数
  const countResult = db.exec(`SELECT COUNT(*) as count FROM review_records WHERE ${whereClause}`, params)
  const total = countResult[0]?.values[0]?.[0] as number || 0

  // 获取数据
  const dataResult = db.exec(
    `SELECT id, filename, file_size, profession_types, review_result, review_conclusion, knowledge_file, tokens_used, model, created_at
     FROM review_records
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const records: ReviewRecord[] = []
  if (dataResult.length > 0) {
    const columns = dataResult[0].columns
    dataResult[0].values.forEach((row) => {
      const record: Record<string, unknown> = {}
      columns.forEach((col, i) => {
        record[col] = row[i]
      })
      records.push({
        id: record.id as number,
        filename: record.filename as string,
        file_size: record.file_size as number | null,
        profession_types: record.profession_types as string | null,
        document_content: null, // 列表不返回文档内容
        review_result: record.review_result as string,
        review_conclusion: record.review_conclusion as string | null,
        knowledge_file: record.knowledge_file as string | null,
        tokens_used: record.tokens_used as number | null,
        model: record.model as string | null,
        user_id: null,
        created_at: record.created_at as string,
      })
    })
  }

  db.close()
  return { records, total }
}

/**
 * 从 Sqlite 获取单条审核记录（未登录用户）
 */
export async function getReviewRecordByIdFromSqlite(id: number): Promise<ReviewRecord | null> {
  const db = await getSqliteDb()

  const result = db.exec(
    `SELECT id, filename, file_size, profession_types, document_content, review_result, review_conclusion, knowledge_file, tokens_used, model, created_at
     FROM review_records
     WHERE id = ?`,
    [id]
  )

  db.close()

  if (result.length === 0 || result[0].values.length === 0) {
    return null
  }

  const columns = result[0].columns
  const row = result[0].values[0]
  const record: Record<string, unknown> = {}
  columns.forEach((col, i) => {
    record[col] = row[i]
  })

  return {
    id: record.id as number,
    filename: record.filename as string,
    file_size: record.file_size as number | null,
    profession_types: record.profession_types as string | null,
    document_content: record.document_content as string | null,
    review_result: record.review_result as string,
    review_conclusion: record.review_conclusion as string | null,
    knowledge_file: record.knowledge_file as string | null,
    tokens_used: record.tokens_used as number | null,
    model: record.model as string | null,
    user_id: null,
    created_at: record.created_at as string,
  }
}

/**
 * 从 Sqlite 删除审核记录（未登录用户）
 */
export async function deleteReviewRecordFromSqlite(id: number): Promise<boolean> {
  const db = await getSqliteDb()

  db.run("DELETE FROM review_records WHERE id = ?", [id])
  saveSqliteDb(db)
  db.close()

  return true
}
