// Genera supabase/seed.sql a partir de los datos de ejemplo de public/js/data.js
//
//   node supabase/generar-seed.js > supabase/seed.sql
//
// El seed crea usuarios ficticios (contraseña "demo1234"), sus reservas,
// reseñas, quién se ha unido a qué reserva y algunas subastas de reventa.
// NO crea ni modifica la cuenta de administrador (admin@ceutaplay.es): esa
// cuenta es real y su contraseña es privada.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { Intl, Math, Date, console };
vm.createContext(ctx);
const fuente = fs.readFileSync(path.join(__dirname, "..", "public", "js", "data.js"), "utf8")
    .replace(/^const (\w+) =/gm, "var $1 =");
vm.runInContext(fuente, ctx);
const { USUARIOS_DEMO, RESERVAS_DEMO, OPINIONES_DEMO, SUBASTAS_DEMO, INSTALACIONES, FACTURACION_DEFECTO } = ctx;

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const usuarios = USUARIOS_DEMO.filter((u) => !u.admin);
const v = (clave) => `v_${clave}`;
const porEmail = (email) => USUARIOS_DEMO.find((u) => u.email === email).clave;
const lineas = [];
const out = (t = "") => lineas.push(t);

out("-- =====================================================================");
out("-- CeutaPlay · Datos de ejemplo (ficticios) para el servidor de pruebas");
out("--");
out("-- GENERADO con: node supabase/generar-seed.js > supabase/seed.sql");
out("-- No lo edites a mano: cambia los datos en public/js/data.js y regénéralo.");
out("--");
out("-- Ejecutar DESPUÉS de schema.sql, admin.sql y plataforma.sql.");
out("-- Crea usuarios ficticios (contraseña: demo1234), reservas, reseñas,");
out("-- participantes y subastas. Si ya se ha ejecutado, no hace nada.");
out("-- No crea ni toca la cuenta de administrador.");
out("--");
out("-- Úsalo solo en un proyecto de pruebas: son cuentas con contraseña conocida.");
out("-- =====================================================================");
out();
out("do $$");
out("declare");
for (const u of usuarios) out(`    ${v(u.clave)} uuid;`);
out("    v_res uuid;");
out("    v_sub uuid;");
out("    v_hoy date := (now() at time zone 'Europe/Madrid')::date;");
out("begin");
out(`    if exists (select 1 from auth.users where email = ${q(usuarios[0].email)}) then`);
out("        raise notice 'Los datos de ejemplo ya estaban creados.';");
out("        return;");
out("    end if;");
out();
out("    -- Los nombres de ejemplo se ponen tal cual (sin pasar por el filtro de nombres)");
out("    alter table public.perfiles disable trigger perfiles_validar_nombre;");
out();
out("    -- ---------- usuarios ----------");
for (const u of usuarios) {
    out(`    ${v(u.clave)} := gen_random_uuid();`);
    out(`    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,`);
    out(`        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,`);
    out(`        confirmation_token, recovery_token, email_change, email_change_token_new)`);
    out(`    values ('00000000-0000-0000-0000-000000000000', ${v(u.clave)}, 'authenticated', 'authenticated', ${q(u.email)},`);
    out(`        extensions.crypt(${q(u.password)}, extensions.gen_salt('bf')), now(),`);
    out(`        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', ${q(u.nombre)}),`);
    out(`        now() - interval '${60 - usuarios.indexOf(u) * 3} days', now(), '', '', '', '');`);
    out(`    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)`);
    out(`    values (gen_random_uuid(), ${v(u.clave)}, ${v(u.clave)}::text,`);
    out(`        jsonb_build_object('sub', ${v(u.clave)}::text, 'email', ${q(u.email)}, 'email_verified', true), 'email', now(), now(), now());`);
    out(`    update public.perfiles set nombre = ${q(u.nombre)}, bio = ${q(u.bio || "")}, deporte_favorito = ${q(u.deporte || "")}`);
    out(`        where id = ${v(u.clave)};`);
    if (u.gestiona) {
        for (const id of u.gestiona) out(`    insert into public.gestores (usuario_id, instalacion_id) values (${v(u.clave)}, ${id});`);
    }
    if (u.entidad) {
        out(`    insert into public.entidades_solidarias (usuario_id, nombre, descripcion, acreditada)`);
        out(`    values (${v(u.clave)}, ${q(u.entidad.nombre)}, ${q(u.entidad.descripcion)}, ${u.entidad.acreditada ? "true" : "false"});`);
    }
    out();
}
out("    alter table public.perfiles enable trigger perfiles_validar_nombre;");
out();

