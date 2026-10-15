import os

from django import template
from django.contrib.staticfiles import finders
from django.templatetags.static import static
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


@register.simple_tag
def asset(caminho):
    """URL estática com ?v=<data de modificação>: o navegador/service worker nunca serve versão velha."""
    url = static(caminho)
    achado = finders.find(caminho)
    if isinstance(achado, str) and os.path.exists(achado):
        url += f"?v={int(os.path.getmtime(achado))}"
    return url
