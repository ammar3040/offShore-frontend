import html2pdf from 'html2pdf.js';
import crewTicketTemplate from '../../assets/lynq-travel-crew-ticket.html?raw';
import lynqLogoUrl from '../../assets/lynq-logo.png?url';
import type { CrewTicketApi } from '../../api/ticket';
import { getCrewTicketPdfFilename } from '../../api/ticket';
import { buildCrewTicketTemplateData, fillCrewTicketTemplate } from './buildCrewTicket';

function prepareCrewTicketHtmlForPdf(html: string): string {
  const pdfLayoutCss = `<style>
    html, body { overflow: visible !important; }
    table { border-collapse: collapse; }
  </style>`;
  return html.replace('</head>', `${pdfLayoutCss}</head>`);
}

function renderCrewTicketHtml(ticket: CrewTicketApi): string {
  const templateData = buildCrewTicketTemplateData(ticket);
  const html = fillCrewTicketTemplate(crewTicketTemplate, {
    ...templateData,
    logo_src: lynqLogoUrl,
  });
  return prepareCrewTicketHtmlForPdf(html);
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function withRenderedHtml<T>(
  html: string,
  capture: (body: HTMLElement) => Promise<T>
): Promise<T> {
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;top:0;left:0;width:794px;min-height:1123px;height:auto;border:0;visibility:hidden;z-index:-1;overflow:visible;';
  document.body.appendChild(iframe);

  try {
    const loaded = new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not access ticket iframe document.');
    doc.open();
    doc.write(html);
    doc.close();

    await loaded;

    try {
      await (iframe.contentDocument?.fonts?.ready ?? Promise.resolve());
    } catch {
      /* fonts API may be unavailable; ignore */
    }
    await waitForPaint();

    const body = iframe.contentDocument?.body;
    if (!body) throw new Error('Ticket iframe body is empty.');

    iframe.style.height = `${Math.max(body.scrollHeight, 1123)}px`;
    await waitForPaint();

    return await capture(body);
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function generateCrewTicketPdfBlob(ticket: CrewTicketApi): Promise<Blob> {
  const html = renderCrewTicketHtml(ticket);
  const filename = getCrewTicketPdfFilename(ticket);

  return withRenderedHtml(html, async (body) => {
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(body)
      .outputPdf('blob');

    return blob as Blob;
  });
}

export async function generateCrewTicketPdfFile(ticket: CrewTicketApi): Promise<File> {
  const blob = await generateCrewTicketPdfBlob(ticket);
  return new File([blob], getCrewTicketPdfFilename(ticket), { type: 'application/pdf' });
}

export function previewCrewTicketHtml(ticket: CrewTicketApi): string {
  return renderCrewTicketHtml(ticket);
}
