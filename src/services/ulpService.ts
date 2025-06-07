import { ULPEntry, UploadStats, ExtractionResult } from "@/types/ulp";
// Removed database imports as they are no longer needed

// URL validation and sanitization function
const isValidUrl = (url: string): boolean => {
  try {
    if (!url || typeof url !== 'string') return false;

    // Trim whitespace
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return false;

    // Allow URLs with or without protocol
    let testUrl = trimmedUrl;
    if (!trimmedUrl.match(/^https?:\/\//i)) {
      testUrl = 'https://' + trimmedUrl;
    }

    // Parse URL to validate format
    const parsedUrl = new URL(testUrl);
    
    // Additional validation rules
    if (parsedUrl.hostname === '') return false;
    if (parsedUrl.hostname === 'localhost') return false;
    if (parsedUrl.hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)) return false; // No raw IP addresses
    if (parsedUrl.hostname.includes('..')) return false; // Prevent directory traversal
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    if (testUrl.includes('javascript:')) return false; // Prevent JavaScript URLs
    if (!parsedUrl.hostname.includes('.')) return false; // Must have at least one dot
    if (parsedUrl.hostname.length > 255) return false; // Max hostname length
    
    // Check for common TLDs or at least a two-letter TLD
    const tld = parsedUrl.hostname.split('.').pop();
    if (!tld || tld.length < 2) return false;
    
    return true;
  } catch {
    return false;
  }
};

// Normalize URL by converting variations of the same URL to a canonical form
const normalizeUrl = (url: string): string => {
  try {
    // Add protocol if missing
    let normalizedUrl = url;
    if (!url.match(/^https?:\/\//i)) {
      normalizedUrl = 'https://' + url;
    }

    const parsedUrl = new URL(normalizedUrl);
    
    // Convert to lowercase
    let hostname = parsedUrl.hostname.toLowerCase();
    
    // Remove 'www.' prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    // Remove trailing slashes from pathname
    let pathname = parsedUrl.pathname;
    while (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Remove default ports
    if ((parsedUrl.protocol === 'http:' && parsedUrl.port === '80') ||
        (parsedUrl.protocol === 'https:' && parsedUrl.port === '443')) {
      parsedUrl.port = '';
    }
    
    // Reconstruct URL with normalized components
    return parsedUrl.protocol + '//' + hostname + 
           (parsedUrl.port ? ':' + parsedUrl.port : '') +
           pathname +
           parsedUrl.search;
  } catch {
    return url; // Return original URL if normalization fails
  }
};

// Enhanced validation for URLs with better error messages
const validateUrl = (url: string): { isValid: boolean; error?: string } => {
  try {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL cannot be empty' };
    }

    // Reject problematic URLs early
    if (url.includes('android://') || url === 'android' || 
        url.startsWith('android') || url === 'https') {
      return { isValid: false, error: 'Invalid or unsupported URL format' };
    }

    const normalizedUrl = normalizeUrl(url);
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid URL format' 
    };
  }
};

