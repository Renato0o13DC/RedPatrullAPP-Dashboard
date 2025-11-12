import { Navigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { app } from "../lib/firebase";

const ProtectedRoute = ({ children }) => {
  const auth = getAuth(app);
  const user = auth.currentUser;

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;