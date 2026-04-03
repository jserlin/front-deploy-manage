"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 项目相关
  project: {
    getAll: () => electron.ipcRenderer.invoke("project:getAll"),
    getById: (id) => electron.ipcRenderer.invoke("project:getById", id),
    create: (data) => electron.ipcRenderer.invoke("project:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("project:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("project:delete", id),
    scanGit: (path) => electron.ipcRenderer.invoke("project:scanGit", path)
  },
  // 分组相关
  group: {
    getAll: () => electron.ipcRenderer.invoke("group:getAll"),
    create: (data) => electron.ipcRenderer.invoke("group:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("group:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("group:delete", id)
  },
  // 服务器凭证相关
  serverCredential: {
    getAll: () => electron.ipcRenderer.invoke("serverCredential:getAll"),
    getById: (id) => electron.ipcRenderer.invoke("serverCredential:getById", id),
    create: (data) => electron.ipcRenderer.invoke("serverCredential:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("serverCredential:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("serverCredential:delete", id),
    testConnection: (id) => electron.ipcRenderer.invoke("serverCredential:testConnection", id)
  },
  // SVN 凭证相关
  svnCredential: {
    getAll: () => electron.ipcRenderer.invoke("svnCredential:getAll"),
    getById: (id) => electron.ipcRenderer.invoke("svnCredential:getById", id),
    create: (data) => electron.ipcRenderer.invoke("svnCredential:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("svnCredential:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("svnCredential:delete", id),
    testConnection: (id) => electron.ipcRenderer.invoke("svnCredential:testConnection", id)
  },
  // Git 相关
  git: {
    getRepoInfo: (localPath) => electron.ipcRenderer.invoke("git:getRepoInfo", localPath),
    getBranches: (localPath) => electron.ipcRenderer.invoke("git:getBranches", localPath),
    checkout: (localPath, branch) => electron.ipcRenderer.invoke("git:checkout", localPath, branch),
    pull: (localPath) => electron.ipcRenderer.invoke("git:pull", localPath),
    getStatus: (localPath) => electron.ipcRenderer.invoke("git:getStatus", localPath)
  },
  // 发布相关
  deploy: {
    svn: (config) => electron.ipcRenderer.invoke("deploy:svn", config),
    server: (config) => electron.ipcRenderer.invoke("deploy:server", config),
    mixed: (config) => electron.ipcRenderer.invoke("deploy:mixed", config),
    stop: () => electron.ipcRenderer.invoke("deploy:stop"),
    getHistory: (projectId) => electron.ipcRenderer.invoke("deploy:getHistory", projectId),
    onProgress: (callback) => {
      electron.ipcRenderer.on("deploy:progress", (event, progress) => callback(progress));
    }
  },
  // 发布模板相关
  template: {
    getAll: () => electron.ipcRenderer.invoke("template:getAll"),
    getById: (id) => electron.ipcRenderer.invoke("template:getById", id),
    create: (data) => electron.ipcRenderer.invoke("template:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("template:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("template:delete", id)
  },
  // 配置相关
  config: {
    export: (includePasswords) => electron.ipcRenderer.invoke("config:export", includePasswords),
    import: (filePath) => electron.ipcRenderer.invoke("config:import", filePath),
    selectFile: () => electron.ipcRenderer.invoke("config:selectFile"),
    selectJsonFile: () => electron.ipcRenderer.invoke("config:selectJsonFile"),
    getDbPath: () => electron.ipcRenderer.invoke("config:getDbPath"),
    clearAll: () => electron.ipcRenderer.invoke("config:clearAll"),
    openDataDir: () => electron.ipcRenderer.invoke("config:openDataDir")
  }
});
