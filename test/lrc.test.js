import test from 'node:test';import assert from 'node:assert/strict';import {parseLrc,activeLyricIndex} from '../src/lrc.js';
test('parses multiple timestamps and selects active lyric',()=>{const lines=parseLrc('[00:01.50]Hello\n[00:05.00][00:08.00]World');assert.deepEqual(lines.map(x=>x.time),[1.5,5,8]);assert.equal(activeLyricIndex(lines,6),1)});
test('ignores metadata and supports blank lyric text',()=>{const lines=parseLrc('[ar:Someone]\n[01:02.003]');assert.equal(lines.length,1);assert.equal(lines[0].time,62.003);assert.equal(lines[0].text,'')});
