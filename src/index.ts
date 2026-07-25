import { criarApp } from './api/server.js';
import { config } from './config.js';
import { criarPersistenciaArquivo } from './infra/persistencia-pedidos.js';
import { criarRepositorioPedidos } from './repositorio/pedidos.js';

const persistencia = criarPersistenciaArquivo(config.pedidosArquivo);
const repositorio = criarRepositorioPedidos(persistencia);
const app = criarApp(repositorio);

app.listen(config.port, () => {
  console.log(`🚁 DroneDelivery rodando em http://localhost:${config.port}`);
});
