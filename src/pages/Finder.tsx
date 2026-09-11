import { useQuery } from '@tanstack/react-query'
import { FileIcon, FolderIcon, SearchIcon, XIcon } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group'
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

export type FinderItem = {
    remote: string
    name: string
    path: string
    isDir: boolean
    size: number
    modTime: string
}

export function FinderPage() {
    const t = useT()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search)
    const [selected, setSelected] = useState<FinderItem | null>(null)
    const [typeFilter, setTypeFilter] = useState<'all' | 'files' | 'folders'>('all')

    const remotesQuery = useQuery({
        queryKey: ['remotes', 'list'],
        queryFn: fetchRemotesList,
    })
    const resultsQuery = useQuery({
        queryKey: ['finder', deferredSearch, remotesQuery.data?.map((remote) => remote.name)],
        queryFn: async ({ signal }) => {
            const query = deferredSearch.trim().toLowerCase()
            const remoteResults = await Promise.all(
                (remotesQuery.data ?? []).map(async (remote) => {
                    try {
                        const response = await rclone('/operations/list', {
                            params: {
                                query: {
                                    fs: `${remote.name}:`,
                                    remote: '',
                                    recursive: Boolean(query),
                                },
                            },
                            signal,
                        })
                        return (response.list ?? [])
                            .map((item): FinderItem | null => {
                                const name = String(item.Name ?? '')
                                const path = String(item.Path ?? name)
                                if (
                                    query &&
                                    !name.toLowerCase().includes(query) &&
                                    !path.toLowerCase().includes(query)
                                ) {
                                    return null
                                }
                                return {
                                    remote: remote.name,
                                    name,
                                    path,
                                    isDir: Boolean(item.IsDir || item.IsBucket),
                                    size: Number(item.Size ?? 0),
                                    modTime: String(item.ModTime ?? ''),
                                }
                            })
                            .filter((item): item is FinderItem => item !== null)
                    } catch {
                        // Continue searching other remotes when one is unavailable.
                        return []
                    }
                })
            )
            return remoteResults.flat().slice(0, 500)
        },
        enabled: !!remotesQuery.data?.length,
        staleTime: 30_000,
    })

    const results = useMemo(() => {
        const items = resultsQuery.data ?? []
        if (typeFilter === 'files') return items.filter((item) => !item.isDir)
        if (typeFilter === 'folders') return items.filter((item) => item.isDir)
        return items
    }, [resultsQuery.data, typeFilter])

    function openItem(item: FinderItem) {
        const folder = item.isDir ? item.path : item.path.split('/').slice(0, -1).join('/')
        navigate(`/remotes/${encodeURIComponent(item.remote)}?path=${encodeURIComponent(folder)}`)
    }

    return (
        <PageWrapper>
            <PageHeader title={t('finder.title')} description={t('finder.description')} />
            <PageContent>
                <div className="space-y-5">
                    <section className="rounded-2xl border bg-slate-950 px-5 py-6 text-white sm:px-8">
                        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
                            {t('finder.eyebrow')}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                            {t('finder.heading')}
                        </h2>
                        <div className="mt-5 max-w-3xl rounded-xl bg-white px-4 py-3 text-slate-900">
                            <InputGroup className="border-0 shadow-none ring-0">
                                <InputGroupAddon align="inline-start">
                                    <SearchIcon />
                                </InputGroupAddon>
                                <InputGroupInput
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('finder.placeholder')}
                                    aria-label={t('finder.placeholder')}
                                />
                                {search && (
                                    <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                            size="icon-xs"
                                            onClick={() => setSearch('')}
                                            aria-label={t('common.clear')}
                                        >
                                            <XIcon />
                                        </InputGroupButton>
                                    </InputGroupAddon>
                                )}
                            </InputGroup>
                        </div>
                    </section>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['all', 'files', 'folders'] as const).map((filter) => (
                            <Button
                                key={filter}
                                type="button"
                                size="sm"
                                variant={typeFilter === filter ? 'default' : 'outline'}
                                onClick={() => setTypeFilter(filter)}
                            >
                                {t(`finder.filter.${filter}`)}
                            </Button>
                        ))}
                        <span className="ml-auto text-sm text-muted-foreground">
                            {results.length} {t('finder.results')}
                        </span>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('finder.fileName')}</TableHead>
                                        <TableHead>{t('finder.location')}</TableHead>
                                        <TableHead className="w-28">{t('finder.size')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!search.trim() &&
                                    !resultsQuery.isFetching &&
                                    results.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="py-14 text-center text-muted-foreground"
                                            >
                                                {t('finder.noResults')}
                                            </TableCell>
                                        </TableRow>
                                    ) : resultsQuery.isPending || resultsQuery.isFetching ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="py-14 text-center">
                                                <Spinner className="mx-auto size-6" />
                                            </TableCell>
                                        </TableRow>
                                    ) : results.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={3}
                                                className="py-14 text-center text-muted-foreground"
                                            >
                                                {t('finder.noResults')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        results.slice(0, 100).map((item) => (
                                            <TableRow
                                                key={`${item.remote}:${item.path}`}
                                                data-selected={
                                                    selected?.path === item.path &&
                                                    selected.remote === item.remote
                                                }
                                                className="cursor-pointer data-[selected=true]:bg-cyan-500/10"
                                                onClick={() => setSelected(item)}
                                            >
                                                <TableCell>
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        {item.isDir ? (
                                                            <FolderIcon className="size-5 shrink-0 text-cyan-600" />
                                                        ) : (
                                                            <FileIcon className="size-5 shrink-0 text-muted-foreground" />
                                                        )}
                                                        <span className="truncate font-medium">
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-56 truncate text-muted-foreground">
                                                    {item.remote} / {item.path}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {item.isDir ? '--' : formatBytes(item.size)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>

                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle>{t('finder.details')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {selected ? (
                                    <div className="space-y-4 text-sm">
                                        <div className="flex items-center gap-3">
                                            {selected.isDir ? (
                                                <FolderIcon className="size-8 text-cyan-600" />
                                            ) : (
                                                <FileIcon className="size-8 text-muted-foreground" />
                                            )}
                                            <p className="min-w-0 truncate font-semibold">
                                                {selected.name}
                                            </p>
                                        </div>
                                        <dl className="space-y-3">
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    {t('finder.remote')}
                                                </dt>
                                                <dd className="break-all">{selected.remote}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    {t('finder.path')}
                                                </dt>
                                                <dd className="break-all">{selected.path}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    {t('finder.size')}
                                                </dt>
                                                <dd>
                                                    {selected.isDir
                                                        ? '--'
                                                        : formatBytes(selected.size)}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    {t('finder.modified')}
                                                </dt>
                                                <dd>{selected.modTime || '--'}</dd>
                                            </div>
                                        </dl>
                                        <Button
                                            className="w-full"
                                            onClick={() => openItem(selected)}
                                        >
                                            {t('finder.openLocation')}
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {t('finder.selectHint')}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </PageContent>
        </PageWrapper>
    )
}
