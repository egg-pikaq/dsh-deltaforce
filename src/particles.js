function createRadar(canvas, reducedMotion) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const points = Array.from({ length: 108 }, (_, index) => {
    const angle = index * 2.39996;
    const radius = Math.sqrt((index + 1) / 108);
    return { angle, radius, phase: index * 0.618 };
  });
  let pixelRatio = 0;
  let width = 0;
  let height = 0;

  return (progress) => {
    const bounds = canvas.getBoundingClientRect();
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    if (width !== bounds.width || height !== bounds.height || pixelRatio !== nextRatio) {
      width = bounds.width;
      height = bounds.height;
      pixelRatio = nextRatio;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.45;
    const sweep = (reducedMotion ? 0.4 : progress * 2.3) * Math.PI * 2;
    context.strokeStyle = 'rgba(122, 201, 250, .27)';
    context.lineWidth = 1;
    for (const ring of [0.29, 0.52, 0.75, 0.98]) {
      context.beginPath();
      context.arc(centerX, centerY, size * ring, 0, Math.PI * 2);
      context.stroke();
    }
    context.strokeStyle = 'rgba(168, 232, 255, .63)';
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + Math.cos(sweep) * size, centerY + Math.sin(sweep) * size);
    context.stroke();

    const formation = reducedMotion ? 1 : Math.min(1, progress * 4);
    for (const point of points) {
      const angle = point.angle + (reducedMotion ? 0 : progress * 0.65);
      const distance = size * point.radius * (1.8 - 0.8 * formation);
      const illumination = Math.max(0, Math.cos(sweep - angle)) ** 12;
      context.fillStyle = `rgba(168, 229, 255, ${0.12 + illumination * 0.65})`;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const side = point.phase % 1 > 0.8 ? 2 : 1;
      context.fillRect(x, y, side, side);
    }
  };
}
