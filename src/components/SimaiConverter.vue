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
  
  // 生成完整谱面
  convertedChart.value = generate67Chart(
    metaData.value,
    convertedContent,
    diffName,
    musicUrl.value || '',
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
  emit('import', convertedChart.value)
  close()
}

// 关闭
const close = () => {
  converted.value = false
  convertedChart.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="show" class="converter-overlay" @click.self="close">
    <div class="converter-modal">
      <h2 class="modal-title">simai 谱面转换器</h2>
      
      <!-- 转换前表单 -->
      <div v-if="!converted" class="converter-form">
        <!-- 音频 URL -->
        <div class="form-item">
          <label>音频 URL 地址</label>
          <input 
            type="text" 
            v-model="musicUrl" 
            placeholder="https://example.com/music.mp3"
          />
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
          :disabled="!musicUrl"
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
</style>
