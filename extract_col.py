import json, cv2
from pathlib import Path
from urllib.parse import quote

idx = json.loads(Path('pipeline/data/works_index.json').read_text())
entry = idx['贈書00043100000']
draft = json.loads(entry['annotationDraft'])
boxes = [b for b in draft['boxes'] if b.get('char')][:12]

safe = quote('贈書00043100000', safe='').replace('%', '_')
img = cv2.imread(f'pipeline/data/processed/{safe}/clean.jpg')
h, w = img.shape[:2]

# Crop to just the column containing these boxes
PAD = 20
x_min = max(0, min(int(b['x']) for b in boxes) - PAD)
x_max = min(w, max(int(b['x'] + b['w']) for b in boxes) + PAD)
y_min = max(0, min(int(b['y']) for b in boxes) - PAD)
y_max = min(h, max(int(b['y'] + b['h']) for b in boxes) + PAD)

col_img = img[y_min:y_max, x_min:x_max]

# Adjust box coordinates to be relative to the crop
adjusted = []
for b in boxes:
    adjusted.append({**b,
        'x': b['x'] - x_min,
        'y': b['y'] - y_min,
    })

cv2.imwrite('/tmp/col_experiment.jpg', col_img)
Path('/tmp/col_boxes.json').write_text(json.dumps(adjusted, ensure_ascii=False))

print(f'Column crop: {col_img.shape[1]}x{col_img.shape[0]}px')
print(f'Chars: {"".join(b["char"] for b in adjusted)}')
print('Saved to /tmp/ — copy to Downloads and re-upload to Colab')
