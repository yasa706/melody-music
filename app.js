const songs = [
  {
    title:"Midnight Drive",
    artist:"Lena Hart",
    duration:"3:42",
    cover:"https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=500&q=80",
    src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  {
    title:"City Lights",
    artist:"Nova Lane",
    duration:"4:15",
    cover:"https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=500&q=80",
    src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
  },
  {
    title:"Ocean Air",
    artist:"Mira",
    duration:"3:58",
    cover:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=80",
    src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
  },
  {
    title:"New Morning",
    artist:"Echo North",
    duration:"4:06",
    cover:"https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=500&q=80",
    src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
  }
];

const playlists = [
  ["轻松时刻","适合工作与阅读", songs[0].cover],
  ["夜晚驾驶","城市、霓虹与节奏", songs[1].cover],
  ["旅行歌单","去远方的背景音乐", songs[2].cover],
  ["清晨醒来","从一首歌开始", songs[3].cover]
];

let currentIndex = 0;
let shuffle = false;
let repeat = false;

const audio = document.getElementById("audio");
const playBtn = document.getElementById("playBtn");
const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");
const playerCover = document.getElementById("playerCover");
const progress = document.getElementById("progress");
const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");

function renderPlaylists(){
  document.getElementById("playlistCards").innerHTML = playlists.map(p => `
    <article class="card">
      <img src="${p[2]}" alt="">
      <div class="card-title">${p[0]}</div>
      <div class="card-sub">${p[1]}</div>
    </article>`).join("");
}

function songRows(list){
  if(!list.length) return `<div class="empty-box">没有找到歌曲</div>`;
  return list.map((s,i)=>`
    <div class="song-row" data-index="${songs.indexOf(s)}">
      <div class="song-number">${i+1}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <img class="song-cover" src="${s.cover}" alt="">
        <div>
          <div class="song-title">${s.title}</div>
          <div class="song-meta">${s.artist}</div>
        </div>
      </div>
      <div class="song-artist-col">${s.artist}</div>
      <div class="song-time">${s.duration}</div>
    </div>`).join("");
}

function bindSongRows(root){
  root.querySelectorAll(".song-row").forEach(row=>{
    row.addEventListener("click",()=>loadSong(Number(row.dataset.index), true));
  });
}

function renderSongs(){
  const el = document.getElementById("songList");
  el.innerHTML = songRows(songs);
  bindSongRows(el);
  document.getElementById("songCount").textContent = `${songs.length} 首`;
}

function loadSong(index, autoplay=false){
  currentIndex = index;
  const s = songs[index];
  audio.src = s.src;
  playerTitle.textContent = s.title;
  playerArtist.textContent = s.artist;
  playerCover.src = s.cover;
  if(autoplay) audio.play();
}

function fmt(sec){
  if(!isFinite(sec)) return "0:00";
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60).toString().padStart(2,"0");
  return `${m}:${s}`;
}

playBtn.addEventListener("click",()=>{
  if(!audio.src) loadSong(currentIndex);
  audio.paused ? audio.play() : audio.pause();
});
audio.addEventListener("play",()=>playBtn.textContent="Ⅱ");
audio.addEventListener("pause",()=>playBtn.textContent="▶");
audio.addEventListener("timeupdate",()=>{
  progress.value = audio.duration ? (audio.currentTime/audio.duration)*100 : 0;
  currentTime.textContent = fmt(audio.currentTime);
  duration.textContent = fmt(audio.duration);
});
progress.addEventListener("input",()=>{
  if(audio.duration) audio.currentTime = (progress.value/100)*audio.duration;
});
document.getElementById("volume").addEventListener("input",e=>audio.volume=e.target.value);
document.getElementById("prevBtn").addEventListener("click",()=>loadSong((currentIndex-1+songs.length)%songs.length,true));
document.getElementById("nextBtn").addEventListener("click",nextSong);
document.getElementById("shuffleBtn").addEventListener("click",e=>{shuffle=!shuffle;e.currentTarget.style.color=shuffle?"#1ed760":""});
document.getElementById("repeatBtn").addEventListener("click",e=>{repeat=!repeat;e.currentTarget.style.color=repeat?"#1ed760":""});
document.getElementById("playFeatured").addEventListener("click",()=>loadSong(0,true));
audio.addEventListener("ended",()=> repeat ? (audio.currentTime=0,audio.play()) : nextSong());

function nextSong(){
  let next = shuffle ? Math.floor(Math.random()*songs.length) : (currentIndex+1)%songs.length;
  loadSong(next,true);
}

document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.getElementById(btn.dataset.view+"View").classList.add("active");
  });
});

document.getElementById("searchInput").addEventListener("input",e=>{
  const q = e.target.value.trim().toLowerCase();
  if(q){
    document.querySelector('[data-view="search"]').click();
    const results = songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    const root = document.getElementById("searchResults");
    root.innerHTML = songRows(results);
    bindSongRows(root);
  }
});

renderPlaylists();
renderSongs();
loadSong(0,false);
audio.volume = .8;
