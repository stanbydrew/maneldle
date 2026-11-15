import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Intră · Maneldle" };

export default function LoginPage() {
  return <AuthForm mode="login" action={login} />;
}
