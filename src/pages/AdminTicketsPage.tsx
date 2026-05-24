import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plane, ChevronLeft, ChevronDown, Search, Ticket as TicketIcon, X, Plus, Trash2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getProjects, type ProjectApi } from '../api/project';
import { getRigs, type RigApi } from '../api/rig';
import { getCrewEnrolledInProject, type CrewMemberApi } from '../api/crew';
import {
  getCrewTickets,
  createFlightTicket,
  cancelCrewTicket,
  type CreateFlightTicketPayload,
  type AirportLocation,
  type CrewTicketApi,
} from '../api/ticket';
import { getAdminProfile } from '../api/admin';
import { searchFlights, bookFlight } from '../api/flightSearch';
import { searchAirportsApi } from '../api/airports';
import { AIRPORTS, getAirportDisplayName, searchAirports } from '../lib/airports';
import type { Airport, Flight, Fare, SearchPayload, CabinClass, CurrencyCode } from '../types/flight';
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

type ModalStep = 'project' | 'crew' | 'form';
type TicketsTab = 'tickets' | 'search';

/** Search tab trip UI; API uses SearchPayload tripType (`multi-city` maps to `one-way` per leg). */
type SearchUITripType = 'one-way' | 'round-trip' | 'multi-city';

const MAX_MULTI_SEGMENTS = 6;

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

