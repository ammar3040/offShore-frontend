import html2pdf from 'html2pdf.js';
import crewTicketTemplate from '../../assets/flight-ticket-email.html?raw';
import type { CrewTicketApi } from '../../api/ticket';
import { getCrewTicketPdfFilename } from '../../api/ticket';
import { buildCrewTicketTemplateData, fillCrewTicketTemplate } from './buildCrewTicket';

interface CrewTicketPdfOptions {
  margin?: number;
  filename?: string;
  image?: { type?: 'jpeg' | 'png' | 'webp'; quality?: number };
  html2canvas?: object;
  jsPDF?: { unit?: string; format?: string; orientation?: 'portrait' | 'landscape' };
  pagebreak?: {
    mode?: Array<'avoid-all' | 'css' | 'legacy'>;
    before?: string | string[];
    after?: string | string[];
    avoid?: string | string[];
  };
}

function prepareCrewTicketHtmlForPdf(html: string): string {
  const withTableFix = html
    .replaceAll(
      'font-size:0px;padding:0;word-break:break-word;',
      'font-size:13px;line-height:1.6;padding:0;word-break:break-word;'
    )
    .replace(
      /font-size:0px;(padding:[^;]+;word-break:break-word;)/g,
      'font-size:13px;line-height:1.6;$1'
    );

  // html2pdf clones only the <body> element into its own frame, so any CSS
  // living in <head> (the mj-style classes and the responsive column media
  // queries) is lost in the final PDF. Copy every head <style> into the body
  // and pin MJML column widths so the layout never depends on media queries.
  const headStyles = Array.from(withTableFix.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => match[1])
    .join('\n');

  const columnWidths = new Set<string>();
  for (const match of withTableFix.matchAll(/mj-column-per-(\d+)/g)) {
    columnWidths.add(match[1]);
  }
  const columnCss = Array.from(columnWidths)
    .map((width) => `.mj-column-per-${width} { width: ${width}% !important; max-width: ${width}%; }`)
    .join('\n');

  const pdfCss = `<style>
    html, body { overflow: visible !important; background: #EAEEF4 !important; margin: 0; padding: 0; }
    table { border-collapse: collapse; }
    [role="article"] { max-width: 600px; margin: 0 auto; }
    .mj-outlook-group-fix { display: inline-block !important; vertical-align: top !important; }
    .crew-ticket-flight-block,
    .crew-ticket-layover,
    .crew-ticket-footer-block,
    .crew-ticket-header-group {
      page-break-inside: avoid;
      break-inside: avoid-page;
    }
    ${columnCss}
    ${headStyles}
  </style>`;

  return withTableFix.replace(/<body([^>]*)>/i, (bodyTag) => `${bodyTag}${pdfCss}`);
}

function renderCrewTicketHtml(ticket: CrewTicketApi): string {
  const templateData = buildCrewTicketTemplateData(ticket);
  const html = fillCrewTicketTemplate(crewTicketTemplate, templateData);
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
          backgroundColor: '#EAEEF4',
          windowWidth: 794,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: [
            '.crew-ticket-flight-block',
            '.crew-ticket-layover',
            '.crew-ticket-footer-block',
            '.crew-ticket-header-group',
          ],
        },
      } as CrewTicketPdfOptions)
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
