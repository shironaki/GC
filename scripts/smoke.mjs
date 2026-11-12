import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const js = readFileSync('src/main.js', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

for (const id of ['world','resources','mission-card','district-tag','joystick','joystick-knob','interact','attack','sprint','menu-open','modal','modal-content','modal-close','toast','loading']) {
  assert.match(html, new RegExp('id="' + id + '"'), 'Missing HTML element #' + id);
}
for (const path of ['./styles.css','./manifest.webmanifest','./src/main.js']) {
  assert.ok(html.includes(path), 'HTML does not reference ' + path);
}
for (const path of ['./index.html','./styles.css','./manifest.webmanifest','./src/main.js']) {
  assert.ok(existsSync(path.replace(/^\.\//,'')), 'Missing offline shell file ' + path);
}
for (const token of ['function update(','function render(','function interact(','function save(','function load(','function updatePolice(','player.attackCooldown','sprintHeld','buy-medkit']) {
  assert.ok(js.includes(token), 'Missing gameplay system: ' + token);
}
assert.ok(css.includes('.joystick') && css.includes('.modal'), 'Core mobile UI styles are missing');
assert.equal(manifest.name, 'Gangstar City: Revival');
assert.equal(manifest.display, 'standalone');
console.log('GCR static smoke checks passed.');
