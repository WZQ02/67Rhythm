<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const chartInfo = ref(null)
const notes = ref([])
const activeNotes = ref([])
const judgmentTexts = ref([])
const stats = ref({ great: 0, good: 0, miss: 0 })
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
  const res = await fetch(url)
  const arrayBuffer = await res.arrayBuffer()
  return audioCtx.decodeAudioData(arrayBuffer)
}

const playCountIn = (bpm, beatCount) => {
  return new Promise((resolve) => {
    const interval = (60 / bpm) * 1000
    
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

const showJudgment = (text, color) => {
  const id = judgmentId++
  judgmentTexts.value.push({ id, text, color })
  setTimeout(() => {
    judgmentTexts.value = judgmentTexts.value.filter(j => j.id !== id)
  }, 200)
}

const judgeNote = (lane) => {
  activateHand(lane)
  
  if (!gameStarted.value || gameEnded.value) return

  const now = (audioCtx.currentTime - musicStartTime) * 1000 - parseFloat(chartInfo.value.delay)
  console.log(`按键判定: ${lane}, 当前时间: ${now}`)
  
  const laneNotes = activeNotes.value.filter(n => n.lane === lane && !n.judged)
  console.log(`当前轨道活跃音符: ${laneNotes.length}`)
  if (laneNotes.length === 0) return

  const closestNote = laneNotes.reduce((prev, curr) => {
    return Math.abs(curr.hitTime - now) < Math.abs(prev.hitTime - now) ? curr : prev
  })

  const diff = Math.abs(closestNote.hitTime - now)
  
  if (diff <= JUDGMENT_WINDOW.great) {
    stats.value.great++
    score.value += 1
    showJudgment('GREAT', '#ffd700')
    closestNote.judged = true
    document.getElementById(`note-${closestNote.id}`)?.remove()
    activeNotes.value = activeNotes.value.filter(n => n.id !== closestNote.id)
  } else if (diff <= JUDGMENT_WINDOW.good) {
    stats.value.good++
    score.value += 0.5
    showJudgment('GOOD', '#00ff00')
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
          miss: stats.value.miss
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

onMounted(async () => {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  // 确保AudioContext处于运行状态
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  
  try {
    // 加载谱面
    const chartRes = await fetch('/charts/code_blood.txt')
    const chartText = await chartRes.text()
    const parsed = parseChart(chartText)
    chartInfo.value = parsed.info
    notes.value = parsed.notes
    
    console.log('谱面解析结果:', chartInfo.value)
    console.log('音符数量:', notes.value.length)
    if (notes.value.length > 0) {
      console.log('前几个音符:', notes.value.slice(0, 5))
    }

    // 加载音频
    musicBuffer = await loadAudio(chartInfo.value.music)
    clockBuffer = await loadAudio('/sfx/clock.mp3')

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
  } catch (err) {
    console.error('Error loading game:', err)
  }
})

onUnmounted(() => {
  if (gameLoopId) cancelAnimationFrame(gameLoopId)
  if (musicSource) musicSource.stop()
  if (audioCtx) audioCtx.close()
  window.removeEventListener('keydown', handleKeyDown)
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
        {{ judgment.text }}
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
  fill: white;
  height: 100%;
  width: 100%;
  bottom: 0px;
  max-width: 50vw;
  opacity: .67;
  transition: transform 0.2s ease-out;
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

@keyframes fall {
  from { top: 0; }
  to { top: 75%; }
}
</style>