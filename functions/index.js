const functions = require("firebase-functions");
const fetch = require("node-fetch");

// Utility: build accent-insensitive regex string and support common prefixes
function makeStreetRegex(name) {
  const n = (name || "").trim().replace(/\s+/g, " ");
  if (!n) return "";
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const diacritics = (s) => esc(s)
    .replace(/a/gi, "[aáàäâ]")
    .replace(/e/gi, "[eéèëê]")
    .replace(/i/gi, "[iíìïî]")
    .replace(/o/gi, "[oóòöô]")
    .replace(/u/gi, "[uúùüû]")
    .replace(/ñ/gi, "[nñ]");
  const lower = n.toLowerCase();
  const hasPrefix = /^(avenida|av\.?|avda\.?|calle|cll\.?|pasaje|pje\.?)\s+/i.test(lower);
  const rest = hasPrefix ? n.replace(/^(?:Avenida|Av\.?|Avda\.?|Calle|Cll\.?|Pasaje|Pje\.?)\s+/i, "") : n;
  const body = diacritics(rest);
  const prefixPattern = "(?:Avenida|Av\\.?|Avda\\.?|Calle|Cll\\.?|Pasaje|Pje\\.?)\\s+";
  return hasPrefix ? `^${prefixPattern}${body}$` : `^${body}$`;
}

// Haversine distance in meters
function haversine(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function overpassIntersection(street1, street2, city) {
  const pRegex = makeStreetRegex(street1);
  const sRegex = makeStreetRegex(street2);
  if (!pRegex || !sRegex) return null;

  const servers = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  const areaName = city || "Pudahuel";

  // 1) Try exact shared node intersection
  const ql = `
    [out:json][timeout:25];
    area[name~"${areaName}",i][boundary="administrative"]->.a;
    way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${pRegex}",i]->.w1;
    way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${sRegex}",i]->.w2;
    node(w.w1)->.n1;
    node(w.w2)->.n2;
    node.n1.n2;out qt;`;

  for (const url of servers) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: ql });
      if (res.ok) {
        const j = await res.json();
        if (j && Array.isArray(j.elements) && j.elements.length > 0) {
          const node = j.elements.find(e => e.type === "node" && typeof e.lat === "number" && typeof e.lon === "number");
          if (node) return { lat: node.lat, lon: node.lon, method: "overpass-node" };
        }
      }
    } catch { /* try next */ }
  }

  // 2) Fallback: fetch nodes separately and compute nearest nodes
  const q1 = `
    [out:json][timeout:25];
    area[name~"${areaName}",i][boundary="administrative"]->.a;
    way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${pRegex}",i]->.w1;node(w.w1);out;`;
  const q2 = `
    [out:json][timeout:25];
    area[name~"${areaName}",i][boundary="administrative"]->.a;
    way(area.a)["highway"][~"^(name|alt_name|official_name|name:es)$"~"${sRegex}",i]->.w2;node(w.w2);out;`;

  try {
    const [r1, r2] = await Promise.all([
      fetch(servers[0], { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: q1 }).catch(() => null),
      fetch(servers[0], { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: q2 }).catch(() => null)
    ]);
    const e1 = r1 && r1.ok ? await r1.json() : null;
    const e2 = r2 && r2.ok ? await r2.json() : null;
    const nodes1 = (e1?.elements || []).filter(e => e.type === "node");
    const nodes2 = (e2?.elements || []).filter(e => e.type === "node");
    if (nodes1.length && nodes2.length) {
      const ids1 = new Set(nodes1.map(n => n.id));
      for (const n of nodes2) {
        if (ids1.has(n.id)) return { lat: n.lat, lon: n.lon, method: "overpass-node" };
      }
      let best = { d: Infinity, a: null, b: null };
      for (const a of nodes1) {
        for (const b of nodes2) {
          const d = haversine({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
          if (d < best.d) best = { d, a, b };
        }
      }
      if (best.d < 30) {
        return { lat: (best.a.lat + best.b.lat)/2, lon: (best.a.lon + best.b.lon)/2, method: "overpass-nearest", distance: best.d };
      }
    }
  } catch {}

  return null;
}

async function nominatimIntersection(street1, street2, city) {
  const NOM_BASE = "https://nominatim.openstreetmap.org/search";
  const COMMON = `format=jsonv2&addressdetails=1&accept-language=es&countrycodes=cl&limit=6`;
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : "";
  const combos = [
    `${street1} & ${street2}`,
    `${street2} & ${street1}`,
    `${street1} y ${street2}`,
    `${street2} y ${street1}`,
    `${street1} & ${street2}, ${city || ""}`.trim()
  ];
  for (const q of combos) {
    try {
      const url = `${NOM_BASE}?${cityParam}&street=${encodeURIComponent(q)}&${COMMON}`;
  const res = await fetch(url, { headers: { "User-Agent": "RedPatrullAPP/1.0 (educational use)" }});
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const t = data[0];
        if (t?.lat && t?.lon) return { lat: parseFloat(t.lat), lon: parseFloat(t.lon), method: "nominatim" };
      }
    } catch {}
  }
  return null;
}

exports.interseccion = functions.https.onRequest(async (req, res) => {
  // Basic CORS allow for GET from same origin / localhost (adjust as needed)
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  try {
    const street1 = (req.query.street1 || "").toString();
    const street2 = (req.query.street2 || "").toString();
    const city = (req.query.city || "Pudahuel").toString();
    if (!street1 || !street2) {
      res.status(400).json({ error: "Missing street1 or street2" });
      return;
    }

    const over = await overpassIntersection(street1, street2, city);
    if (over) {
      res.set("Cache-Control", "public, max-age=3600");
      res.json({ ...over, source: "overpass", city });
      return;
    }

    const nom = await nominatimIntersection(street1, street2, city);
    if (nom) {
      res.set("Cache-Control", "public, max-age=600");
      res.json({ ...nom, source: "nominatim", city });
      return;
    }

    res.status(404).json({ error: "Intersection not found" });
  } catch (e) {
    res.status(500).json({ error: "Internal error" });
  }
});
