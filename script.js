// Variáveis Globais (Declaradas APENAS uma vez)
let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let chartPizza = null;
let chartLinha = null;

const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataAgora = new Date();

// 1. Configura os seletores de Mes/Ano
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
        "Alimentação": ["ifood", "pizza", "burger", "lanche", "restaurante"],
        "Transporte": ["uber", "99", "gasolina", "posto", "i30"],
        "Mercado": ["mercado", "supermercado", "atacadão"],
        "Lazer": ["cinema", "bar", "praia", "show"]
    };
    const t = desc.toLowerCase();
    for (const c in catsAuto) {
        if (catsAuto[c].some(p => t.includes(p))) return c;
    }
    return "Outros";
}

function salvar() {
    localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
    if (typeof window.salvarNoFirebase === 'function') window.salvarNoFirebase(lancamentos);
}

window.atualizarInterface = (dados) => { 
    lancamentos = dados || []; 
    atualizarTela(); 
};

window.adicionarLancamento = function() {
    const desc = document.getElementById("descricao");
    const val = document.getElementById("valor");
    const tipo = document.getElementById("tipo");
    const catM = document.getElementById("categoriaManual");

    if (!desc.value || !val.value) return alert("Preencha os campos!");

    lancamentos.push({
        id: Date.now(),
        descricao: desc.value.trim(),
        valor: Number(val.value),
        tipo: tipo.value,
        categoria: descobrirCategoria(desc.value, catM.value, tipo.value),
        data: new Date().toLocaleDateString("pt-BR")
    });

    salvar();
    atualizarTela();
    desc.value = ""; val.value = "";
};

window.excluirLancamento = (id) => {
    lancamentos = lancamentos.filter(i => i.id !== id);
    salvar();
    atualizarTela();
};

window.limparTudo = () => {
    if (confirm("Apagar todos os dados?")) { lancamentos = []; salvar(); atualizarTela(); }
};

// --- GRÁFICOS TURBINADOS ---
function desenharGraficos(dadosFiltrados, categorias) {
    const pizzaCtx = document.getElementById('meuGrafico');
    const linhaCtx = document.getElementById('graficoLinha');

    if (chartPizza) chartPizza.destroy();
    if (chartLinha) chartLinha.destroy();

    // 1. Gráfico de Pizza
    chartPizza = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categorias),
            datasets: [{
                data: Object.values(categorias),
                backgroundColor: ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { color: '#ffffff' } } } }
    });

    // 2. Gráfico de Linha (Com escala clara e R$)
    const fluxoDiario = {};
    dadosFiltrados.forEach(i => {
        const dia = i.data.split('/')[0];
        fluxoDiario[dia] = (fluxoDiario[dia] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor);
    });

    const diasSorted = Object.keys(fluxoDiario).sort((a, b) => a - b);
    
    chartLinha = new Chart(linhaCtx, {
        type: 'line',
        data: {
            labels: diasSorted.map(d => `Dia ${d}`),
            datasets: [{
                label: 'Fluxo de Caixa',
                data: diasSorted.map(d => fluxoDiario[d]),
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
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
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { 
                        color: '#ffffff', 
                        font: { weight: 'bold' },
                        callback: (value) => 'R$ ' + value 
                    }
                },
                x: {
                    ticks: { color: '#ffffff', font: { weight: 'bold' } }
                }
            },
            plugins: { legend: { labels: { color: '#ffffff' } } }
        }
    });
}

function atualizarTela() {
    configurarFiltros();
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;

    const filtrados = lancamentos.filter(i => {
        const [d, m, a] = i.data.split('/');
        return Number(m) == mesS && Number(a) == anoS;
    });

    const lista = document.getElementById("listaLancamentos");
    const resumo = document.getElementById("resumoCategorias");
    let ent = 0, sai = 0, cats = {};

    lista.innerHTML = "";
    filtrados.forEach(i => {
        if (i.tipo === "entrada") ent += i.valor;
        else {
            sai += i.valor;
            cats[i.categoria] = (cats[i.categoria] || 0) + i.valor;
        }

        lista.innerHTML = `
            <div class="item">
                <div class="item-topo">
                    <strong>${i.descricao}</strong>
                    <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">
                        ${i.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(i.valor)}
                    </span>
                </div>
                <small>${i.data} • ${i.categoria}</small>
                <button class="btn-excluir" onclick="window.excluirLancamento(${i.id})">Excluir</button>
            </div>` + lista.innerHTML;
    });

    document.getElementById("saldo").innerText = formatarMoeda(ent - sai);
    document.getElementById("totalEntradas").innerText = formatarMoeda(ent);
    document.getElementById("totalSaidas").innerText = formatarMoeda(sai);

    resumo.innerHTML = "";
    Object.entries(cats).forEach(([c, v]) => {
        resumo.innerHTML += `<div class="categoria-linha"><strong>${c}</strong> <small>${formatarMoeda(v)}</small></div>`;
    });

    if (filtrados.length > 0) desenharGraficos(filtrados, cats);
}

// Inicialização
configurarFiltros();
atualizarTela();
window.atualizarTela = atualizarTela;