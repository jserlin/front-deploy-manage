<template>
  <div class="history-page">
    <div class="page-header">
      <h2>发布历史</h2>
      <div class="header-actions">
        <el-select
          v-model="filterProjectId"
          placeholder="全部项目"
          clearable
          filterable
          style="width: 200px; margin-right: 12px"
        >
          <el-option
            v-for="project in projects"
            :key="project.id"
            :label="project.name"
            :value="project.id"
          />
        </el-select>
        <el-button @click="fetchHistory">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <el-table :data="filteredList" v-loading="loading" border stripe>
      <el-table-column prop="projectName" label="项目名称" width="180" />
      <el-table-column prop="deployType" label="发布类型" width="120">
        <template #default="{ row }">
          <el-tag>{{ getDeployTypeLabel(row.deployType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="gitBranch" label="分支" width="120" />
      <el-table-column prop="gitCommit" label="Commit" width="100">
        <template #default="{ row }">
          <span v-if="row.gitCommit" :title="row.gitCommit">
            {{ row.gitCommit.substring(0, 8) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="startedAt" label="开始时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.startedAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="finishedAt" label="完成时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.finishedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="viewLog(row)">查看日志</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="logDialogVisible"
      :title="`发布日志 - ${currentLogProjectName}`"
      width="900px"
      top="5vh"
    >
      <div class="log-header">
        <div class="log-info">
          <span class="log-info-item">
            <el-tag size="small" :type="getStatusType(currentLogStatus)">
              {{ getStatusLabel(currentLogStatus) }}
            </el-tag>
          </span>
          <span class="log-info-item" v-if="currentLogBranch">
            <el-icon><Folder /></el-icon>
            分支: {{ currentLogBranch }}
          </span>
          <span class="log-info-item" v-if="currentLogCommit">
            <el-icon><Document /></el-icon>
            Commit: {{ currentLogCommit }}
          </span>
          <span class="log-info-item" v-if="currentLogTime">
            <el-icon><Clock /></el-icon>
            {{ currentLogTime }}
          </span>
        </div>
        <el-button size="small" @click="copyLog" :disabled="!currentLog">
          <el-icon><CopyDocument /></el-icon>
          复制日志
        </el-button>
      </div>
      <div class="log-content" :class="{ 'log-empty': !currentLog }">
        <pre v-if="currentLog">{{ currentLog }}</pre>
        <el-empty v-else description="暂无日志记录" :image-size="80" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Folder, Document, Clock, CopyDocument } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const projects = computed(() => projectStore.projects)

const loading = ref(false)
const historyList = ref<any[]>([])
const logDialogVisible = ref(false)
const currentLog = ref('')
const filterProjectId = ref<number | null>(null)
const currentLogProjectName = ref('')
const currentLogStatus = ref('')
const currentLogBranch = ref('')
const currentLogCommit = ref('')
const currentLogTime = ref('')

const filteredList = computed(() => {
  let list = historyList.value
  if (filterProjectId.value) {
    list = list.filter((item: any) => item.projectId === filterProjectId.value)
  }
  return list
})

const fetchHistory = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.deploy.getHistory()
    if (result.success) {
      historyList.value = result.data || []
    } else {
      ElMessage.error(result.error || '获取历史失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取历史失败')
  } finally {
    loading.value = false
  }
}

const getDeployTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    svn: 'SVN',
    server: '服务器',
    mixed: '混合'
  }
  return labels[type] || type
}

const getStatusType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'info',
    building: 'warning',
    uploading: 'warning',
    success: 'success',
    failed: 'danger',
    cancelled: 'warning'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: '等待中',
    building: '构建中',
    uploading: '上传中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消'
  }
  return labels[status] || status
}

const formatTime = (time: string) => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const viewLog = (row: any) => {
  currentLog.value = row.log || ''
  currentLogProjectName.value = row.projectName || ''
  currentLogStatus.value = row.status || ''
  currentLogBranch.value = row.gitBranch || ''
  currentLogCommit.value = row.gitCommit ? row.gitCommit.substring(0, 8) : ''
  currentLogTime.value = row.startedAt ? formatTime(row.startedAt) : ''
  logDialogVisible.value = true
}

const copyLog = async () => {
  if (!currentLog.value) return
  try {
    await navigator.clipboard.writeText(currentLog.value)
    ElMessage.success('日志已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

onMounted(async () => {
  await projectStore.fetchProjects()
  fetchHistory()
})
</script>

<style scoped lang="scss">
.history-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    h2 {
      margin: 0;
      font-size: 24px;
    }

    .header-actions {
      display: flex;
      align-items: center;
    }
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 12px;

    .log-info {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;

      .log-info-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #606266;

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }

  .log-content {
    max-height: 500px;
    overflow-y: auto;
    background: #1e1e1e;
    padding: 16px;
    border-radius: 4px;
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }

    &.log-empty {
      background: #fff;
      padding: 40px 16px;
    }
  }
}
</style>
