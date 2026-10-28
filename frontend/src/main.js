import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
// Bootstrap's JavaScript, needed for the navbar's ☰ menu button to open on narrow screens
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './style.css'
import App from './App.vue'
import router from './router/index.js'

// Pinia goes in before the router, because the router's login check uses the auth store
createApp(App).use(createPinia()).use(router).mount('#app')
