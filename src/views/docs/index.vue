<template>
  <div class="docs-page">
    <div class="page-header">
      <h2>帮助文档</h2>
    </div>
    
    <div class="docs-container">
      <div class="docs-sidebar">
        <el-menu
          :default-active="activeDoc"
          @select="handleSelect"
          class="docs-menu"
        >
          <el-menu-item index="user-guide">
            <el-icon><Reading /></el-icon>
            <span>用户操作手册</span>
          </el-menu-item>
          <el-menu-item index="system-design">
            <el-icon><Document /></el-icon>
            <span>系统设计文档</span>
          </el-menu-item>
          <el-menu-item index="node-guide">
            <el-icon><Cpu /></el-icon>
            <span>Node版本指南</span>
          </el-menu-item>
        </el-menu>
      </div>
      
      <div class="docs-content" v-loading="loading">
        <div class="markdown-body" v-html="renderedContent"></div>
        <el-empty v-if="!loading && !renderedContent" description="文档内容加载失败" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Reading, Document, Cpu } from '@element-plus/icons-vue'
import { marked } from 'marked'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const activeDoc = ref('user-guide')
const docContent = ref('')

const docFiles: Record<string, string> = {
  'user-guide': '用户操作手册.md',
  'system-design': '系统设计文档.md',
  'node-guide': 'node-version-guide.md'
}

const renderedContent = computed(() => {
  if (!docContent.value) return ''
  return marked(docContent.value) as string
})

const handleSelect = (index: string) => {
  activeDoc.value = index
  router.push({ query: { doc: index } })
  loadDocument(index)
}

const loadDocument = async (docKey: string) => {
  const fileName = docFiles[docKey]
  if (!fileName) return
  
  loading.value = true
  try {
    const result = await window.electronAPI.config.readDoc(fileName)
    if (result.success) {
      docContent.value = result.data
    } else {
      docContent.value = `# 加载失败\n\n无法加载文档: ${result.error}`
    }
  } catch (error: any) {
    docContent.value = `# 加载失败\n\n错误: ${error.message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const docQuery = route.query.doc as string
  if (docQuery && docFiles[docQuery]) {
    activeDoc.value = docQuery
    loadDocument(docQuery)
  } else {
    loadDocument(activeDoc.value)
  }
})

watch(() => route.query.doc, (newDoc) => {
  if (newDoc && docFiles[newDoc as string]) {
    activeDoc.value = newDoc as string
    loadDocument(newDoc as string)
  }
})
</script>

<style scoped lang="scss">
.docs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .page-header {
    margin-bottom: 20px;
    
    h2 {
      margin: 0;
      font-size: 24px;
    }
  }
  
  .docs-container {
    flex: 1;
    display: flex;
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
  
  .docs-sidebar {
    width: 220px;
    border-right: 1px solid #e4e7ed;
    flex-shrink: 0;
    
    .docs-menu {
      border-right: none;
      height: 100%;
      
      .el-menu-item {
        height: 50px;
        line-height: 50px;
        
        &.is-active {
          background-color: #ecf5ff;
        }
      }
    }
  }
  
  .docs-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    
    .markdown-body {
      max-width: 900px;
      margin: 0 auto;
      
      :deep(h1) {
        font-size: 28px;
        border-bottom: 1px solid #eaecef;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      
      :deep(h2) {
        font-size: 24px;
        margin-top: 32px;
        margin-bottom: 16px;
        border-bottom: 1px solid #eaecef;
        padding-bottom: 8px;
      }
      
      :deep(h3) {
        font-size: 20px;
        margin-top: 24px;
        margin-bottom: 12px;
      }
      
      :deep(h4) {
        font-size: 18px;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      
      :deep(p) {
        line-height: 1.8;
        margin-bottom: 16px;
        color: #303133;
      }
      
      :deep(ul), :deep(ol) {
        margin-bottom: 16px;
        padding-left: 24px;
        
        li {
          line-height: 1.8;
          margin-bottom: 8px;
        }
      }
      
      :deep(table) {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        
        th, td {
          border: 1px solid #dcdfe6;
          padding: 12px 16px;
          text-align: left;
        }
        
        th {
          background-color: #f5f7fa;
          font-weight: 600;
        }
        
        tr:nth-child(even) {
          background-color: #fafafa;
        }
      }
      
      :deep(code) {
        background-color: #f5f7fa;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 13px;
      }
      
      :deep(pre) {
        background-color: #282c34;
        color: #abb2bf;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin-bottom: 20px;
        
        code {
          background: none;
          padding: 0;
          color: inherit;
        }
      }
      
      :deep(blockquote) {
        border-left: 4px solid #409eff;
        padding-left: 16px;
        margin: 16px 0;
        color: #606266;
        background-color: #f4f4f5;
        padding: 12px 16px;
        border-radius: 0 4px 4px 0;
      }
      
      :deep(hr) {
        border: none;
        border-top: 1px solid #e4e7ed;
        margin: 24px 0;
      }
      
      :deep(a) {
        color: #409eff;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}
</style>
