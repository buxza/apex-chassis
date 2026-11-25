const GARAGE_CATEGORIES = [
  { key: 'engine', label: '1. Blok Silnika (Engine Swap)', tag: 'BLOCK' },
  { key: 'internals', label: '2. Wnętrze Silnika (Kucizna)', tag: 'INTERNALS' },
  { key: 'induction', label: '3. Doładowanie & Dolot', tag: 'BOOST' },
  { key: 'exhaust', label: '4. Układ Wydechowy', tag: 'EXHAUST' },
  { key: 'drivetrain', label: '5. Skrzynia & Dyferencjał', tag: 'TRANS' },
  { key: 'suspension', label: '6. Zawieszenie & Wahacze', tag: 'COILOVERS' },
  { key: 'brakes', label: '7. Układ Hamulcowy', tag: 'ROTORS' },
  { key: 'tires', label: '8. Opony & Kute Felgi', tag: 'COMPOUND' },
  { key: 'aero', label: '9. Aerodynamika & Body', tag: 'AERO' }
];

const DB = {
  engine: [
    { id: 'r4_stock', name: 'R4 2.0 DOHC Seria', spec: '145 KM • Limit 1.1 bar', hp: 145, weight: 115, maxBoost: 1.1, cyl: 4, price: 0, color: '#00e676' },
    { id: 'r4_forged', name: 'R4 2.2 Stroker Block', spec: '210 KM • Limit 2.4 bar', hp: 210, weight: 125, maxBoost: 2.4, cyl: 4, price: 1400, color: '#00e5ff' },
    { id: 'i6_30', name: 'R6 3.0 Twin-Cam (2JZ)', spec: '280 KM • Limit 2.7 bar', hp: 280, weight: 165, maxBoost: 2.7, cyl: 6, price: 2900, color: '#ffbe0b' },
    { id: 'v8_race', name: 'V8 6.2 Cross-Plane', spec: '395 KM • Limit 2.3 bar', hp: 395, weight: 225, maxBoost: 2.3, cyl: 8, price: 5800, color: '#ff1744' }
  ],
  internals: [
    { id: 'int_stock', name: 'Odlewane Tłoki + Seria Wałki', spec: 'Max 7800 RPM • 1.00x', hpMult: 1.00, boostBonus: 0.0, revBonus: 0, price: 0 },
    { id: 'int_cams', name: 'Ostre Wałki 272° + Sprężynki', spec: '+8% mocy • +600 RPM', hpMult: 1.08, boostBonus: 0.15, revBonus: 600, price: 950 },
    { id: 'int_forged', name: 'Kute Tłoki CP + Korby H-Beam', spec: '+12% mocy • +0.6 bar limitu', hpMult: 1.12, boostBonus: 0.60, revBonus: 900, price: 2100 },
    { id: 'int_billet', name: 'Wał Billet + Tytanowe Zawory', spec: '+18% mocy • 10,200 RPM', hpMult: 1.18, boostBonus: 0.85, revBonus: 1600, price: 4200 }
  ],
  induction: [
    { id: 'na_itb', name: 'Wolnossący ITB (Trąbki)', spec: '0.01s lag • Reakcja 100%', mult: 1.16, lag: 0.01, boostCap: 0, price: 0 },
    { id: 'supercharger', name: 'Kompresor Śrubowy', spec: '0.04s lag • Max 1.5 bar', mult: 1.36, lag: 0.04, boostCap: 1.5, price: 1200 },
    { id: 'turbo_twin', name: 'Turbo Twin-Scroll', spec: '0.18s lag • Max 2.1 bar', mult: 1.54, lag: 0.18, boostCap: 2.1, price: 2400 },
    { id: 'turbo_big', name: 'Big Single GTX45', spec: '0.50s lag • Max 2.8 bar', mult: 1.98, lag: 0.50, boostCap: 2.8, price: 4600 }
  ],
  exhaust: [
    { id: 'ex_stock', name: 'Wydech Seryjny z Katalizatorem', spec: 'Cichy • 1.00x przepływ', hpMult: 1.00, spoolBonus: 0.0, pops: false, price: 0, color: '#718096' },
    { id: 'ex_catback', name: 'Przelot Stal Nierdzewna 3"', spec: '+5% mocy • Pops & Bangs', hpMult: 1.05, spoolBonus: 0.05, pops: true, price: 850, color: '#00e5ff' },
    { id: 'ex_equal', name: 'Kolektor Równoodległościowy', spec: '+9% mocy • Szybszy spool', hpMult: 1.09, spoolBonus: 0.12, pops: true, price: 1750, color: '#ff5500' },
    { id: 'ex_titanium', name: 'Tytanowy Układ Wydechowy', spec: '+13% mocy • -14 kg masy', hpMult: 1.13, spoolBonus: 0.18, pops: true, weightSave: 14, price: 3400, color: '#d500f9' }
  ],
  drivetrain: [
    { id: 'tr_street', name: '5-Biegowa Manual + Szpera 1.5', spec: 'RWD • Klasyczna zmiana', grip: 1.04, drift: 1.0, awd: false, straightCut: false, price: 0 },
    { id: 'tr_drift', name: 'Spaw 100% + Krótkie Przełożenia', spec: 'RWD • Idealny do driftu', grip: 0.94, drift: 1.85, awd: false, straightCut: false, price: 1350 },
    { id: 'tr_rally_awd', name: 'Napęd AWD + Kłowa Skrzynia', spec: '4x4 • Gwizd kłów • Szuter', grip: 1.22, drift: 0.90, awd: true, straightCut: true, price: 2400 },
    { id: 'tr_seq_drag', name: 'Sekwencja 6-Biegów + Półosie Pro', spec: '0.02s zmiana biegu • Drag', grip: 1.38, drift: 0.55, awd: false, straightCut: true, price: 3200 }
  ],
  suspension: [
    { id: 'su_stock', name: 'Amortyzatory Seryjne', spec: 'Komfort • Duże przechyły', cornerMult: 1.00, offroad: 0.65, price: 0 },
    { id: 'su_coil', name: 'Gwint Torowy (Coilovers)', spec: '+14% w zakrętach • Regulacja', cornerMult: 1.14, offroad: 0.45, price: 1100 },
    { id: 'su_angle', name: 'Angle Kit 65° + Wahacze Uniball', spec: '+25% kąta skrętu w drifcie', cornerMult: 1.10, driftAngle: 1.35, offroad: 0.40, price: 1650 },
    { id: 'su_rally', name: 'Zawieszenie Rajdowe Długi Skok', spec: '+75% przyczepności na szutrze', cornerMult: 1.06, offroad: 1.75, price: 1900 }
  ],
  brakes: [
    { id: 'br_stock', name: 'Tarcze Żeliwne 280mm', spec: 'Standardowe hamowanie', brakeMult: 1.00, price: 0, color: '#a0aec0' },
    { id: 'br_slotted', name: 'Tarcze Nacinane 330mm + EBC', spec: '+22% siły hamowania', brakeMult: 1.22, price: 800, color: '#00e5ff' },
    { id: 'br_bbk', name: 'Big Brake Kit 6-Tłoczkowy', spec: '+42% siły • Zero fadingu', brakeMult: 1.42, price: 1850, color: '#ff5500' },
    { id: 'br_carbon', name: 'Hamulce Karbonowo-Ceramiczne', spec: '+65% siły • -12 kg masy', brakeMult: 1.65, weightSave: 12, price: 3600, color: '#ffbe0b' }
  ],
  tires: [
    { id: 'ti_street', name: 'Opony Uliczne 225/45', spec: 'Trwałe • Balans', tireGrip: 1.00, offroad: 0.70, price: 0, color: '#00e5ff' },
    { id: 'ti_semislick', name: 'Semi-Slick R888R + Kute Felgi', spec: '+28% przyczepności na asfalcie', tireGrip: 1.28, offroad: 0.50, price: 1300, color: '#00e676' },
    { id: 'ti_gravel', name: 'Opony Szutrowe z Kostką', spec: '+60% trakcji w błocie/szutrze', tireGrip: 0.92, offroad: 1.60, price: 1250, color: '#d500f9' },
    { id: 'ti_dragslick', name: 'Drag Slick Hoosier + Beadlock', spec: '+58% trakcji na starcie 1/4', tireGrip: 1.58, offroad: 0.30, price: 1950, color: '#ff5500' }
  ],
  aero: [
    { id: 'ae_stock', name: 'Karoseria Seryjna', spec: 'Cx 0.28 • Bez skrzydła', drag: 0.28, downforce: 0.2, price: 0 },
    { id: 'ae_lip', name: 'Przedni Splitter + Ducktail', spec: '+15% docisku • Niski opór', drag: 0.29, downforce: 0.65, price: 950 },
    { id: 'ae_gt', name: 'Pakiet Carbon Time Attack GT', spec: '+65% docisku w szybkich łukach', drag: 0.36, downforce: 1.75, price: 2400 },
    { id: 'ae_drag', name: 'Carbon Front + Spadochron Drag', spec: 'Cx 0.20 • -28 kg masy', drag: 0.20, downforce: 0.15, weightSave: 28, price: 2700 }
  ]
};

