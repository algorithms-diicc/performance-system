import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import getTask, { serverURL, baseURL, statusURL } from '../common/Constants.js';
import "bootstrap/dist/css/bootstrap.min.css";
import "./RenderForm.css";


function RenderForm({ tasksState }) {
  //const [code, setCode] = useState("");
  const [file, setFile] = useState(null); 
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

  function handleFileChange(event) {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && uploadedFile.name.endsWith('.zip')) {
      setFile(uploadedFile);
    } else {
      alert('Please upload a .zip file.');
      event.target.value = ''; // Reset the file input
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      alert('Please upload a .zip file.');
      return;
    }
    console.log(file);
    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);
    setStatus("Esperando respuesta");
    console.log(bodyFormData);
    if (tasksState) {
      bodyFormData.append("task_type", getTask(tasksState));
    }

    axios({
      method: "post",
      url: baseURL,
      data: bodyFormData,
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((response) => {
        const queuedFiles = response.data.cpp_files_queued;
        if (queuedFiles.length > 0 && queuedFiles[0].length > 0) {
          const lastIndex = queuedFiles[0].length - 1;
          setCodename(queuedFiles[0][lastIndex]);
      } else {
          console.log('No files found');
      }
        intervalID = setInterval(() => getStatusfromServer(queuedFiles[0]), 5000);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  function handleChangeName(event) {
    setName(event.target.value);
  }

  function getStatusfromServer(fileNames) {
    console.log("File names: ", fileNames);
  
    // No need to split if fileNames is already an array
    Promise.all(fileNames.map(fileName => 
      axios.get(statusURL + fileName)
        .then(response => ({ name: fileName, status: response.data }))
        .catch(error => ({ name: fileName, status: 'ERROR', error }))
    ))
    .then(results => {
      results.forEach(file => console.log(file.name + " status: " + file.status));
      const allDone = results.every(file => file.status === 'DONE');
  
      if (allDone) {
        clearInterval(intervalID);
        setCheck(false);
        //COMPLETAR
      } else {
        //COMPLETAR
      }
    });
  }
  
  function handleChange2(event) {
    setName(event.target.value);
  }
  return (
    <React.Fragment>
      <form onSubmit={handleSubmit}>
      <div className="container">
        <div className="row">
          <div className="col-6">
            <div className="card border-0 shadow ">
              <div className="card-body">
                <div>
                  <label htmlFor="title">
                    Ingrese un nombre al código (para identificarlo en ventanas
                    o pestañas)
                  </label>
                  <br />
                  <input type="text" value={name} onChange={handleChange2} />
                </div>
                {/* <textarea
                  type="text"
                  id="code"
                  name="code"
                  rows="15" // Adjusted rows to fit content
                  cols="78"
                  value={code}
                  onChange={handleChange}
                ></textarea> */}
                <label htmlFor="formFile" className="form-label">
          Upload .zip file
        </label>
        <input className="form-control" type="file" id="formFile" onChange={handleFileChange}/>
        <input type="submit" className="buttonv" value="Subir" />
              </div>
            </div>
          </div>

          <div className="col-6">
            <div className="card border-0 shadow ">
              <div className="card-body">
                <h2> Estado del Código </h2>
                <div>
                  <textarea
                    type="text"
                    id="status"
                    value={status}
                    disabled
                    rows="15" // Adjusted rows to fit content
                    cols="78"
                  ></textarea>
                </div>
                <button
                  type="button"
                  className="buttonv"
                  onClick={() =>
                    navigate("/code/" + codename, {
                      replace: false,
                      state: { name: name },
                    })
                  }
                  disabled={check}
                >
                  Ver estadísticas
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </form>
    </React.Fragment>
  );
}

export default RenderForm;
