// Utilitario para exportar a Excel (.xlsx)
// Depende de: exceljs y file-saver

import ExcelJS from 'exceljs';
import { saveAs } from "file-saver";

// Formatea fecha/hora a dd/mm/yyyy HH:mm:ss
export function formatDateTime(dt) {
  try {
    let d = dt;
    if (dt && typeof dt.toDate === "function") {
      d = dt.toDate();
    } else if (typeof dt === "string") {
      d = new Date(dt);
    }
    if (!(d instanceof Date) || isNaN(d.getTime())) return "-";
    const pad = (n) => String(n).padStart(2, "0");
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const HH = pad(d.getHours());
    const MM = pad(d.getMinutes());
    const SS = pad(d.getSeconds());
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  } catch {
    return "-";
  }
}

export async function exportVehiculosToExcel(rows) {
  // rows: [{ movil, patente, kmActual, kmProxMant, createdAt }]


  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Vehículos');

  ws.columns = [
    { header: 'Móvil', key: 'movil', width: 12 },
    { header: 'Patente', key: 'patente', width: 15 },
    { header: 'Km Actual', key: 'kmActual', width: 14 },
    { header: 'Km Próx Mantención', key: 'kmProxMant', width: 22 },
    { header: 'Última actualización', key: 'lastUpdate', width: 24 }
  ];

  rows.forEach((v) => {
    ws.addRow({
      movil: v.movil ?? '',
      patente: v.patente ?? '',
      kmActual: v.kmActual ?? 0,
      kmProxMant: v.kmProxMant ?? 0,
      lastUpdate: v.lastUpdate ? formatDateTime(v.lastUpdate) : ''
    });
  });

  styleHeader(ws);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `vehiculos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Exporta turnos de conductores a Excel
// rows esperados: [{ conductor, patrullero, movil, estado, horaSalida, horaLlegada, kmRecorridos }]
export async function exportTurnosToExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Turnos');

  ws.columns = [
    { header: 'Conductor', key: 'conductor', width: 24 },
    { header: 'Patrullero', key: 'patrullero', width: 24 },
    { header: 'Móvil', key: 'movil', width: 12 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Hora Salida', key: 'hora_salida', width: 22 },
    { header: 'Hora Llegada', key: 'hora_llegada', width: 22 },
    { header: 'Km Recorridos', key: 'km_recorridos', width: 16 }
  ];

  (rows || []).forEach((r) => {
    ws.addRow({
      conductor: r.conductor ?? '-',
      patrullero: r.patrullero ?? '-',
      movil: r.movil ?? '-',
      estado: r.estado ?? '-',
      hora_salida: r.hora_salida ? formatDateTime(r.hora_salida) : (r.horaSalida ? formatDateTime(r.horaSalida) : ''),
      hora_llegada: r.hora_llegada ? formatDateTime(r.hora_llegada) : (r.horaLlegada ? formatDateTime(r.horaLlegada) : ''),
      km_recorridos: r.km_recorridos ?? r.kmRecorridos ?? ((r.km_llegada && r.km_salida) ? (r.km_llegada - r.km_salida) : '')
    });
  });

  styleHeader(ws);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `turnos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function styleHeader(ws) {
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE9EEF7' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  });
}
