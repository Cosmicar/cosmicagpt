import { APP_ROUTES } from "./config.js";
import { loginWithEmail, redirectIfLoggedIn } from "./auth-service.js";
import { $, runWithButton } from "./utils.js";

redirectIfLoggedIn();

function mostrarError(msg) {
  const el = $("errorMsg");
  el.textContent = msg;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
}

window.login = async () => {
  const email = $("email").value.trim();
  const pass = $("password").value;
  const btn = $("btnLogin");

  if (!email || !pass) {
    mostrarError("Completá email y contraseña.");
    return;
  }

  try {
    await runWithButton(btn, "Verificando...", async () => {
      await loginWithEmail(email, pass);
      window.location.href = APP_ROUTES.panel;
    });
  } catch (error) {
    const codes = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found"
    ];
    mostrarError(codes.includes(error?.code)
      ? "Email o contraseña incorrectos."
      : "Error al ingresar. Intentá de nuevo.");
  }
};
