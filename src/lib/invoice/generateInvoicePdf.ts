import html2pdf from 'html2pdf.js';
import invoiceTemplate from '../../assets/lynq-travel-invoice.html?raw';
import { buildInvoiceTemplateData, fillInvoiceTemplate } from './buildInvoice';
import type { ProjectInvoiceBill } from './types';

function renderInvoiceHtml(bill: ProjectInvoiceBill): string {
  const templateData = buildInvoiceTemplateData(bill);
  return fillInvoiceTemplate(invoiceTemplate, templateData);
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
    'position:fixed;top:0;left:0;width:794px;height:1123px;border:0;visibility:hidden;z-index:-1;';
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
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#f4f6f8' },
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
