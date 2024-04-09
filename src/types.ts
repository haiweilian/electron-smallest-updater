import type { Options } from 'got'

export interface UpdateInfo {
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

export interface ProgressInfo {
  total: number
  percent: number
  transferred: number
}

export interface UpdateDownloadedInfo extends UpdateInfo {
  downloadFilePath: string
  downloadUnzipPath: string
}

export interface Logger {
  info(message?: any): void
  warn(message?: any): void
  error(message?: any): void
  debug?(message: string): void
}

export interface Publish {
  url: string
  options?: Options
  provider?: 'generic'
}

export interface SmallestUpdaterOptions {
  logger?: Logger
  channel?: string
  publish: Publish
  autoDownload?: boolean
  autoInstallOnAppQuit?: boolean
  forceDevUpdateConfig?: boolean
}

export interface SmallestUpdaterEvents {
  error: (error: Error, message?: string) => void
  'checking-for-update': () => void
  'update-not-available': (info: UpdateInfo) => void
  'update-available': (info: UpdateInfo) => void
  'update-downloaded': (event: UpdateDownloadedInfo) => void
  'download-progress': (info: ProgressInfo) => void
  'update-cancelled': (info: UpdateInfo) => void
}

export interface SmallestBuilderOptions {
  channel?: string
  resources?: string[]
  urlPrefix?: string
}
