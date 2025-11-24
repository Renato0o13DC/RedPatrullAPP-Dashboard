import { Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../lib/firebase";
import React, { useEffect, useState } from "react";

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthed(u ?? null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return null; // evita redirección mientras Firebase restaura la sesión
  if (!authed) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;