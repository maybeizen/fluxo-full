import { useRegister } from "@/hooks/use-register";
import { useUI } from "@/theme-system";

export function RegisterPage() {
  const { RegisterForm } = useUI();
  const register = useRegister();
  return <RegisterForm {...register} />;
}
