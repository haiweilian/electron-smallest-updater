import path from 'path'
import AdmZip from 'adm-zip'
import { AfterPackContext } from 'electron-builder'
import fg from 'fast-glob'
import fse from 'fs-extra'
import type { UpdateInfo, SmallestBuilderOptions } from './types'
import { calcSha512 } from './utils'

const defaultChannel = 'latest-smallest.json'
const defaultResources = ['app.asar', 'app/**', 'app.asar.unpacked/**']

export async function smallestBuilder(context: AfterPackContext, options?: SmallestBuilderOptions) {
  const appInfo = context.packager.appInfo
  const platform = context.electronPlatformName
  const resources = options?.resources || defaultResources
  const outChannelName = options?.channel || defaultChannel
  const outChannelPath = path.join(context.outDir, outChannelName)
  const outResourceFileName = `${appInfo.productName}-${appInfo.version}-smallest.zip`
  const outResourceFilePath = path.join(context.outDir, outResourceFileName)

  // find resources
  let resourcesPath
  if (platform === 'darwin') {
    resourcesPath = path.join(context.appOutDir, `${appInfo.productName}.app`, 'Contents', 'Resources')
  } else {
    resourcesPath = path.join(context.appOutDir, 'resources')
  }

  // write zip file
  const zip = new AdmZip()
  for (const resource of resources) {
    const files = await fg(resource, {
      cwd: resourcesPath,
    })
    for (const file of files) {
      zip.addLocalFile(path.join(resourcesPath, file), path.dirname(file))
    }
  }
  zip.writeZip(outResourceFilePath)

  // write publish json
  const publishJSON: UpdateInfo = {
    version: appInfo.version,
    releaseFile: {
      url: options?.urlPrefix ? `${options?.urlPrefix}/${outResourceFileName}` : outResourceFileName,
      size: (await fse.stat(outResourceFilePath)).size,
      sha512: await calcSha512(outResourceFilePath),
    },
    releaseDate: new Date().toISOString(),
    releaseName: `Update ${appInfo.version}`,
    releaseNotes: `Update for version ${appInfo.version} is available`,
  }
  await fse.writeJSON(outChannelPath, publishJSON, { spaces: 2 })
}
