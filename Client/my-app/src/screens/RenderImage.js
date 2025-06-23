import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import RenderTable from './RenderTable';
import { serverURL } from "../common/Constants";

function RenderImage({ codeList }) {
  const navigate = useNavigate();
  const codename = useParams().codename;
  const name = useLocation().state.name;
  const [plotFiles, setPlotFiles] = useState([]);
  const link = `${serverURL}files/${codename}/`;

  useEffect(() => {
    document.title = `Performance-System: ${name}`;
    fetchPlots();
  }, [name]);

  const fetchPlots = async () => {
    try {
      const response = await axios.get(`${serverURL}files/${codename}`);
      const htmls = response.data
        .split('\n')
        .filter(filename => filename.trim().endsWith('.html'));
      console.log("Archivos HTML recibidos:", htmls);
      setPlotFiles(htmls);
    } catch (error) {
      console.error("No se pudieron cargar los gráficos:", error);
    }
  };

  const handleDownload = () => {
    // CSV combinado en carpeta del codename (funciona tanto con 1 como varios cpp)
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
      style={{ width: "100%", height: "500px", border: "none" }}
    ></iframe>
  );

  return (
    <div>
      <div className="row">
        <button type="button" className="buttonv" onClick={() => navigate(-1)}>Volver</button>
        <button type="button" className="buttonv" onClick={handleDownload} style={{ float: "right" }}>
          Descargar CSV
        </button>
        <h1>{name}</h1>
      </div>

      <div className="cat">
        <h2>Gráficos de las Métricas</h2>
        {plotFiles.map((file, index) => (
          <div key={index}>
            <h4>{file.replace(".html", "")}</h4>
            <PlotIframe src={`${link}${file}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default RenderImage;
