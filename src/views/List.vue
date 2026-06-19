<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const charts = ref([])
const selectedChart = ref(null)
const uploadMessage = ref('')
const uploadInputRef = ref(null)
let audioElement = null

// 从谱面文本中解析元数据
const parseChartMeta = (text) => {
  const meta = {}
  const lines = text.trim().split('\n')
  
  for (const line of lines) {
    if (line.trim() === '') break
    const [key, ...value] = line.split(' ')
    meta[key] = value.join(' ')
  }
  
  return meta
}

// 验证谱面是否符合规范
const validateChart = (text, meta) => {
  // 必填项检查
  if (!meta.id || !meta.title || !meta.level || !meta.music) {
    return false
  }
  
  // 检查元数据后是否有空行
  const lines = text.trim().split('\n')
  let metaEndIndex = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      metaEndIndex = i
      break
    }
  }
  
  // 至少有元数据后的内容（空行后的部分）
  const chartContent = lines.slice(metaEndIndex + 1).join('\n')
  if (!chartContent.trim()) {
    return false
  }
  
  // 检查是否有 BPM 标记和音符分布
  const hasBpm = /^\d+bpm$/mi.test(chartContent)
  const hasNotes = /^\d+\s+[\d,\s]+$/m.test(chartContent)
  
  return hasBpm && hasNotes
}

// 处理文件上传
const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件格式
  if (!file.name.endsWith('.txt')) {
    uploadMessage.value = 'This txt is not a valid 67 chart!'
    setTimeout(() => { uploadMessage.value = '' }, 2000)
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    const meta = parseChartMeta(text)
    
    // 验证谱面
    if (!validateChart(text, meta)) {
      uploadMessage.value = 'This txt is not a valid 67 chart!'
      setTimeout(() => { uploadMessage.value = '' }, 2000)
      return
    }
    
    // 获取当前自制谱数量，生成新 ID
    const customCharts = JSON.parse(localStorage.getItem('customCharts') || '[]')
    const newId = 20000 + customCharts.length
    
    // 保存到 localStorage
    const newChart = {
      id: newId.toString(),
      customText: text,
      title: meta.title,
      artist: meta.artist || 'Unknown',
      level: meta.level,
      chartist: meta.des || 'Unknown',
      music: meta.music || '',
      cover: meta.cover || '/covers/default.jpg',
      isCustom: true
    }
    
    customCharts.push(newChart)
    localStorage.setItem('customCharts', JSON.stringify(customCharts))
    
    // 添加到列表
    charts.value.push(newChart)
    
    uploadMessage.value = 'chart added!'
    setTimeout(() => { uploadMessage.value = '' }, 2000)
  }
  
  reader.readAsText(file)
  
  // 清空 input 以便重复选择同一文件
  event.target.value = ''
}

// 触发文件选择
const triggerUpload = () => {
  uploadInputRef.value?.click()
}

onMounted(async () => {
  // 加载谱面列表
  const res = await fetch('/charts/list.json')
  const chartList = await res.json()
  
  // 遍历所有谱面文件获取元数据
  const loadedCharts = await Promise.all(
    chartList.map(async (item) => {
      const chartRes = await fetch(item.chart)
      const chartText = await chartRes.text()
      const meta = parseChartMeta(chartText)
      
      return {
        id: item.id,
        chart: item.chart,
        title: meta.title || 'Unknown',
        artist: meta.artist || 'Unknown',
        level: meta.level || 'Unknown',
        chartist: meta.des || 'Unknown',
        music: meta.music || '',
        cover: meta.cover || '/covers/default.jpg',
        isCustom: false
      }
    })
  )
  
  // 从 localStorage 加载自制谱
  const customCharts = JSON.parse(localStorage.getItem('customCharts') || '[]')
  
  charts.value = [...loadedCharts, ...customCharts]
  
  // 创建音频元素用于预览
  audioElement = new Audio()
  audioElement.volume = 0.5
})

onUnmounted(() => {
  if (audioElement) {
    audioElement.pause()
    audioElement = null
  }
})

