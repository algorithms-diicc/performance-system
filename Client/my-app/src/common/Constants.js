
export const serverURL = "http://127.0.0.1:5000/";
export const baseURL = serverURL + "sendcode";
export const statusURL = serverURL + "checkstatus/";
export default function getTask(taskState){
    console.log("taskstate", taskState);
    if(taskState === 'lcs')
        return "LCS";
    if(taskState === 'size'){
        return "SIZE";
    }
    if (taskState.includes('camm')){
        if(taskState === 'cammr')
            return "CAMMR";
        if(taskState === 'cammso')
            return "CAMMSO";
        if(taskState === 'camms')
            return "CAMMS";
        return "CAMM";
    }
    return "";
}

export const tasks = [
    {
        id: 'none',
        title: 'None',
        description: `Test de 30 repeticiones`
    },
    {
        id: 'lcs',
        title: 'Text input',
        description: `Test con entrada por argumento de un solo archivo de texto, proveniente de English50MB. 30 Incrementos hasta llegar al valor maximo con 30 repeticiones cada uno`
    },
    {
        id: 'camm',
        title: 'Numerical input',
        description: `Test con entrada por argumento de un solo archivo de numeros, contiene 150000 valores. 30 Incrementos hasta llegar al valor maximo con 30 repeticiones cada uno`
    },
    {
        id: 'size',
        title: 'Input size',
        description: `Test con entrada por argumento de un solo valor. 30 Incrementos hasta llegar al valor maximo con 30 repeticiones cada uno`
    }
  ];

  export const numericalInputOptions = [
    { value: 'cammr', label: 'Numeros aleatoreos' },
    { value: 'cammso', label: 'Numeros semi-ordenados' },
    { value: 'camms', label: 'Numeros iguales' },
  ];