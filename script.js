(function () {
  "use strict";

  var STORAGE_KEY = "todoAppState";

  var GROUPS = [
    { key: "main",     label: "メイン",     isMain: true,  ids: ["main1", "main2", "main3"] },
    { key: "priority", label: "優先",       isMain: false, ids: ["pri1", "pri2", "pri3"] },
    { key: "plus",     label: "プラス",     isMain: false, ids: ["plus1", "plus2", "plus3"] },
    { key: "gap",      label: "スキマ",     isMain: false, ids: ["gap1", "gap2", "gap3"] },
    { key: "routine",  label: "ルーティン", isMain: false, ids: ["rt1", "rt2", "rt3"] },
    { key: "other",    label: "その他",     isMain: false, ids: ["other1"] }
  ];

  var MAIN_IDS = ["main1", "main2", "main3"];
  var WEEK_TOTAL = 14;

  // ---------- date helpers ----------

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function toDateKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // Monday of the week containing `d`
  function mondayOf(d) {
    var date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = date.getDay(); // 0=Sun..6=Sat
    var diff = (day === 0) ? -6 : (1 - day);
    date.setDate(date.getDate() + diff);
    return date;
  }

  function currentMondayKey() {
    return toDateKey(mondayOf(new Date()));
  }

  // ---------- state ----------

  function defaultTasks() {
    var tasks = {};
    GROUPS.forEach(function (g) {
      g.ids.forEach(function (id) {
        tasks[id] = { name: "", checked: false };
      });
    });
    return tasks;
  }

  function defaultReflected() {
    var r = {};
    MAIN_IDS.forEach(function (id) { r[id] = false; });
    return r;
  }

  function defaultState() {
    return {
      dailyTasks: defaultTasks(),
      weeklyClears: 0,
      reflected: defaultReflected(),
      weekStartDate: currentMondayKey()
    };
  }

  function loadState() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }

    var state;
    if (raw) {
      try {
        state = JSON.parse(raw);
      } catch (e) {
        state = null;
      }
    }
    if (!state) state = defaultState();

    // fill in any missing pieces defensively
    if (!state.dailyTasks) state.dailyTasks = defaultTasks();
    if (typeof state.weeklyClears !== "number") state.weeklyClears = 0;
    if (!state.reflected) state.reflected = defaultReflected();
    if (!state.weekStartDate) state.weekStartDate = currentMondayKey();

    // week rollover: independent of daily reset
    var thisMonday = currentMondayKey();
    if (state.weekStartDate !== thisMonday) {
      state.weekStartDate = thisMonday;
      state.weeklyClears = 0;
      state.reflected = defaultReflected();
    }

    return state;
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* storage unavailable — app still works in-memory for this session */
    }
  }

  var state = loadState();

  // ---------- rendering: todo groups ----------

  var todoGroupsEl = document.getElementById("todoGroups");

  function renderTodoGroups() {
    todoGroupsEl.innerHTML = "";

    GROUPS.forEach(function (g) {
      var groupEl = document.createElement("div");
      groupEl.className = "todo-group" + (g.isMain ? " is-main" : "");

      var labelEl = document.createElement("div");
      labelEl.className = "group-label";
      labelEl.innerHTML = "<span>" + g.label + "</span><span class=\"count\">" + g.ids.length + "</span>";
      groupEl.appendChild(labelEl);

      g.ids.forEach(function (id, idx) {
        var task = state.dailyTasks[id];
        var row = document.createElement("div");
        row.className = "task-row" + (task.checked ? " is-checked" : "");

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.checked;
        checkbox.setAttribute("aria-label", g.label + (g.ids.length > 1 ? (idx + 1) : "") + " 完了");
        checkbox.addEventListener("change", function () {
          onTaskCheckChange(id, checkbox.checked, row);
        });

        var nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "task-name";
        nameInput.placeholder = g.label + (g.ids.length > 1 ? "①②③"[idx] || (idx + 1) : "") + " のタスク";
        nameInput.value = task.name;
        nameInput.addEventListener("input", function () {
          state.dailyTasks[id].name = nameInput.value;
          saveState(state);
        });

        row.appendChild(checkbox);
        row.appendChild(nameInput);
        groupEl.appendChild(row);
      });

      todoGroupsEl.appendChild(groupEl);
    });
  }

  function onTaskCheckChange(id, isChecked, rowEl) {
    state.dailyTasks[id].checked = isChecked;
    rowEl.classList.toggle("is-checked", isChecked);

    if (MAIN_IDS.indexOf(id) !== -1 && isChecked && !state.reflected[id] && state.weeklyClears < WEEK_TOTAL) {
      state.weeklyClears += 1;
      state.reflected[id] = true;
    }
    // unchecking a main task never decreases weeklyClears, and never
    // clears the reflected flag — this prevents double counting via
    // check -> uncheck -> check on the same day.

    saveState(state);
    renderWeeklyGrid();
  }

  // ---------- rendering: weekly grid ----------

  var weeklyGridEl = document.getElementById("weeklyGrid");
  var weeklyCountEl = document.getElementById("weeklyCount");
  var rewardBoxEl = document.getElementById("rewardBox");

  function renderWeeklyGrid() {
    weeklyGridEl.innerHTML = "";

    for (var i = 1; i <= 16; i++) {
      var cell = document.createElement("div");

      if (i > WEEK_TOTAL) {
        cell.className = "week-cell is-empty-slot";
        weeklyGridEl.appendChild(cell);
        continue;
      }

      var filled = i <= state.weeklyClears;
      cell.className = "week-cell" + (filled ? " is-filled" : "");
      cell.innerHTML = "<span class=\"num\">" + i + "</span><span class=\"box\"></span>";
      weeklyGridEl.appendChild(cell);
    }

    weeklyCountEl.textContent = state.weeklyClears + " / " + WEEK_TOTAL;
    rewardBoxEl.hidden = state.weeklyClears < WEEK_TOTAL;
  }

  // ---------- daily reset ----------

  var dailyResetBtn = document.getElementById("dailyResetBtn");

  dailyResetBtn.addEventListener("click", function () {
    var ok = window.confirm("デイリーTodoをリセットします。よろしいですか？\n（週間クリア記録は消えません）");
    if (!ok) return;

    state.dailyTasks = defaultTasks();
    state.reflected = defaultReflected();
    // state.weeklyClears is intentionally left untouched

    saveState(state);
    renderTodoGroups();
    renderWeeklyGrid();
  });

  // ---------- init ----------

  renderTodoGroups();
  renderWeeklyGrid();
})();
