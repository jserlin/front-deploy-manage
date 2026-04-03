import fs from 'fs-extra'
import { join } from 'path'

interface DbSchema {
  groups: any[]
  projects: any[]
  serverCredentials: any[]
  svnCredentials: any[]
  deployTemplates: any[]
  deployHistory: any[]
}

const defaultData: DbSchema = {
  groups: [],
  projects: [],
  serverCredentials: [],
  svnCredentials: [],
  deployTemplates: [],
  deployHistory: []
}

/**
 * 轻量级 JSON 文件数据库
 * 提供 all / get / run 方法，兼容 IPC 层调用
 */
export class DatabaseManager {
  private data: DbSchema
  private dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
    if (fs.existsSync(dbPath)) {
      this.data = fs.readJsonSync(dbPath)
    } else {
      this.data = JSON.parse(JSON.stringify(defaultData))
    }
  }

  initialize(): void {
    fs.ensureDirSync(join(this.dbPath, '..'))
    this.save()
    console.log('Database initialized at:', this.dbPath)
  }

  private save(): void {
    fs.writeJsonSync(this.dbPath, this.data, { spaces: 2 })
  }

  /**
   * 从 SQL 或表名中提取主表名
   */
  private extractTableName(input: string): string | null {
    const map: Record<string, string> = {
      groups: 'groups',
      projects: 'projects',
      server_credentials: 'serverCredentials',
      svn_credentials: 'svnCredentials',
      deploy_templates: 'deployTemplates',
      deploy_history: 'deployHistory'
    }

    // 直接匹配表名
    if (map[input]) return map[input]

    // 从 SQL 的 FROM 子句中提取
    const patterns = [
      /FROM\s+(\w+)/gi,
      /INTO\s+(\w+)/gi,
      /UPDATE\s+(\w+)/gi,
      /DELETE\s+FROM\s+(\w+)/gi
    ]

    for (const pattern of patterns) {
      pattern.lastIndex = 0
      const match = pattern.exec(input)
      if (match && map[match[1]]) {
        return map[match[1]]
      }
    }

    return null
  }

  /**
   * 查询所有行
   * @param sqlOrTable - SQL 语句或表名
   * @param _params - 参数（暂不使用）
   */
  all(sqlOrTable: string, _params?: any[]): any[] {
    const key = this.extractTableName(sqlOrTable)
    if (!key || !this.data[key as keyof DbSchema]) {
      console.warn('[DB] all() - Table not found for:', sqlOrTable, '-> resolved key:', key)
      return []
    }
    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    console.log('[DB] all() - table:', key, 'rows:', arr.length)
    return [...arr]
  }

  /**
   * 查询单行
   */
  get(sqlOrTable: string, _params?: any[]): any {
    const key = this.extractTableName(sqlOrTable)
    if (!key || !this.data[key as keyof DbSchema]) {
      return null
    }
    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    // 从 _params 中提取 id（最后一个参数通常是 WHERE 条件值）
    const id = _params?.[_params.length - 1]
    if (!id) return null
    return arr.find((item: any) => item.id === id) || null
  }

  /**
   * 执行 INSERT / UPDATE / DELETE
   */
  run(sql: string, params?: any[]): { lastInsertRowid: number; changes: number } {
    const upperSql = sql.trim().toUpperCase()

    if (upperSql.includes('INSERT OR REPLACE')) {
      return this._insertOrReplace(sql, params)
    }
    if (upperSql.startsWith('INSERT')) {
      return this._insert(sql, params)
    }
    if (upperSql.startsWith('DELETE')) {
      return this._delete(sql, params)
    }
    if (upperSql.startsWith('UPDATE')) {
      return this._update(sql, params)
    }
    return { lastInsertRowid: 0, changes: 0 }
  }

  private _getNextId(key: string): number {
    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    const ids = arr.map((item: any) => item.id).filter(Boolean)
    return ids.length > 0 ? Math.max(...ids) + 1 : 1
  }

  private _insert(sql: string, params?: any[]): { lastInsertRowid: number; changes: number } {
    const key = this.extractTableName(sql)
    if (!key) return { lastInsertRowid: 0, changes: 0 }

    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    if (!colsMatch || !params) return { lastInsertRowid: 0, changes: 0 }

    const cols = colsMatch[1].split(',').map((c: string) => c.trim())
    const obj: any = {}
    cols.forEach((col: string, i: number) => {
      obj[col] = params[i] !== undefined ? params[i] : null
    })

    const newId = this._getNextId(key)
    obj.id = newId
    obj.created_at = new Date().toISOString()
    obj.updated_at = new Date().toISOString()

    ;(this.data[key as keyof DbSchema] as unknown as any[]).push(obj)
    this.save()
    console.log('[DB] INSERT - table:', key, 'id:', newId)
    return { lastInsertRowid: newId, changes: 1 }
  }

  private _insertOrReplace(sql: string, params?: any[]): { lastInsertRowid: number; changes: number } {
    const key = this.extractTableName(sql)
    if (!key) return { lastInsertRowid: 0, changes: 0 }

    const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    if (!colsMatch || !params) return { lastInsertRowid: 0, changes: 0 }

    const cols = colsMatch[1].split(',').map((c: string) => c.trim())
    const obj: any = {}
    cols.forEach((col: string, i: number) => {
      obj[col] = params[i] !== undefined ? params[i] : null
    })

    const id = params[0]
    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    const idx = arr.findIndex((item: any) => item.id === id)

    if (idx >= 0) {
      obj.updated_at = new Date().toISOString()
      arr[idx] = obj
    } else {
      obj.id = this._getNextId(key)
      obj.created_at = new Date().toISOString()
      obj.updated_at = new Date().toISOString()
      arr.push(obj)
    }

    this.save()
    return { lastInsertRowid: obj.id, changes: 1 }
  }

  private _delete(sql: string, params?: any[]): { lastInsertRowid: number; changes: number } {
    const key = this.extractTableName(sql)
    if (!key) return { lastInsertRowid: 0, changes: 0 }

    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    const id = params?.[0]
    const before = arr.length
    this.data[key as keyof DbSchema] = arr.filter((item: any) => item.id !== id) as any
    this.save()
    return { lastInsertRowid: 0, changes: before - arr.length }
  }

  private _update(sql: string, params?: any[]): { lastInsertRowid: number; changes: number } {
    const key = this.extractTableName(sql)
    if (!key || !params) return { lastInsertRowid: 0, changes: 0 }

    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i)
    if (!setMatch) return { lastInsertRowid: 0, changes: 0 }

    const setCols = setMatch[1].split(',').map((c: string) => c.trim().split('=')[0].trim())
    const id = params[params.length - 1] // WHERE id=? 是最后一个参数
    const arr = this.data[key as keyof DbSchema] as unknown as any[]
    const item = arr.find((r: any) => r.id === id)

    if (item) {
      setCols.forEach((col: string, i: number) => {
        item[col] = params[i]
      })
      item.updated_at = new Date().toISOString()
      this.save()
      return { lastInsertRowid: 0, changes: 1 }
    }

    return { lastInsertRowid: 0, changes: 0 }
  }

  getDatabase(): DatabaseManager {
    return this
  }

  close(): void {
    this.save()
  }
}
