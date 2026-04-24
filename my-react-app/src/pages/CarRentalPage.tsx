import { useEffect, useState } from 'react';
import { 
  ArrowLeft, Calendar, User, X, MapPin,
  PlaneTakeoff, Loader2, CarFront, Briefcase, BadgeCheck, Gauge, Fuel, Cog, Star
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { auth, db } from '../services/firebase';
import { searchTransportOffers, toIATA, type TransportOffer } from '../services/mockTravelAPI';
import "../styles/CarRentalPage.css";

const AIRPORT_MAP_CENTERS: Record<string, { lat: number; lng: number }> = {
  KUL: { lat: 2.7456, lng: 101.7072 },
  SIN: { lat: 1.3644, lng: 103.9915 },
  NRT: { lat: 35.7767, lng: 140.3188 },
  HND: { lat: 35.5494, lng: 139.7798 },
  BKK: { lat: 13.6900, lng: 100.7501 },
  DPS: { lat: -8.7482, lng: 115.1670 },
  ICN: { lat: 37.4602, lng: 126.4407 },
  LHR: { lat: 51.4700, lng: -0.4543 },
};

const slugifyUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'guest';

export const CarRentalPage = ({ setView }: { setView: (v: string) => void }) => {
  // --- UI Navigation State ---
  const [mainTab, setMainTab] = useState('Transfers'); // 'Rentals' or 'Transfers'
  const [transferType, setTransferType] = useState('Pick-up'); // 'Pick-up' or 'Drop-off'
  const [viewMode, setViewMode] = useState<'search' | 'results'>('search');
  const [loading, setLoading] = useState(false);
  const [transportOffers, setTransportOffers] = useState<TransportOffer[]>([]);
  const [bookedFlights, setBookedFlights] = useState<any[]>([]);
  const [bookedHotels, setBookedHotels] = useState<any[]>([]);
  
  // --- Form Data States ---
  const [location, setLocation] = useState("Kuala Lumpur");
  const [pickupPoint, setPickupPoint] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [transferDest, setTransferDest] = useState("");
  const [destinationMode, setDestinationMode] = useState<'hotel' | 'manual'>('hotel');
  const [selectedHotelId, setSelectedHotelId] = useState('');
  const [pickupMode, setPickupMode] = useState<'hotel' | 'manual'>('hotel');
  const [selectedPickupHotelId, setSelectedPickupHotelId] = useState('');
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dates, setDates] = useState({ start: "22/04/2026", end: "23/04/2026" });
  const [seatCapacity, setSeatCapacity] = useState('5 Seats');
  const [driveType, setDriveType] = useState('Compact');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['GPS']);

  // --- Modal Toggles ---
  const [showDateModal, setShowDateModal] = useState(false);

  const featureOptions = ['Child Seat', 'GPS', 'Bluetooth', 'Large Boot'];
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'car-rental-map',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  useEffect(() => {
    let unsubscribeFlights = () => {};
    let unsubscribeHotels = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged((sessionUser) => {
      unsubscribeFlights();
      unsubscribeHotels();

      if (!sessionUser) {
        setBookedFlights([]);
        setBookedHotels([]);
        return;
      }

      const flightsQuery = query(
        collection(db, 'Booking'),
        where('userId', '==', sessionUser.uid),
        where('type', '==', 'flight')
      );

      unsubscribeFlights = onSnapshot(
        flightsQuery,
        (snapshot) => {
          const flights = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setBookedFlights(flights);
        },
        (error) => {
          console.error('Flight booking lookup failed:', error);
          setBookedFlights([]);
        }
      );

      const hotelsQuery = query(
        collection(db, 'Booking'),
        where('userId', '==', sessionUser.uid),
        where('type', '==', 'hotel')
      );

      unsubscribeHotels = onSnapshot(
        hotelsQuery,
        (snapshot) => {
          const hotels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setBookedHotels(hotels);
        },
        (error) => {
          console.error('Hotel booking lookup failed:', error);
          setBookedHotels([]);
        }
      );
    });

    return () => {
      unsubscribeFlights();
      unsubscribeHotels();
      unsubscribeAuth();
    };
  }, []);

  const toggleFeature = (item: string) => {
    setSelectedFeatures(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const formatDisplayDate = (value: string) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const parseBookingDate = (value?: string) => {
    if (!value) return null;

    const directDate = new Date(value);
    if (!Number.isNaN(directDate.getTime())) {
      directDate.setHours(0, 0, 0, 0);
      return directDate;
    }

    const normalized = value
      .replace(/\//g, ' ')
      .replace(/,/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parts = normalized.split(' ');
    if (parts.length !== 3) return null;

    const [dayRaw, monthRaw, yearRaw] = parts;
    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const day = Number(dayRaw);
    const year = Number(yearRaw);
    const month = monthMap[monthRaw.slice(0, 3).toLowerCase()];
    if (Number.isNaN(day) || Number.isNaN(year) || month === undefined) return null;

    const parsed = new Date(year, month, day);
    parsed.setHours(0, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calculateRentalDays = () => {
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const activeBookedFlights = bookedFlights.filter((flight) => {
    const status = String(flight.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'expired') {
      return false;
    }

    const bookingDate = parseBookingDate(flight.date);
    if (!bookingDate) {
      return true;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate >= today;
  });

  const selectedFlightBooking = activeBookedFlights.find((flight) => flight.flightNum === flightNum);

  const handleFlightSelect = (selectedValue: string) => {
    setFlightNum(selectedValue);
    const selectedBooking = activeBookedFlights.find((flight) => flight.flightNum === selectedValue);
    if (!selectedBooking) return;

    if (transferType === 'Pick-up' && selectedBooking.to) {
      setLocation(selectedBooking.to);
      setDates({ start: selectedBooking.date || dates.start, end: selectedBooking.date || dates.end });
      setPinLocation(AIRPORT_MAP_CENTERS[selectedBooking.to] ?? AIRPORT_MAP_CENTERS[toIATA(selectedBooking.to)] ?? null);
    }

    if (transferType === 'Drop-off' && selectedBooking.from) {
      setLocation(selectedBooking.from);
      setDates({ start: selectedBooking.date || dates.start, end: selectedBooking.date || dates.end });
      setPinLocation(AIRPORT_MAP_CENTERS[selectedBooking.from] ?? AIRPORT_MAP_CENTERS[toIATA(selectedBooking.from)] ?? null);
    }
  };

  const handleHotelSelect = (selectedValue: string) => {
    setSelectedHotelId(selectedValue);
    const selectedHotel = bookedHotels.find((hotel) => hotel.id === selectedValue);
    if (selectedHotel) {
      setTransferDest(selectedHotel.name || selectedHotel.hotelName || '');
    }
  };

  const handlePickupHotelSelect = (selectedValue: string) => {
    setSelectedPickupHotelId(selectedValue);
    const selectedHotel = bookedHotels.find((hotel) => hotel.id === selectedValue);
    if (selectedHotel) {
      setPickupPoint(selectedHotel.name || selectedHotel.hotelName || '');
    }
  };

  const getMapCenter = () => {
    const code = toIATA(location || 'KUL');
    return pinLocation ?? AIRPORT_MAP_CENTERS[code] ?? AIRPORT_MAP_CENTERS.KUL;
  };

  useEffect(() => {
    if (transferType !== 'Drop-off' || activeBookedFlights.length === 0) return;
    if (flightNum) return;

    const datedFlights = [...activeBookedFlights].sort((a, b) => {
      const aTime = new Date(a.date || '').getTime();
      const bTime = new Date(b.date || '').getTime();
      return bTime - aTime;
    });

    const preferredFlight = datedFlights[0];
    if (preferredFlight?.flightNum) {
      setFlightNum(preferredFlight.flightNum);
      if (preferredFlight.from) {
        setLocation(preferredFlight.from);
        setPinLocation(
          AIRPORT_MAP_CENTERS[preferredFlight.from] ??
          AIRPORT_MAP_CENTERS[toIATA(preferredFlight.from)] ??
          null
        );
      }
      if (preferredFlight.date) {
        setDates({ start: preferredFlight.date, end: preferredFlight.date });
      }
    }
  }, [transferType, activeBookedFlights, flightNum]);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const nextPin = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    setPinLocation(nextPin);
    setDestinationMode('manual');
    setSelectedHotelId('');
    setTransferDest(`Pinned location (${nextPin.lat.toFixed(4)}, ${nextPin.lng.toFixed(4)})`);
  };

  const handleSearch = async () => {
    if (!location.trim()) {
      alert('Please enter an airport or city.');
      return;
    }

    if (mainTab === 'Transfers' && transferType === 'Pick-up' && !transferDest.trim()) {
      alert('Please enter your destination.');
      return;
    }

    if (mainTab === 'Transfers' && transferType === 'Drop-off' && !pickupPoint.trim()) {
      alert('Please enter your pick-up point.');
      return;
    }

    setLoading(true);
    try {
      const offers = await searchTransportOffers({
        mode:
          mainTab === 'Rentals'
            ? 'rental'
            : transferType === 'Pick-up'
              ? 'pickup'
              : 'dropoff',
        location,
        startDate: dates.start,
        endDate: dates.end,
        rentalDays: mainTab === 'Rentals' ? calculateRentalDays() : undefined,
        pickupPoint,
        destination: transferDest,
        flightNum,
      });
      setTransportOffers(offers);
      setViewMode('results');
    } catch (error) {
      console.error('Transport mock search failed:', error);
      alert('Unable to load transport options right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (offer: TransportOffer) => {
    const sessionUser = auth.currentUser;
    if (!sessionUser) {
      alert('Please log in to book transport.');
      return;
    }

    const userId = sessionUser.uid;
    const passengerName =
      sessionUser.displayName?.trim() ||
      sessionUser.email?.split('@')[0] ||
      'Guest';
    const usernameSlug = slugifyUsername(
      sessionUser.displayName?.trim() ||
      sessionUser.email?.split('@')[0] ||
      'guest'
    );
    const bookingDate = formatDisplayDate(dates.start) || '23 Apr 2026';
    const transportPickupPoint =
      mainTab === 'Rentals'
        ? offer.pickupLabel
        : transferType === 'Pick-up'
          ? (selectedFlightBooking?.to || location || offer.pickupLabel)
          : (pickupPoint || offer.pickupLabel);
    const transportDestination =
      mainTab === 'Rentals'
        ? offer.dropoffLabel
        : transferType === 'Pick-up'
          ? (transferDest || offer.dropoffLabel)
          : (selectedFlightBooking?.from || location || offer.dropoffLabel);
    const transportDistance = offer.routeDistance || (mainTab === 'Rentals' ? '' : '12-15 km');

    try {
      const existingTransportQuery = query(
        collection(db, 'Booking'),
        where('userId', '==', userId),
        where('type', '==', 'transport')
      );
      const existingTransportSnap = await getDocs(existingTransportQuery);
      const nextSequence =
        existingTransportSnap.docs.reduce((highest, bookingDoc) => {
          const match = bookingDoc.id.match(/^car_[a-z0-9_]+_(\d+)$/i);
          if (!match) return highest;
          return Math.max(highest, Number(match[1]));
        }, 0) + 1;

      let resolvedSequence = nextSequence;
      let documentId = `car_${usernameSlug}_${String(resolvedSequence).padStart(3, '0')}`;
      let bookingRef = doc(db, 'Booking', documentId);
      let bookingSnap = await getDoc(bookingRef);

      while (bookingSnap.exists()) {
        resolvedSequence += 1;
        documentId = `car_${usernameSlug}_${String(resolvedSequence).padStart(3, '0')}`;
        bookingRef = doc(db, 'Booking', documentId);
        bookingSnap = await getDoc(bookingRef);
      }

      await setDoc(bookingRef, {
        bookingNum: `TP${Math.floor(1000 + Math.random() * 9000)}`,
        carType: offer.model ? `${offer.model} (${offer.carType})` : offer.carType,
        company: offer.company,
        date: bookingDate,
        driverName: offer.driverName,
        driverPhone: offer.driverPhone,
        hasNotification: true,
        imageUrl: offer.imageUrl,
        name: mainTab === 'Rentals' ? (offer.model ?? offer.name) : offer.name,
        passenger: passengerName,
        plateNum: offer.plateNum,
        price: offer.price,
        pickupPoint: transportPickupPoint,
        destination: transportDestination,
        distance: transportDistance,
        status: 'upcoming',
        transportMode:
          mainTab === 'Rentals'
            ? 'rental'
            : transferType === 'Pick-up'
              ? 'pickup'
              : 'dropoff',
        type: 'transport',
        userId,
      });
      alert(`Booked ${offer.name} successfully.`);
      setView('booking');
    } catch (error) {
      console.error('Transport booking save failed:', error);
      alert('Failed to save transport booking.');
    }
  };

  if (viewMode === 'results') {
    const rentalDays = calculateRentalDays();
    const transferMeta =
      transferType === 'Pick-up'
        ? `${selectedFlightBooking?.date || formatDisplayDate(dates.start)}${selectedFlightBooking?.timeLanding ? ` • ETA ${selectedFlightBooking.timeLanding}` : ''}`
        : `${selectedFlightBooking?.date || formatDisplayDate(dates.start)}${selectedFlightBooking?.timeDepart ? ` • Flight ${selectedFlightBooking.timeDepart}` : ''}`;
    return (
      <div className="home-page fade-in">
        <header className="home-header">
          <ArrowLeft onClick={() => setViewMode('search')} style={{ cursor: 'pointer', marginRight: '10px' }} />
          ZenTravel
        </header>

        <main className="rental-container">
          <div className="transport-results-header">
            <p className="transport-eyebrow">
              {mainTab === 'Rentals' ? 'Car rentals' : `Airport ${transferType.toLowerCase()}`}
            </p>
            <h2 className="section-title" style={{ marginBottom: '8px' }}>{location}</h2>
            <p className="transport-meta">
              {mainTab === 'Rentals'
                ? `${rentalDays} rental day${rentalDays > 1 ? 's' : ''} • self-drive catalogue`
                : transferMeta}
            </p>
          </div>

          {mainTab === 'Rentals' && (
            <div className="car-results-banner">
              <h3>Available Cars</h3>
              <p>Choose your self-drive rental car with full specs, photo, and price per day.</p>
            </div>
          )}

          <div className={`transport-results-list ${mainTab === 'Rentals' ? 'car-results-list' : ''}`}>
            {transportOffers.map((offer) => (
              <article key={offer.id} className={`transport-card ${mainTab === 'Rentals' ? 'car-catalog-card' : ''}`}>
                <img src={offer.imageUrl} alt={offer.name} className="transport-card-image" />
                <div className="transport-card-body">
                  <div className="transport-card-top">
                    <div>
                      <div className="transport-brand-row">
                        <h3>{mainTab === 'Rentals' ? (offer.model ?? offer.name) : offer.name}</h3>
                        {offer.recommended && (
                          <span className="transport-badge"><BadgeCheck size={14} /> Recommended</span>
                        )}
                      </div>
                      {mainTab === 'Rentals' && (
                        <p className="transport-provider">Provider: {offer.name}</p>
                      )}
                      <p className="transport-summary">{offer.summary}</p>
                    </div>
                    <div className="transport-price-box">
                      <span className="transport-price">
                        RM {mainTab === 'Rentals'
                          ? Math.round(offer.price / Math.max(1, offer.rentalDays ?? rentalDays))
                          : offer.price}
                      </span>
                      <span className="transport-price-caption">
                        {mainTab === 'Rentals'
                          ? 'per day'
                          : 'per booking'}
                      </span>
                    </div>
                  </div>

                  <div className="transport-specs">
                    <span><CarFront size={15} /> {offer.carType}</span>
                    <span><User size={15} /> {offer.seats} seats</span>
                    <span><Briefcase size={15} /> {offer.bags} bags</span>
                    {mainTab === 'Rentals' && offer.transmission && (
                      <span><Cog size={15} /> {offer.transmission}</span>
                    )}
                    {mainTab === 'Rentals' && offer.fuelType && (
                      <span><Fuel size={15} /> {offer.fuelType}</span>
                    )}
                  </div>

                  {mainTab !== 'Rentals' && (
                    <div className="transport-transfer-highlights">
                      <span>
                        <MapPin size={15} />
                        {offer.routeDistance ?? (transferType === 'Pick-up' ? '12-15 km from airport' : '12-15 km to airport')}
                      </span>
                      <span><Star size={15} /> Driver rating {offer.driverRating?.toFixed(1) ?? '4.8'}</span>
                    </div>
                  )}

                  <div className="transport-route-box">
                    <div>
                      <label>{mainTab === 'Rentals' ? 'Collection' : 'Pick-up'}</label>
                      <p>{offer.pickupLabel}</p>
                    </div>
                    <div>
                      <label>{mainTab === 'Rentals' ? 'Return' : 'Drop-off'}</label>
                      <p>{offer.dropoffLabel}</p>
                    </div>
                    <div>
                      <label>{mainTab === 'Rentals' ? 'Vehicle Ref' : (transferType === 'Pick-up' ? 'ETA' : 'Flight')}</label>
                      <p>{mainTab === 'Rentals' ? offer.plateNum : (transferType === 'Pick-up' ? (selectedFlightBooking?.timeLanding || 'ETA pending') : (selectedFlightBooking?.timeDepart || 'Schedule pending'))}</p>
                    </div>
                  </div>

                  {mainTab === 'Rentals' && (
                    <div className="transport-catalogue-row">
                      <div>
                        <label>Model</label>
                        <p>{offer.model}</p>
                      </div>
                      <div>
                        <label>Daily Rate</label>
                        <p>RM {Math.round(offer.price / Math.max(1, offer.rentalDays ?? rentalDays))}</p>
                      </div>
                      <div>
                        <label>Total</label>
                        <p>RM {offer.price}</p>
                      </div>
                      <div>
                        <label>Usage</label>
                        <p><Gauge size={14} /> Self-drive</p>
                      </div>
                    </div>
                  )}

                  <button className="transport-book-btn" onClick={() => handleBooking(offer)}>
                    <span className="transport-book-btn__label">
                      {mainTab === 'Rentals' ? 'Book Car Rental' : 'Book Transport'}
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home-page fade-in">
      <header className="home-header">
        <ArrowLeft onClick={() => setView('home')} style={{ cursor: 'pointer', marginRight: '10px' }} />
        ZenTravel
      </header>

      <main className="rental-container">
        <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>Transportation</p>

        {/* Main Tabs Selection */}
        <div className="main-tabs">
          <button 
            className={`tab-btn ${mainTab === 'Transfers' ? 'active' : ''}`}
            onClick={() => setMainTab('Transfers')}
          >
            Airport Pick-up
          </button>
          <button 
            className={`tab-btn ${mainTab === 'Rentals' ? 'active' : ''}`}
            onClick={() => setMainTab('Rentals')}
          >
            Car Rental
          </button>
        </div>

        <div className="rental-form-card">
          {mainTab === 'Rentals' ? (
            /* --- RENTALS VIEW --- */
            <>
              <label className="rental-label-purple">Airport or City</label>
              <div className="input-with-icon">
                <MapPin size={22} color="#7b2cbf" />
                <input 
                  type="text" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  placeholder="Where to pick up?"
                />
              </div>

              <label className="rental-label-purple">Rental Duration</label>
              <div className="rental-display-box" onClick={() => setShowDateModal(true)}>
                <Calendar size={22} color="#7b2cbf" />
                <span className="rental-display-text">{dates.start} - {dates.end}</span>
              </div>

              <label className="rental-label-purple">Car Requirements</label>
              <div className="requirements-card">
                <div className="requirement-group">
                  <label className="requirement-label">Capacity</label>
                  <div className="requirement-select-wrap">
                    <select
                      className="requirement-select"
                      value={seatCapacity}
                      onChange={(e) => setSeatCapacity(e.target.value)}
                    >
                      <option>5 Seats</option>
                      <option>7 Seats</option>
                    </select>
                  </div>
                </div>

                <div className="requirement-group">
                  <label className="requirement-label">Drive Type</label>
                  <div className="requirement-select-wrap">
                    <select
                      className="requirement-select"
                      value={driveType}
                      onChange={(e) => setDriveType(e.target.value)}
                    >
                      <option>Compact</option>
                      <option>SUV</option>
                      <option>4 Wheel Drive</option>
                      <option>Premium</option>
                    </select>
                  </div>
                </div>

                <div className="requirement-group">
                  <label className="requirement-label">Features (Optional)</label>
                  <div className="feature-checkboxes">
                    {featureOptions.map((feature) => (
                      <label key={feature} className="feature-check">
                        <input
                          type="checkbox"
                          checked={selectedFeatures.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                        />
                        <span>{feature}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* --- AIRPORT TRANSFERS VIEW --- */
            <>
              <div className="sub-tabs">
                <button 
                  className={`sub-tab-btn ${transferType === 'Pick-up' ? 'active' : ''}`}
                  onClick={() => setTransferType('Pick-up')}
                >
                  Airport pick-up
                </button>
                <button 
                  className={`sub-tab-btn ${transferType === 'Drop-off' ? 'active' : ''}`}
                  onClick={() => setTransferType('Drop-off')}
                >
                  Airport drop-off
                </button>
              </div>

              <div style={{ marginTop: '20px' }}>
                {transferType === 'Pick-up' ? (
                  <>
                    <label className="rental-label-purple">Arrival airport or city</label>
                    <div className="input-with-icon">
                      <PlaneTakeoff size={22} color="#7b2cbf" />
                      <input 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Airport Name" 
                      />
                    </div>
                    <label className="rental-label-purple">Which flight?</label>
                    <div className="requirement-select-wrap">
                      <select
                        className="requirement-select rental-flight-select"
                        value={flightNum}
                        onChange={(e) => handleFlightSelect(e.target.value)}
                      >
                        <option value="">
                          {activeBookedFlights.length > 0 ? 'Select a booked flight' : 'No active booked flights found'}
                        </option>
                        {activeBookedFlights.map((flight) => (
                          <option key={flight.id} value={flight.flightNum}>
                            {flight.flightNum} - {flight.from} to {flight.to} ({flight.date || 'Booked flight'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="rental-label-purple">Destination</label>
                    <div className="destination-toggle-row">
                      <button
                        type="button"
                        className={`destination-toggle-btn ${destinationMode === 'hotel' ? 'active' : ''}`}
                        onClick={() => setDestinationMode('hotel')}
                      >
                        Booked Hotel
                      </button>
                      <button
                        type="button"
                        className={`destination-toggle-btn ${destinationMode === 'manual' ? 'active' : ''}`}
                        onClick={() => setDestinationMode('manual')}
                      >
                        Manual Address
                      </button>
                    </div>
                    {destinationMode === 'hotel' ? (
                      <div className="requirement-select-wrap">
                        <select
                          className="requirement-select rental-flight-select"
                          value={selectedHotelId}
                          onChange={(e) => handleHotelSelect(e.target.value)}
                        >
                          <option value="">
                            {bookedHotels.length > 0 ? 'Select a booked hotel' : 'No booked hotels found'}
                          </option>
                          {bookedHotels.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {(hotel.name || hotel.hotelName)} ({hotel.date || 'Booked stay'})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input 
                        className="rental-input-field" 
                        placeholder="Hotel or Address" 
                        value={transferDest}
                        onChange={(e) => {
                          setSelectedHotelId('');
                          setTransferDest(e.target.value);
                        }}
                      />
                    )}
                    <div className="pickup-map-card">
                      <div className="pickup-map-copy">
                        <span>Pin destination on map</span>
                        <p>The map defaults to the airport area based on your arrival location.</p>
                      </div>
                      <div className="pickup-map-frame">
                        {isMapLoaded ? (
                          <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={getMapCenter()}
                            zoom={12}
                            onClick={handleMapClick}
                            options={{ disableDefaultUI: true, clickableIcons: false }}
                          >
                            {pinLocation && <Marker position={pinLocation} />}
                          </GoogleMap>
                        ) : (
                          <div className="pickup-map-placeholder">Loading map...</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="rental-label-purple">Which return flight?</label>
                    <div className="requirement-select-wrap">
                      <select
                        className="requirement-select rental-flight-select"
                        value={flightNum}
                        onChange={(e) => handleFlightSelect(e.target.value)}
                      >
                        <option value="">
                          {activeBookedFlights.length > 0 ? 'Select a booked return flight' : 'No active booked flights found'}
                        </option>
                        {activeBookedFlights.map((flight) => (
                          <option key={flight.id} value={flight.flightNum}>
                            {flight.flightNum} - {flight.from} to {flight.to} ({flight.date || 'Booked flight'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="rental-label-purple">Where from?</label>
                    <div className="destination-toggle-row">
                      <button
                        type="button"
                        className={`destination-toggle-btn ${pickupMode === 'hotel' ? 'active' : ''}`}
                        onClick={() => setPickupMode('hotel')}
                      >
                        Booked Hotel
                      </button>
                      <button
                        type="button"
                        className={`destination-toggle-btn ${pickupMode === 'manual' ? 'active' : ''}`}
                        onClick={() => setPickupMode('manual')}
                      >
                        Manual Input
                      </button>
                    </div>
                    {pickupMode === 'hotel' ? (
                      <div className="requirement-select-wrap">
                        <select
                          className="requirement-select rental-flight-select"
                          value={selectedPickupHotelId}
                          onChange={(e) => handlePickupHotelSelect(e.target.value)}
                        >
                          <option value="">
                            {bookedHotels.length > 0 ? 'Select a booked hotel' : 'No booked hotels found'}
                          </option>
                          {bookedHotels.map((hotel) => (
                            <option key={hotel.id} value={hotel.id}>
                              {(hotel.name || hotel.hotelName)} ({hotel.date || 'Booked stay'})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input 
                        className="rental-input-field" 
                        placeholder="Pick-up point" 
                        value={pickupPoint}
                        onChange={(e) => {
                          setSelectedPickupHotelId('');
                          setPickupPoint(e.target.value);
                        }}
                      />
                    )}
                    <label className="rental-label-purple">Airport or city</label>
                    <div className="input-with-icon">
                      <PlaneTakeoff size={22} color="#7b2cbf" />
                      <input 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Airport Name" 
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <button className="car-search-btn" onClick={handleSearch} disabled={loading}>
            <span className="car-search-btn__icon">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <CarFront size={18} />}
            </span>
            <span className="car-search-btn__title">
              {loading ? 'Searching...' : 'Search Car'}
            </span>
          </button>
        </div>
      </main>

      {/* --- MODAL: Date Picker --- */}
      {showDateModal && (
        <div className="modal-overlay" onClick={() => setShowDateModal(false)}>
          <div className="modal-card guest-modal" onClick={e => e.stopPropagation()}>
            <X className="close-icon" onClick={() => setShowDateModal(false)} />
            <h3>Select Dates</h3>
            <div className="date-input-group">
              <label>Pick-up Date</label>
              <input
                type="date"
                value={dates.start}
                onChange={(e) => setDates({ ...dates, start: e.target.value })}
              />
              <label>Drop-off Date</label>
              <input
                type="date"
                value={dates.end}
                onChange={(e) => setDates({ ...dates, end: e.target.value })}
              />
            </div>
            <button className="modal-action-btn" onClick={() => setShowDateModal(false)}>Confirm</button>
          </div>
        </div>
      )}

    </div>
  );
};
