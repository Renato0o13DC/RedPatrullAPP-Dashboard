import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../adminbi/dashboard/dashboard.css";
import "./visual_mapa.css";
import { FaSpinner } from "react-icons/fa";
import { getFirestore, collection, query, onSnapshot } from "firebase/firestore";
import { IoMapSharp } from "react-icons/io5";


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
	const [successMsg, setSuccessMsg] = useState(""); // éxito al agregar dirección

	// Ocultar banner de éxito automáticamente
	useEffect(() => {
		if (!successMsg) return;
		const t = setTimeout(() => setSuccessMsg(""), 4000);
		return () => clearTimeout(t);
	}, [successMsg]);

	// Estado y referencias para patrulleros en tiempo real
	const patrolDataRef = useRef({}); // id -> datos actuales (para cálculos y expiración)
	const db = getFirestore();
	const mapRef = useRef(null); // instancia Leaflet Map
	const [patrolCount, setPatrolCount] = useState(0); // contador visible (solo activos <=2min)
	const [patrolMarkers, setPatrolMarkers] = useState([]); // lista renderizada por React-Leaflet
	const buildStamp = process.env.REACT_APP_BUILD_STAMP || '';
	const [sidebarOpen, setSidebarOpen] = useState(false); // responsive sidebar toggle

	// Verificar si existe el ícono personalizado; si falla, usar fallback Leaflet
	const [hasPatrullaIcon, setHasPatrullaIcon] = useState(true);
	useEffect(() => {
		const img = new Image();
		const url = (process.env.PUBLIC_URL || '') + '/icons/patrulla.png';
		img.onload = () => setHasPatrullaIcon(true);
		img.onerror = () => setHasPatrullaIcon(false);
		img.src = url;
	}, []);

	// Ícono para patrullas activas (memoizado con fallback)
	const patrullaIcon = useMemo(() => {
		if (hasPatrullaIcon) {
			return L.icon({
				iconUrl: '/icons/patrulla.png',
				iconSize: [38, 38],
				iconAnchor: [19, 38]
			});
		}
		return L.icon({
			iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
			shadowSize: [41, 41]
		});
	}, [hasPatrullaIcon]);

	// Formatear timestamp Firestore
	const formatTimestamp = (ts) => {
		try {
			if (!ts) return "--";
			const d = ts.toDate ? ts.toDate() : ts;
			return d.toLocaleString("es-CL", { hour12: false });
		} catch { return "--"; }
	};

	// Popup HTML seguro
	const makePopupHTML = (nombre, ts) => (
		`<div style="min-width:140px"><strong>${nombre || "Patrulla"}</strong><br/><small>${formatTimestamp(ts)}</small></div>`
	);

	// Distancia Haversine en metros
	const distMeters = (lat1, lon1, lat2, lon2) => {
		const R = 6371000;
		const toRad = (d) => d * Math.PI / 180;
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
		return 2 * R * Math.asin(Math.sqrt(a));
	};

	// Función opcional para obtener la patrulla más cercana a una coordenada
	const calcularPatrullaMasCercana = (lat, lon) => {
		let mejor = null; let mejorDist = Infinity;
		patrolMarkers.forEach(p => {
			if (typeof p.latitud !== 'number' || typeof p.longitud !== 'number') return;
			const dm = distMeters(lat, lon, p.latitud, p.longitud);
			if (dm < mejorDist) {
				mejorDist = dm;
				mejor = { ...p, distanciaMetros: dm };
			}
		});
		return mejor; // { id, nombre, distanciaMetros, ultima_actualizacion, latitud, longitud }
	};

	// Exponer para debugging (opcional)
	useEffect(() => {
		window.calcularPatrullaMasCercana = calcularPatrullaMasCercana;
	}, []);

	// Función para actualizar marcadores activos (agregar/actualizar/eliminar)
	const updateActivePatrolMarkers = (lista) => {
		// Normalizar y asegurar campos
		const cleaned = lista.filter(p => typeof p.latitud === 'number' && typeof p.longitud === 'number')
			.map(p => ({
				id: p.id,
				nombre: p.nombre || `Patrulla ${p.id.slice(-4)}`,
				latitud: p.latitud,
				longitud: p.longitud,
				ultima_actualizacion: p.ultima_actualizacion
			}));
		setPatrolMarkers(cleaned);
	};

	// Suscripción tiempo real + filtrado de activos (<= 2 min)
	useEffect(() => {
		const q = query(collection(db, 'patrulleros_activos'));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			const ahora = Date.now();
			const activos = [];
			snapshot.forEach(doc => {
				const data = doc.data() || {};
				const ms = data.ultima_actualizacion?.toMillis?.() ?? 0;
				if (ahora - ms <= 120000) {
					activos.push({ id: doc.id, ...data });
					// mantener cache para cálculos (nearest)
					patrolDataRef.current[doc.id] = {
						nombre: data.nombre,
						ultima_actualizacion: data.ultima_actualizacion,
						_lat: data.latitud,
						_lon: data.longitud
					};
				}
			});
			// actualizar contador y marcadores
			setPatrolCount(activos.length);
			updateActivePatrolMarkers(activos.map(p => ({
				id: p.id,
				nombre: p.nombre || `Patrulla ${p.id.slice(-4)}`,
				ultima_actualizacion: p.ultima_actualizacion,
				latitud: p.latitud,
				longitud: p.longitud
			})));
		});
		return () => unsubscribe();
	}, [db]);

	// Intervalo para expirar marcadores (patrullas que dejaron de actualizarse sin snapshot nuevo)
	useEffect(() => {
		const interval = setInterval(() => {
			const ahora = Date.now();
			const activos = [];
			Object.entries(patrolDataRef.current).forEach(([id, d]) => {
				const ms = d.ultima_actualizacion?.toMillis?.() ?? (d.ultima_actualizacion instanceof Date ? d.ultima_actualizacion.getTime() : 0);
				if (ahora - ms <= 120000) {
					activos.push({ id, nombre: d.nombre, ultima_actualizacion: d.ultima_actualizacion, latitud: d._lat, longitud: d._lon });
				}
			});
			setPatrolCount(activos.length);
			updateActivePatrolMarkers(activos);
		}, 30000);
		return () => clearInterval(interval);
	}, []);

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

		// Normalización avanzada para regex (prefijos y tildes)
		const makeStreetRegex = (name) => {
			const n = (name || "").trim().replace(/\s+/g, " ");
			if (!n) return "";
			// construir clase de tildes (insensible a acentos)
			const esc = (s) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
			const diacritics = (s) => esc(s)
				.replace(/a/gi, "[aáàäâ]")
				.replace(/e/gi, "[eéèëê]")
				.replace(/i/gi, "[iíìïî]")
				.replace(/o/gi, "[oóòöô]")
				.replace(/u/gi, "[uúùüû]")
				.replace(/ñ/gi, "[nñ]");
			// prefijos comunes: Avenida/Av/Avda/Calle/Cll/Pasaje/Pje
			const prefixPattern = "(?:Avenida|Av\\.?|Avda\\.?|Calle|Cll\\.?|Pasaje|Pje\\.?)\\s+";
			const lower = n.toLowerCase();
			const hasPrefix = /^(avenida|av\.?|avda\.?|calle|cll\.?|pasaje|pje\.?)\s+/i.test(lower);
			const rest = hasPrefix ? n.replace(/^(?:Avenida|Av\.?|Avda\.?|Calle|Cll\.?|Pasaje|Pje\.?)\s+/i, "") : n;
			const body = diacritics(rest);
			return hasPrefix ? `^${prefixPattern}${body}$` : `^${body}$`;
		};

		const overpassFindIntersection = async (p, s) => {
			const pRegex = makeStreetRegex(p);
			const sRegex = makeStreetRegex(s);
			if (!pRegex || !sRegex) return null;

			// 1) Intento: intersección exacta (nodo compartido)
			let ql = `
				[out:json][timeout:25];
				area[name~"Pudahuel",i][boundary="administrative"]->.a;
				way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${pRegex}",i]->.w1;
				way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${sRegex}",i]->.w2;
				node(w.w1)->.n1;
				node(w.w2)->.n2;
				node.n1.n2;out qt;`;

			const servers = [
				"https://overpass-api.de/api/interpreter",
				"https://overpass.kumi.systems/api/interpreter"
			];

			for (const url of servers) {
				try {
					let res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: ql });
					if (res.ok) {
						const j = await res.json();
						if (j && Array.isArray(j.elements) && j.elements.length > 0) {
							const node = j.elements.find(e => e.type === "node" && typeof e.lat === "number" && typeof e.lon === "number");
							if (node) return { lat: node.lat, lon: node.lon };
						}
					}

					// 2) Fallback: no hay nodo compartido; buscar el par de nodos más cercano entre ambas vías (< 25m)
					const qlGeom = `
						[out:json][timeout:25];
						area[name~"Pudahuel",i][boundary="administrative"]->.a;
						way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${pRegex}",i]->.w1;
						way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${sRegex}",i]->.w2;
						node(w.w1);out;\nnode(w.w2);out;`;
					res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: qlGeom });
					if (!res.ok) continue;
					const j2 = await res.json();
					if (!j2 || !Array.isArray(j2.elements)) continue;
					const n1 = [];
					const n2 = [];
					// dividir los nodos en dos grupos según orden: primero vienen n1, luego n2
					// detectamos corte buscando un cambio grande en ids o simplemente partimos a la mitad si no hay mejor forma
					// mejor: volvamos a hacer dos llamadas separadas para evitar ambigüedad
				} catch (_) { /* try next server */ }
			}

			// Si llegamos aquí, hacemos 2 llamadas separadas para garantizar agrupación correcta
			try {
				const q1 = `
					[out:json][timeout:25];
					area[name~"Pudahuel",i][boundary="administrative"]->.a;
					way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${pRegex}",i]->.w1;node(w.w1);out;`;
				const q2 = `
					[out:json][timeout:25];
					area[name~"Pudahuel",i][boundary="administrative"]->.a;
					way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${sRegex}",i]->.w2;node(w.w2);out;`;
				const [r1, r2] = await Promise.all([
					fetch(servers[0], { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: q1 }).catch(() => null),
					fetch(servers[0], { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: q2 }).catch(() => null)
				]);
				const e1 = r1 && r1.ok ? await r1.json() : null;
				const e2 = r2 && r2.ok ? await r2.json() : null;
				const nodes1 = (e1?.elements || []).filter(e => e.type === "node");
				const nodes2 = (e2?.elements || []).filter(e => e.type === "node");
				if (nodes1.length && nodes2.length) {
					// 2a) buscar nodo con id compartido
					const ids1 = new Set(nodes1.map(n => n.id));
					for (const n of nodes2) {
						if (ids1.has(n.id)) return { lat: n.lat, lon: n.lon };
					}
					// 2b) si no hay nodo compartido, elegir el par de nodos más cercano (< 25m)
					const R = 6371000; // m
					const toRad = (deg) => (deg * Math.PI) / 180;
					const dist = (a, b) => {
						const dLat = toRad(b.lat - a.lat);
						const dLon = toRad(b.lon - a.lon);
						const lat1 = toRad(a.lat);
						const lat2 = toRad(b.lat);
						const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
						return 2 * R * Math.asin(Math.sqrt(h));
					};
					let best = { d: Infinity, a: null, b: null };
					for (const a of nodes1) {
						for (const b of nodes2) {
							const d = dist({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
							if (d < best.d) best = { d, a, b };
						}
					}
					if (best.d < 25) { // umbral 25m
						// punto medio como aproximación de intersección
						return { lat: (best.a.lat + best.b.lat)/2, lon: (best.a.lon + best.b.lon)/2 };
					}
				}
			} catch (_) { /* noop */ }

			return null;
		};

		// Estado de carga para dirección exacta
		const [findingAddress, setFindingAddress] = useState(false);

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
					// Lógica original solo cliente (Nominatim + Overpass)
					let target = null;
					// Intentar resolver la intersección usando "calle1 & calle2" restringido a Pudahuel; probar ambos órdenes
						const q1 = `${p} & ${s}`;
						let res = await fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(q1)}&${COMMON_PARAMS}`);
						let data = await res.json();
						target = Array.isArray(data) && data.length > 0 ? data[0] : null;
					if (!target) {
						const q2 = `${s} & ${p}`;
						res = await fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(q2)}&${COMMON_PARAMS}`);
						data = await res.json();
							target = Array.isArray(data) && data.length > 0 ? data[0] : null;
						}
					if (!target) {
						// Intento adicional: usar separador " y " además de " & "
						const qY = `${p} y ${s}`;
						res = await fetch(`${NOM_BASE}?city=Pudahuel&street=${encodeURIComponent(qY)}&${COMMON_PARAMS}`);
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
		setSuccessMsg("Ubicación agregada correctamente");
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
		// Intento 0: búsqueda estructurada calle + número en Pudahuel
		const splitStreetNumber = (text) => {
			const m = (text || "").trim().match(/(.+?)\s+(\d+[A-Za-z0-9\-\/]*)$/);
			if (m) return { street: m[1].trim(), number: m[2].trim() };
			return { street: text.trim(), number: "" };
		};
		try {
			const { street, number } = splitStreetNumber(query);
			if (street && number) {
				const url = `${NOM_BASE}?street=${encodeURIComponent(`${street} ${number}`)}&city=Pudahuel&${COMMON_PARAMS}`;
				const r = await fetch(url);
				if (r.ok) {
					const d = await r.json();
					if (Array.isArray(d) && d.length > 0) return d[0];
				}
			}
		} catch (_) { /* noop */ }
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
		setFindingAddress(true);
		try {
			const geo = await geocodeDireccion(q);
			if (geo) {
				handleSelectDireccion(geo);
			} else {
				setStatusMsg("No se encontró la dirección. Ajusta el texto e intenta nuevamente.");
			}
		} finally {
			setFindingAddress(false);
		}
	};

	return (
		<div className="dashboard-layout">
			<aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
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
			{sidebarOpen && <div className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} />}
			<main className="dashboard-main-content">
				<header className="dashboard-header" style={{ position: "relative" }}>
					<button
						className="sidebar-toggle-btn"
						onClick={() => setSidebarOpen(o=>!o)}
						aria-label="Toggle sidebar"
					>☰</button>
					<span className="dashboard-header-title">Central de Cámaras</span>
					<div style={{position:'absolute',right:16,top:8,background:'#1e293b',color:'#fff',padding:'4px 10px',borderRadius:8,fontSize:14,boxShadow:'0 2px 6px rgba(0,0,0,0.15)'}}>
						Patrullas activas: {patrolCount}
					</div>
					{buildStamp && (
						<div style={{position:'absolute',left:16,top:8,background:'#334155',color:'#cbd5e1',padding:'4px 10px',borderRadius:8,fontSize:12,boxShadow:'0 2px 6px rgba(0,0,0,0.12)'}}>
							Build: {buildStamp}
						</div>
					)}
				</header>
				<div className="visual-mapa-content">
					{successMsg && (
						<div className="visual-mapa-success" role="status" aria-live="polite" style={{marginBottom:12}}>
							<span>✔</span>{successMsg}
						</div>
					)}
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
								>
									{findingIntersection ? (
										<span>Buscando… <FaSpinner className="spinner-icon" /></span>
									) : (
										"Agregar marcador por intersección"
									)}
								</button>
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
									disabled={findingAddress || !(selectedDireccion || direccion.trim().length >= 3)}
									onClick={handleAddDireccion}
									style={{ marginTop: 8 }}
								>
									{findingAddress ? (
										<span>Buscando… <FaSpinner className="spinner-icon" /></span>
									) : (
										"Agregar marcador por dirección"
									)}
								</button>
							</div>
							{statusMsg && (
								<div style={{ marginTop: 8, color: "#9c1c1c", fontSize: 14 }}>{statusMsg}</div>
							)}
						</div>
					</div>
					<div className="visual-mapa-map-wrapper">
						<MapContainer whenCreated={(map)=>{mapRef.current = map;}} center={INITIAL_POSITION} zoom={MAP_ZOOM} style={{ height: "400px", width: "100%", marginTop: 24, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.10)" }}>
							<TileLayer
								attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
								url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
							/>
							{markers.map((m, idx) => (
								<Marker key={`static-${idx}`} position={m.position} icon={markerIcon}>
									<Popup>{m.info}</Popup>
								</Marker>
							))}
							{patrolMarkers.map(p => (
								<Marker key={`patrol-${p.id}`} position={[p.latitud, p.longitud]} icon={patrullaIcon}>
									<Popup>
										<strong>{p.nombre}</strong><br />
										<small>{formatTimestamp(p.ultima_actualizacion)}</small>
									</Popup>
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

