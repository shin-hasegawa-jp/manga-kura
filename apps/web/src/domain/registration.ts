import * as v from 'valibot'

const idSchema = v.pipe(v.string(), v.minLength(1))
const titleSchema = v.pipe(v.string(), v.minLength(1))
const sourcePageUrlSchema = v.pipe(v.string(), v.url())

const episodeRegistrationSchema = {
  title: titleSchema,
  sourcePageUrl: sourcePageUrlSchema,
}

export const createSeriesRegistrationSchema = v.object({
  seriesTitle: titleSchema,
  ...episodeRegistrationSchema,
})

export const createStandaloneEpisodeRegistrationSchema = v.object({
  ...episodeRegistrationSchema,
})

export const addEpisodeToSeriesRegistrationSchema = v.object({
  seriesId: idSchema,
  ...episodeRegistrationSchema,
})

export type CreateSeriesRegistration = v.InferOutput<typeof createSeriesRegistrationSchema>
export type CreateStandaloneEpisodeRegistration = v.InferOutput<
  typeof createStandaloneEpisodeRegistrationSchema
>
export type AddEpisodeToSeriesRegistration = v.InferOutput<
  typeof addEpisodeToSeriesRegistrationSchema
>

export function validateCreateSeriesRegistration(input: unknown): CreateSeriesRegistration {
  return v.parse(createSeriesRegistrationSchema, input)
}

export function validateCreateStandaloneEpisodeRegistration(
  input: unknown,
): CreateStandaloneEpisodeRegistration {
  return v.parse(createStandaloneEpisodeRegistrationSchema, input)
}

export function validateAddEpisodeToSeriesRegistration(
  input: unknown,
): AddEpisodeToSeriesRegistration {
  return v.parse(addEpisodeToSeriesRegistrationSchema, input)
}
