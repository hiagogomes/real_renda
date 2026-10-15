import json

from django.conf import settings
from django.contrib.sitemaps import Sitemap
from django.http import HttpResponse
from django.shortcuts import render
from django.utils.cache import patch_cache_control
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.http import require_GET

FAQ_JUROS = [
    ("Como calcular juros compostos com aportes mensais?",
     "Some o capital inicial corrigido, M = C × (1 + i)^n, com a soma dos aportes corrigidos, "
     "A × [(1 + i)^n − 1] ÷ i, em que i é a taxa mensal e n o número de meses. A calculadora faz "
     "esse cálculo mês a mês, com o aporte entrando no fim de cada mês, e mostra a memória de cálculo."),
    ("Qual a diferença entre taxa mensal e taxa anual?",
     "Em juros compostos, 1% ao mês não equivale a 12% ao ano: equivale a cerca de 12,68%. "
     "Para converter, use (1 + taxa anual)^(1/12) − 1. Dividir 12% por 12 superestima o rendimento mensal."),
    ("O que significa descontar a inflação?",
     "É converter o valor futuro para o poder de compra de hoje, dividindo-o por (1 + IPCA)^anos. "
     "R$ 1 milhão daqui a 20 anos, com IPCA de 4,5% ao ano, compra o que cerca de R$ 415 mil compram hoje."),
    ("O resultado já desconta Imposto de Renda?",
     "Não. Os valores são brutos. Na renda fixa o IR é regressivo (de 22,5% a 15% sobre o rendimento), "
     "e FIIs e ações têm regras próprias. Considere também taxas de corretagem e custódia."),
    ("Meus dados ficam salvos em algum servidor?",
     "Não. Todo o cálculo roda no seu navegador, em JavaScript. Os valores digitados não são enviados nem armazenados."),
]

FAQ_RENDA = [
    ("Quanto preciso para viver de renda com R$ 5.000 por mês?",
     "Depende da regra. Pela regra dos 4% ao ano, são R$ 1,5 milhão (R$ 60 mil por ano ÷ 4%). "
     "Para apenas preservar o capital com retorno real de 6% ao ano, cerca de R$ 1,03 milhão. "
     "A calculadora recalcula com as suas taxas."),
    ("O que é a regra dos 4%?",
     "É uma regra prática: retirar 4% do patrimônio no primeiro ano e corrigir o valor pela inflação nos "
     "anos seguintes. Surgiu de estudos com o mercado americano (Trinity Study) e não é garantia. "
     "No Brasil, com juros reais historicamente altos, a conta pode ser outra."),
    ("O que é retorno real?",
     "É o rendimento acima da inflação: (1 + retorno nominal) ÷ (1 + IPCA) − 1. É ele que aumenta o seu "
     "poder de compra, por isso a simulação de renda trabalha em valores de hoje."),
    ("Por que o aporte é corrigido pela inflação?",
     "Para manter a simulação coerente em valores de hoje: o aporte de R$ 1.000 continua comprando o "
     "mesmo, o que equivale a reajustá-lo todo ano pelo IPCA."),
    ("A simulação garante que o patrimônio dura esse tempo?",
     "Não. Ela assume retorno constante. Na vida real o retorno varia, e sequências ruins no início das "
     "retiradas reduzem a duração. Use como referência de planejamento, não como promessa."),
]

PAGINAS = {
    "juros": {
        "title": "Calculadora de Juros Compostos com Inflação (IPCA) | Real Renda",
        "description": ("Simule juros compostos com aportes mensais e veja quanto seu dinheiro vale de verdade: "
                        "valor futuro e poder de compra de hoje, com taxas de CDB, Tesouro IPCA+ e FIIs."),
        "h1": "Calculadora de juros compostos com inflação",
        "sub": "Veja quanto seu patrimônio terá no futuro e quanto isso compra em valores de hoje.",
        "faq": FAQ_JUROS,
        "modo": "juros",
    },
    "renda": {
        "title": "Quanto Preciso para Viver de Renda? Calculadora | Real Renda",
        "description": ("Descubra o patrimônio, o prazo e o aporte mensal necessários para viver de renda, "
                        "e por quanto tempo ele sustenta suas retiradas. Em valores de hoje, com IPCA."),
        "h1": "Quanto você precisa para viver de renda?",
        "sub": "Patrimônio necessário, prazo e aporte mensal, e por quanto tempo ele sustenta suas retiradas.",
        "faq": FAQ_RENDA,
        "modo": "renda",
    },
}


