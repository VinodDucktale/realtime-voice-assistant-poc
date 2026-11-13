import { spawn } from 'node:child_process';
import http from 'node:http';

async function checkUrl(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      console.log(`[url] ${url} -> ${res.statusCode}`);
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Non-2xx status: ${res.statusCode}`));
      }
      res.resume();
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

async function checkLocalDev() {
  console.log('[dev] starting Next.js dev server for smoke check...');
  const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });

  // Give it a few seconds to boot, then hit localhost
  await new Promise((r) => setTimeout(r, 8000));

  try {
    await checkUrl('http://localhost:3000');
  } finally {
    child.kill('SIGINT');
  }
}

async function main() {
  const targetUrl = process.env.SMOKE_TEST_URL;
  if (targetUrl) {
    await checkUrl(targetUrl);
  }

  // Always try local dev smoke unless explicitly disabled
  if (process.env.SKIP_LOCAL_SMOKE !== '1') {
    await checkLocalDev();
  }

  console.log('Smoke tests completed.');
}

main().catch((err) => {
  console.error('Smoke tests failed:', err);
  process.exit(1);
});
