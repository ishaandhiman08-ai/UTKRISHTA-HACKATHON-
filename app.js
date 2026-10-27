// Sentinel - Live Stream Anomaly Detection Engine with GitHub NAB Connection
// Direct connection to: https://github.com/numenta/NAB/tree/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/data

// --- GitHub NAB Configuration ---
const GITHUB_CONFIG = {
  repo: "numenta/NAB",
  commit: "ea702d75cc2258d9d7dd35ca8e5e2539d71f3140",
  shortCommit: "ea702d7",
  treeUrl: "https://github.com/numenta/NAB/tree/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/data",
  rawBaseUrl: "https://raw.githubusercontent.com/numenta/NAB/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/data/",
  labelsUrl: "https://raw.githubusercontent.com/numenta/NAB/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/labels/combined_windows.json",
  labelsTreeUrl: "https://github.com/numenta/NAB/blob/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/labels/combined_windows.json",
};

let fetchSourceMode = "github"; // "github" | "local"
let githubStatus = {
  connected: true,
  lastPingMs: null,
  lastSyncTime: new Date().toLocaleTimeString(),
};

// --- UTC Timestamp Helpers ---
const DEFAULT_EPOCH = Date.UTC(2026, 9, 26, 9, 0, 0);

function getPointTimestamp(dataset, idx) {
  if (dataset && dataset.timestamps && dataset.timestamps[idx]) {
    const raw = dataset.timestamps[idx];
    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) return parsed;
  }
  return DEFAULT_EPOCH + idx * 1000;
}

function formatPointTime(dataset, idx) {
  const ts = getPointTimestamp(dataset, idx);
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
}

