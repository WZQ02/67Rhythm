<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const chartInfo = ref(null)
const notes = ref([])
const activeNotes = ref([])
const judgmentTexts = ref([])
const stats = ref({ great: 0, good: 0, miss: 0, fast: 0, late: 0 })
const score = ref(0)
const gameStarted = ref(false)
const gameEnded = ref(false)
const leftHandActivated = ref(false)
const rightHandActivated = ref(false)

const FALL_DURATION = 1000 // 下落时长（毫秒），可调整
const JUDGMENT_WINDOW = { great: 50, good: 100 }

let audioCtx = null
let musicBuffer = null
let clockBuffer = null
let musicSource = null
let gameLoopId = null
let musicStartTime = 0
let judgmentId = 0

const parseChart = (text) => {
  const lines = text.trim().split('\n')
  const info = {}
  const noteData = []
  let isMetaData = true

  for (const line of lines) {
    if (line.trim() === '') {
      isMetaData = false
      continue
    }
    if (isMetaData) {
      const [key, ...value] = line.split(' ')
      info[key] = value.join(' ')
    } else {
      noteData.push(line)
    }
  }

  let currentBpm = 120
  let currentTime = 0
  const parsedNotes = []

  for (const line of noteData) {
    if (line.includes('bpm')) {
      currentBpm = parseFloat(line)
      continue
    }
    const [beatsPerBar, pattern] = line.split(' ')
    const beatDuration = (60 / currentBpm) * 1000
    // 每个音符的时长 = 4/beatsPerBar 拍
    const noteDuration = beatDuration * (4 / parseInt(beatsPerBar))
    const notesInBar = pattern.split(',')
    
    for (let i = 0; i < notesInBar.length; i++) {
      const noteType = notesInBar[i].trim()
      if (noteType === '') continue
      
      parsedNotes.push({
        lane: noteType === '6' ? 'left' : 'right',
        hitTime: currentTime + i * noteDuration
      })
    }
    // 累加时间，不超过最后一个音符的位置
    if (notesInBar.length > 0) {
      currentTime += (notesInBar.length - 1) * noteDuration
    }
  }

  return { info, notes: parsedNotes }
}

const loadAudio = async (url) => {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch audio: ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    return new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(arrayBuffer, resolve, reject)
    })
  } catch (err) {
    console.error('Audio load error:', err)
    throw err
  }
}

const playCountIn = (bpm, beatCount) => {
  return new Promise((resolve) => {
    // 拍子速度 = (bpm / 4) * 拍数
    const countInBpm = (bpm / 4) * beatCount
    const interval = (60 / countInBpm) * 1000
    
    for (let i = 0; i < beatCount; i++) {
      const source = audioCtx.createBufferSource()
      source.buffer = clockBuffer
      source.connect(audioCtx.destination)
      
      const playTime = audioCtx.currentTime + (i * interval) / 1000
      source.start(playTime)
      
      // 最后一个节拍后触发游戏开始
      if (i === beatCount - 1) {
        // 使用 setTimeout 确保节拍声音播放完毕后再开始
        const delayMs = Math.ceil((playTime - audioCtx.currentTime) * 1000) + 100
        setTimeout(resolve, delayMs)
      }
    }
  })
}

const activateHand = (side) => {
  if (side === 'left') {
    leftHandActivated.value = true
    setTimeout(() => { leftHandActivated.value = false }, 200)
  } else {
    rightHandActivated.value = true
    setTimeout(() => { rightHandActivated.value = false }, 200)
  }
}

const showJudgment = (text, color, subText = '', subColor = '') => {
  const id = judgmentId++
  judgmentTexts.value.push({ id, text, color, subText, subColor })
  setTimeout(() => {
    judgmentTexts.value = judgmentTexts.value.filter(j => j.id !== id)
  }, 200)
}

