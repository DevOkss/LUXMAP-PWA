import { createRouter, createWebHistory } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import FullPageLayout from '@/layouts/FullPageLayout.vue'
import ScanLayout from '@/layouts/ScanLayout.vue'
import { useSecurityStore } from '@/stores/securityStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/auth',
      component: AuthLayout,
      children: [
        {
          path: 'login',
          name: 'login',
          component: () => import('@/pages/auth/Login.vue'),
          meta: { guest: true },
        },
        {
          path: 'onboarding',
          name: 'onboarding',
          component: () => import('@/pages/auth/Onboarding.vue'),
          meta: { requiresAuth: true },
        },
      ],
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/Index.vue'),
        },
        {
          path: 'attendance/history',
          name: 'attendance-history',
          component: () => import('@/pages/attendance/History.vue'),
        },
      ],
    },
    {
      path: '/',
      component: FullPageLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'events',
          name: 'events',
          component: () => import('@/pages/events/OrgIndex.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'events/:type',
          name: 'events-org',
          component: () => import('@/pages/events/OrgEvents.vue'),
          meta: { back: 'Events', backRoute: 'events' },
        },
        {
          path: 'events/:type/:eventId',
          name: 'events-show',
          component: () => import('@/pages/events/StudentShow.vue'),
          meta: { back: 'Event Details' },
        },
        {
          path: 'attendance',
          name: 'attendance',
          component: () => import('@/pages/attendance/StudentIndex.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'fees',
          name: 'fees',
          component: () => import('@/pages/fees/Index.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'payments/create',
          name: 'payments-create',
          component: () => import('@/pages/payments/Create.vue'),
          meta: { back: 'Fees', backRoute: 'fees' },
        },
        {
          path: 'payments/history',
          name: 'payments-history',
          component: () => import('@/pages/payments/History.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'payments/submissions',
          name: 'payments-submissions',
          component: () => import('@/pages/payments/Submissions.vue'),
          meta: { back: 'Fees', backRoute: 'fees' },
        },
        {
          path: 'receipts',
          name: 'receipts',
          component: () => import('@/pages/receipts/Index.vue'),
          meta: { back: 'Payments', backRoute: 'payments-history' },
        },
        {
          path: 'receipts/:id',
          name: 'receipts-show',
          component: () => import('@/pages/receipts/Show.vue'),
          meta: { back: 'Receipts', backRoute: 'receipts' },
        },
        {
          path: 'attendance/:orgId',
          name: 'attendance-org',
          component: () => import('@/pages/attendance/OrgDetail.vue'),
          meta: { back: 'Attendance', backRoute: 'attendance' },
        },
        {
          path: 'attendance/queue',
          name: 'attendance-queue',
          component: () => import('@/pages/attendance/Queue.vue'),
          meta: { back: 'Attendance', backRoute: 'attendance' },
        },
        {
          path: 'announcements',
          name: 'announcements',
          component: () => import('@/pages/announcements/Index.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/pages/notifications/Index.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/pages/profile/Index.vue'),
          meta: { back: 'Dashboard', backRoute: 'dashboard' },
        },
        {
          path: 'shift',
          name: 'shift-request',
          component: () => import('@/pages/shift/Request.vue'),
          meta: { back: 'Profile', backRoute: 'profile' },
        },
        {
          path: 'security',
          name: 'security',
          component: () => import('@/pages/security/Index.vue'),
          meta: { back: 'Profile', backRoute: 'profile', securityFlow: true },
        },
        {
          path: 'security/setup',
          name: 'security-setup',
          component: () => import('@/pages/security/Setup.vue'),
          meta: { back: 'Security', backRoute: 'security', securityFlow: true },
        },
        {
          path: 'security/face-enroll',
          name: 'security-face-enroll',
          component: () => import('@/pages/security/FaceEnroll.vue'),
          meta: { back: 'Security', backRoute: 'security', securityFlow: true },
        },
        {
          path: 'security/transfer',
          name: 'security-transfer',
          component: () => import('@/pages/security/Transfer.vue'),
          meta: { back: 'Security', backRoute: 'security', securityFlow: true },
        },
        {
          path: 'security/verify',
          name: 'security-verify',
          component: () => import('@/pages/security/Verify.vue'),
          meta: { securityFlow: true },
        },
      ],
    },
    {
      path: '/',
      component: ScanLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'scanner',
          name: 'scanner',
          component: () => import('@/pages/attendance/Scanner.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

function getStoredUser(): { id?: number; needs_onboarding?: boolean } | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

const REQUIRED_STEP: Record<string, string> = {
  setup: 'security-setup',
  'enroll-face': 'security-face-enroll',
  transfer: 'security-transfer',
  'offline-blocked': 'security-setup',
}

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('auth_token')
  const user = getStoredUser()

  if (!token) {
    if (to.meta.requiresAuth) {
      next({ name: 'login' })
    } else {
      next()
    }
    return
  }

  const needsOnboarding = user?.needs_onboarding !== false

  if (to.name === 'login') {
    next({ name: needsOnboarding ? 'onboarding' : 'dashboard' })
    return
  }

  if (to.name === 'onboarding') {
    if (needsOnboarding) {
      next()
    } else {
      next({ name: 'dashboard' })
    }
    return
  }

  if (to.meta.requiresAuth && needsOnboarding) {
    next({ name: 'onboarding' })
    return
  }

  // Enforce the security gate on every protected route. Security-flow pages
  // are always reachable (they are the gate itself); everything else redirects
  // to the step the student still needs to complete.
  if (to.meta.requiresAuth && !to.meta.securityFlow && user?.id) {
    const security = useSecurityStore()
    const info = await security.resolve(user.id)
    if (info.decision !== 'proceed') {
      const step = REQUIRED_STEP[info.decision] ?? 'security-setup'
      if (to.name !== step) {
        next({ name: step })
        return
      }
    } else if (!security.verified) {
      // Face + device are set up, but the student must verify their face on
      // every fresh login before entering the app.
      if (to.name !== 'security-verify') {
        next({ name: 'security-verify' })
        return
      }
    }
  }

  next()
})

export default router
