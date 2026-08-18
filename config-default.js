export default {
  // 项目文件夹
  projectPath: 'projects',

  // 部署使用的账号 默认为 developer
  sshUser: 'developer',

  // 环境变量
  env: {
    path: [],
  },

  // docker 镜像仓库全局默认配置（可选）
  docker: {
    // 默认镜像仓库地址，项目未单独配置 registry 时使用；留空则 imageName 需写全路径
    registry: '',
  },
}
