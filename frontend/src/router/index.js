import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import HawkerCentreView from '../views/HawkerCentreView.vue'
import { useAuthStore } from '../stores/useAuthStore.js'

// meta.guestOnly: logged-in users are sent home (login, register).
// meta.requiresAuth: logged-out users are sent to /login and returned afterwards.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/hawker-centres/:id', component: HawkerCentreView },
    { path: '/map', component: HomeView },
    { path: '/favourites', component: HomeView },
    { path: '/profile', component: HomeView },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/:pathMatch(.*)*', component: HomeView }
  ],
  // Back/forward returns to where the user was; new pages start at the top.
  // Pages handle #hash links themselves, because their content loads after navigation.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition || { top: 0 }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.loadCurrentUser()

  if (to.meta.requiresAuth && !auth.state.user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && auth.state.user) return { path: '/' }
})

export default router
