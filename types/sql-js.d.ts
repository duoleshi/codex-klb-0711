declare module "sql.js" {
  namespace initSqlJs {
    interface QueryExecResult {
      columns: string[]
      values: unknown[][]
    }

    interface RunResult {
      lastInsertRowId?: number | bigint
    }

    interface Database {
      run(sql: string, params?: unknown[]): RunResult
      exec(sql: string, params?: unknown[]): QueryExecResult[]
      export(): Uint8Array
      close(): void
    }

    interface SqlJsStatic {
      Database: new (data?: Buffer | Uint8Array) => Database
    }
  }

  function initSqlJs(config?: unknown): Promise<initSqlJs.SqlJsStatic>

  export default initSqlJs
}
