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

export interface BranchStatus {
  branch: string
  localExists: boolean
  remoteExists: boolean
  current: string
  hasUpstream: boolean
  checkedAt: string
}

export interface CommitDetail {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  tags: string[]
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

  /**
   * 获取指定路径所在 Git 仓库的根目录（toplevel）。
   * 用于整合仓库场景：传入子项目目录，返回仓库根目录。
   * 若不是 git 仓库则返回 null。
   */
  async getRepoRoot(localPath: string): Promise<string | null> {
    try {
      const git = this.getGit(localPath)
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return null
      const root = await git.revparse(['--show-toplevel'])
      return root ? root.trim() : null
    } catch (error) {
      logger.error('Failed to get repo root:', error)
      return null
    }
  }

  /**
   * 检查指定分支在本地和远程的存在状态。
   * 用于发布前分支状态诊断，识别"本地存在但远程不存在"等场景。
   */
  async checkBranchStatus(localPath: string, branch: string): Promise<BranchStatus> {
    const git = this.getGit(localPath)
    const status = await git.status()
    const localBranches = await git.branchLocal()
    const localExists = localBranches.all.includes(branch)

    let remoteExists = false
    try {
      const remoteBranches = await git.branch(['-r'])
      remoteExists = remoteBranches.all.some((b: string) => {
        const trimmed = b.trim()
        // 匹配 origin/branch 或 origin/tags/branch 等
        return trimmed === `origin/${branch}` || trimmed.endsWith(`/${branch}`)
      })
    } catch {
      // 远程不可达或无远程分支
    }

    return {
      branch,
      localExists,
      remoteExists,
      current: status.current || '',
      hasUpstream: !!status.tracking,
      checkedAt: new Date().toISOString()
    }
  }

  /**
   * 获取当前 HEAD 的完整 commit 信息（哈希、提交信息、作者、时间、关联 tag）。
   */
  async getCommitDetail(localPath: string): Promise<CommitDetail> {
    try {
      const git = this.getGit(localPath)
      const log = await git.log(['--max-count=1'])
      const latest = log.latest

      let tags: string[] = []
      if (latest) {
        try {
          const tagResult = await git.tag(['--points-at', latest.hash])
          tags = tagResult.split('\n').map((t: string) => t.trim()).filter(Boolean)
        } catch {
          // 无 tag 或获取失败
        }
      }

      return {
        hash: latest?.hash || '',
        shortHash: latest?.hash ? latest.hash.substring(0, 8) : '',
        message: latest?.message || '',
        author: latest?.author_name || '',
        date: latest?.date || '',
        tags
      }
    } catch (error) {
      logger.error('Failed to get commit detail:', error)
      return { hash: '', shortHash: '', message: '', author: '', date: '', tags: [] }
    }
  }
}
