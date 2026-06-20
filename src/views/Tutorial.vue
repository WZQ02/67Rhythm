<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const router = useRouter()

onMounted(() => {
  // 标记已查看教程
  localStorage.setItem('tutorialViewed', 'true')
})

const goBack = () => {
  router.push('/list')
}
</script>

<template>
  <div class="tutorial-container">
    <div class="header">
      <button class="back-btn" @click="goBack">←</button>
      <h1 class="title">{{ t('tutorial.title') }}</h1>
    </div>
    
    <div class="tutorial-content">
      <img src="https://img.wzq02.top/upl/a69e281116efdddd4a958ddf8ac395b8.jpg" style="height: 25vh"/>
      <h2 class="section-title">{{ t('tutorial.howToPlay') }}</h2>
      
      <div class="tutorial-text">
        {{ t('tutorial.instructions') }}
      </div>
      
      <div class="tutorial-text">
        {{ t('tutorial.keyboardNote') }}
      </div>
    </div>
    
    <div class="footer">
      <button class="got-it-btn" @click="goBack">{{ t('tutorial.gotIt') }}</button>
    </div>
  </div>
</template>

<style scoped>
.tutorial-container {
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

.tutorial-content {
  flex: 1;
  padding: 20px 30px;
  overflow-y: auto;
}

.section-title {
  color: #ffd700;
  font-size: 1.8rem;
  margin-bottom: 25px;
}

.tutorial-text {
  color: #ccc;
  font-size: 1.25rem;
  line-height: 1.7;
  margin-bottom: 20px;
}

.footer {
  padding: 20px;
}

.got-it-btn {
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

.got-it-btn:hover {
  background: #ffec8b;
}
</style>
