import type { ComicRegistrationService, RegistrationImage } from '@/database/registrationService'
import type { CreateSeriesRegistration } from '@/domain/registration'

export type NewSeriesRegistrationSubmission =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export async function submitNewSeriesRegistration(
  service: Pick<ComicRegistrationService, 'registerSeriesWithFirstEpisode'>,
  registration: CreateSeriesRegistration,
  image: RegistrationImage,
): Promise<NewSeriesRegistrationSubmission> {
  try {
    await service.registerSeriesWithFirstEpisode({ registration, image })

    return { status: 'success', message: '新規作品を登録しました。' }
  } catch {
    return {
      status: 'error',
      message: '新規作品を登録できませんでした。入力内容を確認して、もう一度お試しください。',
    }
  }
}