const precio = (instalacionId) => INSTALACIONES.find((i) => i.id === instalacionId).precioPrueba || 0;
const nombreInst = (instalacionId) => INSTALACIONES.find((i) => i.id === instalacionId).nombre;

out("    -- ---------- reservas (cobradas en CeutaCoins) ----------");
for (const r of RESERVAS_DEMO) {
    const fecha = `v_hoy + ${r.dias}`;
    const importe = `public.precio_turno(${precio(r.instalacionId)}, ${fecha}, ${q(r.hora)}, ${r.duracion})`;
    out(`    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)`);
    out(`    values (${v(r.usuario)}, ${r.instalacionId}, ${q(r.pista)}, ${fecha}, ${q(r.hora)}, ${r.duracion}, ${importe},`);
    out(`        ${r.publica ? "true" : "false"}, ${r.publica ? "true" : "false"}, ${r.plazas || 4}, ${q(r.nota || "")}, now() + interval '${r.dias - 3} days')`);
    out("    returning id into v_res;");
    out(`    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)`);
    out(`    values (${v(r.usuario)}, -${importe}, 'reserva', ${q(`${nombreInst(r.instalacionId)} · ${r.pista}`)}, v_res, now() + interval '${r.dias - 3} days');`);
    for (const p of r.participantes || []) {
        out(`    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, ${v(p.usuario)}, ${q(p.estado)}, ${q(p.mensaje || "")});`);
    }
}
out();
out("    -- un bloqueo del gestor (mantenimiento)");
out(`    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, tipo, nota)`);
out(`    values (${v("gestor")}, 1, 'Pista 3', v_hoy + 2, '09:00', 120, 0, 'bloqueo', 'Mantenimiento del césped');`);
out();

out("    -- ---------- reseñas ----------");
for (const o of OPINIONES_DEMO) {
    out(`    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)`);
    out(`    values (${o.instalacionId}, ${v(o.usuario)}, ${o.puntuacion}, ${q(o.comentario)}, now() + interval '${o.dias} days')`);
    out("    on conflict do nothing;");
}
out();

out("    -- ---------- subastas de reventa (cada una sobre una reserva del vendedor) ----------");
for (const s of SUBASTAS_DEMO) {
    const vend = porEmail(s.vendedor);
    const inst = INSTALACIONES.find((i) => i.id === s.instalacionId);
    // hora del partido redondeada, dentro del horario (de 10:00 a 20:00)
    const hora = `lpad(least(20, greatest(10, extract(hour from now() at time zone 'Europe/Madrid')::integer + ${s.partidoEnHoras % 24}))::text, 2, '0') || ':00'`;
    const fecha = `v_hoy + ${Math.floor(s.partidoEnHoras / 24) + (s.partidoEnHoras >= 6 ? 1 : 0)}`;
    out("    begin");
    out(`        insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe)`);
    out(`        values (${v(vend)}, ${inst.id}, ${q(inst.pistas[inst.pistas.length - 1])}, ${fecha}, ${hora}, 60, ${inst.precioPrueba})`);
    out("        returning id into v_res;");
    out(`        insert into public.subastas (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,`);
    out(`            vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)`);
    out(`        select instalacion_id, ${q(inst.nombre)}, ${q(inst.deporte)}, fecha, hora, ${q(s.descripcion)}, ${s.precioSalida}, ${s.incremento},`);
    out(`            least(now() + interval '${s.terminaEnMin} minutes', public.inicio_turno(fecha, hora)),`);
    out(`            usuario_id, 'reventa', pista, id, ${FACTURACION_DEFECTO.comisionSubastas}, ${FACTURACION_DEFECTO.ipsi}`);
    out("        from public.reservas where id = v_res");
    out("        returning id into v_sub;");
    s.pujas.forEach((p, k) => {
        out(`        insert into public.pujas (subasta_id, usuario_id, cantidad, fecha)`);
        out(`        values (v_sub, ${v(porEmail(p.email))}, ${p.cantidad}, now() - interval '${(s.pujas.length - k) * 5} minutes');`);
    });
    out("    exception when others then");
    out("        raise notice 'Subasta de ejemplo omitida: %', sqlerrm;");
    out("    end;");
}
out();
out("    -- ---------- una petición de pista solidaria para hoy ----------");
out(`    insert into public.peticiones_solidarias (entidad_id, deporte, fecha, desde, hasta)`);
out(`    values (${v("entidad")}, 'Pádel', v_hoy, '16:00', '20:00');`);
out();
out("    raise notice 'Datos de ejemplo creados.';");
out("end;");
out("$$;");

process.stdout.write(lineas.join("\n") + "\n");
