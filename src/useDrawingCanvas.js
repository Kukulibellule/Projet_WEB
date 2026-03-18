import { useRef, useState, useEffect, useCallback } from 'react';

const useDrawingCanvas = (socket) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);

  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }, []);

  const configureCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = parent.offsetWidth;
    const logicalHeight = parent.offsetHeight;
    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      let tempImage = null;
      try {
          tempImage = canvas.toDataURL();
      } catch (_e) {}
      configureCanvas();
      if (tempImage) {
          const img = new Image();
          img.src = tempImage;
          img.onload = () => {
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [configureCanvas]);

  const startDrawing = (e) => {
    if (e.touches) e.preventDefault();
    isDrawingRef.current = true;
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    socket?.emit('drawing_start', { x, y, color, lineWidth });
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    if (e.touches) e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();
    socket?.emit('drawing_move', { x, y, color, lineWidth });
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    canvasRef.current.getContext('2d').closePath();
    socket?.emit('drawing_end');
  };

  const clearCanvas = useCallback((emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (emit) socket?.emit('drawing_clear');
  }, [socket]);

  return {
    canvasRef, startDrawing, draw, stopDrawing,
    clearCanvas, color, setColor, lineWidth, setLineWidth
  };
};

export default useDrawingCanvas;
