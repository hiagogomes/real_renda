from django.contrib.sitemaps.views import sitemap
from django.urls import path
from django.views.generic import RedirectView

from . import views

app_name = "simulador"

urlpatterns = [
    path("", views.index, name="index"),
    path("juros-compostos/", views.juros_compostos, name="juros_compostos"),
    path("viver-de-renda/", RedirectView.as_view(pattern_name="simulador:index", permanent=True)),
    path("api/indicadores/", views.api_indicadores, name="api_indicadores"),
    path("manifest.webmanifest", views.manifest, name="manifest"),
    path("sw.js", views.service_worker, name="sw"),
    path("sobre/", views.sobre, name="sobre"),
    path("privacidade/", views.privacidade, name="privacidade"),
    path("contato/", views.contato, name="contato"),
    path("robots.txt", views.robots_txt, name="robots"),
    path("ads.txt", views.ads_txt, name="ads"),
    path("sitemap.xml", sitemap, {"sitemaps": {"paginas": views.PaginasSitemap}}, name="sitemap"),
]
