export function parseLrc(text='') {
  const out=[];
  for (const raw of String(text).split(/\r?\n/)) {
    if (/^\[(ar|ti|al|by|offset):/i.test(raw)) continue;
    const times=[...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!times.length) continue;
    const lyric=raw.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g,'').trim();
    for (const m of times) {
      const frac=(m[3]||'').padEnd(3,'0').slice(0,3);
      out.push({time:Number(m[1])*60+Number(m[2])+Number(frac||0)/1000,text:lyric});
    }
  }
  return out.sort((a,b)=>a.time-b.time);
}
export function activeLyricIndex(lines, seconds) {
  let idx=-1;
  for (let i=0;i<lines.length;i++) { if (lines[i].time<=seconds) idx=i; else break; }
  return idx;
}
