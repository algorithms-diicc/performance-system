// CORE-06B-2: contrato científico de métricas/UI.
const isDev =
    !process.env.NODE_ENV ||
    process.env.NODE_ENV === "development";

export const serverURL =
    isDev ? "http://localhost:5000/" : "/";

export const baseURL = serverURL + "sendcode";
export const statusURL = serverURL + "checkstatus/";

export default function getTask(taskState) {
    console.log("taskstate", taskState);
    if (taskState === 'lcs')
        return "LCS";
    if (taskState === 'size') {
        return "SIZE";
    }
    if (taskState.includes('camm')) {
        if (taskState === 'cammr')
            return "CAMMR";
        if (taskState === 'cammso')
            return "CAMMSO";
        if (taskState === 'camms')
            return "CAMMS";
        return "CAMM";
    }
    return "";
}

export const tasks = [
    {
        id: 'lcs',
        title: 'Text input',
        description: `Prueba con entrada de texto, usando un archivo de English50MB. Se evalúan 10 tamaños de entrada distribuidos hasta el máximo configurado. Para cada tamaño se realizan las repeticiones definidas por el perfil de ejecución seleccionado.`
    },
    {
        id: 'camm',
        title: 'Numerical input',
        description: `Prueba con entrada numérica, proveniente de un archivo con 150.000 valores. Se evalúan 10 tamaños de entrada distribuidos hasta el máximo configurado. Para cada tamaño se realizan las repeticiones definidas por el perfil de ejecución seleccionado.`
    },
    {
        id: 'size',
        title: 'Input size',
        description: `Prueba con entrada numérica única como argumento. Se evalúan 10 tamaños de entrada distribuidos hasta el máximo configurado. Para cada tamaño se realizan las repeticiones definidas por el perfil de ejecución seleccionado.`
    }
];

export const numericalInputOptions = [
    { value: 'cammr', label: 'Números aleatorios' },
    { value: 'cammso', label: 'Números semiordenados' },
    { value: 'camms', label: 'Números iguales' },
];

