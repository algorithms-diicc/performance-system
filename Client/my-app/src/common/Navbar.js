import React from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import './Navbar.css';
import { Link } from "react-router-dom";

function Navbar({ tasksState }) {
    const isAnyTaskActive = Object.values(tasksState).some(Boolean);
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <div className="container">
                <Link to="/" className="navbar-brand">Performace System</Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse justify-content-center" id="navbarNav">
                    <ul className="navbar-nav">
                        <li className="nav-item active">
                            <Link to="/" className="nav-link">Test</Link>
                        </li>
                        {/* <li className="nav-item active">
                          <Link to="/compare" className="nav-link">Compare</Link>
                      </li>
                      <li className="nav-item">
                      <Link to="/taskpage" className="nav-link">
            Task-info 
            {isAnyTaskActive && <span className="white-dot"></span>}
          </Link>
                      </li> */}
                        <li className="nav-item">
                            <Link to="/tutorial" className="nav-link">  📄 Tutorial y Ejemplos</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
