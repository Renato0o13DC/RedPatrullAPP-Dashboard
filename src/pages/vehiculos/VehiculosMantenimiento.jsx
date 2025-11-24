import React, { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, onSnapshot, query, where } from "firebase/firestore";
import { app } from "../../lib/firebase"; // importa tu instancia de Firebase
import { FaTruck, FaHome, FaTable, FaFileDownload, FaCar, FaUser } from "react-icons/fa"; // íconos
import { IoMapSharp } from "react-icons/io5";
import { BsGraphUpArrow } from "react-icons/bs";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../adminbi/dashboard/dashboard.css"; // reutiliza estilos del layout del dashboard
import "./VehiculosMantenimiento.css"; // estilos propios de la vista
import { exportVehiculosToExcel } from "../../utils/exportExcel";

// Componente: Vehículos y Mantenimiento
// - Escucha en tiempo real las colecciones `vehiculos_pat` y `turnos_conductores`.
// - Calcula el kilometraje actual por móvil (último turno con estado="finalizado").
// - Calcula el progreso hacia el próximo mantenimiento: progreso = (kmActual / kmProxMant) * 100
// - Muestra tabla con buscador y barra de progreso con colores dinámicos.

const numberFmt = (n) => {
	const num = Number(n ?? 0);
	return isFinite(num) ? num.toLocaleString("es-CL") : "-";
};

const getProgressColor = (progress) => {
	// Verde <70%, Amarillo 70-90%, Rojo >90%
	if (progress > 90) return "is-red"; // rojo
	if (progress >= 70) return "is-yellow"; // amarillo
	return "is-green"; // verde
};

export default function VehiculosMantenimiento() {
	const [vehiculos, setVehiculos] = useState([]); // documentos de vehiculos_pat
	const [latestKmByMovil, setLatestKmByMovil] = useState(new Map()); // { movil -> km_llegada más alto }
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);

	// Suscripción en tiempo real a las colecciones necesarias
	useEffect(() => {
		const db = getFirestore(app);

		// 1) Vehículos base (movil, patente, km_prox_mant, km_actual)
		const unsubVeh = onSnapshot(collection(db, "vehiculos_pat"), (snap) => {
			const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
			setVehiculos(list);
			setLoading(false);
		});

		// 2) Turnos finalizados: construir un mapa de último km_llegada por móvil
		const qTurnos = query(collection(db, "turnos_conductores"), where("estado", "==", "finalizado"));
		const unsubTurnos = onSnapshot(qTurnos, (snap) => {
			const map = new Map();
			snap.forEach((doc) => {
				const data = doc.data();
				const movil = data?.movil?.toString?.() ?? "";
				const kmLlegada = Number(data?.km_llegada ?? 0) || 0;
				// guardamos el mayor km_llegada por movil
				const prev = map.get(movil) ?? 0;
				if (kmLlegada > prev) map.set(movil, kmLlegada);
			});
			setLatestKmByMovil(map);
		});

			return () => {
			unsubVeh();
			unsubTurnos();
		};
	}, []);

		// Control de sesión para botón Logout y evitar parpadeo
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

		const handleLogout = async () => {
			try {
				const auth = getAuth(app);
				await signOut(auth);
				navigate("/login", { replace: true });
			} catch (e) {
				// opcional: manejar error
			}
		};

	// Fusionar datos: para cada vehículo, tomar kmActual desde latestKmByMovil (fallback: km_actual de vehiculos_pat)
	const rows = useMemo(() => {
			return vehiculos.map((v) => {
			const movil = v?.movil?.toString?.() ?? "";
			const patente = v?.patente ?? "-";
			const kmProxMant = Number(v?.km_prox_mant ?? 0) || 0;
			const kmActualDesdeTurno = latestKmByMovil.get(movil);
			const kmActualFallback = Number(v?.km_actual ?? 0) || 0;
			const kmActual = Number(kmActualDesdeTurno ?? kmActualFallback) || 0;

			// Evitar división por 0: si kmProxMant no está definido, asumimos ciclo de 10.000 km
			const divisor = kmProxMant > 0 ? kmProxMant : 10000;
			const progreso = (kmActual / divisor) * 100;

			return {
				id: v.id,
				movil,
				patente,
				kmActual,
				kmProxMant: divisor,
					progreso,
					createdAt: v?.created_at ?? null,
			};
		});
	}, [vehiculos, latestKmByMovil]);

	// Filtro de búsqueda por móvil o patente (case-insensitive)
	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) =>
			r.movil?.toLowerCase?.().includes(q) || r.patente?.toLowerCase?.().includes(q)
		);
	}, [rows, search]);

			if (authLoading) return null;

			return (
				<div className="dashboard-layout">
					{/* Sidebar (mismo estilo que Dashboard) */}
					<aside className="dashboard-sidebar">
						<div className="sidebar-logo">
							<img src="img/icono-1514.png" alt="Logo" />
						</div>
						<nav className="sidebar-nav">
							<a
								href="#"
								className="sidebar-link"
								onClick={(e) => { e.preventDefault(); navigate("/dashboard"); }}
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
							<a href="#" className="sidebar-link" onClick={(e)=>{e.preventDefault(); navigate('/tabla-general');}}><FaTable /><span>Tabla General</span></a>
							<a href="#" className="sidebar-link active"><FaCar /><span>Vehículos y Mantenimiento</span></a>
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

					{/* Main */}
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

						{/* Contenido específico de vehículos */}
						<div className="vehm-container">
							<div className="vehm-header">
								<FaTruck className="vehm-header-icon" />
								<h1 className="vehm-title">Vehículos y Mantenimiento</h1>
							</div>

										<div className="vehm-toolbar">
												<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Buscar por móvil o patente"
									className="vehm-search-input"
								/>
												<button
													className="vehm-export-btn"
													onClick={() => exportVehiculosToExcel(filtered)}
													title="Exportar a Excel"
												>
													<FaFileDownload style={{ marginRight: 6 }} /> Exportar Excel
												</button>
							</div>

							{loading ? (
								<div className="vehm-empty">Cargando…</div>
							) : filtered.length === 0 ? (
								<div className="vehm-empty">Sin datos disponibles</div>
							) : (
								<div className="vehm-grid">
									{filtered.map((v) => {
										const pct = Math.max(0, Math.min(100, v.progreso));
										const barMod = getProgressColor(v.progreso);
										return (
											<div key={v.id} className="vehm-card">
												<div className="vehm-card-header">
													<span className="vehm-card-emoji" aria-hidden>🚙</span>
													<div className="vehm-card-titles">
														<div className="vehm-card-title">Movíl: {v.movil || "-"}</div>
														<div className="vehm-card-subtitle">Patente: {v.patente || "-"}</div>
													</div>
												</div>
												<div className="vehm-card-body">
													<div className="vehm-progress">
														<div
															className={`vehm-progress-bar ${barMod}`}
															style={{ width: `${pct}%` }}
															title={`${pct.toFixed(1)}%`}
														/>
													</div>
													<div className="vehm-km-text">
														{numberFmt(v.kmActual)} / {numberFmt(v.kmProxMant)} km
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</main>
				</div>
			);
}

