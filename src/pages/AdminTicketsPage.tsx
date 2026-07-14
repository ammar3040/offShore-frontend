import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  Download,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  Plane,
  Plus,
  Search,
  Ticket as TicketIcon,
  Trash2,
  X,
  Ban,
  CircleDollarSign,
  User,
  Briefcase,
  CheckCircle2,
  Anchor,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { SubseaNavRail } from '@/components/SubseaNavRail';
import { SubseaProfileMenu } from '@/components/SubseaProfileMenu';
import { SUBSEA_FORM_LIGHT_CLASS } from '@/lib/subseaTheme';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewEnrolledInProject, getCrewList, getBulkCrewAvailabilitiesAdmin, type CrewMemberApi } from '../api/crew';
import {
  crewStatusTierDotClass,
  crewStatusTierLabel,
  crewStatusTierBadgeClass,
} from '../utils/crewAvailability';
import {
  getCrewTickets,
  createFlightTicket,
  cancelCrewTicket,
  canUseTicketPdf,
  previewCrewTicketPdf,
  type CreateFlightTicketPayload,
  type AirportLocation,
  type CrewTicketApi,
  getTicketStatus,
  getTicketStatusLabel,
  getTicketApprovalStatusLabel,
  isTicketCancelled,
  normalizeCrewTicket,
  isCrewTicketCreatedInLocalCalendarMonth,
  parseCrewTicketCreatedAt,
} from '../api/ticket';
import { getAdminProfile } from '../api/admin';
import { searchFlights, bookFlight } from '../api/flightSearch';
import { searchAirportsApi } from '../api/airports';
import { AIRPORTS, getAirportDisplayName, searchAirports } from '../lib/airports';
import type {
  Airport,
  Flight,
  Fare,
  SearchPayload,
  CabinClass,
  CurrencyCode,
  FlightSortBy,
  FlightSortOrder,
} from '../types/flight';
import { DatePickerTime } from '@/components/ui/date-picker-time';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  collectTicketSegmentDisplays,
  getTicketArrivalSummary,
  getTicketDepartureSummary,
  getTicketPrimaryAirline,
  getTicketTotalDuration,
} from '../lib/crewTicket/ticketFlightDetails';
import {
  findCrewTravelConflicts,
  getTravelDateRange,
  type CrewTravelConflict,
} from '../utils/crewAvailabilityForDates';
import './AdminTicketsPage.css';
import './RigsPage.css';

type ModalStep = 'project' | 'crew' | 'form';
type TicketsTab = 'tickets' | 'search' | 'spends';
type StatusFilter = 'all' | 'pending' | 'approved' | 'cancelled';

/** Search tab trip UI; API uses SearchPayload tripType (`multi-city` maps to `one-way` per leg). */
type SearchUITripType = 'one-way' | 'round-trip' | 'multi-city';
type FlightSortValue = `${FlightSortBy}:${FlightSortOrder}`;

const MAX_MULTI_SEGMENTS = 6;
const RECENT_BOOKINGS_PAGE_SIZE = 6;

type MultiFlightSegment = {
  id: string;
  from: Airport | null;
  to: Airport | null;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
};

