import React from "react";
import "./TutorialPage.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const TutorialPage = () => {
  return (
    <div className="app-page tutorial-page tutorial-page--dark">
      <main className="tutorial-main">
        <div className="tutorial-container">
          {/* Header general */}
          <header className="tutorial-header">
            <h1 className="tutorial-title tutorial-title--gradient">
              Tutorial y ejemplos de ejecución
            </h1>
            <p className="tutorial-subtitle tutorial-subtitle--muted">
              Aprende a usar Performance System para medir y analizar el
              rendimiento de tu código C++.
            </p>
          </header>

          {/* Flujo general del sistema */}
          <section className="tutorial-section">
            <div className="section-card app-card tutorial-card--dark">
              <h2 className="section-title section-title--accent">
                Flujo general del sistema
              </h2>
              <div className="section-content">
                <p>
                  <strong>1. Ingresar nombre y usuario:</strong> El usuario debe
                  ingresar un nombre representativo para el test y su
                  identificador personal. Esta información se usará para
                  identificar los resultados y asociarlos con quien ejecutó la
                  prueba.
                </p>

                <div className="image-wrapper">
                  <img
                    src="/tutorial-images/Usuario_y_Test.PNG"
                    alt="Ingreso de nombre de test y usuario"
                    className="tutorial-image tutorial-image--small"
                  />
                </div>

                <p>
                  <strong>2. Subir archivo .zip:</strong> El usuario sube un
                  archivo comprimido que contiene uno o más archivos{" "}
                  <code>.cpp</code>.
                </p>

                <div className="image-wrapper">
                  <img
                    src="/tutorial-images/zip.PNG"
                    alt="Subida de archivo ZIP"
                    className="tutorial-image tutorial-image--small"
                  />
                </div>

                <p>
                  <strong>3. Configuración del test:</strong> Debes seleccionar
                  el tipo de test que deseas realizar entre LCS, CAMM o SIZE.
                  Además, debes definir el tamaño máximo de entrada y las
                  repeticiones por incremento.
                </p>

                <div className="image-wrapper">
                  <img
                    src="/tutorial-images/configuracion_de_test.PNG"
                    alt="Configuración de test"
                    className="tutorial-image tutorial-image--small"
                  />
                </div>

                <p>
                  <strong>4. Compilación y envío:</strong> El backend compila
                  automáticamente cada archivo y lo envía a la máquina medidora
                  (slave).
                </p>

                <div className="info-hint-box info-hint-box--blue">
                  <p>
                    <strong>Importante:</strong> Una vez que subas tu archivo{" "}
                    <code>.zip</code> y configures el test, debes esperar a que
                    todos los archivos se ejecuten correctamente. El sistema
                    compilará y medirá cada uno. Cuando el proceso termine, el
                    botón <strong>“Ver estadísticas”</strong> se activará
                    automáticamente.
                  </p>
                </div>

                <p>
                  <strong>5. Ejecución y medición:</strong> El slave mide
                  consumo energético, instrucciones, ciclos de CPU, tiempos y
                  otros parámetros usando <code>perf</code>.
                </p>

                <div className="image-wrapper">
                  <img
                    src="/tutorial-images/test-realizado.PNG"
                    alt="Test realizado"
                    className="tutorial-image tutorial-image--small"
                  />
                </div>

                <p>
                  <strong>6. Resultados:</strong> Los resultados se visualizan
                  en gráficos interactivos y se pueden descargar como CSV.
                </p>

                <div className="image-wrapper">
                  <img
                    src="/tutorial-images/visualizacion-de-resultados.PNG"
                    alt="Visualización de resultados"
                    className="tutorial-image tutorial-image--wide"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Test LCS */}
          <section className="tutorial-section">
            <div className="section-card app-card tutorial-card--dark">
              <h2 className="section-title section-title--accent">
                Test LCS (Longest Common Subsequence)
              </h2>

              <div className="section-content">
                <div className="subsection">
                  <h3 className="subsection-title">¿Qué es el test LCS?</h3>
                  <p>
                    Este ejemplo corresponde a un test de tipo LCS (Text Input)
                    que mide el rendimiento de un algoritmo que busca la
                    subcadena común más larga entre dos mitades de un texto. Tu
                    programa será evaluado midiendo métricas de rendimiento como
                    instrucciones ejecutadas, fallos y aciertos de caché, ciclos
                    de CPU y tiempo total de ejecución.
                  </p>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Recomendaciones</h3>
                  <ul>
                    <li>
                      Optimizar la implementación para minimizar el uso de
                      memoria y CPU.
                    </li>
                    <li>
                      Subir siempre un archivo <code>.cpp</code> compilable.
                    </li>
                    <li>
                      No utilizar <code>cin</code> ni <code>getline</code> para
                      leer por teclado. Usa siempre argumentos o archivos.
                    </li>
                    <li>
                      El archivo de texto usado es{" "}
                      <code>input/english.50MB</code> y será pasado
                      automáticamente como argumento.
                    </li>
                  </ul>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Ejemplo de código</h3>
                  <div className="code-placeholder code-placeholder--dark">
                    <SyntaxHighlighter
                      language="cpp"
                      style={oneDark}
                      showLineNumbers
                    >
                      {`#include <iostream>
#include <vector>
#include <string>
#include <fstream>
using namespace std;

string longest_common_substring(const string& str1, const string& str2) {
    int n = str1.length();
    int m = str2.length();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));
    int maxlen = 0;
    int end = 0;

    for (int i = 1; i <= n; ++i) {
        for (int j = 1; j <= m; ++j) {
            if (str1[i - 1] == str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxlen) {
                    maxlen = dp[i][j];
                    end = i - 1;
                }
            }
        }
    }

    if (maxlen == 0) return "<empty>";
    return str1.substr(end - maxlen + 1, maxlen);
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cerr << "Uso: ./a.out <archivo_input>" << endl;
        return 1;
    }

    ifstream file(argv[1]);
    if (!file.is_open()) {
        cerr << "No se pudo abrir el archivo" << endl;
        return 1;
    }

    string content((istreambuf_iterator<char>(file)), (istreambuf_iterator<char>()));
    file.close();

    int mid = content.size() / 2;
    string first_half = content.substr(0, mid);
    string second_half = content.substr(mid);

    string lcs = longest_common_substring(first_half, second_half);

    cout << "LCS length: " << lcs.length() << endl;
    return 0;
}`}
                    </SyntaxHighlighter>

                    <a
                      href="/tutorial-codigos/lcs_template.zip"
                      download
                      className="icon-button icon-button--primary"
                    >
                      Descargar código LCS (.zip)
                    </a>

                    <p className="code-note">
                      ⚠️ <strong>Nota:</strong> Este código es funcional y
                      puedes usarlo tal como está para ejecutar el test. También
                      puedes subir tu propio código, siempre que respete la
                      estructura esperada y las condiciones definidas para este
                      tipo de prueba.
                    </p>
                  </div>

                  <div className="config-hint-box">
                    <h4 className="config-hint-title">Valores recomendados</h4>
                    <ul className="config-hint-list">
                      <li>
                        <strong>Tamaño máximo de entrada:</strong> 500 a 1000
                      </li>
                      <li>
                        <strong>Repeticiones por incremento:</strong> 10 a 30
                      </li>
                      <li>
                        <strong>Tiempo estimado:</strong> 1 a 10 minutos
                      </li>
                    </ul>
                    <p className="config-hint-note">
                      Estos valores corresponden al código de ejemplo mostrado.
                      Puedes probar otros, pero asegúrate de que tu algoritmo y
                      el test puedan soportarlos correctamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Test CAMM */}
          <section className="tutorial-section">
            <div className="section-card app-card tutorial-card--dark">
              <h2 className="section-title section-title--accent">
                Test CAMM (Cache-Aware Matrix Multiplication)
              </h2>

              <div className="section-content">
                <div className="subsection">
                  <h3 className="subsection-title">¿Qué es el test CAMM?</h3>
                  <p>
                    El test CAMM mide el rendimiento en la multiplicación de
                    matrices usando entrada numérica, con variantes de datos
                    aleatorios, iguales o semi-ordenados. Permite evaluar el
                    comportamiento del caché y la eficiencia en operaciones
                    numéricas. El backend selecciona automáticamente el archivo
                    de entrada según la opción elegida (CAMM, CAMMS o CAMMSO).
                    No es necesario modificar el código para manejar el input.
                  </p>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Recomendaciones</h3>
                  <ul>
                    <li>
                      Verificar siempre la consistencia de las dimensiones antes
                      de ejecutar.
                    </li>
                    <li>
                      El código debe recibir los datos como argumentos (
                      <code>argv</code>), no desde teclado.
                    </li>
                    <li>
                      Confirmar que la lógica de parsing respete el formato:
                      matriz A linealizada seguida de matriz B linealizada.
                    </li>
                    <li>
                      No necesitas preocuparte de cargar archivos manualmente;
                      el sistema lo gestiona.
                    </li>
                  </ul>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Ejemplo de código</h3>
                  <div className="code-placeholder code-placeholder--dark">
                    <SyntaxHighlighter
                      language="cpp"
                      style={oneDark}
                      showLineNumbers
                    >
                      {`#include <iostream>
#include <vector>
#include <cmath>
#include <sstream>
#include <string>

#define BLOCK_SIZE 32 

void multiply(const std::vector<std::vector<double>>& A,
              const std::vector<std::vector<double>>& B,
              std::vector<std::vector<double>>& C) 
{
    int size = A.size();
    for (int i = 0; i < size; i += BLOCK_SIZE) {
        for (int j = 0; j < size; j += BLOCK_SIZE) {
            for (int k = 0; k < size; k += BLOCK_SIZE) {
                for (int ii = i; ii < i + BLOCK_SIZE && ii < size; ii++) {
                    for (int jj = j; jj < j + BLOCK_SIZE && jj < size; jj++) {
                        for (int kk = k; kk < k + BLOCK_SIZE && kk < size; kk++) {
                            C[ii][jj] += A[ii][kk] * B[kk][jj];
                        }
                    }
                }
            }
        }
    }
}

int main(int argc, char* argv[]) {
    std::vector<double> inputValues;

    for (int i = 1; i < argc; ++i) {
        std::stringstream ss(argv[i]);
        double value;
        while (ss >> value) {
            inputValues.push_back(value);
        }
    }

    int size = static_cast<int>(std::sqrt(inputValues.size() / 2));

    std::vector<std::vector<double>> A(size, std::vector<double>(size));
    std::vector<std::vector<double>> B(size, std::vector<double>(size));
    std::vector<std::vector<double>> C(size, std::vector<double>(size, 0.0));

    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            A[i][j] = inputValues[i * size + j];
            B[i][j] = inputValues[(size * size) + (i * size + j)];
        }
    }

    multiply(A, B, C);

    return 0;
}
`}
                    </SyntaxHighlighter>

                    <a
                      href="/tutorial-codigos/camm_template.zip"
                      download
                      className="icon-button icon-button--primary"
                    >
                      Descargar código CAMM (.zip)
                    </a>

                    <p className="code-note">
                      ⚠️ <strong>Nota:</strong> Este código es funcional y
                      puedes usarlo tal como está para ejecutar el test. También
                      puedes subir tu propio código, siempre que respete la
                      estructura esperada y las condiciones definidas para este
                      tipo de prueba.
                    </p>
                  </div>

                  <div className="config-hint-box">
                    <h4 className="config-hint-title">Valores recomendados</h4>
                    <ul className="config-hint-list">
                      <li>
                        <strong>Tamaño máximo de entrada:</strong> 1000 a 10000
                      </li>
                      <li>
                        <strong>Repeticiones por incremento:</strong> 10 a 30
                      </li>
                      <li>
                        <strong>Tiempo estimado:</strong> 10 a 60 segundos
                      </li>
                    </ul>
                    <p className="config-hint-note">
                      Estos valores corresponden al código de ejemplo mostrado.
                      Puedes probar otros, pero asegúrate de que tu algoritmo y
                      el test puedan soportarlos correctamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Test SIZE */}
          <section className="tutorial-section">
            <div className="section-card app-card tutorial-card--dark">
              <h2 className="section-title section-title--accent">
                Test SIZE (Incremental Input Test)
              </h2>

              <div className="section-content">
                <div className="subsection">
                  <h3 className="subsection-title">¿Qué es el test SIZE?</h3>
                  <p>
                    El test SIZE evalúa el rendimiento del algoritmo al
                    incrementar progresivamente el tamaño de entrada. Su
                    objetivo es analizar la escalabilidad y la estabilidad del
                    código cuando se enfrenta a entradas cada vez mayores. Se
                    registran métricas como instrucciones ejecutadas, ciclos de
                    CPU, uso de caché y duración total de la ejecución.
                  </p>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Recomendaciones</h3>
                  <ul>
                    <li>
                      Optimizar la implementación para que no se degrade
                      significativamente con entradas grandes.
                    </li>
                    <li>
                      Subir siempre un archivo <code>.cpp</code> compilable.
                    </li>
                    <li>
                      No utilizar <code>cin</code> ni <code>getline</code> para
                      leer por teclado. Usa siempre argumentos.
                    </li>
                    <li>
                      Validar el tamaño máximo de entrada para evitar tiempos de
                      ejecución excesivos o errores inesperados.
                    </li>
                  </ul>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Ejemplo de código</h3>
                  <div className="code-placeholder code-placeholder--dark">
                    <SyntaxHighlighter
                      language="cpp"
                      style={oneDark}
                      showLineNumbers
                    >
                      {`#include <iostream>
#include <cstdlib>

long long iterativeFibonacci(int n) {
    if (n <= 1) return n;
    long long a = 0, b = 1, c;
    for (int i = 2; i <= n; ++i) {
        c = a + b;
        a = b;
        b = c;
    }
    return b;
}

int main(int argc, char* argv[]) {
    if (argc < 2) return 1;
    int num = std::atoi(argv[1]);
    iterativeFibonacci(num);
    return 0;
}
`}
                    </SyntaxHighlighter>

                    <a
                      href="/tutorial-codigos/size_template.zip"
                      download
                      className="icon-button icon-button--primary"
                    >
                      Descargar código SIZE (.zip)
                    </a>

                    <p className="code-note">
                      ⚠️ <strong>Nota:</strong> Este código es funcional y
                      puedes usarlo tal como está para ejecutar el test. También
                      puedes subir tu propio código, siempre que respete la
                      estructura esperada y las condiciones definidas para este
                      tipo de prueba.
                    </p>
                  </div>

                  <div className="config-hint-box">
                    <h4 className="config-hint-title">Valores recomendados</h4>
                    <ul className="config-hint-list">
                      <li>
                        <strong>Tamaño máximo de entrada:</strong> 1000 a 5000
                      </li>
                      <li>
                        <strong>Repeticiones por incremento:</strong> 10 a 30
                      </li>
                      <li>
                        <strong>Tiempo estimado:</strong> 10 a 60 segundos
                      </li>
                    </ul>
                    <p className="config-hint-note">
                      Estos valores corresponden al código de ejemplo. Puedes
                      probar otros, pero asegúrate de que tu algoritmo y el test
                      puedan soportarlos correctamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Métricas y gráficos */}
          <section className="tutorial-section">
            <div className="section-card app-card tutorial-card--dark">
              <h2 className="section-title section-title--accent">
                Comprensión de métricas y gráficos
              </h2>

              <div className="section-content">
                <div className="subsection">
                  <h3 className="subsection-title">Tipos de métricas</h3>
                  <p>
                    A continuación se explican las métricas utilizadas para
                    evaluar el rendimiento de tu código:
                  </p>
                  <ul>
                    <li>
                      <strong>Instructions:</strong> Número total de
                      instrucciones ejecutadas.
                    </li>
                    <li>
                      <strong>CpuCycles:</strong> Ciclos totales de CPU usados.
                    </li>
                    <li>
                      <strong>TaskClock:</strong> Tiempo de ejecución del
                      proceso en milisegundos.
                    </li>
                    <li>
                      <strong>CpuClock:</strong> Tiempo total de CPU consumido.
                    </li>
                    <li>
                      <strong>Branches:</strong> Número de bifurcaciones
                      ejecutadas.
                    </li>
                    <li>
                      <strong>BranchMisses:</strong> Fallos en la predicción de
                        branches.
                    </li>
                    <li>
                      <strong>
                        LLCLoads / LLCLoadMisses / LLCStores / LLCStoreMisses:
                      </strong>{" "}
                      Accesos y fallos en el último nivel de caché (LLC).
                    </li>
                    <li>
                      <strong>L1Dcache*</strong>: Lecturas/escrituras y fallos
                      en caché L1 de datos.
                    </li>
                    <li>
                      <strong>CacheReferences / CacheMisses:</strong>{" "}
                      Referencias y fallos de caché en general.
                    </li>
                    <li>
                      <strong>PageFaults / MajorFaults:</strong> Fallas de
                      página, especialmente las que requieren acceso a disco.
                    </li>
                    <li>
                      <strong>EnergyPkg / EnergyCores / EnergyRAM:</strong>{" "}
                      Energía consumida por el paquete de CPU, los núcleos y la
                      memoria RAM.
                    </li>
                    <li>
                      <strong>StartTime / EndTime / DurationTime:</strong>{" "}
                      Tiempos de inicio, fin y duración total.
                    </li>
                    <li>
                      <strong>IPC (Instructions Per Cycle):</strong>{" "}
                      Instrucciones por ciclo; valores más altos indican mejor
                      eficiencia.
                    </li>
                    <li>
                      <strong>CacheMissRate:</strong> CacheMisses /
                      CacheReferences.
                    </li>
                    <li>
                      <strong>BranchMissRate:</strong> BranchMisses / Branches.
                    </li>
                    <li>
                      <strong>CacheMissesPerMI:</strong> Fallos de caché por
                      millón de instrucciones.
                    </li>
                    <li>
                      <strong>BranchMissesPerMI:</strong> Fallos de predicción
                      por millón de instrucciones.
                    </li>
                  </ul>
                  <p>
                    Estas métricas te permiten analizar el comportamiento del
                    algoritmo, identificar cuellos de botella y orientar
                    optimizaciones.
                  </p>
                </div>

                <div className="subsection">
                  <h3 className="subsection-title">Ejemplos de gráficos</h3>
                  <div className="image-grid">
                    <div className="image-wrapper">
                      <img
                        src="/tutorial-images/ejemplo_grafico.PNG"
                        alt="Ejemplo de gráfico 1"
                        className="tutorial-image tutorial-image--wide"
                      />
                    </div>
                    <div className="image-wrapper">
                      <img
                        src="/tutorial-images/ejemplo_grafico2.PNG"
                        alt="Ejemplo de gráfico 2"
                        className="tutorial-image tutorial-image--wide"
                      />
                    </div>
                    <div className="image-wrapper">
                      <img
                        src="/tutorial-images/ejemplo_grafico3.PNG"
                        alt="Ejemplo de gráfico 3"
                        className="tutorial-image tutorial-image--wide"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="tutorial-footer tutorial-footer--dark">
        <div className="footer-container">
          <p>&copy; 2025 Performance System · Tutorial y documentación</p>
        </div>
      </footer>
    </div>
  );
};

export default TutorialPage;
