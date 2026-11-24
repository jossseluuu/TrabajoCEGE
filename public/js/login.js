// Páginas login.html y registro.html. Usan las mismas cuentas que el resto
// de la web (store.js), así que se puede entrar desde aquí o desde la
// ventana de inicio de sesión de la página principal.

const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const registrationName = document.getElementById("registration-name");
const passwordRepeat = document.getElementById("password2");
const rememberMe = document.getElementById("remember");

// Página a la que volver después de entrar (solo páginas de esta misma web)
function returnPage() {
    const volver = new URLSearchParams(location.search).get("volver") || "";
    return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(volver) ? volver : "index.html";
}

// Mantiene el parámetro "volver" al pasar de login a registro y al revés
document.querySelectorAll('a[href="login.html"], a[href="registro.html"]').forEach((link) => {
    if (location.search) link.href += location.search;
});

loginForm.addEventListener("input", () => {
    loginStatus.textContent = "";
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        if (registrationName) {
            if (passwordRepeat && password !== passwordRepeat.value) {
                throw new Error("Las contraseñas no coinciden.");
            }
            await Store.registrar({ nombre: registrationName.value, email, password });
        }
        await Store.login(email, password, rememberMe ? rememberMe.checked : false);
        location.replace(returnPage());
    } catch (error) {
        loginStatus.textContent = error.message;
    }
});

// Las cuentas de prueba solo existen en modo local (sin servidor)
if (Store.modo === "remoto") {
    document.querySelectorAll(".demo-box").forEach((caja) => (caja.hidden = true));
}

// Si ya hay sesión iniciada no tiene sentido mostrar el formulario
Store.inicializar().then(() => {
    if (Store.usuarioActual()) location.replace(returnPage());
});
