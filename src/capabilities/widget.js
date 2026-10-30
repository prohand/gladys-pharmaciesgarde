// -----------------------------------------------------------------------------
// Dashboard widget (Gladys 5.1+): the pharmacy to go to, at a glance.
//
// The recommended pharmacy (on duty, or the nearest open one) with its phone
// and until when, the number of pharmacies open around the house, and the list
// of them with their address and a map link. Buttons: refresh the sources, the
// way there, and the official duty finder of the country — at night in France
// the 3237 is the reference, whatever any list says.
//
// The content is declarative (the core renders it): see the "Dashboard
// widgets" section of the SDK README for the vocabulary and the budget — at most
// 8 components, 1 focal, 6 tiles, 1 status list and 4 buttons.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { fit, formatDistance, formatWhen, SOURCE_LABELS } from '../format.js';
import { localize, pick } from '../i18n.js';
import { SOURCES } from '../pharmacies.js';

/** Key of the manifest widget. Never renamed: dashboards store it. */
export const PHARMACY_WIDGET = 'pharmacies';

/** The widget button actions. Never renamed: relayed back by key. */
export const WIDGET_ACTIONS = { REFRESH: 'refresh' };

/** How many pharmacies the list shows when the instance says nothing. */
export const DEFAULT_COUNT = 4;

/** The card-list component holds 8 rows at most. */
const MAX_COUNT = 8;

/** The official duty finder per country (https only: the widget refuses others). */
export const OFFICIAL_FINDERS = {
  fr: 'https://www.3237.fr/',
  de: 'https://www.aponet.de/apotheke/notdienstsuche',
};

const T = {
  pharmacy: { en: 'Pharmacy', fr: 'Pharmacie', de: 'Apotheke', es: 'Farmacia' },
  none: { en: 'None known', fr: 'Aucune connue', de: 'Keine bekannt', es: 'Ninguna conocida' },
  source: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  until: { en: 'Until', fr: "Jusqu'à", de: 'Bis', es: 'Hasta' },
  phone: { en: 'Phone', fr: 'Téléphone', de: 'Telefon', es: 'Teléfono' },
  rota: { en: 'Rota', fr: 'Tableau de garde', de: 'Notdienstplan', es: 'Turnos' },
  openNow: { en: 'Open now', fr: 'Ouvertes', de: 'Geöffnet', es: 'Abiertas' },
  distance: { en: 'Distance', fr: 'Distance', de: 'Entfernung', es: 'Distancia' },
  onDuty: { en: 'On duty', fr: 'De garde', de: 'Notdienst', es: 'De guardia' },
  open: { en: 'Open', fr: 'Ouverte', de: 'Geöffnet', es: 'Abierta' },
  map: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  route: { en: 'Show on map', fr: 'Voir sur la carte', de: 'Auf der Karte', es: 'Ver en el mapa' },
  unnamed: {
    en: 'Pharmacy (no name)',
    fr: 'Pharmacie (sans nom)',
    de: 'Apotheke (ohne Namen)',
    es: 'Farmacia (sin nombre)',
  },
};

function finderLabel(country) {
  return country === 'fr'
    ? { en: '3237 finder', fr: 'Service 3237', de: '3237 (FR)', es: '3237 (FR)' }
    : { en: 'Duty finder', fr: 'Recherche garde', de: 'Notdienstsuche', es: 'Buscar guardia' };
}

function setupNotice(service) {
  if (service.location || service.hasPlanning()) return null;
  return {
    en: 'Set the house location in Gladys, or paste a duty rota, to see pharmacies here.',
    fr: 'Renseignez la position de la maison dans Gladys, ou collez un tableau de garde, pour voir les pharmacies ici.',
    de: 'Lege den Standort des Hauses in Gladys fest oder füge einen Notdienstplan ein, um hier Apotheken zu sehen.',
    es: 'Indique la ubicación de la casa en Gladys, o pegue un cuadro de turnos, para ver farmacias aquí.',
  };
}

function rotaItem(service, now) {
  const daysLeft = service.planningDaysLeft(now);
  if (daysLeft === null) return null;
  const warning = daysLeft <= service.config.planning_warning_days;
  return {
    label: T.rota,
    icon: 'calendar',
    value: localize((language) =>
      pick(language, {
        en: `${daysLeft} day(s) left`,
        fr: `${daysLeft} jour(s) restant(s)`,
        de: `noch ${daysLeft} Tag(e)`,
        es: `quedan ${daysLeft} día(s)`,
      }),
    ),
    color:
      daysLeft === 0
        ? WIDGET_COLORS.DANGER
        : warning
          ? WIDGET_COLORS.WARNING
          : WIDGET_COLORS.SUCCESS,
  };
}

