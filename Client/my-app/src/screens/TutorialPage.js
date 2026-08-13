import React, { useEffect, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Cpu,
  FileCode2,
  Gauge,
  History,
  Info,
  Layers3,
  MemoryStick,
  PlayCircle,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";

import "./TutorialPage.css";

import configSummaryShot from "../assets/tutorial/tutorial-config-summary.png";
import profileSettingsShot from "../assets/tutorial/tutorial-profile-settings.png";
import progressDetailsShot from "../assets/tutorial/tutorial-progress-details.png";
import progressOverviewShot from "../assets/tutorial/tutorial-progress-overview.png";
import recentResultShot from "../assets/tutorial/tutorial-recent-result.png";
import resultsOverviewShot from "../assets/tutorial/tutorial-results-overview.png";
import timeChartShot from "../assets/tutorial/tutorial-time-chart.png";
import uploadShot from "../assets/tutorial/tutorial-upload.png";

const FLOW_STEPS = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Prepara y sube tu proyecto",
    description:
      "Carga un archivo ZIP con tu implementación en C/C++. Performance System valida el envío antes de incorporarlo a la ejecución.",
    shots: [
      {
        src: uploadShot,
        alt: "Archivo ZIP seleccionado en el formulario de nuevo análisis",
        caption: "El archivo seleccionado debe contener al menos una fuente .cpp.",
        variant: "upload",
      },
    ],
  },
  {
    number: "02",
    icon: Settings2,
    title: "Configura el análisis",
    description:
      "Selecciona el benchmark disponible, el tamaño de entrada, las repeticiones por punto y el perfil de ejecución que necesites.",
    shots: [
      {
        src: profileSettingsShot,
        alt: "Selección del entorno y del perfil de medición",
        caption: "El perfil controla cuántas veces se repite cada punto.",
        variant: "profiles",
      },
      {
        src: configSummaryShot,
        alt: "Resumen completo del experimento listo para revisar y ejecutar",
        caption: "El resumen permite comprobar los parámetros antes del envío.",
        variant: "summary",
      },
    ],
  },
  {
    number: "03",
    icon: PlayCircle,
    title: "Envía y sigue la ejecución",
    description:
      "Después de confirmar la configuración, el trabajo entra a la cola y avanza por estados controlados mientras se compila, ejecuta, mide y procesa.",
    shots: [
      {
        src: progressOverviewShot,
        alt: "Vista de una ejecución registrada y en cola",
        caption: "La etapa activa se distingue del trabajo ya completado.",
        variant: "portrait",
      },
      {
        src: progressDetailsShot,
        alt: "Vista de una ejecución realizando mediciones y mostrando detalles técnicos",
        caption: "Los detalles técnicos permiten seguir los mensajes del proceso.",
        variant: "portrait",
      },
    ],
  },
  {
    number: "04",
    icon: BarChart3,
    title: "Interpreta los resultados",
    description:
      "Cuando la ejecución finaliza, revisa las métricas disponibles, sus gráficos y las explicaciones que ayudan a interpretar el comportamiento observado.",
    shots: [
      {
        src: resultsOverviewShot,
        alt: "Resumen de una ejecución completada con indicadores principales e interpretación guiada",
        caption: "La cabecera conserva la configuración y resume el último punto medido.",
        variant: "results",
      },
    ],
  },
];

const EXECUTION_STATES = [
  {
    name: "En cola",
    code: "QUEUED",
    description: "La ejecución fue registrada y espera un recurso de medición.",
  },
  {
    name: "En ejecución",
    code: "RUNNING",
    description: "El código se compila y/o ejecuta en el entorno de medición.",
  },
  {
    name: "Procesando",
    code: "PROCESSING",
    description: "Performance System transforma las mediciones en resultados consultables.",
  },
  {
    name: "Completado",
    code: "COMPLETED",
    description: "Los resultados están disponibles para revisión.",
  },
];

