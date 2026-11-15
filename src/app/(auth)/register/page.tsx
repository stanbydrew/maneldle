import { register } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Cont nou · Maneldle" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={register} />;
}
