// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   - test_sources   fetch every source now and say what each one gave: the
//                    house location, the rota typed in (and the lines it could
//                    not read), the published rota, OpenStreetMap, and the
//                    answer for right now
//   - show_planning  the next turns of the rota, to check it was read right
//
// The answers are multi-language objects, shown under the button.
// -----------------------------------------------------------------------------

import { formatDistance, formatLocal, formatWhen, SOURCE_LABELS } from '../format.js';
import { localize, pick } from '../i18n.js';

/** Action keys, as declared in the manifest. Never renamed. */
export const ACTIONS = { TEST_SOURCES: 'test_sources', SHOW_PLANNING: 'show_planning' };

/** The most turns `show_planning` lists. */
const MAX_LISTED = 30;

/** The unreadable lines quoted by the test, at most. */
const MAX_ERRORS = 5;

function errorLines(errors, language) {
  return errors.slice(0, MAX_ERRORS).map(({ line, message }) =>
    pick(language, {
      en: `  line ${line}: ${message}`,
      fr: `  ligne ${line} : ${message}`,
      de: `  Zeile ${line}: ${message}`,
      es: `  línea ${line}: ${message}`,
    }),
  );
}

function locationLine(service, language) {
  const { location } = service;
  if (!location) {
    return pick(language, {
      en: 'Location: unknown — set the house position in Gladys (Settings > Houses) or the coordinates here.',
      fr: 'Position : inconnue — renseignez la position de la maison dans Gladys (Paramètres > Maisons) ou les coordonnées ici.',
      de: 'Standort: unbekannt — lege die Position des Hauses in Gladys fest (Einstellungen > Häuser) oder die Koordinaten hier.',
      es: 'Ubicación: desconocida — indique la posición de la casa en Gladys (Ajustes > Casas) o las coordenadas aquí.',
    });
  }
  const where = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  const origin =
    location.origin === 'config'
      ? pick(language, {
          en: 'configuration',
          fr: 'configuration',
          de: 'Konfiguration',
          es: 'configuración',
        })
      : location.name;
  return pick(language, {
    en: `Location: ${where} (${origin})`,
    fr: `Position : ${where} (${origin})`,
    de: `Standort: ${where} (${origin})`,
    es: `Ubicación: ${where} (${origin})`,
  });
}

function localLines(service, language) {
  const { entries, errors } = service.local;
  if (!service.config.planning.trim()) {
    return [
      pick(language, {
        en: 'Typed rota: none.',
        fr: 'Tableau saisi : aucun.',
        de: 'Eingegebener Plan: keiner.',
        es: 'Turnos escritos: ninguno.',
      }),
    ];
  }
  return [
    pick(language, {
      en: `Typed rota: ${entries.length} turn(s) read, ${errors.length} line(s) unreadable.`,
      fr: `Tableau saisi : ${entries.length} garde(s) lue(s), ${errors.length} ligne(s) illisible(s).`,
      de: `Eingegebener Plan: ${entries.length} Dienst(e) gelesen, ${errors.length} Zeile(n) unlesbar.`,
      es: `Turnos escritos: ${entries.length} turno(s) leído(s), ${errors.length} línea(s) ilegible(s).`,
    }),
    ...errorLines(errors, language),
  ];
}

function remoteLines(service, language) {
  const { url, entries, errors, error } = service.remote;
  if (!url) {
    return [
      pick(language, {
        en: 'Published rota: none.',
        fr: 'Tableau en ligne : aucun.',
        de: 'Online-Plan: keiner.',
        es: 'Turnos en línea: ninguno.',
      }),
    ];
  }
  if (error) {
    return [
      pick(language, {
        en: `Published rota: unreachable (${error}). ${entries.length} turn(s) kept from the last read.`,
        fr: `Tableau en ligne : injoignable (${error}). ${entries.length} garde(s) gardée(s) de la dernière lecture.`,
        de: `Online-Plan: nicht erreichbar (${error}). ${entries.length} Dienst(e) aus dem letzten Abruf behalten.`,
        es: `Turnos en línea: inaccesible (${error}). ${entries.length} turno(s) conservado(s) de la última lectura.`,
      }),
    ];
  }
  return [
    pick(language, {
      en: `Published rota: ${entries.length} turn(s) read, ${errors.length} line(s) unreadable.`,
      fr: `Tableau en ligne : ${entries.length} garde(s) lue(s), ${errors.length} ligne(s) illisible(s).`,
      de: `Online-Plan: ${entries.length} Dienst(e) gelesen, ${errors.length} Zeile(n) unlesbar.`,
      es: `Turnos en línea: ${entries.length} turno(s) leído(s), ${errors.length} línea(s) ilegible(s).`,
    }),
    ...errorLines(errors, language),
  ];
}

