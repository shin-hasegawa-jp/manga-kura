export type RegistrationMode = 'newSeries' | 'standaloneEpisode' | 'existingSeries'

export interface RegistrationModeOption {
  value: RegistrationMode
  label: string
}

export interface RegistrationField {
  name: 'seriesTitle' | 'seriesId' | 'title' | 'sourcePageUrl'
  label: string
  inputType: 'text' | 'url'
}

export const registrationModeOptions: RegistrationModeOption[] = [
  { value: 'newSeries', label: '新しい作品として保存' },
  { value: 'existingSeries', label: '既存の作品に話を追加' },
  { value: 'standaloneEpisode', label: '単独の話として保存' },
]

const episodeFields: RegistrationField[] = [
  { name: 'title', label: '話タイトル', inputType: 'text' },
  { name: 'sourcePageUrl', label: '元ページURL', inputType: 'url' },
]

export function getRegistrationFields(mode: RegistrationMode): RegistrationField[] {
  switch (mode) {
    case 'newSeries':
      return [{ name: 'seriesTitle', label: '作品名', inputType: 'text' }, ...episodeFields]
    case 'standaloneEpisode':
      return episodeFields
    case 'existingSeries':
      return [{ name: 'seriesId', label: '追加先作品', inputType: 'text' }, ...episodeFields]
  }
}
