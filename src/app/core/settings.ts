export interface Surveyor {
  name: string;
  title: string;
}

const KEY = 'sorvey.surveyor';

export function loadSurveyor(): Surveyor {
  try {
    return { name: '', title: '', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { name: '', title: '' };
  }
}

export function saveSurveyor(value: Surveyor) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Depolama kapalıysa ayar sadece bu oturumda kalır
  }
}
