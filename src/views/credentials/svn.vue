<template>
  <div class="credentials-page">
    <div class="page-header">
      <h2>SVN 凭证管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加凭证
      </el-button>
    </div>

    <div class="filter-bar">
      <el-select v-model="selectedEnv" placeholder="环境筛选" clearable filterable style="width: 150px">
        <el-option label="开发" value="dev" />
        <el-option label="测试" value="test" />
        <el-option label="生产" value="prod" />
      </el-select>
    </div>

    <el-table :data="filteredCredentials" v-loading="loading" border stripe>
      <el-table-column prop="name" label="名称" width="180" />
      <el-table-column prop="svnUrl" label="SVN 地址" />
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="environment" label="环境" width="100">
        <template #default="{ row }">
          <el-tag :type="getEnvType(row.environment)">
            {{ getEnvLabel(row.environment) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="testConnection(row)" :loading="row.testing">
            测试连接
          </el-button>
          <el-button size="small" @click="editCredential(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteCredential(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑凭证' : '添加凭证'"
      width="600px"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="凭证名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入凭证名称" />
        </el-form-item>
        
        <el-form-item label="SVN 地址" prop="svnUrl">
          <el-input v-model="formData.svnUrl" placeholder="https://svn.example.com/repo" />
        </el-form-item>

        <el-form-item label="用户名" prop="username">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>

        <el-form-item label="环境" prop="environment">
          <el-select v-model="formData.environment" placeholder="请选择环境" filterable>
            <el-option label="开发" value="dev" />
            <el-option label="测试" value="test" />
            <el-option label="生产" value="prod" />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="凭证描述"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { SvnCredential } from '@/types/credential'

const loading = ref(false)
const credentials = ref<any[]>([])
const selectedEnv = ref<string>('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()

const formData = ref({
  name: '',
  svnUrl: '',
  username: '',
  password: '',
  environment: 'dev',
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入凭证名称', trigger: 'blur' }],
  svnUrl: [{ required: true, message: '请输入 SVN 地址', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  environment: [{ required: true, message: '请选择环境', trigger: 'change' }]
}

const filteredCredentials = computed(() => {
  if (!selectedEnv.value) return credentials.value
  return credentials.value.filter(c => c.environment === selectedEnv.value)
})

const getEnvType = (env: string) => {
  const types: Record<string, any> = {
    dev: 'success',
    test: 'warning',
    prod: 'danger'
  }
  return types[env] || 'info'
}

const getEnvLabel = (env: string) => {
  const labels: Record<string, string> = {
    dev: '开发',
    test: '测试',
    prod: '生产'
  }
  return labels[env] || env
}

const fetchCredentials = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.svnCredential.getAll()
    if (result.success) {
      credentials.value = (result.data || []).map((c: any) => ({ ...c, testing: false }))
    }
  } catch (error) {
    console.error('Failed to fetch SVN credentials:', error)
  } finally {
    loading.value = false
  }
}

const showAddDialog = () => {
  isEdit.value = false
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const editCredential = (credential: SvnCredential) => {
  isEdit.value = true
  editingId.value = credential.id
  formData.value = {
    name: credential.name,
    svnUrl: credential.svnUrl,
    username: credential.username,
    password: '', // 不显示密码
    environment: credential.environment,
    description: credential.description || ''
  }
  dialogVisible.value = true
}

const deleteCredential = async (credential: SvnCredential) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除凭证 "${credential.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const result = await window.electronAPI.svnCredential.delete(credential.id)
    if (result.success) {
      ElMessage.success('删除成功')
      await fetchCredentials()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const testConnection = async (credential: any) => {
  credential.testing = true
  try {
    const result = await window.electronAPI.svnCredential.testConnection(credential.id)
    if (result.success) {
      ElMessage.success('连接成功')
    } else {
      ElMessage.error(result.message || '连接失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '连接测试失败')
  } finally {
    credential.testing = false
  }
}

const submitForm = async () => {
  try {
    await formRef.value.validate()
    
    const data = JSON.parse(JSON.stringify(formData.value))
    let result
    if (isEdit.value && editingId.value) {
      result = await window.electronAPI.svnCredential.update(editingId.value, data)
    } else {
      result = await window.electronAPI.svnCredential.create(data)
    }
    
    if (result.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '添加成功')
      dialogVisible.value = false
      resetForm()
      await fetchCredentials()
    } else {
      ElMessage.error(result.error || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const resetForm = () => {
  formData.value = {
    name: '',
    svnUrl: '',
    username: '',
    password: '',
    environment: 'dev',
    description: ''
  }
}

onMounted(() => {
  fetchCredentials()
})
</script>

<style scoped lang="scss">
.credentials-page {
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

  .filter-bar {
    margin-bottom: 20px;
  }
}
</style>
