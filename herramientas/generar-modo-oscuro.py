"""Genera el modo oscuro de CeutaPlay a partir de public/css/styles.css.

    python herramientas/generar-modo-oscuro.py

Recorre todas las reglas de la hoja de estilos y, para cada declaración que
usa un color claro (fondos blancos, tintes suaves, bordes grises, textos
oscuros sobre tinte), escribe la misma regla con el color oscuro equivalente
bajo :root[data-tema="oscuro"]. El resultado se guarda al final de
styles.css, entre dos marcas; si ya existía, se sustituye.

Vuelve a ejecutarlo cuando añadas estilos con colores fijos.
"""
import re
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "public" / "css" / "styles.css"
INICIO = "/* ===== MODO OSCURO (generado por herramientas/generar-modo-oscuro.py: no editar a mano) ===== */"
FIN = "/* ===== FIN DEL MODO OSCURO ===== */"
RAIZ = ':root[data-tema="oscuro"]'

VARIABLES = """
    color-scheme: dark;
    --primary: #3b82f6;
    --primary-dark: #60a5fa;
    --dark: #e5e7eb;
    --text: #a3b0c2;
    --light: #0b1120;
    --white: #131c2f;
    --border: #24314a;
    --border-strong: #3a4a66;
    --muted-bg: #1e293b;
    --accent-bg: #16234a;
    --accent-border: #1e40af;
    --accent-text: #bfdbfe;
"""

# color claro -> (fondo, borde, texto). None = se deja igual.
COLORES = {
    "white": ("var(--white)", "var(--border)", None),
    "#fff": ("var(--white)", "var(--border)", None),
    "#ffffff": ("var(--white)", "var(--border)", None),
    "#f8fafc": ("#0f1729", "var(--border)", None),
    "#f1f5f9": ("#1a2436", "var(--border)", None),
    "#e2e8f0": ("#1e293b", "var(--border)", None),
    "#cbd5e1": ("#334155", "var(--border-strong)", None),
    "#94a3b8": ("#475569", "var(--border-strong)", "#a3b0c2"),
    "#eff6ff": ("var(--accent-bg)", "var(--accent-border)", None),
    "#dbeafe": ("#1e3a8a", "var(--accent-border)", None),
    "#bfdbfe": ("#1e3a8a", "var(--accent-border)", None),
    "#93c5fd": ("#1e40af", "#2563eb", None),
    "#f0fdf4": ("#052e1a", "#166534", None),
    "#ecfdf5": ("#052e1a", "#166534", None),
    "#dcfce7": ("#064e3b", "#166534", None),
    "#bbf7d0": ("#064e3b", "#166534", None),
    "#86efac": ("#065f46", "#15803d", None),
    "#fffbeb": ("#2d2106", "#854d0e", None),
    "#fef3c7": ("#3a2a05", "#854d0e", None),
    "#fde68a": ("#4a3507", "#854d0e", None),
    "#fcd34d": ("#5c4108", "#a16207", None),
    "#fef2f2": ("#330d0d", "#7f1d1d", None),
    "#fee2e2": ("#450a0a", "#7f1d1d", None),
    "#fecaca": ("#450a0a", "#7f1d1d", None),
    "#fca5a5": ("#5f1414", "#991b1b", None),
    "#f5f3ff": ("#1e1240", "#4c1d95", None),
    "#ede9fe": ("#2e1065", "#4c1d95", None),
    "#c4b5fd": ("#3b1d7a", "#6d28d9", None),
    # textos oscuros sobre tinte claro -> textos claros
    "#0f172a": (None, None, "#e5e7eb"),
    "#475569": (None, None, "#a3b0c2"),
    "#64748b": (None, None, "#a3b0c2"),
    "#1e3a8a": (None, None, "#bfdbfe"),
    "#92400e": (None, None, "#fcd34d"),
    "#78350f": (None, None, "#fcd34d"),
    "#b45309": (None, None, "#fbbf24"),
    "#166534": (None, None, "#86efac"),
    "#15803d": (None, None, "#86efac"),
    "#14532d": (None, None, "#86efac"),
    "#047857": (None, None, "#6ee7b7"),
    "#991b1b": (None, None, "#fca5a5"),
    "#b91c1c": (None, None, "#fca5a5"),
    "#5b21b6": (None, None, "#c4b5fd"),
    "#6d28d9": (None, None, "#c4b5fd"),
}

# Fondos con var(--dark): en oscuro --dark pasa a ser un color de texto claro
FONDO_DARK = {
    ".auction-filter.active": "var(--primary)",
    ".auction-btn": "var(--primary)",
}
FONDO_DARK_DEFECTO = "#020617"

