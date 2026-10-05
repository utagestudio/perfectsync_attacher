export const contactProductName = 'PerfectSync Attacher';

export function contactFormUrl(language, version) {
  const base = language === 'ja' ? 'https://tally.so/r/kdVdDR' : 'https://tally.so/r/KYqY78';
  return `${base}?product=${encodeURIComponent(contactProductName)}${
    version ? `&version=${encodeURIComponent(version)}` : ''
  }`;
}
