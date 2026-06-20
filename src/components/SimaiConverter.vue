<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  isSimaiFormat, 
  parseSimaiMeta, 
  getSimaiDifficulties, 
  extractDifficultyContent,
  convertSimaiContent,
  generate67Chart,
  preprocessSimaiText
} from '../utils/simaiParser'
import { saveAudio } from '../utils/db'

const { t } = useI18n()

const props = defineProps({
  show: Boolean,
  simaiText: String
})

const emit = defineEmits(['close', 'import'])

// 表单数据
const musicUrl = ref('')
const coverUrl = ref('')
const selectedDifficulty = ref(1)
const convertOptions = ref({
  convertTap: true,
  convertHold: true,
  convertTouch: true
})

// 转换状态
const converted = ref(false)
const convertedChart = ref('')
const pendingMusicId = ref('')

// 音乐上传状态
const showMusicUpload = ref(false)
const musicInputRef = ref(null)
const localAudioUploaded = ref(false) // 标记是否已上传本地音频

// 解析元数据
const metaData = computed(() => {
  if (!props.simaiText) return null
  return parseSimaiMeta(props.simaiText)
})

// 获取可用难度
const difficulties = computed(() => {
  if (!props.simaiText) return []
  return getSimaiDifficulties(props.simaiText)
})

// 监听难度变化，默认选择第一个难度
watch(difficulties, (newDiffs) => {
  if (newDiffs.length > 0 && !newDiffs.find(d => d.level === selectedDifficulty.value)) {
    selectedDifficulty.value = newDiffs[0].level
  }
}, { immediate: true })

// 触发音乐上传
const triggerMusicUpload = () => {
  musicInputRef.value?.click()
}

// 处理音乐上传
const handleMusicUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  if (!file.type.startsWith('audio/')) {
    alert('请上传音频文件')
    return
  }
  
  try {
    const musicId = `audio_${Date.now()}`
    await saveAudio(musicId, file, file.name)
    
    pendingMusicId.value = musicId
    localAudioUploaded.value = true
    
    showMusicUpload.value = false
    // 不自动开始转换，用户点击"开始转换"按钮后才会转换
  } catch (err) {
    console.error('Failed to save audio:', err)
    alert('音频保存失败')
  }
  
  event.target.value = ''
}

// 开始转换
const startConvert = () => {
  if (!props.simaiText) return
  
  // 预处理：规范化谱面格式
  const preprocessedText = preprocessSimaiText(props.simaiText)
  
  // 提取指定难度的内容
  const content = extractDifficultyContent(preprocessedText, selectedDifficulty.value)
  
  // 转换音符
  const convertedContent = convertSimaiContent(content, convertOptions.value)
  
  // 获取难度名称
  const diffName = difficulties.value.find(d => d.level === selectedDifficulty.value)?.name || 'Unknown'
  
  // 确定音乐 URL（优先使用本地音频 ID）
  const finalMusicUrl = pendingMusicId.value || musicUrl.value || ''
  
  // 生成完整谱面
  convertedChart.value = generate67Chart(
    metaData.value,
    convertedContent,
    diffName,
    finalMusicUrl,
    coverUrl.value || ''
  )
  
  converted.value = true
}

