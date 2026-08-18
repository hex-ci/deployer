# deployer 轻量级部署工具

Node.js 命令行部署工具（无框架、ESM），在本地对项目执行「构建 → 发布/回滚」。按 `deployType` 分两种部署类型：`file`（默认，`build.sh` 产出 `dist`，`tar` 打包 + `rsync` 同步到服务器）与 `docker`（构建镜像推送到 registry，服务器 `pull` + `compose` 起容器），都保留历史版本供回滚。所有用户可见文案为中文。

## 技术栈

- Node.js，ESM（`import`/`export`，`package.json` 里 `"type": "module"`；无 TS）
- 依赖：yargs 18（CLI，`yargs(hideBin(process.argv)).parse()`）、shelljs 0.10（执行 shell）、inquirer 14（`inquirer.prompt()` Promise 化，选择题用 `type: 'select'` 而非 `list`）、chalk 6、lodash 4
- lint：eslint 10（flat config，`eslint.config.js`）+ `@stylistic/eslint-plugin`
- 测试：Vitest + @vitest/coverage-v8（`test/**/*.test.js`，`vi.mock` mock shelljs/inquirer/fs 等副作用）；覆盖率门槛 90%（当前 100%）
- 包管理器：pnpm

## 目录结构

- `index.js`　CLI 入口，用 yargs 注册 `lib/` 下的子命令
- `lib/`　每个命令一个文件（create / build / deploy / rollback），统一用命名导出 `export const command`/`describe`/`builder`/`handler`（index.js 以 `import * as` 引入后交给 yargs `.command()`；不是 `export default` 对象）
- `helper/`　共享工具：echo（彩色输出）、json（读写 data 文件）、snapshot（md5 快照/差异）、exclude-include（rsync 过滤参数）、read-data、template（`{{var}}` 替换）、banner、clear-backup、docker（镜像名三级拼接 + docker 命令组装）
- `test/`　Vitest 单元测试，目录结构对齐源码（`helper/` `lib/` `index.test.js`）
- `config-default.js` → 复制为 `config.js`（本地配置，gitignore）
- `data.json`　项目注册表（gitignore，create 时写入）
- `projects/<name>/`　每个项目的工作目录：`repository/`（源码 checkout）、`destination/`（待发布产物）、`history/`（tgz 备份）、`data/`（history.json / snapshot.json / lock）、`temp/`（打包临时目录）

## 安装 / 配置

```
pnpm install
cp config-default.js config.js   # 改 sshUser 等
./index.js --help
```

`config.js` 字段：`projectPath`、`sshUser`、`env`（对象，构建时键名转大写；值为数组则用 `path.delimiter` 拼接后注入 build.sh 的 PATH 类环境变量）、`docker`（可选全局默认：`registry` 镜像仓库地址；密码不落地，靠 `docker login` 预置授权）。

## 命令

入口是可执行文件 `./index.js`：

```
./index.js build <项目> [params]    # 更新代码 -> 执行 build.sh -> 打包 -> rsync 到回归机
./index.js deploy <项目>            # rsync destination/ 到生产服务器
./index.js rollback <项目> <版本ID> # 用 history/<版本ID>-bak.tgz 恢复
./index.js create                   # 交互式新建项目并写 data.json
```

`deployType: 'docker'` 的项目：build 构建镜像并推送到 registry、发布到回归机；deploy 把同一版本部署到生产；rollback 用版本 ID 作镜像 tag 回滚。镜像一个（tag = 版本 ID），test/online 两组服务器共用同一镜像，靠 compose 的运行参数区分环境。

`pnpm run test`（Vitest）跑单元测试，`pnpm run test:coverage` 输出覆盖率；`./index.js` 无参数运行会因 `demandCommand` 报「请输入有效的命令」。

## 约定

