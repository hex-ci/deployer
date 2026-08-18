import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import json from '../../helper/json.js'

let dir

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-json-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('json', () => {
  it('write 后 read 回相同结构', () => {
    const file = path.join(dir, 'x.json')
    const data = { a: 1, b: [1, 2, 3], c: { d: true } }

    json.write(file, data)

    expect(json.read(file)).toEqual(data)
  })

  it('read 不存在的文件返回 {}', () => {
    expect(json.read(path.join(dir, 'nope.json'))).toEqual({})
  })

  it('read 非法 JSON 返回 {}', () => {
    const file = path.join(dir, 'bad.json')
    fs.writeFileSync(file, 'not { valid json')

    expect(json.read(file)).toEqual({})
  })

  it('write 覆盖已存在文件', () => {
    const file = path.join(dir, 'y.json')

    json.write(file, { old: true })
    json.write(file, { new: true })

    expect(json.read(file)).toEqual({ new: true })
  })
})
