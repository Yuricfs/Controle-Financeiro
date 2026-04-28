let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let chartPizza = null, chartLinha = null, idEdicao = null;

const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataAgora = new Date();

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
        "Alimentação": ["ifood", "pizza", "burger", "lanche", "restaurante", "salgado"],
        "Transporte": ["uber", "99", "gasolina", "posto", "i30", "oficina"],
        "Mercado": ["mercado", "supermercado", "atacadão"],
        "Casa": ["aluguel", "energia", "internet", "água"]
    };
    const t = desc.toLowerCase();
    for (const c in catsAuto) {
        if (catsAuto[c].some(p => t.includes(p))) return c;
    }
    return "Outros";
}

window.salvarMeta = () => {
    const valor = document.getElementById("inputMeta").value;
    if (window.salvarMetaFirebase) window.salvarMetaFirebase(Number(valor));
    atualizarTela();
};

function salvar() {
    localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
    if (window.salvarNoFirebase) window.salvarNoFirebase(lancamentos);
}

window.atualizarInterface = (dados) => { lancamentos = dados || []; atualizarTela(); };

// --- FUNCIONALIDADE 3: RECORRÊNCIA INTELIGENTE ---
window.importarRecorrentes = function() {
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
    
    // Busca itens recorrentes de QUALQUER mês anterior
    const recorrentes = lancamentos.filter(i => i.recorrente === true);
    const unicos = [];
    const descricoes = new Set();

    recorrentes.forEach(item => {
        if (!descricoes.has(item.descricao)) {
            descricoes.add(item.descricao);
            unicos.push({
                ...item,
                id: Date.now() + Math.random(),
                data: `01/${mesS.padStart(2, '0')}/${anoS}`
            });
        }
    });

    lancamentos = [...lancamentos, ...unicos];
    salvar();
    atualizarTela();
};

window.prepararEdicao = function(id) {
    const item = lancamentos.find(i => i.id === id);
    if (!item) return;
    idEdicao = id;
    document.getElementById("descricao").value = item.descricao;
    document.getElementById("valor").value = item.valor;
    document.getElementById("tipo").value = item.tipo;
    document.getElementById("categoriaManual").value = item.categoria;
    document.getElementById("recorrente").checked = item.recorrente || false;
    document.getElementById("tituloForm").innerText = "Editando Lançamento";
    document.getElementById("btnSalvar").innerText = "Salvar Alterações";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.adicionarLancamento = function() {
    const desc = document.getElementById("descricao");
    const val = document.getElementById("valor");
    const tipo = document.getElementById("tipo");
    const catM = document.getElementById("categoriaManual");
    const rec = document.getElementById("recorrente");

    if (!desc.value || !val.value) return alert("Preencha os campos!");

    if (idEdicao) {
        const index = lancamentos.findIndex(i => i.id === idEdicao);
        lancamentos[index] = { ...lancamentos[index], descricao: desc.value.trim(), valor: Number(val.value), tipo: tipo.value, categoria: descobrirCategoria(desc.value, catM.value, tipo.value), recorrente: rec.checked };
        idEdicao = null;
        document.getElementById("tituloForm").innerText = "Nova movimentação";
        document.getElementById("btnSalvar").innerText = "Adicionar";
    } else {
        lancamentos.push({ id: Date.now(), descricao: desc.value.trim(), valor: Number(val.value), tipo: tipo.value, categoria: descobrirCategoria(desc.value, catM.value, tipo.value), recorrente: rec.checked, data: new Date().toLocaleDateString("pt-BR") });
    }

    salvar();
    atualizarTela();
    desc.value = ""; val.value = ""; rec.checked = false;
};

window.excluirLancamento = (id) => { if (confirm("Excluir?")) { lancamentos = lancamentos.filter(i => i.id !== id); salvar(); atualizarTela(); } };

window.limparTudo = () => { if (confirm("Zerar?")) { lancamentos = []; salvar(); atualizarTela(); } };

function atualizarTela() {
    configurarFiltros();
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
    const busca = document.getElementById("inputBusca").value.toLowerCase();

    const filtrados = lancamentos.filter(i => {
        const [d, m, a] = i.data.split('/');
        return Number(m) == mesS && Number(a) == anoS && (i.descricao.toLowerCase().includes(busca));
    });

    // Alerta de Recorrência
    const alerta = document.getElementById("alertaRecorrencia");
    if (filtrados.length === 0 && lancamentos.some(i => i.recorrente)) alerta.style.display = "block";
    else alerta.style.display = "none";

    const lista = document.getElementById("listaLancamentos");
    let ent = 0, sai = 0, cats = {};

    lista.innerHTML = "";
    filtrados.forEach(i => {
        if (i.tipo === "entrada") ent += i.valor;
        else { sai += i.valor; cats[i.categoria] = (cats[i.categoria] || 0) + i.valor; }
        lista.innerHTML = `
            <div class="item">
                <div class="item-topo">
                    <strong>${i.recorrente ? '📌 ' : ''}${i.descricao}</strong>
                    <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">${formatarMoeda(i.valor)}</span>
                </div>
                <div class="item-acoes">
                    <button class="btn-edit" onclick="window.prepararEdicao(${i.id})">Editar</button>
                    <button class="btn-excluir" onclick="window.excluirLancamento(${i.id})">Excluir</button>
                </div>
            </div>` + lista.innerHTML;
    });

    document.getElementById("saldo").innerText = formatarMoeda(ent - sai);
    document.getElementById("totalEntradas").innerText = formatarMoeda(ent);
    document.getElementById("totalSaidas").innerText = formatarMoeda(sai);

    // --- FUNCIONALIDADE 4: LÓGICA DA META ---
    const meta = Number(document.getElementById("inputMeta").value) || 0;
    const progresso = document.getElementById("progress-bar");
    const status = document.getElementById("statusMeta");
    
    if (meta > 0) {
        const perc = Math.min((sai / meta) * 100, 100);
        progresso.style.width = perc + "%";
        progresso.style.backgroundColor = perc > 100 ? "#ef4444" : perc > 80 ? "#f59e0b" : "#22c55e";
        status.innerText = `${perc.toFixed(1)}% da meta utilizada`;
    }

    desenharGraficos(filtrados, cats);
}

function desenharGraficos(filtrados, cats) {
    const pizzaCtx = document.getElementById('meuGrafico');
    const linhaCtx = document.getElementById('graficoLinha');
    if (chartPizza) chartPizza.destroy();
    if (chartLinha) chartLinha.destroy();

    chartPizza = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'] }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
    });

    const fluxo = {};
    filtrados.forEach(i => {
        const d = i.data.split('/')[0];
        fluxo[d] = (fluxo[d] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor);
    });
    const dias = Object.keys(fluxo).sort((a,b) => a-b);
    chartLinha = new Chart(linhaCtx, {
        type: 'line',
        data: { labels: dias.map(d => `Dia ${d}`), datasets: [{ label: 'Saldo', data: dias.map(d => fluxo[d]), borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.1)', fill: true, tension: 0.4 }] },
        options: { scales: { y: { ticks: { color: '#fff', callback: v => 'R$ '+v } }, x: { ticks: { color: '#fff' } } } }
    });
}

configurarFiltros();
atualizarTela();
window.atualizarTela = atualizarTela;