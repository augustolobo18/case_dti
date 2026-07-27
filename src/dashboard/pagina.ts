/**
 * Página do dashboard (E6-1/D18/D41): HTML, CSS e JS inline, sem nenhuma
 * requisição a host externo. `tsc` não copia `.html` — como módulo TS que
 * exporta o HTML como template string, compila junto e `npm start` serve o
 * dashboard igual ao `npm run dev` (D41).
 *
 * O JS faz `fetch` em `/mapa`, `/simulacao`, `/drones`,
 * `/entregas/rota?caminho=true` e `/pedidos`, desenha o mapa em SVG (grade
 * rotulada, base, zonas, rotas contornando as zonas via `caminho`, clientes
 * dos pedidos não entregues e um marcador próprio por drone) e liga os botões
 * de `POST /entregas/alocar` e `POST /simulacao/avancar`. Todo texto vindo da
 * API é injetado via `textContent`, nunca `innerHTML`.
 */
export function paginaDashboard(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DroneDelivery — Dashboard</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 24px;
    background: #f4f5f7;
    color: #1a1a2e;
  }
  h1 { font-size: 1.4rem; margin: 0 0 16px; }
  .painel {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .cartao {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .cartao .rotulo { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  .cartao .valor { font-size: 1.5rem; font-weight: 600; margin-top: 4px; }
  .controles { margin-bottom: 20px; display: flex; gap: 8px; align-items: center; }
  button {
    background: #2b59ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  button:hover { background: #1e46d6; }
  input[type="number"] {
    width: 90px;
    padding: 7px 8px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  #mapa-container {
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: inline-block;
  }
  #status { font-size: 0.85rem; color: #666; margin-left: 8px; }
  .bloco {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 20px;
  }
  .bloco h2 { font-size: 1rem; margin: 0 0 12px; }
  #form-pedido { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
  #form-pedido .campo { display: flex; flex-direction: column; gap: 4px; }
  #form-pedido label { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  select { padding: 7px 8px; border-radius: 6px; border: 1px solid #ccc; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
  th { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  .botao-cancelar {
    background: #e05555;
    padding: 4px 10px;
    font-size: 0.8rem;
  }
  .botao-cancelar:hover { background: #c23f3f; }
  svg { display: block; }
  .grade { stroke: #e2e2e2; stroke-width: 0.02; }
  .rotulo-eixo { font-size: 0.3px; fill: #999; }
  .zona { fill: #ffdada; stroke: #e05555; stroke-width: 0.05; }
  .rota { fill: none; stroke: #2b59ff; stroke-width: 0.08; opacity: 0.7; }
  .base { fill: #1a1a2e; }
  .cliente { fill: #e0a500; }
  .drone { fill: #00a3a3; stroke: #007373; stroke-width: 0.03; }
  #legenda {
    list-style: none;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin: 12px 0 0;
    padding: 0;
    font-size: 0.85rem;
  }
  #legenda li { display: flex; align-items: center; gap: 6px; }
  .amostra { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
  .amostra-base { background: #1a1a2e; border-radius: 50%; }
  .amostra-zona { background: #ffdada; border: 1px solid #e05555; }
  .amostra-cliente { background: #e0a500; border-radius: 50%; }
  .amostra-drone { background: #00a3a3; border: 1px solid #007373; }
</style>
</head>
<body>
<h1>DroneDelivery — Painel de operação</h1>

<section class="painel" id="metricas">
  <div class="cartao">
    <div class="rotulo">Entregas realizadas</div>
    <div class="valor" id="metrica-entregas">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Tempo médio por entrega (min)</div>
    <div class="valor" id="metrica-tempo-medio">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Makespan (min)</div>
    <div class="valor" id="metrica-makespan">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Drone mais eficiente</div>
    <div class="valor" id="metrica-drone-eficiente">—</div>
  </div>
</section>

<section class="controles">
  <button id="botao-alocar" type="button">Alocar pedidos</button>
  <label for="campo-minutos">Avançar relógio (min):</label>
  <input id="campo-minutos" type="number" min="0" step="1" value="10" />
  <button id="botao-avancar" type="button">Avançar relógio</button>
  <span id="status"></span>
</section>

<section class="bloco">
  <h2>Cadastrar pedido</h2>
  <form id="form-pedido">
    <div class="campo">
      <label for="campo-x">X (quadra)</label>
      <input id="campo-x" type="number" min="0" step="1" value="0" required />
    </div>
    <div class="campo">
      <label for="campo-y">Y (quadra)</label>
      <input id="campo-y" type="number" min="0" step="1" value="0" required />
    </div>
    <div class="campo">
      <label for="campo-peso">Peso (kg)</label>
      <input id="campo-peso" type="number" min="0.1" step="0.1" value="1" required />
    </div>
    <div class="campo">
      <label for="campo-prioridade">Prioridade</label>
      <select id="campo-prioridade">
        <option value="alta">Alta</option>
        <option value="media">Média</option>
        <option value="baixa" selected>Baixa</option>
      </select>
    </div>
    <button type="submit">Cadastrar pedido</button>
  </form>
</section>

<section class="bloco" id="lista-pedidos">
  <h2>Pedidos</h2>
  <table>
    <thead>
      <tr><th>Destino</th><th>Peso</th><th>Prioridade</th><th>Status</th><th></th></tr>
    </thead>
    <tbody></tbody>
  </table>
</section>

<section id="mapa-container">
  <svg id="mapa" xmlns="http://www.w3.org/2000/svg"></svg>
  <ul id="legenda">
    <li><span class="amostra amostra-base"></span> Base</li>
    <li><span class="amostra amostra-zona"></span> Zona de exclusão</li>
    <li><span class="amostra amostra-cliente"></span> Cliente</li>
    <li><span class="amostra amostra-drone"></span> Drone</li>
  </ul>
</section>

<script>
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ESCALA = 32;
  var MARGEM = 1;
  var STATUS_VISIVEIS = ["pendente", "alocado", "em_voo"];

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var chave in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, chave)) {
        node.setAttribute(chave, String(attrs[chave]));
      }
    }
    return node;
  }

  function definirTexto(id, texto) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = texto;
    }
  }

  function definirStatus(texto) {
    definirTexto("status", texto);
  }

  function buscarJson(url, opcoes) {
    return fetch(url, opcoes).then(function (resposta) {
      return resposta.json().then(function (corpo) {
        if (!resposta.ok) {
          var mensagem =
            corpo && corpo.erro && corpo.erro.mensagem
              ? corpo.erro.mensagem
              : "Erro ao consultar " + url;
          throw new Error(mensagem);
        }
        return corpo;
      });
    });
  }

  function atualizarMetricas(simulacao) {
    var metricas = simulacao.metricas || {};
    definirTexto("metrica-entregas", String(metricas.totalEntregas != null ? metricas.totalEntregas : 0));
    definirTexto(
      "metrica-tempo-medio",
      String(metricas.tempoMedioEntregaMin != null ? metricas.tempoMedioEntregaMin : 0),
    );
    definirTexto("metrica-makespan", String(metricas.makespanMin != null ? metricas.makespanMin : 0));
    definirTexto(
      "metrica-drone-eficiente",
      metricas.droneMaisEficiente ? String(metricas.droneMaisEficiente) : "—",
    );
  }

  function desenharGrade(svg, tamanho, px, py) {
    for (var i = 0; i <= tamanho; i += 1) {
      svg.appendChild(
        el("line", {
          class: "grade",
          x1: px(i),
          y1: py(0),
          x2: px(i),
          y2: py(tamanho),
        }),
      );
      svg.appendChild(
        el("line", {
          class: "grade",
          x1: px(0),
          y1: py(i),
          x2: px(tamanho),
          y2: py(i),
        }),
      );

      var rotuloX = el("text", {
        class: "rotulo-eixo",
        x: px(i),
        y: py(0) + 0.4,
        "text-anchor": "middle",
      });
      rotuloX.textContent = String(i);
      svg.appendChild(rotuloX);

      var rotuloY = el("text", {
        class: "rotulo-eixo",
        x: px(0) - 0.4,
        y: py(i),
        "text-anchor": "end",
      });
      rotuloY.textContent = String(i);
      svg.appendChild(rotuloY);
    }
  }

  function desenharClientes(svg, pedidos, px, py) {
    for (var i = 0; i < pedidos.length; i += 1) {
      var pedido = pedidos[i];
      if (STATUS_VISIVEIS.indexOf(pedido.status) === -1) {
        continue;
      }
      var destino = pedido.destino;
      svg.appendChild(
        el("circle", { class: "cliente", cx: px(destino.x), cy: py(destino.y), r: 0.2 }),
      );
    }
  }

  function desenharDrones(svg, drones, px, py) {
    for (var d = 0; d < drones.length; d += 1) {
      var posicao = drones[d].posicao;
      if (!posicao) {
        continue;
      }
      var cx = px(posicao.x);
      var cy = py(posicao.y);
      var r = 0.22;
      var pontos =
        cx + "," + (cy - r) + " " + (cx + r) + "," + (cy + r) + " " + (cx - r) + "," + (cy + r);
      svg.appendChild(el("polygon", { class: "drone", points: pontos }));
    }
  }

  function desenharMapa(mapaResposta, pedidos, drones, viagens) {
    var svg = document.getElementById("mapa");
    if (!svg) {
      return;
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    var tamanho = mapaResposta.cidadeTamanho || 0;
    var largura = (tamanho + MARGEM * 2) * ESCALA;
    svg.setAttribute("width", String(largura));
    svg.setAttribute("height", String(largura));
    svg.setAttribute("viewBox", "0 0 " + (tamanho + MARGEM * 2) + " " + (tamanho + MARGEM * 2));

    function px(x) {
      return x + MARGEM;
    }
    function py(y) {
      return tamanho - y + MARGEM;
    }

    var fundo = el("rect", {
      x: 0,
      y: 0,
      width: tamanho + MARGEM * 2,
      height: tamanho + MARGEM * 2,
      fill: "#fafafa",
      stroke: "#ddd",
      "stroke-width": 0.02,
    });
    svg.appendChild(fundo);

    desenharGrade(svg, tamanho, px, py);

    var zonas = mapaResposta.zonas || [];
    for (var i = 0; i < zonas.length; i += 1) {
      var zona = zonas[i];
      var x0 = Math.min(zona.de.x, zona.ate.x);
      var y0 = Math.min(zona.de.y, zona.ate.y);
      var x1 = Math.max(zona.de.x, zona.ate.x);
      var y1 = Math.max(zona.de.y, zona.ate.y);
      svg.appendChild(
        el("rect", {
          class: "zona",
          x: px(x0) - 0.5,
          y: py(y1) - 0.5,
          width: x1 - x0 + 1,
          height: y1 - y0 + 1,
        }),
      );
    }

    for (var v = 0; v < viagens.length; v += 1) {
      var viagem = viagens[v];
      var pernas = viagem.caminho || [];
      for (var p = 0; p < pernas.length; p += 1) {
        var celulas = pernas[p].celulas || [];
        if (celulas.length === 0) {
          continue;
        }
        var pontos = celulas
          .map(function (celula) {
            return px(celula.x) + "," + py(celula.y);
          })
          .join(" ");
        svg.appendChild(el("polyline", { class: "rota", points: pontos }));
      }
    }

    var base = mapaResposta.base || { x: 0, y: 0 };
    svg.appendChild(el("circle", { class: "base", cx: px(base.x), cy: py(base.y), r: 0.28 }));

    desenharClientes(svg, pedidos, px, py);
    desenharDrones(svg, drones, px, py);
  }

  function carregarTudo() {
    return Promise.all([
      buscarJson("/mapa"),
      buscarJson("/simulacao"),
      buscarJson("/drones"),
      buscarJson("/entregas/rota?caminho=true"),
      buscarJson("/pedidos"),
    ]).then(function (resultados) {
      var mapaResposta = resultados[0];
      var simulacao = resultados[1];
      var drones = resultados[2];
      var viagens = resultados[3];
      var pedidos = resultados[4];
      atualizarMetricas(simulacao);
      listarPedidos(pedidos);
      desenharMapa(mapaResposta, pedidos, drones, viagens);
    });
  }

  /**
   * Renderiza a tabela de pedidos. Todo texto entra por textContent — nenhum
   * dado da API é interpolado como HTML.
   */
  function listarPedidos(pedidos) {
    var corpo = document.querySelector("#lista-pedidos tbody");
    if (!corpo) {
      return;
    }
    while (corpo.firstChild) {
      corpo.removeChild(corpo.firstChild);
    }

    for (var i = 0; i < pedidos.length; i += 1) {
      var pedido = pedidos[i];
      var linha = document.createElement("tr");

      var destino = pedido.destino || { x: 0, y: 0 };
      linha.appendChild(celula("(" + destino.x + ", " + destino.y + ")"));
      linha.appendChild(celula(String(pedido.pesoKg) + " kg"));
      linha.appendChild(celula(String(pedido.prioridade)));
      linha.appendChild(celula(String(pedido.status)));

      var acoes = document.createElement("td");
      // Cancelar só é permitido a partir de "pendente" — o botão reflete a
      // regra de negócio em vez de deixar a API recusar depois do clique.
      if (pedido.status === "pendente") {
        var botao = document.createElement("button");
        botao.type = "button";
        botao.className = "botao-cancelar";
        botao.setAttribute("data-pedido-id", pedido.id);
        botao.textContent = "Cancelar";
        botao.addEventListener("click", function (evento) {
          aoClicarCancelar(evento.target.getAttribute("data-pedido-id"));
        });
        acoes.appendChild(botao);
      }
      linha.appendChild(acoes);

      corpo.appendChild(linha);
    }
  }

  function celula(texto) {
    var td = document.createElement("td");
    td.textContent = texto;
    return td;
  }

  function aoEnviarCadastro(evento) {
    evento.preventDefault();
    var x = Number(valorDoCampo("campo-x"));
    var y = Number(valorDoCampo("campo-y"));
    var pesoKg = Number(valorDoCampo("campo-peso"));
    var prioridade = valorDoCampo("campo-prioridade");

    definirStatus("Cadastrando…");
    buscarJson("/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: x, y: y, pesoKg: pesoKg, prioridade: prioridade }),
    })
      .then(function () {
        definirStatus("Pedido cadastrado.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  function aoClicarCancelar(pedidoId) {
    definirStatus("Cancelando…");
    buscarJson("/pedidos/" + pedidoId + "/cancelar", { method: "POST" })
      .then(function () {
        definirStatus("Pedido cancelado.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  function valorDoCampo(id) {
    var campo = document.getElementById(id);
    return campo ? campo.value : "";
  }

  function aoClicarAlocar() {
    definirStatus("Alocando…");
    buscarJson("/entregas/alocar", { method: "POST" })
      .then(function () {
        definirStatus("Alocação concluída.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  function aoClicarAvancar() {
    var campo = document.getElementById("campo-minutos");
    var minutos = campo ? Number(campo.value) : 0;
    definirStatus("Avançando o relógio…");
    buscarJson("/simulacao/avancar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutos: minutos }),
    })
      .then(function () {
        definirStatus("Relógio avançado.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var botaoAlocar = document.getElementById("botao-alocar");
    var botaoAvancar = document.getElementById("botao-avancar");
    if (botaoAlocar) {
      botaoAlocar.addEventListener("click", aoClicarAlocar);
    }
    if (botaoAvancar) {
      botaoAvancar.addEventListener("click", aoClicarAvancar);
    }
    var formPedido = document.getElementById("form-pedido");
    if (formPedido) {
      formPedido.addEventListener("submit", aoEnviarCadastro);
    }
    carregarTudo().catch(function (erro) {
      definirStatus("Erro: " + erro.message);
    });
  });
})();
</script>
</body>
</html>
`;
}
