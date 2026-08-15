<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const cards = [
  { type: 'ssc', label: 'SSC', color: 'from-primary-700 to-primary-900', badge: 'bg-primary-50 text-primary-700' },
  { type: 'isc', label: 'ISC', color: 'from-blue-700 to-blue-900', badge: 'bg-blue-50 text-blue-700' },
  { type: 'sro', label: 'SRO', color: 'from-amber-600 to-amber-800', badge: 'bg-amber-50 text-amber-700' },
]

function goToOrg(type: string) {
  router.push({ name: 'events-org', params: { type } })
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-gray-900">My Organizations</h2>

    <div class="space-y-3">
      <button
        v-for="card in cards"
        :key="card.type"
        @click="goToOrg(card.type)"
        class="w-full bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer hover:shadow-md transition-shadow text-left"
      >
        <div class="flex items-center">
          <div class="w-16 h-16 flex items-center justify-center shrink-0 bg-gradient-to-br" :class="card.color">
            <span class="text-white text-xl font-extrabold">{{ card.label }}</span>
          </div>
          <div class="px-4 py-3 flex items-center justify-between flex-1">
            <div>
              <p class="font-semibold text-gray-900 text-[15px]">{{ card.type === 'ssc' ? 'Supreme Student Council' : card.type === 'isc' ? 'Institute Student Council' : 'Student Organization' }}</p>
              <span class="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full" :class="card.badge">{{ card.label }}</span>
            </div>
            <svg class="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
