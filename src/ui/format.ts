/** A share as a short percentage: 31%, 4.2%, 0.3%, <0.1%. */
export const pct = (p: number) => (p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.001 ? `${(p * 100).toFixed(1)}%` : '<0.1%');
