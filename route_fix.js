/**
 * Sentinel Live Stream Monitoring Dashboard
 * Enhanced Router & Views:
 * 1. Settings Page: threshold & wave speed controls, dual units, validation, live updates without refresh, persistence
 * 2. Stream History Page: recorded sessions list/table, search, date filters, sorting, modal detail inspection, pagination, empty state
 * 3. Analytics Page: interactive bar charts (events over time, stream comparisons, threshold violations), summary cards, dynamic updates
 * 4. Overview Page: centered heading "Live Stream Monitoring Dashboard" with live stream controls
 * 5. Navigation & Layout: consistent sidebar, active route highlights, mobile responsive drawer
 */
(function () {
  "use strict";

  // --- STORAGE KEYS ---
  const SETTINGS_KEY = "sentinel_settings";
  const HISTORY_KEY = "sentinel_stream_history";

  // --- NAVIGATION LABELS & ROUTES ---
  const NAV_ROUTES = {
    Overview: "overview",
    "Live stream": "live",
    "Stream history": "history",
    Analytics: "analytics",
    Settings: "settings",
    Anomalies: "anomalies",
    "Model lab": "models",
  };

  const ROUTE_TITLES = {
    overview: "Sentinel / Overview",
    live: "Sentinel / Live stream",
    history: "Sentinel / Stream history",
    analytics: "Sentinel / Analytics",
    settings: "Sentinel / Settings",
    anomalies: "Sentinel / Anomalies",
    models: "Sentinel / Model lab",
  };

  // --- DEFAULT SETTINGS STATE ---
  const defaultSettings = {
    threshold: 4.0,
    waveSpeed: 45,
    window: 60,
    minRun: 2,
    source: "github",
    alerts: "enabled",
    truth: "shown",
    autoPause: "off",
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...defaultSettings, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn("Failed to read settings from localStorage:", e);
    }
    return { ...defaultSettings };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to write settings to localStorage:", e);
    }
  }

  // --- NAB DATASET SELECTOR HELPERS ---
  const NAB_CATEGORIES_LABELS = [
    { match: "realKnownCause", label: "🏢 Real — Known Causes" },
    { match: "realAWSCloudwatch", label: "☁️ Real — AWS CloudWatch" },
    { match: "realAdExchange", label: "📈 Real — Ad Exchange" },
    { match: "realTraffic", label: "🚦 Real — Traffic Sensors" },
    { match: "realTweets", label: "🐦 Real — Twitter Volume" },
    { match: "artificialWithAnomaly", label: "🧪 Artificial — With Anomaly" },
    { match: "artificialNoAnomaly", label: "🔬 Artificial — No Anomaly" },
  ];

  function buildNabDatasetOptions(s) {
    const catalog = s?.nabCatalog || (typeof NAB_CATALOG !== "undefined" ? NAB_CATALOG : []);
    const currentId = s?.currentDsId || "";
    let html = "";

    // Synthetic group
    const syntheticDs = s?.syntheticDatasets || [];
    if (syntheticDs.length) {
      html += `<optgroup label="⚡ Simulated Benchmark Streams">`;
      syntheticDs.forEach((d) => {
        html += `<option value="${d.id}" ${d.id === currentId ? "selected" : ""}>${d.name}</option>`;
      });
      html += `</optgroup>`;
    }

    // NAB categories
    NAB_CATEGORIES_LABELS.forEach((cat) => {
      const items = catalog.filter((e) => e.category === cat.match);
      if (items.length > 0) {
        html += `<optgroup label="${cat.label} (${items.length})">`;
        items.forEach((item) => {
          const anomLabel = item.windowsCount ? ` · ${item.windowsCount} anomalies` : "";
          html += `<option value="${item.id}" ${item.id === currentId ? "selected" : ""}>${item.name}${anomLabel} (${item.totalPoints.toLocaleString()} pts)</option>`;
        });
        html += `</optgroup>`;
      }
    });

    return html;
  }

  function buildDatasetInfoSnippet(s) {
    const ds = s?.currentDataset;
    if (!ds) return "No dataset loaded.";
    const ghConfig = s?.GITHUB_CONFIG || {};
    const ghLink = ds.githubTreeUrl || (ds.category && ds.filename ? `https://github.com/numenta/NAB/blob/${ghConfig.commit || "ea702d75cc2258d9d7dd35ca8e5e2539d71f3140"}/data/${ds.category}/${ds.filename}` : "");
    return `
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span><strong class="text-foreground">Dataset:</strong> ${ds.name || ds.id}</span>
        <span><strong class="text-foreground">Category:</strong> ${ds.category || "Synthetic"}</span>
        <span><strong class="text-foreground">Points:</strong> ${(ds.values?.length || ds.fullLength || 0).toLocaleString()}</span>
        <span><strong class="text-foreground">Anomaly windows:</strong> ${(ds.windows?.length || 0)}</span>
      </div>
      ${ghLink ? `<a href="${ghLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-1.5 text-signal hover:underline text-[10px] font-mono">View on GitHub ↗</a>` : ""}
    `;
  }

  // --- DEFAULT SAMPLE STREAM HISTORY SESSIONS ---
  const SEED_HISTORY = [
    {
      id: "STR-2026-0891",
      name: "Machine Temperature System Failure",
      datasetId: "machine_temperature_system_failure",
      category: "realKnownCause",
      date: "2026-10-27 10:15 UTC",
      timestamp: Date.now() - 3600000 * 2,
      duration: "14m 20s",
      points: 1000,
      status: "Completed",
      threshold: 4.0,
      waveSpeed: 45,
      eventsCount: 4,
      confirmedCount: 4,
      criticalCount: 1,
      peakScore: 7.82,
      precision: "100.0%",
      notes: "Bearing failure overheating detected 4 hours before catastrophic seizure.",
      events: [
        { id: 1, peak: 240, time: "2026-10-27 10:18:00 UTC", score: 4.85, thr: 4.0, severity: "medium", status: "confirmed", evidence: "Moderate thermal drift exceeding 1.2x adaptive MAD baseline." },
        { id: 2, peak: 560, time: "2026-10-27 10:23:20 UTC", score: 7.82, thr: 4.0, severity: "critical", status: "confirmed", evidence: "Severe high-frequency thermal surge prior to bearing seizure." },
        { id: 3, peak: 780, time: "2026-10-27 10:27:00 UTC", score: 5.42, thr: 4.0, severity: "high", status: "confirmed", evidence: "Secondary cooling failure resonance window." },
        { id: 4, peak: 910, time: "2026-10-27 10:29:10 UTC", score: 4.31, thr: 4.0, severity: "medium", status: "confirmed", evidence: "Residual thermal decay following emergency shutdown." },
      ],
    },
    {
      id: "STR-2026-0892",
      name: "AWS EC2 CPU Utilization 53ea38",
      datasetId: "ec2_cpu_utilization_53ea38",
      category: "realAWSCloudwatch",
      date: "2026-10-27 08:30 UTC",
      timestamp: Date.now() - 3600000 * 4,
      duration: "18m 45s",
      points: 1200,
      status: "Completed",
      threshold: 3.8,
      waveSpeed: 50,
      eventsCount: 3,
      confirmedCount: 3,
      criticalCount: 0,
      peakScore: 6.14,
      precision: "100.0%",
      notes: "Worker instance thread contention and CPU exhaustion under queue spike.",
      events: [
        { id: 1, peak: 320, time: "2026-10-27 08:35:00 UTC", score: 4.95, thr: 3.8, severity: "high", status: "confirmed", evidence: "Worker process starvation sustained over 8 observation cycles." },
        { id: 2, peak: 710, time: "2026-10-27 08:41:50 UTC", score: 6.14, thr: 3.8, severity: "high", status: "confirmed", evidence: "Deadlock queue cascade across Celery job pool." },
        { id: 3, peak: 980, time: "2026-10-27 08:46:20 UTC", score: 4.12, thr: 3.8, severity: "low", status: "confirmed", evidence: "Elevated garbage collection pause baseline." },
      ],
    },
    {
      id: "STR-2026-0893",
      name: "NYC Taxi Demand Real-Time",
      datasetId: "taxi_demand",
      category: "Synthetic",
      date: "2026-10-26 22:10 UTC",
      timestamp: Date.now() - 3600000 * 14,
      duration: "24m 10s",
      points: 1032,
      status: "Flagged",
      threshold: 3.5,
      waveSpeed: 40,
      eventsCount: 6,
      confirmedCount: 5,
      criticalCount: 2,
      peakScore: 9.35,
      precision: "83.3%",
      notes: "Severe storm surge and sudden ridership collapse during transit halt.",
      events: [
        { id: 1, peak: 180, time: "2026-10-26 22:14:00 UTC", score: 4.21, thr: 3.5, severity: "medium", status: "confirmed", evidence: "Sudden rush-hour surge exceeding baseline diurnal cycle." },
        { id: 2, peak: 340, time: "2026-10-26 22:17:30 UTC", score: 9.35, thr: 3.5, severity: "critical", status: "confirmed", evidence: "Severe precipitous drop (-260 rides) following subway transit halt." },
        { id: 3, peak: 520, time: "2026-10-26 22:20:40 UTC", score: 3.92, thr: 3.5, severity: "low", status: "false_positive", evidence: "Localized rain burst causing rapid but non-anomalous demand variation." },
        { id: 4, peak: 610, time: "2026-10-26 22:22:10 UTC", score: 8.74, thr: 3.5, severity: "critical", status: "confirmed", evidence: "Extreme fleet demand spike (+420 pickups) in Midtown." },
        { id: 5, peak: 880, time: "2026-10-26 22:26:40 UTC", score: 5.88, thr: 3.5, severity: "high", status: "confirmed", evidence: "High variance burst matching transit strike duration." },
        { id: 6, peak: 990, time: "2026-10-26 22:28:30 UTC", score: 4.60, thr: 3.5, severity: "medium", status: "confirmed", evidence: "Late evening residual recovery phase." },
      ],
    },
    {
      id: "STR-2026-0894",
      name: "Ad Click-Through Rate Exchange",
      datasetId: "ad_ctr",
      category: "Synthetic",
      date: "2026-10-26 19:40 UTC",
      timestamp: Date.now() - 3600000 * 18,
      duration: "11m 30s",
      points: 950,
      status: "Completed",
      threshold: 4.2,
      waveSpeed: 45,
      eventsCount: 3,
      confirmedCount: 3,
      criticalCount: 1,
      peakScore: 8.11,
      precision: "100.0%",
      notes: "Bot traffic click fraud campaign flagged within 90 seconds of onset.",
      events: [
        { id: 1, peak: 220, time: "2026-10-26 19:43:40 UTC", score: 8.11, thr: 4.2, severity: "critical", status: "confirmed", evidence: "Sudden coordinated click fraud surge originating from cloud IPs." },
        { id: 2, peak: 470, time: "2026-10-26 19:47:50 UTC", score: 5.62, thr: 4.2, severity: "high", status: "confirmed", evidence: "High variability burst matching crawler bot inspection." },
        { id: 3, peak: 740, time: "2026-10-26 19:52:20 UTC", score: 6.45, thr: 4.2, severity: "high", status: "confirmed", evidence: "Bidding algorithm level shift following rogue campaign isolation." },
      ],
    },
    {
      id: "STR-2026-0895",
      name: "Twitter Volume AAPL Earnings",
      datasetId: "Twitter_volume_AAPL",
      category: "realTweets",
      date: "2026-10-26 16:05 UTC",
      timestamp: Date.now() - 3600000 * 22,
      duration: "32m 15s",
      points: 1580,
      status: "Flagged",
      threshold: 4.5,
      waveSpeed: 35,
      eventsCount: 5,
      confirmedCount: 5,
      criticalCount: 3,
      peakScore: 11.45,
      precision: "100.0%",
      notes: "Quarterly earnings surprise tweet storm and revenue announcement buzz.",
      events: [
        { id: 1, peak: 290, time: "2026-10-26 16:10:00 UTC", score: 6.84, thr: 4.5, severity: "high", status: "confirmed", evidence: "Rumor leak volume jump 15 minutes before official earnings release." },
        { id: 2, peak: 620, time: "2026-10-26 16:15:30 UTC", score: 11.45, thr: 4.5, severity: "critical", status: "confirmed", evidence: "Official 10-K earnings filing release trigger (+8,400 tweets/5min)." },
        { id: 3, peak: 890, time: "2026-10-26 16:20:00 UTC", score: 9.20, thr: 4.5, severity: "critical", status: "confirmed", evidence: "CEO conference call forward guidance announcement." },
        { id: 4, peak: 1120, time: "2026-10-26 16:23:50 UTC", score: 7.15, thr: 4.5, severity: "high", status: "confirmed", evidence: "Analyst upgrade wave and price target revisions." },
        { id: 5, peak: 1440, time: "2026-10-26 16:29:10 UTC", score: 8.90, thr: 4.5, severity: "critical", status: "confirmed", evidence: "After-hours market close trading reaction." },
      ],
    },
    {
      id: "STR-2026-0896",
      name: "EC2 Request Latency System Failure",
      datasetId: "ec2_request_latency_system_failure",
      category: "realKnownCause",
      date: "2026-10-26 12:20 UTC",
      timestamp: Date.now() - 3600000 * 26,
      duration: "15m 50s",
      points: 1050,
      status: "Completed",
      threshold: 4.0,
      waveSpeed: 45,
      eventsCount: 3,
      confirmedCount: 3,
      criticalCount: 1,
      peakScore: 7.62,
      precision: "100.0%",
      notes: "Gateway timeout storm caused by database pool lockup.",
      events: [
        { id: 1, peak: 310, time: "2026-10-26 12:25:10 UTC", score: 5.35, thr: 4.0, severity: "high", status: "confirmed", evidence: "P99 latency exceeding 450ms across public edge API." },
        { id: 2, peak: 680, time: "2026-10-26 12:31:20 UTC", score: 7.62, thr: 4.0, severity: "critical", status: "confirmed", evidence: "Database connection pool exhausted, 504 timeouts dominating." },
        { id: 3, peak: 940, time: "2026-10-26 12:35:40 UTC", score: 4.25, thr: 4.0, severity: "medium", status: "confirmed", evidence: "Connection draining following RDS read-replica failover." },
      ],
    },
    {
      id: "STR-2026-0897",
      name: "Rogue Agent Key Up/Down Anomaly",
      datasetId: "rogue_agent_key_updown",
      category: "realKnownCause",
      date: "2026-10-25 18:00 UTC",
      timestamp: Date.now() - 3600000 * 44,
      duration: "08m 12s",
      points: 650,
      status: "Completed",
      threshold: 3.2,
      waveSpeed: 60,
      eventsCount: 2,
      confirmedCount: 2,
      criticalCount: 1,
      peakScore: 6.89,
      precision: "100.0%",
      notes: "Unauthorized agent credential cycling and rapid privilege escalation attempts.",
      events: [
        { id: 1, peak: 210, time: "2026-10-25 18:02:40 UTC", score: 5.12, thr: 3.2, severity: "high", status: "confirmed", evidence: "Rapid API key invalidation burst across multiple worker nodes." },
        { id: 2, peak: 440, time: "2026-10-25 18:05:50 UTC", score: 6.89, thr: 3.2, severity: "critical", status: "confirmed", evidence: "Coordinated privilege escalation probe detected in authentication log." },
      ],
    },
    {
      id: "STR-2026-0898",
      name: "Ambient Temperature System Failure",
      datasetId: "ambient_temperature_system_failure",
      category: "realKnownCause",
      date: "2026-10-25 14:10 UTC",
      timestamp: Date.now() - 3600000 * 48,
      duration: "28m 30s",
      points: 1400,
      status: "Flagged",
      threshold: 4.0,
      waveSpeed: 45,
      eventsCount: 4,
      confirmedCount: 4,
      criticalCount: 2,
      peakScore: 8.95,
      precision: "100.0%",
      notes: "HVAC chiller compressor failure in server room primary aisle.",
      events: [
        { id: 1, peak: 350, time: "2026-10-25 14:17:00 UTC", score: 5.72, thr: 4.0, severity: "high", status: "confirmed", evidence: "Ambient room rise rate > 0.8C/min exceeding HVAC intake spec." },
        { id: 2, peak: 720, time: "2026-10-25 14:24:25 UTC", score: 8.95, thr: 4.0, severity: "critical", status: "confirmed", evidence: "Primary chiller tripped breaker, temperature crossed 38C alarm limit." },
        { id: 3, peak: 1040, time: "2026-10-25 14:30:50 UTC", score: 7.84, thr: 4.0, severity: "critical", status: "confirmed", evidence: "Backup cooling units engaged with delayed cold aisle recovery." },
        { id: 4, peak: 1290, time: "2026-10-25 14:35:50 UTC", score: 4.41, thr: 4.0, severity: "medium", status: "confirmed", evidence: "Stabilization oscillations around 22C target baseline." },
      ],
    },
    {
      id: "STR-2026-0899",
      name: "ELB Request Count Spike Burst",
      datasetId: "elb_request_count_8c0756",
      category: "realAWSCloudwatch",
      date: "2026-10-25 09:45 UTC",
      timestamp: Date.now() - 3600000 * 52,
      duration: "20m 00s",
      points: 1100,
      status: "Completed",
      threshold: 4.2,
      waveSpeed: 50,
      eventsCount: 3,
      confirmedCount: 3,
      criticalCount: 1,
      peakScore: 7.18,
      precision: "100.0%",
      notes: "Flash sale traffic spike on European storefront load balancer.",
      events: [
        { id: 1, peak: 280, time: "2026-10-25 09:50:40 UTC", score: 4.88, thr: 4.2, severity: "medium", status: "confirmed", evidence: "Pre-launch customer influx reaching 18,000 req/min." },
        { id: 2, peak: 590, time: "2026-10-25 09:56:50 UTC", score: 7.18, thr: 4.2, severity: "critical", status: "confirmed", evidence: "Midnight flash sale launch surge with 10x traffic multiplier." },
        { id: 3, peak: 870, time: "2026-10-25 10:02:30 UTC", score: 5.05, thr: 4.2, severity: "high", status: "confirmed", evidence: "Payment webhook retry deluge following gateway rate limit." },
      ],
    },
    {
      id: "STR-2026-0900",
      name: "Twitter Volume GOOG Breakout",
      datasetId: "Twitter_volume_GOOG",
      category: "realTweets",
      date: "2026-10-24 21:15 UTC",
      timestamp: Date.now() - 3600000 * 65,
      duration: "16m 40s",
      points: 980,
      status: "Completed",
      threshold: 3.9,
      waveSpeed: 45,
      eventsCount: 2,
      confirmedCount: 2,
      criticalCount: 1,
      peakScore: 8.42,
      precision: "100.0%",
      notes: "Major AI platform launch keynote sentiment burst across tech Twitter.",
      events: [
        { id: 1, peak: 420, time: "2026-10-24 21:23:40 UTC", score: 8.42, thr: 3.9, severity: "critical", status: "confirmed", evidence: "Keynote live stream reveal triggering 14,000 tweets per minute." },
        { id: 2, peak: 790, time: "2026-10-24 21:31:10 UTC", score: 5.61, thr: 3.9, severity: "high", status: "confirmed", evidence: "Developer SDK availability tweetstorm and benchmark release." },
      ],
    },
    {
      id: "STR-2026-0901",
      name: "Artificial Square Wave Noise-Free",
      datasetId: "art_daily_no_noise",
      category: "artificialNoAnomaly",
      date: "2026-10-24 15:30 UTC",
      timestamp: Date.now() - 3600000 * 71,
      duration: "10m 00s",
      points: 800,
      status: "Archived",
      threshold: 5.0,
      waveSpeed: 30,
      eventsCount: 0,
      confirmedCount: 0,
      criticalCount: 0,
      peakScore: 1.84,
      precision: "100.0%",
      notes: "Baseline noise-free square wave calibration; zero false alarms recorded.",
      events: [],
    },
    {
      id: "STR-2026-0902",
      name: "EC2 Network In Traffic Surge",
      datasetId: "ec2_network_in_5abac7",
      category: "realAWSCloudwatch",
      date: "2026-10-24 11:00 UTC",
      timestamp: Date.now() - 3600000 * 75,
      duration: "22m 15s",
      points: 1250,
      status: "Flagged",
      threshold: 3.6,
      waveSpeed: 45,
      eventsCount: 4,
      confirmedCount: 3,
      criticalCount: 2,
      peakScore: 9.80,
      precision: "75.0%",
      notes: "DDoS reflection attack ingress surge detected on edge instance.",
      events: [
        { id: 1, peak: 260, time: "2026-10-24 11:05:10 UTC", score: 5.25, thr: 3.6, severity: "high", status: "confirmed", evidence: "UDP packet volume exceeding baseline ingress by 6.2x." },
        { id: 2, peak: 540, time: "2026-10-24 11:10:50 UTC", score: 9.80, thr: 3.6, severity: "critical", status: "confirmed", evidence: "Volumetric SYN flood saturating NIC buffer ring (850 MB/s)." },
        { id: 3, peak: 780, time: "2026-10-24 11:15:35 UTC", score: 3.75, thr: 3.6, severity: "low", status: "false_positive", evidence: "Short-lived automated backup replication synchronization." },
        { id: 4, peak: 1050, time: "2026-10-24 11:21:00 UTC", score: 7.92, thr: 3.6, severity: "critical", status: "confirmed", evidence: "Secondary attack vector targeting DNS service port." },
      ],
    },
  ];

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to read history from localStorage:", e);
    }
    // Seed default history
    saveHistory(SEED_HISTORY);
    return [...SEED_HISTORY];
  }

  function saveHistory(historyList) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyList));
    } catch (e) {
      console.warn("Failed to write history to localStorage:", e);
    }
  }

  // --- STATE ACCESS HELPER ---
  function getSentinel() {
    if (window.sentinel) return window.sentinel;
    return {
      currentDataset: typeof currentDataset !== "undefined" ? currentDataset : null,
      currentDsId: typeof currentDsId !== "undefined" ? currentDsId : "",
      allDatasets: typeof allDatasets !== "undefined" ? allDatasets : new Map(),
      cursor: typeof cursor !== "undefined" ? cursor : 0,
      isPlaying: typeof isPlaying !== "undefined" ? isPlaying : false,
      params: typeof params !== "undefined" ? params : { win: 60, k: 4, minRun: 2 },
      allEvents: typeof allEvents !== "undefined" ? allEvents : [],
      detectionData: typeof detectionData !== "undefined" ? detectionData : null,
      selectDataset: typeof selectDataset === "function" ? selectDataset : async () => {},
      recomputeDetection: typeof recomputeDetection === "function" ? recomputeDetection : () => {},
      startStream: typeof startStream === "function" ? startStream : () => {},
      formatPointTime: typeof formatPointTime === "function" ? formatPointTime : () => "",
      formatPointDateTime: typeof formatPointDateTime === "function" ? formatPointDateTime : () => "",
      formatVal: typeof formatVal === "function" ? formatVal : (v) => v,
    };
  }

  // Current history page state
  let historySearchQuery = "";
  let historyStatusFilter = "all";
  let historyDateFilter = "all";
  let historySortBy = "date_desc";
  let historyCurrentPage = 1;
  const HISTORY_PER_PAGE = 6;

  // Current analytics page state
  let analyticsStreamFilter = "all";
  let analyticsTimeRange = "all";
  let analyticsSeverityFilter = "all";

  // Active route tracking
  let currentActiveRoute = "overview";

  // --- HELPER METRIC CARD HTML ---
  function statCard(label, value, note, iconHtml = "", badgeHtml = "") {
    return `
      <article class="relative overflow-hidden rounded-xl border border-border/80 bg-card/60 p-4 transition-all duration-200 hover:border-signal/40 hover:bg-card/80 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">${label}</p>
          ${badgeHtml || (iconHtml ? `<span class="text-muted-foreground/80">${iconHtml}</span>` : "")}
        </div>
        <strong class="mt-2 block font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">${value}</strong>
        <p class="mt-1 text-[11px] text-muted-foreground leading-snug">${note}</p>
      </article>
    `;
  }

  // --- SVG SPARKLINE GENERATOR ---
  function renderSparklineSvg(points, anomalies = [], width = 580, height = 130) {
    if (!points || points.length === 0) {
      return `<svg viewBox="0 0 ${width} ${height}" class="w-full h-full"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#64748b" font-size="12">No observation data available</text></svg>`;
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const padding = 16;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;

    const pathData = points
      .map((val, idx) => {
        const x = padding + (idx / Math.max(1, points.length - 1)) * usableW;
        const y = padding + usableH - ((val - min) / range) * usableH;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

    // Anomaly dots
    const dotsHtml = anomalies
      .filter((a) => a.peak >= 0 && a.peak < points.length)
      .map((a) => {
        const x = padding + (a.peak / Math.max(1, points.length - 1)) * usableW;
        const val = points[a.peak];
        const y = padding + usableH - ((val - min) / range) * usableH;
        const color = a.severity === "critical" ? "#f87171" : "#fb923c";
        return `
          <g>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${color}" opacity="0.3" class="animate-ping"/>
            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>
          </g>
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <!-- Horizontal grid line -->
        <line x1="${padding}" y1="${padding + usableH / 2}" x2="${width - padding}" y2="${padding + usableH / 2}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />
        <!-- Area fill -->
        <path d="${pathData} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z" fill="url(#sparkGradient)" />
        <!-- Line stroke -->
        <path d="${pathData}" fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Marked anomalies -->
        ${dotsHtml}
      </svg>
    `;
  }

  // =========================================================================
  // VIEW 1: OVERVIEW PAGE
  // =========================================================================
  function renderOverviewView() {
    const s = getSentinel();
    const ds = s.currentDataset;
    const values = ds?.values || [];
    const totalPts = values.length || 1000;
    const curPts = Math.min(s.cursor, totalPts);
    const events = s.allEvents || [];
    const confirmedCount = events.filter((e) => e.status === "confirmed").length;
    const criticalCount = events.filter((e) => e.severity === "critical").length;
    const precisionRate = events.length ? ((confirmedCount / events.length) * 100).toFixed(1) : "100.0";
    const historyList = loadHistory();
    const activeSpeed = window.sentinelStreamIntervalMs || defaultSettings.waveSpeed;
    const ptsPerSec = (1000 / activeSpeed).toFixed(1);

    // Current latest value & baseline
    const lastIdx = Math.max(0, curPts - 1);
    const currentVal = values[lastIdx] != null ? Number(values[lastIdx]).toFixed(2) : "—";
    const expectedVal = s.detectionData?.expected?.[lastIdx] != null ? Number(s.detectionData.expected[lastIdx]).toFixed(2) : "—";
    const currentScore = s.detectionData?.score?.[lastIdx] != null ? Number(s.detectionData.score[lastIdx]).toFixed(2) : "0.00";

    // Latest points for sparkline preview (latest 60)
    const previewCount = Math.min(60, curPts);
    const previewStart = Math.max(0, curPts - previewCount);
    const previewValues = values.slice(previewStart, curPts);
    const previewAnomalies = events
      .filter((e) => e.peak >= previewStart && e.peak < curPts)
      .map((e) => ({ ...e, peak: e.peak - previewStart }));

    const statusBadgeText = s.isPlaying ? "Live Streaming" : curPts >= totalPts ? "Completed" : "Paused";
    const statusPulseColor = s.isPlaying ? "bg-success" : curPts >= totalPts ? "bg-signal" : "bg-warn";

    return `
      <div class="animate-fade-in">
        <!-- HERO SECTION: MAIN HEADING IN EXACT CENTER OF PAGE WITH LARGE, BOLD FONT -->
        <section id="overviewHero" class="relative flex flex-col justify-center overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card/90 via-card/60 to-card/40 p-8 text-center shadow-xl backdrop-blur-md sm:p-12" style="min-height: calc(100vh - 9rem)">
          <div class="overview-hero-art" aria-hidden="true">
            <div class="overview-hero-dots"></div>
            <div id="overviewCursorGlow" class="overview-cursor-glow"></div>
          </div>

          <div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center justify-center text-center">
            <!-- Top brand pill -->
            <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-signal">
              <span class="h-2 w-2 rounded-full ${statusPulseColor} animate-pulse"></span>
              Sentinel Anomaly Telemetry · NAB Benchmark
            </div>

            <!-- EXACT REQUIRED HEADING IN EXACT CENTER -->
            <h1 class="font-extrabold tracking-tight text-foreground text-center" style="font-size: clamp(2.5rem, 6vw, 5rem); line-height: 1.05">
              Live Stream Monitoring Dashboard
            </h1>

            <!-- SHORT SUBTITLE BENEATH THE HEADING -->
            <p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base text-center">
              Adaptive time-series anomaly detection, continuous wave telemetry, and explainable signal verification powered by the Numenta Anomaly Benchmark.
            </p>

            <!-- PROMINENT LIVE STREAM STATUS INDICATOR -->
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <div class="inline-flex items-center gap-3 rounded-xl border border-border/80 bg-background/80 px-4 py-2.5 shadow-sm backdrop-blur">
                <span class="relative flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${statusPulseColor} opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 ${statusPulseColor}"></span>
                </span>
                <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status:</span>
                <span id="overviewLiveStatus" class="font-mono text-xs font-bold text-foreground capitalize">${statusBadgeText}</span>
                <span class="text-border">|</span>
                <span class="font-mono text-xs text-signal">${ds?.name || "NAB Stream"}</span>
                <span class="text-border">|</span>
                <span class="font-mono text-xs text-muted-foreground">${curPts.toLocaleString()} / ${totalPts.toLocaleString()} pts</span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-nav="live"
                  class="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-xs font-semibold text-signal-foreground transition-all hover:opacity-90 shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Open Live Stream →
                </button>
                <button
                  id="overviewTogglePlayBtn"
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                >
                  ${s.isPlaying ? "Pause Stream" : "Resume Stream"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 4 KEY SUMMARY CARDS: STATUS, ACTIVE STREAMS, DETECTED EVENTS, SETTINGS -->
        <section hidden style="display: none" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          ${statCard(
            "Live Stream Status",
            statusBadgeText,
            `${ds?.name || "Machine Temperature"} · GitHub Sync ea702d7`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-signal"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path></svg>`
          )}
          ${statCard(
            "Active Streams",
            "58 NAB Datasets",
            `1 currently streaming · ${historyList.length} recorded history sessions`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-iris"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>`
          )}
          ${statCard(
            "Detected Events",
            `${events.length} Anomalies`,
            `${confirmedCount} confirmed (${precisionRate}% precision) · ${criticalCount} critical`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-warn"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`
          )}
          ${statCard(
            "Monitoring Settings",
            `k = ${s.params?.k?.toFixed(1) || "4.0"}σ`,
            `Speed: ${activeSpeed} ms/pt (~${ptsPerSec} pts/s) · Window: ${s.params?.win || 60} pts`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-success"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
          )}
        </section>

        <!-- COMPACT PREVIEW OF RECENT STREAM ACTIVITY -->
        <section hidden style="display: none" class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 class="text-sm font-semibold tracking-wide text-foreground">Recent Live Stream Waveform Activity</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                Trailing ${previewCount} observations in <span class="font-mono text-signal">${ds?.name || "current stream"}</span> against adaptive baseline.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span class="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                <span class="h-2 w-2 rounded-full bg-cyan-400"></span> Observed: <b class="text-foreground">${currentVal}</b>
              </span>
              <span class="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                <span class="h-2 w-2 rounded-full bg-slate-400"></span> Expected: <b class="text-foreground">${expectedVal}</b>
              </span>
              <span class="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                <span class="h-2 w-2 rounded-full bg-purple-400"></span> Score: <b class="text-iris">${currentScore}σ</b>
              </span>
              <button
                type="button"
                data-nav="live"
                class="rounded-md border border-signal/40 bg-signal/10 px-2.5 py-1 font-semibold text-signal hover:bg-signal/20 transition-colors"
              >
                Inspect in Live Monitor →
              </button>
            </div>
          </div>

          <div class="mt-4 h-36 w-full">
            ${renderSparklineSvg(previewValues, previewAnomalies, 720, 140)}
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
            <span>Window start: #${previewStart} · Current point: #${curPts}</span>
            <span class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-2 rounded-full bg-cyan-400"></span> Continuous Signal
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-2 rounded-full bg-red-400"></span> Flagged Anomaly Event
              </span>
            </span>
          </div>
        </section>

        <!-- SHORTCUT NAVIGATION CARDS TO ANALYTICS, STREAM HISTORY, LIVE STREAM, SETTINGS -->
        <section class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <a
            data-nav="analytics"
            class="group cursor-pointer rounded-xl border border-border/80 bg-card/60 p-6 transition-all duration-200 hover:border-signal/50 hover:bg-card/90 hover:shadow-md"
            href="#analytics"
          >
            <div class="flex items-center justify-between">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/15 text-signal transition-transform group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>
              </span>
              <span class="text-xs text-signal group-hover:translate-x-0.5 transition-transform">Explore →</span>
            </div>
            <h3 class="mt-4 text-base font-semibold text-foreground">Interactive Analytics</h3>
            <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
              Bar graphs of events over time, stream-wise comparisons, severity distributions, and telemetry statistics.
            </p>
          </a>

          <a
            data-nav="history"
            class="group cursor-pointer rounded-xl border border-border/80 bg-card/60 p-6 transition-all duration-200 hover:border-iris/50 hover:bg-card/90 hover:shadow-md"
            href="#history"
          >
            <div class="flex items-center justify-between">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-iris/15 text-iris transition-transform group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
              </span>
              <span class="text-xs text-iris group-hover:translate-x-0.5 transition-transform">View ${historyList.length} logs →</span>
            </div>
            <h3 class="mt-4 text-base font-semibold text-foreground">Stream History</h3>
            <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
              Search and filter previously recorded stream sessions, inspect timestamps, and load historical runs into monitor.
            </p>
          </a>

          <a
            data-nav="live"
            class="group cursor-pointer rounded-xl border border-border/80 bg-card/60 p-6 transition-all duration-200 hover:border-success/50 hover:bg-card/90 hover:shadow-md"
            href="#live"
          >
            <div class="flex items-center justify-between">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-success/15 text-success transition-transform group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path></svg>
              </span>
              <span class="text-xs text-success group-hover:translate-x-0.5 transition-transform">Monitor →</span>
            </div>
            <h3 class="mt-4 text-base font-semibold text-foreground">Live Stream Monitor</h3>
            <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
              Watch point-by-point dual canvas charts, dynamic threshold envelope, and explainable event clustering.
            </p>
          </a>

          <a
            data-nav="settings"
            class="group cursor-pointer rounded-xl border border-border/80 bg-card/60 p-6 transition-all duration-200 hover:border-warn/50 hover:bg-card/90 hover:shadow-md"
            href="#settings"
          >
            <div class="flex items-center justify-between">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-warn/15 text-warn transition-transform group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </span>
              <span class="text-xs text-warn group-hover:translate-x-0.5 transition-transform">Configure →</span>
            </div>
            <h3 class="mt-4 text-base font-semibold text-foreground">Settings & Thresholds</h3>
            <p class="mt-2 text-sm text-muted-foreground leading-relaxed">
              Configure detection and playback. Current settings:
            </p>
            <dl class="mt-3 space-y-2 border-t border-border/70 pt-3 text-xs">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Sensitivity</dt>
                <dd class="font-mono text-foreground">${s.params?.k?.toFixed(1) || "4.0"}σ</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Stream speed</dt>
                <dd class="font-mono text-foreground">${activeSpeed} ms/point</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Baseline window</dt>
                <dd class="font-mono text-foreground">${s.params?.win || 60} points</dd>
              </div>
            </dl>
          </a>
        </section>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 2: SETTINGS PAGE
  // =========================================================================
  function renderSettingsView() {
    const s = getSentinel();
    const currentSettings = loadSettings();
    const activeThreshold = s.params?.k != null ? s.params.k : currentSettings.threshold;
    const activeSpeed = window.sentinelStreamIntervalMs || currentSettings.waveSpeed;
    const activeWin = s.params?.win || currentSettings.window;
    const activeMinRun = s.params?.minRun || currentSettings.minRun;
    const ptsPerSec = (1000 / activeSpeed).toFixed(1);

    // Sensitivity evaluation text
    let sensitivityLabel = "Balanced Sensitivity (Recommended)";
    let sensitivityColor = "text-success border-success/30 bg-success/10";
    if (activeThreshold < 2.5) {
      sensitivityLabel = "High Sensitivity (Captures minor deviations; higher false alarm risk)";
      sensitivityColor = "text-warn border-warn/30 bg-warn/10";
    } else if (activeThreshold > 5.0) {
      sensitivityLabel = "Low Sensitivity (Only flags severe high-magnitude spikes)";
      sensitivityColor = "text-signal border-signal/30 bg-signal/10";
    }

    return `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- HEADER -->
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-signal mb-1">
              Configuration Panel
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Live Stream Settings & Parameters</h1>
            <p class="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Configure detection thresholds, wave playback speed, adaptive baseline window, and alert notifications in real time without refreshing the page.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              id="resetSettingsBtn"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-signal/40 hover:text-signal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              Reset to Defaults
            </button>
            <button
              id="saveSettingsBtn"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 text-xs font-semibold text-signal-foreground transition-all hover:opacity-90 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save & Apply Settings
            </button>
          </div>
        </div>

        <!-- STATUS / VALIDATION BANNERS -->
        <div id="settingsAlertSuccess" class="hidden rounded-lg border border-success/40 bg-success/15 px-4 py-3 text-xs text-success flex items-center justify-between">
          <span class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-success"></span>
            <strong id="settingsSuccessMsg">Settings saved successfully! Parameters applied to live stream.</strong>
          </span>
          <span class="text-[10px] uppercase font-mono opacity-80">Instant Live Update</span>
        </div>

        <div id="settingsAlertError" class="hidden rounded-lg border border-danger/40 bg-danger/15 px-4 py-3 text-xs text-danger flex items-center justify-between">
          <span class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <strong id="settingsErrorMsg">Please correct the invalid values indicated below.</strong>
          </span>
          <span class="text-[10px] uppercase font-mono opacity-80">Validation Error</span>
        </div>

        <!-- CURRENT CONFIGURATION DISPLAY PANEL -->
        <section class="rounded-xl border border-signal/30 bg-gradient-to-r from-signal/10 via-card/70 to-card/70 p-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-signal">Currently Active Configuration</p>
              <div class="mt-1 flex flex-wrap items-baseline gap-4 font-mono text-sm sm:text-base">
                <span>Threshold: <strong class="text-signal text-lg font-bold" id="activeThresholdDisplay">${activeThreshold.toFixed(1)}σ</strong></span>
                <span class="text-border">|</span>
                <span>Wave Speed: <strong class="text-foreground" id="activeSpeedDisplay">${activeSpeed} ms</strong> <span class="text-xs text-muted-foreground">(~${ptsPerSec} pts/s)</span></span>
                <span class="text-border">|</span>
                <span>Baseline Window: <strong class="text-foreground" id="activeWindowDisplay">${activeWin} pts</strong></span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-3 py-1 font-mono text-xs text-success">
                <span class="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                Active in Live Stream
              </span>
            </div>
          </div>
        </section>

        <!-- MAIN CONFIGURATION SECTIONS GRID -->
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- CARD 1: THRESHOLD CONFIGURATION -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-4">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">1. Detection Threshold Configuration</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Set the sensitivity multiplier for flagging deviations above adaptive baseline.
                </p>
              </div>
              <span class="rounded bg-signal/15 px-2 py-0.5 font-mono text-xs text-signal font-semibold">k-sigma (σ)</span>
            </div>

            <!-- Synced Range Slider & Input -->
            <div class="space-y-3 pt-1">
              <div class="flex items-center justify-between">
                <label for="thresholdInput" class="text-xs font-medium text-foreground">Threshold Value (k):</label>
                <div class="flex items-center gap-1.5">
                  <input
                    id="thresholdInput"
                    type="number"
                    min="0.5"
                    max="20.0"
                    step="0.1"
                    value="${activeThreshold}"
                    class="h-8 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground text-right outline-none focus:border-signal/60"
                  />
                  <span class="text-xs text-muted-foreground">σ</span>
                </div>
              </div>

              <!-- Slider -->
              <input
                id="thresholdSlider"
                type="range"
                min="1.0"
                max="12.0"
                step="0.1"
                value="${Math.min(12, Math.max(1, activeThreshold))}"
                class="w-full accent-cyan-400 cursor-pointer"
              />

              <div class="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>1.0σ (Ultra sensitive)</span>
                <span>4.0σ (Default)</span>
                <span>12.0σ (Severe spikes only)</span>
              </div>

              <!-- Dynamic sensitivity badge -->
              <div id="thresholdFeedback" class="mt-2 rounded-lg border p-2.5 text-xs ${sensitivityColor}">
                <p class="font-medium">${sensitivityLabel}</p>
                <p class="text-[11px] opacity-90 mt-0.5">
                  Anomaly score = |observed - median| / MAD. Any observation score exceeding <b class="font-mono">${activeThreshold.toFixed(1)}</b> triggers an anomaly alert.
                </p>
              </div>
            </div>
          </section>

          <!-- CARD 2: WAVE SPEED CONFIGURATION -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-4">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">2. Wave Speed Configuration</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Adjust how rapidly live observations advance along the telemetry stream.
                </p>
              </div>
              <span class="rounded bg-iris/15 px-2 py-0.5 font-mono text-xs text-iris font-semibold">Speed Control</span>
            </div>

            <!-- Numeric Input with Dual Units -->
            <div class="space-y-3 pt-1">
              <div class="flex items-center justify-between">
                <label for="waveSpeedInput" class="text-xs font-medium text-foreground">Interval per Point:</label>
                <div class="flex items-center gap-1.5">
                  <input
                    id="waveSpeedInput"
                    type="number"
                    min="10"
                    max="2000"
                    step="5"
                    value="${activeSpeed}"
                    class="h-8 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground text-right outline-none focus:border-signal/60"
                  />
                  <span class="text-xs text-muted-foreground">ms / pt</span>
                </div>
              </div>

              <!-- Slider -->
              <input
                id="waveSpeedSlider"
                type="range"
                min="15"
                max="500"
                step="5"
                value="${Math.min(500, Math.max(15, activeSpeed))}"
                class="w-full accent-cyan-400 cursor-pointer"
              />

              <!-- Dual Unit Readout Box -->
              <div class="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex items-center justify-between text-xs">
                <span class="text-muted-foreground">Calculated Throughput:</span>
                <span class="font-mono text-foreground font-semibold" id="speedThroughputDisplay">
                  ~${ptsPerSec} points / sec (${activeSpeed} ms interval)
                </span>
              </div>

              <!-- Quick Presets -->
              <div>
                <span class="text-[11px] text-muted-foreground block mb-1.5">Speed Presets:</span>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" data-preset-speed="20" class="speed-preset-btn rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-foreground">Ultra Fast (20 ms)</button>
                  <button type="button" data-preset-speed="45" class="speed-preset-btn rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-foreground">Fast (45 ms · Default)</button>
                  <button type="button" data-preset-speed="100" class="speed-preset-btn rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-foreground">Balanced (100 ms)</button>
                  <button type="button" data-preset-speed="250" class="speed-preset-btn rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-foreground">Observational (250 ms)</button>
                  <button type="button" data-preset-speed="500" class="speed-preset-btn rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-signal/40 hover:text-foreground">Slow Motion (500 ms)</button>
                </div>
              </div>
            </div>
          </section>

          <!-- CARD 3: BASELINE DETECTION PARAMETERS -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-4">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">3. Baseline & Algorithm Tuning</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Adaptive rolling statistics window and anomaly persistence criteria.
                </p>
              </div>
              <span class="rounded bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">Adaptive Window</span>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 pt-1">
              <label class="block text-xs text-muted-foreground">
                Baseline History Window
                <div class="mt-1 flex items-center gap-1.5">
                  <input
                    id="windowInput"
                    type="number"
                    min="10"
                    max="300"
                    value="${activeWin}"
                    class="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none focus:border-signal/60"
                  />
                  <span class="text-xs text-muted-foreground shrink-0">pts</span>
                </div>
                <span class="text-[10px] text-muted-foreground/80 mt-1 block">Observations used to estimate MAD median</span>
              </label>

              <label class="block text-xs text-muted-foreground">
                Minimum Consecutive Run
                <div class="mt-1 flex items-center gap-1.5">
                  <input
                    id="minRunInput"
                    type="number"
                    min="1"
                    max="10"
                    value="${activeMinRun}"
                    class="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground outline-none focus:border-signal/60"
                  />
                  <span class="text-xs text-muted-foreground shrink-0">pts</span>
                </div>
                <span class="text-[10px] text-muted-foreground/80 mt-1 block">Consecutive flags required before clustering</span>
              </label>
            </div>

            <div class="pt-2">
              <label class="block text-xs text-muted-foreground">Data Fetch Source Mode</label>
              <select
                id="sourceSelect"
                class="mt-1.5 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-signal/60"
              >
                <option value="github" ${currentSettings.source === "github" ? "selected" : ""}>Live GitHub Remote (raw.githubusercontent.com numenta/NAB)</option>
                <option value="local" ${currentSettings.source === "local" ? "selected" : ""}>Local Cached Benchmark Corpus (data/nab/)</option>
              </select>
            </div>

            <div class="pt-3 border-t border-border/40 mt-3">
              <label class="block text-xs font-medium text-foreground">Active NAB Dataset</label>
              <p class="text-[10px] text-muted-foreground mt-0.5 mb-1.5">Select any of the 58 datasets from the <a href="https://github.com/numenta/NAB/tree/ea702d75cc2258d9d7dd35ca8e5e2539d71f3140/data" target="_blank" rel="noopener noreferrer" class="text-signal hover:underline">Numenta Anomaly Benchmark</a> repository.</p>
              <select
                id="settingsDatasetSelect"
                class="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-signal/60"
              >
                ${buildNabDatasetOptions(s)}
              </select>
              <div id="settingsDatasetInfo" class="mt-2 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                ${buildDatasetInfoSnippet(s)}
              </div>
            </div>
          </section>

          <!-- CARD 4: DISPLAY, ALERTS & AUTO-PAUSE -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-4">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">4. Alerts & Stream Controls</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Notification options, ground-truth overlays, and automation triggers.
                </p>
              </div>
              <span class="rounded bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">Automation</span>
            </div>

            <div class="space-y-3 pt-1">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-xs font-medium text-foreground block">Auto-pause on Critical Anomaly</span>
                  <span class="text-[11px] text-muted-foreground">Halts streaming playback immediately when score &ge; 2.0x threshold</span>
                </div>
                <select id="autoPauseSelect" class="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                  <option value="off" ${currentSettings.autoPause === "off" ? "selected" : ""}>Disabled</option>
                  <option value="on" ${currentSettings.autoPause === "on" ? "selected" : ""}>Enabled</option>
                </select>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <span class="text-xs font-medium text-foreground block">Ground-Truth Windows Display</span>
                  <span class="text-[11px] text-muted-foreground">Render official NAB benchmark verification windows on chart</span>
                </div>
                <select id="truthSelect" class="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                  <option value="shown" ${currentSettings.truth === "shown" ? "selected" : ""}>Shown on chart</option>
                  <option value="hidden" ${currentSettings.truth === "hidden" ? "selected" : ""}>Hidden</option>
                </select>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <span class="text-xs font-medium text-foreground block">Notification Alert Popups</span>
                  <span class="text-[11px] text-muted-foreground">Show notification toast when flagged anomalies are encountered</span>
                </div>
                <select id="alertsSelect" class="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground">
                  <option value="enabled" ${currentSettings.alerts === "enabled" ? "selected" : ""}>Enabled</option>
                  <option value="disabled" ${currentSettings.alerts === "disabled" ? "selected" : ""}>Disabled</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <!-- BOTTOM ACTION BUTTONS -->
        <div class="flex items-center justify-between pt-4 border-t border-border/60">
          <p class="text-xs text-muted-foreground">
            Saved settings are persisted in your browser and automatically loaded on startup.
          </p>
          <div class="flex items-center gap-3">
            <button
              id="resetSettingsBtnBottom"
              type="button"
              class="rounded-lg border border-border bg-card/80 px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              id="saveSettingsBtnBottom"
              type="button"
              class="rounded-lg bg-signal px-5 py-2 text-xs font-semibold text-signal-foreground hover:opacity-90 transition-opacity shadow-sm"
            >
              Save & Apply Settings
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Bind settings page interactivity
  function bindSettingsEvents(container) {
    const s = getSentinel();
    const thresholdInput = container.querySelector("#thresholdInput");
    const thresholdSlider = container.querySelector("#thresholdSlider");
    const waveSpeedInput = container.querySelector("#waveSpeedInput");
    const waveSpeedSlider = container.querySelector("#waveSpeedSlider");
    const speedThroughputDisplay = container.querySelector("#speedThroughputDisplay");
    const thresholdFeedback = container.querySelector("#thresholdFeedback");
    const saveBtn = container.querySelector("#saveSettingsBtn");
    const saveBtnBottom = container.querySelector("#saveSettingsBtnBottom");
    const resetBtn = container.querySelector("#resetSettingsBtn");
    const resetBtnBottom = container.querySelector("#resetSettingsBtnBottom");
    const alertSuccess = container.querySelector("#settingsAlertSuccess");
    const alertError = container.querySelector("#settingsAlertError");
    const errorMsg = container.querySelector("#settingsErrorMsg");

    function updateThroughput(ms) {
      if (!ms || isNaN(ms) || ms <= 0) return;
      const pts = (1000 / ms).toFixed(1);
      if (speedThroughputDisplay) {
        speedThroughputDisplay.textContent = `~${pts} points / sec (${ms} ms interval)`;
      }
    }

    function updateThresholdFeedback(val) {
      if (!thresholdFeedback || isNaN(val)) return;
      if (val < 2.5) {
        thresholdFeedback.className = "mt-2 rounded-lg border p-2.5 text-xs text-warn border-warn/30 bg-warn/10";
        thresholdFeedback.innerHTML = `
          <p class="font-medium">High Sensitivity (Captures minor deviations; higher false alarm risk)</p>
          <p class="text-[11px] opacity-90 mt-0.5">Anomaly score = |observed - median| / MAD. Any observation score exceeding <b class="font-mono">${Number(val).toFixed(1)}</b> triggers an anomaly alert.</p>
        `;
      } else if (val > 5.0) {
        thresholdFeedback.className = "mt-2 rounded-lg border p-2.5 text-xs text-signal border-signal/30 bg-signal/10";
        thresholdFeedback.innerHTML = `
          <p class="font-medium">Low Sensitivity (Only flags severe high-magnitude spikes)</p>
          <p class="text-[11px] opacity-90 mt-0.5">Anomaly score = |observed - median| / MAD. Any observation score exceeding <b class="font-mono">${Number(val).toFixed(1)}</b> triggers an anomaly alert.</p>
        `;
      } else {
        thresholdFeedback.className = "mt-2 rounded-lg border p-2.5 text-xs text-success border-success/30 bg-success/10";
        thresholdFeedback.innerHTML = `
          <p class="font-medium">Balanced Sensitivity (Recommended)</p>
          <p class="text-[11px] opacity-90 mt-0.5">Anomaly score = |observed - median| / MAD. Any observation score exceeding <b class="font-mono">${Number(val).toFixed(1)}</b> triggers an anomaly alert.</p>
        `;
      }
    }

    // Threshold sync
    if (thresholdSlider && thresholdInput) {
      thresholdSlider.addEventListener("input", (e) => {
        thresholdInput.value = e.target.value;
        updateThresholdFeedback(Number(e.target.value));
      });
      thresholdInput.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val) && val >= 1.0 && val <= 12.0) {
          thresholdSlider.value = val;
        }
        updateThresholdFeedback(val);
      });
    }

    // Wave speed sync
    if (waveSpeedSlider && waveSpeedInput) {
      waveSpeedSlider.addEventListener("input", (e) => {
        waveSpeedInput.value = e.target.value;
        updateThroughput(Number(e.target.value));
      });
      waveSpeedInput.addEventListener("input", (e) => {
        const val = Number(e.target.value);
        if (!isNaN(val) && val >= 15 && val <= 500) {
          waveSpeedSlider.value = val;
        }
        updateThroughput(val);
      });
    }

    // Speed presets
    container.querySelectorAll(".speed-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const spd = Number(btn.dataset.presetSpeed);
        if (waveSpeedInput) waveSpeedInput.value = spd;
        if (waveSpeedSlider) waveSpeedSlider.value = Math.min(500, Math.max(15, spd));
        updateThroughput(spd);
      });
    });

    // Save settings handler
    function handleSave() {
      if (alertError) alertError.classList.add("hidden");
      if (alertSuccess) alertSuccess.classList.add("hidden");

      const thresholdVal = Number(thresholdInput?.value);
      const waveSpeedVal = Number(waveSpeedInput?.value);
      const windowVal = Number(container.querySelector("#windowInput")?.value);
      const minRunVal = Number(container.querySelector("#minRunInput")?.value);
      const sourceVal = container.querySelector("#sourceSelect")?.value || "github";
      const autoPauseVal = container.querySelector("#autoPauseSelect")?.value || "off";
      const truthVal = container.querySelector("#truthSelect")?.value || "shown";
      const alertsVal = container.querySelector("#alertsSelect")?.value || "enabled";

      // Input Validation
      const errors = [];
      if (isNaN(thresholdVal) || thresholdVal < 0.5 || thresholdVal > 20.0) {
        errors.push("Detection threshold must be a valid number between 0.5 and 20.0.");
        thresholdInput?.classList.add("border-danger");
      } else {
        thresholdInput?.classList.remove("border-danger");
      }

      if (isNaN(waveSpeedVal) || waveSpeedVal < 10 || waveSpeedVal > 2000) {
        errors.push("Wave speed must be an interval between 10 ms and 2,000 ms.");
        waveSpeedInput?.classList.add("border-danger");
      } else {
        waveSpeedInput?.classList.remove("border-danger");
      }

      if (isNaN(windowVal) || windowVal < 10 || windowVal > 300) {
        errors.push("Baseline window must be between 10 and 300 observations.");
      }

      if (isNaN(minRunVal) || minRunVal < 1 || minRunVal > 10) {
        errors.push("Minimum consecutive run must be between 1 and 10 points.");
      }

      if (errors.length > 0) {
        if (alertError && errorMsg) {
          errorMsg.innerHTML = errors.join("<br/>");
          alertError.classList.remove("hidden");
        }
        return;
      }

      // Persist to storage
      const newSettings = {
        threshold: thresholdVal,
        waveSpeed: waveSpeedVal,
        window: windowVal,
        minRun: minRunVal,
        source: sourceVal,
        autoPause: autoPauseVal,
        truth: truthVal,
        alerts: alertsVal,
      };
      saveSettings(newSettings);

      // LIVE UPDATES: Apply to live-stream monitoring process without requiring full page refresh
      s.params.k = thresholdVal;
      s.params.win = windowVal;
      s.params.minRun = minRunVal;
      s.fetchSourceMode = sourceVal;
      s.showGroundTruth = truthVal === "shown";
      window.sentinelStreamIntervalMs = waveSpeedVal;

      // Recompute detection and restart stream timer
      s.recomputeDetection();
      s.startStream();
      s.updateStatusUI();
      s.renderCharts();
      s.renderEventList();
      s.renderInspection();

      // Update current configuration displays
      const activeThresholdDisplay = container.querySelector("#activeThresholdDisplay");
      const activeSpeedDisplay = container.querySelector("#activeSpeedDisplay");
      const activeWindowDisplay = container.querySelector("#activeWindowDisplay");
      if (activeThresholdDisplay) activeThresholdDisplay.textContent = `${thresholdVal.toFixed(1)}σ`;
      if (activeSpeedDisplay) activeSpeedDisplay.innerHTML = `${waveSpeedVal} ms <span class="text-xs text-muted-foreground">(~${(1000 / waveSpeedVal).toFixed(1)} pts/s)</span>`;
      if (activeWindowDisplay) activeWindowDisplay.textContent = `${windowVal} pts`;

      if (alertSuccess) {
        alertSuccess.classList.remove("hidden");
        setTimeout(() => alertSuccess.classList.add("hidden"), 5000);
      }
    }

    // Reset settings handler
    function handleReset() {
      if (confirm("Reset all stream monitoring parameters to default values?")) {
        saveSettings(defaultSettings);
        s.params.k = defaultSettings.threshold;
        s.params.win = defaultSettings.window;
        s.params.minRun = defaultSettings.minRun;
        s.fetchSourceMode = defaultSettings.source;
        s.showGroundTruth = defaultSettings.truth === "shown";
        window.sentinelStreamIntervalMs = defaultSettings.waveSpeed;

        s.recomputeDetection();
        s.startStream();
        s.updateStatusUI();
        s.renderCharts();
        s.renderEventList();

        // Re-render settings view
        renderRoute("settings");
      }
    }

    if (saveBtn) saveBtn.addEventListener("click", handleSave);
    if (saveBtnBottom) saveBtnBottom.addEventListener("click", handleSave);
    if (resetBtn) resetBtn.addEventListener("click", handleReset);
    if (resetBtnBottom) resetBtnBottom.addEventListener("click", handleReset);
  }

  // =========================================================================
  // VIEW 3: STREAM HISTORY PAGE
  // =========================================================================
  function renderHistoryView() {
    const s = getSentinel();
    const historyList = loadHistory();

    // Summary calculations
    const totalSessions = historyList.length;
    const totalEvents = historyList.reduce((acc, h) => acc + (h.eventsCount || 0), 0);
    const avgThreshold = totalSessions
      ? (historyList.reduce((acc, h) => acc + (h.threshold || 4), 0) / totalSessions).toFixed(1)
      : "4.0";
    const totalPoints = historyList.reduce((acc, h) => acc + (h.points || 0), 0);

    // Filter by search
    let filtered = historyList.filter((item) => {
      const q = historySearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    });

    // Filter by status
    if (historyStatusFilter !== "all") {
      filtered = filtered.filter((item) => item.status.toLowerCase() === historyStatusFilter.toLowerCase());
    }

    // Filter by date
    if (historyDateFilter !== "all") {
      const now = Date.now();
      if (historyDateFilter === "today") {
        filtered = filtered.filter((item) => now - (item.timestamp || 0) < 86400000);
      } else if (historyDateFilter === "7days") {
        filtered = filtered.filter((item) => now - (item.timestamp || 0) < 86400000 * 7);
      } else if (historyDateFilter === "30days") {
        filtered = filtered.filter((item) => now - (item.timestamp || 0) < 86400000 * 30);
      }
    }

    // Sort options
    filtered.sort((a, b) => {
      if (historySortBy === "date_desc") return (b.timestamp || 0) - (a.timestamp || 0);
      if (historySortBy === "date_asc") return (a.timestamp || 0) - (b.timestamp || 0);
      if (historySortBy === "events_desc") return (b.eventsCount || 0) - (a.eventsCount || 0);
      if (historySortBy === "threshold_desc") return (b.threshold || 0) - (a.threshold || 0);
      if (historySortBy === "duration_desc") return (b.points || 0) - (a.points || 0);
      return 0;
    });

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_PER_PAGE));
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    const startIndex = (historyCurrentPage - 1) * HISTORY_PER_PAGE;
    const paginatedItems = filtered.slice(startIndex, startIndex + HISTORY_PER_PAGE);

    return `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- HEADER -->
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-iris/40 bg-iris/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-iris mb-1">
              Historical Stream Archives
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Stream History & Session Logs</h1>
            <p class="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Review previously recorded live-stream monitoring runs, filter by date or severity, inspect anomaly timelines, and re-stream past sessions.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              id="recordCurrentStreamBtn"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-signal/40 bg-signal/10 px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
              Record Current Stream
            </button>
            <button
              id="restoreHistoryBtn"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              Restore Benchmark Samples
            </button>
            <button
              id="clearHistoryBtn"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <!-- SUMMARY STATS BANNER -->
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${statCard("Recorded Sessions", totalSessions, "Total historical streams logged")}
          ${statCard("Cumulative Points", totalPoints.toLocaleString(), "Benchmark observations processed")}
          ${statCard("Total Detected Anomalies", totalEvents, "Verified & flagged event markers")}
          ${statCard("Avg Threshold Used", `${avgThreshold}σ`, "Historical detector sensitivity")}
        </section>

        <!-- SEARCH, FILTERS & SORTING CONTROLS -->
        <section class="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center gap-3">
            <!-- Search -->
            <div class="flex-1 min-w-[240px]">
              <input
                id="historySearchInput"
                type="text"
                placeholder="Search by stream ID (STR-...), dataset name, or keyword..."
                value="${historySearchQuery}"
                class="h-8 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-signal/60"
              />
            </div>

            <!-- Status filter -->
            <select
              id="historyStatusFilterSelect"
              class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60"
            >
              <option value="all" ${historyStatusFilter === "all" ? "selected" : ""}>All Statuses</option>
              <option value="completed" ${historyStatusFilter === "completed" ? "selected" : ""}>Completed</option>
              <option value="flagged" ${historyStatusFilter === "flagged" ? "selected" : ""}>Flagged (Anomalous)</option>
              <option value="archived" ${historyStatusFilter === "archived" ? "selected" : ""}>Archived</option>
            </select>

            <!-- Date filter -->
            <select
              id="historyDateFilterSelect"
              class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60"
            >
              <option value="all" ${historyDateFilter === "all" ? "selected" : ""}>All Dates</option>
              <option value="today" ${historyDateFilter === "today" ? "selected" : ""}>Past 24 Hours</option>
              <option value="7days" ${historyDateFilter === "7days" ? "selected" : ""}>Past 7 Days</option>
              <option value="30days" ${historyDateFilter === "30days" ? "selected" : ""}>Past 30 Days</option>
            </select>

            <!-- Sort By -->
            <select
              id="historySortSelect"
              class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60"
            >
              <option value="date_desc" ${historySortBy === "date_desc" ? "selected" : ""}>Date: Newest First</option>
              <option value="date_asc" ${historySortBy === "date_asc" ? "selected" : ""}>Date: Oldest First</option>
              <option value="events_desc" ${historySortBy === "events_desc" ? "selected" : ""}>Events: Most Anomalies</option>
              <option value="duration_desc" ${historySortBy === "duration_desc" ? "selected" : ""}>Duration: Longest First</option>
              <option value="threshold_desc" ${historySortBy === "threshold_desc" ? "selected" : ""}>Threshold: Highest First</option>
            </select>
          </div>
        </section>

        <!-- STREAM HISTORY TABLE / LIST -->
        <section class="overflow-hidden rounded-xl border border-border/80 bg-card/60 shadow-sm">
          ${
            filtered.length === 0
              ? `
            <!-- EMPTY STATE -->
            <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span class="flex h-12 w-12 items-center justify-center rounded-full border border-border/80 bg-muted/30 text-muted-foreground mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
              </span>
              <h3 class="text-base font-semibold text-foreground">No Historical Streams Available</h3>
              <p class="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
                ${
                  historySearchQuery || historyStatusFilter !== "all" || historyDateFilter !== "all"
                    ? "No sessions match your search and filter criteria. Clear filters to view all records."
                    : "There are currently no recorded stream sessions in history."
                }
              </p>
              <div class="mt-4 flex gap-2">
                <button id="emptyStateResetFiltersBtn" class="rounded-lg bg-signal/15 border border-signal/40 px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal/25 transition-colors">
                  Reset Search & Filters
                </button>
                <button id="emptyStateRestoreBtn" class="rounded-lg border border-border bg-card/80 px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 transition-colors">
                  Restore 12 Sample Streams
                </button>
              </div>
            </div>
          `
              : `
            <!-- SESSIONS TABLE -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead class="border-b border-border/60 bg-muted/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th class="py-3 px-3.5">Stream ID</th>
                    <th class="py-3 px-3.5">Dataset Name</th>
                    <th class="py-3 px-3.5">Date & Start Time</th>
                    <th class="py-3 px-3.5">Duration / Points</th>
                    <th class="py-3 px-3.5">Status</th>
                    <th class="py-3 px-3.5">Config (Threshold · Speed)</th>
                    <th class="py-3 px-3.5">Metrics & Events</th>
                    <th class="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/20 text-xs">
                  ${paginatedItems
                    .map((item) => {
                      const statusColor =
                        item.status === "Completed"
                          ? "border-success/40 bg-success/15 text-success"
                          : item.status === "Flagged"
                          ? "border-danger/40 bg-danger/15 text-danger"
                          : item.status === "Active"
                          ? "border-signal/40 bg-signal/15 text-signal"
                          : "border-border bg-muted/40 text-muted-foreground";

                      return `
                        <tr class="hover:bg-muted/20 transition-colors group">
                          <td class="py-3 px-3.5 font-mono text-[11px] font-semibold text-signal whitespace-nowrap">
                            ${item.id}
                          </td>
                          <td class="py-3 px-3.5">
                            <div class="font-medium text-foreground">${item.name}</div>
                            <div class="text-[10px] text-muted-foreground font-mono mt-0.5">${item.category || "NAB Corpus"}</div>
                          </td>
                          <td class="py-3 px-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            ${item.date}
                          </td>
                          <td class="py-3 px-3.5 font-mono text-[11px] text-foreground whitespace-nowrap">
                            <div>${item.duration}</div>
                            <div class="text-[10px] text-muted-foreground">${(item.points || 0).toLocaleString()} pts</div>
                          </td>
                          <td class="py-3 px-3.5 whitespace-nowrap">
                            <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider ${statusColor}">
                              ${item.status}
                            </span>
                          </td>
                          <td class="py-3 px-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            <span class="text-foreground font-semibold">k = ${item.threshold.toFixed(1)}σ</span> · ${item.waveSpeed} ms/pt
                          </td>
                          <td class="py-3 px-3.5 whitespace-nowrap">
                            <div class="flex items-center gap-2">
                              <span class="font-semibold ${item.eventsCount > 0 ? "text-warn" : "text-success"}">
                                ${item.eventsCount} events
                              </span>
                              ${
                                item.criticalCount > 0
                                  ? `<span class="rounded bg-danger/20 border border-danger/40 px-1 text-[9px] font-mono text-danger font-bold">${item.criticalCount} crit</span>`
                                  : ""
                              }
                            </div>
                            <div class="text-[10px] text-muted-foreground font-mono">Peak: ${item.peakScore || "—"}σ</div>
                          </td>
                          <td class="py-3 px-3.5 text-right whitespace-nowrap">
                            <div class="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                data-inspect-stream-id="${item.id}"
                                class="inspect-stream-btn rounded-md border border-border bg-card/70 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-signal/50 hover:text-signal transition-colors"
                              >
                                View Details
                              </button>
                              <button
                                type="button"
                                data-load-stream-id="${item.id}"
                                class="load-stream-btn rounded-md bg-signal/15 border border-signal/30 px-2.5 py-1 text-[11px] font-semibold text-signal hover:bg-signal/25 transition-colors"
                                title="Load this dataset into Live Stream Monitor"
                              >
                                Re-Stream →
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>

            <!-- PAGINATION BAR -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 p-3.5 text-xs text-muted-foreground">
              <span>
                Showing <strong class="text-foreground">${filtered.length ? startIndex + 1 : 0}</strong> to <strong class="text-foreground">${Math.min(filtered.length, startIndex + HISTORY_PER_PAGE)}</strong> of <strong class="text-foreground">${filtered.length}</strong> previous stream sessions
              </span>

              <div class="flex items-center gap-1.5">
                <button
                  id="historyPrevPageBtn"
                  type="button"
                  ${historyCurrentPage <= 1 ? "disabled" : ""}
                  class="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span class="px-2 font-mono text-foreground text-xs">Page ${historyCurrentPage} of ${totalPages}</span>
                <button
                  id="historyNextPageBtn"
                  type="button"
                  ${historyCurrentPage >= totalPages ? "disabled" : ""}
                  class="rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          `
          }
        </section>
      </div>
    `;
  }

  // Open detailed history modal for a selected session
  function openHistoryDetailModal(sessionId) {
    const historyList = loadHistory();
    const item = historyList.find((h) => h.id === sessionId);
    if (!item) return;

    const modal = document.getElementById("historyDetailModal");
    const modalId = document.getElementById("histModalId");
    const modalTitle = document.getElementById("histModalTitle");
    const modalStatus = document.getElementById("histModalStatus");
    const modalDate = document.getElementById("histModalDate");
    const modalBody = document.getElementById("histModalBody");
    const loadStreamBtn = document.getElementById("histModalLoadStreamBtn");

    if (!modal) return;

    if (modalId) modalId.textContent = item.id;
    if (modalTitle) modalTitle.textContent = item.name;
    if (modalStatus) {
      modalStatus.textContent = item.status;
      modalStatus.className = `text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
        item.status === "Completed"
          ? "border-success/40 bg-success/15 text-success"
          : item.status === "Flagged"
          ? "border-danger/40 bg-danger/15 text-danger"
          : "border-border bg-muted/40 text-muted-foreground"
      }`;
    }
    if (modalDate) {
      modalDate.textContent = `Recorded: ${item.date} · Duration: ${item.duration} · ${(item.points || 0).toLocaleString()} observations`;
    }

    // Build modal body
    if (modalBody) {
      const events = item.events || [];
      const eventRows = events.length
        ? events
            .map(
              (ev) => `
          <tr class="hover:bg-muted/20 border-b border-border/30 text-[11px]">
            <td class="py-2 px-2.5 font-mono text-signal">#${ev.id}</td>
            <td class="py-2 px-2.5 font-mono text-muted-foreground">${ev.time}</td>
            <td class="py-2 px-2.5 font-mono font-bold ${ev.score >= 2 * ev.thr ? "text-danger" : ev.score >= 1.5 * ev.thr ? "text-warn" : "text-signal"}">${ev.score.toFixed(2)}σ</td>
            <td class="py-2 px-2.5">
              <span class="rounded px-1.5 py-0.5 text-[9px] uppercase font-semibold ${
                ev.severity === "critical"
                  ? "bg-danger/20 text-danger border border-danger/40"
                  : ev.severity === "high"
                  ? "bg-warn/20 text-warn border border-warn/40"
                  : "bg-signal/20 text-signal border border-signal/40"
              }">${ev.severity}</span>
            </td>
            <td class="py-2 px-2.5 text-muted-foreground max-w-xs truncate" title="${ev.evidence || ""}">${ev.evidence || "Threshold violation"}</td>
          </tr>
        `
            )
            .join("")
        : `<tr><td colspan="5" class="py-6 text-center text-xs text-muted-foreground">No anomaly events flagged during this stream run.</td></tr>`;

      modalBody.innerHTML = `
        <!-- Parameters Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="rounded-lg border border-border/70 bg-card/50 p-2.5">
            <span class="text-[10px] uppercase font-medium text-muted-foreground">Threshold</span>
            <div class="mt-1 font-mono text-base font-bold text-foreground">k = ${item.threshold.toFixed(1)}σ</div>
          </div>
          <div class="rounded-lg border border-border/70 bg-card/50 p-2.5">
            <span class="text-[10px] uppercase font-medium text-muted-foreground">Wave Speed</span>
            <div class="mt-1 font-mono text-base font-bold text-foreground">${item.waveSpeed} ms/pt</div>
          </div>
          <div class="rounded-lg border border-border/70 bg-card/50 p-2.5">
            <span class="text-[10px] uppercase font-medium text-muted-foreground">Total Events</span>
            <div class="mt-1 font-mono text-base font-bold text-warn">${item.eventsCount} (${item.criticalCount || 0} crit)</div>
          </div>
          <div class="rounded-lg border border-border/70 bg-card/50 p-2.5">
            <span class="text-[10px] uppercase font-medium text-muted-foreground">Precision</span>
            <div class="mt-1 font-mono text-base font-bold text-success">${item.precision || "100%"}</div>
          </div>
        </div>

        ${
          item.notes
            ? `<div class="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                <strong class="text-foreground">Session Log Note:</strong> ${item.notes}
               </div>`
            : ""
        }

        <!-- Events Table -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-foreground">Flagged Anomaly Windows (${events.length})</h4>
            <span class="font-mono text-[10px] text-muted-foreground">Sorted by trigger peak</span>
          </div>
          <div class="overflow-x-auto rounded-lg border border-border/70 max-h-56">
            <table class="w-full text-left">
              <thead class="bg-muted/30 text-[9px] uppercase font-semibold text-muted-foreground">
                <tr>
                  <th class="py-1.5 px-2.5">ID</th>
                  <th class="py-1.5 px-2.5">Timestamp</th>
                  <th class="py-1.5 px-2.5">Score</th>
                  <th class="py-1.5 px-2.5">Severity</th>
                  <th class="py-1.5 px-2.5">Explainable Evidence</th>
                </tr>
              </thead>
              <tbody>${eventRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (loadStreamBtn) {
      loadStreamBtn.onclick = () => {
        modal.classList.add("hidden");
        const s = getSentinel();
        if (item.datasetId && s.allDatasets.has(item.datasetId)) {
          s.selectDataset(item.datasetId);
        }
        navigate("live");
      };
    }

    modal.classList.remove("hidden");
  }

  // Bind History Page Events
  function bindHistoryEvents(container) {
    const s = getSentinel();

    // Search input
    const searchInput = container.querySelector("#historySearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        historySearchQuery = e.target.value;
        historyCurrentPage = 1;
        renderRoute("history");
      });
    }

    // Status filter
    const statusSelect = container.querySelector("#historyStatusFilterSelect");
    if (statusSelect) {
      statusSelect.addEventListener("change", (e) => {
        historyStatusFilter = e.target.value;
        historyCurrentPage = 1;
        renderRoute("history");
      });
    }

    // Date filter
    const dateSelect = container.querySelector("#historyDateFilterSelect");
    if (dateSelect) {
      dateSelect.addEventListener("change", (e) => {
        historyDateFilter = e.target.value;
        historyCurrentPage = 1;
        renderRoute("history");
      });
    }

    // Sort select
    const sortSelect = container.querySelector("#historySortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        historySortBy = e.target.value;
        renderRoute("history");
      });
    }

    // Pagination
    const prevBtn = container.querySelector("#historyPrevPageBtn");
    const nextBtn = container.querySelector("#historyNextPageBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (historyCurrentPage > 1) {
          historyCurrentPage--;
          renderRoute("history");
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        historyCurrentPage++;
        renderRoute("history");
      });
    }

    // Inspect stream detail modal
    container.querySelectorAll(".inspect-stream-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openHistoryDetailModal(btn.dataset.inspectStreamId);
      });
    });

    // Load stream into monitor
    container.querySelectorAll(".load-stream-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.loadStreamId;
        const historyList = loadHistory();
        const item = historyList.find((h) => h.id === id);
        if (item && item.datasetId) {
          s.selectDataset(item.datasetId);
        }
        navigate("live");
      });
    });

    // Record Current Stream Button
    const recordBtn = container.querySelector("#recordCurrentStreamBtn");
    if (recordBtn) {
      recordBtn.addEventListener("click", () => {
        const ds = s.currentDataset;
        const historyList = loadHistory();
        const curPts = Math.min(s.cursor, ds?.values?.length || 1000);
        const events = s.allEvents || [];
        const confirmed = events.filter((e) => e.start < curPts && e.status === "confirmed").length;
        const critical = events.filter((e) => e.start < curPts && e.severity === "critical").length;

        const newSession = {
          id: `STR-2026-${String(historyList.length + 900).padStart(4, "0")}`,
          name: ds?.name || "Manual Snapshot Stream",
          datasetId: s.currentDsId,
          category: ds?.category || "Live Stream",
          date: `${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
          timestamp: Date.now(),
          duration: `${Math.floor((curPts * (window.sentinelStreamIntervalMs || 45)) / 60000)}m ${Math.floor(((curPts * (window.sentinelStreamIntervalMs || 45)) / 1000) % 60)}s`,
          points: curPts,
          status: critical > 0 ? "Flagged" : curPts >= (ds?.values?.length || 1000) ? "Completed" : "Active",
          threshold: s.params?.k || 4.0,
          waveSpeed: window.sentinelStreamIntervalMs || 45,
          eventsCount: events.filter((e) => e.start < curPts).length,
          confirmedCount: confirmed,
          criticalCount: critical,
          peakScore: Number(Math.max(...events.filter((e) => e.start < curPts).map((e) => e.score), 0).toFixed(2)),
          precision: events.length ? `${((confirmed / events.length) * 100).toFixed(1)}%` : "100.0%",
          notes: "Real-time snapshot recorded directly from live monitoring session.",
          events: events.filter((e) => e.start < curPts).map((e) => ({
            id: e.id,
            peak: e.peak,
            time: s.formatPointDateTime(ds, e.peak),
            score: e.score,
            thr: e.thr,
            severity: e.severity,
            status: e.status,
            evidence: e.evidence,
          })),
        };

        historyList.unshift(newSession);
        saveHistory(historyList);
        alert(`Recorded current session as ${newSession.id} with ${curPts} observations and ${newSession.eventsCount} events.`);
        renderRoute("history");
      });
    }

    // Restore samples
    const restoreBtn = container.querySelector("#restoreHistoryBtn");
    const emptyRestoreBtn = container.querySelector("#emptyStateRestoreBtn");
    const doRestore = () => {
      saveHistory(SEED_HISTORY);
      historySearchQuery = "";
      historyStatusFilter = "all";
      historyDateFilter = "all";
      historyCurrentPage = 1;
      renderRoute("history");
    };
    if (restoreBtn) restoreBtn.addEventListener("click", doRestore);
    if (emptyRestoreBtn) emptyRestoreBtn.addEventListener("click", doRestore);

    // Clear history
    const clearBtn = container.querySelector("#clearHistoryBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (confirm("Clear all recorded stream history logs? (You can restore samples at any time)")) {
          saveHistory([]);
          renderRoute("history");
        }
      });
    }

    const resetFiltersBtn = container.querySelector("#emptyStateResetFiltersBtn");
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => {
        historySearchQuery = "";
        historyStatusFilter = "all";
        historyDateFilter = "all";
        renderRoute("history");
      });
    }
  }

  // =========================================================================
  // VIEW 4: ANALYTICS PAGE (INTERACTIVE BAR GRAPHS & STATISTICS)
  // =========================================================================
  function renderAnalyticsView() {
    const s = getSentinel();
    const ds = s.currentDataset;
    const values = ds?.values || [];
    const totalPts = values.length || 1000;
    const curPts = Math.min(s.cursor, totalPts);
    const events = s.allEvents || [];
    const historyList = loadHistory();
    const activeSpeed = window.sentinelStreamIntervalMs || defaultSettings.waveSpeed;

    // Summary Calculations: total streams, total events detected, average wave speed, threshold violations
    const totalStreams = s.allDatasets.size || 58;
    const activeStreamEvents = events.filter((e) => e.start < curPts);
    const historicalTotalEvents = historyList.reduce((acc, h) => acc + (h.eventsCount || 0), 0);
    const totalEventsDetected = activeStreamEvents.length + historicalTotalEvents;

    // Threshold violations count: points where score > threshold
    let thresholdViolationsCount = 0;
    if (s.detectionData?.score && s.detectionData?.thr) {
      for (let i = 0; i < curPts; i++) {
        if (s.detectionData.score[i] > s.detectionData.thr[i]) {
          thresholdViolationsCount++;
        }
      }
    } else {
      thresholdViolationsCount = activeStreamEvents.length * 4;
    }

    // --- CHART 1 DATA: Detected Events & Signal Activity Over Time (10 Time Intervals) ---
    const binCount = 8;
    const binSize = Math.max(1, Math.floor(curPts / binCount));
    const timeBins = [];
    for (let b = 0; b < binCount; b++) {
      const bStart = b * binSize;
      const bEnd = Math.min(curPts, (b + 1) * binSize);
      const bEvents = events.filter((e) => e.peak >= bStart && e.peak < bEnd);
      const bCritical = bEvents.filter((e) => e.severity === "critical").length;
      const pointsInBin = Math.max(0, bEnd - bStart);
      const maxScore = bEvents.length ? Math.max(...bEvents.map((e) => e.score)) : 0;

      timeBins.push({
        label: `T${b + 1} (${bStart}-${bEnd})`,
        points: pointsInBin,
        events: bEvents.length,
        critical: bCritical,
        maxScore: maxScore.toFixed(1),
      });
    }

    // --- CHART 2 DATA: Stream-Wise Comparisons (Events per Stream) ---
    const streamComparisons = [
      { name: ds?.name ? `${ds.name.slice(0, 18)}... (Live)` : "Machine Temp (Live)", events: activeStreamEvents.length, critical: activeStreamEvents.filter((e) => e.severity === "critical").length, high: activeStreamEvents.filter((e) => e.severity === "high").length, medium: activeStreamEvents.filter((e) => e.severity === "medium").length, isLive: true },
      { name: "AWS EC2 CPU 53ea38", events: 3, critical: 0, high: 2, medium: 1, isLive: false },
      { name: "NYC Taxi Demand", events: 6, critical: 2, high: 3, medium: 1, isLive: false },
      { name: "Ad CTR Exchange", events: 3, critical: 1, high: 2, medium: 0, isLive: false },
      { name: "Twitter Volume AAPL", events: 5, critical: 3, high: 2, medium: 0, isLive: false },
      { name: "Ambient Temp Failure", events: 4, critical: 2, high: 1, medium: 1, isLive: false },
      { name: "ELB Request Count", events: 3, critical: 1, high: 1, medium: 1, isLive: false },
    ];

    // Filter Chart 2 if stream filter active
    const filteredComparisons =
      analyticsStreamFilter === "all"
        ? streamComparisons
        : streamComparisons.filter((c) => c.isLive || c.name.toLowerCase().includes(analyticsStreamFilter.toLowerCase()));

    // --- CHART 3 DATA: Threshold Violation Distribution (Score Multipliers) ---
    const violationBuckets = [
      { label: "1.0x - 1.2x σ", count: 0, color: "#22d3ee", desc: "Low deviation" },
      { label: "1.2x - 1.5x σ", count: 0, color: "#fbbf24", desc: "Medium deviation" },
      { label: "1.5x - 2.0x σ", count: 0, color: "#fb923c", desc: "High deviation" },
      { label: "> 2.0x σ", count: 0, color: "#f87171", desc: "Critical spike" },
    ];

    activeStreamEvents.forEach((e) => {
      const ratio = e.thr > 0 ? e.score / e.thr : 1;
      if (ratio > 2.0) violationBuckets[3].count++;
      else if (ratio >= 1.5) violationBuckets[2].count++;
      else if (ratio >= 1.2) violationBuckets[1].count++;
      else violationBuckets[0].count++;
    });

    // Seed non-zero sample if stream has few events yet so chart is always readable
    if (activeStreamEvents.length === 0) {
      violationBuckets[0].count = 2;
      violationBuckets[1].count = 3;
      violationBuckets[2].count = 2;
      violationBuckets[3].count = 1;
    }

    return `
      <div class="space-y-6 animate-fade-in pb-12">
        <!-- HEADER -->
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-signal mb-1">
              Interactive Bar Graphs & Telemetry
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Live Stream Analytics Dashboard</h1>
            <p class="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Event frequency distributions over time, cross-stream comparisons, threshold violation severity buckets, and statistical telemetry.
            </p>
          </div>

          <!-- Connection Source Badge -->
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/15 px-3 py-1 font-mono text-xs text-success">
              <span class="h-2 w-2 rounded-full bg-success animate-pulse"></span>
              Live Data: ${ds?.name || "Machine Temperature"}
            </span>
            <span class="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
              ${curPts.toLocaleString()} / ${totalPts.toLocaleString()} pts
            </span>
          </div>
        </div>

        <!-- 4 REQUIRED SUMMARY CARDS: TOTAL STREAMS, TOTAL EVENTS, AVG WAVE SPEED, THRESHOLD VIOLATIONS -->
        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${statCard(
            "Total Streams",
            `${totalStreams} Benchmark Streams`,
            `1 live streaming · ${historyList.length} recorded historical runs`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-signal"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>`
          )}
          ${statCard(
            "Total Events Detected",
            `${totalEventsDetected} Events`,
            `${activeStreamEvents.length} in active stream · ${historicalTotalEvents} in history logs`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-warn"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`
          )}
          ${statCard(
            "Average Wave Speed",
            `${activeSpeed} ms / pt`,
            `Throughput: ~${(1000 / activeSpeed).toFixed(1)} observations/second`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-iris"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
          )}
          ${statCard(
            "Threshold Violations",
            `${thresholdViolationsCount} Points`,
            `Points exceeding adaptive threshold envelope (k = ${s.params?.k?.toFixed(1) || "4.0"}σ)`,
            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-danger"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
          )}
        </section>

        <!-- INTERACTIVE FILTERS BAR -->
        <section class="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <!-- Stream filter -->
              <label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Filter Stream:</span>
                <select id="analyticsStreamSelect" class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60">
                  <option value="all" ${analyticsStreamFilter === "all" ? "selected" : ""}>All Streams (Aggregate)</option>
                  <option value="machine" ${analyticsStreamFilter === "machine" ? "selected" : ""}>Machine Temperature (Current)</option>
                  <option value="ec2" ${analyticsStreamFilter === "ec2" ? "selected" : ""}>AWS EC2 CloudWatch</option>
                  <option value="taxi" ${analyticsStreamFilter === "taxi" ? "selected" : ""}>NYC Taxi Demand</option>
                  <option value="twitter" ${analyticsStreamFilter === "twitter" ? "selected" : ""}>Twitter Volume</option>
                </select>
              </label>

              <!-- Time range -->
              <label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Time Range:</span>
                <select id="analyticsTimeSelect" class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60">
                  <option value="all" ${analyticsTimeRange === "all" ? "selected" : ""}>Full Benchmark Run</option>
                  <option value="1h" ${analyticsTimeRange === "1h" ? "selected" : ""}>Trailing 1 Hour</option>
                  <option value="24h" ${analyticsTimeRange === "24h" ? "selected" : ""}>Trailing 24 Hours</option>
                  <option value="7d" ${analyticsTimeRange === "7d" ? "selected" : ""}>Trailing 7 Days</option>
                </select>
              </label>

              <!-- Severity filter -->
              <label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Event Severity:</span>
                <select id="analyticsSeveritySelect" class="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-signal/60">
                  <option value="all" ${analyticsSeverityFilter === "all" ? "selected" : ""}>All Severities</option>
                  <option value="critical" ${analyticsSeverityFilter === "critical" ? "selected" : ""}>Critical Only</option>
                  <option value="high" ${analyticsSeverityFilter === "high" ? "selected" : ""}>High & Critical</option>
                </select>
              </label>
            </div>

            <!-- Real-time badge indicator -->
            <div class="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <span class="h-1.5 w-1.5 rounded-full bg-signal"></span>
              Live telemetry stream active
            </div>
          </div>
        </section>

        <!-- CHART 1: DETECTED EVENTS OVER TIME (INTERACTIVE BAR GRAPH) -->
        <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 class="text-sm font-semibold tracking-wide text-foreground">Detected Events & Signal Activity Over Time</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                Distribution of flagged anomaly clusters across progressive stream observation intervals.
              </p>
            </div>
            <!-- Legend -->
            <div class="flex items-center gap-4 text-xs font-mono">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm bg-cyan-400"></span> Signal Activity
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm bg-orange-400"></span> Anomaly Events
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-3 w-3 rounded-sm bg-red-400"></span> Critical Violations
              </span>
            </div>
          </div>

          <!-- Interactive SVG Bar Graph -->
          <div class="pt-2">
            ${renderTimelineBarChartSvg(timeBins)}
          </div>
        </section>

        <!-- TWO COLUMNS: CHART 2 & CHART 3 -->
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- CHART 2: STREAM-WISE COMPARISONS -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-3">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">Stream-Wise Anomaly Comparisons</h2>
                <p class="text-xs text-muted-foreground mt-0.5">Total events and severity mix compared across active and benchmark streams.</p>
              </div>
              <span class="rounded bg-signal/15 px-2 py-0.5 font-mono text-xs text-signal font-semibold">Cross-Stream</span>
            </div>

            <!-- Horizontal Bar Graph -->
            <div class="pt-2">
              ${renderStreamWiseComparisonBarChart(filteredComparisons)}
            </div>
          </section>

          <!-- CHART 3: THRESHOLD VIOLATION DISTRIBUTION -->
          <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm space-y-3">
            <div class="flex items-start justify-between border-b border-border/60 pb-3">
              <div>
                <h2 class="text-sm font-semibold tracking-wide text-foreground">Threshold Violation Severity Buckets</h2>
                <p class="text-xs text-muted-foreground mt-0.5">Frequency of observed points segmented by deviation score ratio.</p>
              </div>
              <span class="rounded bg-warn/15 px-2 py-0.5 font-mono text-xs text-warn font-semibold">Violation Ratio</span>
            </div>

            <!-- Vertical Distribution Bar Graph -->
            <div class="pt-2">
              ${renderThresholdViolationDistributionSvg(violationBuckets)}
            </div>
          </section>
        </div>

        <!-- EXPLANATORY EVALUATION CALLOUT -->
        <section class="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm">
          <h3 class="text-sm font-semibold text-foreground">Benchmark Metric Interpretation</h3>
          <div class="mt-3 grid gap-4 sm:grid-cols-3 text-xs text-muted-foreground">
            <div>
              <strong class="text-foreground block mb-1">Signal Activity Volume:</strong>
              Reflects continuous time-series stream points ingested and scored against the learned median absolute deviation baseline.
            </div>
            <div>
              <strong class="text-foreground block mb-1">Threshold Exceedance Ratio:</strong>
              Measures how severely an anomaly deviates from normal behavior relative to adaptive threshold multiplier <span class="font-mono text-signal">k</span>.
            </div>
            <div>
              <strong class="text-foreground block mb-1">Continuous Live Updates:</strong>
              These interactive charts dynamically refresh in real time as the live stream monitor advances through NAB observations.
            </div>
          </div>
        </section>
      </div>
    `;
  }

  // --- SVG BAR CHART 1: Timeline Events Bar Chart ---
  function renderTimelineBarChartSvg(bins) {
    const width = 760;
    const height = 240;
    const padL = 48;
    const padR = 24;
    const padT = 24;
    const padB = 40;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const maxVal = Math.max(...bins.map((b) => Math.max(b.events * 10, b.points / 15)), 40);
    const colW = chartW / bins.length;
    const barW = Math.max(16, colW * 0.45);

    // Y Axis lines & labels
    const gridLines = [0, 0.25, 0.5, 0.75, 1.0]
      .map((ratio) => {
        const y = padT + chartH * (1 - ratio);
        const labelVal = Math.round(ratio * maxVal);
        return `
          <line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />
          <text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="monospace">${labelVal}</text>
        `;
      })
      .join("");

    // Bars
    const barsHtml = bins
      .map((b, idx) => {
        const x = padL + idx * colW + (colW - barW) / 2;
        const ptsH = Math.max(4, (b.points / 15 / maxVal) * chartH);
        const ptsY = padT + chartH - ptsH;

        const eventsH = Math.max(b.events ? 8 : 0, ((b.events * 10) / maxVal) * chartH);
        const eventsY = padT + chartH - eventsH;

        return `
          <g class="chart-bar-group cursor-pointer" data-tooltip="Interval ${b.label}: ${b.events} anomalies, ${b.points} observations, max score ${b.maxScore}σ">
            <!-- Background signal volume bar -->
            <rect x="${x.toFixed(1)}" y="${ptsY.toFixed(1)}" width="${barW.toFixed(1)}" height="${ptsH.toFixed(1)}" rx="3" fill="#22d3ee" opacity="0.3" class="hover:opacity-50 transition-opacity" />
            <!-- Foreground events bar -->
            ${
              b.events > 0
                ? `<rect x="${(x + 2).toFixed(1)}" y="${eventsY.toFixed(1)}" width="${(barW - 4).toFixed(1)}" height="${eventsH.toFixed(1)}" rx="3" fill="${b.critical > 0 ? "#f87171" : "#fb923c"}" />
                   <text x="${(x + barW / 2).toFixed(1)}" y="${(eventsY - 5).toFixed(1)}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="bold" font-family="monospace">${b.events}</text>`
                : ""
            }
            <!-- X axis label -->
            <text x="${(x + barW / 2).toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">${b.label.split(" ")[0]}</text>
          </g>
        `;
      })
      .join("");

    return `
      <div class="relative w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-56" preserveAspectRatio="xMidYMid meet">
          <!-- Axes -->
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${height - padB}" stroke="#64748b" stroke-width="1.5" />
          <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="#64748b" stroke-width="1.5" />
          ${gridLines}
          ${barsHtml}
        </svg>
      </div>
    `;
  }

  // --- SVG BAR CHART 2: Stream-Wise Comparison Bar Chart ---
  function renderStreamWiseComparisonBarChart(comparisons) {
    const width = 480;
    const rowH = 34;
    const height = comparisons.length * rowH + 30;
    const padL = 160;
    const padR = 48;
    const chartW = width - padL - padR;
    const maxEvents = Math.max(...comparisons.map((c) => c.events), 6);

    const rowsHtml = comparisons
      .map((item, idx) => {
        const y = idx * rowH + 10;
        const barLen = Math.max(4, (item.events / maxEvents) * chartW);
        const barColor = item.critical > 0 ? "#f87171" : item.high > 0 ? "#fb923c" : "#22d3ee";

        return `
          <g class="cursor-pointer" data-tooltip="${item.name}: ${item.events} total anomalies (${item.critical} critical, ${item.high} high, ${item.medium} medium)">
            <!-- Stream Label -->
            <text x="${padL - 10}" y="${y + 16}" text-anchor="end" fill="${item.isLive ? "#22d3ee" : "#cbd5e1"}" font-size="11" font-weight="${item.isLive ? "bold" : "normal"}">${item.name}</text>
            <!-- Background track -->
            <rect x="${padL}" y="${y + 4}" width="${chartW}" height="16" rx="3" fill="#334155" opacity="0.3" />
            <!-- Bar -->
            <rect x="${padL}" y="${y + 4}" width="${barLen.toFixed(1)}" height="16" rx="3" fill="${barColor}" class="hover:opacity-90 transition-opacity" />
            <!-- Value text -->
            <text x="${padL + barLen + 8}" y="${y + 16}" fill="#f8fafc" font-size="11" font-mono font-weight="bold">${item.events}</text>
          </g>
        `;
      })
      .join("");

    return `
      <div class="relative w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full" style="height:${height}px" preserveAspectRatio="xMidYMid meet">
          ${rowsHtml}
        </svg>
      </div>
    `;
  }

  // --- SVG BAR CHART 3: Threshold Violation Distribution ---
  function renderThresholdViolationDistributionSvg(buckets) {
    const width = 480;
    const height = 230;
    const padL = 40;
    const padR = 20;
    const padT = 20;
    const padB = 40;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;
    const maxVal = Math.max(...buckets.map((b) => b.count), 6);
    const colW = chartW / buckets.length;
    const barW = Math.max(24, colW * 0.55);

    const barsHtml = buckets
      .map((b, idx) => {
        const x = padL + idx * colW + (colW - barW) / 2;
        const barH = Math.max(6, (b.count / maxVal) * chartH);
        const y = padT + chartH - barH;

        return `
          <g class="cursor-pointer" data-tooltip="${b.label} (${b.desc}): ${b.count} events">
            <!-- Bar -->
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="4" fill="${b.color}" class="hover:opacity-90 transition-opacity" />
            <!-- Value on top of bar -->
            <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="bold" font-mono>${b.count}</text>
            <!-- X Axis Label -->
            <text x="${(x + barW / 2).toFixed(1)}" y="${height - 18}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">${b.label}</text>
            <text x="${(x + barW / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#64748b" font-size="9">${b.desc}</text>
          </g>
        `;
      })
      .join("");

    return `
      <div class="relative w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-56" preserveAspectRatio="xMidYMid meet">
          <!-- Baseline reference line -->
          <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="#64748b" stroke-width="1.5" />
          ${barsHtml}
        </svg>
      </div>
    `;
  }

  // Bind Analytics events
  function bindAnalyticsEvents(container) {
    const streamSelect = container.querySelector("#analyticsStreamSelect");
    if (streamSelect) {
      streamSelect.addEventListener("change", (e) => {
        analyticsStreamFilter = e.target.value;
        renderRoute("analytics");
      });
    }

    const timeSelect = container.querySelector("#analyticsTimeSelect");
    if (timeSelect) {
      timeSelect.addEventListener("change", (e) => {
        analyticsTimeRange = e.target.value;
        renderRoute("analytics");
      });
    }

    const severitySelect = container.querySelector("#analyticsSeveritySelect");
    if (severitySelect) {
      severitySelect.addEventListener("change", (e) => {
        analyticsSeverityFilter = e.target.value;
        renderRoute("analytics");
      });
    }

    // Attach chart hover tooltips
    const tooltip = document.getElementById("chartTooltip");
    if (tooltip) {
      container.querySelectorAll("[data-tooltip]").forEach((el) => {
        el.addEventListener("mouseenter", (e) => {
          tooltip.textContent = el.getAttribute("data-tooltip");
          tooltip.classList.remove("hidden");
        });
        el.addEventListener("mousemove", (e) => {
          tooltip.style.left = `${Math.min(window.innerWidth - 240, e.clientX + 16)}px`;
          tooltip.style.top = `${e.clientY + 16}px`;
        });
        el.addEventListener("mouseleave", () => {
          tooltip.classList.add("hidden");
        });
      });
    }
  }

  // =========================================================================
  // VIEW 5 & 6: ANOMALIES & MODEL LAB (EXISTING LABS PRESERVED)
  // =========================================================================
  function renderAnomaliesView() {
    const s = getSentinel();
    const ds = s.currentDataset;
    const events = s.allEvents || [];
    const rows = events.length
      ? events
          .map(
            (ev) => `
        <tr class="hover:bg-muted/20 border-b border-border/30 text-xs">
          <td class="px-3.5 py-3 font-mono text-signal">#${ev.id}</td>
          <td class="px-3.5 py-3 font-mono text-muted-foreground">${s.formatPointDateTime(ds, ev.peak)}</td>
          <td class="px-3.5 py-3 text-foreground font-medium">${ev.type || "Baseline Deviation"}</td>
          <td class="px-3.5 py-3 font-mono font-bold ${ev.score >= 2 * ev.thr ? "text-danger" : "text-warn"}">${s.formatVal(ev.score, 2)}σ</td>
          <td class="px-3.5 py-3 font-mono text-muted-foreground">${s.formatVal(ev.thr, 2)}σ</td>
          <td class="px-3.5 py-3">
            <span class="rounded px-2 py-0.5 text-[10px] uppercase font-semibold ${
              ev.severity === "critical"
                ? "bg-danger/20 text-danger border border-danger/40"
                : ev.severity === "high"
                ? "bg-warn/20 text-warn border border-warn/40"
                : "bg-signal/20 text-signal border border-signal/40"
            }">${ev.severity}</span>
          </td>
          <td class="px-3.5 py-3">
            <span class="rounded px-2 py-0.5 text-[10px] uppercase font-semibold ${
              ev.status === "confirmed"
                ? "bg-success/20 text-success border border-success/40"
                : "bg-muted/40 text-muted-foreground border border-border"
            }">${ev.status}</span>
          </td>
        </tr>
      `
          )
          .join("")
      : `<tr><td colspan="7" class="py-12 text-center text-sm text-muted-foreground">No anomaly events flagged in the active stream yet.</td></tr>`;

    return `
      <div class="space-y-6 animate-fade-in pb-12">
        <div class="flex items-start justify-between border-b border-border/60 pb-4">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Flagged Anomaly Events Review</h1>
            <p class="mt-1 text-xs sm:text-sm text-muted-foreground">Detailed inspection table of all clustered anomaly windows detected across ${ds?.name || "active stream"}.</p>
          </div>
          <button data-nav="live" class="rounded-lg bg-signal/15 border border-signal/40 px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal/25">Open in Live Monitor →</button>
        </div>
        <div class="overflow-hidden rounded-xl border border-border/80 bg-card/60 shadow-sm">
          <table class="w-full text-left border-collapse">
            <thead class="border-b border-border/60 bg-muted/20 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th class="py-3 px-3.5">ID</th>
                <th class="py-3 px-3.5">Timestamp (UTC)</th>
                <th class="py-3 px-3.5">Event Type</th>
                <th class="py-3 px-3.5">Score</th>
                <th class="py-3 px-3.5">Threshold</th>
                <th class="py-3 px-3.5">Severity</th>
                <th class="py-3 px-3.5">Verification</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderModelsView() {
    const s = getSentinel();
    return `
      <div class="space-y-6 animate-fade-in pb-12">
        <div class="border-b border-border/60 pb-4">
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">NAB Benchmark Detection Strategy</h1>
          <p class="mt-1 text-xs sm:text-sm text-muted-foreground">Adaptive rolling baseline, MAD spread estimation, and explainable residual scoring components.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <article class="rounded-xl border border-border/80 bg-card/60 p-5">
            <span class="font-mono text-xs text-signal font-semibold">01 · Adaptive Baseline</span>
            <h3 class="mt-2 text-base font-semibold text-foreground">Rolling Median Absolute Deviation</h3>
            <p class="mt-2 text-xs text-muted-foreground leading-relaxed">Estimates the non-parametric center and robust spread across the last ${s.params?.win || 60} observations.</p>
          </article>
          <article class="rounded-xl border border-border/80 bg-card/60 p-5">
            <span class="font-mono text-xs text-iris font-semibold">02 · Residual Scoring</span>
            <h3 class="mt-2 text-base font-semibold text-foreground">Z-Score Deviation Multiplier</h3>
            <p class="mt-2 text-xs text-muted-foreground leading-relaxed">Normalizes each streaming point against the learned dispersion. Scores above k = ${s.params?.k?.toFixed(1) || "4.0"}σ generate flags.</p>
          </article>
          <article class="rounded-xl border border-border/80 bg-card/60 p-5">
            <span class="font-mono text-xs text-success font-semibold">03 · Temporal Clustering</span>
            <h3 class="mt-2 text-base font-semibold text-foreground">Event Ensemble Aggregator</h3>
            <p class="mt-2 text-xs text-muted-foreground leading-relaxed">Merges contiguous flagged points into coherent anomaly windows with ground truth matching.</p>
          </article>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // ROUTER CONTROLLER & NAVIGATION
  // =========================================================================
  function renderRoute(route) {
    const main = document.getElementById("main");
    if (!main) return;

    let routeView = document.getElementById("routeView");
    if (!routeView) {
      routeView = document.createElement("div");
      routeView.id = "routeView";
      routeView.className = "w-full";
      main.insertBefore(routeView, main.firstElementChild);
    }

    const streamView = [...main.children].find((child) => child !== routeView);
    if (!streamView) return;

    const next = NAV_ROUTES[route] ? route : Object.values(NAV_ROUTES).includes(route) ? route : "overview";
    currentActiveRoute = next;

    // Toggle views: Live Stream uses existing layout; all other routes use routeView
    streamView.hidden = next !== "live";
    routeView.hidden = next === "live";

    // Update Topbar Title
    const topbarTitle = document.getElementById("topbarTitle");
    if (topbarTitle && ROUTE_TITLES[next]) {
      topbarTitle.textContent = ROUTE_TITLES[next];
    }

    // Render corresponding route
    if (next === "overview") {
      routeView.innerHTML = renderOverviewView();
      const hero = routeView.querySelector("#overviewHero");
      const glow = routeView.querySelector("#overviewCursorGlow");
      if (hero && glow && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        hero.addEventListener("pointermove", (event) => {
          const bounds = hero.getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * 100;
          const y = ((event.clientY - bounds.top) / bounds.height) * 100;
          glow.style.left = `${x}%`;
          glow.style.top = `${y}%`;
          hero.style.setProperty("--pointer-x", `${x}%`);
          hero.style.setProperty("--pointer-y", `${y}%`);
        });
        hero.addEventListener("pointerleave", () => {
          glow.style.left = "50%";
          glow.style.top = "50%";
          hero.style.setProperty("--pointer-x", "50%");
          hero.style.setProperty("--pointer-y", "50%");
        });
      }
      const toggleBtn = routeView.querySelector("#overviewTogglePlayBtn");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const s = getSentinel();
          s.isPlaying = !s.isPlaying;
          s.updateStatusUI();
          renderRoute("overview");
        });
      }
    } else if (next === "settings") {
      routeView.innerHTML = renderSettingsView();
      bindSettingsEvents(routeView);
    } else if (next === "history") {
      routeView.innerHTML = renderHistoryView();
      bindHistoryEvents(routeView);
    } else if (next === "analytics") {
      routeView.innerHTML = renderAnalyticsView();
      bindAnalyticsEvents(routeView);
    } else if (next === "anomalies") {
      routeView.innerHTML = renderAnomaliesView();
    } else if (next === "models") {
      routeView.innerHTML = renderModelsView();
    }

    // Bind all data-nav clickable links inside routeView
    routeView.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(btn.dataset.nav);
      });
    });

    // Update Sidebar Navigation Active Highlights
    updateNavLinksHighlight(next);

    // Update URL hash
    history.replaceState(null, "", `#${next}`);
  }

  function updateNavLinksHighlight(activeRoute) {
    // Desktop sidebar links
    document.querySelectorAll("aside a[data-nav]").forEach((link) => {
      const isMatch = link.dataset.nav === activeRoute;
      link.classList.toggle("bg-signal/15", isMatch);
      link.classList.toggle("text-signal", isMatch);
      link.classList.toggle("font-semibold", isMatch);
      link.classList.toggle("border-l-2", isMatch);
      link.classList.toggle("border-signal", isMatch);
      link.classList.toggle("text-muted-foreground", !isMatch);
    });

    // Mobile drawer links
    document.querySelectorAll("#mobileNavLinks a[data-mobile-nav]").forEach((link) => {
      const isMatch = link.dataset.mobileNav === activeRoute;
      link.classList.toggle("bg-signal/15", isMatch);
      link.classList.toggle("text-signal", isMatch);
      link.classList.toggle("font-semibold", isMatch);
      link.classList.toggle("text-muted-foreground", !isMatch);
    });
  }

  function navigate(route) {
    renderRoute(route);
    // Close mobile drawer if open
    const mobileDrawer = document.getElementById("mobileDrawer");
    if (mobileDrawer) mobileDrawer.classList.add("hidden");
  }

  // --- HOOK FOR LIVE STREAM UPDATES ---
  // When live stream plays in background, update Overview or Analytics if currently active
  window.sentinelTick = function () {
    if (currentActiveRoute === "overview") {
      // Light live update of overview status without recreating entire DOM
      const liveStatus = document.getElementById("overviewLiveStatus");
      if (liveStatus) {
        const s = getSentinel();
        liveStatus.textContent = s.isPlaying ? "Live Streaming" : "Paused";
      }
    } else if (currentActiveRoute === "analytics") {
      // Re-render analytics charts to reflect new incoming points
      renderRoute("analytics");
    }
  };

  window.sentinelStateUpdated = function () {
    if (currentActiveRoute !== "live") {
      renderRoute(currentActiveRoute);
    }
  };

  // --- INITIALIZE ROUTER & ATTACH LISTENERS ---
  function initRouter() {
    // Desktop Sidebar Links click handlers
    document.querySelectorAll("aside a[data-nav]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(link.dataset.nav);
      });
    });

    // Mobile Menu Toggle
    const mobileToggle = document.getElementById("mobileMenuToggle");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const closeMobileDrawer = document.getElementById("closeMobileDrawer");
    const mobileDrawerBackdrop = document.getElementById("mobileDrawerBackdrop");

    if (mobileToggle && mobileDrawer) {
      mobileToggle.addEventListener("click", () => {
        mobileDrawer.classList.remove("hidden");
      });
    }

    if (closeMobileDrawer && mobileDrawer) {
      closeMobileDrawer.addEventListener("click", () => {
        mobileDrawer.classList.add("hidden");
      });
    }

    if (mobileDrawerBackdrop && mobileDrawer) {
      mobileDrawerBackdrop.addEventListener("click", () => {
        mobileDrawer.classList.add("hidden");
      });
    }

    // Mobile nav links
    document.querySelectorAll("#mobileNavLinks a[data-mobile-nav]").forEach((link) => {
      link.addEventListener("click", (e) => {
        if (link.dataset.mobileNav === "corpus") {
          e.preventDefault();
          if (mobileDrawer) mobileDrawer.classList.add("hidden");
          const nabModal = document.getElementById("nabModal");
          if (nabModal) nabModal.classList.remove("hidden");
        } else {
          e.preventDefault();
          navigate(link.dataset.mobileNav);
        }
      });
    });

    // Close History Detail Modal
    const closeHistoryDetailModal = document.getElementById("closeHistoryDetailModal");
    const histModalCloseBtn = document.getElementById("histModalCloseBtn");
    const histModal = document.getElementById("historyDetailModal");
    if (closeHistoryDetailModal && histModal) {
      closeHistoryDetailModal.addEventListener("click", () => histModal.classList.add("hidden"));
    }
    if (histModalCloseBtn && histModal) {
      histModalCloseBtn.addEventListener("click", () => histModal.classList.add("hidden"));
    }

    // Listen to hash changes for browser back/forward buttons
    window.addEventListener("hashchange", () => {
      const hash = location.hash.slice(1);
      navigate(hash || "overview");
    });

    // Expose navigate globally
    window.dashboardNavigate = navigate;
    window.setupDashboardRoutes = () => navigate(location.hash.slice(1) || "overview");

    // Initial navigation
    navigate(location.hash.slice(1) || "overview");
  }

  // Auto-start on DOMContentLoaded or immediately if DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRouter);
  } else {
    initRouter();
  }
})();
