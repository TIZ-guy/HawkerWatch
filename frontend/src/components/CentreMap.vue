<script setup>
// A small OneMap map with a pin on one hawker centre. Used on the centre page.
// Usage: <CentreMap :centre="centre" />  (centre.location is a GeoJSON point: [longitude, latitude])
import { onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ONEMAP_ATTRIBUTION, ONEMAP_TILES } from '../utils/onemap.js'

const props = defineProps({
  centre: { type: Object, required: true }
})

const mapElement = ref(null)
let map = null // kept outside Vue's reactivity; Vue doesn't need to track Leaflet objects

onMounted(() => {
  const [lng, lat] = props.centre.location.coordinates

  map = L.map(mapElement.value, {
    center: [lat, lng],
    zoom: 17,
    minZoom: 11,
    maxZoom: 19,
    scrollWheelZoom: false // so scrolling down the page doesn't zoom the map by accident
  })
  L.tileLayer(ONEMAP_TILES, { minZoom: 11, maxZoom: 19, detectRetina: true, attribution: ONEMAP_ATTRIBUTION }).addTo(map)

  L.circleMarker([lat, lng], { radius: 10, weight: 3, color: '#ffffff', fillColor: '#a32f26', fillOpacity: 1 })
    .bindTooltip(props.centre.name, { permanent: true, direction: 'top', offset: [0, -10] })
    .addTo(map)
})

onBeforeUnmount(() => {
  map?.remove()
})
</script>

<template>
  <div ref="mapElement" class="centre-map rounded" role="region" :aria-label="`Map showing where ${centre.name} is`"></div>
</template>

<style scoped>
.centre-map {
  height: 300px;
  z-index: 0; /* keeps Leaflet's panes below the sticky navbar */
}
</style>