const METRICS = [
  {
    icon: Clock3,
    title: "Tiempo",
    text: "Permite observar cuánto tarda la implementación bajo la configuración seleccionada.",
  },
  {
    icon: Cpu,
    title: "CPU",
    text: "Incluye eventos y contadores de procesador disponibles para estudiar el trabajo realizado por el algoritmo.",
  },
  {
    icon: MemoryStick,
    title: "Memoria",
    text: "Ayuda a contextualizar el uso de recursos y el comportamiento de la implementación.",
  },
  {
    icon: Zap,
    title: "Energía",
    text: "Se muestra cuando el hardware y el entorno de medición permiten obtenerla de forma confiable.",
  },
];

const GOOD_PRACTICES = [
  "Compara implementaciones usando la misma configuración de entrada y número de repeticiones.",
  "Evita procesos externos innecesarios durante una medición cuando estés trabajando en un entorno local de pruebas.",
  "Usa varias repeticiones por punto para reducir el efecto de variaciones puntuales.",
  "Interpreta las métricas en conjunto: una mejora en una métrica no implica necesariamente una mejora global.",
];

const TutorialScreenshot = ({ shot, onOpen }) => (
  <figure className={`tutorial-shot tutorial-shot--${shot.variant || "default"}`}>
    <button
      type="button"
      className="tutorial-shot__button"
      onClick={() => onOpen(shot)}
      aria-label={`Ampliar captura: ${shot.alt}`}
    >
      <span className="tutorial-shot__viewport">
        <img src={shot.src} alt={shot.alt} loading="lazy" />
      </span>
      <span className="tutorial-shot__zoom" aria-hidden="true">
        <ZoomIn size={16} />
        Ampliar
      </span>
    </button>
    {shot.caption && <figcaption>{shot.caption}</figcaption>}
  </figure>
);

