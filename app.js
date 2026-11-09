/* Relatório Fácil — editor de relatórios no navegador. Dados e arquivos nunca saem do aparelho. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const D = window.RFData, R = window.RFReport, TP = window.RFTemplates, T = window.VFTool;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPES = { title: "Título", text: "Texto", kpi: "Indicadores", table: "Tabela", chart: "Gráfico", break: "Quebra de página" };
  const MAXBLOCKS = 200, DRAFT_MAX = 1024 * 1024;
  const S = { doc: null, sel: null, hist: [], redo: [], lastKey: "", lastAt: 0, tab: "edit", draftFail: false, exported: true };

  /* ---------- Avisos ---------- */
  const live = $("#live");
  const say = m => { live.textContent = ""; setTimeout(() => { live.textContent = m; }, 30); };
  const alertBox = $("#alert");
  const showAlert = m => { alertBox.innerHTML = `<p>${esc(m)}</p><button class="link" type="button" id="alert-x">Dispensar</button>`; alertBox.hidden = false; $("#alert-x").onclick = () => { alertBox.hidden = true; }; };

  /* ---------- Dados e tipos ---------- */
  const typeCache = new WeakMap();
  const types = ds => { let t = typeCache.get(ds); if (!t) { t = D.types(ds.header, ds.rows); typeCache.set(ds, t); } return t; };
  const numCols = ds => ds.header.filter((_, i) => types(ds)[i] === "num");
  const textCol = ds => ds.header.find((_, i) => types(ds)[i] === "text") || ds.header[0];
  const blk = id => S.doc.blocks.find(b => b.id === id);
  const idxOf = id => S.doc.blocks.findIndex(b => b.id === id);
  const summ = b => {
    if (b.type === "title") return b.title || "";
    if (b.type === "text") return b.heading || (b.body || "").slice(0, 40);
    if (b.type === "kpi") return `${(b.items || []).length} ${(b.items || []).length === 1 ? "indicador" : "indicadores"}`;
    if (b.type === "table") return `${b.heading || "Tabela"} · ${(b.columns || []).length} colunas`;
    if (b.type === "chart") return b.heading || `${(b.y || []).join(", ") || "?"} por ${b.x || "?"}`;
    return "Nova página no PDF";
  };

  function newBlock(type) {
    const ds = S.doc.data, id = TP.newId(), nums = numCols(ds), cat = textCol(ds), others = nums.filter(c => c !== cat);
    if (type === "title") return { id, type, title: "Título do relatório", subtitle: "", author: "", date: "", cover: false };
    if (type === "text") return { id, type, heading: "Nova seção", body: "" };
    if (type === "kpi") return { id, type, heading: "", items: (others.length ? others : nums).slice(0, 3).map(c => ({ label: "Soma de " + c, mode: "calc", fn: "sum", col: c, prefix: "", suffix: "", note: "" })).concat(nums.length ? [] : [{ label: "Indicador", mode: "manual", value: "0", note: "" }]) };
    if (type === "table") return { id, type, heading: "Tabela", columns: ds.header.slice(0, 6), limit: 10 };
    if (type === "chart") return { id, type, chart: "bar", heading: "", x: cat, y: others.slice(0, 1), sort: "none", limit: 12 };
    return { id, type: "break" };
  }

  // Depois de trocar os dados: ajusta colunas que não existem mais
  function repair() {
    const ds = S.doc.data, ty = types(ds), cat = textCol(ds), nums = numCols(ds); let n = 0;
    S.doc.blocks.forEach(b => {
      if (b.type === "table") { const keep = (b.columns || []).filter(c => ds.header.includes(c)); if (keep.length !== (b.columns || []).length) { b.columns = keep.length ? keep : ds.header.slice(0, 6); n++; } }
      if (b.type === "chart") { if (!ds.header.includes(b.x)) { b.x = cat; n++; } const keep = (b.y || []).filter(c => ds.header.includes(c)); if (keep.length !== (b.y || []).length || !keep.length) { b.y = keep.length ? keep : nums.filter(c => c !== b.x).slice(0, 1); n++; } }
      if (b.type === "kpi") (b.items || []).forEach(it => { if (it.mode === "calc" && !ds.header.includes(it.col)) { it.col = nums[0] || ds.header[0]; n++; } });
    });
    return n;
  }

  /* ---------- Histórico ---------- */
  const snapNow = () => ({ blocks: JSON.stringify(S.doc.blocks), theme: S.doc.theme, data: S.doc.data, sample: !!S.doc.sample });
  function snap(key) {
    const now = Date.now(); if (key && key === S.lastKey && now - S.lastAt < 1200) { S.lastAt = now; return; }
    S.hist.push(snapNow()); if (S.hist.length > 60) S.hist.shift(); S.redo = []; S.lastKey = key || ""; S.lastAt = now; updateBar();
  }
  function restore(h) { S.doc.blocks = JSON.parse(h.blocks); S.doc.theme = h.theme; S.doc.data = h.data; S.doc.sample = h.sample; if (S.sel && !blk(S.sel)) S.sel = null; S.lastKey = ""; }
  function undo() { const h = S.hist.pop(); if (!h) return; S.redo.push(snapNow()); restore(h); afterChange(); say("Desfeito."); }
  function redo() { const h = S.redo.pop(); if (!h) return; S.hist.push(snapNow()); restore(h); afterChange(); say("Refeito."); }

  /* ---------- Rascunho (localStorage) ---------- */
  let draftT = 0;
  const KEYSTORE = "vf-tools:relatorio-facil:v1";
  function saveDraft() {
    clearTimeout(draftT); draftT = setTimeout(() => {
      if (!S.doc) return;
      const at = Date.now(), payload = { doc: S.doc, at }, size = JSON.stringify(payload).length;
      if (size > DRAFT_MAX) { S.draftFail = true; setDraftStatus("Rascunho grande demais para o navegador. Baixe o projeto (.json) para não perder o trabalho."); return; }
      T.set("draft", payload);
      let ok = false; try { ok = JSON.parse(localStorage.getItem(KEYSTORE) || "{}").draft?.at === at; } catch { }
      S.draftFail = !ok;
      setDraftStatus(ok ? "Rascunho salvo neste navegador às " + new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + "." : "Não consegui guardar o rascunho (memória do navegador cheia). Baixe o projeto (.json).");
    }, 600);
  }
  const setDraftStatus = m => { $("#draftst").textContent = m; };
  window.addEventListener("beforeunload", e => { if (S.doc && S.draftFail) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Início ---------- */
  function buildStart() {
    const mini = n => `<div class="mini" aria-hidden="true">${[40, 70, 55, 90, 62].slice(0, n).map(h => `<s style="height:${h}%"></s>`).join("")}</div>`;
    $("#tpls").innerHTML = TP.list.map(t => `<button class="tpl" type="button" data-tpl="${t.id}">${mini(t.id === "vendas" ? 5 : t.id === "semanal" ? 4 : 3)}<b>${esc(t.name)}</b><span>${esc(t.desc)}</span><i>Usar este modelo →</i></button>`).join("") +
      `<button class="tpl" type="button" data-tpl="branco"><div class="mini" aria-hidden="true"></div><b>Começar em branco</b><span>Só um título e um texto. Você cola os dados e monta o resto.</span><i>Começar →</i></button>`;
    const d = T.get("draft", null); $("#resume").hidden = !(d && d.doc && Array.isArray(d.doc.blocks));
    if (!$("#resume").hidden) $("#resume").textContent = "Continuar o rascunho (" + new Date(d.at).toLocaleDateString("pt-BR") + ")";
  }
  $("#tpls").addEventListener("click", e => { const b = e.target.closest("[data-tpl]"); if (!b) return; const k = b.dataset.tpl; open(TP.make(k), k !== "branco", `Modelo “${(TP.list.find(t => t.id === k) || { name: "em branco" }).name}” carregado.`); });
  $("#resume").onclick = () => { const d = T.get("draft", null); const v = d && validate({ app: "relatorio-facil", doc: d.doc }); if (v && v.ok) open(v.doc, false, "Rascunho restaurado."); else showAlert("Não consegui restaurar o rascunho."); };

  function open(doc, sample, msg) {
    S.doc = doc; S.doc.sample = !!sample; S.sel = null; S.hist = []; S.redo = []; S.lastKey = ""; S.exported = true;
    $("#start").hidden = true; $("#editor").hidden = false; $("#themesel").value = doc.theme || "editorial";
    setTab("edit"); afterChange(true); saveDraft(); say(msg || "Relatório aberto.");
    const f = $(".bsel"); if (f) f.focus({ preventScroll: true });
  }

  /* ---------- Desenho do editor ---------- */
  function afterChange(skipSave) { renderList(); renderSheet(); renderData(); updateBar(); if (!skipSave) saveDraft(); }
  function updateBar() {
    $("#undo").disabled = !S.hist.length; $("#redo").disabled = !S.redo.length;
    $("#sample").hidden = !(S.doc && S.doc.sample);
  }
  function renderData() {
    const ds = S.doc.data, nums = numCols(ds).length;
    $("#dsum").textContent = `${ds.rows.length.toLocaleString("pt-BR")} ${ds.rows.length === 1 ? "linha" : "linhas"} × ${ds.header.length} colunas (${nums} numéricas): ${ds.header.slice(0, 6).join(", ")}${ds.header.length > 6 ? "…" : ""}`;
  }
  let sheetT = 0;
  function renderSheet() {
    $("#sheetscale").innerHTML = R.render(S.doc, { preview: true });
    markSel(); fit();
  }
  const schedSheet = () => { clearTimeout(sheetT); sheetT = setTimeout(renderSheet, 140); };
  function markSel() { $$("#sheetscale .blk.sel").forEach(x => x.classList.remove("sel")); if (S.sel) { const el = $(`#sheetscale .blk[data-id="${S.sel}"]`); if (el) el.classList.add("sel"); } }
  function fit() {
    const wrap = $("#sheetwrap"), sc = $("#sheetscale"), sheet = $("#sheetscale .sheet"); if (!sheet) return;
    const w = wrap.clientWidth; if (!w) return;
    const s = Math.min(1, w / 794); sc.style.transform = `scale(${s})`; wrap.style.height = Math.ceil(sheet.offsetHeight * s) + "px";
  }
  if ("ResizeObserver" in window) new ResizeObserver(() => fit()).observe($("#pane-sheet")); window.addEventListener("resize", fit);

  /* ---------- Lista de blocos e formulários ---------- */
  const fid = (b, n) => `${b.id}-${n}`;
  const opt = (v, label, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(label)}</option>`;
  const inp = (b, name, label, v, extra = "") => `<div class="field"><label for="${fid(b, name)}">${label}</label><input id="${fid(b, name)}" data-f="${name}" value="${esc(v)}" autocomplete="off" ${extra}></div>`;

  function form(b) {
    const ds = S.doc.data, ty = types(ds), n = S.doc.blocks.length;
    const posSel = `<div class="field"><label for="${fid(b, "pos")}">Posição no relatório</label><select id="${fid(b, "pos")}" data-f="pos">${S.doc.blocks.map((_, i) => opt(i + 1, `${i + 1} de ${n}`, idxOf(b.id) + 1)).join("")}</select></div>`;
    let h = "";
    if (b.type === "title") h = inp(b, "title", "Título", b.title) + inp(b, "subtitle", "Subtítulo", b.subtitle) + inp(b, "author", "Autor", b.author) + inp(b, "date", "Data ou período", b.date) +
      `<label class="chk"><input type="checkbox" data-f="cover"${b.cover ? " checked" : ""}> Capa em página inteira</label>`;
    else if (b.type === "text") h = inp(b, "heading", "Título da seção (opcional)", b.heading) + `<div class="field"><label for="${fid(b, "body")}">Texto</label><textarea id="${fid(b, "body")}" data-f="body" rows="6">${esc(b.body)}</textarea><span class="hint">Linha em branco separa parágrafos. Comece a linha com “- ” para fazer uma lista.</span></div>`;
    else if (b.type === "kpi") {
      h = inp(b, "heading", "Título da seção (opcional)", b.heading) + (b.items || []).map((it, i) => {
        const base = `${b.id}-k${i}`, calc = it.mode === "calc";
        return `<div class="kitem" role="group" aria-label="Indicador ${i + 1}">
          <div class="field"><label for="${base}-label">Rótulo</label><input id="${base}-label" data-i="${i}" data-f="label" value="${esc(it.label)}"></div>
          <div class="field"><label for="${base}-mode">Valor</label><select id="${base}-mode" data-i="${i}" data-f="mode">${opt("calc", "Calculado a partir dos dados", it.mode)}${opt("manual", "Digitado por mim", it.mode)}</select></div>
          ${calc ? `<div class="two"><div class="field"><label for="${base}-fn">Cálculo</label><select id="${base}-fn" data-i="${i}" data-f="fn">${Object.entries(R.FN).map(([k, v]) => opt(k, v, it.fn)).join("")}</select></div>
            <div class="field"><label for="${base}-col">Coluna</label><select id="${base}-col" data-i="${i}" data-f="col">${ds.header.map((c, ci) => opt(c, c + (ty[ci] === "num" ? "" : " (texto)"), it.col)).join("")}</select></div></div>
            <div class="two"><div class="field"><label for="${base}-prefix">Antes do valor</label><input id="${base}-prefix" data-i="${i}" data-f="prefix" value="${esc(it.prefix || "")}" placeholder="R$ "></div>
            <div class="field"><label for="${base}-suffix">Depois do valor</label><input id="${base}-suffix" data-i="${i}" data-f="suffix" value="${esc(it.suffix || "")}" placeholder=" h"></div></div>
            <div class="field"><label for="${base}-dec">Casas decimais</label><input id="${base}-dec" type="number" min="0" max="4" data-i="${i}" data-f="dec" value="${it.dec == null ? "" : it.dec}" placeholder="automático"></div>`
            : `<div class="field"><label for="${base}-value">Valor</label><input id="${base}-value" data-i="${i}" data-f="value" value="${esc(it.value || "")}"></div>`}
          <div class="field"><label for="${base}-note">Nota (opcional)</label><input id="${base}-note" data-i="${i}" data-f="note" value="${esc(it.note || "")}"></div>
          <button class="btn danger" type="button" data-kdel="${i}" aria-label="Remover indicador ${i + 1}">Remover indicador</button></div>`;
      }).join("") + ((b.items || []).length < 4 ? `<button class="btn" type="button" data-kadd>+ Adicionar indicador</button>` : `<p class="muted">No máximo 4 indicadores por bloco.</p>`);
    } else if (b.type === "table") h = inp(b, "heading", "Título da tabela", b.heading) +
      `<fieldset><legend>Colunas</legend>${ds.header.map((c, i) => `<label class="chk"><input type="checkbox" data-group="columns" value="${esc(c)}"${(b.columns || []).includes(c) ? " checked" : ""}> ${esc(c)}</label>`).join("")}</fieldset>` +
      `<div class="field"><label for="${fid(b, "limit")}">Linhas a mostrar</label><select id="${fid(b, "limit")}" data-f="limit">${[5, 10, 20, 50, 200].map(v => opt(v, v === 200 ? "Todas (até 200)" : v + " linhas", b.limit || 10)).join("")}</select></div>`;
    else if (b.type === "chart") h = inp(b, "heading", "Título do gráfico", b.heading) +
      `<div class="field"><label for="${fid(b, "chart")}">Tipo</label><select id="${fid(b, "chart")}" data-f="chart">${opt("bar", "Barras", b.chart)}${opt("line", "Linhas", b.chart)}</select></div>
       <div class="field"><label for="${fid(b, "x")}">Categorias (eixo horizontal)</label><select id="${fid(b, "x")}" data-f="x">${ds.header.map(c => opt(c, c, b.x)).join("")}</select></div>
       <fieldset><legend>Valores (até 4 colunas numéricas)</legend>${ds.header.map((c, i) => ty[i] === "num" ? `<label class="chk"><input type="checkbox" data-group="y" value="${esc(c)}"${(b.y || []).includes(c) ? " checked" : ""}> ${esc(c)}</label>` : "").join("") || '<p class="muted">Não há colunas numéricas nos dados.</p>'}</fieldset>
       <div class="field"><label for="${fid(b, "sort")}">Ordem</label><select id="${fid(b, "sort")}" data-f="sort">${opt("none", "Como está nos dados", b.sort)}${opt("desc", "Do maior para o menor", b.sort)}${opt("asc", "Do menor para o maior", b.sort)}</select></div>
       <div class="field"><label for="${fid(b, "limit")}">Máximo de categorias (até 12)</label><input id="${fid(b, "limit")}" type="number" min="1" max="12" data-f="limit" value="${b.limit || 12}"></div>`;
    else h = `<p class="muted">Este bloco força o conteúdo seguinte a começar numa nova página do PDF.</p>`;
    return h + posSel;
  }

  function renderList() {
    const act = document.activeElement, key = act && act.closest && act.closest("#blist") ? (act.dataset.act ? `[data-act="${act.dataset.act}"]` : act.classList.contains("bsel") ? ".bsel" : "") + "|" + (act.closest(".bl") || {}).dataset?.id : "";
    const n = S.doc.blocks.length;
    $("#blist").innerHTML = S.doc.blocks.map((b, i) => {
      const open = S.sel === b.id, label = TYPES[b.type] + ", posição " + (i + 1) + " de " + n;
      return `<li class="bl${open ? " open" : ""}" data-id="${b.id}">
        <div class="bhead"><button class="bsel" type="button" aria-expanded="${open}" aria-controls="form-${b.id}"><span class="bn" aria-hidden="true">${i + 1}</span><span class="bt">${TYPES[b.type]}</span><span class="bs">${esc(summ(b))}</span></button>
        <div class="bact">
          <button class="btn" type="button" data-act="up" aria-label="Subir bloco: ${esc(label)}"${i === 0 ? " disabled" : ""}>Subir</button>
          <button class="btn" type="button" data-act="down" aria-label="Descer bloco: ${esc(label)}"${i === n - 1 ? " disabled" : ""}>Descer</button>
          <button class="btn" type="button" data-act="dup" aria-label="Duplicar bloco: ${esc(label)}">Duplicar</button>
          <button class="btn danger" type="button" data-act="del" aria-label="Excluir bloco: ${esc(label)}">Excluir</button></div></div>
        ${open ? `<div class="bform" id="form-${b.id}">${form(b)}</div>` : ""}</li>`;
    }).join("") || '<li class="muted">Nenhum bloco. Use os botões abaixo para adicionar.</li>';
    $$(".bact .btn[disabled]").forEach(x => x.setAttribute("aria-disabled", "true"));
    if (key) { const [sel, id] = key.split("|"); const el = $(`#blist .bl[data-id="${id}"] ${sel || ".bsel"}`) || $(`#blist .bl[data-id="${id}"] .bsel`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  }

  function setSel(id, focusForm) {
    S.sel = S.sel === id && !focusForm ? null : id; renderList(); markSel();
    if (S.sel) { const f = $(`#form-${S.sel} [data-f]`); if (focusForm && f) f.focus(); const el = $(`#sheetscale .blk[data-id="${S.sel}"]`); if (el) el.scrollIntoView({ block: "nearest" }); }
  }

  const moveTo = (id, to) => { const i = idxOf(id), b = S.doc.blocks.splice(i, 1)[0]; S.doc.blocks.splice(Math.max(0, Math.min(S.doc.blocks.length, to)), 0, b); };
  $("#blist").addEventListener("click", e => {
    const li = e.target.closest(".bl"); if (!li) return; const id = li.dataset.id, b = blk(id);
    const act = e.target.closest("[data-act]");
    if (act && !act.disabled) {
      const k = act.dataset.act, i = idxOf(id);
      if (k === "up" || k === "down") { snap(); moveTo(id, i + (k === "up" ? -1 : 1)); afterChange(); say(`Bloco “${TYPES[b.type]}” movido para a posição ${idxOf(id) + 1} de ${S.doc.blocks.length}.`); const t = $(`#blist .bl[data-id="${id}"] [data-act="${k}"]`); (t && !t.disabled ? t : $(`#blist .bl[data-id="${id}"] .bsel`)).focus(); }
      else if (k === "dup") { snap(); const c = JSON.parse(JSON.stringify(b)); c.id = TP.newId(); S.doc.blocks.splice(i + 1, 0, c); S.sel = c.id; afterChange(); say("Bloco duplicado."); const f = $(`#blist .bl[data-id="${c.id}"] .bsel`); if (f) f.focus(); }
      else if (k === "del") { snap(); S.doc.blocks.splice(i, 1); if (S.sel === id) S.sel = null; afterChange(); say(`Bloco “${TYPES[b.type]}” excluído. Restam ${S.doc.blocks.length}.`); const nx = S.doc.blocks[Math.min(i, S.doc.blocks.length - 1)]; const f = nx ? $(`#blist .bl[data-id="${nx.id}"] .bsel`) : $("[data-add]"); if (f) f.focus(); }
      return;
    }
    if (e.target.closest(".bsel")) { setSel(id); return; }
    if (e.target.closest("[data-kadd]")) { snap(); b.items.push({ label: "Indicador", mode: "calc", fn: "sum", col: numCols(S.doc.data)[0] || S.doc.data.header[0], prefix: "", suffix: "", note: "" }); rebuild(b); return; }
    const kd = e.target.closest("[data-kdel]"); if (kd) { snap(); b.items.splice(+kd.dataset.kdel, 1); rebuild(b); say("Indicador removido."); }
  });
  function rebuild(b) { renderList(); renderSheet(); saveDraft(); const f = $(`#form-${b.id} [data-f]`); if (f) f.focus(); }

  function onField(e) {
    const el = e.target.closest("[data-f],[data-group]"); if (!el) return; const li = el.closest(".bl"); if (!li) return; const b = blk(li.dataset.id);
    if (el.dataset.f === "pos") { snap(); const id = b.id; moveTo(id, +el.value - 1); afterChange(); say(`Bloco movido para a posição ${idxOf(id) + 1} de ${S.doc.blocks.length}.`); const f = $(`#form-${id} [data-f="pos"]`); if (f) f.focus(); return; }
    const key = b.id + ":" + (el.dataset.f || el.dataset.group) + (el.dataset.i || ""); snap(key);
    if (el.dataset.group) {
      const g = el.dataset.group, arr = $$(`[data-group="${g}"]:checked`, li).map(x => x.value);
      if (g === "y" && arr.length > 4) { el.checked = false; say("No máximo 4 colunas de valores."); return; }
      b[g] = arr;
    } else if (el.dataset.i !== undefined) {
      const it = b.items[+el.dataset.i], f = el.dataset.f; it[f] = f === "dec" ? (el.value === "" ? undefined : Math.max(0, Math.min(4, +el.value))) : el.value;
      if (f === "mode" || f === "fn") { renderList(); const nf = $(`#${b.id}-k${el.dataset.i}-${f}`); if (nf) nf.focus(); }
    } else if (el.type === "checkbox") b[el.dataset.f] = el.checked;
    else if (el.dataset.f === "limit") b.limit = Math.max(1, Math.min(200, +el.value || 12));
    else b[el.dataset.f] = el.value;
    const head = $(".bs", li); if (head) head.textContent = summ(b);
    if (el.dataset.f === "chart" || el.dataset.f === "x") { /* forma do gráfico mudou */ }
    schedSheet(); saveDraft();
  }
  // texto e números atualizam a folha enquanto se digita; selects e caixas de seleção, ao mudar
  $("#blist").addEventListener("input", e => { if (e.target.matches("input:not([type=checkbox]), textarea")) onField(e); });
  $("#blist").addEventListener("change", e => { if (e.target.matches("select, input[type=checkbox]")) onField(e); });

  $$("[data-add]").forEach(btn => btn.onclick = () => {
    const type = btn.dataset.add; if (S.doc.blocks.length >= MAXBLOCKS) { showAlert("O relatório já tem o máximo de " + MAXBLOCKS + " blocos."); return; }
    snap(); const b = newBlock(type), at = S.sel ? idxOf(S.sel) + 1 : S.doc.blocks.length; S.doc.blocks.splice(at, 0, b); S.sel = b.id;
    afterChange(); say(`${TYPES[type]} adicionado na posição ${at + 1}.`);
    const f = $(`#form-${b.id} [data-f]`) || $(`#blist .bl[data-id="${b.id}"] .bsel`); if (f) f.focus(); const el = $(`#sheetscale .blk[data-id="${b.id}"]`); if (el) el.scrollIntoView({ block: "nearest" });
  });
  $("#themesel").onchange = e => { snap(); S.doc.theme = e.target.value; renderSheet(); saveDraft(); say("Tema da folha: " + e.target.selectedOptions[0].textContent + "."); };
  $("#undo").onclick = undo; $("#redo").onclick = redo;
  document.addEventListener("keydown", e => {
    if (!S.doc || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || $("#datadlg").open) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
  });

  /* ---------- Abas (celular) ---------- */
  function setTab(t) {
    S.tab = t; $("#layout").dataset.tab = t;
    $("#tab-edit").setAttribute("aria-selected", t === "edit"); $("#tab-sheet").setAttribute("aria-selected", t === "sheet");
    $("#tab-edit").tabIndex = t === "edit" ? 0 : -1; $("#tab-sheet").tabIndex = t === "sheet" ? 0 : -1; setTimeout(fit, 0);
  }
  $("#tab-edit").onclick = () => setTab("edit"); $("#tab-sheet").onclick = () => setTab("sheet");
  $("#tabs").addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const t = S.tab === "edit" ? "sheet" : "edit"; setTab(t); $("#tab-" + t).focus(); } });

  /* ---------- Diálogo de dados ---------- */
  const dlg = $("#datadlg"); let parsed = null, dT = 0;
  function dataStatus() {
    const r = D.parse($("#dtext").value), st = $("#dstatus"); parsed = r.ok ? r : null;
    if (!r.ok) { st.textContent = r.error; st.className = "dstatus err"; $("#dprev").innerHTML = ""; }
    else {
      const ty = D.types(r.header, r.rows), nn = ty.filter(t => t === "num").length;
      st.textContent = `Entendi: ${r.rows.length.toLocaleString("pt-BR")} linhas × ${r.header.length} colunas (${nn} numéricas). Separador: ${D.delimName(r.delimiter)}.`; st.className = "dstatus ok";
      $("#dprev").innerHTML = `<table><thead><tr>${r.header.map((h, i) => `<th scope="col">${esc(h)}${ty[i] === "num" ? " (nº)" : ""}</th>`).join("")}</tr></thead><tbody>${r.rows.slice(0, 8).map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    $("#dapply").disabled = !parsed;
  }
  function openData() { const ds = S.doc.data; $("#dtext").value = D.toCsv(ds.header, ds.rows, ";"); dataStatus(); dlg.showModal(); $("#dtext").focus(); }
  $("#editdata").onclick = openData;
  $("#dtext").addEventListener("input", () => { clearTimeout(dT); dT = setTimeout(dataStatus, 250); });
  $("#pickcsv").onclick = () => { const f = $("#csvfile"); f.value = ""; f.click(); };
  $("#csvfile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > D.LIM.bytes) { $("#dstatus").textContent = `“${f.name}” tem ${(f.size / 1048576).toFixed(1).replace(".", ",")} MB, acima do limite de 2 MB. Reduza a tabela e tente de novo.`; $("#dstatus").className = "dstatus err"; return; }
    try { $("#dtext").value = await f.text(); } catch { $("#dstatus").textContent = "Não consegui ler esse arquivo."; $("#dstatus").className = "dstatus err"; return; }
    dataStatus();
  };
  $("#dcancel").onclick = () => dlg.close();
  $("#dapply").onclick = () => {
    if (!parsed) return; snap();
    S.doc.data = { name: S.doc.data.name, header: parsed.header, rows: parsed.rows }; S.doc.sample = false;
    const fixed = repair(); dlg.close(); afterChange();
    say(`Dados atualizados: ${parsed.rows.length} linhas.` + (fixed ? ` Ajustei ${fixed} configuração(ões) de blocos às novas colunas.` : ""));
    if (fixed) showAlert(`As colunas mudaram: ajustei ${fixed} configuração(ões) de blocos. Confira os gráficos e indicadores.`);
    $("#editdata").focus();
  };
  dlg.addEventListener("close", () => { const b = $("#editdata"); if (b && b.isConnected && !$("#editor").hidden) b.focus(); });

  /* ---------- Projeto (.json) ---------- */
  function validate(obj) {
    try {
      if (!obj || obj.app !== "relatorio-facil" || !obj.doc || !Array.isArray(obj.doc.blocks) || !obj.doc.data) return { ok: false, error: "Esse arquivo não parece um projeto do Relatório Fácil." };
      const d = obj.doc, h = d.data.header, rows = d.data.rows;
      if (!Array.isArray(h) || !h.length || h.length > D.LIM.cols || !Array.isArray(rows) || rows.length > D.LIM.rows) return { ok: false, error: "Os dados do projeto estão fora dos limites (até 40 colunas e 5.000 linhas)." };
      if (d.blocks.length > MAXBLOCKS) return { ok: false, error: "O projeto tem blocos demais." };
      const header = h.map(String), data = { name: String(d.data.name || "Dados"), header, rows: rows.map(r => Array.isArray(r) ? header.map((_, i) => String(r[i] == null ? "" : r[i])) : header.map(() => "")) };
      const seen = new Set();
      const blocks = d.blocks.filter(b => b && TYPES[b.type]).map(b => { const c = JSON.parse(JSON.stringify(b)); if (!c.id || seen.has(c.id)) c.id = TP.newId(); seen.add(c.id); return c; });
      return { ok: true, doc: { theme: d.theme === "sobrio" ? "sobrio" : "editorial", data, blocks } };
    } catch { return { ok: false, error: "Não consegui ler esse projeto." }; }
  }
  $("#openproj").onclick = () => { const f = $("#projfile"); f.value = ""; f.click(); };
  $("#projfile").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 8 * 1048576) { showAlert(`“${f.name}” é grande demais para ser um projeto.`); return; }
    let obj; try { obj = JSON.parse(await f.text()); } catch { showAlert(`“${f.name}” não é um arquivo JSON válido.`); return; }
    const v = validate(obj); if (!v.ok) { showAlert(v.error); return; }
    open(v.doc, false, `Projeto “${f.name}” aberto.`);
  };

  /* ---------- Exportar ---------- */
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function deliver(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function reportCss() {
    for (const s of document.styleSheets) { if (s.href && /report\.css(\?|$)/.test(s.href)) { try { return [...s.cssRules].map(r => r.cssText).join("\n"); } catch { } } }
    try { return await (await fetch("report.css")).text(); } catch { return ""; }
  }
  $("#savejson").onclick = async () => {
    const name = R.slug(R.titleOf(S.doc)) + ".json", data = JSON.stringify({ app: "relatorio-facil", version: 1, savedAt: new Date().toISOString(), doc: { theme: S.doc.theme, data: S.doc.data, blocks: S.doc.blocks } });
    await deliver(new Blob([data], { type: "application/json" }), name); S.exported = true; T.toast("Projeto salvo."); say("Projeto salvo em " + name + ".");
  };
  $("#exphtml").onclick = async () => {
    const html = R.standalone(S.doc, await reportCss()); await deliver(new Blob([html], { type: "text/html" }), R.slug(R.titleOf(S.doc)) + ".html"); T.toast("HTML baixado."); say("Versão HTML baixada.");
  };
  $("#exppdf").onclick = () => {
    const old = document.title; document.title = R.titleOf(S.doc); renderSheet(); setTab("sheet");
    const back = () => { document.title = old; window.removeEventListener("afterprint", back); setTab(S.tab === "sheet" && matchMedia("(max-width:979px)").matches ? "sheet" : "edit"); };
    window.addEventListener("afterprint", back); setTimeout(() => window.print(), 60);
  };
  $("#newdoc").onclick = () => {
    if (!confirm("Voltar ao início? O rascunho continua salvo neste navegador.")) return;
    S.doc = null; $("#editor").hidden = true; $("#start").hidden = false; buildStart(); $("#tpls .tpl").focus();
  };
  $("#resetdata").onclick = () => { if (confirm("Isso remove o rascunho e as preferências desta ferramenta neste navegador. Continuar?")) { T.clear(); S.draftFail = false; setDraftStatus(""); buildStart(); T.toast("Dados apagados."); } };
  $("#y").textContent = new Date().getFullYear();

  buildStart();
  window.__rel = { S, open, validate, parse: D.parse };   // para testes
})();
