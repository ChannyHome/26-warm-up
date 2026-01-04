/**
 * Warm-up Portal (Vanilla)
 * - CRUD: GET/POST/PUT/DELETE
 * - Table UX:
 *   1) Debounced search (200ms)
 *   2) Multi-field filter (chips: name+phone+dept ...)
 *   3) Column show/hide via checklist modal (common for depts/employees)
 *   4) Sort (header click), Pagination (prev/next + page numbers)
 * - Employee dept name:
 *   1) employee.department.name 우선
 *   2) departments로 department_id 매핑
 */

// =======================
// 0) API 설정
// =======================
const API = {
  baseUrl: "http://127.0.0.1:8500",
  departments: "/api/departments",
  employees: "/api/employees",
};

// =======================
// 1) 유틸
// =======================
const $ = (sel) => document.querySelector(sel);

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function toast(title, msg) {
  const host = $("#toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-msg">${escapeHtml(msg)}</div>
  `;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiFetch(path, opts = {}) {
  const url = `${API.baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers });

  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch (_) {}

  let data = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch (_) {
    data = bodyText;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return data;
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function formatCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function getRowId(row) {
  return row?.id ?? row?.dept_id ?? row?.emp_id ?? null;
}

function parseRoute() {
  const hash = location.hash || "#/dashboard";
  return hash.replace(/^#/, "");
}

function setActiveNav(routeKey) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === routeKey);
  });
}

// ===== debounce =====
function debounce(fn, wait = 200) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// =======================
// 2) 상태
// =======================
const state = {
  departments: [],
  employees: [],
  deptNameById: new Map(),

  table: {
    departments: {
      q: "",
      // 복수 검색조건: "__all__"이면 전체, 아니면 배열에 선택된 키들
      qFields: ["__all__"],
      sortKey: "id",
      sortDir: "asc",
      page: 1,
      pageSize: 10,
      hiddenCols: {}, // {colKey:true}
    },
    employees: {
      q: "",
      qFields: ["__all__"],
      sortKey: "id",
      sortDir: "asc",
      page: 1,
      pageSize: 10,
      // 기본: department_id 숨김
      hiddenCols: { department_id: true },
    },
  },
};

let dataLoadedOnce = false;

// 디바운스 렌더(전역)
const rerenderCurrentDebounced = debounce(() => rerenderCurrent(), 200);

const dom = {
  view: $("#view"),
  btnRefresh: $("#btnRefresh"),
  btnTheme: $("#btnTheme"),
  apiBaseLabel: $("#apiBaseLabel"),

  modalOverlay: $("#modalOverlay"),
  modalTitle: $("#modalTitle"),
  modalSub: $("#modalSub"),
  modalForm: $("#modalForm"),
  modalClose: $("#modalClose"),
  modalCancel: $("#modalCancel"),
  modalSubmit: $("#modalSubmit"),
};

// =======================
// 3) 부서명 매핑
// =======================
function rebuildDeptMap() {
  state.deptNameById = new Map(
    (state.departments || [])
      .filter((d) => getRowId(d) != null)
      .map((d) => [
        String(getRowId(d)),
        String(d.name ?? d.code ?? getRowId(d)),
      ])
  );
}

function getDeptNameForEmployee(emp) {
  const direct = emp?.department?.name;
  if (direct) return String(direct);

  const did = emp?.department_id;
  if (did === null || did === undefined || did === "") return "";
  return state.deptNameById.get(String(did)) ?? String(did);
}

// =======================
// 4) filter/sort/page
// =======================
function compareSmart(a, b) {
  const na = Number(a);
  const nb = Number(b);
  const aNum = !Number.isNaN(na) && String(a).trim() !== "";
  const bNum = !Number.isNaN(nb) && String(b).trim() !== "";
  if (aNum && bNum) return na - nb;

  const da = Date.parse(a);
  const db = Date.parse(b);
  const aDate = !Number.isNaN(da);
  const bDate = !Number.isNaN(db);
  if (aDate && bDate) return da - db;

  return String(a).localeCompare(String(b), "ko");
}

