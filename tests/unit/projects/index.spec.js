const { describe, it, expect, vi, beforeEach } = require('vitest')

const mockExecAsync = vi.fn()

vi.mock('child_process', () => ({
  exec: vi.fn()
}))

vi.mock('util', () => ({
  promisify: () => mockExecAsync
}))

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

describe('NodeVersionService', () => {
  let NodeVersionService
  let service

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../services/node-version.service')
    NodeVersionService = mod.NodeVersionService
    service = new NodeVersionService()
  })

  describe('getCurrentVersion', () => {
    it('should return current node version', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'v18.17.0\n' })
      const version = await service.getCurrentVersion()
      expect(version).toBe('v18.17.0')
    })

    it('should throw error when node -v fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('node not found'))
      await expect(service.getCurrentVersion()).rejects.toThrow('无法获取当前 Node 版本')
    })
  })

  describe('checkNvmAvailable', () => {
    it('should return true when nvm is available', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '1.1.12\n' })
      const available = await service.checkNvmAvailable()
      expect(available).toBe(true)
    })

    it('should return false when nvm is not available', async () => {
      mockExecAsync.mockRejectedValue(new Error('not found'))
      const available = await service.checkNvmAvailable()
      expect(available).toBe(false)
    })
  })

  describe('isVersionInstalled', () => {
    it('should return true when version is installed', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '  v16.20.2\n  * v18.17.0 (Currently using 64-bit executable)\n'
      })
      const installed = await service.isVersionInstalled('16.20.2')
      expect(installed).toBe(true)
    })

    it('should return false when version is not installed', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '  * v18.17.0 (Currently using 64-bit executable)\n'
      })
      const installed = await service.isVersionInstalled('20.10.0')
      expect(installed).toBe(false)
    })
  })

  describe('checkVersion', () => {
    it('should return needSwitch false when no expected version', async () => {
      const result = await service.checkVersion('')
      expect(result.needSwitch).toBe(false)
    })

    it('should return needSwitch false when versions match', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'v16.20.2\n' })
      const result = await service.checkVersion('v16.20.2')
      expect(result.needSwitch).toBe(false)
      expect(result.currentVersion).toBe('v16.20.2')
    })

    it('should return error when nvm is not available and versions differ', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'v18.17.0\n' })
        .mockRejectedValueOnce(new Error('not found'))
      const result = await service.checkVersion('16.20.2')
      expect(result.needSwitch).toBe(true)
      expect(result.nvmAvailable).toBe(false)
      expect(result.error).toContain('请先安装 nvm')
    })

    it('should detect version not installed', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'v18.17.0\n' })
        .mockResolvedValueOnce({ stdout: '1.1.12\n' })
        .mockResolvedValueOnce({ stdout: '  * v18.17.0\n' })
      const result = await service.checkVersion('16.20.2')
      expect(result.needSwitch).toBe(true)
      expect(result.nvmAvailable).toBe(true)
      expect(result.versionInstalled).toBe(false)
    })
  })

  describe('switchVersion', () => {
    it('should switch version successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '' })
      await expect(service.switchVersion('16.20.2')).resolves.toBeUndefined()
    })

    it('should throw error when switch fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))
      await expect(service.switchVersion('99.99.99')).rejects.toThrow('切换 Node 版本失败')
    })
  })

  describe('installVersion', () => {
    it('should install version successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '' })
      await expect(service.installVersion('16.20.2')).resolves.toBeUndefined()
    })

    it('should throw error when install fails', async () => {
      mockExecAsync.mockRejectedValue(new Error('network error'))
      await expect(service.installVersion('99.99.99')).rejects.toThrow('安装 Node v99.99.99 失败')
    })
  })
})
