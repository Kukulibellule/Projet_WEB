import { useState, useRef, useEffect, useCallback } from "react";

const WS_URL = "ws://localhost:3001";

const DRAW_COLORS = [
  "#1a1a2e", "#ffffff", "#e94560", "#f5a623", "#f8e71c", "#7ed321",
  "#4a90d9", "#9b59b6", "#1abc9c", "#e67e22", "#ff6b9d", "#c0392b",
  "#2980b9", "#27ae60", "#8e44ad", "#f39c12", "#95a5a6", "#2c3e50",
  "#00d2ff", "#ff9f43",
];

const PLAYER_COLORS = [
  "#ff6b9d", "#4a90d9", "#7ed321", "#f5a623",
  "#e94560", "#9b59b6", "#1abc9c", "#e67e22",
];

const AVATARS = ["🐱", "🐶", "🦊", "🐸", "🐼", "🦁", "🐨", "🐯", "🐺", "🦄", "🐻", "🐥"];
const BRUSH_SIZES = [3, 8, 16, 28];

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  card: (accent = "#ff6b9d") => ({
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: `1px solid ${accent}44`,
    borderRadius: "20px",
    boxShadow: `0 8px 40px ${accent}18`,
  }),
  btn: (color, active = true) => ({
    background: active ? `${color}22` : "rgba(255,255,255,0.05)",
    border: `2px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
    color: active ? color : "rgba(255,255,255,0.5)",
    borderRadius: "12px",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    transition: "all 0.15s",
  }),
};

// ─── Notification toast ──────────────────────────────────────────────────────

function Notif({ text, color }) {
  return (
    <div style={{
      background: `${color}22`,
      border: `1px solid ${color}55`,
      borderRadius: "50px",
      padding: "6px 18px",
      fontSize: "13px",
      fontWeight: 600,
      color: "#fff",
      pointerEvents: "none",
      animation: "fadeSlide 0.3s ease",
    }}>
      {text}
    </div>
  );
}

// ─── Join screen ─────────────────────────────────────────────────────────────

function JoinScreen({ onJoin, error }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PLAYER_COLORS[0]);
  const [avatar, setAvatar] = useState(AVATARS[0]);

  return (
    <div style={{
      ...S.page,
      justifyContent: "center",
      gap: "24px",
      padding: "40px 20px",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>🎨</div>
        <h1 style={{
          fontSize: "36px", fontWeight: 900,
          background: "linear-gradient(90deg, #ff6b9d, #4a90d9)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "-1px",
        }}>Gartic Draw</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", marginTop: "6px", fontSize: "14px" }}>
          Dessin multijoueur en temps réel · ws://localhost:3001
        </p>
      </div>

      <div style={{ ...S.card("#ff6b9d"), padding: "28px", width: "100%", maxWidth: "440px" }}>
        {/* Name */}
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", marginBottom: "8px" }}>
          TON PSEUDO
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && name.trim() && onJoin(name.trim(), color, avatar)}
          placeholder="Entrez votre pseudo..."
          maxLength={20}
          style={{
            width: "100%", padding: "12px 16px",
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: "12px", color: "#fff",
            fontSize: "16px", outline: "none",
            marginBottom: "22px",
          }}
        />

        {/* Avatar */}
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", marginBottom: "10px" }}>
          AVATAR
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "22px" }}>
          {AVATARS.map(a => (
            <button key={a} onClick={() => setAvatar(a)} style={{
              width: "44px", height: "44px", fontSize: "24px",
              borderRadius: "12px", cursor: "pointer",
              background: avatar === a ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)",
              border: avatar === a ? "2px solid rgba(255,255,255,0.6)" : "2px solid rgba(255,255,255,0.1)",
              transform: avatar === a ? "scale(1.15)" : "scale(1)",
              transition: "all 0.15s",
            }}>{a}</button>
          ))}
        </div>

        {/* Color */}
        <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", marginBottom: "10px" }}>
          COULEUR DU JOUEUR
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px" }}>
          {PLAYER_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: c, border: color === c ? "3px solid #fff" : "2px solid transparent",
              cursor: "pointer", transform: color === c ? "scale(1.2)" : "scale(1)",
              boxShadow: color === c ? `0 0 10px ${c}` : "none",
              transition: "all 0.15s",
            }} />
          ))}
        </div>

        {error && (
          <div style={{
            background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.4)",
            borderRadius: "12px", padding: "10px 16px",
            fontSize: "13px", color: "#e94560", marginBottom: "16px",
          }}>
            ⚠️ Impossible de se connecter au serveur. Lance d'abord <code>node server.js</code>.
          </div>
        )}

        <button
          onClick={() => name.trim() && onJoin(name.trim(), color, avatar)}
          disabled={!name.trim()}
          style={{
            width: "100%", padding: "14px",
            background: name.trim()
              ? `linear-gradient(90deg, ${color}, ${color}aa)`
              : "rgba(255,255,255,0.05)",
            border: "none", borderRadius: "14px",
            color: "#fff", fontSize: "16px", fontWeight: 800,
            cursor: name.trim() ? "pointer" : "not-allowed",
            opacity: name.trim() ? 1 : 0.5,
            transition: "all 0.2s",
          }}
        >
          {avatar} Rejoindre la partie
        </button>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  // Screens: "join" | "draw"
  const [screen, setScreen] = useState("join");
  const [joinError, setJoinError] = useState(false);

  // My identity
  const [myId, setMyId] = useState(null);
  const [myInfo, setMyInfo] = useState(null);

  // Multiplayer
  const [players, setPlayers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Drawing
  const [activeTool, setActiveTool] = useState("pencil");
  const [activeColor, setActiveColor] = useState("#1a1a2e");
  const [brushSize, setBrushSize] = useState(8);

  // Refs
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const pendingHistory = useRef(null);

  // ── Toast notifications ────────────────────────────────────────────────────
  const addNotif = useCallback((text, color = "#ff6b9d") => {
    const id = Date.now() + Math.random();
    setNotifications(n => [...n, { id, text, color }]);
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 3000);
  }, []);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  const drawStroke = useCallback((stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.beginPath();
    ctx.lineWidth = stroke.tool === "eraser" ? stroke.size * 2.5 : stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "#fdfaf3" : stroke.color;
    ctx.moveTo(stroke.x1 * W, stroke.y1 * H);
    ctx.lineTo(stroke.x2 * W, stroke.y2 * H);
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fdfaf3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Replay history once canvas is mounted ───────────────────────────────
  useEffect(() => {
    if (screen !== "draw") return;
    const timer = setTimeout(() => {
      clearCanvas();
      if (pendingHistory.current) {
        pendingHistory.current.forEach(drawStroke);
        pendingHistory.current = null;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [screen, clearCanvas, drawStroke]);

  // ── WebSocket message handler (stable ref to avoid stale closures) ─────────
  const onMessage = useCallback((msg) => {
    switch (msg.type) {
      case "welcome":
        setMyId(msg.id);
        setPlayers(msg.players);
        pendingHistory.current = msg.strokes;
        setScreen("draw");
        break;

      case "players":
        setPlayers(msg.players);
        break;

      case "joined":
        setPlayers(prev =>
          prev.some(p => p.id === msg.player.id) ? prev : [...prev, msg.player]
        );
        addNotif(`${msg.player.avatar} ${msg.player.name} a rejoint !`, msg.player.color);
        break;

      case "left":
        setPlayers(prev => {
          const leaver = prev.find(p => p.id === msg.playerId);
          if (leaver) addNotif(`${leaver.avatar} ${leaver.name} est parti`, "#95a5a6");
          return prev.filter(p => p.id !== msg.playerId);
        });
        break;

      case "draw":
        drawStroke(msg);
        break;

      case "reset":
        clearCanvas();
        addNotif(`🗑️ ${msg.playerName} a remis le canvas à zéro`, "#e94560");
        break;

      default:
        break;
    }
  }, [addNotif, drawStroke, clearCanvas]);

  // ── Join handler ─────────────────────────────────────────────────────────
  const handleJoin = useCallback((name, color, avatar) => {
    setJoinError(false);
    const info = { name, color, avatar };
    setMyInfo(info);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "join", name, color, avatar }));
    };

    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };

    ws.onerror = () => {
      setJoinError(true);
      setConnected(false);
    };

    ws.onclose = () => setConnected(false);
  }, [onMessage]);

  // ── Drawing event handlers ─────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * scaleX) / canvas.width,
      y: ((clientY - rect.top) * scaleY) / canvas.height,
    };
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  };

  const onMouseMove = (e) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);

    const stroke = {
      type: "draw",
      x1: lastPos.current.x, y1: lastPos.current.y,
      x2: pos.x, y2: pos.y,
      color: activeColor,
      size: brushSize,
      tool: activeTool,
    };

    // Draw locally (instant feedback)
    drawStroke(stroke);

    // Send to server (will be relayed to others)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(stroke));
    }

    lastPos.current = pos;
  };

  const onMouseUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const handleReset = () => {
    clearCanvas();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reset" }));
    }
  };

  // ── Join screen ────────────────────────────────────────────────────────────
  if (screen === "join") {
    return <JoinScreen onJoin={handleJoin} error={joinError} />;
  }

  // ── Draw screen ────────────────────────────────────────────────────────────
  const me = myInfo;

  return (
    <div style={{ ...S.page, minHeight: "100vh", padding: "12px", gap: "10px" }}>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{
        width: "100%", maxWidth: "1100px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>🎨</span>
          <span style={{ fontWeight: 900, fontSize: "20px", letterSpacing: "-0.5px" }}>Gartic Draw</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Connection dot */}
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: connected ? "#7ed321" : "#e94560",
            animation: connected ? "pulse 2s infinite" : "none",
          }} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            {connected ? "Connecté" : "Déconnecté"}
          </span>
        </div>
      </div>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: "16px", left: "50%",
        transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", gap: "6px",
        alignItems: "center", zIndex: 999, pointerEvents: "none",
      }}>
        {notifications.map(n => <Notif key={n.id} text={n.text} color={n.color} />)}
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div style={{
        width: "100%", maxWidth: "1100px",
        display: "flex", gap: "12px",
        flex: 1,
      }}>

        {/* ── Left sidebar: players ────────────────────────────────────── */}
        <div style={{
          ...S.card("#4a90d9"),
          width: "160px", flexShrink: 0,
          padding: "14px 12px",
          display: "flex", flexDirection: "column", gap: "8px",
        }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", marginBottom: "4px" }}>
            JOUEURS ({players.length})
          </div>
          {players.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px",
              background: p.id === myId ? `${p.color}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${p.id === myId ? p.color + "55" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "10px",
            }}>
              <span style={{ fontSize: "20px" }}>{p.avatar}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "13px", fontWeight: 600,
                  color: p.color,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p.name}
                </div>
                {p.id === myId && (
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Toi</div>
                )}
              </div>
            </div>
          ))}
          {players.length === 0 && (
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: "8px" }}>
              En attente de joueurs…
            </div>
          )}
        </div>

        {/* ── Center: canvas + toolbar ─────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Toolbar */}
          <div style={{
            ...S.card(me?.color ?? "#ff6b9d"),
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>

            {/* Tools */}
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { id: "pencil", icon: "✏️", label: "Crayon" },
                { id: "eraser", icon: "🧹", label: "Gomme" },
              ].map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                  style={{
                    ...S.btn(me?.color ?? "#ff6b9d", activeTool === tool.id),
                    width: "44px", height: "44px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  {tool.icon}
                </button>
              ))}
            </div>

            <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.1)" }} />

            {/* Brush sizes */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  style={{
                    width: "38px", height: "38px", borderRadius: "50%",
                    background: brushSize === size ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                    border: `2px solid ${brushSize === size ? (me?.color ?? "#ff6b9d") : "rgba(255,255,255,0.1)"}`,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: `${Math.min(size * 1.2, 26)}px`,
                    height: `${Math.min(size * 1.2, 26)}px`,
                    borderRadius: "50%",
                    background: activeTool === "eraser" ? "rgba(255,255,255,0.2)" : activeColor,
                    border: activeColor === "#ffffff" ? "1px solid rgba(255,255,255,0.3)" : "none",
                  }} />
                </button>
              ))}
            </div>

            <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.1)" }} />

            {/* Color palette */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", maxWidth: "260px" }}>
              {DRAW_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { setActiveColor(c); setActiveTool("pencil"); }}
                  style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: c,
                    border: activeColor === c && activeTool === "pencil"
                      ? "3px solid #fff"
                      : c === "#ffffff" ? "2px solid rgba(255,255,255,0.3)" : "2px solid transparent",
                    cursor: "pointer",
                    transform: activeColor === c && activeTool === "pencil" ? "scale(1.3)" : "scale(1)",
                    boxShadow: activeColor === c && activeTool === "pencil" ? `0 0 8px ${c}99` : "none",
                    transition: "all 0.12s",
                  }}
                />
              ))}
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              style={{
                marginLeft: "auto",
                padding: "8px 16px", height: "40px",
                borderRadius: "12px",
                background: "rgba(233,69,96,0.1)",
                border: "2px solid rgba(233,69,96,0.4)",
                color: "#e94560", fontWeight: 700, fontSize: "13px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.15s",
              }}
            >
              🗑️ Reset
            </button>
          </div>

          {/* Canvas */}
          <div style={{
            ...S.card(me?.color ?? "#ff6b9d"),
            padding: "0",
            overflow: "hidden",
            position: "relative",
            cursor: activeTool === "eraser" ? "cell" : "crosshair",
            flex: 1,
          }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onMouseDown}
              onTouchMove={onMouseMove}
              onTouchEnd={onMouseUp}
              style={{
                display: "block",
                width: "100%", height: "auto",
                touchAction: "none",
                userSelect: "none",
              }}
            />

            {/* Overlay badges */}
            <div style={{
              position: "absolute", top: "10px", left: "10px",
              display: "flex", gap: "8px",
            }}>
              {me && (
                <div style={{
                  background: `${me.color}cc`,
                  backdropFilter: "blur(4px)",
                  borderRadius: "50px",
                  padding: "4px 12px",
                  fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {me.avatar} {me.name}
                </div>
              )}
            </div>

            <div style={{
              position: "absolute", top: "10px", right: "10px",
              background: "rgba(0,0,0,0.45)",
              borderRadius: "50px",
              padding: "4px 12px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <div style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: activeTool === "eraser" ? "rgba(255,255,255,0.5)" : activeColor,
                border: "1px solid rgba(255,255,255,0.3)",
              }} />
              {activeTool === "pencil" ? "Crayon" : "Gomme"} · {brushSize}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}