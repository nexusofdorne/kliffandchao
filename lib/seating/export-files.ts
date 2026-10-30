import writeXlsxFile from 'write-excel-file/browser';
import type { ExportRows } from './export-rows';

const JPG_WIDTH = 3000;

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Draws the floor plan SVG onto a white 3000 px canvas. Guest names live only in the
// chairs' <title> elements, so dropping those keeps the picture name-free.
export async function exportJpg(svg: SVGSVGElement, fileName = 'kliff-chao-seating-plan.jpg'): Promise<void> {
  const box = svg.viewBox.baseVal;
  const height = Math.round((JPG_WIDTH * box.height) / box.width);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('title').forEach((title) => title.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(JPG_WIDTH));
  clone.setAttribute('height', String(height));

  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not draw the seating plan'));
      image.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = JPG_WIDTH;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not draw the seating plan');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, JPG_WIDTH, height);
    context.drawImage(image, 0, 0, JPG_WIDTH, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Could not create the picture');
    download(blob, fileName);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

const headerRow = (...names: string[]) => names.map((value) => ({ value, fontWeight: 'bold' as const }));

export async function exportXlsx(rows: ExportRows, fileName = 'kliff-chao-seating.xlsx'): Promise<void> {
  await writeXlsxFile([
    {
      sheet: 'Seating',
      data: [
        headerRow('Table', 'Table name', 'Seat', 'Guest', 'Household', 'Side', 'Role'),
        ...rows.seating.map((r) => [r.table, r.tableName, r.seat, r.guest, r.household, r.side, r.role || null]),
      ],
    },
    {
      sheet: 'Tables',
      data: [
        headerRow('Table', 'Table name', 'Seats', 'Filled', 'Free'),
        ...rows.tables.map((r) => [r.table, r.tableName, r.seats, r.filled, r.free]),
      ],
    },
    {
      sheet: 'Not seated',
      data: [
        headerRow('Guest', 'Household', 'Side', 'Role'),
        ...rows.notSeated.map((r) => [r.guest, r.household, r.side, r.role || null]),
      ],
    },
  ]).toFile(fileName);
}
