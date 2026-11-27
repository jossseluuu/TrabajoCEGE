// Parte de viento en Ceuta para los deportes náuticos (kayak, paddle surf,
// piragüismo). Usa la previsión gratuita de Open-Meteo (sin clave). Solo se
// envían las coordenadas de Ceuta: ningún dato del usuario.
//
// Levante: viento del este (45°–135°). Poniente: del oeste (225°–315°).
// Con levante la bahía sur (Ribera, Chorrillo) se pica y la norte (Benítez,
// Calamocarro) queda más resguardada; con poniente, al revés.

const Viento = (() => {

    const URL = "https://api.open-meteo.com/v1/forecast?latitude=35.889&longitude=-5.316" +
        "&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh" +
        "&timezone=Europe%2FMadrid&forecast_days=3";
    const CACHE = "cp_viento";
    const VALIDEZ = 30 * 60 * 1000;
    const NAUTICOS = ["Kayak", "Paddle surf", "Piragüismo"];

    // Umbrales en km/h (viento medio y rachas)
    const UMBRAL = { bueno: [15, 25], moderado: [25, 38] };

    const ESTADOS = {
        bueno: { icono: "🟢", texto: "Buen momento" },
        moderado: { icono: "🟡", texto: "Viento moderado" },
        malo: { icono: "🔴", texto: "No recomendable" },
    };

    function tipoDe(grados) {
        if (grados >= 45 && grados <= 135) return "levante";
        if (grados >= 225 && grados <= 315) return "poniente";
        return "otro";
    }

    function estadoDe(velocidad, rachas) {
        if (velocidad < UMBRAL.bueno[0] && rachas < UMBRAL.bueno[1]) return "bueno";
        if (velocidad < UMBRAL.moderado[0] && rachas < UMBRAL.moderado[1]) return "moderado";
        return "malo";
    }

    function consejo(tipo) {
        if (tipo === "levante") return "Con levante, mejor la bahía norte (Benítez, Calamocarro).";
        if (tipo === "poniente") return "Con poniente, mejor la bahía sur (Ribera, Chorrillo).";
        return "Viento sin dirección dominante: las dos bahías están parecidas.";
    }

    let pendiente = null;

    // Previsión por horas: [{ fecha, hora, velocidad, rachas, direccion, tipo, estado }]
    function obtener() {
        try {
            const guardado = JSON.parse(sessionStorage.getItem(CACHE) || "null");
            if (guardado && Date.now() - guardado.creado < VALIDEZ) return Promise.resolve(guardado.horas);
        } catch { /* caché dañada: se vuelve a pedir */ }
        pendiente = pendiente || fetch(URL)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Sin previsión"))))
            .then((d) => {
                const h = d.hourly;
                const horas = h.time.map((t, i) => {
                    const velocidad = Math.round(h.wind_speed_10m[i]);
                    const rachas = Math.round(h.wind_gusts_10m[i]);
                    const direccion = h.wind_direction_10m[i];
                    return {
                        fecha: t.slice(0, 10), hora: t.slice(11, 16), velocidad, rachas, direccion,
                        tipo: tipoDe(direccion), estado: estadoDe(velocidad, rachas),
                    };
                });
                sessionStorage.setItem(CACHE, JSON.stringify({ creado: Date.now(), horas }));
                return horas;
            })
            .finally(() => (pendiente = null));
        return pendiente;
    }

    // Primera hora "buena" dentro del horario náutico de las próximas 24 h
    function mejorVentana(horas, ahoraTexto, desde = "10:00", hasta = "19:00") {
        const limite = new Date(Date.parse(`${ahoraTexto.slice(0, 10)}T00:00:00Z`) + 2 * 864e5).toISOString().slice(0, 10);
        return horas.find((x) => `${x.fecha}T${x.hora}` > ahoraTexto && x.fecha < limite &&
            x.hora >= desde && x.hora < hasta && x.estado === "bueno") || null;
    }

    const esNautico = (deporte) => NAUTICOS.includes(deporte);

    return { obtener, mejorVentana, consejo, esNautico, ESTADOS, NAUTICOS, tipoDe, estadoDe };
})();
