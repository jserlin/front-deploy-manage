import { exec, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { logger } from '../utils/logger'
import { CryptoUtil } from '../utils/crypto'

const execAsync = promisify(exec)
const fs = require('fs-extra')

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

  private buildSvnUrl(baseUrl: string, path: string): string {
    let fullPath: string
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('svn://')) {
      fullPath = path
    } else {
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      const relativePath = path.startsWith('/') ? path : '/' + path
      fullPath = base + relativePath
    }
    try {
      const decoded = decodeURIComponent(fullPath)
      return encodeURI(decoded)
    } catch {
      return encodeURI(fullPath)
    }
  }

  private getParentPath(url: string): string {
    const parts = url.split('/')
    parts.pop()
    return parts.join('/')
  }

  private getDirName(url: string): string {
    const parts = url.split('/')
    return parts.pop() || ''
  }

  private async ensureSvnDirectoryExists(
    credential: SvnCredential,
    svnPath: string,
    fullSvnUrl: string
  ): Promise<void> {
    try {
      const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      
      const testCommand = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${fullSvnUrl}"`
      await this.execCommand(testCommand, { timeout: 10000 })
      return
    } catch (error: any) {
      logger.info(`SVN directory does not exist, attempting to create: ${fullSvnUrl}`)
    }

    const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
    const parentUrl = this.getParentPath(fullSvnUrl)
    const dirName = this.getDirName(fullSvnUrl)
    
    if (!dirName) {
      throw new Error(`Cannot create SVN directory: invalid path ${fullSvnUrl}`)
    }

    const tempParentDir = require('os').tmpdir() + `/svn_parent_${Date.now()}`
    
    try {
      const checkoutParentCmd = `svn checkout --depth empty --username "${credential.username}" --password "${password}" --non-interactive "${parentUrl}" "${tempParentDir}"`
      await this.execCommand(checkoutParentCmd, { timeout: 30000 })
    } catch (error: any) {
      throw new Error(`Failed to checkout parent directory: ${parentUrl}. Error: ${error.message}`)
    }

    try {
      const newDirPath = tempParentDir + '/' + dirName
      await fs.ensureDir(newDirPath)
      
      const addCommand = `svn add "${newDirPath}"`
      await this.execCommand(addCommand, { timeout: 10000 })
      
      const commitCommand = `svn commit --username "${credential.username}" --password "${password}" --non-interactive -m "Create directory for deployment" "${newDirPath}"`
      await this.execCommand(commitCommand, { timeout: 30000 })
      
      logger.info(`SVN directory created: ${fullSvnUrl}`)
    } finally {
      await fs.remove(tempParentDir).catch(() => {})
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
      
      const fullSvnUrl = this.buildSvnUrl(credential.svnUrl, svnPath)
      const tempDir = `${localPath}_svn_temp`
      
      await this.ensureSvnDirectoryExists(credential, svnPath, fullSvnUrl)
      
      const checkoutCommand = `svn checkout --username "${credential.username}" --password "${password}" --non-interactive "${fullSvnUrl}" "${tempDir}"`
      
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
      const fullSvnUrl = this.buildSvnUrl(credential.svnUrl, svnPath)
      
      try {
        const testCommand = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${fullSvnUrl}"`
        await this.execCommand(testCommand, { timeout: 10000 })
      } catch {
        logger.info(`SVN backup skipped: directory does not exist - ${fullSvnUrl}`)
        return '(目录不存在，跳过备份)'
      }

      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      const backupUrl = `${fullSvnUrl}_backup_${timestamp}`
      
      const command = `svn copy --username "${credential.username}" --password "${password}" --non-interactive -m "Backup before deployment" "${fullSvnUrl}" "${backupUrl}"`
      await this.execCommand(command, { timeout: 30000 })
      
      logger.info(`SVN backup created: ${backupUrl}`)
      return backupUrl
    } catch (error: any) {
      logger.error('SVN backup failed:', error)
      throw new Error(`SVN backup failed: ${error.message}`)
    }
  }

  async getInfo(svnPath: string, credential: SvnCredential): Promise<any> {
    try {
      const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      const fullSvnUrl = this.buildSvnUrl(credential.svnUrl, svnPath)
      const command = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${fullSvnUrl}"`
      
      const { stdout } = await this.execCommand(command, { timeout: 10000 })
      return stdout
    } catch (error: any) {
      logger.error('SVN get info failed:', error)
      throw new Error(`SVN get info failed: ${error.message}`)
    }
  }
}
