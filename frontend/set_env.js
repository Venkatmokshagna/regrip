const { execSync } = require('child_process');

try {
  console.log("Adding NEXT_PUBLIC_API_URL...");
  execSync('npx vercel env add NEXT_PUBLIC_API_URL production', {
    input: 'https://regrip-production.up.railway.app/api',
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log("Success.");

  console.log("Adding NEXT_PUBLIC_SOCKET_URL...");
  execSync('npx vercel env add NEXT_PUBLIC_SOCKET_URL production', {
    input: 'https://regrip-production.up.railway.app',
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log("Success.");
} catch (e) {
  console.error("Failed:", e.message);
}
