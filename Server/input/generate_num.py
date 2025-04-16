import random
import sys

bottomRand = 0
topRand = 1000

def generate_semi_sorted_numbers(quantity):
    maxSortedRangeSize = 100
    semi_sorted_numbers = []
    remaining = quantity

    while remaining > 0:
        size = min(random.randint(1, maxSortedRangeSize), remaining)
        bottomRand = random.uniform(0, 500)  
        topRand = random.uniform(bottomRand, 1000) 
        sub_range = [random.uniform(bottomRand, topRand) for _ in range(size)]
        sub_range.sort()
        semi_sorted_numbers.extend(sub_range)
        remaining -= size

    range_starts = [0]
    while len(range_starts) < len(semi_sorted_numbers):
        next_start = range_starts[-1] + size
        if next_start < len(semi_sorted_numbers):
            range_starts.append(next_start)
        else:
            break

    random.shuffle(range_starts)  

    shuffled_semi_sorted = []
    for start in range_starts:
        end = start + size
        shuffled_semi_sorted.extend(semi_sorted_numbers[start:end])

    return shuffled_semi_sorted



def generate_numbers(option, quantity):
    filename = "numerical_input.txt"
    
    if option == "r":
        filename = "numerical_input.txt"
        with open(filename, 'w') as f:
            for _ in range(quantity):
                f.write(f"{random.uniform(bottomRand, topRand):.2f}\n")

    elif option == "so":
            filename = "numerical_input_semi_sorted.txt"
            with open(filename, 'w') as f:
                semi_sorted_numbers = generate_semi_sorted_numbers(quantity)
                for num in semi_sorted_numbers:
                    f.write(f"{num:.2f}\n")

    elif option == "s":
        filename = "numerical_input_same.txt"
        with open(filename, 'w') as f:
            repeat_num = random.uniform(bottomRand, topRand)
            for _ in range(quantity):
                f.write(f"{repeat_num:.2f}\n")

    else:
        print("Invalid option")
        return
    print(f"File {filename} generated with {quantity} numbers.")

# Example usage
if len(sys.argv) != 3:
    print("Usage: python script_name.py [option] [quantity], options = [s:same, so: semi ordenado, r: random]")
else:
    option = sys.argv[1]
    quantity = int(sys.argv[2])
    generate_numbers(option, quantity)
