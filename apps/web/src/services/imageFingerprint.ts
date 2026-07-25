export type ImageDuplicateReason = 'same-content' | 'same-url'

export interface ImageFingerprint {
  normalizedSourceUrl: string
  contentHash: string
}

export function normalizeImageSourceUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl)
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()

  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = ''
  }

  return url.toString()
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createImageContentHash(
  blob: Blob,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<string> {
  const digest = await subtle.digest('SHA-256', await blob.arrayBuffer())
  return toHex(new Uint8Array(digest))
}

export async function createImageFingerprint(
  image: { blob: Blob; sourceUrl: string },
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<ImageFingerprint> {
  return {
    normalizedSourceUrl: normalizeImageSourceUrl(image.sourceUrl),
    contentHash: await createImageContentHash(image.blob, subtle),
  }
}

export function getImageDuplicateReasons(
  left: { sourceUrl: string; contentHash?: string },
  right: { sourceUrl: string; contentHash?: string },
): ImageDuplicateReason[] {
  const reasons: ImageDuplicateReason[] = []
  if (normalizeImageSourceUrl(left.sourceUrl) === normalizeImageSourceUrl(right.sourceUrl)) {
    reasons.push('same-url')
  }
  if (left.contentHash !== undefined && left.contentHash === right.contentHash) {
    reasons.push('same-content')
  }
  return reasons
}
