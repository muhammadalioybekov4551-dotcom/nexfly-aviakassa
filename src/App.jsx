import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plane, Calendar, Users, ArrowRightLeft, Search, ChevronRight, Clock, Luggage, Check, CreditCard, ArrowLeft, MapPin } from "lucide-react";

const AIRPORTS = [
  { code: "TAS", city: "Toshkent", country: "O'zbekiston" },
  { code: "SKD", city: "Samarqand", country: "O'zbekiston" },
  { code: "BHK", city: "Buxoro", country: "O'zbekiston" },
  { code: "FEG", city: "Farg'ona", country: "O'zbekiston" },
  { code: "AZN", city: "Andijon", country: "O'zbekiston" },
  { code: "NMA", city: "Namangan", country: "O'zbekiston" },
  { code: "UGC", city: "Urganch", country: "O'zbekiston" },
  { code: "IST", city: "Istanbul", country: "Turkiya" },
  { code: "AYT", city: "Antalya", country: "Turkiya" },
  { code: "DXB", city: "Dubay", country: "BAA" },
  { code: "AUH", city: "Abu-Dabi", country: "BAA" },
  { code: "MOW", city: "Moskva", country: "Rossiya" },
  { code: "LED", city: "Sankt-Peterburg", country: "Rossiya" },
  { code: "ICN", city: "Seul", country: "Janubiy Koreya" },
  { code: "PEK", city: "Pekin", country: "Xitoy" },
  { code: "LHR", city: "London", country: "Buyuk Britaniya" },
  { code: "CDG", city: "Parij", country: "Fransiya" },
  { code: "FRA", city: "Frankfurt", country: "Germaniya" },
  { code: "JFK", city: "Nyu-York", country: "AQSH" },
  { code: "DEL", city: "Dehli", country: "Hindiston" },
  { code: "ALA", city: "Almati", country: "Qozog'iston" },
  { code: "TSE", city: "Ostona", country: "Qozog'iston" },
  { code: "BKK", city: "Bangkok", country: "Tailand" },
  { code: "KUL", city: "Kuala-Lumpur", country: "Malayziya" },
];

const AIRLINES = [
  { name: "Uzbekistan Airways", code: "HY" },
  { name: "Turkish Airlines", code: "TK" },
  { name: "Qanot Sharq", code: "HH" },
  { name: "Emirates", code: "EK" },
  { name: "Air Astana", code: "KC" },
  { name: "Aeroflot", code: "SU" },
];

// ==== TRAVELPAYOUTS INTEGRATSIYASI ====
// Diqqat: bu ochiq (client-side) ishlatish uchun mo'ljallangan affiliate token.
const TP_TOKEN = "635411d6a00a0df3158645f4bd9f546b";

// Sizning shaxsiy hamkorlik (affiliate) ma'lumotlaringiz:
const TP_CAMPAIGN_ID = "100";
const TP_MARKER = "761885";
const TP_P = "4114";
const TP_TRS = "559985";

// Har qanday havolani sizning hamkorlik ID'ingiz orqali o'tkazadi.
// Foydalanuvchi shu havolani bosganda sotuv sizga bog'lanadi.
function trackedLink(destinationUrl) {
  const params = new URLSearchParams({
    campaign_id: TP_CAMPAIGN_ID,
    marker: TP_MARKER,
    p: TP_P,
    trs: TP_TRS,
    u: destinationUrl,
  });
  return `https://tp.media/r?${params.toString()}`;
}

function airlineFullName(code) {
  return AIRLINES.find((a) => a.code === code)?.name || code;
}

// Travelpayouts "prices_for_dates" API orqali haqiqiy (keshlangan) narxlarni oladi.
async function fetchRealFlights(origin, destination, depDate) {
  const url = `/api/prices?origin=${origin}&destination=${destination}&departure_at=${depDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("API xatosi: " + res.status);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error("Bu yo'nalish bo'yicha ma'lumot topilmadi");
  }
  return json.data.map((d, i) => {
    const dep = new Date(d.departure_at);
    const durMin = d.duration || 120;
    const arrDate = new Date(dep.getTime() + durMin * 60000);
    const destinationUrl = `https://www.aviasales.com${d.link || "/search"}`;
    return {
      id: `${origin}${destination}${depDate}${i}`,
      airline: airlineFullName(d.airline),
      code: d.airline,
      flightNo: d.flight_number ? `${d.airline}${d.flight_number}` : `${d.airline}${100 + i}`,
      dep: dep.toISOString().slice(11, 16),
      arr: arrDate.toISOString().slice(11, 16),
      durMin,
      stops: d.transfers || 0,
      price: Math.round(d.price * 12700), // taxminiy USD -> so'm kursi
      baggage: "Aviakompaniyaga qarab",
      real: true,
      link: trackedLink(destinationUrl),
    };
  });
}

