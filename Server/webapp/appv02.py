# , make_response , send_file
from flask import Flask, request, render_template, abort, url_for, redirect, make_response
from flask_cors import CORS
import matplotlib.pyplot as plt
import pandas as pd
import subprocess
import random
import socket
import json
import threading as th
import time
from statistics import mean
import sys
import numpy as np

app = Flask(__name__)

CORS(app)

queuelist = []
# statusdict = OrderedDict()
activeS = 0  # medidores activos (medidores que han respondido al servidor)
activeR = 0
color = ['red', 'green', 'blue', 'orange', 'purple']
unidadesdemedida = ['Joules', 'Joules', 'Joules', 'Instrucciones', 'Cargas de caché', 'Fallos de caché', 'Guardados de caché', 'Fallos de guardados de caché', 'Cargas de caché', 'Fallos de carga de caché', 'Guardados de caché', 'Fallos de caché', 'Referencias de caché', 'Ramas', 'Fallos de ramas', 'Ciclos de cpu', 'Nanosegundos']

def graph_results(name):
    print("Plotting " + name + "!")
    # print(activeS, activeR)
    subprocess.run(["/bin/mkdir", "static/" + name], universal_newlines=True)

    #El siguiente bloque es el soporte iniciar de medicion, que permite el uso de multiples maquinas medidoras
    #como solo existe un medidor, no se utiliza. Ademas, no posee soporte para graficar multiples
    #graficas de barras de potencia(watts) en una sola figura.
    #los archivos recibidos de los medidores aun tendran un valor que los diferencia (por ejemplo,
    # la medicion de la maquina 1 tendra un valor 0 en el csv de resultado, el de la maquina2, 1, y asi sucesivamente)

    # auxList = []            
    # for i in range(activeR):
    #     nameresult = name + "Results" + str(i) + ".csv"
    #     auxList.append(pd.read_csv(nameresult))

    # for columni in range(17):
    #     fig, ax = plt.subplots()
    #     for machine in range(activeR):
    #         df = auxList[machine]
    #         try:
    #             df.plot(
    #                 y=columni, use_index=True, color=color[machine], title=df.columns[columni],
    #                 legend=None, xlabel='Iterations',
    #                 ylabel=unidadesdemedida[columni], style='--', marker='.', ax=ax, label="Maquina "+str(machine))
    #         except TypeError:
    #             continue
    #     ax.ticklabel_format(scilimits=[-5,5])
    #     plt.minorticks_on()
    #     plt.grid()
    #     if ax.lines:
    #         plt.savefig("static/" + name + "/fig" + str(columni) + ".svg", format='svg')
    #     plt.close(fig)
    # for machine in range(activeR):
    #     nameresult = name + "Results" + str(machine) + ".csv"
    #     subprocess.run(["/bin/mv", nameresult, "static/" + name])
    # print("Done!")

    #leer archivo results0 puesto que solo existe 1 medidor

    nameresult = name + "Results"+ str(0) + ".csv"
    csvobj = pd.read_csv(nameresult)
    for i in range(3):
        aux2 = []
        for j in range(30):
            temp = csvobj.iloc[j,16] / float(10**9)
            temp2 = csvobj.iloc[j, i] / temp
            temp2 = round(temp2, 3)
            aux2.append(temp2)
        if i == 0:
            csvobj['PowerCores'] = aux2
        if i == 1:
            csvobj['PowerPkg'] = aux2
        if i == 2:
            csvobj['PowerRAM'] = aux2
    with open("static/"+name+"/"+name+"ResultsFinal.csv", 'x') as w:
        csvobj.to_csv(w, index=False)

    for columni in range(17):
        fig, ax = plt.subplots()
        df = csvobj
        test = csvobj.iloc[:, columni]
        if(columni < 3):
            ax2 = ax.twinx()
            #todo: 2 ejes y, uno x, energia, potencia
            test2 = csvobj.iloc[:, columni+17]
            ax.axhline(mean(test), label='Energia promedio', color='orange')
            ax2.axhline(mean(test2), label='Potencia promedio', color='purple')
            df.plot(y=columni, use_index=True, kind='bar', ax=ax, color='salmon',
                    ylabel=unidadesdemedida[columni], legend=None, xlabel='Iteraciones')
            ax.set_ylim(top=max(test)+0.1, bottom=max(min(test)-0.1,0))
            df.plot(y=columni+17, use_index=True, kind='line', ax=ax2, color='red', ylabel='Watts', style='--', marker='.')
            lines, labels = ax.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            ax2.legend(lines + lines2, labels + labels2, loc='upper right')
            plt.xticks(np.arange(0,30, step=5))
