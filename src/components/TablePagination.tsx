import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TablePagination({
    page,
    pageCount,
    onPageChange,
}: {
    page: number
    pageCount: number
    onPageChange: (page: number) => void
}) {
    if (pageCount <= 1) return null

    return (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
                {page} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    disabled={page === 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeftIcon />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    disabled={page === pageCount}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRightIcon />
                </Button>
            </div>
        </div>
    )
}
