/* indicadores.js — carrossel de indicadores (dados vêm de /api/indicadores/, servidos pelo Django). */
(function () {
  'use strict';
  const raiz = document.getElementById('indicadores');
  if (!raiz) return;
  const faixa = raiz.querySelector('.indicadores__faixa');
  const fonte = document.getElementById('indicadores-fonte');
  const n = (v, d = 2) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function card(rotulo, valor, sub, varClasse) {
    const c = el('div', 'ind flex-shrink-0 pe-3 border-end');
    c.style.scrollSnapAlign = 'start'; c.style.minWidth = '8.5rem';
    c.append(el('span', 'd-block small text-secondary text-nowrap', rotulo), el('span', 'd-block fw-semibold text-nowrap' + (varClasse ? ' ' + varClasse : ''), valor));
    if (sub) c.append(el('span', 'd-block small text-secondary text-nowrap', sub));
    return c;
  }

  function montar(d) {
    const itens = [];
    if (d.selic) itens.push(card('Selic (meta)', n(d.selic.valor) + '% a.a.', d.selic.data));
    if (d.cdi) itens.push(card('CDI', n(d.cdi.valor) + '% a.a.', d.cdi.data));
    if (d.ipca12) itens.push(card('IPCA (12 meses)', n(d.ipca12.valor) + '%', d.ipca12.data));
    if (d.ipca_focus) itens.push(card('IPCA esperado ' + d.ipca_focus.ano, n(d.ipca_focus.valor) + '%', 'Focus, ' + d.ipca_focus.data));
    if (d.selic && d.ipca_focus) {
      const jr = ((1 + d.selic.valor / 100) / (1 + d.ipca_focus.valor / 100) - 1) * 100;
      itens.push(card('Juro real (Selic ÷ IPCA esperado)', n(jr) + '% a.a.', 'cálculo, antes do IR'));
    }
    if (d.dolar) itens.push(card('Dólar (venda)', 'R$ ' + n(d.dolar.valor), d.dolar.data));
    (d.acoes || []).forEach((a, i) => {
      const alta = a.variacao >= 0;
      itens.push(card((i + 1) + 'º em volume · ' + a.ticker, 'R$ ' + n(a.preco), (alta ? '▲ +' : '▼ ') + n(a.variacao) + '% no dia', alta ? 'text-success' : 'text-danger'));
    });
    return itens;
  }

  // Rotação automática: para ao passar o mouse, focar ou tocar; desligada para quem prefere menos movimento.
  // O usuário também pode arrastar/rolar a faixa manualmente.
  let timer = null;
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function avancar() {
    const fim = faixa.scrollLeft + faixa.clientWidth >= faixa.scrollWidth - 4;
    const passo = faixa.firstElementChild ? faixa.firstElementChild.offsetWidth + 16 : 150;
    if (fim) faixa.scrollTo({ left: 0, behavior: 'smooth' });
    else faixa.scrollBy({ left: passo, behavior: 'smooth' });
  }
  const parar = () => { clearInterval(timer); timer = null; };
  const iniciar = () => { if (!timer && !reduzMovimento) timer = setInterval(avancar, 4500); };
  ['mouseenter', 'focusin', 'touchstart'].forEach((ev) => raiz.addEventListener(ev, parar, { passive: true }));
  ['mouseleave', 'focusout'].forEach((ev) => raiz.addEventListener(ev, iniciar));

  fetch(raiz.dataset.url, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      window.__indicadores = d;
      window.dispatchEvent(new CustomEvent('indicadores', { detail: d }));
      const itens = montar(d);
      if (!itens.length) { raiz.hidden = true; return; }
      faixa.replaceChildren(...itens);
      fonte.textContent = 'Fontes: Banco Central do Brasil' + (d.acoes ? ' e brapi.dev' : '') + '. Dados com possível atraso, em cache de até 15 minutos; não são recomendação de investimento.';
      iniciar();
    })
    .catch(() => { raiz.hidden = true; });
})();