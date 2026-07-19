import { describe, expect, it } from 'vitest'
import {
  getRegistrationFields,
  registrationModeOptions,
  type RegistrationMode,
} from '../saveRegistrationMode'

const registrationFieldCases: Array<{ mode: RegistrationMode; fieldNames: string[] }> = [
  { mode: 'newSeries', fieldNames: ['seriesTitle', 'title', 'sourcePageUrl'] },
  { mode: 'standaloneEpisode', fieldNames: ['title', 'sourcePageUrl'] },
  { mode: 'existingSeries', fieldNames: ['seriesId', 'title', 'sourcePageUrl'] },
]

describe('登録方法の表示項目', () => {
  it('選択肢として新規作品・単独の話・既存作品への追加を提供する', () => {
    expect(registrationModeOptions).toEqual([
      { value: 'newSeries', label: '新しい作品として保存' },
      { value: 'existingSeries', label: '既存の作品に話を追加' },
      { value: 'standaloneEpisode', label: '単独の話として保存' },
    ])
  })

  it.each(registrationFieldCases)(
    '$mode の場合に必要な入力項目だけを返す',
    ({ mode, fieldNames }) => {
      expect(getRegistrationFields(mode).map((field) => field.name)).toEqual(fieldNames)
    },
  )
})
