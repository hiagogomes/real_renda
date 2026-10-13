from django import template
from django.conf import settings

register = template.Library()


@register.inclusion_tag("simulador/_ad.html")
def anuncio(nome, formato="horizontal"):
    """Renderiza um bloco de anúncio AdSense (ou um placeholder em DEBUG).

    nome    -> chave em settings.ADS_SLOTS (ex.: "meio1", "lateral", "rodape")
    formato -> "horizontal" | "vertical" | "retangulo" (define a altura reservada no CSS)
    """
    client = getattr(settings, "ADSENSE_CLIENT", "")
    slot = getattr(settings, "ADS_SLOTS", {}).get(nome, "")
    return {
        "nome": nome,
        "formato": formato,
        "client": client,
        "slot": slot,
        "debug": settings.DEBUG and not client,
    }
