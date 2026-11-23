// Capa de datos de CeutaPlay: usuarios, sesión y subastas.
//
// GitHub Pages no tiene servidor, así que todo se guarda en el navegador
// (localStorage). Es suficiente para el trabajo y para la demostración, pero
// NO es seguro para una web real: cualquiera puede ver o modificar los datos
// desde las herramientas del navegador.
//
// Todo el resto de la web habla solo con este objeto `Store`. Si en el futuro
// se usa un backend de verdad (Firebase, Supabase, Django en Render…), basta
// con reescribir este archivo manteniendo las mismas funciones.

const Store = (() => {

    // Cada versión publicada (/TrabajoCEGE/, /TrabajoCEGE/dev/, /TrabajoCEGE/devep/)
    // comparte dominio y por tanto localStorage. Se añade la carpeta a la clave
    // para que cada rama tenga sus propios usuarios y subastas.
    const CARPETA = location.pathname.replace(/[^/]*$/, "");
    const KEYS = {
        usuarios: `cp_usuarios:${CARPETA}`,
        subastas: `cp_subastas:${CARPETA}`,
        sesion: `cp_sesion:${CARPETA}`,
    };

    const MINUTO = 60 * 1000;

    // ---------- utilidades ----------

    function leer(clave, porDefecto) {
        try {
            const valor = localStorage.getItem(clave);
            return valor ? JSON.parse(valor) : porDefecto;
        } catch {
            return porDefecto;
        }
    }

    function guardar(clave, valor) {
        localStorage.setItem(clave, JSON.stringify(valor));
    }

    function nuevoId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function normalizarEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    // Hash SHA-256 de la contraseña con una "sal" aleatoria por usuario,
    // para no guardar nunca la contraseña en texto plano.
    async function hashPassword(password, sal) {
        const texto = `${sal}:${password}`;
        if (window.crypto && crypto.subtle) {
            const bytes = new TextEncoder().encode(texto);
            const hash = await crypto.subtle.digest("SHA-256", bytes);
            return Array.from(new Uint8Array(hash))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        }
        // Alternativa si el navegador no permite crypto.subtle (no es criptográfica)
        let h = 0;
        for (let i = 0; i < texto.length; i++) {
            h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
        }
        return "x" + (h >>> 0).toString(16);
    }

    function usuarioPublico(usuario) {
        if (!usuario) return null;
        return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
    }

    // ---------- usuarios y sesión ----------

    function getUsuarios() {
        return leer(KEYS.usuarios, []);
    }

    function getUsuario(id) {
        return usuarioPublico(getUsuarios().find((u) => u.id === id));
    }

    async function registrar({ nombre, email, password }) {
        nombre = String(nombre || "").trim();
        email = normalizarEmail(email);

        if (nombre.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
        if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");

        const usuarios = getUsuarios();
        if (usuarios.some((u) => u.email === email)) {
            throw new Error("Ya existe una cuenta con ese correo.");
        }

        const sal = nuevoId();
        const usuario = {
            id: nuevoId(),
            nombre,
            email,
            sal,
            hash: await hashPassword(password, sal),
            creado: Date.now(),
        };
        usuarios.push(usuario);
        guardar(KEYS.usuarios, usuarios);
        return usuarioPublico(usuario);
    }

    async function login(email, password, recordar) {
        email = normalizarEmail(email);
        const usuario = getUsuarios().find((u) => u.email === email);
        const hash = usuario ? await hashPassword(password, usuario.sal) : null;

        if (!usuario || hash !== usuario.hash) {
            throw new Error("Correo o contraseña incorrectos.");
        }

        // Sin "Recordarme" la sesión dura lo que la pestaña (sessionStorage).
        // Así se pueden abrir dos pestañas con usuarios distintos y pujar entre ellos.
        cerrarSesion();
        const destino = recordar ? localStorage : sessionStorage;
        destino.setItem(KEYS.sesion, usuario.id);
        return usuarioPublico(usuario);
    }

    function cerrarSesion() {
        sessionStorage.removeItem(KEYS.sesion);
        localStorage.removeItem(KEYS.sesion);
    }

    function usuarioActual() {
        const id = sessionStorage.getItem(KEYS.sesion) || localStorage.getItem(KEYS.sesion);
        return id ? getUsuario(id) : null;
    }

    // ---------- subastas ----------

    function getSubastasRaw() {
        return leer(KEYS.subastas, []);
    }

    // Añade los campos calculados (estado, puja actual, ganador…)
    function enriquecer(subasta) {
        const ahora = Date.now();
        const pujas = [...subasta.pujas].sort((a, b) => b.cantidad - a.cantidad);
        const mejor = pujas[0] || null;

        let estado = "activa";
        if (subasta.cancelada) estado = "cancelada";
        else if (ahora >= subasta.fin) estado = "finalizada";

        return {
            ...subasta,
            pujas,
            estado,
            precioActual: mejor ? mejor.cantidad : subasta.precioSalida,
            pujaMinima: mejor ? mejor.cantidad + subasta.incremento : subasta.precioSalida,
            mejorPuja: mejor,
            ganador: estado === "finalizada" && mejor ? getUsuario(mejor.usuarioId) : null,
            vendedor: getUsuario(subasta.vendedorId),
            restanteMs: Math.max(0, subasta.fin - ahora),
        };
    }

    function listarSubastas() {
        return getSubastasRaw().map(enriquecer);
    }

    function getSubasta(id) {
        const subasta = getSubastasRaw().find((s) => s.id === id);
        return subasta ? enriquecer(subasta) : null;
    }

    function exigirSesion() {
        const usuario = usuarioActual();
        if (!usuario) throw new Error("Tienes que iniciar sesión.");
        return usuario;
    }

    function crearSubasta({ instalacionId, fecha, hora, precioSalida, incremento, duracionMin, descripcion }) {
        const usuario = exigirSesion();
        const instalacion = INSTALACIONES.find((i) => i.id === Number(instalacionId));

        precioSalida = Number(precioSalida);
        incremento = Number(incremento);
        duracionMin = Number(duracionMin);

        if (!instalacion) throw new Error("Elige una instalación.");
        if (!fecha || !hora) throw new Error("Indica la fecha y la hora del partido.");
        if (!(precioSalida >= 1)) throw new Error("El precio de salida debe ser de al menos 1 €.");
        if (!(incremento >= 1)) throw new Error("El incremento mínimo debe ser de al menos 1 €.");
        if (!(duracionMin >= 1)) throw new Error("Elige la duración de la subasta.");

        const fin = Date.now() + duracionMin * MINUTO;
        const inicioPartido = new Date(`${fecha}T${hora}`).getTime();
        if (inicioPartido <= fin) {
            throw new Error("La subasta tiene que terminar antes de que empiece el partido.");
        }

        const subasta = {
            id: nuevoId(),
            instalacionId: instalacion.id,
            titulo: instalacion.nombre,
            deporte: instalacion.deporte,
            imagen: instalacion.imagen,
            fecha,
            hora,
            descripcion: String(descripcion || "").trim().slice(0, 200),
            precioSalida,
            incremento,
            fin,
            vendedorId: usuario.id,
            pujas: [],
            cancelada: false,
            creada: Date.now(),
        };

        const subastas = getSubastasRaw();
        subastas.push(subasta);
        guardar(KEYS.subastas, subastas);
        return enriquecer(subasta);
    }

    function pujar(subastaId, cantidad) {
        const usuario = exigirSesion();
        cantidad = Number(cantidad);

        // Se vuelve a leer justo antes de guardar por si otra pestaña ha pujado.
        const subastas = getSubastasRaw();
        const raw = subastas.find((s) => s.id === subastaId);
        if (!raw) throw new Error("La subasta no existe.");

        const subasta = enriquecer(raw);
        if (subasta.estado !== "activa") throw new Error("Esta subasta ya no está activa.");
        if (subasta.vendedorId === usuario.id) throw new Error("No puedes pujar en tu propia subasta.");
        if (subasta.mejorPuja && subasta.mejorPuja.usuarioId === usuario.id) {
            throw new Error("Ya tienes la puja más alta.");
        }
        if (!Number.isFinite(cantidad) || cantidad < subasta.pujaMinima) {
            throw new Error(`La puja mínima es de ${subasta.pujaMinima} €.`);
        }

        raw.pujas.push({ usuarioId: usuario.id, cantidad, fecha: Date.now() });
        guardar(KEYS.subastas, subastas);
        return enriquecer(raw);
    }

    function cancelarSubasta(subastaId) {
        const usuario = exigirSesion();
        const subastas = getSubastasRaw();
        const raw = subastas.find((s) => s.id === subastaId);

        if (!raw) throw new Error("La subasta no existe.");
        if (raw.vendedorId !== usuario.id) throw new Error("Solo el creador puede cancelarla.");
        if (raw.pujas.length > 0) throw new Error("No se puede cancelar una subasta que ya tiene pujas.");

        raw.cancelada = true;
        guardar(KEYS.subastas, subastas);
    }

    // ---------- datos de ejemplo ----------

    // La primera vez que se abre la web se crean usuarios y subastas de prueba
    // (definidos en data.js) para que la sección no aparezca vacía.
    async function inicializar() {
        if (localStorage.getItem(KEYS.usuarios)) return;

        const usuarios = [];
        for (const demo of USUARIOS_DEMO) {
            const sal = nuevoId();
            usuarios.push({
                id: nuevoId(),
                nombre: demo.nombre,
                email: normalizarEmail(demo.email),
                sal,
                hash: await hashPassword(demo.password, sal),
                creado: Date.now(),
            });
        }
        guardar(KEYS.usuarios, usuarios);

        const idPorEmail = (email) => usuarios.find((u) => u.email === normalizarEmail(email)).id;
        const ahora = Date.now();

        const subastas = SUBASTAS_DEMO.map((demo) => {
            const instalacion = INSTALACIONES.find((i) => i.id === demo.instalacionId);
            // Hora del partido redondeada y dentro del horario de las pistas (9:00–22:00)
            const partido = new Date(ahora + demo.partidoEnHoras * 60 * MINUTO);
            partido.setMinutes(0, 0, 0);
            if (partido.getHours() < 9) {
                partido.setHours(9);
            } else if (partido.getHours() > 22) {
                partido.setDate(partido.getDate() + 1);
                partido.setHours(9);
            }
            return {
                id: nuevoId(),
                instalacionId: instalacion.id,
                titulo: instalacion.nombre,
                deporte: instalacion.deporte,
                imagen: instalacion.imagen,
                fecha: fechaISO(partido),
                hora: partido.toTimeString().slice(0, 5),
                descripcion: demo.descripcion,
                precioSalida: demo.precioSalida,
                incremento: demo.incremento,
                fin: ahora + demo.terminaEnMin * MINUTO,
                vendedorId: idPorEmail(demo.vendedor),
                pujas: demo.pujas.map((p, i) => ({
                    usuarioId: idPorEmail(p.email),
                    cantidad: p.cantidad,
                    fecha: ahora - (demo.pujas.length - i) * 5 * MINUTO,
                })),
                cancelada: false,
                creada: ahora,
            };
        });
        guardar(KEYS.subastas, subastas);
    }

    // Borra todo y vuelve a crear los datos de ejemplo
    async function reiniciarDemo() {
        localStorage.removeItem(KEYS.usuarios);
        localStorage.removeItem(KEYS.subastas);
        cerrarSesion();
        await inicializar();
    }

    return {
        KEYS,
        inicializar,
        reiniciarDemo,
        registrar,
        login,
        cerrarSesion,
        usuarioActual,
        getUsuario,
        listarSubastas,
        getSubasta,
        crearSubasta,
        pujar,
        cancelarSubasta,
    };
})();
