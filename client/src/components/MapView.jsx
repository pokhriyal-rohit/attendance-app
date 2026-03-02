import { useEffect, useRef } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";

const DEFAULT_CENTER = [77.209, 28.6139];
const DEFAULT_ZOOM = 10;
const LIVE_ZOOM = 16;

function getPolygonStyle(inside) {
  const color = inside === true ? "#16a34a" : inside === false ? "#dc2626" : "#eab308";

  return new Style({
    stroke: new Stroke({
      color,
      width: 2,
    }),
    fill: new Fill({
      color: `${color}40`,
    }),
  });
}

const markerStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: "#2563eb" }),
    stroke: new Stroke({ color: "#ffffff", width: 2 }),
  }),
});

function toValidLonLatPairs(polygonCoordinates) {
  if (!Array.isArray(polygonCoordinates)) {
    return [];
  }

  return polygonCoordinates
    .map((coord) => [Number(coord?.lng), Number(coord?.lat)])
    .filter(
      (coord) =>
        Number.isFinite(coord[0]) &&
        Number.isFinite(coord[1]) &&
        Math.abs(coord[0]) <= 180 &&
        Math.abs(coord[1]) <= 90
    );
}

export default function MapView({ latitude, longitude, polygonCoordinates = [], inside = null }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const markerFeatureRef = useRef(null);
  const polygonFeatureRef = useRef(null);
  const polygonSourceRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return undefined;
    }

    const projectedDefaultCenter = fromLonLat(DEFAULT_CENTER);

    const markerFeature = new Feature({
      geometry: new Point(projectedDefaultCenter),
    });
    markerFeature.setStyle(markerStyle);

    const markerSource = new VectorSource({
      features: [markerFeature],
    });

    const markerLayer = new VectorLayer({
      source: markerSource,
    });

    const polygonSource = new VectorSource();

    const polygonLayer = new VectorLayer({
      source: polygonSource,
    });

    const view = new View({
      center: projectedDefaultCenter,
      zoom: DEFAULT_ZOOM,
    });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        polygonLayer,
        markerLayer,
      ],
      view,
    });

    mapRef.current = map;
    viewRef.current = view;
    markerFeatureRef.current = markerFeature;
    polygonSourceRef.current = polygonSource;

    return () => {
      map.setTarget(null);
      mapRef.current = null;
      viewRef.current = null;
      markerFeatureRef.current = null;
      polygonFeatureRef.current = null;
      polygonSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const projectedPosition = fromLonLat([longitude, latitude]);

    if (viewRef.current) {
      viewRef.current.animate({
        center: projectedPosition,
        zoom: LIVE_ZOOM,
        duration: 1200,
      });
    }

    const markerGeometry = markerFeatureRef.current?.getGeometry();
    if (markerGeometry) {
      markerGeometry.setCoordinates(projectedPosition);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    const polygonSource = polygonSourceRef.current;
    if (!polygonSource) {
      return;
    }

    const lonLatPairs = toValidLonLatPairs(polygonCoordinates);

    if (lonLatPairs.length < 3) {
      if (polygonFeatureRef.current) {
        polygonSource.removeFeature(polygonFeatureRef.current);
        polygonFeatureRef.current = null;
      }
      return;
    }

    const first = lonLatPairs[0];
    const last = lonLatPairs[lonLatPairs.length - 1];
    const closedPairs = [...lonLatPairs];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      closedPairs.push([...first]);
    }

    const projectedRing = closedPairs.map((coord) => fromLonLat(coord));
    const polygonGeometry = new Polygon([projectedRing]);

    if (polygonFeatureRef.current) {
      polygonFeatureRef.current.setGeometry(polygonGeometry);
      polygonFeatureRef.current.setStyle(getPolygonStyle(inside));
      return;
    }

    const polygonFeature = new Feature({
      geometry: polygonGeometry,
    });
    polygonFeature.setStyle(getPolygonStyle(inside));
    polygonSource.addFeature(polygonFeature);
    polygonFeatureRef.current = polygonFeature;
  }, [polygonCoordinates, inside]);

  return <div ref={mapContainerRef} style={{ height: "400px", width: "100%" }} />;
}