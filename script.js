let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let chartPizza = null;
let chartLinha = null;
let idEdicao = null; // Variável de controle para Edição

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
        "Lazer": ["cinema", "bar", "praia", "show"],
        "Casa": ["aluguel", "energia", "internet", "água"]
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

window.atualizarInterface = (dados) => { lancamentos = dados || []; atualizarTela(); };

// FUNÇÃO 2: PREPARAR EDIÇÃO (Preenche o formulário)
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
    
    // Adiciona botão cancelar
    if (!document.getElementById("btnCancelar")) {
        const btnC = document.createElement("button");
        btnC.id = "btnCancelar";
        btnC.innerText = "Cancelar";
        btnC.style.backgroundColor = "#666";
        btnC.onclick = cancelarEdicao;
        document.getElementById("botoesAcao").appendChild(btnC);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function cancelarEdicao() {
    idEdicao = null;
    document.getElementById("descricao").value = "";
    document.getElementById("valor").value = "";
    document.getElementById("tituloForm").innerText = "Nova movimentação";
    document.getElementById("btnSalvar").innerText = "Adicionar";
    const btnC = document.getElementById("btnCancelar");
    if (btnC) btnC.remove();
}

window.adicionarLancamento = function() {
    const desc = document.getElementById("descricao");
    const val = document.getElementById("valor");
    const tipo = document.getElementById("tipo");
    const catM = document.getElementById("categoriaManual");
    const rec = document.getElementById("recorrente");

    if (!desc.value || !val.value) return alert("Preencha os campos!");

    if (idEdicao) {
        // Lógica de Atualização (Update)
        const index = lancamentos.findIndex(i => i.id === idEdicao);
        lancamentos[index] = {
            ...lancamentos[index],
            descricao: desc.value.trim(),
            valor: Number(val.value),
            tipo: tipo.value,
            categoria: descobrirCategoria(desc.value, catM.value, tipo.value),
            recorrente: rec.checked
        };
        cancelarEdicao();
    } else {
        // Lógica de Inserção (Create)
        lancamentos.push({
            id: Date.now(),
            descricao: desc.value.trim(),
            valor: Number(val.value),
            tipo: tipo.value,
            categoria: descobrirCategoria(desc.value, catM.value, tipo.value),
            recorrente: rec.checked,
            data: new Date().toLocaleDateString("pt-BR")
        });
    }

    salvar();
    atualizarTela();
    desc.value = ""; val.value = ""; rec.checked = false;
};

window.excluirLancamento = (id) => {
    if (confirm("Excluir este lançamento?")) {
        lancamentos = lancamentos.filter(i => i.id !== id);
        salvar();
        atualizarTela();
    }
};

window.limparTudo = () => {
    if (confirm("Apagar tudo?")) { lancamentos = []; salvar(); atualizarTela(); }
};

// GRÁFICOS (Mantidos e Ajustados)
function desenharGraficos(filtrados, cats) {
    const pizzaCtx = document.getElementById('meuGrafico');
    const linhaCtx = document.getElementById('graficoLinha');
    if (chartPizza) chartPizza.destroy();
    if (chartLinha) chartLinha.destroy();

    chartPizza = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'] }]
        },
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
        data: {
            labels: dias.map(d => `Dia ${d}`),
            datasets: [{
                label: 'Fluxo',
                data: dias.map(d => fluxo[d]),
                borderColor: '#4ade80',
                fill: true,
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                tension: 0.4
            }]
        },
        options: { scales: { y: { ticks: { color: '#fff', callback: v => 'R$ '+v } }, x: { ticks: { color: '#fff' } } } }
    });
}

function atualizarTela() {
    configurarFiltros();
    const mesS = document.getElementById("filtroMes").value;
    const anoS = document.getElementById("filtroAno").value;
    const busca = document.getElementById("inputBusca").value.toLowerCase();

    // Filtro Combinado: Data + Busca (Funcionalidade 2)
    const filtrados = lancamentos.filter(i => {
        const [d, m, a] = i.data.split('/');
        const pertenceAoMes = Number(m) == mesS && Number(a) == anoS;
        const coincideBusca = i.descricao.toLowerCase().includes(busca) || i.categoria.toLowerCase().includes(busca);
        return pertenceAoMes && coincideBusca;
    });

    const lista = document.getElementById("listaLancamentos");
    let ent = 0, sai = 0, cats = {};

    lista.innerHTML = "";
    filtrados.forEach(i => {
        if (i.tipo === "entrada") ent += i.valor;
        else {
            sai += i.valor;
            cats[i.categoria] = (cats[i.categoria] || 0) + i.valor;
        }

        lista.innerHTML = `
            <div class="item ${i.recorrente ? 'item-recorrente' : ''}">
                <div class="item-topo">
                    <strong>${i.recorrente ? '📌 ' : ''}${i.descricao}</strong>
                    <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">
                        ${formatarMoeda(i.valor)}
                    </span>
                </div>
                <small>${i.data} • ${i.categoria}</small>
                <div class="item-acoes">
                    <button class="btn-edit" onclick="window.prepararEdicao(${i.id})">Editar</button>
                    <button class="btn-excluir" onclick="window.excluirLancamento(${i.id})">Excluir</button>
                </div>
            </div>` + lista.innerHTML;
    });

    document.getElementById("saldo").innerText = formatarMoeda(ent - sai);
    document.getElementById("totalEntradas").innerText = formatarMoeda(ent);
    document.getElementById("totalSaidas").innerText = formatarMoeda(sai);

    desenharGraficos(filtrados, cats);
}

configurarFiltros();
atualizarTela();
window.atualizarTela = atualizarTela;