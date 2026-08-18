import fs from 'fs'
import echo from './echo.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const banner = () => {
  echo.info(`===== 欢迎使用轻量级部署工具 Deployer Ver ${pkg.version} =====`)
}

export default banner
