import { describe, expect, it } from 'vitest'
import type { RegisterSeriesWithFirstEpisodeInput } from '@/database/registrationService'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { submitNewSeriesRegistration } from '../saveNewSeriesRegistration'

describe('新規作品登録フォームの送信', () => {
  it('入力値と固定画像を新規作品登録ユースケースへ渡し、成功表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const registration = {
      seriesTitle: '新規作品',
      title: '第1話',
      sourcePageUrl: 'https://example.com/new-series/episodes/1',
    }
    let submittedInput: RegisterSeriesWithFirstEpisodeInput | undefined
    const service = {
      async registerSeriesWithFirstEpisode(input: RegisterSeriesWithFirstEpisodeInput) {
        submittedInput = input

        return fixture
      },
    }

    const result = await submitNewSeriesRegistration(service, registration, fixture.image)

    expect(submittedInput).toEqual({ registration, image: fixture.image })
    expect(result).toEqual({ status: 'success', message: '新規作品を登録しました。' })
  })

  it('ユースケースが失敗した場合に入力エラー表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const service = {
      async registerSeriesWithFirstEpisode() {
        throw new Error('保存に失敗しました')
      },
    }

    const result = await submitNewSeriesRegistration(
      service,
      {
        seriesTitle: '',
        title: '第1話',
        sourcePageUrl: 'https://example.com/new-series/episodes/1',
      },
      fixture.image,
    )

    expect(result).toEqual({
      status: 'error',
      message: '新規作品を登録できませんでした。入力内容を確認して、もう一度お試しください。',
    })
  })
})
