import { useState } from "react";
import "./landingpage.css"; // Asegúrate de tener este archivo CSS

const LandingPage = () => {
  // Estado para el modo oscuro
  const [darkTheme, setDarkTheme] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Cambia el icono y el tema
  const handleThemeToggle = () => {
    setDarkTheme((prev) => !prev);
  };

  return (
    <div className={`hero${darkTheme ? " dark-theme" : ""}`}>
      {/* Navbar Section */}
      <nav className={menuOpen ? "open" : ""}>
        <img src="/images/logo.png" className="logo" alt="Logo" />
        <button className="lp-burger" aria-label="Menu" onClick={()=>setMenuOpen(o=>!o)}>☰</button>
        <ul className={menuOpen ? "show" : ""} onClick={()=>setMenuOpen(false)}>
          <li><a href="#">Menu</a></li>
          <li><a href="#">Deals</a></li>
          <li><a href="#">Stores</a></li>
          <li><a href="#">About</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
        <img
          src={darkTheme ? "/images/sun.png" : "/images/moon.png"}
          id="icon"
          alt="Theme icon"
          onClick={handleThemeToggle}
          style={{ cursor: "pointer" }}
        />
      </nav>

      {/* Information Section */}
      <div className="info">
        <h1>
          Refresh <span>Mood</span> on Repeat
        </h1>
        <p>
          Delicious, handcrafted beverages and great-tasting food. The secret to
          making life better. Two baristas making coffee.
        </p>
        <a href="#">
          <i className="fas fa-caret-right"></i>Order Now
        </a>
      </div>

      {/* Featured Image */}
      <div className="img-box">
        <img src="/images/coffee.png" className="main-img" alt="Coffee" />
      </div>

      {/* Social Media Icons */}
      <div className="social-links">
        <a href="#"><i className="fab fa-facebook-square"></i></a>
        <a href="#"><i className="fab fa-twitter-square"></i></a>
        <a href="#"><i className="fab fa-instagram-square"></i></a>
      </div>
    </div>
  );
};

export default LandingPage;
