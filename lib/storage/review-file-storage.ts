import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

const REVIEW_FILE_BUCKET = "review-files"

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase Storage 未配置")
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function getSafeExtension(filename: string): string {
  const match = filename.match(/\.([A-Za-z0-9]{1,12})$/)
  return match ? `.${match[1].toLowerCase()}` : ""
}

export function getFilenameFromStoragePath(pathOrFilename: string | null | undefined): string {
  if (!pathOrFilename) return "未命名文件"
  const parts = pathOrFilename.split("/")
  return parts[parts.length - 1] || pathOrFilename
}

export async function uploadReviewFile(input: {
  userId: string
  filename: string
  buffer: Buffer
  contentType?: string
}): Promise<string> {
  const supabase = createSupabaseAdminClient()
  const originalFilename = input.filename
  const objectPath = `${input.userId}/reviews/${Date.now()}-${randomUUID()}${getSafeExtension(originalFilename)}`

  const { error } = await supabase.storage
    .from(REVIEW_FILE_BUCKET)
    .upload(objectPath, input.buffer, {
      contentType: input.contentType || "application/octet-stream",
      upsert: false,
    })

  if (error) {
    throw new Error(`上传审核原始文件失败: ${error.message}`)
  }

  return objectPath
}
