/* indicadores.js — carrossel de indicadores com rolagem contínua (dados de /api/indicadores/, via Django). */
(function () {
  'use strict';
  const raiz = document.getElementById('indicadores');
  if (!raiz) return;
  const faixa = raiz.querySelector('.indicadores__faixa');
  const fonte = document.getElementById('indicadores-fonte');
  const VELOCIDADE = 36; // pixels por segundo
  const n = (v, d = 2) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function card(o) {
    const c = el('div', 'ind' + (o.destaque ? ' ind--destaque' : ''));
    c.append(el('span', 'ind__rotulo', o.rotulo));
    const linha = el('div', 'ind__linha');
    linha.append(el('span', 'ind__valor', o.valor));
    if (o.delta != null) {
      const alta = o.delta >= 0;
      linha.append(el('span', 'ind__delta ind__delta--' + (alta ? 'alta' : 'queda'), (alta ? '▲ +' : '▼ ') + n(Math.abs(o.delta)) + '%'));
    }
    c.append(linha);
    if (o.sub) c.append(el('span', 'ind__sub', o.sub));
    return c;
  }

  function montar(d) {
    const it = [];
    if (d.selic) it.push({ rotulo: 'Selic (meta)', valor: n(d.selic.valor) + '% a.a.', sub: d.selic.data });
    if (d.cdi) it.push({ rotulo: 'CDI', valor: n(d.cdi.valor) + '% a.a.', sub: d.cdi.data });
    if (d.ipca12) it.push({ rotulo: 'IPCA (12 meses)', valor: n(d.ipca12.valor) + '%', sub: d.ipca12.data });
    if (d.ipca_focus) it.push({ rotulo: 'IPCA esperado ' + d.ipca_focus.ano, valor: n(d.ipca_focus.valor) + '%', sub: 'Focus, ' + d.ipca_focus.data });
    if (d.selic && d.ipca_focus) {
      const jr = ((1 + d.selic.valor / 100) / (1 + d.ipca_focus.valor / 100) - 1) * 100;
      it.push({ rotulo: 'Juro real (Selic ÷ IPCA esperado)', valor: n(jr) + '% a.a.', sub: 'cálculo, antes do IR', destaque: true });
    }
    if (d.dolar) it.push({ rotulo: 'Dólar (venda)', valor: 'R$ ' + n(d.dolar.valor), sub: d.dolar.data });
    (d.acoes || []).forEach((a, i) => it.push({ rotulo: (i + 1) + 'º em volume · ' + a.ticker, valor: 'R$ ' + n(a.preco), delta: a.variacao }));
    return it;
  }

  let dados = [], larguraAnterior = 0;

  // Monta o trilho. Se os cards não cabem na tela, duplica o conjunto e anima de forma contínua e sem emendas.
  // Com "reduzir movimento" ou em telas de toque, vira uma faixa rolável com o dedo.
  function renderizar() {
    const auto = !matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(hover: hover) and (pointer: fine)').matches;
    const trilho = el('div', 'ind-trilho');
    const itens = dados.map(card);
    trilho.append(...itens);
    faixa.classList.remove('is-manual');
    faixa.scrollLeft = 0;
    faixa.replaceChildren(trilho);
    larguraAnterior = faixa.clientWidth;
    if (trilho.offsetWidth > faixa.clientWidth) {
      if (auto) {
        const clones = dados.map(card);
        clones.forEach((c) => c.setAttribute('aria-hidden', 'true'));
        trilho.append(...clones);
        const largura = clones[0].offsetLeft - itens[0].offsetLeft;
        trilho.style.setProperty('--ind-largura', largura + 'px');
        trilho.style.setProperty('--ind-duracao', (largura / VELOCIDADE).toFixed(1) + 's');
        trilho.classList.add('is-rolando');
      } else faixa.classList.add('is-manual');
    }
    requestAnimationFrame(() => trilho.classList.add('is-pronto')); // transição de entrada suave
  }

  // economiza processamento: pausa quando o carrossel sai da tela
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => raiz.classList.toggle('is-pausado', !e.isIntersecting)).observe(raiz);
  }
  // refaz o layout ao redimensionar a janela
  let espera = null;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!dados.length) return;
      clearTimeout(espera);
      espera = setTimeout(() => { if (Math.abs(faixa.clientWidth - larguraAnterior) > 1) renderizar(); }, 200);
    }).observe(faixa);
  }

  fetch(raiz.dataset.url, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      window.__indicadores = d;
      window.dispatchEvent(new CustomEvent('indicadores', { detail: d }));
      dados = montar(d);
      if (!dados.length) { raiz.hidden = true; return; }
      renderizar();
      fonte.textContent = 'Fontes: Banco Central do Brasil' + (d.acoes ? ' e brapi.dev' : '') + '. Dados com possível atraso, em cache de até 15 minutos; não são recomendação de investimento.';
    })
    .catch(() => { raiz.hidden = true; });
})();