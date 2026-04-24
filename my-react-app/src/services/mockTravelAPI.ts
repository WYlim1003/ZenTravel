/**
 * Mock Travel API — simulates Amadeus-style responses.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlightOffer {
  flightNumber: string;
  airline:      string;
  from:         string;
  to:           string;
  departIn:     string;
  seatsLeft:    number;
  timeDepart:   string;
  timeLanding:  string;
  duration:     string;
  cabin:        string;
  priceMYR:     number;
  recommended?: boolean;
  note?:        string;
}

export interface HotelOffer {
  name:      string;
  stars:     number;
  distance:  string;
  priceMYR:  number;
  amenity:   string;
  available: boolean;
  recommended?: boolean;
}

export interface TransportOffer {
  name:      string;
  type:      string; 
  priceMYR:  number;
  rating:    number;
  available: boolean;
  note:      string;
}

export interface CompensationResult {
  eligible:      boolean;
  amountEUR:     number;
  amountMYR:     number;
  regulation:    string;
  conditions:    string[];
  claimDeadline: string;
}

export interface ToolCallPlan {
  tool:   string;
  params: Record<string, string | number | boolean>;
}

export type ToolResult =
  | { tool: 'search_flights';     result: FlightOffer[] }
  | { tool: 'search_hotels';      result: HotelOffer[] }
  | { tool: 'search_transport';   result: TransportOffer[] }
  | { tool: 'check_compensation'; result: CompensationResult };

// ─── IATA normaliser ──────────────────────────────────────────────────────────

const CITY_TO_IATA: Record<string, string> = {
  'kuala lumpur': 'KUL', 'kl': 'KUL', 'klia': 'KUL', 'kul': 'KUL',
  'mly': 'KUL', 'malaysia': 'KUL', 'msia': 'KUL',
  'penang': 'PEN', 'pen': 'PEN',
  'bali': 'DPS', 'denpasar': 'DPS', 'dps': 'DPS',
  'london': 'LHR', 'lhr': 'LHR', 'heathrow': 'LHR',
  'tokyo': 'NRT', 'narita': 'NRT', 'nrt': 'NRT',
  'haneda': 'HND', 'hnd': 'HND',
  'osaka': 'KIX', 'kix': 'KIX',
  'sapporo': 'CTS', 'cts': 'CTS',
  'singapore': 'SIN', 'sin': 'SIN',
  'bangkok': 'BKK', 'bkk': 'BKK', 'suvarnabhumi': 'BKK',
  'jakarta': 'CGK', 'cgk': 'CGK',
  'manila': 'MNL', 'mnl': 'MNL',
  'ho chi minh': 'SGN', 'sgn': 'SGN', 'saigon': 'SGN',
  'hanoi': 'HAN', 'han': 'HAN',
  'phnom penh': 'PNH', 'pnh': 'PNH',
  'seoul': 'ICN', 'incheon': 'ICN', 'icn': 'ICN',
  'beijing': 'PEK', 'pek': 'PEK',
  'shanghai': 'PVG', 'pvg': 'PVG',
  'hong kong': 'HKG', 'hkg': 'HKG',
  'dubai': 'DXB', 'dxb': 'DXB',
  'abu dhabi': 'AUH', 'auh': 'AUH',
  'doha': 'DOH', 'doh': 'DOH',
  'riyadh': 'RUH', 'ruh': 'RUH',
  'germany': 'FRA', 'frankfurt': 'FRA', 'fra': 'FRA',
  'munich': 'MUC', 'münchen': 'MUC', 'muc': 'MUC',
  'berlin': 'BER', 'ber': 'BER',
  'hamburg': 'HAM', 'ham': 'HAM',
  'dusseldorf': 'DUS', 'düsseldorf': 'DUS', 'dus': 'DUS',
  'gatwick': 'LGW', 'lgw': 'LGW',
  'paris': 'CDG', 'cdg': 'CDG',
  'amsterdam': 'AMS', 'ams': 'AMS',
  'zurich': 'ZRH', 'zürich': 'ZRH', 'zrh': 'ZRH',
  'rome': 'FCO', 'fco': 'FCO',
  'madrid': 'MAD', 'mad': 'MAD',
  'istanbul': 'IST', 'ist': 'IST',
  'sydney': 'SYD', 'syd': 'SYD',
  'melbourne': 'MEL', 'mel': 'MEL',
  'perth': 'PER', 'per': 'PER',
  'new york': 'JFK', 'jfk': 'JFK',
  'los angeles': 'LAX', 'lax': 'LAX',
};

export function toIATA(city: string): string {
  const normalized = city.toLowerCase().trim();
  return CITY_TO_IATA[normalized] || city.toUpperCase().slice(0, 3);
}

// ─── Route Data ──────────────────────────────────────────────────────────────

export interface RouteData {
  airlines: Array<{ code: string; name: string }>;
  basePriceMYR: number;
  durationMins: number;
}

const ROUTES: Record<string, RouteData> = {
  'KUL-PEN': { airlines: [{ code: 'AK', name: 'AirAsia' }, { code: 'MH', name: 'Malaysia Airlines' }], basePriceMYR: 120, durationMins: 60 },
  'KUL-SIN': { airlines: [{ code: 'MH', name: 'Malaysia Airlines' }, { code: 'AK', name: 'AirAsia' }, { code: 'SQ', name: 'Singapore Airlines' }], basePriceMYR: 180, durationMins: 65 },
  'KUL-LHR': { airlines: [{ code: 'MH', name: 'Malaysia Airlines' }, { code: 'BA', name: 'British Airways' }], basePriceMYR: 2800, durationMins: 830 },
  'KUL-DPS': { airlines: [{ code: 'AK', name: 'AirAsia' }, { code: 'MH', name: 'Malaysia Airlines' }], basePriceMYR: 450, durationMins: 180 },
};

const DEFAULT_ROUTE: RouteData = {
  airlines: [{ code: 'MH', name: 'Malaysia Airlines' }, { code: 'AK', name: 'AirAsia' }],
  basePriceMYR: 500,
  durationMins: 240,
};

const calculateArrival = (departTime: string, durationMins: number) => {
  const [h, m] = departTime.split(':').map(Number);
  let totalMins = h * 60 + m + durationMins;
  const arrivalH = Math.floor(totalMins / 60) % 24;
  const arrivalM = totalMins % 60;
  const nextDay = totalMins >= 1440 ? ' (+1)' : '';
  return `${String(arrivalH).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}${nextDay}`;
};

// --- Updated Integrated Search Function ---
export async function searchFlights(
  fromRaw:       string,
  toRaw:         string,
  countOrClass:  string | number = 3,
  excludeName?:  string
): Promise<FlightOffer[]> {
  await new Promise((r) => setTimeout(r, 400));

  const from = toIATA(fromRaw);
  const to   = toIATA(toRaw);
  const routeKey = `${from}-${to}`;
  const route    = ROUTES[routeKey] ?? DEFAULT_ROUTE;

  const cabin = typeof countOrClass === 'string' ? countOrClass : 'Economy';
  const count = typeof countOrClass === 'number'  ? countOrClass : 3;

  const startTimes  = ['07:30', '11:15', '15:45', '22:10'];
  const durationStr = `${Math.floor(route.durationMins / 60)}h ${route.durationMins % 60}m`;
  const seats       = [9, 4, 2, 6];

  let results = route.airlines.slice(0, Math.max(count, 1)).map((al, i) => {
    const depart   = startTimes[i] ?? '09:00';
    const departIn = `+${Math.round((i + 1) * 2.5)}h`;
    return {
      airline:      al.name,
      flightNumber: `${al.code}${100 + i * 23}`,
      from,
      to,
      departIn,
      seatsLeft:   seats[i] ?? 5,
      timeDepart:  depart,
      timeLanding: calculateArrival(depart, route.durationMins),
      duration:    durationStr,
      cabin,
      priceMYR:    Math.round(route.basePriceMYR * (1 + i * 0.15)),
      recommended: i === 0,
      note:        i === 0 ? 'Earliest available — recommended' : i === 1 ? 'Good value' : 'Premium option',
    };
  });

  if (excludeName) {
    results = results.filter(f => f.airline !== excludeName);
  }

  return results;
}

// ─── Databases ───────────────────────────────────────────────────────────────

const AIRPORT_HOTELS: Record<string, HotelOffer[]> = {
  KUL: [
    { name: 'Sama-Sama Hotel KLIA', stars: 4, distance: 'Connected to terminal', priceMYR: 420, amenity: 'Free airport shuttle', available: true, recommended: true },
    { name: 'Tune Hotel KLIA2', stars: 3, distance: '5-min walk', priceMYR: 185, amenity: 'Budget-friendly', available: true },
    { name: 'Mövenpick Hotel KLIA', stars: 5, distance: '10-min free shuttle', priceMYR: 660, amenity: 'Rooftop pool', available: true },
  ],
  DPS: [
    { name: 'Swiss-Belhotel Rainforest Bali', stars: 4, distance: '10-min from airport', priceMYR: 390, amenity: 'Tropical pool', available: true, recommended: true },
    { name: 'Pop! Hotel Airport Bali', stars: 3, distance: '5-min walk', priceMYR: 190, amenity: 'Free airport transfer', available: true },
    { name: 'Grand Mega Resort Bali Airport', stars: 4, distance: '3-min drive', priceMYR: 420, amenity: 'Balinese spa', available: true },
  ],
};

const TRANSPORT_OFFERS: Record<string, TransportOffer[]> = {
  DPS: [
    { name: 'Bali Private Chauffeur', type: 'Private Car', priceMYR: 180, rating: 4.9, available: true, note: '8-hour English speaking driver' },
    { name: 'Blue Bird Taxi Premium', type: 'Taxi', priceMYR: 60, rating: 4.7, available: true, note: 'Fixed rate to Seminyak/Ubud' },
    { name: 'Grab', type: 'e-Hailing', priceMYR: 45, rating: 4.5, available: true, note: 'Standard transport' },
  ],
};

const DEFAULT_HOTELS: HotelOffer[] = [
  { name: 'Airport Transit Hotel', stars: 3, distance: 'At terminal', priceMYR: 280, amenity: 'Hourly rates', available: true, recommended: true },
];

const DEFAULT_TRANSPORT: TransportOffer[] = [
  { name: 'Local Taxi Service', type: 'Taxi', priceMYR: 50, rating: 4.0, available: true, note: 'Available at arrivals' },
];

// ─── Public API functions ──────────────────────────────────────────────────────

export async function searchHotels(airportRaw: string, excludeName?: string): Promise<HotelOffer[]> {
  await new Promise((r) => setTimeout(r, 200));
  const code = toIATA(airportRaw);
  const hotels = AIRPORT_HOTELS[code] ?? DEFAULT_HOTELS;
  return excludeName ? hotels.filter(h => h.name !== excludeName) : hotels;
}

export async function searchTransport(locationRaw: string, excludeName?: string): Promise<TransportOffer[]> {
  await new Promise((r) => setTimeout(r, 200));
  const code = toIATA(locationRaw);
  const transport = TRANSPORT_OFFERS[code] ?? DEFAULT_TRANSPORT;
  return excludeName ? transport.filter(t => t.name !== excludeName) : transport;
}

export async function checkCompensation(_disruptionType: string): Promise<CompensationResult> {
  await new Promise((r) => setTimeout(r, 100));
  return { eligible: true, amountEUR: 250, amountMYR: 1300, regulation: 'Consumer Protection Code', conditions: ['Delay of 3+ hours'], claimDeadline: '6 years' };
}

export async function executeTool(call: ToolCallPlan): Promise<ToolResult> {
  const p = call.params ?? {};
  switch (call.tool) {
    case 'search_flights':
      return {
        tool:   'search_flights',
        result: await searchFlights(
          String(p.from ?? p.origin ?? ''),
          String(p.to   ?? p.destination ?? ''),
          Number(p.count ?? 3),
        ),
      };
    case 'search_hotels':
      return {
        tool:   'search_hotels',
        result: await searchHotels(String(p.airport ?? p.from ?? p.origin ?? '')),
      };
    case 'search_transport': // 你的新逻辑
      return {
        tool:   'search_transport',
        result: await searchTransport(String(p.location ?? '')),
      };
    case 'check_compensation':
      return {
        tool:   'check_compensation',
        result: await checkCompensation(String(p.type ?? p.disruption_type ?? 'unknown')),
      };
    default:
      return {
        tool:   'check_compensation' as const,
        result: await checkCompensation('unknown'),
      };
  }
}