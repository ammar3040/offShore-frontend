import { approveCrewTicket, uploadSuperadminCrewTicketPdf } from '../../api/superadmin';
import {
  getCrewTicketById,
  getCrewTicketPdfFilename,
  ticketHasStoredPdf,
  type CrewTicketApi,
} from '../../api/ticket';
import { generateCrewTicketPdfBlob } from './generateCrewTicketPdf';

export interface ApproveAndUploadTicketPdfResult {
  crewTicket: CrewTicketApi;
  message?: string;
  pdfUploaded: boolean;
}

/**
 * Option A: approve ticket, always generate PDF in the browser, upload to backend.
 * Ignores any PDF the backend may have created during approve — frontend is the source of truth.
 */
export async function approveAndUploadTicketPdf(
  ticketId: string,
  bookingReference: string
): Promise<ApproveAndUploadTicketPdfResult> {
  const approveRes = await approveCrewTicket(ticketId, bookingReference);

  const fullTicketRes = await getCrewTicketById(ticketId, 'superadmin');
  const ticketForPdf = fullTicketRes.crewTicket ?? approveRes.crewTicket;

  const pdfBlob = await generateCrewTicketPdfBlob(ticketForPdf);
  const pdfFile = new File([pdfBlob], getCrewTicketPdfFilename(ticketForPdf), {
    type: 'application/pdf',
  });

  const uploadRes = (await uploadSuperadminCrewTicketPdf(ticketId, pdfFile)) as {
    crewTicket?: CrewTicketApi;
    message?: string;
  };

  const crewTicket = uploadRes.crewTicket ?? approveRes.crewTicket;

  return {
    crewTicket,
    message: uploadRes.message ?? approveRes.message,
    pdfUploaded: ticketHasStoredPdf(crewTicket),
  };
}

/** Regenerate and upload a frontend PDF for an already-approved ticket (replaces stored PDF). */
export async function regenerateAndUploadTicketPdf(ticketId: string): Promise<ApproveAndUploadTicketPdfResult> {
  const fullTicketRes = await getCrewTicketById(ticketId, 'superadmin');
  const ticketForPdf = fullTicketRes.crewTicket;

  const pdfBlob = await generateCrewTicketPdfBlob(ticketForPdf);
  const pdfFile = new File([pdfBlob], getCrewTicketPdfFilename(ticketForPdf), {
    type: 'application/pdf',
  });

  const uploadRes = (await uploadSuperadminCrewTicketPdf(ticketId, pdfFile)) as {
    crewTicket?: CrewTicketApi;
    message?: string;
  };

  const crewTicket = uploadRes.crewTicket ?? ticketForPdf;

  return {
    crewTicket,
    message: uploadRes.message,
    pdfUploaded: ticketHasStoredPdf(crewTicket),
  };
}
