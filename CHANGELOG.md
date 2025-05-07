

# [0.2.0](https://github.com/haiweilian/electron-smallest-updater/compare/0.1.1...0.2.0) (2025-05-07)


### Features

* optimize ([#3](https://github.com/haiweilian/electron-smallest-updater/issues/3)) ([ad8d572](https://github.com/haiweilian/electron-smallest-updater/commit/ad8d5728afe5b4feff81fd629746f03997f27541))

- 修复构建包名称问题 `productName` 改为 `name`。
- 修复 `got` 请求配置接受错误。
- 优化更新下载目录，下载资源到 `SmallestUpdater` 独立目录。
- 优化更新下载进度值 `percent` 改为百分值，与 electron-updater 一致。
- 新增平均每秒下载字节大小 `bytesPerSecond`，用于计算预计剩余时间。

## [0.1.1](https://github.com/haiweilian/electron-smallest-updater/compare/0.1.0...0.1.1) (2025-04-30)


### Bug Fixes

* 更新不可用时，停用自动更新，zip文件解压缩时error的问题 ([#2](https://github.com/haiweilian/electron-smallest-updater/issues/2)) ([5c4569e](https://github.com/haiweilian/electron-smallest-updater/commit/5c4569ef2e4c7a4470b36a1162e4d4a7b59cdc37))

# [0.1.0](https://github.com/haiweilian/electron-smallest-updater/compare/0.0.2...0.1.0) (2024-07-23)


### Features

* linux builder ([#1](https://github.com/haiweilian/electron-smallest-updater/issues/1)) ([fa44c77](https://github.com/haiweilian/electron-smallest-updater/commit/fa44c776af1035c6d23579186e5d1d7ffc317b48))

## 0.0.2 (2024-04-09)
