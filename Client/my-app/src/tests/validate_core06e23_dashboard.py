#!/usr/bin/env python3
from pathlib import Path
import os, subprocess, sys
REL=Path('Client/my-app/src/screens/RenderImage.js')

def root():
    candidates=[Path.cwd().resolve(),Path(__file__).resolve().parent]
    env=os.environ.get('PERF_SYSTEM_ROOT')
    if env: candidates.insert(0,Path(env).expanduser().resolve())
    expanded=[]
    for c in candidates:
        expanded.append(c); expanded.extend(c.parents)
    seen=set()
    for c in expanded:
        if c in seen: continue
        seen.add(c)
        if (c/REL).is_file(): return c
    raise SystemExit('ERROR: no pude localizar la raíz del proyecto')
ROOT=root(); text=(ROOT/REL).read_text(encoding='utf-8')
passes=[]; failures=[]
def check(cond,name,detail=''):
    if cond:
        passes.append(name); print('[PASS]',name)
    else:
        failures.append((name,detail)); print('[FAIL]',name,detail)
check('"Intervalo Q1–Q3"' in text,'Control de mediana ofrece Q1–Q3')
check('disabled={\n                aggregation === "median"' not in text,'Dispersión no se deshabilita con mediana')
check('symmetric: false' in text and 'arrayminus: lowerDispersion' in text,'Plotly usa intervalo asimétrico')
check('const transformedQ1 =' in text and 'const transformedQ3 =' in text,'Q1/Q3 se transforman con unidad')
check('"Q1: %{customdata[4]}<br>"' in text and '"Q3: %{customdata[5]}<br>"' in text,'Tooltip expone Q1/Q3')
check('"Muestras numéricas: %{customdata[6]}/%{customdata[7]}<br>"' in text,'Tooltip usa muestras numéricas')
check('"Outliers IQR detectados: %{customdata[8]}"' in text,'Tooltip distingue outliers detectados')
check('point.iqr_outliers_detected || 0' in text,'Frontend consume iqr_outliers_detected')
check('const allValuesZero =' in text and 'range: [0, 1]' in text,'Métricas todo-cero tienen eje legible')
check('aggregation === "median"\n        ? "Q1–Q3"' in text,'Footer describe Q1–Q3')
check('if (!showDispersion) {' in text,'Dispersión puede ocultarse con ambos estimadores')
check('function formatKpiIqr(' in text and 'point.q1' in text and 'point.q3' in text,'KPI mediana usa Q1–Q3')
check('formatKpiDispersion(' in text,'Media conserva desviación estándar')
check('buildHardwareAvailabilityExplanation' in text and 'buildMeasurementContextSummary' in text,'UI 06C preservada')
check('useState("median")' in text,'Mediana sigue por defecto')
client=ROOT/'Client/my-app'
proc=subprocess.run(['npm','run','build'],cwd=client,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
check(proc.returncode==0,'npm run build',proc.stdout[-3000:])
print(); print('='*72)
if failures:
    print(f'CORE-06E-2-3: FAIL — {len(failures)} fallaron; {len(passes)} pasaron.')
    for n,d in failures: print(' -',n,d)
    raise SystemExit(1)
print(f'CORE-06E-2-3: PASS — {len(passes)} comprobaciones pasaron.')
