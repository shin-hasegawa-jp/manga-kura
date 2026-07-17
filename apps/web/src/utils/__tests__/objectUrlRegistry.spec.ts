import { describe, expect, it, vi } from 'vitest'
import { createObjectUrlRegistry } from '../objectUrlRegistry'

describe('Object URLレジストリ', () => {
  it('生成したすべてのObject URLを解放し、同じURLを二重に解放しない', () => {
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
