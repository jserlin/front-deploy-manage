/**
 * IPC 调用封装
 * 通过 window.electronAPI 与主进程通信
 */

// 定义 electronAPI 的类型
interface ElectronAPI {
  project: {
    getAll: () => Promise<any>
    getById: (id: number) => Promise<any>
    create: (data: any) => Promise<any>
    update: (id: number, data: any) => Promise<any>
    delete: (id: number) => Promise<any>
    scanGit: (path: string) => Promise<any>
  }
  group: {
    getAll: () => Promise<any>
    create: (data: any) => Promise<any>
    update: (id: number, data: any) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  serverCredential: {
    getAll: () => Promise<any>
    getById: (id: number) => Promise<any>
    create: (data: any) => Promise<any>
    update: (id: number, data: any) => Promise<any>
    delete: (id: number) => Promise<any>
    testConnection: (id: number) => Promise<any>
  }
  svnCredential: {
    getAll: () => Promise<any>
    getById: (id: number) => Promise<any>
    create: (data: any) => Promise<any>
    update: (id: number, data: any) => Promise<any>
    delete: (id: number) => Promise<any>
    testConnection: (id: number) => Promise<any>
  }
  git: {
    getRepoInfo: (localPath: string) => Promise<any>
    getBranches: (localPath: string) => Promise<any>
    checkout: (localPath: string, branch: string) => Promise<any>
    pull: (localPath: string) => Promise<any>
    getStatus: (localPath: string) => Promise<any>
  }
  deploy: {
    svn: (config: any) => Promise<any>
    server: (config: any) => Promise<any>
    mixed: (config: any) => Promise<any>
    stop: () => Promise<any>
    getHistory: (projectId?: number) => Promise<any>
    onProgress: (callback: (progress: any) => void) => void
  }
  template: {
    getAll: () => Promise<any>
    getById: (id: number) => Promise<any>
    create: (data: any) => Promise<any>
    update: (id: number, data: any) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  config: {
    export: (includePasswords: boolean) => Promise<any>
    import: (filePath: string) => Promise<any>
    selectFile: () => Promise<any>
    selectJsonFile: () => Promise<any>
    getDbPath: () => Promise<any>
    clearAll: () => Promise<any>
    openDataDir: () => Promise<any>
  }
  node: {
    checkVersion: (expectedVersion: string) => Promise<any>
    switchVersion: (version: string) => Promise<any>
    installVersion: (version: string) => Promise<any>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