function formatPointDateTime(dataset, idx) {
  const ts = getPointTimestamp(dataset, idx);
  return `${new Date(ts).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

// --- Number Format Helpers ---
const formatVal = (val, dec = 2) =>
  val == null || Number.isNaN(Number(val)) ? "—" : Number(val).toFixed(dec);

// --- Severity & Status Definitions ---
const SEVERITIES = {
  critical: {
    label: "Critical",
    badge: "border-danger/40 bg-danger/15 text-danger",
    dot: "bg-danger",
    bar: "bg-danger",
    hex: "#f87171",
  },
  high: {
    label: "High",
    badge: "border-warn/40 bg-warn/15 text-warn",
    dot: "bg-warn",
    bar: "bg-warn",
    hex: "#fb923c",
  },
  medium: {
    label: "Medium",
    badge: "border-yellow-400/40 bg-yellow-400/15 text-yellow-200",
    dot: "bg-yellow-300",
    bar: "bg-yellow-400",
    hex: "#fbbf24",
  },
  low: {
    label: "Low",
    badge: "border-signal/40 bg-signal/15 text-signal",
    dot: "bg-signal",
    bar: "bg-signal",
    hex: "#22d3ee",
  },
};

const getSeverity = (score, thr) => {
  const ratio = thr > 0 ? score / thr : 0;
  if (ratio >= 2.0) return "critical";
  if (ratio >= 1.5) return "high";
  if (ratio >= 1.2) return "medium";
  return "low";
};

const STATUSES = {
  confirmed: {
    label: "Confirmed",
    badge: "border-success/40 bg-success/15 text-success",
  },
  false_positive: {
    label: "False positive",
    badge: "border-warn/40 bg-warn/15 text-warn",
  },
  unverified: {
    label: "Unverified",
    badge: "border-border bg-muted/60 text-muted-foreground",
  },
};

// --- Seeded PRNG & Synthetic Benchmark Datasets ---
function createLcg(seed) {
  let t = seed;
  return () => {
    t = (t * 1664525 + 1013904223) % 4294967296;
    return t / 4294967296;
  };
}

function gaussian(rng) {
  return (
    Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng())
  );
}

const SYNTHETIC_SPECS = [
  {
    id: "machine_temp",
    name: "Machine temperature (simulated)",
    category: "Synthetic",
    seed: 7,
    base: 70,
    amp: 6,
    period: 96,
    noise: 1.2,
    drift: 0.004,
    anoms: [
      { at: 300, type: "spike", len: 6, mag: 14 },
      { at: 560, type: "shift", len: 40, mag: -16 },
      { at: 820, type: "burst", len: 30, mag: 6 },
    ],
  },
  {
    id: "cpu_util",
    name: "CPU utilization (simulated)",
    category: "Synthetic",
    seed: 21,
    base: 45,
    amp: 10,
    period: 144,
    noise: 2.5,
    drift: 0,
    anoms: [
      { at: 250, type: "burst", len: 28, mag: 7 },
      { at: 520, type: "spike", len: 5, mag: 45 },
      { at: 780, type: "shift", len: 45, mag: 25 },
    ],
  },
  {
    id: "taxi_demand",
    name: "NYC taxi demand (simulated)",
    category: "Synthetic",
    seed: 42,
    base: 400,
    amp: 180,
    period: 48,
    noise: 25,
    drift: 0,
    anoms: [
      { at: 340, type: "shift", len: 36, mag: -260 },
      { at: 610, type: "spike", len: 6, mag: 420 },
      { at: 880, type: "burst", len: 24, mag: 5 },
    ],
  },
  {
    id: "ad_ctr",
    name: "Ad click rate (simulated)",
    category: "Synthetic",
    seed: 99,
    base: 12,
    amp: 2,
    period: 72,
    noise: 0.7,
    drift: 0.002,
    anoms: [
      { at: 220, type: "spike", len: 5, mag: 9 },
      { at: 470, type: "burst", len: 30, mag: 5 },
      { at: 740, type: "shift", len: 40, mag: 6 },
    ],
  },
];

function generateSyntheticDatasets(totalPoints = 1000) {
  return SYNTHETIC_SPECS.map((spec) => {
    const rng = createLcg(spec.seed);
    const values = [];
    for (let i = 0; i < totalPoints; i++) {
      const val =
        spec.base +
        spec.drift * i * 10 +
        spec.amp * Math.sin((2 * Math.PI * i) / spec.period) +
        gaussian(rng) * spec.noise;
      values.push(val);
    }
    const windows = spec.anoms.map((anom) => {
      for (let j = 0; j < anom.len; j++) {
        const idx = anom.at + j;
        if (idx < totalPoints) {
          if (anom.type === "spike") {
            values[idx] += anom.mag * (1 - j / (anom.len + 1));
          } else if (anom.type === "shift") {
            values[idx] += anom.mag;
          } else if (anom.type === "burst") {
            values[idx] += gaussian(rng) * spec.noise * anom.mag;
          }
        }
      }
      return {
        start: anom.at,
        end: anom.at + anom.len - 1,
        type: anom.type,
      };
    });
    return {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      values,
      windows,
      timestamps: values.map((_, i) => new Date(DEFAULT_EPOCH + i * 1000).toISOString()),
    };
  });
}

// --- Statistical Math Helpers ---
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
const stdDev = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
};
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// --- Sentinel Hybrid Anomaly Detection Algorithm ---
function runSentinelDetection(
  values,
  { win = 60, k = 4, minRun = 2, mode = "sentinel" } = {}
) {
  const t0 = performance.now();
  const n = values.length;
  const res = {
    score: Array(n).fill(0),
    thr: Array(n).fill(null),
    expected: Array(n).fill(null),
    flag: Array(n).fill(false),
    comp: Array(n).fill(null),
  };

  const history = [];
  const scoreHistory = [];
  let ewma = null;
  let variance = 1;
  let consecFlags = 0;
  let suppressed = 0;

  for (let i = 0; i < n; i++) {
    const val = values[i];
    if (history.length < Math.floor(win / 2)) {
      history.push(val);
      ewma = ewma === null ? val : 0.1 * val + 0.9 * ewma;
      continue;
    }

    if (mode === "baseline") {
      const windowSlice = history.slice(-win);
      const m = mean(windowSlice);
      const s = stdDev(windowSlice) || 1e-6;
      const score = Math.abs(val - m) / s;
      res.score[i] = score;
      res.thr[i] = 3;
      res.expected[i] = m;
      res.flag[i] = score > 3;
      res.comp[i] = { robust: score, ewma: 0, change: 0, sd: s };
      history.push(val);
      continue;
    }

    const windowSlice = history.slice(-win);
    const med = median(windowSlice);
    const sd = stdDev(windowSlice);
    const mad = Math.max(
      median(windowSlice.map((v) => Math.abs(v - med))) * 1.4826,
      0.1 * sd,
      1e-6
    );

    const robust = Math.abs(val - med) / mad;
    const ewmaRes = Math.abs(val - ewma) / Math.sqrt(variance + 1e-9);

    const diffs = windowSlice.slice(1).map((v, idx) => Math.abs(v - windowSlice[idx]));
    const abrupt =
      Math.abs(val - windowSlice[windowSlice.length - 1]) /
      (mean(diffs) * 1.25 + 1e-6);

    const compositeScore = 0.5 * robust + 0.3 * ewmaRes + 0.2 * abrupt;

    const recentScores = scoreHistory.slice(-200);
    const adaptiveThr =
      recentScores.length > 20
        ? Math.max(3, mean(recentScores) + k * stdDev(recentScores))
        : 6;

    const isExceeded = compositeScore > adaptiveThr;
    consecFlags = isExceeded ? consecFlags + 1 : 0;

    res.score[i] = compositeScore;
    res.thr[i] = adaptiveThr;
    res.expected[i] = med;
    res.flag[i] = isExceeded && consecFlags >= minRun;
    res.comp[i] = { robust, ewma: ewmaRes, change: abrupt, sd: mad };

    if (isExceeded) suppressed++;
    else suppressed = 0;

    if (!isExceeded || suppressed > win / 2) {
      history.push(val);
      if (!isExceeded) scoreHistory.push(compositeScore);
      const err = val - ewma;
      variance = 0.95 * variance + 0.05 * err * err;
      ewma = 0.1 * val + 0.9 * ewma;
      if (suppressed > win / 2) suppressed = 0;
    }

    if (history.length > win * 3) history.shift();
  }

  const duration = performance.now() - t0;
  return {
    ...res,
    msPerPoint: duration / n,
    totalMs: duration,
  };
}

// --- Cluster Flagged Points into Event Windows ---
const MIN_SUSTAINED_ANOMALY_POINTS = 10;

function clusterEvents(detectionRes, rawValues, maxGap = 5) {
  const clusters = [];
  let current = null;

  detectionRes.flag.forEach((flagged, idx) => {
    if (flagged) {
      if (current && idx - current.end <= maxGap) {
        current.end = idx;
      } else {
        current = { start: idx, end: idx };
        clusters.push(current);
      }
    }
  });

  return clusters.map((c, eventId) => {
    let peakIdx = c.start;
    for (let i = c.start; i <= c.end; i++) {
      if (detectionRes.score[i] > detectionRes.score[peakIdx]) {
        peakIdx = i;
      }
    }
    const comp = detectionRes.comp[peakIdx] || { robust: 1, ewma: 1, change: 1 };
    const parts = [
      ["robust deviation from rolling median", comp.robust * 0.5],
      ["EWMA residual", comp.ewma * 0.3],
      ["abrupt change", comp.change * 0.2],
    ];
    parts.sort((a, b) => b[1] - a[1]);

    const exp = detectionRes.expected[peakIdx];
    const obs = rawValues[peakIdx];
    const direction = obs >= exp ? "above" : "below";
    const dev = Math.abs(obs - exp);
    const evidence = `Value ${obs.toFixed(1)} is ${dev.toFixed(1)} ${direction} expected ${exp.toFixed(1)} (${comp.robust.toFixed(1)}σ robust). Score ${detectionRes.score[peakIdx].toFixed(1)} exceeded adaptive threshold ${detectionRes.thr[peakIdx].toFixed(1)}. Main driver: ${parts[0][0]}.`;

    return {
      id: eventId,
      start: c.start,
      end: c.end,
      peak: peakIdx,
      score: detectionRes.score[peakIdx],
      thr: detectionRes.thr[peakIdx],
      label: "ANOMALOUS",
      evidence,
      parts: parts.map(([name, value]) => ({ name, value })),
    };
  });
}

// --- Evaluate Ground Truth Matching ---
function evaluateMatches(events, truthWindows, slack = 10) {
  const matchedTruth = new Set();
  const delays = [];

  const evaluatedEvents = events.map((ev) => {
    const truthIdx = (truthWindows || []).findIndex(
      (tw) => ev.start <= tw.end + slack && ev.end >= tw.start
    );
    const isTp = truthIdx >= 0;
    if (isTp) {
      if (!matchedTruth.has(truthIdx)) {
        delays.push(Math.max(0, ev.start - truthWindows[truthIdx].start));
        matchedTruth.add(truthIdx);
      }
    }
    return {
      ...ev,
      tp: isTp,
      window: truthIdx,
    };
  });

  const tpCount = evaluatedEvents.filter((e) => e.tp).length;
  const prec = evaluatedEvents.length ? tpCount / evaluatedEvents.length : 0;
  const rec = (truthWindows || []).length ? matchedTruth.size / truthWindows.length : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  const medianDelay = delays.length ? mean(delays) : null;

  return {
    events: evaluatedEvents,
    precision: prec,
    recall: rec,
    f1,
    delay: medianDelay,
    detected: matchedTruth.size,
    fp: evaluatedEvents.length - tpCount,
  };
}

// --- GLOBAL DATA STORE & REGISTRY ---
const syntheticDatasets = generateSyntheticDatasets(1000);
const allDatasets = new Map();

syntheticDatasets.forEach((d) => allDatasets.set(d.id, d));

if (typeof NAB_FEATURED_DATASETS !== "undefined") {
  Object.values(NAB_FEATURED_DATASETS).forEach((d) => {
    allDatasets.set(d.id, d);
  });
}

let currentDsId = "machine_temperature_system_failure";
if (!allDatasets.has(currentDsId)) {
  currentDsId = syntheticDatasets[0].id;
}
let currentDataset = allDatasets.get(currentDsId);
let customDataset = null;

let cursor = 360;
let isPlaying = true;
let isDemo = false;
let showGroundTruth = true;
let selectedEventId = 0;

let severityFilter = "all";
let statusFilter = "all";

const params = { win: 60, k: 4, minRun: 2 };

let detectionData = null;
let allEvents = [];
let streamInterval = null;

function recomputeDetection() {
  const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
  const res = runSentinelDetection(ds.values, { ...params, mode: "sentinel" });
  const rawEvents = clusterEvents(res, ds.values);
  const evalResult = evaluateMatches(rawEvents, ds.windows || []);

  allEvents = evalResult.events.map((e) => ({
    ...e,
    ts: getPointTimestamp(ds, e.peak),
    observed: ds.values[e.peak],
    expected: res.expected[e.peak],
    severity: getSeverity(e.score, e.thr),
    status:
      !ds.windows || ds.windows.length === 0
        ? "unverified"
        : e.tp
        ? "confirmed"
        : "false_positive",
  }));

  detectionData = res;
}

recomputeDetection();

// --- DOM ELEMENTS ---
const elements = {
  dsSelectHeader: document.getElementById("dsSelectHeader"),
  dsSelectMain: document.getElementById("dsSelectMain"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  progressBar: document.getElementById("progressBar"),
  ptsCounter: document.getElementById("ptsCounter"),
  streamStatusPill: document.getElementById("streamStatusPill"),
  groundTruthCheckbox: document.getElementById("groundTruthCheckbox"),
  sourceNote: document.getElementById("sourceNote"),
  dsBadge: document.getElementById("dsBadge"),
  truthBadge: document.getElementById("truthBadge"),
  eventCountHeader: document.getElementById("eventCountHeader"),
  streamingStatusHeader: document.getElementById("streamingStatusHeader"),
  severityFilter: document.getElementById("severityFilter"),
  statusFilter: document.getElementById("statusFilter"),
  eventsList: document.getElementById("eventsList"),
  inspectionPanel: document.getElementById("inspectionPanel"),
  launchDemoBtn: document.getElementById("launchDemoBtn"),
  launchDemoHeaderBtn: document.getElementById("launchDemoHeaderBtn"),
  chartTopCanvas: document.getElementById("chartTopCanvas"),
  chartBottomCanvas: document.getElementById("chartBottomCanvas"),
  chartTooltip: document.getElementById("chartTooltip"),
  uploadSeriesLink: document.getElementById("uploadSeriesLink"),
  fileUploadInput: document.getElementById("fileUploadInput"),
  notificationsBtn: document.getElementById("notificationsBtn"),
  notificationsModal: document.getElementById("notificationsModal"),
  closeNotifications: document.getElementById("closeNotifications"),
  notificationsList: document.getElementById("notificationsList"),
  browseNabBtn: document.getElementById("browseNabBtn"),
  browseNabSidebarBtn: document.getElementById("browseNabSidebarBtn"),
  nabModal: document.getElementById("nabModal"),
  closeNabModal: document.getElementById("closeNabModal"),
  nabSearchInput: document.getElementById("nabSearchInput"),
  nabCategoryFilter: document.getElementById("nabCategoryFilter"),
  nabTableBody: document.getElementById("nabTableBody"),
  githubStatusBtn: document.getElementById("githubStatusBtn"),
  githubModal: document.getElementById("githubModal"),
  closeGithubModal: document.getElementById("closeGithubModal"),
  githubPingLabel: document.getElementById("githubPingLabel"),
  githubSyncBtn: document.getElementById("githubSyncBtn"),
  fetchModeSelect: document.getElementById("fetchModeSelect"),
  currentGithubLink: document.getElementById("currentGithubLink"),
  githubSourceBadge: document.getElementById("githubSourceBadge"),
};

// --- GITHUB NAB LIVE FETCHER ---
async function fetchDatasetFromGithubOrLocal(entry) {
  const t0 = performance.now();
  let text = null;
  let sourceOrigin = "local";

  const githubUrl = entry.githubRawUrl || `${GITHUB_CONFIG.rawBaseUrl}${entry.category}/${entry.filename}`;
  const localUrl = `data/nab/${entry.filename}`;

  if (fetchSourceMode === "github") {
    try {
      const resp = await fetch(githubUrl, { cache: "no-cache" });
      if (resp.ok) {
        text = await resp.text();
        sourceOrigin = "github";
        githubStatus.connected = true;
        githubStatus.lastPingMs = Math.round(performance.now() - t0);
        updateGithubUI();
      }
    } catch (e) {
      console.warn("GitHub fetch failed, falling back to local copy:", e);
    }
  }

  // Fallback to local copy
  if (!text) {
    try {
      const resp = await fetch(localUrl);
      if (resp.ok) {
        text = await resp.text();
        sourceOrigin = "local";
      }
    } catch (e) {
      console.error("Local fetch also failed:", e);
    }
  }

  if (!text) throw new Error(`Could not load dataset ${entry.filename}`);

  const lines = text.trim().split(/[\r\n]+/);
  const timestamps = [];
  const values = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 2 && parts[1] !== "") {
      const v = parseFloat(parts[1]);
      if (!isNaN(v)) {
        timestamps.push(parts[0].trim());
        values.push(v);
      }
    }
  }

  const loaded = {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    filename: entry.filename,
    values,
    timestamps,
    windows: entry.windows || [],
    fullLength: values.length,
    sourceOrigin,
    githubPath: entry.githubPath || `data/${entry.category}/${entry.filename}`,
    githubTreeUrl: entry.githubTreeUrl || `https://github.com/numenta/NAB/blob/${GITHUB_CONFIG.commit}/data/${entry.category}/${entry.filename}`,
  };

  allDatasets.set(entry.id, loaded);
  return loaded;
}

