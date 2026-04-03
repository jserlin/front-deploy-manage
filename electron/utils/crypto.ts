import { safeStorage } from 'electron'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'

export class CryptoUtil {
  private static getKey(): Buffer {
    // 使用 Electron 的 safeStorage 来获取加密密钥
    if (safeStorage.isEncryptionAvailable()) {
      // 生成一个固定的密钥用于加密
      const keyString = 'frontend-deploy-manager-encryption-key'
      return crypto.scryptSync(keyString, 'salt', 32)
    }
    // 如果 safeStorage 不可用，使用固定密钥（不推荐生产环境）
    return crypto.scryptSync('fallback-encryption-key', 'salt', 32)
  }

  static encrypt(text: string): string {
    if (!text) return ''
    
    try {
      const key = this.getKey()
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
      
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // 将 iv 和加密数据一起存储
      return iv.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  static decrypt(encryptedData: string): string {
    if (!encryptedData) return ''
    
    try {
      const key = this.getKey()
      const parts = encryptedData.split(':')
      
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format')
      }
      
      const iv = Buffer.from(parts[0], 'hex')
      const encrypted = parts[1]
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt data')
    }
  }
}
