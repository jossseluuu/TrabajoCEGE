// Conexión con el servidor (Supabase).
//
// Rellena estos dos datos con los de tu proyecto de Supabase:
//   Supabase → tu proyecto → Project Settings → API (o "Connect")
//     · url      → "Project URL"           (https://xxxxxxxx.supabase.co)
//     · anonKey  → clave "anon" / "publishable"
//
// La clave anon/publishable es PÚBLICA por diseño: está pensada para ir en la
// web. La seguridad la ponen las reglas de supabase/schema.sql.
// ¡NUNCA pongas aquí la clave "service_role" / "secret"!
//
// Si se dejan vacíos, la web funciona en modo local (cada navegador con sus
// propios datos).

const CONFIG_SUPABASE = {
    url: "",
    anonKey: "",
};
