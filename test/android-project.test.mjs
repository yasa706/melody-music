import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Capacitor project has the approved Melody Music identity and remote site', async () => {
  const pkg = JSON.parse(await read('android-app/package.json'));
  const config = JSON.parse(await read('android-app/capacitor.config.json'));
  assert.equal(pkg.version, '1.0.0');
  assert.equal(pkg.dependencies['@capacitor/core'], '8.4.2');
  assert.equal(pkg.dependencies['@capacitor/android'], '8.4.2');
  assert.equal(pkg.devDependencies['@capacitor/cli'], '8.4.2');
  assert.equal(config.appId, 'com.glory.melodymusic');
  assert.equal(config.appName, 'Melody Music');
  assert.equal(config.webDir, 'www');
  assert.equal(config.server.url, 'https://melody-music.gotoulus.workers.dev');
  assert.equal(config.server.cleartext, false);
});

test('GitHub Actions builds and uploads the installable debug APK', async () => {
  const workflow = await read('.github/workflows/build-android-apk.yml');
  assert.match(workflow, /node-version:\s*['\"]?22/);
  assert.match(workflow, /java-version:\s*['\"]?21/);
  assert.match(workflow, /npx cap add android/);
  assert.match(workflow, /npx cap sync android/);
  assert.match(workflow, /\.\/gradlew assembleDebug/);
  assert.match(workflow, /Melody-Music-1\.0\.0-debug\.apk/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('workflow provisions Android SDK 36 required by Capacitor 8', async () => {
  const workflow = await read('.github/workflows/build-android-apk.yml');
  assert.match(workflow, /android-actions\/setup-android@v3/);
  assert.match(workflow, /platforms;android-36/);
  assert.match(workflow, /build-tools;36\.0\.0/);
});
