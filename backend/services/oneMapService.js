// OneMap (Singapore Land Authority) service. Only the backend talks to OneMap,
// so the token stays on the server and Vue never calls OneMap directly.
//
// Status: stub. Nothing calls it yet. Before using it, put ONEMAP_TOKEN in backend/.env
// and check the response shape against https://www.onemap.gov.sg/apidocs/

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

// searchAddress("123456") -> [{ address, postalCode, lat, lng }]
export async function searchAddress(searchText) {
    const token = process.env.ONEMAP_TOKEN;

    if (!token) {
        throw new Error('ONEMAP_TOKEN is not set in backend/.env');
    }

    const url = `${ONEMAP_SEARCH_URL}?searchVal=${encodeURIComponent(searchText)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const response = await fetch(url, { headers: { Authorization: token } });

    if (!response.ok) {
        throw new Error(`OneMap request failed (${response.status})`);
    }

    const data = await response.json();

    return data.results.map(place => ({
        address: place.ADDRESS,
        postalCode: place.POSTAL,
        lat: Number(place.LATITUDE),
        lng: Number(place.LONGITUDE)
    }));
}
