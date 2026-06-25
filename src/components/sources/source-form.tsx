import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  db,
  newId,
  nowISO,
  isSourceKeyAvailable,
  type Source,
  type FieldMapping,
} from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { testFetch } from "@/lib/api";
import { extractScalarPaths } from "@/lib/json-paths";
import type { ScalarPath } from "@/lib/json-paths";
import type { FetchResult } from "@/lib/api";
import {
  findReferenceDependencies,
  propagateReferenceRenames,
} from "@/lib/source-key-rename";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Play from "lucide-react/dist/esm/icons/play";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { cn } from "@/lib/utils";

interface SourceFormProps {
  sessionId: string;
  source?: Source | null;
  mappings?: FieldMapping[];
  onSaved: () => void;
  onCancel: () => void;
}

export function SourceForm({
  sessionId,
  source,
  mappings,
  onSaved,
  onCancel,
}: SourceFormProps) {
  const editing = !!source;

  // Source fields
  const [name, setName] = useState(source?.name ?? "");
  const [key, setKey] = useState(source?.key ?? "");
  const [url, setUrl] = useState(source?.url ?? "");
  const [enabled, setEnabled] = useState(source?.enabled ?? true);
  const [authType, setAuthType] = useState<"none" | "bearer" | "header">(
    source?.authConfig?.type ?? "none",
  );
  const [authToken, setAuthToken] = useState(source?.authConfig?.token ?? "");
  const [headerName, setHeaderName] = useState(
    source?.authConfig?.headerName ?? "",
  );
  const [headerValue, setHeaderValue] = useState(
    source?.authConfig?.headerValue ?? "",
  );
  const [queryParams, setQueryParams] = useState<
    { key: string; value: string }[]
  >(source?.queryParams ?? []);

  // Test fetch state
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [paths, setPaths] = useState<ScalarPath[]>([]);

  // Field mapping state — initialize from existing mappings when editing
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => {
    if (editing && mappings) {
      return new Set(mappings.map((m) => m.jsonPath));
    }
    return new Set();
  });
  const [pathLabels, setPathLabels] = useState<Record<string, string>>(() => {
    if (editing && mappings) {
      const labels: Record<string, string> = {};
      for (const m of mappings) labels[m.jsonPath] = m.label;
      return labels;
    }
    return {};
  });
  const [pathKeys, setPathKeys] = useState<Record<string, string>>(() => {
    if (editing && mappings) {
      const keys: Record<string, string> = {};
      for (const m of mappings) keys[m.jsonPath] = m.key;
      return keys;
    }
    return {};
  });
  const [pathDescriptions, setPathDescriptions] = useState<
    Record<string, string>
  >(() => {
    if (editing && mappings) {
      const descs: Record<string, string> = {};
      for (const m of mappings)
        if (m.description) descs[m.jsonPath] = m.description;
      return descs;
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialConfigSignature = useMemo(
    () =>
      JSON.stringify({
        url: source?.url ?? "",
        queryParams: source?.queryParams ?? [],
        authType: source?.authConfig?.type ?? "none",
        authToken: source?.authConfig?.token ?? "",
        headerName: source?.authConfig?.headerName ?? "",
        headerValue: source?.authConfig?.headerValue ?? "",
      }),
    [source],
  );
  const currentConfigSignature = useMemo(
    () =>
      JSON.stringify({
        url,
        queryParams,
        authType,
        authToken,
        headerName,
        headerValue,
      }),
    [url, queryParams, authType, authToken, headerName, headerValue],
  );
  const savedSampleJson = source?.lastTestFetchJson;
  const usingSavedSample = editing && !fetchResult && !!savedSampleJson;
  const sampleMayBeStale = usingSavedSample && currentConfigSignature !== initialConfigSignature;
  const hasSampleResponse = fetchResult?.ok === true || (editing && savedSampleJson !== undefined);
  const availablePaths = useMemo(() => {
    const merged = new Map<string, ScalarPath>();
    const samplePaths = fetchResult?.ok
      ? paths
      : savedSampleJson
        ? extractScalarPaths(savedSampleJson)
        : paths;

    for (const path of samplePaths) {
      merged.set(path.path, path);
    }

    for (const mapping of mappings ?? []) {
      if (merged.has(mapping.jsonPath)) continue;
      merged.set(mapping.jsonPath, {
        path: mapping.jsonPath,
        value: "Not in sample",
        type: mapping.type,
      });
    }

    return [...merged.values()];
  }, [fetchResult, paths, savedSampleJson, mappings]);

  // Sync initial state when source/mappings load after mount (live queries)
  const initialSynced = useRef<string | null>(null);
  useEffect(() => {
    if (!editing || !source || !mappings) return;
    if (initialSynced.current === source.id) return;
    initialSynced.current = source.id;

    setSelectedPaths(new Set(mappings.map((m) => m.jsonPath)));
    const labels: Record<string, string> = {};
    const keys: Record<string, string> = {};
    for (const m of mappings) {
      labels[m.jsonPath] = m.label;
      keys[m.jsonPath] = m.key;
    }
    setPathLabels(labels);
    setPathKeys(keys);
    const descs: Record<string, string> = {};
    for (const m of mappings)
      if (m.description) descs[m.jsonPath] = m.description;
    setPathDescriptions(descs);
  }, [editing, source, mappings]);

  // Validation
  const [keyError, setKeyError] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!editing) return true;

    // Source field changes
    if (name !== (source?.name ?? "")) return true;
    if (key !== (source?.key ?? "")) return true;
    if (url !== (source?.url ?? "")) return true;
    if (enabled !== (source?.enabled ?? true)) return true;
    if (authType !== (source?.authConfig?.type ?? "none")) return true;
    if (authToken !== (source?.authConfig?.token ?? "")) return true;
    if (headerName !== (source?.authConfig?.headerName ?? "")) return true;
    if (headerValue !== (source?.authConfig?.headerValue ?? "")) return true;

    // Query param changes
    const initialParams = source?.queryParams ?? [];
    if (queryParams.length !== initialParams.length) return true;
    for (let i = 0; i < queryParams.length; i++) {
      if (queryParams[i].key !== initialParams[i]?.key) return true;
      if (queryParams[i].value !== initialParams[i]?.value) return true;
    }

    // Mapping additions / key / label / description changes
    const initialMappings = mappings ?? [];
    const initialJsonPaths = new Set(initialMappings.map((m) => m.jsonPath));
    if (selectedPaths.size !== initialJsonPaths.size) return true;
    for (const m of initialMappings) {
      if (!selectedPaths.has(m.jsonPath)) return true;
      if (pathLabels[m.jsonPath] !== m.label) return true;
      if (pathKeys[m.jsonPath] !== m.key) return true;
      if ((pathDescriptions[m.jsonPath] ?? "") !== (m.description ?? ""))
        return true;
    }
    for (const path of selectedPaths) {
      if (!initialJsonPaths.has(path)) return true;
    }

    return false;
  }, [
    editing,
    name,
    key,
    url,
    enabled,
    authType,
    authToken,
    headerName,
    headerValue,
    queryParams,
    source,
    mappings,
    selectedPaths,
    pathLabels,
    pathKeys,
    pathDescriptions,
  ]);

  function validateKey(value: string) {
    if (!value) {
      setKeyError("Key is required");
      return false;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
      setKeyError("Lowercase letters, numbers, underscore. No leading number.");
      return false;
    }
    setKeyError(null);
    return true;
  }

  async function handleTestFetch() {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    setFetchResult(null);
    setPaths([]);
    setMappingError(null);
    if (!editing) {
      setSelectedPaths(new Set());
      setPathLabels({});
      setPathKeys({});
      setPathDescriptions({});
    }

    try {
      const session = await db.sessions.get(sessionId);
      const result = await testFetch({
        url: url.trim(),
        queryParams: queryParams.filter((p) => p.key && p.value),
        authConfig:
          authType === "none"
            ? { type: "none" }
            : authType === "bearer"
              ? { type: "bearer", token: authToken }
              : { type: "header", headerName, headerValue },
        timeoutMs: session?.timeoutMs,
      });

      setFetchResult(result);

      if (result.ok && result.data) {
        const scalarPaths = extractScalarPaths(result.data);
        setPaths(scalarPaths);
      } else if (!result.ok) {
        setFetchError(result.error ?? "Request failed");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setFetching(false);
    }
  }

  function togglePath(path: string) {
    setMappingError(null);
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function validateMappingKeys(): string | null {
    const activeMappings = (mappings ?? []).filter((m) => selectedPaths.has(m.jsonPath));
    const existingPairs = new Set(
      activeMappings.map((m) => `${m.jsonPath}::${m.key}`),
    );
    const seenKeys = new Set(activeMappings.map((m) => m.key));
    for (const path of selectedPaths) {
      const key = pathKeys[path] || path.replace(/\./g, "_");
      if (existingPairs.has(`${path}::${key}`)) continue; // already exists, skip check
      if (seenKeys.has(key)) {
        return `Duplicate mapping key: "${key}"`;
      }
      seenKeys.add(key);
    }
    return null;
  }

  async function handleSave() {
    if (!name.trim() || !key.trim() || !url.trim()) return;
    if (!validateKey(key)) return;

    // Check key uniqueness before write
    const keyAvailable = await isSourceKeyAvailable(
      sessionId,
      key.trim(),
      editing ? source!.id : undefined,
    );
    if (!keyAvailable) {
      setKeyError("Key already exists in this session.");
      return;
    }

    // Validate mapping keys for duplicates
    const mappingKeyErr = validateMappingKeys();
    if (mappingKeyErr) {
      setMappingError(mappingKeyErr);
      return;
    }

    const normalizedKey = key.trim();
    const previousKey = source?.key ?? normalizedKey;
    const removedReferences = editing
      ? (mappings ?? [])
          .filter((mapping) => !selectedPaths.has(mapping.jsonPath))
          .map((mapping) => `${previousKey}.${mapping.key}`)
      : [];

    if (removedReferences.length > 0) {
      const dependencies = await findReferenceDependencies(
        sessionId,
        removedReferences,
      );
      const blockedCount =
        dependencies.metrics.length +
        dependencies.rules.length +
        dependencies.charts.length;

      if (blockedCount > 0) {
        setSaveError(
          [
            "Cannot unmap fields that still have dependencies.",
            dependencies.metrics.length > 0
              ? `• Metrics: ${dependencies.metrics.map((item) => item.label).join(", ")}`
              : null,
            dependencies.rules.length > 0
              ? `• Warning rules: ${dependencies.rules.map((item) => item.name).join(", ")}`
              : null,
            dependencies.charts.length > 0
              ? `• Charts: ${dependencies.charts.map((item) => item.name).join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }
    }

    setMappingError(null);
    setSaveError(null);
    setSaving(true);
    try {
      const sourceId = source?.id ?? newId();

      // Upsert source
      const sourceData: Source = {
        id: sourceId,
        sessionId,
        key: normalizedKey,
        name: name.trim(),
        type: "http-poll",
        url: url.trim(),
        queryParams: queryParams.filter((p) => p.key && p.value),
        authConfig:
          authType === "none"
            ? { type: "none" }
            : authType === "bearer"
              ? { type: "bearer", token: authToken }
              : { type: "header", headerName, headerValue },
        enabled,
        createdAt: source?.createdAt ?? nowISO(),
        lastTestFetchJson: fetchResult?.data ?? source?.lastTestFetchJson,
      };

      let renameSummary = {
        metricsUpdated: 0,
        rulesUpdated: 0,
        chartsUpdated: 0,
      };

      await db.transaction(
        "rw",
        db.sources,
        db.fieldMappings,
        db.derivedMetrics,
        db.warningRules,
        db.charts,
        async () => {
          if (editing) {
            await db.sources.put(sourceData);

            // Delete user-removed mappings
            const removedMappingIds = (mappings ?? [])
              .filter((mapping) => !selectedPaths.has(mapping.jsonPath))
              .map((mapping) => mapping.id);
            if (removedMappingIds.length > 0) {
              await db.fieldMappings.bulkDelete(removedMappingIds);
            }

            // Update existing mappings by jsonPath, create only truly new ones
            const mappingsByPath = new Map(
              (mappings ?? []).map((mapping) => [mapping.jsonPath, mapping]),
            );
            const referenceRenames = new Map<string, string>();

            for (const path of selectedPaths) {
              const newKey = pathKeys[path] || path.replace(/\./g, "_");
              const newLabel = pathLabels[path] || path;
              const newDesc = pathDescriptions[path] || undefined;
              const existing = mappingsByPath.get(path);

              if (existing) {
                const oldReference = `${previousKey}.${existing.key}`;
                const newReference = `${normalizedKey}.${newKey}`;
                if (oldReference !== newReference) {
                  referenceRenames.set(oldReference, newReference);
                }

                if (
                  newKey !== existing.key ||
                  newLabel !== existing.label ||
                  newDesc !== existing.description
                ) {
                  await db.fieldMappings.update(existing.id, {
                    key: newKey,
                    label: newLabel,
                    description: newDesc,
                  });
                }
                continue;
              }

              const scalarPath = availablePaths.find((p) => p.path === path);
              if (!scalarPath) continue;
              const mapping: FieldMapping = {
                id: newId(),
                sourceId,
                label: newLabel,
                key: newKey,
                jsonPath: path,
                type: scalarPath.type === "null" ? "string" : scalarPath.type,
                description: newDesc,
              };
              await db.fieldMappings.add(mapping);
            }

            renameSummary = await propagateReferenceRenames(
              sessionId,
              referenceRenames,
            );
          } else {
            await db.sources.add(sourceData);

            for (const path of selectedPaths) {
              const scalarPath = availablePaths.find((p) => p.path === path);
              if (!scalarPath) continue;

              const mapping: FieldMapping = {
                id: newId(),
                sourceId,
                label: pathLabels[path] || path,
                key: pathKeys[path] || path.replace(/\./g, "_"),
                jsonPath: path,
                type: scalarPath.type === "null" ? "string" : scalarPath.type,
                description: pathDescriptions[path] || undefined,
              };
              await db.fieldMappings.add(mapping);
            }
          }
        },
      );

      const renamedCount =
        renameSummary.metricsUpdated +
        renameSummary.rulesUpdated +
        renameSummary.chartsUpdated;
      toast.success(
        editing
          ? renamedCount > 0
            ? `Source updated · migrated ${renamedCount} references`
            : "Source updated"
          : "Source added",
      );
      onSaved();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save source",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Source config */}
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit Source" : "Add Data Source"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="src-name">Name</Label>
              <Input
                id="src-name"
                placeholder="Ad Campaign"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-key">Key</Label>
              <Input
                id="src-key"
                placeholder="ads"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  validateKey(e.target.value);
                }}
              />
              {keyError && (
                <p className="text-xs text-destructive">{keyError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Unique per session. Example: ads, crowdfunding
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="src-url">URL</Label>
            <Input
              id="src-url"
              placeholder="https://api.example.com/data"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          {/* Query params */}
          <div className="space-y-2">
            <Label>Query Parameters</Label>
            {queryParams.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="key"
                  value={p.key}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[i] = { ...next[i], key: e.target.value };
                    setQueryParams(next);
                  }}
                />
                <Input
                  placeholder="value"
                  value={p.value}
                  onChange={(e) => {
                    const next = [...queryParams];
                    next[i] = { ...next[i], value: e.target.value };
                    setQueryParams(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setQueryParams(queryParams.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setQueryParams([...queryParams, { key: "", value: "" }])
              }
            >
              <Plus className="mr-1 size-3" /> Add Param
            </Button>
          </div>

          {/* Auth */}
          <div className="space-y-2">
            <Label>Authentication</Label>
            <div className="flex gap-2">
              {(["none", "bearer", "header"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={authType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAuthType(t)}
                >
                  {t === "none"
                    ? "None"
                    : t === "bearer"
                      ? "Bearer Token"
                      : "Custom Header"}
                </Button>
              ))}
            </div>
            {authType === "bearer" && (
              <Input
                placeholder="Bearer token..."
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            )}
            {authType === "header" && (
              <div className="flex gap-2">
                <Input
                  placeholder="Header name"
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                />
                <Input
                  placeholder="Header value"
                  value={headerValue}
                  onChange={(e) => setHeaderValue(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4"
            />
            <span className="text-sm">Enabled</span>
          </label>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleTestFetch} disabled={fetching || !url.trim()}>
            {fetching ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                {editing ? "Refetch Fields" : "Test Fetch"}
              </>
            )}
          </Button>

          {sampleMayBeStale && (
            <div className="rounded-md border border-yellow-400/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-300">
              Endpoint config changed since this sample was saved. Refetch recommended before adding new mappings.
            </div>
          )}

          {/* Error */}
          {fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : null}

          {(availablePaths.length > 0 || hasSampleResponse) && (
            <div className="space-y-4">
              {hasSampleResponse ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    {fetchResult?.ok
                      ? `Response (${fetchResult.status}, ${fetchResult.durationMs}ms)`
                      : "Saved Sample Response"}
                  </h4>
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(fetchResult?.data ?? source?.lastTestFetchJson, null, 2)}
                  </pre>
                </div>
              ) : null}

              {availablePaths.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-sm font-medium">
                    Map fields ({availablePaths.length} available)
                  </h4>
                  <div className="max-h-120 space-y-1 overflow-auto rounded-md border p-2">
                    {availablePaths.map((p) => {
                      const isSelected = selectedPaths.has(p.path);
                      return (
                        <div
                          key={p.path}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm transition-colors",
                            isSelected && "border-primary/30 bg-accent/30",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePath(p.path)}
                              className="size-4 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-xs">
                                {p.path}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {String(p.value)}{" "}
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-[10px]"
                                >
                                  {p.type}
                                </Badge>
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="mt-2 space-y-1.5 border-t border-border/30 pt-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">
                                    Label
                                  </Label>
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder="Spend"
                                    value={pathLabels[p.path] ?? ""}
                                    onChange={(e) =>
                                      setPathLabels({
                                        ...pathLabels,
                                        [p.path]: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">
                                    Key
                                  </Label>
                                  <Input
                                    className="h-7 text-xs"
                                    placeholder="spend"
                                    value={pathKeys[p.path] ?? ""}
                                    onChange={(e) =>
                                      setPathKeys({
                                        ...pathKeys,
                                        [p.path]: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-[11px] text-muted-foreground">
                                  Description{" "}
                                  <span className="font-normal">(optional)</span>
                                </Label>
                                <Input
                                  className="h-7 text-xs"
                                  placeholder="e.g., Total ad spend across all campaigns"
                                  value={pathDescriptions[p.path] ?? ""}
                                  onChange={(e) =>
                                    setPathDescriptions({
                                      ...pathDescriptions,
                                      [p.path]: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No scalar fields found. The response may contain only arrays or
                  empty objects.
                </p>
              )}
            </div>
          )}

          {!fetchResult && !source?.lastTestFetchJson && availablePaths.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Run test fetch once to capture a sample response, then map fields here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {mappingError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {mappingError}
          </div>
        )}
        {saveError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-line">
            {saveError}
          </div>
        )}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !!mappingError || (!editing ? false : !isDirty)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : editing ? (
              "Update Source"
            ) : (
              "Save Source"
            )}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
