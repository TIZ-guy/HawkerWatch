import { searchAddress } from '../services/oneMapService.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.


// ============================================================
// GET /api/geocode?q=289876
// Finds a postal code, address or place in Singapore with OneMap.
// Returns up to 5 places: [{ name, address, postalCode, lat, lng }], best match first.
// The home page and Explore Map use this to find hawker centres near a postal code.
// ============================================================

export const geocode = async (req, res, next) => {
    try {
        const text = typeof req.query.q === 'string' ? req.query.q.trim() : '';

        if (text.length < 2 || text.length > 60) {
            res.status(400).json({ success: false, message: 'Enter a postal code or place name (2 to 60 characters).' });
            return;
        }

        let places;
        try {
            places = await searchAddress(text);
        } catch (error) {
            res.status(502).json({ success: false, message: "Location search isn't available right now. Please try again." });
            return;
        }

        res.status(200).json({ success: true, data: places });
    } catch (error) {
        next(error);
    }
};
