const fs = require('fs');
const path = require('path');

// Helper to create Vue component
function createVueFile(filepath, template, script, style) {
  const content = `<template>
${template}
</template>

<script setup lang="ts">
${script}
</script>

<style scoped>
${style}
</style>
`;
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Created: ${filepath}`);
}

// Ensure directories exist
['src/views/projects', 'src/views/credentials', 'src/views/deploy', 'src/views/settings'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('Building Vue components...');
console.log('Process completed');

// Component 1: projects/index.vue
const projectsTemplate = `  <div class="projects-page">
    <div class="page-header">
      <h2>项目管理</h2>
      <div class="header-actions">
        <el-select v-model="selectedGroup" placeholder="筛选分组" clearable style="width: 200px; margin-right: 12px;">
          <el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
        </el-select>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加项目
        </el-button>
      </div>
    </div>
    <div class="projects-grid" v-loading="loading">
      <el-empty v-if="filteredProjects.length === 0" description="暂无项目" />
      <el-card v-for="project in filteredProjects" :key="project.id" class="project-card" :body-style="{ padding: '20px' }" shadow="hover">
        <div class="card-header">
          <div class="project-name">
            {{ project.name }}
            <el-tag v-if="project.groupName" :color="project.groupColor" size="small" style="margin-left: 8px;">{{ project.groupName }}</el-tag>
          </div>
          <div class="card-actions">
            <el-button link type="primary" @click="handleEdit(project)"><el-icon><Edit /></el-icon></el-button>
            <el-button link type="danger" @click="handleDelete(project)"><el-icon><Delete /></el-icon></el-button>
          </div>
        </div>
        <div class="project-info">
          <div class="info-item"><el-icon><Folder /></el-icon><span>{{ project.localPath }}</span></div>
          <div class="info-item" v-if="project.gitRepo"><el-icon><Link /></el-icon><span>{{ project.gitRepo }}</span></div>
          <div class="info-item"><el-icon><Coin /></el-icon><span>分支: {{ project.gitBranch }}</span></div>
          <div class="info-item" v-if="project.description"><el-icon><Document /></el-icon><span>{{ project.description }}</span></div>
        </div>
        <div class="card-footer">
          <el-button size="small" @click="handleDeploy(project)"><el-icon><Upload /></el-icon>快速发布</el-button>
          <el-button size="small" @click="handleScanGit(project)"><el-icon><Refresh /></el-icon>扫描Git</el-button>
        </div>
      </el-card>
    </div>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" @closed="resetForm">
      <el-form ref="formRef" :model="formData" :rules="formRules" label-width="100px">
        <el-form-item label="项目名称" prop="name"><el-input v-model="formData.name" placeholder="请输入项目名称" /></el-form-item>
        <el-form-item label="本地路径" prop="localPath">
          <el-input v-model="formData.localPath" placeholder="请输入本地路径">
            <template #append><el-button @click="selectPath">浏览</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item label="Git分支" prop="gitBranch"><el-input v-model="formData.gitBranch" placeholder="请输入Git分支" /></el-form-item>
        <el-form-item label="构建命令" prop="buildCommand"><el-input v-model="formData.buildCommand" type="textarea" :rows="2" placeholder="例如: npm run build" /></el-form-item>
        <el-form-item label="输出目录" prop="outputDir"><el-input v-model="formData.outputDir" placeholder="例如: dist" /></el-form-item>
        <el-form-item label="所属分组" prop="groupId">
          <el-select v-model="formData.groupId" placeholder="请选择分组" clearable>
            <el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="formData.description" type="textarea" :rows="2" placeholder="请输入项目描述" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>`;

createVueFile('src/views/projects/index.vue', projectsTemplate, projectsScript, projectsStyle);

const projectsScript = `import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Edit, Delete, Folder, Link, Coin, Document, Upload, Refresh } from '@element-plus/icons-vue'
import type { Project, Group } from '@/types/project'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const selectedGroup = ref<number>()
const projects = ref<Project[]>([])
const groups = ref<Group[]>([])
const formRef = ref<FormInstance>()