function buildSearchText(row, keys, extraText = "") {
  const parts = [];
  for (const k of keys) {
    const v = row?.[k];
    if (v === null || v === undefined) continue;
    if (typeof v === "object") parts.push(JSON.stringify(v));
    else parts.push(String(v));
  }
  if (extraText) parts.push(extraText);
  return parts.join(" ").toLowerCase();
}

// 복수 필드 선택 처리:
// - ["__all__"]이면 visibleCols 전체 + deptName
// - 그 외면 선택된 필드키들만
function applyFilterSortPage(rows, visibleCols, ui, searchConfig) {
  const q = (ui.q || "").trim().toLowerCase();
  const qFields = ui.qFields?.length ? ui.qFields : ["__all__"];

  let filtered = rows;

  if (q) {
    filtered = rows.filter((r) => {
      const deptName = r.__dept_name ?? "";
      const extra = deptName ? ` ${deptName}` : "";

      // 전체 검색
      if (qFields.includes("__all__")) {
        const keys = visibleCols
          .map((c) => c.key)
          .filter((k) => k !== "__dept_name");
        const text = buildSearchText(r, keys, extra);
        return text.includes(q);
      }

      // 선택된 필드들 중 하나라도 match면 통과(OR)
      for (const f of qFields) {
        if (f === "__dept_name") {
          if (String(deptName).toLowerCase().includes(q)) return true;
          continue;
        }

        const keys = searchConfig?.fieldKeys?.[f] || [f];
        const text = buildSearchText(r, keys, extra);
        if (text.includes(q)) return true;
      }
      return false;
    });
  }

  // sort
  const key = ui.sortKey;
  const dir = ui.sortDir === "desc" ? -1 : 1;

  const sorted = [...filtered].sort((ra, rb) => {
    let va;
    let vb;

    if (key === "__dept_name") {
      va = ra.__dept_name ?? "";
      vb = rb.__dept_name ?? "";
    } else {
      va = ra?.[key];
      vb = rb?.[key];
    }

    if (va === null || va === undefined) va = "";
    if (vb === null || vb === undefined) vb = "";

    return compareSmart(va, vb) * dir;
  });

  // paging
  const pageSize = ui.pageSize;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, ui.page), totalPages);
  ui.page = page;

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageRows = sorted.slice(start, end);

  return { pageRows, total, totalPages, page };
}

function buildPageNumbers(current, totalPages, maxButtons = 7) {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => ({
      type: "page",
      n: i + 1,
    }));
  }

  const items = [];
  const addPage = (n) => items.push({ type: "page", n });
  const addEllipsis = () => items.push({ type: "ellipsis" });

  const windowSize = 3;
  const start = Math.max(2, current - windowSize);
  const end = Math.min(totalPages - 1, current + windowSize);

  addPage(1);
  if (start > 2) addEllipsis();
  for (let n = start; n <= end; n++) addPage(n);
  if (end < totalPages - 1) addEllipsis();
  addPage(totalPages);

  return items;
}

