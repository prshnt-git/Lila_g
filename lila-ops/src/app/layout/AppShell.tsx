import { useEffect, useMemo, useState } from "react";
import TopBar from "./TopBar";
import { loadManifest, loadMatchFile } from "../../data/loaders";
import MapCanvas from "../../components/map/MapCanvas";
import MapOverview from "../../components/map/MapOverview";

function getMapImagePath(mapName: string) {
  const mapImageMap: Record<string, string> = {
    AmbroseValley: "/minimaps/AmbroseValley_Minimap.png",
    GrandRift: "/minimaps/GrandRift_Minimap.png",
    Lockdown: "/minimaps/Lockdown_Minimap.jpg",
  };
  return mapImageMap[mapName] || "";
}

type ManifestMatch = {
  match_id: string;
  map: string;
  file: string;
  players: number;
  events: number;
  quality_tier: "recommended" | "playable" | "debug_only";
  dates?: string[];
};

type Manifest = {
  total_matches: number;
  recommended_matches: number;
  playable_matches: number;
  debug_only_matches: number;
  matches: ManifestMatch[];
};

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

type MatchJson = {
  meta: {
    match_id: string;
    map: string;
    players: number;
    human_players: number;
    bot_players: number;
    events: number;
    quality_tier: string;
  };
  players: Player[];
  events: MatchEvent[];
};

const APP_PADDING = 14;

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px",
        borderRadius: "12px",
        border: active ? "1px solid #22d3ee" : "1px solid #243041",
        background: active ? "#102234" : "#0f1726",
        color: "white",
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      {children}
    </button>
  );
}

function SnapshotRow({
  match,
  selected,
  onClick,
}: {
  match: ManifestMatch;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "9px 10px",
        borderRadius: "12px",
        border: selected ? "1px solid #22d3ee" : "1px solid #1b2740",
        background: selected ? "#102234" : "#111b2a",
        color: "white",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.35 }}>
        {match.match_id}
      </div>
      <div style={{ fontSize: "11px", opacity: 0.72, marginTop: "4px" }}>
        {match.map} • P:{match.players} • E:{match.events}
      </div>
      <div style={{ fontSize: "11px", opacity: 0.56, marginTop: "3px" }}>
        {match.quality_tier}
      </div>
    </button>
  );
}

function ControlButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: "10px",
        border: "1px solid #243041",
        background: "#102234",
        color: "white",
        cursor: "pointer",
        fontSize: "12px",
      }}
    >
      {children}
    </button>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#0f1726",
        border: "1px solid #1f2a44",
        borderRadius: "10px",
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: "10px", opacity: 0.68, marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.3 }}>
        {value}
      </div>
    </div>
  );
}

function getSnapshotMaxTime(matchData: MatchJson | null): number {
  if (!matchData) return 0;

  let maxTime = 0;

  for (const player of matchData.players || []) {
    for (const point of player.path || []) {
      if (point.time_sec > maxTime) maxTime = point.time_sec;
    }
  }

  for (const event of matchData.events || []) {
    if (event.time_sec > maxTime) maxTime = event.time_sec;
  }

  return Number(maxTime.toFixed(3));
}

function formatTime(sec: number) {
  return `${sec.toFixed(2)}s`;
}