// --- TEST GITHUB CONNECTION PING ---
async function pingGithubConnection() {
  const t0 = performance.now();
  try {
    const resp = await fetch(
      `${GITHUB_CONFIG.rawBaseUrl}realKnownCause/ambient_temperature_system_failure.csv`,
      { method: "HEAD", cache: "no-cache" }
    );
    const ms = Math.round(performance.now() - t0);
    githubStatus.connected = resp.ok;
    githubStatus.lastPingMs = ms;
    githubStatus.lastSyncTime = new Date().toLocaleTimeString();
  } catch (err) {
    githubStatus.connected = false;
    githubStatus.lastPingMs = null;
  }
  updateGithubUI();
}

function updateGithubUI() {
  if (elements.githubPingLabel) {
    if (githubStatus.connected && githubStatus.lastPingMs !== null) {
      elements.githubPingLabel.innerHTML = `<span class="text-success font-semibold">Online (${githubStatus.lastPingMs} ms)</span>`;
    } else if (githubStatus.connected) {
      elements.githubPingLabel.innerHTML = `<span class="text-success font-semibold">Connected</span>`;
    } else {
      elements.githubPingLabel.innerHTML = `<span class="text-warn font-semibold">Offline / Cached mode</span>`;
    }
  }

  if (elements.githubStatusBtn) {
    const dot = elements.githubStatusBtn.querySelector(".github-dot");
    if (dot) {
      dot.className = `github-dot h-2 w-2 rounded-full ${
        githubStatus.connected ? "bg-success animate-pulse" : "bg-warn"
      }`;
    }
  }
}

// --- POPULATE DATASET DROPDOWNS ---
function populateDropdowns() {
  const categories = [
    { label: "🏢 Real — Known Causes (NAB Benchmark)", match: "realKnownCause" },
    { label: "☁️ Real — AWS CloudWatch Metrics", match: "realAWSCloudwatch" },
    { label: "📈 Real — Online Ad Exchange", match: "realAdExchange" },
    { label: "🚦 Real — Traffic Sensors", match: "realTraffic" },
    { label: "🐦 Real — Twitter Mentions Volume", match: "realTweets" },
    { label: "🧪 Artificial — Injected Anomalies", match: "artificialWithAnomaly" },
    { label: "🔬 Artificial — No Anomaly (Control)", match: "artificialNoAnomaly" },
    { label: "⚡ Simulated Benchmark Streams", match: "Synthetic" },
  ];

  const buildGroups = () => {
    const catalog = typeof NAB_CATALOG !== "undefined" ? NAB_CATALOG : [];
    const fragment = document.createDocumentFragment();

    categories.forEach((cat) => {
      const optGroup = document.createElement("optgroup");
      optGroup.label = cat.label;

      let matchedItems = [];
      if (cat.match === "Synthetic") {
        matchedItems = syntheticDatasets.map((d) => ({
          id: d.id,
          name: d.name,
        }));
      } else {
        matchedItems = catalog
          .filter((item) => item.category === cat.match)
          .map((item) => ({
            id: item.id,
            name: `${item.name}${item.windowsCount ? ` · ${item.windowsCount} anomalies` : ""}`,
          }));
      }

      if (matchedItems.length > 0) {
        matchedItems.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = m.name;
          optGroup.appendChild(opt);
        });
        fragment.appendChild(optGroup);
      }
    });

    if (customDataset) {
      const customGroup = document.createElement("optgroup");
      customGroup.label = "📁 Custom Uploaded Series";
      const opt = document.createElement("option");
      opt.value = "custom";
      opt.textContent = customDataset.name;
      customGroup.appendChild(opt);
      fragment.appendChild(customGroup);
    }

    return fragment;
  };

  elements.dsSelectHeader.innerHTML = "";
  elements.dsSelectHeader.appendChild(buildGroups());
  elements.dsSelectHeader.value = currentDsId;

  elements.dsSelectMain.innerHTML = "";
  elements.dsSelectMain.appendChild(buildGroups());
  elements.dsSelectMain.value = currentDsId;
}

// --- CHART RENDERING (Interactive Dual-Canvas) ---
let hoverIdx = null;

