# 轻量级部署工具

基于 Linux 和 Mac 命令行的轻量级部署工具，支持备份、回滚、构建和发布。

## 安装

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
