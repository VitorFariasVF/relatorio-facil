/* Relatório Fácil — leitura de CSV/tabelas e números no formato brasileiro. Sem dependências. */
(() => {
  const Data = {};
  const LIM = { rows: 5000, cols: 40, bytes: 2 * 1024 * 1024 };
  Data.LIM = LIM;

  // Descobre o separador olhando a primeira linha (tab, ponto e vírgula ou vírgula), ignorando o que está entre aspas
  Data.detectDelimiter = text => {
    const line = text.split(/\r?\n/).find(l => l.trim()) || "";
    const c = { "\t": 0, ";": 0, ",": 0 }; let q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch in c) c[ch]++; }
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : ",";
  };
  Data.delimName = d => d === "\t" ? "tabulação" : d === ";" ? "ponto e vírgula" : "vírgula";

  // Lê o texto colado ou o CSV. Devolve { ok, header, rows, delimiter } ou { ok:false, error }
  Data.parse = (raw, forced) => {
    const text = String(raw == null ? "" : raw).replace(/^﻿/, "");
    if (!text.trim()) return { ok: false, error: "Cole uma tabela ou escolha um arquivo CSV." };
    if (text.length > LIM.bytes) return { ok: false, error: "Os dados passam de 2 MB. Reduza a tabela e tente de novo." };
    const delim = forced || Data.detectDelimiter(text);
    const rows = [], lines = []; let row = [], cur = "", q = false, line = 1, rowLine = 1;
    const endRow = () => { row.push(cur.trim()); cur = ""; if (!(row.length === 1 && row[0] === "")) { rows.push(row); lines.push(rowLine); } row = []; };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else { cur += ch; if (ch === "\n") line++; }
      } else if (ch === '"' && cur === "") q = true;
      else if (ch === delim) { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; endRow(); line++; rowLine = line; }
      else cur += ch;
    }
    if (q) return { ok: false, error: `Aspas abertas na linha ${rowLine}. Feche as aspas (ou remova-as) e importe de novo.` };
    if (cur !== "" || row.length) endRow();
    if (rows.length < 2) return { ok: false, error: "Preciso de pelo menos o cabeçalho (primeira linha) e uma linha de dados." };
    const width = rows[0].length;
    if (width > LIM.cols) return { ok: false, error: `A tabela tem ${width} colunas. O limite é ${LIM.cols}.` };
    for (let r = 1; r < rows.length; r++) {
      const n = rows[r].length;
      if (n < width) return { ok: false, error: `Não consegui ler a linha ${lines[r]}: faltam colunas (esperava ${width}, encontrei ${n}). Corrija no arquivo e importe de novo.` };
      if (n > width) return { ok: false, error: `Não consegui ler a linha ${lines[r]}: sobram colunas (esperava ${width}, encontrei ${n}). Corrija no arquivo e importe de novo.` };
    }
    if (rows.length - 1 > LIM.rows) return { ok: false, error: `A tabela tem ${rows.length - 1} linhas. O limite é ${LIM.rows.toLocaleString("pt-BR")}.` };
    const seen = {};
    const header = rows[0].map((h, i) => {
      let name = h || `Coluna ${i + 1}`; if (seen[name]) { seen[name]++; name = `${name} (${seen[name]})`; } else seen[name] = 1; return name;
    });
    return { ok: true, header, rows: rows.slice(1), delimiter: delim };
  };

  // Número no formato brasileiro ("1.234,56", "R$ 12,5", "12%") ou internacional ("1,234.56"). Devolve número ou null.
  Data.num = v => {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (v == null) return null;
    let t = String(v).trim(); if (!t) return null;
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    t = t.replace(/R\$|US\$|[€£$%\s ]/g, "");
    if (/^[-−]/.test(t)) { neg = !neg || neg; t = t.replace(/^[-−]/, ""); neg = true; }
    else if (/-$/.test(t)) { neg = true; t = t.slice(0, -1); }
    t = t.replace(/^\+/, "");
    if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
    const dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
    let s;
    if (dots && commas) { const dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ","; s = dec === "," ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""); if ((dec === "," ? commas : dots) > 1) return null; }
    else if (commas) { s = (commas === 1 && !/^\d{1,3},\d{3}$/.test(t)) || (commas === 1 && /^0,/.test(t)) ? t.replace(",", ".") : (/^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : null); }
    else if (dots) { s = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : (dots === 1 ? t : null); }
    else s = t;
    if (s == null) return null;
    const n = parseFloat(s); if (!isFinite(n)) return null;
    return neg ? -n : n;
  };

  // "num" se pelo menos 80% das células preenchidas são números; senão "text"
  Data.types = (header, rows) => header.map((_, c) => {
    let filled = 0, ok = 0;
    for (const r of rows) { const v = r[c]; if (v !== "" && v != null) { filled++; if (Data.num(v) !== null) ok++; } }
    return filled && ok / filled >= .8 ? "num" : "text";
  });

  const nf = {};
  Data.fmt = (n, o = {}) => {
    if (n == null || !isFinite(n)) return "—";
    const key = JSON.stringify(o); nf[key] = nf[key] || new Intl.NumberFormat("pt-BR", { maximumFractionDigits: o.max == null ? 2 : o.max, minimumFractionDigits: o.min || 0, notation: o.compact ? "compact" : "standard" });
    return nf[key].format(n);
  };

  // Serializa de volta para CSV (para editar no diálogo de dados)
  Data.toCsv = (header, rows, d = ";") => {
    const q = s => { s = String(s == null ? "" : s); return s.includes(d) || /["\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [header, ...rows].map(r => r.map(q).join(d)).join("\n");
  };

  window.RFData = Data;
})();