export default function AppShell() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<ManifestMatch | null>(null);
  const [matchData, setMatchData] = useState<MatchJson | null>(null);
  const [mode, setMode] = useState<"overview" | "explorer">("overview");
  const [error, setError] = useState("");

  const [explorerMap, setExplorerMap] = useState<string>("ALL");
  const [matchSearch, setMatchSearch] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    async function init() {
      try {
        const data = await loadManifest();
        setManifest(data);

        const preferred =
          data.matches.find(
            (m: ManifestMatch) => m.quality_tier === "recommended"
          ) ??
          data.matches.find(
            (m: ManifestMatch) => m.quality_tier === "playable"
          ) ??
          null;

        if (preferred) {
          setSelectedMatch(preferred);
        }
      } catch (e: any) {
        setError(e.message || "Error loading manifest");
      }
    }

    init();
  }, []);

  useEffect(() => {
    async function loadMatch() {
      if (!selectedMatch) return;

      try {
        const data = await loadMatchFile(selectedMatch.file);
        setMatchData(data);
        setCurrentTimeSec(0);
        setIsPlaying(false);
      } catch (e: any) {
        setError(e.message || "Error loading match");
      }
    }

    loadMatch();
  }, [selectedMatch]);

  const explorerMapOptions = useMemo(() => {
    if (!manifest) return ["ALL"];
    return ["ALL", ...Array.from(new Set(manifest.matches.map((m) => m.map))).sort()];
  }, [manifest]);

  const filteredExplorerMatches = useMemo(() => {
    if (!manifest) return [];

    const query = matchSearch.trim().toLowerCase();

    return manifest.matches
      .filter((m) => m.quality_tier !== "debug_only")
      .filter((m) => explorerMap === "ALL" || m.map === explorerMap)
      .filter((m) => {
        if (!query) return true;
        return m.match_id.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const qualityOrder = { recommended: 2, playable: 1, debug_only: 0 };
        const qualityDiff =
          qualityOrder[b.quality_tier] - qualityOrder[a.quality_tier];
        if (qualityDiff !== 0) return qualityDiff;
        return b.events - a.events;
      })
      .slice(0, 12);
  }, [manifest, explorerMap, matchSearch]);

  useEffect(() => {
    if (mode !== "explorer") return;

    if (!filteredExplorerMatches.length) {
      setSelectedMatch(null);
      return;
    }

    const stillVisible = filteredExplorerMatches.some(
      (m) => m.match_id === selectedMatch?.match_id
    );

    if (!stillVisible) {
      setSelectedMatch(filteredExplorerMatches[0]);
    }
  }, [filteredExplorerMatches, selectedMatch, mode]);

  const maxTimeSec = useMemo(() => getSnapshotMaxTime(matchData), [matchData]);

  useEffect(() => {
    if (!isPlaying) return;
    if (!matchData) return;
    if (maxTimeSec <= 0) return;

    const interval = window.setInterval(() => {
      setCurrentTimeSec((prev) => {
        const next = prev + 0.05 * playbackSpeed;
        if (next >= maxTimeSec) {
          setIsPlaying(false);
          return maxTimeSec;
        }
        return Number(next.toFixed(3));
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [isPlaying, playbackSpeed, matchData, maxTimeSec]);

  return (
    <div
      style={{
        background: "#081019",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <TopBar />

      <div
        style={{
          padding: APP_PADDING,
          display: "grid",
          gap: "12px",
        }}
      >
        <div
          style={{
            ...panelStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            padding: "14px 16px",
          }}
        >
          <div>
            <div style={{ fontSize: "19px", fontWeight: 700 }}>LILA Player Ops</div>
            <div style={{ fontSize: "12px", opacity: 0.72, marginTop: "3px" }}>
              Map-first visualization for combat, routing, loot, and survival pressure.
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <ModeButton
              active={mode === "overview"}
              onClick={() => setMode("overview")}
            >
              Map Insights
            </ModeButton>
            <ModeButton
              active={mode === "explorer"}
              onClick={() => setMode("explorer")}
            >
              Explorer
            </ModeButton>
          </div>
        </div>

        {!manifest && !error && <div style={panelStyle}>Loading manifest...</div>}

        {error && <div style={{ ...panelStyle, color: "#ff6b6b" }}>Error: {error}</div>}

        {manifest && mode === "overview" && (
          <div style={{ ...panelStyle, padding: "12px" }}>
            <MapOverview />
          </div>
        )}

        {manifest && mode === "explorer" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px minmax(0, 1fr)",
              gap: "12px",
              alignItems: "start",
            }}
          >
            <aside
              style={{
                ...panelStyle,
                display: "grid",
                gap: "10px",
                alignContent: "start",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "15px", fontWeight: 700 }}>
                Explorer
              </div>

              <label style={{ display: "grid", gap: "5px", fontSize: "12px" }}>
                <span style={{ opacity: 0.78 }}>Map</span>
                <select
                  value={explorerMap}
                  onChange={(e) => setExplorerMap(e.target.value)}
                  style={selectStyle}
                >
                  {explorerMapOptions.map((map) => (
                    <option key={map} value={map}>
                      {map === "ALL" ? "All Maps" : map}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "5px", fontSize: "12px" }}>
                <span style={{ opacity: 0.78 }}>Search</span>
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  placeholder="Search match id..."
                  style={inputStyle}
                />
              </label>

              <div style={{ fontSize: "12px", opacity: 0.72 }}>
                {filteredExplorerMatches.length} curated samples
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "8px",
                  maxHeight: "58vh",
                  overflow: "auto",
                }}
              >
                {filteredExplorerMatches.length === 0 && (
                  <div style={{ fontSize: "13px", opacity: 0.72 }}>
                    No usable samples found.
                  </div>
                )}

                {filteredExplorerMatches.map((match) => (
                  <SnapshotRow
                    key={match.match_id}
                    match={match}
                    selected={selectedMatch?.match_id === match.match_id}
                    onClick={() => setSelectedMatch(match)}
                  />
                ))}
              </div>
            </aside>

            <main
              style={{
                ...panelStyle,
                display: "grid",
                gridTemplateRows: "auto auto minmax(520px, 1fr) auto",
                gap: "10px",
                minWidth: 0,
                padding: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "3px" }}>
                  Sample Detail
                </div>
                <div style={{ fontSize: "12px", opacity: 0.72 }}>
                  Short gameplay sample with movement and event overlays.
                </div>
              </div>

              <div
                style={{
                  background: "#0f1726",
                  border: "1px solid #1f2a44",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <ControlButton
                    onClick={() => {
                      if (currentTimeSec >= maxTimeSec && maxTimeSec > 0) {
                        setCurrentTimeSec(0);
                      }
                      setIsPlaying((v) => !v);
                    }}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </ControlButton>

                  <ControlButton
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentTimeSec(0);
                    }}
                  >
                    Reset
                  </ControlButton>

                  <label style={{ fontSize: "12px", opacity: 0.85 }}>
                    Speed
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      style={selectCompactStyle}
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={4}>4x</option>
                    </select>
                  </label>

                  <div style={{ fontSize: "12px", opacity: 0.85 }}>
                    <strong>{formatTime(currentTimeSec)}</strong> /{" "}
                    <strong>{formatTime(maxTimeSec)}</strong>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(maxTimeSec, 0.001)}
                  step={0.01}
                  value={Math.min(currentTimeSec, Math.max(maxTimeSec, 0.001))}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentTimeSec(Number(e.target.value));
                  }}
                  style={{ width: "100%" }}
                />
              </div>

              {!matchData && <div>Loading sample...</div>}

              {matchData && (
                <>
                  <div
                    style={{
                      minHeight: 0,
                      height: "100%",
                      background: "#0b1420",
                      borderRadius: "12px",
                      padding: "8px",
                    }}
                  >
                    <MapCanvas
                      mapName={matchData.meta.map}
                      imagePath={getMapImagePath(matchData.meta.map)}
                      players={matchData.players}
                      events={matchData.events}
                      currentTimeSec={currentTimeSec}
                      playbackEnabled={true}
                      showPaths={true}
                      showEvents={true}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <MetaPill label="ID" value={matchData.meta.match_id} />
                    <MetaPill label="Map" value={matchData.meta.map} />
                    <MetaPill label="Players" value={String(matchData.meta.players)} />
                    <MetaPill label="Humans" value={String(matchData.meta.human_players)} />
                    <MetaPill label="Bots" value={String(matchData.meta.bot_players)} />
                    <MetaPill label="Events" value={String(matchData.meta.events)} />
                    <MetaPill label="Quality" value={matchData.meta.quality_tier} />
                  </div>
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "#0f1726",
  border: "1px solid #1f2a44",
  borderRadius: "16px",
  padding: "16px",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  background: "#102234",
  color: "white",
  border: "1px solid #243041",
  borderRadius: "10px",
  padding: "9px 10px",
  fontSize: "12px",
  width: "100%",
};

const selectCompactStyle: React.CSSProperties = {
  marginLeft: "6px",
  background: "#102234",
  color: "white",
  border: "1px solid #243041",
  borderRadius: "8px",
  padding: "5px 8px",
  fontSize: "12px",
};

const inputStyle: React.CSSProperties = {
  background: "#102234",
  color: "white",
  border: "1px solid #243041",
  borderRadius: "10px",
  padding: "9px 10px",
  fontSize: "12px",
  width: "100%",
};