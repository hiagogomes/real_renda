/* finance.js — matemática financeira pura (sem DOM). Roda no navegador e no Node. */
(function (root) {
  'use strict';

  // Taxas de referência EDITÁVEIS (% a.a.). Atualize periodicamente.
  const REFERENCIA = { atualizadoEm: '2026-10-12', selic: 14.0, ipca: 4.5 };
  const PRESETS = {
    cdb: { anual: 13.9, nota: '100% do CDI (≈ Selic − 0,10 p.p.), antes do IR.' },
    ipcamais: { real: 7.5, nota: 'IPCA projetado + taxa real fixa (valor de referência), antes do IR.' },
    fii: { anual: 9.0, nota: 'Yield médio de proventos, sem valorização das cotas.' },
    poupanca: { anual: 6.17, nota: '0,5% a.m. + TR (TR ≈ 0). Isenta de IR.' },
  };

  // Conversão por equivalência composta (nunca dividir/multiplicar por 12).
  const anualParaMensal = (a) => Math.pow(1 + a, 1 / 12) - 1;
  const mensalParaAnual = (m) => Math.pow(1 + m, 12) - 1;
  // Fisher: retorno real = (1 + nominal) / (1 + inflação) − 1
  const retornoReal = (nominal, ipca) => (1 + nominal) / (1 + ipca) - 1;

  /**
   * Simula mês a mês. Aporte entra no fim de cada mês.
   * Se corrigirAportes, o aporte informado é em valores de hoje e é inflacionado todo mês.
   */
  function simular(o) {
    const i = anualParaMensal(o.taxaAnual);
    const pi = anualParaMensal(o.ipcaAnual);
    let saldo = o.inicial, aportado = o.inicial, aportadoReal = o.inicial;
    const serie = [{ mes: 0, aporte: 0, saldo, aportado, juros: 0, saldoReal: saldo, aportadoReal, jurosReal: 0 }];
    for (let m = 1; m <= o.meses; m++) {
      const defl = Math.pow(1 + pi, m);
      const aporte = o.corrigirAportes ? o.aporte * defl : o.aporte;
      saldo = saldo * (1 + i) + aporte;
      aportado += aporte;
      aportadoReal += aporte / defl;
      const saldoReal = saldo / defl;
      serie.push({ mes: m, aporte, saldo, aportado, juros: saldo - aportado, saldoReal, aportadoReal, jurosReal: saldoReal - aportadoReal });
    }
    return serie;
  }

  // Patrimônio necessário, em valores de hoje.
  function patrimonioNecessario(o) {
    if (o.modo === 'retirada') {
      return o.taxaRetiradaAnual > 0 ? (o.rendaMensal * 12) / o.taxaRetiradaAnual : null;
    }
    if (!(o.retornoRealAnual > -1)) return null;
    const r = anualParaMensal(o.retornoRealAnual);
    return r > 0 ? o.rendaMensal / r : null; // preservar capital: renda = patrimônio × retorno real mensal
  }

  function mesesAteMeta(serie, meta) {
    for (const s of serie) if (s.saldoReal >= meta) return s.mes;
    return null;
  }

  // Aporte mensal (valores de hoje) para atingir a meta em N meses, com aportes corrigidos pela inflação.
  function aporteNecessario(o) {
    const r = anualParaMensal(o.retornoRealAnual);
    const f = Math.pow(1 + r, o.meses);
    const faltante = o.meta - o.inicial * f;
    if (faltante <= 0) return 0;
    if (Math.abs(r) < 1e-12) return faltante / o.meses;
    return (faltante * r) / (f - 1);
  }

  // Fase de usufruto: rende e depois retira, em valores de hoje.
  function usufruto(o) {
    const r = anualParaMensal(o.retornoRealAnual);
    let saldo = o.patrimonio;
    const serie = [{ mes: 0, saldo }];
    let esgotaEm = null;
    for (let m = 1; m <= o.maxMeses; m++) {
      saldo = saldo * (1 + r) - o.retiradaMensal;
      if (saldo <= 0) { serie.push({ mes: m, saldo: 0 }); esgotaEm = m; break; }
      serie.push({ mes: m, saldo });
    }
    const perpetuo = esgotaEm === null && saldo >= o.patrimonio * (1 - 1e-9);
    return { serie, esgotaEm, perpetuo };
  }

  // IR regressivo da renda fixa: alíquota pelo prazo, sobre o rendimento total no resgate (aproximação).
  const aliquotaIR = (meses) => { const d = meses * 30; return d <= 180 ? 0.225 : d <= 360 ? 0.2 : d <= 720 ? 0.175 : 0.15; };
  function aplicarIR(serie) {
    return serie.map((s) => {
      const ir = aliquotaIR(s.mes) * Math.max(s.juros, 0);
      const f = s.saldo > 0 ? (s.saldo - ir) / s.saldo : 1;
      const saldoReal = s.saldoReal * f;
      return { ...s, saldo: s.saldo - ir, juros: s.juros - ir, saldoReal, jurosReal: saldoReal - s.aportadoReal };
    });
  }

  const api = { aliquotaIR, aplicarIR, REFERENCIA, PRESETS, anualParaMensal, mensalParaAnual, retornoReal, simular, patrimonioNecessario, mesesAteMeta, aporteNecessario, usufruto };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Finance = api;
})(typeof self !== 'undefined' ? self : this);
