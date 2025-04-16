import subprocess

tmr = ''

s = subprocess.run(
       "find -type f -printf '%T+ %p\n' | sort | head -1",
       capture_output=True, universal_newlines=True, shell=True)
tmr = s.stdout.split()
print(tmr[1])
tmr2 = tmr[1].split('/')
print(tmr2[-1])