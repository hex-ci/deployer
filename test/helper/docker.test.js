import { describe, it, expect } from 'vitest'
import docker from '../../helper/docker.js'

describe('resolveImage', () => {
  it('项目 registry 优先', () => {
    expect(docker.resolveImage({ registry: 'proj.reg', imageName: 'demo' }, {})).toBe('proj.reg/demo')
  })

  it('项目 registry 空时落全局', () => {
    expect(docker.resolveImage({ registry: '', imageName: 'demo' }, { docker: { registry: 'global.reg' } })).toBe('global.reg/demo')
  })

  it('两者都空时用 imageName 原样', () => {
    expect(docker.resolveImage({ registry: '', imageName: 'full/path/demo' }, { docker: { registry: '' } })).toBe('full/path/demo')
  })

  it('无 docker 全局配置时用 imageName', () => {
    expect(docker.resolveImage({ registry: '', imageName: 'demo' }, {})).toBe('demo')
  })
})

describe('imageTag', () => {
  it('拼接镜像名与 tag', () => {
    expect(docker.imageTag('reg/demo', '123')).toBe('reg/demo:123')
  })
})

describe('命令拼接', () => {
  it('buildCmd', () => {
    expect(docker.buildCmd('reg/demo', '123', 'Dockerfile')).toBe('docker build -t reg/demo:123 -f Dockerfile .')
  })

  it('pushCmd', () => {
    expect(docker.pushCmd('reg/demo', '123')).toBe('docker push reg/demo:123')
  })

  it('pullCmd', () => {
    expect(docker.pullCmd('reg/demo', '123')).toBe('docker pull reg/demo:123')
  })

  it('pruneCmd', () => {
    expect(docker.pruneCmd()).toBe('docker image prune -f')
  })

  it('sshCmd', () => {
    expect(docker.sshCmd('dev', '1.2.3.4', 'docker pull x')).toBe(`ssh dev@1.2.3.4 'docker pull x'`)
  })

  it('deployCmd', () => {
    expect(docker.deployCmd('reg/demo', '123', '/srv/app', 'docker-compose.yml')).toBe('docker pull reg/demo:123 && cd /srv/app && IMAGE=reg/demo TAG=123 docker compose -f docker-compose.yml up -d')
  })
})

describe('composeEnvFile', () => {
  it('yml 生成环境变体', () => {
    expect(docker.composeEnvFile('docker-compose.yml', 'test')).toBe('docker-compose.test.yml')
    expect(docker.composeEnvFile('docker-compose.yml', 'online')).toBe('docker-compose.online.yml')
  })

  it('非 yml/yaml 后缀原样返回', () => {
    expect(docker.composeEnvFile('compose', 'test')).toBe('compose')
  })
})
