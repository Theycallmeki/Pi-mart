<template>
  <div class="p-4">

    <Toast position="top-center" />

    <Card>
      <template #title>
        Total/Overall Gross Sales Overview
      </template>

      <template #content>

        <div class="grid mb-5 align-items-stretch">
          <div class="col-12 md:col-4 flex flex-column gap-2">
            <label>Start Date</label>
            <Calendar v-model="startDate" showIcon class="w-full h-3rem" />
          </div>

          <div class="col-12 md:col-4 flex flex-column gap-2">
            <label>End Date</label>
            <Calendar v-model="endDate" showIcon class="w-full h-3rem" />
          </div>

          <div class="col-12 md:col-4 flex align-items-end">
            <Button
              label="Load Sales"
              icon="pi pi-search"
              class="w-full h-3rem"
              :loading="loading"
              @click="loadSales"
            />
          </div>
        </div>

        <div class="grid mb-5">
          <div class="col-12 md:col-4">
            <Card>
              <template #content>
                <div class="text-xl font-bold">Total Gross Sales</div>
                <div class="text-3xl mt-3">
                  {{ peso(totalGross) }}
                </div>
              </template>
            </Card>
          </div>

          <div class="col-12 md:col-4">
            <Card>
              <template #content>
                <div class="text-xl font-bold">Transactions</div>
                <div class="text-3xl mt-3">
                  {{ rows.length }}
                </div>
              </template>
            </Card>
          </div>

          <div class="col-12 md:col-4">
            <Card>
              <template #content>
                <div class="text-xl font-bold">Average Sale</div>
                <div class="text-3xl mt-3">
                  {{ peso(avgSale) }}
                </div>
              </template>
            </Card>
          </div>
        </div>

        <DataTable
          :value="rows"
          paginator
          :rows="10"
          stripedRows
          responsiveLayout="scroll"
          :loading="loading"
        >
          <Column field="date" header="Date" />
          <Column field="transaction_id" header="Transaction ID" />
          <Column field="items_count" header="Items" />

          <Column header="Gross Amount">
            <template #body="slotProps">
              {{ peso(slotProps.data.gross) }}
            </template>
          </Column>

          <Column header="Items Sold">
            <template #body="slotProps">
              <ul class="items-list">
                <li v-for="i in slotProps.data.items" :key="i.item_id">
                  {{ i.item_name }}
                  ({{ i.category }})
                  — x{{ i.quantity }}
                  — ₱{{ i.price_at_sale }}
                </li>
              </ul>
            </template>
          </Column>

        </DataTable>

      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed } from "vue"
import api from "../services/api"

import Card from "primevue/card"
import Button from "primevue/button"
import Calendar from "primevue/calendar"
import DataTable from "primevue/datatable"
import Column from "primevue/column"
import Toast from "primevue/toast"
import { useToast } from "primevue/usetoast"

const toast = useToast()

const startDate = ref(null)
const endDate = ref(null)
const rows = ref([])
const loading = ref(false)

const totalGross = computed(() =>
  rows.value.reduce((s, r) => s + r.gross, 0)
)

const avgSale = computed(() =>
  rows.value.length ? totalGross.value / rows.value.length : 0
)

function peso(v) {
  return `₱${Number(v || 0).toFixed(2)}`
}

function toLocalYMD(d) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const day = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function inRange(dateStr) {
  if (!startDate.value && !endDate.value) return true

  const tx = toLocalYMD(dateStr)
  const start = startDate.value ? toLocalYMD(startDate.value) : null
  const end = endDate.value ? toLocalYMD(endDate.value) : null

  if (start && tx < start) return false
  if (end && tx > end) return false

  return true
}

async function loadSales() {
  loading.value = true

  try {
    const res = await api.get("/sales")

    rows.value = res.data
      .filter(t => inRange(t.date))
      .map(t => {
        let gross = 0
        let itemsCount = 0

        for (const i of t.items) {
          gross += i.quantity * i.price_at_sale
          itemsCount += i.quantity
        }

        return {
          transaction_id: t.transaction_id,
          date: new Date(t.date).toLocaleString(),
          gross,
          items_count: itemsCount,
          items: t.items
        }
      })

    toast.add({
      severity: "success",
      summary: "Loaded",
      detail: "Sales computed from transactions",
      life: 2500
    })

  } catch (err) {
    console.error(err)

    toast.add({
      severity: "error",
      summary: "Load Failed",
      detail: "Could not load sales",
      life: 3000
    })
  }

  loading.value = false
}
</script>

<style scoped>
.text-3xl {
  font-size: 1.75rem;
  font-weight: bold;
}

.items-list {
  margin: 0;
  padding-left: 16px;
  font-size: 0.9rem;
}
</style>