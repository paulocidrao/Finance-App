import { nextTick, reactive, ref, watch } from "vue";
import { toast } from 'vue-sonner';
import { useNetworkStatus } from '@/utils/network-status';
import { login, type LoginResponse } from "./login.service";
import router from "@/router";
import { startOfflineCacheSession } from "@/utils/offline-cache";
import { validateLoginField, type LoginField, type LoginFormErrors, type LoginFormValues } from "./login.validation";

export const LOGIN_FIELD_IDS: Record<LoginField, string> = {
  email: "login-email",
  password: "login-password",
};
export const LOGIN_SUBMIT_ID = "login-submit";
const LOGIN_FIELDS: readonly LoginField[] = ["email", "password"];

async function focusElement(id: string): Promise<void> {
  await nextTick();
  document.getElementById(id)?.focus();
}

export function useLoginController() {
  const { isOnline } = useNetworkStatus();
  const form = reactive<LoginFormValues>({ email: "", password: "" });
  const errors = reactive<LoginFormErrors>({});
  const touched = reactive<Partial<Record<LoginField, boolean>>>({});
  const backendError = ref("");
  const isSubmitting = ref(false);
  const isPasswordVisible = ref(false);

  function validateField(field: LoginField): void {
    const message = validateLoginField(field, form);
    if (message) errors[field] = message;
    else delete errors[field];
  }

  function handleBlur(field: LoginField): void {
    touched[field] = true;
    validateField(field);
  }

  for (const field of LOGIN_FIELDS) {
    watch(() => form[field], () => {
      if (touched[field]) validateField(field);
      backendError.value = "";
    });
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
    for (const field of LOGIN_FIELDS) {
      touched[field] = true;
      validateField(field);
    }

    const firstInvalidField = LOGIN_FIELDS.find((field) => errors[field]);
    if (firstInvalidField) {
      await focusElement(LOGIN_FIELD_IDS[firstInvalidField]);
      return;
    }

    isSubmitting.value = true;
    let elementToFocus: string | null = null;
    try {
      const response: LoginResponse = await login({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (response.status >= 200 && response.status < 300) {
        await startOfflineCacheSession();
        await router.push({ name: "home" });
      }
    } catch (error) {
      backendError.value = error instanceof Error
        ? error.message
        : "Não foi possível entrar agora. Tente novamente em instantes.";
      elementToFocus = LOGIN_SUBMIT_ID;
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
