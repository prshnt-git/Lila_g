import { useEffect, useMemo, useState } from "react";
import MapCanvas from "./MapCanvas";
import { loadManifest, loadMatchFile } from "../../data/loaders";

type OverviewEvent = {
  type: string;
  time_sec: number;
  position: { x: number; y: number };
  player_id: string;
};

type HeatmapPoint = {
  x: number;
  y: number;
  value: number;
};

type ManifestMatch = {
  match_id: string;
  map: string;
  file: string;
  events: number;
  quality_tier: "recommended" | "playable" | "debug_only";
  quality_score?: number;
  quality_flags?: string[];
  dates?: string[];
};

type Manifest = {
  matches: ManifestMatch[];
};

type FilterState = {
  kill: boolean;
  death: boolean;
  storm_death: boolean;
  loot: boolean;
};

type OverviewStats = {
  loadedSnapshots: number;
  kill: number;
  death: number;
  storm_death: number;
  loot: number;
};

type VisualMode = "events" | "heatmap";
type HeatmapMetric = "kill" | "death" | "storm_death" | "loot";
type ActivePreset = "combat" | "survival" | "economy" | "all";

const DEFAULT_FILTERS: FilterState = {
  kill: true,
  death: true,
  storm_death: true,
  loot: false,
};

function normalizeOverviewEventType(rawType: string) {
  const t = rawType.toLowerCase();

  if (t.includes("position")) return null;
  if (t === "killedbystorm" || t === "storm_death") return "storm_death";
  if (
    t === "killed" ||
    t === "botkilled" ||
    t === "death" ||
    t === "death_by_bot"
  ) {
    return "death";
  }
  if (t === "kill" || t === "botkill" || t === "kill_bot") return "kill";
  if (t === "loot") return "loot";

  return null;
}

function getMapImagePath(mapName: string) {
  const mapImageMap: Record<string, string> = {
    AmbroseValley: "/minimaps/AmbroseValley_Minimap.png",
    GrandRift: "/minimaps/GrandRift_Minimap.png",
    Lockdown: "/minimaps/Lockdown_Minimap.jpg",
  };

  return mapImageMap[mapName] || "";
}

function getSnapshotPriority(match: ManifestMatch) {
  let score = 0;

  if (match.quality_tier === "recommended") score += 1000;
  else if (match.quality_tier === "playable") score += 300;
  else score += 50;

  score += match.events || 0;
  score += match.quality_score || 0;

  return score;
}

function getInsightSummary(
  stats: OverviewStats,
  mapName: string,
  visualMode: VisualMode,
  heatmapMetric: HeatmapMetric
) {
  const totalCombat = stats.kill + stats.death + stats.storm_death;

  if (visualMode === "heatmap") {
    return `${mapName} is showing a ${heatmapMetric.replace(
      "_",
      " "
    )} heatmap. Use it to identify concentrated zones, repeated pressure areas, and underused spaces.`;
  }

  if (stats.loadedSnapshots === 0) {
    return `No usable samples loaded for ${mapName}.`;
  }

  if (totalCombat === 0 && stats.loot > 0) {
    return `${mapName} appears economy-heavy, with loot dominating and little visible combat signal.`;
  }

  if (stats.kill > stats.death && stats.kill > stats.loot) {
    return `${mapName} is showing strong combat concentration. Use this to identify contested routes and high-conflict spaces.`;
  }

  if (stats.loot > stats.kill * 2) {
    return `${mapName} trends loot-heavy. This may indicate safer farming routes, lower contest pressure, or early-phase engagement bias.`;
  }

  if (stats.storm_death > 0 && stats.storm_death >= stats.death / 2) {
    return `${mapName} shows meaningful storm-pressure signal. Inspect edge routes, pacing, and extraction pressure.`;
  }

  return `${mapName} shows a mixed interaction pattern across combat, survival pressure, and resource collection.`;
}

function buildHeatmapPoints(
  events: OverviewEvent[],
  metric: HeatmapMetric
): HeatmapPoint[] {
  const metricEvents = events.filter((e) => e.type === metric);

  if (!metricEvents.length) return [];

  const cellSize = 24;
  const grid = new Map<string, { x: number; y: number; count: number }>();

  for (const event of metricEvents) {
    const gx = Math.floor(event.position.x / cellSize);
    const gy = Math.floor(event.position.y / cellSize);
    const key = `${gx}_${gy}`;

    if (!grid.has(key)) {
      grid.set(key, {
        x: gx * cellSize + cellSize / 2,
        y: gy * cellSize + cellSize / 2,
        count: 0,
      });
    }

    grid.get(key)!.count += 1;
  }

  const maxCount = Math.max(...Array.from(grid.values()).map((g) => g.count), 1);

  return Array.from(grid.values()).map((cell) => ({
    x: cell.x,
    y: cell.y,
    value: cell.count / maxCount,
  }));
}

