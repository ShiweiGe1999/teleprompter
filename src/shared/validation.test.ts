import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './defaults'
import { normalizeSettings, parseScriptInput, parseSettingsPatch } from './validation'

describe('validation', () => {
  it('accepts a valid script and trims its title', () => {
    expect(parseScriptInput({ title: '  Intro  ', body: 'Hello' })).toEqual({ title: 'Intro', body: 'Hello' })
  })

  it('rejects unknown script fields and blank titles', () => {
    expect(() => parseScriptInput({ title: '', body: '', extra: true })).toThrow()
  })

  it('normalizes corrupt settings back to safe defaults', () => {
    expect(normalizeSettings({ scrollSpeed: 500 })).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts bounded settings patches', () => {
    expect(parseSettingsPatch({ fontSize: 72, backgroundOpacity: 0.5, transparentMode: true })).toEqual({ fontSize: 72, backgroundOpacity: 0.5, transparentMode: true })
    expect(() => parseSettingsPatch({ fontSize: 12 })).toThrow()
  })
})
