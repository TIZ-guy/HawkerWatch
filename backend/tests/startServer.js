// Starts the real app on a free port for a test, and closes it when the test ends.
// Returns the base URL, e.g. "http://127.0.0.1:52344".
//
// fetch() refuses a few "bad ports" (6000, 10080, ...) for safety. Some computers hand out
// ports from 1024 upwards, so a random port can land on one of them and the test fails with
// "bad port". If that happens the server is closed and started again on another port.
import app from '../app.js';

// The ports above 1023 that fetch refuses (from the Fetch standard's "bad port" list)
const FETCH_BAD_PORTS = new Set([1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

function listen() {
    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

export async function startServer(t) {
    let server = await listen();
    while (FETCH_BAD_PORTS.has(server.address().port)) {
        await new Promise((resolve) => server.close(resolve));
        server = await listen();
    }
    t.after(() => server.close());
    return `http://127.0.0.1:${server.address().port}`;
}