# +17
        else:
            try:
                df.plot(
                    y=columni, use_index=True, color=color[0], title=df.columns[columni],
                    legend=None, xlabel='Iteraciones',
                    ylabel=unidadesdemedida[columni], style='--', marker='.', ax=ax, label="")
                ax.axhline(mean(test), label='Promedio', color='orange')
            except TypeError:
                continue
        if(columni>3):
            plt.ticklabel_format(scilimits=[-5,5])
        plt.minorticks_on()
        plt.grid()
        if ax.lines:
            plt.savefig("static/" + name + "/fig" + str(columni) + ".svg", format='svg')
        plt.close(fig)
    subprocess.run(["/bin/mv", nameresult, "static/" + name])
    print("Done!")


def send_manager(s, json_string, name):
    global activeS
    firsttime = True
    s.settimeout(20.0)
    counter = 0
    while True:
        try:
            conn, addr = s.accept()
            th.Thread(target=send_program, args=(conn, json_string), daemon=True).start()
            counter = counter + 1
        except socket.timeout:
            if counter == 0:
                print("No measure machines available!", file=sys.stderr)
                w = open("status/"+name, 'r+')
                w.seek(0)
                w.write('ERROR: no machines available')
                w.truncate()
                w.close()
            break
        if(firsttime):
            firsttime = False
            s.settimeout(5.0)
    activeS = counter


def send_program(conn, json_string):
    with conn:
        conn.sendall(json_string.encode())


def recv_manager(s, name):
    global activeR
    counter = 0
    firsttime = True
    s.settimeout(40.0)
    while True:
        try:
            conn, addr = s.accept()
            th.Thread(target=receive_data, args=(conn, counter, ), daemon=True).start()
            counter = counter + 1
        except socket.timeout:
            if counter == 0:
                print("No measure machines available!", file=sys.stderr)
                w = open("status"+name, 'r+')
                w.seek(0)
                w.write('ERROR: no machines available')
                w.truncate()
                w.close()
            break
        if(firsttime):
            firsttime = False
            s.settimeout(5.0)
        # inicia conteo de 5 segundos para recibir archivos
    activeR = counter


def receive_data(conn, ident):
    with conn:
        payload = b''
        while True:
            data = conn.recv(1024)
            if not data:
                break
            payload += data
        payloadDict = json.loads(payload.decode())
        name = payloadDict["name"] + str(ident) + ".csv"
        with open(name, 'w') as f:
            f.write(payloadDict["results"])


def slave_serve(file_dir, name, cmd):
    port = 50000
    port2 = 60000
    host = '127.0.0.1'
    print(file_dir, name, cmd)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        s2.bind((host, port2))
        s.listen(5)
        s2.listen(5)
        with open(file_dir, 'r') as f:
            code = f.read()
        m = {"name": name, "cmd": cmd, "code": code}
        json_string = json.dumps(m)
        sendmng = th.Thread(target=send_manager, args=(s, json_string, name, ), daemon=True)
        sendmng.start()
        recvmng = th.Thread(target=recv_manager, args=(s2, name, ), daemon=True)
        recvmng.start()
    finally:
        sendmng.join()
        print("Socket 1 disconnected!")
        recvmng.join()
        print("Socket 2 disconnected!")
        s.close()
        s2.close()


def security_check():
    pass


@app.route('/hola', methods=['GET'])
def hola():
    t = subprocess.run(['ls', 'status'], capture_output=True, universal_newlines=True)
    return str(t.stdout)


@app.route('/test', methods=['GET'])
def test():
    return render_template("index.html")

@app.route('/', methods=['GET'])
def home():
    return redirect(url_for('test'))


