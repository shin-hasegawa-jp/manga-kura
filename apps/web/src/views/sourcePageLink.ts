import { validatePageUrl } from './savePageUrlValidation'

export function getSourcePageLink(sourcePageUrl: string | undefined): string | undefined {
  if (sourcePageUrl === undefined) return undefined
  const result = validatePageUrl(sourcePageUrl)
  return result.status === 'valid' ? result.url : undefined
}
