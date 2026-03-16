let previousFrameData = null;

self.onmessage = function (e) {
  const { imageData, width, height } = e.data;
  const data = imageData.data;
  const length = data.length;

  let totalLuminance = 0;
  let motionDifference = 0;

  // 1. Luminance & Motion Loop (Combined for performance)
  for (let i = 0; i < length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    totalLuminance += luminance;

    if (previousFrameData) {
      // Proxy motion by luminance difference
      const prevR = previousFrameData[i];
      const prevG = previousFrameData[i + 1];
      const prevB = previousFrameData[i + 2];
      const prevLuminance = prevR * 0.299 + prevG * 0.587 + prevB * 0.114;
      motionDifference += Math.abs(luminance - prevLuminance);
    }
  }

  const avgLuminance = totalLuminance / (length / 4);
  const avgMotion = previousFrameData ? motionDifference / (length / 4) : 0;

  previousFrameData = new Uint8ClampedArray(data);

  // 2. Fast Blur Check (Laplacian Variance approximation)
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let pixelCount = 0;

  // Step by 2 to save CPU (sub-sampling)
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;

      const val = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
      const top = data[idx - width * 4] * 0.299 + data[idx - width * 4 + 1] * 0.587 + data[idx - width * 4 + 2] * 0.114;
      const bottom = data[idx + width * 4] * 0.299 + data[idx + width * 4 + 1] * 0.587 + data[idx + width * 4 + 2] * 0.114;
      const left = data[idx - 4] * 0.299 + data[idx - 3] * 0.587 + data[idx - 2] * 0.114;
      const right = data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114;

      const laplacian = (top + bottom + left + right) - (4 * val);
      
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      pixelCount++;
    }
  }

  const meanLaplacian = laplacianSum / pixelCount;
  const variance = (laplacianSqSum / pixelCount) - (meanLaplacian * meanLaplacian);

  // 3. Warning Triggers
  const warnings = [];
  if (avgLuminance < 40) warnings.push("LOW_LIGHT");
  if (avgMotion > 20) warnings.push("FAST_MOTION");
  // Only check blur if there is enough light and not much motion, to avoid false positives
  if (variance < 40 && avgLuminance >= 40 && avgMotion < 15) warnings.push("BLURRY");

  self.postMessage({ warnings, metrics: { avgLuminance, avgMotion, variance } });
};
