with open('src/pages/Episodes.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'function StoryLocationCard' in line:
        start_idx = i
        print(f'Found StoryLocationCard at line {i+1}')
    if 'function SectionLabel' in line:
        end_idx = i
        print(f'Found SectionLabel at line {i+1}')
        # Don't break after finding SectionLabel - we want the first one
        break

# We need to check if there's any other content between StoryCharacterCard import and SectionLabel
# Actually, let me just delete from start_idx to just before SectionLabel
if start_idx is not None and end_idx is not None:
    # Verify these are the right boundaries
    print(f'Removing lines {start_idx+1} through {end_idx}')
    del lines[start_idx:end_idx]
    print(f'New total: {len(lines)} lines')
    
    with open('src/pages/Episodes.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
else:
    print(f'Boundaries: start={start_idx}, end={end_idx}')
    if start_idx:
        print(f'Line {start_idx+1}: {repr(lines[start_idx])}')
    if end_idx:
        print(f'Line {end_idx+1}: {repr(lines[end_idx])}')
