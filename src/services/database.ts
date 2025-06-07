import initSqlJs from "sql.js";
import { useState, useEffect } from "react";

let SQL: typeof import("sql.js") | null = null;
let db: import("sql.js").Database | null = null;

// Initialize SQL.js
export const initDatabase = async () => {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }

  if (!db) {
    // حاول تحميل قاعدة البيانات من IndexedDB أولًا
    const data = await getDBFromIndexedDB("techdb");
    if (data) {
      db = new SQL.Database(new Uint8Array(data));
    } else {
      db = new SQL.Database();
      // إنشاء الجداول إذا لم تكن موجودة
      db.run(`
        CREATE TABLE IF NOT EXISTS websites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS technologies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS website_technologies (
          website_id INTEGER,
          technology_id INTEGER,
          PRIMARY KEY (website_id, technology_id),
          FOREIGN KEY (website_id) REFERENCES websites(id),
          FOREIGN KEY (technology_id) REFERENCES technologies(id)
        );
      `);
      // إنشاء جدول ulp_entries إذا لم يكن موجودًا
      db.run(`
        CREATE TABLE IF NOT EXISTS ulp_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT,
          username TEXT,
          password TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      // احفظ قاعدة البيانات الجديدة في IndexedDB
      await saveDatabase();
    }
  }

  return db;
};

// IndexedDB helpers
function setDBToIndexedDB(key: string, value: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.open("websitesdb", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function getDBFromIndexedDB(key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open("websitesdb", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("kv", "readonly");
      const store = tx.objectStore("kv");
      const getReq = store.get(key);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// Save database to IndexedDB
export const saveDatabase = async () => {
  if (db) {
    const data = db.export();
    await setDBToIndexedDB("techdb", new Uint8Array(data));
  }
};

// Load database from IndexedDB
export const loadDatabase = async () => {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });
  const data = await getDBFromIndexedDB("techdb");
  if (data) {
    db = new SQL.Database(new Uint8Array(data));
    return db;
  }
  return null;
};

// Insert website data
export const insertWebsiteData = async (
  data: { url: string; technologies: string[] }[]
) => {
  const database = await initDatabase();

  database.run("BEGIN TRANSACTION;");

  try {
    for (const item of data) {
      console.log("Inserting item:", item); // DEBUG: See what is being inserted into DB
      // Insert website
      const websiteStmt = database.prepare(
        "INSERT OR IGNORE INTO websites (url) VALUES (?)"
      );
      websiteStmt.run([item.url]);
      websiteStmt.free();

      // Get website id
      const websiteIdResult = database.exec(
        `SELECT id FROM websites WHERE url = '${item.url}'`
      );
      const websiteId = websiteIdResult[0].values[0][0];

      for (const tech of item.technologies) {
        // Insert technology
        const techStmt = database.prepare(
          "INSERT OR IGNORE INTO technologies (name) VALUES (?)"
        );
        techStmt.run([tech]);
        techStmt.free();

        // Get technology id
        const techIdResult = database.exec(
          `SELECT id FROM technologies WHERE name = '${tech}'`
        );
        const techId = techIdResult[0].values[0][0];

        // Associate website with technology
        const linkStmt = database.prepare(
          "INSERT OR IGNORE INTO website_technologies (website_id, technology_id) VALUES (?, ?)"
        );
        linkStmt.run([websiteId, techId]);
        linkStmt.free();
      }
    }

    database.run("COMMIT;");
    saveDatabase();
    return true;
  } catch (error) {
    database.run("ROLLBACK;");
    console.error("Error inserting data:", error);
    return false;
  }
};

// Delete a specific website and its technology associations
export const deleteWebsite = async (url: string) => {
  const database = await initDatabase();

  database.run("BEGIN TRANSACTION;");

  try {
    // Get the website id
    const websiteIdResult = database.exec(
      `SELECT id FROM websites WHERE url = '${url}'`
    );

    if (
      websiteIdResult.length === 0 ||
      websiteIdResult[0].values.length === 0
    ) {
      database.run("ROLLBACK;");
      return false;
    }

    const websiteId = websiteIdResult[0].values[0][0];

    // Delete website-technology associations
    database.run(
      `DELETE FROM website_technologies WHERE website_id = ${websiteId}`
    );

    // Delete the website
    database.run(`DELETE FROM websites WHERE id = ${websiteId}`);

    database.run("COMMIT;");
    saveDatabase();
    return true;
  } catch (error) {
    database.run("ROLLBACK;");
    console.error("Error deleting website:", error);
    return false;
  }
};

// Delete all data
export const deleteAllData = async () => {
  const database = await initDatabase();

  database.run("BEGIN TRANSACTION;");

  try {
    // Delete all website-technology associations
    database.run("DELETE FROM website_technologies");

    // Delete all websites
    database.run("DELETE FROM websites");

    // We're keeping technologies in case they want to be reused

    database.run("COMMIT;");
    saveDatabase();
    return true;
  } catch (error) {
    database.run("ROLLBACK;");
    console.error("Error deleting all data:", error);
    return false;
  }
};

// Search websites by technology or URL pattern
export const searchWebsites = async (
  query: string,
  searchTechnology: boolean = false
) => {
  const database = await initDatabase();

  try {
    let results;

    if (searchTechnology) {
      results = database.exec(`
        SELECT w.url, GROUP_CONCAT(t.name) as technologies
        FROM websites w
        LEFT JOIN website_technologies wt ON w.id = wt.website_id
        LEFT JOIN technologies t ON t.id = wt.technology_id
        WHERE t.name LIKE '%${query}%'
        GROUP BY w.url
        ORDER BY w.url
      `);
    } else {
      results = database.exec(`
        SELECT w.url, GROUP_CONCAT(t.name) as technologies
        FROM websites w
        LEFT JOIN website_technologies wt ON w.id = wt.website_id
        LEFT JOIN technologies t ON t.id = wt.technology_id
        WHERE w.url LIKE '%${query}%'
        GROUP BY w.url
        ORDER BY w.url
      `);
    }

    if (results.length === 0 || !results[0].values) {
      return [];
    }

    return results[0].values.map((row: unknown[]) => {
      const techString = typeof row[1] === 'string' ? row[1] : '';
      return {
        url: row[0] as string,
        technologies: techString && techString !== 'null'
          ? techString.split(',').map(t => t.trim()).filter(Boolean)
          : [],
      };
    });
  } catch (error) {
    console.error("Error searching:", error);
    return [];
  }
};

// Get all data for export
export const getAllWebsitesWithTechnologies = async () => {
  const database = await initDatabase();

  try {
    const results = database.exec(`
      SELECT w.url, GROUP_CONCAT(t.name) as technologies
      FROM websites w
      LEFT JOIN website_technologies wt ON w.id = wt.website_id
      LEFT JOIN technologies t ON t.id = wt.technology_id
      GROUP BY w.url
      ORDER BY w.url
    `);

    if (results.length === 0 || !results[0].values) {
      return [];
    }

    return results[0].values.map((row: unknown[]) => {
      const techString = typeof row[1] === 'string' ? row[1] : '';
      return {
        url: row[0] as string,
        technologies: techString && techString !== 'null'
          ? techString.split(',').map(t => t.trim()).filter(Boolean)
          : [],
      };
    });
  } catch (error) {
    console.error("Error getting all websites:", error);
    return [];
  }
};

// Get all technologies for filtering
export const getAllTechnologies = async () => {
  const database = await initDatabase();

  try {
    const results = database.exec(
      "SELECT name FROM technologies ORDER BY name"
    );

    if (results.length === 0 || !results[0].values) {
      return [];
    }

    return results[0].values.map((row: unknown[]) => row[0] as string);
  } catch (error) {
    console.error("Error getting technologies:", error);
    return [];
  }
};

// ULP-specific functions
// ULP entries table: id, url, username, password, notes, created_at

export const addULPEntry = async (entry) => {
  const database = await initDatabase();
  database.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
  const stmt = database.prepare(
    `INSERT INTO ulp_entries (url, username, password, notes) VALUES (?, ?, ?, ?)`
  );
  stmt.run([entry.url, entry.username, entry.password, entry.notes]);
  stmt.free();
  saveDatabase();
  return true;
};

export const addULPEntries = async (entries) => {
  const database = await initDatabase();
  database.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
  database.run("BEGIN TRANSACTION;");
  let transactionStarted = true;
  try {
    for (const entry of entries) {
      const stmt = database.prepare(
        `INSERT INTO ulp_entries (url, username, password, notes) VALUES (?, ?, ?, ?)`
      );
      stmt.run([entry.url, entry.username, entry.password, entry.notes]);
      stmt.free();
    }
    database.run("COMMIT;");
    transactionStarted = false;
    saveDatabase();
    return true;
  } catch (error) {
    if (transactionStarted) {
      try { database.run("ROLLBACK;"); } catch {}
    }
    console.error("Error inserting ULP entries:", error);
    return false;
  }
};

export const getULPEntries = async () => {
  const database = await initDatabase();
  database.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
  const results = database.exec(`SELECT * FROM ulp_entries ORDER BY created_at DESC`);
  if (results.length === 0 || !results[0].values) return [];
  return results[0].values.map(row => ({
    id: row[0],
    url: row[1],
    username: row[2],
    password: row[3],
    notes: row[4],
    created_at: row[5],
  }));
};

export const searchULPEntries = async (query, field = "url") => {
  const database = await initDatabase();
  database.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
  let results;
  if (field === "all") {
    results = database.exec(`SELECT * FROM ulp_entries WHERE 
      url LIKE '%${query}%' OR 
      username LIKE '%${query}%' OR 
      password LIKE '%${query}%' OR 
      notes LIKE '%${query}%' 
      ORDER BY created_at DESC`);
  } else {
    results = database.exec(`SELECT * FROM ulp_entries WHERE ${field} LIKE '%${query}%' ORDER BY created_at DESC`);
  }
  if (results.length === 0 || !results[0].values) return [];
  return results[0].values.map(row => ({
    id: row[0],
    url: row[1],
    username: row[2],
    password: row[3],
    notes: row[4],
    created_at: row[5],
  }));
};

export const deleteAllULPEntries = async () => {
  const database = await initDatabase();
  // حذف الجدول بالكامل ثم إعادة إنشائه ليبدأ id من 1
  database.run("DROP TABLE IF EXISTS ulp_entries;");
  database.run(`CREATE TABLE IF NOT EXISTS ulp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
  saveDatabase();
  return true;
};

// Helper functions for storing binary data in localStorage
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Hook for database operations
export function useDatabase() {
  const [dbInstance, setDbInstance] = useState<
    import("sql.js").Database | null
  >(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Try to load from localStorage first
        let loadedDb = await loadDatabase();

        // If no saved database, initialize a new one
        if (!loadedDb) {
          loadedDb = await initDatabase();
        }

        setDbInstance(loadedDb);
        setIsReady(true);
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };

    initialize();
  }, []);

  return { db: dbInstance, isReady };
}
