import React from "react";

export function TestDiagramSvg({
  type,
}: {
  type: "campus_map" | "water_cycle" | "museum_floor";
}) {
  if (type === "museum_floor") {
    return (
      <svg viewBox="0 0 560 300" className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        <rect x="20" y="20" width="520" height="260" rx="12" fill="none" stroke="#94a3b8" strokeWidth="2" />
        {/* Compass */}
        <text x="515" y="45" fontSize="13" fontWeight="700" fill="#059669" textAnchor="middle">N ↑</text>
        {/* North Exit */}
        <rect x="235" y="12" width="90" height="18" rx="4" fill="#e2e8f0" />
        <text x="280" y="25" fontSize="10" fontWeight="600" fill="#334155" textAnchor="middle">NORTH EXIT</text>
        {/* Zone D beside North Exit */}
        <rect x="345" y="34" width="145" height="62" rx="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
        <text x="417" y="69" fontSize="13" fontWeight="700" fill="#047857" textAnchor="middle">Zone D</text>
        {/* Zone A opposite entrance */}
        <rect x="195" y="90" width="140" height="72" rx="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
        <text x="265" y="130" fontSize="13" fontWeight="700" fill="#047857" textAnchor="middle">Zone A</text>
        {/* Central Courtyard */}
        <rect x="210" y="176" width="110" height="46" rx="8" fill="#f1f5f9" stroke="#cbd5e1" strokeDasharray="4 3" />
        <text x="265" y="203" fontSize="10" fontWeight="600" fill="#64748b" textAnchor="middle">Central Courtyard</text>
        {/* Zone B West */}
        <rect x="40" y="140" width="135" height="100" rx="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
        <text x="107" y="190" fontSize="13" fontWeight="700" fill="#047857" textAnchor="middle">Zone B (West)</text>
        {/* Zone C East */}
        <rect x="365" y="140" width="150" height="100" rx="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
        <text x="440" y="190" fontSize="13" fontWeight="700" fill="#047857" textAnchor="middle">Zone C (East)</text>
        {/* Main Entrance */}
        <rect x="215" y="268" width="100" height="22" rx="4" fill="#059669" />
        <text x="265" y="283" fontSize="10" fontWeight="700" fill="#ffffff" textAnchor="middle">MAIN ENTRANCE</text>
      </svg>
    );
  }

  if (type === "water_cycle") {
    return (
      <svg viewBox="0 0 560 220" className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
        {[
          { x: 20, title: "Stage 1", sub: "Roof → [Q1] Gutters" },
          { x: 155, title: "Stage 2", sub: "Underground [Q2] Filter" },
          { x: 290, title: "Stage 3", sub: "Buried Cistern ([Q3]k L)" },
          { x: 425, title: "Stage 4", sub: "Solar Drip Mist Pumps" },
        ].map((step, i) => (
          <g key={step.title}>
            <rect x={step.x} y="65" width="115" height="90" rx="12" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
            <text x={step.x + 57} y="98" fontSize="13" fontWeight="700" fill="#047857" textAnchor="middle">{step.title}</text>
            <text x={step.x + 57} y="124" fontSize="9.5" fill="#334155" textAnchor="middle">{step.sub}</text>
            {i < 3 && (
              <path d={`M ${step.x + 118} 110 L ${step.x + 132} 110`} stroke="#059669" strokeWidth="2.5" markerEnd="url(#arrow)" />
            )}
          </g>
        ))}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#059669" />
          </marker>
        </defs>
      </svg>
    );
  }

  // campus_map
  return (
    <svg viewBox="0 0 560 220" className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <rect x="20" y="20" width="520" height="180" rx="12" fill="none" stroke="#94a3b8" strokeWidth="2" />
      <rect x="45" y="45" width="150" height="125" rx="10" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
      <text x="120" y="98" fontSize="14" fontWeight="700" fill="#047857" textAnchor="middle">Studio A</text>
      <text x="120" y="120" fontSize="10" fill="#334155" textAnchor="middle">North End · Acoustic Foam</text>

      <rect x="215" y="45" width="145" height="125" rx="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
      <text x="287" y="98" fontSize="14" fontWeight="700" fill="#334155" textAnchor="middle">Studio B</text>
      <text x="287" y="120" fontSize="10" fill="#64748b" textAnchor="middle">Center · Video Editing</text>

      <rect x="380" y="45" width="135" height="125" rx="10" fill="#fefce8" stroke="#ca8a04" strokeWidth="1.5" />
      <text x="447" y="98" fontSize="13" fontWeight="700" fill="#854d0e" textAnchor="middle">Equipment Desk</text>
      <text x="447" y="120" fontSize="10" fill="#713f12" textAnchor="middle">Book Mics 48h Ahead</text>
    </svg>
  );
}
