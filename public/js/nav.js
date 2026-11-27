// Cabecera común de todas las páginas: logo, menú y zona de usuario
// (Iniciar sesión / Registrarse, o el nombre del usuario, Panel admin y Salir).
//
// Cada página solo necesita:
//   <header class="navbar" id="site-header" data-pagina="inicio"></header>
// y cargar este archivo después de store.js. Valores de data-pagina:
// inicio, mapa, reservas, comunidad, perfil, gestor, admin, login, registro.
// Si la página carga también js/avisos.js (y js/viento.js), aparece la campana.
//
// En la página principal los botones de entrar/registrarse abren la ventana
// de auth.js; en el resto llevan a login.html y vuelven después a la página.

const Nav = (() => {

    const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

    let header;
    let listo = false; // false hasta que Store sabe si hay sesión (evita parpadeos)

    function paginaActual() {
        return header.dataset.pagina || "";
    }

    function enlaces(usuario) {
        const enInicio = paginaActual() === "inicio";
        const base = enInicio ? "" : "index.html";
        const lista = [
            { href: `${base}#inicio`, texto: "Inicio", pagina: "inicio" },
            { href: `${base}#instalaciones`, texto: "Instalaciones" },
            { href: "mapa.html", texto: "Mapa", pagina: "mapa" },
            { href: "reservas.html", texto: "Reservar", pagina: "reservas" },
            { href: `${base}#subastas`, texto: "Subastas" },
            { href: "comunidad.html", texto: "Comunidad", pagina: "comunidad" },
        ];
        if (usuario && !usuario.admin && Store.gestiona().length) {
            lista.push({ href: "gestor.html", texto: "Panel gestor", pagina: "gestor", clase: "nav-admin" });
        }
        if (usuario && usuario.admin) {
            lista.push({ href: "admin.html", texto: "Panel admin", pagina: "admin", clase: "nav-admin" });
        }
        return lista.map((e) => `
            <a href="${e.href}" class="${e.clase || ""}"
               ${e.pagina && e.pagina === paginaActual() ? 'aria-current="page"' : ""}>${e.texto}</a>`).join("");
    }

    function volverA() {
        const pagina = location.pathname.split("/").pop() || "index.html";
        return encodeURIComponent(pagina + location.search);
    }

    function botonTema() {
        if (typeof Tema === "undefined") return "";
        const oscuro = Tema.actual() === "oscuro";
        return `<button type="button" class="nav-bell nav-theme" data-nav="tema"
                    aria-label="${oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}"
                    title="${oscuro ? "Modo claro" : "Modo oscuro"}">${oscuro ? "☀️" : "🌙"}</button>`;
    }

    function acciones(usuario) {
        if (!listo) return `${botonTema()}<span class="nav-loading" aria-hidden="true"></span>`;

        if (usuario) {
            const inicial = esc((usuario.nombre || "?").trim().charAt(0).toUpperCase());
            return `${botonTema()}
                <button type="button" class="nav-bell" data-nav="avisos" aria-label="Avisos" aria-expanded="false"
                        aria-controls="avisos-panel">🔔<span class="bell-count" hidden></span></button>
                <a class="user-chip" href="perfil.html" title="Mi perfil (${esc(usuario.email)})"
                   ${paginaActual() === "perfil" ? 'aria-current="page"' : ""}>
                    <span class="user-avatar" aria-hidden="true">${inicial}</span>
                    <span class="user-name">${esc(usuario.nombre)}</span>
                    ${usuario.admin ? `<span class="admin-badge">ADMIN</span>` : ""}
                </a>
                <button type="button" class="login-btn" data-nav="logout">Cerrar sesión</button>`;
        }

        // En la portada existe la ventana de login (auth.js)
        if (document.getElementById("auth-modal")) {
            return `${botonTema()}
                <button type="button" class="login-btn" data-accion="login">Iniciar sesión</button>
                <button type="button" class="register-btn" data-accion="registro">Registrarse</button>`;
        }
        const volver = ["login", "registro"].includes(paginaActual()) ? location.search : `?volver=${volverA()}`;
        return `${botonTema()}
            <a class="login-btn" href="login.html${volver}" ${paginaActual() === "login" ? 'aria-current="page"' : ""}>Iniciar sesión</a>
            <a class="register-btn" href="registro.html${volver}">Registrarse</a>`;
    }

    function pintar() {
        if (!header) return;
        const usuario = listo ? Store.usuarioActual() : null;
        const abierto = header.classList.contains("menu-abierto");
        header.innerHTML = `
            <div class="container nav-content">
                <a href="index.html" class="logo">CEUTA<span>PLAY</span></a>
                <button type="button" class="nav-toggle" data-nav="menu" aria-expanded="${abierto}"
                        aria-controls="nav-menu" aria-label="Abrir menú">☰</button>
                <div class="nav-menu" id="nav-menu">
                    <nav aria-label="Navegación principal">${enlaces(usuario)}</nav>
                    <div class="nav-actions" id="nav-actions">${acciones(usuario)}</div>
                </div>
            </div>`;
        if ((typeof Avisos !== "undefined") && usuario) Avisos.pintar();
    }

    async function cerrarSesion() {
        await Store.cerrarSesion();
        // Las páginas privadas (perfil, admin, reservas) vuelven a la portada
        if (document.body.hasAttribute("data-requiere-login")) {
            location.replace("index.html");
            return;
        }
        document.dispatchEvent(new CustomEvent("sesion-cambiada"));
        if ((typeof UI !== "undefined")) UI.toast("Has cerrado sesión.");
    }

    // ---------- pie común: enlaces, instalar la app ----------

    let instalacion = null; // evento beforeinstallprompt (Chrome, Edge, Android)

    function pie() {
        let footer = document.querySelector("footer.footer");
        if (!footer) {
            footer = document.createElement("footer");
            footer.className = "footer footer-mini";
            footer.innerHTML = `<div class="container footer-content">
                <a href="index.html" class="logo">CEUTA<span>PLAY</span></a>
                <p>© ${new Date().getFullYear()} CeutaPlay · Ceuta</p></div>`;
            document.body.append(footer);
        }
        if (footer.querySelector(".footer-links")) return;
        const enlaces = document.createElement("nav");
        enlaces.className = "footer-links container";
        enlaces.setAttribute("aria-label", "Información");
        enlaces.innerHTML = `
            <a href="como-funciona.html">Cómo funciona</a>
            <a href="legal.html#privacidad">Privacidad</a>
            <a href="legal.html#cookies">Cookies</a>
            <a href="legal.html#condiciones">Condiciones de uso</a>
            <a href="legal.html#cancelaciones">Cancelaciones y reventa</a>
            <button type="button" class="footer-install" data-nav="instalar" hidden>📲 Instalar app</button>
            <span class="footer-lang" id="footer-lang"></span>`;
        footer.append(enlaces);
        enlaces.addEventListener("click", async (e) => {
            if (!e.target.closest("[data-nav=instalar]") || !instalacion) return;
            instalacion.prompt();
            await instalacion.userChoice.catch(() => null);
            instalacion = null;
            enlaces.querySelector("[data-nav=instalar]").hidden = true;
        });
        if (typeof I18n !== "undefined") I18n.selector(document.getElementById("footer-lang"));
    }

    function registrarApp() {
        if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
            navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker:", e));
        }
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            instalacion = e;
            const boton = document.querySelector("[data-nav=instalar]");
            if (boton) boton.hidden = false;
        });
    }

    function iniciar() {
        pie();
        registrarApp();
        header = document.getElementById("site-header");
        if (!header) return;
        pintar();

        header.addEventListener("click", (event) => {
            const boton = event.target.closest("[data-nav]");
            if (boton && boton.dataset.nav === "logout") cerrarSesion();
            if (boton && boton.dataset.nav === "tema" && typeof Tema !== "undefined") {
                Tema.alternar();
                pintar();
                header.querySelector("[data-nav=tema]")?.focus();
            }
            if (boton && boton.dataset.nav === "avisos" && (typeof Avisos !== "undefined")) Avisos.alternar();
            if (boton && boton.dataset.nav === "menu") {
                const abierto = header.classList.toggle("menu-abierto");
                boton.setAttribute("aria-expanded", abierto);
            }
            // Al elegir un enlace del menú en el móvil, se cierra
            if (event.target.closest(".nav-menu a")) header.classList.remove("menu-abierto");
        });

        document.addEventListener("sesion-cambiada", pintar);

        Store.inicializar()
            .catch((error) => console.error(error))
            .finally(() => {
                listo = true;
                pintar();
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

    return { pintar };
})();
