import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 项目相关
  project: {
    getAll: () => ipcRenderer.invoke('project:getAll'),
    getById: (id: number) => ipcRenderer.invoke('project:getById', id),
    create: (data: any) => ipcRenderer.invoke('project:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('project:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('project:delete', id),
    scanGit: (path: string) => ipcRenderer.invoke('project:scanGit', path)
  },

  // 分组相关
  group: {
    getAll: () => ipcRenderer.invoke('group:getAll'),
    create: (data: any) => ipcRenderer.invoke('group:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('group:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('group:delete', id)
  },

  // 服务器凭证相关
  serverCredential: {
    getAll: () => ipcRenderer.invoke('serverCredential:getAll'),
    getById: (id: number) => ipcRenderer.invoke('serverCredential:getById', id),
    create: (data: any) => ipcRenderer.invoke('serverCredential:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('serverCredential:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('serverCredential:delete', id),
    testConnection: (id: number) => ipcRenderer.invoke('serverCredential:testConnection', id)
  },

  // SVN 凭证相关
  svnCredential: {
    getAll: () => ipcRenderer.invoke('svnCredential:getAll'),
    getById: (id: number) => ipcRenderer.invoke('svnCredential:getById', id),
    create: (data: any) => ipcRenderer.invoke('svnCredential:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('svnCredential:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('svnCredential:delete', id),
    testConnection: (id: number) => ipcRenderer.invoke('svnCredential:testConnection', id)
  },

  // Git 相关
  git: {
    getRepoInfo: (localPath: string) => ipcRenderer.invoke('git:getRepoInfo', localPath),
    getBranches: (localPath: string) => ipcRenderer.invoke('git:getBranches', localPath),
    checkout: (localPath: string, branch: string) => ipcRenderer.invoke('git:checkout', localPath, branch),
    pull: (localPath: string) => ipcRenderer.invoke('git:pull', localPath),
    getStatus: (localPath: string) => ipcRenderer.invoke('git:getStatus', localPath)
  },

  // 发布相关
  deploy: {
    svn: (config: any) => ipcRenderer.invoke('deploy:svn', config),
    server: (config: any) => ipcRenderer.invoke('deploy:server', config),
    mixed: (config: any) => ipcRenderer.invoke('deploy:mixed', config),
    stop: () => ipcRenderer.invoke('deploy:stop'),
    getHistory: (projectId?: number) => ipcRenderer.invoke('deploy:getHistory', projectId),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('deploy:progress', (event, progress) => callback(progress))
    }
  },

  // 发布模板相关
  template: {
    getAll: () => ipcRenderer.invoke('template:getAll'),
    getById: (id: number) => ipcRenderer.invoke('template:getById', id),
    create: (data: any) => ipcRenderer.invoke('template:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('template:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('template:delete', id)
  },

  // 配置相关
  config: {
    export: (includePasswords: boolean) => ipcRenderer.invoke('config:export', includePasswords),
    import: (filePath: string) => ipcRenderer.invoke('config:import', filePath),
    selectFile: () => ipcRenderer.invoke('config:selectFile'),
    getDbPath: () => ipcRenderer.invoke('config:getDbPath'),
    clearAll: () => ipcRenderer.invoke('config:clearAll'),
    openDataDir: () => ipcRenderer.invoke('config:openDataDir')
  }
})