function osmLine(service, result, language) {
  if (!service.config.use_openstreetmap) {
    return pick(language, {
      en: 'OpenStreetMap: off.',
      fr: 'OpenStreetMap : désactivé.',
      de: 'OpenStreetMap: aus.',
      es: 'OpenStreetMap: desactivado.',
    });
  }
  if (!service.location) {
    return pick(language, {
      en: 'OpenStreetMap: needs the location.',
      fr: 'OpenStreetMap : il faut la position.',
      de: 'OpenStreetMap: braucht den Standort.',
      es: 'OpenStreetMap: necesita la ubicación.',
    });
  }
  const { error } = service.osm;
  const total = result.pharmacies.length;
  const unknown = result.pharmacies.filter((pharmacy) => pharmacy.open === null).length;
  const radius = service.config.radius_km;
  const counts = pick(language, {
    en: `${total} pharmacies within ${radius} km, ${result.open.length} open now, ${unknown} without readable hours`,
    fr: `${total} pharmacies dans un rayon de ${radius} km, ${result.open.length} ouvertes maintenant, ${unknown} sans horaires lisibles`,
    de: `${total} Apotheken im Umkreis von ${radius} km, ${result.open.length} jetzt geöffnet, ${unknown} ohne lesbare Öffnungszeiten`,
    es: `${total} farmacias en un radio de ${radius} km, ${result.open.length} abiertas ahora, ${unknown} sin horario legible`,
  });
  if (error) {
    return pick(language, {
      en: `OpenStreetMap: unreachable (${error}); last list: ${counts}.`,
      fr: `OpenStreetMap : injoignable (${error}) ; dernière liste : ${counts}.`,
      de: `OpenStreetMap: nicht erreichbar (${error}); letzte Liste: ${counts}.`,
      es: `OpenStreetMap: inaccesible (${error}); última lista: ${counts}.`,
    });
  }
  const label = pick(language, {
    en: 'OpenStreetMap:',
    fr: 'OpenStreetMap :',
    de: 'OpenStreetMap:',
    es: 'OpenStreetMap:',
  });
  return `${label} ${counts}.`;
}

function answerLine(service, result, language) {
  const { recommended } = result;
  if (!recommended) {
    return pick(language, {
      en: 'Right now: no pharmacy known.',
      fr: 'En ce moment : aucune pharmacie connue.',
      de: 'Gerade jetzt: keine Apotheke bekannt.',
      es: 'Ahora mismo: ninguna farmacia conocida.',
    });
  }
  const details = [
    pick(language, SOURCE_LABELS[recommended.source]),
    formatDistance(recommended.distanceKm),
    recommended.until
      ? `${pick(language, { en: 'until', fr: "jusqu'à", de: 'bis', es: 'hasta' })} ${formatWhen(recommended.until, result.at.getTime(), service.config.timezone, language)}`
      : '',
  ]
    .filter(Boolean)
    .join(', ');
  return pick(language, {
    en: `Right now: ${recommended.name} (${details}).`,
    fr: `En ce moment : ${recommended.name} (${details}).`,
    de: `Gerade jetzt: ${recommended.name} (${details}).`,
    es: `Ahora mismo: ${recommended.name} (${details}).`,
  });
}

/**
 * The handlers of the manifest actions, keyed by action key.
 * @param {import('../pharmacies.js').PharmacyService} service
 * @param {{ onRefreshed?: () => Promise<void> }} [hooks] run after a forced refresh
 */
export function buildActions(service, { onRefreshed } = {}) {
  return {
    async [ACTIONS.TEST_SOURCES]() {
      await service.refresh({ force: true });
      await onRefreshed?.();
      const result = service.lookup();
      return localize((language) =>
        [
          locationLine(service, language),
          ...localLines(service, language),
          ...remoteLines(service, language),
          osmLine(service, result, language),
          answerLine(service, result, language),
        ].join('\n'),
      );
    },

    async [ACTIONS.SHOW_PLANNING](fields) {
      const days = Math.max(1, Math.min(60, Number(fields?.days) || 14));
      const now = service.now();
      const until = now + days * 24 * 60 * 60 * 1000;
      const turns = [
        ...service.local.entries.map((entry) => ({ entry, source: 'planning' })),
        ...service.remote.entries.map((entry) => ({ entry, source: 'remote' })),
      ]
        .filter(({ entry }) => entry.end.getTime() > now && entry.start.getTime() < until)
        .sort((a, b) => a.entry.start - b.entry.start);
      const timeZone = service.config.timezone;
      return localize((language) => {
        if (turns.length === 0) {
          return pick(language, {
            en: `No turn in the next ${days} day(s).`,
            fr: `Aucune garde dans les ${days} prochain(s) jour(s).`,
            de: `Kein Dienst in den nächsten ${days} Tag(en).`,
            es: `Ningún turno en los próximos ${days} día(s).`,
          });
        }
        const lines = turns.slice(0, MAX_LISTED).map(({ entry, source }) => {
          const where = [entry.address, entry.phone].filter(Boolean).join(', ');
          const label = pick(language, SOURCE_LABELS[source]);
          return `${formatLocal(entry.start, timeZone)} → ${formatLocal(entry.end, timeZone)} : ${entry.name}${where ? ` (${where})` : ''} [${label}]`;
        });
        if (turns.length > MAX_LISTED) lines.push(`… +${turns.length - MAX_LISTED}`);
        return lines.join('\n');
      });
    },
  };
}
