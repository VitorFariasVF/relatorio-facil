/* Relatório Fácil — monta o HTML do relatório a partir do documento. Usado na pré-visualização e na exportação em HTML. */
(() => {
  const D = window.RFData, C = window.RFCharts;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FN = { sum: "Soma", avg: "Média", max: "Máximo", min: "Mínimo", count: "Contagem", first: "Primeiro", last: "Último", change: "Variação % (último vs primeiro)" };

  function text(s) {
    return String(s || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => {
      const lines = p.split("\n");
      return lines.every(l => /^\s*[-•]\s+/.test(l)) ? "<ul>" + lines.map(l => "<li>" + esc(l.replace(/^\s*[-•]\s+/, "")) + "</li>").join("") + "</ul>" : "<p>" + lines.map(esc).join("<br>") + "</p>";
    }).join("");
  }

  function kpiValue(it, ds) {
    if (it.mode !== "calc") return { v: it.value || "—" };
    const ci = ds.header.indexOf(it.col); if (ci < 0) return { v: "—", warn: `A coluna “${it.col}” não existe nos dados.` };
    const raw = ds.rows.map(r => r[ci]), nums = raw.map(D.num).filter(n => n !== null);
    let v = null;
    if (it.fn === "count") v = raw.filter(x => x !== "").length;
    else if (nums.length) {
      v = it.fn === "sum" ? nums.reduce((a, b) => a + b, 0) : it.fn === "avg" ? nums.reduce((a, b) => a + b, 0) / nums.length : it.fn === "max" ? Math.max(...nums) : it.fn === "min" ? Math.min(...nums)
        : it.fn === "first" ? nums[0] : it.fn === "last" ? nums[nums.length - 1] : it.fn === "change" && nums[0] !== 0 ? (nums[nums.length - 1] - nums[0]) / Math.abs(nums[0]) * 100 : null;
    }
    if (v === null) return { v: "—" };
    const sfx = it.fn === "change" ? (it.suffix || "%") : (it.suffix || "");
    return { v: (it.prefix || "") + D.fmt(v, { max: it.dec == null ? 2 : it.dec }) + sfx };
  }

  function block(b, doc) {
    const ds = doc.data, warn = m => `<p class="warn" role="note">${esc(m)}</p>`;
    switch (b.type) {
      case "title":
        return `<section class="blk b-title${b.cover ? " cover" : ""}" data-id="${b.id}"><h1>${esc(b.title || "Título do relatório")}</h1>${b.subtitle ? `<p class="sub">${esc(b.subtitle)}</p>` : ""}${b.author || b.date ? `<p class="meta">${[b.author, b.date].filter(Boolean).map(esc).join(" · ")}</p>` : ""}</section>`;
      case "text":
        return `<section class="blk b-text" data-id="${b.id}">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}${text(b.body) || '<p class="muted">Escreva o texto deste bloco.</p>'}</section>`;
      case "kpi": {
        const items = (b.items || []).map(it => { const k = kpiValue(it, ds); return `<div class="kpi"><dt>${esc(it.label || "Indicador")}</dt><dd class="v">${esc(k.v)}</dd>${it.note ? `<dd class="note">${esc(it.note)}</dd>` : ""}${k.warn ? `<dd class="warn">${esc(k.warn)}</dd>` : ""}</div>`; }).join("");
        return `<section class="blk b-kpi" data-id="${b.id}">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}<dl class="kpis">${items || '<p class="muted">Adicione indicadores a este bloco.</p>'}</dl></section>`;
      }
      case "table": {
        const idx = (b.columns || []).map(n => ds.header.indexOf(n)).filter(i => i >= 0);
        if (!idx.length) return `<section class="blk b-table" data-id="${b.id}">${warn("Escolha ao menos uma coluna para a tabela.")}</section>`;
        const types = D.types(ds.header, ds.rows), cap = b.limit && b.limit > 0 ? b.limit : 200, rows = ds.rows.slice(0, Math.min(cap, 200));
        const more = ds.rows.length > rows.length;
        return `<section class="blk b-table" data-id="${b.id}">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}<table><caption class="sr-only">${esc(b.heading || "Tabela de dados")}</caption><thead><tr>${idx.map(i => `<th scope="col"${types[i] === "num" ? ' class="n"' : ""}>${esc(ds.header[i])}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${idx.map(i => types[i] === "num" && D.num(r[i]) !== null ? `<td class="n">${esc(D.fmt(D.num(r[i]), { max: 2 }))}</td>` : `<td>${esc(r[i])}</td>`).join("")}</tr>`).join("")}</tbody></table>${more ? `<p class="note">Mostrando ${rows.length} de ${ds.rows.length.toLocaleString("pt-BR")} linhas.</p>` : ""}</section>`;
      }
      case "chart": {
        const g = C.build({ type: b.chart, title: b.heading, x: b.x, y: b.y, sort: b.sort, limit: b.limit }, ds, "c" + b.id);
        if (g.error) return `<section class="blk b-chart" data-id="${b.id}">${warn(g.error)}</section>`;
        return `<figure class="blk b-chart" data-id="${b.id}">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}${g.svg}<figcaption>${esc(g.summary)}</figcaption>${g.table}</figure>`;
      }
      case "break":
        return `<div class="blk b-break" data-id="${b.id}" role="separator" aria-label="Quebra de página"></div>`;
      default: return "";
    }
  }

  const render = (doc, opt) => `<article class="sheet${opt && opt.preview ? " preview" : ""}" data-theme="${esc(doc.theme || "editorial")}">${(doc.blocks || []).map(b => block(b, doc)).join("")}</article>`;

  function titleOf(doc) { const t = (doc.blocks || []).find(b => b.type === "title"); return (t && t.title) || "Relatório"; }
  const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "relatorio";

  // Arquivo HTML único: sem JavaScript, com CSS embutido
  function standalone(doc, css) {
    const title = titleOf(doc);
    return `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}\nbody{margin:0;background:#e9e1d1}.sheet{width:auto;max-width:794px;margin:24px auto;box-shadow:0 2px 14px rgba(0,0,0,.18)}@media(max-width:820px){.sheet{margin:0;padding:20px;box-shadow:none}}@media print{body{background:none}.sheet{margin:0;box-shadow:none;max-width:none}}</style></head><body><main>${render(doc)}</main></body></html>`;
  }

  window.RFReport = { render, standalone, titleOf, slug, FN, kpiValue };
})();
