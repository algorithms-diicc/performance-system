import React from 'react';
import './TutorialPage.css'; // Archivo CSS que ya tienes
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
const TutorialPage = () => {
    return (
        <div className="tutorial-page">
            {/* Contenido principal */}
            <main className="tutorial-main">
                <div className="tutorial-container">

                    {/* Título General */}
                    <header className="tutorial-header">
                        <h1 className="tutorial-title">Tutorial y Ejemplos de Ejecución</h1>
                        <p className="tutorial-subtitle">
                            Aprende a usar Performance System para medir y analizar el rendimiento de tu código C++
                        </p>
                    </header>

                    {/* Sección: Flujo General del Sistema */}
                    <section className="tutorial-section">
                        <div className="section-card">
                            <h2 className="section-title">Flujo General del Sistema</h2>
                            <div className="section-content">
                                <p>
                                    📥 <strong>Subir archivo .zip:</strong> El usuario sube un archivo comprimido que contiene uno o más archivos <code>.cpp</code>.
                                </p>
                                <div className="image-wrapper">
                                    <img
                                        src="/tutorial-images/zip.PNG"
                                        alt="Subida de archivo a la plataforma"
                                        style={{ maxWidth: "30%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                    />
                                </div>

                                <p>
                                    ⚙️ <strong>Configuración del test:</strong> Debes seleccionar el tipo de test que deseas realizar (por ejemplo, LCS, CAMM o SIZE). Además, debes definir el <strong>Max Input Size</strong> y las repeticiones por incremento.
                                </p>
                                <div className="image-wrapper">
                                    <img
                                        src="/tutorial-images/configuracion_de_test.PNG"
                                        alt="Configuración de test"
                                        style={{ maxWidth: "30%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                    />
                                </div>

                                <p>
                                    ⚡ <strong>Compilación y envío:</strong> El backend compila automáticamente cada archivo y lo envía a la red de máquinas medidoras (slaves).
                                </p>

                                <p>
                                    🧪 <strong>Ejecución y medición:</strong> Cada slave mide consumo energético, instrucciones, ciclos de CPU, tiempos y otros parámetros usando <code>perf</code>.
                                </p>
                                <div className="image-wrapper">
                                    <img
                                        src="/tutorial-images/test-realizado.PNG"
                                        alt="Test realizado"
                                        style={{ maxWidth: "30%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                    />
                                </div>

                                <p>
                                    📊 <strong>Resultados:</strong> Los resultados se visualizan en gráficos interactivos y se pueden descargar como CSV.
                                </p>
                                <div className="image-wrapper">
                                    <img
                                        src="/tutorial-images/visualizacion-de-resultados.PNG"
                                        alt="Visualización de resultados"
                                        style={{ maxWidth: "30%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sección: Test LCS */}
                    <section className="tutorial-section">
                        <div className="section-card">
                            <h2 className="section-title">Test LCS (Longest Common Subsequence)</h2>
                            <div className="section-content">
                                <div className="subsection">
                                    <h3 className="subsection-title">¿Qué es el Test LCS?</h3>
                                    <p>
                                        Este ejemplo corresponde a un test de tipo LCS (Text Input) que mide el rendimiento de un algoritmo que busca la Subcadena Común Más Larga entre dos mitades de un texto. Tu programa será evaluado midiendo métricas de rendimiento como instrucciones ejecutadas, fallos y aciertos de caché, ciclos de CPU y tiempo total de ejecución.                                   </p>
                                </div>
                            </div>
                            <div className="subsection">
                                <h3 className="subsection-title">Recomendaciones</h3>
                                <ul>
                                    <li>Optimizar la implementación para minimizar el uso de memoria y CPU.</li>
                                    <li>Subir siempre un archivo <code>.cpp</code> compilable.</li>
                                    <li>No utilizar <code>cin</code> ni <code>getline</code> para leer por teclado. Usa siempre argumentos o archivos.</li>
                                    <li>El archivo de texto usado es <code>input/english.50MB</code> y será pasado automáticamente como argumento.</li>
                                </ul>
                            </div>
                            <div className="subsection">
                                <h3 className="subsection-title">Ejemplo de Código</h3>
                                <div className="code-placeholder">
                                    <SyntaxHighlighter language="cpp" style={oneDark} showLineNumbers>
                                        {`
#include <iostream>
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
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sección: Test CAMM */}
                    <section className="tutorial-section">
                        <div className="section-card">
                            <h2 className="section-title">Test CAMM (Cache-Aware Matrix Multiplication)</h2>
                            <div className="section-content">
                                <div className="subsection">
                                    <h3 className="subsection-title">¿Qué es el Test CAMM?</h3>
                                    <p>
                                        El test CAMM mide el rendimiento en la multiplicación de matrices usando entrada numérica, con variantes de datos aleatorios, iguales o semi-ordenados. Permite evaluar el comportamiento del cache y la eficiencia en operaciones numéricas. El backend selecciona automáticamente el archivo de entrada según la opción elegida (CAMM, CAMMS o CAMMSO). No es necesario modificar el código para manejar el input.
                                    </p>
                                </div>
                                <div className="subsection">
                                    <h3 className="subsection-title">Recomendaciones</h3>
                                    <ul>
                                        <li>Verificar siempre la consistencia de las dimensiones antes de ejecutar.</li>
                                        <li>El código debe recibir los datos como argumentos (<code>argv</code>), no desde teclado.</li>
                                        <li>Confirma que tu lógica de parsing respete el formato: matriz A linealizada seguida de matriz B linealizada.</li>
                                        <li>No necesitas preocuparte de cargar archivos manualmente; el sistema lo gestiona.</li>
                                    </ul>

                                </div>
                                <div className="subsection">
                                    <h3 className="subsection-title">Ejemplo de Código</h3>
                                    <div className="code-placeholder">
                                        <SyntaxHighlighter language="cpp" style={oneDark} showLineNumbers>
                                            {`
#include <iostream>
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
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Sección: Test SIZE */}
                    <section className="tutorial-section">
                        <div className="section-card">
                            <h2 className="section-title">Test SIZE (Incremental Input Test)</h2>
                            <div className="section-content">
                                <div className="subsection">
                                    <h3 className="subsection-title">¿Qué es el Test SIZE?</h3>
                                    <p>
                                        El test SIZE evalúa el rendimiento del algoritmo al incrementar progresivamente el tamaño de entrada. Su objetivo es analizar la escalabilidad y la estabilidad del código cuando se enfrenta a entradas cada vez mayores.
                                        Durante la prueba se registran métricas como instrucciones ejecutadas, ciclos de CPU, uso de caché y duración total de la ejecución. Este test es ideal para identificar cuellos de botella y medir el impacto de optimizaciones en escenarios que simulan cargas crecientes.
                                    </p>
                                </div>
                                <div className="subsection">
                                    <h3 className="subsection-title">Recomendaciones</h3>
                                    <ul>
                                        <li>Optimizar la implementación para que no se degrade significativamente con entradas grandes.</li>
                                        <li>Subir siempre un archivo <code>.cpp</code> compilable.</li>
                                        <li>No utilizar <code>cin</code> ni <code>getline</code> para leer por teclado. Usa siempre argumentos.</li>
                                        <li>Validar el tamaño máximo de entrada para evitar tiempos de ejecución excesivos o errores inesperados.</li>
                                    </ul>
                                </div>
                                <div className="subsection">
                                    <h3 className="subsection-title">Ejemplo de Código</h3>
                                    <div className="code-placeholder">
                                        <SyntaxHighlighter language="cpp" style={oneDark} showLineNumbers>
                                            {`
#include <iostream>
#include <cstdlib>

// Función recursiva para calcular Fibonacci
long long recursiveFibonacci(int n) {
    if (n <= 1) return n;
    return recursiveFibonacci(n - 1) + recursiveFibonacci(n - 2);
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Uso: ./a.out <tamaño_input>" << std::endl;
        return 1;
    }

    int num = std::atoi(argv[1]);
    recursiveFibonacci(num);

    std::cout << "Fibonacci calculado para n = " << num << std::endl;
    return 0;
}
                        `}
                                        </SyntaxHighlighter>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>


                    {/* Sección: Métricas y Gráficos */}
                    <section className="tutorial-section">
                        <div className="section-card">
                            <h2 className="section-title">Comprensión de Métricas y Gráficos</h2>
                            <div className="section-content">
                                <div className="subsection">
                                    <h3 className="subsection-title">Tipos de Métricas</h3>
                                    <p>
                                        A continuación se explican las principales métricas utilizadas para evaluar el rendimiento de tu código:
                                    </p>
                                    <ul>
                                        <li><strong>Instructions:</strong> Número total de instrucciones ejecutadas. Relacionado con la eficiencia general del código.</li>
                                        <li><strong>CpuCycles:</strong> Ciclos totales de CPU usados. Indica uso intensivo del procesador.</li>
                                        <li><strong>TaskClock:</strong> Tiempo de ejecución del proceso en milisegundos.</li>
                                        <li><strong>CpuClock:</strong> Tiempo total de CPU consumido.</li>
                                        <li><strong>Branches:</strong> Número de bifurcaciones (branches) ejecutadas.</li>
                                        <li><strong>BranchMisses:</strong> Fallos en predicción de branches. Afecta rendimiento.</li>
                                        <li><strong>LLCLoads:</strong> Lecturas desde el último nivel de caché (LLC).</li>
                                        <li><strong>LLCLoadMisses:</strong> Fallos al leer desde LLC.</li>
                                        <li><strong>LLCStores:</strong> Escrituras en LLC.</li>
                                        <li><strong>LLCStoreMisses:</strong> Fallos al escribir en LLC.</li>
                                        <li><strong>L1DcacheLoads:</strong> Lecturas desde caché L1 de datos.</li>
                                        <li><strong>L1DcacheLoadMisses:</strong> Fallos al leer desde caché L1.</li>
                                        <li><strong>L1DcacheStores:</strong> Escrituras en caché L1.</li>
                                        <li><strong>CacheReferences:</strong> Referencias totales a cualquier nivel de caché.</li>
                                        <li><strong>CacheMisses:</strong> Fallos generales de caché.</li>
                                        <li><strong>PageFaults:</strong> Fallas de página. Indican acceso a memoria que no estaba en RAM.</li>
                                        <li><strong>MajorFaults:</strong> Fallas mayores que requieren cargar datos desde disco.</li>
                                        <li><strong>EnergyPkg:</strong> Energía consumida por el paquete completo del CPU (package).</li>
                                        <li><strong>EnergyCores:</strong> Energía consumida específicamente por los núcleos del CPU.</li>
                                        <li><strong>EnergyRAM:</strong> Energía consumida por la memoria RAM.</li>
                                        <li><strong>StartTime:</strong> Hora de inicio de la ejecución.</li>
                                        <li><strong>EndTime:</strong> Hora de fin de la ejecución.</li>
                                        <li><strong>DurationTime:</strong> Duración total de la ejecución en milisegundos.</li>
                                    </ul>
                                    <p>
                                        📈 Estas métricas te permiten analizar el comportamiento detallado de tu algoritmo, identificar cuellos de botella y optimizar el rendimiento general.
                                    </p>
                                </div>
                                <div className="subsection">
                                    <h3 className="subsection-title">Ejemplos de Gráficos</h3>
                                    <div className="image-placeholder">
                                        <div className="image-wrapper">
                                            <img
                                                src="/tutorial-images/ejemplo_grafico.PNG"
                                                alt="Visualización de resultados"
                                                style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                            /></div>
                                        <div className="image-wrapper">
                                            <img
                                                src="/tutorial-images/ejemplo_grafico2.PNG"
                                                alt="Visualización de resultados"
                                                style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                            /></div>
                                        <div className="image-wrapper">
                                            <img
                                                src="/tutorial-images/ejemplo_grafico3.PNG"
                                                alt="Visualización de resultados"
                                                style={{ maxWidth: "100%", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                                            /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </main >

            {/* Footer opcional */}
            < footer className="tutorial-footer" >
                <div className="footer-container">
                    <p>&copy; 2024 Performance System - Tutorial y Documentación</p>
                </div>
            </footer >
        </div >
    );
};

export default TutorialPage;
