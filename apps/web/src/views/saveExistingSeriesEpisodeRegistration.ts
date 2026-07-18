import type { ComicRegistrationService, RegistrationImage } from '@/database/registrationService'
import type { AddEpisodeToSeriesRegistration } from '@/domain/registration'

export type ExistingSeriesEpisodeRegistrationSubmission =
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

export async function submitExistingSeriesEpisodeRegistration(
  service: Pick<ComicRegistrationService, 'addEpisodeToSeries'>,
  registration: AddEpisodeToSeriesRegistration,
  images: readonly RegistrationImage[],
): Promise<ExistingSeriesEpisodeRegistrationSubmission> {
  if (registration.seriesId.trim() === '') {
    return { status: 'error', message: '追加先の作品を選択してください。' }
  }

  try {
    await service.addEpisodeToSeries({ registration, images })

    return { status: 'success', message: '作品に話を追加しました。' }
  } catch (error) {
    if (error instanceof Error && error.message === '追加先の作品が見つかりません') {
      return {
        status: 'error',
        message: '選択した作品は見つかりません。再読み込みして選択し直してください。',
      }
    }

    return {
      status: 'error',
      message: '話を追加できませんでした。入力内容を確認して、もう一度お試しください。',
    }
  }
}
