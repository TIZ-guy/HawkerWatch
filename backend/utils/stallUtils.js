// Checks for the stall details users send when adding or editing a stall.

export const STALL_NAME_MAX = 60;
export const CUISINE_MAX = 40;

// Case-insensitive exact match, e.g. "ah hock chicken rice" matches "Ah Hock Chicken Rice".
// The replace stops characters like ( or * from being read as part of a pattern.
export function exactly(text) {
    return new RegExp(`^${String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

// "#01-23", "01-23", " 1-23 " -> "01-23"; "02-115A" stays "02-115A". Returns null if it isn't a unit number.
export function normaliseUnitNumber(text) {
    const match = /^#?\s*(\d{1,2})\s*-\s*(\d{1,4}[A-Za-z]?)$/.exec(String(text).trim());
    if (!match) {
        return null;
    }
    return `${match[1].padStart(2, '0')}-${match[2].toUpperCase()}`;
}

// Checks { name, cuisine, unitNumber } from a request body.
// Returns { details } with only the fields that were sent (cleaned up), or { message } if something is wrong.
// With nameRequired false (editing), a missing name is fine but an empty one is not.
// An empty cuisine or unit number means "clear it", so it becomes undefined.
export function checkStallDetails(body, { nameRequired }) {
    const details = {};
    const input = body || {};

    for (const field of ['name', 'cuisine', 'unitNumber']) {
        if (field in input && input[field] !== null && typeof input[field] !== 'string') {
            return { message: `${field} must be text.` };
        }
    }

    if ('name' in input || nameRequired) {
        const name = String(input.name || '').trim().replace(/\s+/g, ' ');
        if (name.length < 2) {
            return { message: 'Stall name must be at least 2 characters.' };
        }
        if (name.length > STALL_NAME_MAX) {
            return { message: `Stall name can be at most ${STALL_NAME_MAX} characters.` };
        }
        details.name = name;
    }

    if ('cuisine' in input) {
        const cuisine = String(input.cuisine || '').trim().replace(/\s+/g, ' ');
        if (cuisine.length > CUISINE_MAX) {
            return { message: `Cuisine can be at most ${CUISINE_MAX} characters.` };
        }
        details.cuisine = cuisine || undefined;
    }

    if ('unitNumber' in input) {
        const text = String(input.unitNumber || '').trim();
        if (text) {
            const unitNumber = normaliseUnitNumber(text);
            if (!unitNumber) {
                return { message: 'Unit number should look like 01-23.' };
            }
            details.unitNumber = unitNumber;
        } else {
            details.unitNumber = undefined;
        }
    }

    return { details: details };
}
