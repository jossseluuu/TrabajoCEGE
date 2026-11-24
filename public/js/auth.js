// Login y registro de usuarios + utilidades de interfaz compartidas
// (avisos tipo "toast" y escapado de HTML).

const UI = (() => {

    function escapeHTML(texto) {
        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function toast(mensaje, tipo = "ok") {
        let zona = document.getElementById("toasts");
        if (!zona) {
            zona = document.createElement("div");
            zona.id = "toasts";
            zona.className = "toasts";
            zona.setAttribute("aria-live", "polite");
            document.body.appendChild(zona);
        }
        const aviso = document.createElement("div");
        aviso.className = `toast toast-${tipo}`;
        aviso.textContent = mensaje;
        zona.appendChild(aviso);
        setTimeout(() => aviso.classList.add("toast-out"), 3200);
        setTimeout(() => aviso.remove(), 3600);
    }

    // Cierra un <dialog> al pulsar fuera de él o en su botón ×
    function prepararModal(dialog) {
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog || event.target.closest(".modal-close")) {
                dialog.close();
            }
        });
    }

    return { escapeHTML, toast, prepararModal };
})();


const Auth = (() => {

    let modal;
    let accionPendiente = null; // lo que se hace tras iniciar sesión (p. ej. pujar)

    function mostrarPestana(pestana) {
        modal.querySelectorAll(".auth-tab").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.tab === pestana);
        });
        document.getElementById("login-form").hidden = pestana !== "login";
        document.getElementById("register-form").hidden = pestana !== "registro";
        modal.querySelectorAll(".form-error").forEach((e) => (e.hidden = true));
    }

    function abrir(pestana = "login", aviso = "") {
        const notice = document.getElementById("auth-notice");
        notice.textContent = aviso;
        notice.hidden = !aviso;
        mostrarPestana(pestana);
        if (!modal.open) modal.showModal();
        const primerCampo = modal.querySelector(`form:not([hidden]) input`);
        if (primerCampo) primerCampo.focus();
    }

    // Ejecuta `accion` si hay sesión; si no, pide iniciar sesión y la ejecuta después.
    function requerirLogin(accion, aviso = "Inicia sesión para continuar.") {
        if (Store.usuarioActual()) {
            accion();
            return;
        }
        accionPendiente = accion;
        abrir("login", aviso);
    }

    function mostrarError(form, mensaje) {
        const error = form.querySelector(".form-error");
        error.textContent = mensaje;
        error.hidden = false;
    }

    function trasEntrar(usuario, mensaje) {
        modal.close();
        document.getElementById("login-form").reset();
        document.getElementById("register-form").reset();
        pintarNavbar();
        document.dispatchEvent(new CustomEvent("sesion-cambiada"));
        UI.toast(mensaje.replace("{nombre}", usuario.nombre));

        if (accionPendiente) {
            const accion = accionPendiente;
            accionPendiente = null;
            accion();
        }
    }

    // La cabecera la dibuja nav.js (es común a todas las páginas)
    function pintarNavbar() {
        if (window.Nav) Nav.pintar();
    }

    function iniciar() {
        modal = document.getElementById("auth-modal");
        UI.prepararModal(modal);
        modal.addEventListener("close", () => (accionPendiente = null));

        modal.querySelectorAll(".auth-tab").forEach((tab) => {
            tab.addEventListener("click", () => mostrarPestana(tab.dataset.tab));
        });
        modal.querySelectorAll("[data-ir-a]").forEach((enlace) => {
            enlace.addEventListener("click", () => mostrarPestana(enlace.dataset.irA));
        });

        // Botones "Iniciar sesión" / "Registrarse" de la cabecera (nav.js la
        // vuelve a dibujar, por eso se escucha en la cabecera y no en los botones).
        // "Cerrar sesión" lo gestiona nav.js.
        document.getElementById("site-header").addEventListener("click", (event) => {
            const boton = event.target.closest("[data-accion]");
            if (!boton) return;
            if (boton.dataset.accion === "login") abrir("login");
            if (boton.dataset.accion === "registro") abrir("registro");
        });

        // Iniciar sesión
        const loginForm = document.getElementById("login-form");
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const datos = new FormData(loginForm);
            const boton = loginForm.querySelector("[type=submit]");
            boton.disabled = true;
            try {
                const usuario = await Store.login(
                    datos.get("email"),
                    datos.get("password"),
                    datos.get("recordar") === "on"
                );
                trasEntrar(usuario, "¡Hola de nuevo, {nombre}!");
            } catch (error) {
                mostrarError(loginForm, error.message);
            } finally {
                boton.disabled = false;
            }
        });

        // Registro
        const registerForm = document.getElementById("register-form");
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const datos = new FormData(registerForm);
            if (datos.get("password") !== datos.get("password2")) {
                mostrarError(registerForm, "Las contraseñas no coinciden.");
                return;
            }
            const boton = registerForm.querySelector("[type=submit]");
            boton.disabled = true;
            try {
                await Store.registrar({
                    nombre: datos.get("nombre"),
                    email: datos.get("email"),
                    password: datos.get("password"),
                });
                const usuario = await Store.login(datos.get("email"), datos.get("password"), false);
                trasEntrar(usuario, "¡Bienvenido/a a CeutaPlay, {nombre}!");
            } catch (error) {
                mostrarError(registerForm, error.message);
            } finally {
                boton.disabled = false;
            }
        });

        // Modo de datos: con servidor (Supabase) o solo en este navegador
        const modoDatos = document.getElementById("modo-datos");
        if (modoDatos) {
            modoDatos.textContent = Store.modo === "remoto"
                ? "🟢 Conectado al servidor: todos ven las mismas subastas"
                : "🟡 Modo local: los datos solo se guardan en este navegador";
        }

        // Las cuentas de prueba y el botón de restablecer solo existen en modo local
        const botonReset = document.getElementById("reset-demo");
        if (Store.modo === "remoto") {
            botonReset.hidden = true;
            document.querySelectorAll(".demo-box").forEach((caja) => (caja.hidden = true));
        }

        // Restablecer los datos de ejemplo
        botonReset.addEventListener("click", async () => {
            if (!confirm("Se borrarán todos los usuarios y subastas guardados en este navegador. ¿Continuar?")) return;
            await Store.reiniciarDemo();
            pintarNavbar();
            document.dispatchEvent(new CustomEvent("sesion-cambiada"));
            UI.toast("Datos de ejemplo restablecidos.");
        });

        pintarNavbar();
    }

    return { iniciar, abrir, requerirLogin, pintarNavbar };
})();
