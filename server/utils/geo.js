const turf = require("@turf/turf");

const normalizePolygonCoordinates = (polygonCoordinates) => {
  if (!Array.isArray(polygonCoordinates)) {
    return [];
  }

  const cleaned = polygonCoordinates
    .map((coord) => ({
      lat: Number(coord?.lat),
      lng: Number(coord?.lng),
    }))
    .filter(
      (coord) =>
        Number.isFinite(coord.lat) &&
        Number.isFinite(coord.lng) &&
        Math.abs(coord.lat) <= 90 &&
        Math.abs(coord.lng) <= 180
    );

  if (cleaned.length < 3) {
    return [];
  }

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) {
    cleaned.push({ ...first });
  }

  return cleaned;
};

const checkIfInsidePolygon = (studentLat, studentLng, polygonCoordinates) => {
  const normalizedPolygon = normalizePolygonCoordinates(polygonCoordinates);
  if (normalizedPolygon.length < 4) {
    return false;
  }

  const ring = normalizedPolygon
    .map((coord) => [coord.lng, coord.lat])
    .filter(
      (coord) =>
        Number.isFinite(coord[0]) &&
        Number.isFinite(coord[1]) &&
        Math.abs(coord[0]) <= 180 &&
        Math.abs(coord[1]) <= 90
    );

  if (ring.length < 4) {
    return false;
  }

  const polygon = turf.polygon([ring]);
  const studentPoint = turf.point([studentLng, studentLat]);

  return turf.booleanPointInPolygon(studentPoint, polygon);
};

const calculateDistanceMeters = (fromLat, fromLng, toLat, toLng) => {
  const from = turf.point([fromLng, fromLat]);
  const to = turf.point([toLng, toLat]);
  return turf.distance(from, to, { units: "kilometers" }) * 1000;
};

module.exports = { checkIfInsidePolygon, normalizePolygonCoordinates, calculateDistanceMeters };
