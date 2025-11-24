/**
 * RedPatrullAPP - Cloudflare Worker (proxy de intersecciones)
 * - Maneja GET /api/interseccion?q=<texto libre>
 * - Llama a Nominatim (OpenStreetMap) usando fetch nativo
 * - Responde JSON con content-type UTF-8 y CORS abierto
 * - Sin dependencias externas
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Ruta única: /api/interseccion
    if (url.pathname !== "/api/interseccion") {
      return json({ error: "Not found" }, 404);
    }

    // Validar parámetro q
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) {
      return json({ error: "Falta el parámetro q" }, 400);
    }

    // Construir URL a Nominatim (sin límites artificiales)
    const nominatim = new URL("https://nominatim.openstreetmap.org/search");
    nominatim.searchParams.set("format", "jsonv2");
    nominatim.searchParams.set("addressdetails", "1");
    nominatim.searchParams.set("accept-language", "es");
    nominatim.searchParams.set("namedetails", "1");
    nominatim.searchParams.set("q", q);

    try {
      const res = await fetch(nominatim.toString(), {
        headers: {
          // User-Agent recomendado por Nominatim para evitar bloqueos
          "User-Agent": "RedPatrullAPP-Worker/1.0 (educational)",
          "Accept-Language": "es"
        }
      });

      if (!res.ok) {
        return json({ error: "No se pudo consultar Nominatim", status: res.status }, 502);
      }

      const data = await res.json();
      return json(data, 200);
    } catch (err) {
      return json({ error: "Error interno consultando Nominatim" }, 502);
    }
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Permitir ser llamado desde tu frontend (Firebase Hosting, etc.)
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }
  });
}
