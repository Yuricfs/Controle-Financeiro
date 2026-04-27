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
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function descobrirCategoria(descricao, categoriaManual, tipo) {
  if (categoriaManual) return categoriaManual;

  if (tipo === "entrada") return "Renda";

  const texto = descricao.toLowerCase();

  for (const categoria in categoriasAutomaticas) {
    const palavras = categoriasAutomaticas[categoria];

    if (palavras.some(palavra => texto.includes(palavra))) {
      return categoria;
    }
  }

  return "Outros";
}

function salvar() {
  localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
}

function adicionarLancamento() {
  const descricao = document.getElementById("descricao").value.trim();
  const valor = Number(document.getElementById("valor").value);
  const tipo = document.getElementById("tipo").value;
  const categoriaManual = document.getElementById("categoriaManual").value;

  if (!descricao || !valor || valor <= 0) {
    alert("Preencha a descrição e um valor válido.");
    return;
  }

  const categoria = descobrirCategoria(descricao, categoriaManual, tipo);

  const lancamento = {
    id: Date.now(),
    descricao,
    valor,
    tipo,
    categoria,
    data: new Date().toLocaleDateString("pt-BR")
  };

  lancamentos.push(lancamento);

  salvar();
  atualizarTela();

  document.getElementById("descricao").value = "";
  document.getElementById("valor").value = "";
  document.getElementById("categoriaManual").value = "";
  document.getElementById("tipo").value = "saida";
}

function excluirLancamento(id) {
  lancamentos = lancamentos.filter(item => item.id !== id);
  salvar();
  atualizarTela();
}

function limparTudo() {
  const confirmar = confirm("Tem certeza que deseja apagar tudo?");

  if (!confirmar) return;

  lancamentos = [];
  salvar();
  atualizarTela();
}

function atualizarTela() {
  const lista = document.getElementById("listaLancamentos");
  const resumo = document.getElementById("resumoCategorias");

  let totalEntradas = 0;
  let totalSaidas = 0;
  let categorias = {};

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
          <strong class="${classeValor}">
            ${sinal} ${formatarMoeda(item.valor)}
          </strong>
        </div>

        <small>${item.data} • ${item.categoria}</small>

        <button class="btn-excluir" onclick="excluirLancamento(${item.id})">
          Excluir
        </button>
      </div>
    ` + lista.innerHTML;
  });

  const saldo = totalEntradas - totalSaidas;

  document.getElementById("saldo").innerText = formatarMoeda(saldo);
  document.getElementById("totalEntradas").innerText = formatarMoeda(totalEntradas);
  document.getElementById("totalSaidas").innerText = formatarMoeda(totalSaidas);

  const maiorCategoria = Math.max(...Object.values(categorias), 1);

  Object.entries(categorias).forEach(([categoria, valor]) => {
    const porcentagem = (valor / maiorCategoria) * 100;

    resumo.innerHTML += `
      <div class="categoria-linha">
        <strong>${categoria}</strong>
        <small>${formatarMoeda(valor)}</small>
        <div class="barra">
          <div style="width:${porcentagem}%"></div>
        </div>
      </div>
    `;
  });

  if (lancamentos.length === 0) {
    lista.innerHTML = "<p>Nenhum lançamento ainda.</p>";
    resumo.innerHTML = "<p>Sem gastos cadastrados.</p>";
  }
}

atualizarTela();