// =======================
// 5) Column picker modal (공통)
// =======================
function openColumnPickerModal({ tableKey, title, columns }) {
  const ui = state.table[tableKey];
  const hidden = ui.hiddenCols || {};

  // columns: [{key,label,required?}]
  const bodyHtml = `
    <div class="colpicker">
      <div class="colpicker-head">
        <div class="muted" style="font-size:12px; line-height:1.6">
          체크 해제하면 해당 컬럼이 숨겨집니다.<br/>
          (필수 컬럼은 숨길 수 없습니다.)
        </div>
        <div class="card-actions">
          <button class="btn small" type="button" id="colAll">전체 표시</button>
          <button class="btn small" type="button" id="colReset">기본값</button>
        </div>
      </div>

      <div class="colpicker-list">
        ${columns
          .map((c) => {
            const isHidden = !!hidden[c.key];
            const disabled = c.required ? "disabled" : "";
            const checked = !isHidden ? "checked" : "";
            return `
              <label class="check-row">
                <input type="checkbox" data-col="${escapeHtml(
                  c.key
                )}" ${checked} ${disabled}/>
                <span class="check-label">${escapeHtml(c.label)}</span>
                <span class="check-key">${escapeHtml(c.key)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  openModal({
    title: `${title} 컬럼 설정`,
    sub: "표에 표시할 컬럼을 선택하세요.",
    // openModal이 form 기반이라 fields 대신 직접 innerHTML을 주입하는 꼼수
    fields: [
      {
        name: "__custom",
        label: "",
        type: "custom",
      },
    ],
    onSubmit: async () => {
      // 저장 버튼 누를 때 적용
      const checks = dom.modalForm.querySelectorAll(
        "input[type=checkbox][data-col]"
      );
      checks.forEach((ch) => {
        const key = ch.dataset.col;
        const col = columns.find((x) => x.key === key);
        if (col?.required) return; // required는 무시
        // checked = 표시, unchecked = 숨김
        hidden[key] = !ch.checked;
      });

      ui.hiddenCols = hidden;

      // sortKey가 숨김 컬럼이면 보정
      if (ui.hiddenCols[ui.sortKey])
        ui.sortKey = columns.find((c) => !ui.hiddenCols[c.key])?.key ?? "id";

      ui.page = 1;
      rerenderCurrent();
    },
  });

  // 커스텀 내용 주입
  dom.modalForm.innerHTML = bodyHtml;

  // 버튼들
  $("#colAll").onclick = () => {
    const checks = dom.modalForm.querySelectorAll(
      "input[type=checkbox][data-col]"
    );
    checks.forEach((ch) => {
      const key = ch.dataset.col;
      const col = columns.find((x) => x.key === key);
      if (col?.required) return;
      ch.checked = true;
    });
  };

  $("#colReset").onclick = () => {
    // 기본값: employees는 department_id 숨김, 나머지는 숨김 없음
    const defaults = tableKey === "employees" ? { department_id: true } : {};

    const checks = dom.modalForm.querySelectorAll(
      "input[type=checkbox][data-col]"
    );
    checks.forEach((ch) => {
      const key = ch.dataset.col;
      const col = columns.find((x) => x.key === key);
      if (col?.required) return;
      ch.checked = !defaults[key];
    });
  };
}

// =======================
// 6) 테이블 렌더(공통)
// =======================
function rerenderCurrent() {
  const path = parseRoute();
  if (path === "/departments") return renderDepartments();
  if (path === "/employees") return renderEmployees();
  if (path === "/dashboard") return renderDashboard();
  if (path === "/departments/new") return renderDepartmentsNew();
  if (path === "/employees/new") return renderEmployeesNew();
  location.hash = "#/dashboard";
}

