import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, Bell,
  CarFront, Check, ChevronDown, CircleHelp, Clock3, Cpu, Gauge, LayoutDashboard,
  Menu, MoreHorizontal, ParkingCircle, Plus, Radio, RotateCcw, Search,
  SlidersHorizontal, Wifi, WifiOff, X, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar
} from 'recharts';

const initialSlots = [
  { id: 'P-01', level: 'Level 01', position: 'Upper left', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 148 },
  { id: 'P-02', level: 'Level 01', position: 'Upper right', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 152 },
  { id: 'P-03', level: 'Level 02', position: 'Middle left', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 145 },
  { id: 'P-04', level: 'Level 02', position: 'Middle right', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 156 },
  { id: 'P-05', level: 'Level 03', position: 'Lower left', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 160 },
  { id: 'P-06', level: 'Level 03', position: 'Lower right', status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 163 },
];

const initialVehicles = [
  { id: 1, number: 'AP 39 AB 1234', owner: 'Aarav Sharma', type: 'Car', rfid: 'A4:B3:C2:D1', slot: '—', status: 'Outside' },
  { id: 2, number: 'AP 39 CD 5678', owner: 'Diya Reddy', type: 'Car', rfid: 'B2:C4:D6:E8', slot: '—', status: 'Outside' },
  { id: 3, number: 'TS 08 EF 9012', owner: 'Ishaan Rao', type: 'SUV', rfid: 'C1:D2:E3:F4', slot: '—', status: 'Outside' },
  { id: 4, number: 'KA 05 GH 3456', owner: 'Meera Nair', type: 'Bike', rfid: 'D5:E6:F7:A8', slot: '—', status: 'Outside' },
];

const initialEvents = [];

const trend = [
  { time: '06 AM', occupancy: 1 }, { time: '08 AM', occupancy: 2 }, { time: '10 AM', occupancy: 3 },
  { time: '12 PM', occupancy: 4 }, { time: '02 PM', occupancy: 3 }, { time: '04 PM', occupancy: 5 },
  { time: '06 PM', occupancy: 4 }, { time: '08 PM', occupancy: 2 },
];

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'parking', label: 'Live parking', icon: ParkingCircle },
  { id: 'vehicles', label: 'Vehicles', icon: CarFront },
  { id: 'history', label: 'Parking history', icon: Clock3 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'devices', label: 'Devices & sensors', icon: Cpu },
];

const fmtTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const todayLabel = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();

