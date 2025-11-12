import React, { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../../../lib/firebase";
import "./dashboard.css";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { FaHome, FaTable, FaFileDownload } from "react-icons/fa";
import { IoMapSharp } from "react-icons/io5";
import { BsGraphUpArrow } from "react-icons/bs";
import { TbReport } from "react-icons/tb";
import MapaCalor from "../mapa de calor/mapacalor";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // <-- nuevo

const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

const formatoFechaCorta = (fecha) => {
  if (fecha && typeof fecha === "object" && typeof fecha.toDate === "function") {
    const d = fecha.toDate();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }
  if (typeof fecha === "string") {
    const match = fecha.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (match) {
      const dia = match[1].padStart(2, "0");
      const meses = {
        enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
        julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12"
      };
      const mes = meses[match[2].toLowerCase()] || "00";
      const anio = match[3].slice(-2);
      return `${dia}/${mes}/${anio}`;
    }
  }
  return "-";
};

const getMostFrequentKey = (counterObj) =>
  Object.entries(counterObj).reduce(
    (acc, [k, v]) => (v > acc.count ? { key: k, count: v } : acc),
    { key: "", count: 0 }
  ).key;

const Dashboard = () => {
  const [reportesCount, setReportesCount] = useState(0);
  const [incidenteMasComun, setIncidenteMasComun] = useState("");
  const [turnoMasComun, setTurnoMasComun] = useState("");
  const [ultimosReportes, setUltimosReportes] = useState([]);
  const [turnosData, setTurnosData] = useState([]);
  const [tiposData, setTiposData] = useState([]); // <-- nuevo estado
  const [selectedSection, setSelectedSection] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate(); // <-- nuevo

  useEffect(() => {
    const fetchData = async () => {
      const db = getFirestore(app);
      const querySnapshot = await getDocs(collection(db, "reportes"));
      const tipoCounter = {};
      const turnoCounter = {};
      const reportesList = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tipo_incidente) {
          tipoCounter[data.tipo_incidente] = (tipoCounter[data.tipo_incidente] || 0) + 1;
        }
        if (data.turno) {
            turnoCounter[data.turno] = (turnoCounter[data.turno] || 0) + 1;
        }
        if (data.fecha && data.tipo_incidente && data.nombre_patrullero && data.turno) {
          reportesList.push({
            fecha: data.fecha,
            tipo_incidente: data.tipo_incidente,
            nombre_patrullero: data.nombre_patrullero,
            turno: data.turno
          });
        }
      });

      setReportesCount(querySnapshot.size);
      setIncidenteMasComun(getMostFrequentKey(tipoCounter));
      setTurnoMasComun(getMostFrequentKey(turnoCounter));

      setTurnosData(
        Object.entries(turnoCounter).map(([turno, cantidad]) => ({
          name: turno.charAt(0).toUpperCase() + turno.slice(1).toLowerCase(),
          value: cantidad
        }))
      );

      setTiposData( // <-- llenar datos por tipo (orden descendente)
        Object.entries(tipoCounter)
          .map(([tipo, cantidad]) => ({ tipo, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
      );

      const getDate = (f) =>
        f && typeof f === "object" && typeof f.toDate === "function"
          ? f.toDate()
          : typeof f === "string"
          ? new Date(f)
          : new Date(0);

      setUltimosReportes(
        reportesList
          .sort((a, b) => getDate(b.fecha) - getDate(a.fecha))
          .slice(0, 4)
      );
    };
    fetchData();
  }, []);

  // Reemplaza el useEffect de autenticación anterior
  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) navigate("/login", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (e) {
      // opcional: manejar error
    }
  };

  if (authLoading) return null; // <-- evita parpadeo/redirección prematura

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <img src="img/icono-1514.png" alt="Logo" />
        </div>
        <nav className="sidebar-nav">
          <a
            href="#"
            className="sidebar-link"
            onClick={(e) => { e.preventDefault(); setSelectedSection("dashboard"); }}
          >
            <FaHome /><span>Inicio</span>
          </a>
          <a
            href="#"
            className="sidebar-link"
            onClick={(e) => { e.preventDefault(); setSelectedSection("mapacalor"); }}
          >
            <IoMapSharp /><span>Mapa de Calor</span>
          </a>
          <a href="#" className="sidebar-link"><BsGraphUpArrow /><span>Graficas</span></a>
          <a href="#" className="sidebar-link"><FaTable /><span>Tabla General</span></a>
          <a href="#" className="sidebar-link"><TbReport /><span>Patrullas</span></a>
          <a href="#" className="sidebar-link"><FaFileDownload /><span>Exportar</span></a>
        </nav>
        <div className="sidebar-footer">
          <span>2025</span>
        </div>
      </aside>
      <main className="dashboard-main-content">
        <header className="dashboard-header" style={{ position: "relative" }}>
          <span className="dashboard-header-title">Seguridad Municipal de Pudahuel</span>
          {user && (
            <button
              onClick={handleLogout}
              style={{
                position: "absolute",
                top: 8,
                right: 12,
                background: "#fff",
                color: "#000",
                border: "1px solid #ccc",
                padding: "6px 12px",
                fontSize: 12,
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          )}
        </header>
        {/* Usa un fragmento para envolver ambos bloques condicionales */}
        <>
          {selectedSection === "dashboard" && (
            <>
              {/* KPIs */}
              <section className="dashboard-kpis">
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-value">{reportesCount}</div>
                  <div className="dashboard-kpi-label">Total de Reportes de Incidentes</div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-value">80</div>
                  <div className="dashboard-kpi-label">Incidentes por Mes</div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-value">
                    {incidenteMasComun || "Sin datos"}
                  </div>
                  <div className="dashboard-kpi-label">Incidente más común</div>
                </div>
                <div className="dashboard-kpi-card">
                  <div className="dashboard-kpi-value">
                    {(turnoMasComun || "Sin datos").toUpperCase()}
                  </div>
                  <div className="dashboard-kpi-label">Turno con mayor cantidad de reportes</div>
                </div>
              </section>

              {/* Main Content */}
              <section className="dashboard-content">
                {/* Incidentes por tipo */}
                <div className="dashboard-card dashboard-incidentes-tipo">
                  <h2>Reporte de Incidentes por Tipo</h2>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table className="dashboard-table-incidentes">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Reportes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiposData.length === 0 ? (
                          <tr>
                            <td colSpan={2} style={{ textAlign: "center" }}>Sin datos</td>
                          </tr>
                        ) : (
                          tiposData.map(t => (
                            <tr key={t.tipo}>
                              <td>{t.tipo}</td>
                              <td style={{ textAlign: "right", fontWeight: 600 }}>{t.cantidad}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Incidentes recientes */}
                <div className="dashboard-card dashboard-incidentes-recientes">
                  <h2>Incidentes Recientes</h2>
                  <table className="dashboard-table-incidentes">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo de Incidente</th>
                        <th>Responsable</th>
                        <th>Turno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ultimosReportes.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center" }}>Sin datos</td>
                        </tr>
                      ) : (
                        ultimosReportes.map((rep, idx) => (
                          <tr key={idx}>
                            <td>{formatoFechaCorta(rep.fecha)}</td>
                            <td>{rep.tipo_incidente}</td>
                            <td>{rep.nombre_patrullero}</td>
                            <td>{rep.turno.charAt(0).toUpperCase() + rep.turno.slice(1).toLowerCase()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Incidentes por turno */}
                <div className="dashboard-card dashboard-incidentes-turno">
                  <h2>Incidentes por Turno</h2>
                  <div style={{ width: "100%", height: 220 }}>
                    {turnosData.length === 0 ? (
                      <div className="dashboard-pie-chart-placeholder">Sin datos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={turnosData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {turnosData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
          {selectedSection === "mapacalor" && (
            <div className="dashboard-card" style={{ margin: 24 }}>
              <h2>Mapa de Calor de Incidentes</h2>
              <MapaCalor />
            </div>
          )}
        </>
      </main>
    </div>
  );
};

export default Dashboard;