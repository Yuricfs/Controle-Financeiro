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
        "Alimentação": ["ifood", "pizza", "burger", "lanche", "restaurante", "salgado", "comida"],
        "Transporte": ["uber", "99", "gasolina", "posto", "i30", "oficina", "mecanico"],
        "Mercado": ["mercado", "supermercado", "atacadão"],
        "Assinaturas": ["netflix", "spotify", "prime", "youtube"],
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
    if (typeof window.salvarNoFirebase === 'function') window.salvarNoFirebase(lancamentos);
}

window.atualizarInterface = (dados) => { lancamentos = dados || []; atualizarTela(); };

// RECORRÊNCIA
window.importarRecorrentes = function() {
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
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

// CRUD
window.prepararEdicao = function(id) {
    const item = lancamentos.find(i => i.id === id);
    if (!item) return;
    idEdicao = id;
    document.getElementById("descricao").value = item.descricao;
    document.getElementById("valor").value = item.valor;
    document.getElementById("tipo").value = item.tipo;
    document.getElementById("categoriaManual").value = item.categoria;
    document.getElementById("recorrente").checked = item.recorrente || false;
    document.getElementById("tituloForm").innerText = "Editar Lançamento";
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

window.excluirLancamento = (id) => { if (confirm("Deseja mesmo excluir?")) { lancamentos = lancamentos.filter(i => i.id !== id); salvar(); atualizarTela(); } };

window.limparTudo = () => { if (confirm("Zerar todo o sistema?")) { lancamentos = []; salvar(); atualizarTela(); } };

// GRÁFICOS MELHORADOS
function desenharGraficos(filtrados, cats) {
    const pizzaCtx = document.getElementById('meuGrafico');
    const linhaCtx = document.getElementById('graficoLinha');
    if (chartPizza) chartPizza.destroy();
    if (chartLinha) chartLinha.destroy();

    chartPizza = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
                borderWidth: 2,
                borderColor: '#1e293b'
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#ffffff', font: { size: 12 } } } } }
    });

    const fluxoDiario = {};
    filtrados.forEach(i => {
        const dia = i.data.split('/')[0];
        fluxoDiario[dia] = (fluxoDiario[dia] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor);
    });
    const diasSorted = Object.keys(fluxoDiario).sort((a,b) => a-b);
    
    chartLinha = new Chart(linhaCtx, {
        type: 'line',
        data: {
            labels: diasSorted.map(d => `Dia ${d}`),
            datasets: [{
                label: 'Fluxo (R$)',
                data: diasSorted.map(d => fluxoDiario[d]),
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#4ade80'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#ffffff', font: { weight: 'bold' }, callback: v => 'R$ '+v } },
                x: { ticks: { color: '#ffffff', font: { weight: 'bold' } } }
            },
            plugins: { legend: { labels: { color: '#ffffff' } } }
        }
    });
}

function atualizarTela() {
    configurarFiltros();
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
    const busca = document.getElementById("inputBusca").value.toLowerCase();

    const filtrados = lancamentos.filter(i => {
        const [d, m, a] = i.data.split('/');
        return Number(m) == mesS && Number(a) == anoS && (i.descricao.toLowerCase().includes(busca) || i.categoria.toLowerCase().includes(busca));
    });

    const alerta = document.getElementById("alertaRecorrencia");
    if (filtrados.length === 0 && lancamentos.some(i => i.recorrente)) alerta.style.display = "block";
    else alerta.style.display = "none";

    const lista = document.getElementById("listaLancamentos");
    const resumo = document.getElementById("resumoCategorias");
    let ent = 0, sai = 0, cats = {};

    lista.innerHTML = "";
    resumo.innerHTML = ""; // Limpa o resumo de barras

    filtrados.forEach(i => {
        if (i.tipo === "entrada") ent += i.valor;
        else {
            sai += i.valor;
            cats[i.categoria] = (cats[i.categoria] || 0) + i.valor;
        }

        // EXTRATO COM DATA E CATEGORIA VOLTANDO
        lista.innerHTML = `
            <div class="item">
                <div class="item-topo">
                    <strong>${i.recorrente ? '📌 ' : ''}${i.descricao}</strong>
                    <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">
                        ${formatarMoeda(i.valor)}
                    </span>
                </div>
                <small style="display: block; margin-bottom: 10px; color: #aaa;">${i.data} • ${i.categoria}</small>
                <div class="item-acoes" style="display: flex; gap: 8px;">
                    <button class="btn-edit" style="flex: 1; padding: 10px;" onclick="window.prepararEdicao(${i.id})">Editar</button>
                    <button class="btn-excluir" style="flex: 1; padding: 10px;" onclick="window.excluirLancamento(${i.id})">Excluir</button>
                </div>
            </div>` + lista.innerHTML;
    });

    document.getElementById("saldo").innerText = formatarMoeda(ent - sai);
    document.getElementById("totalEntradas").innerText = formatarMoeda(ent);
    document.getElementById("totalSaidas").innerText = formatarMoeda(sai);

    // BARRINHAS DE RESUMO (O QUE TINHA SUMIDO)
    const maiorCat = Math.max(...Object.values(cats), 1);
    Object.entries(cats).forEach(([c, v]) => {
        const perc = (v / maiorCat) * 100;
        resumo.innerHTML += `
            <div class="categoria-linha" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>${c}</strong> <span>${formatarMoeda(v)}</span>
                </div>
                <div class="barra"><div style="width: ${perc}%; background: #3b82f6; height: 8px; border-radius: 4px;"></div></div>
            </div>`;
    });

    // LÓGICA DA META
    const meta = Number(document.getElementById("inputMeta").value) || 0;
    const progresso = document.getElementById("progress-bar");
    const status = document.getElementById("statusMeta");
    
    if (meta > 0) {
        const perc = Math.min((sai / meta) * 100, 100);
        progresso.style.width = perc + "%";
        progresso.style.backgroundColor = perc > 100 ? "#ef4444" : perc > 80 ? "#f59e0b" : "#22c55e";
        status.innerText = `${perc.toFixed(1)}% da meta utilizada`;
    } else {
        progresso.style.width = "0%";
        status.innerText = "Nenhuma meta definida.";
    }

    if (filtrados.length > 0) desenharGraficos(filtrados, cats);
}

configurarFiltros();
atualizarTela();
window.atualizarTela = atualizarTela;