import * as v from 'valibot'

const imageSourceAttributeSchema = v.picklist([
  'data-srcset',
  'srcset',
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-original-src',
  'data-lazy',
  'src',
])

const apiImageCandidateSchema = v.object({
  id: v.pipe(v.string(), v.nonEmpty()),
  domOrder: v.pipe(v.number(), v.integer(), v.minValue(0)),
  imageUrl: v.pipe(v.string(), v.url()),
  sourceAttribute: imageSourceAttributeSchema,
  parentGroupId: v.nullable(v.pipe(v.string(), v.maxLength(32), v.regex(/^image-parent-\d+$/))),
  cssClasses: v.pipe(
    v.array(v.pipe(v.string(), v.nonEmpty(), v.maxLength(64), v.regex(/^[A-Za-z0-9_-]+$/))),
    v.maxLength(8),
  ),
  proxyToken: v.pipe(v.string(), v.nonEmpty()),
  previewToken: v.pipe(v.string(), v.nonEmpty()),
})

export const pageAnalysisResponseSchema = v.object({
  pageUrl: v.pipe(v.string(), v.url()),
  pageTitle: v.nullable(v.pipe(v.string(), v.nonEmpty(), v.maxLength(200))),
  acquisitionMethod: v.literal('api'),
  candidates: v.array(apiImageCandidateSchema),
})

const apiErrorDetailValueSchema = v.union([v.string(), v.number(), v.boolean()])

export const acquisitionApiErrorResponseSchema = v.object({
  error: v.object({
    code: v.pipe(v.string(), v.nonEmpty()),
    message: v.pipe(v.string(), v.nonEmpty()),
    retryable: v.boolean(),
    details: v.nullable(v.record(v.string(), apiErrorDetailValueSchema)),
  }),
})

export type PageAnalysisResponse = v.InferOutput<typeof pageAnalysisResponseSchema>
export type ApiImageCandidate = v.InferOutput<typeof apiImageCandidateSchema>
export type AcquisitionApiErrorResponse = v.InferOutput<typeof acquisitionApiErrorResponseSchema>

export function parsePageAnalysisResponse(input: unknown): PageAnalysisResponse | undefined {
  const result = v.safeParse(pageAnalysisResponseSchema, input)
  return result.success ? result.output : undefined
}

export function parseAcquisitionApiErrorResponse(
  input: unknown,
): AcquisitionApiErrorResponse | undefined {
  const result = v.safeParse(acquisitionApiErrorResponseSchema, input)
  return result.success ? result.output : undefined
}