TOKEN = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\bwhite\b")


def categoria(prop):
    if prop.startswith("background") or prop in ("fill",):
        return 0
    if prop.startswith("border") or prop.startswith("outline") or prop in ("box-shadow",):
        return 1
    if prop in ("color", "caret-color", "text-decoration-color", "stroke", "accent-color"):
        return 2
    return None


def convertir(prop, valor, selector):
    cat = categoria(prop)
    if cat is None:
        return None
    nuevo = valor
    if cat == 0 and "var(--dark)" in valor:
        nuevo = nuevo.replace("var(--dark)", FONDO_DARK.get(selector.strip(), FONDO_DARK_DEFECTO))
    if cat == 2 and "var(--white)" in valor:
        nuevo = nuevo.replace("var(--white)", "#ffffff")  # texto blanco sobre fondo oscuro: sigue blanco
    if cat == 1 and "var(--dark)" in valor:
        nuevo = nuevo.replace("var(--dark)", "var(--primary)")

    def sustituir(m):
        clave = m.group(0).lower()
        destino = COLORES.get(clave, (None, None, None))[cat]
        return destino or m.group(0)

    nuevo = TOKEN.sub(sustituir, nuevo)
    return nuevo if nuevo != valor else None


def reglas(texto):
    """Devuelve [(contexto_media, selector, cuerpo)] de un CSS sin comentarios."""
    salida = []
    i = 0
    n = len(texto)

    def bloque(desde):
        nivel = 0
        for j in range(desde, n):
            if texto[j] == "{":
                nivel += 1
            elif texto[j] == "}":
                nivel -= 1
                if nivel == 0:
                    return j
        return n

    def recorrer(a, b, media):
        k = a
        while k < b:
            llave = texto.find("{", k, b)
            if llave == -1:
                break
            cabecera = texto[k:llave].strip()
            # sentencias sueltas como @import ...;
            if ";" in cabecera and cabecera.startswith("@"):
                cabecera = cabecera.split(";")[-1].strip()
            cierre = bloque(llave)
            if cabecera.startswith("@media"):
                if "print" not in cabecera:
                    recorrer(llave + 1, cierre, cabecera)
            elif cabecera.startswith("@"):
                pass  # @keyframes, @font-face…
            elif cabecera:
                salida.append((media, cabecera, texto[llave + 1:cierre]))
            k = cierre + 1

    recorrer(0, n, None)
    return salida


def prefijar(selector):
    partes = []
    for s in selector.split(","):
        s = s.strip()
        if s in (":root", "html"):
            partes.append(RAIZ)
        elif s.startswith(":root"):
            partes.append(RAIZ + s[len(":root"):])
        else:
            partes.append(f"{RAIZ} {s}")
    return ",\n".join(partes)


def main():
    original = CSS.read_text(encoding="utf-8")
    base = original.split(INICIO)[0].rstrip() + "\n"
    sin_comentarios = re.sub(r"/\*.*?\*/", "", base, flags=re.S)

    trozos = [INICIO, f"{RAIZ} {{{VARIABLES}}}"]
    for media, selector, cuerpo in reglas(sin_comentarios):
        cambios = []
        for decl in cuerpo.split(";"):
            if ":" not in decl:
                continue
            prop, valor = decl.split(":", 1)
            prop, valor = prop.strip().lower(), valor.strip()
            nuevo = convertir(prop, valor, selector)
            if nuevo:
                cambios.append(f"    {prop}: {nuevo};")
        if not cambios:
            continue
        regla = f"{prefijar(selector)} {{\n" + "\n".join(cambios) + "\n}"
        if media:
            regla = f"{media} {{\n{regla}\n}}"
        trozos.append(regla)

    # retoques que no salen de la conversión automática
    trozos.append(f"""{RAIZ} img {{ filter: brightness(0.92); }}
{RAIZ} iframe {{ filter: invert(0.9) hue-rotate(180deg); }}
{RAIZ} .login-page {{ background: linear-gradient(140deg, #0f1a33, var(--light) 65%); }}
{RAIZ} input, {RAIZ} select, {RAIZ} textarea {{ background-color: #0f1729; color: var(--dark); }}""")
    trozos.append(FIN)
    CSS.write_text(base + "\n" + "\n\n".join(trozos) + "\n", encoding="utf-8")
    print(f"Modo oscuro: {len(trozos) - 3} reglas generadas en {CSS.name}")


if __name__ == "__main__":
    main()
