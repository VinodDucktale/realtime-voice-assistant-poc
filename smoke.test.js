// smoke.test.js
// Lightweight smoke tests for runtime, network, and app harness.

import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function log(step, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
}

async function runtimeSmoke() {
  log('runtime', 'Starting runtime smoke test');

  if (1 + 1 !== 2) {
    throw new Error('Basic arithmetic failed');
  }

  const value = await Promise.resolve(42);
  if (value !== 42) {
    throw new Error('Promise resolution failed');
  }

  const start = Date.now();
  await delay(10);
  const elapsed = Date.now() - start;
  if (elapsed < 5) {
    throw new Error('Timer did not wait as expected');
  }

  log('runtime', 'Runtime smoke test passed');
}

async function localHttpSmoke() {
  log('http', 'Starting local HTTP smoke test');

  const port = 34567;
  const responseBody = 'ok-smoke';

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(responseBody);
    } else {
      res.writeHead(404);
      res.end('not-found');
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(port, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  log('http', `Local HTTP server listening on http://localhost:${port}`);

  const body = await new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
  });

  if (body !== responseBody) {
    server.close();
    throw new Error(`Unexpected response body: "${body}"`);
  }

  server.close();
  log('http', 'Local HTTP smoke test passed');
}

async function appHarnessSmoke() {
  log('app', 'Starting app harness smoke test');

  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      CI: 'true',
    },
  });

  let stdoutBuffer = '';
  let stderrBuffer = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdoutBuffer += text;
    console.log(`[dev-stdout] ${text.trimEnd()}`);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuffer += text;
    console.error(`[dev-stderr] ${text.trimEnd()}`);
  });

  const devUrl = 'http://localhost:3000';

  const timeoutMs = 60000;
  const start = Date.now();
  let ready = false;

  while (Date.now() - start < timeoutMs) {
    if (/started server|ready - started server|compiled successfully/i.test(stdoutBuffer)) {
      ready = true;
      break;
    }

    try {
      const status = await new Promise((resolve) => {
        const req = http.get(devUrl, (res) => {
          resolve(res.statusCode);
        });
        req.on('error', () => resolve(null));
      });

      if (status === 200) {
        ready = true;
        break;
      }
    } catch {
      // ignore
    }

    await delay(1000);
  }

  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(
      `Dev server did not become ready within ${timeoutMs}ms.\nstdout:\n${stdoutBuffer}\nstderr:\n${stderrBuffer}`,
    );
  }

  log('app', 'Dev server appears ready, performing HTTP GET /');

  const status = await new Promise((resolve, reject) => {
    const req = http.get(devUrl, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
  });

  if (status !== 200) {
    child.kill('SIGTERM');
    throw new Error(`Expected HTTP 200 from ${devUrl}, got ${status}`);
  }

  log('app', 'App harness smoke test passed (HTTP 200 from /)');

  child.kill('SIGTERM');
}

async function main() {
  try {
    await runtimeSmoke();
    await localHttpSmoke();
    await appHarnessSmoke();
    log('smoke', 'All smoke tests passed');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] Smoke tests FAILED:', err);
    process.exit(1);
  }
}

// Always run when executed via `node smoke.test.js`
await main();

export { runtimeSmoke, localHttpSmoke, appHarnessSmoke, main };
