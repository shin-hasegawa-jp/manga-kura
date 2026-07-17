import { describe, expect, it } from 'vitest'
import {
  validateAddEpisodeToSeriesRegistration,
  validateCreateSeriesRegistration,
  validateCreateStandaloneEpisodeRegistration,
} from '../registration'

describe('登録用データのバリデーション', () => {
  it('新規作品登録に必要な作品名・話タイトル・元ページURLを検証する', () => {
    const registration = {
      seriesTitle: '作品1',
      title: '第1話',
      sourcePageUrl: 'https://example.com/episodes/1',
    }

    expect(validateCreateSeriesRegistration(registration)).toEqual(registration)
    expect(() =>
      validateCreateSeriesRegistration({ ...registration, seriesTitle: undefined }),
    ).toThrow()
    expect(() => validateCreateSeriesRegistration({ ...registration, title: undefined })).toThrow()
    expect(() =>
      validateCreateSeriesRegistration({ ...registration, sourcePageUrl: undefined }),
    ).toThrow()
  })

  it('単独の話は作品IDを持たず、話タイトルと元ページURLを検証する', () => {
    const registration = {
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone',
    }

    expect(validateCreateStandaloneEpisodeRegistration(registration)).toEqual(registration)
    expect(
      validateCreateStandaloneEpisodeRegistration({ ...registration, seriesId: 'series-1' }),
    ).toEqual(registration)
    expect(() =>
      validateCreateStandaloneEpisodeRegistration({ ...registration, sourcePageUrl: 'not-a-url' }),
    ).toThrow()
  })

  it('既存作品への話追加に必要な作品ID・話タイトル・元ページURLを検証する', () => {
    const registration = {
      seriesId: 'series-1',
      title: '第2話',
      sourcePageUrl: 'https://example.com/episodes/2',
    }

    expect(validateAddEpisodeToSeriesRegistration(registration)).toEqual(registration)
    expect(() =>
      validateAddEpisodeToSeriesRegistration({ ...registration, seriesId: '' }),
    ).toThrow()
    expect(() => validateAddEpisodeToSeriesRegistration({ ...registration, title: '' })).toThrow()
  })
})
