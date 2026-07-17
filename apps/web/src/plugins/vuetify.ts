import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#5b3f92',
          background: '#faf8fc',
          surface: '#ffffff',
        },
      },
    },
  },
})
