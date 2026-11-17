// Draws one certificate on its own thread and exits. Rasterising at print size
// and packing the PDF are seconds of CPU between them; done here, the API's
// main thread keeps answering everyone else in the meantime.
//
// Plain JavaScript on purpose: the same file runs under the dev server, the
// tests and the production image without a build step of its own.
import { Resvg } from '@resvg/resvg-js';
import { PDFDocument } from 'pdf-lib';
import { parentPort, workerData } from 'node:worker_threads';

/** @type {{ kind: 'png' | 'pdf', svg: string, width: number, fontFiles: string[], pdf?: { title: string, subject: string, issuedAt: string } }} */
const job = workerData;

function png(width) {
  const resvg = new Resvg(job.svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: job.fontFiles, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
  });
  return resvg.render().asPng();
}

async function pdf() {
  const doc = await PDFDocument.create();
  doc.setTitle(job.pdf.title);
  doc.setSubject(job.pdf.subject);
  doc.setAuthor('Lumio');
  doc.setCreator('Lumio');
  doc.setProducer('Lumio');
  doc.setCreationDate(new Date(job.pdf.issuedAt));
  doc.setModificationDate(new Date(job.pdf.issuedAt));
  const image = await doc.embedPng(png(3508));
  // Landscape A4 in points.
  const page = doc.addPage([841.89, 595.28]);
  page.drawImage(image, { x: 0, y: 0, width: 841.89, height: 595.28 });
  return doc.save();
}

const bytes = job.kind === 'pdf' ? await pdf() : png(job.width);
const out = new Uint8Array(bytes);
parentPort.postMessage(out, [out.buffer]);
