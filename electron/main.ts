import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { DatabaseManager } from './database'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null
let database: DatabaseManager | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    },
    title: 'Frontend Deploy Manager',
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

function initializeDatabase() {
  const dbPath = join(app.getPath('userData'), 'deploy-manager.json')
  console.log('Database path:', dbPath)
  database = new DatabaseManager(dbPath)
  database.initialize()
  return database
}

app.whenReady().then(async () => {
  try {
    console.log('Application starting...')

    const db = initializeDatabase()
    console.log('Database initialized')

    registerIpcHandlers(db)
    console.log('IPC handlers registered')

    await createWindow()
    console.log('Window created')

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow()
      }
    })
  } catch (error) {
    console.error('Failed to initialize app:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    database?.close()
    app.quit()
  }
})
