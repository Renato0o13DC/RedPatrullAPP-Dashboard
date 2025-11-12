import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../../lib/firebase";
import "./loginpage.css";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      // Busca el usuario en la colección "usuarios" por su UID
      const userDocRef = doc(db, "usuarios", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        const rolRaw = data.rol || "";
        const rol = rolRaw.trim().toLowerCase();
        if (rol === "administrador") {
          navigate("/dashboard");
        } else if (rol === "central_camaras") {
          navigate("/visual_mapa");
        } else {
          await signOut(auth);
          setError("Usuario no autorizado para acceder a la plataforma.");
        }
      } else {
        await signOut(auth);
        setError("Usuario no registrado en la plataforma.");
      }
    } catch (err) {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-illustration">  
          <img src="/img/imagen_login.png" alt="login illustration" />
        </div>
        <div className="login-form-section">
          <form className="login-form" onSubmit={handleLogin}>
            <h2>Panel Administrador BI</h2>
            <label>Usuario *</label>
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label>Contraseña *</label>
            <input
              type="password"
              placeholder="Contraseña"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
            <div className="login-options">
              <label>
                <input type="checkbox" /> Recuerdame
              </label>
              <a href="#">¿Olvidaste tu contraseña?</a>
            </div>
            <button type="submit">INICIAR SESIÓN</button>
            {error && <p className="login-error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

