import express from 'express';
import { processMessage } from '../core/protocol.js';

export function createHttpServer(ctx) {
  const app = express();
  app.use(express.json());

  app.post('/message', (req, res) => {
    processMessage(req.body, {
      ...ctx,
      transport: 'http',
      reply: (r) => res.json(r)
    });
  });

  return app;
}