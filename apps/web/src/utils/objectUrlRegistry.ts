export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

export interface ObjectUrlRegistry {
  create(blob: Blob): string
  revokeAll(): void
}

export function createObjectUrlRegistry(api: ObjectUrlApi = URL): ObjectUrlRegistry {
  const urls = new Set<string>()

  return {
    create(blob: Blob) {
      const url = api.createObjectURL(blob)
      urls.add(url)
      return url
    },
    revokeAll() {
      for (const url of urls) {
        api.revokeObjectURL(url)
      }
      urls.clear()
    },
  }
}
