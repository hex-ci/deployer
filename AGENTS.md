# deployer 轻量级部署工具

Node.js 命令行部署工具（无框架、ESM），在本地对项目执行「构建 → 打包 → 发布/回滚」：从 git/svn 拉源码，执行项目自带的 `build.sh` 产出 `dist`，`tar` 打包 + `rsync` 同步到测试/生产服务器，保留历史版本供回滚。所有用户可见文案为中文。

## 技术栈

- Node.js，ESM（`import`/`export`，`package.json` 里 `"type": "module"`；无 TS）
- 依赖：yargs 18（CLI，`yargs(hideBin(process.argv)).parse()`）、shelljs 0.10（执行 shell）、inquirer 14（`inquirer.prompt()` Promise 化，选择题用 `type: 'select'` 而非 `list`）、chalk 6、lodash 4
- lint：eslint 10（flat config，`eslint.config.js`）+ `@stylistic/eslint-plugin`
- 测试：Vitest + @vitest/coverage-v8（`test/**/*.test.js`，`vi.mock` mock shelljs/inquirer/fs 等副作用）；覆盖率门槛 90%（当前 100%）
- 包管理器：pnpm

## 目录结构

- `index.js`　CLI 入口，用 yargs 注册 `lib/` 下的子命令
- `lib/`　每个命令一个文件（create / build / deploy / rollback），统一用命名导出 `export const command`/`describe`/`builder`/`handler`（index.js 以 `import * as` 引入后交给 yargs `.command()`；不是 `export default` 对象）
- `helper/`　共享工具：echo（彩色输出）、json（读写 data 文件）、snapshot（md5 快照/差异）、exclude-include（rsync 过滤参数）、read-data、template（`{{var}}` 替换）、banner、clear-backup
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

`config.js` 字段：`projectPath`、`sshUser`、`env`（对象，构建时键名转大写；值为数组则用 `path.delimiter` 拼接后注入 build.sh 的 PATH 类环境变量）。

## 命令

入口是可执行文件 `./index.js`：

```
./index.js build <项目> [params]    # 更新代码 -> 执行 build.sh -> 打包 -> rsync 到回归机
./index.js deploy <项目>            # rsync destination/ 到生产服务器
./index.js rollback <项目> <版本ID> # 用 history/<版本ID>-bak.tgz 恢复
./index.js create                   # 交互式新建项目并写 data.json
```

`pnpm run test`（Vitest）跑单元测试，`pnpm run test:coverage` 输出覆盖率；`./index.js` 无参数运行会因 `demandCommand` 报「请输入有效的命令」。

## 约定

- 每个项目的 `repository/build.sh` 是构建入口，以其所在目录为 cwd 执行；build 的 `[params]` 作为 `$1 $2 $3…` 传入 build.sh。build.sh 须把产物放进 `distPath`（默认 `dist`）。
- 项目名正则 `^[a-z0-9_-]{3,50}$`（create 校验）。
- `data.json` 项目字段：`name`、`repositoryType`(git|svn)、`distPath`、`exclude`/`include`（逗号分隔，存入数组）、`testServers`/`testDeployPath`、`onlineServers`/`onlineDeployPath`、`isFullSync`（true 时 rsync 加 `--delete`）；可选 `backupExpires`、`rollbackCommandTips`/`buildCommandTips`（`{{var}}` 模板）。
- 代码风格：2 空格缩进、无分号、单引号、左花括号不换行、else 换行（stroustrup brace-style），由 eslint flat config（`eslint.config.js`）+ `@stylistic/eslint-plugin` 约束；package.json 无 lint script，直接跑 `./node_modules/.bin/eslint`。

## 坑

- `config.js`、`data.json`、整个 `projects/` 目录都在 .gitignore 里——它们是本地运行态数据，不是源码，别当改动提交。
- build 会在项目 `data/lock` 写当前用户锁定项目；他人 build/部署同项目会被拒绝，别删别人的 lock。
- 回滚依赖 `history/<版本ID>-bak.tgz`，版本 ID 是 build 时的毫秒时间戳；build 输出末尾会提示对应的回滚/部署命令。
- 主机需有 `rsync`、`tar`、`git`（svn 项目还需 `svn`）；部署通过 `sshUser@host` 走 ssh。
- `"type": "module"` 下没有 `__dirname`/`require`：取当前文件路径用 `path.dirname(fileURLToPath(import.meta.url))`，读 `package.json`/`data.json` 用 `new URL('../xx.json', import.meta.url)`；`config.js` 本身也必须是 ESM（`export default {…}`），否则 import 会报 `module is not defined`。
