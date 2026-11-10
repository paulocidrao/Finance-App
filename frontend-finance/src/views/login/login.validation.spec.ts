import { describe, expect, it } from 'vitest'
import { validateLoginField } from './login.validation'

const values = { email: '', password: '' }

describe('validateLoginField', () => {
  it('exige um e-mail preenchido', () => {
    expect(validateLoginField('email', values)).toBe('Informe seu e-mail.')
  })

  it('recusa e-mails com formato inválido', () => {
    expect(validateLoginField('email', { ...values, email: 'invalido' })).toBe(
      'Informe um e-mail válido, como nome@exemplo.com.',
    )
    expect(validateLoginField('email', { ...values, email: 'nome@exemplo' })).toBe(
      'Informe um e-mail válido, como nome@exemplo.com.',
    )
  })

  it('aceita e-mails válidos, com espaços nas pontas', () => {
    expect(validateLoginField('email', { ...values, email: '  nome@exemplo.com  ' })).toBeUndefined()
  })

  it('exige a senha', () => {
    expect(validateLoginField('password', values)).toBe('Informe sua senha.')
    expect(validateLoginField('password', { ...values, password: 'x' })).toBeUndefined()
  })
})
