// Works out an uploaded file's real image type from its first bytes, rather than trusting
// the type the browser claims. Returns 'image/jpeg', 'image/png', 'image/webp', or null for anything else.
export function detectImageType(buffer) {
    if (!buffer || buffer.length < 12) {
        return null;
    }
    // JPEG files start with FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    // PNG files start with 89 50 4E 47 ("\x89PNG")
    if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
        return 'image/png';
    }
    // WebP files start with "RIFF", then 4 size bytes, then "WEBP"
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
}
