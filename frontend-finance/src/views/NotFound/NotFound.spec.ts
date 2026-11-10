import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
}))

vi.mock('@/router', () => ({
  default: { back: mocks.back },
}))

import NotFound from './NotFound.vue'

describe('NotFound', () => {
  beforeEach(() => {
    mocks.back.mockReset()
  })

  it('renderiza a mensagem de página não encontrada', () => {
    const wrapper = mount(NotFound)

    expect(wrapper.get('h1').text()).toBe('Pagina não encontrada!')
    expect(wrapper.text()).toContain('Voltar')
    expect(wrapper.get('main').classes()).toContain('min-h-dvh')
  })

  it('volta para a página anterior ao clicar em Voltar', async () => {
    const wrapper = mount(NotFound)

    await wrapper.get('button').trigger('click')

    expect(mocks.back).toHaveBeenCalledOnce()
  })
})
