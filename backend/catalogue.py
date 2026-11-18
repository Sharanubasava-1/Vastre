"""Editable catalogue only. Importing this module never opens a database."""
import json
from pathlib import Path

CATEGORY_WEIGHTS = {'Shirts': 0.25, 'T-shirts': 0.18, 'Trousers': 0.45, 'Jeans': 0.65, 'Hoodies': 0.60, 'Sportswear': 0.35}
CATEGORIES = list(CATEGORY_WEIGHTS)
PRODUCTS = json.loads(Path(__file__).with_name('catalogue.json').read_text(encoding='utf-8'))
