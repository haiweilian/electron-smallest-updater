import { dialog, BrowserWindow } from 'electron'
import logger from 'electron-log'
import ProgressBar from 'electron-progressbar'
import { SmallestUpdater } from 'electron-smallest-updater'

export function initSmallestUpdater(mainWindow: BrowserWindow): SmallestUpdater {
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

  // 创建实例
  const smallestUpdater = new SmallestUpdater({
    logger,
    publish: {
      url: 'http://localhost:3000/smallest-updates'
    },
    autoDownload: false,
    forceDevUpdateConfig: true
  })

  // 更新可用
  smallestUpdater.on('update-available', (info) => {
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
          smallestUpdater.downloadUpdate() // 手动下载更新
        }
      })
  })

  // 更新不可用
  smallestUpdater.on('update-not-available', () => {
    progressBar.close()
  })

  // 下载进度
  smallestUpdater.on('download-progress', (progress) => {
    console.log('[electron-updater]', '下载进度', progress)
    progressBar.value = progress.percent * 100
    progressBar.detail = `下载中 ${(progress.transferred / 1000 / 1000).toFixed(2)}/${(progress.total / 1000 / 1000).toFixed(2)}`
  })

  // 下载完成
  smallestUpdater.on('update-downloaded', (info) => {
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
          smallestUpdater.quitAndInstall() // 退出并安装重启
        }
      })
  })

  // 检查更新
  smallestUpdater.checkForUpdates()

  return smallestUpdater
}
