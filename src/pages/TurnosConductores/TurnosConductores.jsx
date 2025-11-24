import React, { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { app } from "../../lib/firebase";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { FaHome, FaTable, FaFileDownload, FaCar, FaUser } from "react-icons/fa";
import { IoMapSharp } from "react-icons/io5";
import { BsGraphUpArrow } from "react-icons/bs";
import "../adminbi/dashboard/dashboard.css"; // layout y estilos base
import "./TurnosConductores.css"; // estilos propios
import { exportTurnosToExcel } from "../../utils/exportExcel";

// utilitarios de formato
const pad = (n) => String(n).padStart(2, "0");
const toDate = (v) => {
  if (v && typeof v.toDate === "function") return v.toDate();
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return null;
};
const formatDateTime = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d.getTime())) return "-";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function TurnosConductores() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fConductor, setFConductor] = useState("");
  const [fPatrullero, setFPatrullero] = useState("");
  const [fEstado, setFEstado] = useState("");

  // auth + navegación + layout consistente
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // datos en tiempo real
  useEffect(() => {
    const db = getFirestore(app);
    const unsub = onSnapshot(collection(db, "turnos_conductores"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Normalizadores: hay proyectos donde los campos difieren en nombre.
  const pick = (obj, paths) => {
    for (const p of paths) {
      const val = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
      if (val !== undefined && val !== null && String(val).trim() !== "") return val;
    }
    return "";
  };
  const getConductor = (r) => pick(r, [
    "conductor",
    "nombre_conductor",
    "conductor_nombre",
    "conductor.name",
    "nombreConductor",
  ]);
  const getPatrullero = (r) => pick(r, [
    "patrullero",
    "nombre_patrullero",
    "patrullero_nombre",
    "patrullero.name",
    "responsable",
    "nombre",
  ]);

  // opciones select dinámicas
  const conductores = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const c = getConductor(r);
      if (c) set.add(String(c));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const patrulleros = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const p = getPatrullero(r);
      if (p) set.add(String(p));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // filtrado
  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

    return rows.filter((r) => {
      // fecha: se evalúa por hora_salida si existe, sino created_at
      const baseDate = toDate(r?.hora_salida) || toDate(r?.created_at);
      if (from && (!baseDate || baseDate < from)) return false;
      if (to && (!baseDate || baseDate > to)) return false;

      if (fConductor && String(getConductor(r)) !== fConductor) return false;
      if (fPatrullero && String(getPatrullero(r)) !== fPatrullero) return false;
      if (fEstado && String(r?.estado).toLowerCase() !== fEstado.toLowerCase()) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, fConductor, fPatrullero, fEstado]);

  // métricas
  const metrics = useMemo(() => {
    const totalTurnos = filtered.length;
    let totalKm = 0;
    const byConductor = new Map();

    filtered.forEach((r) => {
      const kms = (Number(r?.km_llegada ?? 0) || 0) - (Number(r?.km_salida ?? 0) || 0);
      const kmRec = Math.max(0, kms);
      totalKm += kmRec;
      // Normalizamos conductor usando getConductor para mayor consistencia
      const key = String(getConductor(r) || "-");
      byConductor.set(key, (byConductor.get(key) || 0) + kmRec);
    });

    const distinctCount = Array.from(byConductor.keys()).filter((k) => k !== "-").length;
    const prom = distinctCount === 0 ? 0 : totalKm / distinctCount;

    return { totalTurnos, totalKm, promKmConductor: prom };
  }, [filtered]);

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch {}
  };

  if (authLoading) return null;

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-logo">
          <img src="img/icono-1514.png" alt="Logo" />
        </div>
        <nav className="sidebar-nav">
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/dashboard"); }}>
            <FaHome /><span>Inicio</span>
          </a>
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/mapacalor"); }}>
            <IoMapSharp /><span>Mapa de Calor</span>
          </a>
          <a href="#" className="sidebar-link" onClick={(e)=>{e.preventDefault(); navigate('/tabla-general');}}><FaTable /><span>Tabla General</span></a>
          <a href="#" className="sidebar-link" onClick={(e) => { e.preventDefault(); navigate("/vehiculos"); }}>
            <FaCar /><span>Vehículos y Mantenimiento</span>
          </a>
          <a href="#" className="sidebar-link active">
            <FaUser /><span>Conductores y Turnos</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <span>2025</span>
        </div>
      </aside>

      {/* Main */}
      <main className="dashboard-main-content">
        <header className="dashboard-header" style={{ position: "relative" }}>
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

        {/* Contenido */}
        <div className="turnos-container">
          {/* Métricas */}
          <section className="turnos-kpis">
            <div className="turnos-kpi-card">
              <div className="turnos-kpi-value">{metrics.totalTurnos.toLocaleString("es-CL")}</div>
              <div className="turnos-kpi-label">Total turnos</div>
            </div>
            <div className="turnos-kpi-card">
              <div className="turnos-kpi-value">{Math.round(metrics.totalKm).toLocaleString("es-CL")}</div>
              <div className="turnos-kpi-label">Total km recorridos</div>
            </div>
            <div className="turnos-kpi-card">
              <div className="turnos-kpi-value">{Math.round(metrics.promKmConductor).toLocaleString("es-CL")}</div>
              <div className="turnos-kpi-label">Promedio km por conductor</div>
            </div>
          </section>

          {/* Filtros */}
          <section className="turnos-toolbar">
            <div className="turnos-field">
              <label>Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="turnos-field">
              <label>Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="turnos-field">
              <label>Conductor</label>
              <select value={fConductor} onChange={(e) => setFConductor(e.target.value)}>
                <option value="">Todos</option>
                {conductores.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="turnos-field">
              <label>Patrullero</label>
              <select value={fPatrullero} onChange={(e) => setFPatrullero(e.target.value)}>
                <option value="">Todos</option>
                {patrulleros.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="turnos-field">
              <label>Estado</label>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="en ruta">En ruta</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
            <button
              className="turnos-export-btn"
              onClick={() => {
                const exportRows = filtered.map((r) => {
                  const kmRec = Math.max(0, (Number(r?.km_llegada ?? 0) || 0) - (Number(r?.km_salida ?? 0) || 0));
                  return {
                    conductor: getConductor(r) || "-",
                    patrullero: getPatrullero(r) || "-",
                    movil: r?.movil ?? "-",
                    estado: r?.estado ?? "-",
                    horaSalida: r?.hora_salida ?? r?.created_at ?? null,
                    horaLlegada: r?.hora_llegada ?? null,
                    kmRecorridos: kmRec,
                  };
                });
                exportTurnosToExcel(exportRows);
              }}
              title="Exportar tabla a Excel"
            >
              <FaFileDownload style={{ marginRight: 6 }} /> Exportar Excel
            </button>
          </section>

          {/* Tabla */}
          <section className="turnos-card">
            {loading ? (
              <div className="turnos-empty">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="turnos-empty">Sin datos disponibles</div>
            ) : (
              <div className="turnos-table-wrapper">
                <table className="turnos-table">
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th>Patrullero</th>
                      <th>Móvil</th>
                      <th>Estado</th>
                      <th>Hora Salida</th>
                      <th>Hora Llegada</th>
                      <th>Km Recorridos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const kmRec = Math.max(0, (Number(r?.km_llegada ?? 0) || 0) - (Number(r?.km_salida ?? 0) || 0));
                      return (
                        <tr key={r.id}>
                          <td>{getConductor(r) || "-"}</td>
                          <td>{getPatrullero(r) || "-"}</td>
                          <td>{r?.movil || "-"}</td>
                          <td style={{ textTransform: "capitalize" }}>{r?.estado || "-"}</td>
                          <td>{formatDateTime(r?.hora_salida)}</td>
                          <td>{formatDateTime(r?.hora_llegada)}</td>
                          <td style={{ textAlign: "right" }}>{kmRec.toLocaleString("es-CL")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* sección futura removida a petición del usuario */}
        </div>
      </main>
    </div>
  );
}
