import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useNow(intervalMs = 1000) {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null

  function refresh() {
    now.value = new Date()
  }

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
  })

  return { now }
}
