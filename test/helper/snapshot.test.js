import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import snapshot from '../../helper/snapshot.js'

let dir
let root

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deployer-snapshot-'))
  root = path.join(dir, 'src')
  fs.mkdirSync(root)
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (rel, content) => {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content)
}

const md5 = (str) => {
  return crypto.createHash('md5').update(str).digest('hex')
}

describe('snapshot.make', () => {
  it('为每个文件生成 md5，key 为相对根目录的路径', () => {
    write('a.txt', 'hello')
    write('sub/b.txt', 'world')

    const manifest = snapshot.make(root)

    expect(Object.keys(manifest).sort()).toEqual(['/a.txt', '/sub/b.txt'])
    expect(manifest['/a.txt']).toBe(md5('hello'))
    expect(manifest['/sub/b.txt']).toBe(md5('world'))
  })

  it('空目录返回空对象', () => {
    expect(snapshot.make(root)).toEqual({})
  })
})

describe('snapshot.check', () => {
  it('内容无变化时返回空对象', () => {
    write('a.txt', 'same')

    const diff = snapshot.check(snapshot.make(root), root)

    expect(diff).toEqual({})
  })

  it('新增文件会出现在 diff 中', () => {
    write('a.txt', 'x')
    const manifest = snapshot.make(root)
    write('b.txt', 'y')

    const diff = snapshot.check(manifest, root)

    expect(Object.keys(diff)).toEqual(['/b.txt'])
  })

  it('内容改变的文件会出现在 diff 中', () => {
    write('a.txt', 'v1')
    const manifest = snapshot.make(root)
    write('a.txt', 'v2')

    const diff = snapshot.check(manifest, root)

    expect(Object.keys(diff)).toEqual(['/a.txt'])
    expect(diff['/a.txt']).toBe(md5('v2'))
  })

  it('被删除的文件不会被检出（check 只报新增/修改）', () => {
    write('a.txt', 'x')
    const manifest = snapshot.make(root)
    fs.rmSync(path.join(root, 'a.txt'))

    expect(snapshot.check(manifest, root)).toEqual({})
  })
})
