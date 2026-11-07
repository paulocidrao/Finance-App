import { nextTick, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useNetworkStatus } from '@/utils/network-status';
import router from "@/router";
import { signin, SigninError } from "./signin.service";
import {
  SIGNIN_FIELDS,
  validateSigninField,
  type SigninField,
  type SigninFormErrors,
  type SigninFormValues,
} from "./signin.validation";

/** IDs dos inputs na view, usados para mover o foco até o campo com erro. */
export const SIGNIN_FIELD_IDS: Record<SigninField, string> = {
  name: "signin-name",
  email: "signin-email",
  password: "signin-password",
  passwordConfirmation: "signin-password-confirmation",
};

export const SIGNIN_SUBMIT_ID = "signin-submit";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function focusElement(id: string): Promise<void> {
  await nextTick();
  document.getElementById(id)?.focus();
}

function focusField(field: SigninField): Promise<void> {
  return focusElement(SIGNIN_FIELD_IDS[field]);
}

export function useSigninController() {
  const { isOnline } = useNetworkStatus();
  const form = reactive<SigninFormValues>({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const errors = reactive<SigninFormErrors>({});
  const touched = reactive<Partial<Record<SigninField, boolean>>>({});
  const backendError = ref("");
  const isSubmitting = ref(false);
  const isPasswordVisible = ref(false);

  // E-mail que a API já recusou como duplicado: mantém o erro enquanto ele não mudar.
  const conflictingEmail = ref<string | null>(null);

  function validateField(field: SigninField): void {
    let message = validateSigninField(field, form);

    if (
      !message &&
      field === "email" &&
      conflictingEmail.value === normalizeEmail(form.email)
    ) {
      message = "Este e-mail já está cadastrado.";
    }

    if (message) errors[field] = message;
    else delete errors[field];
  }

  function handleBlur(field: SigninField): void {
    touched[field] = true;
    validateField(field);
  }

  // Depois que o campo foi visitado, o erro é atualizado enquanto a pessoa digita.
  for (const field of SIGNIN_FIELDS) {
    watch(
      () => form[field],
      () => {
        if (touched[field]) validateField(field);
        if (field === "password" && touched.passwordConfirmation) {
          validateField("passwordConfirmation");
        }
      },
    );
  }

  function togglePasswordVisibility(): void {
    isPasswordVisible.value = !isPasswordVisible.value;
  }

  async function handleSubmit(): Promise<void> {
    if (!isOnline.value) {
      toast.error('Você está offline. Conecte-se para salvar alterações.');
      return;
    }
    if (isSubmitting.value) return;

    backendError.value = "";
    for (const field of SIGNIN_FIELDS) {
      touched[field] = true;
      validateField(field);
    }

    const firstInvalidField = SIGNIN_FIELDS.find((field) => errors[field]);
    if (firstInvalidField) {
      await focusField(firstInvalidField);
      return;
    }

    isSubmitting.value = true;
    // O formulário fica desabilitado durante o envio e o foco se perde;
    // em caso de erro ele volta para o campo afetado ou para o botão.
    let elementToFocus: string | null = null;

    try {
      await signin({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      toast.success("Conta criada", {
        description: "Agora é só entrar com seu e-mail e senha.",
      });
      await router.push({ name: "login" });
    } catch (error) {
      if (error instanceof SigninError && error.kind === "conflict") {
        conflictingEmail.value = normalizeEmail(form.email);
        validateField("email");
        elementToFocus = SIGNIN_FIELD_IDS.email;
      } else {
        backendError.value =
          error instanceof SigninError
            ? error.message
            : "Não foi possível criar a conta agora. Tente novamente em instantes.";
        elementToFocus = SIGNIN_SUBMIT_ID;
      }
    } finally {
      isSubmitting.value = false;
    }

    if (elementToFocus) await focusElement(elementToFocus);
  }

  return {
    isOnline,
    form,
    errors,
    backendError,
    isSubmitting,
    isPasswordVisible,
    handleBlur,
    handleSubmit,
    togglePasswordVisibility,
  };
}
