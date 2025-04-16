# Plataforma de Medicion de Energia de Codigos C++

Una aplicacion web que un cliente accede mediante una pagina web. El cliente envia un codigo c++ que quiera medir a traves de la pagina, y una red de computadores llamados medidores, lo miden para obtener estadisticas. Estas estadisticas se pueden utilizar para estandarizar la forma en que los codigos se miden, evitando el bias de las caracteristicas de los computadores. Los medidores utilizan la tecnologia de Intel RAPL para obtener las estadisticas, accedida mediante ```perf```.

## Como correr plataforma de manera local

### Puertos asignados 

- 5000 React App
- 50000 app.py
- 60000 slave.py

**Cambiar las direcciones a local**

En cualquier archivo que aparezcan las siguientes direcciones, cambiar por su contraparte respectiva:
- 192.168.56.1 -> 127.0.0.1
- http://keira.inf.udec.cl/'+this.props.code+'/mean -> http://127.0.0.1/'+this.props.code+'/mean

### Correr React webapp
Conciderar que se requiere una version de node >= 12.20.0
En directorio power-tester/Client/my-app/, instalar dependencias con 
    ```npm install ```
Luego 
    ```npm start ```

### Setup de ambiente 

El ambiente es requierido para administrar las dependencias del proyecto.
En directorio power-tester/Server/
```conda env create -f powertester.yml```
```conda activate memoria```

en app.py usar measurescript2.sh y en este ultimo agregar al comando perf :'duartion_time'

Inicializar el input de testeo
En la carpeta power-tester/Server/input
```python3 init_input.py```
### Setup de perf

Hay que cambiar los permisos de perf
Al realizar     sudo nano /proc/sys/kernel/perf_event_paranoid
cambiar el valor predefinido de 4 -> -1

### Correr Servidor 

En directorio power-tester/Server/webapp
```python3 app.py```
o usar gunicorn: 
```gunicorn --bind 127.0.0.1:5000 wsgi:app```

### Correr Medidor 

En directorio power-tester/Server/
```python3 Slave.py```

![general](https://user-images.githubusercontent.com/26441581/210628228-049075b1-c714-453e-88a9-84c1e5d74113.png)

Estructura interna.

### Imagenes de la utilizacion de la plataforma, de manera secuencial.

Interfaz hecha utilizando React.

![plataforma pag1](https://user-images.githubusercontent.com/26441581/210628436-1a55d37d-bdce-4b02-999e-e5d66d55775d.PNG)

![plataforma pag1 listo](https://user-images.githubusercontent.com/26441581/210628447-5e2fce05-5c75-4cd2-bb76-30df911c6e87.PNG)

![plataforma pag2](https://user-images.githubusercontent.com/26441581/210628502-d073b0e6-460a-4b8f-80ca-6501e2f72d80.PNG)

![plataforma pag2 2](https://user-images.githubusercontent.com/26441581/210628677-17d226d4-16c3-4b3c-b6b0-8e6b8867b372.PNG)

![plataforma pag2 3](https://user-images.githubusercontent.com/26441581/210628707-6a4cc76e-484e-4af1-8dc6-70c4fcbcfb2f.PNG)

# Pruebas disponibles 

# To-do 
Multiplicacion de matrices
cache oblivious
Modificar el flujo de graficos para aceptar box plot
slave.py: 
    uncomment # get_box_graph_params(result_name)
    change measurescript3 to 4