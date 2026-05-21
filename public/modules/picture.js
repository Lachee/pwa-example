/**
 * Converts a canvas into a bitmap
 * @param canvas
 * @returns {{data: *[], width: *, height: *}}
 */
export function canvasToBitmap(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const binaryData = [];

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x += 8) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
                const pixelIndex = ((y * canvas.width) + (x + bit)) * 4;
                if (data[pixelIndex] < 128) {
                    byteValue |= (1 << (7 - bit));
                }
            }
            binaryData.push(byteValue);
        }
    }
    return {
        data: binaryData,
        width: canvas.width,
        height: canvas.height
    };
}

/**
 * Dither an image using Floyd-Steinberg error diffusion.
 * Generated with ChatGPT
 * @param canvas
 */
export function dither(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Convert to grayscale
    let grayBuf = new Float32Array(width * height);
    for (let i = 0; i < d.length; i += 4) {
        grayBuf[i / 4] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }

    // Floyd-Steinberg error diffusion
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let idx = y * width + x;
            let oldPixel = grayBuf[idx];
            let newPixel = oldPixel < 128 ? 0 : 255;
            grayBuf[idx] = newPixel;
            let err = oldPixel - newPixel;

            if (x + 1 < width) grayBuf[idx + 1] += err * 7 / 16;
            if (y + 1 < height) {
                if (x > 0) grayBuf[idx + width - 1] += err * 3 / 16;
                grayBuf[idx + width] += err * 5 / 16;
                if (x + 1 < width) grayBuf[idx + width + 1] += err * 1 / 16;
            }
        }
    }

    for (let i = 0; i < grayBuf.length; i++) {
        let val = grayBuf[i];
        let canvasIdx = i * 4;
        d[canvasIdx] = d[canvasIdx + 1] = d[canvasIdx + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
}