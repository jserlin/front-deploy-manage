export interface DeployConfig {
  projectId: number
  branch: string
  deployType: 'svn' | 'server' | 'mixed'
  serverCredentialId?: number
  svnCredentialId?: number
  remotePath?: string
  svnPath?: string
  commitMessage?: string
  preCommand?: string
  postCommand?: string
  backupEnabled: boolean
  startedAt?: string
  finishedAt?: string
  log?: string
  createdAt: string
}

