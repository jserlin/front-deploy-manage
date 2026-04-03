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
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: number
  name: string
  color: string
  sortOrder: number
}
