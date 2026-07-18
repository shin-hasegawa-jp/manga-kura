import type { AcquisitionApiClientError } from './acquisitionApiClient'
import { ImageBlobFetchError } from './imageBlobClient'
import type { ImageCandidate } from './imageCandidateFactory'
import { PageHtmlFetchError } from './pageHtmlClient'

export function toPageHtmlFetchError(error: AcquisitionApiClientError): PageHtmlFetchError {
  if (error.kind === 'unsupportedContentType' || error.code === 'unsupported_content_type') {
    return new PageHtmlFetchError('unsupportedContentType', error.message, {
      contentType: error.contentType,
    })
  }
  if (error.kind === 'network' || error.kind === 'invalidResponse') {
    return new PageHtmlFetchError('network', error.message)
  }
  return new PageHtmlFetchError('http', error.message, { status: error.status })
}

export function toImageBlobFetchError(
  error: AcquisitionApiClientError,
  candidate: Pick<ImageCandidate, 'id' | 'imageUrl'>,
): ImageBlobFetchError {
  const details = {
    candidateId: candidate.id,
    imageUrl: candidate.imageUrl,
    status: error.status,
    contentType: error.contentType,
  }
  if (error.kind === 'unsupportedContentType' || error.code === 'unsupported_content_type') {
    return new ImageBlobFetchError('unsupportedContentType', error.message, details)
  }
  if (error.kind === 'network' || error.kind === 'invalidResponse') {
    return new ImageBlobFetchError('network', error.message, details)
  }
  return new ImageBlobFetchError('http', error.message, details)
}
