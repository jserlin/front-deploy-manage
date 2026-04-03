import { ipcMain, dialog } from 'electron'
import { DatabaseManager } from '../database'
import { GitService } from '../services/git.service'
import { SSHService } from '../services/ssh.service'
import { SVNService } from '../services/svn.service'
import { BuildService } from '../services/build.service'
import { CryptoUtil } from '../utils/crypto'
import * as fs from 'fs-extra'
import * as path from 'path'

export function registerIpcHandlers(database: DatabaseManager) {
  const db = database
  const gitService = new GitService()
  const sshService = new SSHService()
  const svnService = new SVNService()
  const buildService = new BuildService()

  // ==================== 项目管理 ====================

  ipcMain.handle('project:getAll', async () => {
    try {
      const projects = db.all('projects')
      const groups = db.all('groups') as any[]
      const groupMap = new Map(groups.map((g: any) => [g.id, g]))
      const mapped = projects.map((p: any) => {
        const group = p.group_id ? groupMap.get(p.group_id) : null
        return {
          id: p.id,
          name: p.name,
          localPath: p.local_path,
          gitRepo: p.git_repo || '',
          gitBranch: p.git_branch || 'main',
          buildCommand: p.build_command || '',
          outputDir: p.output_dir || 'dist',
          groupId: p.group_id || null,
          groupName: group ? group.name : '',
          groupColor: group ? group.color : '',
          description: p.description || '',
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }
      })
      return { success: true, data: mapped }
    } catch (error: any) {
      console.error('Failed to get projects:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:getById', async (event, id: number) => {
    try {
      const p = db.get('SELECT * FROM projects WHERE id=?', [id]) as any
      if (!p) return { success: false, error: 'Project not found' }
      const groups = db.all('groups') as any[]
      const group = p.group_id ? groups.find((g: any) => g.id === p.group_id) : null
      const mapped = {
        id: p.id,
        name: p.name,
        localPath: p.local_path,
        gitRepo: p.git_repo || '',
        gitBranch: p.git_branch || 'main',
        buildCommand: p.build_command || '',
        outputDir: p.output_dir || 'dist',
        groupId: p.group_id || null,
        groupName: group ? group.name : '',
        groupColor: group ? group.color : '',
        description: p.description || '',
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:create', async (event, data) => {
    try {
      console.log('[IPC] project:create - data:', JSON.stringify(data))
      const result = db.run(`
        INSERT INTO projects (name, local_path, git_repo, git_branch, build_command, output_dir, group_id, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.name, data.localPath, data.gitRepo || null, data.gitBranch || 'main',
        data.buildCommand || 'npm run build', data.outputDir || 'dist',
        data.groupId || null, data.description || null
      ])
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error: any) {
      console.error('Failed to create project:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:update', async (event, id: number, data) => {
    try {
      db.run(`
        UPDATE projects
        SET name=?, local_path=?, git_repo=?, git_branch=?, build_command=?, output_dir=?, group_id=?, description=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.name, data.localPath, data.gitRepo || null, data.gitBranch || 'main',
        data.buildCommand || 'npm run build', data.outputDir || 'dist',
        data.groupId || null, data.description || null, id
      ])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:delete', async (event, id: number) => {
    try {
      db.run('DELETE FROM projects WHERE id=?', [id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('project:scanGit', async (event, projectPath: string) => {
    try {
      const repoInfo = await gitService.getRepoInfo(projectPath)
      return { success: true, data: repoInfo }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 分组管理 ====================

  ipcMain.handle('group:getAll', async () => {
    try {
      const groups = db.all('SELECT * FROM groups ORDER BY sort_order, name')
      return { success: true, data: groups }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('group:create', async (event, data) => {
    try {
      const result = db.run('INSERT INTO groups (name, color, sort_order) VALUES (?, ?, ?)',
        [data.name, data.color || '#409EFF', data.sortOrder || 0])
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('group:update', async (event, id: number, data) => {
    try {
      db.run('UPDATE groups SET name=?, color=?, sort_order=? WHERE id=?',
        [data.name, data.color || '#409EFF', data.sortOrder || 0, id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('group:delete', async (event, id: number) => {
    try {
      db.run('DELETE FROM groups WHERE id=?', [id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 服务器凭证管理 ====================

  ipcMain.handle('serverCredential:getAll', async () => {
    try {
      const rows = db.all('server_credentials')
      const mapped = rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        username: c.username,
        authType: c.auth_type || 'password',
        environment: c.environment || 'dev',
        description: c.description || '',
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('serverCredential:getById', async (event, id: number) => {
    try {
      const c = db.get('SELECT * FROM server_credentials WHERE id=?', [id]) as any
      if (!c) return { success: false, error: 'Credential not found' }
      const mapped = {
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        username: c.username,
        authType: c.auth_type || 'password',
        environment: c.environment || 'dev',
        description: c.description || '',
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('serverCredential:create', async (event, data) => {
    try {
      const encryptedPassword = data.password ? CryptoUtil.encrypt(data.password) : null
      const encryptedPrivateKey = data.privateKey ? CryptoUtil.encrypt(data.privateKey) : null
      const encryptedPassphrase = data.passphrase ? CryptoUtil.encrypt(data.passphrase) : null

      const result = db.run(`
        INSERT INTO server_credentials (name, host, port, username, auth_type, password, private_key, passphrase, environment, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.name, data.host, data.port || 22, data.username, data.authType || 'password',
        encryptedPassword, encryptedPrivateKey, encryptedPassphrase,
        data.environment || 'dev', data.description || null
      ])
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('serverCredential:update', async (event, id: number, data) => {
    try {
      const existing = db.get('SELECT * FROM server_credentials WHERE id=?', [id]) as any
      const encryptedPassword = data.password ? CryptoUtil.encrypt(data.password) : existing.password
      const encryptedPrivateKey = data.privateKey ? CryptoUtil.encrypt(data.privateKey) : existing.private_key
      const encryptedPassphrase = data.passphrase ? CryptoUtil.encrypt(data.passphrase) : existing.passphrase

      db.run(`
        UPDATE server_credentials
        SET name=?, host=?, port=?, username=?, auth_type=?, password=?, private_key=?, passphrase=?, environment=?, description=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.name, data.host, data.port || 22, data.username, data.authType || 'password',
        encryptedPassword, encryptedPrivateKey, encryptedPassphrase,
        data.environment || 'dev', data.description || null, id
      ])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('serverCredential:delete', async (event, id: number) => {
    try {
      db.run('DELETE FROM server_credentials WHERE id=?', [id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('serverCredential:testConnection', async (event, id: number) => {
    try {
      const credential = db.get('SELECT * FROM server_credentials WHERE id=?', [id]) as any
      const result = await sshService.testConnection(credential)
      return result
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  // ==================== SVN 凭证管理 ====================

  ipcMain.handle('svnCredential:getAll', async () => {
    try {
      const rows = db.all('svn_credentials')
      const mapped = rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        svnUrl: c.svn_url || '',
        username: c.username,
        environment: c.environment || 'dev',
        description: c.description || '',
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }))
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('svnCredential:getById', async (event, id: number) => {
    try {
      const c = db.get('SELECT * FROM svn_credentials WHERE id=?', [id]) as any
      if (!c) return { success: false, error: 'Credential not found' }
      const mapped = {
        id: c.id,
        name: c.name,
        svnUrl: c.svn_url || '',
        username: c.username,
        environment: c.environment || 'dev',
        description: c.description || '',
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('svnCredential:create', async (event, data) => {
    try {
      const encryptedPassword = CryptoUtil.encrypt(data.password)
      const result = db.run(`
        INSERT INTO svn_credentials (name, svn_url, username, password, environment, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [data.name, data.svnUrl, data.username, encryptedPassword, data.environment || 'dev', data.description || null])
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('svnCredential:update', async (event, id: number, data) => {
    try {
      const existing = db.get('SELECT * FROM svn_credentials WHERE id=?', [id]) as any
      const encryptedPassword = data.password ? CryptoUtil.encrypt(data.password) : existing.password
      db.run(`
        UPDATE svn_credentials
        SET name=?, svn_url=?, username=?, password=?, environment=?, description=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [data.name, data.svnUrl, data.username, encryptedPassword, data.environment || 'dev', data.description || null, id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('svnCredential:delete', async (event, id: number) => {
    try {
      db.run('DELETE FROM svn_credentials WHERE id=?', [id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('svnCredential:testConnection', async (event, id: number) => {
    try {
      const credential = db.get('SELECT * FROM svn_credentials WHERE id=?', [id]) as any
      const result = await svnService.testConnection(credential)
      return result
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  // ==================== Git 操作 ====================

  ipcMain.handle('git:getRepoInfo', async (event, localPath: string) => {
    try {
      const info = await gitService.getRepoInfo(localPath)
      return { success: true, data: info }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('git:getBranches', async (event, localPath: string) => {
    try {
      const branches = await gitService.getBranches(localPath)
      return { success: true, data: branches }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('git:checkout', async (event, localPath: string, branch: string) => {
    try {
      await gitService.checkoutBranch(localPath, branch)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('git:pull', async (event, localPath: string) => {
    try {
      await gitService.pull(localPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('git:getStatus', async (event, localPath: string) => {
    try {
      const status = await gitService.getStatus(localPath)
      return { success: true, data: status }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 发布操作 ====================

  ipcMain.handle('deploy:svn', async (event, config) => {
    try {
      const { project, svnCredential, svnPath, commitMessage, backupEnabled } = config
      await gitService.pull(project.localPath)
      if (config.branch) {
        await gitService.checkoutBranch(project.localPath, config.branch)
      }
      event.sender.send('deploy:progress', { stage: 'building', message: '开始构建...' })
      const buildResult = await buildService.build(project, (log: string) => {
        event.sender.send('deploy:progress', { stage: 'building', log })
      })
      if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
      const isValid = await buildService.validateOutput(project)
      if (!isValid) throw new Error('构建产物验证失败')
      if (backupEnabled) {
        event.sender.send('deploy:progress', { stage: 'backup', message: '备份 SVN 目录...' })
        await svnService.backup(svnPath, svnCredential)
      }
      event.sender.send('deploy:progress', { stage: 'uploading', message: '上传到 SVN...' })
      const outputPath = path.join(project.localPath, project.outputDir)
      await svnService.uploadDirectory(svnCredential, outputPath, svnPath, commitMessage)
      const commit = await gitService.getCurrentCommit(project.localPath)
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at) VALUES (?, 'svn', ?, ?, 'success', datetime('now','localtime'), datetime('now','localtime'))`,
        [project.id, config.branch || 'main', commit])
      event.sender.send('deploy:progress', { stage: 'completed', message: '发布成功！' })
      return { success: true }
    } catch (error: any) {
      event.sender.send('deploy:progress', { stage: 'failed', error: error.message })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:server', async (event, config) => {
    try {
      const { project, serverCredential, remotePath, backupEnabled } = config
      await gitService.pull(project.localPath)
      if (config.branch) {
        await gitService.checkoutBranch(project.localPath, config.branch)
      }
      event.sender.send('deploy:progress', { stage: 'building', message: '开始构建...' })
      const buildResult = await buildService.build(project, (log: string) => {
        event.sender.send('deploy:progress', { stage: 'building', log })
      })
      if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
      const isValid = await buildService.validateOutput(project)
      if (!isValid) throw new Error('构建产物验证失败')
      if (backupEnabled) {
        event.sender.send('deploy:progress', { stage: 'backup', message: '备份远程目录...' })
        await sshService.execCommand(serverCredential, `mv ${remotePath} ${remotePath}_backup_${Date.now()}`)
      }
      event.sender.send('deploy:progress', { stage: 'uploading', message: '上传到服务器...' })
      const outputPath = path.join(project.localPath, project.outputDir)
      await sshService.uploadDirectory(serverCredential, outputPath, remotePath, (progress: any) => {
        event.sender.send('deploy:progress', { stage: 'uploading', progress })
      })
      const commit = await gitService.getCurrentCommit(project.localPath)
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at) VALUES (?, 'server', ?, ?, 'success', datetime('now','localtime'), datetime('now','localtime'))`,
        [project.id, config.branch || 'main', commit])
      event.sender.send('deploy:progress', { stage: 'completed', message: '发布成功！' })
      return { success: true }
    } catch (error: any) {
      event.sender.send('deploy:progress', { stage: 'failed', error: error.message })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:mixed', async (event, config) => {
    try {
      const { project, targets, branch } = config
      await gitService.pull(project.localPath)
      if (branch) await gitService.checkoutBranch(project.localPath, branch)
      event.sender.send('deploy:progress', { stage: 'building', message: '开始构建...' })
      const buildResult = await buildService.build(project, (log: string) => {
        event.sender.send('deploy:progress', { stage: 'building', log })
      })
      if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
      const isValid = await buildService.validateOutput(project)
      if (!isValid) throw new Error('构建产物验证失败')
      for (const target of targets) {
        const outputPath = path.join(project.localPath, project.outputDir)
        if (target.type === 'svn') {
          event.sender.send('deploy:progress', { stage: 'uploading', message: `上传到 SVN: ${target.svnPath}` })
          await svnService.uploadDirectory(target.credential, outputPath, target.svnPath, target.commitMessage)
        } else if (target.type === 'server') {
          event.sender.send('deploy:progress', { stage: 'uploading', message: `上传到服务器: ${target.credential.host}` })
          await sshService.uploadDirectory(target.credential, outputPath, target.remotePath, (progress: any) => {
            event.sender.send('deploy:progress', { stage: 'uploading', progress })
          })
        }
      }
      const commit = await gitService.getCurrentCommit(project.localPath)
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at) VALUES (?, 'mixed', ?, ?, 'success', datetime('now','localtime'), datetime('now','localtime'))`,
        [project.id, branch || 'main', commit])
      event.sender.send('deploy:progress', { stage: 'completed', message: '混合发布成功！' })
      return { success: true }
    } catch (error: any) {
      event.sender.send('deploy:progress', { stage: 'failed', error: error.message })
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:stop', async () => {
    buildService.stopBuild()
    return { success: true }
  })

  ipcMain.handle('deploy:getHistory', async (event, projectId?: number) => {
    try {
      if (projectId) {
        const history = db.all(`
          SELECT h.*, p.name as project_name FROM deploy_history h
          LEFT JOIN projects p ON h.project_id = p.id
          WHERE h.project_id = ? ORDER BY h.created_at DESC LIMIT 50
        `, [projectId])
        return { success: true, data: history }
      } else {
        const history = db.all(`
          SELECT h.*, p.name as project_name FROM deploy_history h
          LEFT JOIN projects p ON h.project_id = p.id
          ORDER BY h.created_at DESC LIMIT 50
        `)
        return { success: true, data: history }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 发布模板 ====================

  ipcMain.handle('template:getAll', async () => {
    try {
      const templates = db.all('SELECT * FROM deploy_templates ORDER BY created_at DESC')
      return { success: true, data: templates }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('template:getById', async (event, id: number) => {
    try {
      const template = db.get('SELECT * FROM deploy_templates WHERE id=?', [id])
      return { success: true, data: template }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('template:create', async (event, data) => {
    try {
      const result = db.run(`
        INSERT INTO deploy_templates (name, project_id, deploy_type, server_credential_id, svn_credential_id, remote_path, svn_path, backup_enabled, pre_command, post_command)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.name, data.projectId, data.deployType, data.serverCredentialId, data.svnCredentialId,
        data.remotePath, data.svnPath, data.backupEnabled ? 1 : 0, data.preCommand, data.postCommand
      ])
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('template:update', async (event, id: number, data) => {
    try {
      db.run(`
        UPDATE deploy_templates SET name=?, project_id=?, deploy_type=?, server_credential_id=?, svn_credential_id=?, remote_path=?, svn_path=?, backup_enabled=?, pre_command=?, post_command=?
        WHERE id=?
      `, [
        data.name, data.projectId, data.deployType, data.serverCredentialId, data.svnCredentialId,
        data.remotePath, data.svnPath, data.backupEnabled ? 1 : 0, data.preCommand, data.postCommand, id
      ])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('template:delete', async (event, id: number) => {
    try {
      db.run('DELETE FROM deploy_templates WHERE id=?', [id])
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 配置导入导出 ====================

  ipcMain.handle('config:export', async (event, includePasswords: boolean) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '导出配置',
        defaultPath: `deploy-config-${Date.now()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.filePath) {
        const config: any = {
          version: '1.0.0',
          exportTime: new Date().toISOString(),
          projects: db.all('SELECT * FROM projects'),
          groups: db.all('SELECT * FROM groups'),
          serverCredentials: db.all('SELECT * FROM server_credentials'),
          svnCredentials: db.all('SELECT * FROM svn_credentials'),
          templates: db.all('SELECT * FROM deploy_templates')
        }
        if (!includePasswords) {
          config.serverCredentials = config.serverCredentials.map((c: any) => ({ ...c, password: undefined, private_key: undefined, passphrase: undefined }))
          config.svnCredentials = config.svnCredentials.map((c: any) => ({ ...c, password: undefined }))
        }
        await fs.writeJson(result.filePath, config, { spaces: 2 })
        return { success: true, path: result.filePath }
      }
      return { success: false, error: '取消导出' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:import', async (event, filePath: string) => {
    try {
      const config = await fs.readJson(filePath)
      for (const group of config.groups || []) {
        try { db.run('INSERT OR REPLACE INTO groups (id, name, color, sort_order) VALUES (?, ?, ?, ?)', [group.id, group.name, group.color, group.sort_order]) } catch (e) { /* skip */ }
      }
      for (const project of config.projects || []) {
        try { db.run('INSERT OR REPLACE INTO projects (id, name, local_path, git_repo, git_branch, build_command, output_dir, group_id, description) VALUES (?,?,?,?,?,?,?,?,?)',
          [project.id, project.name, project.local_path, project.git_repo, project.git_branch, project.build_command, project.output_dir, project.group_id, project.description]) } catch (e) { /* skip */ }
      }
      for (const cred of config.serverCredentials || []) {
        try { db.run('INSERT OR REPLACE INTO server_credentials (id, name, host, port, username, auth_type, password, private_key, passphrase, environment, description) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [cred.id, cred.name, cred.host, cred.port, cred.username, cred.auth_type, cred.password, cred.private_key, cred.passphrase, cred.environment, cred.description]) } catch (e) { /* skip */ }
      }
      for (const cred of config.svnCredentials || []) {
        try { db.run('INSERT OR REPLACE INTO svn_credentials (id, name, svn_url, username, password, environment, description) VALUES (?,?,?,?,?,?,?)',
          [cred.id, cred.name, cred.svn_url, cred.username, cred.password, cred.environment, cred.description]) } catch (e) { /* skip */ }
      }
      for (const tpl of config.templates || []) {
        try { db.run('INSERT OR REPLACE INTO deploy_templates (id, name, project_id, deploy_type, server_credential_id, svn_credential_id, remote_path, svn_path, backup_enabled, pre_command, post_command) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [tpl.id, tpl.name, tpl.project_id, tpl.deploy_type, tpl.server_credential_id, tpl.svn_credential_id, tpl.remote_path, tpl.svn_path, tpl.backup_enabled, tpl.pre_command, tpl.post_command]) } catch (e) { /* skip */ }
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:selectFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择项目目录',
        properties: ['openDirectory']
      })
      if (result.filePaths && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] }
      }
      return { success: false }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  console.log('IPC handlers registered successfully')
}
