import { Client } from 'ssh2'
import * as fs from 'fs-extra'
import * as path from 'path'
import { logger } from '../utils/logger'
import { CryptoUtil } from '../utils/crypto'

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
}

export class SSHService {
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
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end()
            reject(err)
            return
          }

          this.uploadDirectoryRecursive(sftp, localPath, remotePath, onProgress)
            .then(() => {
              conn.end()
              resolve()
            })
            .catch((uploadErr) => {
              conn.end()
              reject(uploadErr)
            })
        })
      })

      conn.on('error', (err) => {
        reject(err)
      })

      conn.connect(config)
    })
  }

  private async uploadDirectoryRecursive(
    sftp: any,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    // 创建远程目录
    await this.mkdirRemote(sftp, remotePath)

    const items = await fs.readdir(localPath)

    for (const item of items) {
      const localItemPath = path.join(localPath, item)
      const remoteItemPath = `${remotePath}/${item}`
      const stats = await fs.stat(localItemPath)

      if (stats.isDirectory()) {
        await this.uploadDirectoryRecursive(sftp, localItemPath, remoteItemPath, onProgress)
      } else {
        await this.uploadFile(sftp, localItemPath, remoteItemPath, onProgress)
      }
    }
  }

  private async uploadFile(
    sftp: any,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: UploadProgress) => void
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
              percent: Math.round((transferred / total) * 100)
            })
          }
        }
      }, (err: Error) => {
        if (err) {
          reject(err)
        } else {
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