function renderTableCard({
  tableKey,
  title,
  desc,
  rows,
  columns,
  searchConfig,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  rowTransform,
}) {
  const ui = state.table[tableKey];

  // row 변환(예: __dept_name)
  const displayRows = rowTransform ? rows.map(rowTransform) : rows;

  // 컬럼 숨김 적용
  const visibleCols = columns.filter((c) => !ui.hiddenCols?.[c.key]);

  // sortKey 보정
  if (ui.sortKey && ui.sortKey !== "__dept_name") {
    const exists = visibleCols.some((c) => c.key === ui.sortKey);
    if (!exists) ui.sortKey = visibleCols[0]?.key ?? "id";
  }

  const { pageRows, total, totalPages, page } = applyFilterSortPage(
    displayRows,
    visibleCols,
    ui,
    searchConfig
  );

  // 헤더
  const headHtml =
    visibleCols
      .map((c) => {
        const sortable = c.sortable !== false;
        const isActive = ui.sortKey === c.key;
        const ind = isActive ? (ui.sortDir === "asc" ? "▲" : "▼") : "";
        return `
          <th class="${sortable ? "sortable" : ""}" data-sort="${escapeHtml(
          c.key
        )}">
            ${escapeHtml(c.label)}${
          ind ? `<span class="sort-ind">${ind}</span>` : ""
        }
          </th>
        `;
      })
      .join("") + `<th class="actions">Actions</th>`;

  const bodyHtml =
    pageRows.length === 0
      ? `<tr><td colspan="${
          visibleCols.length + 1
        }" class="muted">데이터가 없습니다.</td></tr>`
      : pageRows
          .map((r) => {
            const tds = visibleCols
              .map((c) => `<td>${escapeHtml(formatCell(r?.[c.key]))}</td>`)
              .join("");
            const rid = getRowId(r);
            return `
              <tr>
                ${tds}
                <td class="actions">
                  <div class="row-actions">
                    <button class="btn small btnEdit" data-id="${escapeHtml(
                      String(rid ?? "")
                    )}">수정</button>
                    <button class="btn danger small btnDelete" data-id="${escapeHtml(
                      String(rid ?? "")
                    )}">삭제</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("");

  const pages = buildPageNumbers(page, totalPages);

  // 복수 검색조건 chips
  const qOpts = searchConfig?.options || [{ value: "__all__", label: "전체" }];
  const selected = new Set(ui.qFields || ["__all__"]);

  // "__all__"이면 다른건 해제 상태로 보이게
  const isAll = selected.has("__all__");

  dom.view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">${escapeHtml(title)}</div>
          <div class="muted" style="margin-top:4px; font-size:12px;">${escapeHtml(
            desc
          )}</div>
        </div>
        <div class="card-actions">
          <button class="btn" id="btnCols">컬럼 설정</button>
          <button class="btn primary" id="btnCreate">등록</button>
        </div>
      </div>

      <div class="table-controls">
        <div class="ctrl-left">
          <input class="input sm" id="qInput" placeholder="검색..." value="${escapeHtml(
            ui.q
          )}" />
          <span class="muted" style="font-size:12px;">총 <span class="mono">${total}</span>건</span>

          <div class="ctrl-left" style="gap:8px;">
            ${qOpts
              .map((o) => {
                const checked = selected.has(o.value) ? "checked" : "";
                const disabled = o.value !== "__all__" && isAll ? "" : "";
                // "__all__"이 체크되면 다른 체크는 해제 가능하지만, 표시상 의미만
                return `
                  <label class="chip" title="복수 선택 가능">
                    <input type="checkbox" class="qChip" data-q="${escapeHtml(
                      o.value
                    )}" ${checked}/>
                    ${escapeHtml(o.label)}
                  </label>
                `;
              })
              .join("")}
          </div>
        </div>

        <div class="ctrl-right">
          <label class="muted" style="font-size:12px;">Page size</label>
          <select class="select sm" id="pageSizeSel">
            ${[10, 20, 50]
              .map(
                (n) =>
                  `<option value="${n}" ${
                    ui.pageSize === n ? "selected" : ""
                  }>${n}</option>`
              )
              .join("")}
          </select>

          <div class="pager">
            <button class="btn small" id="prevPage" ${
              page <= 1 ? "disabled" : ""
            }>이전</button>
            <div class="page-list" id="pageList">
              ${pages
                .map((p) => {
                  if (p.type === "ellipsis")
                    return `<span class="page-ellipsis">…</span>`;
                  const active = p.n === page ? "active" : "";
                  return `<button class="page-num ${active}" data-page="${p.n}">${p.n}</button>`;
                })
                .join("")}
            </div>
            <button class="btn small" id="nextPage" ${
              page >= totalPages ? "disabled" : ""
            }>다음</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  // 컬럼 설정 모달
  $("#btnCols").onclick = () => {
    openColumnPickerModal({
      tableKey,
      title,
      columns,
    });
  };

  $("#btnCreate").onclick = onCreateClick;

  // ===== debounced search =====
  $("#qInput").oninput = (e) => {
    ui.q = e.target.value ?? "";
    ui.page = 1;
    rerenderCurrentDebounced();
  };

  // 복수 검색조건 chips
  dom.view.querySelectorAll(".qChip").forEach((ch) => {
    ch.onchange = () => {
      const key = ch.dataset.q;
      if (!key) return;

      const set = new Set(ui.qFields || ["__all__"]);

      if (key === "__all__") {
        // 전체 체크하면 나머지 제거
        if (ch.checked) {
          ui.qFields = ["__all__"];
        } else {
          // 전체 해제 시 아무것도 없으면 전체로 복구
          set.delete("__all__");
          ui.qFields = set.size ? Array.from(set) : ["__all__"];
        }
      } else {
        // 특정 필드 체크하면 전체 제거
        set.delete("__all__");
        if (ch.checked) set.add(key);
        else set.delete(key);

        ui.qFields = set.size ? Array.from(set) : ["__all__"];
      }

      ui.page = 1;
      rerenderCurrent();
    };
  });

  // page size
  $("#pageSizeSel").onchange = (e) => {
    ui.pageSize = Number(e.target.value) || 10;
    ui.page = 1;
    rerenderCurrent();
  };

  // prev/next
  $("#prevPage").onclick = () => {
    ui.page = Math.max(1, ui.page - 1);
    rerenderCurrent();
  };
  $("#nextPage").onclick = () => {
    ui.page = Math.min(totalPages, ui.page + 1);
    rerenderCurrent();
  };

  // page numbers click
  dom.view.querySelectorAll(".page-num").forEach((btn) => {
    btn.onclick = () => {
      const n = Number(btn.dataset.page);
      if (!Number.isFinite(n)) return;
      ui.page = n;
      rerenderCurrent();
    };
  });

  // sort
  dom.view.querySelectorAll("th.sortable").forEach((th) => {
    th.onclick = () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (ui.sortKey === key)
        ui.sortDir = ui.sortDir === "asc" ? "desc" : "asc";
      else {
        ui.sortKey = key;
        ui.sortDir = "asc";
      }
      ui.page = 1;
      rerenderCurrent();
    };
  });

  // edit/delete
  dom.view.querySelectorAll(".btnEdit").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!id) return toast("수정 실패", "id를 찾지 못했습니다.");
      try {
        await onEditClick(id);
      } catch (e) {
        toast("수정 실패", e.message || String(e));
      }
    };
  });

  dom.view.querySelectorAll(".btnDelete").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!id) return toast("삭제 실패", "id를 찾지 못했습니다.");
      const ok = confirm(`정말 삭제할까요? (id: ${id})`);
      if (!ok) return;
      try {
        await onDeleteClick(id);
      } catch (e) {
        toast("삭제 실패", e.message || String(e));
      }
    };
  });
}

// =======================
// 7) Views
// =======================
function renderDashboard() {
  setText("pageTitle", "대시보드");
  setText("pageDesc", "부서/사원 정보를 조회하고 등록/수정/삭제합니다.");
  dom.view.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <div class="card-head">
          <div class="card-title">부서</div>
          <div class="card-actions">
            <button class="btn" id="goDepts">부서 목록</button>
            <button class="btn primary" id="newDept">부서 등록</button>
          </div>
        </div>
        <div class="muted">현재 로딩된 부서: <span class="mono">${state.departments.length}</span></div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">사원</div>
          <div class="card-actions">
            <button class="btn" id="goEmps">사원 목록</button>
            <button class="btn primary" id="newEmp">사원 등록</button>
          </div>
        </div>
        <div class="muted">현재 로딩된 사원: <span class="mono">${state.employees.length}</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">업그레이드된 UX</div>
      <div class="muted" style="line-height:1.7; margin-top:10px;">
        - 검색창은 200ms 디바운스로 부드럽게 동작합니다.<br/>
        - 검색 조건은 복수 선택 가능합니다(이름+전화+부서명).<br/>
        - 컬럼 표시/숨김은 "컬럼 설정" 버튼에서 공통 모달로 설정합니다.
      </div>
    </div>
  `;
  $("#goDepts").onclick = () => (location.hash = "#/departments");
  $("#goEmps").onclick = () => (location.hash = "#/employees");
  $("#newDept").onclick = () => openDeptModal({ mode: "create" });
  $("#newEmp").onclick = () => openEmpModal({ mode: "create" });
}

