from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse


def _falso_get_json(url, headers=None, timeout=5):
    if "sgs.432" in url: return [{"data": "10/10/2026", "valor": "14.00"}]
    if "sgs.4389" in url: return [{"data": "10/10/2026", "valor": "13.90"}]
    if "sgs.13522" in url: return [{"data": "01/09/2026", "valor": "4.44"}]
    if "sgs.1/" in url: return [{"data": "10/10/2026", "valor": "5.2000"}]
    if "olinda" in url: return {"value": [{"Data": "2026-10-09", "Mediana": 4.1}]}
    if "brapi" in url:
        return {"stocks": [
            {"stock": "BARATA3", "name": "Barata", "close": 1.0, "change": 1.0, "volume": 90_000_000},   # 90 mi
            {"stock": "PETR4", "name": "Petrobras", "close": 36.65, "change": -0.95, "volume": 27_000_000},  # ~989 mi
            {"stock": "VALE3", "name": "Vale", "close": 60.0, "change": 0.5, "volume": 20_000_000},        # 1,2 bi
            {"stock": "ITUB4", "name": "Itau", "close": 35.0, "change": 0.1, "volume": 15_000_000},
            {"stock": "BBAS3", "name": "BB", "close": 25.0, "change": 0.2, "volume": 14_000_000},
            {"stock": "ABEV3", "name": "Ambev", "close": 12.0, "change": 0.3, "volume": 13_000_000},
            {"stock": "MGLU3", "name": "Magalu", "close": 9.0, "change": 2.0, "volume": 12_000_000}]}
    raise AssertionError(url)


class IndicadoresTests(TestCase):
    def setUp(self):
        cache.clear()

    @override_settings(BRAPI_TOKEN="tk")
    @patch("simulador.indicadores._get_json", side_effect=_falso_get_json)
    def test_endpoint_agrega_fontes_e_ordena_acoes_por_volume_financeiro(self, _):
        d = self.client.get("/api/indicadores/").json()
        self.assertEqual(d["selic"]["valor"], 14.0)
        self.assertEqual(d["dolar"]["valor"], 5.2)
        self.assertEqual(d["ipca_focus"]["data"], "09/10/2026")
        tickers = [a["ticker"] for a in d["acoes"]]
        self.assertEqual(len(tickers), 5)
        self.assertEqual(tickers[:2], ["VALE3", "PETR4"])      # BARATA3 tem muitos papéis, mas pouco financeiro
        self.assertNotIn("BARATA3", tickers)

    @override_settings(BRAPI_TOKEN="")
    @patch("simulador.indicadores._get_json", side_effect=_falso_get_json)
    def test_sem_token_omite_acoes(self, _):
        self.assertIsNone(self.client.get("/api/indicadores/").json()["acoes"])

    @patch("simulador.indicadores._get_json", side_effect=OSError("sem rede"))
    def test_falha_total_nao_quebra_o_endpoint(self, _):
        r = self.client.get("/api/indicadores/")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()["selic"])

    def test_usa_ultimo_valor_bom_quando_a_fonte_cai(self):
        with patch("simulador.indicadores._get_json", side_effect=_falso_get_json):
            self.client.get("/api/indicadores/")
        cache.delete("ind:selic")                                  # expira o "fresco", mantém o último bom
        with patch("simulador.indicadores._get_json", side_effect=OSError("fora")):
            self.assertEqual(self.client.get("/api/indicadores/").json()["selic"]["valor"], 14.0)


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
