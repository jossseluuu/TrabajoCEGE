from datetime import date, timedelta
from django.shortcuts import render


def home(request):

    deportes = [
        {"nombre": "Pádel", "icono": "🎾"},
        {"nombre": "Fútbol", "icono": "⚽"},
        {"nombre": "Tenis", "icono": "🎾"},
        {"nombre": "Baloncesto", "icono": "🏀"},
    ]

    instalaciones = [
        {
            "id": 1,
            "nombre": "Pistas de Pádel",
            "ubicacion": "Ceuta",
            "deporte": "Pádel",
            "precio": 20,
            "imagen": "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=900",
        },
        {
            "id": 2,
            "nombre": "Campo de Fútbol",
            "ubicacion": "Ceuta",
            "deporte": "Fútbol",
            "precio": 45,
            "imagen": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900",
        },
        {
            "id": 3,
            "nombre": "Pistas de Tenis",
            "ubicacion": "Ceuta",
            "deporte": "Tenis",
            "precio": 15,
            "imagen": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=900",
        },
    ]

    subastas = [
        {
            "nombre": "Pista de Pádel",
            "precio_original": 24,
            "precio_actual": 16,
            "hora": "19:00",
        },
        {
            "nombre": "Pista de Tenis",
            "precio_original": 20,
            "precio_actual": 12,
            "hora": "20:30",
        },
    ]

    contexto = {
        "deportes": deportes,
        "instalaciones": instalaciones,
        "subastas": subastas,
        "fecha_minima": date.today().isoformat(),
        "fecha_maxima": (date.today() + timedelta(days=30)).isoformat(),
    }

    return render(request, "core/home.html", contexto)