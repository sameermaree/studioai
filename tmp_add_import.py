with open('src/pages/Episodes.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the StoryCharacterCard import line
for i, line in enumerate(lines):
    if 'from ../features/story-bible/components/StoryCharacterCard' in line:
        lines.insert(i+1, "import { StoryLocationCard } from '../features/story-bible/components/StoryLocationCard';\n")
        break

with open('src/pages/Episodes.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done')
