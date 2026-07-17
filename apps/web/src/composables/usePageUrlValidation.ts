import { ref } from 'vue'
import { submitPageUrl, type PageUrlSubmission } from '@/views/savePageUrlValidation'

export function usePageUrlValidation() {
  const pageUrl = ref('')
  const validatedPageUrl = ref('')
  const pageUrlSubmission = ref<PageUrlSubmission>()
  const isValidatingPageUrl = ref(false)

  async function validatePageUrlForAnalysis() {
    isValidatingPageUrl.value = true
    validatedPageUrl.value = ''

    try {
      pageUrlSubmission.value = await submitPageUrl(pageUrl.value, (normalizedUrl) => {
        pageUrl.value = normalizedUrl
        validatedPageUrl.value = normalizedUrl
      })
    } finally {
      isValidatingPageUrl.value = false
    }
  }

  return {
    pageUrl,
    validatedPageUrl,
    pageUrlSubmission,
    isValidatingPageUrl,
    validatePageUrlForAnalysis,
  }
}
