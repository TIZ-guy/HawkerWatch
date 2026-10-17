// Shrinks a photo in the browser before uploading, so uploads are quick and small (usually 100-300 KB).
// Phone photos are often 3-10 MB; this redraws the photo on a canvas at most 1280 pixels wide or tall
// and saves it as a JPEG. Returns a Blob, which can be uploaded like a File.
const MAX_SIZE = 1280
const QUALITY = 0.8

export function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_SIZE / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Couldn't read that photo. Try a different one."))
      }, 'image/jpeg', QUALITY)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Couldn't read that photo. Try a JPEG or PNG."))
    }

    image.src = url
  })
}
