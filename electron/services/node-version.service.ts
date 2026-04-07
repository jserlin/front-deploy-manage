import { existsSync, readdirSync } from 'fs'

import { exec } from 'child_process'
import { join } from 'path'
import { logger } from '../utils/logger'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface NodeCheckResult {
  needSwitch: boolean
  currentVersion: string
  expectedVersion: string
  nvmAvailable: boolean
  versionInstalled: boolean
  nodePath: string
  error?: string
}

function getNvmHome(): string | null {
  return process.env.NVM_HOME || null
}

export class NodeVersionService {
  async getCurrentVersion(): Promise<string> {
    const { stdout } = await execAsync('node -v', { timeout: 5000 })
    return stdout.trim()
  }

  async checkNvmAvailable(): Promise<boolean> {
    const nvmHome = getNvmHome()
    return !!(nvmHome && existsSync(join(nvmHome, 'nvm.exe')))
  }

  async isVersionInstalled(version: string): Promise<boolean> {
    const normalized = version.startsWith('v') ? version : `v${version}`
    const nvmHome = getNvmHome()
    if (nvmHome && existsSync(join(nvmHome, normalized))) {
      return true
    }
    return false
  }

  getNodeVersionPath(version: string): string | null {
    const normalized = version.startsWith('v') ? version : `v${version}`
    const nvmHome = getNvmHome()
    if (!nvmHome) return null
    const versionDir = join(nvmHome, normalized)
    return existsSync(versionDir) ? versionDir : null
  }

  async getInstalledVersions(): Promise<string[]> {
    const nvmHome = getNvmHome()
    if (!nvmHome || !existsSync(nvmHome)) return []
    try {
      const entries = readdirSync(nvmHome, { withFileTypes: true })
      return entries
        .filter(e => e.isDirectory() && e.name.startsWith('v'))
        .map(e => e.name)
        .sort()
    } catch {
      return []
    }
  }

  async checkVersion(expectedVersion: string): Promise<NodeCheckResult> {
    if (!expectedVersion) {
      return {
        needSwitch: false,
        currentVersion: '',
        expectedVersion: '',
        nvmAvailable: false,
        versionInstalled: false,
        nodePath: ''
      }
    }

    const normalized = expectedVersion.startsWith('v') ? expectedVersion : `v${expectedVersion}`

    try {
      const currentVersion = await this.getCurrentVersion()

      if (currentVersion === normalized) {
        return {
          needSwitch: false,
          currentVersion,
          expectedVersion: normalized,
          nvmAvailable: true,
          versionInstalled: true,
          nodePath: ''
        }
      }

      const nvmAvailable = await this.checkNvmAvailable()
      if (!nvmAvailable) {
        return {
          needSwitch: true,
          currentVersion,
          expectedVersion: normalized,
          nvmAvailable: false,
          versionInstalled: false,
          nodePath: '',
          error: `本项目依赖 Node ${normalized}，请先安装 nvm-windows 后再试`
        }
      }

      const versionInstalled = await this.isVersionInstalled(normalized)
      const nodePath = this.getNodeVersionPath(normalized) || ''
      return {
        needSwitch: true,
        currentVersion,
        expectedVersion: normalized,
        nvmAvailable: true,
        versionInstalled,
        nodePath
      }
    } catch (error: any) {
      return {
        needSwitch: true,
        currentVersion: 'unknown',
        expectedVersion: normalized,
        nvmAvailable: false,
        versionInstalled: false,
        nodePath: '',
        error: error.message
      }
    }
  }

  async switchVersion(version: string): Promise<void> {
    const normalized = version.startsWith('v') ? version : `v${version}`
    const nodePath = this.getNodeVersionPath(normalized)
    if (!nodePath) {
      throw new Error(`Node ${normalized} 未安装，无法切换`)
    }
    logger.info(`Node ${normalized} ready, path: ${nodePath}`)
  }
}
