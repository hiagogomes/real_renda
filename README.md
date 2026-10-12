# real_renda

A aplicação é focada em simulações financeiras de longo prazo, acúmulo de patrimônio, cálculo de juros compostos e planejamento de aposentadoria/viver de renda.

O objetivo principal é solucionar as limitações dos simuladores tradicionais no mercado brasileiro, oferecendo precisão inflacionária (poder de compra em valores de hoje), processamento instantâneo 100% no cliente (browser-side) e simulação completa da fase de usufruto/aposentadoria.

## Nicho e Mercado alvo

Categoria: Conversores Financeiros e Calculadoras Práticas (E-learning / Finanças Pessoais / Investimentos).

Público-Alvo: Investidores pessoas físicas, planejadores financeiros, freelancers, estudantes de finanças e criadores de conteúdo financeiro.

Intenção de Busca no Google: Atende desde buscas de alto volume ("calculadora de juros compostos", "simulador de investimentos") até buscas de alta intenção e maturidade financeira ("simulador de independência financeira", "calculadora viver de renda", "quanto preciso para aposentar").

### Diferenciais e Brechas de Mercados Atacadas

| Brecha de mercado no concorrentes | Solução implementada |
| :--------- | :--------- |
| Ilusão Inflacionária: Mostram apenas valores nominais futuros inflacionados. | Visão de Poder de Compra Real: Alternância instantânea entre valor nominal futuro e valor real corrigido pelo IPCA. |
| Lentidão e Poluição: Páginas pesadas, dependentes de servidor e cheias de anúncios invasivos. | Client-Side & PWA: Execução 100% local em JavaScript/WebAssembly. Performance máxima no Core Web Vitals com carregamento instantâneo.
| Conversão Errada de Taxas: Divisão simples de taxa anual por 12 ($12\% \div 12 = 1\%$). | Rigores Matemáticos: Conversão exata de taxas equivalentes compostas $\left((1 + i)^{1/12} - 1\right)$. |
| Foco Exclusivo no Acúmulo: Parar no montante final acumulado. | Fase de Usufruto / Aposentadoria: Simulação da taxa sustentável de retirada (ex: Regra dos 4% ou yields de proventos de FIIs/B3) mostrando a duração do patrimônio. |
| Exportação Limitada: Dificuldade em salvar os resultados para consultas futuras. | Gerador de Relatórios e Gráficos: Download instantâneo do gráfico em imagem (para redes sociais) ou relatório detalhado em PDF/Excel. |

## Arquitetura de funcionalidades (módulo do Sistema)

1. **Juros Compostos e Aportes (volume bruto de SEO)**
- Inputs: Patrimônio Inicial (R$), Aporte Mensal (R$), Taxa de Juros (mensal ou anual) e Tempo de Aplicação (meses ou anos).

- Outputs Instantâneos:

    - Montante Total Acumulado.

    - Total Aportado pelo Usuário.

    - Total Ganho em Juros Compostos.

2. **Benchmarks & Presets Reais da B3 / Renda Fixa**
- Seleção rápida de taxas baseadas em ativos do mercado brasileiro sem necessidade de digitar taxas manuais:

    - CDB 100% CDI / Selic (renda fixa pós-fixada).

    - Tesouro IPCA+ (rentabilidade real + taxa fixa).

    - Carteira de FIIs / Ações de Dividendos (com base em Dividend Yield médio histórico).

    - Poupança (para comparação do custo de oportunidade).

3. Renda Real vs. Inflação (Filtro IPCA)
- Checkbox toggle: "Descontar Inflação (IPCA Projetado)".

- Permite recalcular o montante em tempo real para refletir o equivalente em R$ de hoje, ajustando as projeções para a inflação futura acumulada.

4. "Quanto preciso para Viver de Renda?" (Aposentadoria Inversa)
- Input: Renda Passiva Mensal Desejada (ex: R$ 5.000/mês).

- Outputs:

    - Patrimônio necessário para gerar essa renda mantendo o capital principal intacto ou aplicando uma taxa de retirada sustentável.

    - Tempo e aporte mensal necessários para atingir a meta.

    - Gráfico de projeção do período de acúmulo e transição para a fase de saques/consumo.

## Requisitos Técnicos e Arquitetura de Software

- Django e Bootstrap
- Html, css e javascript
- System design

### Segurança e Privacidade

- Zero Backend Database: Nenhum dado financeiro ou simulação do usuário é armazenado em bancos de dados remotos.

- Processamento Local: Maior conformidade com diretrizes de privacidade (LGPD), aumentando a confiança do público corporativo e individual.

### Estratégia de SEO, Tráfego e Monetização

#### SEO On-Page e Estrutura de Conteúdo
 - Topo da Página: Calculadora interativa visível de imediato sem necessidade de scroll.
 - Memória de Cálculo & Tabela Accordion: Detalhamento do crescimento mês a mês/ano a ano.
 - Conteúdo Educacional Estruturado (Abaixo da Ferramenta):
    - Explicação didática da fórmula de Juros Compostos: $M = C \cdot (1 + i)^t$.
    - Tabela comparativa entre Juros Simples vs. Juros Compostos.
    - Guia sobre Taxa de Retirada Sustentável e Inflação acumulada
- Schema.org Markup: Implementação de WebApplication e FAQPage para exibição em Rich Snippets nos resultados do Google.

### Estratégia de Monetização

- Mídia Programática (Google AdSense): Exibição de anúncios não intrusivos posicionados nas áreas laterais e ao final da página (aproveitando o alto CPM do nicho financeiro).

- Marketing de Afiliados e Parcerias:

    - Banners e botões contextuais indicando abertura de conta em corretoras ("Pronto para investir? Abra sua conta na Corretora X").

    - Parcerias com plataformas de educação financeira, livros de finanças e casas de análise/relatórios.

