import sys

data = []
with open('history.txt', 'r') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        parts = line.split('-')
        period = int(parts[0].strip())
        number = int(parts[1].strip())
        size = parts[2].strip()
        color = parts[3].strip()
        data.append((period, number, size, color))

data.sort(key=lambda x: x[0])

print(f"Total records: {len(data)}")

# check if period % X == number
for x in range(2, 11):
    matches = sum(1 for p, n, s, c in data if p % x == n % x)
    print(f"Period % {x} == Number % {x}: {matches}/{len(data)} ({(matches/len(data))*100:.2f}%)")
    
# check last digit
last_digit_matches = sum(1 for p, n, s, c in data if int(str(p)[-1]) == n)
print(f"Period last digit == Number: {last_digit_matches}/{len(data)} ({(last_digit_matches/len(data))*100:.2f}%)")

# check transitions
transitions = {}
for i in range(len(data) - 1):
    if data[i+1][0] == data[i][0] + 1:
        prev_color = data[i][3].split('/')[0].strip()
        next_color = data[i+1][3].split('/')[0].strip()
        if prev_color not in transitions:
            transitions[prev_color] = {'Red': 0, 'Green': 0}
        
        if 'Red' in next_color: transitions[prev_color]['Red'] += 1
        elif 'Green' in next_color: transitions[prev_color]['Green'] += 1

print("\nTransitions:")
for prev, counts in transitions.items():
    total = sum(counts.values())
    print(f"After {prev}: Red={counts['Red']/total*100:.1f}% Green={counts['Green']/total*100:.1f}%")

# check alternating (R->G->R->G)
alt_matches = 0
total_seq = 0
for i in range(len(data) - 1):
    if data[i+1][0] == data[i][0] + 1:
        total_seq += 1
        c1 = 'R' if 'Red' in data[i][3] else 'G'
        c2 = 'R' if 'Red' in data[i+1][3] else 'G'
        if c1 != c2: alt_matches += 1

if total_seq > 0:
    print(f"\nAlternating sequences: {alt_matches}/{total_seq} ({(alt_matches/total_seq)*100:.2f}%)")