const PROTOTYPE_POOL = [
  { id: 'proto_twin_gtx', cat: 'induction', name: 'PROTOTYPE: HKS Twin-Turbo 80s', spec: '0.10s lag • Max 2.8 bar • +125% mocy', mult: 2.25, lag: 0.10, boostCap: 2.8, proto: true },
  { id: 'proto_wankel_4r', cat: 'engine', name: 'PROTOTYPE: 4-Rotor Billet 26B', spec: '465 KM • 10,200 RPM • 4 rotory', hp: 465, weight: 125, maxBoost: 2.6, cyl: 4, color: '#ffbe0b', proto: true },
  { id: 'proto_active_aero', cat: 'aero', name: 'PROTOTYPE: Aktywne Aero DRS', spec: 'Cx 0.21 + Max docisk 2.1x', drag: 0.21, downforce: 2.1, proto: true },
  { id: 'proto_ti_exhaust', cat: 'exhaust', name: 'PROTOTYPE: Inconel F1 Header', spec: '+18% mocy • Natychmiastowy spool', hpMult: 1.18, spoolBonus: 0.25, pops: true, weightSave: 18, color: '#ffbe0b', proto: true }
];

const SYNDICATE_BOSSES = [
  { id: 'boss_drag', name: 'DUKE "V8 BUTCHER"', title: 'Król Ulicznego Dragu (1/4 Mili)', disc: 'drag', targetText: 'Pokonaj czas: poniżej 11.30s na 402m', targetVal: 11.30, rewardCash: 2800, rewardRep: 450, desc: 'Ciężki muscle car na kompresorze. Zmiażdż go lekkim autem i slickami.', defeated: false },
  { id: 'boss_drift', name: 'KENJI "SHADOW TOUGE"', title: 'Mistrz Górskich Serpentyn', disc: 'drift', targetText: 'Zdobądź 4,500 pkt driftu', targetVal: 4500, rewardCash: 3400, rewardRep: 600, desc: 'Wymaga Angle Kitu 65°, spawu dyferencjału i utrzymania mnożnika x5.', defeated: false },
  { id: 'boss_rally', name: 'BJÖRN "GRAVEL KING"', title: 'Mistrz Błota i Szutru', disc: 'rally', targetText: 'Zdobądź 3,500 pkt na szutrze', targetVal: 3500, rewardCash: 4200, rewardRep: 800, desc: 'Bez napędu AWD i opon szutrowych zniszczysz silnik.', defeated: false },
  { id: 'boss_circuit', name: 'ELENA "APEX QUEEN"', title: 'Rekordzistka Toru Time Attack', disc: 'circuit', targetText: 'Zdobądź 5,000 pkt linii wyścigowej', targetVal: 5000, rewardCash: 6000, rewardRep: 1200, desc: 'Wymaga pakietu Carbon Aero, hamulców BBK i ujemnego camberu.', defeated: false }
];

