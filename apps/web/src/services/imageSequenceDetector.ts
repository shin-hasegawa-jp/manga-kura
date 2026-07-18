const SUPPORTED_IMAGE_FILENAME_PATTERN = /^(.*?)(\d+)\.(jpe?g|png|webp)$/i

export interface ImageSequenceFilename {
  prefix: string
  number: number
  numberText: string
  extension: string
}

/**
 * URLのファイル名末尾にあるページ番号を抽出する。
 * ディレクトリ名・クエリ・フラグメントに含まれる数字は判定対象にしない。
 */
export function extractImageSequenceFilename(imageUrl: string): ImageSequenceFilename | undefined {
  let url: URL

  try {
    url = new URL(imageUrl)
  } catch {
    return undefined
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined
  }

  const pathSegments = url.pathname.split('/')
  const encodedFilename = pathSegments[pathSegments.length - 1]
  if (encodedFilename === undefined || encodedFilename.length === 0) {
    return undefined
  }

  let filename: string

  try {
    filename = decodeURIComponent(encodedFilename)
  } catch {
    return undefined
  }

  const match = SUPPORTED_IMAGE_FILENAME_PATTERN.exec(filename)
  if (match === null) {
    return undefined
  }

  const [, prefix, numberText, extension] = match
  if (prefix === undefined || numberText === undefined || extension === undefined) {
    return undefined
  }

  const number = Number(numberText)
  if (!Number.isSafeInteger(number)) {
    return undefined
  }

  return {
    prefix: prefix.toLowerCase(),
    number,
    numberText,
    extension: extension.toLowerCase(),
  }
}

/** 同じ接頭辞・拡張子を持つ2枚以上の画像に、欠番のない連続番号があるかを判定する。 */
export function isLikelyImageSequence(imageUrls: readonly string[]): boolean {
  const numbersByFilenamePattern = new Map<string, Set<number>>()

  for (const imageUrl of imageUrls) {
    const filename = extractImageSequenceFilename(imageUrl)
    if (filename === undefined) {
      continue
    }

    const key = `${filename.prefix}\u0000${filename.extension}`
    const numbers = numbersByFilenamePattern.get(key) ?? new Set<number>()
    numbers.add(filename.number)
    numbersByFilenamePattern.set(key, numbers)
  }

  return [...numbersByFilenamePattern.values()].some((numbers) => {
    if (numbers.size < 2) {
      return false
    }

    const sortedNumbers = [...numbers].sort((left, right) => left - right)
    let previousNumber: number | undefined

    for (const number of sortedNumbers) {
      if (previousNumber !== undefined && number !== previousNumber + 1) {
        return false
      }
      previousNumber = number
    }

    return true
  })
}