// Aviasales umumiy qidiruv sahifasiga hamkorlik havolasi orqali o'tkazish (zaxira variant)
function aviasalesSearchLink(origin, destination, depDate, retDate, passengers) {
  const fmt = (iso) => iso.slice(8, 10) + iso.slice(5, 7);
  let path = `${origin}${fmt(depDate)}${destination}`;
  if (retDate) path += fmt(retDate);
  path += String(passengers || 1);
  return trackedLink(`https://www.aviasales.com/search/${path}`);
}

function seedFlights(from, to, salt) {
  const key = from + to + salt;
  const base = 850000 + Math.abs(hashCode(key)) % 4000000;
  return Array.from({ length: 6 }).map((_, i) => {
    const airline = AIRLINES[(hashCode(key + i) >>> 0) % AIRLINES.length];
    const depHour = 4 + ((i * 3) % 19);
    const durMin = 90 + ((hashCode(key + i * 7) >>> 0) % 600);
    const arrTotalMin = depHour * 60 + durMin;
    const arrHour = Math.floor(arrTotalMin / 60) % 24;
    const arrMin = arrTotalMin % 60;
    const stops = durMin > 420 ? (i % 3 === 0 ? 0 : 1) : i % 4 === 0 ? 1 : 0;
    const price = Math.round((base + i * 137000 + (stops === 0 ? 400000 : 0)) / 1000) * 1000;
    return {
      id: `${key}${i}`,
      airline: airline.name,
      code: airline.code,
      flightNo: `${airline.code}${100 + ((hashCode(key + i) >>> 0) % 800)}`,
      dep: `${String(depHour).padStart(2, "0")}:00`,
      arr: `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`,
      durMin,
      stops,
      price,
      baggage: i % 2 === 0 ? "23 kg" : "10 kg (qo'l yuki)",
    };
  }).sort((a, b) => a.price - b.price);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function fmtPrice(n) {
  return n.toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
}

function fmtDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} soat ${m ? m + " daq" : ""}`.trim();
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function airportLabel(a) {
  return `${a.city} (${a.code}), ${a.country}`;
}

function CityAutocomplete({ value, onChange, exclude, label }) {
  const current = AIRPORTS.find((a) => a.code === value);
  const [query, setQuery] = useState(current ? airportLabel(current) : "");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const c = AIRPORTS.find((a) => a.code === value);
    if (c) setQuery(airportLabel(c));
  }, [value]);

  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AIRPORTS.filter((a) => a.code !== exclude).slice(0, 6);
    return AIRPORTS
      .filter((a) => a.code !== exclude)
      .filter((a) => a.city.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, exclude]);

  return (
    <div className="relative" ref={boxRef}>
      <span className="text-white/50 text-xs mb-1.5 flex items-center gap-1"><MapPin size={12} />{label}</span>
      <input
        className="field-select"
        value={query}
        placeholder="Shahar yoki davlat yozing..."
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl overflow-hidden shadow-xl" style={{ background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {matches.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => { onChange(a.code); setQuery(airportLabel(a)); setOpen(false); }}
              className="w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-white/5 transition"
            >
              <span className="text-white text-sm">{a.city} <span className="text-white/40">, {a.country}</span></span>
              <span className="mono text-xs text-white/40">{a.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState("search");
  const [tripType, setTripType] = useState("oneway");
  const [from, setFrom] = useState("TAS");
  const [to, setTo] = useState("IST");
  const [date, setDate] = useState(todayPlus(14));
  const [returnDate, setReturnDate] = useState(todayPlus(21));
  const [passengers, setPassengers] = useState(1);
  const [sortBy, setSortBy] = useState("price");
  const [leg, setLeg] = useState("outbound");
  const [selectedOut, setSelectedOut] = useState(null);
  const [selectedRet, setSelectedRet] = useState(null);
  const [passengerForm, setPassengerForm] = useState({ name: "", passport: "", phone: "" });
  const [flip, setFlip] = useState(false);

  const [outboundResults, setOutboundResults] = useState([]);
  const [returnResults, setReturnResults] = useState([]);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const activeResults = leg === "outbound" ? outboundResults : returnResults;

  useEffect(() => {
    if (step !== "results") return;
    let cancelled = false;
    setLoadingFlights(true);
    setUsingFallback(false);

    async function load() {
      try {
        const out = await fetchRealFlights(from, to, date);
        if (cancelled) return;
        setOutboundResults(out);
      } catch (e) {
        if (cancelled) return;
        setUsingFallback(true);
        setOutboundResults(seedFlights(from, to, "out"));
      }

      if (tripType === "roundtrip") {
        try {
          const ret = await fetchRealFlights(to, from, returnDate);
          if (cancelled) return;
          setReturnResults(ret);
        } catch (e) {
          if (cancelled) return;
          setUsingFallback(true);
          setReturnResults(seedFlights(to, from, "ret"));
        }
      }
      if (!cancelled) setLoadingFlights(false);
    }
    load();
    return () => { cancelled = true; };
  }, [step, from, to, date, returnDate, tripType]);

  const sorted = useMemo(() => {
    const copy = [...activeResults];
    if (sortBy === "price") copy.sort((a, b) => a.price - b.price);
    if (sortBy === "duration") copy.sort((a, b) => a.durMin - b.durMin);
    if (sortBy === "dep") copy.sort((a, b) => a.dep.localeCompare(b.dep));
    return copy;
  }, [activeResults, sortBy]);

  const totalPrice = (selectedOut?.price || 0) * passengers + (tripType === "roundtrip" ? (selectedRet?.price || 0) * passengers : 0);

  function doSearch() {
    setFlip(true);
    setLeg("outbound");
    setStep("results");
    setTimeout(() => setFlip(false), 900);
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function pickFlight(f) {
    if (leg === "outbound") {
      setSelectedOut(f);
      if (tripType === "roundtrip") {
        setLeg("return");
        setFlip(true);
        setTimeout(() => setFlip(false), 900);
      } else {
        setStep("passengers");
      }
    } else {
      setSelectedRet(f);
      setStep("passengers");
    }
  }

  const cityName = (code) => AIRPORTS.find((a) => a.code === code)?.city || code;

  return (
    <div style={{ "--navy": "#0B1E3D", "--navy-2": "#132A52", "--amber": "#F2A93B", "--amber-2": "#FFC966", "--cream": "#F6F4EF", "--ink": "#0B1E3D", "--teal": "#3FA5A0" }}
      className="min-h-screen w-full" >
      <style>{`
        @keyframes flap {
          0% { opacity: 0; transform: translateY(-6px) scaleY(0.4); }
          60% { opacity: 1; transform: translateY(1px) scaleY(1.05); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        .flap-row { animation: flap 0.5s ease-out both; }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace; }
        .display { font-family: 'Manrope', ui-sans-serif, system-ui; }
        .field-select {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 12px;
          color: white;
          font-size: 14px;
          outline: none;
        }
        .field-select:focus { border-color: var(--amber); }
        .field-select option { background: var(--navy); color: white; }
      `}</style>

      <div className="min-h-screen" style={{ background: "var(--navy)" }}>
        <header className="flex items-center justify-between px-6 sm:px-10 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--amber)" }}>
              <Plane size={16} color="var(--navy)" strokeWidth={2.5} />
            </div>
            <span className="display text-white text-lg font-bold tracking-tight">PARVOZ</span>
          </div>
          {step !== "search" && (
            <button
              onClick={() => {
                if (step === "results" && leg === "return") { setLeg("outbound"); return; }
                if (step === "passengers") { setStep("results"); setLeg(tripType === "roundtrip" ? "return" : "outbound"); return; }
                if (step === "payment") { setStep("passengers"); return; }
                setStep(step === "results" ? "search" : "results");
              }}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
            >
              <ArrowLeft size={15} /> Orqaga
            </button>
          )}
        </header>

        {step === "search" && (
          <div className="px-6 sm:px-10 py-16 sm:py-24 max-w-3xl mx-auto">
            <p className="mono text-xs tracking-[0.3em] mb-3" style={{ color: "var(--amber)" }}>
              XALQARO VA ICHKI PARVOZLAR
            </p>
            <h1 className="display text-4xl sm:text-5xl font-bold text-white leading-[1.05] mb-6">
              Chiptangizni <span style={{ color: "var(--amber)" }}>toping</span>.
            </h1>

            <div className="flex gap-1.5 rounded-lg p-1 w-fit mb-6" style={{ background: "var(--navy-2)" }}>
              {[["oneway", "Bir tomonlama"], ["roundtrip", "Borib-kelish"]].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTripType(k)}
                  className="px-4 py-2 rounded-md text-sm font-medium transition"
                  style={tripType === k ? { background: "var(--amber)", color: "var(--navy)" } : { color: "rgba(255,255,255,0.6)" }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl p-5 sm:p-6" style={{ background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-start">
                <CityAutocomplete label="Qayerdan" value={from} onChange={setFrom} exclude={to} />
                <button
                  onClick={swap}
                  className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center mt-6 shrink-0 transition hover:rotate-180 duration-300"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  aria-label="Almashtirish"
                >
                  <ArrowRightLeft size={15} color="white" />
                </button>
                <CityAutocomplete label="Qayerga" value={to} onChange={setTo} exclude={from} />
              </div>

              <div className={`grid gap-3 mt-3 ${tripType === "roundtrip" ? "grid-cols-2" : "grid-cols-2"}`}>
                <Field label="Jo'nash sanasi" icon={<Calendar size={13} />}>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-select" />
                </Field>
                {tripType === "roundtrip" ? (
                  <Field label="Qaytish sanasi" icon={<Calendar size={13} />}>
                    <input type="date" value={returnDate} min={date} onChange={(e) => setReturnDate(e.target.value)} className="field-select" />
                  </Field>
                ) : (
                  <Field label="Yo'lovchilar" icon={<Users size={13} />}>
                    <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="field-select">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} kishi</option>)}
                    </select>
                  </Field>
                )}
              </div>
              {tripType === "roundtrip" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Yo'lovchilar" icon={<Users size={13} />}>
                    <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="field-select">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} kishi</option>)}
                    </select>
                  </Field>
                  <div />
                </div>
              )}

              <button
                onClick={doSearch}
                disabled={from === to}
                className="mt-5 w-full rounded-xl py-3.5 flex items-center justify-center gap-2 font-semibold display transition disabled:opacity-40"
                style={{ background: "var(--amber)", color: "var(--navy)" }}
              >
                <Search size={17} strokeWidth={2.5} /> Chiptalarni qidirish
              </button>
              {from === to && <p className="text-red-300 text-xs mt-2">Jo'nash va borish shaharlari bir xil bo'lmasligi kerak.</p>}
            </div>

            <p className="text-white/40 text-xs mt-6 mono">
              * Namunaviy narxlar. Haqiqiy parvoz ma'lumotlari uchun API ulanishi kerak.
            </p>
          </div>
        )}

        {step === "results" && (
          <div className="px-6 sm:px-10 py-8 max-w-4xl mx-auto">
            {tripType === "roundtrip" && (
              <div className="flex gap-2 mb-5">
                <LegPill active={leg === "outbound"} done={!!selectedOut} label={`${cityName(from)} → ${cityName(to)}`} onClick={() => selectedOut && setLeg("outbound")} />
                <LegPill active={leg === "return"} done={!!selectedRet} label={`${cityName(to)} → ${cityName(from)}`} onClick={() => selectedOut && setLeg("return")} />
              </div>
            )}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="display text-white text-xl font-bold">
                  {leg === "outbound" ? `${cityName(from)} → ${cityName(to)}` : `${cityName(to)} → ${cityName(from)}`}
                </h2>
                <p className="text-white/50 text-sm mono mt-0.5">{leg === "outbound" ? date : returnDate} · {passengers} yo'lovchi</p>
              </div>
              <div className="flex items-center gap-3">
                {loadingFlights && <span className="text-white/50 text-xs mono">Yuklanmoqda...</span>}
                {!loadingFlights && usingFallback && (
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(255,80,80,0.12)", color: "#ff9a9a" }}>
                    Namunaviy narxlar (API javob bermadi)
                  </span>
                )}
                {!loadingFlights && !usingFallback && (
                  <span className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(63,165,160,0.15)", color: "var(--teal)" }}>
                    Travelpayouts orqali real narxlar
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 rounded-lg p-1" style={{ background: "var(--navy-2)" }}>
                {[["price", "Narx"], ["duration", "Davomiylik"], ["dep", "Jo'nash"]].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition"
                    style={sortBy === k ? { background: "var(--amber)", color: "var(--navy)" } : { color: "rgba(255,255,255,0.6)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {sorted.map((f, i) => (
                <div key={f.id} className={flip ? "flap-row" : ""} style={{ animationDelay: flip ? `${i * 60}ms` : "0ms" }}>
                  <button
                    onClick={() => pickFlight(f)}
                    className="w-full text-left rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 transition hover:brightness-110"
                    style={{ background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                      <div className="hidden sm:block">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(242,169,59,0.15)" }}>
                          <Plane size={15} color="var(--amber)" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white/50 text-xs mono mb-0.5">{f.airline} · {f.flightNo}</p>
                        <div className="flex items-center gap-2 sm:gap-3 mono">
                          <span className="text-white text-lg font-semibold">{f.dep}</span>
                          <div className="flex-1 flex items-center gap-1 text-white/30 w-10 sm:w-16">
                            <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.2)" }} />
                            <Plane size={10} />
                          </div>
                          <span className="text-white text-lg font-semibold">{f.arr}</span>
                        </div>
                        <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                          <Clock size={11} /> {fmtDur(f.durMin)} · {f.stops === 0 ? "To'g'ridan-to'g'ri" : `${f.stops} ta qo'nish`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="display text-white font-bold text-lg sm:text-xl">{fmtPrice(f.price)}</p>
                      <p className="text-white/40 text-xs flex items-center justify-end gap-1 mt-0.5"><Luggage size={11} /> {f.baggage}</p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.3)" className="hidden sm:block shrink-0" />
                  </button>
                  {f.real && (
                    <a
                      href={f.link || aviasalesSearchLink(from, to, date, tripType === "roundtrip" ? returnDate : null, passengers)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="block text-center text-xs mt-1.5 py-2 rounded-lg transition hover:bg-white/5"
                      style={{ color: "var(--amber)", border: "1px solid rgba(242,169,59,0.3)" }}
                    >
                      Aviasales'da haqiqiy narxni ko'rish va band qilish ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "passengers" && selectedOut && (
          <div className="px-6 sm:px-10 py-8 max-w-lg mx-auto">
            <h2 className="display text-white text-xl font-bold mb-1">Yo'lovchi ma'lumotlari</h2>
            <p className="text-white/50 text-sm mb-6">
              {cityName(from)} → {cityName(to)}{tripType === "roundtrip" ? ` → ${cityName(from)}` : ""} · {selectedOut.flightNo}{selectedRet ? ` / ${selectedRet.flightNo}` : ""}
            </p>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Field label="To'liq ism">
                <input className="field-select" placeholder="Familiya Ism" value={passengerForm.name} onChange={(e) => setPassengerForm({ ...passengerForm, name: e.target.value })} />
              </Field>
              <Field label="Passport raqami">
                <input className="field-select" placeholder="AB1234567" value={passengerForm.passport} onChange={(e) => setPassengerForm({ ...passengerForm, passport: e.target.value })} />
              </Field>
              <Field label="Telefon">
                <input className="field-select" placeholder="+998 90 123 45 67" value={passengerForm.phone} onChange={(e) => setPassengerForm({ ...passengerForm, phone: e.target.value })} />
              </Field>
            </div>

            <div className="rounded-2xl p-5 mt-4 flex items-center justify-between" style={{ background: "rgba(242,169,59,0.1)", border: "1px solid rgba(242,169,59,0.25)" }}>
              <span className="text-white/70 text-sm">Jami to'lov</span>
              <span className="display text-white font-bold text-xl">{fmtPrice(totalPrice)}</span>
            </div>

            <button
              onClick={() => setStep("payment")}
              disabled={!passengerForm.name || !passengerForm.passport || !passengerForm.phone}
              className="mt-5 w-full rounded-xl py-3.5 font-semibold display transition disabled:opacity-40"
              style={{ background: "var(--amber)", color: "var(--navy)" }}
            >
              Davom etish
            </button>
          </div>
        )}

        {step === "payment" && selectedOut && (
          <div className="px-6 sm:px-10 py-8 max-w-lg mx-auto">
            <h2 className="display text-white text-xl font-bold mb-1">To'lov</h2>
            <p className="text-white/50 text-sm mb-6">Xavfsiz to'lov (namuna)</p>

            <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--navy-2)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex gap-2">
                {["Payme", "Click", "Karta"].map((m, i) => (
                  <div key={m} className="flex-1 rounded-lg py-3 text-center text-sm font-medium"
                    style={i === 0 ? { background: "var(--amber)", color: "var(--navy)" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                    {m}
                  </div>
                ))}
              </div>
              <Field label="Karta raqami">
                <input className="field-select mono" placeholder="0000 0000 0000 0000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amal qilish muddati"><input className="field-select mono" placeholder="MM/YY" /></Field>
                <Field label="SMS kod"><input className="field-select mono" placeholder="••••" /></Field>
              </div>
            </div>

            <button
              onClick={() => setStep("done")}
              className="mt-5 w-full rounded-xl py-3.5 font-semibold display transition flex items-center justify-center gap-2"
              style={{ background: "var(--amber)", color: "var(--navy)" }}
            >
              <CreditCard size={16} /> {fmtPrice(totalPrice)} to'lash
            </button>
          </div>
        )}

        {step === "done" && selectedOut && (
          <div className="px-6 sm:px-10 py-8 max-w-lg mx-auto">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--teal)" }}>
                <Check size={26} color="white" strokeWidth={3} />
              </div>
              <h2 className="display text-white text-2xl font-bold">Chipta band qilindi!</h2>
              <p className="text-white/50 text-sm mt-1">Elektron chipta telefon raqamingizga yuboriladi.</p>
            </div>

            <TicketCard leg="Borish" from={from} to={to} f={selectedOut} date={date} name={passengerForm.name} />
            {tripType === "roundtrip" && selectedRet && (
              <div className="mt-3">
                <TicketCard leg="Qaytish" from={to} to={from} f={selectedRet} date={returnDate} name={passengerForm.name} />
              </div>
            )}

            <button
              onClick={() => {
                setStep("search"); setSelectedOut(null); setSelectedRet(null); setLeg("outbound");
                setPassengerForm({ name: "", passport: "", phone: "" });
              }}
              className="mt-5 w-full rounded-xl py-3.5 font-semibold display text-white transition"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              Yangi qidiruv
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ leg, from, to, f, date, name }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cream)" }}>
      <div className="p-5 flex items-center justify-between" style={{ background: "var(--amber)" }}>
        <span className="display font-bold" style={{ color: "var(--navy)" }}>PARVOZ · {leg}</span>
        <span className="mono text-xs font-semibold" style={{ color: "var(--navy)" }}>{f.flightNo}</span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mono">
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--navy)" }}>{from}</p>
            <p className="text-xs" style={{ color: "var(--navy)", opacity: 0.6 }}>{f.dep}</p>
          </div>
          <Plane size={18} style={{ color: "var(--navy)", opacity: 0.4 }} />
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "var(--navy)" }}>{to}</p>
            <p className="text-xs" style={{ color: "var(--navy)", opacity: 0.6 }}>{f.arr}</p>
          </div>
        </div>
        <div className="h-px my-4" style={{ background: "rgba(11,30,61,0.15)" }} />
        <div className="grid grid-cols-2 gap-3 text-sm" style={{ color: "var(--navy)" }}>
          <div><p className="opacity-50 text-xs">Yo'lovchi</p><p className="font-semibold">{name}</p></div>
          <div><p className="opacity-50 text-xs">Sana</p><p className="font-semibold">{date}</p></div>
          <div><p className="opacity-50 text-xs">Aviakompaniya</p><p className="font-semibold">{f.airline}</p></div>
          <div><p className="opacity-50 text-xs">Yuk</p><p className="font-semibold">{f.baggage}</p></div>
        </div>
      </div>
    </div>
  );
}

function LegPill({ active, done, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition"
      style={active ? { background: "var(--amber)", color: "var(--navy)" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
    >
      {done && <Check size={11} />} {label}
    </button>
  );
}

function Field({ label, children, icon }) {
  return (
    <label className="block">
      <span className="text-white/50 text-xs mb-1.5 flex items-center gap-1">{icon}{label}</span>
      {children}
    </label>
  );
}