function renderCharts() {
  const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
  if (!detectionData || !elements.chartTopCanvas || !elements.chartBottomCanvas) return;

  const visibleEnd = Math.min(cursor, ds.values.length);
  const visibleStart = 0;
  const count = visibleEnd - visibleStart;

  const dpr = window.devicePixelRatio || 1;
  const topCanvas = elements.chartTopCanvas;
  const bottomCanvas = elements.chartBottomCanvas;

  const topRect = topCanvas.getBoundingClientRect();
  const bottomRect = bottomCanvas.getBoundingClientRect();

  if (topRect.width === 0 || bottomRect.width === 0) return;

  topCanvas.width = topRect.width * dpr;
  topCanvas.height = 300 * dpr;
  bottomCanvas.width = bottomRect.width * dpr;
  bottomCanvas.height = 130 * dpr;

  const ctxTop = topCanvas.getContext("2d");
  const ctxBottom = bottomCanvas.getContext("2d");

  ctxTop.scale(dpr, dpr);
  ctxBottom.scale(dpr, dpr);

  const W = topRect.width;
  const H_top = 300;
  const H_bot = 130;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 25;

  const chartW = W - padLeft - padRight;
  const chartH_top = H_top - padTop - padBottom;
  const chartH_bot = H_bot - padTop - padBottom;

  ctxTop.clearRect(0, 0, W, H_top);
  ctxBottom.clearRect(0, 0, W, H_bot);

  if (count <= 1) {
    ctxTop.fillStyle = "#64748b";
    ctxTop.font = "12px Inter, sans-serif";
    ctxTop.textAlign = "center";
    ctxTop.fillText("Waiting for data stream to begin...", W / 2, H_top / 2);
    return;
  }

  // --- Scales for TOP CHART ---
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const v = ds.values[i];
    const exp = detectionData.expected[i] || v;
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    if (exp < minVal) minVal = exp;
    if (exp > maxVal) maxVal = exp;
  }
  const valMargin = (maxVal - minVal) * 0.15 || 5;
  minVal -= valMargin;
  maxVal += valMargin;

  const getX = (idx) => padLeft + ((idx - visibleStart) / (count - 1)) * chartW;
  const getY_top = (val) => padTop + chartH_top - ((val - minVal) / (maxVal - minVal)) * chartH_top;

  // Grid Lines (Top)
  ctxTop.strokeStyle = "#1b2436";
  ctxTop.lineWidth = 1;
  const numGridLines = 4;
  ctxTop.fillStyle = "#64748b";
  ctxTop.font = "10px ui-monospace, monospace";
  ctxTop.textAlign = "right";

  for (let g = 0; g <= numGridLines; g++) {
    const yVal = minVal + (g / numGridLines) * (maxVal - minVal);
    const yPx = getY_top(yVal);
    ctxTop.beginPath();
    ctxTop.moveTo(padLeft, yPx);
    ctxTop.lineTo(padLeft + chartW, yPx);
    ctxTop.stroke();
    ctxTop.fillText(yVal.toFixed(0), padLeft - 6, yPx + 3);
  }

  // Draw Ground Truth Windows
  if (showGroundTruth && ds.windows && ds.windows.length > 0) {
    ctxTop.fillStyle = "rgba(251, 191, 36, 0.12)";
    ctxTop.strokeStyle = "rgba(251, 191, 36, 0.45)";
    ctxTop.lineWidth = 1;

    ds.windows.forEach((w) => {
      if (w.end >= visibleStart && w.start < visibleEnd) {
        const x1 = Math.max(padLeft, getX(w.start));
        const x2 = Math.min(padLeft + chartW, getX(w.end));
        const width = Math.max(4, x2 - x1);

        ctxTop.fillRect(x1, padTop, width, chartH_top);
        ctxTop.strokeRect(x1, padTop, width, chartH_top);

        ctxTop.fillStyle = "rgba(251, 191, 36, 0.85)";
        ctxTop.font = "9px ui-monospace, monospace";
        ctxTop.textAlign = "center";
        ctxTop.fillText("LABELLED ANOMALY", x1 + width / 2, padTop + 14);
      }
    });
  }

  // Highlight sustained detected events around the observed signal.
  const pointWidth = chartW / (count - 1);
  allEvents.forEach((event) => {
    if (
      event.end - event.start + 1 < MIN_SUSTAINED_ANOMALY_POINTS ||
      event.end < visibleStart ||
      event.start >= visibleEnd
    ) {
      return;
    }

    const start = Math.max(visibleStart, event.start);
    const end = Math.min(visibleEnd - 1, event.end);
    let eventMin = Infinity;
    let eventMax = -Infinity;
    for (let i = start; i <= end; i++) {
      eventMin = Math.min(eventMin, ds.values[i]);
      eventMax = Math.max(eventMax, ds.values[i]);
    }
    const valuePadding = Math.max((eventMax - eventMin) * 0.08, (maxVal - minVal) * 0.015);
    const x1 = Math.max(padLeft, getX(start) - pointWidth / 2);
    const x2 = Math.min(padLeft + chartW, getX(end) + pointWidth / 2);
    const y1 = Math.max(padTop, getY_top(eventMax + valuePadding));
    const y2 = Math.min(padTop + chartH_top, getY_top(eventMin - valuePadding));

    ctxTop.fillStyle = "rgba(248, 113, 113, 0.12)";
    ctxTop.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctxTop.strokeStyle = "rgba(248, 113, 113, 0.9)";
    ctxTop.lineWidth = 1.5;
    ctxTop.setLineDash([5, 3]);
    ctxTop.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctxTop.setLineDash([]);

    if (x2 - x1 > 110) {
      ctxTop.fillStyle = "#fca5a5";
      ctxTop.font = "9px ui-monospace, monospace";
      ctxTop.textAlign = "left";
      ctxTop.fillText("SUSTAINED ANOMALY", x1 + 5, y1 + 12);
    }
  });

  // Gradient Fill under Value Curve
  const grad = ctxTop.createLinearGradient(0, padTop, 0, padTop + chartH_top);
  grad.addColorStop(0, "rgba(34, 211, 238, 0.25)");
  grad.addColorStop(1, "rgba(34, 211, 238, 0.0)");

  ctxTop.beginPath();
  ctxTop.moveTo(getX(visibleStart), getY_top(ds.values[visibleStart]));
  for (let i = visibleStart + 1; i < visibleEnd; i++) {
    ctxTop.lineTo(getX(i), getY_top(ds.values[i]));
  }
  ctxTop.lineTo(getX(visibleEnd - 1), padTop + chartH_top);
  ctxTop.lineTo(getX(visibleStart), padTop + chartH_top);
  ctxTop.closePath();
  ctxTop.fillStyle = grad;
  ctxTop.fill();

  // Draw Expected Baseline (Dashed #64748b)
  ctxTop.beginPath();
  ctxTop.setLineDash([4, 4]);
  ctxTop.strokeStyle = "#64748b";
  ctxTop.lineWidth = 1.3;
  let startedBaseline = false;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const exp = detectionData.expected[i];
    if (exp != null) {
      if (!startedBaseline) {
        ctxTop.moveTo(getX(i), getY_top(exp));
        startedBaseline = true;
      } else {
        ctxTop.lineTo(getX(i), getY_top(exp));
      }
    }
  }
  ctxTop.stroke();
  ctxTop.setLineDash([]);

  // Draw Observed Value Curve (Cyan #22d3ee)
  ctxTop.beginPath();
  ctxTop.strokeStyle = "#22d3ee";
  ctxTop.lineWidth = 1.6;
  for (let i = visibleStart; i < visibleEnd; i++) {
    if (i === visibleStart) {
      ctxTop.moveTo(getX(i), getY_top(ds.values[i]));
    } else {
      ctxTop.lineTo(getX(i), getY_top(ds.values[i]));
    }
  }
  ctxTop.stroke();

  // Draw Flagged Anomaly Points (Red Glowing Dots #f87171)
  for (let i = visibleStart; i < visibleEnd; i++) {
    if (detectionData.flag[i]) {
      const cx = getX(i);
      const cy = getY_top(ds.values[i]);

      ctxTop.fillStyle = "#f87171";
      ctxTop.shadowColor = "#f87171";
      ctxTop.shadowBlur = 8;
      ctxTop.beginPath();
      ctxTop.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctxTop.fill();
      ctxTop.shadowBlur = 0;
    }
  }

  // --- Scales for BOTTOM CHART ---
  let maxScore = 8;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const sc = detectionData.score[i] || 0;
    const th = detectionData.thr[i] || 0;
    if (sc > maxScore) maxScore = sc;
    if (th > maxScore) maxScore = th;
  }
  maxScore = Math.ceil(maxScore * 1.15);

  const getY_bot = (score) => padTop + chartH_bot - (score / maxScore) * chartH_bot;

  // Grid Lines (Bottom)
  ctxBottom.strokeStyle = "#1b2436";
  ctxBottom.lineWidth = 1;
  ctxBottom.fillStyle = "#64748b";
  ctxBottom.font = "10px ui-monospace, monospace";
  ctxBottom.textAlign = "right";

  for (let g = 0; g <= 3; g++) {
    const scVal = (g / 3) * maxScore;
    const yPx = getY_bot(scVal);
    ctxBottom.beginPath();
    ctxBottom.moveTo(padLeft, yPx);
    ctxBottom.lineTo(padLeft + chartW, yPx);
    ctxBottom.stroke();
    ctxBottom.fillText(scVal.toFixed(0), padLeft - 6, yPx + 3);
  }

  // Score Gradient Fill (#8b5cf6)
  const scoreGrad = ctxBottom.createLinearGradient(0, padTop, 0, padTop + chartH_bot);
  scoreGrad.addColorStop(0, "rgba(139, 92, 246, 0.32)");
  scoreGrad.addColorStop(1, "rgba(139, 92, 246, 0.0)");

  ctxBottom.beginPath();
  ctxBottom.moveTo(getX(visibleStart), getY_bot(detectionData.score[visibleStart] || 0));
  for (let i = visibleStart + 1; i < visibleEnd; i++) {
    ctxBottom.lineTo(getX(i), getY_bot(detectionData.score[i] || 0));
  }
  ctxBottom.lineTo(getX(visibleEnd - 1), padTop + chartH_bot);
  ctxBottom.lineTo(getX(visibleStart), padTop + chartH_bot);
  ctxBottom.closePath();
  ctxBottom.fillStyle = scoreGrad;
  ctxBottom.fill();

  // Score Curve (#a78bfa)
  ctxBottom.beginPath();
  ctxBottom.strokeStyle = "#a78bfa";
  ctxBottom.lineWidth = 1.3;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const sc = detectionData.score[i] || 0;
    if (i === visibleStart) ctxBottom.moveTo(getX(i), getY_bot(sc));
    else ctxBottom.lineTo(getX(i), getY_bot(sc));
  }
  ctxBottom.stroke();

  // Adaptive Threshold Curve (#fb923c Dashed [5, 3])
  ctxBottom.beginPath();
  ctxBottom.setLineDash([5, 3]);
  ctxBottom.strokeStyle = "#fb923c";
  ctxBottom.lineWidth = 1.4;
  let startedThr = false;
  for (let i = visibleStart; i < visibleEnd; i++) {
    const th = detectionData.thr[i];
    if (th != null) {
      if (!startedThr) {
        ctxBottom.moveTo(getX(i), getY_bot(th));
        startedThr = true;
      } else {
        ctxBottom.lineTo(getX(i), getY_bot(th));
      }
    }
  }
  ctxBottom.stroke();
  ctxBottom.setLineDash([]);

  // Time Axis Labels (Bottom)
  ctxBottom.fillStyle = "#64748b";
  ctxBottom.font = "9px ui-monospace, monospace";
  ctxBottom.textAlign = "center";
  const numTimeLabels = 6;
  for (let l = 0; l <= numTimeLabels; l++) {
    const sampleIdx = Math.floor(visibleStart + (l / numTimeLabels) * (count - 1));
    const px = getX(sampleIdx);
    ctxBottom.fillText(formatPointTime(ds, sampleIdx), px, H_bot - 6);
  }

  // Crosshair & Tooltip
  if (hoverIdx !== null && hoverIdx >= visibleStart && hoverIdx < visibleEnd) {
    const hx = getX(hoverIdx);

    ctxTop.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctxTop.setLineDash([3, 3]);
    ctxTop.beginPath();
    ctxTop.moveTo(hx, padTop);
    ctxTop.lineTo(hx, padTop + chartH_top);
    ctxTop.stroke();

    const obsVal = ds.values[hoverIdx];
    ctxTop.fillStyle = "#22d3ee";
    ctxTop.beginPath();
    ctxTop.arc(hx, getY_top(obsVal), 4, 0, Math.PI * 2);
    ctxTop.fill();
    ctxTop.setLineDash([]);

    ctxBottom.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctxBottom.setLineDash([3, 3]);
    ctxBottom.beginPath();
    ctxBottom.moveTo(hx, padTop);
    ctxBottom.lineTo(hx, padTop + chartH_bot);
    ctxBottom.stroke();
    ctxBottom.setLineDash([]);
  }
}

