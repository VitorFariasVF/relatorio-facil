/* Relatório Fácil — modelos prontos (cada um já vem com dados de exemplo). */
(() => {
  let n = 0; const id = () => "b" + (++n) + Math.random().toString(36).slice(2, 6);
  const T = {
    semanal: () => ({
      theme: "editorial",
      data: { name: "Tarefas da semana", header: ["Dia", "Concluídas", "Em andamento", "Horas"], rows: [["Seg", "5", "3", "7,5"], ["Ter", "7", "4", "8"], ["Qua", "4", "6", "6,5"], ["Qui", "8", "3", "8"], ["Sex", "6", "2", "7"]] },
      blocks: [
        { id: id(), type: "title", title: "Relatório semanal do projeto", subtitle: "Semana 12 · Equipe Produto", author: "Seu nome", date: "12 a 16 de agosto", cover: false },
        { id: id(), type: "kpi", heading: "", items: [
          { label: "Tarefas concluídas", mode: "calc", fn: "sum", col: "Concluídas", prefix: "", suffix: "", note: "na semana" },
          { label: "Em andamento (média)", mode: "calc", fn: "avg", col: "Em andamento", prefix: "", suffix: "", dec: 1, note: "por dia" },
          { label: "Horas trabalhadas", mode: "calc", fn: "sum", col: "Horas", prefix: "", suffix: " h", note: "" },
          { label: "Melhor dia", mode: "calc", fn: "max", col: "Concluídas", prefix: "", suffix: "", note: "tarefas concluídas" }] },
        { id: id(), type: "chart", chart: "bar", heading: "Tarefas concluídas por dia", x: "Dia", y: ["Concluídas"], sort: "none", limit: 12 },
        { id: id(), type: "table", heading: "Detalhe por dia", columns: ["Dia", "Concluídas", "Em andamento", "Horas"], limit: 10 },
        { id: id(), type: "text", heading: "Comentários e próximos passos", body: "- A entrega de quinta foi a mais produtiva da semana.\n- Duas tarefas ficaram bloqueadas aguardando aprovação.\n- Próxima semana: fechar o piloto e preparar a demonstração." }]
    }),
    vendas: () => ({
      theme: "editorial",
      data: { name: "Vendas do semestre", header: ["Mês", "Vendas", "Meta", "Pedidos"], rows: [["Jan", "48200", "45000", "120"], ["Fev", "43100", "45000", "104"], ["Mar", "52900", "47000", "131"], ["Abr", "58700", "50000", "149"], ["Mai", "61300", "52000", "158"], ["Jun", "66400", "55000", "171"]] },
      blocks: [
        { id: id(), type: "title", title: "Resumo de vendas", subtitle: "Primeiro semestre", author: "Seu nome", date: "Janeiro a junho", cover: false },
        { id: id(), type: "kpi", heading: "", items: [
          { label: "Total vendido", mode: "calc", fn: "sum", col: "Vendas", prefix: "R$ ", suffix: "", dec: 0, note: "no semestre" },
          { label: "Média mensal", mode: "calc", fn: "avg", col: "Vendas", prefix: "R$ ", suffix: "", dec: 0, note: "" },
          { label: "Pedidos", mode: "calc", fn: "sum", col: "Pedidos", prefix: "", suffix: "", dec: 0, note: "" },
          { label: "Crescimento", mode: "calc", fn: "change", col: "Vendas", prefix: "", suffix: "%", dec: 1, note: "de janeiro a junho" }] },
        { id: id(), type: "chart", chart: "line", heading: "Vendas e meta por mês", x: "Mês", y: ["Vendas", "Meta"], sort: "none", limit: 12 },
        { id: id(), type: "chart", chart: "bar", heading: "Os 3 melhores meses", x: "Mês", y: ["Vendas"], sort: "desc", limit: 3 },
        { id: id(), type: "table", heading: "Números do semestre", columns: ["Mês", "Vendas", "Meta", "Pedidos"], limit: 12 },
        { id: id(), type: "text", heading: "Leitura dos resultados", body: "As vendas superaram a meta em quatro dos seis meses, com crescimento contínuo a partir de março.\n\n- Fevereiro ficou abaixo da meta por menos dias úteis.\n- Junho foi o melhor mês do semestre." }]
    }),
    estudo: () => ({
      theme: "sobrio",
      data: { name: "Resultados por grupo", header: ["Grupo", "Nota média", "Participantes"], rows: [["Grupo A", "7,2", "24"], ["Grupo B", "8,1", "22"], ["Grupo C", "6,8", "25"], ["Grupo D", "7,9", "21"]] },
      blocks: [
        { id: id(), type: "title", title: "Relatório de estudo", subtitle: "Desempenho por grupo de participantes", author: "Seu nome", date: "Ano letivo", cover: true },
        { id: id(), type: "text", heading: "Objetivo", body: "Descreva aqui o que foi estudado, por que e como os dados foram coletados." },
        { id: id(), type: "kpi", heading: "", items: [
          { label: "Participantes", mode: "calc", fn: "sum", col: "Participantes", prefix: "", suffix: "", dec: 0, note: "no total" },
          { label: "Maior média", mode: "calc", fn: "max", col: "Nota média", prefix: "", suffix: "", dec: 1, note: "" },
          { label: "Média geral", mode: "calc", fn: "avg", col: "Nota média", prefix: "", suffix: "", dec: 1, note: "dos grupos" }] },
        { id: id(), type: "table", heading: "Dados coletados", columns: ["Grupo", "Nota média", "Participantes"], limit: 10 },
        { id: id(), type: "chart", chart: "bar", heading: "Nota média por grupo", x: "Grupo", y: ["Nota média"], sort: "none", limit: 12 },
        { id: id(), type: "text", heading: "Conclusão", body: "Resuma o que os resultados mostram e o que pode ser feito a partir deles." }]
    }),
    branco: () => ({
      theme: "editorial",
      data: { name: "Dados", header: ["Categoria", "Valor"], rows: [["A", "10"], ["B", "20"], ["C", "15"]] },
      blocks: [{ id: id(), type: "title", title: "Título do relatório", subtitle: "", author: "", date: "", cover: false }, { id: id(), type: "text", heading: "", body: "Escreva aqui. Use “Dados” para colar sua tabela e adicione tabelas e gráficos pelos botões ao lado." }]
    })
  };
  const LIST = [
    { id: "semanal", name: "Relatório semanal", desc: "Indicadores, gráfico de barras, tabela e comentários. Para acompanhar um projeto." },
    { id: "vendas", name: "Resumo de vendas", desc: "Total, crescimento, gráfico de linhas contra a meta e os melhores meses." },
    { id: "estudo", name: "Relatório de estudo", desc: "Capa, objetivo, dados, gráfico e conclusão. Para trabalhos e pesquisas." }];
  window.RFTemplates = { list: LIST, make: k => (T[k] || T.branco)(), newId: id };
})();
