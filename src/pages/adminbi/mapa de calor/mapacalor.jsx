import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../dashboard/dashboard.css";
import { FaHome, FaTable, FaFileDownload, FaCar, FaUser } from "react-icons/fa";
import { IoMapSharp } from "react-icons/io5";
import { BsGraphUpArrow } from "react-icons/bs";

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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false); // responsive toggle

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

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch {}
  };

  // Filtra por tipo de incidente (normaliza para evitar problemas de mayúsculas/minúsculas)
  const puntosFiltrados = reportes
    .filter(
      (r) =>
        tipo === "TODOS" ||
        r.tipo_incidente === tipo.trim().toUpperCase()
    )
    .map((r) => r.coords);

  if (authLoading) return null;

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="img/icono-1514.png" alt="Logo" />
        </div>
        <nav className="sidebar-nav">
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/dashboard"); }}>
            <FaHome /><span>Inicio</span>
          </a>
          <a href="#" className="sidebar-link active" onClick={(e)=>e.preventDefault()}>
            <IoMapSharp /><span>Mapa de Calor</span>
          </a>
          <a href="#" className="sidebar-link" onClick={(e)=>{e.preventDefault(); navigate('/tabla-general');}}><FaTable /><span>Tabla General</span></a>
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/vehiculos"); }}>
            <FaCar /><span>Vehículos y Mantenimiento</span>
          </a>
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/turnos"); }}>
            <FaUser /><span>Conductores y Turnos</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <span>2025</span>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} />}
      <main className="dashboard-main-content">
        <header className="dashboard-header" style={{ position: "relative" }}>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >☰</button>
          <span className="dashboard-header-title">Seguridad Municipal de Pudahuel</span>
          {user && (
            <button
              onClick={handleLogout}
              style={{ position: "absolute", top: 8, right: 12, background: "#fff", color: "#000", border: "1px solid #ccc", padding: "6px 12px", fontSize: 12, borderRadius: 4, cursor: "pointer" }}
            >
              Logout
            </button>
          )}
        </header>

        {/* Filtros y mapa */}
        <div style={{ width: "100%" }}>
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
          <MapContainer center={[-33.45, -70.65]} zoom={12} style={{ height: "400px", width: "100%", borderRadius: 12, overflow: "hidden" }} className="heatmap-container">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatmapLayer points={puntosFiltrados} />
          </MapContainer>
        </div>
      </main>
    </div>
  );
}