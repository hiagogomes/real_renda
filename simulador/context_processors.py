from django.conf import settings


def site(request):
    """Variáveis globais usadas em todos os templates (SEO, anúncios, contato)."""
    base = getattr(settings, "SITE_URL", "").rstrip("/") or f"{request.scheme}://{request.get_host()}"
    return {
        "DEBUG": settings.DEBUG,
        "SITE_NAME": getattr(settings, "SITE_NAME", "Real Renda"),
        "SITE_BASE": base,
        "CANONICAL": base + request.path,
        "CONTACT_EMAIL": getattr(settings, "CONTACT_EMAIL", ""),
        "ADSENSE_CLIENT": getattr(settings, "ADSENSE_CLIENT", ""),
    }
