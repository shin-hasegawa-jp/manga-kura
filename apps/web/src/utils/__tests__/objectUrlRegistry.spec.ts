import { describe, expect, it, vi } from 'vitest'
import { createObjectUrlRegistry } from '../objectUrlRegistry'

describe('createObjectUrlRegistry', () => {
  it('revokes every object URL it creates and does not revoke them twice', () => {
    const api = {
      createObjectURL: vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second'),
      revokeObjectURL: vi.fn(),
    }
    const registry = createObjectUrlRegistry(api)

    registry.create(new Blob(['first']))
    registry.create(new Blob(['second']))
    registry.revokeAll()
    registry.revokeAll()

    expect(api.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:second')
  })
})
