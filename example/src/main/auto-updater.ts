import { dialog, BrowserWindow } from 'electron'
import logger from 'electron-log'
import ProgressBar from 'electron-progressbar'
import { autoUpdater } from 'electron-updater'

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.logger = logger

  // 默认会自动下载，如果不想自动下载，设置 autoUpdater.autoDownload = false
  autoUpdater.autoDownload = false

  // 开启开发环境测试自动更新程序流程，创建 dev-app-update.yml
  autoUpdater.forceDevUpdateConfig = true

  // 下载进度条
  const progressBar = new ProgressBar({
    title: '更新',
    text: '下载更新',
    detail: '等待下载',
    indeterminate: false,
    closeOnComplete: true,
    browserWindow: {
      show: false,
      modal: true,
      parent: mainWindow
    }
  })
  // @ts-expect-error
  progressBar._window.hide()
  // @ts-expect-error
  progressBar._window.setProgressBar(-1)

  // 更新可用
  autoUpdater.on('update-available', (info) => {
    console.log('[electron-updater]', '更新可用', info)
    const version = info.version
    const releaseNotes = info.releaseNotes
    dialog
      .showMessageBox(mainWindow, {
        title: '版本更新',
        message: `发现新版本${version}，是否更新\n\n${releaseNotes}`,
        type: 'info',
        buttons: ['稍后更新', '立即更新']
      })
      .then(({ response }) => {
        if (response === 1) {
          // @ts-expect-error
          progressBar._window.show()
          // @ts-expect-error
          progressBar._window.setProgressBar(0)
          autoUpdater.downloadUpdate() // 手动下载更新
        }
      })
  })

  // 更新不可用
  autoUpdater.on('update-not-available', () => {
    progressBar.close()
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    console.log('[electron-updater]', '下载进度', progress)
    progressBar.value = progress.percent
    progressBar.detail = `下载中 ${(progress.transferred / 1000 / 1000).toFixed(2)}/${(progress.total / 1000 / 1000).toFixed(2)}`
  })

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[electron-updater]', '下载完成', info)
    dialog
      .showMessageBox(mainWindow, {
        title: '下载完成',
        message: `重启可应用新版本`,
        type: 'info',
        buttons: ['稍后重启', '立即重启']
      })
      .then(({ response }) => {
        if (response === 1) {
          autoUpdater.quitAndInstall() // 退出并安装重启
        }
      })
  })

  // 检查更新
  autoUpdater.checkForUpdates()
}
