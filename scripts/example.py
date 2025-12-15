#!/usr/bin/env python3
# Example Python script

import os
import datetime

print('Hello from Python script!')
print(f'Current directory: {os.getcwd()}')
print(f'Date: {datetime.datetime.now()}')
print(f'Python version: {os.sys.version}')
print('List of files in current directory:')

for file in os.listdir('.'):
    stats = os.stat(file)
    print(f'{file} - {stats.st_size} bytes')