const formData = ref({
  id: 0,
  name: '',
  localPath: '',
  gitBranch: 'master',
  buildCommand: 'npm run build',
  outputDir: 'dist',
  groupId: undefined as number | undefined,
  description: ''
})

const formRules: FormRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  localPath: [{ required: true, message: '请输入本地路径', trigger: 'blur' }],
  gitBranch: [{ required: true, message: '请输入Git分支', trigger: 'blur' }],
  buildCommand: [{ required: true, message: '请输入构建命令', trigger: 'blur' }],
  outputDir: [{ required: true, message: '请输入输出目录', trigger: 'blur' }]
}

const dialogTitle = computed(() => (isEdit.value ? '编辑项目' : '添加项目'))
const filteredProjects = computed(() => {
  if (!selectedGroup.value) return projects.value
  return projects.value.filter(p => p.groupId === selectedGroup.value)
})

const loadProjects = async () => {
  try {
    loading.value = true
    projects.value = await window.electronAPI.project.getAll()
  } catch (error: any) {
    ElMessage.error(error.message || '加载项目列表失败')
  } finally {
    loading.value = false
  }
}

const loadGroups = async () => {
  try {
    groups.value = await window.electronAPI.group.getAll()
  } catch (error: any) {
    ElMessage.error(error.message || '加载分组列表失败')
  }
}

const handleAdd = () => {
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (project: Project) => {
  isEdit.value = true
  formData.value = {
    id: project.id,
    name: project.name,
    localPath: project.localPath,
    gitBranch: project.gitBranch,
    buildCommand: project.buildCommand,
    outputDir: project.outputDir,
    groupId: project.groupId,
    description: project.description || ''
  }
  dialogVisible.value = true
}

const handleDelete = async (project: Project) => {
  try {
    await ElMessageBox.confirm('确定要删除项目 "' + project.name + '" 吗?', '确认删除', { type: 'warning' })
    await window.electronAPI.project.delete(project.id)
    ElMessage.success('删除成功')
    await loadProjects()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true
    if (isEdit.value) {
      await window.electronAPI.project.update(formData.value.id, formData.value)
      ElMessage.success('更新成功')
    } else {
      await window.electronAPI.project.create(formData.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadProjects()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  formData.value = {
    id: 0,
    name: '',
    localPath: '',
    gitBranch: 'master',
    buildCommand: 'npm run build',
    outputDir: 'dist',
    groupId: undefined,
    description: ''
  }
  formRef.value?.resetFields()
}

const selectPath = async () => {
  ElMessage.info('路径选择功能需要Electron环境')
}

const handleDeploy = (project: Project) => {
  router.push({ path: '/deploy', query: { projectId: project.id } })
}

const handleScanGit = async (project: Project) => {
  try {
    const result = await window.electronAPI.project.scanGit(project.localPath)
    if (result) {
      ElMessage.success('Git信息扫描成功')
      await loadProjects()
    }
  } catch (error: any) {
    ElMessage.error(error.message || 'Git扫描失败')
  }
}

onMounted(() => {
  loadProjects()
  loadGroups()
})`;

const projectsStyle = `.projects-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { margin: 0; font-size: 24px; font-weight: 600; }
.header-actions { display: flex; align-items: center; }
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
.project-card { transition: all 0.3s; }
.project-card:hover { transform: translateY(-4px); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
.project-name { font-size: 16px; font-weight: 600; color: #303133; display: flex; align-items: center; }
.card-actions { display: flex; gap: 8px; }
.project-info { margin-bottom: 16px; }
.info-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 14px; color: #606266; }
.info-item .el-icon { margin-right: 8px; color: #909399; }
.info-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-footer { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #ebeef5; }`;
