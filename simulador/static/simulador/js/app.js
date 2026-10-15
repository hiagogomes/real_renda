/* app.js — interface das calculadoras (100% no navegador). Depende de finance.js e Chart.js. */
(function () {
  'use strict';
  const F = window.Finance;
  const $ = (id) => document.getElementById(id);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const pct = (v, d = 1) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const estado = { j: null, r: null };
  const graficos = {};

  function parseNum(txt) {
    let s = String(txt == null ? '' : txt).replace(/[R$\s%]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function tempo(meses) {
    const a = Math.floor(meses / 12), m = meses % 12;
    const partes = [];
    if (a) partes.push(plural(a, 'ano', 'anos'));
    if (m || !a) partes.push(plural(m, 'mês', 'meses'));
    return partes.join(' e ');
  }

  function mostrarErro(p, msg) {
    const el = $(p + '-erro');
    el.hidden = !msg;
    el.textContent = msg || '';
  }

  /* ---------- leitura dos campos ---------- */
  function lerBase(p) {
    const inicial = parseNum($(p + '-inicial').value);
    const aporte = parseNum($(p + '-aporte').value);
    const taxa = parseNum($(p + '-taxa').value) / 100;
    const ipca = parseNum($(p + '-ipca').value) / 100;
    const tipo = $(p + '-taxaTipo').value;
    if ([inicial, aporte, taxa, ipca].some(Number.isNaN)) return { erro: 'Preencha todos os campos com números válidos.' };
    if (inicial < 0 || aporte < 0) return { erro: 'Patrimônio inicial e aporte não podem ser negativos.' };
    if (ipca <= -0.5 || ipca > 1) return { erro: 'Informe um IPCA entre -50% e 100% ao ano.' };
    if (taxa <= -0.5 || (tipo === 'm' && taxa > 0.5) || (tipo === 'a' && taxa > 5)) return { erro: 'Informe uma taxa de juros dentro de limites realistas.' };
    return { inicial, aporte, taxaAnual: tipo === 'm' ? F.mensalParaAnual(taxa) : taxa, ipcaAnual: ipca };
  }

  /* ---------- presets de mercado ---------- */
  function aplicarPreset(p) {
    const def = F.PRESETS[$(p + '-preset').value];
    const nota = $(p + '-presetNota');
    if (!def) { nota.textContent = ''; return; }
    const ipca = parseNum($(p + '-ipca').value) / 100;
    const anual = def.real != null ? ((1 + def.real / 100) * (1 + (Number.isNaN(ipca) ? 0 : ipca)) - 1) * 100 : def.anual;
    $(p + '-taxaTipo').value = 'a';
    $(p + '-taxa').value = anual.toFixed(2).replace('.', ',');
    nota.textContent = def.nota;
  }
  function virarManual(p) { $(p + '-preset').value = 'manual'; $(p + '-presetNota').textContent = ''; }

  /* ---------- gráfico ---------- */
  function cor(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
  const marca = {
    id: 'marca',
    beforeDraw(c) { // fundo branco no PNG exportado
      if (!c.$exportando) return;
      c.ctx.save(); c.ctx.globalCompositeOperation = 'destination-over'; c.ctx.fillStyle = '#fff';
      c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore();
    },
    afterDraw(c) { // assinatura discreta só no PNG exportado
      if (!c.$exportando) return;
      c.ctx.save(); c.ctx.fillStyle = '#55646e'; c.ctx.font = '12px sans-serif'; c.ctx.textAlign = 'right';
      c.ctx.fillText(location.host || 'Real Renda', c.width - 8, c.height - 6); c.ctx.restore();
    },
  };

  function desenhar(p, meses, datasets) {
    if (!window.Chart) return;
    const labels = Array.from({ length: meses + 1 }, (_, i) => i);
    const passo = Math.max(1, Math.ceil(meses / 12 / 10));
    if (!graficos[p]) {
      graficos[p] = new window.Chart($(p + '-grafico'), {
        type: 'line',
        data: { labels, datasets },
        plugins: [marca],
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          elements: { point: { radius: 0, hitRadius: 8 }, line: { tension: 0 } },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12 } },
            tooltip: {
              callbacks: {
                title: (it) => 'Após ' + tempo(Number(it[0].label)),
                label: (it) => it.parsed.y == null ? null : `${it.dataset.label}: ${brl.format(it.parsed.y)}`,
              },
            },
          },
          scales: {
            x: { ticks: { autoSkip: false, maxRotation: 0, callback(v) { const m = Number(this.getLabelForValue(v)); const ps = this.chart.$passo || 1; return m % (12 * ps) === 0 ? m / 12 + ' a' : ''; } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { callback: (v) => 'R$ ' + compacto.format(v) } },
          },
        },
      });
    } else {
      graficos[p].data.labels = labels;
      graficos[p].data.datasets = datasets;
    }
    graficos[p].$passo = passo;
    graficos[p].update('none');
  }

  const linha = (label, data, cor_, largura, tracejado) => ({ label, data, borderColor: cor_, backgroundColor: cor_, borderWidth: largura, borderDash: tracejado ? [6, 4] : [], fill: false });

  /* ---------- módulo 1: juros compostos ---------- */
  function calcJuros() {
    const base = lerBase('j');
    const prazo = parseNum($('j-prazo').value);
    if (base.erro) return mostrarErro('j', base.erro);
    if (!(prazo > 0)) return mostrarErro('j', 'Informe o tempo de aplicação.');
    const meses = Math.round($('j-prazoTipo').value === 'a' ? prazo * 12 : prazo);
    if (meses < 1 || meses > 1200) return mostrarErro('j', 'O prazo deve ficar entre 1 mês e 100 anos.');
    mostrarErro('j', '');
    let serie = F.simular({ ...base, meses, corrigirAportes: $('j-corrigir').checked });
    if ($('j-ir').checked && $('j-preset').value !== 'poupanca') serie = F.aplicarIR(serie);
    estado.j = { meses, serie };
    renderJuros();
  }

  function renderJuros() {
    const e = estado.j; if (!e) return;
    const real = $('j-descontar').checked;
    const f = e.serie[e.serie.length - 1];
    $('j-resultado').classList.toggle('is-real', real);
    const liq = $('j-ir').checked && $('j-preset').value !== 'poupanca' ? ', líquido de IR' : '';
    $('j-total-rotulo').textContent = (real ? `Montante em ${tempo(e.meses)}, em valores de hoje` : `Montante em ${tempo(e.meses)}`) + liq;
    $('j-nominal').textContent = brl.format(f.saldo);
    $('j-hoje').textContent = brl.format(f.saldoReal);
    $('j-total').textContent = brl.format(real ? f.saldoReal : f.saldo);
    $('j-aportado').textContent = brl.format(real ? f.aportadoReal : f.aportado);
    $('j-juros').textContent = brl.format(real ? f.jurosReal : f.juros);
    $('j-leitura').textContent = f.saldo > 0 ? `A inflação projetada consome ${pct(1 - f.saldoReal / f.saldo)} do poder de compra do montante.` : '';
    desenhar('j', e.meses, [
      linha('Montante (valor nominal)', e.serie.map((s) => s.saldo), cor('--green'), real ? 1.5 : 3, real),
      linha('Montante em valores de hoje', e.serie.map((s) => s.saldoReal), cor('--amber'), real ? 3 : 1.5, !real),
      linha('Total aportado', e.serie.map((s) => s.aportado), cor('--muted'), 1.5, true),
    ]);
    renderTabela('j-tbody-anual', true);
    if ($('j-collapse-mensal').classList.contains('show')) renderTabela('j-tbody-mensal', false);
  }

  function renderTabela(id, anual) {
    const e = estado.j; if (!e) return;
    const real = $('j-descontar').checked;
    const ultimo = e.serie.length - 1;
    const linhas = e.serie.filter((s) => s.mes > 0 && (!anual || s.mes % 12 === 0 || s.mes === ultimo));
    $(id).innerHTML = linhas.map((s) => {
      const rotulo = anual ? (s.mes % 12 === 0 ? `Ano ${s.mes / 12}` : tempo(s.mes)) : `Mês ${s.mes}`;
      return `<tr><td>${rotulo}</td><td>${brl.format(real ? s.aportadoReal : s.aportado)}</td><td>${brl.format(real ? s.jurosReal : s.juros)}</td><td>${brl.format(real ? s.saldoReal : s.saldo)}</td></tr>`;
    }).join('');
  }

  /* ---------- módulo 4: viver de renda ---------- */
  function calcRenda() {
    const base = lerBase('r');
    if (base.erro) return mostrarErro('r', base.erro);
    const renda = parseNum($('r-renda').value);
    const retirada = parseNum($('r-retirada').value) / 100;
    const prazoAnos = parseNum($('r-prazo').value);
    const modo = $('r-modo').value;
    if (!(renda > 0)) return mostrarErro('r', 'Informe a renda mensal desejada.');
    if (modo === 'retirada' && !(retirada > 0 && retirada <= 1)) return mostrarErro('r', 'Informe uma taxa de retirada entre 0,1% e 100% ao ano.');
    if (!(prazoAnos >= 1 && prazoAnos <= 80)) return mostrarErro('r', 'O prazo desejado deve ficar entre 1 e 80 anos.');

    const rr = F.retornoReal(base.taxaAnual, base.ipcaAnual);
    const meta = F.patrimonioNecessario({ modo, rendaMensal: renda, taxaRetiradaAnual: retirada, retornoRealAnual: rr });
    if (meta == null) return mostrarErro('r', 'Com retorno real igual ou menor que zero não é possível viver só dos rendimentos. Aumente a taxa, reduza o IPCA ou use a taxa de retirada.');
    mostrarErro('r', '');

    const serie = F.simular({ ...base, meses: 1200, corrigirAportes: true });
    const mesMeta = F.mesesAteMeta(serie, meta);
    const meses = Math.round(prazoAnos * 12);
    const aporteNec = F.aporteNecessario({ inicial: base.inicial, meta, retornoRealAnual: rr, meses });
    const ref = mesMeta == null ? meses : mesMeta;
    const usuf = F.usufruto({ patrimonio: meta, retiradaMensal: renda, retornoRealAnual: rr, maxMeses: 480 });
    const nominalEm = (m) => meta * Math.pow(1 + base.ipcaAnual, m / 12);

    const ind = estado.ind;
    $('r-usd').textContent = ind && ind.dolar ? `Equivale a cerca de US$ ${(meta / ind.dolar.valor).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ao dólar de hoje (R$ ${n2(ind.dolar.valor)}).` : '';
    if (ind && ind.selic && ind.ipca_focus) {
      const jr = (1 + ind.selic.valor / 100) / (1 + ind.ipca_focus.valor / 100) - 1;
      $('r-contexto').textContent = modo === 'retirada'
        ? `Contexto: o juro real de hoje é de ${pct(jr)} ao ano (Selic de ${n2(ind.selic.valor)}% e IPCA esperado de ${n2(ind.ipca_focus.valor)}%). Diante disso, uma retirada de ${pct(retirada)} tende a ser conservadora, mas juros altos não são permanentes: teste também cenários de retorno menor.`
        : `Contexto: se o juro real de hoje (${pct(jr)} ao ano, antes do IR) se mantivesse, bastariam ${brl.format(renda / F.anualParaMensal(jr))} para viver só dos rendimentos. Esse nível de juros pode não durar.`;
    } else $('r-contexto').textContent = '';
    $('r-meta').textContent = brl.format(meta);
    $('r-hoje').textContent = brl.format(meta);
    $('r-nominal').textContent = brl.format(nominalEm(meses));
    $('r-nominal-rotulo').textContent = `Mesma meta, em R$ nominais de ${new Date().getFullYear() + Math.round(prazoAnos)}`;
    $('r-meta-leitura').textContent = `Retorno real de ${pct(rr, 2)} ao ano (${pct(base.taxaAnual, 2)} nominal menos IPCA de ${pct(base.ipcaAnual, 2)}).`;
    $('r-prazo-atual').textContent = mesMeta == null ? 'mais de 100 anos' : tempo(mesMeta);
    $('r-prazo-nota').textContent = mesMeta == null ? 'Aumente o aporte ou a taxa.' : `Em valores de então: ${brl.format(nominalEm(mesMeta))}.`;
    $('r-aporte-nec').textContent = brl.format(aporteNec);
    $('r-aporte-nota').textContent = `Em ${plural(prazoAnos, 'ano', 'anos')}, reajustado pelo IPCA.`;
    $('r-duracao').textContent = usuf.perpetuo ? 'Perpétua' : usuf.esgotaEm ? tempo(usuf.esgotaEm) : 'Mais de 40 anos';
    $('r-duracao-nota').textContent = usuf.perpetuo ? 'Os rendimentos cobrem as retiradas.' : usuf.esgotaEm ? 'Até o patrimônio zerar.' : 'O patrimônio ainda não zerou.';

    // gráfico: acúmulo até a meta (ou até o prazo) + fase de retiradas
    const fimAcumulo = ref;
    const totalMeses = fimAcumulo + Math.min(usuf.serie.length - 1, 360);
    const acumulo = [], retiradas = [], metaLinha = [];
    for (let m = 0; m <= totalMeses; m++) {
      acumulo.push(m <= fimAcumulo ? serie[m].saldoReal : null);
      retiradas.push(mesMeta != null && m >= fimAcumulo ? (usuf.serie[m - fimAcumulo] || { saldo: 0 }).saldo : null);
      metaLinha.push(meta);
    }
    desenhar('r', totalMeses, [
      linha('Acúmulo (valores de hoje)', acumulo, cor('--green'), 3, false),
      linha('Fase de retiradas', retiradas, cor('--amber'), 3, false),
      linha('Meta de patrimônio', metaLinha, cor('--muted'), 1.5, true),
    ]);
    estado.r = { csv: [['Mes', 'Fase', 'Patrimonio (valores de hoje)'], ...acumulo.map((v, m) => (v != null ? [m, 'Acumulo', v] : null)).filter(Boolean), ...retiradas.map((v, m) => (v != null && m > fimAcumulo ? [m, 'Retiradas', v] : null)).filter(Boolean)] };
  }

  /* ---------- exportação ---------- */
  function baixar(nome, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csvNum = (n) => (typeof n === 'number' ? n.toFixed(2).replace('.', ',') : n);
  function exportar(acao, p) {
    if (acao === 'pdf') return window.print();
    if (acao === 'png') {
      const c = graficos[p]; if (!c) return;
      c.$exportando = true; c.update('none');
      const url = c.toBase64Image('image/png', 1);
      c.$exportando = false; c.update('none');
      const a = document.createElement('a'); a.href = url; a.download = `real-renda-${p === 'j' ? 'juros-compostos' : 'viver-de-renda'}.png`; a.click();
      return;
    }
    if (acao === 'csv') {
      let linhas;
      if (p === 'j') {
        if (!estado.j) return;
        linhas = [['Mes', 'Aporte do mes', 'Total aportado', 'Juros acumulados', 'Saldo nominal', 'Saldo em valores de hoje'],
          ...estado.j.serie.map((s) => [s.mes, s.aporte, s.aportado, s.juros, s.saldo, s.saldoReal])];
      } else {
        if (!estado.r) return;
        linhas = estado.r.csv;
      }
      const texto = '\ufeff' + linhas.map((l) => l.map(csvNum).join(';')).join('\r\n');
      baixar(`real-renda-${p === 'j' ? 'juros-compostos' : 'viver-de-renda'}.csv`, new Blob([texto], { type: 'text/csv;charset=utf-8' }));
    }
  }

  /* ---------- inicialização ---------- */
  const pendente = {};
  function agendar(p) {
    if (pendente[p]) return;
    pendente[p] = requestAnimationFrame(() => { pendente[p] = 0; (p === 'j' ? calcJuros : calcRenda)(); });
  }

  ['j', 'r'].forEach((p) => {
    const form = $(p + '-form');
    form.addEventListener('submit', (ev) => ev.preventDefault());
    form.addEventListener('input', (ev) => {
      if (ev.target.id === p + '-taxa') virarManual(p);
      if (ev.target.id === p + '-ipca') { ev.target.dataset.editado = '1'; if ($(p + '-preset').value === 'ipcamais') aplicarPreset(p); }
      agendar(p);
    });
    form.addEventListener('change', (ev) => {
      if (ev.target.id === p + '-preset') aplicarPreset(p);
      if (ev.target.id === p + '-taxaTipo') virarManual(p);
      if (ev.target.id === p + '-modo') $('r-retirada-campo').hidden = ev.target.value !== 'retirada';
      agendar(p);
    });
    aplicarPreset(p);
  });

  $('j-descontar').addEventListener('change', renderJuros);
  $('j-ir').addEventListener('change', () => agendar('j'));
  document.querySelectorAll('[data-renda]').forEach((b) => b.addEventListener('click', () => { $('r-renda').value = b.dataset.renda; agendar('r'); }));
  $('j-collapse-mensal').addEventListener('shown.bs.collapse', () => renderTabela('j-tbody-mensal', false));
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((b) => b.addEventListener('shown.bs.tab', () => Object.values(graficos).forEach((c) => c.resize())));
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]');
    if (b) exportar(b.dataset.acao, b.dataset.mod);
  });
  $('r-modo').addEventListener('change', () => { $('r-retirada-campo').hidden = $('r-modo').value !== 'retirada'; });

  // Aplica os indicadores do servidor (/api/indicadores/) aos cálculos.
  const n2 = (v) => Number(v).toFixed(2).replace('.', ',');
  function aplicarIndicadores(d) {
    if (!d) return;
    estado.ind = d;
    if (d.cdi && d.cdi.valor > 0 && d.cdi.valor < 100) {
      F.PRESETS.cdb.anual = d.cdi.valor;
      F.PRESETS.cdb.nota = `100% do CDI (${n2(d.cdi.valor)}% a.a. em ${d.cdi.data}, Banco Central), antes do IR.`;
    }
    ['j', 'r'].forEach((p) => {
      const campo = $(p + '-ipca'), partes = [];
      if (d.ipca_focus && !campo.dataset.editado) campo.value = n2(d.ipca_focus.valor); // só se o usuário não editou
      if (d.ipca_focus) partes.push(`Expectativa de mercado para ${d.ipca_focus.ano}: ${n2(d.ipca_focus.valor)}% (Focus, BC).`);
      if (d.ipca12) partes.push(`IPCA em 12 meses: ${n2(d.ipca12.valor)}%.`);
      $(p + '-ipcaNota').textContent = partes.join(' ');
      if (['cdb', 'ipcamais'].includes($(p + '-preset').value)) aplicarPreset(p);
      agendar(p);
    });
  }
  window.addEventListener('indicadores', (e) => aplicarIndicadores(e.detail));

  function iniciar() { calcJuros(); calcRenda(); if (window.__indicadores) aplicarIndicadores(window.__indicadores); }
  if (window.Chart) iniciar(); else window.addEventListener('load', iniciar);
})();
