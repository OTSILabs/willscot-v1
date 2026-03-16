let previousFrameData = null;
let motionHistory = []; // Rolling buffer of avgMotion values
const HISTORY_LIMIT = 10;

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
  const currentMotion = previousFrameData ? motionDifference / (length / 4) : 0;

  // Update Motion History
  motionHistory.push(currentMotion);
  if (motionHistory.length > HISTORY_LIMIT) motionHistory.shift();

  previousFrameData = new Uint8ClampedArray(data);

  // Analyze History for Velocity and Jitter
  let sustainedMotion = 0;
  let motionVariance = 0;
  if (motionHistory.length >= 5) {
    sustainedMotion = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;
    const mean = sustainedMotion;
    motionVariance = motionHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / motionHistory.length;
  }

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
  
  // Lighting (Calibrated for Professional AI Quality: 500-1000 Lux)
  // LOW_LIGHT: Below ~500 Lux (Luminance ~120)
  if (avgLuminance < 120) {
    warnings.push("LOW_LIGHT");
  } 
  // TOO_BRIGHT: Above ~1000 Lux / Harsh Glare (Luminance ~210)
  else if (avgLuminance > 210) {
    warnings.push("TOO_BRIGHT");
  }
  
  // Motion Logic (Refined)
  // TOO_FAST: Sustained high motion (rapid panning)
  if (sustainedMotion > 45) {
    warnings.push("TOO_FAST");
  } 
  // TOO_SHAKY: High variance in motion (extreme jerky movements/jitter)
  // Threshold increased to 250 to allow for normal walking bouncing
  else if (motionVariance > 250 && sustainedMotion > 10) {
    warnings.push("TOO_SHAKY");
  }

  // Blur: Only check if there is enough light and not much motion, to avoid false positives
  if (variance < 40 && avgLuminance >= 120 && sustainedMotion < 25) {
    warnings.push("BLURRY");
  }

  self.postMessage({ warnings, metrics: { avgLuminance, avgMotion: sustainedMotion, motionVariance, variance } });
};
