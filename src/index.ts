import { criarApp } from './api/server.js';
import { config } from './config.js';

const app = criarApp();

app.listen(config.port, () => {
  console.log(`🚁 DroneDelivery rodando em http://localhost:${config.port}`);
});
