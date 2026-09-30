import json
import os


def repo_root():
    override = os.environ.get('HABIBI_ROOT')
    if override:
        return os.path.abspath(override)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def site_dir():
    override = os.environ.get('HABIBI_SITE')
    if override:
        return os.path.abspath(override)
    return os.path.join(repo_root(), 'site')


def printful_token():
    token = os.environ.get('PRINTFUL_API_TOKEN', '').strip().strip('"').strip("'")
    if token:
        return token
    env_file = os.environ.get('HABIBI_ENV_FILE')
    if not env_file:
        raise SystemExit('PRINTFUL_API_TOKEN is not set')
    with open(env_file) as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if key.strip() == 'PRINTFUL_API_TOKEN':
                return value.strip().strip('"').strip("'")
    raise SystemExit('PRINTFUL_API_TOKEN is not set')


def launch_cents():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pricing.json')
    with open(path) as handle:
        data = json.load(handle)
    return data['retail_cents']


def money(cents):
    cents = int(cents)
    return f'${cents // 100}.{cents % 100:02d}'


def offer_amount(cents):
    cents = int(cents)
    return f'{cents // 100}.{cents % 100:02d}'
