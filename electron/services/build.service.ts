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
}

export class BuildService {
  private currentProcess: ChildProcess | null = null

  async build(
    project: Project,
    onLog?: (log: string) => void
  ): Promise<BuildResult> {
    return new Promise((resolve) => {
      try {
        logger.info(`Starting build for project: ${project.name}`)
        
        // 检查项目目录是否存在
        if (!fs.existsSync(project.localPath)) {
          resolve({
            success: false,
            output: '',
            error: 'Project directory does not exist'
          })
          return
        }

        const [command, ...args] = project.buildCommand.split(' ')
        
        this.currentProcess = spawn(command, args, {
          cwd: project.localPath,
          shell: true,
          env: { ...process.env, NODE_ENV: 'production' }
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
      } catch (error: any) {
        logger.error('Build failed:', error)
        resolve({
          success: false,
          output: '',
          error: error.message
        })
      }
    })
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
