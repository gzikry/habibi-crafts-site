import os
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

EXCLUDED_SYNC_IDS = {471226874, 471225102, 462540360, 462532459}

_token = None


def repo_root():
    override = os.environ.get('HABIBI_ROOT', '').strip()
    if override:
        return Path(override).resolve()
    return Path(__file__).resolve().parents[1]


def site_dir():
    return repo_root() / 'site'


def angles_dir():
    return repo_root() / 'pf-angles'


def shots_dir():
    return repo_root() / 'shots'


def printful_token():
    global _token
    if _token:
        return _token
    env_token = os.environ.get('PRINTFUL_API_TOKEN', '').strip()
    if env_token:
        _token = env_token
        return _token
    env_file = os.environ.get('HABIBI_ENV_FILE', '').strip()
    if env_file:
        for line in Path(env_file).read_text().splitlines():
            if line.startswith('PRINTFUL_API_TOKEN='):
                value = line.split('=', 1)[1].strip().strip('"').strip("'")
                if value:
                    _token = value
                    return _token
    raise SystemExit('PRINTFUL_API_TOKEN is not set')


def cents_from_retail(retail):
    return int((Decimal(str(retail)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def format_cents(cents):
    cents = int(cents)
    sign = '-' if cents < 0 else ''
    cents = abs(cents)
    return f'{sign}${cents // 100}.{cents % 100:02d}'


def cents_decimal(cents):
    cents = int(cents)
    sign = '-' if cents < 0 else ''
    cents = abs(cents)
    return f'{sign}{cents // 100}.{cents % 100:02d}'
