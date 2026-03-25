import { Platform, Share } from "react-native";
import type { CardItem } from "@/types/models";

function escapeCsv(value: string | number | null | undefined): string {
  const normalized = value == null ? "" : String(value);
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsvRows(cards: CardItem[]): string[] {
  const header = [
    "Player Name",
    "Card Title",
    "Year",
    "Brand",
    "Set",
    "Card Number",
    "Team",
    "Position",
    "Reference Value",
    "Rarity",
    "Condition",
    "Favorite",
    "Autograph",
    "Memorabilia",
    "Parallel",
    "Parallel Name",
    "Serial Number",
    "Graded",
    "Grading Company",
    "Grade",
    "Added At",
    "Scanned At",
    "Notes"
  ];

  const rows = cards.map((card) =>
    [
      card.playerName,
      card.cardTitle,
      card.year,
      card.brand,
      card.set,
      card.cardNumber,
      card.team,
      card.position,
      card.referenceValue.toFixed(2),
      card.rarityLabel,
      card.condition,
      card.isFavorite ? "Yes" : "No",
      card.isAutograph ? "Yes" : "No",
      card.isMemorabilia ? "Yes" : "No",
      card.isParallel ? "Yes" : "No",
      card.parallelName ?? "",
      card.serialNumber ?? "",
      card.isGraded ? "Yes" : "No",
      card.gradingCompany ?? "",
      card.grade ?? "",
      card.addedAt ?? "",
      card.dateScanned,
      card.notes ?? ""
    ]
      .map((value) => escapeCsv(value))
      .join(",")
  );

  return [header.map((value) => escapeCsv(value)).join(","), ...rows];
}

function downloadOnWeb(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

class CollectionExportService {
  buildCsv(cards: CardItem[]): string {
    return buildCsvRows(cards).join("\n");
  }

  async export(cards: CardItem[]): Promise<{ status: "exported"; message: string }> {
    const filename = `cardatlas-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    const csv = this.buildCsv(cards);

    if (Platform.OS === "web" && typeof document !== "undefined") {
      downloadOnWeb(csv, filename);
      return { status: "exported", message: "Collection export downloaded as CSV." };
    }

    await Share.share({
      title: "CardAtlas Collection Export",
      message: csv
    });

    return { status: "exported", message: "Collection export opened in the share sheet." };
  }
}

export const collectionExportService = new CollectionExportService();
