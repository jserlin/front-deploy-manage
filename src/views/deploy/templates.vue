<template>
  <div class="templates-page">
    <div class="page-header">
      <h2>发布模板</h2>
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
        <el-button type="primary" @click="showAddDialog">
          <el-icon><Plus /></el-icon>
          创建模板
        </el-button>
      </div>
    </div>

    <el-table :data="filteredList" v-loading="loading" border stripe>
      <el-table-column prop="name" label="模板名称" width="180" />
      <el-table-column prop="projectName" label="项目" width="150" />
      <el-table-column prop="deployType" label="发布类型" width="120">
        <template #default="{ row }">
          <el-tag>{{ getDeployTypeLabel(row.deployType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="useTemplate(row)">使用</el-button>
          <el-button size="small" @click="editTemplate(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteTemplate(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模板' : '创建模板'"
      width="700px"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入模板名称" />
        </el-form-item>

        <el-form-item label="关联项目" prop="projectId">
          <el-select v-model="formData.projectId" placeholder="请选择项目" filterable style="width: 100%">
            <el-option
              v-for="project in projects"
              :key="project.id"
              :label="project.name"
              :value="project.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="发布类型" prop="deployType">
          <el-radio-group v-model="formData.deployType">
            <el-radio value="svn">SVN 发布</el-radio>
            <el-radio value="server">服务器发布</el-radio>
            <el-radio value="mixed">混合发布</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="formData.deployType === 'svn' || formData.deployType === 'mixed'">
          <el-form-item label="SVN 凭证">
            <el-select v-model="formData.svnCredentialId" placeholder="请选择 SVN 凭证" filterable style="width: 100%">
              <el-option
                v-for="cred in svnCredentials"
                :key="cred.id"
                :label="cred.name"
                :value="cred.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="SVN 路径">
            <el-input v-model="formData.svnPath" placeholder="SVN 目标路径" />
          </el-form-item>
          <el-form-item label="提交信息">
            <el-input v-model="formData.commitMessage" type="textarea" :rows="3" placeholder="SVN 提交信息" />
          </el-form-item>
        </template>

        <template v-if="formData.deployType === 'server' || formData.deployType === 'mixed'">
          <el-form-item label="服务器凭证">
            <el-select v-model="formData.serverCredentialId" placeholder="请选择服务器凭证" filterable style="width: 100%">
              <el-option
                v-for="cred in serverCredentials"
                :key="cred.id"
                :label="cred.name"
                :value="cred.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="远程路径">
            <el-input v-model="formData.remotePath" placeholder="/var/www/html/project" />
          </el-form-item>
        </template>

        <el-form-item label="备份旧版本">
          <el-switch v-model="formData.backupEnabled" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="模板描述" />
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

const loading = ref(false)
const templates = ref<any[]>([])
const projects = computed(() => projectStore.projects)
const serverCredentials = ref<any[]>([])
const svnCredentials = ref<any[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()
const filterProjectId = ref<number | null>(null)

const filteredList = computed(() => {
  let list = templates.value
  if (filterProjectId.value) {
    list = list.filter((item: any) => item.projectId === filterProjectId.value)
  }
  return list
})

const formData = ref({
  name: '',
  projectId: null as number | null,
  deployType: 'svn' as 'svn' | 'server' | 'mixed',
  svnCredentialId: null as number | null,
  svnPath: '',
  serverCredentialId: null as number | null,
  remotePath: '',
  commitMessage: '',
  backupEnabled: true,
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  deployType: [{ required: true, message: '请选择发布类型', trigger: 'change' }]
}

const getDeployTypeLabel = (type: string) => {
  const labels: Record<string, string> = { svn: 'SVN', server: '服务器', mixed: '混合' }
  return labels[type] || type
}

const fetchTemplates = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.template.getAll()
    if (result.success) {
      templates.value = (result.data || [])
    } else {
      ElMessage.error(result.error || '获取模板失败')
    }
  } finally {
    loading.value = false
  }
}

const fetchCredentials = async () => {
  try {
    const [serverResult, svnResult] = await Promise.all([
      window.electronAPI.serverCredential.getAll(),
      window.electronAPI.svnCredential.getAll()
    ])
    if (serverResult && serverResult.success) serverCredentials.value = serverResult.data || []
    if (svnResult && svnResult.success) svnCredentials.value = svnResult.data || []
  } catch (error) {
    console.error('Failed to fetch credentials:', error)
  }
}

const showAddDialog = () => {
  isEdit.value = false
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const editTemplate = (template: any) => {
  isEdit.value = true
  editingId.value = template.id
  formData.value = {
    name: template.name,
    projectId: template.projectId,
    deployType: template.deployType,
    svnCredentialId: template.svnCredentialId,
    svnPath: template.svnPath || '',
    serverCredentialId: template.serverCredentialId,
    remotePath: template.remotePath || '',
    commitMessage: '',
    backupEnabled: template.backupEnabled === true || template.backupEnabled === 1,
    description: template.description || ''
  }
  dialogVisible.value = true
}

const useTemplate = (template: any) => {
  router.push({ path: '/deploy', query: { templateId: String(template.id) } })
}

const deleteTemplate = async (template: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name}" 吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const result = await window.electronAPI.template.delete(template.id)
    if (result.success) {
      ElMessage.success('删除成功')
      await fetchTemplates()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const submitForm = async () => {
  try {
    await formRef.value.validate()
    const data = JSON.parse(JSON.stringify(formData.value))
    let result
    if (isEdit.value && editingId.value) {
      result = await window.electronAPI.template.update(editingId.value, data)
    } else {
      result = await window.electronAPI.template.create(data)
    }
    if (result.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      resetForm()
      await fetchTemplates()
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
    projectId: null,
    deployType: 'svn',
    svnCredentialId: null,
    svnPath: '',
    serverCredentialId: null,
    remotePath: '',
    commitMessage: '',
    backupEnabled: true,
    description: ''
  }
}

onMounted(async () => {
  await Promise.all([
    projectStore.fetchProjects(),
    fetchTemplates(),
    fetchCredentials()
  ])
})
</script>

<style scoped lang="scss">
.templates-page {
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
}
</style>
