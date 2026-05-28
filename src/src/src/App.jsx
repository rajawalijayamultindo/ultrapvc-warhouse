import { useState, useEffect, useCallback } from "react";

const API = "https://script.google.com/macros/s/AKfycbyTkXJ3_vdcq2sLE_mCw1jsN74rupMrokZAvsMEk2WvEROwacobbjfR7nUb_YKlXbDR/exec";

const BOM = { frame: 1, leaf: 1, list: 2, hinge: 2, screw: 16, handle: 1, lock: 1 };
const UNITS = { frame: "list", leaf: "pcs", list: "list", hinge: "pcs", screw: "pcs", handle: "pcs", lock: "pcs" };
const LABELS = { frame: "Door Frame", leaf: "Door Leaf", list: "Door List", hinge: "Hinge", screw: "Screw", handle: "Door Handle", lock: "Door Lock Switch" };
const SPECS = { frame: "4.65m/list", leaf: "1 each", list: "2.6m/list", hinge: "per pair", screw: "per set", handle: "1 each", lock: "1 each" };
const GROUPS = { "PVC Structure": ["frame", "leaf", "list"], "Hardware": ["hinge", "screw", "handle", "lock"] };
const ALL_KEYS = Object.keys(BOM);
const DEFAULT_PINS = { owner: "1010", staff: "0000" };
const INIT_STOCK = Object.fromEntries(ALL_KEYS.map(k => [k, 0]));

