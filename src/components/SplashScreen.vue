<script setup lang="ts">
const letters = 'TCGC'.split('')
</script>

<template>
  <div class="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white">
    <div class="splash-logo-wrap">
      <img
        src="/logo.png"
        alt="Tangub City Global College"
        class="splash-logo h-24 w-24 object-contain sm:h-28 sm:w-28"
      />
    </div>

    <div class="splash-word mt-8 flex gap-2 text-5xl font-bold text-[#20673A] sm:text-6xl">
      <span
        v-for="(letter, index) in letters"
        :key="index"
        class="splash-letter"
        :style="{ animationDelay: `${0.55 + index * 0.18}s` }"
      >
        {{ letter }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.splash-logo-wrap {
  animation: logo-pulse 2s ease-in-out 0.9s infinite;
}

.splash-logo {
  animation: logo-in 0.7s ease-out both;
}

.splash-word {
  animation: word-glow 1.8s ease-in-out 1.6s infinite;
}

.splash-letter {
  display: inline-block;
  opacity: 0;
  animation: letter-in 0.5s ease-out forwards;
}

@keyframes logo-in {
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes logo-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

@keyframes letter-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes word-glow {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
