import React, { useState, useEffect } from 'react';
import useDrawingCanvas from './useDrawingCanvas';
import './DrawingArea.css';

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#8B4513'
];

const DrawingArea = ({ socket, userCount }) => {
  const {
    canvasRef, startDrawing, draw, stopDrawing, clearCanvas,
    color, setColor, lineWidth, setLineWidth
  } = useDrawingCanvas(socket);

  const [isWordPhase, setIsWordPhase] = useState(false);
  useEffect(() => {
    if (!socket || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');

    const handleRemoteStart = ({ x, y }) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleRemoteMove = ({ x, y, color, lineWidth }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    socket.on('remote_drawing_start', handleRemoteStart);
    socket.on('remote_drawing_move', handleRemoteMove);
    socket.on('remote_drawing_clear', () => clearCanvas(false));

    return () => {
      socket.off('remote_drawing_start');
      socket.off('remote_drawing_move');
      socket.off('remote_drawing_clear');
    };
  }, [socket, clearCanvas, canvasRef]);

  return (
    <div className="drawing-container">
      {!isWordPhase ? (
        <div className="drawing-start-screen">
          <h3>🎨 Gribouille.io</h3>
          <p>Joueurs : <strong>{userCount}</strong></p>
          <button 
            onClick={() => setIsWordPhase(true)} 
            disabled={userCount < 2}
            className="start-btn"
          >
            Lancer la partie
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="tool-group colors">
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                title="Sélecteur personnalisé"
              />
              <div className="preset-palette">
                {PRESET_COLORS.map(c => (
                  <button 
                    key={c} 
                    onClick={() => setColor(c)} 
                    style={{ backgroundColor: c }}
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="tool-group brush-size">
              <input 
                type="range" 
                min="1" max="30" 
                value={lineWidth} 
                onChange={(e) => setLineWidth(parseInt(e.target.value))} 
              />
              <span className="size-display">{lineWidth}px</span>
            </div>
            <button onClick={() => clearCanvas(true)} className="clear-btn">
              🗑️ Effacer
            </button>
          </div>

          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DrawingArea;
