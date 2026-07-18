import { database } from '@/database/database'
import { createComicRegistrationService } from '@/database/registrationService'
import { createMangaRepository } from '@/database/repository'

export const registrationService = createComicRegistrationService(database)
export const registrationRepository = createMangaRepository(database)
