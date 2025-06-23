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