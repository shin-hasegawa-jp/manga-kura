import type { ComicRegistrationService, RegistrationImage } from '@/database/registrationService'
import type { CreateStandaloneEpisodeRegistration } from '@/domain/registration'

export type StandaloneEpisodeRegistrationSubmission =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export async function submitStandaloneEpisodeRegistration(
  service: Pick<ComicRegistrationService, 'registerStandaloneEpisode'>,
  registration: CreateStandaloneEpisodeRegistration,
  image: RegistrationImage,
): Promise<StandaloneEpisodeRegistrationSubmission> {
  try {
    await service.registerStandaloneEpisode({ registration, image })

    return { status: 'success', message: '単独の話を登録しました。' }
  } catch {
    return {
      status: 'error',
      message: '単独の話を登録できませんでした。入力内容を確認して、もう一度お試しください。',
    }
  }
}
