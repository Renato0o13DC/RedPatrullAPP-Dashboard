import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../adminbi/dashboard/dashboard.css";
import "./visual_mapa.css";
import { FaHome, FaTable, FaFileDownload } from "react-icons/fa";
import { IoMapSharp } from "react-icons/io5";
import { BsGraphUpArrow } from "react-icons/bs";
import { TbReport } from "react-icons/tb";


// Coordenadas iniciales de la ciudad (ejemplo: Santiago, Chile)
const INITIAL_POSITION = [-33.45, -70.6667];
const MAP_ZOOM = 13;

// Icono personalizado para los marcadores
const markerIcon = new L.Icon({
	iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
	shadowSize: [41, 41]
	});

	function useDebounce(value, delay) {
	const [debouncedValue, setDebouncedValue] = useState(value);
	useEffect(() => {
		const handler = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(handler);
	}, [value, delay]);
	return debouncedValue;
}

const VisualMapa = () => {
	// Inputs intersección
	const [callePrincipal, setCallePrincipal] = useState("");
	const [calleSecundaria, setCalleSecundaria] = useState("");
	const [sugsPrincipal, setSugsPrincipal] = useState([]); // string[] de nombres de calle
	const [sugsSecundaria, setSugsSecundaria] = useState([]); // string[] de nombres de calle
	const [selectedPrincipalName, setSelectedPrincipalName] = useState("");
	const [selectedSecundariaName, setSelectedSecundariaName] = useState("");

	// Input dirección exacta
	const [direccion, setDireccion] = useState("");
	const [sugsDireccion, setSugsDireccion] = useState([]);
	const [selectedDireccion, setSelectedDireccion] = useState(null);

	// Marcadores
	const [markers, setMarkers] = useState([]);

	// Estado UI
	const [statusMsg, setStatusMsg] = useState("");
	const [findingIntersection, setFindingIntersection] = useState(false);

	// Debounce para inputs
		const debouncedPrincipal = useDebounce(callePrincipal, 300);
		const debouncedSecundaria = useDebounce(calleSecundaria, 300);
		const debouncedDireccion = useDebounce(direccion, 300);

		// Parámetros de Nominatim para limitar a Pudahuel, Chile
		const NOM_BASE = "https://nominatim.openstreetmap.org/search";
		const VIEWBOX = "-70.84,-33.33,-70.65,-33.56"; // aprox límite de Pudahuel (lon1,lat1,lon2,lat2)
		const COMMON_PARAMS = `format=jsonv2&addressdetails=1&accept-language=es&countrycodes=cl&viewbox=${VIEWBOX}&bounded=1&limit=6&namedetails=1`;

		// Helpers: filtrar y derivar nombres de calles únicos
		const allowedTypes = new Set([
			"residential","primary","secondary","tertiary","unclassified","living_street",
			"service","trunk","motorway","pedestrian","track","road"
		]);
		const isStreetFeature = (r) => (r.class === "highway") || (r.addresstype === "road") || (allowedTypes.has(r.type));
		const deriveStreetName = (r) => {
			if (r?.namedetails?.name) return r.namedetails.name;
			if (r?.name) return r.name;
			const a = r?.address || {};
			return a.road || a.pedestrian || a.residential || a.footway || a.path || (r?.display_name ? r.display_name.split(",")[0] : "");
		};
		const toUniqueStreetNames = (arr) => {
			const seen = new Set();
			const out = [];
			arr.forEach(r => {
				if (!isStreetFeature(r)) return;
				const name = (deriveStreetName(r) || "").trim();
				if (!name) return;
				const key = name.toLowerCase();
				if (seen.has(key)) return;
				seen.add(key);
				out.push(name);
			});
			return out;
		};

		// Normalización básica para regex (Avenida/Av/Avda)
		const makeStreetRegex = (name) => {
			const n = (name || "").trim();
			if (!n) return "";
			// Si empieza por av/avda/avenida, hacer un grupo opcional
			const prefixPattern = "(?:Avenida|Av\\.?|Avda\\.?)\\s+";
			const lower = n.toLowerCase();
			if (lower.startsWith("av ") || lower.startsWith("av.") || lower.startsWith("avda") || lower.startsWith("avenida")) {
				// Quitar prefijo y dejar el cuerpo del nombre
				const rest = n.replace(/^\s*(Avenida|Av\.?|Avda\.?)\s+/i, "");
				return `^${prefixPattern}${rest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
			}
			// Si no tiene prefijo, usar nombre literal con límites relajados
			return `^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
		};

		const overpassFindIntersection = async (p, s) => {
			const pRegex = makeStreetRegex(p);
			const sRegex = makeStreetRegex(s);
			if (!pRegex || !sRegex) return null;
			const ql = `
				[out:json][timeout:25];
				area["name"="Pudahuel"]["boundary"="administrative"]->.a;
				way(area.a)["highway"]["name"~"${pRegex}",i]->.w1;
				way(area.a)["highway"]["name"~"${sRegex}",i]->.w2;
				node(w.w1)->.n1;
				node(w.w2)->.n2;
				node.n1.n2;out qt;`;
			const servers = [
				"https://overpass-api.de/api/interpreter",
				"https://overpass.kumi.systems/api/interpreter"
			];
			for (const url of servers) {
				try {
					const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: ql });
					if (!res.ok) continue;
					const j = await res.json();
					if (j && Array.isArray(j.elements) && j.elements.length > 0) {
						const node = j.elements.find(e => e.type === "node" && typeof e.lat === "number" && typeof e.lon === "number");
						if (node) return { lat: node.lat, lon: node.lon };
					}
				} catch (_) { /* try next */ }
			}
			return null;
		};

	// Consultar Nominatim para autocompletar calles (intersección)
		useEffect(() => {
				if (debouncedPrincipal.length < 2) { setSugsPrincipal([]); return; }
				// Evitar reabrir sugerencias si el valor coincide con la selección
				if (debouncedPrincipal.trim().toLowerCase() === selectedPrincipalName.trim().toLowerCase()) { setSugsPrincipal([]); return; }
				fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(debouncedPrincipal)}&${COMMON_PARAMS}`)
				.then(r => r.json())
				.then(data => setSugsPrincipal(toUniqueStreetNames(Array.isArray(data) ? data : [])))
				.catch(() => setSugsPrincipal([]));
		}, [debouncedPrincipal, selectedPrincipalName]);

	useEffect(() => {
			if (debouncedSecundaria.length < 2) { setSugsSecundaria([]); return; }
			if (debouncedSecundaria.trim().toLowerCase() === selectedSecundariaName.trim().toLowerCase()) { setSugsSecundaria([]); return; }
			fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(debouncedSecundaria)}&${COMMON_PARAMS}`)
			.then(r => r.json())
			.then(data => setSugsSecundaria(toUniqueStreetNames(Array.isArray(data) ? data : [])))
			.catch(() => setSugsSecundaria([]));
	}, [debouncedSecundaria, selectedSecundariaName]);

	// Consultar Nominatim para dirección exacta
		useEffect(() => {
			if (debouncedDireccion.length < 2) { setSugsDireccion([]); return; }
			fetch(`${NOM_BASE}?city=Pudahuel&q=${encodeURIComponent(debouncedDireccion)}&${COMMON_PARAMS}`)
			.then(r => r.json())
			.then(data => setSugsDireccion(data))
			.catch(() => setSugsDireccion([]));
	}, [debouncedDireccion]);

	// Agregar marcador por intersección
		const handleSelectInterseccion = async (principalName, secundariaName) => {
				const p = (principalName || "").trim();
				const s = (secundariaName || "").trim();
				if (!p || !s) return;
				setStatusMsg("");
				setFindingIntersection(true);
				try {
					// Intentar resolver la intersección usando "calle1 & calle2" restringido a Pudahuel; probar ambos órdenes
					const q1 = `${p} & ${s}`;
					let res = await fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(q1)}&${COMMON_PARAMS}`);
					let data = await res.json();
					let target = Array.isArray(data) && data.length > 0 ? data[0] : null;
					if (!target) {
						const q2 = `${s} & ${p}`;
						res = await fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(q2)}&${COMMON_PARAMS}`);
						data = await res.json();
						target = Array.isArray(data) && data.length > 0 ? data[0] : null;
					}
					if (!target) {
						// Fallback 1: 'q' dentro de la vista de Pudahuel
						const q3 = `${p} & ${s}, Pudahuel`;
						res = await fetch(`${NOM_BASE}?q=${encodeURIComponent(q3)}&${COMMON_PARAMS}`);
						data = await res.json();
						target = Array.isArray(data) && data.length > 0 ? data[0] : null;
					}
					if (!target) {
						// Fallback 2: Overpass para intersecciones precisas
						const node = await overpassFindIntersection(p, s);
						if (node) {
							target = { lat: node.lat, lon: node.lon };
						}
					}
					if (target) {
						setMarkers([
							{
								position: [parseFloat(target.lat), parseFloat(target.lon)],
								info: `Intersección: ${p} y ${s}`,
							},
						]);
						setStatusMsg("");
					} else {
						setStatusMsg("No se encontró la intersección en Pudahuel. Prueba otra combinación o ajusta los nombres.");
					}
				} catch (_) {
					setStatusMsg("Hubo un problema buscando la intersección. Inténtalo nuevamente.");
				} finally {
					setFindingIntersection(false);
					setCallePrincipal(""); setCalleSecundaria("");
					setSugsPrincipal([]); setSugsSecundaria([]);
					setSelectedPrincipalName(""); setSelectedSecundariaName("");
				}
			};


	// Agregar marcador por dirección exacta
	const handleSelectDireccion = (direccionObj) => {
		setMarkers([
			{
				position: [parseFloat(direccionObj.lat), parseFloat(direccionObj.lon)],
				info: `Dirección: ${direccionObj.display_name}`,
			},
		]);
		setDireccion(""); setSugsDireccion([]); setSelectedDireccion(null);
	};


	// Permitir agregar marcador por dirección con Enter si hay una sola sugerencia
	const handleDireccionKeyDown = (e) => {
		if (e.key === "Enter") {
			if (sugsDireccion.length >= 1) {
				// Si hay sugerencias, toma la primera
				handleSelectDireccion(sugsDireccion[0]);
			} else if (direccion.trim().length >= 3) {
				// Si no hay sugerencias, intenta geocodificar el texto libre
				handleAddDireccion();
			}
		}
	};

	// Geocodificar texto libre con restricción a Pudahuel y fallback amplio
	const geocodeDireccion = async (query) => {
		try {
			// Intento 1: Restringido a Pudahuel
			const res1 = await fetch(`${NOM_BASE}?city=Pudahuel&q=${encodeURIComponent(query)}&${COMMON_PARAMS}`);
			const data1 = await res1.json();
			if (Array.isArray(data1) && data1.length > 0) return data1[0];
			// Intento 2: Búsqueda amplia en Chile
			const res2 = await fetch(`${NOM_BASE}?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&accept-language=es&countrycodes=cl&limit=6`);
			const data2 = await res2.json();
			if (Array.isArray(data2) && data2.length > 0) return data2[0];
		} catch (_) { /* noop */ }
		return null;
	};

	// Agregar por dirección usando selección o geocodificación del texto
	const handleAddDireccion = async () => {
		if (selectedDireccion) return handleSelectDireccion(selectedDireccion);
		const q = direccion.trim();
		if (q.length < 3) return;
		const geo = await geocodeDireccion(q);
		if (geo) {
			handleSelectDireccion(geo);
		}
	};

	return (
		<div className="dashboard-layout">
			{/* Sidebar */}
			<aside className="dashboard-sidebar">
				<div className="sidebar-logo">
					<img src="/img/icono-1514.png" alt="Logo" />
				</div>
				<nav className="sidebar-nav">
					<a href="#" className="sidebar-link">
						<IoMapSharp /><span>Mapa</span>
					</a>
				</nav>
				<div className="sidebar-footer">
					<span>2025</span>
				</div>
			</aside>
			<main className="dashboard-main-content">
				<header className="dashboard-header" style={{ position: "relative" }}>
					<span className="dashboard-header-title">Central de Cámaras</span>
				</header>
				<div className="visual-mapa-content">
					<div className="visual-mapa-form-wrapper">
						<h2>Registrar Incidente</h2>
						<div className="visual-mapa-form">
							<div className="visual-mapa-form-section">
								<h3>Opción 1: Intersección</h3>
								<input
									type="text"
									className="visual-mapa-input"
									placeholder="Calle principal"
									value={callePrincipal}
									onChange={e => { setCallePrincipal(e.target.value); setSelectedPrincipalName(""); }}
									autoComplete="off"
								/>
								{sugsPrincipal.length > 0 && (
									<ul className="visual-mapa-suggestions">
										{sugsPrincipal.map((name, idx) => (
											<li key={idx} onClick={() => { setSelectedPrincipalName(name); setCallePrincipal(name); setSugsPrincipal([]); }}>
												{name}
											</li>
										))}
									</ul>
								)}
								<input
									type="text"
									className="visual-mapa-input"
									placeholder="Calle secundaria"
									value={calleSecundaria}
									onChange={e => { setCalleSecundaria(e.target.value); setSelectedSecundariaName(""); }}
									autoComplete="off"
								/>
								{sugsSecundaria.length > 0 && (
									<ul className="visual-mapa-suggestions">
										{sugsSecundaria.map((name, idx) => (
											<li key={idx} onClick={() => { setSelectedSecundariaName(name); setCalleSecundaria(name); setSugsSecundaria([]); }}>
												{name}
											</li>
										))}
									</ul>
								)}
								<button
									className="visual-mapa-btn"
									disabled={!(selectedPrincipalName && selectedSecundariaName) || findingIntersection}
									onClick={() => handleSelectInterseccion(selectedPrincipalName, selectedSecundariaName)}
									style={{ marginTop: 8 }}
								>{findingIntersection ? "Buscando…" : "Agregar marcador por intersección"}</button>
							</div>
							<div className="visual-mapa-form-section">
								<h3>Opción 2: Dirección exacta</h3>
								<input
									type="text"
									className="visual-mapa-input"
									placeholder="Dirección exacta"
									value={direccion}
									onChange={e => { setDireccion(e.target.value); setSelectedDireccion(null); }}
									onKeyDown={handleDireccionKeyDown}
									autoComplete="off"
								/>
								{sugsDireccion.length > 0 && (
									<ul className="visual-mapa-suggestions">
										{sugsDireccion.map((s, idx) => (
											<li key={idx} onClick={() => { setSelectedDireccion(s); setDireccion(s.display_name); setSugsDireccion([]); }}>
												{s.display_name}
											</li>
										))}
									</ul>
								)}
								<button
									className="visual-mapa-btn"
									disabled={!(selectedDireccion || direccion.trim().length >= 3)}
									onClick={handleAddDireccion}
									style={{ marginTop: 8 }}
								>Agregar marcador por dirección</button>
							</div>
							{statusMsg && (
								<div style={{ marginTop: 8, color: "#9c1c1c", fontSize: 14 }}>{statusMsg}</div>
							)}
						</div>
					</div>
					<div className="visual-mapa-map-wrapper">
						<MapContainer center={INITIAL_POSITION} zoom={MAP_ZOOM} style={{ height: "400px", width: "100%", marginTop: 24, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.10)" }}>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							{markers.map((m, idx) => (
								<Marker key={idx} position={m.position} icon={markerIcon}>
									<Popup>{m.info}</Popup>
								</Marker>
							))}
						</MapContainer>
					</div>
				</div>
			</main>
		</div>
	);
};

export default VisualMapa;

