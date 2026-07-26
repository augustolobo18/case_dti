import { criarApp } from './api/server.js';
import { config } from './config.js';
import { criarPersistenciaArquivo } from './infra/persistencia-pedidos.js';
import { criarRepositorioPedidos } from './repositorio/pedidos.js';
import { criarRepositorioFrota } from './repositorio/frota.js';

const persistencia = criarPersistenciaArquivo(config.pedidosArquivo);
const pedidos = criarRepositorioPedidos(persistencia);
const frota = criarRepositorioFrota({
  base: config.base,
  capacidadeKg: config.droneCapacidadeKg,
  alcanceQuadras: config.droneAlcanceQuadras,
  quantidade: config.droneQuantidade,
});
const app = criarApp({ pedidos, frota });

app.listen(config.port, () => {
  console.log(`🚁 DroneDelivery rodando em http://localhost:${config.port}`);
});