// 下载谱面
const downloadChart = () => {
  if (!convertedChart.value) return
  
  const blob = new Blob([convertedChart.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${metaData.value?.title || 'chart'}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 导入谱面
const importChart = () => {
  emit('import', convertedChart.value, pendingMusicId.value)
  close()
}

// 关闭
const close = () => {
  converted.value = false
  convertedChart.value = ''
  pendingMusicId.value = ''
  musicUrl.value = ''
  localAudioUploaded.value = false
  emit('close')
}
</script>

<template>
  <div v-if="show" class="converter-overlay" @click.self="close">
    <div class="converter-modal">
      <h2 class="modal-title">simai 谱面转换器</h2>
      
      <!-- 转换前表单 -->
      <div v-if="!converted" class="converter-form">
        <!-- 音频 URL 或上传 -->
        <div class="form-item">
          <label>音频文件</label>
          <div class="music-input-row">
            <template v-if="localAudioUploaded">
              <div class="uploaded-indicator">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>（已上传音频）</span>
              </div>
            </template>
            <template v-else>
              <input 
                type="text" 
                v-model="musicUrl" 
                placeholder="https://example.com/music.mp3"
                class="music-url-input"
              />
            </template>
            <button class="upload-music-btn" @click="triggerMusicUpload" title="上传本地音频">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </div>
          <span class="input-hint" v-if="!localAudioUploaded">输入 URL 或点击按钮上传本地音频</span>
        </div>
        
        <!-- 难度选择 -->
        <div class="form-item">
          <label>转换哪个难度</label>
          <div class="difficulty-options">
            <label 
              v-for="diff in difficulties" 
              :key="diff.level"
              class="radio-label"
            >
              <input 
                type="radio" 
                :value="diff.level" 
                v-model="selectedDifficulty"
              />
              <span>{{ diff.name }}</span>
            </label>
          </div>
        </div>
        
        <!-- 音符类型选择 -->
        <div class="form-item">
          <label>转换哪些音符</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="convertOptions.convertTap" />
              <span>转换 tap</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="convertOptions.convertHold" />
              <span>转换 hold（变成单点）</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="convertOptions.convertTouch" />
              <span>转换 touch</span>
            </label>
          </div>
        </div>
        
        <!-- 曲绘 URL -->
        <div class="form-item">
          <label>添加曲绘（可选）</label>
          <input 
            type="text" 
            v-model="coverUrl" 
            placeholder="https://example.com/cover.jpg"
          />
        </div>
        
        <!-- 开始转换按钮 -->
        <button 
          class="convert-btn" 
          @click="startConvert"
        >
          开始转换
        </button>
      </div>
      
      <!-- 转换完成 -->
      <div v-else class="converter-result">
        <div class="success-message">转换完成！</div>
        
        <div class="result-actions">
          <button class="action-btn download-btn" @click="downloadChart">
            下载谱面
          </button>
          <button class="action-btn import-btn" @click="importChart">
            导入谱面
          </button>
        </div>
      </div>
      
      <!-- 关闭按钮 -->
      <button class="close-btn" @click="close">×</button>
      
      <!-- 隐藏的音乐文件输入框 -->
      <input 
        ref="musicInputRef"
        type="file" 
        accept="audio/*" 
        style="display: none" 
        @change="handleMusicUpload"
      />
    </div>
  </div>
</template>

<style scoped>
.converter-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.converter-modal {
  background: #1a1a1a;
  border-radius: 15px;
  padding: 30px;
  width: 90%;
  max-width: 450px;
  position: relative;
  color: #fff;
}

.modal-title {
  text-align: center;
  color: #ffd700;
  margin-bottom: 25px;
  font-size: 1.3rem;
}

.converter-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-item label {
  color: #ccc;
  font-size: 0.9rem;
}

.form-item input[type="text"] {
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
}

.form-item input[type="text"]:focus {
  outline: none;
  border-color: #ffd700;
}

.difficulty-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px;
  background: #2a2a2a;
  border-radius: 8px;
  transition: all 0.2s;
}

.radio-label:has(input:checked) {
  background: #ffd700;
  color: #000;
}

.radio-label input {
  display: none;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  accent-color: #ffd700;
}

.convert-btn {
  padding: 15px;
  background: #ffd700;
  border: none;
  border-radius: 10px;
  color: #000;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}

.convert-btn:hover:not(:disabled) {
  background: #ffec8b;
}

.convert-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.converter-result {
  text-align: center;
}

.success-message {
  color: #4ade80;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 30px;
}

.result-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.action-btn {
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.download-btn {
  background: #4a9eff;
  color: #fff;
}

.download-btn:hover {
  background: #3a8eef;
}

.import-btn {
  background: #ffd700;
  color: #000;
}

.import-btn:hover {
  background: #ffec8b;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 30px;
  height: 30px;
  background: #333;
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #ff4444;
}

.music-input-row {
  display: flex;
  gap: 10px;
}

.music-url-input {
  flex: 1;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
}

.music-url-input:focus {
  outline: none;
  border-color: #ffd700;
}

.uploaded-indicator {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #2a4a2a;
  border: 1px solid #4a8a4a;
  border-radius: 8px;
  color: #4ade80;
  font-size: 1rem;
}

.upload-music-btn {
  width: 44px;
  height: 44px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #ffd700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.upload-music-btn:hover {
  background: #ffd700;
  color: #000;
  border-color: #ffd700;
}

.input-hint {
  color: #666;
  font-size: 0.8rem;
}
</style>
