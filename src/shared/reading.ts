import type { AppSettings, Script } from './types'

export const READING_WORDS_PER_MINUTE = 150

export interface ReadingMetrics {
  wordCount: number
  totalMinutes: number
  remainingMinutes: number
  progressPercent: number
}

export function getReadingMetrics(script: Pick<Script, 'body' | 'position'>, settings: Pick<AppSettings, 'overlayWidth' | 'fontSize' | 'lineHeight'>): ReadingMetrics {
  const trimmed = script.body.trim()
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0
  const totalMinutes = wordCount / READING_WORDS_PER_MINUTE
  if (!trimmed) return { wordCount: 0, totalMinutes: 0, remainingMinutes: 0, progressPercent: 0 }

  const charactersPerLine = Math.max(18, settings.overlayWidth / (settings.fontSize * 0.56))
  const lineCount = script.body.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0)
  const estimatedHeight = Math.max(settings.fontSize * settings.lineHeight, lineCount * settings.fontSize * settings.lineHeight)
  const progress = Math.min(1, Math.max(0, script.position / estimatedHeight))
  return {
    wordCount,
    totalMinutes,
    remainingMinutes: totalMinutes * (1 - progress),
    progressPercent: Math.round(progress * 100)
  }
}
