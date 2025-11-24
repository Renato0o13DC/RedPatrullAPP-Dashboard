import React, { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "../../../lib/firebase";
import "./dashboard.css";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { FaHome, FaTable, FaCar, FaUser, FaEye } from "react-icons/fa";
import { IoMapSharp } from "react-icons/io5";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

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
  const [reportesFull, setReportesFull] = useState([]);
  const [turnosData, setTurnosData] = useState([]);
  const [tiposData, setTiposData] = useState([]);
  const [promedioMensual, setPromedioMensual] = useState(0); // nuevo: promedio de incidentes por mes
  const [sidebarOpen, setSidebarOpen] = useState(false); // responsive: toggle sidebar en móviles
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  // (Eliminado manejo de vista/localStorage; ahora Tabla General es ruta separada)

  useEffect(() => {
    const fetchData = async () => {
      const db = getFirestore(app);
      const querySnapshot = await getDocs(collection(db, "reportes"));
      const tipoCounter = {};
      const turnoCounter = {};
      const reportesList = [];
      const reportesFullTemp = [];

      const getDate = (f) =>
        f && typeof f === "object" && typeof f.toDate === "function"
          ? f.toDate()
          : typeof f === "string"
          ? new Date(f)
          : new Date(0);

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tipo_incidente) {
          tipoCounter[data.tipo_incidente] = (tipoCounter[data.tipo_incidente] || 0) + 1;
        }
        if (data.turno) {
          turnoCounter[data.turno] = (turnoCounter[data.turno] || 0) + 1;
        }
        reportesFullTemp.push({ id: doc.id, ...data });
        if (data.fecha && data.tipo_incidente && data.nombre_patrullero && data.turno) {
          reportesList.push({
            fecha: data.fecha,
            tipo_incidente: data.tipo_incidente,
            nombre_patrullero: data.nombre_patrullero,
            turno: data.turno
          });
        }
      });

      setReportesFull(
        reportesFullTemp.sort((a, b) => getDate(b.fecha) - getDate(a.fecha))
      );
      setReportesCount(querySnapshot.size);
      setIncidenteMasComun(getMostFrequentKey(tipoCounter));
      setTurnoMasComun(getMostFrequentKey(turnoCounter));

      setTurnosData(
        Object.entries(turnoCounter).map(([turno, cantidad]) => ({
          name: turno.charAt(0).toUpperCase() + turno.slice(1).toLowerCase(),
          value: cantidad
        }))
      );

      setTiposData(
        Object.entries(tipoCounter)
          .map(([tipo, cantidad]) => ({ tipo, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad)
      );

      setUltimosReportes(
        reportesList
          .sort((a, b) => getDate(b.fecha) - getDate(a.fecha))
          .slice(0, 4)
      );

      // Calcular promedio mensual: total reportes / número de meses distintos
      const monthCounter = {};
      reportesFullTemp.forEach(r => {
        const d = getDate(r.fecha);
        if (!isNaN(d)) {
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthCounter[key] = (monthCounter[key] || 0) + 1;
        }
      });
      const distinctMonths = Object.keys(monthCounter).length;
      const avg = distinctMonths === 0 ? 0 : Math.round(querySnapshot.size / distinctMonths);
      setPromedioMensual(avg);
    };
    fetchData();
  }, []);

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
      // manejar error opcional
    }
  };

  const formatoFechaLarga = (fecha) => {
    if (fecha && typeof fecha === "object" && typeof fecha.toDate === "function") {
      return fecha.toDate().toLocaleString("es-CL");
    }
    if (typeof fecha === "string") return fecha;
    return "-";
  };

  return (
    <div className="dashboard-layout">
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="img/icono-1514.png" alt="Logo" />
        </div>
        <nav className="sidebar-nav">
          <a
            href="#"
            className="sidebar-link active"
            onClick={(e)=>{e.preventDefault(); navigate('/dashboard');}}
          >
            <FaHome /><span>Inicio</span>
          </a>
          <a
            href="#"
            className="sidebar-link"
            onClick={(e) => { e.preventDefault(); navigate("/mapacalor"); }}
          >
            <IoMapSharp /><span>Mapa de Calor</span>
          </a>
          <a
            href="#"
            className="sidebar-link"
            onClick={(e)=>{e.preventDefault(); navigate('/tabla-general');}}
          >
            <FaTable /><span>Tabla General</span>
          </a>
          <a
            href="#"
            className="sidebar-link"
            onClick={(e) => { e.preventDefault(); navigate("/vehiculos"); }}
          >
            <FaCar /><span>Vehículos y Mantenimiento</span>
          </a>
          <a
            href="#"
            className="sidebar-link"
            onClick={(e) => { e.preventDefault(); navigate("/turnos"); }}
          >
            <FaUser /><span>Conductores y Turnos</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <span>2025</span>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
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

        <>
            <section className="dashboard-kpis">
              <div className="dashboard-kpi-card">
                <div className="dashboard-kpi-value">{reportesCount}</div>
                <div className="dashboard-kpi-label">Total de Reportes de Incidentes</div>
              </div>
              <div className="dashboard-kpi-card">
                <div className="dashboard-kpi-value">{promedioMensual}</div>
                <div className="dashboard-kpi-label">Promedio Mensual de Incidentes</div>
              </div>
              <div className="dashboard-kpi-card">
                <div className="dashboard-kpi-value">{incidenteMasComun || "Sin datos"}</div>
                <div className="dashboard-kpi-label">Incidente más común</div>
              </div>
              <div className="dashboard-kpi-card">
                <div className="dashboard-kpi-value">{(turnoMasComun || "Sin datos").toUpperCase()}</div>
                <div className="dashboard-kpi-label">Turno con mayor cantidad de reportes</div>
              </div>
            </section>

            <section className="dashboard-content">
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
                        <tr><td colSpan={2} style={{ textAlign: "center" }}>Sin datos</td></tr>
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
                      <tr><td colSpan={4} style={{ textAlign: "center" }}>Sin datos</td></tr>
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

              {/* Nuevo gráfico: Distribución de incidentes por tipo (barras) */}
              <div className="dashboard-card dashboard-incidentes-tipo-bar">
                <h2>Distribución de Incidentes por Tipo</h2>
                <div style={{ width: '100%', height: 220 }}>
                  {tiposData.length === 0 ? (
                    <div className="dashboard-pie-chart-placeholder">Sin datos</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tiposData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <XAxis type="number" />
                        <YAxis dataKey="tipo" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#0a2e5c" radius={[4,4,4,4]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>
        </>

        {/* Tabla General ahora vive en /tabla-general */}
      </main>
    </div>
  );
};

export default Dashboard;
