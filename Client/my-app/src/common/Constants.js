const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

export const serverURL = isDev ? "http://127.0.0.1:5000/" : "/";
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
        description: `Prueba con entrada de texto, usando un archivo de English50MB. Se realizan 30 incrementos hasta el tamaño del input. En cada incremento se ejecuta el algoritmo la cantidad de veces seleccionada por el usuario.`
    },
    {
        id: 'camm',
        title: 'Numerical input',
        description: `Prueba con entrada numérica, proveniente de un archivo con 150.000 valores. Se realizan 30 incrementos hasta el tamaño del input. Cada uno se repite según el número definido por el usuario.`
    },
    {
        id: 'size',
        title: 'Input size',
        description: `Prueba con entrada numérica única como argumento. Se realizan 30 incrementos del valor de entrada, y cada uno se repite tantas veces como defina el usuario.`
    }
];

export const numericalInputOptions = [
    { value: 'cammr', label: 'Numeros aleatoreos' },
    { value: 'cammso', label: 'Numeros semi-ordenados' },
    { value: 'camms', label: 'Numeros iguales' },
];

export const METRIC_DESCRIPTIONS = {
    Instructions: "Número total de instrucciones ejecutadas. Relacionado con la eficiencia general del código.",
    CpuCycles: "Ciclos totales de CPU usados. Indica uso intensivo del procesador.",
    TaskClock: "Tiempo de ejecución del proceso en milisegundos.",
    CpuClock: "Tiempo total de CPU consumido.",
    Branches: "Número de bifurcaciones (branches) ejecutadas.",
    BranchMisses: "Fallos en predicción de branches. Afecta rendimiento.",
    LLCLoads: "Lecturas desde el último nivel de caché (LLC).",
    LLCLoadMisses: "Fallos al leer desde LLC.",
    LLCStores: "Escrituras en LLC.",
    LLCStoreMisses: "Fallos al escribir en LLC.",
    L1DcacheLoads: "Lecturas desde caché L1 de datos.",
    L1DcacheLoadMisses: "Fallos al leer desde caché L1.",
    L1DcacheStores: "Escrituras en caché L1.",
    CacheReferences: "Referencias totales a cualquier nivel de caché.",
    CacheMisses: "Fallos generales de caché.",
    PageFaults: "Fallas de página. Indican acceso a memoria que no estaba en RAM.",
    MajorFaults: "Fallas mayores que requieren cargar datos desde disco.",
    EnergyPkg: "Energía consumida por el paquete completo del CPU (package).",
    EnergyCores: "Energía consumida específicamente por los núcleos del CPU.",
    EnergyRAM: "Energía consumida por la memoria RAM.",
    StartTime: "Hora de inicio de la ejecución.",
    EndTime: "Hora de fin de la ejecución.",
    DurationTime: "Duración total de la ejecución en milisegundos."
};

export const METRIC_CATEGORIES = {
    CPU: ["Instructions", "CpuCycles", "TaskClock", "CpuClock", "Branches", "BranchMisses"],
    Memoria: ["LLCLoads", "LLCLoadMisses", "LLCStores", "LLCStoreMisses", "L1DcacheLoads", "L1DcacheLoadMisses", "L1DcacheStores", "CacheReferences", "CacheMisses"],
    Sistema: ["PageFaults", "MajorFaults"],
    Tiempo: ["StartTime", "EndTime", "DurationTime"],
    Energía: ["EnergyPkg", "EnergyCores", "EnergyRAM"]
};
