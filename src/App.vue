<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container v-if="!isLoginPage" class="layout-container">
        <!-- 侧边栏 -->
        <el-aside width="200px" class="sidebar">
          <div class="logo">
            <el-icon><Monitor /></el-icon>
            <span>Deploy Manager</span>
          </div>
          <el-menu
            :default-active="activeMenu"
            router
            class="sidebar-menu"
          >
            <el-menu-item index="/projects">
              <el-icon><FolderOpened /></el-icon>
              <span>项目管理</span>
            </el-menu-item>
            <el-sub-menu index="credentials">
              <template #title>
                <el-icon><Key /></el-icon>
                <span>凭证管理</span>
              </template>
              <el-menu-item index="/credentials/server">
                <el-icon><Monitor /></el-icon>
                <span>服务器凭证</span>
              </el-menu-item>
              <el-menu-item index="/credentials/svn">
                <el-icon><Connection /></el-icon>
                <span>SVN 凭证</span>
              </el-menu-item>
            </el-sub-menu>
            <el-sub-menu index="deploy">
              <template #title>
                <el-icon><Upload /></el-icon>
                <span>发布管理</span>
              </template>
              <el-menu-item index="/deploy">
                <el-icon><Position /></el-icon>
                <span>快速发布</span>
              </el-menu-item>
              <el-menu-item index="/deploy/history">
                <el-icon><Clock /></el-icon>
                <span>发布历史</span>
              </el-menu-item>
              <el-menu-item index="/deploy/templates">
                <el-icon><Document /></el-icon>
                <span>发布模板</span>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>设置</span>
            </el-menu-item>
            <el-menu-item index="/docs">
              <el-icon><Notebook /></el-icon>
              <span>帮助文档</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <!-- 主内容区 -->
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
      
      <!-- 登录页或其他特殊页面 -->
      <router-view v-if="isLoginPage" />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Notebook } from '@element-plus/icons-vue'

const route = useRoute()

const activeMenu = computed(() => {
  return route.path
})

const isLoginPage = computed(() => {
  return false
})

onMounted(() => {
  if (!window.electronAPI) {
    console.error('[App] window.electronAPI is NOT available! Preload script failed.')
  } else {
    console.log('[App] window.electronAPI is available, keys:', Object.keys(window.electronAPI))
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.app-container {
  height: 100vh;
  overflow: hidden;
}

.layout-container {
  height: 100%;
}

.sidebar {
  overflow-y: auto;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-menu {
  border-right: none;
  background: transparent;
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: scroll;
  min-height: 100vh;
}
</style>
