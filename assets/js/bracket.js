(function () {
  const cfg = window.TOURNAMENT_CONFIG || {};
  const TEAMS_NEEDED = cfg.teamsNeeded || 16;
  const DEMO_MODE = new URLSearchParams(location.search).has("demo");
  const STORAGE_KEY = DEMO_MODE ? "wasimo.bracket.v1.demo" : "wasimo.bracket.v1";
  const scriptEl = document.currentScript;
  const IS_ADMIN = scriptEl && scriptEl.dataset.admin === "true";

  const DEMO_TEAMS = [
    { teamName: "Aces Wild", captainName: "Alex" },
    { teamName: "Bluff Masters", captainName: "Brianna" },
    { teamName: "Card Sharks", captainName: "Carlos" },
    { teamName: "Deck Stackers", captainName: "Dana" },
    { teamName: "Empty Suits", captainName: "Eli" },
    { teamName: "Full House Crew", captainName: "Fatima" },
    { teamName: "Grand Slam", captainName: "Gabe" },
    { teamName: "High Rollers", captainName: "Hana" },
    { teamName: "Iron Hands", captainName: "Ibrahim" },
    { teamName: "Jokers Wild", captainName: "Jade" },
    { teamName: "Kings & Queens", captainName: "Kareem" },
    { teamName: "Lucky 13", captainName: "Layla" },
    { teamName: "Midnight Dealers", captainName: "Marco" },
    { teamName: "No Bluffs", captainName: "Nadia" },
    { teamName: "One-Eyed Jacks", captainName: "Omar" },
    { teamName: "Pocket Aces", captainName: "Priya" },
  ];

  const statusLine = document.getElementById("status-line");
  const drawBtn = document.getElementById("draw-btn");
  const resetBtn = document.getElementById("reset-btn");
  const exportBtn = document.getElementById("export-btn");
  const refreshBtn = document.getElementById("refresh-btn");
  const listSection = document.getElementById("signup-list");
  const listEl = document.getElementById("signup-list-items");
  const bracketSection = document.getElementById("bracket-section");
  const bracketEl = document.getElementById("bracket");

  let teams = [];
  let state = loadState();

  function loadState() {
    if (!IS_ADMIN) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.draw) || obj.draw.length !== TEAMS_NEEDED) return null;
      obj.results = obj.results || {};
      return obj;
    } catch (_) { return null; }
  }

  function saveState() {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    publishState(state);
  }

  function clearState() {
    state = null;
    localStorage.removeItem(STORAGE_KEY);
    publishState(null);
  }

  function isValidState(obj) {
    return !!obj && Array.isArray(obj.draw) && obj.draw.length === TEAMS_NEEDED;
  }

  async function fetchBracketState() {
    if (!cfg.appsScriptUrl) return;
    try {
      const res = await fetch(cfg.appsScriptUrl + "?action=bracket", { method: "GET" });
      const json = await res.json();
      if (json && isValidState(json.state)) {
        json.state.results = json.state.results || {};
        state = json.state;
        if (IS_ADMIN) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else if (!IS_ADMIN) {
        state = null;
      }
    } catch (_) {
      if (!IS_ADMIN) state = null;
    }
  }

  function publishState(nextState) {
    if (!IS_ADMIN || !cfg.appsScriptUrl) return;
    fetch(cfg.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "bracket", state: nextState }),
    }).catch(function () {
      statusLine.textContent = "Bracket updated locally, but could not publish yet. Try Refresh teams.";
    });
  }

  async function fetchTeams() {
    if (DEMO_MODE) {
      teams = DEMO_TEAMS.slice();
      render();
      return;
    }
    if (!cfg.appsScriptUrl) {
      statusLine.textContent =
        "Signup endpoint not configured yet. Add appsScriptUrl in assets/js/config.js.";
      return;
    }
    statusLine.textContent = "Loading teams…";
    try {
      const res = await fetch(cfg.appsScriptUrl + "?action=list", { method: "GET" });
      const json = await res.json();
      if (!json || !Array.isArray(json.teams)) throw new Error("Bad response");
      teams = json.teams;
      await fetchBracketState();
      render();
    } catch (err) {
      statusLine.textContent = "Could not load teams: " + err.message;
    }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function teamLabel(t) {
    return t ? (t.teamName || t.captainName || "Team") : "";
  }

  function render() {
    // Signup list
    listSection.hidden = teams.length === 0;
    listEl.innerHTML = "";
    teams.slice(0, TEAMS_NEEDED).forEach(function (t) {
      const li = document.createElement("li");
      li.textContent = teamLabel(t);
      listEl.appendChild(li);
    });

    // Status + controls
    const ready = teams.length >= TEAMS_NEEDED;
    const locked = !!state;

    const demoBadge = DEMO_MODE
      ? '<span style="background:#cf3a3a;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;letter-spacing:0.08em;margin-right:8px;">DEMO MODE</span>'
      : "";

    if (locked) {
      statusLine.innerHTML = demoBadge + "Bracket locked with " + TEAMS_NEEDED + " teams.";
      drawBtn.hidden = true;
      resetBtn.hidden = !IS_ADMIN;
      exportBtn.hidden = !IS_ADMIN;
    } else if (ready) {
      statusLine.innerHTML = demoBadge + (IS_ADMIN
        ? TEAMS_NEEDED + " teams confirmed. Click \"Draw bracket\" to lock the bracket."
        : TEAMS_NEEDED + " teams confirmed. Bracket draw is not published yet.");
      drawBtn.hidden = !IS_ADMIN;
      resetBtn.hidden = true;
      exportBtn.hidden = true;
    } else {
      const missing = TEAMS_NEEDED - teams.length;
      statusLine.innerHTML =
        demoBadge +
        teams.length + " of " + TEAMS_NEEDED + " teams signed up. Need " +
        missing + " more to draw the bracket.";
      drawBtn.hidden = true;
      resetBtn.hidden = true;
      exportBtn.hidden = true;
    }

    bracketSection.hidden = !locked;
    if (locked) renderBracket();
  }

  function drawBracket() {
    if (teams.length < TEAMS_NEEDED) return;
    const slate = teams.slice(0, TEAMS_NEEDED).map(function (t) {
      return { teamName: t.teamName || "", captainName: t.captainName || "" };
    });
    state = {
      draw: shuffle(slate),
      drawnAt: new Date().toISOString(),
      results: {},
    };
    saveState();
    render();
  }

  // ----- Bracket model -----
  // 8 R1 matches feed 4 QF matches feed 2 SF matches feed 1 F match.
  // Match IDs: r1m0..r1m7, qfm0..qfm3, sfm0..sfm1, fm0.
  // R1 is best of 3 (first to 2). Later rounds: single game (1-0 click).
  function getMatchWinner(id) {
    const r = state.results[id];
    if (!r) return null;
    if (id.startsWith("r1m")) {
      if (r.a >= 2) return "a";
      if (r.b >= 2) return "b";
      return null;
    }
    if (r.a >= 1) return "a";
    if (r.b >= 1) return "b";
    return null;
  }

  function getSlotTeam(id, side) {
    if (id.startsWith("r1m")) {
      const i = parseInt(id.slice(3), 10);
      return state.draw[i * 2 + (side === "a" ? 0 : 1)] || null;
    }
    const map = {
      qfm0: ["r1m0", "r1m1"], qfm1: ["r1m2", "r1m3"],
      qfm2: ["r1m4", "r1m5"], qfm3: ["r1m6", "r1m7"],
      sfm0: ["qfm0", "qfm1"], sfm1: ["qfm2", "qfm3"],
      fm0:  ["sfm0", "sfm1"],
    };
    const src = map[id][side === "a" ? 0 : 1];
    const w = getMatchWinner(src);
    if (!w) return null;
    return getSlotTeam(src, w);
  }

  function recordWin(id, side) {
    const r = state.results[id] || { a: 0, b: 0 };
    if (id.startsWith("r1m")) {
      // Best of 3: increment the winning side's game count, cap at 2.
      // Clicking the same side again past the win does nothing.
      if (r.a >= 2 || r.b >= 2) {
        // Match is done; clicking the opposite side resets only if user clicks loser.
        // To keep things simple: ignore further clicks. Use reset to redo.
        return;
      }
      r[side] = (r[side] || 0) + 1;
    } else {
      // Single game: clicking sets the winner. Clicking the other side switches.
      r.a = side === "a" ? 1 : 0;
      r.b = side === "b" ? 1 : 0;
      // Clear downstream results that depended on this match's previous winner.
      clearDownstream(id);
    }
    state.results[id] = r;

    // If a R1 match just resolved, clear downstream too in case it had to flip.
    if (id.startsWith("r1m")) {
      const wAfter = getMatchWinner(id);
      if (wAfter) clearDownstream(id);
    }
    saveState();
    renderBracket();
  }

  function clearMatch(id) {
    delete state.results[id];
    clearDownstream(id);
  }

  function clearDownstream(id) {
    const children = {
      r1m0: "qfm0", r1m1: "qfm0", r1m2: "qfm1", r1m3: "qfm1",
      r1m4: "qfm2", r1m5: "qfm2", r1m6: "qfm3", r1m7: "qfm3",
      qfm0: "sfm0", qfm1: "sfm0", qfm2: "sfm1", qfm3: "sfm1",
      sfm0: "fm0",  sfm1: "fm0",
    };
    const next = children[id];
    if (next) {
      delete state.results[next];
      clearDownstream(next);
    }
  }

  function makeSlot(matchId, side, team, winner) {
    const slot = document.createElement("div");
    slot.className = "slot";
    const isEmpty = !team;
    if (isEmpty) slot.classList.add("empty", "disabled");

    const name = document.createElement("span");
    name.className = "team-name";
    name.textContent = isEmpty ? "—" : teamLabel(team);
    slot.appendChild(name);

    if (matchId.startsWith("r1m")) {
      const r = state.results[matchId] || { a: 0, b: 0 };
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = String(r[side] || 0);
      slot.appendChild(score);
    }

    if (winner === side) slot.classList.add("winner");
    else if (winner) slot.classList.add("loser");

    if (!isEmpty && IS_ADMIN) {
      slot.addEventListener("click", function () { recordWin(matchId, side); });
      slot.title = "Click to mark this team as winner";
    }
    return slot;
  }

  function makeMatch(matchId, formatLabel) {
    const w = getMatchWinner(matchId);
    const a = getSlotTeam(matchId, "a");
    const b = getSlotTeam(matchId, "b");

    const card = document.createElement("div");
    card.className = "match";

    const meta = document.createElement("div");
    meta.className = "match-meta";
    const left = document.createElement("span");
    left.textContent = matchLabel(matchId);
    const right = document.createElement("span");
    right.className = "format-tag";
    right.textContent = formatLabel;
    meta.appendChild(left);
    meta.appendChild(right);
    card.appendChild(meta);

    card.appendChild(makeSlot(matchId, "a", a, w));
    card.appendChild(makeSlot(matchId, "b", b, w));

    // Reset link if results exist
    if (IS_ADMIN && state.results[matchId]) {
      const reset = document.createElement("div");
      reset.className = "match-meta";
      reset.style.justifyContent = "flex-end";
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = "reset match";
      link.style.fontSize = "11px";
      link.addEventListener("click", function (e) {
        e.preventDefault();
        clearMatch(matchId);
        saveState();
        renderBracket();
      });
      reset.appendChild(link);
      card.appendChild(reset);
    }
    return card;
  }

  function matchLabel(id) {
    if (id.startsWith("r1m")) return "R16 · M" + (parseInt(id.slice(3), 10) + 1);
    if (id.startsWith("qfm")) return "QF · M" + (parseInt(id.slice(3), 10) + 1);
    if (id.startsWith("sfm")) return "SF · M" + (parseInt(id.slice(3), 10) + 1);
    if (id === "fm0") return "Final";
    return id;
  }

  function renderBracket() {
    bracketEl.innerHTML = "";

    const cols = [
      { title: "Round of 16", cls: "round-r1", ids: ["r1m0","r1m1","r1m2","r1m3","r1m4","r1m5","r1m6","r1m7"], format: "BEST OF 3" },
      { title: "Quarterfinals", cls: "round-qf", ids: ["qfm0","qfm1","qfm2","qfm3"], format: "SINGLE GAME" },
      { title: "Semifinals", cls: "round-sf", ids: ["sfm0","sfm1"], format: "SINGLE GAME" },
      { title: "Final", cls: "round-f", ids: ["fm0"], format: "SINGLE GAME" },
    ];

    cols.forEach(function (col) {
      const wrap = document.createElement("div");
      wrap.className = "round " + col.cls;
      const title = document.createElement("div");
      title.className = "round-title";
      title.textContent = col.title;
      wrap.appendChild(title);

      const matches = document.createElement("div");
      matches.className = "matches";
      col.ids.forEach(function (id) {
        matches.appendChild(makeMatch(id, col.format));
      });
      wrap.appendChild(matches);
      bracketEl.appendChild(wrap);
    });

    // Champion banner
    const champSide = getMatchWinner("fm0");
    if (champSide) {
      const champ = getSlotTeam("fm0", champSide);
      if (champ) {
        const note = document.createElement("p");
        note.style.marginTop = "16px";
        note.innerHTML = "Champion: <strong>" + escapeHtml(teamLabel(champ)) + "</strong>";
        bracketEl.appendChild(note);
      }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ----- Wire up controls -----
  if (IS_ADMIN) {
    drawBtn.addEventListener("click", drawBracket);
    resetBtn.addEventListener("click", function () {
      if (!confirm("Reset the bracket? This clears the draw and all results.")) return;
      clearState();
      render();
    });
    exportBtn.addEventListener("click", function () {
      if (!state) return;
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hand-bracket-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
  refreshBtn.addEventListener("click", fetchTeams);

  fetchTeams();
})();
