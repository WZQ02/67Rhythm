<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isSimaiFormat } from '../utils/simaiParser'
import { saveAudio, deleteAudio, getAudio } from '../utils/db'
import SimaiConverter from '../components/SimaiConverter.vue'
const { t } = useI18n()

const router = useRouter()
const charts = ref([])
const selectedChart = ref(null)
const uploadMessage = ref('')
const uploadInputRef = ref(null)
let audioElement = null

// simai 转换器状态
const showSimaiConverter = ref(false)
const simaiText = ref('')

// 音乐上传弹窗状态
const showMusicUpload = ref(false)
const pendingChartData = ref(null)
const musicInputRef = ref(null)

// simai 转换器音乐上传状态
const pendingSimaiMusic = ref(null)
const showSimaiMusicUpload = ref(false)
const simaiMusicInputRef = ref(null)

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
  // 必填项检查（music 改为可选，由用户后续上传）
  if (!meta.id || !meta.title || !meta.level) {
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
  const hasBpm = /^\d+(?:\.\d+)?bpm$/mi.test(chartContent)
  const hasNotes = /^\d+\s+[\d,\s]+$/m.test(chartContent)
  
  return hasBpm && hasNotes
}

// 更新谱面文本中的 music 字段
const updateMusicInChartText = (text, musicValue) => {
  const lines = text.trim().split('\n')
  let inMetadata = true
  let updatedLines = []
  
  for (const line of lines) {
    if (inMetadata) {
      console.log(line)
      if (line.trim() === '') {
        // 空行表示元数据结束
        inMetadata = false
        updatedLines.push(line)
      } else if (line.trim().startsWith('music')) {
        // 更新已有的 music 行
        updatedLines.push(`music ${musicValue}`)
      } else {
        // 其他元数据行保持不变
        updatedLines.push(line)
      }
    } else {
      // 谱面内容保持不变
      updatedLines.push(line)
    }
  }
  
  return updatedLines.join('\n')
}

// 保存谱面到 localStorage
const saveChartToStorage = (text, meta, musicId = '') => {
  const customCharts = JSON.parse(localStorage.getItem('customCharts') || '[]')
  const newId = 20000 + customCharts.length
  
  // 如果有音乐ID，更新谱面文本中的 music 字段
  let chartText = text
  if (musicId) {
    chartText = updateMusicInChartText(text, musicId)
  }
  
  const newChart = {
    id: newId.toString(),
    customText: chartText,
    title: meta.title,
    artist: meta.artist || 'Unknown',
    level: meta.level,
    chartist: meta.des || 'Unknown',
    music: musicId || meta.music || '',
    cover: meta.cover || '/covers/default.jpg',
    isCustom: true
  }
  
  customCharts.push(newChart)
  localStorage.setItem('customCharts', JSON.stringify(customCharts))
  
  return newChart
}

// 处理音乐文件上传
const handleMusicUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (!file.type.startsWith('audio/')) {
    uploadMessage.value = '请上传音频文件'
    setTimeout(() => { uploadMessage.value = '' }, 2000)
    return
  }
  
  try {
    const musicId = `audio_${Date.now()}`
    
    // 保存到 IndexedDB
    await saveAudio(musicId, file, file.name)
    
    // 如果有待导入的谱面数据
    if (pendingChartData.value) {
      const { text, meta } = pendingChartData.value
      const newChart = saveChartToStorage(text, meta, musicId)
      charts.value.push(newChart)
      pendingChartData.value = null
    } else if (pendingSimaiMusic.value) {
      // 如果是 simai 转换后待上传音乐
      importConvertedChart(pendingSimaiMusic.value.chartText, musicId)
      pendingSimaiMusic.value = null
    }
    
    showMusicUpload.value = false
    showSimaiMusicUpload.value = false
    uploadMessage.value = t('list.chartAdded')
    setTimeout(() => { uploadMessage.value = '' }, 2000)
  } catch (err) {
    console.error('Failed to save audio:', err)
    uploadMessage.value = '音频保存失败'
    setTimeout(() => { uploadMessage.value = '' }, 2000)
  }
  
  event.target.value = ''
}

// 触发音乐上传
const triggerMusicUpload = () => {
  musicInputRef.value?.click()
}

// 触发 simai 音乐上传
const triggerSimaiMusicUpload = () => {
  simaiMusicInputRef.value?.click()
}

