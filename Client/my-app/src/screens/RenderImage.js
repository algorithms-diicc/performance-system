import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import RenderTable from './RenderTable'

function RenderImage({codeList}) {
  const navigate = useNavigate();
  const codename = useParams().codename;
  const name = useLocation().state.name;
  const link = `http://127.0.0.1:5000/static/${codename}/`;

  useEffect(() => {
    console.log("file names from renderImage:  ", codeList);
    document.title = `Power-tester: ${name}`;
  }, [name]);

  return (
    <div>
      <div className="row">
        <button type="button" className="buttonv" onClick={() => navigate(-1)}>Volver</button>
        <button type="button" className="buttonv" onClick={handleDownload} style={{ float: "right" }}>Descargar CSV</button>
        <h1>{name}</h1>
      </div>
      {/* <div className="cat">
        <h2>Tabla de Promedios</h2>
        <RenderTable code={codename} />
      </div> */}
      <div className="cat">
        <h2>Energía y rendimiento de CPU</h2>
        <PlotIframe src={`${link}fig0.html`} />
        <PlotIframe src={`${link}fig1.html`} />
        <PlotIframe src={`${link}fig2.html`} />
        <PlotIframe src={`${link}fig3.html`} />
        <PlotIframe src={`${link}fig4.html`} />
        <PlotIframe src={`${link}fig5.html`} />
        <PlotIframe src={`${link}fig6.html`} />
        <PlotIframe src={`${link}fig7.html`} />
        <PlotIframe src={`${link}fig8.html`} />
        <PlotIframe src={`${link}fig9.html`} />
        <PlotIframe src={`${link}fig10.html`} />
        <PlotIframe src={`${link}fig11.html`} />
        <PlotIframe src={`${link}fig12.html`} />
        <PlotIframe src={`${link}fig13.html`} />
        <PlotIframe src={`${link}fig14.html`} />
        <PlotIframe src={`${link}fig15.html`} />
        <PlotIframe src={`${link}fig16.html`} />
      </div>
    </div>
  );

  function handleDownload(event) {
    axios({
      url: 'http://127.0.0.1:5000/static/' + codename + '/' + codename + 'ResultsFinal.csv',
      method: 'GET',
      responseType: 'blob', // important
    })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'results.csv');
        document.body.appendChild(link);
        link.click();
      });
  }

  function PlotIframe({ src }) {
    return <iframe src={src} title="Plot" style={{ width: "100%", height: "500px", border: "none" }}></iframe>;
  }
}

export default RenderImage;
