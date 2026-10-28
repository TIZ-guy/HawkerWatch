// OneMap (Singapore Land Authority) search. Turns a postal code, address or place name into coordinates.
// The browser asks our backend (GET /api/geocode), and only the backend talks to OneMap.
// OneMap's search API needs no token. https://www.onemap.gov.sg/apidocs/
import axios from 'axios';

const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';
const MAX_RESULTS = 5;

// searchAddress("289876") -> [{ name, address, postalCode, lat, lng }], best match first (at most 5).
export async function searchAddress(searchText) {
    let response;
    try {
        // Axios builds the query string (and encodes searchText) from params.
        response = await axios.get(ONEMAP_SEARCH_URL, {
            params: { searchVal: searchText, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 },
            timeout: 10000
        });
    } catch (error) {
        throw new Error(`OneMap request failed (${error.response?.status || error.message})`);
    }

    const results = [];
    for (const place of response.data?.results || []) {
        const lat = Number(place.LATITUDE);
        const lng = Number(place.LONGITUDE);
        if (isNaN(lat) || isNaN(lng)) {
            continue;
        }
        results.push({
            name: place.SEARCHVAL,
            address: place.ADDRESS,
            // OneMap writes "NIL" when a place has no postal code
            postalCode: /^\d{6}$/.test(place.POSTAL) ? place.POSTAL : null,
            lat: lat,
            lng: lng
        });
        if (results.length === MAX_RESULTS) {
            break;
        }
    }
    return results;
}
