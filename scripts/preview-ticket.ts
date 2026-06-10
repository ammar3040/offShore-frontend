/* Quick manual preview: renders the crew ticket template with sample data.
   Run: npx tsx scripts/preview-ticket.ts */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCrewTicketTemplateData, fillCrewTicketTemplate } from '../src/lib/crewTicket/buildCrewTicket';
import type { CrewTicketApi } from '../src/api/ticket';

const sample = {
  _id: 'sample',
  bookingReference: '8XT6HB',
  class: 'economy',
  approvedAt: '2026-05-31T10:00:00Z',
  crew_id: { firstname: 'Darryl James', lastname: 'Keen' },
  rig_id: { name: 'MV Transocean Equinox' },
  flightSnapshot: {
    fares: [{ name: 'Economy (N)' }],
    legs: [
      {
        itinerary: [
          {
            airlineName: 'Qatar Airways',
            airlineCode: 'QR',
            flightNumber: '032',
            from: 'EDI',
            to: 'DOH',
            fromAirport: 'Edinburgh Airport',
            toAirport: 'Hamad International Airport',
            departureTime: '2026-06-05T07:55:00',
            arrivalTime: '2026-06-05T17:20:00',
            duration: '07h 25m',
            aircraft: 'Boeing 787-8',
            baggage: '40 KG',
            layover: { location: 'Doha (DOH)', duration: '3h 10m' },
          },
          {
            airlineName: 'Qatar Airways',
            airlineCode: 'QR',
            flightNumber: '904',
            from: 'DOH',
            to: 'MEL',
            fromAirport: 'Hamad International Airport',
            toAirport: 'Melbourne Airport – Terminal 2',
            departureTime: '2026-06-05T20:30:00',
            arrivalTime: '2026-06-06T17:15:00',
            duration: '13h 45m',
            aircraft: 'Airbus A350-1000',
            baggage: '40 KG',
          },
        ],
      },
    ],
  },
} as unknown as CrewTicketApi;

const template = readFileSync('src/assets/flight-ticket-email.html', 'utf8');
const html = fillCrewTicketTemplate(template, buildCrewTicketTemplateData(sample));
writeFileSync('/tmp/generated-ticket.html', html);
console.log('wrote /tmp/generated-ticket.html');
