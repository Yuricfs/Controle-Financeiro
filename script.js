// Variáveis Globais (Declaradas apenas UMA vez)
let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let chartInstance = null;

const categoriasAutomaticas = {
  "Alimentação": ["ifood", "restaurante", "lanche", "pizza", "hamburguer", "açaí"],
  "Transporte": ["uber", "99", "taxi", "ônibus", "gasolina", "posto"],
  "Mercado": ["mercado", "supermercado", "atacadão", "assaí", "carrefour"],
  "Saúde": ["farmácia", "remédio", "consulta", "médico", "dentista"],
  "Lazer": ["cinema", "bar", "show", "festa", "praia"],
  "Casa": ["aluguel", "energia", "água", "internet", "condomínio"],
  "Assinaturas": ["netflix", "spotify", "prime", "icloud", "youtube"],
  "Renda": ["salário", "pix recebido", "freela", "venda", "comissão"]
};

// Formatação
const formatarMoeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Lógica de Categorias
function descobrirCategoria(desc, catM, tipo) {
  if (catM) return catM;
  if (tipo === "entrada") return "Renda";
  const texto = desc.toLowerCase();
  for (const cat in categoriasAutomaticas) {
    if (categoriasAutomaticas[cat].some(p => texto.includes(p))) return cat;
  }
  return "Outros";
}

// Persistência
function salvar() {
  localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
  if (typeof window.salvarNoFirebase === 'function') {
    window.salvarNoFirebase(lancamentos);
  }
}

// Ponte com Firebase
window.atualizarInterface = function(dados) {
  lancamentos = dados || [];
  atualizarTela();
};

// Funções do Usuário (Expostas para o HTML)
window.adicionarLancamento = function() {
  const desc = document.getElementById("descricao");
  const val = document.getElementById("valor");
  const tipo = document.getElementById("tipo");
  const catM = document.getElementById("categoriaManual");

  if (!desc.value || !val.value || val.value <= 0) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

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

window.excluirLancamento = function(id) {
  lancamentos = lancamentos.filter(i => i.id !== id);
  salvar();
  atualizarTela();
};

window.limparTudo = function() {
  if (confirm("Deseja apagar todos os dados?")) {
    lancamentos = [];
    salvar();
    atualizarTela();
  }
};

// O GRÁFICO
function atualizarGrafico(categorias) {
  const ctx = document.getElementById('meuGrafico');
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();

  const labels = Object.keys(categorias);
  const valores = Object.values(categorias);

  if (labels.length === 0) return;

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        backgroundColor: ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { color: '#fff' } }
      }
    }
  });
}

// Renderização da Tela
function atualizarTela() {
  const lista = document.getElementById("listaLancamentos");
  const resumo = document.getElementById("resumoCategorias");
  const elSaldo = document.getElementById("saldo");
  const elEnt = document.getElementById("totalEntradas");
  const elSai = document.getElementById("totalSaidas");

  if (!lista || !resumo) return;

  let ent = 0, sai = 0, cats = {};
  lista.innerHTML = "";

  lancamentos.forEach(item => {
    if (item.tipo === "entrada") ent += item.valor;
    else {
      sai += item.valor;
      cats[item.categoria] = (cats[item.categoria] || 0) + item.valor;
    }

    lista.innerHTML = `
      <div class="item">
        <div class="item-topo">
          <strong>${item.descricao}</strong>
          <strong class="${item.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}">
            ${item.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(item.valor)}
          </strong>
        </div>
        <small>${item.data} • ${item.categoria}</small>
        <button class="btn-excluir" onclick="window.excluirLancamento(${item.id})">Excluir</button>
      </div>` + lista.innerHTML;
  });

  if (elSaldo) elSaldo.innerText = formatarMoeda(ent - sai);
  if (elEnt) elEnt.innerText = formatarMoeda(ent);
  if (elSai) elSai.innerText = formatarMoeda(sai);

  resumo.innerHTML = "";
  Object.entries(cats).forEach(([c, v]) => {
    resumo.innerHTML += `<div class="categoria-linha"><strong>${c}</strong> <small>${formatarMoeda(v)}</small></div>`;
  });

  if (lancamentos.length === 0) {
    lista.innerHTML = "<p>Nenhum lançamento.</p>";
  }

  atualizarGrafico(cats);
}

// Inicialização
atualizarTela();