export default {
  resolveImage(data, config) {
    if (data.registry) {
      return `${data.registry}/${data.imageName}`
    }

    if (config.docker && config.docker.registry) {
      return `${config.docker.registry}/${data.imageName}`
    }

    return data.imageName
  },

  imageTag(image, tag) {
    return `${image}:${tag}`
  },

  buildCmd(image, tag, dockerfile) {
    return `docker build -t ${image}:${tag} -f ${dockerfile} .`
  },

  pushCmd(image, tag) {
    return `docker push ${image}:${tag}`
  },

  pullCmd(image, tag) {
    return `docker pull ${image}:${tag}`
  },

  pruneCmd() {
    return 'docker image prune -f'
  },

  sshCmd(user, host, cmd) {
    return `ssh ${user}@${host} '${cmd}'`
  },

  composeEnvFile(composeFile, env) {
    const match = composeFile.match(/^(.*)\.(ya?ml)$/)

    if (!match) {
      return composeFile
    }

    return `${match[1]}.${env}.${match[2]}`
  },

  deployCmd(image, tag, deployPath, composeFile) {
    return `docker pull ${image}:${tag} && cd ${deployPath} && IMAGE=${image} TAG=${tag} docker compose -f ${composeFile} up -d`
  },
}
