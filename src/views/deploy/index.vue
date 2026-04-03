<template>
  <div class="deploy-page">
    <div class="page-header">
      <h2>快速发布</h2>
    </div>

    <el-card class="deploy-form-card">
      <el-form :model="deployConfig" label-width="120px">
        <el-form-item label="选择项目">
          <el-select
            v-model="deployConfig.projectId"
            placeholder="请选择项目"
            @change="handleProjectChange"
            style="width: 100%"
          >
            <el-option
              v-for="project in projects"
              :key="project.id"
                :label="project.name"
              :value="project.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择分支" v-if="deployConfig.projectId">
          <el-select
            v-model="deployConfig.branch"
            placeholder="请选择分支"
            style="width: 100%"
          >
            <el-option
              v-for="branch in branches"
              :key="branch"
              :label="branch"
              :value="branch"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="发布类型">
          <el-radio-group v-model="deployConfig.deployType">
            <el-radio value="svn">SVN 发布</el-radio>
            <el-radio value="server">服务器发布</el-radio>
            <el-radio value="mixed">混合发布</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- SVN 发布配置 -->
        <template v-if="deployConfig.deployType === 'svn' || deployConfig.deployType === 'mixed'">
          <el-form-item label="SVN 凭证">
            <el-select
              v-model="deployConfig.svnCredentialId"
              placeholder="请选择 SVN 凭证"
              style="width: 100%"
            >
              <el-option
                v-for="cred in svnCredentials"
                :key="cred.id"
                :label="cred.name"
                :value="cred.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="SVN 路径">
            <el-input
              v-model="deployConfig.svnPath"
              placeholder="SVN 目标路径"
            />
          </el-form-item>

          <el-form-item label="提交信息">
            <el-input
              v-model="deployConfig.commitMessage"
              type="textarea"
              :rows="3"
              placeholder="SVN 提交信息"
            />
          </el-form-item>
        </template>

        <!-- 服务器发布配置 -->
        <template v-if="deployConfig.deployType === 'server' || deployConfig.deployType === 'mixed'">
          <el-form-item label="服务器凭证">
            <el-select
              v-model="deployConfig.serverCredentialId"
              placeholder="请选择服务器凭证"
              style="width: 100%"
            >
              <el-option
                v-for="cred in serverCredentials"
                :key="cred.id"
                :label="cred.name"
                :value="cred.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="远程路径">
            <el-input
              v-model="deployConfig.remotePath"
              placeholder="/var/www/html/project"
            />
          </el-form-item>
        </template>

        <el-form-item label="备份旧版本">
          <el-switch v-model="deployConfig.backupEnabled" />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            @click="startDeploy"
            :loading="deploying"
            :disabled="!canDeploy"
          >
            开始发布
          </el-button>
          <el-button
            v-if="deploying"
            type="danger"
            size="large"
            @click="stopDeploy"
          >
            停止发布
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 发布进度 -->
    <el-card v-if="deployProgress.stage" class="progress-card">
      <template #header>
        <div class="card-header">
          <span>发布进度</span>
          <el-tag :type="getProgressType(deployProgress.stage)">
            {{ getProgressLabel(deployProgress.stage) }}
          </el-tag>
        </div>
      </template>

      <div class="progress-content">
        <el-steps
          :active="getActiveStep(deployProgress.stage)"
          align-center
        >
          <el-step title="拉取代码" />
          <el-step title="切换分支" />
          <el-step title="构建" />
          <el-step title="上传" />
          <el-step title="完成" />
        </el-steps>

        <div v-if="deployProgress.message" class="progress-message">
          {{ deployProgress.message }}
        </div>

        <div v-if="deployProgress.progress" class="upload-progress">
          <div>文件: {{ deployProgress.progress.filename }}</div>
          <el-progress
            :percentage="deployProgress.progress.percent"
            :format="() => `${deployProgress.progress.transferred} / ${deployProgress.progress.total}`"
          />
        </div>

        <div v-if="deployLogs.length" class="deploy-logs">
          <div class="logs-header">构建日志:</div>
          <div class="logs-content">
            <div v-for="(log, index) in deployLogs" :key="index" class="log-item">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'

import type { Project } from '@/types/project'

const projectStore = useProjectStore()

const projects = computed(() => projectStore.projects)
const branches = ref<string[]>([])
const serverCredentials = ref<any[]>([])
const svnCredentials = ref<any[]>([])
const deploying = ref(false)
const deployLogs = ref<string[]>([])

const deployConfig = ref({
  projectId: null as number | null,
  branch: '',
  deployType: 'svn' as 'svn' | 'server' | 'mixed',
  serverCredentialId: null as number | null,
  svnCredentialId: null as number | null,
  remotePath: '',
  svnPath: '',
  commitMessage: '自动部署 - ' + new Date().toLocaleString(),
  backupEnabled: true
})

const deployProgress = ref<any>({
  stage: '',
  message: '',
  progress: null
})

const canDeploy = computed(() => {
  if (!deployConfig.value.projectId || !deployConfig.value.branch) return false
  
  if (deployConfig.value.deployType === 'svn') {
    return deployConfig.value.svnCredentialId && deployConfig.value.svnPath
  }
  
  if (deployConfig.value.deployType === 'server') {
    return deployConfig.value.serverCredentialId && deployConfig.value.remotePath
  }
  
  if (deployConfig.value.deployType === 'mixed') {
    return deployConfig.value.svnCredentialId && 
           deployConfig.value.svnPath && 
           deployConfig.value.serverCredentialId && 
           deployConfig.value.remotePath
  }
  
  return false
})

