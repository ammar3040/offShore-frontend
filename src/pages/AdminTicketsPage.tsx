import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plane, ChevronLeft, Plus, ChevronDown, Search, Ticket as TicketIcon, Upload } from 'lucide-react';
import Modal from '../components/Modal';
import { Toaster, useToast } from '../components/Toast';
import { getProjects, type ProjectApi } from '../api/project';
import { getCrewEnrolledInProject, type CrewMemberApi } from '../api/crew';
import { getCrewTickets, createFlightTicket, uploadCrewTicketPdf, type CreateFlightTicketPayload, type AirportLocation, type CrewTicketApi } from '../api/ticket';
import { searchFlights, bookFlight } from '../api/flightSearch';
import { AIRPORTS, getAirportDisplayName } from '../lib/airports';
import type { Airport, Flight, Fare, SearchPayload, CabinClass, CurrencyCode } from '../types/flight';
import './AdminTicketsPage.css';

type ModalStep = 'project' | 'crew' | 'form';
type TicketsTab = 'tickets' | 'search';

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

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    <div className="atfc-card">
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
              <span className="atfc-fare-total">{currency} {selectedFare.totalFare?.toLocaleString() ?? '—'}</span>
              {selectedFare.basicFare !== selectedFare.totalFare && (
                <span className="atfc-fare-basic">Base: {currency} {selectedFare.basicFare?.toLocaleString()}</span>
              )}
              <span className="atfc-fare-label">{selectedFare.name ?? selectedFare.type}</span>
            </div>
          ) : (
            <span className="atfc-fare-empty">No fare</span>
          )}
          <button
            type="button"
            className="atfc-book-btn"
            onClick={() => onBook(flight)}
            disabled={isBooking || fares.length === 0}
          >
            {isBooking ? (
              <><span className="admin-tickets-spinner admin-tickets-spinner-inline" />Booking…</>
            ) : 'Book Now'}
          </button>
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
              <span className="atfc-fare-tab-price">{currency} {f.totalFare?.toLocaleString() ?? '—'}</span>
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
  const { toasts, toast, dismiss } = useToast();
  const [tickets, setTickets] = useState<CrewTicketApi[]>([]);
  const [projects, setProjects] = useState<ProjectApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<CrewTicketApi | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectApi | null>(null);
  const [createProjectId, setCreateProjectId] = useState<string>('');
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
  const [searchTripType, setSearchTripType] = useState<SearchPayload['tripType']>('one-way');
  const [searchFrom, setSearchFrom] = useState<Airport | null>(() => AIRPORTS[0] ?? null);
  const [searchTo, setSearchTo] = useState<Airport | null>(() => AIRPORTS[1] ?? null);
  const [departureDate, setDepartureDate] = useState(() => toYYYYMMDD(new Date()));
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toYYYYMMDD(d);
  });
  const [adults, setAdults] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabinClass, setCabinClass] = useState<CabinClass>('economy');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [searchResults, setSearchResults] = useState<Flight[] | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<SearchPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingFlightId, setBookingFlightId] = useState<string | null>(null);

  /* Project & crew for search form */
  const [searchProjectId, setSearchProjectId] = useState<string>('');
  const [searchCrewIds, setSearchCrewIds] = useState<string[]>([]);
  const [searchCrewList, setSearchCrewList] = useState<CrewMemberApi[]>([]);
  const [searchCrewLoading, setSearchCrewLoading] = useState(false);
  const [crewDropdownOpen, setCrewDropdownOpen] = useState(false);
  const crewDropdownRef = useRef<HTMLDivElement>(null);

  /* PDF upload for crew tickets */
  const [uploadingTicketId, setUploadingTicketId] = useState<string | null>(null);
  const ticketPdfInputRef = useRef<HTMLInputElement>(null);
  const pendingPdfUploadRef = useRef<string | null>(null);

  const handleUploadPdfClick = useCallback((ticketId: string) => {
    pendingPdfUploadRef.current = ticketId;
    ticketPdfInputRef.current?.click();
  }, []);

  const handlePdfFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ticketId = pendingPdfUploadRef.current;
    pendingPdfUploadRef.current = null;
    e.target.value = '';
    if (!file || !ticketId) return;
    if (!file.type.includes('pdf')) {
      toast('error', 'Invalid file', 'Only PDF files are allowed.');
      return;
    }
    setUploadingTicketId(ticketId);
    try {
      await uploadCrewTicketPdf(ticketId, file);
      toast('success', 'PDF uploaded', 'Ticket PDF uploaded successfully.');
    } catch (err) {
      toast('error', 'Upload failed', err instanceof Error ? err.message : 'Failed to upload PDF.');
    } finally {
      setUploadingTicketId(null);
    }
  }, [toast]);

  useEffect(() => {
    if (!crewDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (crewDropdownRef.current && !crewDropdownRef.current.contains(e.target as Node)) {
        setCrewDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [crewDropdownOpen]);

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

  const fetchTickets = useCallback(() => {
    setTicketsLoading(true);
    getCrewTickets()
      .then((res) => setTickets(res.crewTickets ?? []))
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getCrewTickets(), getProjects()])
      .then(([ticketsRes, projectsRes]) => {
        if (!cancelled) {
          setTickets(ticketsRes.crewTickets ?? []);
          setProjects(projectsRes.projects ?? []);
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

  const handleSearch = useCallback(async () => {
    if (!searchFrom || !searchTo) {
      setSearchError('Please select From and To airports.');
      return;
    }
    const criteria: SearchPayload = {
      tripType: searchTripType,
      from: searchFrom,
      to: searchTo,
      departureDate,
      returnDate: searchTripType === 'round-trip' ? returnDate : undefined,
      adults,
      children: childrenCount,
      infants,
      cabinClass,
      currency,
      ...(searchProjectId ? { project_id: searchProjectId } : {}),
      ...(searchCrewIds.length > 0 ? { crew_ids: searchCrewIds } : {}),
    };
    setSearchCriteria(criteria);
    setSearchResults(null);
    setSearchError(null);
    setIsSearching(true);
    try {
      const data = await searchFlights(criteria);
      setSearchResults(data);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [
    searchFrom,
    searchTo,
    searchTripType,
    departureDate,
    returnDate,
    adults,
    childrenCount,
    infants,
    cabinClass,
    currency,
    searchProjectId,
    searchCrewIds,
  ]);

  const handleBookNow = useCallback(
    async (flight: Flight) => {
      if (!searchProjectId) {
        toast('error', 'No project selected', 'Please select a project in the search form before booking.');
        return;
      }
      if (searchCrewIds.length === 0) {
        toast('error', 'No crew selected', 'Please select at least one crew member in the search form.');
        return;
      }
      setBookingFlightId(flight.id);
      try {
        const data = await bookFlight({
          project_id: searchProjectId,
          crew_ids: searchCrewIds,
          flight,
          adult: adults,
          children: childrenCount,
          infants,
        });
        const ticketCount = Array.isArray(data.tickets) ? data.tickets.length : searchCrewIds.length;
        const desc = `${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} booked & flight details sent to crew email.${data.bookingReference ? ` Ref: ${data.bookingReference}` : ''}`;
        toast('success', 'Ticket booked successfully!', desc);
        setSearchResults((prev) => (prev ? prev.filter((f) => f.id !== flight.id) : null));
      } catch (err) {
        toast('error', 'Booking failed', err instanceof Error ? err.message : 'Unable to complete booking. Please try again.');
      } finally {
        setBookingFlightId(null);
      }
    },
    [searchProjectId, searchCrewIds, adults, childrenCount, infants, toast]
  );

  const handleSearchBack = useCallback(() => {
    setSearchResults(null);
    setSearchCriteria(null);
    setSearchError(null);
  }, []);

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
      <div className="admin-tickets-header">
        <div>
          <h1 className="admin-tickets-title">Flight Tickets</h1>
          <p className="admin-tickets-subtitle">
            View and manage flight tickets for crew on projects.
          </p>
        </div>
        <div className="admin-tickets-header-actions">
          <div className="admin-tickets-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tickets'}
              className={'admin-tickets-tab' + (activeTab === 'tickets' ? ' admin-tickets-tab-active' : '')}
              onClick={() => setActiveTab('tickets')}
            >
              <TicketIcon size={18} />
              Tickets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'search'}
              className={'admin-tickets-tab' + (activeTab === 'search' ? ' admin-tickets-tab-active' : '')}
              onClick={() => setActiveTab('search')}
            >
              <Search size={18} />
              Search & Book
            </button>
          </div>
          {activeTab === 'tickets' && (
            <button type="button" className="admin-tickets-create-btn" onClick={openCreateModal}>
              <Plus size={18} />
              Create ticket
            </button>
          )}
        </div>
      </div>

      {activeTab === 'search' ? (
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
              <div className="admin-tickets-search-form-card">
                <div className="admin-tickets-search-form">
                  <div className="admin-tickets-search-row admin-tickets-search-row-trip">
                    <span className="admin-tickets-search-row-label">Trip type</span>
                    <div className="admin-tickets-search-radio-group">
                      <label className="admin-tickets-search-radio">
                        <input
                          type="radio"
                          name="trip-type"
                          checked={searchTripType === 'one-way'}
                          onChange={() => setSearchTripType('one-way')}
                        />
                        <span>One way</span>
                      </label>
                      <label className="admin-tickets-search-radio">
                        <input
                          type="radio"
                          name="trip-type"
                          checked={searchTripType === 'round-trip'}
                          onChange={() => setSearchTripType('round-trip')}
                        />
                        <span>Round Trip</span>
                      </label>
                    </div>
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-project">Project</label>
                    <select
                      id="search-project"
                      value={searchProjectId}
                      onChange={(e) => setSearchProjectId(e.target.value)}
                    >
                      <option value="">Select project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-tickets-search-field admin-tickets-search-field-crew">
                    <label htmlFor="search-crew-toggle">Crew members</label>
                    <div className="admin-tickets-search-crew-wrap" ref={crewDropdownRef}>
                      <button
                        id="search-crew-toggle"
                        type="button"
                        className="admin-tickets-search-crew-trigger"
                        onClick={() => setCrewDropdownOpen((o) => !o)}
                        disabled={!searchProjectId}
                        aria-expanded={crewDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <span className="admin-tickets-search-crew-trigger-text">
                          {!searchProjectId
                            ? 'Select a project first'
                            : searchCrewLoading
                              ? 'Loading…'
                              : searchCrewIds.length === 0
                                ? 'Select crew members…'
                                : `${searchCrewIds.length} crew member${searchCrewIds.length !== 1 ? 's' : ''} selected`}
                        </span>
                        <ChevronDown size={18} className="admin-tickets-search-crew-chevron" />
                      </button>
                      {crewDropdownOpen && searchProjectId && (
                        <div
                          className="admin-tickets-search-crew-dropdown"
                          role="listbox"
                          aria-multiselectable
                        >
                          {searchCrewList.length === 0 ? (
                            <p className="admin-tickets-search-crew-empty">No crew enrolled in this project.</p>
                          ) : (
                            <>
                              <div className="admin-tickets-search-crew-actions">
                                <button
                                  type="button"
                                  className="admin-tickets-search-crew-select-all"
                                  onClick={() => setSearchCrewIds(searchCrewList.map((c) => c.id))}
                                >
                                  Select all
                                </button>
                                <button
                                  type="button"
                                  className="admin-tickets-search-crew-clear"
                                  onClick={() => setSearchCrewIds([])}
                                >
                                  Clear
                                </button>
                              </div>
                              <ul className="admin-tickets-search-crew-list">
                                {searchCrewList.map((c) => (
                                  <li key={c.id}>
                                    <label className="admin-tickets-search-crew-item">
                                      <input
                                        type="checkbox"
                                        checked={searchCrewIds.includes(c.id)}
                                        onChange={() => toggleCrewSearch(c.id)}
                                      />
                                      <span>
                                        {c.firstname} {c.lastname}
                                      </span>
                                      <span className="admin-tickets-search-crew-item-email">{c.email}</span>
                                    </label>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-from">From</label>
                    <select
                      id="search-from"
                      value={searchFrom ? searchFrom.Name : ''}
                      onChange={(e) => {
                        const airport = AIRPORTS.find((a) => a.Name === e.target.value) ?? null;
                        setSearchFrom(airport);
                      }}
                    >
                      <option value="">Select airport</option>
                      {AIRPORTS.map((a) => (
                        <option key={a.Name} value={a.Name}>
                          {getAirportDisplayName(a)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-to">To</label>
                    <select
                      id="search-to"
                      value={searchTo ? searchTo.Name : ''}
                      onChange={(e) => {
                        const airport = AIRPORTS.find((a) => a.Name === e.target.value) ?? null;
                        setSearchTo(airport);
                      }}
                    >
                      <option value="">Select airport</option>
                      {AIRPORTS.map((a) => (
                        <option key={a.Name} value={a.Name}>
                          {getAirportDisplayName(a)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-departure">Departure date</label>
                    <input
                      id="search-departure"
                      type="date"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                    />
                  </div>
                  {searchTripType === 'round-trip' ? (
                    <div className="admin-tickets-search-field">
                      <label htmlFor="search-return">Return date</label>
                      <input
                        id="search-return"
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="admin-tickets-search-field" aria-hidden />
                  )}
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-adults">Adults</label>
                    <input
                      id="search-adults"
                      type="number"
                      min={0}
                      value={adults}
                      onChange={(e) => setAdults(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-children">Children</label>
                    <input
                      id="search-children"
                      type="number"
                      min={0}
                      value={childrenCount}
                      onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>
                  <div className="admin-tickets-search-field">
                    <label htmlFor="search-infants">Infants</label>
                    <input
                      id="search-infants"
                      type="number"
                      min={0}
                      value={infants}
                      onChange={(e) => setInfants(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>
                  <div className="admin-tickets-search-field admin-tickets-search-field-cabin">
                    <label htmlFor="search-cabin">Cabin class</label>
                    <select
                      id="search-cabin"
                      value={cabinClass}
                      onChange={(e) => setCabinClass(e.target.value as CabinClass)}
                    >
                      {CABIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {searchError && (
                  <div className="admin-tickets-search-error" role="alert">
                    {searchError}
                  </div>
                )}
                <div className="admin-tickets-search-actions">
                  <button
                    type="button"
                    className="admin-tickets-search-btn admin-tickets-search-btn-primary"
                    onClick={handleSearch}
                    disabled={isSearching || !searchFrom || !searchTo}
                  >
                    {isSearching ? (
                      <>
                        <span className="admin-tickets-spinner admin-tickets-spinner-inline" />
                        Searching…
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        Search flights
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-tickets-results-wrap">
              <div className="admin-tickets-results-header">
                <button type="button" className="admin-tickets-back-btn" onClick={handleSearchBack}>
                  <ChevronLeft size={18} />
                  Back to search
                </button>
                {searchCriteria && (
                  <p className="admin-tickets-results-summary">
                    {searchCriteria.from?.Name ?? '—'} → {searchCriteria.to?.Name ?? '—'}
                    {searchCriteria.departureDate && ` · ${searchCriteria.departureDate}`}
                  </p>
                )}
                <p className="admin-tickets-results-count">
                  {searchResults.length} flight{searchResults.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="admin-tickets-results-list">
                {searchResults.length === 0 ? (
                  <p className="admin-tickets-results-empty">No flights match your criteria.</p>
                ) : (
                  searchResults.map((flight) => (
                    <FlightResultCard
                      key={flight.id}
                      flight={flight}
                      currency={currency}
                      onBook={handleBookNow}
                      isBooking={bookingFlightId === flight.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
      <input
        ref={ticketPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="admin-tickets-file-input-hidden"
        onChange={handlePdfFileChange}
        aria-hidden
      />
      <div className="admin-tickets-toolbar">
        <div className="admin-tickets-filter-wrap">
          <label htmlFor="tickets-project-filter" className="admin-tickets-filter-label">
            Filter by project
          </label>
          <select
            id="tickets-project-filter"
            className="admin-tickets-filter-select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All projects</option>
            {uniqueProjectsFromTickets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <ChevronDown size={18} className="admin-tickets-filter-chevron" />
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
          {projectFilter === 'all' && (
            <button type="button" className="admin-tickets-create-inline" onClick={openCreateModal}>
              <Plus size={18} />
              Create ticket
            </button>
          )}
        </div>
      ) : (
        <div className="admin-tickets-table-wrap">
          <table className="admin-tickets-table">
            <thead>
              <tr>
                <th>Crew</th>
                <th>Project</th>
                <th>From → To</th>
                <th>Class</th>
                <th>Trip</th>
                <th>Passengers</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="admin-tickets-row-clickable"
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
                  <td>
                    <span className="admin-tickets-cell-crew">{getCrewName(ticket)}</span>
                  </td>
                  <td>
                    <span className="admin-tickets-cell-project">{getProjectTitle(ticket)}</span>
                  </td>
                  <td>
                    <span className="admin-tickets-cell-route" title={`${ticket.from?.Name ?? ''} → ${ticket.to?.Name ?? ''}`}>
                      {ticket.from?.Name ?? '—'} → {ticket.to?.Name ?? '—'}
                    </span>
                  </td>
                  <td>{ticket.class ?? '—'}</td>
                  <td>{ticket.trip?.replace('_', ' ') ?? '—'}</td>
                  <td>
                    {[ticket.adult, ticket.children, ticket.infants]
                      .filter((n) => n != null && n > 0)
                      .join(' / ') || '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-tickets-upload-pdf-btn"
                      onClick={() => handleUploadPdfClick(ticket.id)}
                      disabled={uploadingTicketId === ticket.id}
                      title="Upload ticket PDF"
                    >
                      {uploadingTicketId === ticket.id ? (
                        <span className="admin-tickets-upload-spinner" />
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title="Ticket details"
        size="medium"
      >
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
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={
          modalStep === 'project'
            ? 'Create ticket — Select project'
            : modalStep === 'crew'
              ? `Select crew — ${selectedProject?.title ?? ''}`
              : 'Create flight tickets'
        }
        size="medium"
      >
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
              <div className="admin-tickets-modal-actions">
                <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-tickets-btn admin-tickets-btn-primary"
                  onClick={handleProjectSelectAndContinue}
                  disabled={!createProjectId}
                >
                  Continue
                </button>
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
                <div className="admin-tickets-modal-actions">
                  <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-tickets-btn admin-tickets-btn-primary"
                    onClick={goToForm}
                    disabled={crewLoading || crew.length === 0 || selectedCrewIds.length === 0}
                  >
                    Continue to flight details
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="admin-tickets-back" onClick={goBackToCrew}>
                  <ChevronLeft size={16} />
                  Back to crew selection
                </button>

                {submitError && (
                  <div className="admin-tickets-form-error" role="alert">
                    {submitError}
                  </div>
                )}

                <form className="admin-tickets-form" onSubmit={handleSubmitTickets}>
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

                  <div className="admin-tickets-modal-actions">
                    <button type="button" className="admin-tickets-btn admin-tickets-btn-cancel" onClick={closeCreateModal} disabled={submitLoading}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-tickets-btn admin-tickets-btn-primary"
                      disabled={submitLoading}
                    >
                      {submitLoading ? 'Creating…' : `Create ${selectedCrewIds.length} ticket${selectedCrewIds.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
      </Modal>
      <Toaster toasts={toasts} dismiss={dismiss} />
    </div>
  );
};

export default AdminTicketsPage;
