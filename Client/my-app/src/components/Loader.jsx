import React from "react";
import "./Loader.css";

const Loader = () => {
    return (
        <div className="ps-loader-container">
            <svg className="ps-loader-circle" viewBox="0 0 50 50">
                <circle
                    className="ps-loader-path"
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    strokeWidth="4"
                />
            </svg>

            <span className="ps-loader-text">Cargando...</span>
        </div>
    );
};

export default Loader;
