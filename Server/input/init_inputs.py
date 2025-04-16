import shutil
import requests
import subprocess
import gzip
import os

def download_file(url, local_filename):
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with open(local_filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    return local_filename

def decompress_gz(file_path):
    with gzip.open(file_path, 'rb') as f_in:
        with open(file_path[:-3], 'wb') as f_out: 
            shutil.copyfileobj(f_in, f_out)
    os.remove(file_path) 

def execute_script(script_name, opt, size):
    subprocess.run(['python3', script_name, opt, size], check=True)

file_url = 'https://pizzachili.dcc.uchile.cl/texts/nlang/english.50MB.gz'

gz_file_name = download_file(file_url, "english.50MBzip")
print(f"Downloaded '{gz_file_name}' to the current directory.")

decompress_gz(gz_file_name)
print(f"Decompressed '{gz_file_name}'.")

python_script_name = 'generate_num.py'
execute_script(python_script_name,"r", "15000")
execute_script(python_script_name,"s", "15000")
execute_script(python_script_name,"so", "15000")
print(f"Executed the script '{python_script_name}'.")