export const METRIC_DESCRIPTIONS = {
    Instructions:
        "Número total de instrucciones ejecutadas por el CPU durante la ejecución del programa.\nRefleja la cantidad de operaciones básicas necesarias para completar la tarea.\nUn menor número de instrucciones, si se mantiene el mismo resultado, puede indicar un código más optimizado y eficiente.\nSin embargo, no siempre menos es mejor: depende de la calidad de la implementación y del tipo de algoritmo.",

    CpuCycles:
        "Cantidad total de ciclos de reloj del CPU utilizados para ejecutar el programa.\nCada ciclo de CPU representa un 'tick' donde el procesador puede ejecutar parte de una instrucción.\nComparar ciclos con instrucciones permite calcular la eficiencia real (IPC).\nMenos ciclos para la misma cantidad de instrucciones indica un uso más eficiente del procesador.",

    TaskClock:
        "Tiempo total de ejecución activo del proceso en milisegundos.\nIndica cuánto tiempo estuvo efectivamente ocupado el CPU ejecutando el proceso, considerando posibles hilos o tareas concurrentes.\nEs una métrica clave para comparar la rapidez entre diferentes implementaciones.",

    CpuClock:
        "Tiempo total de CPU consumido por el programa en milisegundos.\nIncluye el tiempo de todos los núcleos y hilos usados.\nSirve para medir el costo total de procesamiento, especialmente relevante en algoritmos paralelos o con múltiples hilos.",

    Branches:
        "Número total de bifurcaciones o saltos condicionales ejecutados, como if, loops o jumps.\nEl procesador necesita predecir estas bifurcaciones para mantener el flujo eficiente de ejecución.\nMuchos branches pueden hacer el flujo menos predecible, dificultando la optimización.",

    BranchMisses:
        "Cantidad de fallos en la predicción de bifurcaciones.\nCuando el procesador predice incorrectamente, se produce un 'branch misprediction', obligando a descartar instrucciones ya procesadas y reiniciar el flujo correcto.\nEsto penaliza el rendimiento y aumenta la latencia.",

    L1DcacheLoads:
        "Número de lecturas desde la caché L1 de datos (primer nivel).\nL1 (Level 1): caché más cercana al núcleo del CPU, extremadamente rápida pero pequeña (normalmente 32-64 KB).\nAcceder a L1 significa mínima latencia y máximo rendimiento.\nUn alto número de lecturas exitosas en L1 es deseable porque reduce la dependencia de niveles más lentos (L2, L3 y RAM).",

    L1DcacheLoadMisses:
        "Cantidad de fallos al leer en la caché L1 de datos.\nCuando ocurre un fallo en L1, el CPU debe buscar en la caché L2 o L3, o en última instancia en la RAM, lo cual es mucho más lento.\nMinimizar estos fallos es crítico para mantener la eficiencia y evitar cuellos de botella de memoria.\n\nSobre jerarquía de caché:\n- L1: la más rápida y cercana, pequeña.\n- L2: intermedia, más grande, compartida por menos núcleos.\n- L3: última línea de defensa antes de RAM, más grande y más lenta.",

    L1DcacheStores:
        "Número de escrituras en la caché L1 de datos.\nAlmacenar datos en L1 permite que operaciones posteriores (como bucles o acumulaciones) se ejecuten de manera extremadamente rápida.\nUn uso eficiente de la L1 evita presión en los niveles superiores y reduce los tiempos de acceso globales.",

    LLCLoads:
        "Número de lecturas realizadas desde la LLC (Last Level Cache), que en la mayoría de los sistemas modernos corresponde a la caché L3.\nL3 (Level 3): más grande y más lenta que L1 y L2, suele ser compartida por varios núcleos.\nAcceder a la LLC es mucho más rápido que ir a la RAM, pero más lento que L1 o L2.\nAlta actividad en LLC puede indicar acceso frecuente a datos compartidos entre hilos o núcleos.",

    LLCLoadMisses:
        "Cantidad de fallos al intentar leer en la LLC (Last Level Cache, normalmente L3).\nCuando se produce un fallo aquí, el CPU se ve obligado a buscar datos en la memoria RAM, lo que introduce mucha más latencia.\nReducir estos fallos mejora significativamente el rendimiento general y el consumo energético.",

    LLCStores:
        "Número de escrituras en la LLC (Last Level Cache, normalmente L3).\nEste nivel se usa para almacenar datos que podrían necesitar otros núcleos y para preparar escritura en RAM.\nUn uso eficiente ayuda a reducir la congestión en la RAM y facilita el trabajo en paralelo.",

    LLCStoreMisses:
        "Cantidad de fallos al escribir en la LLC (Last Level Cache).\nCuando ocurre un fallo, se debe escribir directamente en la memoria RAM, lo que es mucho más lento y costoso.\nMinimizar estos fallos implica un mejor diseño de estructuras de datos y un acceso más coherente a la memoria.",

    CacheReferences:
        "Referencias de caché reportadas por el contador genérico de rendimiento del sistema.\nRepresentan actividad de caché según la semántica que expone el PMU del procesador; su correspondencia exacta con un nivel concreto puede variar entre arquitecturas.\nSe interpreta principalmente junto con CacheMisses y no como un conteo universal de todos los accesos a todos los niveles de caché.",

    CacheMisses:
        "Fallos de caché reportados por el contador genérico de rendimiento del sistema.\nLa correspondencia exacta del evento depende de la arquitectura y del PMU, por lo que no debe interpretarse automáticamente como la suma de fallos de todos los niveles ni como una garantía de acceso posterior a RAM.\nSe utiliza junto con CacheReferences para estudiar la proporción de fallos observada por el contador disponible.",

    PageFaults:
        "Cantidad de fallos de página.\nSe producen cuando el proceso accede a una página de memoria que no está en la RAM y necesita ser cargada desde disco.\nLos fallos de página son una señal de que el programa está utilizando más memoria de la que puede mantener activa, lo que degrada drásticamente el rendimiento.",

    MajorFaults:
        "Cantidad de fallos de página 'mayores'.\nEstos requieren que el sistema operativo cargue datos desde disco o swap.\nSon extremadamente costosos en tiempo y afectan negativamente el rendimiento general.\nReducir el uso excesivo de memoria y optimizar el acceso ayuda a disminuir estos fallos.",

    EnergyPkg:
        "Energía registrada por el dominio físico CPU Package durante la ventana de medición del benchmark (J).\nLa lectura corresponde al dominio energético expuesto por la plataforma y no atribuye de forma exclusiva ese consumo al proceso del estudiante.\nSolo se muestra cuando el backend de medición entrega muestras numéricas válidas.",

    EnergyCores:
        "Energía registrada por el dominio físico de núcleos CPU durante la ventana de medición del benchmark (J), cuando dicho dominio está expuesto por la plataforma y es accesible al backend.\nNo debe interpretarse como energía exclusiva del proceso ni como una medida disponible en todo hardware.",

    EnergyRAM:
        "Energía registrada por el dominio de memoria/DRAM durante la ventana de medición del benchmark (J), únicamente cuando la plataforma expone ese dominio y el backend puede medirlo.\nLa ausencia de esta métrica se representa como no disponible; nunca se sustituye por cero.",

    StartTime:
        "Hora exacta en la que se inició la ejecución del programa.\nPermite rastrear cuándo se realizó la prueba y correlacionar con otros experimentos o estados del sistema.",

    EndTime:
        "Hora exacta en la que finalizó la ejecución.\nCombinada con StartTime, sirve para verificar la duración total de forma precisa y para auditoría experimental.",

    DurationTime:
        "Duración total de la ejecución del programa en milisegundos.\nEs una de las métricas más intuitivas para el usuario, ya que indica el tiempo real que tarda en completarse la tarea.\nSe usa como referencia principal para comparar la rapidez entre algoritmos o configuraciones.",

    IPC:
        "Instructions Per Cycle (IPC), o Instrucciones por Ciclo.\nCalculado como Instructions / CpuCycles.\nMide cuántas instrucciones se ejecutan en promedio por ciclo de CPU.\nUn IPC alto indica un mejor aprovechamiento del procesador y mayor eficiencia.\nEste valor depende del tipo de tarea y de cómo el compilador y el CPU gestionan el flujo de instrucciones.",

    CacheMissRate:
        "Tasa de fallos de caché.\nCalculada como CacheMisses / CacheReferences.\nExpresa la proporción entre los fallos y las referencias reportadas por los contadores genéricos disponibles en ese hardware.\nUna tasa menor puede indicar un patrón de acceso más favorable, pero su interpretación debe considerar la arquitectura y la semántica del PMU utilizado.",

    BranchMissRate:
        "Tasa de fallos en predicción de bifurcaciones.\nCalculada como BranchMisses / Branches.\nRefleja qué tan bien el procesador logra predecir los saltos en el flujo del programa (if, loops).\nUna tasa baja significa menor penalización y mayor aprovechamiento del pipeline, lo que se traduce en mejor rendimiento.",
    CacheMissesPerMI:
        "Fallos de caché por millón de instrucciones.\n" +
        "Calculada como CacheMisses / (Instructions / 1e6).\n" +
        "Este indicador normaliza los fallos de caché respecto al volumen total de instrucciones ejecutadas, " +
        "permitiendo una comparación más justa entre algoritmos de diferente tamaño.\n" +
        "Valores bajos reflejan una mejor localidad de datos y mayor eficiencia en el uso de la jerarquía de memoria.",

    BranchMissesPerMI:
        "Fallos de predicción de saltos por millón de instrucciones.\n" +
        "Calculada como BranchMisses / (Instructions / 1e6).\n" +
        "Este indicador complementa a BranchMissRate, pero al estar expresado por unidad de trabajo (instrucciones ejecutadas) " +
        "facilita la comparación entre implementaciones con diferente volumen de instrucciones.\n" +
        "Valores bajos sugieren un flujo de control más predecible y eficiente."

};


export const METRIC_CATEGORIES = {
    CPU: ["Instructions", "CpuCycles", "TaskClock", "CpuClock", "Branches", "BranchMisses", "BranchMissesPerMI", "IPC"],
    Memoria: ["LLCLoads", "LLCLoadMisses", "LLCStores", "LLCStoreMisses", "L1DcacheLoads", "L1DcacheLoadMisses", "L1DcacheStores", "CacheReferences", "CacheMisses", "CacheMissRate", "CacheMissesPerMI"],
    Sistema: ["PageFaults", "MajorFaults"],
    // CORE-06B-2: StartTime/EndTime son metadatos de trazabilidad,
    // no métricas de rendimiento del dashboard.
    Tiempo: ["DurationTime"],
    Energía: ["EnergyPkg", "EnergyCores", "EnergyRAM"],
    "Predicción de Flujo": ["BranchMissRate"]
};
