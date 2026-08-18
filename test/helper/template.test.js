import { describe, it, expect } from 'vitest'
import template from '../../helper/template.js'

describe('template', () => {
  it('替换单个 {{var}}', () => {
    expect(template('hello {{name}}', { name: 'world' })).toBe('hello world')
  })

  it('替换多个变量', () => {
    expect(template('{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-2')
  })

  it('替换同名变量的所有出现', () => {
    expect(template('{{x}} {{x}}', { x: 'y' })).toBe('y y')
  })

  it('vars 中没有的占位符保持原样', () => {
    expect(template('hi {{missing}}', { a: 'b' })).toBe('hi {{missing}}')
  })

  it('空 vars 原样返回', () => {
    expect(template('abc', {})).toBe('abc')
  })

  it('key 含正则特殊字符时按字面替换', () => {
    expect(template('{{a.b}}', { 'a.b': 'c' })).toBe('c')
  })

  it('占位符只替换完整 key，不误伤前缀', () => {
    expect(template('{{version}} {{versionId}}', { versionId: '1' })).toBe('{{version}} 1')
  })
})
