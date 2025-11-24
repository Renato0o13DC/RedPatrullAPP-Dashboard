import React, { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { app } from '../../../lib/firebase';
import '../dashboard/dashboard.css';
import { FaHome, FaTable, FaCar, FaUser, FaEye } from 'react-icons/fa';
import { IoMapSharp } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const formatoFechaCorta = (fecha) => {
  if (fecha && typeof fecha === 'object' && typeof fecha.toDate === 'function') {
    const d = fecha.toDate();
    const day = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }
  if (typeof fecha === 'string') return fecha;
  return '-';
};

export default function TablaGeneral() {
  const [reportesFull, setReportesFull] = useState([]);
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const [imagenExpandida, setImagenExpandida] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const db = getFirestore(app);
      const querySnapshot = await getDocs(collection(db, 'reportes'));
      const list = [];
      querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      // ordenar por fecha descendente
      list.sort((a,b) => {
        const fa = a.fecha && typeof a.fecha.toDate==='function' ? a.fecha.toDate() : new Date(0);
        const fb = b.fecha && typeof b.fecha.toDate==='function' ? b.fecha.toDate() : new Date(0);
        return fb - fa;
      });
      setReportesFull(list);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) navigate('/login', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch {}
  };

  const formatoFechaLarga = (fecha) => {
    if (fecha && typeof fecha === 'object' && typeof fecha.toDate === 'function') {
      return fecha.toDate().toLocaleString('es-CL');
    }
    if (typeof fecha === 'string') return fecha;
    return '-';
  };

  if (authLoading) return null;

  return (
    <div className='dashboard-layout'>
      <aside className='dashboard-sidebar'>
        <div className='sidebar-logo'>
          <img src='img/icono-1514.png' alt='Logo' />
        </div>
        <nav className='sidebar-nav'>
          <a href='#' className='sidebar-link' onClick={(e)=>{e.preventDefault(); navigate('/dashboard');}}><FaHome /><span>Inicio</span></a>
          <a href='#' className='sidebar-link' onClick={(e)=>{e.preventDefault(); navigate('/mapacalor');}}><IoMapSharp /><span>Mapa de Calor</span></a>
          <a href='#' className='sidebar-link active' onClick={(e)=>e.preventDefault()}><FaTable /><span>Tabla General</span></a>
          <a href='#' className='sidebar-link' onClick={(e)=>{e.preventDefault(); navigate('/vehiculos');}}><FaCar /><span>Vehículos y Mantenimiento</span></a>
          <a href='#' className='sidebar-link' onClick={(e)=>{e.preventDefault(); navigate('/turnos');}}><FaUser /><span>Conductores y Turnos</span></a>
        </nav>
        <div className='sidebar-footer'><span>2025</span></div>
      </aside>
      <main className='dashboard-main-content'>
        <header className='dashboard-header' style={{ position:'relative' }}>
          <span className='dashboard-header-title'>Tabla General de Reportes</span>
          {user && (
            <button onClick={handleLogout} style={{ position:'absolute', top:8, right:12, background:'#fff', color:'#000', border:'1px solid #ccc', padding:'6px 12px', fontSize:12, borderRadius:4, cursor:'pointer' }}>Logout</button>
          )}
        </header>
        <section style={{ padding:'24px 34px 40px' }}>
          <div className='dashboard-card' style={{ overflowX:'auto' }}>
            <h2>Tabla General de Reportes</h2>
            <table className='tabla-general-table'>
              <thead>
                <tr>
                  <th>Tipo de Incidente</th>
                  <th>Fecha</th>
                  <th>Dirección</th>
                  <th>Patrullero</th>
                  <th>Ver</th>
                </tr>
              </thead>
              <tbody>
                {reportesFull.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center' }}>Sin datos</td></tr>
                ) : (
                  reportesFull.map(r => {
                    const fechaTxt = formatoFechaCorta(r.fecha);
                    return (
                      <tr key={r.id}>
                        <td>{r.tipo_incidente || '-'}</td>
                        <td>{fechaTxt}</td>
                        <td>{r.direccion || r.intersecciones || '-'}</td>
                        <td>{r.nombre_patrullero || '-'}</td>
                        <td>
                          <button className='tabla-general-eye-btn' onClick={() => setReporteSeleccionado(r)}><FaEye /></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        {reporteSeleccionado && (
          <div className='reporte-modal-overlay' onClick={() => setReporteSeleccionado(null)}>
            <div className='reporte-modal' onClick={(e)=>e.stopPropagation()}>
              <button className='reporte-modal-close' onClick={() => setReporteSeleccionado(null)}>×</button>
              <h3>Detalle del Reporte</h3>
              <div className='reporte-modal-content'>
                <p><strong>Tipo:</strong> {reporteSeleccionado.tipo_incidente || '-'}</p>
                <p><strong>Fecha:</strong> {formatoFechaLarga(reporteSeleccionado.fecha)}</p>
                <p><strong>Dirección / Intersecciones:</strong> {reporteSeleccionado.direccion || reporteSeleccionado.intersecciones || '-'}</p>
                <p><strong>Patrullero:</strong> {reporteSeleccionado.nombre_patrullero || '-'}</p>
                <p><strong>Turno:</strong> {reporteSeleccionado.turno || '-'}</p>
                {reporteSeleccionado.observaciones && <p><strong>Observaciones:</strong> {reporteSeleccionado.observaciones}</p>}
                {Array.isArray(reporteSeleccionado.imagenes) && reporteSeleccionado.imagenes.length > 0 && (
                  <div>
                    <strong>Imágenes:</strong>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
                      {reporteSeleccionado.imagenes.map((url, idx) => (
                        <img key={idx} src={url} alt={`img-${idx}`} style={{ width:120, height:90, objectFit:'cover', borderRadius:4, border:'1px solid #ddd', cursor:'zoom-in' }} onClick={() => setImagenExpandida(url)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {imagenExpandida && (
          <div className='imagen-full-overlay' onClick={()=>setImagenExpandida(null)}>
            <img src={imagenExpandida} alt='imagen-reporte' className='imagen-full' onClick={(e)=>e.stopPropagation()} />
            <button className='imagen-full-close' onClick={()=>setImagenExpandida(null)}>×</button>
          </div>
        )}
      </main>
    </div>
  );
}