function newSegmentId(): string {
  return `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isFlightNonStop(flight: Flight): boolean {
  const firstLeg = flight.legs?.[0];
  const stops = (flight as { stops?: number }).stops ?? firstLeg?.stops ?? 0;
  return stops === 0;
}

const TRIP_OPTIONS: Array<{ value: CreateFlightTicketPayload['trip']; label: string }> = [
  { value: 'ONE_WAY', label: 'One way' },
  { value: 'ROUND_TRIP', label: 'Round trip' },
];

const CLASS_OPTIONS: Array<{ value: CreateFlightTicketPayload['class']; label: string }> = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const CABIN_OPTIONS: Array<{ value: CabinClass; label: string }> = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'INR', label: 'INR' },
];

const FLIGHT_SORT_OPTIONS: Array<{ value: FlightSortValue; label: string }> = [
  { value: 'price:asc', label: 'Price: low to high' },
  { value: 'price:desc', label: 'Price: high to low' },
  { value: 'duration:asc', label: 'Duration: shortest first' },
  { value: 'duration:desc', label: 'Duration: longest first' },
  { value: 'stops:asc', label: 'Stops: fewest first' },
  { value: 'stops:desc', label: 'Stops: most first' },
  { value: 'departureTime:asc', label: 'Departure: earliest first' },
  { value: 'departureTime:desc', label: 'Departure: latest first' },
  { value: 'arrivalTime:asc', label: 'Arrival: earliest first' },
  { value: 'arrivalTime:desc', label: 'Arrival: latest first' },
];

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  GBP: '£',
  INR: '₹',
};

function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isCrewTicketCreatedInPreviousLocalCalendarMonth(t: CrewTicketApi, now = new Date()): boolean {
  const d = parseCrewTicketCreatedAt(t);
  if (!d) return false;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
}

function formatTicketClass(cls?: string): string {
  if (!cls?.trim()) return 'Unspecified';
  return cls
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumPricedTickets(tickets: CrewTicketApi[]): { total: number; count: number; average: number } {
  const priced = tickets.filter((ticket) => typeof ticket.price === 'number');
  const total = priced.reduce((sum, ticket) => sum + (ticket.price ?? 0), 0);
  return {
    total,
    count: priced.length,
    average: priced.length ? total / priced.length : 0,
  };
}

const METRIC_BAR_COLORS = ['blue', 'teal', 'amber', 'green', 'blue'] as const;

function initialMultiSegments(): MultiFlightSegment[] {
  const a0 = AIRPORTS[0] ?? null;
  const a1 = AIRPORTS[1] ?? null;
  return [
    {
      id: newSegmentId(),
      from: a0,
      to: a1,
      departureDate: '',
      departureTime: '',
      arrivalDate: '',
      arrivalTime: '',
    },
    {
      id: newSegmentId(),
      from: a1,
      to: a0,
      departureDate: '',
      departureTime: '',
      arrivalDate: '',
      arrivalTime: '',
    },
  ];
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

/** True when the API sent a full datetime (not bare HH:mm). */
function hasParseableDate(value: string): boolean {
  if (!value?.trim()) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value.trim())) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function parseFlightDateTime(value: string): Date | null {
  if (!hasParseableDate(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar nights between departure and arrival (e.g. 48h Mon→Wed = 2 overnights). */
function countFlightOvernights(departureIso: string, arrivalIso: string): number {
  const departure = parseFlightDateTime(departureIso);
  const arrival = parseFlightDateTime(arrivalIso);
  if (!departure || !arrival || arrival <= departure) return 0;

  const depDay = Date.UTC(departure.getFullYear(), departure.getMonth(), departure.getDate());
  const arrDay = Date.UTC(arrival.getFullYear(), arrival.getMonth(), arrival.getDate());
  const dayDiff = Math.round((arrDay - depDay) / 86_400_000);
  return Math.max(0, dayDiff);
}

const SEARCH_DEBOUNCE_MS = 300;

const SEARCH_DROPDOWN_CONTENT_CLASS =
  'admin-tickets-search-overlay w-[var(--radix-dropdown-menu-trigger-width)] max-h-[260px] overflow-y-auto';

const SEARCH_SELECT_CONTENT_CLASS = 'admin-tickets-search-overlay';

function SearchFieldClearButton({
  visible,
  onClear,
  label,
}: {
  visible: boolean;
  onClear: () => void;
  label: string;
}) {
  if (!visible) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      className="admin-tickets-search-clear-inline"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClear();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          e.preventDefault();
          onClear();
        }
      }}
      title="Clear"
      aria-label={label}
    >
      <X size={14} />
    </span>
  );
}

function getAirportCode(airport: Airport): string {
  if (airport.Code) return airport.Code;
  const match = airport.Name.match(/\[([A-Z0-9]{3})\]/);
  return match?.[1] ?? '';
}

function getAirportPrimaryLabel(airport: Airport): string {
  const displayName = getAirportDisplayName(airport);
  return airport.AirportName || displayName.split(' - ')[1]?.split(',')[0]?.trim() || displayName;
}

function getAirportSecondaryLabel(airport: Airport): string {
  const cityName = airport.CityName || getAirportDisplayName(airport).split(' - ')[0]?.trim();
  const countryName = airport.COUNTRYNAME ? `, ${airport.COUNTRYNAME}` : '';
  return `${cityName}${countryName}`;
}

function getAirportDistanceLabel(airport: Airport): string {
  if (typeof airport.distanceKm !== 'number') return '';
  return `${Math.round(airport.distanceKm)} km`;
}

function airportMatchesQuery(airport: Airport, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    airport.Name,
    airport.COUNTRY,
    airport.COUNTRYNAME,
    airport.Code,
    airport.CityName,
    airport.AirportName,
  ].some((value) => value?.toLowerCase().includes(q));
}

function AirportCombobox({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [apiAirports, setApiAirports] = useState<Airport[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const tid = setTimeout(() => setApiAirports([]), 0);
      return () => clearTimeout(tid);
    }
    const tid = setTimeout(async () => {
      const results = await searchAirportsApi(q);
      setApiAirports(results);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(tid);
  }, [query]);

  const filtered = useMemo(() => {
    const staticFiltered = searchAirports(query);
    const apiFiltered = apiAirports.filter(
      (apiA) =>
        airportMatchesQuery(apiA, query) &&
        !staticFiltered.some((s) => s.Name === apiA.Name)
    );
    return [...staticFiltered, ...apiFiltered];
  }, [query, apiAirports]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayValue = value ? getAirportDisplayName(value) : '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
    if (value) onChange(null);
  };

  const handleFocus = () => {
    setOpen(true);
    if (value) {
      setQuery('');
    }
  };

  const handleSelect = (airport: Airport) => {
    onChange(airport);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="airport-combobox" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="airport-combobox-input"
        value={open ? query : displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder="Type city, code or airport…"
        autoComplete="off"
        ref={inputRef}
      />
      {open && (
        <ul className="airport-combobox-dropdown">
          {filtered.length === 0 ? (
            <li className="airport-combobox-empty">No airports found</li>
          ) : (
            filtered.map((a) => {
              const nearby = a.nearbyAirports ?? [];
              const code = getAirportCode(a);

              return (
                <li key={a.Name} className="airport-combobox-group">
                  <button
                    type="button"
                    className={'airport-combobox-option airport-combobox-option-main' + (value?.Name === a.Name ? ' airport-combobox-option-active' : '')}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(a)}
                  >
                    <span className="airport-combobox-code">{code || 'AIR'}</span>
                    <span className="airport-combobox-option-text">
                      <span className="airport-combobox-option-name">{getAirportDisplayName(a)}</span>
                      <span className="airport-combobox-option-country">{a.COUNTRYNAME}</span>
                    </span>
                  </button>
                  {nearby.length > 0 ? (
                    <>
                      <div className="airport-combobox-nearby-heading">
                        Found {nearby.length} Nearby Airport{nearby.length === 1 ? '' : 's'}
                      </div>
                      <ul className="airport-combobox-nearby-list">
                        {nearby.map((nearbyAirport) => {
                          const distanceLabel = getAirportDistanceLabel(nearbyAirport);
                          return (
                            <li key={nearbyAirport.Name}>
                              <button
                                type="button"
                                className={'airport-combobox-option airport-combobox-option-nearby' + (value?.Name === nearbyAirport.Name ? ' airport-combobox-option-active' : '')}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(nearbyAirport)}
                              >
                                <span className="airport-combobox-branch" aria-hidden="true" />
                                <span className="airport-combobox-code">{getAirportCode(nearbyAirport) || 'AIR'}</span>
                                <span className="airport-combobox-option-text">
                                  <span className="airport-combobox-option-name">{getAirportPrimaryLabel(nearbyAirport)}</span>
                                  <span className="airport-combobox-option-country">
                                    {distanceLabel ? `${distanceLabel} from ${a.CityName || getAirportDisplayName(a)}` : getAirportSecondaryLabel(nearbyAirport)}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function FlightResultCard({
  flight,
  currency,
  onBook,
  isBooking,
}: {
  flight: Flight;
  currency: CurrencyCode;
  onBook: (flight: Flight) => void;
  isBooking: boolean;
}) {
  const [selectedFare, setSelectedFare] = useState<Fare | null>(flight.fares?.[0] ?? null);
  const [expanded, setExpanded] = useState(false);
  const fares = flight.fares ?? [];

  const hasMarineFare = fares.some((f) => {
    const ind = typeof f.indicator === 'string' ? f.indicator.trim().toUpperCase() : '';
    if (ind === 'M') return true;
    const label = `${f.name ?? ''} ${f.type ?? ''}`;
    return /\bmarine\b/i.test(label);
  });

  const firstLeg = flight.legs?.[0];
  const lastLeg = flight.legs?.[flight.legs.length - 1];
  const firstSeg = firstLeg?.itinerary?.[0];
  const lastSeg = lastLeg?.itinerary?.[lastLeg.itinerary.length - 1];

  const fromAirport = firstSeg?.fromAirport ?? firstLeg?.from ?? '—';
  const toAirport = lastSeg?.toAirport ?? lastLeg?.to ?? '—';
  const departureTime = firstLeg?.departureTime ?? '';
  const arrivalTime = lastLeg?.arrivalTime ?? '';
  const duration = firstLeg?.duration ?? '—';
  const overnightCount = countFlightOvernights(departureTime, arrivalTime);
  const stops = (flight as { stops?: number }).stops ?? firstLeg?.stops ?? 0;
  const via = firstLeg?.via;
  const airlineName = (flight as { airlineName?: string }).airlineName ?? firstLeg?.airlineName ?? '—';
  const airlineCode = (flight as { airlineCode?: string }).airlineCode ?? '';
  const cabin = selectedFare?.cabin ?? firstSeg?.cabin ?? '—';
  const segments = flight.legs?.flatMap((leg) => leg.itinerary ?? []) ?? [];

  return (
    <div className={'atfc-card' + (hasMarineFare ? ' atfc-card--marine' : '')}>
      {/* ── Main row ── */}
      <div className="atfc-main">
        {/* Airline */}
        <div className="atfc-airline">
          <span className="atfc-airline-name">{airlineName}</span>
          <span className="atfc-airline-code">{airlineCode}</span>
        </div>

        {/* Route */}
        <div className="atfc-route">
          <div className="atfc-route-endpoint">
            <span className="atfc-time">{departureTime ? fmtTime(departureTime) : '—'}</span>
            <span className="atfc-date">{departureTime ? fmtDate(departureTime) : ''}</span>
            <span className="atfc-airport" title={fromAirport}>{fromAirport}</span>
          </div>
          <div className="atfc-route-mid">
            <span className="atfc-duration">{duration}</span>
            <div className="atfc-route-line">
              <span className="atfc-route-dot" />
              <span className="atfc-route-bar" />
              <Plane size={14} className="atfc-route-plane" />
              <span className="atfc-route-bar" />
              <span className="atfc-route-dot" />
            </div>
            <span className="atfc-stops">
              {stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}${via ? ` via ${via}` : ''}`}
            </span>
            {overnightCount > 0 ? (
              <span className="atfc-overnight-badge" title={`${overnightCount} overnight${overnightCount !== 1 ? 's' : ''} in transit`}>
                {overnightCount} overnight{overnightCount !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
          <div className="atfc-route-endpoint atfc-route-endpoint-right">
            <span className="atfc-time">{arrivalTime ? fmtTime(arrivalTime) : '—'}</span>
            <span className="atfc-date">{arrivalTime ? fmtDate(arrivalTime) : ''}</span>
            <span className="atfc-airport" title={toAirport}>{toAirport}</span>
          </div>
        </div>

        {/* Cabin badge */}
        <div className="atfc-cabin">
          <span className="atfc-cabin-badge">{cabin}</span>
        </div>

        {/* Fare & action */}
        <div className="atfc-fare-action">
          {selectedFare ? (
            <div className="atfc-fare-price">
              <span className="atfc-fare-total">{getCurrencySymbol(currency)}{selectedFare.totalFare?.toLocaleString() ?? '—'}</span>
              <span className="atfc-fare-label">{selectedFare.name ?? selectedFare.type}</span>
              {flight.cashback != null && flight.cashback > 0 && (
                <span className="atfc-cashback">{getCurrencySymbol(currency)}{flight.cashback.toLocaleString()} cashback</span>
              )}
            </div>
          ) : (
            <span className="atfc-fare-empty">No fare</span>
          )}
          <Button
            type="button"
            size="sm"
            className="atfc-book-btn"
            onClick={() => onBook(flight)}
            disabled={isBooking || fares.length === 0}
          >
            {isBooking ? (
              <><span className="admin-tickets-spinner admin-tickets-spinner-inline" />Booking…</>
            ) : 'Book Now'}
          </Button>
        </div>
      </div>

      {/* Fare tabs (multiple fares) */}
      {fares.length > 1 && (
        <div className="atfc-fare-tabs">
          {fares.map((f) => (
            <button
              key={f.type}
              type="button"
              className={'atfc-fare-tab' + (selectedFare?.type === f.type ? ' atfc-fare-tab-active' : '')}
              onClick={() => setSelectedFare(f)}
            >
              <span className="atfc-fare-tab-name">{f.name ?? f.type}</span>
              <span className="atfc-fare-tab-price">{getCurrencySymbol(currency)}{f.totalFare?.toLocaleString() ?? '—'}</span>
              <span className="atfc-fare-tab-seats">{f.seats} seats</span>
            </button>
          ))}
        </div>
      )}

      {/* Segment details toggle */}
      <button
        type="button"
        className="atfc-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDown size={16} className={'atfc-toggle-icon' + (expanded ? ' atfc-toggle-icon-open' : '')} />
        {expanded ? 'Hide' : 'Show'} flight details
      </button>

      {expanded && (
        <div className="atfc-segments">
          {segments.map((seg, i) => {
            const nextSeg = segments[i + 1];
            const layoverArrival = seg.arrivalTime;
            const layoverDeparture = nextSeg?.departureTime;

            return (
              <div key={i} className="atfc-seg">
                <div className="atfc-seg-header">
                  <span className="atfc-seg-airline">{seg.airlineName} {seg.airlineCode} {seg.flightNumber}</span>
                  <span className="atfc-seg-cabin">{seg.cabin}</span>
                </div>
                <div className="atfc-seg-route">
                  <div className="atfc-seg-point">
                    <span className="atfc-seg-time">{seg.departureTime ? fmtTime(seg.departureTime) : '—'}</span>
                    {hasParseableDate(seg.departureTime) && (
                      <span className="atfc-seg-date">{fmtDate(seg.departureTime)}</span>
                    )}
                    <span className="atfc-seg-airport">{seg.fromAirport ?? seg.from}</span>
                    {seg.fromTerminal && <span className="atfc-seg-terminal">Terminal {seg.fromTerminal}</span>}
                  </div>
                  <div className="atfc-seg-arrow">→</div>
                  <div className="atfc-seg-point">
                    <span className="atfc-seg-time">{seg.arrivalTime ? fmtTime(seg.arrivalTime) : '—'}</span>
                    {hasParseableDate(seg.arrivalTime) && (
                      <span className="atfc-seg-date">{fmtDate(seg.arrivalTime)}</span>
                    )}
                    <span className="atfc-seg-airport">{seg.toAirport ?? seg.to}</span>
                    {seg.toTerminal && <span className="atfc-seg-terminal">Terminal {seg.toTerminal}</span>}
                  </div>
                </div>
                <div className="atfc-seg-meta">
                  <span>Baggage: {seg.baggage}</span>
                  <span>Cabin bag: {seg.cabinBaggage}</span>
                </div>
                {seg.layover && (
                  <div className="atfc-seg-layover">
                    <span>
                      Layover at {seg.layover.location}: {seg.layover.duration}
                      {hasParseableDate(layoverArrival) && (
                        <> · Arrive {fmtDate(layoverArrival)} {fmtTime(layoverArrival)}</>
                      )}
                      {layoverDeparture && hasParseableDate(layoverDeparture) && (
                        <> · Next departs {fmtDate(layoverDeparture)} {fmtTime(layoverDeparture)}</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const isMarineFare = (f: Fare): boolean => {
  const ind = typeof f.indicator === 'string' ? f.indicator.trim().toUpperCase() : '';
  if (ind === 'M') return true;
  const label = `${f.name ?? ''} ${f.type ?? ''}`;
  return /\bmarine\b/i.test(label);
};

const filterMarineFares = (flights: Flight[]): Flight[] => {
  return flights
    .map((flight) => ({
      ...flight,
      fares: (flight.fares ?? []).filter(isMarineFare),
    }))
    .filter((flight) => flight.fares.length > 0);
};

const AdminTicketsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [rigs, setRigs] = useState<RigApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recentBookingsPage, setRecentBookingsPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);
  const [ticketToConfirmCancel, setTicketToConfirmCancel] = useState<CrewTicketApi | null>(null);
  const [cancelTicketSubmitting, setCancelTicketSubmitting] = useState(false);
  const [previewingTicketId, setPreviewingTicketId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectApi | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>('');
  const [createRigId, setCreateRigId] = useState<string>('');
  const [crew, setCrew] = useState<CrewMemberApi[]>([]);
  const [crewLoading, setCrewLoading] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [modalStep, setModalStep] = useState<ModalStep>('project');

  const [formData, setFormData] = useState({
    fromName: '',
    fromCountry: '',
    fromCountryName: '',
    toName: '',
    toCountry: '',
    toCountryName: '',
    class: 'ECONOMY' as CreateFlightTicketPayload['class'],
    adult: 1,
    children: 0,
    infants: 0,
    trip: 'ONE_WAY' as CreateFlightTicketPayload['trip'],
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load initial search state from localStorage on script load/init
  const savedState = (() => {
    try {
      const saved = localStorage.getItem('admin_tickets_search_state');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  /* Search & Book tab state */
  const [activeTab, setActiveTab] = useState<TicketsTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const qTab = params.get('tab');
    if (qTab === 'search' || qTab === 'tickets' || qTab === 'spends') return qTab;
    return savedState?.activeTab ?? 'tickets';
  });
  const [searchTripTypeUI, setSearchTripTypeUI] = useState<SearchUITripType>(() => savedState?.searchTripTypeUI ?? 'one-way');
  const [multiSegments, setMultiSegments] = useState<MultiFlightSegment[]>(() => savedState?.multiSegments ?? initialMultiSegments());
  const [activeMultiLegIndex, setActiveMultiLegIndex] = useState(() => savedState?.activeMultiLegIndex ?? 0);
  const [preferNonStopPerLeg, setPreferNonStopPerLeg] = useState(() => savedState?.preferNonStopPerLeg ?? false);
  const [searchFrom, setSearchFrom] = useState<Airport | null>(() => savedState?.searchFrom ?? AIRPORTS[0] ?? null);
  const [searchTo, setSearchTo] = useState<Airport | null>(() => savedState?.searchTo ?? AIRPORTS[1] ?? null);
  const [departureDate, setDepartureDate] = useState(() => savedState?.departureDate ?? '');
  const [returnDate, setReturnDate] = useState(() => {
    if (savedState?.returnDate !== undefined) return savedState.returnDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toYYYYMMDD(d);
  });
  const [returnTime, setReturnTime] = useState(() => savedState?.returnTime ?? '');
  const [departureTime, setDepartureTime] = useState(() => savedState?.departureTime ?? '');
  const [arrivalDate, setArrivalDate] = useState(() => savedState?.arrivalDate ?? '');
  const [arrivalTime, setArrivalTime] = useState(() => savedState?.arrivalTime ?? '');
  const [adults, setAdults] = useState(() => savedState?.adults ?? 1);
  const [cabinClass, setCabinClass] = useState<CabinClass>(() => savedState?.cabinClass ?? 'economy');
  const [currency, setCurrency] = useState<CurrencyCode>(() => savedState?.currency ?? 'GBP');
  const [flightSortBy, setFlightSortBy] = useState<FlightSortBy>(() => savedState?.flightSortBy ?? 'price');
  const [flightSortOrder, setFlightSortOrder] = useState<FlightSortOrder>(() => savedState?.flightSortOrder ?? 'asc');
  const [searchResults, setSearchResults] = useState<Flight[] | null>(() => savedState?.searchResults ?? null);
  const [searchTotalCount, setSearchTotalCount] = useState<number>(() => savedState?.searchTotalCount ?? 0);
  const [searchPage, setSearchPage] = useState<number>(() => savedState?.searchPage ?? 1);
  const [searchCriteria, setSearchCriteria] = useState<SearchPayload | null>(() => savedState?.searchCriteria ?? null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingFlightKey, setBookingFlightKey] = useState<string | null>(null);
  const [flightToBook, setFlightToBook] = useState<Flight | null>(null);
  const [bookingTravelDirection, setBookingTravelDirection] = useState<'HOME_TO_RIG' | 'RIG_TO_HOME'>('HOME_TO_RIG');
  const [bookingConfirmConflicts, setBookingConfirmConflicts] = useState<CrewTravelConflict[]>([]);
  const [bookingConfirmConflictsLoading, setBookingConfirmConflictsLoading] = useState(false);
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [searchBookingSuccess, setSearchBookingSuccess] = useState(false);
  const [searchSuccessMessage, setSearchSuccessMessage] = useState('');

  /* Crew status confirmation dialog state */
  const [crewStatusConfirmPending, setCrewStatusConfirmPending] = useState<{
    crew: CrewMemberApi;
    context: 'search' | 'modal';
  } | null>(null);

  const [crewAvailabilitySearchPending, setCrewAvailabilitySearchPending] = useState<{
    conflicts: CrewTravelConflict[];
    criteria: SearchPayload;
  } | null>(null);

  /* Project & crew for search form */
  const [searchProjectId, setSearchProjectId] = useState<string>(() => savedState?.searchProjectId ?? '');
  const [searchCrewIds, setSearchCrewIds] = useState<string[]>(() => savedState?.searchCrewIds ?? []);

  // Save state to localStorage when any search parameters or results change
  useEffect(() => {
    try {
      const stateToSave = {
        activeTab,
        searchTripTypeUI,
        multiSegments,
        activeMultiLegIndex,
        preferNonStopPerLeg,
        searchFrom,
        searchTo,
        departureDate,
        returnDate,
        returnTime,
        departureTime,
        arrivalDate,
        arrivalTime,
        adults,
        cabinClass,
        currency,
        flightSortBy,
        flightSortOrder,
        searchResults,
        searchTotalCount,
        searchPage,
        searchCriteria,
        searchProjectId,
        searchCrewIds,
      };
      localStorage.setItem('admin_tickets_search_state', JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save search state', e);
    }
  }, [
    activeTab,
    searchTripTypeUI,
    multiSegments,
    activeMultiLegIndex,
    preferNonStopPerLeg,
    searchFrom,
    searchTo,
    departureDate,
    returnDate,
    returnTime,
    departureTime,
    arrivalDate,
    arrivalTime,
    adults,
    cabinClass,
    currency,
    flightSortBy,
    flightSortOrder,
    searchResults,
    searchTotalCount,
    searchPage,
    searchCriteria,
    searchProjectId,
    searchCrewIds,
  ]);
  const [searchCrewList, setSearchCrewList] = useState<CrewMemberApi[]>([]);
  const [searchCrewLoading, setSearchCrewLoading] = useState(false);
  const [searchCrewFilter, setSearchCrewFilter] = useState('');
  const [, setAdminMarkup] = useState<number | null>(null);
  const selectedFlightSortValue = `${flightSortBy}:${flightSortOrder}` as FlightSortValue;

  useEffect(() => {
    let cancelled = false;
    getAdminProfile()
      .then((profile) => {
        if (!cancelled && profile.markup != null) setAdminMarkup(profile.markup);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSearchCrewLoading(true);
    getCrewList()
      .then((res) => {
        if (cancelled) return;
        setSearchCrewList(res.crew ?? []);
      })
      .catch(() => {
        if (!cancelled) setSearchCrewList([]);
      })
      .finally(() => {
        if (!cancelled) setSearchCrewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (location.state?.crewId && projects.length > 0) {
      const { crewId, projectId } = location.state;

      // 1. Pre-fill Search tab
      setSearchCrewIds([crewId]);
      if (projectId) {
        setSearchProjectId(projectId);
      }
      setActiveTab('search');

      // 2. Pre-fill and open the manual modal
      if (projectId) {
        setCreateProjectId(projectId);
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          setSelectedProject(project);
          setModalStep('crew');
          setSelectedCrewIds([crewId]);
          setCrewLoading(true);
          getCrewEnrolledInProject(projectId)
            .then((res) => {
              setCrew(res.crew ?? []);
              setModalStep('form');
            })
            .catch(() => setCrew([]))
            .finally(() => {
              setCrewLoading(false);
              setIsCreateModalOpen(true);
            });
        } else {
          setIsCreateModalOpen(true);
        }
      } else {
        setIsCreateModalOpen(true);
      }

      // Clear the history state so refreshing doesn't keep opening the modal
      window.history.replaceState({}, document.title);
    }
  }, [location.state, projects]);

  const filteredSearchCrewList = useMemo(() => {
    const q = searchCrewFilter.trim().toLowerCase();
    if (!q) return searchCrewList;
    return searchCrewList.filter((c) => {
      const name = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim().toLowerCase();
      return name.includes(q) || (c.email?.toLowerCase().includes(q) ?? false);
    });
  }, [searchCrewList, searchCrewFilter]);

  const searchAdultCount = searchCrewIds.length > 0 ? searchCrewIds.length : Math.max(1, adults);

  const toggleCrewSearch = useCallback((crewId: string) => {
    // If already selected, just deselect (no confirmation needed)
    if (searchCrewIds.includes(crewId)) {
      setSearchCrewIds((prev) => prev.filter((id) => id !== crewId));
      return;
    }
    // Check if crew has non-Available status
    const crewMember = searchCrewList.find((c) => c.id === crewId);
    const personnelStatus = crewMember?.current_status ?? 'Available';
    if (personnelStatus !== 'Available' && crewMember) {
      setCrewStatusConfirmPending({ crew: crewMember, context: 'search' });
      return;
    }
    setSearchCrewIds((prev) => [...prev, crewId]);
  }, [searchCrewIds, searchCrewList]);

  const updateMultiSegment = useCallback((index: number, patch: Partial<MultiFlightSegment>) => {
    setMultiSegments((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      if (patch.to != null && index + 1 < next.length) {
        next[index + 1] = { ...next[index + 1], from: patch.to };
      }
      return next;
    });
  }, []);

  const addMultiSegment = useCallback(() => {
    setMultiSegments((prev) => {
      if (prev.length >= MAX_MULTI_SEGMENTS) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          id: newSegmentId(),
          from: last.to,
          to: null,
          departureDate: last.departureDate,
          departureTime: '',
          arrivalDate: '',
          arrivalTime: '',
        },
      ];
    });
  }, []);

  const removeMultiSegment = useCallback((index: number) => {
    if (multiSegments.length <= 2) return;
    const newLen = multiSegments.length - 1;
    setMultiSegments((prev) => prev.filter((_, i) => i !== index));
    setActiveMultiLegIndex((idx: number) => {
      if (index < idx) return idx - 1;
      return Math.max(0, Math.min(idx, newLen - 1));
    });
  }, [multiSegments.length]);

  const changeSearchTripType = useCallback(
    (next: SearchUITripType) => {
      setSearchTripTypeUI(next);
      setSearchResults(null);
      setSearchTotalCount(0);
      setSearchPage(1);
      setSearchCriteria(null);
      setSearchError(null);
      if (next !== 'multi-city') {
        setPreferNonStopPerLeg(false);
      }
      if (next === 'multi-city') {
        setActiveMultiLegIndex(0);
        if (searchFrom && searchTo) {
          setMultiSegments([
            {
              id: newSegmentId(),
              from: searchFrom,
              to: searchTo,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            },
            {
              id: newSegmentId(),
              from: searchTo,
              to: searchFrom,
              departureDate,
              departureTime,
              arrivalDate,
              arrivalTime,
            },
          ]);
        } else {
          setMultiSegments(initialMultiSegments());
        }
      }
    },
    [searchFrom, searchTo, departureDate, departureTime, arrivalDate, arrivalTime]
  );

  const fetchTickets = useCallback(() => {
    setTicketsLoading(true);
    getCrewTickets()
      .then((res) => setTickets(res.crewTickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, []);

  const requestCancelTicketFlow = useCallback((ticket: CrewTicketApi) => {
    if (isTicketCancelled(ticket)) return;
    setSelectedTicket(null);
    setTicketToConfirmCancel(ticket);
  }, []);

  const handleConfirmCancelTicket = useCallback(async () => {
    if (!ticketToConfirmCancel || isTicketCancelled(ticketToConfirmCancel)) return;
    const id = ticketToConfirmCancel.id;
    setCancelTicketSubmitting(true);
    try {
      const result = await cancelCrewTicket(id);
      const cancelledTicket =
        result.crewTicket ??
        normalizeCrewTicket({
          ...ticketToConfirmCancel,
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
        });

      setTickets((prev) => prev.map((t) => (t.id === id ? cancelledTicket : t)));
      setSelectedTicket(cancelledTicket);
      setTicketToConfirmCancel(null);
      void fetchTickets();

      toast.success('Ticket cancelled', {
        description: 'The booking was marked as cancelled.',
      });
      window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
    } catch (err) {
      toast.error('Cancellation failed', {
        description:
          err instanceof Error ? err.message : 'Unable to cancel this ticket. Please try again.',
      });
    } finally {
      setCancelTicketSubmitting(false);
    }
  }, [ticketToConfirmCancel, fetchTickets]);

  const handlePreviewTicketPdf = useCallback(async (ticket: CrewTicketApi) => {
    if (!canUseTicketPdf(ticket)) {
      toast.info('Ticket PDF not available yet', {
        description: 'Preview is available after superadmin approval and PDF generation.',
      });
      return;
    }
    if (!ticket.id?.trim()) {
      toast.error('Failed to open ticket PDF', {
        description: 'This ticket is missing an id.',
      });
      return;
    }

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.title = 'Loading ticket…';
      previewWindow.document.body.innerHTML =
        '<p style="font-family:sans-serif;padding:24px;margin:0">Loading ticket PDF…</p>';
    }

    setPreviewingTicketId(ticket.id);
    try {
      await previewCrewTicketPdf(ticket, 'admin', previewWindow);
    } catch (err) {
      previewWindow?.close();
      toast.error('Failed to open ticket PDF', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setPreviewingTicketId(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getCrewTickets(), getProjects(), getRigs()])
      .then(([ticketsRes, projectsRes, rigsRes]) => {
        if (!cancelled) {
          setTickets(ticketsRes.crewTickets ?? []);
          setProjects(projectsRes.projects ?? []);
          setRigs(rigsRes.rigs ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setTicketsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const projectFilteredTickets = useMemo(() => {
    if (projectFilter === 'all') return tickets;
    return tickets.filter((t) => {
      const pid = t.project_id?._id ?? (t.project_id as { id?: string })?.id;
      return pid === projectFilter;
    });
  }, [tickets, projectFilter]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'pending') {
      return projectFilteredTickets.filter((t) => getTicketStatus(t) === 'UNAPPROVED');
    }
    if (statusFilter === 'approved') {
      return projectFilteredTickets.filter((t) => getTicketStatus(t) === 'APPROVED');
    }
    if (statusFilter === 'cancelled') {
      return projectFilteredTickets.filter((t) => getTicketStatus(t) === 'CANCELLED');
    }
    return projectFilteredTickets;
  }, [projectFilteredTickets, statusFilter]);

  useEffect(() => {
    setRecentBookingsPage(1);
  }, [projectFilter, statusFilter]);

  const uniqueProjectsFromTickets = useMemo(() => {
    const seen = new Set<string>();
    return tickets
      .map((t) => {
        const p = t.project_id;
        const id = p?._id ?? (p as { id?: string })?.id ?? '';
        const title = p?.title ?? (p as { title?: string })?.title ?? '';
        return { id, title };
      })
      .filter((p) => p.id && !seen.has(p.id) && (seen.add(p.id), true));
  }, [tickets]);

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
    setModalStep('project');
    setSelectedProject(null);
    setCreateProjectId('');
    setCreateRigId('');
    setSelectedCrewIds([]);
    setCrew([]);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  const handleProjectSelectAndContinue = useCallback(() => {
    const project = projects.find((p) => p.id === createProjectId);
    if (!project) return;
    setSelectedProject(project);
    setModalStep('crew');
    setSelectedCrewIds([]);
    setCrewLoading(true);
    getCrewEnrolledInProject(project.id)
      .then((res) => setCrew(res.crew ?? []))
      .catch(() => setCrew([]))
      .finally(() => setCrewLoading(false));
  }, [createProjectId, projects]);

  const closeCreateModal = useCallback(() => {
    if (!submitLoading) {
      setIsCreateModalOpen(false);
      setSelectedProject(null);
      setCreateProjectId('');
      setCreateRigId('');
      setSelectedCrewIds([]);
      setModalStep('project');
      setSubmitError(null);
      setSubmitSuccess(false);
    }
  }, [submitLoading]);

  const toggleCrewSelection = useCallback((crewId: string) => {
    setSelectedCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  }, []);

  const selectAllCrew = useCallback(() => {
    setSelectedCrewIds(crew.map((c) => c.id));
  }, [crew]);

  const deselectAllCrew = useCallback(() => {
    setSelectedCrewIds([]);
  }, []);

  const goToForm = useCallback(() => {
    if (selectedCrewIds.length > 0) {
      setModalStep('form');
      setSubmitError(null);
      setFormData({
        fromName: 'Mumbai [BOM] - Chhatrapati Shivaji Maharaj International Airport, India',
        fromCountry: 'IN',
        fromCountryName: 'India',
        toName: 'Delhi NCR [DEL] - Indira Gandhi International Airport, India',
        toCountry: 'IN',
        toCountryName: 'India',
        class: 'ECONOMY',
        adult: 1,
        children: 0,
        infants: 0,
        trip: 'ONE_WAY',
      });
    }
  }, [selectedCrewIds.length]);

  const goBackToCrew = useCallback(() => {
    setModalStep('crew');
    setSubmitError(null);
  }, []);

  const runFlightSearch = useCallback(async (criteria: SearchPayload) => {
    setSearchCriteria(criteria);
    setSearchResults(null);
    setSearchTotalCount(0);
    setSearchPage(1);
    setSearchError(null);
    setIsSearching(true);
    try {
      const data = await searchFlights(criteria);
      setSearchResults(filterMarineFares(data.flights));
      setSearchTotalCount(data.total);
      setSearchPage(data.page ?? 1);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = useCallback(
    async (overrides?: {
      departureDate?: string;
      departureTime?: string;
      arrivalDate?: string;
      arrivalTime?: string;
      returnDate?: string;
      returnTime?: string;
    }) => {
      let criteria: SearchPayload;

      if (searchTripTypeUI === 'multi-city') {
        const seg = multiSegments[activeMultiLegIndex];
        if (!seg?.from || !seg?.to) {
          setSearchError('Please select From and To airports for this flight.');
          return;
        }
        const dDate = overrides?.departureDate !== undefined ? overrides.departureDate : seg.departureDate;
        const dTime = overrides?.departureTime !== undefined ? overrides.departureTime : seg.departureTime;
        const aDate = overrides?.arrivalDate !== undefined ? overrides.arrivalDate : seg.arrivalDate;
        const aTime = overrides?.arrivalTime !== undefined ? overrides.arrivalTime : seg.arrivalTime;
        criteria = {
          tripType: 'one-way',
          from: seg.from,
          to: seg.to,
          departureDate: dDate,
          adults: searchAdultCount,
          children: 0,
          infants: 0,
          cabinClass,
          currency,
          page: 1,
          sortBy: flightSortBy,
          sortOrder: flightSortOrder,
          ...(searchProjectId ? { project_id: searchProjectId } : {}),
          ...(searchCrewIds.length > 0 ? { crew_ids: searchCrewIds } : {}),
          ...(dTime.trim() ? { departureTime: dTime.trim() } : {}),
          ...(aDate.trim() ? { arrivalDate: aDate.trim() } : {}),
          ...(aTime.trim() ? { arrivalTime: aTime.trim() } : {}),
          ...(preferNonStopPerLeg ? { stops: ['0'] } : {}),
        };
      } else {
        if (!searchFrom || !searchTo) {
          setSearchError('Please select From and To airports.');
          return;
        }
        const dDate = overrides?.departureDate !== undefined ? overrides.departureDate : departureDate;
        const dTime = overrides?.departureTime !== undefined ? overrides.departureTime : departureTime;
        const aDate = overrides?.arrivalDate !== undefined ? overrides.arrivalDate : arrivalDate;
        const aTime = overrides?.arrivalTime !== undefined ? overrides.arrivalTime : arrivalTime;
        const rDate = overrides?.returnDate !== undefined ? overrides.returnDate : returnDate;
        const rTime = overrides?.returnTime !== undefined ? overrides.returnTime : returnTime;
        criteria = {
          tripType: searchTripTypeUI,
          from: searchFrom,
          to: searchTo,
          departureDate: dDate,
          returnDate: searchTripTypeUI === 'round-trip' ? rDate : undefined,
          ...(searchTripTypeUI === 'round-trip' && rTime.trim() ? { returnTime: rTime.trim() } : {}),
          adults: searchAdultCount,
          children: 0,
          infants: 0,
          cabinClass,
          currency,
          page: 1,
          sortBy: flightSortBy,
          sortOrder: flightSortOrder,
          ...(searchProjectId ? { project_id: searchProjectId } : {}),
          ...(searchCrewIds.length > 0 ? { crew_ids: searchCrewIds } : {}),
          ...(searchTripTypeUI === 'one-way' && dTime.trim() ? { departureTime: dTime.trim() } : {}),
          ...(searchTripTypeUI === 'one-way' && aDate.trim() ? { arrivalDate: aDate.trim() } : {}),
          ...(searchTripTypeUI === 'one-way' && aTime.trim() ? { arrivalTime: aTime.trim() } : {}),
        };
      }

      if (searchCrewIds.length > 0 && criteria.departureDate?.trim()) {
        const range = getTravelDateRange(criteria.departureDate, criteria.returnDate);
        if (range) {
          try {
            const availabilities = await getBulkCrewAvailabilitiesAdmin(searchCrewIds);
            const conflicts = findCrewTravelConflicts(
              searchCrewIds,
              (id) => {
                const crew = searchCrewList.find((c) => c.id === id);
                return crew ? `${crew.firstname} ${crew.lastname}`.trim() : 'Crew member';
              },
              range.start,
              range.end,
              availabilities
            );
            if (conflicts.length > 0) {
              setCrewAvailabilitySearchPending({ conflicts, criteria });
              return;
            }
          } catch {
            // Proceed with search if availability lookup fails.
          }
        }
      }

      await runFlightSearch(criteria);
    },
    [
      searchTripTypeUI,
      multiSegments,
      activeMultiLegIndex,
      preferNonStopPerLeg,
      searchFrom,
      searchTo,
      departureDate,
      returnDate,
      returnTime,
      departureTime,
      arrivalDate,
      arrivalTime,
      searchAdultCount,
      cabinClass,
      currency,
      flightSortBy,
      flightSortOrder,
      searchProjectId,
      searchCrewIds,
      searchCrewList,
      runFlightSearch,
    ]
  );

  const handleResultSortChange = useCallback(
    async (value: FlightSortValue) => {
      const [nextSortBy, nextSortOrder] = value.split(':') as [FlightSortBy, FlightSortOrder];
      setFlightSortBy(nextSortBy);
      setFlightSortOrder(nextSortOrder);

      if (!searchCriteria) return;

      const criteria: SearchPayload = {
        ...searchCriteria,
        page: 1,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      };

      setSearchCriteria(criteria);
      setSearchError(null);
      setIsSearching(true);
      try {
        const data = await searchFlights(criteria);
        setSearchResults(filterMarineFares(data.flights));
        setSearchTotalCount(data.total);
        setSearchPage(data.page ?? 1);
      } catch (e) {
        toast.error('Failed to sort results', { description: e instanceof Error ? e.message : 'Please try again.' });
      } finally {
        setIsSearching(false);
      }
    },
    [searchCriteria]
  );

  const handleLoadMore = useCallback(async () => {
    if (!searchCriteria || isLoadingMore) return;
    if (searchTripTypeUI !== 'multi-city' && (!searchFrom || !searchTo)) return;
    if (searchTripTypeUI === 'multi-city') {
      const seg = multiSegments[activeMultiLegIndex];
      if (!seg?.from || !seg?.to) return;
    }
    const nextPage = searchPage + 1;
    const criteria: SearchPayload = {
      ...searchCriteria,
      page: nextPage,
    };
    setIsLoadingMore(true);
    try {
      const data = await searchFlights(criteria);
      setSearchResults((prev) => (prev ? [...prev, ...filterMarineFares(data.flights)] : filterMarineFares(data.flights)));
      setSearchTotalCount(data.total);
      setSearchPage(data.page ?? nextPage);
    } catch (e) {
      toast.error('Failed to load more', { description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    searchCriteria,
    searchFrom,
    searchTo,
    searchPage,
    isLoadingMore,
    searchTripTypeUI,
    multiSegments,
    activeMultiLegIndex,
  ]);

  const executeSearchBooking = useCallback(
    async (flight: Flight) => {
      const bookKey =
        searchTripTypeUI === 'multi-city' ? `${activeMultiLegIndex}::${flight.id}` : flight.id;
      setBookingFlightKey(bookKey);
      try {
        const firstFare = flight.fares?.[0];
        const priceAmount = firstFare?.totalFare ?? 0;
        const data = await bookFlight({
          ...(searchProjectId ? { project_id: searchProjectId } : {}),
          ...(searchCrewIds.length > 0 ? { crew_ids: searchCrewIds } : {}),
          flight,
          cashback: flight.cashback ?? 0,
          price: priceAmount,
          currency,
          adult: searchAdultCount,
          children: 0,
          infants: 0,
          travelDirection: bookingTravelDirection,
        });
        const returnedTickets = Array.isArray(data.crewTickets) ? data.crewTickets : Array.isArray(data.tickets) ? data.tickets : [];
        const ticketCount = returnedTickets.length;
        const refNote = data.bookingReference ? ` Ref: ${data.bookingReference}` : '';
        const baseDesc = `${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} booked and sent for approval.${refNote}`;

        setSearchSuccessMessage(baseDesc);
        setSearchBookingSuccess(true);

        if (searchTripTypeUI === 'multi-city') {
          const n = multiSegments.length;
          const legDone = activeMultiLegIndex + 1;
          if (activeMultiLegIndex < n - 1) {
            toast.success(`Leg ${legDone} of ${n} sent for approval.`, {
              description: `${baseDesc} Search and book leg ${legDone + 1}.`,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            fetchTickets();
            setTimeout(() => {
              setActiveMultiLegIndex((i: number) => i + 1);
              setSearchResults(null);
              setSearchTotalCount(0);
              setSearchPage(1);
              setSearchCriteria(null);
              setFlightToBook(null);
              setSearchBookingSuccess(false);
            }, 2500);
          } else {
            toast.success(`All ${n} flight${n !== 1 ? 's' : ''} sent for approval.`, {
              description: baseDesc,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            fetchTickets();
            setTimeout(() => {
              setSearchResults(null);
              setSearchTotalCount(0);
              setSearchPage(1);
              setSearchCriteria(null);
              setActiveMultiLegIndex(0);
              setMultiSegments(initialMultiSegments());
              setFlightToBook(null);
              setSearchBookingSuccess(false);
            }, 2500);
          }
        } else {
          toast.success('Ticket booked and sent for approval.', { description: baseDesc });
          window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
          fetchTickets();
          setTimeout(() => {
            setSearchResults((prev) => (prev ? prev.filter((f) => f.id !== flight.id) : null));
            setSearchTotalCount((prev) => Math.max(0, prev - 1));
            setFlightToBook(null);
            setSearchBookingSuccess(false);
          }, 2500);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to complete booking. Please try again.';
        if (searchTripTypeUI === 'multi-city') {
          toast.error('Booking failed for this leg', {
            description: `${msg} Earlier legs in this flow are already separate bookings and are not undone.`,
          });
        } else {
          toast.error('Booking failed', { description: msg });
        }
      } finally {
        setBookingFlightKey(null);
      }
    },
    [
      searchProjectId,
      searchCrewIds,
      searchAdultCount,
      currency,
      searchTripTypeUI,
      activeMultiLegIndex,
      multiSegments.length,
      fetchTickets,
      bookingTravelDirection,
    ]
  );

  const handleBookNow = useCallback(
    (flight: Flight) => {
      setBookingConfirmConflicts([]);
      setBookingTravelDirection('HOME_TO_RIG');
      setFlightToBook(flight);
    },
    []
  );

  const selectedSearchCrewMembers = useMemo(
    () => searchCrewList.filter((c) => searchCrewIds.includes(c.id)),
    [searchCrewList, searchCrewIds]
  );

  useEffect(() => {
    if (!flightToBook || searchCrewIds.length === 0) {
      setBookingConfirmConflicts([]);
      return;
    }
    const firstLeg = flightToBook.legs?.[0];
    const lastLeg = flightToBook.legs?.[flightToBook.legs.length - 1];
    const dep = firstLeg?.departureTime ?? '';
    const arr = lastLeg?.arrivalTime ?? firstLeg?.arrivalTime ?? dep;
    const depYmd = dep ? String(dep).slice(0, 10) : '';
    const arrYmd = arr ? String(arr).slice(0, 10) : depYmd;
    const range = getTravelDateRange(depYmd, arrYmd);
    if (!range) {
      setBookingConfirmConflicts([]);
      return;
    }

    let cancelled = false;
    setBookingConfirmConflictsLoading(true);
    getBulkCrewAvailabilitiesAdmin(searchCrewIds)
      .then((availabilities) => {
        if (cancelled) return;
        const conflicts = findCrewTravelConflicts(
          searchCrewIds,
          (id) => {
            const crew = searchCrewList.find((c) => c.id === id);
            return crew ? `${crew.firstname} ${crew.lastname}`.trim() : 'Crew member';
          },
          range.start,
          range.end,
          availabilities
        );
        setBookingConfirmConflicts(conflicts);
      })
      .catch(() => {
        if (!cancelled) setBookingConfirmConflicts([]);
      })
      .finally(() => {
        if (!cancelled) setBookingConfirmConflictsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flightToBook, searchCrewIds, searchCrewList]);

  const handleSearchBack = useCallback(() => {
    setSearchResults(null);
    setSearchTotalCount(0);
    setSearchPage(1);
    setSearchCriteria(null);
    setSearchError(null);
  }, []);

  const displayedSearchFlights = useMemo(() => {
    if (!searchResults) return null;
    if (searchTripTypeUI === 'multi-city' && preferNonStopPerLeg) {
      return searchResults.filter(isFlightNonStop);
    }
    return searchResults;
  }, [searchResults, searchTripTypeUI, preferNonStopPerLeg]);

  const handleSubmitTickets = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject || selectedCrewIds.length === 0) return;

    const fromName = formData.fromName.trim();
    const toName = formData.toName.trim();

    if (!fromName || !toName) {
      setSubmitError('From and To airport names are required');
      return;
    }

    setSubmitError(null);
    setShowManualConfirm(true);
  };

  const executeManualBooking = async () => {
    if (!selectedProject || selectedCrewIds.length === 0) return;

    const from: AirportLocation = {
      Name: formData.fromName.trim(),
      COUNTRY: formData.fromCountry.trim(),
      COUNTRYNAME: formData.fromCountryName.trim(),
    };
    const to: AirportLocation = {
      Name: formData.toName.trim(),
      COUNTRY: formData.toCountry.trim(),
      COUNTRYNAME: formData.toCountryName.trim(),
    };

    if (!from.Name || !to.Name) {
      setSubmitError('From and To airport names are required');
      setShowManualConfirm(false);
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      for (const crewId of selectedCrewIds) {
        const payload: CreateFlightTicketPayload = {
          crew_id: crewId,
          project_id: selectedProject.id,
          ...(createRigId ? { rig_id: createRigId } : {}),
          from,
          to,
          class: formData.class,
          adult: formData.adult,
          children: formData.children,
          infants: formData.infants,
          trip: formData.trip,
        };
        await createFlightTicket(payload);
      }
      setSubmitSuccess(true);
      fetchTickets();
      setShowManualConfirm(false);
      setTimeout(closeCreateModal, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create tickets');
      setShowManualConfirm(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  const getCrewName = (t: CrewTicketApi) => {
    const c = t.crew_id;
    const first = c?.firstname ?? (c as { firstname?: string })?.firstname ?? '';
    const last = c?.lastname ?? (c as { lastname?: string })?.lastname ?? '';
    return `${first} ${last}`.trim() || '—';
  };

  const getProjectTitle = (t: CrewTicketApi) => {
    const p = t.project_id;
    return p?.title ?? (p as { title?: string })?.title ?? '—';
  };

  const getRigName = (t: CrewTicketApi) => {
    const rig = t.rig_id;
    if (!rig) return '—';
    if (typeof rig === 'string') {
      return rigs.find((r) => r.id === rig)?.name ?? '—';
    }
    return rig.name ?? (rig as { name?: string })?.name ?? '—';
  };

  const formatProjectDuration = (p: CrewTicketApi['project_id']) => {
    const d = (p as { duration?: { startDate?: string; endDate?: string } })?.duration;
    if (!d?.startDate || !d?.endDate) return '—';
    try {
      const start = new Date(d.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const end = new Date(d.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} – ${end}`;
    } catch {
      return '—';
    }
  };

  const ticketDashboardStats = useMemo(() => {
    const activeTickets = projectFilteredTickets.filter(
      (ticket) => getTicketStatus(ticket) !== 'CANCELLED'
    );
    const totalBookings = activeTickets.length;
    const mtdTickets = activeTickets.filter((ticket) =>
      isCrewTicketCreatedInLocalCalendarMonth(ticket)
    );
    const lastMonthTickets = activeTickets.filter((ticket) =>
      isCrewTicketCreatedInPreviousLocalCalendarMonth(ticket)
    );
    const mtdSpend = sumPricedTickets(mtdTickets);
    const lastMonthSpend = sumPricedTickets(lastMonthTickets);
    const approvedCount = activeTickets.filter(
      (ticket) => getTicketStatus(ticket) === 'APPROVED'
    ).length;
    const pendingCount = activeTickets.filter(
      (ticket) => getTicketStatus(ticket) === 'UNAPPROVED'
    ).length;

    let spendChangeMeta = 'No priced bookings this month';
    let spendChangeTone: 'up' | 'down' | 'flat' = 'flat';
    if (mtdSpend.count > 0) {
      if (lastMonthSpend.total > 0) {
        const pctChange = ((mtdSpend.total - lastMonthSpend.total) / lastMonthSpend.total) * 100;
        const rounded = Math.round(Math.abs(pctChange));
        if (pctChange > 0) {
          spendChangeMeta = `+${rounded}% vs last month`;
          spendChangeTone = 'down';
        } else if (pctChange < 0) {
          spendChangeMeta = `-${rounded}% vs last month`;
          spendChangeTone = 'up';
        } else {
          spendChangeMeta = 'Flat vs last month';
        }
      } else {
        spendChangeMeta = 'No spend last month';
        spendChangeTone = 'flat';
      }
    }

    const classCounts = new Map<string, number>();
    for (const ticket of mtdTickets) {
      const label = formatTicketClass(ticket.class);
      classCounts.set(label, (classCounts.get(label) ?? 0) + 1);
    }
    const topClassEntry = [...classCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const avgCostMeta = mtdSpend.count
      ? `${mtdSpend.count} priced booking${mtdSpend.count !== 1 ? 's' : ''}${topClassEntry ? ` · ${topClassEntry[0]}` : ''}`
      : 'No priced bookings this month';

    const cancelledCount = projectFilteredTickets.length - activeTickets.length;

    const spendByDestinationMap = new Map<string, number>();
    for (const ticket of activeTickets) {
      if (typeof ticket.price !== 'number') continue;
      const dest = ticket.to?.COUNTRYNAME?.trim() || ticket.to?.COUNTRY?.trim() || 'Unknown destination';
      spendByDestinationMap.set(dest, (spendByDestinationMap.get(dest) ?? 0) + ticket.price);
    }
    const spendByDestinationEntries = [...spendByDestinationMap.entries()].sort((a, b) => b[1] - a[1]);
    const topDestinationSpend = spendByDestinationEntries[0]?.[1] ?? 0;
    const spendByDestination = spendByDestinationEntries.slice(0, 5).map(([label, amount], index) => ({
      label,
      amount,
      barPct: topDestinationSpend ? Math.round((amount / topDestinationSpend) * 100) : 0,
      color: METRIC_BAR_COLORS[index % METRIC_BAR_COLORS.length],
    }));

    const classBookingMap = new Map<string, number>();
    for (const ticket of activeTickets) {
      const label = formatTicketClass(ticket.class);
      classBookingMap.set(label, (classBookingMap.get(label) ?? 0) + 1);
    }
    const bookingsByClass = [...classBookingMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        pct: totalBookings ? Math.round((count / totalBookings) * 100) : 0,
      }));

    const combinedSpend = mtdSpend.total + lastMonthSpend.total;
    const spendMtdBarPct = combinedSpend
      ? Math.round((mtdSpend.total / combinedSpend) * 100)
      : mtdTickets.length
        ? Math.min(100, mtdTickets.length * 10)
        : 0;

    return {
      totalBookings,
      cancelledCount,
      approvedCount,
      pendingCount,
      mtdSpend,
      spendChangeMeta,
      spendChangeTone,
      avgCostMeta,
      spendByDestination,
      bookingsByClass,
      activeBookingsBarPct: totalBookings ? Math.round((approvedCount / totalBookings) * 100) : 0,
      pendingBarPct: totalBookings ? Math.round((pendingCount / totalBookings) * 100) : 0,
      spendMtdBarPct,
      avgCostBarPct: mtdTickets.length
        ? Math.round((mtdSpend.count / mtdTickets.length) * 100)
        : 0,
      pendingMeta:
        pendingCount > 0
          ? `${pendingCount} awaiting superadmin`
          : 'None awaiting approval',
    };
  }, [projectFilteredTickets]);

  const sortedRecentBookings = useMemo(
    () =>
      [...filteredTickets].sort((a, b) => {
        const aTime = parseCrewTicketCreatedAt(a)?.getTime() ?? 0;
        const bTime = parseCrewTicketCreatedAt(b)?.getTime() ?? 0;
        return bTime - aTime;
      }),
    [filteredTickets]
  );

  const recentBookingsTotalPages = Math.max(
    1,
    Math.ceil(sortedRecentBookings.length / RECENT_BOOKINGS_PAGE_SIZE)
  );

  useEffect(() => {
    if (recentBookingsPage > recentBookingsTotalPages) {
      setRecentBookingsPage(recentBookingsTotalPages);
    }
  }, [recentBookingsPage, recentBookingsTotalPages]);

  const paginatedRecentBookings = useMemo(() => {
    const start = (recentBookingsPage - 1) * RECENT_BOOKINGS_PAGE_SIZE;
    return sortedRecentBookings.slice(start, start + RECENT_BOOKINGS_PAGE_SIZE);
  }, [sortedRecentBookings, recentBookingsPage]);

  const activeBookingsCount = useMemo(
    () => projectFilteredTickets.filter((ticket) => getTicketStatus(ticket) !== 'CANCELLED').length,
    [projectFilteredTickets]
  );

  const cancelledBookingsCount = useMemo(
    () => projectFilteredTickets.filter((ticket) => getTicketStatus(ticket) === 'CANCELLED').length,
    [projectFilteredTickets]
  );

  const pendingApprovalCount = useMemo(
    () => projectFilteredTickets.filter((ticket) => getTicketStatus(ticket) === 'UNAPPROVED').length,
    [projectFilteredTickets]
  );

  const getTicketStatusBadgeClass = (ticket: CrewTicketApi) => {
    const status = getTicketStatus(ticket);
    if (status === 'CANCELLED') return 'subsea-b-red subsea-flight-status-cancelled';
    if (status === 'APPROVED') return 'subsea-b-green subsea-flight-status-approved';
    return 'subsea-b-orange subsea-flight-status-pending';
  };

  const routeCode = (location?: AirportLocation) => {
    const name = location?.Name ?? '';
    const match = name.match(/\[([A-Z0-9]{3})\]/);
    if (match?.[1]) return match[1];
    return name.slice(0, 3).toUpperCase() || '---';
  };

  const routeCity = (location?: AirportLocation) => {
    const name = location?.Name ?? '';
    return name.split('[')[0]?.trim().split(' - ')[0] || location?.COUNTRYNAME || 'Airport';
  };

  const displayMoney = (amount: number) => `£${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  const selectedTicketSegments = useMemo(
    () => (selectedTicket ? collectTicketSegmentDisplays(selectedTicket) : []),
    [selectedTicket]
  );

  return (
    <div className="subsea-shell">
      <SubseaNavRail activeModule="tickets" />

      <aside className="subsea-sidebar">
        <div className="subsea-sb-head">
          <span className="subsea-sb-title">Flight Bookings</span>
          <button type="button" className="subsea-sb-btn" aria-label="Filter panel">
            <Filter size={13} />
          </button>
        </div>
        <div className="subsea-sb-search">
          <div className="subsea-sb-search-wrap">
            <Search size={13} />
            <input type="text" placeholder="Search flights, PNR..." />
          </div>
        </div>
        <div className="subsea-sb-body">
          <div className="subsea-sb-group">Bookings</div>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'tickets' && statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => {
              setActiveTab('tickets');
              setStatusFilter('all');
            }}
          >
            <TicketIcon size={13} /> Active Bookings <span className="subsea-sb-count">{activeBookingsCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'search' ? ' active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={13} /> Search Flights
          </button>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'spends' ? ' active' : ''}`}
            onClick={() => setActiveTab('spends')}
          >
            <CircleDollarSign size={13} /> Report Spends
          </button>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'tickets' && statusFilter === 'pending' ? ' active' : ''}`}
            onClick={() => {
              setActiveTab('tickets');
              setStatusFilter('pending');
            }}
          >
            <AlertTriangle size={13} /> Pending Approval <span className="subsea-sb-count subsea-sb-count-red">{pendingApprovalCount}</span>
          </button>
          <button
            type="button"
            className={`subsea-sb-link${activeTab === 'tickets' && statusFilter === 'cancelled' ? ' active' : ''}`}
            onClick={() => {
              setActiveTab('tickets');
              setStatusFilter('cancelled');
            }}
          >
            <Ban size={13} /> Cancelled <span className="subsea-sb-count">{cancelledBookingsCount}</span>
          </button>
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Plane size={13} /> Upcoming Departures
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
          <button
            type="button"
            className="subsea-btn subsea-btn-default subsea-btn-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={12} className="mr-1.5" /> Back
          </button>
          <div className="subsea-crumb">
            <span>Subseacore</span>
            <span className="subsea-crumb-sep">/</span>
            <span className="subsea-crumb-active">Flight Bookings</span>
          </div>
          <div className="subsea-sync-pill">
            <span className="subsea-sync-dot" />
            GMDSS Online · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
          </div>
          <div className="subsea-top-actions">
            <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm">
              <Download size={12} /> Export
            </button>
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={() => setActiveTab('search')}>
              <Plane size={12} /> Book Flight
            </button>
            <span className="subsea-vr" />
            <SubseaProfileMenu size="sm" />
          </div>
        </div>

        <main className="subsea-content">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TicketsTab)}>
            <TabsContent value="search" className="mt-0">
              <div className="admin-tickets-search-view">
                {searchResults == null ? (
                  <>
                    <div className="admin-tickets-flights-hero">
                      <div className="admin-tickets-flights-hero-left">
                        <div className="admin-tickets-flights-hero-icon">
                          <Plane size={28} />
                        </div>
                        <div>
                          <h2 className="admin-tickets-flights-hero-title">Flights</h2>
                          <p className="admin-tickets-flights-hero-subtitle">Search and compare flight options</p>
                        </div>
                      </div>
                      <div className="admin-tickets-flights-hero-currency">
                        <label htmlFor="hero-currency" className="admin-tickets-flights-hero-currency-label">CURRENCY</label>
                        <select
                          id="hero-currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                          className="admin-tickets-flights-hero-currency-select"
                        >
                          {CURRENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="admin-tickets-search-panel">
                      <div className="admin-tickets-search-form">
                        <section className="admin-tickets-search-section admin-tickets-search-section-full">
                          <div className="admin-tickets-search-row admin-tickets-search-row-trip">
                            <span className="admin-tickets-search-row-label">Trip type</span>
                            <div className="admin-tickets-search-radio-group admin-tickets-search-radio-group-trip">
                              <label className="admin-tickets-search-radio">
                                <input
                                  type="radio"
                                  name="trip-type"
                                  checked={searchTripTypeUI === 'one-way'}
                                  onChange={() => changeSearchTripType('one-way')}
                                />
                                <span>One way</span>
                              </label>
                              <label className="admin-tickets-search-radio">
                                <input
                                  type="radio"
                                  name="trip-type"
                                  checked={searchTripTypeUI === 'round-trip'}
                                  onChange={() => changeSearchTripType('round-trip')}
                                />
                                <span>Round trip</span>
                              </label>
                              <label className="admin-tickets-search-radio">
                                <input
                                  type="radio"
                                  name="trip-type"
                                  checked={searchTripTypeUI === 'multi-city'}
                                  onChange={() => changeSearchTripType('multi-city')}
                                />
                                <span>Multiple flights</span>
                              </label>
                            </div>
                          </div>
                        </section>

                        <section className="admin-tickets-search-section admin-tickets-search-section-full">
                          <h3 className="admin-tickets-search-section-title">Assignment</h3>
                          <div className="admin-tickets-search-section-grid">
                            <div className="admin-tickets-search-field admin-tickets-search-field-col-6">
                              <label htmlFor="search-project">Project (optional)</label>
                              <div className="admin-tickets-search-field-with-clear">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      id="search-project"
                                      variant="outline"
                                      className="admin-tickets-search-control"
                                    >
                                      <span className="truncate flex-1 text-left min-w-0">
                                        {searchProjectId
                                          ? (projects.find((p) => p.id === searchProjectId)?.title ?? 'Select project')
                                          : 'No project'}
                                      </span>
                                      <SearchFieldClearButton
                                        visible={!!searchProjectId}
                                        onClear={() => setSearchProjectId('')}
                                        label="Clear project"
                                      />
                                      <ChevronDown size={16} className="shrink-0 opacity-50" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    className={SEARCH_DROPDOWN_CONTENT_CLASS}
                                    align="start"
                                  >
                                    <DropdownMenuGroup>
                                      <DropdownMenuItem
                                        onSelect={() => setSearchProjectId('')}
                                        className={!searchProjectId ? 'admin-tickets-search-option-selected' : ''}
                                      >
                                        No project
                                      </DropdownMenuItem>
                                      {projects.map((p) => (
                                        <DropdownMenuItem
                                          key={p.id}
                                          onSelect={() => setSearchProjectId(p.id)}
                                          className={searchProjectId === p.id ? 'admin-tickets-search-option-selected' : ''}
                                        >
                                          {p.title}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuGroup>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="admin-tickets-search-field admin-tickets-search-field-col-6 admin-tickets-search-field-crew">
                              <label htmlFor="search-crew">Crew members</label>
                              <div className="admin-tickets-search-field-with-clear">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      id="search-crew"
                                      variant="outline"
                                      className="admin-tickets-search-control"
                                    >
                                      <span className="truncate flex-1 text-left min-w-0">
                                        {searchCrewLoading
                                          ? 'Loading…'
                                          : searchCrewIds.length === 0
                                            ? 'Select crew members…'
                                            : `${searchCrewIds.length} crew member${searchCrewIds.length !== 1 ? 's' : ''} selected`}
                                      </span>
                                      <SearchFieldClearButton
                                        visible={searchCrewIds.length > 0}
                                        onClear={() => setSearchCrewIds([])}
                                        label="Clear crew members"
                                      />
                                      <ChevronDown size={16} className="shrink-0 opacity-50" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    className={SEARCH_DROPDOWN_CONTENT_CLASS}
                                    align="start"
                                    onCloseAutoFocus={() => setSearchCrewFilter('')}
                                  >
                                    <div className="px-2 py-1.5">
                                      <Input
                                        value={searchCrewFilter}
                                        onChange={(e) => setSearchCrewFilter(e.target.value)}
                                        placeholder="Search crew…"
                                        className="h-8"
                                        onKeyDown={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    {searchCrewLoading && searchCrewList.length === 0 ? (
                                      <DropdownMenuLabel>Loading crew…</DropdownMenuLabel>
                                    ) : searchCrewList.length === 0 ? (
                                      <DropdownMenuLabel>No crew members found.</DropdownMenuLabel>
                                    ) : filteredSearchCrewList.length === 0 ? (
                                      <DropdownMenuLabel>No crew match your search.</DropdownMenuLabel>
                                    ) : (
                                      <DropdownMenuGroup>
                                        {filteredSearchCrewList.map((c) => {
                                          const personnelStatus = c.current_status ?? 'Available';
                                          const activeProject = c.activeProjects?.[0]?.title;
                                          const showStatus = !!departureDate;
                                          return (
                                            <DropdownMenuCheckboxItem
                                              key={c.id}
                                              checked={searchCrewIds.includes(c.id)}
                                              onCheckedChange={() => toggleCrewSearch(c.id)}
                                              onSelect={(e) => e.preventDefault()}
                                            >
                                              <div className="flex items-start gap-2 min-w-0 w-full">
                                                {showStatus && (
                                                  <span
                                                    className={crewStatusTierDotClass(personnelStatus)}
                                                    title={crewStatusTierLabel(personnelStatus)}
                                                    aria-label={crewStatusTierLabel(personnelStatus)}
                                                  />
                                                )}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                  <span>{c.firstname} {c.lastname}</span>
                                                  <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                                                  {showStatus && personnelStatus !== 'Available' ? (
                                                    <span className={`text-xs truncate crew-status-inline-label ${crewStatusTierBadgeClass(personnelStatus)}`}>
                                                      {crewStatusTierLabel(personnelStatus)}
                                                    </span>
                                                  ) : activeProject ? (
                                                    <span className="text-xs text-muted-foreground truncate">{activeProject}</span>
                                                  ) : null}
                                                </div>
                                              </div>
                                            </DropdownMenuCheckboxItem>
                                          );
                                        })}
                                      </DropdownMenuGroup>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="admin-tickets-search-section admin-tickets-search-section-full">
                          <h3 className="admin-tickets-search-section-title">
                            {searchTripTypeUI === 'multi-city' ? 'Flights' : 'Route & schedule'}
                          </h3>
                          <div className="admin-tickets-search-section-grid">
                            {searchTripTypeUI === 'multi-city' ? (
                              <>
                                <p className="admin-tickets-multi-hint admin-tickets-search-field-col-12">
                                  Book each leg as its own ticket in one flow (separate from connecting flights sold as one itinerary).
                                </p>
                                <div className="admin-tickets-multi-nonstop admin-tickets-search-field-col-12">
                                  <Checkbox
                                    id="prefer-nonstop-legs"
                                    checked={preferNonStopPerLeg}
                                    onCheckedChange={(c) => setPreferNonStopPerLeg(c === true)}
                                  />
                                  <label htmlFor="prefer-nonstop-legs" className="admin-tickets-multi-nonstop-label">
                                    Prefer non-stop for each leg (search requests direct-only when supported; list is filtered to non-stop).
                                  </label>
                                </div>
                                <p className="admin-tickets-multi-active-hint admin-tickets-search-field-col-12">
                                  Active leg for search: <strong>{activeMultiLegIndex + 1}</strong> of {multiSegments.length}. Click a leg card to change it (when not viewing results).
                                </p>
                                <div className="admin-tickets-multi-segments admin-tickets-search-field-col-12">
                                  {multiSegments.map((seg, i) => (
                                    <div
                                      key={seg.id}
                                      className={
                                        'admin-tickets-multi-seg-card' +
                                        (i === activeMultiLegIndex ? ' admin-tickets-multi-seg-card-active' : '')
                                      }
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        if (searchResults == null) setActiveMultiLegIndex(i);
                                      }}
                                      onKeyDown={(e) => {
                                        if (searchResults != null) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setActiveMultiLegIndex(i);
                                        }
                                      }}
                                    >
                                      <div className="admin-tickets-multi-seg-card-head">
                                        <span className="admin-tickets-multi-seg-title">Leg {i + 1}</span>
                                        {multiSegments.length > 2 ? (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="admin-tickets-multi-seg-remove"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeMultiSegment(i);
                                            }}
                                            aria-label={`Remove leg ${i + 1}`}
                                          >
                                            <Trash2 size={16} />
                                          </Button>
                                        ) : null}
                                      </div>
                                      <div className="admin-tickets-search-airports-row">
                                        <div className="admin-tickets-search-field">
                                          <label htmlFor={`multi-from-${seg.id}`}>From</label>
                                          <AirportCombobox
                                            id={`multi-from-${seg.id}`}
                                            value={seg.from}
                                            onChange={(a) => updateMultiSegment(i, { from: a })}
                                          />
                                        </div>
                                        <div className="admin-tickets-search-field">
                                          <label htmlFor={`multi-to-${seg.id}`}>To</label>
                                          <AirportCombobox
                                            id={`multi-to-${seg.id}`}
                                            value={seg.to}
                                            onChange={(a) => updateMultiSegment(i, { to: a })}
                                          />
                                        </div>
                                      </div>
                                      <div className="admin-tickets-search-field admin-tickets-search-date-picker">
                                        <DatePickerTime
                                          date={seg.departureDate}
                                          time={seg.departureTime}
                                          onDateChange={(d) => updateMultiSegment(i, { departureDate: d })}
                                          onTimeChange={(t) => updateMultiSegment(i, { departureTime: t })}
                                          dateLabel="Departure date"
                                          timeLabel="Min. departure time"
                                          datePlaceholder="Select date"
                                          showTime={true}
                                          idPrefix={`multi-dep-${seg.id}`}
                                          onClear={() => updateMultiSegment(i, { departureDate: '', departureTime: '' })}
                                          hasValue={!!seg.departureDate?.trim() || !!seg.departureTime?.trim()}
                                          disablePastDates
                                          popoverContentClassName={SEARCH_SELECT_CONTENT_CLASS}
                                        />
                                      </div>
                                      <div className="admin-tickets-search-field admin-tickets-search-date-picker">
                                        <DatePickerTime
                                          date={seg.arrivalDate}
                                          time={seg.arrivalTime}
                                          onDateChange={(d) => updateMultiSegment(i, { arrivalDate: d })}
                                          onTimeChange={(t) => updateMultiSegment(i, { arrivalTime: t })}
                                          dateLabel="Arrival date (optional)"
                                          timeLabel="Max. arrival time"
                                          datePlaceholder="Select date"
                                          showTime={true}
                                          idPrefix={`multi-arr-${seg.id}`}
                                          onClear={() => updateMultiSegment(i, { arrivalDate: '', arrivalTime: '' })}
                                          hasValue={!!seg.arrivalDate?.trim() || !!seg.arrivalTime?.trim()}
                                          popoverContentClassName={SEARCH_SELECT_CONTENT_CLASS}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {multiSegments.length < MAX_MULTI_SEGMENTS ? (
                                  <div className="admin-tickets-multi-add-row admin-tickets-search-field-col-12">
                                    <Button type="button" variant="outline" size="sm" onClick={addMultiSegment}>
                                      <Plus size={16} className="mr-1" />
                                      Add flight
                                    </Button>
                                    <span className="admin-tickets-multi-add-cap">Up to {MAX_MULTI_SEGMENTS} legs</span>
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <div className="admin-tickets-search-field admin-tickets-search-field-col-6">
                                  <label htmlFor="search-from">From</label>
                                  <AirportCombobox
                                    id="search-from"
                                    value={searchFrom}
                                    onChange={setSearchFrom}
                                  />
                                </div>
                                <div className="admin-tickets-search-field admin-tickets-search-field-col-6">
                                  <label htmlFor="search-to">To</label>
                                  <AirportCombobox
                                    id="search-to"
                                    value={searchTo}
                                    onChange={setSearchTo}
                                  />
                                </div>
                                <div className="admin-tickets-search-field admin-tickets-search-date-picker admin-tickets-search-field-col-12">
                                  <DatePickerTime
                                    date={departureDate}
                                    time={departureTime}
                                    onDateChange={setDepartureDate}
                                    onTimeChange={setDepartureTime}
                                    dateLabel="Departure date"
                                    timeLabel="Min. departure time"
                                    datePlaceholder="Select date"
                                    showTime={searchTripTypeUI === 'one-way'}
                                    idPrefix="search-departure"
                                    onClear={() => {
                                      setDepartureDate('');
                                      setDepartureTime('');
                                    }}
                                    hasValue={!!departureDate?.trim() || !!departureTime?.trim()}
                                    disablePastDates
                                    popoverContentClassName={SEARCH_SELECT_CONTENT_CLASS}
                                  />
                                </div>
                                {searchTripTypeUI === 'one-way' ? (
                                  <div className="admin-tickets-search-field admin-tickets-search-date-picker admin-tickets-search-field-col-12">
                                    <DatePickerTime
                                      date={arrivalDate}
                                      time={arrivalTime}
                                      onDateChange={setArrivalDate}
                                      onTimeChange={setArrivalTime}
                                      dateLabel="Arrival date"
                                      timeLabel="Max. arrival time"
                                      datePlaceholder="Select date"
                                      showTime={true}
                                      idPrefix="search-arrival"
                                      onClear={() => {
                                        setArrivalDate('');
                                        setArrivalTime('');
                                      }}
                                      hasValue={!!arrivalDate?.trim() || !!arrivalTime?.trim()}
                                      popoverContentClassName={SEARCH_SELECT_CONTENT_CLASS}
                                    />
                                  </div>
                                ) : null}
                                {searchTripTypeUI === 'round-trip' ? (
                                  <div className="admin-tickets-search-field admin-tickets-search-date-picker admin-tickets-search-field-col-12">
                                    <DatePickerTime
                                      date={returnDate}
                                      time={returnTime}
                                      onDateChange={setReturnDate}
                                      onTimeChange={setReturnTime}
                                      dateLabel="Return date"
                                      timeLabel="Return time"
                                      datePlaceholder="Select date"
                                      showTime={true}
                                      idPrefix="search-return"
                                      onClear={() => {
                                        setReturnDate('');
                                        setReturnTime('');
                                      }}
                                      hasValue={!!returnDate?.trim() || !!returnTime?.trim()}
                                      popoverContentClassName={SEARCH_SELECT_CONTENT_CLASS}
                                    />
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </section>

                        <section className="admin-tickets-search-section admin-tickets-search-section-full">
                          <h3 className="admin-tickets-search-section-title">Passengers</h3>
                          <div className="admin-tickets-search-section-grid">
                            <div className="admin-tickets-search-field admin-tickets-search-field-col-4">
                              <label htmlFor="search-adults">Adults</label>
                              <Input
                                id="search-adults"
                                type="number"
                                min={0}
                                value={adults}
                                onChange={(e) => setAdults(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                className="admin-tickets-search-input"
                              />
                            </div>
                            <div className="admin-tickets-search-field admin-tickets-search-field-col-4 admin-tickets-search-field-cabin">
                              <label htmlFor="search-cabin">Cabin class</label>
                              <div className="admin-tickets-search-field-with-clear">
                                <Select
                                  value={cabinClass}
                                  onValueChange={(v) => setCabinClass(v as CabinClass)}
                                >
                                  <SelectTrigger id="search-cabin" className="admin-tickets-search-control">
                                    <SelectValue placeholder="Select cabin" />
                                    <SearchFieldClearButton
                                      visible={cabinClass !== 'economy'}
                                      onClear={() => setCabinClass('economy')}
                                      label="Clear cabin class"
                                    />
                                  </SelectTrigger>
                                  <SelectContent className={SEARCH_SELECT_CONTENT_CLASS}>
                                    {CABIN_OPTIONS.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                      {searchError && (
                        <div className="admin-tickets-search-error" role="alert">
                          {searchError}
                        </div>
                      )}
                      <div className="admin-tickets-search-actions">
                        <Button
                          type="button"
                          onClick={() => handleSearch()}
                          disabled={
                            isSearching ||
                            (searchTripTypeUI === 'multi-city'
                              ? !(multiSegments[activeMultiLegIndex]?.from && multiSegments[activeMultiLegIndex]?.to)
                              : !searchFrom || !searchTo)
                          }
                        >
                          {isSearching ? (
                            <>
                              <span className="admin-tickets-spinner admin-tickets-spinner-inline" />
                              Searching…
                            </>
                          ) : (
                            <>
                              <Search size={18} />
                              {searchTripTypeUI === 'multi-city'
                                ? `Search leg ${activeMultiLegIndex + 1}`
                                : 'Search flights'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="admin-tickets-results-wrap">
                    <div className="admin-tickets-results-header">
                      <Button variant="outline" type="button" onClick={handleSearchBack}>
                        <ChevronLeft size={18} />
                        Back to search
                      </Button>
                      {searchCriteria && (
                        <p className="admin-tickets-results-summary">
                          {searchTripTypeUI === 'multi-city' ? (
                            <>
                              Leg {activeMultiLegIndex + 1} of {multiSegments.length}:{' '}
                              {searchCriteria.from?.Name ?? '—'} → {searchCriteria.to?.Name ?? '—'}
                              {searchCriteria.departureDate && ` · ${searchCriteria.departureDate}`}
                            </>
                          ) : (
                            <>
                              {searchCriteria.from?.Name ?? '—'} → {searchCriteria.to?.Name ?? '—'}
                              {searchCriteria.departureDate && ` · ${searchCriteria.departureDate}`}
                            </>
                          )}
                        </p>
                      )}
                      <div className="admin-tickets-results-sort">
                        <label htmlFor="flight-results-sort">Sort</label>
                        <Select
                          value={selectedFlightSortValue}
                          onValueChange={(value) => {
                            void handleResultSortChange(value as FlightSortValue);
                          }}
                          disabled={isSearching || isLoadingMore}
                        >
                          <SelectTrigger id="flight-results-sort" className="admin-tickets-results-sort-trigger">
                            <SelectValue placeholder="Sort results" />
                          </SelectTrigger>
                          <SelectContent className={SEARCH_SELECT_CONTENT_CLASS}>
                            {FLIGHT_SORT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isSearching ? <span className="admin-tickets-spinner admin-tickets-spinner-inline" /> : null}
                      </div>
                      <p className="admin-tickets-results-count">
                        {searchTotalCount} flight{searchTotalCount !== 1 ? 's' : ''} found
                        {searchTripTypeUI === 'multi-city' &&
                          preferNonStopPerLeg &&
                          displayedSearchFlights &&
                          searchResults &&
                          displayedSearchFlights.length !== searchResults.length && (
                            <span className="admin-tickets-results-count-note">
                              {' '}
                              · {displayedSearchFlights.length} non-stop shown from {searchResults.length} loaded
                            </span>
                          )}
                      </p>
                    </div>
                    <div className="admin-tickets-results-list">
                      {searchResults.length === 0 ? (
                        <p className="admin-tickets-results-empty">No flights match your criteria.</p>
                      ) : (displayedSearchFlights?.length ?? 0) === 0 ? (
                        <p className="admin-tickets-results-empty">
                          No non-stop flights in the loaded results. Clear the non-stop filter or try Load more.
                        </p>
                      ) : (
                        <>
                          {(displayedSearchFlights ?? searchResults).map((flight) => (
                            <FlightResultCard
                              key={flight.id}
                              flight={flight}
                              currency={currency}
                              onBook={handleBookNow}
                              isBooking={
                                bookingFlightKey ===
                                (searchTripTypeUI === 'multi-city'
                                  ? `${activeMultiLegIndex}::${flight.id}`
                                  : flight.id)
                              }
                            />
                          ))}
                          {searchResults.length < searchTotalCount && (
                            <div className="admin-tickets-load-more-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={isLoadingMore || isSearching}
                                className="admin-tickets-load-more-btn"
                              >
                                {isLoadingMore ? (
                                  <>
                                    <span className="admin-tickets-spinner admin-tickets-spinner-inline" />
                                    Loading…
                                  </>
                                ) : (
                                  `Load more (showing ${searchResults.length} of ${searchTotalCount})`
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="tickets" className="mt-0">
              <div className="subsea-page-head">
                <div>
                  <h1>Flight Bookings</h1>
                  <p>{filteredTickets.length} bookings active · {pendingApprovalCount} pending approval · IATA-compliant</p>
                </div>
                <div className="subsea-ph-right">
                  <button type="button" className="subsea-btn subsea-btn-default subsea-btn-sm" onClick={() => setActiveTab('search')}>
                    <Search size={11} /> Search Flights
                  </button>
                  <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                    <Plus size={11} /> Book Flight
                  </button>
                </div>
              </div>

              <div className="subsea-kpi-strip subsea-kpi-strip-2">
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Active Bookings</div>
                  <div className="subsea-kpi-value">{ticketDashboardStats.totalBookings}</div>
                  <div className="subsea-kpi-meta flat">{ticketDashboardStats.approvedCount} approved</div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill blue" style={{ width: `${ticketDashboardStats.activeBookingsBarPct}%` }} />
                  </div>
                </div>
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Pending Approval</div>
                  <div className="subsea-kpi-value">{pendingApprovalCount}</div>
                  <div className={`subsea-kpi-meta ${pendingApprovalCount ? 'down' : 'flat'}`}>
                    {ticketDashboardStats.pendingMeta}
                  </div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill amber" style={{ width: `${ticketDashboardStats.pendingBarPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="subsea-alert subsea-alert-info">
                <Info size={15} />
                <span><strong>{pendingApprovalCount} ticket{pendingApprovalCount !== 1 ? 's' : ''}</strong> awaiting superadmin approval. Download links appear after approval and PDF generation.</span>
                <button
                  type="button"
                  className="subsea-btn subsea-btn-default subsea-btn-sm"
                  onClick={() => {
                    setActiveTab('tickets');
                    setStatusFilter('pending');
                  }}
                >
                  Review Status
                </button>
              </div>

              <div className="subsea-toolbar-row">
                <div className="subsea-filter-wrap">
                  <span className="subsea-filter-label">Project</span>
                  <select
                    className="subsea-filter-select"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <option value="all">All projects</option>
                    {uniqueProjectsFromTickets.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="subsea-filter-chevron" />
                </div>
              </div>

              {loading ? (
                <div className="subsea-state" role="status">Loading flight bookings...</div>
              ) : error ? (
                <div className="subsea-empty-panel" role="alert">{error}</div>
              ) : ticketsLoading && tickets.length === 0 ? (
                <div className="subsea-state" role="status">Loading tickets...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="subsea-empty-panel">
                  <Plane size={34} />
                  <h3>
                    {statusFilter === 'pending'
                      ? 'No tickets pending approval'
                      : statusFilter === 'approved'
                        ? 'No approved tickets'
                        : statusFilter === 'cancelled'
                          ? 'No cancelled tickets'
                        : projectFilter === 'all'
                          ? 'No tickets yet'
                          : 'No tickets for this project'}
                  </h3>
                  <p>
                    {statusFilter === 'pending'
                      ? 'All bookings in this view are approved, or none match the selected project.'
                      : statusFilter === 'approved'
                        ? 'No approved bookings match the current project filter.'
                        : statusFilter === 'cancelled'
                          ? 'Cancelled bookings will appear here after you cancel an active ticket.'
                        : projectFilter === 'all'
                          ? 'Create tickets for crew on your projects.'
                          : 'Try selecting all projects or book a new flight.'}
                  </p>
                  <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
                    <Plus size={12} /> Book Flight
                  </button>
                </div>
              ) : (
                <div>
                  <div className="subsea-pane">
                    <div className="subsea-pane-head">
                      <div className="subsea-pane-title">Recent Bookings</div>
                      <div className="subsea-pane-actions">
                        <span className="subsea-pane-sub">
                          {sortedRecentBookings.length > 0
                            ? `${(recentBookingsPage - 1) * RECENT_BOOKINGS_PAGE_SIZE + 1}-${Math.min(recentBookingsPage * RECENT_BOOKINGS_PAGE_SIZE, sortedRecentBookings.length)} of ${sortedRecentBookings.length}`
                            : '0 bookings'}
                        </span>
                        <button
                          type="button"
                          className="subsea-btn subsea-btn-default subsea-btn-sm"
                          onClick={() => {
                            setProjectFilter('all');
                            setStatusFilter('all');
                          }}
                        >
                          All Bookings
                        </button>
                      </div>
                    </div>
                    <div className="subsea-pane-body">
                      {paginatedRecentBookings.map((ticket) => (
                        <div
                          key={ticket.id}
                          className={`subsea-flight-card${
                            getTicketStatus(ticket) === 'CANCELLED'
                              ? ' cancelled'
                              : getTicketStatus(ticket) !== 'APPROVED'
                                ? ' pending'
                                : ''
                          }`}
                          onClick={() => setSelectedTicket(ticket)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedTicket(ticket);
                            }
                          }}
                        >
                          <div className="subsea-flight-route">
                            <div className="subsea-airport">
                              <div className="subsea-airport-code">{routeCode(ticket.from)}</div>
                              <div className="subsea-airport-city">{routeCity(ticket.from)}</div>
                            </div>
                            <div className="subsea-flight-line">
                              <div className="subsea-flight-line-bar" />
                              <div className="subsea-flight-dur">{ticket.trip?.replace('_', ' ') ?? 'One way'} · {ticket.class ?? 'Economy'}</div>
                            </div>
                            <div className="subsea-airport">
                              <div className="subsea-airport-code">{routeCode(ticket.to)}</div>
                              <div className="subsea-airport-city">{routeCity(ticket.to)}</div>
                            </div>
                            <div className="subsea-flight-status">
                              <span className={`subsea-badge ${getTicketStatusBadgeClass(ticket)}`}>
                                {getTicketStatusLabel(ticket)}
                              </span>
                            </div>
                          </div>
                          <div className="subsea-flight-meta">
                            <div className="subsea-flight-meta-item"><div className="subsea-flight-meta-label">Pax</div><div className="subsea-flight-meta-val">{getCrewName(ticket)}</div></div>
                            <div className="subsea-flight-meta-item"><div className="subsea-flight-meta-label">Project</div><div className="subsea-flight-meta-val">{getProjectTitle(ticket)}</div></div>
                            <div className="subsea-flight-meta-item"><div className="subsea-flight-meta-label">Rig</div><div className="subsea-flight-meta-val">{getRigName(ticket)}</div></div>
                            <div className="subsea-flight-meta-item"><div className="subsea-flight-meta-label">Booking ref</div><div className="subsea-flight-meta-val">{ticket.bookingReference || 'Pending'}</div></div>
                            <div className="subsea-flight-meta-item"><div className="subsea-flight-meta-label">Fare</div><div className="subsea-flight-meta-val">{ticket.price != null ? displayMoney(ticket.price) : 'TBC'}</div></div>
                            <button
                              type="button"
                              className="subsea-icon-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handlePreviewTicketPdf(ticket);
                              }}
                              disabled={previewingTicketId === ticket.id}
                              aria-disabled={!canUseTicketPdf(ticket)}
                              title={
                                previewingTicketId === ticket.id
                                  ? 'Opening ticket PDF…'
                                  : canUseTicketPdf(ticket)
                                    ? 'Preview ticket PDF in new tab'
                                    : 'PDF available after approval'
                              }
                            >
                              {previewingTicketId === ticket.id ? (
                                <Loader2 size={14} className="animate-spin" aria-hidden />
                              ) : (
                                <ExternalLink size={14} />
                              )}
                            </button>
                            {!isTicketCancelled(ticket) && (
                            <button
                              type="button"
                              className="subsea-icon-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestCancelTicketFlow(ticket);
                              }}
                              title="Cancel ticket"
                            >
                              <Ban size={14} />
                            </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {sortedRecentBookings.length > RECENT_BOOKINGS_PAGE_SIZE && (
                      <div className="subsea-pagination">
                        <span>
                          Showing {(recentBookingsPage - 1) * RECENT_BOOKINGS_PAGE_SIZE + 1}-
                          {Math.min(recentBookingsPage * RECENT_BOOKINGS_PAGE_SIZE, sortedRecentBookings.length)} of{' '}
                          {sortedRecentBookings.length} bookings
                        </span>
                        <div>
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-default subsea-btn-sm"
                            disabled={recentBookingsPage <= 1}
                            onClick={() => setRecentBookingsPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </button>
                          {Array.from({ length: recentBookingsTotalPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`subsea-btn subsea-btn-sm ${p === recentBookingsPage ? 'subsea-btn-primary' : 'subsea-btn-default'}`}
                              onClick={() => setRecentBookingsPage(p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="subsea-btn subsea-btn-default subsea-btn-sm"
                            disabled={recentBookingsPage >= recentBookingsTotalPages}
                            onClick={() => setRecentBookingsPage((p) => Math.min(recentBookingsTotalPages, p + 1))}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="spends" className="mt-0">
              <div className="subsea-page-head">
                <div>
                  <h1>Report Spends</h1>
                  <p>
                    Flight spend analytics · {ticketDashboardStats.totalBookings} active booking
                    {ticketDashboardStats.totalBookings !== 1 ? 's' : ''}
                    {ticketDashboardStats.cancelledCount > 0
                      ? ` · ${ticketDashboardStats.cancelledCount} cancelled excluded from spend`
                      : ''}
                    {projectFilter !== 'all' ? ' · filtered by project' : ''}
                  </p>
                </div>
              </div>

              <div className="subsea-kpi-strip subsea-kpi-strip-4">
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Total Spend MTD</div>
                  <div className="subsea-kpi-value">{displayMoney(ticketDashboardStats.mtdSpend.total)}</div>
                  <div className={`subsea-kpi-meta ${ticketDashboardStats.spendChangeTone}`}>
                    {ticketDashboardStats.spendChangeMeta}
                  </div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill teal" style={{ width: `${ticketDashboardStats.spendMtdBarPct}%` }} />
                  </div>
                </div>
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Avg Ticket Cost</div>
                  <div className="subsea-kpi-value">
                    {ticketDashboardStats.mtdSpend.count
                      ? displayMoney(ticketDashboardStats.mtdSpend.average)
                      : '—'}
                  </div>
                  <div className="subsea-kpi-meta flat">{ticketDashboardStats.avgCostMeta}</div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill green" style={{ width: `${ticketDashboardStats.avgCostBarPct}%` }} />
                  </div>
                </div>
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Priced Bookings</div>
                  <div className="subsea-kpi-value">{ticketDashboardStats.mtdSpend.count}</div>
                  <div className="subsea-kpi-meta flat">This month</div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill blue" style={{ width: `${Math.min(100, ticketDashboardStats.mtdSpend.count * 10)}%` }} />
                  </div>
                </div>
                <div className="subsea-kpi">
                  <div className="subsea-kpi-label">Destinations</div>
                  <div className="subsea-kpi-value">{ticketDashboardStats.spendByDestination.length}</div>
                  <div className="subsea-kpi-meta flat">With recorded spend</div>
                  <div className="subsea-kpi-bar">
                    <div className="subsea-kpi-fill amber" style={{ width: `${Math.min(100, ticketDashboardStats.spendByDestination.length * 20)}%` }} />
                  </div>
                </div>
              </div>

              <div className="subsea-g2">
                <div className="subsea-pane">
                  <div className="subsea-pane-head"><div className="subsea-pane-title">Spend by Destination</div></div>
                  <div className="subsea-pane-body subsea-pane-body-compact">
                    {ticketDashboardStats.spendByDestination.length === 0 ? (
                      <div className="subsea-state">No priced bookings yet</div>
                    ) : (
                      ticketDashboardStats.spendByDestination.map((row) => (
                        <div className="subsea-metric-row" key={row.label}>
                          <div className="subsea-metric-grow">
                            <div className="subsea-metric-label">{row.label}</div>
                            <div className="subsea-prog-bar">
                              <div className={`subsea-prog-fill ${row.color}`} style={{ width: `${row.barPct}%` }} />
                            </div>
                          </div>
                          <div className="subsea-metric-val">{displayMoney(row.amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="subsea-pane">
                  <div className="subsea-pane-head"><div className="subsea-pane-title">Bookings by Class</div></div>
                  <div className="subsea-pane-body subsea-pane-body-compact">
                    {ticketDashboardStats.bookingsByClass.length === 0 ? (
                      <div className="subsea-state">No bookings yet</div>
                    ) : (
                      ticketDashboardStats.bookingsByClass.map((row) => (
                        <div className="subsea-metric-row" key={row.label}>
                          <span className="subsea-metric-label">{row.label}</span>
                          <span className="subsea-metric-val">{row.count} ({row.pct}%)</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} admin-tickets-detail-dialog`}>
          {selectedTicket && (
            <>
              <DialogHeader className="admin-tickets-detail-header">
                <div className="admin-tickets-detail-header-top">
                  <div>
                    <DialogTitle className="admin-tickets-detail-title">
                      <TicketIcon size={18} className="text-primary" />
                      Ticket details
                    </DialogTitle>
                    <p className="admin-tickets-detail-route">
                      {routeCode(selectedTicket.from)} → {routeCode(selectedTicket.to)}
                      <span className="admin-tickets-detail-route-cities">
                        {routeCity(selectedTicket.from)} to {routeCity(selectedTicket.to)}
                      </span>
                    </p>
                  </div>
                  <span className={`subsea-badge ${getTicketStatusBadgeClass(selectedTicket)}`}>
                    {getTicketStatusLabel(selectedTicket)}
                  </span>
                </div>
                <div className="admin-tickets-detail-chips">
                  <span className="admin-tickets-detail-chip">
                    Ref: {selectedTicket.bookingReference || 'Pending approval'}
                  </span>
                  <span className="admin-tickets-detail-chip">
                    {selectedTicket.trip?.replace(/_/g, ' ') ?? '—'}
                  </span>
                  {selectedTicket.createdAt && (
                    <span className="admin-tickets-detail-chip">
                      Booked {new Date(selectedTicket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </DialogHeader>

              <div className="admin-tickets-detail-body">
                <section className="admin-tickets-detail-section">
                  <h3 className="admin-tickets-detail-heading">
                    <Plane size={15} className="text-primary" />
                    Flight details
                  </h3>

                  {selectedTicketSegments.length > 0 ? (
                    <div className="admin-tickets-detail-segments">
                      {selectedTicketSegments.map((segment, index) => (
                        <article key={`${segment.flightCode}-${index}`} className="admin-tickets-detail-segment">
                          <div className="admin-tickets-detail-segment-head">
                            <div>
                              <span className="admin-tickets-detail-segment-label">Flight {index + 1}</span>
                              <strong>{segment.flightCode}</strong>
                              <span className="admin-tickets-detail-segment-airline">{segment.airlineName}</span>
                            </div>
                            {segment.duration !== '—' && (
                              <span className="admin-tickets-detail-duration">
                                <Clock size={13} />
                                {segment.duration}
                              </span>
                            )}
                          </div>
                          <div className="admin-tickets-detail-segment-route">
                            <div className="admin-tickets-detail-segment-endpoint">
                              <span className="admin-tickets-detail-iata">{segment.from}</span>
                              <span className="admin-tickets-detail-airport">{segment.fromAirport}</span>
                              <span className="admin-tickets-detail-datetime">
                                {segment.departureTime} · {segment.departureDate}
                              </span>
                            </div>
                            <div className="admin-tickets-detail-segment-arrow" aria-hidden>→</div>
                            <div className="admin-tickets-detail-segment-endpoint admin-tickets-detail-segment-endpoint--arrival">
                              <span className="admin-tickets-detail-iata">{segment.to}</span>
                              <span className="admin-tickets-detail-airport">{segment.toAirport}</span>
                              <span className="admin-tickets-detail-datetime">
                                {segment.arrivalTime} · {segment.arrivalDate}
                              </span>
                            </div>
                          </div>
                          {(segment.cabin || segment.baggage || segment.layover) && (
                            <div className="admin-tickets-detail-segment-meta">
                              {segment.cabin && <span>Class: {segment.cabin}</span>}
                              {segment.baggage && <span>Baggage: {segment.baggage}</span>}
                              {segment.layover && <span>Layover: {segment.layover}</span>}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <dl className="admin-tickets-detail-grid">
                      <div className="admin-tickets-detail-grid-item">
                        <dt>From</dt>
                        <dd>{selectedTicket.from?.Name ?? '—'}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>To</dt>
                        <dd>{selectedTicket.to?.Name ?? '—'}</dd>
                      </div>
                    </dl>
                  )}

                  <dl className="admin-tickets-detail-grid admin-tickets-detail-grid--summary">
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Class</dt>
                      <dd>{formatTicketClass(selectedTicket.class)}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Trip</dt>
                      <dd>{selectedTicket.trip?.replace(/_/g, ' ') ?? '—'}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Duration</dt>
                      <dd>{getTicketTotalDuration(selectedTicket)}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Airline</dt>
                      <dd>{getTicketPrimaryAirline(selectedTicket)}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Departure</dt>
                      <dd>{getTicketDepartureSummary(selectedTicket)}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Arrival</dt>
                      <dd>{getTicketArrivalSummary(selectedTicket)}</dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Passengers</dt>
                      <dd>
                        {[
                          selectedTicket.adult ? `${selectedTicket.adult} adult(s)` : null,
                          selectedTicket.children ? `${selectedTicket.children} child(ren)` : null,
                          selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Price</dt>
                      <dd className="admin-tickets-detail-price">
                        {selectedTicket.price != null ? displayMoney(selectedTicket.price) : '—'}
                      </dd>
                    </div>
                    <div className="admin-tickets-detail-grid-item">
                      <dt>Cashback</dt>
                      <dd className="admin-tickets-detail-cashback">
                        {selectedTicket.cashback != null ? displayMoney(selectedTicket.cashback) : '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <div className="admin-tickets-detail-columns">
                  <section className="admin-tickets-detail-section">
                    <h3 className="admin-tickets-detail-heading">
                      <User size={15} className="text-primary" />
                      Crew
                    </h3>
                    <dl className="admin-tickets-detail-grid admin-tickets-detail-grid--compact">
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Name</dt>
                        <dd>{getCrewName(selectedTicket)}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Email</dt>
                        <dd>{(selectedTicket.crew_id as { email?: string })?.email ?? '—'}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Phone</dt>
                        <dd>{(selectedTicket.crew_id as { phone?: string })?.phone ?? '—'}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Nationality</dt>
                        <dd>{(selectedTicket.crew_id as { nationality?: string })?.nationality ?? '—'}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="admin-tickets-detail-section">
                    <h3 className="admin-tickets-detail-heading">
                      <Briefcase size={15} className="text-primary" />
                      Project
                    </h3>
                    <dl className="admin-tickets-detail-grid admin-tickets-detail-grid--compact">
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Title</dt>
                        <dd>{getProjectTitle(selectedTicket)}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Status</dt>
                        <dd>{selectedTicket.project_id?.status ?? '—'}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Duration</dt>
                        <dd>{formatProjectDuration(selectedTicket.project_id)}</dd>
                      </div>
                      {(selectedTicket.project_id as { description?: string })?.description && (
                        <div className="admin-tickets-detail-grid-item admin-tickets-detail-grid-item--full">
                          <dt>Description</dt>
                          <dd>{(selectedTicket.project_id as { description?: string }).description}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                </div>

                <div className="admin-tickets-detail-columns">
                  <section className="admin-tickets-detail-section">
                    <h3 className="admin-tickets-detail-heading">
                      <Anchor size={15} className="text-primary" />
                      Rig
                    </h3>
                    <dl className="admin-tickets-detail-grid admin-tickets-detail-grid--compact">
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Name</dt>
                        <dd>{getRigName(selectedTicket)}</dd>
                      </div>
                      {selectedTicket.rig_id &&
                        typeof selectedTicket.rig_id !== 'string' &&
                        (selectedTicket.rig_id as { description?: string })?.description && (
                          <div className="admin-tickets-detail-grid-item admin-tickets-detail-grid-item--full">
                            <dt>Description</dt>
                            <dd>{(selectedTicket.rig_id as { description?: string }).description}</dd>
                          </div>
                        )}
                    </dl>
                  </section>

                  <section className="admin-tickets-detail-section">
                    <h3 className="admin-tickets-detail-heading">
                      <CheckCircle2 size={15} className="text-primary" />
                      Approval
                    </h3>
                    <dl className="admin-tickets-detail-grid admin-tickets-detail-grid--compact">
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Approval status</dt>
                        <dd>{getTicketApprovalStatusLabel(selectedTicket)}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Booking reference</dt>
                        <dd className="font-mono">{selectedTicket.bookingReference || 'Pending approval'}</dd>
                      </div>
                      <div className="admin-tickets-detail-grid-item">
                        <dt>Approved at</dt>
                        <dd>
                          {selectedTicket.approvedAt
                            ? new Date(selectedTicket.approvedAt).toLocaleString('en-GB')
                            : '—'}
                        </dd>
                      </div>
                      {selectedTicket.approvedBy && (
                        <div className="admin-tickets-detail-grid-item">
                          <dt>Approved by</dt>
                          <dd>{selectedTicket.approvedBy}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                </div>
              </div>

              <div className="admin-tickets-detail-footer">
                {!isTicketCancelled(selectedTicket) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => requestCancelTicketFlow(selectedTicket)}
                  >
                    <Ban size={16} className="mr-2" />
                    Cancel ticket
                  </Button>
                ) : (
                  <span className="admin-tickets-cancelled-note">This booking has been cancelled.</span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canUseTicketPdf(selectedTicket) || previewingTicketId === selectedTicket.id}
                  onClick={() => {
                    void handlePreviewTicketPdf(selectedTicket);
                  }}
                >
                  {previewingTicketId === selectedTicket.id ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" aria-hidden />
                      Opening…
                    </>
                  ) : (
                    <>
                      <ExternalLink size={16} className="mr-2" />
                      {canUseTicketPdf(selectedTicket) ? 'Preview ticket PDF' : 'PDF after approval'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ticketToConfirmCancel}
        onOpenChange={(open) => {
          if (!open && !cancelTicketSubmitting) setTicketToConfirmCancel(null);
        }}
      >
        <DialogContent showCloseButton={!cancelTicketSubmitting} className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>Cancel this ticket?</DialogTitle>
            <DialogDescription className="text-left pt-1">
              This marks the booking as cancelled for{' '}
              <span className="font-medium text-foreground">
                {ticketToConfirmCancel ? getCrewName(ticketToConfirmCancel) : ''}
              </span>
              {ticketToConfirmCancel ? (
                <>
                  {' '}
                  on {getProjectTitle(ticketToConfirmCancel)} ({ticketToConfirmCancel.from?.Name ?? '—'} →{' '}
                  {ticketToConfirmCancel.to?.Name ?? '—'}).
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTicketToConfirmCancel(null)}
              disabled={cancelTicketSubmitting}
            >
              Keep ticket
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancelTicket}
              disabled={cancelTicketSubmitting || !ticketToConfirmCancel}
            >
              {cancelTicketSubmitting ? (
                <>
                  <span className="admin-tickets-spinner admin-tickets-spinner-inline mr-2" />
                  Cancelling…
                </>
              ) : (
                <>
                  <Ban size={16} className="mr-2" />
                  Cancel ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateModalOpen} onOpenChange={(open) => !open && closeCreateModal()}>
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-lg max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>
              {modalStep === 'project'
                ? 'Create ticket — Select project'
                : modalStep === 'crew'
                  ? `Select crew — ${selectedProject?.title ?? ''}`
                  : 'Create flight tickets'}
            </DialogTitle>
          </DialogHeader>
          <div className="admin-tickets-modal">
            {submitSuccess ? (
              <div className="admin-tickets-success" role="status">
                Tickets created for {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}. Approval may be required before PDF is available.
              </div>
            ) : modalStep === 'project' ? (
              <>
                <p className="admin-tickets-modal-intro">
                  Select a project to create flight tickets for enrolled crew.
                </p>
                <div className="admin-tickets-form-field">
                  <label htmlFor="create-ticket-project">Project</label>
                  <select
                    id="create-ticket-project"
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                    className="admin-tickets-project-select"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                {projects.length === 0 && (
                  <p className="admin-tickets-crew-empty">No projects available.</p>
                )}
                <div className="admin-tickets-modal-actions flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleProjectSelectAndContinue}
                    disabled={!createProjectId}
                  >
                    Continue
                  </Button>
                </div>
              </>
            ) : modalStep === 'crew' ? (
              <>
                <p className="admin-tickets-modal-intro">
                  Select crew members from <strong>{selectedProject?.title ?? ''}</strong> to create flight tickets.
                </p>
                {crewLoading ? (
                  <p className="admin-tickets-crew-loading">Loading crew…</p>
                ) : crew.length === 0 ? (
                  <p className="admin-tickets-crew-empty">No crew enrolled in this project yet.</p>
                ) : (
                  <>
                    <div className="admin-tickets-crew-actions">
                      <button type="button" className="admin-tickets-select-link" onClick={selectAllCrew}>
                        Select all
                      </button>
                      <span className="admin-tickets-select-sep">·</span>
                      <button type="button" className="admin-tickets-select-link" onClick={deselectAllCrew}>
                        Deselect all
                      </button>
                    </div>
                    <div className="admin-tickets-crew-list" role="group">
                      {crew.map((c) => (
                        <label key={c.id} className="admin-tickets-crew-item">
                          <input
                            type="checkbox"
                            checked={selectedCrewIds.includes(c.id)}
                            onChange={() => toggleCrewSelection(c.id)}
                            className="admin-tickets-crew-checkbox"
                          />
                          <span className="admin-tickets-crew-name">
                            {c.firstname} {c.lastname}
                          </span>
                          <span className="admin-tickets-crew-email">{c.email}</span>
                        </label>
                      ))}
                    </div>
                    {selectedCrewIds.length > 0 && (
                      <p className="admin-tickets-selected-count">
                        {selectedCrewIds.length} member{selectedCrewIds.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </>
                )}
                <div className="admin-tickets-modal-actions flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeCreateModal}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={goToForm}
                    disabled={crewLoading || crew.length === 0 || selectedCrewIds.length === 0}
                  >
                    Continue to flight details
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={goBackToCrew} className="-ml-2">
                  <ChevronLeft size={16} />
                  Back to crew selection
                </Button>

                {submitError && (
                  <div className="admin-tickets-form-error" role="alert">
                    {submitError}
                  </div>
                )}

                <form className="admin-tickets-form" onSubmit={handleSubmitTickets}>
                  <div className="admin-tickets-form-field admin-tickets-form-field-full">
                    <label htmlFor="ticket-rig">Rig</label>
                    <select
                      id="ticket-rig"
                      value={createRigId}
                      onChange={(e) => setCreateRigId(e.target.value)}
                      disabled={submitLoading}
                    >
                      <option value="">No rig selected</option>
                      {rigs.map((rig) => (
                        <option key={rig.id} value={rig.id}>
                          {rig.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <fieldset className="admin-tickets-fieldset">
                    <legend>From</legend>
                    <div className="admin-tickets-form-row">
                      <div className="admin-tickets-form-field admin-tickets-form-field-full">
                        <label htmlFor="from-name">Airport name</label>
                        <input
                          id="from-name"
                          type="text"
                          value={formData.fromName}
                          onChange={(e) => setFormData((d) => ({ ...d, fromName: e.target.value }))}
                          placeholder="e.g. Mumbai [BOM] - Chhatrapati Shivaji Maharaj International Airport, India"
                          required
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                    <div className="admin-tickets-form-row admin-tickets-form-row-2">
                      <div className="admin-tickets-form-field">
                        <label htmlFor="from-country">Country code</label>
                        <input
                          id="from-country"
                          type="text"
                          value={formData.fromCountry}
                          onChange={(e) => setFormData((d) => ({ ...d, fromCountry: e.target.value }))}
                          placeholder="e.g. IN"
                          maxLength={4}
                          disabled={submitLoading}
                        />
                      </div>
                      <div className="admin-tickets-form-field">
                        <label htmlFor="from-country-name">Country name</label>
                        <input
                          id="from-country-name"
                          type="text"
                          value={formData.fromCountryName}
                          onChange={(e) => setFormData((d) => ({ ...d, fromCountryName: e.target.value }))}
                          placeholder="e.g. India"
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="admin-tickets-fieldset">
                    <legend>To</legend>
                    <div className="admin-tickets-form-row">
                      <div className="admin-tickets-form-field admin-tickets-form-field-full">
                        <label htmlFor="to-name">Airport name</label>
                        <input
                          id="to-name"
                          type="text"
                          value={formData.toName}
                          onChange={(e) => setFormData((d) => ({ ...d, toName: e.target.value }))}
                          placeholder="e.g. Delhi NCR [DEL] - Indira Gandhi International Airport, India"
                          required
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                    <div className="admin-tickets-form-row admin-tickets-form-row-2">
                      <div className="admin-tickets-form-field">
                        <label htmlFor="to-country">Country code</label>
                        <input
                          id="to-country"
                          type="text"
                          value={formData.toCountry}
                          onChange={(e) => setFormData((d) => ({ ...d, toCountry: e.target.value }))}
                          placeholder="e.g. IN"
                          maxLength={4}
                          disabled={submitLoading}
                        />
                      </div>
                      <div className="admin-tickets-form-field">
                        <label htmlFor="to-country-name">Country name</label>
                        <input
                          id="to-country-name"
                          type="text"
                          value={formData.toCountryName}
                          onChange={(e) => setFormData((d) => ({ ...d, toCountryName: e.target.value }))}
                          placeholder="e.g. India"
                          disabled={submitLoading}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <div className="admin-tickets-form-row admin-tickets-form-row-2">
                    <div className="admin-tickets-form-field">
                      <label htmlFor="trip">Trip type</label>
                      <select
                        id="trip"
                        value={formData.trip}
                        onChange={(e) => setFormData((d) => ({ ...d, trip: e.target.value as CreateFlightTicketPayload['trip'] }))}
                        disabled={submitLoading}
                      >
                        {TRIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="class">Class</label>
                      <select
                        id="class"
                        value={formData.class}
                        onChange={(e) => setFormData((d) => ({ ...d, class: e.target.value as CreateFlightTicketPayload['class'] }))}
                        disabled={submitLoading}
                      >
                        {CLASS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="admin-tickets-form-row admin-tickets-form-row-3">
                    <div className="admin-tickets-form-field">
                      <label htmlFor="adult">Adults</label>
                      <input
                        id="adult"
                        type="number"
                        min={0}
                        value={formData.adult}
                        onChange={(e) => setFormData((d) => ({ ...d, adult: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="children">Children</label>
                      <input
                        id="children"
                        type="number"
                        min={0}
                        value={formData.children}
                        onChange={(e) => setFormData((d) => ({ ...d, children: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                    <div className="admin-tickets-form-field">
                      <label htmlFor="infants">Infants</label>
                      <input
                        id="infants"
                        type="number"
                        min={0}
                        value={formData.infants}
                        onChange={(e) => setFormData((d) => ({ ...d, infants: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        disabled={submitLoading}
                      />
                    </div>
                  </div>

                  <p className="admin-tickets-form-hint">
                    Creating tickets for {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}
                  </p>

                  <div className="admin-tickets-modal-actions flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeCreateModal} disabled={submitLoading}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitLoading}
                    >
                      {submitLoading ? 'Creating…' : `Create ${selectedCrewIds.length} ticket${selectedCrewIds.length !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Flight Search Booking Confirmation Dialog */}
      <Dialog
        open={!!flightToBook}
        onOpenChange={(open) => {
          if (!open && !bookingFlightKey && !searchBookingSuccess) {
            setFlightToBook(null);
            setBookingConfirmConflicts([]);
            setBookingTravelDirection('HOME_TO_RIG');
          }
        }}
      >
        <DialogContent showCloseButton={!bookingFlightKey && !searchBookingSuccess} className={`${SUBSEA_FORM_LIGHT_CLASS} admin-tickets-booking-confirm-dialog max-w-2xl max-h-[92vh] overflow-y-auto`}>
          {searchBookingSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 animate-bounce">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Booking Successful!</h3>
              <p className="text-sm text-muted-foreground px-4">
                {searchSuccessMessage || 'Ticket has been booked and sent for approval.'}
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Book flight tickets?</DialogTitle>
                <DialogDescription className="text-left pt-2 text-muted-foreground">
                  Confirm booking for the selected crew. Travel days will be marked occupied on their availability calendar until the ticket is cancelled.
                </DialogDescription>
              </DialogHeader>

              {flightToBook && (() => {
                const firstLeg = flightToBook.legs?.[0];
                const lastLeg = flightToBook.legs?.[flightToBook.legs.length - 1];
                const firstSeg = firstLeg?.itinerary?.[0];
                const lastSeg = lastLeg?.itinerary?.[lastLeg.itinerary.length - 1];
                const fromAirport = firstSeg?.fromAirport ?? firstLeg?.from ?? '—';
                const toAirport = lastSeg?.toAirport ?? lastLeg?.to ?? '—';
                const departureTime = firstLeg?.departureTime ?? '';
                const arrivalTime = lastLeg?.arrivalTime ?? '';
                const duration = firstLeg?.duration ?? '—';
                const stops = (flightToBook as { stops?: number }).stops ?? firstLeg?.stops ?? 0;
                const airlineName = (flightToBook as { airlineName?: string }).airlineName ?? firstLeg?.airlineName ?? '—';
                const firstFare = flightToBook.fares?.[0];
                const priceAmount = firstFare?.totalFare ?? 0;

                return (
                  <div className="mt-2 space-y-4">
                    <div className="booking-confirm-card">
                      <div className="booking-confirm-header">
                        <div className="booking-confirm-airline">
                          <span>{airlineName}</span>
                        </div>
                        <span className="booking-confirm-price">
                          {currency} {priceAmount.toLocaleString()}
                        </span>
                      </div>

                      <div className="booking-confirm-details">
                        <div className="booking-confirm-node departure">
                          <span className="booking-confirm-time">{departureTime ? fmtTime(departureTime) : '—'}</span>
                          <span className="booking-confirm-date">{departureTime ? fmtDate(departureTime) : ''}</span>
                          <span className="booking-confirm-airport" title={fromAirport}>{fromAirport}</span>
                        </div>

                        <div className="booking-confirm-path">
                          <span className="booking-confirm-duration">{duration}</span>
                          <div className="booking-confirm-line-wrap">
                            <div className="booking-confirm-line" />
                            <Plane size={14} className="booking-confirm-plane" />
                          </div>
                          <span className={`booking-confirm-stops ${stops === 0 ? 'nonstop' : ''}`}>
                            {stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                          </span>
                        </div>

                        <div className="booking-confirm-node arrival">
                          <span className="booking-confirm-time">{arrivalTime ? fmtTime(arrivalTime) : '—'}</span>
                          <span className="booking-confirm-date">{arrivalTime ? fmtDate(arrivalTime) : ''}</span>
                          <span className="booking-confirm-airport" title={toAirport}>{toAirport}</span>
                        </div>
                      </div>
                    </div>

                    <div className="booking-confirm-direction" role="group" aria-label="Travel direction">
                      <div className="booking-confirm-direction-head">
                        <Plane size={15} className="text-primary" />
                        <strong>Travel direction</strong>
                      </div>
                      <p className="booking-confirm-direction-hint">
                        Choose whether this booking is outbound to the rig or return to home port.
                      </p>
                      <div className="booking-confirm-direction-toggle">
                        <button
                          type="button"
                          className={bookingTravelDirection === 'HOME_TO_RIG' ? 'is-active' : ''}
                          aria-pressed={bookingTravelDirection === 'HOME_TO_RIG'}
                          onClick={() => setBookingTravelDirection('HOME_TO_RIG')}
                          disabled={!!bookingFlightKey}
                        >
                          Home port → Rig
                        </button>
                        <button
                          type="button"
                          className={bookingTravelDirection === 'RIG_TO_HOME' ? 'is-active' : ''}
                          aria-pressed={bookingTravelDirection === 'RIG_TO_HOME'}
                          onClick={() => setBookingTravelDirection('RIG_TO_HOME')}
                          disabled={!!bookingFlightKey}
                        >
                          Rig → Home port
                        </button>
                      </div>
                    </div>

                    <div className="booking-confirm-crew-panel">
                      <div className="booking-confirm-crew-head">
                        <User size={15} className="text-primary" />
                        <strong>
                          Selected crew ({selectedSearchCrewMembers.length || searchCrewIds.length || 0})
                        </strong>
                      </div>
                      {selectedSearchCrewMembers.length === 0 ? (
                        <p className="booking-confirm-crew-empty">
                          {searchCrewIds.length === 0
                            ? 'No crew selected for this booking. Select crew in Search Flights before confirming.'
                            : 'Selected crew IDs could not be resolved from the roster.'}
                        </p>
                      ) : (
                        <ul className="booking-confirm-crew-list">
                          {selectedSearchCrewMembers.map((crew) => {
                            const conflict = bookingConfirmConflicts.find((c) => c.crewId === crew.id);
                            const status = crew.current_status ?? 'Available';
                            return (
                              <li key={crew.id} className="booking-confirm-crew-item">
                                <div className="booking-confirm-crew-main">
                                  <span className={crewStatusTierDotClass(status)} title={crewStatusTierLabel(status)} />
                                  <div>
                                    <strong>{crew.firstname} {crew.lastname}</strong>
                                    <span className="booking-confirm-crew-email">{crew.email}</span>
                                  </div>
                                </div>
                                <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(status)}`}>
                                  {crewStatusTierLabel(status)}
                                </span>
                                {conflict && (
                                  <p className="booking-confirm-crew-conflict">
                                    Not fully available {conflict.periodFrom} – {conflict.periodTo}: {conflict.statusLabel}
                                    {conflict.reason ? ` · ${conflict.reason}` : ''}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {bookingConfirmConflictsLoading && (
                      <p className="text-sm text-muted-foreground">Checking crew availability for travel dates…</p>
                    )}

                    {!bookingConfirmConflictsLoading && bookingConfirmConflicts.length > 0 && (
                      <div className="booking-confirm-warning" role="alert">
                        <AlertTriangle size={16} />
                        <div>
                          <strong>Availability warning</strong>
                          <p>
                            {bookingConfirmConflicts.length} selected crew member
                            {bookingConfirmConflicts.length !== 1 ? 's are' : ' is'} not available for all travel dates.
                            You can still confirm if you want to proceed.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFlightToBook(null);
                    setBookingConfirmConflicts([]);
                    setBookingTravelDirection('HOME_TO_RIG');
                  }}
                  disabled={!!bookingFlightKey}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => flightToBook && executeSearchBooking(flightToBook)}
                  disabled={!!bookingFlightKey || !flightToBook || searchCrewIds.length === 0}
                >
                  {bookingFlightKey ? (
                    <>
                      <span className="admin-tickets-spinner admin-tickets-spinner-inline mr-2" />
                      Booking…
                    </>
                  ) : (
                    <>
                      <Plane size={16} className="mr-2" />
                      Confirm Booking
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Booking Confirmation Dialog */}
      <Dialog
        open={showManualConfirm}
        onOpenChange={(open) => {
          if (!open && !submitLoading) setShowManualConfirm(false);
        }}
      >
        <DialogContent showCloseButton={!submitLoading} className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>Confirm ticket creation?</DialogTitle>
            <DialogDescription className="text-left pt-2 text-muted-foreground">
              Are you sure you want to create flight tickets for the selected crew?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <div className="booking-summary-card">
              <div className="space-y-2.5">
                <div className="booking-summary-row header">
                  <span className="label">Project</span>
                  <span className="value project-title">{selectedProject?.title ?? '—'}</span>
                </div>
                <div className="booking-summary-row">
                  <span className="label">Crew Selected</span>
                  <span className="value">
                    {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="booking-summary-row">
                  <span className="label">Route</span>
                  <span className="value">
                    {formData.fromName.trim()} → {formData.toName.trim()}
                  </span>
                </div>
                {formData.trip && (
                  <div className="booking-summary-row">
                    <span className="label">Trip Type</span>
                    <span className="value font-semibold">
                      {formData.trip === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}
                    </span>
                  </div>
                )}
                {formData.class && (
                  <div className="booking-summary-row">
                    <span className="label">Cabin Class</span>
                    <span className="value font-semibold">
                      {formData.class}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowManualConfirm(false)}
              disabled={submitLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={executeManualBooking}
              disabled={submitLoading}
            >
              {submitLoading ? (
                <>
                  <span className="admin-tickets-spinner admin-tickets-spinner-inline mr-2" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Confirm Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crew availability warning before flight search */}
      <Dialog
        open={!!crewAvailabilitySearchPending}
        onOpenChange={(open) => {
          if (!open) setCrewAvailabilitySearchPending(null);
        }}
      >
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-lg max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Crew not available for travel dates
            </DialogTitle>
            <DialogDescription className="text-left pt-2 text-muted-foreground">
              The selected crew member(s) have availability conflicts during your travel window. Review the details below before continuing.
            </DialogDescription>
          </DialogHeader>
          {crewAvailabilitySearchPending && (
            <ul className="admin-tickets-availability-conflicts">
              {crewAvailabilitySearchPending.conflicts.map((conflict) => (
                <li key={`${conflict.crewId}-${conflict.periodFrom}`} className="admin-tickets-availability-conflict">
                  <div className="admin-tickets-availability-conflict-head">
                    <strong>{conflict.crewName}</strong>
                    <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(conflict.status)}`}>
                      {conflict.statusLabel}
                    </span>
                  </div>
                  <p className="admin-tickets-availability-conflict-period">
                    {conflict.periodFrom} – {conflict.periodTo}
                  </p>
                  <p className="admin-tickets-availability-conflict-reason">{conflict.reason}</p>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCrewAvailabilitySearchPending(null)}>
              Change selection
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!crewAvailabilitySearchPending) return;
                const { criteria } = crewAvailabilitySearchPending;
                setCrewAvailabilitySearchPending(null);
                void runFlightSearch(criteria);
              }}
            >
              Search anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crew Status Confirmation Dialog */}
      <Dialog
        open={!!crewStatusConfirmPending}
        onOpenChange={(open) => {
          if (!open) setCrewStatusConfirmPending(null);
        }}
      >
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>Crew Status Warning</DialogTitle>
            <DialogDescription className="text-left pt-2 text-muted-foreground">
              {crewStatusConfirmPending && (() => {
                const { crew: crewMember } = crewStatusConfirmPending;
                const statusLabel = crewStatusTierLabel(crewMember.current_status ?? 'Available');
                return (
                  <>
                    <strong>{crewMember.firstname} {crewMember.lastname}</strong> is currently marked as{' '}
                    <span className={`subsea-badge crew-status-badge ${crewStatusTierBadgeClass(crewMember.current_status)}`} style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}>
                      {statusLabel}
                    </span>.
                    <br />
                    <br />
                    Are you sure you want to proceed with booking a flight ticket for this crew member?
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCrewStatusConfirmPending(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!crewStatusConfirmPending) return;
                const { crew: crewMember, context } = crewStatusConfirmPending;
                if (context === 'search') {
                  setSearchCrewIds((prev) => [...prev, crewMember.id]);
                }
                setCrewStatusConfirmPending(null);
              }}
            >
              <AlertTriangle size={16} className="mr-2" />
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTicketsPage;