@app.route('/checkstatus/<code>', methods=['GET'])
# crear ruta para ver status de codigo
def tmr(code):
    try:
        temp = open("status/"+code, 'r+', newline='\n')
    except FileNotFoundError:
        abort(404)
    data = temp.read()
    response = make_response(data, 200)
    response.headers["content-type"] = "text/plain;charset=UTF-8"
    return response


@app.route('/checkmeasurers', methods=['GET'])
def check():
    if abs(activeR - activeS) != 0:
        return 'Algunos medidores no responden!', 200
    else:
        return 'Todo OK!', 200


@app.route('/sendcode', methods=['POST'])          # endpoint Recibir Codigo
def cap_code():
    code = request.form['code']
    file_dir = str(random.randint(0, 13458345324))
    name = file_dir
    outputfile = "test/" + file_dir + ".out"
    file_dir = "test/" + file_dir + ".cpp"
    with open(file_dir, "w", newline="\n") as f:
        f.write(code)
    statusfile = "status/" + name
    st = open(statusfile, "w", newline="\n")
    time.sleep(2)
    print("Code received!")
    if not security_check:
        abort(409)
    # temppath = 'g++ ' + file_dir + ' -o ' + outputfile
    # print(temppath)
    new_compile = subprocess.Popen(
       ["g++", file_dir, "-o", outputfile],
       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    try:
        output, outerr = new_compile.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        new_compile.kill()
        st.write('ERROR: timeout compile\n')
        st.write(outerr)
        st.close()
        return str(name), 200
    if new_compile.returncode:
        st.write('ERROR: at compile\n')
        st.write(outerr)
        st.close()
        return str(name), 200
    outputfile = "./" + outputfile
    new_execute = subprocess.Popen(
        [outputfile], stdin=subprocess.PIPE,
        stdout=subprocess.PIPE, universal_newlines=True)
    try:
        output, outerr = new_execute.communicate(timeout=15)
    except subprocess.TimeoutExpired:
        new_execute.kill()
        output, outerr = new_execute.communicate()
        st.write('ERROR: timeout execute\n')
        st.write(outerr)
        st.close()
        return str(name), 200
    if new_execute.returncode:
        st.write('ERROR: execute returned non-zero\n')
        return str(name), 200
    else:
        subprocess.run(["/bin/rm", outputfile], timeout=15)
    queuelist.append([file_dir, name, "-O3"])
    st.write('IN QUEUE')
    st.close()
    # print(statusdict, len(statusdict))
    return str(name), 200


@app.before_first_request
def spawner():
    th.Thread(target=queue_manager, daemon=True).start()


def queue_manager():        # administrador de cola
    while True:
        if not queuelist:
            # print('Waiting...')
            s = subprocess.run(
                "ls status| wc -l",
                capture_output=True, universal_newlines=True, shell=True)
            if int(s.stdout) >= 50:           # Usar Log
                s2 = subprocess.run(
                    "find status -type f -printf '%T+ %p\n' | sort | head -1",
                    capture_output=True, universal_newlines=True, shell=True)
                temp = s2.stdout.split()
                temp2 = temp[1].split('/')
                print("Removed element " + temp[1] + "! from status files", file=sys.stderr)
                subprocess.run(["/bin/rm", temp[1]], timeout=15)
                subprocess.run(["/bin/rm", "static/" + temp2[1], "-rf"], timeout=15)
            time.sleep(10)
        else:
            nextInline = queuelist.pop()
            r = open("status/"+nextInline[1],'r')
            asd = r.read()
            r.close()
            if asd == 'IN QUEUE':
                slave_serve(nextInline[0], nextInline[1], nextInline[2])
                r = open("status/"+nextInline[1],'r+')
                asd2 = r.read()
                if asd2 != 'ERROR: no machines available':
                    graph_results(nextInline[1])
                    print(nextInline, 'served!')
                    r.seek(0)
                    r.write('DONE')
                    r.truncate()
                else:
                    print(nextInline, 'failed: No machines available!')
                r.close()
# agregar mensajes de error en lista de status


if __name__ == '__main__':
    app.run(host='0.0.0.0')
