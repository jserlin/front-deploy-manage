import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/projects'
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('@/views/projects/index.vue'),
    meta: { title: '项目管理' }
  },
  {
    path: '/credentials/server',
    name: 'ServerCredentials',
    component: () => import('@/views/credentials/server.vue'),
    meta: { title: '服务器凭证' }
  },
  {
    path: '/credentials/svn',
    name: 'SvnCredentials',
    component: () => import('@/views/credentials/svn.vue'),
    meta: { title: 'SVN 凭证' }
  },
  {
    path: '/deploy',
    name: 'Deploy',
    component: () => import('@/views/deploy/index.vue'),
    meta: { title: '快速发布' }
  },
  {
    path: '/deploy/history',
    name: 'DeployHistory',
    component: () => import('@/views/deploy/history.vue'),
    meta: { title: '发布历史' }
  },
  {
    path: '/deploy/templates',
    name: 'DeployTemplates',
    component: () => import('@/views/deploy/templates.vue'),
    meta: { title: '发布模板' }
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('@/views/docs/index.vue'),
    meta: { title: '帮助文档' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/settings/index.vue'),
    meta: { title: '设置' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