function getHeatmapColor(metric: HeatmapMetric) {
  if (metric === "kill") return "#ef4444";
  if (metric === "death") return "#111827";
  if (metric === "storm_death") return "#8b5cf6";
  return "#facc15";
}

function ToggleButton({
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
        padding: "8px 12px",
        borderRadius: "10px",
        border: active ? "1px solid #22d3ee" : "1px solid #243041",
        background: active ? "#102234" : "#0f1726",
        color: "white",
        cursor: "pointer",
        fontSize: "13px",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#0f1726",
        border: "1px solid #1f2a44",
        borderRadius: "10px",
        padding: "8px 10px",
        fontSize: "12px",
      }}
    >
      <div style={{ opacity: 0.7, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function LegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        opacity: 0.9,
      }}
    >
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "999px",
          background: color,
          display: "inline-block",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

export default function MapOverview() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [mapName, setMapName] = useState("AmbroseValley");
  const [events, setEvents] = useState<OverviewEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [visualMode, setVisualMode] = useState<VisualMode>("heatmap");
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("kill");
  const [activePreset, setActivePreset] = useState<ActivePreset>("combat");

  const [stats, setStats] = useState<OverviewStats>({
    loadedSnapshots: 0,
    kill: 0,
    death: 0,
    storm_death: 0,
    loot: 0,
  });

  useEffect(() => {
    async function loadBaseManifest() {
      try {
        const data = (await loadManifest()) as Manifest;
        setManifest(data);
      } catch (e) {
        console.error("Manifest load failed", e);
      }
    }

    loadBaseManifest();
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(Boolean).length;
  }, [filters]);

  const insightSummary = useMemo(() => {
    return getInsightSummary(stats, mapName, visualMode, heatmapMetric);
  }, [stats, mapName, visualMode, heatmapMetric]);

  const heatmapPoints = useMemo(() => {
    return buildHeatmapPoints(events, heatmapMetric);
  }, [events, heatmapMetric]);

  function applyPreset(preset: ActivePreset) {
    setActivePreset(preset);

    if (preset === "combat") {
      setFilters({
        kill: true,
        death: true,
        storm_death: false,
        loot: false,
      });
      if (visualMode === "heatmap") setHeatmapMetric("kill");
      return;
    }

    if (preset === "survival") {
      setFilters({
        kill: false,
        death: true,
        storm_death: true,
        loot: false,
      });
      if (visualMode === "heatmap") setHeatmapMetric("storm_death");
      return;
    }

    if (preset === "economy") {
      setFilters({
        kill: false,
        death: false,
        storm_death: false,
        loot: true,
      });
      if (visualMode === "heatmap") setHeatmapMetric("loot");
      return;
    }

    setFilters({
      kill: true,
      death: true,
      storm_death: true,
      loot: true,
    });
  }

  useEffect(() => {
    async function loadOverview() {
      if (!manifest) return;

      setLoading(true);

      try {
        const filteredMatches = manifest.matches
          .filter((m) => m.map === mapName)
          .filter((m) => m.quality_tier !== "debug_only")
          .sort((a, b) => getSnapshotPriority(b) - getSnapshotPriority(a))
          .slice(0, 80);

        let allEvents: OverviewEvent[] = [];

        for (const match of filteredMatches) {
          const data = await loadMatchFile(match.file);

          const matchEvents: OverviewEvent[] = data.events
            .map((e: any) => {
              const type = normalizeOverviewEventType(e.type);
              if (!type) return null;

              return {
                type,
                time_sec: e.time_sec,
                position: e.position,
                player_id: e.player_id,
              };
            })
            .filter(Boolean) as OverviewEvent[];

          allEvents = allEvents.concat(matchEvents);
        }

        const counts: OverviewStats = {
          loadedSnapshots: filteredMatches.length,
          kill: 0,
          death: 0,
          storm_death: 0,
          loot: 0,
        };

        for (const e of allEvents) {
          if (e.type === "kill") counts.kill += 1;
          else if (e.type === "death") counts.death += 1;
          else if (e.type === "storm_death") counts.storm_death += 1;
          else if (e.type === "loot") counts.loot += 1;
        }

        const filteredEvents = allEvents.filter((e) => {
          if (e.type === "kill" && !filters.kill) return false;
          if (e.type === "death" && !filters.death) return false;
          if (e.type === "storm_death" && !filters.storm_death) return false;
          if (e.type === "loot" && !filters.loot) return false;
          return true;
        });

        setStats(counts);
        setEvents(filteredEvents);
      } catch (e) {
        console.error("Overview load failed", e);
      }

      setLoading(false);
    }

    loadOverview();
  }, [manifest, mapName, filters]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px minmax(0, 1fr)",
        gap: "12px",
        alignItems: "start",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "8px",
          alignContent: "start",
        }}
      >
        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Map</div>

          <div style={{ display: "grid", gap: "8px", marginBottom: "8px" }}>
            <ToggleButton
              active={mapName === "AmbroseValley"}
              onClick={() => setMapName("AmbroseValley")}
            >
              Ambrose Valley
            </ToggleButton>

            <ToggleButton
              active={mapName === "GrandRift"}
              onClick={() => setMapName("GrandRift")}
            >
              Grand Rift
            </ToggleButton>

            <ToggleButton
              active={mapName === "Lockdown"}
              onClick={() => setMapName("Lockdown")}
            >
              Lockdown
            </ToggleButton>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <ToggleButton
              active={visualMode === "events"}
              onClick={() => setVisualMode("events")}
            >
              Events
            </ToggleButton>
            <ToggleButton
              active={visualMode === "heatmap"}
              onClick={() => setVisualMode("heatmap")}
            >
              Heatmap
            </ToggleButton>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Presets</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <ToggleButton
              active={activePreset === "combat"}
              onClick={() => applyPreset("combat")}
            >
              Combat
            </ToggleButton>
            <ToggleButton
              active={activePreset === "survival"}
              onClick={() => applyPreset("survival")}
            >
              Survival
            </ToggleButton>
            <ToggleButton
              active={activePreset === "economy"}
              onClick={() => applyPreset("economy")}
            >
              Economy
            </ToggleButton>
            <ToggleButton
              active={activePreset === "all"}
              onClick={() => applyPreset("all")}
            >
              All
            </ToggleButton>
          </div>
        </div>

        {visualMode === "heatmap" && (
          <div style={cardStyle}>
            <div style={sectionTitleStyle}>Heatmap Metric</div>
            <select
              value={heatmapMetric}
              onChange={(e) => setHeatmapMetric(e.target.value as HeatmapMetric)}
              style={selectStyle}
            >
              <option value="kill">Kill Density</option>
              <option value="death">Death Density</option>
              <option value="storm_death">Storm Density</option>
              <option value="loot">Loot Density</option>
            </select>
          </div>
        )}

        <div style={cardStyle}>
          <div style={sectionTitleStyle}>Insights</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <StatPill label="Samples" value={stats.loadedSnapshots} />
            <StatPill label="Kill" value={stats.kill} />
            <StatPill label="Death" value={stats.death} />
            <StatPill label="Storm" value={stats.storm_death} />
            <StatPill label="Loot" value={stats.loot} />
            <StatPill label="Layers" value={activeFilterCount} />
          </div>

          <div style={{ fontSize: "12px", lineHeight: 1.4, opacity: 0.9 }}>
            {insightSummary}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            <LegendItem color="#ef4444" label="Kill hotspot" />
            <LegendItem color="#111827" label="Death cluster" />
            <LegendItem color="#8b5cf6" label="Storm pressure" />
            <LegendItem color="#facc15" label="Loot density" />
          </div>
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          padding: "10px",
        }}
      >
        {loading ? (
          <div>Loading overview...</div>
        ) : (
          <div style={{ height: "720px" }}>
            <MapCanvas
              mapName={mapName}
              imagePath={getMapImagePath(mapName)}
              players={[]}
              events={events}
              showPaths={false}
              showEvents={visualMode === "events"}
              heatmapMode={visualMode === "heatmap"}
              heatmapPoints={heatmapPoints}
              heatmapColor={getHeatmapColor(heatmapMetric)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#0f1726",
  border: "1px solid #1f2a44",
  borderRadius: "14px",
  padding: "10px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  marginBottom: "8px",
};

const selectStyle: React.CSSProperties = {
  background: "#102234",
  color: "white",
  border: "1px solid #243041",
  borderRadius: "10px",
  padding: "9px 10px",
  fontSize: "13px",
  width: "100%",
};