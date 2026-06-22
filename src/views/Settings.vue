<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const router = useRouter()

// 从 localStorage 加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('gameSettings')
  if (saved) {
    return JSON.parse(saved)
  }
  return { audioOffset: 0, gravitySensitivity: 7, playCorrectSound: false }
}

const settings = ref(loadSettings())

// 保存设置
const saveSettings = () => {
  localStorage.setItem('gameSettings', JSON.stringify(settings.value))
  router.push('/list')
}

// 返回列表
const goBack = () => {
  router.push('/list')
}
</script>

<template>
  <div class="settings-container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <h1 class="title">{{ t('settings.title') }}</h1>
    </div>
    
    <div class="settings-content">
      <!-- 音押延迟 -->
      <div class="setting-item">
        <div class="setting-label">
          <span class="label-text">{{ t('settings.audioOffset') }}</span>
          <span class="label-value">{{ settings.audioOffset > 0 ? '+' : '' }}{{ settings.audioOffset }}ms</span>
        </div>
        <div class="slider-container">
          <input 
            type="range" 
            min="-500" 
            max="500" 
            step="10"
            v-model.number="settings.audioOffset"
            class="slider"
          />
          <div class="slider-marks">
            <span>-500ms</span>
            <span>0</span>
            <span>+500ms</span>
          </div>
        </div>
        <div class="setting-hint">{{ t('settings.audioOffsetHint') }}</div>
      </div>
      
      <!-- 重力传感灵敏度 -->
      <div class="setting-item">
        <div class="setting-label">
          <span class="label-text">{{ t('settings.gravitySensitivity') }}</span>
          <span class="label-value">{{ settings.gravitySensitivity }}</span>
        </div>
        <div class="slider-container">
          <input 
            type="range" 
            min="1" 
            max="15" 
            step="1"
            v-model.number="settings.gravitySensitivity"
            class="slider"
          />
          <div class="slider-marks">
            <span>1</span>
            <span>8</span>
            <span>15</span>
          </div>
        </div>
        <div class="setting-hint">{{ t('settings.gravityHint') }}</div>
      </div>
      
      <!-- 播放正解音效 -->
      <div class="setting-item checkbox-item">
        <div class="checkbox-label">
          <span class="label-text">播放正解音</span>
          <label class="checkbox-wrapper">
            <input 
              type="checkbox" 
              v-model="settings.playCorrectSound"
              class="checkbox"
            />
            <span class="checkbox-checkmark"></span>
          </label>
        </div>
        <div class="setting-hint">勾选后，音符到达判定线时会播放对应音效</div>
      </div>
    </div>
    
    <div class="footer">
      <button class="ok-btn" @click="saveSettings">{{ t('settings.ok') }}</button>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  width: 100vw;
  height: 100vh;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
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
}

.settings-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.setting-item {
  background: #1a1a1a;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
}

.setting-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.label-text {
  color: #fff;
  font-size: 1.1rem;
}

.label-value {
  color: #ffd700;
  font-size: 1.2rem;
  font-weight: bold;
}

.slider-container {
  padding: 0 10px;
}

.slider {
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 4px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  background: #ffd700;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  background: #ffec8b;
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  background: #ffd700;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: #666;
  font-size: 0.8rem;
}

.setting-hint {
  color: #666;
  font-size: 0.85rem;
  margin-top: 10px;
  text-align: center;
}

.checkbox-item {
  padding: 15px 20px;
}

.checkbox-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checkbox-wrapper {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 30px;
  cursor: pointer;
}

.checkbox-wrapper .checkbox {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.checkbox-checkmark {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #333;
  border-radius: 15px;
  transition: background-color 0.3s ease;
}

.checkbox-checkmark::before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background-color: #666;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.checkbox:checked + .checkbox-checkmark {
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
}

.checkbox:checked + .checkbox-checkmark::before {
  transform: translateX(20px);
  background-color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.footer {
  padding: 20px;
}

.ok-btn {
  width: 100%;
  padding: 15px;
  background: #ffd700;
  border: none;
  border-radius: 10px;
  color: #000;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.ok-btn:hover {
  background: #ffec8b;
}
</style>
