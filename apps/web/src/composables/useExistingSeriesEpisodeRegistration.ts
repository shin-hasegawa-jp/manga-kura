import { onMounted, ref } from 'vue'
import type { Series } from '@/domain/models'
import {
  submitExistingSeriesEpisodeRegistration,
  type ExistingSeriesEpisodeRegistrationSubmission,
} from '@/views/saveExistingSeriesEpisodeRegistration'
import {
  createFixedImageForRegistration,
  registrationRepository,
  registrationService,
} from './registrationDependencies'

export function useExistingSeriesEpisodeRegistration() {
  const seriesOptions = ref<Series[]>([])
  const existingSeriesId = ref('')
  const existingSeriesEpisodeTitle = ref('')
  const existingSeriesEpisodeSourcePageUrl = ref('')
  const existingSeriesEpisodeSubmission = ref<ExistingSeriesEpisodeRegistrationSubmission>()
  const isSubmittingExistingSeriesEpisode = ref(false)

  async function loadSeriesOptions() {
    seriesOptions.value = await registrationRepository.series.findAll()
  }

  async function registerExistingSeriesEpisode() {
    isSubmittingExistingSeriesEpisode.value = true

    try {
      existingSeriesEpisodeSubmission.value = await submitExistingSeriesEpisodeRegistration(
        registrationService,
        {
          seriesId: existingSeriesId.value,
          title: existingSeriesEpisodeTitle.value,
          sourcePageUrl: existingSeriesEpisodeSourcePageUrl.value,
        },
        createFixedImageForRegistration(),
      )
    } finally {
      isSubmittingExistingSeriesEpisode.value = false
    }
  }

  function clearExistingSeriesEpisodeSubmission() {
    existingSeriesEpisodeSubmission.value = undefined
  }

  onMounted(() => {
    void loadSeriesOptions()
  })

  return {
    seriesOptions,
    existingSeriesId,
    existingSeriesEpisodeTitle,
    existingSeriesEpisodeSourcePageUrl,
    existingSeriesEpisodeSubmission,
    isSubmittingExistingSeriesEpisode,
    loadSeriesOptions,
    registerExistingSeriesEpisode,
    clearExistingSeriesEpisodeSubmission,
  }
}
