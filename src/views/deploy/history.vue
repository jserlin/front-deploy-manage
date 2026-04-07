<template>
  <div class="history-page">
    <div class="page-header">
      <h2>发布历史</h2>
      <el-button @click="fetchHistory">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-table :data="historyList" v-loading="loading" border stripe>
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

    <!-- 日志对话框 -->
    <el-dialog
      v-model="logDialogVisible"
      title="发布日志"
      width="800px"
    >
      <div class="log-content">
        <pre>{{ currentLog }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const loading = ref(false)
const historyList = ref<any[]>([])
const logDialogVisible = ref(false)
const currentLog = ref('')

const fetchHistory = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.deploy.getHistory()
    if (result.success) {
      historyList.value = result.data || []
      console.log(`既然手边有树叶 ~ fetchHistory ~ historyList:`, historyList)
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
  currentLog.value = row.log || '无日志'
  logDialogVisible.value = true
}

onMounted(() => {
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
  }

  .log-content {
    max-height: 500px;
    overflow-y: auto;
    background: #f5f7fa;
    padding: 16px;
    border-radius: 4px;
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
    }
  }
}
</style>
