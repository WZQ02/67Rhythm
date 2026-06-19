<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const router = useRouter()

const goToList = () => {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
  }
  router.push('/list')
}

</script>

<template>
  <div class="container">
    <h1 class="title">67Rhythm</h1>
    <a class="start-link" @click.prevent="goToList">{{ t('home.play') }}</a>
  </div>
</template>

<style scoped>
.container {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.title {
  color: #fff;
  font-size: 4rem;
  font-weight: bold;
  margin-bottom: 2rem;
}

.start-link {
  color: #fff;
  font-size: 1.5rem;
  text-decoration: underline;
  cursor: pointer;
}

.start-link:hover {
  opacity: 0.8;
}
</style>