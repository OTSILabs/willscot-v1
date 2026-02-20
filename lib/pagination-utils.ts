/**
 * Pagination utility functions for generating smart pagination items
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type PaginationPageItem = {
  type: "page";
  page: number;
  isActive: boolean;
};

type PaginationEllipsisItem = {
  type: "ellipsis";
};

export type PaginationItem = PaginationPageItem | PaginationEllipsisItem;

/* -------------------------------------------------------------------------- */
/* Functions                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generate pagination items with maximum 3 visible pages + ellipses.
 * Example pattern:
 * 1 ... 4 5 6 ... 10
 */
export function generatePaginationItems(
  currentPage: number,
  totalPages: number
): PaginationItem[] {
  const items: PaginationItem[] = [];

  // Always show first page
  items.push({ type: "page", page: 1, isActive: currentPage === 1 });

  // Add left ellipsis if needed
  if (currentPage > 3) {
    items.push({ type: "ellipsis" });
  }

  // Determine middle range
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    if (i > 1 && i < totalPages) {
      items.push({
        type: "page",
        page: i,
        isActive: i === currentPage,
      });
    }
  }

  // Add right ellipsis if needed
  if (currentPage < totalPages - 2) {
    items.push({ type: "ellipsis" });
  }

  // Always show last page
  if (totalPages > 1) {
    items.push({
      type: "page",
      page: totalPages,
      isActive: currentPage === totalPages,
    });
  }

  return items;
}

/**
 * Calculate total pages based on total items and page size
 */
export function calculateTotalPages(
  totalItems: number,
  pageSize: number
): number {
  return Math.ceil(totalItems / pageSize);
}

/**
 * Validate if a page change is valid
 * @param newPage - New page index (0-based)
 * @param totalPages - Total number of pages
 */
export function isValidPageChange(
  newPage: number,
  totalPages: number
): boolean {
  return newPage >= 0 && newPage < totalPages;
}

/**
 * Convert 0-based page index to 1-based page number
 */
export function getPageNumber(pageIndex: number): number {
  return pageIndex + 1;
}

/**
 * Convert 1-based page number to 0-based page index
 */
export function getPageIndex(pageNumber: number): number {
  return pageNumber - 1;
}