export function luminance(rgba: ArrayLike<number>): Float32Array {
  const gray = new Float32Array(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const alpha = rgba[i * 4 + 3] / 255;
    const y = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    gray[i] = y * alpha + 255 * (1 - alpha);
  }
  return gray;
}

export function ditherFloydSteinberg(
  gray: ArrayLike<number>,
  width: number,
  height: number,
): Uint8Array {
  const bits = new Uint8Array(width * height);
  const work = Float32Array.from(gray);
  const spread = (x: number, y: number, error: number) => {
    if (x < 0 || x >= width || y >= height) return;
    work[y * width + x] += error;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const old = work[y * width + x];
      const next = old < 128 ? 0 : 255;
      const error = old - next;
      bits[y * width + x] = next === 0 ? 1 : 0;
      spread(x + 1, y, (error * 7) / 16);
      spread(x - 1, y + 1, (error * 3) / 16);
      spread(x, y + 1, (error * 5) / 16);
      spread(x + 1, y + 1, error / 16);
    }
  }
  return bits;
}

export function toInkRgba(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  ink: readonly [number, number, number] = [17, 17, 17],
): Uint8ClampedArray<ArrayBuffer> {
  const bits = ditherFloydSteinberg(gray, width, height);
  const rgba = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  for (let i = 0; i < bits.length; i++) {
    rgba[i * 4] = ink[0];
    rgba[i * 4 + 1] = ink[1];
    rgba[i * 4 + 2] = ink[2];
    rgba[i * 4 + 3] = bits[i] ? 255 : 0;
  }
  return rgba;
}
