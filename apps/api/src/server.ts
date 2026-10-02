import { app } from './app.js';
import { env } from './config/env.js';
import { db } from './lib/db.js';

const server = app.listen(env.PORT, '0.0.0.0', () => console.info(`Hotel API listening on :${env.PORT}`));
async function shutdown() {
  server.close(async () => { await db.$disconnect(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
