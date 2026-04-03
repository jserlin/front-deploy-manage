<template>
  <div class="projects-page">
    <div class="page-header">
      <h2>项目管理</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加项目
      </el-button>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="searchText"
        placeholder="搜索项目名称"
        style="width: 300px"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="selectedGroup" placeholder="选择分组" clearable style="width: 200px; margin-left: 16px">
        <el-option
          v-for="group in groups"
          :key="group.id"
          :label="group.name"
          :value="group.id"
        />
      </el-select>
    </div>

    <div v-loading="loading" class="project-grid">
      <el-card
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
        shadow="hover"
      >
        <div class="card-header">
          <h3>{{ project.name }}</h3>
          <el-tag v-if="project.groupName" :color="project.groupColor" size="small">
            {{ project.groupName }}
          </el-tag>
        </div>
        
        <div class="card-body">
          <div class="info-item">
            <el-icon><Folder /></el-icon>
            <span>{{ project.localPath }}</span>
          </div>
          <div class="info-item">
            <el-icon><Share /></el-icon>
            <span>{{ project.gitBranch || 'main' }}</span>
          </div>
          <div class="info-item">
            <el-icon><Setting /></el-icon>
            <span>{{ project.buildCommand }}</span>
          </div>
        </div>

        <div class="card-actions">
          <el-button text @click="quickDeploy(project)">
            <el-icon><Upload /></el-icon>
            发布
          </el-button>
          <el-button text @click="editProject(project)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button text type="danger" @click="deleteProject(project)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑项目' : '添加项目'"
      width="600px"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入项目名称" />
        </el-form-item>
        
        <el-form-item label="本地路径" prop="localPath">
          <el-input v-model="formData.localPath" placeholder="选择或输入项目路径">
            <template #append>
              <el-button @click="selectPath">选择</el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="Git 仓库">
          <el-input v-model="formData.gitRepo" disabled placeholder="自动检测" />
        </el-form-item>

        <el-form-item label="Git 分支" prop="gitBranch">
          <el-input v-model="formData.gitBranch" placeholder="默认 main" />
        </el-form-item>

        <el-form-item label="构建命令" prop="buildCommand">
          <el-input v-model="formData.buildCommand" placeholder="npm run build" />
        </el-form-item>

        <el-form-item label="产物目录" prop="outputDir">
          <el-input v-model="formData.outputDir" placeholder="dist" />
        </el-form-item>

        <el-form-item label="所属分组">
          <el-select v-model="formData.groupId" placeholder="选择分组" clearable>
            <el-option
              v-for="group in groups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="项目描述"
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
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import type { Project } from '@/types/project'

const router = useRouter()
const projectStore = useProjectStore()

const loading = ref(false)
const searchText = ref('')
const selectedGroup = ref<number | null>(null)
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()

const projects = computed(() => projectStore.projects)
const groups = ref<any[]>([])

const formData = ref({
  name: '',
  localPath: '',
  gitRepo: '',
  gitBranch: 'main',
  buildCommand: 'npm run build',
  outputDir: 'dist',
  groupId: null as number | null,
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  localPath: [{ required: true, message: '请选择项目路径', trigger: 'blur' }]
}

const filteredProjects = computed(() => {
  let result = projects.value
  
  if (searchText.value) {
    result = result.filter(p => 
      p.name.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }
  
  if (selectedGroup.value) {
    result = result.filter(p => p.groupId === selectedGroup.value)
  }
  
  return result
})

const fetchGroups = async () => {
  try {
    const result = await window.electronAPI.group.getAll()
    if (result.success) {
      groups.value = result.data || []
    }
  } catch (error) {
    console.error('Failed to fetch groups:', error)
  }
}

const showAddDialog = () => {
  isEdit.value = false
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const editProject = (project: Project) => {
  isEdit.value = true
  editingId.value = project.id
  formData.value = {
    name: project.name,
    localPath: project.localPath,
    gitRepo: project.gitRepo || '',
    gitBranch: project.gitBranch || 'main',
    buildCommand: project.buildCommand || 'npm run build',
    outputDir: project.outputDir || 'dist',
    groupId: project.groupId || null,
    description: project.description || ''
  }
  dialogVisible.value = true
}

const deleteProject = async (project: Project) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目 "${project.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await projectStore.deleteProject(project.id)
    ElMessage.success('删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const quickDeploy = (project: Project) => {
  projectStore.setCurrentProject(project)
  router.push('/deploy')
}

const selectPath = async () => {
  try {
    const result = await window.electronAPI.config.selectFile()
    if (result && result.success && result.path) {
      // selectFile 现在返回的就是目录路径
      formData.value.localPath = result.path

      // 自动检测 Git 信息
      const gitResult = await window.electronAPI.project.scanGit(formData.value.localPath)
      if (gitResult && gitResult.success && gitResult.data) {
        formData.value.gitRepo = gitResult.data.repo || ''
        formData.value.gitBranch = gitResult.data.branch || 'main'
        if (!formData.value.name) {
          const parts = formData.value.localPath.replace(/\\/g, '/').split('/')
          formData.value.name = parts[parts.length - 1] || ''
        }
      }
    }
  } catch (error) {
    console.error('selectPath error:', error)
  }
}

const submitForm = async () => {
  try {
    await formRef.value.validate()
    
    const data = JSON.parse(JSON.stringify(formData.value))
    
    if (isEdit.value && editingId.value) {
      await projectStore.updateProject(editingId.value, data)
      ElMessage.success('更新成功')
    } else {
      await projectStore.createProject(data)
      ElMessage.success('添加成功')
    }
    
    dialogVisible.value = false
    resetForm()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

const resetForm = () => {
  formData.value = {
    name: '',
    localPath: '',
    gitRepo: '',
    gitBranch: 'main',
    buildCommand: 'npm run build',
    outputDir: 'dist',
    groupId: null,
    description: ''
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      projectStore.fetchProjects(),
      fetchGroups()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.projects-page {
  height: 100%;
}

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
  display: flex;
  align-items: center;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  overflow-y: auto;
}

.project-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    h3 {
      margin: 0;
      font-size: 18px;
    }
  }
  
  .card-body {
    margin-bottom: 16px;
    
    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #666;
      font-size: 14px;
      
      .el-icon {
        color: #999;
      }
    }
  }
  
  .card-actions {
    display: flex;
    gap: 8px;
    border-top: 1px solid #eee;
    padding-top: 12px;
  }
}
</style>
