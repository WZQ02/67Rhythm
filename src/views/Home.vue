<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToPlay = () => {
  router.push('/play')
}
</script>

<template>
  <div class="container">
    <h1 class="title">67Rhythm</h1>
    <a class="start-link" @click.prevent="goToPlay">Start</a>
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