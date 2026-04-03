import log from 'electron-log'
import { join } from 'path'
import { app } from 'electron'

// 配置日志文件路径
log.transports.file.resolvePathFn = () => {
  return join(app.getPath('userData'), 'logs', 'main.log')
}

// 配置日志格式
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

// 设置日志级别
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

export const logger = log
