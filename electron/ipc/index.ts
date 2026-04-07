import { ipcMain, dialog, app, shell } from 'electron'
import { join } from 'path'
import { DatabaseManager } from '../database'
import { GitService } from '../services/git.service'
import { SSHService } from '../services/ssh.service'
import { SVNService } from '../services/svn.service'
import { BuildService } from '../services/build.service'
import { NodeVersionService } from '../services/node-version.service'
import { CryptoUtil } from '../utils/crypto'
import * as fs from 'fs-extra'
import * as path from 'path'

export function registerIpcHandlers(database: DatabaseManager) {
  const db = database
  const gitService = new GitService()
  const sshService = new SSHService()
  const svnService = new SVNService()
  const buildService = new BuildService()
  const nodeVersionService = new NodeVersionService()

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
          nodeVersion: p.node_version || '',
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
        nodeVersion: p.node_version || '',
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
        INSERT INTO projects (name, local_path, git_repo, git_branch, build_command, output_dir, group_id, description, node_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.name, data.localPath, data.gitRepo || null, data.gitBranch || 'main',
        data.buildCommand || 'npm run build', data.outputDir || 'dist',
        data.groupId || null, data.description || null, data.nodeVersion || null
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
        SET name=?, local_path=?, git_repo=?, git_branch=?, build_command=?, output_dir=?, group_id=?, description=?, node_version=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `, [
        data.name, data.localPath, data.gitRepo || null, data.gitBranch || 'main',
        data.buildCommand || 'npm run build', data.outputDir || 'dist',
        data.groupId || null, data.description || null, data.nodeVersion || null, id
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
      const rows = db.all('groups')
      const mapped = rows.map((g: any) => ({
        id: g.id,
        name: g.name,
        color: g.color || '#409EFF',
        sortOrder: g.sort_order || 0,
        createdAt: g.created_at,
        updatedAt: g.updated_at
      }))
      return { success: true, data: mapped }
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
      const c = db.get('SELECT * FROM server_credentials WHERE id=?', [id]) as any
      if (!c) return { success: false, message: '凭证不存在' }
      const credential = {
        host: c.host,
        port: c.port,
        username: c.username,
        authType: c.auth_type || 'password',
        password: c.password || '',
        privateKey: c.private_key || '',
        passphrase: c.passphrase || ''
      }
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
      const c = db.get('SELECT * FROM svn_credentials WHERE id=?', [id]) as any
      if (!c) return { success: false, message: '凭证不存在' }
      const credential = {
        svnUrl: c.svn_url || '',
        username: c.username,
        password: c.password || ''
      }
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
    sshService.resetAbort()
    svnService.resetAbort()
    const logs: string[] = []
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
      event.sender.send('deploy:progress', { stage: 'building', log: msg })
    }
    try {
      const { project, svnPath, commitMessage, backupEnabled, needBuild = true, branch } = config
      const svnCredential = config.svnCredential
      if (svnCredential && svnCredential.id) {
        const c = db.get('SELECT * FROM svn_credentials WHERE id=?', [svnCredential.id]) as any
        if (c) {
          Object.assign(svnCredential, {
            svnUrl: c.svn_url || '',
            password: c.password || ''
          })
        }
      }

      log('开始拉取代码...')
      await gitService.pull(project.localPath)
      log('代码拉取完成')
      if (branch) {
        log(`切换到分支: ${branch}`)
        await gitService.checkoutBranch(project.localPath, branch)
      }
      if (needBuild) {
        log('开始构建...')
        const buildResult = await buildService.build(project, (l: string) => {
          logs.push(l)
          event.sender.send('deploy:progress', { stage: 'building', log: l })
        })
        if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
        const isValid = await buildService.validateOutput(project)
        if (!isValid) throw new Error('构建产物验证失败')
        log('构建完成')
      } else {
        log('跳过构建，使用已有产物')
      }
      if (backupEnabled) {
        log('备份 SVN 目录...')
        const backupResult = await svnService.backup(svnPath, svnCredential)
        log(`备份完成: ${backupResult}`)
      }
      log(`上传到 SVN: ${svnPath}`)
      const outputPath = path.join(project.localPath, project.outputDir)
      await svnService.uploadDirectory(svnCredential, outputPath, svnPath, commitMessage)
      log('SVN 上传完成')
      const commit = await gitService.getCurrentCommit(project.localPath)
      const now = new Date().toLocaleString('sv-SE')
      const historyLog = logs.join('\n')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, 'svn', branch || 'main', commit, 'success', now, now, historyLog])
      event.sender.send('deploy:progress', { stage: 'completed', message: 'SVN 发布成功！' })
      return { success: true }
    } catch (error: any) {
      const isCancelled = error.message === '发布已取消'
      logs.push(`[${new Date().toLocaleTimeString()}] ${isCancelled ? '发布已取消' : '错误: ' + error.message}`)
      event.sender.send('deploy:progress', {
        stage: isCancelled ? 'cancelled' : 'failed',
        message: isCancelled ? '发布已取消' : undefined,
        error: isCancelled ? undefined : error.message
      })
      const commit = await gitService.getCurrentCommit(config.project.localPath).catch(() => 'unknown')
      const now = new Date().toLocaleString('sv-SE')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [config.project.id, 'svn', config.branch || 'main', commit, isCancelled ? 'cancelled' : 'failed', now, now, logs.join('\n')])
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:server', async (event, config) => {
    sshService.resetAbort()
    svnService.resetAbort()
    const logs: string[] = []
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
      event.sender.send('deploy:progress', { stage: 'building', log: msg })
    }
    try {
      const { project, remotePath, backupEnabled, needBuild = true } = config
      const serverCredential = config.serverCredential
      if (serverCredential && serverCredential.id) {
        const c = db.get('SELECT * FROM server_credentials WHERE id=?', [serverCredential.id]) as any
        if (c) {
          Object.assign(serverCredential, {
            authType: c.auth_type || 'password',
            password: c.password || '',
            privateKey: c.private_key || '',
            passphrase: c.passphrase || ''
          })
        }
      }
      log('开始拉取代码...')
      await gitService.pull(project.localPath)
      log('代码拉取完成')
      if (config.branch) {
        log(`切换到分支: ${config.branch}`)
        await gitService.checkoutBranch(project.localPath, config.branch)
      }
      if (needBuild) {
        log('开始构建...')
        const buildResult = await buildService.build(project, (l: string) => {
          logs.push(l)
          event.sender.send('deploy:progress', { stage: 'building', log: l })
        })
        if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
        const isValid = await buildService.validateOutput(project)
        if (!isValid) throw new Error('构建产物验证失败')
        log('构建完成')
      } else {
        log('跳过构建，使用已有产物')
      }
      if (backupEnabled) {
        log('备份远程目录...')
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const backupTs = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
        await sshService.execCommand(serverCredential, `mv ${remotePath} ${remotePath}_backup_${backupTs}`)
        log('备份完成')
      }
      log(`压缩并上传到服务器: ${serverCredential.host}:${remotePath}`)
      const outputPath = path.join(project.localPath, project.outputDir)
      await sshService.uploadDirectoryCompressed(serverCredential, outputPath, remotePath, (progress: any) => {
        event.sender.send('deploy:progress', { stage: 'uploading', progress })
      })
      log('上传完成')
      const commit = await gitService.getCurrentCommit(project.localPath)
      const now = new Date().toLocaleString('sv-SE')
      const historyLog = logs.join('\n')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, 'server', config.branch || 'main', commit, 'success', now, now, historyLog])
      event.sender.send('deploy:progress', { stage: 'completed', message: '发布成功！' })
      return { success: true }
    } catch (error: any) {
      const isCancelled = error.message === '发布已取消'
      logs.push(`[${new Date().toLocaleTimeString()}] ${isCancelled ? '发布已取消' : '错误: ' + error.message}`)
      event.sender.send('deploy:progress', {
        stage: isCancelled ? 'cancelled' : 'failed',
        message: isCancelled ? '发布已取消' : undefined,
        error: isCancelled ? undefined : error.message
      })
      const commit = await gitService.getCurrentCommit(config.project.localPath).catch(() => 'unknown')
      const now = new Date().toLocaleString('sv-SE')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [config.project.id, 'server', config.branch || 'main', commit, isCancelled ? 'cancelled' : 'failed', now, now, logs.join('\n')])
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:mixed', async (event, config) => {
    sshService.resetAbort()
    svnService.resetAbort()
    const logs: string[] = []
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
      event.sender.send('deploy:progress', { stage: 'building', log: msg })
    }
    try {
      const { project, targets, branch, needBuild = true } = config
      log('加载凭证信息...')
      for (const target of targets) {
        if (target.type === 'server' && target.credential && target.credential.id) {
          const c = db.get('SELECT * FROM server_credentials WHERE id=?', [target.credential.id]) as any
          if (c) {
            Object.assign(target.credential, {
              authType: c.auth_type || 'password',
              password: c.password || '',
              privateKey: c.private_key || '',
              passphrase: c.passphrase || ''
            })
          }
        }
        if (target.type === 'svn' && target.credential && target.credential.id) {
          const c = db.get('SELECT * FROM svn_credentials WHERE id=?', [target.credential.id]) as any
          if (c) {
            Object.assign(target.credential, {
              svnUrl: c.svn_url || '',
              password: c.password || ''
            })
          }
        }
      }
      log('开始拉取代码...')
      await gitService.pull(project.localPath)
      log('代码拉取完成')
      if (branch) {
        log(`切换到分支: ${branch}`)
        await gitService.checkoutBranch(project.localPath, branch)
      }
      if (needBuild) {
        log('开始构建...')
        const buildResult = await buildService.build(project, (l: string) => {
          logs.push(l)
          event.sender.send('deploy:progress', { stage: 'building', log: l })
        })
        if (!buildResult.success) throw new Error(buildResult.error || '构建失败')
        const isValid = await buildService.validateOutput(project)
        if (!isValid) throw new Error('构建产物验证失败')
        log('构建完成')
      } else {
        log('跳过构建，使用已有产物')
      }
      for (const target of targets) {
        const outputPath = path.join(project.localPath, project.outputDir)
        if (target.type === 'svn') {
          log(`上传到 SVN: ${target.svnPath}`)
          await svnService.uploadDirectory(target.credential, outputPath, target.svnPath, target.commitMessage)
          log('SVN 上传完成')
        } else if (target.type === 'server') {
          log(`压缩并上传到服务器: ${target.credential.host}:${target.remotePath}`)
          await sshService.uploadDirectoryCompressed(target.credential, outputPath, target.remotePath, (progress: any) => {
            event.sender.send('deploy:progress', { stage: 'uploading', progress })
          })
          log('服务器上传完成')
        }
      }
      const commit = await gitService.getCurrentCommit(project.localPath)
      const now = new Date().toLocaleString('sv-SE')
      const historyLog = logs.join('\n')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, 'mixed', branch || 'main', commit, 'success', now, now, historyLog])
      event.sender.send('deploy:progress', { stage: 'completed', message: '混合发布成功！' })
      return { success: true }
    } catch (error: any) {
      const isCancelled = error.message === '发布已取消'
      logs.push(`[${new Date().toLocaleTimeString()}] ${isCancelled ? '发布已取消' : '错误: ' + error.message}`)
      event.sender.send('deploy:progress', {
        stage: isCancelled ? 'cancelled' : 'failed',
        message: isCancelled ? '发布已取消' : undefined,
        error: isCancelled ? undefined : error.message
      })
      const commit = await gitService.getCurrentCommit(config.project.localPath).catch(() => 'unknown')
      const now = new Date().toLocaleString('sv-SE')
      db.run(`INSERT INTO deploy_history (project_id, deploy_type, git_branch, git_commit, status, started_at, finished_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [config.project.id, 'mixed', config.branch || 'main', commit, isCancelled ? 'cancelled' : 'failed', now, now, logs.join('\n')])
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:stop', async () => {
    buildService.stopBuild()
    sshService.abort()
    svnService.abort()
    return { success: true }
  })

  ipcMain.handle('node:checkVersion', async (event, expectedVersion: string) => {
    try {
      const result = await nodeVersionService.checkVersion(expectedVersion)
      return { success: true, data: result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('node:switchVersion', async (event, version: string) => {
    try {
      await nodeVersionService.switchVersion(version)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('node:installVersion', async (event, version: string) => {
    try {
      await nodeVersionService.installVersion(version)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('deploy:getHistory', async (event, projectId?: number) => {
    try {
      let rows = db.all('deploy_history') as any[]
      if (projectId) {
        rows = rows.filter((h: any) => h.project_id === projectId)
      }
      const projects = db.all('projects') as any[]
      const projectMap = new Map(projects.map((p: any) => [p.id, p.name]))
      const mapped = rows.map((h: any) => ({
        id: h.id,
        projectId: h.project_id,
        projectName: projectMap.get(h.project_id) || '',
        deployType: h.deploy_type,
        gitBranch: h.git_branch,
        gitCommit: h.git_commit,
        status: h.status,
        startedAt: h.started_at,
        finishedAt: h.finished_at,
        log: h.log || '',
        createdAt: h.created_at,
        updatedAt: h.updated_at
      }))
      mapped.sort((a: any, b: any) => b.id - a.id)
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 发布模板 ====================

  ipcMain.handle('template:getAll', async () => {
    try {
      const rows = db.all('deploy_templates')
      const projects = db.all('projects') as any[]
      const projectMap = new Map(projects.map((p: any) => [p.id, p.name]))
      const mapped = rows.map((t: any) => ({
        id: t.id,
        name: t.name,
        projectId: t.project_id,
        projectName: projectMap.get(t.project_id) || '',
        deployType: t.deploy_type,
        serverCredentialId: t.server_credential_id,
        svnCredentialId: t.svn_credential_id,
        remotePath: t.remote_path || '',
        svnPath: t.svn_path || '',
        backupEnabled: t.backup_enabled === 1,
        preCommand: t.pre_command || '',
        postCommand: t.post_command || '',
        description: t.description || '',
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
      mapped.sort((a: any, b: any) => b.id - a.id)
      return { success: true, data: mapped }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('template:getById', async (event, id: number) => {
    try {
      const t = db.get('SELECT * FROM deploy_templates WHERE id=?', [id]) as any
      if (!t) return { success: false, error: 'Template not found' }
      const projects = db.all('projects') as any[]
      const projectMap = new Map(projects.map((p: any) => [p.id, p.name]))
      const mapped = {
        id: t.id,
        name: t.name,
        projectId: t.project_id,
        projectName: projectMap.get(t.project_id) || '',
        deployType: t.deploy_type,
        serverCredentialId: t.server_credential_id,
        svnCredentialId: t.svn_credential_id,
        remotePath: t.remote_path || '',
        svnPath: t.svn_path || '',
        backupEnabled: t.backup_enabled === 1,
        preCommand: t.pre_command || '',
        postCommand: t.post_command || '',
        description: t.description || '',
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }
      return { success: true, data: mapped }
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

  ipcMain.handle('config:selectJsonFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择配置文件',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.filePaths && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] }
      }
      return { success: false }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:getDbPath', async () => {
    return { success: true, path: join(app.getPath('userData'), 'deploy-manager.json') }
  })

  ipcMain.handle('config:clearAll', async () => {
    try {
      const schema: Record<string, any[]> = {
        groups: [],
        projects: [],
        serverCredentials: [],
        svnCredentials: [],
        deployTemplates: [],
        deployHistory: []
      }
      ;(db as any).data = schema
      ;(db as any).save()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('config:openDataDir', async () => {
    try {
      const { shell } = await import('electron')
      await shell.openPath(app.getPath('userData'))
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  console.log('IPC handlers registered successfully')
}