// Clean username and password with enhanced validation
const sanitizeField = (field: string, isUsername: boolean = false): string => {
  if (!field || typeof field !== 'string') {
    return '';
  }

  // Skip if field is likely encrypted/base64 and it's a password
  if (!isUsername && isLikelyEncrypted(field)) {
    return field;
  }

  let cleaned = field.trim();
  if (isUsername) {
    cleaned = cleaned
      .replace(/\s+/g, ' ') // Convert multiple spaces to single space
      .replace(/['"{}[\]]/g, '') // Remove JSON symbols
      .replace(/\\n|\\r/g, '') // Remove newlines
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
      .replace(/,$/, '') // Remove trailing comma
      .replace(/^"|"$/g, '') // Remove surrounding quotes
      .trim();
  } else {
    cleaned = cleaned
      .replace(/\s+/g, ' ') 
      .replace(/['"{}[\]]/g, '') 
      .replace(/\\n|\\r/g, '') 
      .replace(/[^\x20-\x7E]/g, '') 
      .replace(/,$/, '') 
      .replace(/^"|"$/g, '') 
      .trim();
  }

  // Additional validation for usernames
  if (isUsername) {
    // Common invalid usernames
    const invalidUsernames = [
      'android', 'user', 'username', 'login', 'email', 'admin',
      'test', 'guest', 'anonymous', 'system', 'root'
    ];

    if (invalidUsernames.includes(cleaned.toLowerCase())) {
      return '';
    }

    // Reject if it's too short or looks like a URL/path
    if (cleaned.length < 2 || 
        cleaned.includes('://') || 
        cleaned.includes('www.') ||
        cleaned.includes('/') ||
        cleaned.length > 100) {
      return '';
    }
  }

  return cleaned;
};

// Enhanced encrypted/base64 content detection
const isLikelyEncrypted = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  
  const encryptedPatterns = [
    /^[A-Za-z0-9+/=]{24,}$/,           // Standard base64
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, // Exact base64
    /^[0-9a-fA-F]{32,}$/,              // Hex encoded
    /^(?:0x)?[0-9a-fA-F]+$/,           // Ethereum style hex
    /\\x[0-9a-fA-F]{2}/i,              // Escaped hex
    /\$[1-6]\$[a-zA-Z0-9./]+\$[a-zA-Z0-9./]+/, // Unix crypt format
    /\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}/    // bcrypt format
  ];

  // Check for entropy (randomness) in the string
  const hasHighEntropy = (s: string): boolean => {
    const charFreq: { [key: string]: number } = {};
    for (const char of s) {
      charFreq[char] = (charFreq[char] || 0) + 1;
    }
    const entropy = Object.values(charFreq).reduce((acc, freq) => {
      const p = freq / s.length;
      return acc - p * Math.log2(p);
    }, 0);
    return entropy > 3.5; // Threshold for high entropy
  };

  return encryptedPatterns.some(pattern => pattern.test(str)) || 
         (str.length >= 20 && hasHighEntropy(str));
};

// Validate and sanitize entry fields
const validateEntry = (
  entry: ULPEntry
): { 
  isValid: boolean; 
  error?: string;
  sanitizedEntry?: ULPEntry;
} => {
  try {
    // URL validation
    const urlValidation = validateUrl(entry.url);
    if (!urlValidation.isValid) {
      return { isValid: false, error: urlValidation.error };
    }

    // Clean up fields
    const sanitizedUsername = sanitizeField(entry.username, true);
    const sanitizedPassword = sanitizeField(entry.password);

    // Username validation with more specific errors
    if (!sanitizedUsername) {
      return { isValid: false, error: `Username cannot be empty or invalid for URL: ${entry.url}` };
    }

    // Password validation
    if (!sanitizedPassword) {
      return { isValid: false, error: `Password cannot be empty for URL: ${entry.url}` };
    }

    // Normalize URL
    const normalizedUrl = normalizeUrl(entry.url);

    // Return sanitized entry if all validations pass
    return { 
      isValid: true,
      sanitizedEntry: {
        ...entry,
        url: normalizedUrl,
        username: sanitizedUsername,
        password: sanitizedPassword
      }
    };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Validation error for ${entry.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

const API_BASE = "http://localhost:4000/api/ulp";

export const getStoredData = async (): Promise<ULPEntry[]> => {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error("Failed to fetch data");
    return await res.json();
  } catch (error) {
    console.error("Error reading data:", error);
    return [];
  }
};

export const addEntries = async (newEntries: ULPEntry[]): Promise<{ 
  added: number;
  duplicates: number;
  invalid: number;
  error?: string;
}> => {
  // Ensure notes is included in the type
  const validEntries: { url: string; username: string; password: string; notes: string }[] = [];
  let invalid = 0;

  for (const entry of newEntries) {
    const validation = validateEntry(entry);
    if (validation.isValid && validation.sanitizedEntry) {
      validEntries.push({
        url: validation.sanitizedEntry.url,
        username: validation.sanitizedEntry.username,
        password: validation.sanitizedEntry.password,
        notes: validation.sanitizedEntry.notes ?? ""
      });
    } else {
      invalid++;
    }
  }

  if (validEntries.length > 0) {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: validEntries })
      });
      if (!res.ok) throw new Error("Failed to add entries");
      const data = await res.json();
      return {
        added: data.added || validEntries.length,
        duplicates: 0, // backend لا يحسب التكرار حالياً
        invalid: invalid
      };
    } catch (error) {
      return {
        added: 0,
        duplicates: 0,
        invalid: invalid,
        error: 'db_error'
      };
    }
  }

  return {
    added: 0,
    duplicates: 0,
    invalid
  };
};

