import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Componente para agregar capa de calor
function HeatmapLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    // Limpia capas previas
    map.eachLayer((layer) => {
      if (layer.options && layer.options.pane === "overlayPane") {
        map.removeLayer(layer);
      }
    });

    // Agrega capa de calor
    const heat = window.L.heatLayer(points, { radius: 25, blur: 18, maxZoom: 17 });
    heat.addTo(map);

    // Limpia al desmontar
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

const INCIDENTES = [
  "VIF",
  "ACCIDENTE VEHICULAR",
  "ACCIDENTE PERSONA",
  "RIÑA",
  "INCENDIO ESTRUCTURAL",
  "INCENDIO FORESTAL",
  "DERRAME DE SUSTANCIAS PELIGROSAS",
  "RUIDOS MOLESTOS",
  "FISCALIZACIÓN VEHICULAR",
  "FISCALIZACIÓN COMERCIO ILEGAL",
  "ROBO",
  "OTROS"
];

export default function MapaCalor() {
  const [reportes, setReportes] = useState([]);
  const [tipo, setTipo] = useState("TODOS");

  useEffect(() => {
    const fetchData = async () => {
      const db = getFirestore();
      const querySnapshot = await getDocs(collection(db, "reportes"));
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        // Log para depuración
        console.log("Documento:", d);
        if (
          d.direccion &&
          typeof d.direccion === "string" &&
          d.tipo_incidente
        ) {
          const [lat, lng] = d.direccion.split(",").map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            data.push({
              tipo_incidente: d.tipo_incidente.trim().toUpperCase(),
              coords: [lat, lng],
            });
          }
        }
      });
      setReportes(data);
    };
    fetchData();
  }, []);

  // Filtra por tipo de incidente (normaliza para evitar problemas de mayúsculas/minúsculas)
  const puntosFiltrados = reportes
    .filter(
      (r) =>
        tipo === "TODOS" ||
        r.tipo_incidente === tipo.trim().toUpperCase()
    )
    .map((r) => r.coords);

  return (
    <div style={{ width: "100%", height: "480px" }}>
      <div style={{
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#f5f6fa",
        padding: "12px 18px",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
      }}>
        <label style={{ fontWeight: 600 }}>Filtrar por tipo de incidente:</label>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: "1rem"
          }}
        >
          <option value="TODOS">Todos</option>
          {INCIDENTES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <MapContainer center={[-33.45, -70.65]} zoom={12} style={{ height: "400px", width: "100%", borderRadius: 12, overflow: "hidden" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatmapLayer points={puntosFiltrados} />
      </MapContainer>
    </div>
  );
}