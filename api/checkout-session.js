export default function handler(request) {
  return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
}
