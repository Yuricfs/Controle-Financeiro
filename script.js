// Única declaração de variáveis globais
let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let filtradosParaExportar = [];
let chartPizza = null;
let chartLinha = null;
let idEdicao = null;

const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataAgora = new Date();

// --- CONFIGURAÇÃO ---
function configurarFiltros() {
    const sMes = document.getElementById("filtroMes");
    const sAno = document.getElementById("filtroAno");
    if (sMes && sMes.options.length === 0) {
        mesesNomes.forEach((m, i) => sMes.add(new Option(m, i + 1)));
        sMes.value = dataAgora.getMonth() + 1;
    }
    if (sAno && sAno.options.length === 0) {
        const anoAtual = dataAgora.getFullYear();
        for (let a = anoAtual - 1; a <= anoAtual + 1; a++) sAno.add(new Option(a, a));
        sAno.value = anoAtual;
    }
}

const formatarMoeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function descobrirCategoria(desc, catM, tipo) {
    if (catM) return catM;
    if (tipo === "entrada") return "Renda";
    const catsAuto = {
        "Alimentação": ["ifood", "pizza", "burger", "restaurante", "salgado", "lanche"],
        "Transporte": ["uber", "99", "gasolina", "posto", "i30", "oficina"],
        "Mercado": ["mercado", "supermercado", "atacadão"],
        "Casa": ["aluguel", "energia", "internet", "água"]
    };
    const t = desc.toLowerCase();
    for (const c in catsAuto) if (catsAuto[c].some(p => t.includes(p))) return c;
    return "Outros";
}

