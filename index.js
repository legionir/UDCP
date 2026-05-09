import { startUDP } from './transport/udp.js';
import { startWS } from './transport/ws.js';
import { createHttpServer } from './transport/http.js';

import { createDB } from './storage/sqlite.js';
import { MetricsCollector } from './metrics/collector.js';
import { UdcpEventBus, attachSSE } from './ui-gateway/events.js';
import { attachAPI } from './ui-gateway/api.js';

const AUTH_SECRET = 'shared-hmac-secret';
const AUTH_TOKEN = 'secret-token';

const db = createDB();
const metrics = new MetricsCollector();
const eventBus = new UdcpEventBus();

const ctx = {
  authSecret: AUTH_SECRET,
  authToken: AUTH_TOKEN,
  metrics,
  storage: db,
  eventBus
};

// transports
startUDP(ctx);
startWS(ctx);

const app = createHttpServer(ctx);
attachSSE(app, eventBus);
attachAPI(app, db);

app.listen(3000, () => {
  console.log('✅ HTTP 3000');
});