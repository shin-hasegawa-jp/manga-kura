import { describe, expect, it } from 'vitest'
import type { AddEpisodeToSeriesInput } from '@/database/registrationService'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { submitExistingSeriesEpisodeRegistration } from '../saveExistingSeriesEpisodeRegistration'

describe('既存作品への話追加フォームの送信', () => {
  it('追加先が未選択の場合はユースケースを呼び出さず、入力エラー表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    let wasCalled = false
    const service = {
      async addEpisodeToSeries() {
        wasCalled = true

        return fixture
      },
    }

    const result = await submitExistingSeriesEpisodeRegistration(
      service,
      {
        seriesId: '',
        title: '第2話',
        sourcePageUrl: 'https://example.com/development-series/episodes/2',
      },
      fixture.image,
    )

    expect(wasCalled).toBe(false)
    expect(result).toEqual({ status: 'error', message: '追加先の作品を選択してください。' })
  })

  it('存在しない作品を選択した場合はエラー表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const service = {
      async addEpisodeToSeries() {
        throw new Error('追加先の作品が見つかりません')
      },
    }

    const result = await submitExistingSeriesEpisodeRegistration(
      service,
      {
        seriesId: 'unknown-series',
        title: '第2話',
        sourcePageUrl: 'https://example.com/unknown-series/episodes/2',
      },
      fixture.image,
    )

    expect(result).toEqual({
      status: 'error',
      message: '選択した作品は見つかりません。再読み込みして選択し直してください。',
    })
  })

  it('選択した作品と入力値と固定画像を話追加ユースケースへ渡し、成功表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const registration = {
      seriesId: fixture.series.id,
      title: '第2話',
      sourcePageUrl: 'https://example.com/development-series/episodes/2',
    }
    let submittedInput: AddEpisodeToSeriesInput | undefined
    const service = {
      async addEpisodeToSeries(input: AddEpisodeToSeriesInput) {
        submittedInput = input

        return fixture
      },
    }

    const result = await submitExistingSeriesEpisodeRegistration(
      service,
      registration,
      fixture.image,
    )

    expect(submittedInput).toEqual({ registration, image: fixture.image })
    expect(result).toEqual({ status: 'success', message: '作品に話を追加しました。' })
  })
})
