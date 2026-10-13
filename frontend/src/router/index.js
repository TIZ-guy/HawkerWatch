import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import HawkerCentreView from '../views/HawkerCentreView.vue'
import FavouritesView from '../views/FavouritesView.vue'
import ProfileView from '../views/ProfileView.vue'
import { useAuthStore } from '../stores/useAuthStore.js'

// meta.guestOnly: logged-in users are sent home (login, register).
// meta.requiresAuth: logged-out users are sent to /login and returned afterwards.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/hawker-centres/:id', component: HawkerCentreView },
    { path: '/map', component: () => import('../views/MapView.vue') },
    { path: '/favourites', component: FavouritesView, meta: { requiresAuth: true } },
    { path: '/profile', component: ProfileView, meta: { requiresAuth: true } },
    { path: '/login', component: LoginView, meta: { guestOnly: true } },
    { path: '/register', component: RegisterView, meta: { guestOnly: true } },
    { path: '/:pathMatch(.*)*', component: HomeView }
  ],
  scrollBehavior: (_to, _from, savedPosition) => savedPosition || { top: 0 }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.loadCurrentUser()

  if (to.meta.requiresAuth && !auth.state.user) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && auth.state.user) return { path: '/' }
})

export default router
