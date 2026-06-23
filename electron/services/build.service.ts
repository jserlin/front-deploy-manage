import { spawn, ChildProcess } from 'child_process'
import { logger } from '../utils/logger'
import * as fs from 'fs-extra'
import * as path from 'path'

export interface BuildResult {
  success: boolean
  output: string
  error?: string
}

export interface Project {
  id: number
  name: string
  localPath: string
  buildCommand: string
  outputDir: string
  nodeVersion?: string
  /** 整合仓库根目录，留空则回退到 localPath */
  repoRootPath?: string
}

export class BuildService {
  private currentProcess: ChildProcess | null = null

  private getNodeEnvPath(nodeVersion?: string): { [key: string]: string | undefined } {
    if (!nodeVersion) {
      return { ...process.env, NODE_ENV: 'production' }
    }

    const nvmHome = process.env.NVM_HOME
    if (!nvmHome) {
      return { ...process.env, NODE_ENV: 'production' }
    }

    const normalized = nodeVersion.trim()
    const versionPrefix = normalized.startsWith('v') ? normalized : `v${normalized}`
    const nodeDir = path.join(nvmHome, versionPrefix)
    if (!fs.existsSync(nodeDir)) {
      logger.warn(`Node ${versionPrefix} directory not found: ${nodeDir}, using default Node`)
      return { ...process.env, NODE_ENV: 'production' }
    }

    const currentPath = process.env.PATH || ''
    const newPath = `${nodeDir};${currentPath}`
    logger.info(`Injecting Node ${versionPrefix} into PATH: ${nodeDir}`)

    return {
      ...process.env,
      PATH: newPath,
      NODE_ENV: 'production'
    }
  }

  /**
   * 构建前诊断实际使用的 Node/npm 版本和路径。
   * 检查 node 和 npm 是否来自同一目录，不一致时给出明确警告。
   * 不做版本拦截（v13 + npm6 等组合是合法的）。
   */
  private async checkBuildEnv(
    env: { [key: string]: string | undefined },
    onLog?: (log: string) => void
  ): Promise<{ ok: boolean; error?: string }> {
    const run = (cmd: string): Promise<string> => new Promise((res) => {
      const child = spawn(cmd, { shell: true, env, timeout: 8000 })
      let out = ''
      child.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      child.stderr?.on('data', () => {})
      child.on('close', () => res(out.trim()))
      child.on('error', () => res(''))
    })

    // 获取版本和路径
    const nodeVer = await run('node -v')
    const npmVer = await run('npm -v')
    const nodePath = await run('where node')
    const npmPath = await run('where npm')

    if (onLog) {
      onLog(`[环境检查] Node: ${nodeVer || '(未检测到)'} | npm: ${npmVer || '(未检测到)'}`)
      if (nodePath) onLog(`[环境检查] node 路径: ${nodePath.split('\r\n')[0]}`)
      if (npmPath) onLog(`[环境检查] npm 路径: ${npmPath.split('\r\n')[0]}`)
    }

    // 检查 node 和 npm 是否来自同一版本目录
    const nodeFirst = nodePath.split('\r\n')[0].toLowerCase()
    const npmFirst = npmPath.split('\r\n')[0].toLowerCase()

    if (nodeFirst && npmFirst) {
      // 取各自所在目录进行比较
      const nodeDir = nodeFirst.substring(0, nodeFirst.lastIndexOf('\\'))
      const npmDir = npmFirst.substring(0, npmFirst.lastIndexOf('\\'))

      if (nodeDir && npmDir && nodeDir !== npmDir) {
        const msg = `Node 和 npm 来自不同目录，可能导致版本不匹配:\n  Node: ${nodeDir}\n  npm: ${npmDir}`
        if (onLog) onLog(`[环境警告] ${msg}`)
        logger.warn(msg)
      }
    }

    return { ok: true }
  }

  async build(
    project: Project,
    onLog?: (log: string) => void
  ): Promise<BuildResult> {
    try {
      logger.info(`Starting build for project: ${project.name}`)

      if (!fs.existsSync(project.localPath)) {
        return {
          success: false,
          output: '',
          error: 'Project directory does not exist'
        }
      }

      const env = this.getNodeEnvPath(project.nodeVersion)

      // 构建前检查 Node/npm 版本
      const envCheck = await this.checkBuildEnv(env, onLog)
      if (!envCheck.ok) {
        return { success: false, output: '', error: envCheck.error! }
      }

      return new Promise((resolve) => {
        const [command, ...args] = project.buildCommand.split(' ')

        this.currentProcess = spawn(command, args, {
          cwd: project.localPath,
          shell: true,
          env
        })

        let output = ''
        let error = ''

        this.currentProcess.stdout?.on('data', (data) => {
          const log = data.toString()
          output += log
          if (onLog) {
            onLog(log)
          }
          logger.info(log)
        })

        this.currentProcess.stderr?.on('data', (data) => {
          const log = data.toString()
          error += log
          output += log
          if (onLog) {
            onLog(log)
          }
          logger.error(log)
        })

        this.currentProcess.on('close', (code) => {
          this.currentProcess = null
          
          if (code === 0) {
            logger.info('Build completed successfully')
            resolve({
              success: true,
              output
            })
          } else {
            logger.error(`Build failed with code: ${code}`)
            resolve({
              success: false,
              output,
              error: `Build process exited with code ${code}`
            })
          }
        })

        this.currentProcess.on('error', (err) => {
          this.currentProcess = null
          logger.error('Build process error:', err)
          resolve({
            success: false,
            output,
            error: err.message
          })
        })
      })
    } catch (error: any) {
      logger.error('Build failed:', error)
      return {
        success: false,
        output: '',
        error: error.message
      }
    }
  }

  stopBuild(): void {
    if (this.currentProcess) {
      this.currentProcess.kill()
      this.currentProcess = null
      logger.info('Build process stopped')
    }
  }

  async validateOutput(project: Project): Promise<boolean> {
    try {
      const outputPath = path.join(project.localPath, project.outputDir)
      const exists = await fs.pathExists(outputPath)
      
      if (!exists) {
        logger.error(`Output directory does not exist: ${outputPath}`)
        return false
      }

      const files = await fs.readdir(outputPath)
      if (files.length === 0) {
        logger.error('Output directory is empty')
        return false
      }

      logger.info('Build output validated successfully')
      return true
    } catch (error) {
      logger.error('Failed to validate build output:', error)
      return false
    }
  }
}
