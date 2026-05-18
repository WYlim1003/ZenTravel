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
  id: string;
  name: string;
  company: string;
  imageUrl: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  model?: string;
  carType: string;
  transmission?: string;
  fuelType?: string;
  routeDistance?: string;
  plateNum: string;
  price: number;
  seats: number;
  bags: number;
  rentalDays?: number;
  pickupLabel: string;
  dropoffLabel: string;
  summary: string;
  recommended?: boolean;
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
  const totalMins = h * 60 + m + durationMins;
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
  { name: 'Airport Transit Hotel',   stars: 3, distance: 'At terminal',     priceMYR: 280, amenity: 'Hourly & nightly rates', available: true, recommended: true },
  { name: 'Ibis Airport Hotel',      stars: 3, distance: '5-min shuttle',   priceMYR: 320, amenity: 'Restaurant & bar on-site', available: true },
  { name: 'Novotel Airport Hotel',   stars: 4, distance: '10-min free bus', priceMYR: 490, amenity: 'Pool, gym, free cancellation', available: true },
];

const TRANSPORT_COMPANIES = [
  {
    name: 'Grab',
    company: 'https://logo.clearbit.com/grab.com',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'AirAsia Ride',
    company: 'https://logo.clearbit.com/airasia.com',
    imageUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Klook Transfer',
    company: 'https://logo.clearbit.com/klook.com',
    imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Traveloka Cars',
    company: 'https://logo.clearbit.com/traveloka.com',
    imageUrl: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=900&q=80',
  },
];

const TRANSPORT_PROFILES = [
  { carType: 'sedan car', seats: 4, bags: 2, basePrice: 70, platePrefix: 'PJN' },
  { carType: 'mpv', seats: 6, bags: 4, basePrice: 110, platePrefix: 'VKL' },
  { carType: 'premium suv', seats: 5, bags: 3, basePrice: 165, platePrefix: 'WXX' },
];

// ─── Compensation rules ────────────────────────────────────────────────────────

const COMPENSATION: Record<string, CompensationResult> = {
  cancellation: {
    eligible:      true,
    amountEUR:     600,
    amountMYR:     3000,
    regulation:    'EU Regulation 261/2004 / Malaysia Aviation Consumer Protection Code 2016',
    conditions:    [
      'Cancellation notified less than 14 days before departure',
      'Not caused by extraordinary circumstances (weather, ATC strikes)',
      'Carrier must offer rerouting or full refund',
    ],
    claimDeadline: '6 years (Malaysia) / 3 years (EU)',
  },
  delay: {
    eligible:      true,
    amountEUR:     250,
    amountMYR:     1300,
    regulation:    'EU Regulation 261/2004 / Malaysia Aviation Consumer Protection Code 2016',
    conditions:    [
      'Delay of 3+ hours at final destination',
      'Not caused by extraordinary circumstances',
      'Carrier must provide meals, refreshments, accommodation if overnight',
    ],
    claimDeadline: '6 years (Malaysia) / 3 years (EU)',
  },
  lost_luggage: {
    eligible:      true,
    amountEUR:     1300,
    amountMYR:     6500,
    regulation:    'Montreal Convention 1999 — Article 22',
    conditions:    [
      'File Property Irregularity Report (PIR) at airport before leaving baggage claim',
      'Submit formal claim within 21 days for delayed, 7 days for damaged baggage',
      'Keep all receipts for essential purchases during delay',
    ],
    claimDeadline: '2 years from arrival date',
  },
};

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

export async function searchTransportOffers(params: {
  mode: 'rental' | 'pickup' | 'dropoff';
  location: string;
  startDate?: string;
  endDate?: string;
  rentalDays?: number;
  pickupPoint?: string;
  destination?: string;
  flightNum?: string;
}): Promise<TransportOffer[]> {
  await new Promise((r) => setTimeout(r, 250));

  const normalizedLocation = params.location.trim() || 'Kuala Lumpur';
  const pickupLabel =
    params.mode === 'dropoff'
      ? (params.pickupPoint?.trim() || 'City Centre Pick-up')
      : params.mode === 'pickup'
        ? `${normalizedLocation} Airport`
        : `${normalizedLocation} Pick-up Hub`;

  const dropoffLabel =
    params.mode === 'pickup'
      ? (params.destination?.trim() || `${normalizedLocation} City Centre`)
      : params.mode === 'dropoff'
        ? `${normalizedLocation} Airport`
        : `${normalizedLocation} Return Hub`;

  const rentalDays = Math.max(1, params.rentalDays ?? 1);

  return TRANSPORT_COMPANIES.slice(0, 3).map((companyInfo, index) => {
    const profile = TRANSPORT_PROFILES[index % TRANSPORT_PROFILES.length];
    const routeFactor = normalizedLocation.length % 7;
    const modeFactor = params.mode === 'rental' ? 1.25 : params.mode === 'pickup' ? 1 : 1.1;
    const basePrice = Math.round((profile.basePrice + routeFactor * 6 + index * 12) * modeFactor);
    const price = params.mode === 'rental' ? basePrice * rentalDays : basePrice;
    const model =
      index === 0 ? 'Perodua Bezza 1.3 AV'
      : index === 1 ? 'Toyota Innova 2.0 G'
      : 'Honda CR-V 1.5 TC';
    const transmission = index === 0 ? 'Automatic' : 'Automatic';
    const fuelType = index === 2 ? 'Petrol Turbo' : 'Petrol';
    const driverName = index === 0 ? 'Aiman' : index === 1 ? 'Farah' : 'Daniel';
    const driverPhone = `+60 12-88${index + 2} ${6500 + index * 37}`;
    const driverRating = Number((4.6 + index * 0.15).toFixed(1));
    const routeDistanceKm = 8 + routeFactor * 3 + index * 4;
    const routeDistance =
      params.mode === 'rental'
        ? undefined
        : `${routeDistanceKm}-${routeDistanceKm + 3} km from airport`;

    return {
      id: `${params.mode}-${index + 1}`,
      name: companyInfo.name,
      company: companyInfo.company,
      imageUrl: companyInfo.imageUrl,
      driverName,
      driverPhone,
      driverRating,
      model,
      carType: profile.carType,
      transmission,
      fuelType,
      routeDistance,
      plateNum: `${profile.platePrefix} ${6500 + index * 37}`,
      price,
      seats: profile.seats,
      bags: profile.bags,
      rentalDays: params.mode === 'rental' ? rentalDays : undefined,
      pickupLabel,
      dropoffLabel,
      summary:
        params.mode === 'rental'
          ? `${profile.carType} for self-drive travel around ${normalizedLocation}, priced for ${rentalDays} day${rentalDays > 1 ? 's' : ''}.`
          : params.mode === 'pickup'
            ? `Airport meet-and-greet${params.flightNum ? ` for ${params.flightNum.toUpperCase()}` : ''} with direct transfer to your destination.`
            : `Private transfer from ${pickupLabel} to ${dropoffLabel}.`,
      recommended: index === 0,
    };
  });
}

export async function checkCompensation(disruptionType: string): Promise<CompensationResult> {
  await new Promise((r) => setTimeout(r, 100));
  const type = disruptionType.toLowerCase();
  return COMPENSATION[type] || COMPENSATION['delay'];
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
