import { simpleGit, SimpleGit } from 'simple-git'
import { logger } from '../utils/logger'

export interface GitRepoInfo {
  repo: string
  branch: string
  remote: string
}

export interface GitStatus {
  current: string
  tracking: string | null
  files: string[]
  staged: string[]
  ahead: number
  behind: number
}

export interface Commit {
  hash: string
  date: string
  message: string
  author_name: string
}

export class GitService {
  private gitInstances: Map<string, SimpleGit> = new Map()

  private getGit(localPath: string): SimpleGit {
    if (!this.gitInstances.has(localPath)) {
      this.gitInstances.set(localPath, simpleGit(localPath, {
        env: {
          ...process.env,
          GIT_SSL_NO_VERIFY: '1'
        }
      }))
    }
    return this.gitInstances.get(localPath)!
  }

  private async ensureSslVerifyDisabled(localPath: string): Promise<void> {
    try {
      const git = this.getGit(localPath)
      await git.addConfig('http.sslVerify', 'false')
      await git.addConfig('http.sslVerify', 'false', 'global')
    } catch {
      // ignore if not a git repo yet
    }
  }

  async getRepoInfo(localPath: string): Promise<GitRepoInfo | null> {
    try {
      const git = this.getGit(localPath)
      
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return null
      }

      const [remotes, branch] = await Promise.all([
        git.getRemotes(true),
        git.revparse(['--abbrev-ref', 'HEAD'])
      ])

      const originRemote = remotes.find(r => r.name === 'origin')
      
      return {
        repo: originRemote?.refs?.fetch || '',
        branch: branch.trim(),
        remote: originRemote?.refs?.fetch || ''
      }
    } catch (error) {
      logger.error('Failed to get repo info:', error)
      return null
    }
  }

  async getBranches(localPath: string): Promise<string[]> {
    try {
      const git = this.getGit(localPath)
      const branches = await git.branchLocal()
      return branches.all
    } catch (error) {
      logger.error('Failed to get branches:', error)
      return []
    }
  }

  async checkoutBranch(localPath: string, branch: string): Promise<void> {
    try {
      await this.ensureSslVerifyDisabled(localPath)
      const git = this.getGit(localPath)
      await git.checkout(branch)
      logger.info(`Checked out branch: ${branch}`)
    } catch (error) {
      logger.error('Failed to checkout branch:', error)
      throw error
    }
  }

  async pull(localPath: string): Promise<void> {
    try {
      await this.ensureSslVerifyDisabled(localPath)
      const git = this.getGit(localPath)
      await git.raw(['-c', 'http.sslVerify=false', 'pull'])
      logger.info('Pulled latest changes')
    } catch (error) {
      logger.error('Failed to pull:', error)
      throw error
    }
  }

  async getStatus(localPath: string): Promise<GitStatus | null> {
    try {
      const git = this.getGit(localPath)
      const status = await git.status()
      
      return {
        current: status.current,
        tracking: status.tracking,
        files: status.files.map(f => f.path),
        staged: status.staged,
        ahead: status.ahead,
        behind: status.behind
      }
    } catch (error) {
      logger.error('Failed to get status:', error)
      return null
    }
  }

  async getCommits(localPath: string, limit: number = 10): Promise<Commit[]> {
    try {
      const git = this.getGit(localPath)
      const log = await git.log(['--max-count=' + limit])
      
      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author_name: commit.author_name
      }))
    } catch (error) {
      logger.error('Failed to get commits:', error)
      return []
    }
  }

  async getCurrentCommit(localPath: string): Promise<string> {
    try {
      const git = this.getGit(localPath)
      const log = await git.log(['--max-count=1'])
      return log.latest?.hash || ''
    } catch (error) {
      logger.error('Failed to get current commit:', error)
      return ''
    }
  }
}
