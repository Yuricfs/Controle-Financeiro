const App = {
    state: {
        user: null,
        isRegistering: false,
        lancamentos: [],
        filtrados: [],
        idEdicao: null,
        charts: { pizza: null, linha: null }
    },

    init() { this.configFilters(); },

    toggleAuthMode() {
        this.state.isRegistering = !this.state.isRegistering;
        const isReg = this.state.isRegistering;
        document.getElementById("auth-title").innerText = isReg ? "Criar Conta" : "Bem-vindo";
        document.getElementById("group-nome").style.display = isReg ? "block" : "none";
        document.getElementById("btn-entrar").innerText = isReg ? "Cadastrar" : "Entrar";
        document.getElementById("toggle-auth-text").innerHTML = isReg ? 
            'Já tem conta? <a href="#" onclick="App.toggleAuthMode()">Login</a>' :
            'Não tem conta? <a href="#" onclick="App.toggleAuthMode()">Cadastre-se</a>';
        document.getElementById("login-error-msg").style.display = "none";
    },

    async handleAuthAction() {
        const e = document.getElementById("email-login").value.trim();
        const p = document.getElementById("pass-login").value;
        const nome = document.getElementById("nome-cadastro").value.trim();
        const errorDiv = document.getElementById("login-error-msg");
        const btn = document.getElementById("btn-entrar");

        if(!e || !p || (this.state.isRegistering && !nome)) {
            errorDiv.innerText = "Preencha todos os campos!";
            errorDiv.style.display = "block";
            return;
        }

        try {
            btn.innerText = "Aguarde...";
            btn.disabled = true;
            errorDiv.style.display = "none";
            
            if (this.state.isRegistering) {
                const credential = await window.AuthActions.register(e, p);
                await window.FB.savePerfil(credential.user.uid, nome);
            } else {
                await window.AuthActions.login(e, p);
            }
        } catch (error) {
            let msg = "Erro na autenticação.";
            if (error.code === 'auth/wrong-password') msg = "Senha incorreta!";
            if (error.code === 'auth/too-many-requests') msg = "Muitas tentativas. Aguarde 5 min.";
            errorDiv.innerText = msg;
            errorDiv.style.display = "block";
            btn.innerText = this.state.isRegistering ? "Cadastrar" : "Entrar";
            btn.disabled = false;
        }
    },

    togglePasswordVisibility() {
        const passInput = document.getElementById("pass-login");
        const eyeIcon = document.getElementById("togglePassword");
        if (passInput.type === "password") {
            passInput.type = "text";
            eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
        } else {
            passInput.type = "password";
            eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
        }
    },

    setUser(user) {
        this.state.user = user;
        if (window.FB) {
            window.FB.listen(user.uid, 
                (data) => { this.state.lancamentos = data || []; this.updateUI(); },
                (meta) => { if(meta !== null) document.getElementById("inputMeta").value = meta; this.updateUI(); }
            );
        }
    },

    configFilters() {
        const sMes = document.getElementById("filtroMes"), sAno = document.getElementById("filtroAno");
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        meses.forEach((m, i) => sMes.add(new Option(m, i + 1)));
        sMes.value = new Date().getMonth() + 1;
        const anoAtual = new Date().getFullYear();
        for (let a = anoAtual - 1; a <= anoAtual + 1; a++) sAno.add(new Option(a, a));
        sAno.value = anoAtual;
    },

    handleSave() {
        const d = document.getElementById("descricao"), v = document.getElementById("valor"), t = document.getElementById("tipo"), c = document.getElementById("categoriaManual"), r = document.getElementById("recorrente");
        if (!d.value || !v.value) return;
        const novo = { id: Date.now(), descricao: d.value.trim(), valor: Number(v.value), tipo: t.value, categoria: c.value || this.autoCategory(d.value, t.value), recorrente: r.checked, data: new Date().toLocaleDateString("pt-BR") };
        this.state.lancamentos.push(novo);
        this.persist();
        d.value = ""; v.value = ""; r.checked = false;
    },

    autoCategory(desc, tipo) {
        if (tipo === "entrada") return "Renda";
        const t = desc.toLowerCase();
        if (t.includes("ifood") || t.includes("comida")) return "Alimentação";
        if (t.includes("i30") || t.includes("uber") || t.includes("gasolina")) return "Transporte";
        return "Outros";
    },

    handleMetaChange() {
        const val = document.getElementById("inputMeta").value;
        if (this.state.user) window.FB.saveMeta(this.state.user.uid, Number(val));
    },

    handleGoogleAuth() { window.AuthActions.google(); },
    handleLogout() { window.AuthActions.logout(); },
    persist() { if (this.state.user) window.FB.save(this.state.user.uid, this.state.lancamentos); this.updateUI(); },

    updateUI() {
        const m = document.getElementById("filtroMes").value, a = document.getElementById("filtroAno").value, b = document.getElementById("inputBusca").value.toLowerCase();
        this.state.filtrados = this.state.lancamentos.filter(i => { 
            const [, mes, ano] = i.data.split('/'); 
            return Number(mes) == m && Number(ano) == a && i.descricao.toLowerCase().includes(b); 
        });
        UI.render(this.state.filtrados, this.state.charts);
    },

    exportPDF() {
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        const rows = this.state.filtrados.map(i => [i.data, i.descricao, i.categoria, i.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})]);
        doc.text("Extrato", 14, 15); doc.autoTable({ head: [['Data', 'Item', 'Categoria', 'Valor']], body: rows, startY: 20 });
        doc.save("financeiro.pdf");
    },

    exportExcel() {
        const ws = XLSX.utils.json_to_sheet(this.state.filtrados); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados"); XLSX.writeFile(wb, "financeiro.xlsx");
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
                    <div class="item-info">
                        <strong>${i.descricao}</strong>
                        <small>${i.data} • ${i.categoria}</small>
                    </div>
                    <div class="item-amount">
                        <span class="${i.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">
                            ${i.tipo === 'entrada' ? '+' : '-'}${i.valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                        </span>
                    </div>
                </div>` + lista.innerHTML;
        });

        document.getElementById("saldo").innerText = (ent-sai).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalEntradas").innerText = ent.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById("totalSaidas").innerText = sai.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

        const meta = Number(document.getElementById("inputMeta").value) || 0;
        const bar = document.getElementById("progress-bar"), stat = document.getElementById("statusMeta");
        if (meta > 0) { 
            const p = Math.min((sai/meta)*100, 100); 
            bar.style.width = p+"%"; 
            stat.innerText = `${p.toFixed(1)}% da meta atingida`;
        }
        
        Object.entries(cats).forEach(([c, v]) => {
            const perc = (v / Math.max(sai, 1)) * 100;
            resumo.innerHTML += `
                <div class="categoria-linha">
                    <div style="display:flex; justify-content:space-between; font-size: 13px;">
                        <span>${c}</span> <span>${v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                    </div>
                    <div class="resumo-barra-bg"><div class="resumo-barra-fill" style="width:${perc}%"></div></div>
                </div>`;
        });
        this.renderCharts(filtrados, cats, charts);
    },

    renderCharts(filtrados, cats, charts) {
        const pCtx = document.getElementById('meuGrafico'), lCtx = document.getElementById('graficoLinha');
        if (charts.pizza) charts.pizza.destroy(); if (charts.linha) charts.linha.destroy();
        
        charts.pizza = new Chart(pCtx, { 
            type:'doughnut', 
            data: { labels:Object.keys(cats), datasets:[{data:Object.values(cats), backgroundColor:['#2563eb','#4ade80','#f87171','#f59e0b','#8b5cf6'], borderWidth:0}] },
            options: { plugins: { legend: { position:'bottom', labels: { color: '#94a3b8', font: { size: 10 } } } } }
        });

        const fluxo = {}; filtrados.forEach(i => { const d = i.data.split('/')[0]; fluxo[d] = (fluxo[d] || 0) + (i.tipo === 'entrada' ? i.valor : -i.valor); });
        const dias = Object.keys(fluxo).sort((a,b) => Number(a)-Number(b));
        
        charts.linha = new Chart(lCtx, { 
            type:'line', 
            data: { labels:dias.map(d=>`Dia ${d}`), datasets:[{label:'Fluxo', data:dias.map(d=>fluxo[d]), borderColor:'#2563eb', backgroundColor:'rgba(37, 99, 235, 0.1)', fill:true, tension:0.4, pointRadius: 4}] },
            options: { scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }
        });
    }
};

window.App = App;
App.init();