export const searchEntries = async (
  query: string,
  field: "all" | "url" | "username" | "password" | "id"
): Promise<ULPEntry[]> => {
  try {
    const params = new URLSearchParams({ q: query, field });
    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to search");
    return await res.json();
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
};

export const deleteAllEntries = async (): Promise<void> => {
  await fetch(API_BASE, { method: "DELETE" });
};

export const exportDatabaseAsSQLite = async (): Promise<Blob | null> => {
  try {
    const res = await fetch(`${API_BASE}/export`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob;
  } catch {
    return null;
  }
};

export const getStats = async () => {
  const data = await getStoredData();
  return {
    totalPasswords: data.length,
    lastUpdate: data.length > 0 && (data[0] as any).created_at ? (data[0] as any).created_at : null,
    uniqueUsers: new Set(data.map(entry => entry.username)).size
  };
};

// استخراج بيانات ULP من ملف (بدون تخزين)
export const extractCredentials = async (file: File): Promise<{
  entries: ULPEntry[];
  stats: UploadStats;
}> => {
  const entries: ULPEntry[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const invalidDetails: string[] = [];
  const seenEntries = new Set<string>();
  const startTime = Date.now();
  const content = await file.text();
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  // Helper function to validate and add entry
  const processEntry = (entry: Partial<ULPEntry>, lineNumber?: number) => {
    const { url, username, password } = entry;
    if (!url || !username || !password) {
      invalidCount++;
      invalidDetails.push(
        `Line ${lineNumber ? lineNumber : 'unknown'}: Missing required fields` +
        `${!url ? ' (URL)' : ''}${!username ? ' (username)' : ''}${!password ? ' (password)' : ''}`
      );
      return;
    }
    try {
      if (!isValidUrl(url)) {
        invalidCount++;
        invalidDetails.push(`Line ${lineNumber ? lineNumber : 'unknown'}: Invalid URL format - ${url}`);
        return;
      }
      const normalizedUrl = normalizeUrl(url);
      const normalizedUsername = username.trim();
      const entryKey = `${normalizedUrl}:${normalizedUsername}`;
      if (seenEntries.has(entryKey)) {
        duplicateCount++;
        return;
      }
      const normalizedPassword = password.trim();
      if (!normalizedPassword) {
        invalidCount++;
        invalidDetails.push(`Line ${lineNumber ? lineNumber : 'unknown'}: Empty password`);
        return;
      }
      seenEntries.add(entryKey);
      entries.push({
        id: '',
        url: normalizedUrl,
        username: normalizedUsername,
        password: normalizedPassword
      });
    } catch (error) {
      invalidCount++;
      invalidDetails.push(
        `Line ${lineNumber ? lineNumber : 'unknown'}: Error processing entry - ` +
        `${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  try {
    if (fileExtension === 'json') {
      try {
        const jsonData = JSON.parse(content);
        if (!Array.isArray(jsonData)) {
          invalidCount++;
          invalidDetails.push("Error: JSON must be an array of objects");
          return {
            entries,
            stats: {
              fileName: file.name,
              added: 0,
              duplicates: duplicateCount,
              invalid: invalidCount,
              processingTime: (Date.now() - startTime) / 1000,
              speed: content.length / ((Date.now() - startTime) / 1000),
              invalidDetails
            }
          };
        }
        jsonData.forEach((item, index) => {
          const entry = {
            url: item?.URL?.trim() || item?.url?.trim() || "",
            username: item?.Username?.trim() || item?.username?.trim() || "",
            password: item?.Password || item?.password || ""
          };
          processEntry(entry, index + 1);
        });
      } catch (error) {
        invalidCount++;
        invalidDetails.push(`JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (fileExtension === 'txt' || fileExtension === 'csv') {
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        if (fileExtension === 'csv') {
          const parts = trimmedLine.match(/(?:^|,)("(?:[^"]+|"")*"|[^,]*)/g);
          if (parts && parts.length >= 3) {
            const [url, username, password] = parts
              .map(part => part.replace(/^,|"|'/g, '').trim());
            processEntry({ url, username, password }, index + 1);
          } else {
            invalidCount++;
            invalidDetails.push(`Line ${index + 1}: Invalid CSV format`);
          }
        } else {
          const match = trimmedLine.match(/^((?:https?:\/\/)?[^:]+):([^:]+):(.+)$/);
          if (match) {
            const [, url, username, password] = match;
            processEntry({
              url: url.trim(),
              username: username.trim(),
              password: password.trim()
            }, index + 1);
          } else {
            invalidCount++;
            invalidDetails.push(`Line ${index + 1}: Invalid format, expected URL:username:password`);
          }
        }
      });
    } else {
      invalidCount++;
      invalidDetails.push(`Unsupported file format: ${fileExtension}`);
    }
  } catch (error) {
    invalidCount++;
    invalidDetails.push(`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const processingTime = (Date.now() - startTime) / 1000;
  return {
    entries,
    stats: {
      fileName: file.name,
      added: entries.length,
      duplicates: duplicateCount,
      invalid: invalidCount,
      processingTime,
      speed: content.length / processingTime,
      invalidDetails: invalidDetails.length > 0 ? invalidDetails : undefined
    }
  };
};