function renderDepartments() {
  setText("pageTitle", "부서 목록");
  setText(
    "pageDesc",
    "디바운스 검색 / 복수 조건 / 컬럼 설정 / 정렬 / 페이지네이션"
  );

  const columns = [
    { key: "id", label: "ID", sortable: true, required: true },
    { key: "code", label: "부서코드", sortable: true },
    { key: "name", label: "부서명", sortable: true, required: true },
    { key: "description", label: "설명", sortable: true },
    { key: "created_at", label: "생성일", sortable: true },
  ];

  const searchConfig = {
    options: [
      { value: "__all__", label: "전체" },
      { value: "name", label: "부서명" },
      { value: "code", label: "부서코드" },
      { value: "description", label: "설명" },
    ],
    fieldKeys: {},
  };

  renderTableCard({
    tableKey: "departments",
    title: "Departments",
    desc: `GET ${API.departments}`,
    rows: state.departments,
    columns,
    searchConfig,
    onCreateClick: () => openDeptModal({ mode: "create" }),
    onEditClick: async (deptId) => {
      const row = state.departments.find(
        (d) => String(getRowId(d)) === String(deptId)
      );
      if (!row) throw new Error("대상 부서를 찾지 못했습니다.");
      openDeptModal({ mode: "edit", row });
    },
    onDeleteClick: async (deptId) => {
      await apiFetch(`${API.departments}/${deptId}`, { method: "DELETE" });
      toast("삭제 완료", "부서 목록을 갱신합니다.");
      await loadDepartments();
      rebuildDeptMap();
      rerenderCurrent();
    },
  });
}

