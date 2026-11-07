export interface LoginFormValues {
  email: string;
  password: string;
}

export type LoginField = keyof LoginFormValues;
export type LoginFormErrors = Partial<Record<LoginField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginField(field: LoginField, values: LoginFormValues): string | undefined {
  if (field === "email") {
    const email = values.email.trim();
    if (!email) return "Informe seu e-mail.";
    if (!EMAIL_PATTERN.test(email)) return "Informe um e-mail válido, como nome@exemplo.com.";
    return undefined;
  }

  if (!values.password) return "Informe sua senha.";
  return undefined;
}
