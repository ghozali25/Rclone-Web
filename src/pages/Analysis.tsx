import { useQuery } from '@tanstack/react-query'
import { BarChart3Icon, FileIcon, HardDriveIcon, RefreshCwIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { TablePagination } from '@/components/TablePagination'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatBytes } from '@/lib/format'
import { useT } from '@/lib/i18n'
import rclone from '@/rclone/client'
import { fetchRemotesList } from '@/rclone/usage'

export type AnalysisFile = {
    remote: string
    name: string
    path: string
    size: number
    modTime: string
}

export function AnalysisPage() {
    const t = useT()
    const [page, setPage] = useState(1)
    const remotesQuery = useQuery({
        queryKey: ['remotes', 'list'],
        queryFn: fetchRemotesList,
    })
    const analysisQuery = useQuery({
        queryKey: ['analysis', remotesQuery.data?.map((remote) => remote.name)],
        queryFn: async ({ signal }) => {
            const remoteResults = await Promise.all(
                (remotesQuery.data ?? []).map(async (remote) => {
                    try {
                        const response = await rclone('/operations/list', {
                            params: {
                                query: {
                                    fs: `${remote.name}:`,
                                    remote: '',
                                    recursive: true,
                                    files_only: true,
                                },
                            },
                            signal,
                        })
                        return (response.list ?? [])
                            .filter((item) => !item.IsDir && !item.IsBucket)
                            .map(
                                (item): AnalysisFile => ({
                                    remote: remote.name,
                                    name: String(item.Name ?? ''),
                                    path: String(item.Path ?? item.Name ?? ''),
                                    size: Number(item.Size ?? 0),
                                    modTime: String(item.ModTime ?? ''),
                                })
                            )
                    } catch {
                        return []
                    }
                })
            )
            return remoteResults.flat()
        },
        enabled: !!remotesQuery.data?.length,
        staleTime: 60_000,
    })

    const files = analysisQuery.data ?? []
    const largestFiles = useMemo(
        () =>
            [...files].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name)).slice(0, 25),
        [files]
    )
    const totalBytes = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files])
    const largestSize = largestFiles[0]?.size ?? 0
    const remoteCount = remotesQuery.data?.length ?? 0
    const pageSize = 10
    const pageCount = Math.max(1, Math.ceil(largestFiles.length / pageSize))
    const pagedLargestFiles = largestFiles.slice((page - 1) * pageSize, page * pageSize)

    return (
        <PageWrapper>
            <PageHeader
                title={t('analysis.title')}
                description={t('analysis.description')}
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => analysisQuery.refetch()}
                        disabled={analysisQuery.isFetching}
                    >
                        <RefreshCwIcon className={analysisQuery.isFetching ? 'animate-spin' : ''} />
                        {t('analysis.refresh')}
                    </Button>
                }
            />
            <PageContent>
                {analysisQuery.isPending ? (
                    <div className="flex min-h-72 items-center justify-center">
                        <div className="space-y-3 text-center">
                            <Spinner className="mx-auto size-8" />
                            <p className="text-sm text-muted-foreground">
                                {t('analysis.scanning')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <AnalysisMetric
                                icon={FileIcon}
                                label={t('analysis.totalFiles')}
                                value={files.length.toLocaleString()}
                                detail={t('analysis.remoteCount', { count: remoteCount })}
                            />
                            <AnalysisMetric
                                icon={HardDriveIcon}
                                label={t('analysis.totalSize')}
                                value={formatBytes(totalBytes)}
                                detail={t('analysis.allRemotes')}
                            />
                            <AnalysisMetric
                                icon={BarChart3Icon}
                                label={t('analysis.largestFile')}
                                value={formatBytes(largestSize)}
                                detail={largestFiles[0]?.name || '--'}
                            />
                            <AnalysisMetric
                                icon={HardDriveIcon}
                                label={t('analysis.remotesScanned')}
                                value={String(remoteCount)}
                                detail={t('analysis.filesIndexed', { count: files.length })}
                            />
                        </section>

                        <Card>
                            <CardHeader className="border-b bg-amber-500/5">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <CardTitle>{t('analysis.largestFiles')}</CardTitle>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {t('analysis.largestFilesDescription')}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
                                        {t('analysis.topCount', { count: largestFiles.length })}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16 text-center">#</TableHead>
                                            <TableHead>{t('analysis.file')}</TableHead>
                                            <TableHead>{t('analysis.location')}</TableHead>
                                            <TableHead className="w-36 text-right">
                                                {t('analysis.size')}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {largestFiles.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="py-14 text-center text-muted-foreground"
                                                >
                                                    {t('analysis.noFiles')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pagedLargestFiles.map((file, index) => (
                                                <TableRow key={`${file.remote}:${file.path}`}>
                                                    <TableCell className="text-center font-medium text-muted-foreground">
                                                        {(page - 1) * pageSize + index + 1}
                                                    </TableCell>
                                                    <TableCell className="max-w-80 truncate font-medium">
                                                        <span className="inline-flex items-center gap-2">
                                                            <FileIcon className="size-4 shrink-0 text-cyan-600" />
                                                            <span className="truncate">
                                                                {file.name}
                                                            </span>
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="max-w-96 truncate text-muted-foreground">
                                                        {file.remote} / {file.path}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold tabular-nums">
                                                        {formatBytes(file.size)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <TablePagination
                                    page={Math.min(page, pageCount)}
                                    pageCount={pageCount}
                                    onPageChange={setPage}
                                />
                            </CardContent>
                        </Card>

                        {largestSize > 0 ? (
                            <Card>
                                <CardContent className="space-y-2 pt-5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            {t('analysis.largestShare')}
                                        </span>
                                        <span className="font-medium">
                                            {Math.round((largestSize / totalBytes) * 100)}%
                                        </span>
                                    </div>
                                    <Progress value={(largestSize / totalBytes) * 100} />
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>
                )}
            </PageContent>
        </PageWrapper>
    )
}

function AnalysisMetric({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: typeof FileIcon
    label: string
    value: string
    detail: string
}) {
    return (
        <Card>
            <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
                        <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                            {detail}
                        </p>
                    </div>
                    <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600">
                        <Icon className="size-4" />
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
