<template>
  <div class="settings-page">
    <div class="page-header">
      <h2>设置</h2>
    </div>

    <el-card class="settings-card">
      <template #header>
        <span>配置管理</span>
      </template>

      <div class="settings-section">
        <h3>导出配置</h3>
        <p class="description">将所有项目、凭证、模板配置导出为 JSON 文件</p>
        <div class="option-group">
          <el-checkbox v-model="exportIncludePasswords">包含密码信息</el-checkbox>
          <el-button type="primary" @click="exportConfig" :loading="exporting">
            <el-icon><Download /></el-icon>
            导出配置
          </el-button>
        </div>
      </div>

      <el-divider />

      <div class="settings-section">
        <h3>导入配置</h3>
        <p class="description">从 JSON 文件导入配置（将覆盖现有数据）</p>
        <el-button type="warning" @click="importConfig" :loading="importing">
          <el-icon><Upload /></el-icon>
          导入配置
        </el-button>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <span>数据管理</span>
      </template>

      <div class="settings-section">
        <h3>数据库位置</h3>
        <p class="info-text">{{ dbPath }}</p>
        <el-button @click="openDataDirectory">
          <el-icon><FolderOpened /></el-icon>
          打开数据目录
        </el-button>
      </div>

      <el-divider />

      <div class="settings-section">
        <h3>清除数据</h3>
        <p class="description warning">危险操作：清除所有项目、凭证和发布历史</p>
        <el-button type="danger" @click="clearAllData">
          <el-icon><Delete /></el-icon>
          清除所有数据
        </el-button>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <span>关于</span>
      </template>

      <div class="about-section">
        <h3>Frontend Deploy Manager</h3>
        <p>版本: 1.0.0</p>
        <p>前端项目构建与部署管理工具</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const exportIncludePasswords = ref(false)
const exporting = ref(false)
const importing = ref(false)
const dbPath = ref('')

const loadDbPath = async () => {
  try {
    const result = await window.electronAPI.config.getDbPath()
    if (result.success) {
      dbPath.value = result.path
    }
  } catch (error) {
    console.error('Failed to get db path:', error)
  }
}

const exportConfig = async () => {
  if (exportIncludePasswords.value) {
    try {
      await ElMessageBox.confirm(
        '导出将包含加密的密码信息，请妥善保管导出文件。确定继续吗？',
        '安全提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
  }

  exporting.value = true
  try {
    const result = await window.electronAPI.config.export(exportIncludePasswords.value)
    if (result.success) {
      ElMessage.success(`配置已导出到: ${result.path}`)
    } else {
      ElMessage.error(result.error || '导出失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

const importConfig = async () => {
  try {
    await ElMessageBox.confirm(
      '导入配置将覆盖现有数据，确定继续吗？',
      '确认导入',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    importing.value = true
    
    // 选择文件
    const fileResult = await window.electronAPI.config.selectJsonFile()
    if (!fileResult.success || !fileResult.path) {
      importing.value = false
      return
    }

    // 导入配置
    const result = await window.electronAPI.config.import(fileResult.path)
    if (result.success) {
      ElMessage.success('配置导入成功')
      location.reload()
    } else {
      ElMessage.error(result.error || '导入失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '导入失败')
    }
  } finally {
    importing.value = false
  }
}

const openDataDirectory = async () => {
  try {
    await window.electronAPI.config.openDataDir()
  } catch (error: any) {
    ElMessage.error(error.message || '打开目录失败')
  }
}

const clearAllData = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有数据吗？此操作不可恢复！',
      '危险操作',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    const result = await window.electronAPI.config.clearAll()
    if (result.success) {
      ElMessage.success('数据已清除')
    } else {
      ElMessage.error(result.error || '清除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '清除失败')
    }
  }
}

onMounted(() => {
  loadDbPath()
})
</script>

<style scoped lang="scss">
.settings-page {
  .page-header {
    margin-bottom: 20px;
    
    h2 {
      margin: 0;
      font-size: 24px;
    }
  }

  .settings-card {
    margin-bottom: 20px;
  }

  .settings-section {
    h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: 600;
    }

    .description {
      color: #666;
      margin-bottom: 16px;
      font-size: 14px;

      &.warning {
        color: #f56c6c;
      }
    }

    .info-text {
      color: #409eff;
      margin-bottom: 12px;
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }

    .option-group {
      display: flex;
      align-items: center;
      gap: 16px;
    }
  }

  .about-section {
    text-align: center;
    padding: 20px 0;

    h3 {
      margin: 0 0 10px 0;
      font-size: 20px;
    }

    p {
      color: #666;
      margin: 5px 0;
    }
  }
}
</style>
