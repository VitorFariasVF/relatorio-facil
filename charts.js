/* Relatório Fácil — gráficos de barras e linhas em SVG feito à mão (sem biblioteca).
   Acessíveis: cada gráfico devolve também um resumo em texto e uma tabela de dados.
   Séries se distinguem por padrão/traço/marcador, não só por cor. */
(() => {
  const D = window.RFData;
  const PAL = ["#8a5200", "#0f6a60", "#3342a0", "#a61b1b"];       // contraste ≥ 3:1 sobre a folha clara
  const DASH = ["", "7 4", "2 4", "9 3 2 3"];
  const PAPER = "#fffdf8", INK = "#3a2f22", GRID = "#e4dccd", AXIS = "#7a6f60";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;

  function nice(min, max, ticks = 5) {
    if (min === max) max = min + 1;
    const raw = (max - min) / ticks, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return { lo, hi, ticks: out };
  }

  function pattern(id, k) {
    const c = PAL[k];
    if (k === 1) return `<pattern id="${id}-p1" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${PAPER}"/><rect width="3.2" height="7" fill="${c}"/></pattern>`;
    if (k === 2) return `<pattern id="${id}-p2" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${PAPER}"/><circle cx="3.5" cy="3.5" r="1.8" fill="${c}"/></pattern>`;
    if (k === 3) return `<pattern id="${id}-p3" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${PAPER}"/><path d="M0 0L8 8M8 0L0 8" stroke="${c}" stroke-width="1.6"/></pattern>`;
    return "";
  }
  const fillFor = (id, k) => k === 0 ? PAL[0] : `url(#${id}-p${k})`;
  const marker = (k, x, y) => {
    const c = PAL[k];
    if (k === 0) return `<circle cx="${x}" cy="${y}" r="4.2" fill="${c}" stroke="${PAPER}" stroke-width="1.4"/>`;
    if (k === 1) return `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${c}" stroke="${PAPER}" stroke-width="1.4"/>`;
    if (k === 2) return `<path d="M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z" fill="${c}" stroke="${PAPER}" stroke-width="1.4"/>`;
    return `<path d="M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z" fill="${c}" stroke="${PAPER}" stroke-width="1.4"/>`;
  };

  // spec: { type:"bar"|"line", title, x:"coluna", y:["coluna",...], sort:"none"|"asc"|"desc", limit:1..12 }
  function build(spec, ds, id) {
    const xi = ds.header.indexOf(spec.x), yi = (spec.y || []).map(n => ds.header.indexOf(n)).filter(i => i >= 0).slice(0, 4);
    if (xi < 0 || !yi.length) return { error: "Escolha a coluna das categorias e ao menos uma coluna de valores." };
    const names = yi.map(i => ds.header[i]);
    const order = [], map = new Map();
    for (const r of ds.rows) {
      const lab = r[xi] === "" ? "(vazio)" : r[xi];
      if (!map.has(lab)) { map.set(lab, yi.map(() => 0)); order.push(lab); }
      const vals = map.get(lab); yi.forEach((c, k) => { const n = D.num(r[c]); if (n !== null) vals[k] += n; });
    }
    let pts = order.map(l => ({ l, v: map.get(l) })); const total = pts.length;
    if (spec.sort === "desc") pts.sort((a, b) => b.v[0] - a.v[0]); else if (spec.sort === "asc") pts.sort((a, b) => a.v[0] - b.v[0]);
    const lim = Math.max(1, Math.min(12, +spec.limit || 12)); pts = pts.slice(0, lim);
    const n = pts.length, S = names.length, isLine = spec.type === "line";
    const all = pts.flatMap(p => p.v), vmax = Math.max(...all), vmin = Math.min(...all);
    const base0 = !isLine || (vmin >= 0 && vmin < .5 * vmax);
    const sc = nice(base0 ? Math.min(0, vmin) : vmin, Math.max(vmax, base0 ? 0 : vmax));
    const W = 640, H = 340, fmtTick = v => D.fmt(v, { compact: Math.abs(sc.hi) >= 10000, max: 1 });
    const left = Math.min(76, Math.max(46, 16 + 7.2 * Math.max(...sc.ticks.map(t => fmtTick(t).length))));
    const maxLab = Math.max(...pts.map(p => Math.min(16, p.l.length))), rot = n > 6 || maxLab > 9;
    const top = 14 + (S > 1 ? 26 : 0), bot = rot ? 26 + Math.min(70, maxLab * 5.6) : 36;
    const x0 = left, x1 = W - 14, y0 = top, y1 = H - bot, gw = (x1 - x0) / n;
    const Y = v => y1 - (v - sc.lo) / (sc.hi - sc.lo) * (y1 - y0), zero = Y(Math.max(sc.lo, Math.min(0, sc.hi)));
    let g = `<defs>${[1, 2, 3].filter(k => k < S && !isLine).map(k => pattern(id, k)).join("")}</defs><rect width="${W}" height="${H}" fill="${PAPER}"/>`;
    for (const t of sc.ticks) { const y = Y(t); g += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${GRID}" stroke-width="1"/><text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11.5" fill="${INK}">${esc(fmtTick(t))}</text>`; }
    g += `<line x1="${x0}" x2="${x1}" y1="${zero}" y2="${zero}" stroke="${AXIS}" stroke-width="1.5"/>`;
    if (!isLine) {
      const bw = Math.max(5, Math.min(60, gw * .78 / S)), gx = (gw - bw * S) / 2;
      pts.forEach((p, i) => p.v.forEach((v, k) => {
        const x = x0 + i * gw + gx + k * bw, y = Y(v), h = Math.abs(zero - y);
        g += `<rect x="${x.toFixed(1)}" y="${Math.min(y, zero).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, v === 0 ? 0 : 1).toFixed(1)}" fill="${fillFor(id, k)}" stroke="${PAL[k]}" stroke-width="1"/>`;
        if (n * S <= 10) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${(v >= 0 ? y - 5 : y + 14).toFixed(1)}" text-anchor="middle" font-size="11" fill="${INK}">${esc(D.fmt(v, { compact: Math.abs(v) >= 10000, max: 1 }))}</text>`;
      }));
    } else {
      for (let k = 0; k < S; k++) {
        const xy = pts.map((p, i) => [x0 + gw * (i + .5), Y(p.v[k])]);
        g += `<polyline points="${xy.map(a => a.map(q => q.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="${PAL[k]}" stroke-width="2.6" stroke-linejoin="round"${DASH[k] ? ` stroke-dasharray="${DASH[k]}"` : ""}/>`;
        xy.forEach(([x, y]) => { g += marker(k, +x.toFixed(1), +y.toFixed(1)); });
      }
    }
    pts.forEach((p, i) => {
      const x = x0 + gw * (i + .5), t = esc(cut(p.l, 16));
      g += rot ? `<text transform="translate(${x.toFixed(1)} ${y1 + 14}) rotate(-35)" text-anchor="end" font-size="11.5" fill="${INK}">${t}</text>` : `<text x="${x.toFixed(1)}" y="${y1 + 20}" text-anchor="middle" font-size="11.5" fill="${INK}">${t}</text>`;
    });
    if (S > 1) {
      let lx = x0; names.forEach((nm, k) => {
        const lab = cut(nm, 18);
        g += isLine ? `<line x1="${lx}" x2="${lx + 26}" y1="12" y2="12" stroke="${PAL[k]}" stroke-width="2.6"${DASH[k] ? ` stroke-dasharray="${DASH[k]}"` : ""}/>${marker(k, lx + 13, 12)}` : `<rect x="${lx}" y="6" width="22" height="12" fill="${fillFor(id, k)}" stroke="${PAL[k]}"/>`;
        g += `<text x="${lx + 32}" y="16" font-size="12" fill="${INK}">${esc(lab)}</text>`; lx += 44 + lab.length * 6.6;
      });
    }
    // resumo em texto
    const q = s => `“${s}”`, fv = v => D.fmt(v, { max: 2 });
    let sum = `Gráfico de ${isLine ? "linhas" : "barras"} com ${n} ${n === 1 ? "categoria" : "categorias"} de ${q(spec.x)}, ${S === 1 ? `mostrando ${q(names[0])}` : `comparando ${names.map(q).join(", ")}`}.`;
    if (total > n) sum += ` Mostrando ${n} de ${total} categorias.`;
    names.forEach((nm, k) => {
      const hi = pts.reduce((a, p) => p.v[k] > a.v[k] ? p : a), lo = pts.reduce((a, p) => p.v[k] < a.v[k] ? p : a);
      sum += ` ${S > 1 ? q(nm) + ": " : ""}maior valor ${q(hi.l)} (${fv(hi.v[k])}), menor valor ${q(lo.l)} (${fv(lo.v[k])}).`;
      if (isLine && n >= 2 && pts[0].v[k] !== 0) { const a = pts[0].v[k], b = pts[n - 1].v[k], pc = (b - a) / Math.abs(a) * 100; sum += ` De ${q(pts[0].l)} a ${q(pts[n - 1].l)}, ${pc >= 0 ? "subiu" : "caiu"} ${D.fmt(Math.abs(pc), { max: 1 })}% (de ${fv(a)} para ${fv(b)}).`; }
    });
    const title = spec.title || `${names.join(", ")} por ${spec.x}`;
    const svg = `<svg class="chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d" font-family="Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"><title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(sum)}</desc>${g}</svg>`;
    const table = `<table class="sr-only"><caption>Dados do gráfico: ${esc(title)}</caption><thead><tr><th scope="col">${esc(spec.x)}</th>${names.map(nm => `<th scope="col">${esc(nm)}</th>`).join("")}</tr></thead><tbody>${pts.map(p => `<tr><th scope="row">${esc(p.l)}</th>${p.v.map(v => `<td>${esc(fv(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return { svg, summary: sum, table, title };
  }
  window.RFCharts = { build, PAL };
})();
