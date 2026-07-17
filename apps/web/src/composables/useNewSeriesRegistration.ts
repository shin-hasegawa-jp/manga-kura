import { ref } from 'vue'
import {
  submitNewSeriesRegistration,
  type NewSeriesRegistrationSubmission,
} from '@/views/saveNewSeriesRegistration'
import { createFixedImageForRegistration, registrationService } from './registrationDependencies'

export function useNewSeriesRegistration() {
  const newSeriesTitle = ref('')
  const newSeriesEpisodeTitle = ref('')
  const newSeriesSourcePageUrl = ref('')
  const newSeriesSubmission = ref<NewSeriesRegistrationSubmission>()
  const isSubmittingNewSeries = ref(false)

  async function registerNewSeries() {
    isSubmittingNewSeries.value = true

    try {
      newSeriesSubmission.value = await submitNewSeriesRegistration(
        registrationService,
        {
          seriesTitle: newSeriesTitle.value,
          title: newSeriesEpisodeTitle.value,
          sourcePageUrl: newSeriesSourcePageUrl.value,
        },
        createFixedImageForRegistration(),
      )
    } finally {
      isSubmittingNewSeries.value = false
    }
  }

  function clearNewSeriesSubmission() {
    newSeriesSubmission.value = undefined
  }

  return {
    newSeriesTitle,
    newSeriesEpisodeTitle,
    newSeriesSourcePageUrl,
    newSeriesSubmission,
    isSubmittingNewSeries,
    registerNewSeries,
    clearNewSeriesSubmission,
  }
}
