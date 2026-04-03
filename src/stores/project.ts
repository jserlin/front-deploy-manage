import { defineStore } from 'pinia'
import type { Project } from '@/types/project'

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    loading: false
  }),

  actions: {
    async fetchProjects() {
      this.loading = true
      try {
        const result = await window.electronAPI.project.getAll()
        if (result && result.success && result.data) {
          this.projects = result.data
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      } finally {
        this.loading = false
      }
    },

    async createProject(data: any) {
      try {
        const result = await window.electronAPI.project.create(data)
        if (result && result.success) {
          await this.fetchProjects()
          return result
        }
        throw new Error(result?.error || '创建失败')
      } catch (error) {
        console.error('Failed to create project:', error)
        throw error
      }
    },

    async updateProject(id: number, data: any) {
      try {
        const result = await window.electronAPI.project.update(id, data)
        if (result && result.success) {
          await this.fetchProjects()
          return result
        }
        throw new Error(result?.error || '更新失败')
      } catch (error) {
        console.error('Failed to update project:', error)
        throw error
      }
    },

    async deleteProject(id: number) {
      try {
        const result = await window.electronAPI.project.delete(id)
        if (result && result.success) {
          await this.fetchProjects()
          return result
        }
        throw new Error(result?.error || '删除失败')
      } catch (error) {
        console.error('Failed to delete project:', error)
        throw error
      }
    },

    setCurrentProject(project: Project | null) {
      this.currentProject = project
    }
  }
})
