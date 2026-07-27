import { criarApp } from './api/server.js';
import { config } from './config.js';
import { criarPersistenciaArquivo as criarPersistenciaArquivoPedidos } from './infra/persistencia-pedidos.js';
import { criarPersistenciaArquivo as criarPersistenciaArquivoViagens } from './infra/persistencia-viagens.js';
import { criarRepositorioPedidos } from './repositorio/pedidos.js';
import { criarRepositorioFrota } from './repositorio/frota.js';
import { criarRepositorioViagens } from './repositorio/viagens.js';
import { criarServicoSimulacao } from './servicos/simulacao.js';

const persistenciaPedidos = criarPersistenciaArquivoPedidos(config.pedidosArquivo);
const pedidos = criarRepositorioPedidos(persistenciaPedidos);
const frota = criarRepositorioFrota({
  base: config.base,
  capacidadeKg: config.droneCapacidadeKg,
  alcanceQuadras: config.droneAlcanceQuadras,
  quantidade: config.droneQuantidade,
});

const persistenciaViagens = criarPersistenciaArquivoViagens(config.viagensArquivo);
const viagens = criarRepositorioViagens({
  persistencia: persistenciaViagens,
  droneIds: frota.listar().map((drone) => drone.id),
});

// Reconciliação do boot (D27): viagem de drone que deixou de existir (frota
// encolhida via DRONE_QUANTIDADE) já foi descartada na criação do repositório
// de viagens acima; os pedidos dela voltam a "pendente" aqui.
const pedidoIdsOrfaos = viagens.pedidoIdsOrfaos();
if (pedidoIdsOrfaos.length > 0) {
  pedidos.reverterParaPendente(pedidoIdsOrfaos);
  console.log(
    `⚠️  Reconciliação no boot: ${pedidoIdsOrfaos.length} pedido(s) revertido(s) a "pendente" ` +
      '(viagem descartada por apontar para drone que deixou de existir).',
  );
}

// Instancia o serviço de simulação com os tempos da config e recomputa a
// linha do tempo já na subida (D31), para que o processo suba pronto —
// depois da reconciliação de viagens órfãs acima.
const simulacao = criarServicoSimulacao({
  pedidos,
  frota,
  viagens,
  base: config.base,
  tempos: {
    velocidadeQuadrasMin: config.droneVelocidadeQuadrasMin,
    carregamentoMin: config.tempoCarregamentoMin,
    entregaMin: config.tempoEntregaMin,
    recargaMinPorQuadra: config.recargaMinPorQuadra,
  },
});

const app = criarApp({ pedidos, frota, viagens, simulacao });

app.listen(config.port, () => {
  console.log(`🚁 DroneDelivery rodando em http://localhost:${config.port}`);
});
