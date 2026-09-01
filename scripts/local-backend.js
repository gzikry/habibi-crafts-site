import http from 'node:http';

const PORT = Number(process.env.PORT || 9999);
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`local backend http://127.0.0.1:${PORT}`);
  const response = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/api/health`, (resp) => {
      let data = '';
      resp.on('data', (chunk) => (data += chunk));
      resp.on('end', () => resolve({ status: resp.statusCode, data }));
      resp.on('error', reject);
    }).on('error', reject);
  });
  console.log('health', response.data);
  server.close();
});
