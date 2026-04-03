import { exec, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { logger } from '../utils/logger'
import { CryptoUtil } from '../utils/crypto'

const execAsync = promisify(exec)

export interface SvnCredential {
  id: number
  name: string
  svnUrl: string
  username: string
  password: string
  environment: string
  description?: string
}

export class SVNService {
  private currentProcesses: ChildProcess[] = []
  private aborted = false

  abort(): void {
    this.aborted = true
    for (const proc of this.currentProcesses) {
      try { proc.kill() } catch {}
    }
    this.currentProcesses = []
  }

  isAborted(): boolean {
    return this.aborted
  }

  resetAbort(): void {
    this.aborted = false
    this.currentProcesses = []
  }

  private checkAborted(): void {
    if (this.aborted) throw new Error('发布已取消')
  }

  private execCommand(command: string, options?: any): Promise<{ stdout: string; stderr: string }> {
    this.checkAborted()
    return new Promise((resolve, reject) => {
      const proc = exec(command, options, (err, stdout, stderr) => {
        const idx = this.currentProcesses.indexOf(proc)
        if (idx > -1) this.currentProcesses.splice(idx, 1)
        if (this.aborted) {
          reject(new Error('发布已取消'))
        } else if (err) {
          reject(err)
        } else {
          resolve({ stdout, stderr })
        }
      })
      this.currentProcesses.push(proc)
    })
  }
  async testConnection(credential: SvnCredential): Promise<{ success: boolean; message: string }> {
      try {
        const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
        const command = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${credential.svnUrl}"`
        
        await this.execCommand(command, { timeout: 10000 })
        return { success: true, message: 'Connection successful' }
      } catch (error: any) {
        logger.error('SVN test connection failed:', error)
        return { success: false, message: error.message }
      }
    }
  
    async uploadDirectory(
      credential: SvnCredential,
      localPath: string,
      svnPath: string,
      commitMessage: string
    ): Promise<void> {
      try {
        this.checkAborted()
        const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
        
        const tempDir = `${localPath}_svn_temp`
        const checkoutCommand = `svn checkout --username "${credential.username}" --password "${password}" --non-interactive "${svnPath}" "${tempDir}"`
        
        try {
          await this.execCommand(checkoutCommand, { timeout: 30000 })
        } catch (error: any) {
          if (error.message === '发布已取消') throw error
          if (error.message.includes('already')) {
            const updateCommand = `svn update --username "${credential.username}" --password "${password}" --non-interactive "${tempDir}"`
            await this.execCommand(updateCommand, { timeout: 30000 })
          } else {
            throw error
          }
        }

        this.checkAborted()
        const fs = require('fs-extra')
        await fs.copy(localPath, tempDir, { overwrite: true })

        const addCommand = `svn add --force "${tempDir}" --auto-props --parents --depth infinity`
        await this.execCommand(addCommand, { timeout: 30000 })

        const commitCommand = `svn commit --username "${credential.username}" --password "${password}" --non-interactive -m "${commitMessage}" "${tempDir}"`
        await this.execCommand(commitCommand, { timeout: 60000 })

        await fs.remove(tempDir)

        logger.info('SVN upload completed successfully')
      } catch (error: any) {
        logger.error('SVN upload failed:', error)
        throw new Error(`SVN upload failed: ${error.message}`)
      }
    }
  
    async backup(
      svnPath: string,
      credential: SvnCredential
    ): Promise<string> {
      try {
        const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupPath = `${svnPath}_backup_${timestamp}`
        
        const command = `svn copy --username "${credential.username}" --password "${password}" --non-interactive -m "Backup before deployment" "${svnPath}" "${backupPath}"`
        await this.execCommand(command, { timeout: 30000 })
        
        logger.info(`SVN backup created: ${backupPath}`)
        return backupPath
      } catch (error: any) {
        logger.error('SVN backup failed:', error)
        throw new Error(`SVN backup failed: ${error.message}`)
      }
    }
  
    async getInfo(svnPath: string, credential: SvnCredential): Promise<any> {
      try {
        const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
        const command = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${svnPath}"`
        
        const { stdout } = await this.execCommand(command, { timeout: 10000 })
        return stdout
      } catch (error: any) {
        logger.error('SVN get info failed:', error)
        throw new Error(`SVN get info failed: ${error.message}`)
      }
    }
  }