function initialMultiSegments(): MultiFlightSegment[] {
  const a0 = AIRPORTS[0] ?? null;
  const a1 = AIRPORTS[1] ?? null;
  const dep = toYYYYMMDD(new Date());
  return [
    {
      id: newSegmentId(),
      from: a0,
      to: a1,
      departureDate: dep,
      departureTime: '',
      arrivalDate: '',
      arrivalTime: '',
    },
    {
      id: newSegmentId(),
      from: a1,
      to: a0,
      departureDate: dep,
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

const SEARCH_DEBOUNCE_MS = 300;

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
      setApiAirports([]);
      return;
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
      (apiA) => !staticFiltered.some((s) => s.Name === apiA.Name)
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
            filtered.map((a) => (
              <li
                key={a.Name}
                className={'airport-combobox-option' + (value?.Name === a.Name ? ' airport-combobox-option-active' : '')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(a)}
              >
                <span className="airport-combobox-option-name">{getAirportDisplayName(a)}</span>
                <span className="airport-combobox-option-country">{a.COUNTRYNAME}</span>
              </li>
            ))
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
  const stops = (flight as { stops?: number }).stops ?? firstLeg?.stops ?? 0;
  const via = firstLeg?.via;
  const airlineName = (flight as { airlineName?: string }).airlineName ?? firstLeg?.airlineName ?? '—';
  const airlineCode = (flight as { airlineCode?: string }).airlineCode ?? '';
  const cabin = selectedFare?.cabin ?? firstSeg?.cabin ?? '—';

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
          {flight.legs?.flatMap((leg) => leg.itinerary ?? []).map((seg, i) => (
            <div key={i} className="atfc-seg">
              <div className="atfc-seg-header">
                <span className="atfc-seg-airline">{seg.airlineName} {seg.airlineCode} {seg.flightNumber}</span>
                <span className="atfc-seg-cabin">{seg.cabin}</span>
              </div>
              <div className="atfc-seg-route">
                <div className="atfc-seg-point">
                  <span className="atfc-seg-time">{seg.departureTime ? fmtTime(seg.departureTime) : '—'}</span>
                  <span className="atfc-seg-airport">{seg.fromAirport ?? seg.from}</span>
                  {seg.fromTerminal && <span className="atfc-seg-terminal">Terminal {seg.fromTerminal}</span>}
                </div>
                <div className="atfc-seg-arrow">→</div>
                <div className="atfc-seg-point">
                  <span className="atfc-seg-time">{seg.arrivalTime ? fmtTime(seg.arrivalTime) : '—'}</span>
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
                  <span>Layover at {seg.layover.location}: {seg.layover.duration}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AdminTicketsPage = () => {
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [rigs, setRigs] = useState<RigApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);
  const [ticketToConfirmCancel, setTicketToConfirmCancel] = useState<CrewTicketApi | null>(null);
  const [cancelTicketSubmitting, setCancelTicketSubmitting] = useState(false);

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
  const [activeTab, setActiveTab] = useState<TicketsTab>('search');
  const [searchTripTypeUI, setSearchTripTypeUI] = useState<SearchUITripType>('one-way');
  const [multiSegments, setMultiSegments] = useState<MultiFlightSegment[]>(() => initialMultiSegments());
  const [activeMultiLegIndex, setActiveMultiLegIndex] = useState(0);
  const [preferNonStopPerLeg, setPreferNonStopPerLeg] = useState(false);
  const [searchFrom, setSearchFrom] = useState<Airport | null>(() => AIRPORTS[0] ?? null);
  const [searchTo, setSearchTo] = useState<Airport | null>(() => AIRPORTS[1] ?? null);
  const [departureDate, setDepartureDate] = useState(() => toYYYYMMDD(new Date()));
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
  const [searchResults, setSearchResults] = useState<Flight[] | null>(null);
  const [searchTotalCount, setSearchTotalCount] = useState<number>(0);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchCriteria, setSearchCriteria] = useState<SearchPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingFlightKey, setBookingFlightKey] = useState<string | null>(null);

  /* Project & crew for search form */
  const [searchProjectId, setSearchProjectId] = useState<string>('');
  const [searchRigId, setSearchRigId] = useState<string>('');
  const [searchCrewIds, setSearchCrewIds] = useState<string[]>([]);
  const [searchCrewList, setSearchCrewList] = useState<CrewMemberApi[]>([]);
  const [searchCrewLoading, setSearchCrewLoading] = useState(false);
  const [_adminMarkup, setAdminMarkup] = useState<number | null>(null);

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
    if (!searchProjectId) {
      setSearchCrewList([]);
      setSearchCrewIds([]);
      return;
    }
    setSearchCrewLoading(true);
    getCrewEnrolledInProject(searchProjectId)
      .then((res) => setSearchCrewList(res.crew ?? []))
      .catch(() => setSearchCrewList([]))
      .finally(() => setSearchCrewLoading(false));
    setSearchCrewIds([]);
  }, [searchProjectId]);

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
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredTickets = useMemo(() => {
    if (projectFilter === 'all') return tickets;
    return tickets.filter((t) => {
      const pid = t.project_id?._id ?? (t.project_id as { id?: string })?.id;
      return pid === projectFilter;
    });
  }, [tickets, projectFilter]);

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
          adults,
          children: 0,
          infants: 0,
          cabinClass,
          currency,
          page: 1,
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
          adults,
          children: 0,
          infants: 0,
          cabinClass,
          currency,
          page: 1,
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
      adults,
      cabinClass,
      currency,
      searchProjectId,
      searchCrewIds,
    ]
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

  const handleBookNow = useCallback(
    async (flight: Flight) => {
      if (!searchProjectId) {
        toast.error('No project selected', { description: 'Please select a project in the search form before booking.' });
        return;
      }
      if (searchCrewIds.length === 0) {
        toast.error('No crew selected', { description: 'Please select at least one crew member in the search form.' });
        return;
      }
      const bookKey =
        searchTripTypeUI === 'multi-city' ? `${activeMultiLegIndex}::${flight.id}` : flight.id;
      setBookingFlightKey(bookKey);
      try {
        const firstFare = flight.fares?.[0];
        const priceAmount = firstFare?.totalFare ?? 0;
        const data = await bookFlight({
          project_id: searchProjectId,
          ...(searchRigId ? { rig_id: searchRigId } : {}),
          crew_ids: searchCrewIds,
          flight,
          cashback: flight.cashback ?? 0,
          price: priceAmount,
          currency,
          adult: adults,
          children: 0,
          infants: 0,
        });
        const ticketCount = Array.isArray(data.tickets) ? data.tickets.length : searchCrewIds.length;
        const refNote = data.bookingReference ? ` Ref: ${data.bookingReference}` : '';
        const baseDesc = `${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} booked & flight details sent to crew email.${refNote}`;

        if (searchTripTypeUI === 'multi-city') {
          const n = multiSegments.length;
          const legDone = activeMultiLegIndex + 1;
          if (activeMultiLegIndex < n - 1) {
            toast.success(`Leg ${legDone} of ${n} booked (separate ticket).`, {
              description: `${baseDesc} Search and book leg ${legDone + 1}.`,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            setActiveMultiLegIndex((i) => i + 1);
            setSearchResults(null);
            setSearchTotalCount(0);
            setSearchPage(1);
            setSearchCriteria(null);
          } else {
            toast.success(`All ${n} flight${n !== 1 ? 's' : ''} booked (separate tickets).`, {
              description: baseDesc,
            });
            window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
            setSearchResults(null);
            setSearchTotalCount(0);
            setSearchPage(1);
            setSearchCriteria(null);
            setActiveMultiLegIndex(0);
            setMultiSegments(initialMultiSegments());
          }
        } else {
          toast.success('Ticket booked successfully!', { description: baseDesc });
          window.dispatchEvent(new CustomEvent('admin-balance-refresh'));
          setSearchResults((prev) => (prev ? prev.filter((f) => f.id !== flight.id) : null));
          setSearchTotalCount((prev) => Math.max(0, prev - 1));
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
      searchRigId,
      searchCrewIds,
      adults,
      currency,
      searchTripTypeUI,
      activeMultiLegIndex,
      multiSegments.length,
    ]
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

  const handleSubmitTickets = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      setTimeout(closeCreateModal, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create tickets');
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

  return (
    <div className="admin-tickets-page">
      <div className="flex flex-col gap-6 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flight Tickets</h1>
          <p className="text-muted-foreground mt-1">
            View and manage flight tickets for crew on projects.
          </p>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TicketsTab)}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <TabsList className="h-10">
              <TabsTrigger value="tickets" className="gap-2">
                <TicketIcon size={18} />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2">
                <Search size={18} />
                Search & Book
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="search" className="mt-6">
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
              <Card>
                <CardContent className="pt-6">
                <div className="admin-tickets-search-form">
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
                  {searchTripTypeUI === 'multi-city' ? (
                    <p className="admin-tickets-multi-hint">
                      Book each leg as its own ticket in one flow (separate from connecting flights sold as one itinerary).
                    </p>
                  ) : null}
                  <div className="admin-tickets-search-field">
                    <label className="block text-xs font-semibold text-[#374151] mb-2">Project</label>
                    <div className="admin-tickets-search-field-with-clear">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="truncate">
                              {searchProjectId
                                ? (projects.find((p) => p.id === searchProjectId)?.title ?? 'Select project')
                                : 'Select project'}
                            </span>
                            <ChevronDown size={16} className="shrink-0 ml-2 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[260px] overflow-y-auto"
                        align="start"
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onSelect={() => setSearchProjectId('')}
                            className={!searchProjectId ? 'bg-accent' : ''}
                          >
                            Select project
                          </DropdownMenuItem>
                          {projects.map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onSelect={() => setSearchProjectId(p.id)}
                              className={searchProjectId === p.id ? 'bg-accent' : ''}
                            >
                              {p.title}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                      {searchProjectId ? (
                        <button
                          type="button"
                          className="admin-tickets-search-clear-btn"
                          onClick={() => setSearchProjectId('')}
                          title="Clear"
                          aria-label="Clear project"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="admin-tickets-search-field">
                    <label className="block text-xs font-semibold text-[#374151] mb-2">Rig</label>
                    <div className="admin-tickets-search-field-with-clear">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="truncate">
                              {searchRigId
                                ? (rigs.find((r) => r.id === searchRigId)?.name ?? 'Select rig')
                                : 'Select rig (optional)'}
                            </span>
                            <ChevronDown size={16} className="shrink-0 ml-2 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[260px] overflow-y-auto"
                          align="start"
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => setSearchRigId('')}
                              className={!searchRigId ? 'bg-accent' : ''}
                            >
                              No rig
                            </DropdownMenuItem>
                            {rigs.map((rig) => (
                              <DropdownMenuItem
                                key={rig.id}
                                onSelect={() => setSearchRigId(rig.id)}
                                className={searchRigId === rig.id ? 'bg-accent' : ''}
                              >
                                {rig.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {searchRigId ? (
                        <button
                          type="button"
                          className="admin-tickets-search-clear-btn"
                          onClick={() => setSearchRigId('')}
                          title="Clear"
                          aria-label="Clear rig"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="admin-tickets-search-field admin-tickets-search-field-crew">
                    <label className="block text-xs font-semibold text-[#374151] mb-2">Crew members</label>
                    <div className="admin-tickets-search-field-with-clear">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={!searchProjectId}
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate">
                            {!searchProjectId
                              ? 'Select a project first'
                              : searchCrewLoading
                                ? 'Loading…'
                                : searchCrewIds.length === 0
                                  ? 'Select crew members…'
                                  : `${searchCrewIds.length} crew member${searchCrewIds.length !== 1 ? 's' : ''} selected`}
                          </span>
                          <ChevronDown size={16} className="shrink-0 ml-2 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[260px] overflow-y-auto"
                        align="start"
                      >
                        {searchCrewLoading && searchCrewList.length === 0 ? (
                          <DropdownMenuLabel>Loading crew…</DropdownMenuLabel>
                        ) : searchCrewList.length === 0 ? (
                          <DropdownMenuLabel>No crew enrolled in this project.</DropdownMenuLabel>
                        ) : (
                          <DropdownMenuGroup>
                            {searchCrewList.map((c) => (
                              <DropdownMenuCheckboxItem
                                key={c.id}
                                checked={searchCrewIds.includes(c.id)}
                                onCheckedChange={() => toggleCrewSearch(c.id)}
                                onSelect={(e) => e.preventDefault()}
                              >
                                <div className="flex flex-col min-w-0">
                                  <span>{c.firstname} {c.lastname}</span>
                                  <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuGroup>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                      {searchCrewIds.length > 0 ? (
                        <button
                          type="button"
                          className="admin-tickets-search-clear-btn"
                          onClick={() => setSearchCrewIds([])}
                          title="Clear"
                          aria-label="Clear crew members"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {searchTripTypeUI === 'multi-city' ? (
                    <>
                      <div className="admin-tickets-multi-nonstop">
                        <Checkbox
                          id="prefer-nonstop-legs"
                          checked={preferNonStopPerLeg}
                          onCheckedChange={(c) => setPreferNonStopPerLeg(c === true)}
                        />
                        <label htmlFor="prefer-nonstop-legs" className="admin-tickets-multi-nonstop-label">
                          Prefer non-stop for each leg (search requests direct-only when supported; list is filtered to non-stop).
                        </label>
                      </div>
                      <p className="admin-tickets-multi-active-hint">
                        Active leg for search: <strong>{activeMultiLegIndex + 1}</strong> of {multiSegments.length}. Click a leg card to change it (when not viewing results).
                      </p>
                      <div className="admin-tickets-multi-segments">
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
                                onClear={() => updateMultiSegment(i, { departureTime: '' })}
                                hasValue={!!seg.departureTime}
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
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {multiSegments.length < MAX_MULTI_SEGMENTS ? (
                        <div className="admin-tickets-multi-add-row">
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
                      <div className="admin-tickets-search-airports-row">
                        <div className="admin-tickets-search-field">
                          <label htmlFor="search-from">From</label>
                          <AirportCombobox
                            id="search-from"
                            value={searchFrom}
                            onChange={setSearchFrom}
                          />
                        </div>
                        <div className="admin-tickets-search-field">
                          <label htmlFor="search-to">To</label>
                          <AirportCombobox
                            id="search-to"
                            value={searchTo}
                            onChange={setSearchTo}
                          />
                        </div>
                      </div>
                      <div className="admin-tickets-search-field admin-tickets-search-date-picker">
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
                          onClear={searchTripTypeUI === 'one-way' ? () => { setDepartureTime(''); } : undefined}
                          hasValue={!!departureTime}
                        />
                      </div>
                      {searchTripTypeUI === 'one-way' ? (
                        <div className="admin-tickets-search-field admin-tickets-search-date-picker">
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
                          />
                        </div>
                      ) : null}
                      {searchTripTypeUI === 'round-trip' ? (
                        <div className="admin-tickets-search-field admin-tickets-search-date-picker">
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
                            onClear={() => setReturnTime('')}
                            hasValue={!!returnTime}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                  <div className="admin-tickets-search-field">
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
                  <div className="admin-tickets-search-field admin-tickets-search-field-cabin">
                    <label htmlFor="search-cabin">Cabin class</label>
                    <Select
                      value={cabinClass}
                      onValueChange={(v) => setCabinClass(v as CabinClass)}
                    >
                      <SelectTrigger id="search-cabin" className="admin-tickets-search-input w-full">
                        <SelectValue placeholder="Select cabin" />
                      </SelectTrigger>
                      <SelectContent>
                        {CABIN_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
              </CardContent>
              </Card>
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
                          disabled={isLoadingMore}
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
          <TabsContent value="tickets" className="mt-6">
        <>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <Button onClick={openCreateModal}>Create ticket</Button>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <label className="text-sm font-medium">
            Filter by project
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                <span className="truncate">
                  {projectFilter === 'all'
                    ? 'All projects'
                    : (uniqueProjectsFromTickets.find((p) => p.id === projectFilter)?.title ?? 'All projects')}
                </span>
                <ChevronDown size={16} className="shrink-0 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => setProjectFilter('all')}
                  className={projectFilter === 'all' ? 'bg-accent' : ''}
                >
                  All projects
                </DropdownMenuItem>
                {uniqueProjectsFromTickets.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => setProjectFilter(p.id)}
                    className={projectFilter === p.id ? 'bg-accent' : ''}
                  >
                    {p.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {loading ? (
        <div className="admin-tickets-loading" role="status">
          <div className="admin-tickets-spinner" />
          <p>Loading…</p>
        </div>
      ) : error ? (
        <div className="admin-tickets-error" role="alert">{error}</div>
      ) : ticketsLoading && tickets.length === 0 ? (
        <div className="admin-tickets-loading" role="status">
          <div className="admin-tickets-spinner" />
          <p>Loading tickets…</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="admin-tickets-empty">
          <Plane size={48} className="admin-tickets-empty-icon" />
          <p>{projectFilter === 'all' ? 'No tickets yet.' : 'No tickets for this project.'}</p>
          <p className="admin-tickets-empty-hint">
            {projectFilter === 'all'
              ? 'Create tickets for crew on your projects.'
              : 'Try selecting "All projects" or create new tickets.'}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Crew</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Rig</TableHead>
              <TableHead>From → To</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Trip</TableHead>
              <TableHead>Passengers</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Cashback</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                className="cursor-pointer"
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
                <TableCell className="font-medium">{getCrewName(ticket)}</TableCell>
                <TableCell>{getProjectTitle(ticket)}</TableCell>
                <TableCell>{getRigName(ticket)}</TableCell>
                <TableCell title={`${ticket.from?.Name ?? ''} → ${ticket.to?.Name ?? ''}`}>
                  {ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}
                </TableCell>
                <TableCell>{ticket.class ?? '—'}</TableCell>
                <TableCell>{ticket.trip?.replace('_', ' ') ?? '—'}</TableCell>
                <TableCell>
                  {[ticket.adult, ticket.children, ticket.infants]
                    .filter((n) => n != null && n > 0)
                    .join(' / ') || '—'}
                </TableCell>
                <TableCell>
                  {ticket.price != null ? `£${ticket.price.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell>
                  {ticket.cashback != null ? `£${ticket.cashback.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => requestCancelTicketFlow(ticket)}
                    title="Cancel ticket"
                  >
                    <Ban size={14} className="mr-1" />
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
          </CardContent>
        </Card>
      )}
        </>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
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
        <DialogContent showCloseButton={!cancelTicketSubmitting} className="max-w-md">
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
        <DialogContent className="max-w-lg">
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
              Tickets created successfully for {selectedCrewIds.length} crew member{selectedCrewIds.length !== 1 ? 's' : ''}.
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
    </div>
  );
};

export default AdminTicketsPage;
