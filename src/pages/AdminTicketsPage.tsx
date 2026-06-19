import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertTriangle,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { SubseaNavRail } from '@/components/SubseaNavRail';
import { SubseaProfileMenu } from '@/components/SubseaProfileMenu';
import { SUBSEA_FORM_LIGHT_CLASS } from '@/lib/subseaTheme';
import { useNavigate } from 'react-router-dom';
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
import { getCrewEnrolledInProject, getCrewList, type CrewMemberApi } from '../api/crew';
import {
  availabilityFromCrewSignal,
  crewAvailabilityDotClass,
  getCrewAvailabilityLabel,
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
import './AdminTicketsPage.css';
import './RigsPage.css';

type ModalStep = 'project' | 'crew' | 'form';
type TicketsTab = 'tickets' | 'search' | 'spends';
type StatusFilter = 'all' | 'pending' | 'approved';

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

const AdminTicketsPage = () => {
  const navigate = useNavigate();
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

  /* Search & Book tab state */
  const [activeTab, setActiveTab] = useState<TicketsTab>('tickets');
  const [searchTripTypeUI, setSearchTripTypeUI] = useState<SearchUITripType>('one-way');
  const [multiSegments, setMultiSegments] = useState<MultiFlightSegment[]>(() => initialMultiSegments());
  const [activeMultiLegIndex, setActiveMultiLegIndex] = useState(0);
  const [preferNonStopPerLeg, setPreferNonStopPerLeg] = useState(false);
  const [searchFrom, setSearchFrom] = useState<Airport | null>(() => AIRPORTS[0] ?? null);
  const [searchTo, setSearchTo] = useState<Airport | null>(() => AIRPORTS[1] ?? null);
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toYYYYMMDD(d);
  });
  const [returnTime, setReturnTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [adults, setAdults] = useState(1);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [currency, setCurrency] = useState<CurrencyCode>('GBP');
  const [flightSortBy, setFlightSortBy] = useState<FlightSortBy>('price');
  const [flightSortOrder, setFlightSortOrder] = useState<FlightSortOrder>('asc');
  const [searchResults, setSearchResults] = useState<Flight[] | null>(null);
  const [searchTotalCount, setSearchTotalCount] = useState<number>(0);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchCriteria, setSearchCriteria] = useState<SearchPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingFlightKey, setBookingFlightKey] = useState<string | null>(null);
  const [flightToBook, setFlightToBook] = useState<Flight | null>(null);
  const [showManualConfirm, setShowManualConfirm] = useState(false);

  /* Project & crew for search form */
  const [searchProjectId, setSearchProjectId] = useState<string>('');
  const [searchCrewIds, setSearchCrewIds] = useState<string[]>([]);
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
    setSearchCrewIds((prev) =>
      prev.includes(crewId) ? prev.filter((id) => id !== crewId) : [...prev, crewId]
    );
  }, []);

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
    setActiveMultiLegIndex((idx) => {
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
    setSelectedTicket(null);
    setTicketToConfirmCancel(ticket);
  }, []);

  const handleConfirmCancelTicket = useCallback(async () => {
    if (!ticketToConfirmCancel) return;
    const id = ticketToConfirmCancel.id;
    setCancelTicketSubmitting(true);
    try {
      await cancelCrewTicket(id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
      setSelectedTicket((prev) => (prev?.id === id ? null : prev));
      setTicketToConfirmCancel(null);
      toast.success('Ticket cancelled', {
        description: 'The booking was removed from your crew tickets list.',
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
  }, [ticketToConfirmCancel]);

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
      return projectFilteredTickets.filter((t) => getTicketStatus(t) !== 'APPROVED');
    }
    if (statusFilter === 'approved') {
      return projectFilteredTickets.filter((t) => getTicketStatus(t) === 'APPROVED');
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

      setSearchCriteria(criteria);
      setSearchResults(null);
      setSearchTotalCount(0);
      setSearchPage(1);
      setSearchError(null);
      setIsSearching(true);
      try {
        const data = await searchFlights(criteria);
        setSearchResults(data.flights);
        setSearchTotalCount(data.total);
        setSearchPage(data.page ?? 1);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
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
        setSearchResults(data.flights);
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
      setSearchResults((prev) => (prev ? [...prev, ...data.flights] : data.flights));
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
        });
        const returnedTickets = Array.isArray(data.crewTickets) ? data.crewTickets : Array.isArray(data.tickets) ? data.tickets : [];
        const ticketCount = returnedTickets.length || searchCrewIds.length || searchAdultCount;
        const refNote = data.bookingReference ? ` Ref: ${data.bookingReference}` : '';
        const baseDesc = `${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} booked and sent for approval.${refNote}`;

        if (searchTripTypeUI === 'multi-city') {
          const n = multiSegments.length;
          const legDone = activeMultiLegIndex + 1;
          if (activeMultiLegIndex < n - 1) {
            toast.success(`Leg ${legDone} of ${n} sent for approval.`, {
              description: `${baseDesc} Search and book leg ${legDone + 1}.`,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            fetchTickets();
            setActiveMultiLegIndex((i) => i + 1);
            setSearchResults(null);
            setSearchTotalCount(0);
            setSearchPage(1);
            setSearchCriteria(null);
          } else {
            toast.success(`All ${n} flight${n !== 1 ? 's' : ''} sent for approval.`, {
              description: baseDesc,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            fetchTickets();
            setSearchResults(null);
            setSearchTotalCount(0);
            setSearchPage(1);
            setSearchCriteria(null);
            setActiveMultiLegIndex(0);
            setMultiSegments(initialMultiSegments());
          }
        } else {
          toast.success('Ticket booked and sent for approval.', { description: baseDesc });
          window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
          fetchTickets();
          setSearchResults((prev) => (prev ? prev.filter((f) => f.id !== flight.id) : null));
          setSearchTotalCount((prev) => Math.max(0, prev - 1));
        }
        setFlightToBook(null);
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
    ]
  );

  const handleBookNow = useCallback(
    (flight: Flight) => {
      setFlightToBook(flight);
    },
    []
  );

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
    const totalBookings = projectFilteredTickets.length;
    const mtdTickets = projectFilteredTickets.filter((ticket) =>
      isCrewTicketCreatedInLocalCalendarMonth(ticket)
    );
    const lastMonthTickets = projectFilteredTickets.filter((ticket) =>
      isCrewTicketCreatedInPreviousLocalCalendarMonth(ticket)
    );
    const mtdSpend = sumPricedTickets(mtdTickets);
    const lastMonthSpend = sumPricedTickets(lastMonthTickets);
    const approvedCount = projectFilteredTickets.filter(
      (ticket) => getTicketStatus(ticket) === 'APPROVED'
    ).length;
    const pendingCount = totalBookings - approvedCount;

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

    const spendByDestinationMap = new Map<string, number>();
    for (const ticket of projectFilteredTickets) {
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
    for (const ticket of projectFilteredTickets) {
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

  const pendingApprovalCount = useMemo(
    () => projectFilteredTickets.filter((ticket) => getTicketStatus(ticket) !== 'APPROVED').length,
    [projectFilteredTickets]
  );

  const getTicketStatusBadgeClass = (ticket: CrewTicketApi) =>
    getTicketStatus(ticket) === 'APPROVED'
      ? 'subsea-b-green subsea-flight-status-approved'
      : 'subsea-b-orange subsea-flight-status-pending';

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
            <TicketIcon size={13} /> Active Bookings <span className="subsea-sb-count">{projectFilteredTickets.length}</span>
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
          <div className="subsea-sb-group">Operations</div>
          <button type="button" className="subsea-sb-link" onClick={() => navigate('/crew')}>
            <Plane size={13} /> Upcoming Departures
          </button>
        </div>
      </aside>

      <div className="subsea-main">
        <div className="subsea-topbar">
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
            <button type="button" className="subsea-btn subsea-btn-primary subsea-btn-sm" onClick={openCreateModal}>
              <Plus size={12} /> Book Flight
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
                                    const availability = availabilityFromCrewSignal(c.signal);
                                    const activeProject = c.activeProjects?.[0]?.title;
                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={c.id}
                                        checked={searchCrewIds.includes(c.id)}
                                        onCheckedChange={() => toggleCrewSearch(c.id)}
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        <div className="flex items-start gap-2 min-w-0 w-full">
                                          <span
                                            className={crewAvailabilityDotClass(availability)}
                                            title={getCrewAvailabilityLabel(availability)}
                                            aria-label={getCrewAvailabilityLabel(availability)}
                                          />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span>{c.firstname} {c.lastname}</span>
                                            <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                                            {activeProject ? (
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
                      : projectFilter === 'all'
                        ? 'No tickets yet'
                        : 'No tickets for this project'}
                </h3>
                <p>
                  {statusFilter === 'pending'
                    ? 'All bookings in this view are approved, or none match the selected project.'
                    : statusFilter === 'approved'
                      ? 'No approved bookings match the current project filter.'
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
                        className={`subsea-flight-card${getTicketStatus(ticket) !== 'APPROVED' ? ' pending' : ''}`}
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
                <p>Flight spend analytics · {projectFilteredTickets.length} bookings in scope</p>
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
                <div className="subsea-pane-head"><div className="subsea-pane-title">Bookings by Cabin Class</div></div>
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
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-lg`}>
          <DialogHeader>
            <DialogTitle>Ticket details</DialogTitle>
          </DialogHeader>
        {selectedTicket && (
          <div className="admin-tickets-detail-card">
            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Flight details</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>From</dt>
                  <dd>{selectedTicket.from?.Name ?? '—'}</dd>
                  <dd className="admin-tickets-detail-meta">
                    {selectedTicket.from?.COUNTRYNAME ?? ''} ({selectedTicket.from?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>To</dt>
                  <dd>{selectedTicket.to?.Name ?? '—'}</dd>
                  <dd className="admin-tickets-detail-meta">
                    {selectedTicket.to?.COUNTRYNAME ?? ''} ({selectedTicket.to?.COUNTRY ?? ''})
                  </dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Class</dt>
                  <dd>{selectedTicket.class ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Trip</dt>
                  <dd>{selectedTicket.trip?.replace('_', ' ') ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Passengers</dt>
                  <dd>
                    {[selectedTicket.adult && `${selectedTicket.adult} adult(s)`, selectedTicket.children ? `${selectedTicket.children} child(ren)` : null, selectedTicket.infants ? `${selectedTicket.infants} infant(s)` : null]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Price</dt>
                  <dd>{selectedTicket.price != null ? `£${selectedTicket.price.toLocaleString()}` : '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Cashback</dt>
                  <dd>{selectedTicket.cashback != null ? `£${selectedTicket.cashback.toLocaleString()}` : '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Crew</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Name</dt>
                  <dd>{getCrewName(selectedTicket)}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Email</dt>
                  <dd>{(selectedTicket.crew_id as { email?: string })?.email ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Phone</dt>
                  <dd>{(selectedTicket.crew_id as { phone?: string })?.phone ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Nationality</dt>
                  <dd>{(selectedTicket.crew_id as { nationality?: string })?.nationality ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Project</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Title</dt>
                  <dd>{getProjectTitle(selectedTicket)}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Status</dt>
                  <dd>{selectedTicket.project_id?.status ?? '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Duration</dt>
                  <dd>{formatProjectDuration(selectedTicket.project_id)}</dd>
                </div>
                {(selectedTicket.project_id as { description?: string })?.description && (
                  <div className="admin-tickets-detail-item">
                    <dt>Description</dt>
                    <dd>{(selectedTicket.project_id as { description?: string }).description}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Rig</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Name</dt>
                  <dd>{getRigName(selectedTicket)}</dd>
                </div>
                {selectedTicket.rig_id &&
                  typeof selectedTicket.rig_id !== 'string' &&
                  (selectedTicket.rig_id as { description?: string })?.description && (
                    <div className="admin-tickets-detail-item">
                      <dt>Description</dt>
                      <dd>{(selectedTicket.rig_id as { description?: string }).description}</dd>
                    </div>
                  )}
              </dl>
            </section>

            <section className="admin-tickets-detail-section">
              <h3 className="admin-tickets-detail-heading">Approval</h3>
              <dl className="admin-tickets-detail-list">
                <div className="admin-tickets-detail-item">
                  <dt>Status</dt>
                  <dd><span className={`subsea-badge ${getTicketStatusBadgeClass(selectedTicket)}`}>{getTicketStatusLabel(selectedTicket)}</span></dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Booking reference</dt>
                  <dd>{selectedTicket.bookingReference || 'Pending approval'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Approved at</dt>
                  <dd>{selectedTicket.approvedAt ? new Date(selectedTicket.approvedAt).toLocaleString() : '—'}</dd>
                </div>
                <div className="admin-tickets-detail-item">
                  <dt>Ticket PDF</dt>
                  <dd>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        !canUseTicketPdf(selectedTicket) ||
                        previewingTicketId === selectedTicket.id
                      }
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
                          {canUseTicketPdf(selectedTicket) ? 'Preview ticket' : 'Available after approval'}
                        </>
                      )}
                    </Button>
                  </dd>
                </div>
              </dl>
            </section>

            <div className="admin-tickets-detail-cancel-wrap">
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => selectedTicket && requestCancelTicketFlow(selectedTicket)}
              >
                <Ban size={16} className="mr-2" />
                Cancel ticket
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ticketToConfirmCancel}
        onOpenChange={(open) => {
          if (!open && !cancelTicketSubmitting) setTicketToConfirmCancel(null);
        }}
      >
        <DialogContent showCloseButton={!cancelTicketSubmitting} className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md`}>
          <DialogHeader>
            <DialogTitle>Cancel this ticket?</DialogTitle>
            <DialogDescription className="text-left pt-1">
              This removes the booking for{' '}
              <span className="font-medium text-foreground">
                {ticketToConfirmCancel ? getCrewName(ticketToConfirmCancel) : ''}
              </span>
              {ticketToConfirmCancel ? (
                <>
                  {' '}
                  on {getProjectTitle(ticketToConfirmCancel)} ({ticketToConfirmCancel.from?.Name ?? '—'} →{' '}
                  {ticketToConfirmCancel.to?.Name ?? '—'}). If your workspace uses cancellation charges, the
                  project owner may accrue cancellation debt according to policy.
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
        <DialogContent className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-lg`}>
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
          if (!open && !bookingFlightKey) setFlightToBook(null);
        }}
      >
        <DialogContent showCloseButton={!bookingFlightKey} className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md`}>
          <DialogHeader>
            <DialogTitle>Book flight tickets?</DialogTitle>
            <DialogDescription className="text-left pt-2 text-muted-foreground">
              Are you sure you want to book this flight for the selected crew?
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
                <div className="border border-border rounded-lg p-4 bg-muted/40 text-sm">
                  <div className="flex justify-between items-start font-semibold border-b border-border/50 pb-2 mb-3">
                    <div>
                      <span className="text-base text-foreground font-semibold">{airlineName}</span>
                    </div>
                    <span className="text-base text-primary font-bold">
                      {currency} {priceAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm relative py-2">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-foreground">{departureTime ? fmtTime(departureTime) : '—'}</span>
                      <span className="text-xs text-muted-foreground">{departureTime ? fmtDate(departureTime) : ''}</span>
                      <span className="text-xs font-semibold text-foreground mt-1" title={fromAirport}>{fromAirport}</span>
                    </div>

                    <div className="flex flex-col items-center flex-1 px-4">
                      <span className="text-[10px] text-muted-foreground font-mono">{duration}</span>
                      <div className="w-full flex items-center justify-center my-1 relative">
                        <div className="w-full h-[2px] bg-border absolute top-1/2 -translate-y-1/2" />
                        <Plane size={14} className="text-muted-foreground bg-background px-1 z-10" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-lg font-bold text-foreground">{arrivalTime ? fmtTime(arrivalTime) : '—'}</span>
                      <span className="text-xs text-muted-foreground">{arrivalTime ? fmtDate(arrivalTime) : ''}</span>
                      <span className="text-xs font-semibold text-foreground mt-1" title={toAirport}>{toAirport}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFlightToBook(null)}
              disabled={!!bookingFlightKey}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => flightToBook && executeSearchBooking(flightToBook)}
              disabled={!!bookingFlightKey || !flightToBook}
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
        </DialogContent>
      </Dialog>

      {/* Manual Booking Confirmation Dialog */}
      <Dialog
        open={showManualConfirm}
        onOpenChange={(open) => {
          if (!open && !submitLoading) setShowManualConfirm(false);
        }}
      >
        <DialogContent showCloseButton={!submitLoading} className={`${SUBSEA_FORM_LIGHT_CLASS} max-w-md`}>
          <DialogHeader>
            <DialogTitle>Confirm ticket creation?</DialogTitle>
            <DialogDescription className="text-left pt-2 text-muted-foreground">
              Are you sure you want to create flight tickets for the selected crew?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="border border-border rounded-lg p-4 bg-muted/40 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border/50 pb-2 mb-2 font-semibold">
                  <span className="text-muted-foreground">Project</span>
                  <span className="text-foreground">{selectedProject?.title ?? '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Crew Selected</span>
                  <span className="text-foreground font-semibold">
                    {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Route</span>
                  <span className="text-foreground font-semibold">
                    {formData.fromName.trim()} → {formData.toName.trim()}
                  </span>
                </div>
                {formData.trip && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Trip Type</span>
                    <span className="text-foreground font-semibold">
                      {formData.trip === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}
                    </span>
                  </div>
                )}
                {formData.class && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cabin Class</span>
                    <span className="text-foreground font-semibold">
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
    </div>
  );
};

export default AdminTicketsPage;