// --- TOOLTIP HANDLER ---
function setupChartEvents() {
  const topCanvas = elements.chartTopCanvas;
  const bottomCanvas = elements.chartBottomCanvas;
  const tooltip = elements.chartTooltip;

  function handleMove(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const padLeft = 45;
    const padRight = 15;
    const chartW = rect.width - padLeft - padRight;

    const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
    const visibleEnd = Math.min(cursor, ds.values.length);
    const visibleStart = 0;
    const count = visibleEnd - visibleStart;

    if (x < padLeft || x > padLeft + chartW || count <= 1) {
      hoverIdx = null;
      tooltip.classList.add("hidden");
      renderCharts();
      return;
    }

    const relX = (x - padLeft) / chartW;
    hoverIdx = Math.round(visibleStart + relX * (count - 1));
    hoverIdx = Math.max(visibleStart, Math.min(visibleEnd - 1, hoverIdx));

    renderCharts();

    const obs = ds.values[hoverIdx];
    const exp = detectionData.expected[hoverIdx] || obs;
    const score = detectionData.score[hoverIdx] || 0;
    const thr = detectionData.thr[hoverIdx] || 3;
    const isFlagged = detectionData.flag[hoverIdx];
    const timeFormatted = formatPointDateTime(ds, hoverIdx);

    tooltip.innerHTML = `
      <div class="text-[10px] text-muted-foreground pb-1 border-b border-border/40 font-mono">
        ${timeFormatted} · point #${hoverIdx}
      </div>
      <div class="pt-1.5 space-y-1 text-[11px]">
        <div class="flex justify-between gap-4">
          <span class="text-cyan-400">Observed:</span>
          <span class="font-bold text-foreground">${obs.toFixed(2)}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-slate-400">Baseline:</span>
          <span class="font-mono text-foreground">${exp.toFixed(2)}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-purple-400">Score / Thr:</span>
          <span class="font-mono">${score.toFixed(2)} / ${thr.toFixed(2)}</span>
        </div>
        ${
          isFlagged
            ? `<div class="mt-1 pt-1 border-t border-danger/30 text-danger font-semibold flex items-center gap-1">
                 <span class="w-2 h-2 rounded-full bg-danger animate-ping inline-block"></span> ANOMALY FLAGGED
               </div>`
            : `<div class="mt-1 text-slate-500 text-[10px]">Normal stream variation</div>`
        }
      </div>
    `;

    tooltip.classList.remove("hidden");
    const tipX = Math.min(window.innerWidth - 230, e.clientX + 16);
    const tipY = e.clientY + 10;
    tooltip.style.left = `${tipX}px`;
    tooltip.style.top = `${tipY}px`;
  }

  function handleLeave() {
    hoverIdx = null;
    tooltip.classList.add("hidden");
    renderCharts();
  }

  topCanvas.addEventListener("mousemove", (e) => handleMove(e, topCanvas));
  topCanvas.addEventListener("mouseleave", handleLeave);
  bottomCanvas.addEventListener("mousemove", (e) => handleMove(e, bottomCanvas));
  bottomCanvas.addEventListener("mouseleave", handleLeave);
}

