import { z } from 'zod'
import { DEFAULT_SETTINGS } from './defaults'
import type { AppSettings, ScriptInput } from './types'

const idSchema = z.string().trim().min(1).max(128)
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const scriptInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(500_000),
  position: z.number().finite().min(0).optional()
}).strict()

export const settingsPatchSchema = z.object({
  version: z.literal(2).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  scrollSpeed: z.number().finite().min(10).max(200).optional(),
  fontSize: z.number().finite().min(24).max(96).optional(),
  lineHeight: z.number().finite().min(1).max(2.5).optional(),
  textAlign: z.enum(['left', 'center']).optional(),
  textColor: colorSchema.optional(),
  backgroundColor: colorSchema.optional(),
  backgroundOpacity: z.number().finite().min(0.1).max(1).optional(),
  transparentMode: z.boolean().optional(),
  overlayWidth: z.number().finite().min(320).max(1600).optional(),
  hideFromCapture: z.boolean().optional(),
  hasSeenLockHint: z.boolean().optional(),
  hasSeenTrayNotice: z.boolean().optional(),
  overlayBounds: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(320).max(4000),
    height: z.number().int().min(180).max(3000),
    displayId: z.string().optional()
  }).optional()
}).strict()

const storedSettingsSchema = settingsPatchSchema.extend({
  version: z.union([z.literal(1), z.literal(2)]).optional()
})

export function parseScriptInput(input: unknown): ScriptInput {
  return scriptInputSchema.parse(input)
}

export function normalizeSettings(input: unknown): AppSettings {
  const parsed = storedSettingsSchema.safeParse(input)
  if (!parsed.success) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...parsed.data, version: 2 }
}

export function parseSettingsPatch(input: unknown): Partial<AppSettings> {
  return settingsPatchSchema.parse(input)
}

export function parseId(input: unknown): string {
  return idSchema.parse(input)
}

export function clampPosition(value: unknown): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.round(number * 100) / 100)
}
