/**
 * Centralized Indian Standard Time (IST, UTC+05:30) date & time utilities.
 * Ensures consistent time display across all devices, browsers, and cloud deployments (Render, Vercel).
 */

export const parseISTDate = (dateVal) => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  
  let s = String(dateVal).trim();
  if (!s) return new Date();
  
  // Normalize space separator to T (e.g. "2026-09-05 19:54:39" -> "2026-09-05T19:54:39")
  s = s.replace(' ', 'T');
  
  // If naive datetime without timezone offset (+... or Z), treat as Indian Standard Time (+05:30)
  // This prevents browsers from adding 5.5 hours to timestamps already stored in IST
  if (!s.includes('+') && !s.endsWith('Z')) {
    s = s + '+05:30';
  }
  
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const formatISTDate = (dateVal, options = null) => {
  const d = parseISTDate(dateVal);
  const defaultOpts = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  };
  return d.toLocaleDateString('en-IN', options ? { timeZone: 'Asia/Kolkata', ...options } : defaultOpts);
};

export const formatISTTime = (dateVal, options = null) => {
  const d = parseISTDate(dateVal);
  const defaultOpts = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  return d.toLocaleTimeString('en-IN', options ? { timeZone: 'Asia/Kolkata', ...options } : defaultOpts);
};

export const formatISTDateTime = (dateVal) => {
  const d = parseISTDate(dateVal);
  const datePart = d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${datePart} ${timePart}`;
};

export const parseNaiveDate = parseISTDate;
