with open('src/pages/Episodes.tsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()

# StoryLocationCard starts at line where "function StoryLocationCard" appears
# SectionLabel starts after it at "function SectionLabel"
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'function StoryLocationCard' in line:
        start_idx = i
    if 'function SectionLabel' in line:
        end_idx = i
        break

if start_idx is not None and end_idx is not None:
    # Remove start_idx to end_idx (the blank line before SectionLabel)
    del lines[start_idx:end_idx]
    print(f'Removed lines {start_idx+1} to {end_idx}. New total: {len(lines)} lines.')
else:
    print(f'Could not find boundaries. start={start_idx}, end={end_idx}')

with open('src/pages/Episodes.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
