import html2pdf from 'html2pdf.js';
import invoiceTemplate from '../../assets/lynq-travel-invoice.html?raw';
import lynqLogoUrl from '../../assets/lynq-logo.png?url';
import { buildInvoiceTemplateData, fillInvoiceTemplate } from './buildInvoice';
import type { ProjectInvoiceBill } from './types';

function prepareInvoiceHtmlForPdf(html: string): string {
  // MJML wraps tables in font-size:0 containers which html2canvas can clip.
  const withTableFix = html.replaceAll(
    'font-size:0px;padding:0;word-break:break-word;',
    'font-size:13px;line-height:1.6;padding:0;word-break:break-word;'
  );
  const pdfLayoutCss = `<style>
    html, body { overflow: visible !important; }
    table { border-collapse: collapse; }
  </style>`;
  return withTableFix.replace('</head>', `${pdfLayoutCss}</head>`);
}

function renderInvoiceHtml(bill: ProjectInvoiceBill): string {
  const templateData = buildInvoiceTemplateData(bill);
  const html = fillInvoiceTemplate(invoiceTemplate, {
    ...templateData,
    logo_src: lynqLogoUrl,
  });
  return prepareInvoiceHtmlForPdf(html);
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Renders the invoice HTML inside an isolated iframe so the full document
 * (with its <head> styles) is laid out natively, then captures it to PDF.
 * Using an iframe avoids html2canvas blank-capture issues that occur with
 * off-screen or opacity-hidden elements.
 */
async function withRenderedInvoice<T>(
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
    if (!doc) throw new Error('Could not access invoice iframe document.');
    doc.open();
    doc.write(html);
    doc.close();

    await loaded;

    // Wait for fonts (if any) and a paint frame before capturing.
    try {
      await (iframe.contentDocument?.fonts?.ready ?? Promise.resolve());
    } catch {
      /* fonts API may be unavailable; ignore */
    }
    await waitForPaint();

    const body = iframe.contentDocument?.body;
    if (!body) throw new Error('Invoice iframe body is empty.');

    iframe.style.height = `${Math.max(body.scrollHeight, 1123)}px`;
    await waitForPaint();

    return await capture(body);
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function generateInvoicePdfBlob(bill: ProjectInvoiceBill): Promise<Blob> {
  const html = renderInvoiceHtml(bill);

  return withRenderedInvoice(html, async (body) => {
    const blob = await html2pdf()
      .set({
        margin: 0,
        filename: `${bill.invoiceNumber}.pdf`,
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

export async function generateInvoicePdfFile(bill: ProjectInvoiceBill): Promise<File> {
  const blob = await generateInvoicePdfBlob(bill);
  return new File([blob], `${bill.invoiceNumber}.pdf`, { type: 'application/pdf' });
}

export function previewInvoiceHtml(bill: ProjectInvoiceBill): string {
  return renderInvoiceHtml(bill);
}
