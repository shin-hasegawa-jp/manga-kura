import { ref } from 'vue'
import {
  submitStandaloneEpisodeRegistration,
  type StandaloneEpisodeRegistrationSubmission,
} from '@/views/saveStandaloneEpisodeRegistration'
import { createFixedImageForRegistration, registrationService } from './registrationDependencies'

export function useStandaloneEpisodeRegistration() {
  const standaloneEpisodeTitle = ref('')
  const standaloneEpisodeSourcePageUrl = ref('')
  const standaloneEpisodeSubmission = ref<StandaloneEpisodeRegistrationSubmission>()
  const isSubmittingStandaloneEpisode = ref(false)

  async function registerStandaloneEpisode() {
    isSubmittingStandaloneEpisode.value = true

    try {
      standaloneEpisodeSubmission.value = await submitStandaloneEpisodeRegistration(
        registrationService,
        {
          title: standaloneEpisodeTitle.value,
          sourcePageUrl: standaloneEpisodeSourcePageUrl.value,
        },
        [createFixedImageForRegistration()],
      )
    } finally {
      isSubmittingStandaloneEpisode.value = false
    }
  }

  function clearStandaloneEpisodeSubmission() {
    standaloneEpisodeSubmission.value = undefined
  }

  return {
    standaloneEpisodeTitle,
    standaloneEpisodeSourcePageUrl,
    standaloneEpisodeSubmission,
    isSubmittingStandaloneEpisode,
    registerStandaloneEpisode,
    clearStandaloneEpisodeSubmission,
  }
}
