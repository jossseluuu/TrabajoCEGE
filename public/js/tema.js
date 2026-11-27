// Modo claro / oscuro. Se carga en el <head> (sin defer) para aplicar el tema
// antes de pintar la página y evitar un destello blanco.
// Si el usuario no ha elegido, se sigue el ajuste del sistema.
// Los estilos del modo oscuro están al final de css/styles.css (generados por
// herramientas/generar-modo-oscuro.py).

window.Tema = (() => {
    const CLAVE = "cp_tema";
    const sistema = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    const elegido = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
    const preferido = () => elegido() || (sistema && sistema.matches ? "oscuro" : "claro");

    function aplicar(tema) {
        document.documentElement.dataset.tema = tema;
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.append(meta);
        }
        meta.content = tema === "oscuro" ? "#0b1120" : "#2563eb";
    }

    aplicar(preferido());

    // Idioma elegido (js/i18n.js) desde el principio
    try {
        if (localStorage.getItem("cp_idioma") === "en") document.documentElement.lang = "en";
    } catch { /* sin almacenamiento */ }
    if (sistema) {
        sistema.addEventListener("change", () => {
            if (!elegido()) {
                aplicar(preferido());
                document.dispatchEvent(new CustomEvent("tema-cambiado"));
            }
        });
    }

    return {
        actual: () => document.documentElement.dataset.tema,
        alternar() {
            const tema = this.actual() === "oscuro" ? "claro" : "oscuro";
            try { localStorage.setItem(CLAVE, tema); } catch { /* modo privado */ }
            aplicar(tema);
            document.dispatchEvent(new CustomEvent("tema-cambiado"));
        },
    };
})();
