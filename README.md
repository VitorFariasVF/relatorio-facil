# Relatório Fácil

Transforme uma planilha em um relatório com indicadores, gráficos e tabelas, pronto para PDF. **Tudo no navegador:** seus dados não são enviados nem guardados em servidor.

Parte do [VF Tools](https://vitorfariasvf.github.io/VF-Tools/). Segue o [padrão de design](https://github.com/VitorFariasVF/VF-Tools/blob/Main/DESIGN.md) do site.

## Como funciona
1. **Escolha um modelo** (semanal, vendas, estudo) ou comece em branco. Os modelos já vêm com dados de exemplo.
2. **Cole seus dados** em "Editar dados": tabela copiada do Excel/Google Planilhas ou arquivo CSV. Números no formato brasileiro (`1.234,56`, `R$ 12,50`, `12%`) são entendidos.
3. **Monte o relatório em blocos:** título/capa, texto, indicadores (KPIs), tabela, gráfico de barras ou linhas e quebra de página. Reordene com *Subir*, *Descer* ou o campo *Posição* (arrastar não é necessário).
4. **Veja a folha A4 ao vivo.** As linhas tracejadas mostram onde a página costuma terminar.
5. **Exporte:** PDF (pela janela de impressão), HTML único acessível ou projeto `.json` para continuar depois.

## Recursos
- Indicadores calculados dos dados (soma, média, máximo, mínimo, contagem, primeiro, último, variação %) ou digitados.
- Gráficos em SVG feitos à mão, sem biblioteca. Séries se distinguem por padrão, traço e marcador (não só por cor). Cada gráfico vem com **resumo em texto** e **tabela de dados** para leitores de tela.
- Desfazer/refazer (Ctrl+Z), rascunho automático no navegador (até 1 MB) e aviso quando a memória do navegador enche.
- Dois temas para a folha (Editorial e Sóbrio). A folha é sempre clara, mesmo no tema escuro do site.
- Mascote Doggy com tour guiado.

## Limites
Até 5.000 linhas, 40 colunas e 2 MB de dados · 200 blocos · gráficos com até 12 categorias e 4 séries · tabela mostra até 200 linhas.
Não há edição estilo planilha nem fórmulas: para corrigir uma célula, edite o texto no diálogo de dados.

## Acessibilidade
- O relatório gerado usa HTML semântico (`article`, `section`, `figure`, `dl`, tabelas com `caption` e `th scope`).
- O PDF por impressão **não garante estrutura acessível**; a versão HTML é a recomendada para quem usa leitor de tela.
- Editor 100% por teclado, campos com rótulo, anúncios por `aria-live`, alvos de toque de 44 px.

## Estrutura
| Arquivo | Para quê |
|---|---|
| `index.html` | Página (modelo do VF Tools) |
| `app.js` / `app.css` | Editor e interface |
| `data.js` | Leitura de CSV e números pt-BR |
| `charts.js` | Gráficos SVG + resumo e tabela de dados |
| `report.js` / `report.css` | Monta a folha A4 (preview, HTML e impressão) |
| `templates.js` | Modelos prontos |
| `tool.js` | Helper do VF Tools (armazenamento, tema, toast) |

O visual do site (`tokens.css`, `components.css`, `doggy.css`, `dog.js`, `help.js`) é carregado de `vitorfariasvf.github.io/VF-Tools/`.

## Rodar localmente
```bash
python3 -m http.server 8766
# abra http://localhost:8766
```
Site estático, sem build.
