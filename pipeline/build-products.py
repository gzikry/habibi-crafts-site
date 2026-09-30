#!/usr/bin/env python3
"""Write product pages from the live storefront template."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chrome import output_dir
from root import site_dir
from storefront import write_products


def main():
    out = output_dir(site_dir())
    out.mkdir(parents=True, exist_ok=True)
    write_products(out)


if __name__ == '__main__':
    main()
