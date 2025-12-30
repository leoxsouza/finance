export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
};

export type PaginationMeta = PaginationState & {
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
};

export type PaginationAction =
  | { type: "setPage"; page: number }
  | { type: "setPageSize"; pageSize: number }
  | { type: "setTotal"; total: number };

const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;

export function getPageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const safePageSize = Math.max(Math.floor(pageSize), MIN_PAGE_SIZE);
  return Math.max(Math.ceil(total / safePageSize), 1);
}

export function clampPage(page: number, pageCount: number): number {
  if (pageCount <= 0) {
    return MIN_PAGE;
  }
  if (!Number.isFinite(page)) {
    return MIN_PAGE;
  }

  return Math.min(Math.max(Math.floor(page), MIN_PAGE), pageCount);
}

export function buildRange(from: number, to: number): number[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const result: number[] = [];

  for (let index = start; index <= end; index += 1) {
    result.push(index);
  }

  return result;
}

export function getPaginationMeta(state: PaginationState): PaginationMeta {
  const pageCount = getPageCount(state.total, state.pageSize);
  const currentPage = clampPage(state.page, pageCount);
  const safePageSize = Math.max(Math.floor(state.pageSize), MIN_PAGE_SIZE);

  if (state.total === 0) {
    return {
      ...state,
      page: MIN_PAGE,
      pageSize: safePageSize,
      total: 0,
      pageCount: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      startIndex: 0,
      endIndex: 0,
    };
  }

  const startIndex = (currentPage - 1) * safePageSize + 1;
  const endIndex = Math.min(currentPage * safePageSize, state.total);

  return {
    page: currentPage,
    pageSize: safePageSize,
    total: state.total,
    pageCount,
    hasNextPage: currentPage < pageCount,
    hasPreviousPage: currentPage > MIN_PAGE,
    startIndex,
    endIndex,
  };
}
