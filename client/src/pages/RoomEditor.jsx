import { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { fromLonLat, toLonLat } from "ol/proj";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import apiClient from "../api/client";

const DEFAULT_CENTER = [77.209, 28.6139];
const DEFAULT_ZOOM = 18;

const pointStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#f97316" }),
    stroke: new Stroke({ color: "#ffffff", width: 2 }),
  }),
});

const lineStyle = new Style({
  stroke: new Stroke({
    color: "#f97316",
    width: 2,
  }),
});

const polygonStyle = new Style({
  stroke: new Stroke({
    color: "#0f766e",
    width: 2,
  }),
  fill: new Fill({
    color: "rgba(15, 118, 110, 0.2)",
  }),
});

export default function RoomEditor() {
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [polygonCoordinates, setPolygonCoordinates] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Click on map to draw classroom boundary.");
  const [isSaving, setIsSaving] = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return undefined;
    }

    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(DEFAULT_CENTER),
        zoom: DEFAULT_ZOOM,
      }),
    });

    const handleMapClick = (event) => {
      const [lng, lat] = toLonLat(event.coordinate);
      setPolygonCoordinates((prev) => [
        ...prev,
        {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
        },
      ]);
    };

    map.on("click", handleMapClick);

    mapRef.current = map;
    vectorSourceRef.current = vectorSource;

    return () => {
      map.un("click", handleMapClick);
      map.setTarget(null);
      mapRef.current = null;
      vectorSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) {
      return;
    }

    source.clear();

    const projectedPoints = polygonCoordinates
      .map((coord) => [Number(coord?.lng), Number(coord?.lat)])
      .filter(
        (coord) =>
          Number.isFinite(coord[0]) &&
          Number.isFinite(coord[1]) &&
          Math.abs(coord[0]) <= 180 &&
          Math.abs(coord[1]) <= 90
      )
      .map((coord) => fromLonLat(coord));

    projectedPoints.forEach((point) => {
      const feature = new Feature({
        geometry: new Point(point),
      });
      feature.setStyle(pointStyle);
      source.addFeature(feature);
    });

    if (projectedPoints.length >= 2) {
      const lineFeature = new Feature({
        geometry: new LineString(projectedPoints),
      });
      lineFeature.setStyle(lineStyle);
      source.addFeature(lineFeature);
    }

    if (projectedPoints.length >= 3) {
      const closedRing = [...projectedPoints];
      const first = closedRing[0];
      const last = closedRing[closedRing.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        closedRing.push([...first]);
      }

      const polygonFeature = new Feature({
        geometry: new Polygon([closedRing]),
      });
      polygonFeature.setStyle(polygonStyle);
      source.addFeature(polygonFeature);
    }
  }, [polygonCoordinates]);

  const handleRemoveLast = () => {
    setPolygonCoordinates((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setPolygonCoordinates([]);
  };

  const handleSave = async () => {
    if (polygonCoordinates.length < 3) {
      setStatusMessage("Add at least 3 points before saving.");
      return;
    }

    if (!name.trim()) {
      setStatusMessage("Room name is required.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await apiClient.post("/api/rooms", {
        name: name.trim(),
        floor: floor === "" ? undefined : Number(floor),
        polygonCoordinates,
      });

      const savedRoomName = response.data?.name || "Room";
      setStatusMessage(`${savedRoomName} boundary saved successfully.`);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || "Failed to save room boundary.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[350px_1fr]">
        <article className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-semibold text-slate-900">Room Polygon Editor</h1>
          <p className="mt-2 text-sm text-slate-600">
            Click on the map to add boundary points for the classroom polygon.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="roomName">
                Room Name
              </label>
              <input
                id="roomName"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Room 101"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="roomFloor">
                Floor
              </label>
              <input
                id="roomFloor"
                type="number"
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
                placeholder="1"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p>Total points: {polygonCoordinates.length}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRemoveLast}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Remove Last
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Clear All
              </button>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Room Boundary"}
            </button>

            <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{statusMessage}</p>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow">
          <div ref={mapContainerRef} className="h-[620px] w-full" />
        </article>
      </section>
    </main>
  );
}