function renderEmployees() {
  setText("pageTitle", "사원 목록");
  setText(
    "pageDesc",
    "부서명 표시 + 디바운스 검색/복수 조건/컬럼 설정/정렬/페이지네이션"
  );

  const rowTransform = (e) => ({
    ...e,
    __dept_name: getDeptNameForEmployee(e),
  });

  const columns = [
    { key: "id", label: "ID", sortable: true, required: true },
    { key: "emp_no", label: "사번", sortable: true },
    { key: "name", label: "이름", sortable: true, required: true },
    { key: "department_id", label: "부서ID", sortable: true },
    { key: "__dept_name", label: "부서명", sortable: true },
    { key: "gender", label: "성별", sortable: true },
    { key: "phone", label: "전화", sortable: true },
    { key: "memo", label: "비고", sortable: true },
  ];

  const searchConfig = {
    options: [
      { value: "__all__", label: "전체" },
      { value: "name", label: "이름" },
      { value: "phone", label: "전화" },
      { value: "emp_no", label: "사번" },
      { value: "__dept_name", label: "부서명" },
      { value: "gender", label: "성별" },
    ],
    fieldKeys: {},
  };

  renderTableCard({
    tableKey: "employees",
    title: "Employees",
    desc: `GET ${API.employees}`,
    rows: state.employees,
    columns,
    searchConfig,
    rowTransform,
    onCreateClick: () => openEmpModal({ mode: "create" }),
    onEditClick: async (empId) => {
      const row = state.employees.find(
        (e) => String(getRowId(e)) === String(empId)
      );
      if (!row) throw new Error("대상 사원을 찾지 못했습니다.");
      openEmpModal({ mode: "edit", row });
    },
    onDeleteClick: async (empId) => {
      await apiFetch(`${API.employees}/${empId}`, { method: "DELETE" });
      toast("삭제 완료", "사원 목록을 갱신합니다.");
      await loadEmployees();
      rerenderCurrent();
    },
  });
}

function renderDepartmentsNew() {
  setText("pageTitle", "부서 등록");
  setText("pageDesc", "새 부서를 등록합니다.");
  dom.view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">부서 등록</div>
          <div class="muted" style="margin-top:4px; font-size:12px;">POST ${API.departments}</div>
        </div>
        <div class="card-actions">
          <button class="btn primary" id="openDeptModal">등록 폼 열기</button>
        </div>
      </div>
      <div class="muted" style="line-height:1.7">
        - 등록 후 자동으로 부서 목록을 갱신합니다.
      </div>
    </div>
  `;
  $("#openDeptModal").onclick = () => openDeptModal({ mode: "create" });
}

function renderEmployeesNew() {
  setText("pageTitle", "사원 등록");
  setText("pageDesc", "새 사원을 등록합니다.");
  dom.view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">사원 등록</div>
          <div class="muted" style="margin-top:4px; font-size:12px;">POST ${API.employees}</div>
        </div>
        <div class="card-actions">
          <button class="btn primary" id="openEmpModal">등록 폼 열기</button>
        </div>
      </div>
      <div class="muted" style="line-height:1.7">
        - 등록 후 자동으로 사원 목록을 갱신합니다.
      </div>
    </div>
  `;
  $("#openEmpModal").onclick = () => openEmpModal({ mode: "create" });
}