// 处理文件上传
const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件格式
  if (!file.name.endsWith('.txt')) {
    uploadMessage.value = t('list.invalidChart')
    setTimeout(() => { uploadMessage.value = '' }, 2000)
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    const meta = parseChartMeta(text)
    
    // 验证谱面
    if (!validateChart(text, meta)) {
      // 检查是否为 simai 格式
      if (isSimaiFormat(text)) {
        simaiText.value = text
        showSimaiConverter.value = true
      } else {
        uploadMessage.value = t('list.invalidChart')
        setTimeout(() => { uploadMessage.value = '' }, 2000)
      }
      return
    }
    
    // 检查 music 项是否为空
    if (!meta.music || meta.music.trim() === '') {
      // 弹出音乐上传界面
      pendingChartData.value = { text, meta }
      showMusicUpload.value = true
      return
    }
    
    // 保存到 localStorage
    const newChart = saveChartToStorage(text, meta)
    
    // 添加到列表
    charts.value.push(newChart)
    
    uploadMessage.value = t('list.chartAdded')
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

// 获取历史最高记录
const getHighScore = (chartId) => {
  const highScores = JSON.parse(localStorage.getItem('highScores') || '{}')
  return highScores[chartId] || null
}

// 导入转换后的 simai 谱面
const importConvertedChart = (chartText, musicId = '') => {
  const meta = parseChartMeta(chartText)
  
  // 如果有音乐ID，更新谱面文本中的 music 字段
  let updatedChartText = chartText
  if (musicId) {
    updatedChartText = updateMusicInChartText(chartText, musicId)
  }
  
  // 获取当前自制谱数量，生成新 ID
  const customCharts = JSON.parse(localStorage.getItem('customCharts') || '[]')
  const newId = 20000 + customCharts.length
  
  // 保存到 localStorage
  const newChart = {
    id: newId.toString(),
    customText: updatedChartText,
    title: meta.title,
    artist: meta.artist || 'Unknown',
    level: meta.level,
    chartist: meta.des || 'Unknown',
    music: musicId || meta.music || '',
    cover: meta.cover || '/covers/default.jpg',
    isCustom: true
  }
  
  customCharts.push(newChart)
  localStorage.setItem('customCharts', JSON.stringify(customCharts))
  
  // 添加到列表
  charts.value.push(newChart)
  
  uploadMessage.value = t('list.chartAdded')
  setTimeout(() => { uploadMessage.value = '' }, 2000)
}

// 处理 simai 转换完成但需要上传音乐
const handleSimaiConvertWithMusic = (chartText) => {
  const meta = parseChartMeta(chartText)
  
  // 检查 music 项是否为空
  if (!meta.music || meta.music.trim() === '') {
    // 弹出音乐上传界面
    pendingSimaiMusic.value = { chartText }
    showSimaiMusicUpload.value = true
    return
  }
  
  // 直接导入
  importConvertedChart(chartText)
}

// 删除自制谱
const deleteCustomChart = async (chart) => {
  if (!chart.isCustom) return
  
  // 如果有本地音乐文件，删除 IndexedDB 中的数据
  if (chart.music && chart.music.startsWith('audio_')) {
    try {
      await deleteAudio(chart.music)
    } catch (err) {
      console.error('Failed to delete audio from IndexedDB:', err)
    }
  }
  
  // 删除对应的游玩成绩记录
  const highScores = JSON.parse(localStorage.getItem('highScores') || '{}')
  delete highScores[chart.id]
  localStorage.setItem('highScores', JSON.stringify(highScores))
  
  // 从 localStorage 中删除谱面
  let customCharts = JSON.parse(localStorage.getItem('customCharts') || '[]')
  customCharts = customCharts.filter(c => c.id !== chart.id)
  localStorage.setItem('customCharts', JSON.stringify(customCharts))
  
  // 从列表中移除
  charts.value = charts.value.filter(c => c.id !== chart.id)
  
  // 如果删除的是当前选中的，清除选择
  if (selectedChart.value?.id === chart.id) {
    selectedChart.value = null
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
    }
  }
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

const selectChart = async (chart) => {
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
  
  // 播放预览音乐
  if (audioElement) {
    try {
      // 如果是本地音频ID，从 IndexedDB 读取
      if (chart.music && chart.music.startsWith('audio_')) {
        const blob = await getAudio(chart.music)
        if (blob) {
          const url = URL.createObjectURL(blob)
          audioElement.src = url
          audioElement.play()
        }
      } else {
        audioElement.src = chart.music
        audioElement.play()
      }
    } catch (err) {
      console.log('Audio playback failed:', err)
    }
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
      <h1 class="title">{{ t('list.title') }}</h1>
      <div class="header-buttons">
        <button class="tutorial-btn" @click="router.push('/tutorial')" title="教程">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
        <button class="upload-btn" @click="triggerUpload" title="添加谱面">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button class="settings-btn" @click="router.push('/settings')" title="设置">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="about-btn" @click="router.push('/about')" title="关于">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </button>
      </div>
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
            <span class="chartist">{{ t('list.chartedBy') }} {{ chart.chartist }}</span>
            <span v-if="getHighScore(chart.id)" class="high-grade">{{ getHighScore(chart.id).grade }}</span>
          </div>
        </div>
        <button 
          v-if="chart.isCustom" 
          class="delete-btn"
          @click.stop="deleteCustomChart(chart)"
          title="Delete"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="footer">
      <button 
        class="start-btn" 
        :disabled="!selectedChart"
        @click="startGame"
      >
        {{ t('list.start') }}
      </button>
    </div>
    
    <!-- simai 转换器弹窗 -->
    <SimaiConverter 
      :show="showSimaiConverter"
      :simaiText="simaiText"
      @close="showSimaiConverter = false"
      @import="handleSimaiConvertWithMusic"
    />
    
    <!-- 音乐上传弹窗（67谱面） -->
    <div v-if="showMusicUpload" class="modal-overlay" @click.self="showMusicUpload = false">
      <div class="modal-content music-modal">
        <h2>谱面 music 项为空，请指定这个谱面的音乐文件：</h2>
        <div class="upload-area" @click="triggerMusicUpload">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>点击上传音频文件</p>
        </div>
        <button class="modal-cancel-btn" @click="showMusicUpload = false; pendingChartData = null">取消</button>
      </div>
    </div>
    
    <!-- simai 音乐上传弹窗 -->
    <div v-if="showSimaiMusicUpload" class="modal-overlay" @click.self="showSimaiMusicUpload = false">
      <div class="modal-content music-modal">
        <h2>simai 谱面 music 项为空，请指定这个谱面的音乐文件：</h2>
        <div class="upload-area" @click="triggerSimaiMusicUpload">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>点击上传音频文件</p>
        </div>
        <button class="modal-cancel-btn" @click="showSimaiMusicUpload = false; pendingSimaiMusic = null">取消</button>
      </div>
    </div>
    
    <!-- 隐藏的音乐文件输入框 -->
    <input 
      ref="musicInputRef"
      type="file" 
      accept="audio/*" 
      style="display: none" 
      @change="handleMusicUpload"
    />
    <input 
      ref="simaiMusicInputRef"
      type="file" 
      accept="audio/*" 
      style="display: none" 
      @change="handleMusicUpload"
    />
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

.header-buttons {
  display: flex;
  gap: 10px;
}

.settings-btn,
.tutorial-btn {
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

.settings-btn:hover {
  background: #4a9eff;
  color: #fff;
}

.about-btn {
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

.about-btn:hover {
  background: #9b59b6;
  color: #fff;
}

.tutorial-btn:hover {
  background: #ff9f4a;
  color: #fff;
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
  flex-wrap: wrap;
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

.high-grade {
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 1.5rem;
  font-weight: bold;
  margin-left: auto;
}

.delete-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  background: #333;
  border: none;
  border-radius: 50%;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: #ff4444;
  color: #fff;
}

.chart-item {
  position: relative;
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

/* 音乐上传弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-content {
  background: #1a1a1a;
  padding: 30px;
  border-radius: 15px;
  max-width: 90vw;
  text-align: center;
}

.music-modal {
  width: 400px;
}

.music-modal h2 {
  color: #ffd700;
  font-size: 1.2rem;
  margin-bottom: 20px;
  line-height: 1.5;
}

.upload-area {
  border: 2px dashed #444;
  border-radius: 15px;
  padding: 40px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  color: #666;
}

.upload-area:hover {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
}

.upload-area p {
  margin: 0;
  font-size: 1rem;
}

.modal-cancel-btn {
  margin-top: 20px;
  padding: 12px 30px;
  background: #333;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-cancel-btn:hover {
  background: #444;
}
</style>