const selectChart = (chart) => {
  // 如果选择的是同一个谱面，取消选择
  if (selectedChart.value && selectedChart.value.id === chart.id) {
    selectedChart.value = null
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
    return
  }
  
  selectedChart.value = chart
  
  // 播放预览音乐（不需要等待缓存）
  if (audioElement) {
    audioElement.src = chart.music
    audioElement.play().catch(err => {
      console.log('音频播放失败:', err)
    })
  }
}

const startGame = () => {
  if (!selectedChart.value) return
  
  // 停止预览音乐
  if (audioElement) {
    audioElement.pause()
    audioElement.currentTime = 0
  }
  
  // 跳转到游戏页面，传递选中的谱面信息
  router.push({
    path: '/play',
    query: {
      chart: selectedChart.value.id
    }
  })
}

const goHome = () => {
  if (audioElement) {
    audioElement.pause()
  }
  router.push('/')
}
</script>

<template>
  <div class="list-container">
    <div class="header">
      <button class="back-btn" @click="goHome">←</button>
      <h1 class="title">Select Chart</h1>
      <button class="upload-btn" @click="triggerUpload" title="添加谱面">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
    </div>
    
    <!-- 隐藏的文件输入框 -->
    <input 
      ref="uploadInputRef"
      type="file" 
      accept=".txt" 
      style="display: none" 
      @change="handleFileUpload"
    />
    
    <!-- 上传提示 -->
    <div v-if="uploadMessage" class="upload-message" :class="{ success: uploadMessage === 'chart added!' }">
      {{ uploadMessage }}
    </div>
    
    <div class="chart-list">
      <div 
        v-for="chart in charts" 
        :key="chart.id"
        class="chart-item"
        :class="{ selected: selectedChart?.id === chart.id }"
        @click="selectChart(chart)"
      >
        <div class="chart-cover">
          <img :src="chart.cover" :alt="chart.title" @error="($event.target.style.display = 'none')" />
        </div>
        <div class="chart-info">
          <div class="chart-title">{{ chart.title }}</div>
          <div class="chart-artist">{{ chart.artist }}</div>
          <div class="chart-meta">
            <span class="level">{{ chart.level }}</span>
            <span class="chartist">Charted by {{ chart.chartist }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <button 
        class="start-btn" 
        :disabled="!selectedChart"
        @click="startGame"
      >
        Start!
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-container {
  width: 100vw;
  height: 100vh;
  background-color: #0a0a0a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  padding: 20px;
  gap: 15px;
}

.back-btn {
  width: 40px;
  height: 40px;
  background: #222;
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #333;
}

.title {
  color: #fff;
  font-size: 1.5rem;
  margin: 0;
  flex: 1;
}

.upload-btn {
  width: 40px;
  height: 40px;
  background: #222;
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-btn:hover {
  background: #ffd700;
  color: #000;
}

.upload-message {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: #ff4444;
  color: #fff;
  border-radius: 8px;
  font-size: 0.9rem;
  z-index: 100;
  animation: fadeIn 0.3s;
}

.upload-message.success {
  background: #44ff44;
  color: #000;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.chart-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.chart-item {
  display: flex;
  gap: 15px;
  padding: 15px;
  background: #1a1a1a;
  border-radius: 15px;
  margin-bottom: 15px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.chart-item:hover {
  background: #252525;
}

.chart-item.selected {
  border-color: #ffd700;
  background: #2a2a1a;
}

.chart-cover {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  background: #333;
  flex-shrink: 0;
}

.chart-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chart-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.chart-title {
  color: #fff;
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.chart-artist {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.chart-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.level {
  background: #ffd700;
  color: #000;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: bold;
}

.chartist {
  color: #666;
  font-size: 0.8rem;
}

.footer {
  padding: 20px;
}

.start-btn {
  width: 100%;
  padding: 18px;
  font-size: 1.3rem;
  font-weight: bold;
  background: linear-gradient(145deg, #ffd700, #ffaa00);
  color: #000;
  border: none;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.start-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3);
}
</style>
