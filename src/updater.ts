import { spawnSync, SpawnOptions } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { join, basename } from 'node:path'
import { pipeline as streamPipeline } from 'node:stream/promises'
import AdmZip from 'adm-zip'
import { app } from 'electron'
import fse from 'fs-extra'
import got from 'got'
import semver from 'semver'
import { TypedEmitter } from 'tiny-typed-emitter'
import type { Logger, Publish, UpdateInfo, SmallestUpdaterOptions, SmallestUpdaterEvents } from './types'
import { calcSha512 } from './utils'

export class SmallestUpdater extends TypedEmitter<SmallestUpdaterEvents> {
  private logger: Logger
  private channel: string
  private publish: Publish
  private updateInfo: UpdateInfo | undefined

  private downloadUrl = ''
  private downloadDir = ''
  private downloadFileName = 'latest-smallest.zip'
  private downloadFilePath = ''
  private downloadUnzipPath = ''
  private resourcesPath = ''

  private quitAndInstallCalled = false
  private autoDownload = true
  private autoInstallOnAppQuit = true
  private forceDevUpdateConfig = false

  constructor(options: SmallestUpdaterOptions) {
    super()

    this.logger = options.logger ?? console
    this.channel = options.channel ?? 'latest-smallest.json'
    this.publish = options.publish
    this.autoDownload = options.autoDownload ?? true
    this.autoInstallOnAppQuit = options.autoInstallOnAppQuit ?? true
    this.forceDevUpdateConfig = options.forceDevUpdateConfig ?? false

    this.downloadDir = app.getPath('userData')
    this.resourcesPath = process.resourcesPath
  }

  /**
   * Asks the server whether there is an update.
   */
  async checkForUpdates() {
    if (!app.isPackaged) {
      if (!this.forceDevUpdateConfig) {
        this.logger.info('Skip checkForUpdates because application is not packed and dev update config is not forced')
        return
      }

      // To avoid affecting application parsing errors
      // Update development environment resources to virtual directory(electron-smallest-updater-dev)
      this.resourcesPath = join(this.resourcesPath, 'electron-smallest-updater-dev')
    }

    const url = this.publish.url
    if (!url) return

    this.logger.info('Checking for update')

    // check
    let updateInfo: UpdateInfo
    try {
      this.emit('checking-for-update')

      updateInfo = await got({
        ...this.publish,
        url: `${url}/${this.channel}`,
      }).json()

      if (!updateInfo?.version || !updateInfo.releaseFile) {
        throw new Error('Invalid response content')
      }
    } catch (error: any) {
      this.emit('error', error, `Cannot check for updates: ${error.message}`)
      this.logger.error(error.stack || error)
      throw error
    }

    // diff
    const latestVersion = updateInfo.version
    const currentVersion = app.getVersion()
    if (semver.gt(latestVersion, currentVersion)) {
      this.emit('update-available', updateInfo)
      this.logger.info(`Update for version ${currentVersion} is available (latest version: ${latestVersion}`)
    } else {
      this.emit('update-not-available', updateInfo)
      this.logger.info(`Update for version ${currentVersion} is not available (latest version: ${latestVersion}`)
      return
    }

    this.updateInfo = updateInfo
    this.downloadUrl = this.formatDownloadUrl(updateInfo.releaseFile.url)

    if (this.autoDownload) {
      this.logger.info('Download triggered by autoDownload')
      await this.downloadUpdate()
    }
  }

