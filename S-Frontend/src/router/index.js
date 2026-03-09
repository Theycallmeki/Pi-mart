import { createRouter, createWebHistory } from "vue-router"
import api from "../services/api"

import Login from "../views/Login.vue"
import Home from "../views/Home.vue"
import Inventory from "../views/Inventory.vue"
import POS from "../views/POS.vue"
import Payment from "../views/Payment.vue"
import TransactionHistory from "../views/TransactionHistory.vue"

import DemandForecast from "../views/DemandForecast.vue"
import ItemMovement from "../views/ItemMovement.vue"
import StockoutRisk from "../views/StockoutRisk.vue"
import Recommendations from "../views/Recommendations.vue"
import WalletTopUp from "../views/WalletTopUp.vue"
import GrossSales from "../views/GrossSales.vue"


import ForecastMetrics from "../views/ForecastMetrics.vue"
import StockoutRiskMetrics from "../views/StockoutRiskMetrics.vue"
import ItemMovementMetrics from "../views/ItemMovementMetrics.vue"



const routes = [
  { path: "/login", component: Login, meta: { public: true } },

  { path: "/", component: Home },
  { path: "/inventory", component: Inventory },
  { path: "/pos", component: POS },
  { path: "/payment", component: Payment },
  { path: "/transactions", component: TransactionHistory },
  { path: "/wallet/top-up", component: WalletTopUp },

 
  { path: "/analytics/demand", component: DemandForecast },
  { path: "/analytics/movement", component: ItemMovement },
  { path: "/analytics/stockout", component: StockoutRisk },
  { path: "/analytics/recommendations", component: Recommendations },
  { path: "/analytics/gross-sales", component: GrossSales },

  /* ✅ NEW METRICS ROUTES */
  { path: "/analytics/forecast-metrics", component: ForecastMetrics },
  { path: "/analytics/stockout-metrics", component: StockoutRiskMetrics },
  { path: "/analytics/movement-metrics", component: ItemMovementMetrics }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/* ---------------- AUTH GUARD ---------------- */

// 🔒 in-memory auth cache (safe + fast)
let isAuthenticated = false
let authChecked = false

router.beforeEach(async (to, from, next) => {
  if (to.meta.public) {
    return next()
  }

  if (authChecked && isAuthenticated) {
    return next()
  }

  try {
    // 🔥 MUST USE LEADING SLASH
    await api.get("/users/me")

    isAuthenticated = true
    authChecked = true
    next()
  } catch (err) {
    console.error("Auth guard failed:", err)

    isAuthenticated = false
    authChecked = true
    next("/login")
  }
})

export default router