// =======================
// 8) 모달(등록/수정) - 기존 모달 재사용
// =======================
function openModal({ title, sub, fields, onSubmit }) {
  dom.modalTitle.textContent = title;
  dom.modalSub.textContent = sub;

  dom.modalForm.innerHTML = (fields || [])
    .map((f) => {
      if (f.type === "custom") {
        return `<div></div>`; // placeholder
      }
      const inputId = `f_${f.name}`;
      const type = f.type || "text";
      const placeholder = f.placeholder || "";
      const help = f.help
        ? `<div class="form-help">${escapeHtml(f.help)}</div>`
        : "";
      const requiredMark = f.required ? " *" : "";

      const optionsHtml =
        type === "select"
          ? `<select class="input" id="${inputId}" name="${f.name}" ${
              f.required ? "required" : ""
            }>
              ${(f.options || [])
                .map(
                  (o) =>
                    `<option value="${escapeHtml(o.value)}">${escapeHtml(
                      o.label
                    )}</option>`
                )
                .join("")}
            </select>`
          : `<input class="input" id="${inputId}" name="${
              f.name
            }" type="${type}"
              placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(
              f.value ?? ""
            )}"
              ${f.required ? "required" : ""} />`;

      return `
        <div class="form-row" style="margin-bottom:12px;">
          <div class="label">${escapeHtml(f.label)}${requiredMark}</div>
          ${optionsHtml}
          ${help}
        </div>
      `;
    })
    .join("");

  dom.modalOverlay.classList.remove("hidden");

  const close = () => dom.modalOverlay.classList.add("hidden");
  dom.modalClose.onclick = close;
  dom.modalCancel.onclick = close;

  dom.modalForm.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(dom.modalForm);
    const payload = {};
    for (const [k, v] of fd.entries()) payload[k] = v;

    try {
      await onSubmit(payload);
      close();
    } catch (err) {
      toast("실패", err.message || String(err));
    }
  };
}

