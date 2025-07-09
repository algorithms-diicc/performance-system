import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import getTask, {
  numericalInputOptions,
  serverURL,
  baseURL,
  tasks,
} from "../common/Constants.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "./RenderForm.css";

function RenderForm() {
  const [file, setFile] = useState(null);
  const [codename, setCodename] = useState();
  const [messages, setMessages] = useState([]);
  const [check, setCheck] = useState(true);
  const [name, setName] = useState("test");
  const [fileList, setFileList] = useState([]);
  const [inputSize, setInputSize] = useState(10000);
  const [samples, setSamples] = useState(30);
  const [selectedTaskType, setselectedTaskType] = useState("");
  const navigate = useNavigate();

  // 🔁 Leer JSON de estado cada 3s
  useEffect(() => {
    if (!codename) return;

    const interval = setInterval(() => {
      axios
        .get(`${serverURL}status/${codename}_status.json`, {
          headers: { "Cache-Control": "no-cache" },
        })
        .then((response) => {
          const data = response.data;
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);

            const terminado = data.messages.some((m) =>
              m.msg.includes("📊 Generando gráficos") ||
              m.msg.includes("✅ Test ejecutado correctamente")
            );
            if (terminado) {
              setCheck(false);
              clearInterval(interval);
            }
          }
        })
        .catch((error) => {
          console.warn("⏳ JSON no disponible todavía:", error.message);
        });
    }, 3000);

    return () => clearInterval(interval);
  }, [codename]);

  const handleRadioChange = (taskId) => {
    setselectedTaskType(taskId);
  };

  const sizeChange = (event) => {
    const newValue = event.target.value;
    if (!isNaN(newValue) && newValue.trim() !== "") {
      setInputSize(newValue);
    }
  };

  function handleFileChange(event) {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && uploadedFile.name.endsWith(".zip")) {
      setFile(uploadedFile);
    } else {
      alert("Please upload a .zip file.");
      event.target.value = "";
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      alert("Please upload a .zip file.");
      return;
    }

    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);
    bodyFormData.append("input_size", inputSize);
    bodyFormData.append("samples", samples);

    if (selectedTaskType) {
      bodyFormData.append("task_type", getTask(selectedTaskType));
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
          const realCodename = queuedFiles[queuedFiles.length - 1];
          setMessages([]); 
          setCodename(realCodename);
          setFileList(queuedFiles);
        } else {
          console.error("No se encontraron archivos en la respuesta");
        }
      })
      .catch((error) => {
        console.error("❌ Error al enviar archivo:", error);
      });
  }

  function handleChangeName(event) {
    setName(event.target.value);
  }

  return (
    <React.Fragment>
      <form onSubmit={handleSubmit}>
        <div className="container">
          <div className="row">
            {/* Columna izquierda */}
            <div className="col-6">
              <div className="card border-0 shadow">
                <div className="card-body">
                  <label>
                    Ingrese un nombre al código (para identificarlo)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={handleChangeName}
                    className="form-control mb-3"
                  />

                  <label className="form-label">Upload .zip file</label>
                  <input
                    className="form-control"
                    type="file"
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
                              onChange={() => handleRadioChange(task.id)}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={task.id}
                            >
                              {task.title}
                            </label>
                          </div>

                          {(selectedTaskType === task.id ||
                            (selectedTaskType.includes("camm") &&
                              task.id.includes("camm"))) && (
                            <div className="mt-2">
                              <p>{task.description}</p>

                              {(selectedTaskType.includes("camm") ||
                                selectedTaskType === "size" ||
                                selectedTaskType === "lcs") && (
                                <>
                                  <label>max input size</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    placeholder={inputSize}
                                    onChange={sizeChange}
                                  />

                                  <label className="mt-2">
                                    Repeticiones por incremento
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    name="samples"
                                    value={samples}
                                    onChange={(e) =>
                                      setSamples(e.target.value)
                                    }
                                    className="form-control"
                                    placeholder="Ej: 30"
                                  />

                                  <div className="mt-2">
                                    {selectedTaskType !== "size" &&
                                      selectedTaskType !== "lcs" &&
                                      numericalInputOptions.map((option) => (
                                        <div
                                          className="form-check"
                                          key={option.value}
                                        >
                                          <input
                                            className="form-check-input"
                                            type="radio"
                                            name="option"
                                            value={option.value}
                                            onChange={(e) =>
                                              handleRadioChange(option.value)
                                            }
                                          />
                                          <label className="form-check-label">
                                            {option.label}
                                          </label>
                                        </div>
                                      ))}
                                  </div>
                                </>
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

            {/* Columna derecha */}
            <div className="col-6">
              <div className="card border-0 shadow">
                <div className="card-body">
                  <h2>Estado del Código</h2>
                  <div
                    className="status-box border rounded p-2"
                    style={{
                      height: "300px",
                      overflowY: "auto",
                      backgroundColor: "#f8f9fa",
                    }}
                  >
                    <ul className="list-group list-group-flush">
                      {messages.map((entry, index) => (
                        <li
                          key={index}
                          className="list-group-item py-1 px-2"
                        >
                          <strong>[{entry.time}]</strong> {entry.msg}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!messages.some((m) =>
                    m.msg.includes("❌ ERROR DETECTADO")
                  ) && (
                    <button
                      type="button"
                      className="buttonv mt-3"
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
