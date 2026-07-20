import * as v from 'valibot'

const idSchema = v.pipe(v.string(), v.minLength(1))
const titleSchema = v.pipe(v.string(), v.minLength(1))
const nonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0))
const positiveIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(1))
const urlSchema = v.pipe(v.string(), v.url())

export const seriesSchema = v.object({
  id: idSchema,
  title: titleSchema,
  thumbnailImageId: v.optional(idSchema),
  createdAt: v.date(),
  updatedAt: v.date(),
  lastReadAt: v.optional(v.date()),
  episodeCount: nonNegativeIntegerSchema,
})

export const episodeSchema = v.object({
  id: idSchema,
  seriesId: v.optional(idSchema),
  title: titleSchema,
  episodeNumber: v.optional(v.pipe(v.number(), v.minValue(0))),
  sourcePageUrl: urlSchema,
  createdAt: v.date(),
  updatedAt: v.date(),
  lastReadAt: v.optional(v.date()),
  thumbnailImageId: v.optional(idSchema),
  scrollPosition: v.pipe(v.number(), v.minValue(0)),
  scrollProgress: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  savedContentHeight: v.optional(v.pipe(v.number(), v.minValue(0))),
})

export const comicImageSchema = v.object({
  id: idSchema,
  episodeId: idSchema,
  displayOrder: nonNegativeIntegerSchema,
  blob: v.blob(),
  sourceUrl: urlSchema,
  mimeType: v.pipe(v.string(), v.minLength(1)),
  fileSize: nonNegativeIntegerSchema,
  width: positiveIntegerSchema,
  height: positiveIntegerSchema,
  createdAt: v.date(),
})

export const appSettingsSchema = v.object({
  id: v.literal('app'),
  sortOrder: v.picklist(['recentlyRead', 'recentlyAdded']),
  displaySettings: v.object({
    theme: v.picklist(['system', 'light', 'dark']),
  }),
  schemaVersion: positiveIntegerSchema,
  offlineSettings: v.object({
    enabled: v.boolean(),
  }),
  storageSettings: v.object({
    warningThresholdBytes: nonNegativeIntegerSchema,
  }),
})

export type Series = v.InferOutput<typeof seriesSchema>
export type Episode = v.InferOutput<typeof episodeSchema>
export type ComicImage = v.InferOutput<typeof comicImageSchema>
export type AppSettings = v.InferOutput<typeof appSettingsSchema>

export function validateSeries(input: unknown): Series {
  return v.parse(seriesSchema, input)
}

export function validateEpisode(input: unknown): Episode {
  return v.parse(episodeSchema, input)
}

export function validateComicImage(input: unknown): ComicImage {
  return v.parse(comicImageSchema, input)
}

export function validateAppSettings(input: unknown): AppSettings {
  return v.parse(appSettingsSchema, input)
}