const TutorialPage = () => {
  const [activeShot, setActiveShot] = useState(null);

  useEffect(() => {
    if (!activeShot) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveShot(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeShot]);

  return (
    <div className="app-page tutorial-page">
      <main className="tutorial-main">
        <div className="tutorial-container">
          <header className="tutorial-hero">
            <div className="tutorial-eyebrow">
              <Sparkles size={16} />
              <span>Guía de uso</span>
            </div>

            <h1 className="tutorial-title">Cómo funciona Performance System</h1>

            <p className="tutorial-subtitle">
              Desde la carga del código hasta la interpretación de resultados:
              una guía breve para ejecutar mediciones reproducibles de
              algoritmos en C/C++.
            </p>

            <div className="tutorial-hero-badges" aria-label="Características">
              <span>
                <FileCode2 size={16} />
                C / C++
              </span>
              <span>
                <ShieldCheck size={16} />
                Ejecución controlada
              </span>
              <span>
                <Activity size={16} />
                Métricas de rendimiento
              </span>
              <span>
                <BarChart3 size={16} />
                Visualización y análisis
              </span>
            </div>
          </header>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">Flujo principal</span>
              <h2>De tu código a una medición interpretable</h2>
              <p>
                El sistema separa la preparación del envío, la ejecución y la
                presentación de resultados para que cada etapa sea trazable.
              </p>

              <div className="tutorial-capture-context" role="note">
                <Info size={16} aria-hidden="true" />
                <span>
                  <strong>Referencia visual:</strong> las capturas fueron
                  tomadas en modo oscuro. La ubicación y el funcionamiento de
                  los controles son idénticos en modo claro.
                </span>
              </div>
            </div>

            <div className="tutorial-flow">
              {FLOW_STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article className="tutorial-flow-card" key={step.number}>
                    <div className="tutorial-flow-card__top">
                      <span className="tutorial-step-number">{step.number}</span>
                      <div className="tutorial-step-icon">
                        <Icon size={22} strokeWidth={1.9} />
                      </div>
                    </div>

                    <h3>{step.title}</h3>
                    <p>{step.description}</p>

                    <div
                      className={`tutorial-flow-card__media tutorial-flow-card__media--${step.shots.length} tutorial-flow-card__media--step-${step.number}`}
                    >
                      {step.shots.map((shot) => (
                        <TutorialScreenshot
                          key={shot.src}
                          shot={shot}
                          onOpen={setActiveShot}
                        />
                      ))}
                    </div>

                    {index < FLOW_STEPS.length - 1 && (
                      <ChevronRight
                        className="tutorial-flow-card__arrow"
                        size={20}
                        aria-hidden="true"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="tutorial-section tutorial-two-column">
            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Archive size={21} />
                <div>
                  <span className="tutorial-section-kicker">Antes de ejecutar</span>
                  <h2>Prepara correctamente el ZIP</h2>
                </div>
              </div>

              <p>
                El archivo comprimido debe contener el código fuente que deseas
                medir. La plataforma valida el envío antes de registrarlo para
                evitar formatos inesperados o archivos que no puedan
                procesarse.
              </p>

              <div className="tutorial-file-tree" aria-label="Ejemplo de ZIP">
                <span>mi_algoritmo.zip</span>
                <span className="tutorial-file-tree__child">
                  └── algoritmo.cpp
                </span>
              </div>

              <div className="tutorial-note">
                <Info size={18} />
                <p>
                  No incluyas rutas absolutas, enlaces simbólicos ni contenido
                  ajeno a la prueba. Si el envío no cumple las validaciones, el
                  sistema lo rechazará antes de ejecutarlo.
                </p>
              </div>
            </article>

            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Settings2 size={21} />
                <div>
                  <span className="tutorial-section-kicker">Configuración</span>
                  <h2>Qué controla cada parámetro</h2>
                </div>
              </div>

              <div className="tutorial-definition-list">
                <div>
                  <strong>Benchmark</strong>
                  <span>
                    Define el tipo de entrada y el escenario con el que se
                    evaluará el código.
                  </span>
                </div>
                <div>
                  <strong>Tamaño de entrada</strong>
                  <span>
                    Determina la escala del problema utilizado durante la
                    medición.
                  </span>
                </div>
                <div>
                  <strong>Repeticiones por punto</strong>
                  <span>
                    Indica cuántas veces se mide cada tamaño de entrada para
                    obtener resultados más estables.
                  </span>
                </div>
                <div>
                  <strong>Perfil</strong>
                  <span>
                    Agrupa configuraciones de ejecución pensadas para análisis
                    rápidos, balanceados o más exhaustivos.
                  </span>
                </div>
              </div>
            </article>
          </section>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">Seguimiento</span>
              <h2>Estados de una ejecución</h2>
              <p>
                La ejecución mantiene un estado persistente para que puedas
                abandonar la vista y volver a consultar su progreso.
              </p>
            </div>

            <div className="tutorial-state-grid">
              {EXECUTION_STATES.map((state) => (
                <article className="tutorial-state-card" key={state.code}>
                  <span className="tutorial-state-dot" aria-hidden="true" />
                  <div>
                    <div className="tutorial-state-card__title">
                      <strong>{state.name}</strong>
                      <code>{state.code}</code>
                    </div>
                    <p>{state.description}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="tutorial-failure-note">
              <ServerCog size={20} />
              <div>
                <strong>¿Y si algo falla?</strong>
                <p>
                  Los errores de validación, compilación, ejecución, medición o
                  procesamiento se presentan como un fallo de la ejecución. El
                  detalle disponible ayuda a distinguir la etapa que requiere
                  corrección.
                </p>
              </div>
            </div>
          </section>

          <section className="tutorial-section tutorial-resume-panel">
            <div className="tutorial-resume-panel__copy">
              <div className="tutorial-panel-title">
                <History size={21} />
                <div>
                  <span className="tutorial-section-kicker">Continuidad</span>
                  <h2>Retoma tu último resultado desde el perfil</h2>
                </div>
              </div>

              <p>
                La ejecución queda persistida aunque abandones la pantalla de
                seguimiento. En tu perfil puedes consultar el estado de tu
                actividad y abrir directamente el resultado más reciente.
              </p>

              <div className="tutorial-note">
                <Info size={18} />
                <p>
                  <strong>Ver último resultado</strong> abre la visualización de
                  la ejecución completada más reciente; no vuelve a ejecutar el
                  código ni altera las mediciones guardadas.
                </p>
              </div>
            </div>

            <TutorialScreenshot
              shot={{
                src: recentResultShot,
                alt: "Perfil del estudiante con resumen de actividad y acceso al último resultado",
                caption:
                  "El acceso se encuentra en la tarjeta Ejecución más reciente.",
                variant: "recent",
              }}
              onOpen={setActiveShot}
            />
          </section>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">Resultados</span>
              <h2>Qué puedes observar</h2>
              <p>
                La disponibilidad exacta depende de la ejecución, del perfil y
                del hardware de medición. Performance System muestra únicamente
                las métricas que realmente están disponibles.
              </p>
            </div>

            <div className="tutorial-metric-grid">
              {METRICS.map((metric) => {
                const Icon = metric.icon;

                return (
                  <article className="tutorial-metric-card" key={metric.title}>
                    <div className="tutorial-metric-card__icon">
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <h3>{metric.title}</h3>
                    <p>{metric.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="tutorial-result-example">
              <div className="tutorial-result-example__copy">
                <span className="tutorial-section-kicker">Ejemplo de lectura</span>
                <h3>Relaciona el tamaño de entrada con la tendencia</h3>
                <p>
                  En este ejemplo, el eje horizontal representa el tamaño de
                  entrada y el vertical el tiempo de ejecución. Cada punto
                  resume las repeticiones realizadas para ese tamaño: interesa
                  la dirección general de la serie, no un punto aislado.
                </p>
                <ul>
                  <li>Comprueba siempre la unidad indicada en cada eje.</li>
                  <li>Observa si la métrica crece, disminuye o se mantiene.</li>
                  <li>Compara solo ejecuciones con condiciones equivalentes.</li>
                </ul>
              </div>

              <TutorialScreenshot
                shot={{
                  src: timeChartShot,
                  alt: "Gráfico de tiempo de ejecución según tamaño de entrada",
                  caption:
                    "La serie muestra una tendencia creciente entre los tamaños medidos.",
                  variant: "chart",
                }}
                onOpen={setActiveShot}
              />
            </div>
          </section>

          <section className="tutorial-section tutorial-two-column">
            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Gauge size={21} />
                <div>
                  <span className="tutorial-section-kicker">Interpretación</span>
                  <h2>Cómo leer una medición</h2>
                </div>
              </div>

              <p>
                Un gráfico no debe analizarse de forma aislada. Observa la
                tendencia, compara ejecuciones bajo condiciones equivalentes y
                utiliza las explicaciones del sistema como apoyo para relacionar
                las métricas con el comportamiento del algoritmo.
              </p>

              <div className="tutorial-analysis-preview">
                <div>
                  <Activity size={18} />
                  <span>Tendencia observada</span>
                </div>
                <div>
                  <Layers3 size={18} />
                  <span>Comparación entre métricas</span>
                </div>
                <div>
                  <Code2 size={18} />
                  <span>Contexto de la implementación</span>
                </div>
              </div>
            </article>

            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <CheckCircle2 size={21} />
                <div>
                  <span className="tutorial-section-kicker">Buenas prácticas</span>
                  <h2>Obtén resultados comparables</h2>
                </div>
              </div>

              <ul className="tutorial-check-list">
                {GOOD_PRACTICES.map((practice) => (
                  <li key={practice}>
                    <CheckCircle2 size={17} />
                    <span>{practice}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="tutorial-section">
            <article className="tutorial-final-card">
              <div className="tutorial-final-card__icon">
                <BarChart3 size={24} />
              </div>
              <div>
                <span className="tutorial-section-kicker">
                  Antes de comenzar
                </span>
                <h2>Revisa el ZIP y conserva condiciones comparables</h2>
                <p>
                  Con el archivo preparado, configura el benchmark y comprueba
                  el resumen antes de ejecutar. Cuando necesites repetir una
                  comparación, mantén el mismo entorno, perfil y tamaño de
                  entrada para que la lectura siga siendo válida.
                </p>
              </div>
            </article>
          </section>
        </div>
      </main>

      {activeShot && (
        <div
          className="tutorial-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Captura ampliada del tutorial"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveShot(null);
          }}
        >
          <div className="tutorial-lightbox__dialog">
            <button
              type="button"
              className="tutorial-lightbox__close"
              onClick={() => setActiveShot(null)}
              aria-label="Cerrar captura ampliada"
            >
              <X size={20} />
            </button>
            <div
              className={`tutorial-lightbox__viewport tutorial-lightbox__viewport--${activeShot.variant || "default"}`}
            >
              <img src={activeShot.src} alt={activeShot.alt} />
            </div>
            {activeShot.caption && <p>{activeShot.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialPage;
