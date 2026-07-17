export type PageUrlValidation =
  | { status: 'valid'; url: string }
  | { status: 'invalid'; message: string }

export type PageUrlSubmission =
  | { status: 'success'; message: string; url: string }
  | { status: 'error'; message: string }

export function validatePageUrl(input: string): PageUrlValidation {
  const trimmedInput = input.trim()

  if (trimmedInput === '') {
    return { status: 'invalid', message: 'URLを入力してください。' }
  }

  let url: URL

  try {
    url = new URL(trimmedInput)
  } catch {
    return { status: 'invalid', message: '有効な絶対URLを入力してください。' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { status: 'invalid', message: 'httpまたはhttpsのURLを入力してください。' }
  }

  return { status: 'valid', url: url.href }
}

export async function submitPageUrl(
  input: string,
  onValidUrl: (url: string) => void | Promise<void>,
): Promise<PageUrlSubmission> {
  const validation = validatePageUrl(input)

  if (validation.status === 'invalid') {
    return { status: 'error', message: validation.message }
  }

  await onValidUrl(validation.url)

  return { status: 'success', message: 'URLを確認しました。', url: validation.url }
}
