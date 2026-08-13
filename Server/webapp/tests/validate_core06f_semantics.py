#!/usr/bin/env python3
from pathlib import Path
import importlib
import math
import os
import subprocess
import sys

REL_INTERP = Path('Server/webapp/services/interpretation_service.py')
REL_PED = Path('Server/webapp/services/pedagogy_service.py')
REL_AI = Path('Server/webapp/services/ai_explanation_service.py')

def find_root():
    starts = [Path.cwd().resolve(), Path(__file__).resolve().parent]
    env = os.environ.get('PERF_SYSTEM_ROOT')
    if env:
        starts.insert(0, Path(env).expanduser().resolve())
    seen = set()
    for start in starts:
        for candidate in [start, *start.parents]:
            if candidate in seen:
                continue
            seen.add(candidate)
            if (candidate/REL_INTERP).is_file():
                return candidate
    raise SystemExit('ERROR: no pude localizar la raíz del proyecto.')

ROOT = find_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

passes = 0
fails = []
def check(ok, name, detail=''):
    global passes
    if ok:
        passes += 1
        print('[PASS]', name)
    else:
        fails.append((name, detail))
        print('[FAIL]', name, detail)

def main():
    for rel in [REL_INTERP, REL_PED]:
        p = subprocess.run([sys.executable, '-m', 'py_compile', str(ROOT/rel)], capture_output=True, text=True)
        check(p.returncode == 0, f'py_compile {rel}', p.stderr.strip())

    interp_text = (ROOT/REL_INTERP).read_text(encoding='utf-8')
    ped_text = (ROOT/REL_PED).read_text(encoding='utf-8')
    ai_text = (ROOT/REL_AI).read_text(encoding='utf-8')
    check('INTERPRETATION_VERSION = "1.1"' in interp_text, 'Versión de interpretación 1.1')
    check('"central_value": "median"' in interp_text, 'Metodología usa mediana')
    check('El filtrado IQR eliminó' not in ped_text, 'No queda redacción IQR destructiva')
    check(
        'Estas observaciones se conservaron' in ped_text
        and '"samples_removed": 0' in ped_text,
        'Pedagogía declara IQR no destructivo',
    )
    check('"outliers"' in ai_text and 'metrics -> analysis -> pedagogy' in ai_text, 'IA conserva evidencia estructurada')

    interp = importlib.import_module('Server.webapp.services.interpretation_service')
    ped = importlib.import_module('Server.webapp.services.pedagogy_service')

    metric = {
        'status': 'available', 'reason': None, 'unit': 'ms',
        'availability': {'rows_total': 30, 'numeric': 30, 'groups_total': 3, 'groups_with_data': 3},
        'points': [
            {'source':'fixture.cpp','input_size':100,'mean':100.0,'median':10.0,'stddev':5.0,'q1':9.0,'q3':11.0,'iqr':2.0,'samples_total':10,'samples_valid':10,'outliers_removed':0,'iqr_applied':False,'iqr_diagnostic_applied':True,'iqr_inliers':9,'iqr_outliers_detected':1},
            {'source':'fixture.cpp','input_size':200,'mean':250.0,'median':20.0,'stddev':10.0,'q1':18.0,'q3':22.0,'iqr':4.0,'samples_total':10,'samples_valid':10,'outliers_removed':0,'iqr_applied':False,'iqr_diagnostic_applied':True,'iqr_inliers':8,'iqr_outliers_detected':2},
            {'source':'fixture.cpp','input_size':400,'mean':900.0,'median':40.0,'stddev':20.0,'q1':36.0,'q3':44.0,'iqr':8.0,'samples_total':10,'samples_valid':10,'outliers_removed':0,'iqr_applied':False,'iqr_diagnostic_applied':True,'iqr_inliers':10,'iqr_outliers_detected':0},
        ],
    }
    analysis = interp.build_results_analysis({'DurationTime': metric})
    source = analysis['metrics']['DurationTime']['sources'][0]
    check(analysis['methodology']['central_value'] == 'median', 'Analysis central_value=median')
    check('log(median)' in analysis['methodology']['observed_scaling'], 'Metodología log-log sobre medianas')
    snap = source['at_max_input']
    check(snap['median'] == 40.0 and snap['q1'] == 36.0 and snap['q3'] == 44.0, 'Snapshot mediana + Q1/Q3')
    trend = source['trend']
    check(trend['central_value'] == 'median' and trend['first']['median'] == 10.0 and trend['last']['median'] == 40.0 and math.isclose(trend['relative_change'], 3.0), 'Tendencia calculada sobre medianas', str(trend))
    scaling = source['observed_scaling']
    check(scaling['central_value'] == 'median' and math.isclose(scaling['exponent'], 1.0, abs_tol=1e-9), 'Escalamiento log-log usa medianas', str(scaling))
    outs = source['outliers']
    check(outs['samples_evaluated'] == 30 and outs['iqr_outliers_detected'] == 3 and outs['samples_removed'] == 0 and outs['outliers_removed'] == 0, 'IQR detecta sin eliminar', str(outs))
    check(math.isclose(outs['iqr_outlier_rate'], 0.1, abs_tol=1e-12), 'Tasa IQR = detectados/evaluados')
    var = source['variability']
    check(var['points_with_relative_iqr'] == 3 and var['mean_relative_iqr'] is not None, 'Variabilidad robusta Q1-Q3')

    messages = ped._build_source_messages('DurationTime', 'Tiempo de ejecución', source)
    texts = '\n'.join(m.get('text','') for m in messages)
    check('la mediana fue' in texts and 'intervalo Q1–Q3' in texts, 'Mensaje principal usa mediana y Q1-Q3', texts)
    check('referencia complementaria, la media' in texts and 'coeficiente de variación clásico' in texts, 'Media/std/CV son complementarios', texts)
    check('criterio IQR 1,5×' in texts and 'detectó 3 de 30' in texts and 'no se eliminó ninguna muestra' in texts, 'Mensaje IQR no destructivo', texts)
    check('escala log-log observada sobre las medianas' in texts, 'Escalamiento pedagógico explicita medianas', texts)

    unavailable = interp.build_metric_analysis('EnergyPkg', {
        'status':'unsupported','reason':'measurement_event_unavailable','unit':'J',
        'availability': {'rows_total':10,'numeric':0,'unsupported':10,'groups_total':1,'groups_with_data':0},
        'points': []
    })
    check(unavailable['status']=='unavailable' and unavailable['reason']=='measurement_event_unavailable' and unavailable['sources']==[], 'Disponibilidad N/A intacta', str(unavailable))

    print('\n' + '='*76)
    if fails:
        print(f'CORE-06F: FAIL — {len(fails)} fallaron; {passes} pasaron.')
        for name, detail in fails:
            print(' -', name)
            if detail: print('   ', detail[:1000])
        return 1
    print(f'CORE-06F: PASS — {passes} comprobaciones pasaron.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
