import * as fs from 'fs-extra'
import * as path from 'path'

import { Client } from 'ssh2'
import { CryptoUtil } from '../utils/crypto'
import { execFileSync } from 'child_process'
import { logger } from '../utils/logger'

export interface ServerCredential {
  id: number
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  privateKey?: string
  passphrase?: string
  environment: string
  description?: string
}

export interface UploadProgress {
  filename: string
  transferred: number
  total: number
  percent: number
  fileCount: number
  totalFiles: number
}

export class SSHService {
  private currentConn: Client | null = null
  private aborted = false

  abort(): void {
    this.aborted = true
    if (this.currentConn) {
      this.currentConn.end()
      this.currentConn = null
    }
  }

  isAborted(): boolean {
    return this.aborted
  }

  resetAbort(): void {
    this.aborted = false
    this.currentConn = null
  }

  private checkAborted(): void {
    if (this.aborted) throw new Error('发布已取消')
  }
  async testConnection(credential: ServerCredential): Promise<{ success: boolean; message: string }> {
    const conn = new Client()
    
    return new Promise((resolve) => {
      const config: any = {
        host: credential.host,
        port: credential.port,
        username: credential.username,
        readyTimeout: 10000
      }

      if (credential.authType === 'password') {
        config.password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      } else {
        config.privateKey = credential.privateKey ? CryptoUtil.decrypt(credential.privateKey) : ''
        if (credential.passphrase) {
          config.passphrase = CryptoUtil.decrypt(credential.passphrase)
        }
      }

      conn.on('ready', () => {
        conn.end()
        resolve({ success: true, message: 'Connection successful' })
      })

      conn.on('error', (err) => {
        resolve({ success: false, message: err.message })
      })

      conn.connect(config)
    })
  }