const EVENTS_DB = [
  { id: 'lic_1', type: 'license', badge: 'LICENCJA B-1', title: 'Kontrola Poślizgu (Touge)', disc: 'drift', targetVal: 2200, desc: 'Zdobądź 2,200 pkt driftu w jednym przejeździe, używając hamulca ręcznego i kontry.', rewardCash: 1100, rewardRep: 250, done: false },
  { id: 'lic_2', type: 'license', badge: 'LICENCJA A-1', title: 'Mistrz Przełożeń (Drag < 400 KM)', disc: 'drag', targetVal: 11.75, maxHpLimit: 400, desc: 'Zrób czas poniżej 11.75s na 1/4 mili autem o mocy poniżej 400 KM.', rewardCash: 1600, rewardRep: 350, done: false },
  { id: 'spec_weekly', type: 'spec', badge: 'SPEC SERIES (TYGODNIOWY)', title: 'Puchar 280 KM // Szuter', disc: 'rally', targetVal: 3200, maxHpLimit: 285, desc: 'Równe szanse! Limit mocy 285 KM na szutrze. Wygrywa wyłącznie zawieszenie i technika.', rewardCash: 3000, rewardRep: 700, done: false },
  { id: 'pink_slip_1', type: 'pink', badge: 'PINK SLIPS // WYSOKIE RYZYKO', title: 'Wyścig o Dowód: Midnight Devil', disc: 'drag', targetVal: 10.50, desc: 'WYGRANA = Kradniesz unikalny PROTOTYP rywala! PRZEGRANA = Tracisz zamontowane ulepszenia!', rewardCash: 4500, rewardRep: 1000, done: false }
];
