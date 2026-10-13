const assert = require('assert');
const F = require('../simulador/static/simulador/js/finance.js');
const near = (a, b, t = 0.01) => assert.ok(Math.abs(a - b) <= t, `${a} !≈ ${b}`);

// Equivalência de taxas
near(F.anualParaMensal(0.12) * 100, 0.9489, 0.0001);
near(F.mensalParaAnual(0.01) * 100, 12.6825, 0.0001);

// Juros compostos sem aporte: 10.000 a 1% a.m. por 12 / 24 / 120 meses
const mensal1 = F.mensalParaAnual(0.01);
const s = (meses) => F.simular({ inicial: 10000, aporte: 0, taxaAnual: mensal1, ipcaAnual: 0, meses }).pop();
near(s(12).saldo, 11268.25); near(s(24).saldo, 12697.35); near(s(120).saldo, 33003.87);

// Aportes: conferir com a fórmula fechada FV = C(1+i)^n + A((1+i)^n-1)/i
const i = 0.008, n = 240, A = 500, C = 10000;
const fv = C * Math.pow(1 + i, n) + A * (Math.pow(1 + i, n) - 1) / i;
const sim = F.simular({ inicial: C, aporte: A, taxaAnual: F.mensalParaAnual(i), ipcaAnual: 0.045, meses: n }).pop();
near(sim.saldo, fv, 0.5);
near(sim.aportado, C + A * n, 1e-6);

// Valor real: 1 milhão em 20 anos a 4,5% a.a. ≈ 414,6 mil
const r20 = F.simular({ inicial: 1e6, aporte: 0, taxaAnual: 0, ipcaAnual: 0.045, meses: 240 }).pop();
near(r20.saldoReal, 414643, 100);

// Aportes corrigidos: em termos reais o aporte fica constante
const sc = F.simular({ inicial: 0, aporte: 1000, taxaAnual: 0, ipcaAnual: 0.045, meses: 12, corrigirAportes: true }).pop();
near(sc.aportadoReal, 12000, 1e-6);

// Aporte necessário bate com a simulação (retorno real constante)
const ret = F.retornoReal(0.139, 0.045);
const meta = 1_000_000, meses = 240;
const an = F.aporteNecessario({ inicial: 20000, meta, retornoRealAnual: ret, meses });
const chk = F.simular({ inicial: 20000, aporte: an, taxaAnual: 0.139, ipcaAnual: 0.045, meses, corrigirAportes: true }).pop();
near(chk.saldoReal, meta, 1);

// Meta e usufruto
near(F.patrimonioNecessario({ modo: 'retirada', rendaMensal: 5000, taxaRetiradaAnual: 0.04 }), 1_500_000, 0.01);
const pres = F.patrimonioNecessario({ modo: 'preservar', rendaMensal: 5000, retornoRealAnual: 0.06 });
near(pres, 1027100, 300);
assert.strictEqual(F.usufruto({ patrimonio: pres, retiradaMensal: 5000, retornoRealAnual: 0.06, maxMeses: 480 }).perpetuo, true);
const u = F.usufruto({ patrimonio: 100000, retiradaMensal: 5000, retornoRealAnual: 0.0, maxMeses: 480 });
assert.strictEqual(u.esgotaEm, 20);
console.log('OK — todos os testes de finance.js passaram');

// IR regressivo
assert.strictEqual(F.aliquotaIR(3), 0.225); assert.strictEqual(F.aliquotaIR(24), 0.175); assert.strictEqual(F.aliquotaIR(240), 0.15);
const liq = F.aplicarIR(F.simular({ inicial: 10000, aporte: 0, taxaAnual: 0.12, ipcaAnual: 0.045, meses: 240 })).pop();
const bruto = F.simular({ inicial: 10000, aporte: 0, taxaAnual: 0.12, ipcaAnual: 0.045, meses: 240 }).pop();
near(liq.saldo, bruto.saldo - 0.15 * bruto.juros, 0.01);
near(liq.saldoReal / liq.saldo, bruto.saldoReal / bruto.saldo, 1e-9);
console.log('OK — IR regressivo');
