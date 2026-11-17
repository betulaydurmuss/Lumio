/** A downloadable resource on a lesson. The file lives in the media store under `key`. */
export interface AttachmentSeed {
  key: string;
  title: [tr: string, en: string];
}

/** Course slug → lesson English title → its resources, in order. */
export const attachments: Record<string, Record<string, AttachmentSeed[]>> = {
  'kvkk-awareness': {
    'Rights of the data subject': [
      {
        key: 'demo/resources/kvkk-basvuru-kontrol-listesi.txt',
        title: ['İlgili kişi başvurusu kontrol listesi', 'Data subject request checklist'],
      },
    ],
    'Clean desk, clean screen': [
      {
        key: 'demo/resources/temiz-masa-kontrol-listesi.txt',
        title: ['Temiz masa kontrol listesi', 'Clean desk checklist'],
      },
    ],
  },
  'phishing-and-social-engineering': {
    Checklist: [
      {
        key: 'demo/resources/oltalama-kontrol-listesi.txt',
        title: ['Oltalama e-postası kontrol listesi', 'Phishing email checklist'],
      },
    ],
  },
};
