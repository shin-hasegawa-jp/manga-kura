import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      // ライトテーマ = 納品デザインの通常画面の基調。
      // 色の責務をここへ集約し、CSSトークン（tokens.css）はこのテーマ変数を参照する。
      // ダークテーマは同じ色キーで別途 themes.dark を追加すれば拡張できる。
      light: {
        dark: false,
        colors: {
          background: '#fbfaf8', // 画面背景（生成り）
          surface: '#ffffff', // カード・面
          'surface-variant': '#f4f1ec', // まとまり／パネルの面
          'on-surface': '#1a1a1a', // 主要テキスト（補助テキストは中強調opacityで表現）
          'on-background': '#1a1a1a',
          primary: '#b5643c', // 主要アクセント（選択・ステップ・リンク・進捗）
          'on-primary': '#ffffff',
          cta: '#1a1a1a', // 主要アクション（ニアブラックの塗りボタン）
          'on-cta': '#fbfaf8',
          error: '#c25b4a',
          'on-error': '#ffffff',
          success: '#3f7a52',
          'on-success': '#ffffff',
        },
      },
    },
  },
})
