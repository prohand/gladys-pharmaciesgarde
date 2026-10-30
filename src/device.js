// -----------------------------------------------------------------------------
// The Gladys device: "Pharmacy on duty".
//
// One device, whose features carry the recommended pharmacy (on duty, or the
// nearest open one without a rota) as text — name, address, phone, source — and
// two distances. Text features let a scene read them ({{...}} in a message) and
// the dashboard show them; the distances let a scene compare.
//
// The states are published by the minute tick of index.js, not on Gladys
// polls: the scene triggers and the widget must work even before the user
// creates the device, and the tick is what feeds them.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { SOURCES } from './pharmacies.js';

const DEVICE_TYPE = 'pharmacy';

// A single zone per installation: the id is fixed. External ids are forever —
// Gladys keys the device, its history and the dashboards on it.
const PLATFORM_ID = 'duty';

/** Feature keys. Never renamed: they are part of the external ids. */
export const FEATURES = {
  NAME: 'name',
  ADDRESS: 'address',
  PHONE: 'phone',
  SOURCE: 'source',
  DISTANCE: 'distance',
  NEAREST_OPEN_NAME: 'nearest-open-name',
  NEAREST_OPEN_DISTANCE: 'nearest-open-distance',
};

/** What a text feature shows when there is nothing to say. */
export const NONE = '-';

/** A distance feature caps here (30 km radius, plus a rota pharmacy a bit further). */
const MAX_DISTANCE_KM = 100;

const SOURCE_TEXT = {
  [SOURCES.PLANNING]: 'rota',
  [SOURCES.REMOTE]: 'published rota',
  [SOURCES.OSM]: 'open now (OpenStreetMap)',
};

export function deviceIds(gladys) {
  return gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);
}

function textFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    // min/max are NOT NULL in Gladys, text features included.
    min: 0,
    max: 0,
  };
}

function distanceFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.DISTANCE_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
    unit: DEVICE_FEATURE_UNITS.KM,
    read_only: true,
    has_feedback: false,
    keep_history: false,
    min: 0,
    max: MAX_DISTANCE_KM,
  };
}

/**
 * The discovery payload.
 */
export function buildDevice(gladys) {
  const ids = deviceIds(gladys);
  return {
    name: 'Pharmacie de garde',
    external_id: ids.device,
    features: [
      textFeature(ids, FEATURES.NAME, 'Pharmacie'),
      textFeature(ids, FEATURES.ADDRESS, 'Adresse'),
      textFeature(ids, FEATURES.PHONE, 'Téléphone'),
      textFeature(ids, FEATURES.SOURCE, 'Source'),
      distanceFeature(ids, FEATURES.DISTANCE, 'Distance'),
      textFeature(ids, FEATURES.NEAREST_OPEN_NAME, 'Ouverte la plus proche'),
      distanceFeature(ids, FEATURES.NEAREST_OPEN_DISTANCE, 'Distance ouverte la plus proche'),
    ],
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * The states of the device for a lookup result (see PharmacyService.lookup).
 * A distance nobody knows is not published: Gladys keeps the last one rather
 * than a misleading 0.
 */
export function buildStates(gladys, { recommended, open }) {
  const ids = deviceIds(gladys);
  const text = (key, value) => ({
    device_feature_external_id: ids.feature(key),
    text: value ? String(value).slice(0, 250) : NONE,
  });
  const states = [
    text(FEATURES.NAME, recommended?.name),
    text(FEATURES.ADDRESS, recommended?.address),
    text(FEATURES.PHONE, recommended?.phone),
    text(FEATURES.SOURCE, recommended ? SOURCE_TEXT[recommended.source] : ''),
    text(FEATURES.NEAREST_OPEN_NAME, open[0]?.name),
  ];
  if (typeof recommended?.distanceKm === 'number') {
    states.push({
      device_feature_external_id: ids.feature(FEATURES.DISTANCE),
      state: Math.min(MAX_DISTANCE_KM, round(recommended.distanceKm)),
    });
  }
  if (typeof open[0]?.distanceKm === 'number') {
    states.push({
      device_feature_external_id: ids.feature(FEATURES.NEAREST_OPEN_DISTANCE),
      state: Math.min(MAX_DISTANCE_KM, round(open[0].distanceKm)),
    });
  }
  return states;
}