const judgeNote = (lane) => {
  activateHand(lane)
  
  if (!gameStarted.value || gameEnded.value) return

  const now = (audioCtx.currentTime - musicStartTime) * 1000 - parseFloat(chartInfo.value.delay)
  
  const laneNotes = activeNotes.value.filter(n => n.lane === lane && !n.judged)
  if (laneNotes.length === 0) return

  const closestNote = laneNotes.reduce((prev, curr) => {
    return Math.abs(curr.hitTime - now) < Math.abs(prev.hitTime - now) ? curr : prev
  })

  const diff = Math.abs(closestNote.hitTime - now)
  const timeDiff = now - closestNote.hitTime  // 正数表示打晚了，负数表示打早了
  
  if (diff <= JUDGMENT_WINDOW.great) {
    stats.value.great++
    score.value += 1
    // 判断是 FAST 还是 LATE（diff > 20ms 时）
    if (diff > 20) {
      if (timeDiff > 0) {
        // 打晚了
        stats.value.late++
        showJudgment('GREAT', '#ffd700', 'LATE', '#ff4444')
      } else {
        // 打早了
        stats.value.fast++
        showJudgment('GREAT', '#ffd700', 'FAST', '#4488ff')
      }
    } else {
      showJudgment('GREAT', '#ffd700')
    }
    closestNote.judged = true
    document.getElementById(`note-${closestNote.id}`)?.remove()
    activeNotes.value = activeNotes.value.filter(n => n.id !== closestNote.id)
  } else if (diff <= JUDGMENT_WINDOW.good) {
    stats.value.good++
    score.value += 0.5
    // GOOD 判定总是显示 FAST/LATE
    if (timeDiff > 0) {
      // 打晚了
      stats.value.late++
      showJudgment('GOOD', '#00ff00', 'LATE', '#ff4444')
    } else {
      // 打早了
      stats.value.fast++
      showJudgment('GOOD', '#00ff00', 'FAST', '#4488ff')
    }
    closestNote.judged = true
    document.getElementById(`note-${closestNote.id}`)?.remove()
    activeNotes.value = activeNotes.value.filter(n => n.id !== closestNote.id)
  }
}

const spawnNote = (note) => {
  const track = document.querySelector(`.track.${note.lane}`)
  if (!track) {
    console.error(`找不到轨道: .track.${note.lane}`)
    return
  }
  const noteEl = document.createElement('div')
  noteEl.className = 'note'
  noteEl.classList += ' '+note.lane
  noteEl.id = `note-${note.id}`
  noteEl.style.animationDuration = `${FALL_DURATION}ms`
  track.appendChild(noteEl)
  console.log(`生成音符: ${note.lane}, hitTime: ${note.hitTime}`)
}

const gameLoop = () => {
  if (gameEnded.value) return

  const now = (audioCtx.currentTime - musicStartTime) * 1000 - parseFloat(chartInfo.value.delay)
  
  // 生成新音符
  for (const note of notes.value) {
    const spawnTime = note.hitTime - FALL_DURATION
    if (!note.spawned && now >= spawnTime && now <= note.hitTime + 500) {
      note.spawned = true
      note.id = Date.now() + Math.random()
      spawnNote(note)
      activeNotes.value.push(note)
    }
  }

  // 检查miss
  for (const note of activeNotes.value) {
    if (!note.judged && now > note.hitTime + JUDGMENT_WINDOW.good) {
      stats.value.miss++
      showJudgment('MISS', '#888888')
      note.judged = true
      document.getElementById(`note-${note.id}`)?.remove()
      activeNotes.value = activeNotes.value.filter(n => n.id !== note.id)
    }
  }

  // 检查游戏结束
  if (activeNotes.value.length === 0 && notes.value.every(n => n.spawned)) {
    gameEnded.value = true
    setTimeout(() => {
      const accuracy = notes.value.length > 0 ? (score.value / notes.value.length) * 100 : 0
      router.push({ 
        path: '/result',
        query: {
          title: chartInfo.value.title,
          artist: chartInfo.value.artist,
          level: chartInfo.value.level,
          accuracy: accuracy.toFixed(2),
          great: stats.value.great,
          good: stats.value.good,
          miss: stats.value.miss,
          fast: stats.value.fast,
          late: stats.value.late
        }
      })
    }, 1000)
    return
  }

  gameLoopId = requestAnimationFrame(gameLoop)
}

