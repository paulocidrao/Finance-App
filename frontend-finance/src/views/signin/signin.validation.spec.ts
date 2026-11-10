import { describe, expect, it } from 'vitest'
import { validateSigninField, validateSigninForm, type SigninFormValues } from './signin.validation'

const values: SigninFormValues = {
  name: '',
  email: '',
  password: '',
  passwordConfirmation: '',
}

describe('validateSigninField', () => {
  it('valida o nome', () => {
    expect(validateSigninField('name', values)).toBe('Informe seu nome.')
    expect(validateSigninField('name', { ...values, name: 'A' })).toBe(
      'O nome deve ter pelo menos 2 caracteres.',
    )
    expect(validateSigninField('name', { ...values, name: 'A'.repeat(81) })).toBe(
      'O nome deve ter no máximo 80 caracteres.',
    )
    expect(validateSigninField('name', { ...values, name: '  Maria  ' })).toBeUndefined()
  })

  it('valida o e-mail', () => {
    expect(validateSigninField('email', values)).toBe('Informe seu e-mail.')
    expect(validateSigninField('email', { ...values, email: 'invalido' })).toBe(
      'Informe um e-mail válido, como nome@exemplo.com.',
    )
    expect(
      validateSigninField('email', { ...values, email: 'maria@exemplo.com' }),
    ).toBeUndefined()
  })

  it('valida o tamanho da senha', () => {
    expect(validateSigninField('password', values)).toBe('Crie uma senha.')
    expect(validateSigninField('password', { ...values, password: '1234567' })).toBe(
      'A senha deve ter pelo menos 8 caracteres.',
    )
    expect(
      validateSigninField('password', { ...values, password: 'x'.repeat(201) }),
    ).toBe('A senha deve ter no máximo 200 caracteres.')
    expect(
      validateSigninField('password', { ...values, password: 'segredo123' }),
    ).toBeUndefined()
  })

  it('valida a confirmação da senha', () => {
    expect(validateSigninField('passwordConfirmation', values)).toBe('Confirme sua senha.')
    expect(
      validateSigninField('passwordConfirmation', {
        ...values,
        password: 'segredo123',
        passwordConfirmation: 'outra',
      }),
    ).toBe('As senhas não coincidem.')
    expect(
      validateSigninField('passwordConfirmation', {
        ...values,
        password: 'segredo123',
        passwordConfirmation: 'segredo123',
      }),
    ).toBeUndefined()
  })
})

describe('validateSigninForm', () => {
  it('devolve todos os erros de uma vez', () => {
    expect(validateSigninForm(values)).toEqual({
      name: 'Informe seu nome.',
      email: 'Informe seu e-mail.',
      password: 'Crie uma senha.',
      passwordConfirmation: 'Confirme sua senha.',
    })
  })

  it('devolve um objeto vazio quando o formulário é válido', () => {
    expect(
      validateSigninForm({
        name: 'Maria Silva',
        email: 'maria@exemplo.com',
        password: 'segredo123',
        passwordConfirmation: 'segredo123',
      }),
    ).toEqual({})
  })
})
