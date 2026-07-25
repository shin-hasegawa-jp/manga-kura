import { ref } from 'vue'
import type { RegistrationImage } from '@/database/registrationService'
import {
  submitStandaloneEpisodeRegistration,
  type StandaloneEpisodeRegistrationSubmission,
} from '@/views/saveStandaloneEpisodeRegistration'
import { registrationService } from './registrationDependencies'

export function useStandaloneEpisodeRegistration() {
  const standaloneEpisodeTitle = ref('')
  const standaloneEpisodeNumber = ref<number>()
  const standaloneEpisodeSourcePageUrl = ref('')
  const standaloneEpisodeSubmission = ref<StandaloneEpisodeRegistrationSubmission>()
  const isSubmittingStandaloneEpisode = ref(false)

  async function registerStandaloneEpisode(images: readonly RegistrationImage[]) {
    isSubmittingStandaloneEpisode.value = true

    try {
      standaloneEpisodeSubmission.value = await submitStandaloneEpisodeRegistration(
        registrationService,
        {
          title: standaloneEpisodeTitle.value,
          episodeNumber: standaloneEpisodeNumber.value,
          sourcePageUrl: standaloneEpisodeSourcePageUrl.value,
        },
        images,
      )
      return standaloneEpisodeSubmission.value
    } finally {
      isSubmittingStandaloneEpisode.value = false
    }
  }

  function resetStandaloneEpisodeFields() {
    standaloneEpisodeTitle.value = ''
    standaloneEpisodeNumber.value = undefined
    standaloneEpisodeSourcePageUrl.value = ''
  }

  function clearStandaloneEpisodeSubmission() {
    standaloneEpisodeSubmission.value = undefined
  }

  return {
    standaloneEpisodeTitle,
    standaloneEpisodeNumber,
    standaloneEpisodeSourcePageUrl,
    standaloneEpisodeSubmission,
    isSubmittingStandaloneEpisode,
    registerStandaloneEpisode,
    resetStandaloneEpisodeFields,
    clearStandaloneEpisodeSubmission,
  }
}
