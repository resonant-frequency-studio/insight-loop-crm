"use client";

import { useState } from "react";
import Papa from "papaparse";

export interface CsvParseResult {
  rows: Record<string, string>[];
  error: string | null;
}

/**
 * Hook for parsing CSV files
 */
export function useCsvParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseCsv = (file: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      setIsParsing(true);
      setParseError(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          setIsParsing(false);
          resolve(results.data);
        },
        error: (error: Error) => {
          setIsParsing(false);
          const errorMessage = `Error parsing CSV: ${error.message}`;
          setParseError(errorMessage);
          reject(new Error(errorMessage));
        },
      });
    });
  };

  return {
    parseCsv,
    isParsing,
    parseError,
  };
}

