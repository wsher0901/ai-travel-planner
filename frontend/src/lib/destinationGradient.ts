const GRADIENTS = {
  cyan:   'linear-gradient(180deg, rgba(6,182,212,0.9), rgba(6,182,212,0.3))',
  green:  'linear-gradient(180deg, rgba(52,211,153,0.9), rgba(52,211,153,0.3))',
  amber:  'linear-gradient(180deg, rgba(245,158,11,0.9), rgba(245,158,11,0.3))',
  orange: 'linear-gradient(180deg, rgba(249,115,22,0.9), rgba(249,115,22,0.3))',
  indigo: 'linear-gradient(180deg, rgba(129,140,248,0.9), rgba(129,140,248,0.3))',
  violet: 'linear-gradient(180deg, rgba(167,139,250,0.9), rgba(167,139,250,0.3))',
} as const

type GradientKey = keyof typeof GRADIENTS

const KEYWORDS: { key: GradientKey; words: string[] }[] = [
  { key: 'cyan',   words: ['bali', 'maldives', 'cancun', 'hawaii', 'beach', 'coast', 'island', 'miami'] },
  { key: 'green',  words: ['alps', 'rockies', 'himalaya', 'mountain', 'patagonia', 'banff', 'zermatt'] },
  { key: 'amber',  words: ['tokyo', 'paris', 'new york', 'london', 'seoul', 'berlin', 'rome'] },
  { key: 'orange', words: ['dubai', 'morocco', 'egypt', 'sahara', 'vegas'] },
  { key: 'indigo', words: ['iceland', 'norway', 'finland', 'antarctica'] },
]

export function getDestinationGradient(destination: string): string {
  const d = destination.toLowerCase()
  for (const { key, words } of KEYWORDS) {
    if (words.some((w) => d.includes(w))) return GRADIENTS[key]
  }
  return GRADIENTS.violet
}
