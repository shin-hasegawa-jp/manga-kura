import { ref } from 'vue'
import type { RegistrationImage } from '@/database/registrationService'
import {
  submitNewSeriesRegistration,
  type NewSeriesRegistrationSubmission,
} from '@/views/saveNewSeriesRegistration'
import { registrationService } from './registrationDependencies'

export function useNewSeriesRegistration() {
  const newSeriesTitle = ref('')
  const newSeriesEpisodeTitle = ref('')
  const newSeriesSourcePageUrl = ref('')
  const newSeriesSubmission = ref<NewSeriesRegistrationSubmission>()
  const isSubmittingNewSeries = ref(false)

  async function registerNewSeries(images: readonly RegistrationImage[]) {
    isSubmittingNewSeries.value = true

    try {
      newSeriesSubmission.value = await submitNewSeriesRegistration(
        registrationService,
        {
          seriesTitle: newSeriesTitle.value,
          title: newSeriesEpisodeTitle.value,
          sourcePageUrl: newSeriesSourcePageUrl.value,
        },
        images,
      )
      return newSeriesSubmission.value
    } finally {
      isSubmittingNewSeries.value = false
    }
  }

  function resetNewSeriesFields() {
    newSeriesTitle.value = ''
    newSeriesEpisodeTitle.value = ''
    newSeriesSourcePageUrl.value = ''
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
    resetNewSeriesFields,
    clearNewSeriesSubmission,
  }
}
