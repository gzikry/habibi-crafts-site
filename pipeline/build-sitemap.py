#!/usr/bin/env python3
"""Write sitemap.xml and robots.txt from the pages that exist."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from chrome import output_dir
from root import site_dir
from storefront import write_sitemap


def main():
    out = output_dir(site_dir())
    out.mkdir(parents=True, exist_ok=True)
    write_sitemap(out)


if __name__ == '__main__':
    main()
