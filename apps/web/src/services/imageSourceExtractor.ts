export interface ImageSourceExtractorDependencies {
  parseHtml(html: string): Document
}

const defaultDependencies: ImageSourceExtractorDependencies = {
  parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html')
  },
}

export function extractImageSources(
  html: string,
  dependencies: ImageSourceExtractorDependencies = defaultDependencies,
): string[] {
  const document = dependencies.parseHtml(html)
  const sources: string[] = []
  const seenSources = new Set<string>()

  for (const image of document.querySelectorAll('img[src]')) {
    const source = image.getAttribute('src')?.trim() ?? ''

    if (source === '' || seenSources.has(source)) {
      continue
    }

    seenSources.add(source)
    sources.push(source)
  }

  return sources
}
