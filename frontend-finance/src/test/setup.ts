import { config } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, vi } from 'vitest'

// Alguns componentes (reka-ui, gráficos, sidebar) dependem de APIs de layout
// que o jsdom não implementa.
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverMock {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return []
  }
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})

if (!HTMLElement.prototype.showPicker) {
  Object.defineProperty(HTMLElement.prototype, 'showPicker', {
    writable: true,
    value: vi.fn(),
  })
}

// Slots padrão continuam sendo renderizados quando um componente é substituído
// por um stub, o que mantém o texto das telas visível nas asserções.
config.global.renderStubDefaultSlot = true

// Os layouts carregam sidebar, clima e service worker; as telas são testadas
// isoladamente, então basta renderizar o conteúdo do slot.
config.global.stubs = {
  RouterLink: defineComponent({
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: undefined } },
    setup(_props, { slots }) {
      return () => h('a', slots.default?.())
    },
  }),
  AuthLayout: defineComponent({
    name: 'AuthLayout',
    setup(_props, { slots }) {
      return () => h('div', { 'data-test': 'auth-layout' }, slots.default?.())
    },
  }),
  DashboardLayout: defineComponent({
    name: 'DashboardLayout',
    props: { section: String, page: String },
    setup(_props, { slots }) {
      return () => h('div', { 'data-test': 'dashboard-layout' }, slots.default?.())
    },
  }),
}

afterEach(() => {
  document.body.innerHTML = ''
  document.title = ''
})
