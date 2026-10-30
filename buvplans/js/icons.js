// Rīkjoslas ikonas (24×24, līnijas). Pašu zīmētas; atslēgas atbilst catalog-data.js `icon` laukiem.
// Krāsainas līnijas tikai caurulēm / vadiem / demontāžai (sarkans = karsts / fāze / nojaukt, zils = auksts / neitrāle).
const R = '#ff6b5f', B = '#6aa7ff', BR = '#c9a074';
const h = 'stroke-width="1"'; // šķērssvītrojums
const DROP = 'M12 3s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z';
const PLATE = '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/>'; // rozetes / slēdža rāmis
const SERP = 'M4 5h16v3.5H4V12h16v3.5H4V19h16';
const WIRE = (c) => `<path d="M2.5 12h8" stroke="${c}" stroke-width="2.2"/><path d="M10.5 9.5h4.5v5h-4.5z" stroke="${c}"/><path d="M15 12h6.5" stroke="${c}"/>`;
const CORES = (pts) => `<circle cx="12" cy="12" r="8"/>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="currentColor"/>`).join('')}`;
const TROWEL = '<path d="M3 15.5h12.5l-1.5 3H4.5z"/><path d="M9.5 15.5v-3.5h6.5a2.5 2.5 0 0 0 0-5h-2"/>';

const I = {
  select: '<path d="M6 3l12 7-5.5 1.7L10 17.5z"/><path d="M12.5 11.7l3.5 6.3"/>',

  // ── Pamatplāns ──
  wall: `<path d="M3 21V4h18v4.5H7.5V21z"/><path d="M3 8.5l4.5-4.5M3 13l4.5-4.5M3 17.5l4.5-4.5M4 21l3.5-3.5M8 8.5l4.5-4.5M12.5 8.5L17 4M17 8.5l4-4" ${h}/>`,
  balcony: '<path d="M2 4.5h20" stroke-width="2.6"/><path d="M4 9h16M4 9v10M20 9v10"/><path d="M8 9v10M12 9v10M16 9v10" stroke-width="1.1"/><path d="M2.5 20.5h19" stroke-width="2.2"/>',
  window: '<rect x="5" y="3" width="14" height="16"/><path d="M12 3v16M5 11h14"/><path d="M3 21h18" stroke-width="2"/><path d="M8 6l2-2" stroke-width="1"/>',
  door: '<path d="M2 20.5h4M18 20.5h4" stroke-width="2.6"/><path d="M6 20.5V5" stroke-width="2"/><path d="M6 5a15.5 15.5 0 0 1 12 15.5" stroke-dasharray="2 1.8"/>',
  column: `<rect x="5" y="5" width="14" height="14"/><path d="M5 10l5-5M5 15 15 5M5.5 19 19 5.5M10 19l9-9M15 19l4-4" ${h}/>`,
  beam: '<path d="M2 8h20M2 16h20" stroke-dasharray="3 2"/><path d="M2 5v14M22 5v14"/><path d="M8 12h8" stroke-width="1"/>',
  stairs: '<rect x="5" y="2.5" width="14" height="19"/><path d="M5 6.5h14M5 10.5h14M5 14.5h14M5 18h14" stroke-width="1"/><path d="M12 20V4.5M9.5 7l2.5-2.5L14.5 7" stroke-width="1.6"/>',
  utilities: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2"/><circle cx="9" cy="9" r="3"/><circle cx="15.5" cy="15.5" r="2.5"/><circle cx="15.5" cy="8" r="1.6"/><circle cx="8" cy="16" r="1.6"/>',
  hole: `<rect x="3" y="3" width="18" height="18"/><rect x="6.5" y="6.5" width="11" height="11"/><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" ${h}/>`,
  terrace: '<rect x="3" y="12" width="18" height="9"/><path d="M3 15h18M3 18h18" stroke-width="1"/><path d="M8 12v3M14 15v3M10 18v3M17 12v3" stroke-width="1"/><circle cx="16.5" cy="5.5" r="3"/><path d="M16.5 8.5V12M3 9h6" />',

  // ── Demontāža ──
  demolish: `<rect x="3" y="9" width="18" height="6"/><path d="M5 15l6-6M9 15l6-6M13 15l6-6" ${h}/><path d="M5 4l14 16M19 4 5 20" stroke="${R}" stroke-width="2"/>`,
  demolishPart: `<path d="M2 9h6v6H2M22 9h-6v6h6"/><path d="M2 14l4-4M18 14l3-3" ${h}/><rect x="8" y="9" width="8" height="6" stroke="${R}" stroke-dasharray="2 1.5"/><path d="M10 5l4 4M14 5l-4 4M10 15l4 4M14 15l-4 4" stroke="${R}" stroke-width="1.6"/>`,
  demolishDoor: `<path d="M2 20.5h4M18 20.5h4" stroke-width="2.6"/><path d="M6 20.5V5"/><path d="M6 5a15.5 15.5 0 0 1 12 15.5" stroke-dasharray="2 1.8"/><path d="M4 3l17 15" stroke="${R}" stroke-width="2"/>`,
  demolishRad: `<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M7.5 7v10M12 7v10M16.5 7v10"/><path d="M3 3.5l18 17" stroke="${R}" stroke-width="2"/>`,
  demolishPanel: `<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M13 6.5l-3 5.5h4l-3 5.5"/><path d="M3 3.5l18 17" stroke="${R}" stroke-width="2"/>`,
  eraser: '<path d="M14.5 3.5l6 6-9.5 9.5H6.5l-3.5-3.5z"/><path d="M9 9l6 6M6.5 19H21"/>',

  // ── Starpsienas ──
  partition: '<rect x="3" y="6" width="18" height="12"/><path d="M3 12h18M10 6v6M17 6v6M6.5 12v6M13.5 12v6"/>',
  partitionFoam: '<rect x="3" y="6" width="18" height="12"/><path d="M3 12h18M12 6v6M7.5 12v6M16.5 12v6"/><path d="M6 9h0M9 8.5h0M15 9h0M18.5 8h0M5 15h0M10.5 15.5h0M13.5 14.5h0M19 15.5h0" stroke-width="1.6"/>',
  partitionBrick: '<rect x="3" y="5" width="18" height="14"/><path d="M3 8.5h18M3 12h18M3 15.5h18M8 5v3.5M14 5v3.5M11 8.5V12M17 8.5V12M5.5 8.5V12M8 12v3.5M14 12v3.5M11 15.5V19M17 15.5V19M5.5 15.5V19" stroke-width="1.1"/>',
  partitionDry: '<path d="M3 6h18M3 8.5h18M3 15.5h18M3 18h18"/><path d="M3 6v12M21 6v12"/><path d="M7.5 8.5v7M12 8.5v7M16.5 8.5v7" stroke-dasharray="1.6 1.4" stroke-width="1.1"/>',
  partitionGlass: '<rect x="3" y="4" width="18" height="16"/><path d="M12 4v16"/><path d="M5.5 11l3-3M5.5 14.5l5-5M14.5 11l3-3M14.5 14.5l4-4" stroke-width="1"/>',
  partitionSlat: '<rect x="3.5" y="3" width="2.6" height="18"/><rect x="8.5" y="3" width="2.6" height="18"/><rect x="13.5" y="3" width="2.6" height="18"/><rect x="18.4" y="3" width="2.6" height="18"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  drywallBox: `<path d="M3 3v18M3 3h18" stroke-width="2.6"/><path d="M3 13h7a2 2 0 0 0 2-2V3"/><path d="M4 11l6-6.5M4 7l3-3M6.5 12l5-5.5" ${h}/>`,
  zoning: '<rect x="3" y="4" width="18" height="16"/><path d="M12 4v16" stroke-dasharray="2.5 2"/><path d="M6 12h3M7.5 10.5 9 12l-1.5 1.5M18 12h-3M16.5 10.5 15 12l1.5 1.5" stroke-width="1.1"/>',

  // ── Apkure ──
  radiator: '<rect x="3" y="5.5" width="18" height="12" rx="1"/><path d="M7.5 5.5v12M12 5.5v12M16.5 5.5v12"/><path d="M5 17.5v2.5M19 17.5v2.5"/>',
  radiatorTube: '<path d="M3 6h18M3 17h18"/><path d="M5 6v11M8 6v11M11 6v11M14 6v11M17 6v11M20 6v11" stroke-width="1.1"/><path d="M5 17v3M20 17v3"/>',
  radiatorVertical: '<rect x="7" y="2.5" width="10" height="19" rx="1"/><path d="M10.3 2.5v19M13.7 2.5v19"/>',
  convector: '<rect x="3" y="8" width="18" height="10" rx="1.5"/><path d="M6 8v-.5M3 12h18M6 15h12" stroke-width="1"/><path d="M8 5c0-1.5 1.5-1.5 1.5-3M12 5c0-1.5 1.5-1.5 1.5-3M16 5c0-1.5 1.5-1.5 1.5-3" stroke-width="1.1"/>',
  convectorTrench: '<path d="M2 9h4v8h12V9h4" stroke-width="1.8"/><path d="M7 11.5h10M7 14.5h10M9 9v8M12 9v8M15 9v8" stroke-width="1"/><path d="M9.5 6c0-1.3 1.2-1.3 1.2-2.6M13.5 6c0-1.3 1.2-1.3 1.2-2.6" stroke-width="1.1"/>',
  convectorElectric: '<rect x="3" y="7" width="18" height="11" rx="1.5"/><path d="M12.5 9 10 12.7h3.5L11 16.5"/><path d="M6 18v2.5M18 18v2.5"/>',
  manifold: `<path d="M3 7h18" stroke="${R}" stroke-width="2.2"/><path d="M3 14h18" stroke="${B}" stroke-width="2.2"/><path d="M6 7v3M10 7v3M14 7v3M18 7v3M6 14v6M10 14v6M14 14v6M18 14v6" stroke-width="1.4"/>`,
  pipeRed: `<path d="M3 17h7V7h11" stroke="${R}" stroke-width="2.6"/><circle cx="10" cy="17" r="1.6" fill="${R}" stroke="none"/>`,
  pipeBlue: `<path d="M3 17h7V7h11" stroke="${B}" stroke-width="2.6"/><circle cx="10" cy="17" r="1.6" fill="${B}" stroke="none"/>`,
  pipeBrown: `<path d="M3 17h7V7h11" stroke="${BR}" stroke-width="3.4"/><path d="M17 4.5v5" stroke="${BR}" stroke-width="1.4"/>`,
  drain: `<path d="M3 7h7v10h11" stroke="${B}" stroke-width="2.2" stroke-dasharray="3 2"/><path d="M18 14l3 3-3 3" stroke="${B}"/>`,

  // ── Mēbeles ──
  sofa: '<path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/><path d="M2 11h4v4h12v-4h4v7H2z"/><path d="M4 18v2M20 18v2"/>',
  kitchen: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 8.5h16"/><circle cx="8" cy="5.8" r=".9"/><circle cx="11.5" cy="5.8" r=".9"/><rect x="7" y="11.5" width="10" height="6.5" rx="1"/><path d="M9 13.5h6" stroke-width="1"/>',
  tv: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 7.5h16M7 5.3h3"/><circle cx="16.5" cy="5.3" r=".6"/><circle cx="12" cy="14" r="4.5"/><path d="M9.5 15a3 3 0 0 0 3 1.8" stroke-width="1"/>',
  appliances: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 7.5h16M7 5.3h3"/><circle cx="16.5" cy="5.3" r=".6"/><circle cx="12" cy="14" r="4.5"/><path d="M9.5 15a3 3 0 0 0 3 1.8" stroke-width="1"/>',
  television: '<rect x="2.5" y="4" width="19" height="12.5" rx="1"/><path d="M8 20.5h8M12 16.5v4"/>',
  closet: '<rect x="4" y="2.5" width="16" height="17.5" rx=".5"/><path d="M12 2.5V20M10 10v3M14 10v3M6 20v1.5M18 20v1.5"/>',
  crib: '<path d="M4 4v17M20 4v17M4 9h16M4 17h16M8 9v8M12 9v8M16 9v8"/><path d="M2.5 21h3M18.5 21h3"/>',
  office: '<rect x="6" y="2.5" width="12" height="8.5" rx="1"/><path d="M12 11v3M2 14h20M4 14v7M20 14v7M14 17.5h6"/>',
  plant: '<path d="M7.5 15h9l-1.2 6H8.7z"/><path d="M12 15V9M12 9c-3.5 0-5-2.5-5-5 3.5 0 5 2 5 5zM12 11c2.5 0 4.5-1.8 4.5-4.5-2.8 0-4.5 1.8-4.5 4.5z"/>',
  gym: '<path d="M7 12h10"/><rect x="4" y="6.5" width="3" height="11" rx="1"/><rect x="17" y="6.5" width="3" height="11" rx="1"/><path d="M2 9.5v5M22 9.5v5"/>',
  house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5M16 7V4h2v4.5"/>',
  scissors: '<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/><path d="M8.6 15.4 19 3.5M15.4 15.4 5 3.5"/>',
  cart: '<path d="M2 4h3l2.6 11h11.2l2.2-8H6"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>',
  restaurant: '<path d="M5 3v6a2.5 2.5 0 0 0 5 0V3M7.5 3v18M17 21V3c2.5 1 3.5 4.5 3.5 9H17"/>',
  medical: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3z"/>',
  factory: '<path d="M3 21V11l5 3v-3l5 3V5h4v16z"/><path d="M2 21h20M6 18h2M10 18h2"/>',
  car: '<path d="M3 16.5v-3.5l2.5-5.5h10l3.5 5.5h2v3.5"/><path d="M6.5 13h12" stroke-width="1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',

  // ── Santehnika ──
  sink: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><ellipse cx="12" cy="13" rx="6" ry="4.5"/><path d="M12 4v4"/><circle cx="12" cy="13.5" r=".8" fill="currentColor"/>',
  cabinet: '<path d="M7.5 8.5V7h9v1.5M12 7V4.5h2.5"/><path d="M3 8.5h18"/><rect x="4" y="8.5" width="16" height="12"/><path d="M12 8.5v12M10 13v2.5M14 13v2.5"/>',
  bath: '<path d="M2.5 11h19v2.5a6 6 0 0 1-6 6h-7a6 6 0 0 1-6-6zM5.5 11V5.5a2 2 0 0 1 4 0v.5"/><path d="M6 19.5 5 21.5M18 19.5l1 2"/>',
  toilet: '<rect x="7" y="2.5" width="10" height="5.5" rx="1"/><path d="M5 8h14a7 7 0 0 1-7 8.5A7 7 0 0 1 5 8z"/><path d="M9.5 16l-.5 5.5h6l-.5-5.5"/>',
  shower: '<path d="M4 21V7a3.5 3.5 0 0 1 7 0"/><path d="M8 10h6"/><path d="M8.5 13l-.5 1.5M11 13v1.5M13.5 13l.5 1.5M8.5 17l-.8 1.8M11 17v1.8M13.5 17l.8 1.8" stroke-width="1.3"/>',
  showerCabin: '<path d="M3 3h18v18H3z"/><path d="M3 21a18 18 0 0 1 18-18" stroke-dasharray="2.2 1.8"/><circle cx="17" cy="17" r="1.4"/>',
  faucet: '<path d="M4 11h9a4 4 0 0 1 4 4v1.5M8.5 11V7.5M5.5 7.5h6"/><path d="M17 19v1M15.5 20.5v1M18.5 20.5v1" stroke-width="1.2"/>',
  towel: '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M6 8h12M6 12h12M6 16h12"/>',
  mirror: '<ellipse cx="12" cy="11" rx="6" ry="8"/><path d="M9.5 8.5l3-3M9.5 12l5-5" stroke-width="1.1"/><path d="M8 21.5h8"/>',

  // ── Ūdensapgāde ──
  water: `<path d="M12 2.5s4.2 4.6 4.2 7.6a4.2 4.2 0 0 1-8.4 0c0-3 4.2-7.6 4.2-7.6z"/><path d="M3 16.5h18M3 20.5h18"/><path d="M5 20.5l4-4M10 20.5l4-4M15 20.5l4-4" ${h}/>`,
  waterWall: `<path d="M3 2.5v19M7 2.5v19"/><path d="M3 7l4-4M3 12l4-4M3 17l4-4M3 21.5l4-4" ${h}/><path d="M15 6s4.5 5 4.5 8a4.5 4.5 0 0 1-9 0c0-3 4.5-8 4.5-8z"/>`,
  dropBlue: `<path d="${DROP}" stroke="${B}"/><path d="M9.2 14.5a3 3 0 0 0 2.8 2.5" stroke="${B}" stroke-width="1"/>`,
  dropRed: `<path d="${DROP}" stroke="${R}"/><path d="M9.2 14.5a3 3 0 0 0 2.8 2.5" stroke="${R}" stroke-width="1"/>`,
  dropBrown: `<path d="${DROP}" stroke="${BR}"/><path d="M9 14.5h6M10 17h4" stroke="${BR}" stroke-width="1.2"/>`,
  drops: `<path d="M7 6s4 5 4 8a4 4 0 0 1-8 0c0-3 4-8 4-8z" stroke="${B}"/><path d="M17 6s4 5 4 8a4 4 0 0 1-8 0c0-3 4-8 4-8z" stroke="${R}"/>`,
  node: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2.5V9M3.5 17.5 9.4 13.5M20.5 17.5 14.6 13.5"/>',

  // ── Rozetes ──
  socket: `${PLATE}<circle cx="12" cy="12" r="5.5"/><path d="M9.8 12h0M14.2 12h0" stroke-width="2.4"/><path d="M12 6.5v1.3M12 16.2v1.3"/>`,
  socketBlock: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="7.5" cy="12" r="3.6"/><circle cx="16.5" cy="12" r="3.6"/><path d="M6.2 12h0M8.8 12h0M15.2 12h0M17.8 12h0" stroke-width="2"/>',
  socketWet: `${PLATE}<path d="M3.5 9h17"/><circle cx="12" cy="14.5" r="3.5"/><path d="M10.6 14.5h0M13.4 14.5h0" stroke-width="2"/><path d="M12 5.2s1.5 1.5 1.5 2.1a1.5 1.5 0 0 1-3 0c0-.6 1.5-2.1 1.5-2.1z" stroke-width="1"/>`,
  socketPower: `${PLATE}<circle cx="12" cy="12" r="5.5"/><path d="M9.8 12h0M14.2 12h0" stroke-width="3.2"/><path d="M12 6.5v2.3M12 15.2v2.3" stroke-width="2"/>`,
  socket380: `${PLATE}<circle cx="12" cy="12" r="6"/><path d="M12 7.8h0M15.6 10.6h0M14.2 15h0M9.8 15h0M8.4 10.6h0" stroke-width="2.2"/>`,
  socketFloor: `<path d="M2 20h20" stroke-width="2"/><rect x="5" y="6" width="14" height="10" rx="1"/><path d="M5 6l3-3h8l3 3"/><path d="M10 11h0M14 11h0" stroke-width="2.2"/>`,
  socketCeiling: `<path d="M2 4h20" stroke-width="2"/><path d="M6 4v3a6 6 0 0 0 12 0V4"/><path d="M10 9h0M14 9h0" stroke-width="2.2"/><path d="M12 13v7" stroke-dasharray="2 1.5"/>`,
  socketTV: `${PLATE}<path d="M8 8.5h8v5.5h-2v2h-4v-2H8z"/><path d="M10 8.5v2M12 8.5v2M14 8.5v2" stroke-width="1"/>`,
  wireOut: '<path d="M3.5 3v18" stroke-width="2.6"/><path d="M3.5 12H8c5 0 5-5 10-5M8 12c5 0 5 5 10 5"/><circle cx="19.5" cy="7" r="1.5"/><circle cx="19.5" cy="17" r="1.5"/>',
  router: '<rect x="3" y="13" width="18" height="6.5" rx="1.5"/><path d="M7 13 5.5 7.5M17 13l1.5-5.5"/><path d="M6.5 16.3h0M9.5 16.3h0" stroke-width="2"/><path d="M10 7.5a3 3 0 0 1 4 0M8.5 5.3a5.5 5.5 0 0 1 7 0" stroke-width="1.2"/>',
  panel: '<rect x="4" y="2.5" width="16" height="19" rx="1"/><path d="M13.5 5.5 9.5 12h5l-4 6.5"/>',

  // ── Slēdži ──
  switch: `${PLATE}<rect x="8.5" y="7" width="7" height="10" rx="1"/><path d="M8.5 10h7"/>`,
  switch2: `${PLATE}<rect x="6.5" y="7" width="11" height="10" rx="1"/><path d="M12 7v10M6.5 10h11"/>`,
  switch3: `${PLATE}<rect x="5.5" y="7" width="13" height="10" rx="1"/><path d="M9.8 7v10M14.2 7v10M5.5 10h13"/>`,
  switchTwoWay: `${PLATE}<rect x="8.5" y="7" width="7" height="10" rx="1"/><path d="M12 9v6M10.5 10.5 12 9l1.5 1.5M10.5 13.5 12 15l1.5-1.5" stroke-width="1.1"/>`,
  switchCross: `${PLATE}<rect x="8.5" y="7" width="7" height="10" rx="1"/><path d="M10 9.5l4 5M14 9.5l-4 5" stroke-width="1.1"/>`,
  switchMaster: `${PLATE}<rect x="7" y="7" width="10" height="10" rx="1"/><circle cx="12" cy="12" r="2.6"/><path d="M12 9v1.5" stroke-width="1.1"/>`,
  dimmer: `${PLATE}<circle cx="12" cy="12" r="4.5"/><path d="M12 7.5v3"/><path d="M6 17.5a8 8 0 0 1 0-11" stroke-width="1" stroke-dasharray="1 1.5"/>`,
  cable: '<path d="M2.5 17c3.5 0 4-10 9.5-10s6 10 9.5 10"/><circle cx="2.5" cy="17" r=".9" fill="currentColor"/><circle cx="21.5" cy="17" r=".9" fill="currentColor"/>',

  // ── Apgaismojums ──
  chandelier: '<path d="M12 2.5V8M4.5 11.5a7.5 4 0 0 0 15 0z"/><path d="M4.5 11.5v3.5M12 15.5v3M19.5 11.5v3.5"/><circle cx="4.5" cy="16.5" r="1.4"/><circle cx="12" cy="20" r="1.4"/><circle cx="19.5" cy="16.5" r="1.4"/>',
  ceilingLight: '<path d="M2.5 4.5h19"/><path d="M5 4.5a7 7 0 0 0 14 0"/><path d="M12 15v2.5M6.5 13.5 5 15.5M17.5 13.5l1.5 2M12 20.5v.5" stroke-width="1.2"/>',
  spot: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  sconce: '<path d="M4 3v18" stroke-width="2.2"/><path d="M4 12h3.5"/><path d="M7.5 7h9l3 7h-12z"/><path d="M12 17v1.5M9 16.5l-1 1.3M15 16.5l1 1.3" stroke-width="1.2"/>',
  track: '<path d="M2 5h20" stroke-width="2.4"/><path d="M6 5v4M12 5v4M18 5v4"/><path d="M4 9h4l1 5H3zM10 9h4l1 5H9zM16 9h4l1 5h-6z"/>',
  linear: '<rect x="2" y="9" width="20" height="5" rx="1"/><path d="M5 18l1-2M12 18.5v-2.5M19 18l-1-2" stroke-width="1.2"/><path d="M2 6.5h20" stroke-width="1" stroke-dasharray="2 2"/>',
  led: '<rect x="2" y="9" width="20" height="6" rx="1"/><path d="M5 12h1.2M9.3 12h1.2M13.5 12h1.2M17.8 12h1.2" stroke-width="2.4"/><path d="M5.6 6.5v-1M14 6.5v-1M9.9 18.5v-1M18.4 18.5v-1" stroke-width="1"/>',

  // ── Elektroinstalācija ──
  cable2: CORES([[9, 12], [15, 12]]),
  cable3: CORES([[12, 8.5], [8.8, 14], [15.2, 14]]),
  cable4: CORES([[9, 9], [15, 9], [9, 15], [15, 15]]),
  cable5: CORES([[12, 7.5], [16.3, 10.6], [14.6, 15.6], [9.4, 15.6], [7.7, 10.6]]),
  cableLow: '<path d="M2 12c2.5 0 2.5-4 5-4s2.5 8 5 8 2.5-8 5-8 2.5 4 5 4"/><path d="M2 12c2.5 0 2.5 4 5 4s2.5-8 5-8 2.5 8 5 8 2.5-4 5-4" stroke-width="1.1"/>',
  junction: '<circle cx="12" cy="12" r="5"/><path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5"/><path d="M9.5 9.5l5 5" stroke-width="1"/>',
  junctionWall: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  bondingBox: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 6v6M7.5 12h9M9 15h6M10.5 18h3"/>',

  // ── Sadales skapis ──
  din: '<path d="M2 9h20v6H2z"/><path d="M2 7v10M22 7v10" stroke-width="1"/><path d="M5 12h2.5M10.8 12h2.5M16.5 12h2.5" stroke-width="2"/>',
  breaker: '<rect x="7" y="2.5" width="10" height="19" rx="1"/><path d="M7 7.5h10M7 16.5h10"/><rect x="10.3" y="9.5" width="3.4" height="5" rx=".5"/><path d="M12 9.5v2.5"/>',
  rcd: '<rect x="3.5" y="2.5" width="17" height="19" rx="1"/><path d="M3.5 7.5h17M3.5 16.5h17"/><rect x="6.5" y="9.5" width="3" height="5" rx=".5"/><rect x="11" y="9.5" width="3" height="5" rx=".5"/><circle cx="17" cy="12" r="1.4"/>',
  module: '<rect x="6" y="2.5" width="12" height="19" rx="1"/><rect x="8.5" y="5.5" width="7" height="4.5"/><path d="M10 7.8h4" stroke-width="1"/><circle cx="12" cy="15.5" r="2.3"/>',
  separator: '<path d="M2.5 3H8v18H2.5M21.5 3H16v18h5.5"/><rect x="10.7" y="3" width="2.6" height="18" rx=".5"/>',
  busbar: '<path d="M2.5 8h19" stroke-width="2.4"/><path d="M5 8v9M9.5 8v9M14 8v9M18.5 8v9"/><path d="M4 17h2M8.5 17h2M13 17h2M17.5 17h2"/>',
  busbarN: `<rect x="2.5" y="8.5" width="19" height="7" rx="1" stroke="${B}"/><circle cx="6.5" cy="12" r="1.5"/><circle cx="10.5" cy="12" r="1.5"/><circle cx="14.5" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/><path d="M12 3v5.5" stroke="${B}"/>`,
  wireL1: WIRE(R),
  wireL2: WIRE('#c9905a'),
  wireL3: WIRE('#dddddd'),
  wireN: WIRE(B),
  wireE: WIRE('#b5d334'),

  // ── Siltās grīdas ──
  heat: `<path d="${SERP}" stroke="${R}" stroke-width="1.4"/><path d="M3 21.5h18" stroke-width="1"/>`,
  heatIR: `<rect x="3" y="4" width="18" height="16"/><path d="M3 8h18M3 16h18" stroke-width="1"/><path d="M6 12c1-1.5 2-1.5 3 0s2 1.5 3 0 2-1.5 3 0 2 1.5 3 0" stroke="${R}"/>`,
  heatWall: `<path d="M3 3v18" stroke-width="2.6"/><path d="M8 3v3.5h12V10H8v3.5h12V17H8v4" stroke="${R}" stroke-width="1.4"/>`,
  heatWater: `<path d="M3.5 5H18a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h12a2 2 0 0 1 0 4H3.5" stroke="${B}"/><path d="M3.5 20.5h17" stroke="${R}"/>`,
  thermostat: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14.5" r="3"/><path d="M12 6.5v5"/><path d="M9 6.5h1M14 6.5h1" stroke-width="1"/>',

  // ── Kondicionēšana / ventilācija ──
  acOutdoor: '<rect x="2.5" y="4.5" width="19" height="14" rx="1"/><circle cx="10" cy="11.5" r="4.5"/><path d="M10 9v5M7.5 11.5h5" stroke-width="1"/><path d="M17 8v7M19 8v7" stroke-width="1.1"/><path d="M5 18.5v2M19 18.5v2"/>',
  acIndoor: '<rect x="2.5" y="5" width="19" height="8.5" rx="2.5"/><path d="M5 10.5h14" stroke-width="1"/><path d="M6.5 16.5l-1 2.5M12 16.5V19M17.5 16.5l1 2.5" stroke-width="1.3"/>',
  acPipes: `<path d="M3 9h18" stroke="${R}" stroke-width="1.8"/><path d="M3 13h18" stroke="${B}" stroke-width="1.8"/><path d="M3 17c3 0 3 2 6 2s3-2 6-2 3 2 6 2" stroke-width="1.1"/>`,
  duct: '<path d="M2.5 8h19M2.5 16h19"/><path d="M2.5 6v12M21.5 6v12" stroke-width="1"/><path d="M8 12h7.5M13 9.5l2.5 2.5-2.5 2.5"/>',
  ductSupply: `<path d="M2.5 8h19M2.5 16h19"/><path d="M2.5 6v12M21.5 6v12" stroke-width="1"/><path d="M7 12h8.5M13 9.5l2.5 2.5-2.5 2.5" stroke="${B}"/>`,
  ductExhaust: `<path d="M2.5 8h19M2.5 16h19"/><path d="M2.5 6v12M21.5 6v12" stroke-width="1"/><path d="M17 12H8.5M11 9.5 8.5 12l2.5 2.5" stroke="${R}"/>`,
  grille: '<rect x="3" y="3" width="18" height="18"/><rect x="7.5" y="7.5" width="9" height="9"/><path d="M3 3l4.5 4.5M21 3l-4.5 4.5M3 21l4.5-4.5M21 21l-4.5-4.5"/><path d="M10 12h4" stroke-width="1"/>',
  fan: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c-.5-3 1-5.5 3-5 1.5.6.5 3.8-3 5zM13.6 12c3-.5 5.5 1 5 3-.6 1.5-3.8.5-5-3zM12 13.6c.5 3-1 5.5-3 5-1.5-.6-.5-3.8 3-5zM10.4 12c-3 .5-5.5-1-5-3 .6-1.5 3.8-.5 5 3z" stroke-width="1.2"/>',

  // ── Drošība ──
  extinguisher: '<rect x="7.5" y="8" width="9" height="13.5" rx="3"/><path d="M10 8V5h4v3M14 5.5l4.5-2M10 5.5 7 4"/><path d="M7.5 13h9" stroke-width="1"/>',
  camera: '<path d="M2.5 7.5 16 10.5l-1.3 5.6L1.3 13.1z"/><path d="M16 12.5l4.5 1M7.5 14.8l-1 3.7H3M3 16v5" /><circle cx="5.2" cy="10.6" r=".8" fill="currentColor"/>',
  sensor: '<circle cx="12" cy="12" r="2.8"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5 5a9.9 9.9 0 0 0 0 14M19 5a9.9 9.9 0 0 1 0 14"/>',
  sensorLight: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  sensorLeak: `<path d="M12 3s4.5 5 4.5 8a4.5 4.5 0 0 1-9 0c0-3 4.5-8 4.5-8z" stroke="${B}"/><path d="M3 20c2 0 2-1.5 4.5-1.5S10 20 12 20s2.5-1.5 4.5-1.5S19 20 21 20" stroke="${B}"/>`,
  smoke: '<path d="M3 4h18"/><path d="M5 4v2a7 3 0 0 0 14 0V4"/><circle cx="12" cy="8" r="1"/><path d="M9 13c-1.5 1.5 1.5 2.5 0 4s1.5 2.5 0 4M15 13c-1.5 1.5 1.5 2.5 0 4s1.5 2.5 0 4" stroke-width="1.2"/>',
  alarm: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><rect x="7" y="5.5" width="10" height="4.5"/><path d="M8 13.5h0M12 13.5h0M16 13.5h0M8 17.5h0M12 17.5h0M16 17.5h0" stroke-width="2.2"/>',
  leakPanel: `<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M12 6s3 3.3 3 5.3a3 3 0 0 1-6 0c0-2 3-5.3 3-5.3z" stroke="${B}"/><path d="M8 18h3M14 18h2" stroke-width="2"/>`,

  // ── Apdare ──
  start: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  zone: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 2"/><rect x="2.5" y="2.5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="18.5" y="2.5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="2.5" y="18.5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="18.5" y="18.5" width="3" height="3" fill="currentColor" stroke="none"/>',
  tiles: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  planks: '<rect x="3" y="4" width="18" height="16"/><path d="M3 8h18M3 12h18M3 16h18M10 4v4M16 8v4M7 12v4M13 16v4" stroke-width="1.2"/>',
  parquet: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9l4.5-4.5L12 9l4.5-4.5L21 9M3 15l4.5-4.5L12 15l4.5-4.5L21 15M3 21l4.5-4.5L12 21l4.5-4.5L21 21" stroke-width="1.2"/>',
  carpet: '<rect x="5" y="4.5" width="14" height="15"/><rect x="8" y="7.5" width="8" height="9"/><path d="M7 4.5v-2M10 4.5v-2M14 4.5v-2M17 4.5v-2M7 19.5v2M10 19.5v2M14 19.5v2M17 19.5v2" stroke-width="1.1"/>',
  baseboard: `<path d="M5 2.5v18.5h16.5"/><path d="M5 12.5h2.5a2.5 2.5 0 0 1 2.5 2.5v6" stroke-width="1.8"/><path d="M12 21l2-2M16 21l2-2M20 21l1.5-1.5" ${h}/>`,
  roller: '<rect x="3.5" y="3" width="13" height="6" rx="1.5"/><path d="M16.5 6h3.5v5.5h-8.5v3"/><rect x="10" y="14.5" width="3" height="7" rx="1"/>',
  plaster: `<path d="M21 2.5v19" stroke-width="2.4"/><path d="M17.5 4c-1 2 1 4 0 6s1 4 0 6 1 3 0 4.5" stroke-width="1"/>${TROWEL}`,
  plasterBeacon: `<path d="M21 2.5v19" stroke-width="2.4"/><path d="M17.5 2.5v19" stroke-dasharray="3 2" stroke-width="1.1"/>${TROWEL}`,
  plasterCeiling: `<path d="M2.5 3h19" stroke-width="2.4"/><path d="M4 6c2-1 4 1 6 0s4 1 6 0 3 1 4.5 0" stroke-width="1"/><path d="M5 9h13l-1.5 2.5h-10z"/><path d="M11.5 11.5v2"/><rect x="9" y="13.5" width="5" height="7" rx="2"/>`,
  screed: `<rect x="3" y="14" width="18" height="6"/><path d="M4 20l6-6M9 20l6-6M14 20l6-6" ${h}/><path d="M2 9.5h20" stroke-width="2"/><path d="M10 8h4v3h-4z" stroke-width="1"/>`,
  screedDry: `<rect x="3" y="15" width="18" height="5"/><path d="M5 18h0M8 17h0M11 18.5h0M14 17h0M17 18h0M19.5 17h0" stroke-width="1.8"/><path d="M3 10h18v3H3z"/><path d="M12 10v3"/>`,
  screedSelf: `<rect x="3" y="15" width="18" height="5"/><path d="M3 12.5c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5"/><path d="M7 3.5h5l-1 3h-3z M9.5 6.5v3" stroke-width="1.2"/>`,
  ceiling: `<path d="M2.5 3.5h19" stroke-width="2.2"/><path d="M4 3.5l2-2M9 3.5l2-2M14 3.5l2-2M19 3.5l2-2" ${h}/><path d="M6 3.5v6M18 3.5v6"/><path d="M3 9.5h18" stroke-width="2.4"/><path d="M8 13.5h8M10 16.5h4" stroke-width="1"/>`,
  ceiling2: `<path d="M2.5 3.5h19" stroke-width="2.2"/><path d="M5 3.5v4M19 3.5v4"/><path d="M2.5 7.5h5V11h9V7.5h5" stroke-width="2"/><path d="M12 14v4M10 16.5l2 2 2-2" stroke-width="1.1"/>`,
  curtain: '<path d="M2.5 3.5h19" stroke-width="2"/><path d="M2.5 7h8.5V3.5M11 7h10.5"/><path d="M4 7c-1 4.5 1 9 0 14M6.5 7c-1 4.5 1 9 0 14M9 7c-1 4.5 1 9 0 14" stroke-width="1.2"/>',
  bed: `<path d="M2 6h20"/><path d="M4 6l2.5-3M9 6l2.5-3M14 6l2.5-3M19 6l2.5-3" ${h}/><rect x="7.5" y="6" width="9" height="3"/><path d="M12 9v5.5a3 3 0 1 1-3 3"/>`,
  molding: `<path d="M3 3h18M3 3v18" stroke-width="2"/><path d="M12 3v2h-2a2 2 0 0 0-2 2v1a2 2 0 0 1-2 2H3"/><path d="M4 9l5-5M5.5 9.5 8 7M7 5l2-2" ${h}/><path d="M14 13h7" stroke-dasharray="2 1.6" stroke-width="1"/>`,
  insulation: '<path d="M3 4.5h18M3 19.5h18"/><path d="M3 6l3 12 3-12 3 12 3-12 3 12 3-12"/>',
  insulationXPS: '<rect x="3" y="6" width="18" height="12"/><path d="M3 10h18M3 14h18" stroke-width="1"/><path d="M9 6v4M15 10v4M9 14v4" stroke-width="1"/>',
  insulationSound: '<path d="M3 3v18" stroke-width="2.4"/><path d="M6 3v18M6 4l3 3-3 3 3 3-3 3 3 3-3 3" stroke-width="1.1"/><path d="M14 9a4 4 0 0 1 0 6M17 6.5a7.5 7.5 0 0 1 0 11M20 4a11 11 0 0 1 0 16" stroke-width="1.3"/>',
  insulationMembrane: '<path d="M3 7h18M3 17h18"/><path d="M3 12c2 0 2-1.5 4.5-1.5S10 12 12 12s2.5-1.5 4.5-1.5S19 12 21 12" stroke-width="1.8"/>',
  insulationRoll: '<circle cx="8" cy="11" r="5.5"/><circle cx="8" cy="11" r="2"/><path d="M8 16.5h13.5M13.5 11c0 2.5 0 5.5 0 5.5"/><path d="M13.8 19.5h7.7" stroke-width="1"/>',

  // ── Vispārīgās ──
  figure: '<path d="M4 18 9 5l11 6-6 9z"/><circle cx="4" cy="18" r="1.4" fill="currentColor"/><circle cx="9" cy="5" r="1.4" fill="currentColor"/><circle cx="20" cy="11" r="1.4" fill="currentColor"/><circle cx="14" cy="20" r="1.4" fill="currentColor"/>',
  image: '<rect x="3" y="5" width="18" height="14"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-4 4 3 4-5 5 6"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6" stroke-width="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 16.5v.5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
I.partitionGypsum = I.partition;
I.ceilingMount = I.bed;

export function icon(name, fallback = 'box') {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${I[name] || I[fallback]}</svg>`;
}
export const hasIcon = (name) => !!I[name];