const handleKeyDown = (e) => {
  if (e.key === '6') {
    e.preventDefault()
    judgeNote('left')
  } else if (e.key === '7') {
    e.preventDefault()
    judgeNote('right')
  }
}

let THRESHOLD = 7;
let rotation_num = 0;

const Handle67Motion = (event) => {
  const now = Date.now();
  const acc = event.acceleration;
  if (!acc || acc.y === null || acc.z === null) return;
  const cF = acc.y + acc.z;
  if (cF > THRESHOLD) {
      if (rotation_num != 6) {
          rotation_num = 6
          judgeNote('left')
      }
      lastTriggerTime = now;
  } 
  else if (cF < -THRESHOLD) {
      if (rotation_num != 7) {
          rotation_num = 7
          judgeNote('right')
      }
      lastTriggerTime = now;
  }
}

onMounted(async () => {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  // 确保AudioContext处于运行状态
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  
  try {
    // 从路由参数获取谱面ID，默认为 pandora
    const chartId = route.query.chart || 'pandora'
    
    // 加载谱面列表获取谱面文件路径
    const listRes = await fetch('/charts/list.json')
    const chartList = await listRes.json()
    const chartItem = chartList.find(c => c.id === chartId) || chartList[0]
    
    // 加载谱面文件（包含所有元数据）
    const chartRes = await fetch(chartItem.chart)
    const chartText = await chartRes.text()
    const parsed = parseChart(chartText)
    chartInfo.value = parsed.info
    notes.value = parsed.notes
    
    console.log('谱面信息:', chartInfo.value)
    
    // 获取音乐URL，处理相对路径
    let musicUrl = chartInfo.value.music || ''
    if (musicUrl && !musicUrl.startsWith('http')) {
      // 如果是相对路径，添加正确的主机地址
      musicUrl = window.location.origin + musicUrl
    }
    console.log('音乐URL:', musicUrl)

    // 加载音频（使用 Web Audio API）
    console.log('开始加载音乐...')
    musicBuffer = await loadAudio(musicUrl).catch(err => {
      console.error('音乐加载失败，尝试本地fallback:', err)
      return loadAudio('/music/default.mp3')
    })
    console.log('音乐加载完成')
    
    console.log('开始加载节拍音效...')
    clockBuffer = await loadAudio('/sfx/clock.mp3').catch(err => {
      console.error('节拍音效加载失败:', err)
    })
    console.log('节拍音效加载完成')

    // 解析第一行bpm和拍数用于预拍
    const lines = chartText.trim().split('\n')
    let noteLinesStartIndex = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        noteLinesStartIndex = i + 1
        break
      }
    }
    const noteLines = lines.slice(noteLinesStartIndex)
    const firstBpm = parseFloat(noteLines.find(l => l.includes('bpm'))) || 120
    const firstBarLine = noteLines.find(l => !l.includes('bpm'))
    const firstBeatCount = parseInt(firstBarLine?.split(' ')[0]) || 4

    // 播放预拍
    await playCountIn(firstBpm, firstBeatCount)

    // 开始游戏
    musicSource = audioCtx.createBufferSource()
    musicSource.buffer = musicBuffer
    musicSource.connect(audioCtx.destination)
    musicStartTime = audioCtx.currentTime
    musicSource.start()

    gameStarted.value = true
    gameLoopId = requestAnimationFrame(gameLoop)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('devicemotion', Handle67Motion)
  } catch (err) {
    console.error('Error loading game:', err)
  }
})

onUnmounted(() => {
  if (gameLoopId) cancelAnimationFrame(gameLoopId)
  if (musicSource) musicSource.stop()
  if (audioCtx) audioCtx.close()
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('devicemotion', Handle67Motion)
})
</script>

