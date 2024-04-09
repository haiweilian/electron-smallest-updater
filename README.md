# electron-smallest-updater

用于最小更新 Electron Resources 的更新器。

- 与 electron-updater 有相近的配置和用法。
- 可手动指定更新 Resources 目录下的任意资源。
- 自动生成更新所需的资源压缩包和元数据文件。
- 支持 Windows 任意目录下的更新无需额外依赖。

## 安装

```sh
npm install electron-smallest-updater
```

## 构建

利用 `electron-builder` 的 `afterPack` 钩子自动生成更新所需的资源压缩包和元数据文件。

```yml
# electron-builder.yml
afterPack: ./afterPack.js
```

```js
// afterPack.js
const { smallestBuilder } = require('electron-smallest-updater')

exports.default = async (context) => {
  return smallestBuilder(context, {
    // options
  })
}
```

以上配置打包后会在指定的输出目录生成 `{productName}-{version}-smallest.zip`(资源压缩包) 和 `latest-smallest.json`(更新频道文件)。然后你可以把生成内容放到文件服务器上。

```json
// latest-smallest.json
{
  "version": "1.1.0",
  "releaseFile": {
    "url": "electron-updater-example-1.1.0-smallest.zip",
    "size": 9334322,
    "sha512": "28d21a3e1d15e5c5b7bbc7ee4298df66e160cd5330cdb0a135a614d5077..."
  },
  "releaseDate": "2024-04-08T02:23:43.648Z",
  "releaseName": "Update 1.1.0",
  "releaseNotes": "Update for version 1.1.0 is available"
}
```

### 配置

| 名称      | 描述             | 默认值                                           |
| --------- | ---------------- | ------------------------------------------------ |
| channel   | 更新频道名称     | latest-smallest.json                             |
| resources | 生成压缩包的资源 | \['app.asar', 'app/**', 'app.asar.unpacked/**'\] |
| urlPrefix | 文件资源路径前缀 |                                                  |

## 使用

在主进程中接入更新逻辑，以下是一个可直接使用的示例。

```ts
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
      parent: mainWindow,
    },
  })
  // @ts-expect-error
  progressBar._window.hide()
  // @ts-expect-error
  progressBar._window.setProgressBar(-1)

  // 创建实例
  const smallestUpdater = new SmallestUpdater({
    logger,
    publish: {
      url: 'http://localhost:3000/smallest-updates',
    },
    autoDownload: false,
    forceDevUpdateConfig: true,
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
        buttons: ['稍后更新', '立即更新'],
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
        buttons: ['稍后重启', '立即重启'],
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
```

### 配置

| 名称                 | 描述                 | 默认值                                 |
| -------------------- | -------------------- | -------------------------------------- |
| logger               | 自定义日志           | console                                |
| channel              | 更新频道名称         | latest-smallest.json                   |
| publish              | 发布配置             | { url: string, options?: Got.Options } |
| autoDownload         | 是否自动下载         | true                                   |
| autoInstallOnAppQuit | 是否退出时自动安装   | true                                   |
| forceDevUpdateConfig | 是否允许开发环境更新 | false                                  |

### 事件

| 名称                 | 描述         | 回调                                     |
| -------------------- | ------------ | ---------------------------------------- |
| error                | 更新错误     | (error: Error, message?: string) => void |
| checking-for-update  | 检查更新     | () => void                               |
| update-available     | 更新可用     | (info: UpdateInfo) => void               |
| update-not-available | 更新不可用   | (info: UpdateInfo) => void               |
| update-downloaded    | 更新下载完成 | (event: UpdateDownloadedInfo) => void    |
| download-progress    | 更新下载进度 | (info: ProgressInfo) => void             |
| update-cancelled     | 更新取消     | (info: UpdateInfo) => void               |

**UpdateInfo**

```ts
interface UpdateInfo {
  version: string
  releaseFile: {
    url: string
    size: number
    sha512: string
  }
  releaseDate: string
  releaseName?: string
  releaseNotes?: string
}
```

**ProgressInfo**

```ts
export interface ProgressInfo {
  total: number
  percent: number
  transferred: number
}
```