// --- RENDER EVENT LIST ---
function renderEventList() {
  const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
  const visibleEvents = allEvents.filter((e) => e.start < cursor);
  const filtered = visibleEvents.filter((e) => {
    const sevMatch = severityFilter === "all" || e.severity === severityFilter;
    const statMatch = statusFilter === "all" || e.status === statusFilter;
    return sevMatch && statMatch;
  });

  elements.eventCountHeader.textContent = `Flagged events (${filtered.length})`;
  elements.streamingStatusHeader.textContent = isPlaying
    ? "Streaming in progress"
    : "Paused";

  if (filtered.length === 0) {
    elements.eventsList.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <span class="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-muted/40 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan-search"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><circle cx="12" cy="12" r="3"></circle><path d="m16 16-1.9-1.9"></path></svg>
        </span>
        <p class="text-sm font-medium text-foreground">No events match these filters</p>
        <p class="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Clear the severity or status filter, or keep streaming until the first window is flagged.
        </p>
      </div>
    `;
    return;
  }

  elements.eventsList.innerHTML = filtered
    .map((e) => {
      const isSelected = selectedEventId === e.id;
      const sev = SEVERITIES[e.severity] || SEVERITIES.low;
      const stat = STATUSES[e.status] || STATUSES.unverified;
      const timeStr = formatPointTime(ds, e.peak);

      return `
        <button
          type="button"
          data-event-id="${e.id}"
          class="event-card-item w-full rounded-lg border p-2.5 text-left transition-colors duration-150 ${
            isSelected
              ? "border-signal/50 bg-signal/10"
              : "border-border/70 bg-card/40 hover:border-border hover:bg-muted/40"
          }"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-[12px] font-medium text-foreground">#${e.id}</span>
            <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sev.badge}">
              <span class="h-1.5 w-1.5 rounded-full ${sev.dot}"></span>
              ${sev.label}
            </span>
          </div>
          <div class="mt-1.5 flex items-center justify-between text-[11px]">
            <span class="font-mono text-muted-foreground">
              ${timeStr} · score ${e.score.toFixed(1)} / ${e.thr.toFixed(1)}
            </span>
            <span class="rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${stat.badge}">
              ${stat.label}
            </span>
          </div>
          <p class="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            ${e.evidence}
          </p>
        </button>
      `;
    })
    .join("");

  elements.eventsList.querySelectorAll(".event-card-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedEventId = Number(btn.dataset.eventId);
      renderEventList();
      renderInspection();
    });
  });
}

// --- RENDER INSPECTION PANEL ---
function renderInspection() {
  const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
  const event = allEvents.find((e) => e.id === selectedEventId);

  if (!event || event.start >= cursor) {
    elements.inspectionPanel.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <span class="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-muted/40 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mouse-pointer-click h-4 w-4">
            <path d="M14 4.1 12 6"></path>
            <path d="m5.1 8-2.9-.8"></path>
            <path d="m6 12-1.9 2"></path>
            <path d="M7.2 2.2 8 5.1"></path>
            <path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"></path>
          </svg>
        </span>
        <p class="text-sm font-medium text-foreground">No event selected</p>
        <p class="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Pick a flagged event on the left to see its observed value, baseline, score, threshold and signal contributions.
        </p>
      </div>
    `;
    return;
  }

  const sev = SEVERITIES[event.severity] || SEVERITIES.low;
  const stat = STATUSES[event.status] || STATUSES.unverified;
  const dev = event.observed - event.expected;
  const ratio = event.thr ? event.score / event.thr : 0;
  const maxPart = Math.max(...event.parts.map((p) => p.value), 1e-6);

  const ratioColor =
    ratio >= 2.0 ? "bg-danger" : ratio >= 1.5 ? "bg-warn" : "bg-yellow-400";

  elements.inspectionPanel.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[13px] font-semibold text-foreground">#${event.id}</span>
          <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sev.badge}">
            <span class="h-1.5 w-1.5 rounded-full ${sev.dot}"></span>
            ${sev.label}
          </span>
        </div>
        <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${stat.badge}">
          ${stat.label}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gauge"><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>
            Observed
          </p>
          <p class="mt-1 font-mono text-sm font-semibold text-foreground">${formatVal(event.observed)}</p>
        </div>
        <div class="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
            Baseline
          </p>
          <p class="mt-1 font-mono text-sm font-semibold text-foreground">${formatVal(event.expected)}</p>
        </div>
        <div class="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide ${dev >= 0 ? "lucide-arrow-up-right" : "lucide-arrow-down-right"}"><path d="m7 7 10 10"></path><path d="M17 7v10H7"></path></svg>
            Deviation
          </p>
          <p class="mt-1 font-mono text-sm font-semibold ${Math.abs(dev) > 0 ? "text-warn" : "text-foreground"}">
            ${dev >= 0 ? "+" : "−"}${formatVal(Math.abs(dev))}
          </p>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Score vs adaptive threshold</span>
          <span class="font-mono normal-case">${formatVal(event.score)} / ${formatVal(event.thr)} (${ratio.toFixed(1)}×)</span>
        </div>
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full ${ratioColor}" style="width: ${Math.min(100, (ratio / 2.5) * 100)}%"></div>
        </div>
      </div>

      <div class="rounded-lg border border-border/70 bg-muted/20 p-3">
        <p class="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scan-line"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><path d="M7 12h10"></path></svg>
          Why it was flagged
        </p>
        <p class="text-[12px] leading-relaxed text-foreground/90">${event.evidence}</p>
      </div>

      <div>
        <p class="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Signal contribution</p>
        <div class="space-y-2">
          ${event.parts
            .map(
              (p) => `
            <div>
              <div class="flex justify-between text-[11px] text-muted-foreground">
                <span>${p.name}</span>
                <span class="font-mono tabular-nums text-foreground/80">${p.value.toFixed(2)}</span>
              </div>
              <div class="mt-1 h-1.5 rounded bg-muted">
                <div class="h-1.5 rounded bg-signal/80" style="width: ${(p.value / maxPart) * 100}%"></div>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      <dl class="pt-1">
        <div class="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5">
          <dt class="text-[11px] text-muted-foreground">Detected at</dt>
          <dd class="text-right text-[12px] text-foreground font-mono tabular-nums">${formatPointDateTime(ds, event.peak)}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5">
          <dt class="text-[11px] text-muted-foreground">Stream window</dt>
          <dd class="text-right text-[12px] text-foreground font-mono tabular-nums">points ${event.start}–${event.end}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5">
          <dt class="text-[11px] text-muted-foreground">Duration</dt>
          <dd class="text-right text-[12px] text-foreground font-mono tabular-nums">${event.end - event.start + 1} point${event.end > event.start ? "s" : ""}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5">
          <dt class="text-[11px] text-muted-foreground">Peak index</dt>
          <dd class="text-right text-[12px] text-foreground font-mono tabular-nums">${event.peak}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3 py-1.5">
          <dt class="text-[11px] text-muted-foreground">Detection method</dt>
          <dd class="text-right text-[12px] text-foreground">Sentinel hybrid ensemble</dd>
        </div>
      </dl>

      <p class="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock mt-0.5 h-3 w-3 shrink-0"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        Severity is score ÷ threshold. The threshold adapts from the rolling score history, so it moves with the stream.
      </p>
    </div>
  `;
}

// --- UPDATE STREAM CONTROLS & HEADER STATUS ---
function updateStatusUI() {
  const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
  const n = ds.values.length;
  const pct = n > 0 ? Math.min(100, (cursor / n) * 100) : 0;

  elements.progressBar.style.width = `${pct}%`;
  elements.ptsCounter.textContent = `${cursor} / ${n} pts`;

  const isAtEnd = cursor >= n && n > 0;
  const lastIdx = Math.max(0, cursor - 1);
  const isFlaggedNow = detectionData ? !!detectionData.flag[lastIdx] : false;

  elements.streamStatusPill.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-radio h-3 w-3 ${
      isPlaying ? "animate-pulse-soft text-success" : "text-muted-foreground"
    }">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
      <circle cx="12" cy="12" r="2"></circle>
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>
    </svg>
    ${isDemo ? "Demo · " : ""}${cursor > 0 ? `last ${formatPointTime(ds, lastIdx)}` : "no data"} · ${
    isFlaggedNow ? "flagged" : "normal"
  }
  `;

  const btnText = isAtEnd
    ? "Restart"
    : isPlaying
    ? "Pause"
    : cursor > 0
    ? "Resume"
    : "Start";

  const btnIcon = isAtEnd
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw h-3.5 w-3.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`
    : isPlaying
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pause h-3.5 w-3.5"><rect x="14" y="4" width="4" height="16" rx="1"></rect><rect x="6" y="4" width="4" height="16" rx="1"></rect></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play h-3.5 w-3.5"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;

  elements.playPauseBtn.innerHTML = `${btnIcon} ${btnText}`;
  elements.resetBtn.disabled = cursor === 0 && !isPlaying;

  const datasetType = ds.category ? `${ds.category} · ` : "";
  elements.sourceNote.textContent = `${isDemo ? "Demo mode · " : ""}Source: ${datasetType}${
    ds.name
  }. Each point is streamed sequentially against the learned rolling baseline.`;

  elements.dsBadge.textContent = `${ds.category ? ds.category + " · " : ""}${ds.name}`;
  if (!ds.windows || ds.windows.length === 0) {
    elements.truthBadge.classList.remove("hidden");
  } else {
    elements.truthBadge.classList.add("hidden");
  }

  // Update GitHub link in dashboard header
  if (elements.currentGithubLink) {
    if (ds.githubTreeUrl) {
      elements.currentGithubLink.href = ds.githubTreeUrl;
      elements.currentGithubLink.classList.remove("hidden");
    } else if (ds.category !== "Synthetic" && ds.filename) {
      elements.currentGithubLink.href = `${GITHUB_CONFIG.treeUrl}/${ds.category}/${ds.filename}`;
      elements.currentGithubLink.classList.remove("hidden");
    } else {
      elements.currentGithubLink.classList.add("hidden");
    }
  }

  if (elements.githubSourceBadge) {
    elements.githubSourceBadge.textContent = ds.sourceOrigin === "github" ? "Live GitHub" : "Local / Cached";
  }
}

// --- STREAM TIMER LOOP ---
function startStream() {
  if (streamInterval) clearInterval(streamInterval);
  streamInterval = setInterval(() => {
    if (!isPlaying) return;

    const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
    const step = isDemo ? 2 : 1;

    if (cursor < ds.values.length) {
      cursor = Math.min(ds.values.length, cursor + step);

      if (isDemo && selectedEventId === null) {
        const firstEv = allEvents.find((e) => e.start < cursor);
        if (firstEv) selectedEventId = firstEv.id;
      }

      updateStatusUI();
      renderCharts();
      renderEventList();
      renderInspection();
      if (typeof window.sentinelTick === "function") {
        window.sentinelTick();
      }
    } else {
      isPlaying = false;
      updateStatusUI();
      renderEventList();
      if (typeof window.sentinelTick === "function") {
        window.sentinelTick();
      }
      if (typeof window.sentinelStreamFinished === "function") {
        window.sentinelStreamFinished();
      }
    }
  }, Number(window.sentinelStreamIntervalMs) || 45);
}

// --- SWITCH DATASET (WITH GITHUB LIVE STREAMING SUPPORT) ---
async function selectDataset(newId) {
  let target = allDatasets.get(newId);

  // If not yet in memory or if user specifically wants live GitHub fetch for NAB files
  if (typeof NAB_CATALOG !== "undefined") {
    const entry = NAB_CATALOG.find((e) => e.id === newId);
    if (entry && (!target || fetchSourceMode === "github")) {
      const loadingBadge = elements.dsBadge;
      if (loadingBadge) loadingBadge.textContent = `Streaming from GitHub: ${entry.name}...`;
      try {
        target = await fetchDatasetFromGithubOrLocal(entry);
      } catch (err) {
        console.warn("Fetch error, using cached entry:", err);
        // If fetch failed but we have catalog metadata, create minimal stub for display
        if (!target && entry) {
          target = {
            id: entry.id,
            name: entry.name,
            category: entry.category,
            filename: entry.filename,
            values: entry.values || [],
            timestamps: entry.timestamps || [],
            windows: entry.windows || [],
            githubTreeUrl: entry.githubTreeUrl,
            githubPath: entry.githubPath,
          };
          allDatasets.set(entry.id, target);
        }
      }
    }
  }

  if (target) {
    currentDsId = target.id;
    currentDataset = target;
  } else if (newId === "custom" && customDataset) {
    currentDsId = "custom";
    currentDataset = customDataset;
  } else {
    currentDsId = syntheticDatasets[0].id;
    currentDataset = syntheticDatasets[0];
  }

  elements.dsSelectHeader.value = currentDsId;
  elements.dsSelectMain.value = currentDsId;

  cursor = Math.min(360, Math.floor(currentDataset.values.length * 0.35));
  isPlaying = false;
  isDemo = false;
  selectedEventId = 0;

  recomputeDetection();
  updateStatusUI();
  renderCharts();
  renderEventList();
  renderInspection();

  // Notify route_fix about dataset change for overview/analytics/settings live updates
  if (typeof window.onSentinelDatasetChanged === "function") {
    window.onSentinelDatasetChanged(currentDsId, currentDataset);
  }
}

// --- INTERACTIVE DEMO WALKTHROUGH ---
function triggerDemo() {
  const demoTargetId = allDatasets.has("machine_temperature_system_failure")
    ? "machine_temperature_system_failure"
    : syntheticDatasets[0].id;

  selectDataset(demoTargetId);
  const ds = allDatasets.get(demoTargetId);
  showGroundTruth = true;
  elements.groundTruthCheckbox.checked = true;

  if (ds.windows && ds.windows.length > 0) {
    cursor = Math.max(0, ds.windows[0].start - 30);
  } else {
    cursor = 0;
  }

  isDemo = true;
  isPlaying = true;
  selectedEventId = 0;

  updateStatusUI();
  renderCharts();
  renderEventList();
  renderInspection();
}

// --- NAB CORPUS MODAL LOGIC ---
function renderNabModalTable() {
  if (typeof NAB_CATALOG === "undefined" || !elements.nabTableBody) return;

  const search = (elements.nabSearchInput ? elements.nabSearchInput.value : "").toLowerCase().trim();
  const cat = elements.nabCategoryFilter ? elements.nabCategoryFilter.value : "all";

  const filtered = NAB_CATALOG.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      item.filename.toLowerCase().includes(search);
    const matchesCat = cat === "all" || item.category === cat;
    return matchesSearch && matchesCat;
  });

  elements.nabTableBody.innerHTML = filtered
    .map(
      (item) => `
    <tr class="border-b border-border/40 hover:bg-muted/30 transition-colors text-[11px]">
      <td class="py-2.5 px-3">
        <div class="font-medium text-foreground">${item.name}</div>
        <div class="font-mono text-[9px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <span>data/${item.category}/${item.filename}</span>
          <a
            href="https://github.com/numenta/NAB/blob/${GITHUB_CONFIG.commit}/data/${item.category}/${item.filename}"
            target="_blank"
            rel="noopener noreferrer"
            class="text-signal hover:underline inline-flex items-center gap-0.5 text-[9px]"
          >
            GitHub ↗
          </a>
        </div>
      </td>
      <td class="py-2.5 px-3">
        <span class="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ${item.category.replace("real", "Real ").replace("artificial", "Artificial ")}
        </span>
      </td>
      <td class="py-2.5 px-3 font-mono tabular-nums text-muted-foreground">
        ${item.totalPoints.toLocaleString()}
      </td>
      <td class="py-2.5 px-3">
        ${
          item.windowsCount > 0
            ? `<span class="inline-flex items-center gap-1 rounded bg-yellow-400/15 border border-yellow-400/40 px-1.5 py-0.5 font-mono text-[10px] text-yellow-300">
                ${item.windowsCount} labelled
               </span>`
            : `<span class="text-muted-foreground/60 text-[10px]">None</span>`
        }
      </td>
      <td class="py-2.5 px-3 text-right">
        <button
          onclick="loadNabFromModal('${item.id}')"
          class="inline-flex items-center gap-1 rounded-md bg-signal/15 px-2.5 py-1 text-[11px] font-semibold text-signal hover:bg-signal/25 transition-colors"
        >
          Load stream →
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

window.loadNabFromModal = async function (id) {
  if (elements.nabModal) elements.nabModal.classList.add("hidden");
  await selectDataset(id);
};

// --- SETUP EVENT LISTENERS ---
function initEventListeners() {
  elements.playPauseBtn.addEventListener("click", () => {
    const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
    if (cursor >= ds.values.length) {
      cursor = 0;
      isPlaying = true;
    } else {
      isPlaying = !isPlaying;
    }
    updateStatusUI();
    renderCharts();
    renderEventList();
    if (typeof window.sentinelStateUpdated === "function") {
      window.sentinelStateUpdated();
    }
  });

  elements.resetBtn.addEventListener("click", () => {
    isPlaying = false;
    isDemo = false;
    cursor = 0;
    selectedEventId = null;
    updateStatusUI();
    renderCharts();
    renderEventList();
    renderInspection();
    if (typeof window.sentinelStateUpdated === "function") {
      window.sentinelStateUpdated();
    }
  });

  elements.dsSelectHeader.addEventListener("change", (e) => selectDataset(e.target.value));
  elements.dsSelectMain.addEventListener("change", (e) => selectDataset(e.target.value));

  elements.groundTruthCheckbox.addEventListener("change", (e) => {
    showGroundTruth = e.target.checked;
    renderCharts();
  });

  elements.severityFilter.addEventListener("change", (e) => {
    severityFilter = e.target.value;
    renderEventList();
  });

  elements.statusFilter.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    renderEventList();
  });

  if (elements.launchDemoBtn) elements.launchDemoBtn.addEventListener("click", triggerDemo);
  if (elements.launchDemoHeaderBtn) elements.launchDemoHeaderBtn.addEventListener("click", triggerDemo);

  // File Upload Dialog
  if (elements.uploadSeriesLink && elements.fileUploadInput) {
    elements.uploadSeriesLink.addEventListener("click", (e) => {
      e.preventDefault();
      elements.fileUploadInput.click();
    });

    elements.fileUploadInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      const lines = text.trim().split(/[\r\n]+/);
      const timestamps = [];
      const values = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length >= 2) {
          const v = parseFloat(parts[1]);
          if (!isNaN(v)) {
            timestamps.push(parts[0].trim());
            values.push(v);
          }
        } else {
          const v = parseFloat(lines[i]);
          if (!isNaN(v)) values.push(v);
        }
      }

      if (values.length < 50) {
        alert("The uploaded series needs at least 50 numeric points.");
        return;
      }

      customDataset = {
        id: "custom",
        name: `Uploaded · ${file.name}`,
        category: "Custom",
        values,
        timestamps: timestamps.length === values.length ? timestamps : null,
        windows: [],
      };

      allDatasets.set("custom", customDataset);
      populateDropdowns();
      selectDataset("custom");
    });
  }

  // Notifications Modal
  if (elements.notificationsBtn && elements.notificationsModal) {
    elements.notificationsBtn.addEventListener("click", () => {
      const ds = currentDsId === "custom" && customDataset ? customDataset : currentDataset;
      const flagged = allEvents.filter((e) => e.start < cursor);
      elements.notificationsList.innerHTML = flagged.length
        ? flagged
            .map(
              (e) => `
          <div class="p-2.5 rounded border border-border/70 bg-card/60 flex items-center justify-between text-xs">
            <div>
              <p class="font-medium text-foreground">#${e.id} - ${e.severity.toUpperCase()} anomaly</p>
              <p class="text-[11px] text-muted-foreground">${formatPointDateTime(ds, e.peak)} · score ${e.score.toFixed(1)}</p>
            </div>
            <button onclick="selectAndCloseModal(${e.id})" class="px-2 py-1 rounded bg-signal/15 text-signal hover:bg-signal/25 font-semibold">Inspect</button>
          </div>
        `
            )
            .join("")
        : `<p class="text-xs text-muted-foreground py-4 text-center">No anomalies flagged in range yet.</p>`;

      elements.notificationsModal.classList.remove("hidden");
    });

    elements.closeNotifications.addEventListener("click", () => {
      elements.notificationsModal.classList.add("hidden");
    });
  }

  // NAB Corpus Modal
  const openNabModal = () => {
    if (elements.nabModal) {
      renderNabModalTable();
      elements.nabModal.classList.remove("hidden");
    }
  };

  if (elements.browseNabBtn) elements.browseNabBtn.addEventListener("click", openNabModal);
  if (elements.browseNabSidebarBtn) elements.browseNabSidebarBtn.addEventListener("click", openNabModal);
  if (elements.closeNabModal) {
    elements.closeNabModal.addEventListener("click", () => {
      elements.nabModal.classList.add("hidden");
    });
  }
  if (elements.nabSearchInput) elements.nabSearchInput.addEventListener("input", renderNabModalTable);
  if (elements.nabCategoryFilter) elements.nabCategoryFilter.addEventListener("change", renderNabModalTable);

  // GitHub Connection Modal
  if (elements.githubStatusBtn && elements.githubModal) {
    elements.githubStatusBtn.addEventListener("click", () => {
      elements.githubModal.classList.remove("hidden");
      pingGithubConnection();
    });

    elements.closeGithubModal.addEventListener("click", () => {
      elements.githubModal.classList.add("hidden");
    });
  }

  if (elements.githubSyncBtn) {
    elements.githubSyncBtn.addEventListener("click", async () => {
      elements.githubSyncBtn.textContent = "Testing...";
      await pingGithubConnection();
      elements.githubSyncBtn.textContent = "Test GitHub Connection";
    });
  }

  if (elements.fetchModeSelect) {
    elements.fetchModeSelect.addEventListener("change", (e) => {
      fetchSourceMode = e.target.value;
      updateStatusUI();
    });
  }

  window.addEventListener("resize", () => {
    renderCharts();
  });
}

window.selectAndCloseModal = function (id) {
  selectedEventId = id;
  elements.notificationsModal.classList.add("hidden");
  renderEventList();
  renderInspection();
};

// --- EXPOSE SENTINEL GLOBAL API ---
window.sentinel = {
  get currentDataset() { return currentDsId === "custom" && customDataset ? customDataset : currentDataset; },
  get currentDsId() { return currentDsId; },
  get allDatasets() { return allDatasets; },
  get syntheticDatasets() { return syntheticDatasets; },
  get nabCatalog() { return typeof NAB_CATALOG !== "undefined" ? NAB_CATALOG : []; },
  get cursor() { return cursor; },
  set cursor(val) { cursor = val; },
  get isPlaying() { return isPlaying; },
  set isPlaying(val) { isPlaying = val; },
  get isDemo() { return isDemo; },
  set isDemo(val) { isDemo = val; },
  get showGroundTruth() { return showGroundTruth; },
  set showGroundTruth(val) { showGroundTruth = val; },
  get params() { return params; },
  get allEvents() { return allEvents; },
  get detectionData() { return detectionData; },
  get fetchSourceMode() { return fetchSourceMode; },
  set fetchSourceMode(val) { fetchSourceMode = val; },
  get githubStatus() { return githubStatus; },
  get GITHUB_CONFIG() { return GITHUB_CONFIG; },
  selectDataset,
  recomputeDetection,
  populateDropdowns,
  startStream,
  updateStatusUI,
  renderCharts,
  renderEventList,
  renderInspection,
  triggerDemo,
  formatPointTime,
  formatPointDateTime,
  formatVal,
  getPointTimestamp,
  SEVERITIES,
  STATUSES,
  mean,
  stdDev,
  median
};

// --- INITIALIZE APP ---
document.addEventListener("DOMContentLoaded", () => {
  // Load persisted settings
  try {
    const saved = localStorage.getItem("sentinel_settings");
    if (saved) {
      const cfg = JSON.parse(saved);
      if (cfg.threshold != null && !isNaN(Number(cfg.threshold))) {
        params.k = Math.max(0.5, Math.min(20, Number(cfg.threshold)));
      }
      if (cfg.waveSpeed != null && !isNaN(Number(cfg.waveSpeed))) {
        window.sentinelStreamIntervalMs = Math.max(10, Math.min(2000, Number(cfg.waveSpeed)));
      }
      if (cfg.window != null && !isNaN(Number(cfg.window))) {
        params.win = Math.max(10, Math.min(300, Number(cfg.window)));
      }
      if (cfg.minRun != null && !isNaN(Number(cfg.minRun))) {
        params.minRun = Math.max(1, Math.min(10, Number(cfg.minRun)));
      }
      if (cfg.source) {
        fetchSourceMode = cfg.source;
      }
      if (cfg.truth !== undefined) {
        showGroundTruth = cfg.truth === "shown" || cfg.truth === true;
      }
    }
  } catch (err) {
    console.warn("Could not parse saved sentinel_settings:", err);
  }

  populateDropdowns();
  setupChartEvents();
  initEventListeners();
  recomputeDetection();
  updateStatusUI();
  renderCharts();
  renderEventList();
  renderInspection();
  startStream();
  pingGithubConnection();
  if (typeof window.setupDashboardRoutes === "function") {
    window.setupDashboardRoutes();
  }
  selectDataset(currentDsId);
});
