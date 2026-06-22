export interface Project {
  id: number
  name: string
  localPath: string
  gitRepo?: string
  gitBranch?: string
  buildCommand?: string
  outputDir?: string
  groupId?: number
  groupName?: string
  groupColor?: string
  description?: string
  nodeVersion?: string
  permissionFilePath?: string
  svnPermissionAlias?: string
  /**
   * 整合仓库（monorepo）场景下的 Git 仓库根目录。
   * 独立仓库模式下留空，此时 git 操作回退到 localPath；
   * 整合仓库模式下指向仓库根目录，多个子前端项目共享同一值。
   */
  repoRootPath?: string
  createdAt: string
  updatedAt: string
}

/**
 * 扫描整合仓库得到的子前端项目候选项
 */
export interface SubProjectCandidate {
  name: string
  /** 子项目绝对路径（构建时的工作目录） */
  localPath: string
  /** 相对仓库根目录的路径，用于展示 */
  relativePath: string
  buildCommand: string
  outputDir: string
  nodeVersion?: string
}

export interface Group {
  id: number
  name: string
  color: string
  sortOrder: number
}
