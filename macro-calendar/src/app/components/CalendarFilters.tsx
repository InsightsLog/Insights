"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

type CalendarFiltersProps = {
  countries: string[];
  categories: string[];
  isAuthenticated: boolean;
};

/**
 * Client component for country and category filter dropdowns.
 * Uses URL search params for state so filters are bookmarkable/shareable.
 * 
 * Mobile responsive: filters stack in a grid layout on small screens.
 */
export function CalendarFilters({
  countries,
  categories,
  isAuthenticated,
}: CalendarFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCountry = searchParams.get("country") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentSearch = searchParams.get("search") ?? "";
  const currentWatchlist = searchParams.get("watchlist") === "true";

  // Local state for search input (debounced)
  const [searchValue, setSearchValue] = useState(currentSearch);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Sync local state when URL changes (e.g., clear filters button)
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  // Debounced search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== currentSearch) {
        updateFilter("search", searchValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, currentSearch, updateFilter]);

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      {/* Country filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="country-filter"
          className="min-w-[60px] text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:min-w-0 sm:text-sm"
        >
          Country
        </label>
        <select
          id="country-filter"
          value={currentCountry}
          onChange={(e) => updateFilter("country", e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:flex-initial sm:px-3"
        >
          <option value="">All countries</option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="category-filter"
          className="min-w-[60px] text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:min-w-0 sm:text-sm"
        >
          Category
        </label>
        <select
          id="category-filter"
          value={currentCategory}
          onChange={(e) => updateFilter("category", e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:flex-initial sm:px-3"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="search-filter"
          className="min-w-[60px] text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:min-w-0 sm:text-sm"
        >
          Search
        </label>
        <input
          id="search-filter"
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Indicator name..."
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 sm:w-48 sm:flex-initial sm:px-3"
        />
      </div>

      {/* Watchlist toggle - only shown when authenticated */}
      {isAuthenticated && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="watchlist-toggle"
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              id="watchlist-toggle"
              type="checkbox"
              checked={currentWatchlist}
              onChange={(e) =>
                updateFilter("watchlist", e.target.checked ? "true" : "")
              }
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 sm:text-sm">
              My Watchlist
            </span>
          </label>
        </div>
      )}

      {/* Clear filters button (only show when filters active) */}
      {(currentCountry || currentCategory || currentSearch || currentWatchlist) && (
        <button
          onClick={() => {
            setSearchValue("");
            router.push("/");
          }}
          className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 sm:px-3 sm:text-sm"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
