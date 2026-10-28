// OneMap (Singapore Land Authority) map settings, shared by Explore Map and the map on each centre page.
// The map images come from OneMap's public tile service, which needs no token.

export const ONEMAP_TILES = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'

// Attribution as OneMap's terms of use ask for it
export const ONEMAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;" alt="" />' +
  '&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>' +
  '&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'

export const SINGAPORE_CENTRE = [1.3521, 103.8198]
