<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const router = useRouter()
const route = useRoute()

const result = ref({
  title: '',
  artist: '',
  level: '',
  accuracy: 0,
  grade: '',
  great: 0,
  good: 0,
  miss: 0,
  fast: 0,
  late: 0
})

const getGrade = (accuracy) => {
  if (accuracy >= 100) return 'SS'
  if (accuracy >= 97) return 'S+'
  if (accuracy >= 91) return 'S'
  if (accuracy >= 78) return 'A'
  if (accuracy >= 67) return 'B'
  if (accuracy >= 50) return 'C'
  return 'D'
}

const goHome = () => {
  router.push('/list')
}

onMounted(() => {
  result.value = {
    title: route.query.title || 'Unknown',
    artist: route.query.artist || 'Unknown',
    level: route.query.level || 'Unknown',
    accuracy: parseFloat(route.query.accuracy) || 0,
    great: parseInt(route.query.great) || 0,
    good: parseInt(route.query.good) || 0,
    miss: parseInt(route.query.miss) || 0,
    fast: parseInt(route.query.fast) || 0,
    late: parseInt(route.query.late) || 0
  }
  result.value.grade = getGrade(result.value.accuracy)
  
  // 保存最高记录到 localStorage
  const chartId = route.query.chartId
  if (chartId) {
    const highScores = JSON.parse(localStorage.getItem('highScores') || '{}')
    const currentScore = {
      accuracy: result.value.accuracy,
      grade: result.value.grade
    }
    
    // 如果没有记录或当前分数更高，则更新
    if (!highScores[chartId] || result.value.accuracy > highScores[chartId].accuracy) {
      highScores[chartId] = currentScore
      localStorage.setItem('highScores', JSON.stringify(highScores))
    }
  }
})
</script>

<template>
  <div class="result-container">
    <div class="result-card">
      <div class="header">
        <h1 class="title">{{ result.title }}</h1>
        <p class="artist">{{ result.artist }}</p>
        <span class="level">{{ result.level }}</span>
      </div>

      <div class="score-section">
        <div class="accuracy">{{ result.accuracy }}%</div>
        <div class="grade" :class="result.grade">{{ result.grade }}</div>
      </div>

      <div class="stats">
        <div class="stat-item great">
          <span class="label">GREAT</span>
          <span class="value">{{ result.great }}</span>
        </div>
        <div class="stat-item good">
          <span class="label">GOOD</span>
          <span class="value">{{ result.good }}</span>
        </div>
        <div class="stat-item miss">
          <span class="label">MISS</span>
          <span class="value">{{ result.miss }}</span>
        </div>
      </div>
      
      <div class="timing-stats">
        <div class="stat-item fast">
          <span class="label">FAST</span>
          <span class="value">{{ result.fast }}</span>
        </div>
        <div class="stat-item late">
          <span class="label">LATE</span>
          <span class="value">{{ result.late }}</span>
        </div>
      </div>

      <button class="replay-btn" @click="goHome">{{ t('result.replay') }}</button>
    </div>
  </div>
</template>

<style scoped>
.result-container {
  width: 100vw;
  height: 100vh;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.result-card {
  background: linear-gradient(145deg, #1a1a1a, #2a2a2a);
  border-radius: 20px;
  padding: 40px;
  min-width: 400px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.header {
  margin-bottom: 30px;
}

.title {
  color: #fff;
  font-size: 2rem;
  margin: 0 0 10px 0;
}

.artist {
  color: #888;
  font-size: 1.2rem;
  margin: 0 0 15px 0;
}

.level {
  display: inline-block;
  background: #333;
  color: #fff;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.score-section {
  margin-bottom: 30px;
}

.accuracy {
  color: #fff;
  font-size: 4rem;
  font-weight: bold;
  margin: 0;
}

.grade {
  display: inline-block;
  font-size: 5rem;
  font-weight: bold;
  margin-top: 10px;
}

.grade.SS { color: #ffd700; }
.grade.S\+ { color: #ffd700; }
.grade.S { color: #ffd700; }
.grade.A { color: #00ff00; }
.grade.B { color: #00bfff; }
.grade.C { color: #ffff00; }
.grade.D { color: #888888; }

.stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
}

.stat-item {
  text-align: center;
}

.stat-item .label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 5px;
}

.stat-item.great .label,
.stat-item.great .value { color: #ffd700; }

.stat-item.good .label,
.stat-item.good .value { color: #00ff00; }

.stat-item.miss .label,
.stat-item.miss .value { color: #888888; }

.stat-item .value {
  font-size: 2rem;
  font-weight: bold;
}

.timing-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
  padding-top: 15px;
  border-top: 1px solid #444;
}

.stat-item.fast .label,
.stat-item.fast .value { color: #4488ff; }

.stat-item.late .label,
.stat-item.late .value { color: #ff4444; }

.replay-btn {
  width: 100%;
  padding: 15px;
  font-size: 1.2rem;
  font-weight: bold;
  background: linear-gradient(145deg, #444, #333);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.replay-btn:hover {
  background: linear-gradient(145deg, #555, #444);
  transform: translateY(-2px);
}

.replay-btn:active {
  transform: translateY(0);
}
</style>