- file 项目：`repository/build.sh` 是构建入口，以其所在目录为 cwd 执行；build 的 `[params]` 作为 `$1 $2 $3…` 传入；build.sh 须把产物放进 `distPath`（默认 `dist`）。docker 项目：`repository/Dockerfile` 必有（镜像定义源）；`build.sh` 可选，存在则注入 `IMAGE`/`TAG` 环境变量执行（build.sh 内自己 `docker build -t $IMAGE:$TAG .`），不存在则由工具直接 `docker build`。
- `build.sh` 通过 `child_process.spawnSync` + `stdio: 'inherit'` 执行，继承交互终端（可交互：pnpm 确认、密码输入等）；环境变量 = 完整 `process.env`（剔除 `NODE_ENV`/`CI`，交由构建工具自行决定）+ `config.env` 注入 + `FORCE_COLOR=1`（docker 模式额外 `IMAGE`/`TAG`）。
- 项目名正则 `^[a-z0-9_-]{3,50}$`（create 校验）。
- `data.json` 项目字段：`name`、`repositoryType`(git|svn)、`deployType`(file|docker，默认 file)、`distPath`、`exclude`/`include`（逗号分隔，存入数组）、`testServers`/`testDeployPath`、`onlineServers`/`onlineDeployPath`、`isFullSync`（true 时 rsync 加 `--delete`）；可选 `backupExpires`、`rollbackCommandTips`/`buildCommandTips`（`{{var}}` 模板）。docker 项目额外字段：`imageName`、`registry`（可空）、`dockerfile`（默认 Dockerfile）、`composeFile`（默认 docker-compose.yml）。
- 代码风格：2 空格缩进、无分号、单引号、左花括号不换行、else 换行（stroustrup brace-style），由 eslint flat config（`eslint.config.js`）+ `@stylistic/eslint-plugin` 约束；package.json 无 lint script，直接跑 `./node_modules/.bin/eslint`。

## 坑

- `config.js`、`data.json`、整个 `projects/` 目录都在 .gitignore 里——它们是本地运行态数据，不是源码，别当改动提交。
- build 会在项目 `data/lock` 写当前用户，作为并发互斥锁防止同时构建（他人此时被拒）；锁在 build 结束即自动释放——成功、失败、Ctrl+C 中断都会清，仅 kill -9/断电等强杀可能残留，可手动 `rm data/lock` 兜底。
- inquirer 14 交互中按 Ctrl+C 会 reject `ExitPromptError`（判断 `error.name === 'ExitPromptError'`，顶层不导出该类、`@inquirer/core` 是子依赖不能直接 import），不 catch 会打印整段堆栈；应捕获后友好提示并干净退出。
- 回滚依赖 `history/<版本ID>-bak.tgz`，版本 ID 是 build 时的毫秒时间戳；build 输出末尾会提示对应的回滚/部署命令。
- 主机需有 `rsync`、`tar`、`git`（svn 项目还需 `svn`）；部署通过 `sshUser@host` 走 ssh。
- `"type": "module"` 下没有 `__dirname`/`require`：取当前文件路径用 `path.dirname(fileURLToPath(import.meta.url))`，读 `package.json`/`data.json` 用 `new URL('../xx.json', import.meta.url)`；`config.js` 本身也必须是 ESM（`export default {…}`），否则 import 会报 `module is not defined`。
- docker 模式镜像名三级拼接（`helper/docker.js` 的 `resolveImage`）：项目 `registry` > 全局 `docker.registry` > `imageName` 原样；别两头都配（registry 配了又 imageName 写全路径会拼重）。
- docker 模式 compose 命名约定：默认 `docker-compose.yml`，test/online 若跑法不同可放 `docker-compose.test.yml` / `docker-compose.online.yml`（存在则优先），compose 里镜像写 `image: ${IMAGE}:${TAG}`。
- docker 模式回滚依赖 registry 里的旧 tag：只 ssh 清服务器本地悬空镜像（`docker image prune -f`），registry 旧 tag 永久保留。
- 镜像仓库认证靠 `docker login` 预置授权（`.docker/config.json`），工具不记任何凭据。
- docker 部署的前置：目标服务器需装 docker（与 rsync/tar/git 同类约定）。
