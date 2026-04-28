const App = {
    state: {
        lancamentos: JSON.parse(localStorage.getItem("lancamentos")) || [],
        filtrados: [],
        idEdicao: null,
        charts: { pizza: null, linha: null }
    },

    init() {
        this.configFilters();
        this.bindDB();
        this.updateUI();
    },

    configFilters() {
        const sMes = document.getElementById("filtroMes"), sAno = document.getElementById("filtroAno");
        if (sMes && sMes.options.length === 0) {
            const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            meses.forEach((m, i) => sMes.add(new Option(m, i + 1)));
            sMes.value = new Date().getMonth() + 1;
        }
        if (sAno && sAno.options.length === 0) {
            const anoAtual = new Date().getFullYear();
            for (let a = anoAtual - 1; a <= anoAtual + 1; a++) sAno.add(new Option(a, a));
            sAno.value = anoAtual;
        }
    },

    bindDB() {
        const check = setInterval(() => {
            if (window.DB) {
                window.DB.onDataChange(data => { this.state.lancamentos = data || []; this.updateUI(); });
                window.DB.onMetaChange(val => { if (val) document.getElementById("inputMeta").value = val; this.updateUI(); });
                clearInterval(check);
            }
        }, 500);
    },

    handleSave() {
        const d = document.getElementById("descricao"), v = document.getElementById("valor");
        const t = document.getElementById("tipo"), c = document.getElementById("categoriaManual"), r = document.getElementById("recorrente");
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
        d.value = ""; v.value = ""; r.checked = false;
        document.getElementById("btnSalvar").innerText = "Adicionar";
    },

    autoCategory(desc, tipo) {
        if (tipo === "entrada") return "Renda";
        const t = desc.toLowerCase();
        if (t.includes("ifood") || t.includes("salgado") || t.includes("comida")) return "Alimentação";
        if (t.includes("uber") || t.includes("posto") || t.includes("gasolina") || t.includes("i30")) return "Transporte";
        return "Outros";
    },

    handleMetaChange() {
        const val = document.getElementById("inputMeta").value;
        if (window.DB) window.DB.saveMeta(Number(val));
        this.updateUI();
    },

    prepareEdit(id) {
        const i = this.state.lancamentos.find(x => x.id === id);
        this.state.idEdicao = id;
        document.getElementById("descricao").value = i.descricao;
        document.getElementById("valor").value = i.valor;
        document.getElementById("btnSalvar").innerText = "Salvar Alterações";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    deleteItem(id) { if (confirm("Excluir?")) { this.state.lancamentos = this.state.lancamentos.filter(x => x.id !== id); this.persist(); } },
    clearAll() { if (confirm("Zerar dados?")) { this.state.lancamentos = []; this.persist(); } },

    persist() {
        localStorage.setItem("lancamentos", JSON.stringify(this.state.lancamentos));
        if (window.DB) window.DB.saveTransactions(this.state.lancamentos);
        this.updateUI();
    },

    updateUI() {
        const m = document.getElementById("filtroMes").value, a = document.getElementById("filtroAno").value;
        const b = document.getElementById("inputBusca").value.toLowerCase();
        this.state.filtrados = this.state.lancamentos.filter(i => {
            const [, mes, ano] = i.data.split('/');
            return Number(mes) == m && Number(ano) == a && i.descricao.toLowerCase().includes(b);
        });
        UI.render(this.state.filtrados, this.state.charts);
    },

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Extrato Financeiro", 14, 15);
        const rows = this.state.filtrados.map(i => [i.data, i.descricao, i.categoria, i.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})]);
        doc.autoTable({ head: [['Data', 'Item', 'Categoria', 'Valor']], body: rows, startY: 20 });
        doc.save("extrato.pdf");
    },

    exportExcel() {
        const ws = XLSX.utils.json_to_sheet(this.state.filtrados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados");
        XLSX.writeFile(wb, "financeiro.xlsx");
    }
};

const UI = {
    render(filtrados, charts) {
        let ent = 0, sai = 0, cats = {};
        const lista = document.getElementById("listaLancamentos"), resumo = document.getElementById("resumoCategorias");
        lista.innerHTML = ""; resumo.innerHTML = "";

        filtrados.forEach(i => {
            if (i.tipo === "entrada") ent += i.valor;
            else { sai += i.valor; cats[i.categoria] = (cats[i.categoria] || 0) + i.valor; }

            lista.innerHTML = `
                <div class="item">
                    <div class="item-topo"><strong>${i.descricao}</strong> <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">${i.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span></div>
                    <small style="color:#aaa">${i.data} • ${i.categoria}</small>
                    <div class="item-acoes" style="display:flex; gap:8px; margin-top:10px;">
                        <button onclick="App.prepareEdit(${i.id})" style="flex:1;">Editar</button>
                        <button onclick="App.deleteItem(${i.id})" style="flex:1; background:#444;">Excluir</button>
                    </div>
                </div>` + lista.innerHTML;
        });

        document.getElementById("saldo").innerText = (ent - sai).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalEntradas").innerText = ent.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalSaidas").innerText = sai.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

        // Meta
        const meta = Number(document.getElementById("inputMeta").value) || 0;
        const bar = document.getElementById("progress-bar"), stat = document.getElementById("statusMeta");
        if (meta > 0) {
            const p = Math.min((sai / meta) * 100, 100);
            bar.style.width = p + "%";
            bar.style.backgroundColor = p > 90 ? "#ef4444" : "#22c55e";
            stat.innerText = `${p.toFixed(0)}% da meta`;
        }

        // Barras Neon
        Object.entries(cats).forEach(([c, v]) => {
            const perc = (v / Math.max(sai, 1)) * 100;
            resumo.innerHTML += `
                <div class="categoria-linha" style="margin-bottom:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${c} (${perc.toFixed(0)}%)</strong> <span>${v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span></div>
                    <div style="background:#334155; height:8px; border-radius:10px;"><div style="background:#00d4ff; width:${perc}%; height:100%; border-radius:10px; box-shadow:0 0 10px #00d4ff"></div></div>
                </div>`;
        });

        this.renderCharts(filtrados, cats, charts);
    },

    renderCharts(filtrados, cats, charts) {
        const pCtx = document.getElementById('meuGrafico'), lCtx = document.getElementById('graficoLinha');
        if (charts.pizza) charts.pizza.destroy();
        if (charts.linha) charts.linha.destroy();

        charts.pizza = new Chart(pCtx, { 
            type: 'doughnut', 
            data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#00d4ff','#ef4444','#10b981','#f59e0b','#8b5cf6'], borderWidth:0 }] },
            options: { plugins: { legend: { position:'bottom', labels: { color:'#fff' } } } }
        });

        const fluxo = {};
        filtrados.forEach(i => { const d = i.data.split('/')[0]; fluxo[d] = (fluxo[d] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor); });
        const dias = Object.keys(fluxo).sort((a,b) => a-b);
        charts.linha = new Chart(lCtx, {
            type:'line',
            data: { labels: dias.map(d => `Dia ${d}`), datasets: [{ label:'Fluxo Diário', data: dias.map(d => fluxo[d]), borderColor:'#4ade80', backgroundColor:'rgba(74, 122, 128, 0.2)', fill:true, tension:0.4, pointRadius: 5, pointBackgroundColor: '#4ade80' }] },
            options: { 
                maintainAspectRatio: false,
                scales: { 
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff', callback: v => 'R$ '+v } }, 
                    x: { ticks: { color: '#fff' } } 
                }, 
                plugins: { legend: { labels: { color: '#fff' } } } 
            }
        });
    }
};

window.App = App;
App.init();