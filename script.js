/**
 * APP MODULE: O "Cérebro" do sistema
 */
const App = {
    state: {
        lancamentos: JSON.parse(localStorage.getItem("lancamentos")) || [],
        filtrados: [],
        idEdicao: null,
        charts: { pizza: null, linha: null }
    },

    init() {
        this.configFilters();
        this.bindEvents();
        this.updateUI();
    },

    bindEvents() {
        // Vincula as chamadas do Firebase quando o DB estiver pronto
        const checkDB = setInterval(() => {
            if (window.DB) {
                window.DB.onDataChange(data => {
                    this.state.lancamentos = data || [];
                    this.updateUI();
                });
                window.DB.onMetaChange(val => {
                    if (val) document.getElementById("inputMeta").value = val;
                    this.updateUI();
                });
                clearInterval(checkDB);
            }
        }, 500);
    },

    // --- LÓGICA DE NEGÓCIO ---
    handleSave() {
        const d = document.getElementById("descricao"), v = document.getElementById("valor");
        const t = document.getElementById("tipo"), c = document.getElementById("categoriaManual");
        const r = document.getElementById("recorrente");

        if (!d.value || !v.value) return alert("Preencha os campos!");

        const novo = {
            id: this.state.idEdicao || Date.now(),
            descricao: d.value.trim(),
            valor: Number(v.value),
            tipo: t.value,
            categoria: c.value || this.autoCategory(d.value, t.value),
            recorrente: r.checked,
            data: this.state.idEdicao ? this.state.lancamentos.find(x => x.id === this.state.idEdicao).data : new Date().toLocaleDateString("pt-BR")
        };

        if (this.state.idEdicao) {
            const idx = this.state.lancamentos.findIndex(x => x.id === this.state.idEdicao);
            this.state.lancamentos[idx] = novo;
            this.state.idEdicao = null;
        } else {
            this.state.lancamentos.push(novo);
        }

        this.persist();
        this.resetForm();
    },

    autoCategory(desc, tipo) {
        if (tipo === "entrada") return "Renda";
        const map = { "Alimentação": ["ifood", "pizza", "burger"], "Transporte": ["uber", "posto", "i30"], "Casa": ["aluguel", "luz"] };
        const t = desc.toLowerCase();
        for (const cat in map) if (map[cat].some(p => t.includes(p))) return cat;
        return "Outros";
    },

    persist() {
        localStorage.setItem("lancamentos", JSON.stringify(this.state.lancamentos));
        if (window.DB) window.DB.saveTransactions(this.state.lancamentos);
        this.updateUI();
    },

    // --- INTERFACE (UI) ---
    updateUI() {
        this.filterData();
        UI.renderSummary(this.state.filtrados);
        UI.renderList(this.state.filtrados);
        UI.renderCharts(this.state.filtrados, this.state.charts);
    },

    filterData() {
        const m = document.getElementById("filtroMes").value;
        const a = document.getElementById("filtroAno").value;
        const b = document.getElementById("inputBusca").value.toLowerCase();

        this.state.filtrados = this.state.lancamentos.filter(i => {
            const [dia, mes, ano] = i.data.split('/');
            return Number(mes) == m && Number(ano) == a && i.descricao.toLowerCase().includes(b);
        });

        UI.toggleRecurrenceAlert(this.state.filtrados.length === 0 && this.state.lancamentos.some(i => i.recorrente));
    },

    // --- EXPORTAÇÃO ---
    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Relatório Financeiro", 14, 15);
        const rows = this.state.filtrados.map(i => [i.data, i.descricao, i.categoria, i.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})]);
        doc.autoTable({ head: [['Data', 'Item', 'Categoria', 'Valor']], body: rows, startY: 20 });
        doc.save("financeiro.pdf");
    }
};

/**
 * UI MODULE: Cuida apenas de "desenhar" as coisas
 */
const UI = {
    renderSummary(dados) {
        let ent = 0, sai = 0, cats = {};
        dados.forEach(i => {
            if (i.tipo === "entrada") ent += i.valor;
            else { sai += i.valor; cats[i.categoria] = (cats[i.categoria] || 0) + i.valor; }
        });

        document.getElementById("saldo").innerText = (ent - sai).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalEntradas").innerText = ent.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalSaidas").innerText = sai.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        this.updateProgressBar(sai);
        this.renderCategoryBars(cats, sai);
    },

    updateProgressBar(gastos) {
        const meta = Number(document.getElementById("inputMeta").value) || 0;
        const bar = document.getElementById("progress-bar");
        if (meta > 0) {
            const p = Math.min((gastos / meta) * 100, 100);
            bar.style.width = p + "%";
            bar.style.backgroundColor = p > 90 ? "#ef4444" : "#22c55e";
        }
    },

    renderList(dados) {
        const container = document.getElementById("listaLancamentos");
        container.innerHTML = dados.map(i => `
            <div class="item">
                <div class="item-topo"><strong>${i.recorrente ? '📌 ' : ''}${i.descricao}</strong> <span>R$ ${i.valor}</span></div>
                <small>${i.data} • ${i.categoria}</small>
                <div class="item-acoes">
                    <button onclick="App.prepareEdit(${i.id})">Editar</button>
                    <button onclick="App.deleteItem(${i.id})" style="background:#444">Excluir</button>
                </div>
            </div>
        `).join('');
    },

    renderCharts(dados, charts) {
        const pCtx = document.getElementById('meuGrafico'), lCtx = document.getElementById('graficoLinha');
        if (charts.pizza) charts.pizza.destroy();
        if (charts.linha) charts.linha.destroy();

        // Lógica simplificada de agrupamento
        const cats = {}; dados.forEach(i => { if(i.tipo==='saida') cats[i.categoria] = (cats[i.categoria] || 0) + i.valor });
        
        charts.pizza = new Chart(pCtx, { 
            type: 'doughnut', 
            data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#00d4ff','#ef4444','#10b981','#f59e0b'] }] },
            options: { plugins: { legend: { labels: { color: '#fff' } } } }
        });
    }
};

// --- FUNÇÕES GLOBAIS (Expostas para o HTML) ---
window.App = App;
App.init();
