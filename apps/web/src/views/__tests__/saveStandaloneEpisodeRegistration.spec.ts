import { describe, expect, it } from 'vitest'
import type { RegisterStandaloneEpisodeInput } from '@/database/registrationService'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { submitStandaloneEpisodeRegistration } from '../saveStandaloneEpisodeRegistration'

describe('単独の話登録フォームの送信', () => {
  it('入力値と固定画像を単独の話登録ユースケースへ渡し、成功表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const registration = {
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone-episodes/1',
    }
    let submittedInput: RegisterStandaloneEpisodeInput | undefined
    const service = {
      async registerStandaloneEpisode(input: RegisterStandaloneEpisodeInput) {
        submittedInput = input

        return { episode: fixture.episode, images: [fixture.image] }
      },
    }

    const result = await submitStandaloneEpisodeRegistration(service, registration, [fixture.image])

    expect(submittedInput).toEqual({ registration, images: [fixture.image] })
    expect(result).toEqual({ status: 'success', message: '単独の話を登録しました。' })
  })

  it('ユースケースが失敗した場合に入力エラー表示を返す', async () => {
    const fixture = createDevelopmentComicFixture()
    const service = {
      async registerStandaloneEpisode() {
        throw new Error('保存に失敗しました')
      },
    }

    const result = await submitStandaloneEpisodeRegistration(
      service,
      {
        title: '',
        sourcePageUrl: 'https://example.com/standalone-episodes/1',
      },
      [fixture.image],
    )

    expect(result).toEqual({
      status: 'error',
      message: '単独の話を登録できませんでした。入力内容を確認して、もう一度お試しください。',
    })
  })
})
