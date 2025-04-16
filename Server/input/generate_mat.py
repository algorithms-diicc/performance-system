import random

filename = "numerical_input.txt"
matrix_size = 200  # Size of one side of the matrix

# We'll generate numbers for two matrices, so double the total count
total_numbers = matrix_size * matrix_size * 2

with open(filename, 'w') as f:
    for _ in range(total_numbers):
        # Generate a random float between 0 and 100 (you can adjust as necessary)
        f.write(f"{random.uniform(0, 100):.4f}\n")  # Writes number with 4 decimal places

print(f"File {filename} generated with {total_numbers} numbers.")

