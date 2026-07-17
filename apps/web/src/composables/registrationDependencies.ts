import { database } from '@/database/database'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import {
  createComicRegistrationService,
  createRegistrationId,
} from '@/database/registrationService'
import { createMangaRepository } from '@/database/repository'

export const registrationService = createComicRegistrationService(database)
export const registrationRepository = createMangaRepository(database)

export function createFixedImageForRegistration() {
  const image = createDevelopmentComicFixture().image

  return { ...image, id: createRegistrationId() }
}