  async uploadDirectory(
    credential: ServerCredential,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    this.checkAborted()
    return new Promise((resolve, reject) => {
      const conn = new Client()
      this.currentConn = conn
      
      const config: any = {
        host: credential.host,
        port: credential.port,
        username: credential.username
      }

      if (credential.authType === 'password') {
        config.password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      } else {
        config.privateKey = credential.privateKey ? CryptoUtil.decrypt(credential.privateKey) : ''
        if (credential.passphrase) {
          config.passphrase = CryptoUtil.decrypt(credential.passphrase)
        }
      }

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end()
            this.currentConn = null
            reject(err)
            return
          }

          this.countFiles(localPath).then(totalFiles => {
            const counters = { uploaded: 0, total: totalFiles }
            return this.uploadDirectoryRecursive(sftp, localPath, remotePath, onProgress, counters)
          }).then(() => {
            conn.end()
            this.currentConn = null
            resolve()
          }).catch((uploadErr) => {
            conn.end()
            this.currentConn = null
            reject(uploadErr)
          })
        })
      })

      conn.on('error', (err) => {
        this.currentConn = null
        if (this.aborted) {
          reject(new Error('发布已取消'))
        } else {
          reject(err)
        }
      })

      conn.connect(config)
    })
  }

  private async countFiles(dirPath: string): Promise<number> {
    let count = 0
    const items = await fs.readdir(dirPath)
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = await fs.stat(itemPath)
      if (stats.isDirectory()) {
        count += await this.countFiles(itemPath)
      } else {
        count++
      }
    }
    return count
  }

  async uploadDirectoryCompressed(
    credential: ServerCredential,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    this.checkAborted()
    const tmpDir = path.join(require('os').tmpdir(), 'deploy-upload')
    await fs.ensureDir(tmpDir)
    const timestamp = Date.now()
    const archiveName = `deploy-${timestamp}.tar.gz`
    const localArchivePath = path.join(tmpDir, archiveName)
    const remoteArchivePath = `/tmp/${archiveName}`

    try {
      this.checkAborted()
      logger.info(`Compressing ${localPath} to ${localArchivePath}`)
      onProgress?.({
        filename: archiveName,
        transferred: 0,
        total: 0,
        percent: 0,
        fileCount: 0,
        totalFiles: 1
      })

      const localDir = localPath
      const localBase = '.'
      execFileSync('tar', ['-czf', localArchivePath, '-C', localDir, localBase], { timeout: 120000 })

      const archiveStats = await fs.stat(localArchivePath)
      const archiveSize = archiveStats.size
      logger.info(`Archive created: ${archiveName} (${(archiveSize / 1024 / 1024).toFixed(2)} MB)`)

      this.checkAborted()
      await this.uploadSingleFile(credential, localArchivePath, remoteArchivePath, (transferred, total) => {
        onProgress?.({
          filename: archiveName,
          transferred,
          total,
          percent: total > 0 ? Math.round((transferred / total) * 100) : 0,
          fileCount: transferred === total ? 1 : 0,
          totalFiles: 1
        })
      })

      this.checkAborted()
      logger.info(`Extracting archive on remote server to ${remotePath}`)
      const extractCmd = `mkdir -p "${remotePath}" && tar -xzf "${remoteArchivePath}" -C "${remotePath}" && rm -f "${remoteArchivePath}"`
      const extractResult = await this.execCommand(credential, extractCmd)
      if (extractResult.code !== 0) {
        throw new Error(`远程解压失败: ${extractResult.stderr}`)
      }
      logger.info(`Deploy completed successfully via compressed upload`)
    } finally {
      try { await fs.remove(localArchivePath) } catch {}
    }
  }

  private async uploadSingleFile(
    credential: ServerCredential,
    localFilePath: string,
    remoteFilePath: string,
    onProgress?: (transferred: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client()
      this.currentConn = conn

      const config: any = {
        host: credential.host,
        port: credential.port,
        username: credential.username
      }

      if (credential.authType === 'password') {
        config.password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      } else {
        config.privateKey = credential.privateKey ? CryptoUtil.decrypt(credential.privateKey) : ''
        if (credential.passphrase) {
          config.passphrase = CryptoUtil.decrypt(credential.passphrase)
        }
      }

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end()
            this.currentConn = null
            reject(err)
            return
          }

          const stats = fs.statSync(localFilePath)
          const total = stats.size
          let transferred = 0
          let lastReported = 0

          sftp.fastPut(localFilePath, remoteFilePath, {
            step: (transferredBytes: number) => {
              transferred = transferredBytes
              if (transferred - lastReported > 1024 * 64 || transferred === total) {
                lastReported = transferred
                onProgress?.(transferred, total)
              }
            }
          }, (err: Error) => {
            conn.end()
            this.currentConn = null
            if (err) {
              reject(err)
            } else {
              onProgress?.(total, total)
              resolve()
            }
          })
        })
      })

      conn.on('error', (err) => {
        this.currentConn = null
        if (this.aborted) {
          reject(new Error('发布已取消'))
        } else {
          reject(err)
        }
      })

      conn.connect(config)
    })
  }

  private async uploadDirectoryRecursive(
    sftp: any,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void,
    counters?: { uploaded: number; total: number }
  ): Promise<void> {
    this.checkAborted()
    await this.mkdirRemote(sftp, remotePath)

    const items = await fs.readdir(localPath)

    for (const item of items) {
      this.checkAborted()
      const localItemPath = path.join(localPath, item)
      const remoteItemPath = `${remotePath}/${item}`
      const stats = await fs.stat(localItemPath)

      if (stats.isDirectory()) {
        await this.uploadDirectoryRecursive(sftp, localItemPath, remoteItemPath, onProgress, counters)
      } else {
        await this.uploadFile(sftp, localItemPath, remoteItemPath, onProgress, counters)
      }
    }
  }

  private async uploadFile(
    sftp: any,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void,
    counters?: { uploaded: number; total: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stats = fs.statSync(localPath)
      const total = stats.size
      let transferred = 0

      sftp.fastPut(localPath, remotePath, {
        step: (transferredBytes: number) => {
          transferred = transferredBytes
          if (onProgress) {
            onProgress({
              filename: path.basename(localPath),
              transferred,
              total,
              percent: Math.round((transferred / total) * 100),
              fileCount: counters ? counters.uploaded + 1 : 1,
              totalFiles: counters ? counters.total : 1
            })
          }
        }
      }, (err: Error) => {
        if (err) {
          reject(err)
        } else {
          if (counters) counters.uploaded++
          resolve()
        }
      })
    })
  }

  private async mkdirRemote(sftp: any, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err: Error) => {
        if (err) {
          // 目录可能已存在，忽略错误
          resolve()
        } else {
          resolve()
        }
      })
    })
  }

  async execCommand(
    credential: ServerCredential,
    command: string
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    this.checkAborted()
    return new Promise((resolve, reject) => {
      const conn = new Client()
      
      const config: any = {
        host: credential.host,
        port: credential.port,
        username: credential.username
      }

      if (credential.authType === 'password') {
        config.password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      } else {
        config.privateKey = credential.privateKey ? CryptoUtil.decrypt(credential.privateKey) : ''
        if (credential.passphrase) {
          config.passphrase = CryptoUtil.decrypt(credential.passphrase)
        }
      }

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end()
            reject(err)
            return
          }

          let stdout = ''
          let stderr = ''

          stream.on('close', (code: number) => {
            conn.end()
            resolve({ stdout, stderr, code })
          })

          stream.on('data', (data: Buffer) => {
            stdout += data.toString()
          })

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })
        })
      })

      conn.on('error', (err) => {
        reject(err)
      })

      conn.connect(config)
    })
  }
}
