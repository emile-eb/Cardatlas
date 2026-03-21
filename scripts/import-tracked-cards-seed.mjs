import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_HEADERS = ["player_name", "year", "brand", "set_name", "card_number"];
const CARD_SELECT = "id,sport,player_name,card_title,year,brand,set_name,card_number,team";
const MAX_SAMPLE_ROWS = 10;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeCardNumber(value) {
  return normalizeText(value).replace(/[^a-z0-9#]/g, "");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_");
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      const hasValues = row.some((value) => value.length > 0);
      if (hasValues) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function parseCsvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(content);
  if (!rows.length) {
    throw new Error("CSV is empty.");
  }

  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((values, index) => {
    const rowObject = {};
    headers.forEach((header, headerIndex) => {
      rowObject[header] = String(values[headerIndex] ?? "").trim();
    });
    rowObject.__rowNumber = index + 2;
    return rowObject;
  });

  return { headers, records };
}

function summarizeCard(card) {
  return {
    cardId: card.id,
    playerName: card.player_name ?? null,
    year: card.year ?? null,
    brand: card.brand ?? null,
    setName: card.set_name ?? null,
    cardNumber: card.card_number ?? null,
    sport: card.sport ?? null,
    team: card.team ?? null
  };
}

function exactCardMatch(card, row) {
  const checks = [
    ["player_name", normalizeText(card.player_name), normalizeText(row.player_name)],
    ["brand", normalizeText(card.brand), normalizeText(row.brand)],
    ["set_name", normalizeText(card.set_name), normalizeText(row.set_name)],
    ["sport", normalizeText(card.sport), normalizeText(row.sport)],
    ["team", normalizeText(card.team), normalizeText(row.team)]
  ];

  for (const [, left, right] of checks) {
    if (!right) continue;
    if (left !== right) return false;
  }

  if (row.card_number && normalizeCardNumber(card.card_number) !== normalizeCardNumber(row.card_number)) {
    return false;
  }

  if (row.year) {
    const year = Number.parseInt(String(row.year), 10);
    if (!Number.isFinite(year) || card.year !== year) return false;
  }

  return true;
}

async function resolveCard(service, row) {
  const directCardId = row.card_id?.trim();
  if (directCardId) {
    const { data, error } = await service.from("cards").select(CARD_SELECT).eq("id", directCardId).maybeSingle();
    if (error) throw error;
    if (!data) {
      return { status: "unresolved", reason: "card_id_not_found" };
    }
    return { status: "resolved", card: data, resolution: "card_id" };
  }

  const anchors = [row.player_name, row.brand, row.set_name, row.card_number, row.year].filter((value) => normalizeText(value)).length;
  if (anchors < 3) {
    return { status: "unresolved", reason: "insufficient_identity_fields" };
  }

  let query = service.from("cards").select(CARD_SELECT).limit(20);

  if (row.player_name) query = query.ilike("player_name", row.player_name.trim());
  if (row.brand) query = query.ilike("brand", row.brand.trim());
  if (row.set_name) query = query.ilike("set_name", row.set_name.trim());
  if (row.card_number) query = query.ilike("card_number", row.card_number.trim());
  if (row.sport) query = query.ilike("sport", row.sport.trim());
  if (row.team) query = query.ilike("team", row.team.trim());
  if (row.year) {
    const parsedYear = Number.parseInt(String(row.year), 10);
    if (Number.isFinite(parsedYear)) {
      query = query.eq("year", parsedYear);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const exactMatches = (data ?? []).filter((card) => exactCardMatch(card, row));
  if (exactMatches.length === 1) {
    return { status: "resolved", card: exactMatches[0], resolution: "identity_fields" };
  }
  if (exactMatches.length > 1) {
    return {
      status: "unresolved",
      reason: "ambiguous_multiple_matches",
      candidates: exactMatches.slice(0, 5).map(summarizeCard)
    };
  }

  return { status: "unresolved", reason: "no_exact_card_match" };
}

function buildTrackedCardInsert(cardId) {
  const now = new Date().toISOString();
  return {
    card_id: cardId,
    tracking_source: "seeded",
    tracking_status: "active",
    is_active: true,
    first_tracked_at: now
  };
}

function pickSummarySample(items) {
  return items.slice(0, MAX_SAMPLE_ROWS);
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const args = process.argv.slice(2);
  const csvPathArg = args.find((value) => !value.startsWith("--"));
  const dryRun = args.includes("--dry-run");

  if (!csvPathArg) {
    throw new Error("Usage: npm run seed:tracked-cards -- <path-to-csv> [--dry-run]");
  }

  const csvPath = path.resolve(process.cwd(), csvPathArg);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const supabaseUrl = getEnv("SUPABASE_URL", ["EXPO_PUBLIC_SUPABASE_URL"]);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { headers, records } = parseCsvFile(csvPath);
  const hasAnyIdentityHeader = headers.includes("card_id") || REQUIRED_HEADERS.every((header) => headers.includes(header));
  if (!hasAnyIdentityHeader) {
    throw new Error(
      "CSV must include either card_id, or the identifying columns: player_name, year, brand, set_name, card_number."
    );
  }

  const summary = {
    totalRows: records.length,
    insertedCount: 0,
    alreadyTrackedCount: 0,
    unresolvedCount: 0,
    failedCount: 0,
    dryRun,
    unresolved: [],
    failed: [],
    inserted: [],
    alreadyTracked: []
  };

  const resolvedRows = [];

  for (const row of records) {
    try {
      const resolution = await resolveCard(supabase, row);
      if (resolution.status !== "resolved") {
        summary.unresolvedCount += 1;
        summary.unresolved.push({
          rowNumber: row.__rowNumber,
          reason: resolution.reason,
          input: {
            card_id: row.card_id || null,
            player_name: row.player_name || null,
            year: row.year || null,
            brand: row.brand || null,
            set_name: row.set_name || null,
            card_number: row.card_number || null
          },
          candidates: resolution.candidates ?? null
        });
        continue;
      }

      resolvedRows.push({
        rowNumber: row.__rowNumber,
        card: resolution.card,
        resolution: resolution.resolution
      });
    } catch (error) {
      summary.failedCount += 1;
      summary.failed.push({
        rowNumber: row.__rowNumber,
        reason: error instanceof Error ? error.message : "Unknown resolution failure"
      });
    }
  }

  const uniqueResolvedIds = Array.from(new Set(resolvedRows.map((row) => row.card.id)));
  const { data: existingRows, error: existingError } = await supabase
    .from("tracked_cards")
    .select("card_id")
    .in("card_id", uniqueResolvedIds);

  if (existingError) throw existingError;

  const existingIds = new Set((existingRows ?? []).map((row) => row.card_id).filter(Boolean));
  const rowsToInsert = [];

  for (const row of resolvedRows) {
    const cardId = row.card.id;
    const sample = {
      rowNumber: row.rowNumber,
      cardId,
      playerName: row.card.player_name ?? null,
      year: row.card.year ?? null,
      brand: row.card.brand ?? null,
      setName: row.card.set_name ?? null,
      cardNumber: row.card.card_number ?? null
    };

    if (existingIds.has(cardId)) {
      summary.alreadyTrackedCount += 1;
      summary.alreadyTracked.push(sample);
      continue;
    }

    rowsToInsert.push(buildTrackedCardInsert(cardId));
    existingIds.add(cardId);
    summary.inserted.push(sample);
  }

  if (!dryRun && rowsToInsert.length) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("tracked_cards")
      .upsert(rowsToInsert, { onConflict: "card_id", ignoreDuplicates: true })
      .select("card_id");

    if (insertError) throw insertError;
    summary.insertedCount = insertedRows?.length ?? 0;
  } else {
    summary.insertedCount = rowsToInsert.length;
  }

  const output = {
    totalRows: summary.totalRows,
    dryRun: summary.dryRun,
    insertedCount: summary.insertedCount,
    alreadyTrackedCount: summary.alreadyTrackedCount,
    unresolvedCount: summary.unresolvedCount,
    failedCount: summary.failedCount,
    sampleInserted: pickSummarySample(summary.inserted),
    sampleAlreadyTracked: pickSummarySample(summary.alreadyTracked),
    sampleUnresolved: pickSummarySample(summary.unresolved),
    sampleFailed: pickSummarySample(summary.failed)
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exitCode = 1;
});
