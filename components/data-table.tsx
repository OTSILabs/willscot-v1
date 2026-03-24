/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useRef, useState } from "react";
import {
  flexRender,
  getFilteredRowModel,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import { PaginationComponent } from "./pagination-component";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { CopyToClipboard } from "./copy-to-clipboard";
import { Input } from "./ui/input";


interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  isLoading?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  totalItems?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  manualFiltering?: boolean;
  onFilterChange?: (filters: ColumnFiltersState) => void;
  onRowSelectionChange?: (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => void;
  rowSelection?: RowSelectionState;
}

export function DataTable<TData>({
  data,
  columns,
  isLoading,
  enablePagination,
  pageSize,
  totalItems,
  page,
  onPageChange,
  manualFiltering = true,
  onRowSelectionChange,
  rowSelection = {},
}: DataTableProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<TData>({
    data,
    columns,
    defaultColumn: {
      enableColumnFilter: false,
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    manualPagination: true,
    manualFiltering: manualFiltering,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: (filters) => {
      setColumnFilters(filters as ColumnFiltersState);
    },
    onRowSelectionChange: onRowSelectionChange,
    state: {
      columnFilters,
      rowSelection,
    },
  });


  return (
    <div ref={tableContainerRef}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup: any) => {
            const isFilterable = headerGroup.headers.some((header: any) =>
              header.column.getCanFilter()
            );

            return (
              <Fragment key={headerGroup.id}>
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "p-4",
                        (header.column.columnDef as { rowClassName?: string }).rowClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  ))}
                </TableRow>
                {isFilterable && (
                  <TableRow>
                    {headerGroup.headers.map((header: any) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "px-4 py-2",
                          (header.column.columnDef as { rowClassName?: string }).rowClassName
                        )}
                      >
                        {header.column.getCanFilter() && (
                          <Filter
                            filter={header.column.getFilterValue() as string}
                            onChange={header.column.setFilterValue}
                            type={header.column.columnDef.filterFn as string}
                            header={header.column.columnDef.header as string}
                          />
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell
                  colSpan={columns.length}
                  className="text-center px-4 py-3"
                >
                  <Skeleton className="w-full h-8" />
                </TableCell>
              </TableRow>
            ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row: any) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={cn(
                  "odd:bg-muted",
                  (row.original as { rowClassName?: string }).rowClassName
                )}
              >
                {row.getVisibleCells().map((cell: any) => (
                  <TableCell key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PaginationComponent
        currentPage={page}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(page: number) => {
          onPageChange?.(page);
          tableContainerRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
        enablePagination={enablePagination}
        className="justify-end"
      />
    </div>
  );
}


interface FilterProps {
  filter: string;
  onChange: (value: string) => void;
  type: string;
  header: string;
}

function Filter({ filter, onChange, type, header }: FilterProps) {
  return (
    <Input
      type={type === "includesDate" ? "date" : "text"}
      value={filter || ""}
      placeholder={`Filter ${header}`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}


interface RowRenderLinkProps {
  showLink?: boolean;
  href: string;
  value: string;
  header?: string;
  allowCopy?: boolean;
  target?: string;
  urlText?: string;
}

export function RowRenderLink({
  showLink = true,
  href,
  value,
  header,
  allowCopy = true,
  target = "_self",
  urlText = "Click to view",
}: RowRenderLinkProps) {
  return (
    <div className="flex items-center gap-0.5">
      <div className="max-w-24 truncate">
        {showLink ? (
          <Link href={href} className="underline" target={target}>
            <RowCell
              value={value}
              href={href}
              header={header}
              urlText={urlText}
              target={target}
            />
          </Link>
        ) : (
          <RowCell value={value} header={header} urlText={urlText} />
        )}
      </div>
      {allowCopy && <CopyToClipboard value={value} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RowCell                                                                    */
/* -------------------------------------------------------------------------- */

interface RowCellProps {
  value: string;
  className?: string;
  header?: string;
  href?: string;
  urlText?: string;
  target?: string;
}

export function RowCell({
  value,
  className,
  header,
  href,
  urlText = "View logs",
  target = "_self",
}: RowCellProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className={cn("max-w-32 truncate", className)}>{value}</div>
      </HoverCardTrigger>
      <HoverCardContent className="space-y-2 p-0">
        <div className="p-4">
          {header && <h3 className="text-base">{header}</h3>}
          <div className="text-sm">{value}</div>
        </div>
        {href && (
          <Link
            href={href}
            target={target}
            className="text-sm bg-accent-foreground/10 p-2 flex gap-1 items-center"
          >
            <LinkIcon className="size-3" />
            {urlText}
          </Link>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}