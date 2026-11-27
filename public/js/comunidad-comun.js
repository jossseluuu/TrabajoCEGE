// Piezas de la comunidad que comparten comunidad.html y perfil.html:
// avatar con la inicial, tarjeta de nivel con barra de progreso e insignias.

const Comunidad = (() => {

    const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

    // Color estable por usuario (mismo usuario → mismo color en toda la web)
    const COLORES = ["#2563eb", "#0891b2", "#059669", "#7c3aed", "#db2777", "#ea580c", "#4f46e5", "#0d9488"];
    function colorDe(id) {
        let h = 0;
        for (const c of String(id || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return COLORES[h % COLORES.length];
    }

    function avatar(usuario, tamano = "") {
        const inicial = esc((usuario?.nombre || "?").trim().charAt(0).toUpperCase());
        return `<span class="avatar ${tamano}" style="--avatar:${colorDe(usuario?.id)}" aria-hidden="true">${inicial}</span>`;
    }

    function nivelHTML(nivel, { compacto = false } = {}) {
        const desde = nivel.min;
        const hasta = nivel.siguiente ? nivel.siguiente.min : nivel.puntos;
        const pct = nivel.siguiente ? Math.round((nivel.puntos - desde) / (hasta - desde) * 100) : 100;
        const etiqueta = nivel.siguiente
            ? `${nivel.faltan} pts para ${nivel.siguiente.icono} ${esc(nivel.siguiente.nombre)}`
            : "Nivel máximo";
        return `
            <div class="level ${compacto ? "level-compact" : ""}">
                <div class="level-head">
                    <strong>${nivel.icono} ${esc(nivel.nombre)}</strong>
                    <span>${nivel.puntos} pts</span>
                </div>
                <div class="level-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"
                     aria-label="Progreso de nivel: ${etiqueta}"><span style="width:${pct}%"></span></div>
                ${compacto ? "" : `<small>${etiqueta}</small>`}
            </div>`;
    }

    function insigniasHTML(insignias, { todas = false } = {}) {
        const lista = todas ? Store.INSIGNIAS : insignias;
        if (!lista.length) return `<p class="form-hint">Aún sin insignias.</p>`;
        const ganadas = new Set(insignias.map((i) => i.id));
        return `<ul class="badges">${lista.map((i) => `
            <li class="badge ${ganadas.has(i.id) ? "" : "badge-off"}" title="${esc(i.texto)}">
                <span aria-hidden="true">${i.icono}</span> ${esc(i.nombre)}
                <span class="sr-only">${ganadas.has(i.id) ? "(conseguida)" : "(pendiente)"}: ${esc(i.texto)}</span>
            </li>`).join("")}</ul>`;
    }

    const fechaCorta = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    const textoFecha = (fecha) => fechaCorta.format(new Date(`${fecha}T00:00:00Z`));

    return { esc, avatar, colorDe, nivelHTML, insigniasHTML, textoFecha };
})();
