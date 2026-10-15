"""Indicadores de mercado buscados no servidor (Python), com cache e fallback por fonte.

Fontes:
- Banco Central (SGS): Selic meta (432), CDI anualizado (4389), IPCA 12 meses (13522), dólar venda (1).
- Banco Central (Olinda/Focus): mediana da expectativa de IPCA do próximo ano.
- brapi.dev (opcional, exige BRAPI_TOKEN): ações mais negociadas da B3.

Cada fonte falha de forma isolada: se uma cair, usa-se o último valor bom em cache (ou None).
"""
import json
import logging
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

log = logging.getLogger(__name__)
TTL = 15 * 60            # dado "fresco"
TTL_ULTIMO_BOM = 7 * 24 * 3600
TTL_FALHA = 60           # evita martelar a API quando ela está fora
_HEADERS = {"User-Agent": "real-renda/1.0", "Accept": "application/json"}


def _get_json(url, headers=None, timeout=5):
    req = urllib.request.Request(url, headers={**_HEADERS, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _br(data):
    """Normaliza '2026-10-05' para '05/10/2026' (o SGS já devolve dd/mm/aaaa)."""
    return f"{data[8:10]}/{data[5:7]}/{data[:4]}" if "-" in data[:5] + data[4:5] else data


def _sgs(codigo):
    d = _get_json(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1?formato=json")[0]
    return {"valor": float(d["valor"]), "data": _br(d["data"])}


def _focus_ipca():
    ano = date.today().year + 1
    q = urllib.parse.urlencode(
        {"$top": "1", "$filter": f"Indicador eq 'IPCA' and DataReferencia eq '{ano}'",
         "$orderby": "Data desc", "$select": "Data,Mediana", "$format": "json"},
        quote_via=urllib.parse.quote)
    v = _get_json("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?" + q)["value"][0]
    return {"valor": float(v["Mediana"]), "data": _br(v["Data"]), "ano": ano}


def _acoes(token):
    """Top 5 por volume FINANCEIRO (preço × quantidade), não só por quantidade de papéis."""
    q = urllib.parse.urlencode({"sortBy": "volume", "sortOrder": "desc", "limit": 30, "type": "stock"})
    d = _get_json(f"https://brapi.dev/api/quote/list?{q}", headers={"Authorization": f"Bearer {token}"})
    itens = []
    for s in d.get("stocks", []):
        preco, vol = s.get("close"), s.get("volume")
        ticker = s.get("stock") or s.get("symbol")
        if not ticker or preco is None or vol is None:
            continue
        itens.append({"ticker": ticker, "nome": s.get("name") or ticker, "preco": float(preco),
                      "variacao": float(s.get("change") or 0), "financeiro": float(preco) * float(vol)})
    itens.sort(key=lambda i: i["financeiro"], reverse=True)
    return itens[:5] or None


def _com_cache(chave, fn):
    ck = f"ind:{chave}"
    atual = cache.get(ck)
    if atual is not None:
        return atual
    if cache.get(ck + ":falha"):
        return cache.get(ck + ":ultimo")
    try:
        valor = fn()
    except Exception as exc:  # rede, JSON, campo ausente...
        log.warning("Indicador %s indisponível: %s", chave, exc)
        cache.set(ck + ":falha", True, TTL_FALHA)
        return cache.get(ck + ":ultimo")
    cache.set(ck, valor, TTL)
    cache.set(ck + ":ultimo", valor, TTL_ULTIMO_BOM)
    return valor


def obter_indicadores():
    fontes = {"selic": lambda: _sgs(432), "cdi": lambda: _sgs(4389), "ipca12": lambda: _sgs(13522),
              "dolar": lambda: _sgs(1), "ipca_focus": _focus_ipca}
    token = getattr(settings, "BRAPI_TOKEN", "")
    if token:
        fontes["acoes"] = lambda: _acoes(token)
    with ThreadPoolExecutor(max_workers=len(fontes)) as ex:
        futuros = {k: ex.submit(_com_cache, k, fn) for k, fn in fontes.items()}
        dados = {k: f.result() for k, f in futuros.items()}
    dados.setdefault("acoes", None)
    dados["atualizado"] = timezone.now().isoformat()
    return dados
