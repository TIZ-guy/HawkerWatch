// Calls the real GET /api/geocode route over HTTP. OneMap is replaced with a fake answer
// (copied from a real OneMap response), so these tests run without internet.
import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { startServer } from './startServer.js';

const ONEMAP_ADAM_ROAD = {
    found: 1,
    results: [{
        SEARCHVAL: 'ADAM FOOD CENTRE', BLK_NO: '2', ROAD_NAME: 'ADAM ROAD', BUILDING: 'ADAM FOOD CENTRE',
        ADDRESS: '2 ADAM ROAD ADAM FOOD CENTRE SINGAPORE 289876', POSTAL: '289876',
        LATITUDE: '1.324159852595583', LONGITUDE: '103.8141659241357'
    }]
};


test('GET /api/geocode turns a postal code into a place with coordinates', async (t) => {
    const get = t.mock.method(axios, 'get', async () => ({ data: ONEMAP_ADAM_ROAD }));
    const base = await startServer(t);

    const body = await (await fetch(`${base}/api/geocode?q=289876`)).json();

    assert.equal(body.success, true);
    assert.deepEqual(body.data[0], {
        name: 'ADAM FOOD CENTRE',
        address: '2 ADAM ROAD ADAM FOOD CENTRE SINGAPORE 289876',
        postalCode: '289876',
        lat: 1.324159852595583,
        lng: 103.8141659241357
    });
    assert.equal(get.mock.calls[0].arguments[1].params.searchVal, '289876');
});

test('GET /api/geocode keeps at most 5 places and skips ones without coordinates', async (t) => {
    const place = (name, lat) => ({ SEARCHVAL: name, ADDRESS: name, POSTAL: 'NIL', LATITUDE: lat, LONGITUDE: '103.9' });
    t.mock.method(axios, 'get', async () => ({
        data: { results: [place('A', 'x'), place('B', '1.31'), place('C', '1.32'), place('D', '1.33'), place('E', '1.34'), place('F', '1.35'), place('G', '1.36')] }
    }));
    const base = await startServer(t);

    const body = await (await fetch(`${base}/api/geocode?q=bedok`)).json();

    assert.deepEqual(body.data.map((found) => found.name), ['B', 'C', 'D', 'E', 'F']);
    assert.equal(body.data[0].postalCode, null); // "NIL" means no postal code
});

test('GET /api/geocode gives 400 for missing or too-short search text', async (t) => {
    const get = t.mock.method(axios, 'get', async () => ({ data: ONEMAP_ADAM_ROAD }));
    const base = await startServer(t);

    for (const query of ['', '?q=', '?q=a', `?q=${'x'.repeat(61)}`]) {
        const response = await fetch(`${base}/api/geocode${query}`);
        assert.equal(response.status, 400, query);
    }
    assert.equal(get.mock.callCount(), 0);
});

test('GET /api/geocode gives 502 when OneMap cannot be reached', async (t) => {
    t.mock.method(axios, 'get', async () => { throw new Error('getaddrinfo ENOTFOUND www.onemap.gov.sg'); });
    const base = await startServer(t);

    const response = await fetch(`${base}/api/geocode?q=289876`);

    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
});
