import { exec } from 'child_process'
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
  async testConnection(credential: SvnCredential): Promise<{ success: boolean; message: string }> {
    try {
      const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      const command = `svn info --username "${credential.username}" --password "${password}" --non-interactive "${credential.svnUrl}"`
      
      await execAsync(command, { timeout: 10000 })
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
      const password = credential.password ? CryptoUtil.decrypt(credential.password) : ''
      
      // 1. 检出或更新 SVN 目录
      const tempDir = `${localPath}_svn_temp`
      const checkoutCommand = `svn checkout --username "${credential.username}" --password "${password}" --non-interactive "${svnPath}" "${tempDir}"`
      
      try {
        await execAsync(checkoutCommand, { timeout: 30000 })
      } catch (error: any) {
        // 如果目录已存在，则更新
        if (error.message.includes('already')) {
          const updateCommand = `svn update --username "${credential.username}" --password "${password}" --non-interactive "${tempDir}"`
          await execAsync(updateCommand, { timeout: 30000 })
        } else {
          throw error
        }
      }

      // 2. 复制构建产物到 SVN 工作副本
      const fs = require('fs-extra')
      await fs.copy(localPath, tempDir, { overwrite: true })

      // 3. 添加新文件
      const addCommand = `svn add --force "${tempDir}" --auto-props --parents --depth infinity`
      await execAsync(addCommand, { timeout: 30000 })

      // 4. 提交更改
      const commitCommand = `svn commit --username "${credential.username}" --password "${password}" --non-interactive -m "${commitMessage}" "${tempDir}"`
      await execAsync(commitCommand, { timeout: 60000 })

      // 5. 清理临时目录
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
      await execAsync(command, { timeout: 30000 })
      
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
      
      const { stdout } = await execAsync(command, { timeout: 10000 })
      return stdout
    } catch (error: any) {
      logger.error('SVN get info failed:', error)
      throw new Error(`SVN get info failed: ${error.message}`)
    }
  }
}
