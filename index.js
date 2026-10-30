// -----------------------------------------------------------------------------
// Entry point of the "Pharmacies de garde" Gladys integration.
//
// SDK bootstrap only: the handlers live in src/app.js (registered BEFORE
// connect()), the logic in src/pharmacies.js and src/sources/.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerIntegration } from './src/app.js';

const gladys = new GladysIntegration();
const app = registerIntegration(gladys);

// A failed promise somewhere must be logged, not kill the integration.
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled promise rejection', err);
});

// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT).
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  app.stop();
});

logger.info('Starting the Pharmacies de garde integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
