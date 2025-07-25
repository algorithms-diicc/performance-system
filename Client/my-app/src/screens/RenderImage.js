
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { serverURL, METRIC_CATEGORIES, METRIC_DESCRIPTIONS } from "../common/Constants";
import { Tooltip } from "react-tooltip";
import { Info, ArrowLeft, Download, Filter } from "lucide-react";
import "./RenderImage.css";

function RenderImage() {
  const navigate = useNavigate();
  const codename = useParams().codename;
  const name = useLocation().state.name;
  const [plotFiles, setPlotFiles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [statusData, setStatusData] = useState({});
  const link = `${serverURL}files/${codename}/`;

  useEffect(() => {
    document.title = `Performance-System: ${name}`;
    fetchPlots();
    fetchStatusData();
  }, [name]);

  const fetchPlots = async () => {
    try {
      const response = await axios.get(`${serverURL}files/${codename}`);
      const htmls = response.data
        .split('\n')
        .filter(filename => filename.trim().endsWith('.html'));
      setPlotFiles(htmls);
    } catch (error) {
      console.error("No se pudieron cargar los gráficos:", error);
    }
  };
  const fetchStatusData = async () => {
    try {
      const response = await axios.get(`${serverURL}status/${codename}_status.json`);
      setStatusData(response.data);
    } catch (error) {
      console.error("No se pudo obtener status JSON:", error);
    }
  };
  const handleDownload = () => {
    axios({
      url: `${serverURL}files/${codename}/CombinedResults.csv`,
      method: 'GET',
      responseType: 'blob',
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'CombinedResults.csv');
        document.body.appendChild(link);
        link.click();
      })
      .catch((error) => {
        console.error("Error al intentar descargar el CSV combinado:", error);
      });
  };

  const PlotIframe = ({ src }) => (
    <iframe
      src={src}
      title="Plot"
      style={{ width: "100%", height: "400px", border: "none" }}
    ></iframe>
  );

  const groupedFiles = {};
  plotFiles.forEach(file => {
    const metricName = file.replace(".html", "").trim();
    let found = false;
    for (const [category, metrics] of Object.entries(METRIC_CATEGORIES)) {
      if (metrics.includes(metricName)) {
        if (!groupedFiles[category]) groupedFiles[category] = [];
        groupedFiles[category].push(file);
        found = true;
        break;
      }
    }
    if (!found) {
      if (!groupedFiles["Otros"]) groupedFiles["Otros"] = [];
      groupedFiles["Otros"].push(file);
    }
  });

  const categories = ["Todas", ...Object.keys(METRIC_CATEGORIES)];
  const normalizeClassName = (str) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quitar tildes
      .replace(/\s/g, '');
  };

  return (
    <div>
      <div className="glass-header header-content">
        <div className="header-left">
          <button className="icon-button" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Volver
          </button>
        </div>
        <div className="header-center">
          <div className="test-title-with-icon">
            <h1 className="test-title">{name}</h1>
            <Info
              data-tooltip-id="tooltip-test-info"
              data-tooltip-html={`
    <div style="text-align: left;">
      <strong>🔍 Máquina Medidora</strong><br/>
      Sistema operativo: <em>Linux Mint 22 (64 bits)</em><br/>
      Procesador: <em>Intel Core i5-9400 @ 2.90GHz</em><br/>
      Memoria RAM: <em>23 GB</em><br/>
      Caché L3: <em>9 MB</em><br/>
      Caché L2: <em>256 KB</em><br/>
      Caché L1i: <em>32 KB</em><br/>
      Caché L1d: <em>32 KB</em><br/><br/>
      ⚠️ Esta máquina no es de uso exclusivo para este sistema. Por lo tanto, <strong>las mediciones pueden variar</strong> ligeramente debido a procesos concurrentes.
    </div>
  `}
              className="info-icon"
              color="#3b82f6"
              style={{ marginLeft: "6px" }}
            />
            <Tooltip id="tooltip-test-info" place="top" />
          </div>
          <div className="test-details-box">
            <p className="test-subtitle">
              Tipo de Test: <strong>{statusData.task_type}</strong> ·
              Tamaño Máximo de Entrada: <strong>{statusData.input_size}</strong> ·
              Repeticiones por Incremento: <strong>{statusData.samples}</strong>
            </p>
          </div>
        </div>
        <div className="header-controls">
          <div className="filter-container">
            <Filter size={16} style={{ marginRight: "4px" }} />
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button className="icon-button" onClick={handleDownload}>
            <Download size={18} /> CSV
          </button>
        </div>
      </div>

      <div className="metrics-title-container">
        <h2 className="metrics-title">Métricas de Rendimiento</h2>
        <p className="metrics-subtitle">Análisis detallado del rendimiento y eficiencia energética de tu código.</p>
      </div>
      {Object.entries(groupedFiles)
        .filter(([category]) => selectedCategory === "Todas" || selectedCategory === category)
        .map(([category, files]) => (
          <div key={category} className="category-group-container">
            <div className={`category-chip ${normalizeClassName(category)}`}>{category}</div>
            {files.map((file, index) => {
              const metricName = file.replace(".html", "").trim();
              const description = METRIC_DESCRIPTIONS[metricName] || "Descripción no disponible.";
              let originalFileName = "";
              if (statusData.files) {
                const match = statusData.files.find(f => metricName.includes(f.codename));
                if (match) originalFileName = match.original_filename;
              }

              return (
                <div key={index} className="metric-card">
                  <div className="metric-header">
                    <h3>{metricName}</h3>
                    <Info
                      data-tooltip-id={`tooltip-${metricName}`}
                      data-tooltip-content={description.replace(/\n/g, "<br/>")}
                      className="info-icon"
                      color="#3b82f6"
                    />
                    <Tooltip
                      id={`tooltip-${metricName}`}
                      place="top"
                      render={() => <span dangerouslySetInnerHTML={{ __html: description.replace(/\n/g, "<br/>") }} />}
                    ></Tooltip>
                  </div>
                  <div className="iframe-container">
                    <iframe
                      src={`${link}${file}`}
                      title="Plot"
                      style={{ width: "100%", height: "400px", border: "none" }}
                    ></iframe>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

export default RenderImage;
