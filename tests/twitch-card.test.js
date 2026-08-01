const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('gives only the Twitch project card its official purple accent', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const twitchCard = html.match(
    /<a href="https:\/\/github\.com\/AlekBlackk\/twitch_bot"[\s\S]*?<\/a>/
  )?.[0];

  assert.ok(twitchCard);
  assert.match(twitchCard, /--card-color: #9146FF;/);
  assert.match(
    twitchCard,
    /--preview-bg: linear-gradient\(135deg, rgba\(145, 70, 255, 0\.15\), rgba\(145, 70, 255, 0\.05\)\);/
  );
  assert.doesNotMatch(twitchCard, /#f59e0b|rgba\(245, 158, 11,/);
});