function statusItems(service, recommended, now) {
  const timeZone = service.config.timezone;
  const items = [
    {
      label: T.pharmacy,
      icon: 'plus-square',
      value: recommended ? fit(recommended.name || '?', 40) : T.none,
      color: !recommended
        ? WIDGET_COLORS.DANGER
        : recommended.source === SOURCES.OSM
          ? WIDGET_COLORS.WARNING
          : WIDGET_COLORS.SUCCESS,
    },
  ];
  if (recommended) {
    items.push({
      label: T.source,
      icon: 'info',
      value: SOURCE_LABELS[recommended.source],
      color: WIDGET_COLORS.NEUTRAL,
    });
    if (recommended.until) {
      items.push({
        label: T.until,
        icon: 'clock',
        value: localize((language) => formatWhen(recommended.until, now, timeZone, language)),
        color: WIDGET_COLORS.INFO,
      });
    }
    if (recommended.phone) {
      items.push({
        label: T.phone,
        icon: 'phone',
        value: fit(recommended.phone, 40),
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
  }
  const rota = rotaItem(service, now);
  if (rota) items.push(rota);
  return items;
}

function listItem(pharmacy, badge, now, timeZone) {
  const lines = [pharmacy.address, pharmacy.phone].filter(Boolean);
  const item = {
    title: fit(pharmacy.name || '', 60) || T.unnamed,
    subtitle: localize((language) =>
      [
        formatDistance(pharmacy.distanceKm),
        pharmacy.until
          ? `${pick(language, T.until)} ${formatWhen(pharmacy.until, now, timeZone, language)}`
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    ),
    badge,
  };
  const description = [...lines, pharmacy.openingHours].filter(Boolean).join('\n');
  if (description) item.description = fit(description, 2000);
  if (pharmacy.mapUrl) item.links = [{ url: pharmacy.mapUrl, label: T.map }];
  return item;
}

function emptySubtitle(item) {
  // A subtitle with no text in any language is noise.
  if (Object.values(item.subtitle).every((text) => text === '')) delete item.subtitle;
  return item;
}

/**
 * The pharmacies shown in the list: the recommended one first, then the open ones.
 */
function listItems(result, count, now, timeZone) {
  if (count === 0) return [];
  const items = [];
  const { recommended, open } = result;
  if (recommended) {
    const badge =
      recommended.source === SOURCES.OSM
        ? { text: T.open, color: WIDGET_COLORS.WARNING }
        : { text: T.onDuty, color: WIDGET_COLORS.SUCCESS };
    items.push(emptySubtitle(listItem(recommended, badge, now, timeZone)));
  }
  // The nearest open pharmacy is already first when it is the recommended one,
  // and a pharmacy on duty may be open too: list each pharmacy once.
  const others = recommended?.source === SOURCES.OSM ? open.slice(1) : open;
  for (const pharmacy of others) {
    if (items.length >= count) break;
    if (recommended?.mapUrl && recommended.mapUrl === pharmacy.mapUrl) continue;
    items.push(
      emptySubtitle(listItem(pharmacy, { text: T.open, color: WIDGET_COLORS.INFO }, now, timeZone)),
    );
  }
  return items.slice(0, count);
}

function countOf(settings) {
  const count = Number(settings?.count);
  if (settings?.count === undefined || settings?.count === null || !Number.isFinite(count)) {
    return DEFAULT_COUNT;
  }
  return Math.max(0, Math.min(MAX_COUNT, Math.round(count)));
}

/**
 * The content of the `pharmacies` widget.
 * @param {import('../pharmacies.js').PharmacyService} service
 * @param {{ settings?: object, now?: number }} [options]
 */
export function buildPharmacyWidget(service, { settings = {}, now = service.now() } = {}) {
  const timeZone = service.config.timezone;
  const result = service.lookup(now);
  const { recommended } = result;
  const components = [];

  const notice = setupNotice(service);
  if (notice) components.push({ type: 'text', variant: 'body', text: notice });

  components.push({ type: 'status', items: statusItems(service, recommended, now) });

  if (service.osmEnabled()) {
    components.push({
      type: 'value',
      label: T.openNow,
      icon: 'plus-circle',
      value: result.open.length,
      color: result.open.length > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
    });
  }
  if (typeof recommended?.distanceKm === 'number') {
    components.push({
      type: 'value',
      label: T.distance,
      icon: 'navigation',
      value: Math.round(recommended.distanceKm * 10) / 10,
      unit: 'km',
    });
  }

  const items = listItems(result, countOf(settings), now, timeZone);
  if (items.length > 0) components.push({ type: 'card-list', display: 'list', items });

  components.push({
    type: 'button',
    label: T.refresh,
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH },
  });
  if (recommended?.mapUrl) {
    components.push({
      type: 'button',
      label: T.route,
      icon: 'map-pin',
      style: 'primary',
      link: { url: recommended.mapUrl },
    });
  }
  const finder = OFFICIAL_FINDERS[service.config.country];
  if (finder) {
    components.push({
      type: 'button',
      label: finderLabel(service.config.country),
      icon: 'phone-call',
      style: 'secondary',
      link: { url: finder },
    });
  }

  return { ttl_seconds: 300, components };
}

/**
 * A tapped widget button.
 * @param {import('../pharmacies.js').PharmacyService} service
 * @param {string} actionKey
 */
export async function runWidgetAction(service, actionKey) {
  if (actionKey !== WIDGET_ACTIONS.REFRESH) {
    // Throwing acks the action as failed: the message reaches the user.
    throw new Error(`Unknown widget action: ${actionKey}`);
  }
  await service.refresh({ force: true });
  const { open, recommended } = service.lookup();
  return localize((language) =>
    pick(language, {
      en: `Updated: ${recommended ? recommended.name : 'no pharmacy known'}, ${open.length} open.`,
      fr: `Actualisé : ${recommended ? recommended.name : 'aucune pharmacie connue'}, ${open.length} ouverte(s).`,
      de: `Aktualisiert: ${recommended ? recommended.name : 'keine Apotheke bekannt'}, ${open.length} geöffnet.`,
      es: `Actualizado: ${recommended ? recommended.name : 'ninguna farmacia conocida'}, ${open.length} abierta(s).`,
    }).slice(0, 200),
  );
}
