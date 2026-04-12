"""
Ingest the MCCD (Multi-Attribute Chinese Calligraphy Character Dataset) into the SQLite database.

Prerequisites:
  1. Apply for MCCD access at https://github.com/SCUT-DLVCLab/MCCD
  2. Download LMDB files
  3. pip install lmdb Pillow tqdm

The MCCD dataset contains:
  - 329,715 isolated character samples
  - 7,765 character categories
  - 142 calligraphers
  - 10 script styles (includes our target 5)
  - 15 dynasties

Usage:
  python scripts/ingest_mccd.py \
    --lmdb-path /path/to/mccd/lmdb \
    --output-dir public/images \
    --db data/shufazidian.db
"""

import argparse
import sqlite3
from pathlib import Path

# lmdb and PIL will be needed when dataset is available
# import lmdb
# from PIL import Image
# from io import BytesIO
# from tqdm import tqdm


STYLE_MAP = {
    # Map MCCD style labels to our slug system
    # These mappings need to be verified against the actual MCCD label files
    "篆书": "zhuan",
    "隶书": "li",
    "楷书": "kai",
    "行书": "xing",
    "草书": "cao",
    # MCCD may have additional styles we can map or skip
}


def char_to_unicode_hex(char: str) -> str:
    return f"{ord(char):04X}"


def main():
    parser = argparse.ArgumentParser(description="Ingest MCCD dataset")
    parser.add_argument("--lmdb-path", required=True, help="Path to MCCD LMDB directory")
    parser.add_argument("--output-dir", default="public/images")
    parser.add_argument("--db", default="data/shufazidian.db")
    parser.add_argument("--char-map", help="Path to char_book2024.txt character mapping file")
    args = parser.parse_args()

    print("=" * 60)
    print("MCCD Ingestion Script")
    print("=" * 60)
    print()
    print("This script requires MCCD dataset access.")
    print("Apply at: https://github.com/SCUT-DLVCLab/MCCD")
    print()
    print("Once you have access, the script will:")
    print("  1. Open the LMDB database")
    print("  2. For each entry, read: image, character, style, calligrapher, dynasty")
    print("  3. Convert images to WebP and normalize")
    print("  4. Insert metadata into SQLite")
    print()
    print("Expected LMDB key format (to be verified with actual data):")
    print("  image-{idx}    -> raw image bytes")
    print("  label-{idx}    -> calligrapher label (integer)")
    print("  char-{idx}     -> character label (integer)")
    print("  style-{idx}    -> style label (integer)")
    print("  dynasty-{idx}  -> dynasty label (integer)")
    print()

    lmdb_path = Path(args.lmdb_path)
    if not lmdb_path.exists():
        print(f"Error: LMDB path does not exist: {lmdb_path}")
        print("Please download the MCCD dataset first.")
        return

    # TODO: Implement when MCCD access is granted
    # The implementation will follow this pattern:
    #
    # env = lmdb.open(str(lmdb_path), readonly=True, lock=False)
    # conn = sqlite3.connect(args.db)
    # cursor = conn.cursor()
    #
    # with env.begin() as txn:
    #     num_samples = txn.stat()["entries"] // 5  # 5 keys per sample
    #     for idx in tqdm(range(num_samples)):
    #         img_bytes = txn.get(f"image-{idx:09d}".encode())
    #         char_label = int(txn.get(f"char-{idx:09d}".encode()))
    #         style_label = int(txn.get(f"style-{idx:09d}".encode()))
    #         calligrapher_label = int(txn.get(f"label-{idx:09d}".encode()))
    #
    #         # Map labels to actual values using mapping files
    #         # Convert image, insert into DB
    #         pass
    #
    # conn.close()
    # env.close()

    print("Implementation pending MCCD dataset access.")


if __name__ == "__main__":
    main()