<template>
  <div class="play-container">
    <div class="title_bar">
      <div class="song_title">{{ chartInfo?.title || 'Loading...' }}</div>
    </div>
    
    <div class="tracks-wrapper">
      <div class="track left">
      </div>
      <div class="track right"></div>
      <div class="white-line"></div>
    </div>
    
    <div class="hands">
      <div class="hand left" :class="{ activated: leftHandActivated }">
        <svg viewBox="0 0 445.25 164.14">
            <path d="M0,88.5S209.91,29.26,366.65,11.88c14.88-1.65,12.33-12.84,31.85-11.81,19.52,1.03-2.57,8.22-2.57,8.22,0,0,27.74-5.65,36.98-5.65s8.56,3.94,1.11,5.74-5.82,1.46-5.82,1.46c0,0,17.55-4.37,17.04.51s-3.94,22.17-23.29,27.82c-19.35,5.65-25.68,4.11-39.81,3.08S76.7,171.37,0,163.83"></path>
        </svg>
      </div>
      <div class="hand right" :class="{ activated: rightHandActivated }">
        <svg viewBox="0 0 445.25 164.14">
            <path d="M445.25,88.5S235.34,29.26,78.6,11.88C63.71,10.23,66.27-.96,46.75.07s2.57,8.22,2.57,8.22c0,0-27.74-5.65-36.98-5.65s-8.56,3.94-1.11,5.74,5.82,1.46,5.82,1.46C17.05,9.83-.5,5.46.01,10.34s3.94,22.17,23.29,27.82c19.35,5.65,25.68,4.11,39.81,3.08,14.13-1.03,305.44,130.12,382.15,122.59"></path>
        </svg>
      </div>
    </div>

    <div class="judgment-area">
      <div 
        v-for="judgment in judgmentTexts" 
        :key="judgment.id" 
        class="judgment-text"
        :style="{ color: judgment.color }"
      >
        <div class="judgment-main">{{ judgment.text }}</div>
        <div v-if="judgment.subText" class="judgment-sub" :style="{ color: judgment.subColor }">
          {{ judgment.subText }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-container {
  width: 100vw;
  height: 100vh;
  background-color: #000;
  position: relative;
  overflow: hidden;
}

.title_bar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.song_title {
  color: #fff;
  font-size: 1.5rem;
  font-weight: bold;
}

.tracks-wrapper {
  width: 60%;
  height: 100%;
  margin: 0 auto;
  position: relative;
  display: flex;
  justify-content: center;
  gap: 20%;
}

.track {
  width: 30vh;
  height: 100%;
  background-color: #222;
  border: 2px #444 inset;
  position: relative;
  overflow: hidden;
}

.white-line {
  position: absolute;
  top: 75%;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #fff;
  border: 1px solid #000;
}

.hands {
  position: absolute;
  height: 10vh;
  width: 100%;
  bottom: 0px;
}

.hand {
  position: absolute;
  fill: rgb(255, 224, 72);
  height: 100%;
  width: 100%;
  bottom: 0px;
  max-width: 50vw;
  opacity: 1;
  stroke: black;
  stroke-width: 3;
  transition: transform 0.1s ease-in;
}

.hand.left {
  left: -15vw;
}

.hand.right {
  right: -15vw;
}

.hand.activated {
  transform: translateY(-16vh);
}

/* .note 样式移到了下方的全局 style 块中 */

.judgment-area {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 20;
}

.judgment-text {
  font-size: 3rem;
  font-weight: bold;
  animation: judgmentFade 0.2s ease-out forwards;
  text-align: center;
}

.judgment-main {
  line-height: 1.2;
}

.judgment-sub {
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 1;
  margin-top: 0.2rem;
}

@keyframes judgmentFade {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.5); }
}
</style>

<style>
.note {
  position: absolute;
  width: 10vh;
  left: 50%;
  transform: translateX(-50%);
  height: 1vh;
  background-color: #fff;
  top: 0;
  animation: fall linear forwards;
}

.note::after {
  color: #fff;
  text-align: center;
  font-size: 6.7vh;
  font-weight: bold;
  position: relative;
  text-shadow:
        -2px -2px 0 #000,  
         2px -2px 0 #000,
        -2px  2px 0 #000,
         2px  2px 0 #000;
  top: -7vh;
  left: 3vh;
}

.note.left::after {
  content: "6";
}
.note.right::after {
  content: "7";
}

@keyframes fall {
  from { top: 0; }
  to { top: 75%; }
}
</style>