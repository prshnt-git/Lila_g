type PlayerPathPoint = {
  time_sec: number;
  position: {
    x: number;
    y: number;
  };
};

type Player = {
  id: string;
  type: string;
  path: PlayerPathPoint[];
};

type MatchEvent = {
  type: string;
  time_sec: number;
  position: {
    x: number;
    y: number;
  };
  player_id: string;
};

type HeatmapPoint = {
  x: number;
  y: number;
  value: number;
};

type MapCanvasProps = {
  mapName: string;
  imagePath: string;
  players: Player[];
  events: MatchEvent[];
  currentTimeSec?: number | null;
  playbackEnabled?: boolean;
  showPaths?: boolean;
  showEvents?: boolean;
  heatmapMode?: boolean;
  heatmapPoints?: HeatmapPoint[];
  heatmapColor?: string;
};

function getPathColor(playerType: string) {
  return playerType === "human" ? "#22d3ee" : "#f97316";
}

function getEventLayerPriority(eventType: string) {
  const t = eventType.toLowerCase();

  if (t.includes("loot")) return 1;
  if (t.includes("storm")) return 2;
  if (t.includes("death")) return 3;
  if (t.includes("kill")) return 4;

  return 0;
}

function getEventStyle(eventType: string) {
  const t = eventType.toLowerCase();

  if (t.includes("kill")) {
    return {
      coreColor: "#ef4444",
      coreRadius: 4,
      coreOpacity: 0.95,
      glowRadius: 10,
      glowOpacity: 0.18,
    };
  }

  if (t.includes("storm")) {
    return {
      coreColor: "#8b5cf6",
      coreRadius: 3.5,
      coreOpacity: 0.8,
      glowRadius: 8,
      glowOpacity: 0.14,
    };
  }

  if (t.includes("death")) {
    return {
      coreColor: "#111827",
      coreRadius: 3.5,
      coreOpacity: 0.78,
      glowRadius: 7,
      glowOpacity: 0.12,
    };
  }

  if (t.includes("loot")) {
    return {
      coreColor: "#facc15",
      coreRadius: 1.6,
      coreOpacity: 0.12,
      glowRadius: 4,
      glowOpacity: 0.04,
    };
  }

  return {
    coreColor: "#94a3b8",
    coreRadius: 2,
    coreOpacity: 0.18,
    glowRadius: 5,
    glowOpacity: 0.05,
  };
}

function filterPathByTime(
  path: PlayerPathPoint[],
  currentTimeSec?: number | null,
  playbackEnabled?: boolean
) {
  if (
    !playbackEnabled ||
    currentTimeSec === null ||
    currentTimeSec === undefined
  ) {
    return path;
  }

  return path.filter((p) => p.time_sec <= currentTimeSec);
}

function buildPolylinePoints(path: PlayerPathPoint[]) {
  return path.map((p) => `${p.position.x},${p.position.y}`).join(" ");
}

function getLatestPoint(path: PlayerPathPoint[]) {
  if (!path.length) return null;
  return path[path.length - 1];
}

export default function MapCanvas({
  mapName,
  imagePath,
  players,
  events,
  currentTimeSec = null,
  playbackEnabled = false,
  showPaths = true,
  showEvents = true,
  heatmapMode = false,
  heatmapPoints = [],
  heatmapColor = "#ef4444",
}: MapCanvasProps) {
  const visiblePlayers = players
    .map((player) => {
      const visiblePath = filterPathByTime(
        player.path ?? [],
        currentTimeSec,
        playbackEnabled
      );

      return {
        ...player,
        visiblePath,
        latestPoint: getLatestPoint(visiblePath),
      };
    })
    .filter((player) => player.visiblePath.length > 0);

  const visibleEvents = [...events]
    .filter((event) => {
      if (
        !playbackEnabled ||
        currentTimeSec === null ||
        currentTimeSec === undefined
      ) {
        return true;
      }

      return event.time_sec <= currentTimeSec;
    })
    .sort((a, b) => getEventLayerPriority(a.type) - getEventLayerPriority(b.type));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #1b2740",
        background: "#0b1420",
        position: "relative",
      }}
    >
      <img
        src={imagePath}
        alt={mapName}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          background: "#0b1420",
        }}
      />

      <svg
        viewBox="0 0 1024 1024"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {heatmapMode &&
          heatmapPoints.map((point, i) => {
            const clamped = Math.max(0.12, Math.min(point.value, 1));

            return (
              <g key={`heat-${i}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={70}
                  fill={heatmapColor}
                  opacity={0.04 * clamped}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={52}
                  fill={heatmapColor}
                  opacity={0.07 * clamped}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={34}
                  fill={heatmapColor}
                  opacity={0.11 * clamped}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={18}
                  fill={heatmapColor}
                  opacity={0.16 * clamped}
                />
              </g>
            );
          })}

        {showPaths &&
          visiblePlayers.map((player) => {
            if (player.visiblePath.length < 2) return null;

            return (
              <polyline
                key={player.id}
                points={buildPolylinePoints(player.visiblePath)}
                fill="none"
                stroke={getPathColor(player.type)}
                strokeWidth={1.8}
                strokeOpacity={0.34}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

        {showPaths &&
          visiblePlayers.map((player) => {
            if (!player.latestPoint) return null;

            return (
              <circle
                key={`${player.id}-head`}
                cx={player.latestPoint.position.x}
                cy={player.latestPoint.position.y}
                r={2.4}
                fill={getPathColor(player.type)}
                opacity={0.95}
              />
            );
          })}

        {!heatmapMode &&
          showEvents &&
          visibleEvents.map((event, i) => {
            const style = getEventStyle(event.type);

            return (
              <g key={`${event.player_id}-${event.time_sec}-${i}`}>
                <circle
                  cx={event.position.x}
                  cy={event.position.y}
                  r={style.glowRadius}
                  fill={style.coreColor}
                  opacity={style.glowOpacity}
                />
                <circle
                  cx={event.position.x}
                  cy={event.position.y}
                  r={style.coreRadius}
                  fill={style.coreColor}
                  opacity={style.coreOpacity}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
}