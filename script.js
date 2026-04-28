// 1. Iniciamos a lista
let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];

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

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function descobrirCategoria(descricao, categoriaManual, tipo) {
  if (categoriaManual) return categoriaManual;
  if (tipo === "entrada") return "Renda";
  const texto = descricao.toLowerCase();
  for (const categoria in categoriasAutomaticas) {
    if (categoriasAutomaticas[categoria].some(palavra => texto.includes(palavra))) return categoria;
  }
  return "Outros";
}

function salvar() {
  localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
  if (typeof window.salvarNoFirebase === 'function') {
    window.salvarNoFirebase(lancamentos);
  }
}

window.atualizarInterface = function(dadosVindosDoBanco) {
  lancamentos = dadosVindosDoBanco || [];
  atualizarTela();
};

function adicionarLancamento() {
  const descricao = document.getElementById("descricao").value.trim();
  const valor = Number(document.getElementById("valor").value);
  const tipo = document.getElementById("tipo").value;
  const categoriaManual = document.getElementById("categoriaManual").value;

  if (!descricao || !valor || valor <= 0) {
    alert("Preencha a descrição e um valor válido.");
    return;
  }

  const lancamento = {
    id: Date.now(),
    descricao,
    valor,
    tipo,
    categoria: descobrirCategoria(descricao, categoriaManual, tipo),
    data: new Date().toLocaleDateString("pt-BR")
  };

  lancamentos.push(lancamento);
  salvar();
  atualizarTela();

  document.getElementById("descricao").value = "";
  document.getElementById("valor").value = "";
}

window.adicionarLancamento = adicionarLancamento;
window.excluirLancamento = function(id) {
  lancamentos = lancamentos.filter(item => item.id !== id);
  salvar();
  atualizarTela();
};
window.limparTudo = function() {
  if (confirm("Tem certeza que deseja apagar tudo?")) {
    lancamentos = [];
    salvar();
    atualizarTela();
  }
};

let chartInstance = null; 

function atualizarGrafico(categorias) {
  const ctx = document.getElementById('meuGrafico').getContext('2d');
  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = Object.keys(categorias);
  const valores = Object.values(categorias);

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
        legend: {
          position: 'bottom',
          labels: { color: '#fff' }
        }
      }
    }
  });
}

function atualizarTela() {
  const lista = document.getElementById("listaLancamentos");
  const resumo = document.getElementById("resumoCategorias");
  let totalEntradas = 0, totalSaidas = 0, categorias = {};

  lista.innerHTML = "";
  resumo.innerHTML = "";

  lancamentos.forEach(item => {
    if (item.tipo === "entrada") {
      totalEntradas += item.valor;
    } else {
      totalSaidas += item.valor;
      categorias[item.categoria] = (categorias[item.categoria] || 0) + item.valor;
    }

    const sinal = item.tipo === "entrada" ? "+" : "-";
    const classeValor = item.tipo === "entrada" ? "valor-entrada" : "valor-saida";

    lista.innerHTML = `
      <div class="item">
        <div class="item-topo">
          <strong>${item.descricao}</strong>
          <strong class="${classeValor}">${sinal} ${formatarMoeda(item.valor)}</strong>
        </div>
        <small>${item.data} • ${item.categoria}</small>
        <button class="btn-excluir" onclick="window.excluirLancamento(${item.id})">Excluir</button>
      </div>` + lista.innerHTML;
  });

  document.getElementById("saldo").innerText = formatarMoeda(totalEntradas - totalSaidas);
  document.getElementById("totalEntradas").innerText = formatarMoeda(totalEntradas);
  document.getElementById("totalSaidas").innerText = formatarMoeda(totalSaidas);

  const maiorCategoria = Math.max(...Object.values(categorias), 1);
  Object.entries(categorias).forEach(([categoria, valor]) => {
    const porcentagem = (valor / maiorCategoria) * 100;
    resumo.innerHTML += `
      <div class="categoria-linha">
        <strong>${categoria}</strong> <small>${formatarMoeda(valor)}</small>
        <div class="barra"><div style="width:${porcentagem}%"></div></div>
      </div>`;
  });

  if (lancamentos.length === 0) {
    lista.innerHTML = "<p>Nenhum lançamento ainda.</p>";
    resumo.innerHTML = "<p>Sem gastos cadastrados.</p>";
  }

  // CHAMADA DO GRÁFICO:
  atualizarGrafico(categorias);
}

// Inicializa a tela na primeira vez
atualizarTela();