def _schema(request, canonical, pagina):
    """JSON-LD: WebApplication + FAQPage (escapa </ para ser seguro dentro de <script>)."""
    dados = [
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": pagina["h1"],
            "url": canonical,
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "inLanguage": "pt-BR",
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "BRL"},
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in pagina["faq"]
            ],
        },
    ]
    return json.dumps(dados, ensure_ascii=False).replace("</", "<\\/")


def _pagina_calculadora(request, chave):
    pagina = PAGINAS[chave]
    base = getattr(settings, "SITE_URL", "").rstrip("/") or f"{request.scheme}://{request.get_host()}"
    ctx = {"pagina": pagina, "modo": pagina["modo"], "schema_json": _schema(request, base + request.path, pagina)}
    return render(request, "simulador/index.html", ctx)


def index(request):
    """Home: a proposta principal é viver de renda (acúmulo + retiradas, em valores de hoje)."""
    return _pagina_calculadora(request, "renda")


def juros_compostos(request):
    return _pagina_calculadora(request, "juros")


@require_GET
def api_indicadores(request):
    """JSON com Selic, CDI, IPCA, dólar, expectativa Focus e ações (quando há token)."""
    from django.http import JsonResponse
    from . import indicadores
    resp = JsonResponse(indicadores.obter_indicadores())
    patch_cache_control(resp, public=True, max_age=300)
    return resp


@require_GET
def manifest(request):
    dados = {
        "name": getattr(settings, "SITE_NAME", "Real Renda"), "short_name": "Real Renda",
        "description": "Calculadoras financeiras com inflação: viver de renda e juros compostos.",
        "start_url": "/", "scope": "/", "display": "standalone", "lang": "pt-BR",
        "background_color": "#f4f6f3", "theme_color": "#1f6f54",
        "icons": [
            {"src": static("simulador/icon.svg"), "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
        ],
    }
    return HttpResponse(json.dumps(dados, ensure_ascii=False), content_type="application/manifest+json")


SW_JS = """const C='real-renda-v2',S='__STATIC__';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/admin'))return;
 const salvar=n=>{if(n.ok){const c=n.clone();caches.open(C).then(x=>x.put(r,c));}return n;};
 if(u.pathname.startsWith(S)){e.respondWith(caches.match(r).then(h=>{const rede=fetch(r).then(salvar).catch(()=>h);return h||rede;}));return;}
 e.respondWith(fetch(r).then(salvar).catch(()=>caches.match(r)));});
"""


@require_GET
def service_worker(request):
    corpo = SW_JS.replace("__STATIC__", "/" + settings.STATIC_URL.strip("/") + "/")
    resp = HttpResponse(corpo, content_type="application/javascript")
    resp["Cache-Control"] = "no-cache"
    return resp


def sobre(request):
    return render(request, "simulador/sobre.html")


def privacidade(request):
    return render(request, "simulador/privacidade.html")


def contato(request):
    return render(request, "simulador/contato.html")


@require_GET
def robots_txt(request):
    base = getattr(settings, "SITE_URL", "").rstrip("/") or f"{request.scheme}://{request.get_host()}"
    linhas = ["User-agent: *", "Allow: /", "Disallow: /admin/", "Disallow: /api/", "", f"Sitemap: {base}/sitemap.xml"]
    return HttpResponse("\n".join(linhas) + "\n", content_type="text/plain")


@require_GET
def ads_txt(request):
    """Autoriza o Google a vender seu inventário (exigido pelo AdSense)."""
    client = getattr(settings, "ADSENSE_CLIENT", "")
    pub = client.replace("ca-", "", 1) if client.startswith("ca-pub-") else ""
    corpo = f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n" if pub else ""
    return HttpResponse(corpo, content_type="text/plain")


class PaginasSitemap(Sitemap):
    changefreq = "monthly"
    protocol = "http" if settings.DEBUG else "https"

    _prioridades = {"simulador:index": 1.0, "simulador:juros_compostos": 0.9,
                    "simulador:sobre": 0.3, "simulador:privacidade": 0.2, "simulador:contato": 0.2}

    def items(self):
        return list(self._prioridades)

    def location(self, item):
        return reverse(item)

    def priority(self, item):
        return self._prioridades[item]
    