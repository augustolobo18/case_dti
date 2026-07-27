import { Router } from 'express';
import { paginaDashboard } from '../../dashboard/pagina.js';

/**
 * Cria a rota do dashboard (E6-1/D41): serve a página HTML/CSS/JS inline,
 * sem `express.static` nem asset em disco — só o módulo TS compilado
 * (`npm start` serve idêntico ao `npm run dev`).
 */
export function criarRotasDashboard(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.type('html').send(paginaDashboard());
  });

  return router;
}
