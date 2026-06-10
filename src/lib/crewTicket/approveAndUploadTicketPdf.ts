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
 * Option A flow: approve ticket, generate PDF in browser, upload to backend.
 */
export async function approveAndUploadTicketPdf(
  ticketId: string,
  bookingReference: string
): Promise<ApproveAndUploadTicketPdfResult> {
  const approveRes = await approveCrewTicket(ticketId, bookingReference);
  let crewTicket = approveRes.crewTicket;

  if (ticketHasStoredPdf(crewTicket)) {
    return { crewTicket, message: approveRes.message, pdfUploaded: true };
  }

  const fullTicketRes = await getCrewTicketById(ticketId, 'superadmin');
  const ticketForPdf = fullTicketRes.crewTicket ?? crewTicket;

  const pdfBlob = await generateCrewTicketPdfBlob(ticketForPdf);
  const pdfFile = new File([pdfBlob], getCrewTicketPdfFilename(ticketForPdf), {
    type: 'application/pdf',
  });

  const uploadRes = (await uploadSuperadminCrewTicketPdf(ticketId, pdfFile)) as {
    crewTicket?: CrewTicketApi;
    message?: string;
  };

  if (uploadRes.crewTicket) {
    crewTicket = uploadRes.crewTicket;
  }

  return {
    crewTicket,
    message: uploadRes.message ?? approveRes.message,
    pdfUploaded: ticketHasStoredPdf(crewTicket),
  };
}
