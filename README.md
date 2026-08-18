# 轻量级部署工具

[![codecov](https://codecov.io/github/hex-ci/deployer/graph/badge.svg)](https://codecov.io/github/hex-ci/deployer)

基于 Linux 和 Mac 命令行的轻量级部署工具，支持备份、回滚、构建和发布。

## 安装

执行 `pnpm install` 安装依赖。

复制 `config-default.js` 文件为 `config.js` 文件。

## 使用方法

### 构建项目

`./index.js build <项目名称> [其它参数]`

### 部署项目

`./index.js deploy <项目名称>`

### 回滚项目

`./index.js rollback <项目名称> <版本ID>`

### 示例

`./index.js build demo_project`

## 项目构建流程

项目需在源码根目录提供 `build.sh` 脚本来进行自定义构建流程。

工具会在 build 命令中，以源码根目录为当前目录执行 `build.sh` 脚本。

执行 `build.sh` 前，会设置 PATH 环境变量，以便执行 node、gulp 和 php 等命令。

`build.sh` 脚本需把生成后的文件，放到创建项目时指定的目标目录中，工具会把这个目录中的文件以 rsync 方式部署到目标服务器中。

### vue-cli 项目 build.sh 示例

```bash
if [[ $1 = "clean" ]]; then
  echo "=== 安装依赖并清理 ==="

  npm ci --registry=https://registry.npmmirror.com
fi

npm run build
```

## Docker 部署

创建项目时选择部署类型 `docker`（默认 `file`），即可用镜像部署替代文件同步。

docker 项目要求 `Dockerfile`（镜像定义源，必有）；可选 `docker-compose.yml` 定义容器如何运行，test/online 跑法不同时分别放 `docker-compose.test.yml` / `docker-compose.online.yml`。

- 构建：`./index.js build <项目>` 执行 `docker build` 并推送到镜像仓库；有 `build.sh` 时注入 `IMAGE`/`TAG` 环境变量交给用户自定义构建。
- 部署：`./index.js deploy <项目>` 在目标服务器 `docker pull` 同一镜像并用 compose 起容器。
- 回滚：`./index.js rollback <项目> <版本ID>` 用旧版本 tag 重新拉起容器。

镜像 tag 就是构建时的版本 ID，registry 里的历史 tag 永久保留用于回滚；只清理服务器本地悬空镜像。镜像仓库认证通过运行机上的 `docker login` 预置授权，工具不记录密码。
