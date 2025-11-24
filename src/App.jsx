import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/login/loginpage";
import Dashboard from "./pages/adminbi/dashboard/dashboard";
import TablaGeneral from "./pages/adminbi/dashboard/TablaGeneral";
import LandingPage from "./pages/landingpage/landingpage";
import ProtectedRoute from "./components/ProtectedRoute";
import MapaCalor from "./pages/adminbi/mapa de calor/mapacalor";
import VisualMapa from "./pages/central_camaras/visual_mapa";
import VehiculosMantenimiento from "./pages/vehiculos/VehiculosMantenimiento";
import TurnosConductores from "./pages/TurnosConductores/TurnosConductores";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} /> {/* <-- agrega esta línea */}
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tabla-general"
          element={
            <ProtectedRoute>
              <TablaGeneral />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mapacalor"
          element={
            <ProtectedRoute>
              <MapaCalor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visual_mapa"
          element={
            <ProtectedRoute>
              <VisualMapa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehiculos"
          element={
            <ProtectedRoute>
              <VehiculosMantenimiento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/turnos"
          element={
            <ProtectedRoute>
              <TurnosConductores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/landingpage"
          element={
            <LandingPage />
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;