// --- EXPORTAÇÃO ---
window.exportarPDF = function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const mesIdx = document.getElementById("filtroMes").value - 1;
    doc.text(`Relatório Financeiro - ${mesesNomes[mesIdx]}`, 14, 15);
    
    const rows = filtradosParaExportar.map(i => [i.data, i.descricao, i.categoria, i.tipo === 'entrada' ? 'Entrada' : 'Gasto', formatarMoeda(i.valor)]);
    doc.autoTable({ head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']], body: rows, startY: 20 });
    doc.save(`extrato_${mesesNomes[mesIdx]}.pdf`);
};

window.exportarExcel = function() {
    const ws = XLSX.utils.json_to_sheet(filtradosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    XLSX.writeFile(wb, "financeiro_pro.xlsx");
};

// --- AÇÕES ---
window.salvarMeta = () => {
    const val = document.getElementById("inputMeta").value;
    if (window.salvarMetaFirebase) window.salvarMetaFirebase(Number(val));
    atualizarTela();
};

window.importarRecorrentes = function() {
    const m = document.getElementById("filtroMes").value;
    const a = document.getElementById("filtroAno").value;
    const recs = lancamentos.filter(i => i.recorrente === true);
    const novos = recs.map(i => ({ ...i, id: Date.now() + Math.random(), data: `01/${m.padStart(2, '0')}/${a}` }));
    lancamentos = [...lancamentos, ...novos];
    salvar(); atualizarTela();
};

window.prepararEdicao = (id) => {
    const i = lancamentos.find(x => x.id === id);
    if (!i) return;
    idEdicao = id;
    document.getElementById("descricao").value = i.descricao;
    document.getElementById("valor").value = i.valor;
    document.getElementById("tipo").value = i.tipo;
    document.getElementById("tituloForm").innerText = "Editando...";
    window.scrollTo(0,0);
};

window.adicionarLancamento = function() {
    const desc = document.getElementById("descricao"), val = document.getElementById("valor"), tipo = document.getElementById("tipo"), catM = document.getElementById("categoriaManual"), rec = document.getElementById("recorrente");
    if (!desc.value || !val.value) return alert("Preencha os campos!");

    if (idEdicao) {
        const idx = lancamentos.findIndex(x => x.id === idEdicao);
        lancamentos[idx] = { ...lancamentos[idx], descricao: desc.value, valor: Number(val.value), tipo: tipo.value, categoria: descobrirCategoria(desc.value, catM.value, tipo.value), recorrente: rec.checked };
        idEdicao = null;
        document.getElementById("tituloForm").innerText = "Novo Lançamento";
    } else {
        lancamentos.push({ id: Date.now(), descricao: desc.value, valor: Number(val.value), tipo: tipo.value, categoria: descobrirCategoria(desc.value, catM.value, tipo.value), recorrente: rec.checked, data: new Date().toLocaleDateString("pt-BR") });
    }
    salvar(); atualizarTela();
    desc.value = ""; val.value = "";
};

function salvar() {
    localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
    if (window.salvarNoFirebase) window.salvarNoFirebase(lancamentos);
}

window.atualizarInterface = (d) => { lancamentos = d || []; atualizarTela(); };

window.excluirLancamento = (id) => { if (confirm("Excluir?")) { lancamentos = lancamentos.filter(x => x.id !== id); salvar(); atualizarTela(); } };
window.limparTudo = () => { if (confirm("Zerar?")) { lancamentos = []; salvar(); atualizarTela(); } };

// --- RENDER ---
function atualizarTela() {
    configurarFiltros();
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
    const busca = document.getElementById("inputBusca").value.toLowerCase();

    filtradosParaExportar = lancamentos.filter(i => {
        const [d, m, a] = i.data.split('/');
        return Number(m) == mesS && Number(a) == anoS && i.descricao.toLowerCase().includes(busca);
    });

    const alerta = document.getElementById("alertaRecorrencia");
    if (filtradosParaExportar.length === 0 && lancamentos.some(i => i.recorrente)) alerta.style.display = "block";
    else alerta.style.display = "none";

    const lista = document.getElementById("listaLancamentos"), resumo = document.getElementById("resumoCategorias");
    let ent = 0, sai = 0, cats = {};

    lista.innerHTML = ""; resumo.innerHTML = "";
    filtradosParaExportar.forEach(i => {
        if (i.tipo === "entrada") ent += i.valor;
        else { sai += i.valor; cats[i.categoria] = (cats[i.categoria] || 0) + i.valor; }
        
        lista.innerHTML = `
            <div class="item">
                <div class="item-topo"><strong>${i.recorrente ? '📌 ' : ''}${i.descricao}</strong> <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">${formatarMoeda(i.valor)}</span></div>
                <small>${i.data} • ${i.categoria}</small>
                <div class="item-acoes" style="display:flex; gap:5px; margin-top:10px;">
                    <button onclick="window.prepararEdicao(${i.id})" style="flex:1;">Editar</button>
                    <button onclick="window.excluirLancamento(${i.id})" style="flex:1; background:#444;">Excluir</button>
                </div>
            </div>` + lista.innerHTML;
    });

    document.getElementById("saldo").innerText = formatarMoeda(ent - sai);
    document.getElementById("totalEntradas").innerText = formatarMoeda(ent);
    document.getElementById("totalSaidas").innerText = formatarMoeda(sai);

    // Meta
    const metaVal = Number(document.getElementById("inputMeta").value) || 0;
    const prog = document.getElementById("progress-bar"), stat = document.getElementById("statusMeta");
    if (metaVal > 0) {
        const p = Math.min((sai / metaVal) * 100, 100);
        prog.style.width = p + "%";
        prog.style.backgroundColor = p > 90 ? "#ef4444" : "#22c55e";
        stat.innerText = `${p.toFixed(0)}% da meta atingida`;
    }

    // Barras de Categoria
    Object.entries(cats).forEach(([c, v]) => {
        resumo.innerHTML += `<div class="categoria-linha"><strong>${c}</strong> <span>${formatarMoeda(v)}</span></div>`;
    });

    desenharGraficos(filtradosParaExportar, cats);
}

function desenharGraficos(filtrados, cats) {
    const pCtx = document.getElementById('meuGrafico'), lCtx = document.getElementById('graficoLinha');
    if (!pCtx || !lCtx) return;
    if (chartPizza) chartPizza.destroy(); if (chartLinha) chartLinha.destroy();

    chartPizza = new Chart(pCtx, { type: 'doughnut', data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] }] }, options: { plugins: { legend: { labels: { color: '#fff' } } } } });

    const fluxo = {};
    filtrados.forEach(i => { const d = i.data.split('/')[0]; fluxo[d] = (fluxo[d] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor); });
    const dias = Object.keys(fluxo).sort((a,b) => a-b);
    chartLinha = new Chart(lCtx, { type: 'line', data: { labels: dias.map(d => `Dia ${d}`), datasets: [{ label: 'Fluxo', data: dias.map(d => fluxo[d]), borderColor: '#4ade80', fill: true, backgroundColor: 'rgba(74, 222, 128, 0.1)', tension: 0.4 }] }, options: { scales: { y: { ticks: { color: '#fff', callback: v => 'R$ '+v } }, x: { ticks: { color: '#fff' } } }, plugins: { legend: { labels: { color: '#fff' } } } } });
}

configurarFiltros();
atualizarTela();
window.atualizarTela = atualizarTela;