const handleProjectChange = async () => {
  if (deployConfig.value.projectId) {
    const project = projects.value.find(p => p.id === deployConfig.value.projectId)
    if (project) {
      try {
        const result = await window.electronAPI.git.getBranches(project.localPath)
        if (result.success) {
          branches.value = result.data || []
          deployConfig.value.branch = project.gitBranch || (result.data && result.data[0]) || ''
        }
      } catch (error) {
        console.error('Failed to get branches:', error)
      }
    }
  }
}

const startDeploy = async () => {
  deploying.value = true
  deployLogs.value = []
  deployProgress.value = { stage: 'preparing', message: '准备发布...' }

  try {
    const project = projects.value.find(p => p.id === deployConfig.value.projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const plainProject = JSON.parse(JSON.stringify(project))
    let result
    
    if (deployConfig.value.deployType === 'svn') {
      const svnCred = svnCredentials.value.find(c => c.id === deployConfig.value.svnCredentialId)
      result = await window.electronAPI.deploy.svn({
        project: plainProject,
        svnCredential: svnCred ? JSON.parse(JSON.stringify(svnCred)) : null,
        svnPath: deployConfig.value.svnPath,
        commitMessage: deployConfig.value.commitMessage,
        backupEnabled: deployConfig.value.backupEnabled,
        branch: deployConfig.value.branch
      })
    } else if (deployConfig.value.deployType === 'server') {
      const serverCred = serverCredentials.value.find(c => c.id === deployConfig.value.serverCredentialId)
      result = await window.electronAPI.deploy.server({
        project: plainProject,
        serverCredential: serverCred ? JSON.parse(JSON.stringify(serverCred)) : null,
        remotePath: deployConfig.value.remotePath,
        backupEnabled: deployConfig.value.backupEnabled,
        branch: deployConfig.value.branch
      })
    } else if (deployConfig.value.deployType === 'mixed') {
      const svnCred = svnCredentials.value.find(c => c.id === deployConfig.value.svnCredentialId)
      const serverCred = serverCredentials.value.find(c => c.id === deployConfig.value.serverCredentialId)
      
      result = await window.electronAPI.deploy.mixed({
        project: plainProject,
        branch: deployConfig.value.branch,
        targets: [
          {
            type: 'svn',
            credential: svnCred ? JSON.parse(JSON.stringify(svnCred)) : null,
            svnPath: deployConfig.value.svnPath,
            commitMessage: deployConfig.value.commitMessage
          },
          {
            type: 'server',
            credential: serverCred ? JSON.parse(JSON.stringify(serverCred)) : null,
            remotePath: deployConfig.value.remotePath
          }
        ]
      })
    }

    if (result.success) {
      ElMessage.success('发布成功')
    } else {
      ElMessage.error(result.error || '发布失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '发布失败')
  } finally {
    deploying.value = false
  }
}

const stopDeploy = async () => {
  try {
    await window.electronAPI.deploy.stop()
    ElMessage.info('已停止发布')
    deploying.value = false
  } catch (error: any) {
    ElMessage.error(error.message || '停止失败')
  }
}

const getActiveStep = (stage: string) => {
  const steps: Record<string, number> = {
    preparing: 0,
    building: 2,
    uploading: 3,
    completed: 4,
    failed: 4
  }
  return steps[stage] || 0
}

const getProgressType = (stage: string) => {
  if (stage === 'completed') return 'success'
  if (stage === 'failed') return 'danger'
  if (stage === 'building') return 'warning'
  return 'info'
}

const getProgressLabel = (stage: string) => {
  const labels: Record<string, string> = {
    preparing: '准备中',
    building: '构建中',
    uploading: '上传中',
    completed: '已完成',
    failed: '失败'
  }
  return labels[stage] || stage
}

// 监听发布进度
const handleProgress = (progress: any) => {
  deployProgress.value = progress
  
  if (progress.log) {
    deployLogs.value.push(progress.log)
  }
}

onMounted(async () => {
  await projectStore.fetchProjects()
  
  const [serverResult, svnResult] = await Promise.all([
    window.electronAPI.serverCredential.getAll(),
    window.electronAPI.svnCredential.getAll()
  ])
  
  if (serverResult && serverResult.success) {
    serverCredentials.value = serverResult.data || []
  }

  if (svnResult && svnResult.success) {
    svnCredentials.value = svnResult.data || []
  }
  
  window.electronAPI.deploy.onProgress(handleProgress)
})

onUnmounted(() => {
  // 清理监听器
})
</script>

<style scoped lang="scss">
.deploy-page {
  .page-header {
    margin-bottom: 20px;
    
    h2 {
      margin: 0;
      font-size: 24px;
    }
  }

  .deploy-form-card {
    margin-bottom: 20px;
  }

  .progress-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .progress-content {
      .progress-message {
        margin-top: 20px;
        padding: 10px;
        background: #f5f7fa;
        border-radius: 4px;
      }

      .upload-progress {
        margin-top: 20px;
      }

      .deploy-logs {
        margin-top: 20px;
        
        .logs-header {
          font-weight: bold;
          margin-bottom: 10px;
        }

        .logs-content {
          max-height: 300px;
          overflow-y: auto;
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 12px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;

          .log-item {
            margin-bottom: 2px;
          }
        }
      }
    }
  }
}
</style>
