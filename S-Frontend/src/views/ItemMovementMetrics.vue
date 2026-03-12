<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import api from "../services/api"   

const router = useRouter()

const loading = ref(true)

const rows = ref([])
const global = ref({})

/* 🔙 GO BACK */
const goBack = () => {
  router.back()
}

/* ---------------- PARSE CATEGORY ---------------- */
const parseCategory = (metrics) => {
  return Object.keys(metrics).map(cat => ({
    category: cat,
    accuracy: metrics[cat].accuracy,
    macro_f1: metrics[cat].macro_f1,
    movement_mae: metrics[cat].movement_mae,
    total_items: metrics[cat].total_items
  }))
}

/* ---------------- LOAD DATA ---------------- */
const load = async () => {
  try {
    const res = await api.get("/metrics/item-movement") // ✅ USING API.JS

    if (res.data.success) {
      rows.value = parseCategory(res.data.metrics)
      global.value = res.data.global_metrics
    }
  } catch (err) {
    console.error("Item movement metrics error:", err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="metrics-page">

    <!-- 🔙 GO BACK BUTTON -->
    <button class="back-btn" @click="goBack">
      ← Go Back
    </button>

    <h2 class="title">Item Movement AI Metrics</h2>

    <div v-if="loading" class="loading">
      Loading model metrics...
    </div>

    <div v-else>

      <!-- 🔥 GLOBAL KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span>Accuracy</span>
          <h3>{{ global.accuracy }}</h3>
        </div>

        <div class="kpi-card">
          <span>Macro F1</span>
          <h3>{{ global.macro_f1 }}</h3>
        </div>

        <div class="kpi-card">
          <span>Movement MAE</span>
          <h3>{{ global.movement_mae }}</h3>
        </div>

        <div class="kpi-card">
          <span>Total Items</span>
          <h3>{{ global.total_items }}</h3>
        </div>
      </div>

      <!-- 📊 CATEGORY TABLE -->
      <div class="table-wrapper">
        <h3>Category Performance</h3>

        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Accuracy</th>
              <th>Macro F1</th>
              <th>Movement MAE</th>
              <th>Total Items</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="r in rows" :key="r.category">
              <td>{{ r.category }}</td>

              <td :class="r.accuracy >= 0.9 ? 'good' : 'warn'">
                {{ r.accuracy }}
              </td>

              <td :class="r.macro_f1 >= 0.8 ? 'good' : 'warn'">
                {{ r.macro_f1 }}
              </td>

              <td>{{ r.movement_mae }}</td>
              <td>{{ r.total_items }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<style scoped>
.metrics-page {
  padding: 20px;
  color: #fff;
}

.title {
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* 🔙 BACK BUTTON */
.back-btn {
  margin-bottom: 12px;
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: #1f2937;
  color: #fff;
  cursor: pointer;
}

.back-btn:hover {
  background: #374151;
}

/* 🔥 KPI GRID */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  background: #111827;
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
}

.kpi-card span {
  font-size: 0.9rem;
  color: #9ca3af;
}

.kpi-card h3 {
  margin-top: 6px;
  font-size: 1.6rem;
}

/* 📊 TABLE */
.table-wrapper {
  background: #0f172a;
  border-radius: 10px;
  padding: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 10px;
  background: #020617;
}

td {
  padding: 10px;
  border-bottom: 1px solid #1f2937;
}

.good {
  color: #22c55e;
  font-weight: bold;
}

.warn {
  color: #f59e0b;
  font-weight: bold;
}

.loading {
  margin-top: 40px;
}
</style>