  /**
   * Start downloading update manually.
   */
  async downloadUpdate() {
    const downloadUrl = this.downloadUrl
    if (!downloadUrl) return

    this.logger.info(`Downloading update from ${downloadUrl}`)

    // clean
    await fse.ensureDir(this.downloadDir)
    const downloadFilePath = join(this.downloadDir, this.downloadFileName)
    if (await fse.pathExists(downloadFilePath)) {
      await fse.remove(downloadFilePath)
    }
    const downloadUnzipPath = join(this.downloadDir, basename(this.downloadFileName, '.zip'))
    if (await fse.pathExists(downloadUnzipPath)) {
      // https://github.com/isaacs/rimraf/issues/203
      // https://www.electronjs.org/docs/latest/tutorial/asar-archives#treating-an-asar-archive-as-a-normal-file
      process.noAsar = true
      await fse.remove(downloadUnzipPath)
      process.noAsar = false
    }

    // download
    try {
      this.logger.info(`Download to ${downloadFilePath}`)
      const resStream = got.stream(downloadUrl)
      const writeStream = createWriteStream(downloadFilePath)
      resStream.on('downloadProgress', (progress) => {
        this.emit('download-progress', progress)
      })
      await streamPipeline(resStream, writeStream)
    } catch (error: any) {
      this.emit('error', error, `Download error: ${error.message}`)
      this.logger.error(error.stack || error)
      throw error
    }

    // validate
    try {
      const sha512 = this.updateInfo?.releaseFile.sha512
      this.logger.info(`Validate sha512 ${sha512}`)
      const result = await calcSha512(downloadFilePath)
      if (sha512 !== result) {
        throw new Error('Verification of sha512 failed, file changed')
      }
    } catch (error: any) {
      this.emit('error', error, `Validate error: ${error.message}`)
      this.logger.error(error.stack || error)
      throw error
    }

    // unzip
    try {
      /**
       * @link https://stackoverflow.com/questions/43645745/electron-invalid-package-on-unzip
      */
      process.noAsar = true
      this.logger.info(`Extract to ${downloadUnzipPath}`)
      const zip = new AdmZip(downloadFilePath)
      zip.extractAllTo(downloadUnzipPath, true)
      process.noAsar = false
    } catch (error: any) {
      this.emit('error', error, `Extract error: ${error.message}`)
      this.logger.error(error.stack || error)
      throw error
    }

    this.downloadFilePath = downloadFilePath
    this.downloadUnzipPath = downloadUnzipPath
    this.emit('update-downloaded', {
      ...this.updateInfo!,
      downloadFilePath: this.downloadFilePath,
      downloadUnzipPath: this.downloadUnzipPath,
    })

    this.addQuitHandler()
  }

  /**
   * Restarts the app and installs the update after it has been downloaded.
   * It should only be called after `update-downloaded` has been emitted.
   */
  async quitAndInstall() {
    try {
      this.logger.info('Auto install update on call quitAndInstall')
      this.updateResources()
      this.quitAndInstallCalled = true
    } catch (error: any) {
      this.emit('error', error, `Install error: ${error.message}`)
      this.logger.error(error.stack || error)
      throw error
    }

    // quit and relaunch
    app.relaunch()
    app.quit()
  }

  /**
   * Install on exit when quitAndInstall is not called.
   */
  private addQuitHandler() {
    app.once('quit', (_, exitCode) => {
      if (this.quitAndInstallCalled) {
        this.logger.info('Update installer has already been triggered. Quitting application.')
        return
      }

      if (!this.autoInstallOnAppQuit) {
        this.logger.info('Update will not be installed on quit because autoInstallOnAppQuit is set to false.')
        return
      }

      if (exitCode !== 0) {
        this.logger.info(
          `Update will be not installed on quit because application is quitting with exit code ${exitCode}`
        )
        return
      }

      this.logger.info('Auto install update on quit')
      this.updateResources()
    })
  }

  /**
   * Copy download resources to application resources.
   */
  private updateResources() {
    let cmd: string
    let args: string[]
    let options: SpawnOptions
    if (process.platform !== 'win32') {
      cmd = 'cp'
      args = ['-r', '-f', '-v', `${this.downloadUnzipPath}/.`, `${this.resourcesPath}/`]
      options = { stdio: 'ignore' }
    } else {
      cmd = 'Start-Process'
      args = [
        '-FilePath cmd',
        '-WindowStyle hidden',
        `-ArgumentList "/c xcopy /i /s /y \`"${this.downloadUnzipPath}\`" \`"${this.resourcesPath}\`""`,
        // '-Verb RunAs',
      ]
      options = { shell: 'powershell', stdio: 'ignore' }

      // If can write run using C:\Users\user\cmd.exe
      // If not can write run using C:\WINDOWS\system32\cmd.exe
      if (!this.checkFolderWritePermission(this.resourcesPath)) {
        args.push('-Verb RunAs')
      }
    }

    this.logger.info(`Start update process. Command:${cmd}, Args:${args.join(' ')}`)
    try {
      const childProcess = spawnSync(cmd, args, options)
      if (childProcess.status === 1) {
        throw new Error('The operation has been canceled by the user')
      }
    } catch (error) {
      throw new Error('Start shell process Error: ' + error)
    }
  }

  /**
   * Format URL and add prefix.
   */
  private formatDownloadUrl(fileUrl: string) {
    if (/^https?:\/\/.*/.test(fileUrl)) {
      return fileUrl
    } else {
      return `${this.publish.url}/${fileUrl}`
    }
  }

  /**
   * Check for write permission by writing files to the folder.
   * Why not fs.access: https://github.com/nodejs/node/issues/34395.
   */
  private checkFolderWritePermission(folder: string) {
    try {
      const file = join(folder, 'permission.txt')
      fse.writeFileSync(file, 'check folder write permission.')
      fse.removeSync(file)
      return true
    } catch (error) {
      return false
    }
  }
}
