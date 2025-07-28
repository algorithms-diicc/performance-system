import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import getTask, {
  numericalInputOptions,
  serverURL,
  baseURL,
  tasks,
} from "../common/Constants.js";
import "./RenderForm.css";
const defaultParams = {
  lcs: { inputSize: 500, samples: 30 },
  camm: { inputSize: 5000, samples: 30 },
  size: { inputSize: 2500, samples: 30 },
};

function RenderForm() {
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [check, setCheck] = useState(true);
  const [name, setName] = useState("");
  const [username, setuserName] = useState("");
  const [fileList, setFileList] = useState([]);
  const [inputSize, setInputSize] = useState(1000);
  const [samples, setSamples] = useState(30);
  const [selectedTaskType, setSelectedTaskType] = useState("");
  const [dataType, setDataType] = useState("");
  const navigate = useNavigate();

  // 🔁 Lectura de todos los archivos *_status.json para cada archivo subido
  useEffect(() => {
    if (!fileList || fileList.length === 0) return;

    const interval = setInterval(() => {
      const requests = fileList.map((code) =>
        axios
          .get(`${serverURL}status/${code}_status.json`, {
            headers: { "Cache-Control": "no-cache" },
          })
          .then((res) => ({
            codename: code,
            originalName:
              res.data.files && res.data.files.length > 0
                ? res.data.files[0].original_filename
                : code,
            messages: res.data.messages
          }))
          .catch(() => null)
      );

      Promise.all(requests).then((results) => {
        let allMessages = [];
        let allDone = true;
        results.forEach((res) => {
          if (res && Array.isArray(res.messages)) {
            allMessages.push({
              codename: res.codename,
              originalName: res.originalName,  // ✅ Añadido correctamente aquí
              messages: res.messages,
            });

            const isDone = res.messages.some((m) =>
              m.msg.includes("✅ Resultados listos.")
            );
            if (!isDone) allDone = false;
          }
        });
        setMessages(allMessages);
        if (allDone) {
          setCheck(false);
          clearInterval(interval);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [fileList]);

  const handleTaskChange = (taskId) => {
    // Solo reiniciar dataType si el tipo de test es diferente
    if (selectedTaskType !== taskId) {
      setDataType("");
    }

    setSelectedTaskType(taskId);

    const params = defaultParams[taskId];

    // Solo aplicar valores por defecto si el usuario no los ha cambiado aún
    if (params) {
      setInputSize((prev) => {
        return prev === defaultParams[selectedTaskType]?.inputSize ? params.inputSize : prev;
      });
      setSamples((prev) => {
        return prev === defaultParams[selectedTaskType]?.samples ? params.samples : prev;
      });
    }
  };



  const handleDataTypeChange = (type) => {
    setDataType(type);
  };

  const handleFileChange = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile && uploadedFile.name.endsWith(".zip")) {
      setFile(uploadedFile);
    } else {
      alert("Por favor, sube un archivo .zip válido.");
      event.target.value = "";
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!file) {
      alert("Por favor, sube un archivo .zip.");
      return;
    }

    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);
    bodyFormData.append("input_size", inputSize);
    bodyFormData.append("samples", samples);

    if (selectedTaskType) {
      bodyFormData.append("task_type", getTask(selectedTaskType));
    }
    if (dataType) {
      bodyFormData.append("data_type", dataType);
    }
    if (username) {
      bodyFormData.append("username", username);
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
          setMessages([]);
          setFileList(queuedFiles);
        } else {
          console.error("No se encontraron archivos en la respuesta");
        }
      })
      .catch((error) => {
        console.error("❌ Error al enviar archivo:", error);
      });
  };

  const handleChangeName = (event) => {
    setName(event.target.value);
  };
  const handleChangeuserName = (event) => {
    setuserName(event.target.value);
  };

  return (
    <div className="inicio-container">
      <form onSubmit={handleSubmit}>
        <div className="content-grid">
          {/* Panel configuración */}
          <div className="glass-card config-scroll">
            <div className="card-header" style={{ padding: "2rem 2rem 1rem 2rem" }}>
              <h2 style={{ marginLeft: "0.5rem", marginTop: "0.5rem" }}>🛠️ Configuración del Test</h2>
            </div>

            <div className="form-section">
              <label className="form-label"><span className="label-icon">📝</span> Usuario </label>
              <input
                type="text"
                value={username}
                onChange={handleChangeuserName}
                className="form-input"
                required
              />
            </div>
            <div className="form-section">
              <label className="form-label"><span className="label-icon">📝</span> Nombre del Test</label>
              <input
                type="text"
                value={name}
                onChange={handleChangeName}
                className="form-input"
                placeholder="Ej: mi algoritmo"
                required
              />
            </div>

            <div className="form-section">
              <label className="form-label"><span className="label-icon">📁</span> Archivo de código (.zip)</label>
              <input
                type="file"
                onChange={handleFileChange}
                className="form-input"
                accept=".zip"
                required
              />
            </div>

            <div className="form-section">
              <label className="form-label"><span className="label-icon">💻</span> Tipo de Test</label>
              <div className="test-options">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`test-option ${selectedTaskType === task.id ? "selected" : ""}`}
                    onClick={() => handleTaskChange(task.id)}
                  >
                    <label className="test-radio-label">
                      <input
                        type="radio"
                        name="taskToggle"
                        checked={selectedTaskType === task.id}
                        onChange={() => handleTaskChange(task.id)}
                        className="test-radio"
                      />
                      <span className="test-title">{task.title}</span>
                    </label>
                    {selectedTaskType === task.id && (
                      <div className="test-details">
                        <p className="test-description">{task.description}</p>
                        <div className="test-params">
                          <div className="param-group">
                            <label className="param-label">Tamaño máximo de entrada</label>
                            <input
                              type="number"
                              className="param-input"
                              value={inputSize}
                              onChange={(e) => setInputSize(e.target.value)}
                              min="1"
                            />
                          </div>
                          <div className="param-group">
                            <label className="param-label">Repeticiones por incremento</label>
                            <input
                              type="number"
                              className="param-input"
                              value={samples}
                              onChange={(e) => setSamples(e.target.value)}
                              min="1"
                              placeholder="Ej: 30"
                            />
                          </div>

                          {/* Opciones solo para CAMM */}
                          {selectedTaskType === "camm" && (
                            <div className="param-group">
                              <label className="param-label">Tipo de datos</label>
                              <div className="data-options">
                                {numericalInputOptions.map((option) => (
                                  <label key={option.value} className="data-option" style={{ marginBottom: "0.5rem" }}>
                                    <input
                                      type="radio"
                                      name="dataType"
                                      value={option.value}
                                      onChange={(e) => handleDataTypeChange(e.target.value)}
                                      checked={dataType === option.value}
                                      className="data-radio"
                                    />
                                    <span className="data-label">{option.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className={`submit-button ${!selectedTaskType || !file ? "disabled" : ""}`}
              disabled={!selectedTaskType || !file}
            >
              Ejecutar Test
            </button>
          </div>

          {/* Panel estado */}
          <div className="glass-card" style={{ minHeight: "600px" }}>
            <div className="card-header" style={{ padding: "2rem 2rem 1rem 2rem" }}>
              <h2 style={{ marginLeft: "0.5rem", marginTop: "0.5rem" }}>⚙️ Estado del Código</h2>
            </div>
            <div className="status-content">
              <div className="status-box">
                {messages.length === 0 ? (
                  <div className="status-empty">
                    <span className="status-icon">⏳</span>
                    <p>Esperando ejecución del test...</p>
                  </div>
                ) : (
                  <div className="status-messages">
                    {messages.map((group, idx) => (
                      <div key={idx} className="status-group">
                        <h4 className="codename-title">
                          Archivo: <span style={{ fontWeight: 600 }}>{group.originalName}</span>
                        </h4>
                        {group.messages.map((entry, index) => (
                          <div key={index} className="status-message">
                            <span className="message-time">[{entry.time}]</span>
                            <span className="message-text">{entry.msg}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {fileList.length > 0 && !messages.some((g) =>
                g.messages.some((m) => m.msg.includes("❌ ERROR DETECTADO"))
              ) && (
                  <button
                    type="button"
                    className={`results-button ${check ? "disabled" : ""}`}
                    onClick={() =>
                      navigate("/code/" + fileList[fileList.length - 1], {
                        replace: false,
                        state: { name: name, codeList: fileList },
                      })
                    }
                    disabled={check}
                  >
                    Ver Estadísticas
                  </button>
                )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default RenderForm;
