import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import getUrl, { serverURL } from '../common/Constants.js';
import "bootstrap/dist/css/bootstrap.min.css";
import "./RenderForm.css";

function RenderDoubleForm({ tasksState }) {
  const [code, setCode] = useState("");
  const [code2, setCode2] = useState("");
  const [codename, setCodename] = useState();
  const [status, setStatus] = useState("Esperando entrada");
  const [check, setCheck] = useState(true);
  const [name, setName] = useState("test");
  var flag = "";
  var intervalID = 0;
  let navigate = useNavigate();

  useEffect(() => {
    document.title = "Power Tester";
  }, []);

  function handleSubmit(event) {
    alert("¡Enviado! Espere por el estado del código");
    event.preventDefault();
    setStatus("Esperando respuesta");
    var bodyFormData = new FormData();
    if (code) {
      bodyFormData.append("code", code);
    }
    if (code2) {
      bodyFormData.append("code2", code2);
    }

    let url = getUrl(tasksState);

    axios({
      method: "post",
      url: url,
      data: bodyFormData,
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((response) => {
        console.log(response.data, codename);
        setCodename(response.data);
        intervalID = setInterval(getStatusfromServer, 5000, response.data);
      })
      .catch((response) => {
        console.log(response);
      });
  }

  function handleChange(event) {
    setCode(event.target.value);
    setCheck(true);
  }

  function handleChangeCode2(event) {
    setCode2(event.target.value);
    setCheck(true);
  }

  function handleChange2(event) {
    setName(event.target.value);
  }

  const fileInput = React.useRef(null);
  const fileInput2 = React.useRef(null);

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setCode(e.target.result);
      reader.readAsText(file);
    }
  }

  function handleFileChange2(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setCode2(e.target.result);
      reader.readAsText(file);
    }
  }

  function getStatusfromServer(match) {
    axios
      .get(serverURL + "checkstatus/" + match)
      .then((response) => {
        if (response.data === "IN QUEUE") setStatus("En cola");
        else if (response.data === "DONE") setStatus("Listo");
        else setStatus(response.data);
        flag = response.data;
      })
      .catch((response) => { });
    var tmp = flag.split(":");
    console.log(tmp, flag);
    if (flag === "DONE" || tmp[0] === "ERROR") {
      clearInterval(intervalID);
      if (flag === "DONE") setCheck(false);
    }
  }

  return (
    <React.Fragment>
      <form onSubmit={handleSubmit}>
        <div className="container">
          <div className="row">
            <div className="col-6">
              <div className="card border-0 shadow">
                <div className="card-body">
                  <label htmlFor="title">Ingrese un nombre al código (para identificarlo en ventanas o pestañas)</label>
                  <input type="text" value={name} onChange={handleChange2} />
                  <div>
                    <label htmlFor="code">Inserte primer código </label>
                  </div>
                  <textarea
                    className="form-control"
                    type="text"
                    id="code"
                    name="code"
                    rows="15"
                    cols="78"
                    value={code}
                    onChange={handleChange}
                  ></textarea>
                  <label className="form-label">Cargar primer archivo</label>
                  <input ref={fileInput} className="form-control" type="file" id="formFile" onChange={handleFileChange} />
                </div>
              </div>
            </div>

            <div className="col-6">
              <div className="card border-0 shadow">
                <div className="card-body">
                  <label htmlFor="title">Ingrese un nombre al código (para identificarlo en ventanas o pestañas)</label>
                  <input type="text" value={name} onChange={handleChange2} />
                  <div>
                    <label htmlFor="code2">Inserte segundo código </label>
                  </div>
                  <textarea
                    className="form-control"
                    type="text"
                    id="code2"
                    name="code2"
                    rows="15"
                    cols="78"
                    value={code2}
                    onChange={handleChangeCode2}
                  ></textarea>
                  <label className="form-label">Cargar segundo archivo</label>
                  <input ref={fileInput2} className="form-control" type="file" id="formFile2" onChange={handleFileChange2} />
                </div>
              </div>
            </div>
            <div>
              <input type="submit" className="buttonv2" value="Subir" />
            </div>
            <div className="d-flex justify-content-center mt-3"> {/* Added this wrapping div */}
              <div className="col-6">
                <div className="card border-0 shadow">
                  <div className="card-body">
                    <h2> Estado del Código </h2>
                    <textarea
                      type="text"
                      id="status"
                      value={status}
                      disabled
                      rows="15"
                      cols="78"
                    ></textarea>
                    <button
                      type="button"
                      className="buttonv"
                      onClick={() => navigate("/code/" + codename, { replace: false, state: { name: name } })}
                      disabled={check}
                    >
                      Ver estadísticas
                    </button>
                  </div>
                </div>
              </div>
            </div> {/* Closing the wrapping div */}
          </div>
        </div>
      </form>
    </React.Fragment>
  );
}

export default RenderDoubleForm;
