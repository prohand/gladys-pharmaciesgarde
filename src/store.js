// -----------------------------------------------------------------------------
// What survives a restart, in /data (the only writable path of the container).
//
// Three things: the last OpenStreetMap list and the last published rota read
// (so a restart does not query the servers again, and an unreachable server
// does not leave the house without pharmacies), and what the scene triggers
// already announced (so an update of the integration does not announce the
// same duty change twice). Losing the file is harmless: everything is fetched
// again.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'store' });

export const DEFAULT_STORE_PATH = '/data/state.json';

/**
 * A small JSON store. `load()` never throws (an unreadable file is an empty
 * store); `save()` logs a failure instead of throwing, the store being a cache.
 * @param {string | null} path null keeps everything in memory (tests)
 */
export function createStore(path = DEFAULT_STORE_PATH) {
  let data = {};
  return {
    async load() {
      if (!path) return data;
      try {
        data = JSON.parse(await readFile(path, 'utf8')) ?? {};
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Cannot read ${path}, starting empty: ${err.message}`);
        }
        data = {};
      }
      return data;
    },
    get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
      if (!path) return;
      try {
        await mkdir(dirname(path), { recursive: true });
        const tmp = `${path}.tmp`;
        await writeFile(tmp, JSON.stringify(data));
        await rename(tmp, path);
      } catch (err) {
        logger.warn(`Cannot write ${path}: ${err.message}`);
      }
    },
  };
}