function openDeptModal({ mode, row }) {
  const isEdit = mode === "edit";
  const id = isEdit ? getRowId(row) : null;

  openModal({
    title: isEdit ? `부서 수정 (ID: ${id})` : "부서 등록",
    sub: isEdit ? "수정할 항목을 변경하세요." : "부서 정보를 입력하세요.",
    fields: [
      {
        name: "code",
        label: "부서코드",
        placeholder: "예: DEV",
        required: false,
        value: isEdit ? row?.code ?? "" : "",
      },
      {
        name: "name",
        label: "부서명",
        placeholder: "예: 개발팀",
        required: true,
        value: isEdit ? row?.name ?? "" : "",
      },
      {
        name: "description",
        label: "설명",
        placeholder: "예: 제품 개발 담당",
        required: false,
        value: isEdit ? row?.description ?? "" : "",
      },
    ],
    onSubmit: async (payload) => {
      if (isEdit) {
        await apiFetch(`${API.departments}/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast("부서 수정 완료", "부서 목록을 갱신합니다.");
      } else {
        await apiFetch(API.departments, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast("부서 등록 완료", "부서 목록을 갱신합니다.");
      }
      await loadDepartments();
      rebuildDeptMap();
      location.hash = "#/departments";
      rerenderCurrent();
    },
  });
}

function openEmpModal({ mode, row }) {
  const isEdit = mode === "edit";
  const id = isEdit ? getRowId(row) : null;

  const deptOptions = (state.departments || []).map((d) => ({
    value: String(getRowId(d) ?? d.code ?? d.name ?? ""),
    label: String(d.name ?? d.code ?? getRowId(d) ?? "부서"),
  }));

  const currentDeptId = isEdit ? row?.department_id ?? "" : "";

  openModal({
    title: isEdit ? `사원 수정 (ID: ${id})` : "사원 등록",
    sub: isEdit ? "수정할 항목을 변경하세요." : "사원 정보를 입력하세요.",
    fields: [
      {
        name: "emp_no",
        label: "사번",
        placeholder: "예: 1001",
        required: false,
        value: isEdit ? row?.emp_no ?? "" : "",
      },
      {
        name: "name",
        label: "이름",
        placeholder: "예: 홍길동",
        required: true,
        value: isEdit ? row?.name ?? "" : "",
      },
      {
        name: "department_id",
        label: "부서",
        type: "select",
        required: false,
        options: deptOptions.length
          ? [{ value: "", label: "선택 안 함" }, ...deptOptions]
          : [{ value: "", label: "부서를 먼저 등록/조회하세요" }],
        help: "부서명 표시를 위해, 가능하면 부서를 선택해 주세요.",
      },
      {
        name: "gender",
        label: "성별",
        type: "select",
        required: false,
        options: [
          { value: "", label: "선택 안 함" },
          { value: "M", label: "남" },
          { value: "F", label: "여" },
        ],
      },
      {
        name: "phone",
        label: "전화번호",
        placeholder: "예: 010-1234-5678",
        required: false,
        value: isEdit ? row?.phone ?? "" : "",
      },
      {
        name: "memo",
        label: "비고",
        placeholder: "메모",
        required: false,
        value: isEdit ? row?.memo ?? "" : "",
      },
    ],
    onSubmit: async (payload) => {
      if (isEdit) {
        if (!payload.department_id && currentDeptId)
          payload.department_id = String(currentDeptId);
        if (!payload.gender && row?.gender) payload.gender = String(row.gender);
      }

      if (!payload.department_id) delete payload.department_id;
      if (!payload.gender) delete payload.gender;

      if (isEdit) {
        await apiFetch(`${API.employees}/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast("사원 수정 완료", "사원 목록을 갱신합니다.");
      } else {
        await apiFetch(API.employees, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast("사원 등록 완료", "사원 목록을 갱신합니다.");
      }

      await loadEmployees();
      location.hash = "#/employees";
      rerenderCurrent();
    },
  });

  if (isEdit) {
    const deptSel = document.querySelector(`#f_department_id`);
    if (deptSel && currentDeptId !== null && currentDeptId !== undefined)
      deptSel.value = String(currentDeptId);
    const genderSel = document.querySelector(`#f_gender`);
    if (genderSel && row?.gender) genderSel.value = String(row.gender);
  }
}

// =======================
// 9) 데이터 로드
// =======================
async function loadDepartments() {
  const data = await apiFetch(API.departments, { method: "GET" });
  state.departments = normalizeList(data);
}

async function loadEmployees() {
  const data = await apiFetch(API.employees, { method: "GET" });
  state.employees = normalizeList(data);
}

async function loadAll() {
  try {
    await loadDepartments();
  } catch (_) {
    toast("부서 로드 실패", "API 경로/서버/CORS를 확인하세요.");
  }
  try {
    await loadEmployees();
  } catch (_) {
    toast("사원 로드 실패", "API 경로/서버/CORS를 확인하세요.");
  }
  rebuildDeptMap();
}

// =======================
// 10) 테마/라우터/초기화
// =======================
function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.dataset.theme = saved;
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
}

async function renderRoute() {
  const path = parseRoute();

  if (path.startsWith("/departments/new")) setActiveNav("departments-new");
  else if (path.startsWith("/employees/new")) setActiveNav("employees-new");
  else if (path.startsWith("/departments")) setActiveNav("departments");
  else if (path.startsWith("/employees")) setActiveNav("employees");
  else setActiveNav("dashboard");

  if (!dataLoadedOnce) {
    await loadAll();
    dataLoadedOnce = true;
  }

  if (path === "/dashboard") return renderDashboard();
  if (path === "/departments") return renderDepartments();
  if (path === "/employees") return renderEmployees();
  if (path === "/departments/new") return renderDepartmentsNew();
  if (path === "/employees/new") return renderEmployeesNew();

  location.hash = "#/dashboard";
}

function init() {
  setText("apiBaseLabel", API.baseUrl);
  initTheme();

  window.addEventListener("hashchange", () => {
    renderRoute().catch((e) => toast("라우트 실패", e.message || String(e)));
  });

  dom.btnTheme.onclick = toggleTheme;

  dom.btnRefresh.onclick = async () => {
    toast("새로고침", "데이터를 다시 불러옵니다.");
    await loadAll();
    await renderRoute();
  };

  dom.modalOverlay.addEventListener("click", (e) => {
    if (e.target === dom.modalOverlay) dom.modalOverlay.classList.add("hidden");
  });

  if (!location.hash) location.hash = "#/dashboard";
  renderRoute().catch((e) => toast("초기 로드 실패", e.message || String(e)));
}

document.addEventListener("DOMContentLoaded", init);
