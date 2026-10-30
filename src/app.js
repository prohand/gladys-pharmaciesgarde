// -----------------------------------------------------------------------------
// The wiring between the SDK and the integration, kept out of index.js so the
// tests can run it against the fake Gladys of the SDK.
//
// One loop drives everything: a tick every minute (and right after a
// connection or a configuration save) refreshes what is stale, computes the
// answer for now, publishes the device states and the transport badge, fires
// the scene triggers and nudges the widget when the answer changed. Ticks
// never overlap: a slow Overpass answer delays the next one instead of racing it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildActions } from './capabilities/actions.js';
import { buildSceneActions, createTriggerWatcher } from './capabilities/scenes.js';
import { buildPharmacyWidget, PHARMACY_WIDGET, runWidgetAction } from './capabilities/widget.js';
import { normalizeConfig } from './config.js';
import { buildDevice, buildStates, deviceIds } from './device.js';
import { resolveLocation } from './location.js';
import { PharmacyService } from './pharmacies.js';
import { createStore } from './store.js';

const logger = createLogger({ name: 'app' });

const TICK_MS = 60 * 1000;
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

/**
 * Register every handler on a Gladys client. Call before `connect()`.
 * @param {object} gladys a GladysIntegration (or the fake one of the SDK)
 * @param {object} [options]
 * @param {ReturnType<typeof createStore>} [options.store]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {number | null} [options.tickMs] null: no timer (tests drive `tick`)
 */
export function registerIntegration(
  gladys,
  { store = createStore(), fetchImpl = fetch, now = () => Date.now(), tickMs = TICK_MS } = {},
) {
  const service = new PharmacyService({ fetchImpl, store, now });
  const checkTriggers = createTriggerWatcher({ gladys, store });
  let loaded = false;
  let timer = null;
  let queue = Promise.resolve();
  let lastTransport = null;
  let lastWidget = null;
  let lastStatus = null;

  // One tick at a time, in call order.
  function exclusive(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  async function reconfigure(rawConfig) {
    const config = normalizeConfig(rawConfig);
    const location = await resolveLocation(gladys, config);
    service.configure(config, location);
  }

  async function publishTransport(result) {
    const entry = { external_id: deviceIds(gladys).device, ...service.transport(result) };
    const signature = JSON.stringify(entry);
    if (signature === lastTransport) return;
    await gladys.publishTransports([entry]);
    lastTransport = signature;
  }

  async function publishStatus() {
    const nothing = !service.location && !service.hasPlanning();
    const failing =
      !service.local.entries.length &&
      (!service.osmEnabled() || service.osm.error) &&
      (!service.remote.url || service.remote.error) &&
      (service.osmEnabled() || service.remote.url);
    let status = { connected: true };
    if (nothing) {
      status = {
        connected: false,
        message: {
          en: 'No house location and no rota: set one of them.',
          fr: 'Ni position de la maison ni tableau de garde : renseignez l’un des deux.',
          de: 'Weder Standort des Hauses noch Notdienstplan: lege eines davon fest.',
          es: 'Ni ubicación de la casa ni cuadro de turnos: indique uno de los dos.',
        },
      };
    } else if (failing) {
      status = {
        connected: false,
        message: {
          en: 'The online sources do not answer, see "Test the sources".',
          fr: 'Les sources en ligne ne répondent pas, voir « Tester les sources ».',
          de: 'Die Online-Quellen antworten nicht, siehe „Quellen testen“.',
          es: 'Las fuentes en línea no responden, vea «Probar las fuentes».',
        },
      };
    }
    const signature = JSON.stringify(status);
    if (signature === lastStatus) return;
    await gladys.setConnectionStatus(status.connected, status.message);
    lastStatus = signature;
  }

  function refreshWidget(result, { force = false } = {}) {
    const signature = `${result.recommended?.source}|${result.recommended?.name}|${result.open.length}`;
    if (!force && signature === lastWidget) return;
    lastWidget = signature;
    gladys.requestWidgetRefresh(PHARMACY_WIDGET);
  }

  /**
   * One pass of the loop.
   * @param {{ refresh?: boolean, forceWidget?: boolean }} [options]
   */
  function tick({ refresh = true, forceWidget = false } = {}) {
    return exclusive(async () => {
      if (!service.config) return;
      try {
        if (refresh) await service.refresh();
        const at = service.now();
        const result = service.lookup(at);
        await gladys.publishChangedStates(buildStates(gladys, result), {
          heartbeat: STATE_HEARTBEAT_MS,
        });
        await publishTransport(result);
        await publishStatus();
        await checkTriggers(service, result, at);
        refreshWidget(result, { force: forceWidget });
      } catch (err) {
        logger.error('Update failed', err);
      }
    });
  }

  function startTimer() {
    stopTimer();
    if (tickMs) timer = setInterval(() => tick(), tickMs);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  gladys.onScanRequest(async () => {
    await gladys.publishDiscoveredDevices([buildDevice(gladys)]);
  });

  // A device just created has no state yet: send the current ones at once
  // (the SDK already forgot what it had published for it).
  gladys.onDeviceCreated(async () => {
    lastTransport = null;
    await tick({ refresh: false });
  });

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration saved');
    await exclusive(() => reconfigure(newConfig));
    lastStatus = null;
    await tick({ forceWidget: true });
  });

  const hooks = { onRefreshed: () => tick({ refresh: false, forceWidget: true }) };
  for (const [key, handler] of Object.entries(buildActions(service, hooks))) {
    gladys.onAction(key, (fields) => handler(fields));
  }

  for (const [key, handler] of Object.entries(buildSceneActions(service))) {
    gladys.onSceneAction(key, (fields) => handler(fields));
  }

  gladys.onWidgetGet(PHARMACY_WIDGET, async ({ settings }) => {
    if (!service.config) return { components: [] };
    return buildPharmacyWidget(service, { settings });
  });

  gladys.onWidgetAction(PHARMACY_WIDGET, async (actionKey) => {
    const message = await runWidgetAction(service, actionKey);
    await tick({ refresh: false });
    return message;
  });

  gladys.on('connected', async () => {
    try {
      if (!loaded) {
        await store.load();
        service.restore();
        loaded = true;
      }
      await exclusive(async () => reconfigure(await gladys.getConfig()));
      await gladys.publishDiscoveredDevices([buildDevice(gladys)]);
      lastTransport = null;
      lastStatus = null;
      // The nudges sent while the socket was down were dropped.
      await tick({ forceWidget: true });
      startTimer();
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(false, {
          en: 'Initialization failed, check the integration logs.',
          fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
          de: 'Die Initialisierung ist fehlgeschlagen, siehe die Protokolle der Integration.',
          es: 'La inicialización ha fallado, consulte los registros de la integración.',
        })
        .catch(() => {});
    }
  });

  gladys.on('disconnected', () => stopTimer());

  return { service, tick, stop: stopTimer };
}
