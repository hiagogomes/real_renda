from django.test import TestCase, override_settings
from django.urls import reverse


class PaginasTests(TestCase):
    def test_paginas_publicas_respondem_200(self):
        for nome in ["index", "juros_compostos", "sobre", "privacidade", "contato"]:
            r = self.client.get(reverse(f"simulador:{nome}"))
            self.assertEqual(r.status_code, 200, nome)

    def test_seo_basico_na_home(self):
        html = self.client.get("/").content.decode()
        self.assertIn('<link rel="canonical"', html)
        self.assertIn('"@type": "FAQPage"', html)
        self.assertIn('"@type": "WebApplication"', html)
        self.assertEqual(html.count("<h1"), 1)

    def test_renda_abre_aba_certa(self):
        html = self.client.get("/").content.decode()
        self.assertIn("Quanto você precisa para viver de renda?", html)
        self.assertIn("Calculadora de juros compostos com inflação", self.client.get("/juros-compostos/").content.decode())

    def test_url_antiga_redireciona_e_pwa(self):
        r = self.client.get("/viver-de-renda/")
        self.assertEqual((r.status_code, r["Location"]), (301, "/"))
        self.assertIn("standalone", self.client.get("/manifest.webmanifest").content.decode())
        self.assertIn("addEventListener", self.client.get("/sw.js").content.decode())

    def test_robots_e_sitemap(self):
        self.assertIn("Sitemap:", self.client.get("/robots.txt").content.decode())
        xml = self.client.get("/sitemap.xml").content.decode()
        self.assertIn("/juros-compostos/", xml)

    @override_settings(ADSENSE_CLIENT="ca-pub-123", ADS_SLOTS={"meio1": "111", "lateral": "222", "rodape": "333", "meio2": "444"})
    def test_adsense_ativo_gera_anuncios_e_ads_txt(self):
        html = self.client.get("/").content.decode()
        self.assertIn('data-ad-client="ca-pub-123"', html)
        self.assertIn("adsbygoogle.js?client=ca-pub-123", html)
        self.assertIn("pub-123, DIRECT", self.client.get("/ads.txt").content.decode())

    @override_settings(ADSENSE_CLIENT="", DEBUG=False)
    def test_sem_adsense_nao_renderiza_anuncio(self):
        html = self.client.get("/").content.decode()
        self.assertNotIn("adsbygoogle", html)