async function apiCall(action, payload = null) {
  let url = `${API}?action=${action}`;
  if (payload !== null) url += `&payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const res = await fetch(url);
  return res.json();
}

function Badge({ children, color }) {
  const c = {
    green: ["#EAF3DE","#3B6D11"], amber: ["#FAEEDA","#854F0B"],
    red: ["#FCEBEB","#A32D2D"], blue: ["#E6F1FB","#185FA5"],
    purple: ["#EEEDFE","#3C3489"], gray: ["#F1EFE8","#5F5E5A"]
  };
  return (
    <span style={{ background: c[color]?.[0], color: c[color]?.[1], fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, sub, color }) {
  const c = { green: "#3B6D11", amber: "#854F0B", blue: "#185FA5", purple: "#3C3489" };
  return (
    <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "12px 16px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: c[color] || "#1a1a1a" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PinInput({ onSubmit, error }) {
  const [pin, setPin] = useState("");
  const handleKey = (k) => {
    if (k === "DEL") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => { onSubmit(next); setPin(""); }, 200);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: pin.length > i ? "#534AB7" : "#ddd", transition: "background 0.15s" }} />
        ))}
      </div>
      {error && <div style={{ fontSize: 12, color: "#A32D2D" }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: 200 }}>
        {["1","2","3","4","5","6","7","8","9","DEL","0","✓"].map(k => (
          <button key={k} onClick={() => handleKey(k === "✓" ? "" : k)}
            style={{ padding: "14px 0", fontSize: k === "DEL" || k === "✓" ? 13 : 18, fontWeight: 500, borderRadius: 10, background: k === "✓" ? "#EEEDFE" : "#f5f5f5", color: k === "✓" ? "#3C3489" : "#1a1a1a", border: "0.5px solid #ddd" }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [pinError, setPinError] = useState("");
  const [choosingRole, setChoosingRole] = useState(null);
  const [pins, setPins] = useState(DEFAULT_PINS);
  const [stock, setStock] = useState(INIT_STOCK);
  const [log, setLog] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("warehouse");
  const [receiveForm, setReceiveForm] = useState(Object.fromEntries(ALL_KEYS.map(k => [k, ""])));
  const [prodQty, setProdQty] = useState("");
  const [reverseQty, setReverseQty] = useState("");
  const [msg, setMsg] = useState(null);
  const [changingPin, setChangingPin] = useState(null);
  const [newPinStep, setNewPinStep] = useState(1);
  const [newPinFirst, setNewPinFirst] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const showMsg = (text, type = "success") => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall("getAll");
      if (res.stock) { const { pins: p, ...s } = res.stock; setStock(s); if (p) setPins(p); }
      if (res.requests) setRequests(res.requests);
      if (res.log) setLog(res.log);
      setLastSync(new Date().toLocaleTimeString("id-ID"));
    } catch { showMsg("Could not connect to Google Sheets.", "error"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!role) return;
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, [role, loadAll]);

  async function save(action, payload) {
    setSyncing(true);
    try { await apiCall(action, payload); setLastSync(new Date().toLocaleTimeString("id-ID")); }
    catch { showMsg("Sync failed.", "error"); }
    setSyncing(false);
  }

  const maxDoors = Math.min(...ALL_KEYS.map(k => Math.floor((stock[k] || 0) / BOM[k])));
  const pendingCount = requests.filter(r => r.status === "pending").length;

  function handlePin(entered) {
    if (entered === pins[choosingRole]) {
      setRole(choosingRole); setChoosingRole(null); setPinError("");
      setTab(choosingRole === "owner" ? "reports" : "warehouse");
    } else { setPinError("Wrong PIN, try again."); }
  }

  async function handleReceive() {
    const added = Object.fromEntries(ALL_KEYS.map(k => [k, parseInt(receiveForm[k]) || 0]));
    if (ALL_KEYS.every(k => !added[k])) { showMsg("Enter at least one quantity.", "error"); return; }
    const newStock = Object.fromEntries(ALL_KEYS.map(k => [k, (stock[k] || 0) + added[k]]));
    const entries = ALL_KEYS.filter(k => added[k] > 0).map(k => `${added[k]} ${LABELS[k]}`).join(", ");
    const newLog = [{ type: "receive", text: `Received: ${entries}`, date: new Date().toLocaleString("id-ID"), by: "Staff" }, ...log];
    setStock(newStock); setLog(newLog);
    setReceiveForm(Object.fromEntries(ALL_KEYS.map(k => [k, ""])));
    await save("saveStock", { ...newStock, pins });
    await save("saveLog", newLog);
    showMsg("Stock updated & synced!");
  }

  async function handleRequestProduce() {
    const qty = parseInt(prodQty);
    if (!qty || qty <= 0) { showMsg("Enter a valid quantity.", "error"); return; }
    const req = { id: Date.now(), qty, date: new Date().toLocaleString("id-ID"), status: "pending" };
    const newRequests = [req, ...requests];
    setRequests(newRequests);
    await save("saveRequests", newRequests);
    setProdQty("");
    showMsg(`Request for ${qty} door(s) submitted!`);
  }

  async function handleApprove(id) {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    if (req.qty > maxDoors) { showMsg(`Not enough stock. Max: ${maxDoors}.`, "error"); return; }
    const newStock = Object.fromEntries(ALL_KEYS.map(k => [k, (stock[k] || 0) - req.qty * BOM[k]]));
    const summary = ALL_KEYS.map(k => `${req.qty * BOM[k]} ${LABELS[k]}`).join(", ");
    const newLog = [{ type: "produce", text: `Produced ${req.qty} door(s) — used: ${summary}`, date: new Date().toLocaleString("id-ID"), by: "Owner" }, ...log];
    const newRequests = requests.map(r => r.id === id ? { ...r, status: "approved" } : r);
    setStock(newStock); setLog(newLog); setRequests(newRequests);
    await save("saveStock", { ...newStock, pins });
    await save("saveLog", newLog);
    await save("saveRequests", newRequests);
    showMsg(`${req.qty} door(s) approved!`);
  }

  async function handleReject(id) {
    const newRequests = requests.map(r => r.id === id ? { ...r, status: "rejected" } : r);
    setRequests(newRequests);
    await save("saveRequests", newRequests);
    showMsg("Request rejected.", "error");
  }

  async function handleChangePin(entered) {
    if (newPinStep === 1) { setNewPinFirst(entered); setNewPinStep(2); setPinError(""); }
    else {
      if (entered !== newPinFirst) { setPinError("PINs don't match."); setNewPinStep(1); setNewPinFirst(""); }
      else {
        const updated = { ...pins, [changingPin]: entered };
        setPins(updated);
        await save("saveStock", { ...stock, pins: updated });
        setChangingPin(null); setNewPinStep(1); setNewPinFirst(""); setPinError("");
        showMsg("PIN updated!");
      }
    }
  }

  const revQty = parseInt(reverseQty) || 0;
  const revFeasible = revQty > 0 && ALL_KEYS.every(k => (stock[k] || 0) >= revQty * BOM[k]);

  const tabs = role === "owner" ? ["reports","approve","log","settings"] : ["warehouse","produce"];
  const tabLabels = { reports: "📊 Reports", approve: `✅ Approve${pendingCount > 0 ? ` (${pendingCount})` : ""}`, log: "📋 Log", settings: "⚙️ Settings", warehouse: "📦 Receive Stock", produce: "🏭 Request Production" };

  const tabStyle = (t) => ({
    padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
    borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
    background: "none", border: "none", borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
    color: tab === t ? "#534AB7" : "#666", whiteSpace: "nowrap"
  });

  if (loading && !role) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🏭</div>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.14em", color: "#534AB7" }}>ULTRA PVC</div>
      <div style={{ fontSize: 13, color: "#888" }}>Connecting to Google Sheets...</div>
    </div>
  );

  if (!role) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 24, padding: "2rem" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: "#534AB7", marginBottom: 6 }}>ULTRA PVC</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>Warehouse Management</h1>
        <p style={{ fontSize: 14, color: "#888", margin: 0 }}>PVC Bathroom Door Production</p>
      </div>
      {!choosingRole ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {["owner","staff"].map(r => (
            <button key={r} onClick={() => { setChoosingRole(r); setPinError(""); }}
              style={{ padding: "28px 40px", borderRadius: 14, fontSize: 15, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 140, background: r === "owner" ? "#EEEDFE" : "#f5f5f5", color: r === "owner" ? "#3C3489" : "#1a1a1a", border: `1px solid ${r === "owner" ? "#AFA9EC" : "#ddd"}` }}>
              <span style={{ fontSize: 32 }}>{r === "owner" ? "👑" : "👷"}</span>
              {r === "owner" ? "Owner" : "Staff"}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: 14, color: "#666" }}>Enter {choosingRole === "owner" ? "Owner" : "Staff"} PIN</p>
          <PinInput onSubmit={handlePin} error={pinError} />
          <button onClick={() => { setChoosingRole(null); setPinError(""); }} style={{ fontSize: 13, color: "#888", background: "none", border: "none" }}>← Back</button>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: lastSync ? "#1D9E75" : "#E24B4A", display: "inline-block" }} />
        {lastSync ? `Synced · ${lastSync}` : "Connecting..."}
      </div>
    </div>
  );

  if (changingPin) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600 }}>Change {changingPin === "owner" ? "Owner" : "Staff"} PIN</h3>
      <p style={{ fontSize: 13, color: "#666" }}>{newPinStep === 1 ? "Enter new PIN" : "Confirm new PIN"}</p>
      <PinInput onSubmit={handleChangePin} error={pinError} />
      <button onClick={() => { setChangingPin(null); setNewPinStep(1); setPinError(""); }} style={{ fontSize: 13, color: "#888", background: "none", border: "none" }}>← Cancel</button>
    </div>
  );

  return (
    <div style={{ padding: "1.25rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#534AB7", marginBottom: 2 }}>ULTRA PVC</div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 2px" }}>Warehouse & Production</h2>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>PVC Bathroom Door</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge color={role === "owner" ? "purple" : "blue"}>{role === "owner" ? "👑 Owner" : "👷 Staff"}</Badge>
            <button onClick={() => { setRole(null); }} style={{ fontSize: 12, padding: "4px 10px" }}>Log out</button>
            <button onClick={loadAll} style={{ fontSize: 12, padding: "4px 10px" }}>🔄 Sync</button>
          </div>
          <div style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: syncing ? "#EF9F27" : "#1D9E75", display: "inline-block" }} />
            {syncing ? "Syncing..." : `Last sync: ${lastSync || "—"}`}
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.type === "error" ? "#FCEBEB" : "#EAF3DE", color: msg.type === "error" ? "#A32D2D" : "#3B6D11", border: `1px solid ${msg.type === "error" ? "#F09595" : "#97C459"}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #eee", marginBottom: 20, overflowX: "auto" }}>
        {tabs.map(t => <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{tabLabels[t]}</button>)}
      </div>

      {tab === "reports" && (
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <MetricCard label="Max doors producible" value={maxDoors} sub="from current stock" color="purple" />
            {ALL_KEYS.map(k => <MetricCard key={k} label={LABELS[k]} value={stock[k]||0} sub={SPECS[k]} color={(stock[k]||0)===0?"amber":"blue"} />)}
          </div>
          {Object.entries(GROUPS).map(([g, keys]) => (
            <div key={g} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g}</div>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: "1px solid #eee" }}>
                  {["Material","Spec","In stock","Per door","Can make"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#888", fontWeight: 500 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {keys.map(k => (
                    <tr key={k} style={{ borderBottom: "1px solid #f5f5f5" }}>
                      <td style={{ padding: "8px", fontWeight: 500 }}>{LABELS[k]}</td>
                      <td style={{ padding: "8px", color: "#888" }}>{SPECS[k]}</td>
                      <td style={{ padding: "8px" }}><Badge color={(stock[k]||0)===0?"red":(stock[k]||0)<BOM[k]*5?"amber":"green"}>{stock[k]||0} {UNITS[k]}</Badge></td>
                      <td style={{ padding: "8px", color: "#888" }}>{BOM[k]}</td>
                      <td style={{ padding: "8px", color: "#3C3489", fontWeight: 500 }}>{Math.floor((stock[k]||0)/BOM[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === "approve" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Production requests</h3>
          {requests.length === 0 ? <p style={{ fontSize: 13, color: "#aaa" }}>No requests yet.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {requests.map(r => (
                <div key={r.id} style={{ padding: "12px 14px", borderRadius: 8, background: "#f9f9f9", border: "1px solid #eee", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Produce {r.qty} door(s)</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{r.date}</div>
                    {r.status === "pending" && r.qty > maxDoors && <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 3 }}>⚠ Insufficient stock (max: {maxDoors})</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.status === "pending" ? (
                      <>
                        <button onClick={() => handleApprove(r.id)} style={{ fontSize: 12, padding: "5px 14px", background: "#EAF3DE", color: "#3B6D11", border: "1px solid #97C459" }}>Approve</button>
                        <button onClick={() => handleReject(r.id)} style={{ fontSize: 12, padding: "5px 14px", background: "#FCEBEB", color: "#A32D2D", border: "1px solid #F09595" }}>Reject</button>
                      </>
                    ) : <Badge color={r.status === "approved" ? "green" : "red"}>{r.status}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "log" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Activity log</h3>
          {log.length === 0 ? <p style={{ fontSize: 13, color: "#aaa" }}>No activity yet.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {log.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#f9f9f9", borderLeft: `3px solid ${e.type === "receive" ? "#1D9E75" : "#534AB7"}` }}>
                  <span>{e.type === "receive" ? "📥" : "🔧"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{e.text}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{e.date} · {e.by}</div>
                  </div>
                  <Badge color={e.type === "receive" ? "green" : "purple"}>{e.type === "receive" ? "Received" : "Produced"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>PIN management</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {["owner","staff"].map(r => (
              <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 8, background: "#f9f9f9", border: "1px solid #eee" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r === "owner" ? "👑 Owner PIN" : "👷 Staff PIN"}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{"●".repeat(4)}</div>
                </div>
                <button onClick={() => { setChangingPin(r); setNewPinStep(1); setPinError(""); }} style={{ fontSize: 12, padding: "5px 14px" }}>Change PIN</button>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "#f9f9f9", border: "1px solid #eee" }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>🔗 Google Sheets</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: lastSync ? "#1D9E75" : "#E24B4A", display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#888" }}>{lastSync ? `Connected · ${lastSync}` : "Not connected"}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "warehouse" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Receive materials</h3>
          {Object.entries(GROUPS).map(([g, keys]) => (
            <div key={g} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {keys.map(k => (
                  <div key={k}>
                    <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>{LABELS[k]} <span style={{ color: "#aaa" }}>({SPECS[k]})</span></label>
                    <input type="number" min="0" placeholder="0" value={receiveForm[k]} onChange={e => setReceiveForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: "100%" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={handleReceive} style={{ background: "#534AB7", color: "#fff", border: "none", padding: "10px 24px", fontWeight: 500 }}>Add to stock</button>
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Current stock</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALL_KEYS.map(k => (
                <div key={k} style={{ background: "#f5f5f5", borderRadius: 8, padding: "8px 12px", minWidth: 90 }}>
                  <div style={{ fontSize: 11, color: "#888" }}>{LABELS[k]}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: (stock[k]||0) === 0 ? "#A32D2D" : "#185FA5" }}>{stock[k]||0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "produce" && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Request production</h3>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Submit a request — the owner will approve before stock is deducted.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
            <input type="number" min="1" placeholder="No. of doors" value={prodQty} onChange={e => setProdQty(e.target.value)} style={{ width: 140 }} />
            <button onClick={handleRequestProduce} disabled={!prodQty || parseInt(prodQty) <= 0} style={{ background: "#534AB7", color: "#fff", border: "none", padding: "10px 20px", fontWeight: 500 }}>Submit</button>
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>My requests</h3>
          {requests.length === 0 ? <p style={{ fontSize: 13, color: "#aaa" }}>No requests yet.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {requests.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "#f9f9f9", border: "1px solid #eee" }}>
                  <div>
                    <div style={{ fontSize: 13 }}>Produce <strong>{r.qty}</strong> door(s)</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{r.date}</div>
                  </div>
                  <Badge color={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}>{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
