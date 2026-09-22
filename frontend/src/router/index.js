import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: App },
    { path: '/map', component: App },
    { path: '/favourites', component: App },
    { path: '/profile', component: App },
    { path: '/:pathMatch(.*)*', component: App }
  ]
})

export default router
