import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import getTask, {
  numericalInputOptions,
  serverURL,
  baseURL,
  statusURL,
  tasks,
} from "../common/Constants.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "./RenderForm.css";

function RenderForm() {
  //const [code, setCode] = useState("");
  const [file, setFile] = useState(null);
  const [codename, setCodename] = useState();
  const [messages, setMessages] = useState([]);
  const [check, setCheck] = useState(true);
  const [name, setName] = useState("test");
  const [fileList, setFileList] = useState();
  const [inputSize, setInputSize] = useState(10000);
  const [samples, setSamples] = useState(30); 
  var flag = "";
  var intervalID = 0;
  let navigate = useNavigate();

  const [selectedTaskType, setselectedTaskType] = useState('');

useEffect(() => {
  if (!codename) return;

  let lastCount = 0;

  const interval = setInterval(() => {
    axios
      .get(`${serverURL}status/${codename}_status.json`)
      .then((response) => {
        const data = response.data;

        if (Array.isArray(data.messages)) {
          const newMessages = data.messages.slice(lastCount);
          if (newMessages.length > 0) {
            setMessages((prev) => [...prev, ...newMessages]);
            lastCount = data.messages.length;

            // ✅ Habilitar botón cuando se detecta mensaje final
            if (
              newMessages.some((m) =>
                m.msg.includes("📊 Generando gráficos") ||
                m.msg.includes("✅ Test ejecutado correctamente")
              )
            ) {
              setCheck(false);
            }
          }
        }
      })
      .catch((error) => {
        console.error("❌ Error al obtener estado JSON:", error);
      });
  }, 3000);

  return () => clearInterval(interval);
}, [codename]);


  const handleRadioChange = (taskId) => {
    setselectedTaskType(taskId);
  };

  const sizeChange = (event) => {
    const newValue = event.target.value;
    console.log("Nuevo valor:", newValue);

    if (!isNaN(newValue) && newValue.trim() !== '') {
      setInputSize(newValue);
    } else {
      console.log("El valor introducido no es numérico");
    }
  };

  function handleFileChange(event) {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && uploadedFile.name.endsWith(".zip")) {
      setFile(uploadedFile);
    } else {
      alert("Please upload a .zip file.");
      event.target.value = ""; // Reset the file input
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      alert("Please upload a .zip file.");
      return;
    }
    console.log(file);
    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);
    bodyFormData.append("input_size", inputSize);
    bodyFormData.append("samples", samples);
    setMessages([{
      time: new Date().toISOString().replace("T", " ").slice(0, 19),
      msg: "📨 Enviando archivo al servidor..."
    }]);
    console.log(bodyFormData);
    if (selectedTaskType) {
      bodyFormData.append("task_type", getTask(selectedTaskType));
      console.log(bodyFormData);
    }

    axios({
      method: "post",
      url: baseURL,
      data: bodyFormData,
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((response) => {
        const queuedFiles = response.data.cpp_files_queued;
        console.log('queuedFiles: ', queuedFiles);
        if (queuedFiles.length > 0 && queuedFiles[0].length > 0) {
          const lastIndex = queuedFiles.length - 1;
          setCodename(queuedFiles[lastIndex]);
          console.log(codename);
        } else {
          console.log("No files found");
        }
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
  setFileList(fileNames);

  Promise.all(
    fileNames.map((fileName) =>
      axios
        .get(statusURL + fileName)
        .then((response) => {
          const data = response.data;
          let formattedStatus = "";

          if (Array.isArray(data.messages)) {
            formattedStatus = data.messages
              .map((entry) => `[${entry.time}] ${entry.msg}`)
              .join("\n");
          }

          // Si ya hay un error o ya terminó, se puede frenar
          const isDone = data.status === "DONE";
          const isError = data.status === "ERROR";

          return {
            name: fileName,
            formattedStatus,
            stop: isDone || isError
          };
        })
        .catch((error) => ({
          name: fileName,
          formattedStatus: "[ERROR] No se pudo obtener estado",
          stop: true
        }))
    )
  ).then((results) => {
    const combinedStatus = results.map((file) => file.formattedStatus).join("\n\n");
    setMessages(combinedStatus);

    // Si todos terminaron, detener polling
    const allStop = results.every((r) => r.stop);
    if (allStop) {
      clearInterval(intervalID);
      setCheck(false);
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
                      Ingrese un nombre al código (para identificarlo en
                      ventanas o pestañas)
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
                  <input
                    className="form-control"
                    type="file"
                    id="formFile"
                    onChange={handleFileChange}
                  />
                  <div className="container mt-4 scrollable-area">
                    {tasks.map((task) => (
                      <div className="card mb-3" key={task.id}>
                        <div className="card-body">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="taskToggle"
                              id={task.id}
                              onChange={(e) => handleRadioChange(task.id)}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={task.id}
                            >
                              {task.title}{" "}
                              {selectedTaskType !== task.id &&
                                ""}
                            </label>

                          </div>
                          {(selectedTaskType === task.id || (selectedTaskType.includes("camm") && task.id.includes("camm"))) && (
                            <div className="mt-2">
                              <p>{task.description}</p>
                              {(selectedTaskType.includes('camm') || selectedTaskType === 'size' || selectedTaskType === 'lcs') && (
                                <div>
                                  <label>max input size</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder={inputSize}
                                    onChange={sizeChange}

                                  />
                                 <label className="mt-2">Repeticiones por incremento</label>
                                  <input
                                    type="number"
                                    min="1"
                                    name="samples"
                                    value={samples}
                                    onChange={(e) => setSamples(e.target.value)}
                                    className="form-control"
                                    placeholder="Ej: 30"
                                  />
                                    <div className="mt-2">
                                    {selectedTaskType !== 'size' && selectedTaskType !== 'lcs' && numericalInputOptions.map((option) => (
                                      <div className="form-check" key={option.value}>
                                        <input
                                          className="form-check-input"
                                          type="radio"
                                          name="option"
                                          value={option.value}
                                          onChange={(e) => handleRadioChange(option.value)}
                                        />
                                        <label className="form-check-label">{option.label}</label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <input
                    type="submit"
                    className="buttonv"
                    disabled={!selectedTaskType}
                    value="Subir"
                  />
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card border-0 shadow ">
                <div className="card-body">
                  <h2> Estado del Código </h2>
                  <div>
                     <div className="status-box border rounded p-2" style={{ height: "300px", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                        <ul className="list-group list-group-flush">
                          {messages.map((entry, index) => (
                            <li key={index} className="list-group-item py-1 px-2">
                              <strong>[{entry.time}]</strong> {entry.msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                  </div>
                  {!messages.some((m) => m.msg.includes("❌ ERROR DETECTADO")) && (
                    <button
                      type="button"
                      className="buttonv"
                      onClick={() =>
                        navigate("/code/" + codename, {
                          replace: false,
                          state: { name: name, codeList: fileList },
                        })
                      }
                      disabled={check}
                    >
                      Ver estadísticas
                    </button>
                  )}
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