function App() {
  const [page, setPage] = useState('overview');
  const [slots, setSlots] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartpark_slots_v2')) || initialSlots; } catch { return initialSlots; }
  });
  const [vehicles, setVehicles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartpark_vehicles_v2')) || initialVehicles; } catch { return initialVehicles; }
  });
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('smartpark_events_v2')) || initialEvents; } catch { return initialEvents; }
  });

  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(fmtTime());
  const [form, setForm] = useState({ number: '', owner: '', type: 'Car', rfid: '' });

  // Live Hardware Telemetry State
  const [hw, setHw] = useState({
    bridgeOnline: false,
    arduinoConnected: false,
    portName: 'Searching...',
    statusMessage: 'Connecting to local serial bridge...',
    entryDistance: 999,
    exitDistance: 999,
    entryGateOpen: false,
    exitGateOpen: false,
    lastRfid: 'None',
    arduinoAvailableSlots: 6,
    arduinoMaxSlots: 6,
  });

  // Keep latest state in refs for WebSocket handler
  const slotsRef = useRef(slots);
  const vehiclesRef = useRef(vehicles);
  useEffect(() => { slotsRef.current = slots; localStorage.setItem('smartpark_slots_v2', JSON.stringify(slots)); }, [slots]);
  useEffect(() => { vehiclesRef.current = vehicles; localStorage.setItem('smartpark_vehicles_v2', JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem('smartpark_events_v2', JSON.stringify(events)); }, [events]);

  // Handle vehicle entry (works for both hardware trigger and manual button)
  function handleVehicleEntry(rfidUid = '') {
    const currentSlots = slotsRef.current;
    const currentVehicles = vehiclesRef.current;

    const freeSlot = currentSlots.find((s) => s.status === 'Available');
    if (!freeSlot) {
      setToast('Parking is full — no available slot.');
      return;
    }

    // Match by scanned RFID UID first, otherwise pick first vehicle outside, or generate a visitor tag
    let matchedVehicle = rfidUid
      ? currentVehicles.find((v) => v.rfid.toUpperCase() === rfidUid.toUpperCase() && v.status === 'Outside')
      : null;

    if (!matchedVehicle) {
      matchedVehicle = currentVehicles.find((v) => v.status === 'Outside');
    }

    const vehicleNumber = matchedVehicle
      ? matchedVehicle.number
      : rfidUid
      ? `RFID-${rfidUid}`
      : `GUEST-${Math.floor(100 + Math.random() * 900)}`;

    const vehicleOwner = matchedVehicle ? matchedVehicle.owner : 'Walk-in / RFID Visitor';
    const vehicleRfid = matchedVehicle ? matchedVehicle.rfid : (rfidUid || 'SENSOR-TRIGGER');

    setSlots((prev) =>
      prev.map((s) =>
        s.id === freeSlot.id
          ? { ...s, status: 'Occupied', vehicle: vehicleNumber, owner: vehicleOwner, rfid: vehicleRfid, sensor: 12 }
          : s
      )
    );

    if (matchedVehicle) {
      setVehicles((prev) =>
        prev.map((v) => (v.id === matchedVehicle.id ? { ...v, status: 'Parked', slot: freeSlot.id } : v))
      );
    }

    setEvents((prev) => [
      { id: Date.now(), type: 'ENTRY', vehicle: vehicleNumber, slot: freeSlot.id, time: fmtTime(), date: 'Today', duration: 'Active' },
      ...prev,
    ]);

    setLastUpdate(fmtTime());
    setToast(`Entry Gate Opened: ${vehicleNumber} parked in ${freeSlot.id}`);
  }

  // Handle vehicle exit (works for both hardware trigger and manual button)
  function handleVehicleExit() {
    const currentSlots = slotsRef.current;
    const occupiedSlot = currentSlots.find((s) => s.status === 'Occupied');

    if (!occupiedSlot) {
      setToast('Exit sensor triggered, but all dashboard slots are already empty.');
      return;
    }

    const exitingVehicle = occupiedSlot.vehicle;

    setSlots((prev) =>
      prev.map((s) =>
        s.id === occupiedSlot.id
          ? { ...s, status: 'Available', vehicle: '', owner: '', rfid: '', sensor: 150 }
          : s
      )
    );

    setVehicles((prev) =>
      prev.map((v) => (v.number === exitingVehicle ? { ...v, status: 'Outside', slot: '—' } : v))
    );

    setEvents((prev) => [
      { id: Date.now(), type: 'EXIT', vehicle: exitingVehicle, slot: occupiedSlot.id, time: fmtTime(), date: 'Today', duration: 'Completed' },
      ...prev,
    ]);

    setLastUpdate(fmtTime());
    setToast(`Exit Gate Opened: ${exitingVehicle} exited from ${occupiedSlot.id}`);
  }

  // WebSocket Connection to Local Node.js Serial Bridge
  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connectWS() {
      ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        setHw((prev) => ({ ...prev, bridgeOnline: true }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastUpdate(fmtTime());

          if (data.type === 'STATUS') {
            setHw((prev) => ({
              ...prev,
              bridgeOnline: true,
              arduinoConnected: Boolean(data.connected),
              portName: data.portName || prev.portName,
              statusMessage: data.message || '',
            }));
            if (data.connected) {
              setSimRunning(false);
            }
            return;
          }

          // Any valid data packet from Arduino confirms hardware is live
          setHw((prev) => ({
            ...prev,
            bridgeOnline: true,
            arduinoConnected: true,
            portName: data.portName || prev.portName,
            entryDistance: data.entryDistance !== undefined ? data.entryDistance : prev.entryDistance,
            exitDistance: data.exitDistance !== undefined ? data.exitDistance : prev.exitDistance,
            entryGateOpen: data.entryGateOpen !== undefined ? data.entryGateOpen : prev.entryGateOpen,
            exitGateOpen: data.exitGateOpen !== undefined ? data.exitGateOpen : prev.exitGateOpen,
            lastRfid: data.uid ? data.uid : prev.lastRfid,
            arduinoAvailableSlots: data.availableSlots !== undefined ? data.availableSlots : prev.arduinoAvailableSlots,
            arduinoMaxSlots: data.maxSlots !== undefined ? data.maxSlots : prev.arduinoMaxSlots,
          }));

          if (data.type === 'RFID' && data.uid) {
            const registered = vehiclesRef.current.find((v) => v.rfid.toUpperCase() === data.uid.toUpperCase());
            setToast(
              registered
                ? `RFID Verified: ${registered.owner} (${registered.number})`
                : `New RFID Card Scanned: ${data.uid}`
            );
            // Auto-fill RFID field if Add Vehicle modal is open
            setForm((f) => ({ ...f, rfid: data.uid }));
          }

          if (data.type === 'ENTRY') {
            handleVehicleEntry(data.uid || '');
          }

          if (data.type === 'EXIT') {
            handleVehicleExit();
          }

          if (data.type === 'FULL') {
            setToast('Arduino Alert: Parking Lot Full! Entry gate kept closed.');
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };

      ws.onclose = () => {
        setHw((prev) => ({
          ...prev,
          bridgeOnline: false,
          arduinoConnected: false,
          statusMessage: 'Bridge offline. Run "node server.js" in terminal.',
        }));
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWS();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Optional Browser Simulation Mode (only when toggle is turned ON)
  useEffect(() => {
    if (!simRunning) return;
    const timer = setInterval(() => {
      setSlots((prev) =>
        prev.map((s) => ({
          ...s,
          sensor:
            s.status === 'Occupied'
              ? 16 + Math.floor(Math.random() * 12)
              : s.status === 'Reserved'
              ? 75 + Math.floor(Math.random() * 20)
              : 135 + Math.floor(Math.random() * 35),
        }))
      );
      setLastUpdate(fmtTime());
    }, 3500);
    return () => clearInterval(timer);
  }, [simRunning]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(
    () => ({
      total: slots.length,
      occupied: slots.filter((s) => s.status === 'Occupied').length,
      available: slots.filter((s) => s.status === 'Available').length,
      reserved: slots.filter((s) => s.status === 'Reserved').length,
      maintenance: slots.filter((s) => s.status === 'Maintenance').length,
    }),
    [slots]
  );

  const occupancy = Math.round((counts.occupied / Math.max(counts.total, 1)) * 100);

  function addVehicle(e) {
    e.preventDefault();
    if (!form.number.trim() || !form.owner.trim() || !form.rfid.trim()) {
      setToast('Please complete all vehicle details.');
      return;
    }
    if (
      vehicles.some(
        (v) =>
          v.number.toLowerCase() === form.number.trim().toLowerCase() ||
          v.rfid.toLowerCase() === form.rfid.trim().toLowerCase()
      )
    ) {
      setToast('Vehicle number or RFID already exists.');
      return;
    }
    setVehicles((prev) => [
      ...prev,
      {
        id: Date.now(),
        number: form.number.trim().toUpperCase(),
        owner: form.owner.trim(),
        type: form.type,
        rfid: form.rfid.trim().toUpperCase(),
        slot: '—',
        status: 'Outside',
      },
    ]);
    setForm({ number: '', owner: '', type: 'Car', rfid: '' });
    setShowAdd(false);
    setToast('Vehicle registered successfully.');
  }

  function toggleMaintenance(id) {
    const target = slots.find((s) => s.id === id);
    if (!target) return;
    if (target.status === 'Occupied' || target.status === 'Reserved') {
      setToast('Only available platforms can be moved into maintenance.');
      return;
    }
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'Maintenance' ? 'Available' : 'Maintenance', vehicle: '', owner: '', rfid: '' }
          : s
      )
    );
    setToast(`${id} status updated.`);
  }

  function resetAllSlots() {
    setSlots(initialSlots);
    setVehicles((prev) => prev.map((v) => ({ ...v, status: 'Outside', slot: '—' })));
    setToast('All 6 parking slots reset to Available.');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <ParkingCircle size={22} />
          </div>
          <div>
            <div className="brand-name">
              smart<span>park</span>
            </div>
            <div className="brand-sub">PARKING INTELLIGENCE</div>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => {
                setPage(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'devices' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card" onClick={() => setPage('devices')} style={{ cursor: 'pointer' }}>
            <div className="help-icon">
              <Cpu size={17} />
            </div>
            <div>
              <b>{hw.arduinoConnected ? `Nano (${hw.portName})` : 'Hardware Offline'}</b>
              <span>{hw.arduinoConnected ? 'Live serial active' : 'Check bridge & USB'}</span>
            </div>
            <ChevronDown size={14} />
          </div>
          <div className="profile">
            <div className="avatar">SP</div>
            <div className="profile-copy">
              <b>Project Admin</b>
              <span>Administrator</span>
            </div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span> <b>{nav.find((n) => n.id === page)?.label || 'Overview'}</b>
            </div>
          </div>
          <div className="top-actions">
            <div
              className="system-pill"
              style={{
                borderColor: hw.arduinoConnected ? 'rgba(52, 201, 161, 0.45)' : 'rgba(245, 158, 11, 0.45)',
                color: hw.arduinoConnected ? '#34c9a1' : '#fbbf24',
              }}
            >
              <span
                className="pulse"
                style={{ background: hw.arduinoConnected ? '#34c9a1' : '#fbbf24' }}
              />
              {hw.arduinoConnected
                ? `Arduino Live (${hw.portName})`
                : simRunning
                ? 'Simulation mode'
                : 'Waiting for Arduino...'}
            </div>
            <button className="icon-button" title="Reset Slots" onClick={resetAllSlots}>
              <RotateCcw size={17} />
            </button>
            <div className="top-avatar">SP</div>
          </div>
        </header>

        <div className="page-content">
          {page === 'overview' && (
            <Overview
              counts={counts}
              occupancy={occupancy}
              slots={slots}
              events={events}
              trend={trend}
              onPage={setPage}
              onEntry={() => handleVehicleEntry('')}
              onExit={handleVehicleExit}
              simRunning={simRunning}
              setSimRunning={setSimRunning}
              lastUpdate={lastUpdate}
              hw={hw}
            />
          )}
          {page === 'parking' && (
            <ParkingPage
              slots={slots}
              onMaintenance={toggleMaintenance}
              onEntry={() => handleVehicleEntry('')}
              onExit={handleVehicleExit}
              hw={hw}
            />
          )}
          {page === 'vehicles' && (
            <VehiclesPage
              vehicles={vehicles}
              query={query}
              setQuery={setQuery}
              onAdd={() => setShowAdd(true)}
              lastRfid={hw.lastRfid}
            />
          )}
          {page === 'history' && <HistoryPage events={events} query={query} setQuery={setQuery} />}
          {page === 'analytics' && <AnalyticsPage trend={trend} counts={counts} events={events} />}
          {page === 'devices' && (
            <DevicesPage
              slots={slots}
              simRunning={simRunning}
              setSimRunning={setSimRunning}
              lastUpdate={lastUpdate}
              hw={hw}
            />
          )}
        </div>
      </main>

      {showAdd && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
        >
          <form className="modal" onSubmit={addVehicle}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">VEHICLE MANAGEMENT</span>
                <h2>Register a vehicle</h2>
                <p>Tap an RFID card on your reader to auto-fill its UID.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <label>
              Vehicle registration number
              <input
                autoFocus
                placeholder="e.g. AP 39 AB 1234"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </label>
            <label>
              Owner name
              <input
                placeholder="Enter owner's full name"
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Vehicle type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Car</option>
                  <option>SUV</option>
                  <option>Bike</option>
                  <option>EV</option>
                </select>
              </label>
              <label>
                RFID UID {hw.lastRfid !== 'None' && `(Last scanned: ${hw.lastRfid})`}
                <input
                  placeholder="e.g. A4:B3:C2:D1"
                  value={form.rfid}
                  onChange={(e) => setForm({ ...form, rfid: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                <Plus size={16} /> Register vehicle
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, tone, trendValue }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        <span className="stat-detail">{detail}</span>
        {trendValue && <span className="trend-up">{trendValue}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = status.toLowerCase().replaceAll(' ', '-');
  return (
    <span className={`status-badge ${cls}`}>
      <i />
      {status}
    </span>
  );
}

function Overview({
  counts,
  occupancy,
  slots,
  events,
  trend,
  onPage,
  onEntry,
  onExit,
  simRunning,
  setSimRunning,
  lastUpdate,
  hw,
}) {
  return (
    <>
      <PageHeading
        eyebrow={todayLabel()}
        title="SmartPark Live Control"
        description="Real-time Arduino sensor telemetry, gate states, and parking slot availability."
        action={
          <div className="heading-actions">
            <button className="btn secondary" onClick={onExit}>
              <ArrowUpRight size={16} /> Test Exit
            </button>
            <button className="btn primary" onClick={onEntry}>
              <ArrowDownLeft size={16} /> Test Entry
            </button>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Total parking slots"
          value={counts.total.toString().padStart(2, '0')}
          detail="Synced with Arduino MAX_SLOTS"
          icon={ParkingCircle}
          tone="blue"
        />
        <StatCard
          label="Available spaces"
          value={counts.available.toString().padStart(2, '0')}
          detail={hw.arduinoConnected ? `Arduino LCD shows: ${hw.arduinoAvailableSlots}` : 'Ready for incoming vehicles'}
          icon={Check}
          tone="green"
          trendValue={hw.arduinoConnected ? 'Hardware Synced' : undefined}
        />
        <StatCard
          label="Occupied spaces"
          value={counts.occupied.toString().padStart(2, '0')}
          detail={`${occupancy}% current occupancy`}
          icon={CarFront}
          tone="violet"
          trendValue="Live"
        />
        <StatCard
          label="Entry / Exit Sensors"
          value={`${hw.entryDistance > 500 ? 'Clear' : hw.entryDistance + 'cm'} / ${hw.exitDistance > 500 ? 'Clear' : hw.exitDistance + 'cm'}`}
          detail={`Gates: ${hw.entryGateOpen ? 'ENTRY OPEN' : 'Entry Closed'} · ${hw.exitGateOpen ? 'EXIT OPEN' : 'Exit Closed'}`}
          icon={Activity}
          tone="amber"
        />
      </div>

      <div className="overview-grid">
        <section className="panel occupancy-panel">
          <div className="panel-head">
            <div>
              <h3>Parking occupancy</h3>
              <p>Real-time utilization across all levels</p>
            </div>
            <button className="text-button" onClick={() => onPage('parking')}>
              View layout <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="occupancy-content">
            <div className="donut-wrap">
              <div className="donut" style={{ '--progress': `${occupancy}%` }}>
                <div className="donut-center">
                  <strong>{occupancy}%</strong>
                  <span>Occupied</span>
                </div>
              </div>
              <div className="donut-caption">Facility utilization</div>
            </div>
            <div className="legend-list">
              <Legend color="green" label="Available" value={counts.available} />
              <Legend color="violet" label="Occupied" value={counts.occupied} />
              <Legend color="amber" label="Reserved" value={counts.reserved} />
              <Legend color="gray" label="Maintenance" value={counts.maintenance} />
            </div>
          </div>
          <div className="panel-divider" />
          <div className="mini-note">
            <span className="pulse" /> Updated {lastUpdate}
            <span className="note-right">
              {hw.arduinoConnected ? `Live on ${hw.portName}` : simRunning ? 'Simulation active' : 'Standby'}
            </span>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h3>Recent gate activity</h3>
              <p>Live entry & exit events from sensors</p>
            </div>
            <button className="text-button" onClick={() => onPage('history')}>
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="activity-list">
            {events.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                No vehicles have entered or exited yet. Trigger the entry sensor or click Test Entry.
              </div>
            ) : (
              events.slice(0, 4).map((ev) => (
                <div className="activity-row" key={ev.id}>
                  <div className={`activity-icon ${ev.type.toLowerCase()}`}>
                    {ev.type === 'ENTRY' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="activity-copy">
                    <b>{ev.vehicle}</b>
                    <span>{ev.type === 'ENTRY' ? `Entered · ${ev.slot}` : `Exited · ${ev.slot}`}</span>
                  </div>
                  <time>{ev.time}</time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <h3>Occupancy trends</h3>
              <p>Today's parking utilization by time</p>
            </div>
            <span className="period-chip">
              Today <ChevronDown size={13} />
            </span>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b8def" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5b8def" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#263247" />
                <XAxis dataKey="time" tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} domain={[0, 6]} tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid #2b3a50', borderRadius: 10, color: '#e8eef8' }} />
                <Area type="monotone" dataKey="occupancy" stroke="#6b9bff" strokeWidth={2.5} fill="url(#occGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-head">
            <div>
              <h3>Live Hardware Telemetry</h3>
              <p>Arduino Nano + Dual Ultrasonic + Servos + RFID</p>
            </div>
            <button className="text-button" onClick={() => onPage('devices')}>
              Details <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="system-list">
            <SystemLine
              icon={Cpu}
              label="Arduino Nano"
              value={hw.arduinoConnected ? `Connected (${hw.portName})` : 'Disconnected'}
              state={hw.arduinoConnected ? 'online' : 'sim'}
            />
            <SystemLine
              icon={Radio}
              label="Last RFID Tag"
              value={hw.lastRfid}
              state={hw.arduinoConnected ? 'online' : 'sim'}
            />
            <SystemLine
              icon={Activity}
              label="Entry / Exit Ultrasonic"
              value={`${hw.entryDistance > 500 ? 'Clear' : hw.entryDistance + ' cm'} / ${hw.exitDistance > 500 ? 'Clear' : hw.exitDistance + ' cm'}`}
              state={hw.arduinoConnected ? 'online' : 'sim'}
            />
            <SystemLine
              icon={Zap}
              label="Entry / Exit Servos"
              value={`${hw.entryGateOpen ? 'OPEN (90°)' : 'Closed (0°)'} / ${hw.exitGateOpen ? 'OPEN (90°)' : 'Closed (0°)'}`}
              state={hw.arduinoConnected ? 'online' : 'sim'}
            />
          </div>
          <div className="simulation-banner">
            <div>
              <b>{hw.arduinoConnected ? 'Live Hardware Mode' : 'Fallback Simulation'}</b>
              <span>{hw.arduinoConnected ? 'Receiving real-time serial data' : hw.statusMessage}</span>
            </div>
            <button
              className={`switch ${simRunning ? 'on' : ''}`}
              onClick={() => setSimRunning(!simRunning)}
              aria-label="Toggle simulation"
            >
              <i />
            </button>
          </div>
        </section>
      </div>

      <section className="panel slots-preview">
        <div className="panel-head">
          <div>
            <h3>Parking layout</h3>
            <p>Six vertical platforms · Automatically updates on Entry/Exit sensor trigger</p>
          </div>
          <button className="text-button" onClick={() => onPage('parking')}>
            Full layout <ArrowUpRight size={14} />
          </button>
        </div>
        <SlotGrid slots={slots.slice(0, 6)} compact />
      </section>
    </>
  );
}

function Legend({ color, label, value }) {
  return (
    <div className="legend-row">
      <span className={`legend-dot ${color}`} />
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function SystemLine({ icon: Icon, label, value, state }) {
  return (
    <div className="system-line">
      <div className="system-line-icon">
        <Icon size={16} />
      </div>
      <span>{label}</span>
      <b>{value}</b>
      <i className={`health-dot ${state}`} />
    </div>
  );
}

function SlotGrid({ slots, compact = false, onMaintenance }) {
  return (
    <div className={`slot-grid ${compact ? 'compact' : ''}`}>
      {slots.map((s) => (
        <div className={`slot-card ${s.status.toLowerCase()}`} key={s.id}>
          <div className="slot-card-top">
            <span className="slot-id">{s.id}</span>
            <StatusBadge status={s.status} />
          </div>
          <div className="slot-visual">
            <div className="slot-platform">
              <div className="car-shape">
                <div className="car-window" />
                <div className="car-wheel left" />
                <div className="car-wheel right" />
              </div>
              <div className="platform-line" />
            </div>
          </div>
          <div className="slot-card-bottom">
            <div>
              <b>
                {s.vehicle ||
                  (s.status === 'Reserved'
                    ? 'Reservation held'
                    : s.status === 'Maintenance'
                    ? 'Service required'
                    : 'Ready for vehicle')}
              </b>
              <span>
                {s.level} · {s.status === 'Occupied' ? 'Vehicle Parked' : 'Slot Empty'}
              </span>
            </div>
            {onMaintenance && (
              <button className="tiny-action" onClick={() => onMaintenance(s.id)} title="Toggle maintenance">
                <SlidersHorizontal size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ParkingPage({ slots, onMaintenance, onEntry, onExit, hw }) {
  return (
    <>
      <PageHeading
        eyebrow="FACILITY MONITORING"
        title="Live parking layout"
        description="Monitor all six vertical parking platforms and gate sensor triggers in real time."
        action={
          <div className="heading-actions">
            <button className="btn secondary" onClick={onExit}>
              <ArrowUpRight size={16} /> Test Exit
            </button>
            <button className="btn primary" onClick={onEntry}>
              <ArrowDownLeft size={16} /> Test Entry
            </button>
          </div>
        }
      />
      <div className="parking-summary">
        <div>
          <span>Available</span>
          <b className="green-text">{slots.filter((s) => s.status === 'Available').length}</b>
        </div>
        <div>
          <span>Occupied</span>
          <b className="violet-text">{slots.filter((s) => s.status === 'Occupied').length}</b>
        </div>
        <div>
          <span>Entry Gate</span>
          <b className="amber-text">{hw.entryGateOpen ? 'OPEN' : 'CLOSED'}</b>
        </div>
        <div>
          <span>Exit Gate</span>
          <b className="amber-text">{hw.exitGateOpen ? 'OPEN' : 'CLOSED'}</b>
        </div>
      </div>
      <section className="panel parking-layout-panel">
        <div className="panel-head">
          <div>
            <h3>Vertical parking structure</h3>
            <p>Front elevation · Live updates from Entry & Exit Ultrasonic gates</p>
          </div>
          <span className="live-tag">
            <i className="pulse" /> {hw.arduinoConnected ? 'LIVE HARDWARE' : 'STANDBY'}
          </span>
        </div>
        <SlotGrid slots={slots} onMaintenance={onMaintenance} />
        <div className="layout-foot">
          <span>
            <i className="legend-dot green" /> Available
          </span>
          <span>
            <i className="legend-dot violet" /> Occupied
          </span>
          <span>
            <i className="legend-dot amber" /> Reserved
          </span>
          <span>
            <i className="legend-dot gray" /> Maintenance
          </span>
          <small>Tip: use the sliders icon on a platform to toggle maintenance status.</small>
        </div>
      </section>
    </>
  );
}

function VehiclesPage({ vehicles, query, setQuery, onAdd, lastRfid }) {
  const filtered = vehicles.filter((v) =>
    [v.number, v.owner, v.rfid, v.type].join(' ').toLowerCase().includes(query.toLowerCase())
  );
  return (
    <>
      <PageHeading
        eyebrow="VEHICLE DIRECTORY"
        title="Registered vehicles"
        description={`Manage vehicle profiles and RFID credentials. Last scanned tag: ${lastRfid}`}
        action={
          <button className="btn primary" onClick={onAdd}>
            <Plus size={16} /> Add vehicle
          </button>
        }
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <h3>
              All vehicles <span className="count-chip">{vehicles.length}</span>
            </h3>
            <p>Associate an RFID card UID to auto-identify vehicles at the gate</p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search vehicle, owner or RFID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>VEHICLE</th>
                <th>OWNER</th>
                <th>TYPE</th>
                <th>RFID UID</th>
                <th>ASSIGNED SLOT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="vehicle-cell">
                      <div className="vehicle-icon">
                        <CarFront size={17} />
                      </div>
                      <b>{v.number}</b>
                    </div>
                  </td>
                  <td>{v.owner}</td>
                  <td>
                    <span className="type-chip">{v.type}</span>
                  </td>
                  <td>
                    <code>{v.rfid}</code>
                  </td>
                  <td>
                    <b className="slot-cell">{v.slot}</b>
                  </td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No vehicles match your search.</div>}
        </div>
        <div className="table-foot">
          Showing {filtered.length} of {vehicles.length} registered vehicles
        </div>
      </section>
    </>
  );
}

function HistoryPage({ events, query, setQuery }) {
  const filtered = events.filter((e) =>
    [e.vehicle, e.slot, e.type, e.date].join(' ').toLowerCase().includes(query.toLowerCase())
  );
  return (
    <>
      <PageHeading
        eyebrow="ACTIVITY LOG"
        title="Parking history"
        description="Chronological log of all Entry and Exit gate events triggered by your hardware."
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div>
            <h3>
              All activity <span className="count-chip">{events.length}</span>
            </h3>
            <p>Live gate entry and exit timestamps</p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Search vehicle or slot..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EVENT</th>
                <th>VEHICLE / TAG</th>
                <th>PARKING SLOT</th>
                <th>TIME</th>
                <th>DATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className={`event-label ${e.type.toLowerCase()}`}>{e.type}</span>
                  </td>
                  <td>
                    <b>{e.vehicle}</b>
                  </td>
                  <td>{e.slot}</td>
                  <td>{e.time}</td>
                  <td>{e.date}</td>
                  <td>{e.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">No activity recorded yet.</div>}
        </div>
        <div className="table-foot">Real-time activity log saved locally in browser.</div>
      </section>
    </>
  );
}

function AnalyticsPage({ trend, counts, events }) {
  const entries = events.filter((e) => e.type === 'ENTRY').length;
  const exits = events.filter((e) => e.type === 'EXIT').length;
  const chart = [
    { day: 'Mon', entries: 3, exits: 2 },
    { day: 'Tue', entries: 5, exits: 4 },
    { day: 'Wed', entries: 4, exits: 3 },
    { day: 'Thu', entries: 6, exits: 5 },
    { day: 'Fri', entries: 7, exits: 4 },
    { day: 'Sat', entries: 3, exits: 3 },
    { day: 'Sun', entries: entries, exits: exits },
  ];
  return (
    <>
      <PageHeading
        eyebrow="PARKING INSIGHTS"
        title="Analytics & reports"
        description="Understand occupancy, vehicle movement and facility utilization."
        action={
          <span className="period-chip">
            Live Session <ChevronDown size={13} />
          </span>
        }
      />
      <div className="stat-grid analytics-stats">
        <StatCard
          label="Current occupancy"
          value={`${Math.round((counts.occupied / counts.total) * 100)}%`}
          detail={`${counts.occupied} of ${counts.total} platforms`}
          icon={Gauge}
          tone="blue"
        />
        <StatCard label="Recorded entries" value={entries} detail="Live sensor triggers" icon={ArrowDownLeft} tone="green" />
        <StatCard label="Recorded exits" value={exits} detail="Live sensor triggers" icon={ArrowUpRight} tone="violet" />
        <StatCard label="Total movements" value={entries + exits} detail="Entries + exits" icon={Activity} tone="amber" />
      </div>
      <div className="overview-grid analytics-grid">
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <h3>Daily vehicle movements</h3>
              <p>Weekly entry and exit distribution (Sun reflects live session)</p>
            </div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#263247" />
                <XAxis dataKey="day" tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid #2b3a50', borderRadius: 10, color: '#e8eef8' }} />
                <Bar dataKey="entries" fill="#6b9bff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exits" fill="#34c9a1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot blue" /> Entries
            </span>
            <span>
              <i className="legend-dot green" /> Exits
            </span>
          </div>
        </section>
        <section className="panel trend-panel">
          <div className="panel-head">
            <div>
              <h3>Utilization by time</h3>
              <p>Typical occupancy pattern</p>
            </div>
          </div>
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34c9a1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#34c9a1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#263247" />
                <XAxis dataKey="time" tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#8290a6', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111c2d', border: '1px solid #2b3a50', borderRadius: 10, color: '#e8eef8' }} />
                <Area type="monotone" dataKey="occupancy" stroke="#34c9a1" strokeWidth={2.5} fill="url(#analyticsGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  );
}

function DevicesPage({ slots, simRunning, setSimRunning, lastUpdate, hw }) {
  return (
    <>
      <PageHeading
        eyebrow="HARDWARE MONITORING"
        title="Devices & sensors"
        description="Live serial connection status, ultrasonic distances, servo states, and RFID reader telemetry."
        action={
          <button
            className={`btn ${simRunning ? 'secondary' : 'primary'}`}
            onClick={() => setSimRunning(!simRunning)}
          >
            {simRunning ? 'Pause fallback simulation' : 'Enable fallback simulation'}
          </button>
        }
      />

      <div
        className="device-banner"
        style={{
          borderColor: hw.arduinoConnected ? 'rgba(52, 201, 161, 0.4)' : undefined,
        }}
      >
        <div className="device-banner-icon">
          {hw.arduinoConnected ? <Wifi size={24} color="#34c9a1" /> : <WifiOff size={24} />}
        </div>
        <div>
          <b>{hw.arduinoConnected ? `Arduino Connected on ${hw.portName}` : 'Arduino Not Connected'}</b>
          <span>{hw.statusMessage}</span>
        </div>
        <span className="mode-badge">{hw.arduinoConnected ? 'LIVE HARDWARE' : 'OFFLINE'}</span>
      </div>

      <div className="device-grid">
        <DeviceCard
          icon={Cpu}
          name="Arduino Nano Gateway"
          detail={`USB Serial · ${hw.portName} @ 9600 baud`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Central controller managing entry/exit ultrasonic sensors, servos, LCD, and RFID."
        />
        <DeviceCard
          icon={Radio}
          name="RFID Reader (RC522)"
          detail={`SPI Bus · Last UID: ${hw.lastRfid}`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Scans vehicle RFID tags and forwards card UIDs to the dashboard."
        />
        <DeviceCard
          icon={Activity}
          name="Entry Ultrasonic (HC-SR04)"
          detail={`Pins 2 & 3 · Distance: ${hw.entryDistance > 500 ? 'Clear (>15cm)' : hw.entryDistance + ' cm'}`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Detects incoming vehicles within 15 cm and triggers entry gate."
        />
        <DeviceCard
          icon={Activity}
          name="Exit Ultrasonic (HC-SR04)"
          detail={`Pins 4 & 5 · Distance: ${hw.exitDistance > 500 ? 'Clear (>15cm)' : hw.exitDistance + ' cm'}`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Detects departing vehicles within 15 cm and frees parking slot."
        />
        <DeviceCard
          icon={Zap}
          name="Entry Gate Servo"
          detail={`Pin 6 · State: ${hw.entryGateOpen ? 'OPEN (90°)' : 'CLOSED (0°)'}`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Opens entry barrier for 3 seconds when a vehicle arrives and slots are available."
        />
        <DeviceCard
          icon={Zap}
          name="Exit Gate Servo"
          detail={`Pin 7 · State: ${hw.exitGateOpen ? 'OPEN (90°)' : 'CLOSED (0°)'}`}
          state={hw.arduinoConnected ? 'Online' : 'Not connected'}
          description="Opens exit barrier for 3 seconds when a departing vehicle is detected."
        />
      </div>

      <section className="panel sensor-panel">
        <div className="panel-head">
          <div>
            <h3>Live Gate & Slot Telemetry</h3>
            <p>Real-time readings from Arduino hardware</p>
          </div>
          <span className="last-update">Last packet {lastUpdate}</span>
        </div>
        <div className="sensor-table">
          <div className="sensor-row">
            <div>
              <b>ENTRY GATE</b>
              <span>HC-SR04 (Trig 2, Echo 3)</span>
            </div>
            <div className="sensor-meter">
              <i style={{ width: `${Math.min(100, hw.entryDistance > 200 ? 100 : hw.entryDistance / 2)}%` }} />
            </div>
            <b>
              {hw.entryDistance > 500 ? 'Clear' : hw.entryDistance} <small>{hw.entryDistance > 500 ? '' : 'cm'}</small>
            </b>
            <StatusBadge status={hw.entryGateOpen ? 'Occupied' : 'Available'} />
          </div>
          <div className="sensor-row">
            <div>
              <b>EXIT GATE</b>
              <span>HC-SR04 (Trig 4, Echo 5)</span>
            </div>
            <div className="sensor-meter">
              <i style={{ width: `${Math.min(100, hw.exitDistance > 200 ? 100 : hw.exitDistance / 2)}%` }} />
            </div>
            <b>
              {hw.exitDistance > 500 ? 'Clear' : hw.exitDistance} <small>{hw.exitDistance > 500 ? '' : 'cm'}</small>
            </b>
            <StatusBadge status={hw.exitGateOpen ? 'Occupied' : 'Available'} />
          </div>
        </div>
      </section>
    </>
  );
}

function DeviceCard({ icon: Icon, name, detail, state, description }) {
  return (
    <div className="device-card">
      <div className="device-card-top">
        <div className="device-icon">
          <Icon size={19} />
        </div>
        <StatusBadge status={state} />
      </div>
      <h3>{name}</h3>
      <span className="device-detail">{detail}</span>
      <p>{description}</p>
    </div>
  );
}

export default App;
