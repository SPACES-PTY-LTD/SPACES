"use client"

import "@xyflow/react/dist/style.css"

import * as React from "react"
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleHelp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Workflow,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getMerchantLocationAutomation,
  updateMerchantLocationAutomation,
} from "@/lib/api/location-automation"
import { listLocationTypes } from "@/lib/api/location-types"
import type {
  LocationAutomationAction,
  LocationAutomationActionType,
  LocationAutomationCondition,
  LocationAutomationConditionField,
  LocationAutomationConditionOperator,
  LocationAutomationEvent,
  LocationAutomationRule,
  LocationType,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const ACTION_OPTIONS: Array<{
  value: LocationAutomationActionType
  label: string
  description: string
}> = [
  { value: "record_vehicle_entry", label: "Record vehicle entry", description: "Keeps the standard geofence entry visit record. The entry activity is already written before automation runs, so this step is mainly explicit documentation inside the configured flow." },
  { value: "record_vehicle_exit", label: "Record vehicle exit", description: "Keeps the standard geofence exit visit record. The exit activity is already written before automation runs, so this step mainly makes the configured flow explicit." },
  { value: "start_run", label: "End run & start new run", description: "Starts a new run from the current collection point. If an active run already exists with shipments, it is completed first at this location; if it has no shipments, the active run is kept open and reused." },
  { value: "create_shipment", label: "Create shipment", description: "Creates one auto shipment per run and dropoff location, links it to the active run, sets collection time to at least one second after run start, and records both shipment collection and shipment delivery stage activities." },
]

const CONDITION_FIELD_OPTIONS: Array<{
  value: LocationAutomationConditionField
  label: string
  operators: LocationAutomationConditionOperator[]
  values: string[]
}> = [
  { value: "has_active_run", label: "Has active run", operators: ["equals"], values: ["true", "false"] },
  { value: "run_status", label: "Run status", operators: ["equals", "not_equals"], values: ["draft", "dispatched", "in_progress", "completed", "cancelled"] },
  { value: "shipment_exists_for_location", label: "Shipment exists for location", operators: ["equals"], values: ["true", "false"] },
  { value: "shipment_status", label: "Shipment status", operators: ["equals", "not_equals"], values: ["draft", "ready", "in_transit", "delivered", "exception", "cancelled"] },
  { value: "location_matches_run_origin", label: "Location matches run origin", operators: ["equals"], values: ["true", "false"] },
  { value: "location_matches_run_destination", label: "Location matches run destination", operators: ["equals"], values: ["true", "false"] },
]

const FLOW_NODE_TYPE = "automationAction"
const FLOW_TYPE_NODE = "automationType"
const FLOW_EVENT_NODE = "automationEvent"
const NODE_GAP = 28
const TYPE_ROW_Y = 24
const EVENT_ROW_Y = 170
const ACTION_ROW_Y = 300
const TYPE_GROUP_WIDTH = 760
const ACTION_NODE_HEIGHT = 150

type FlowNodeData = {
  variant: "type" | "event" | "action"
  title: string
  description: string
  actionType?: LocationAutomationActionType
  subtitle?: string
  stepLabel?: string
  conditionCount: number
  accentColor: string
  laneKey?: string
  onAdd?: (() => void) | undefined
  onRemove?: (() => void) | undefined
  onChangeActionType?: ((value: LocationAutomationActionType) => void) | undefined
}

function ActionFlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  const stopNodeGesture = (
    event:
      | React.MouseEvent<HTMLElement>
      | React.PointerEvent<HTMLElement>
      | React.TouchEvent<HTMLElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleAddClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    stopNodeGesture(event)
    data.onAdd?.()
  }

  const handleRemoveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    stopNodeGesture(event)
    data.onRemove?.()
  }

  const infoTrigger = data.description ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="nodrag nopan nowheel inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Show action description"
          draggable={false}
          onMouseDown={stopNodeGesture}
          onPointerDown={stopNodeGesture}
          onTouchStart={stopNodeGesture}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-xs text-left leading-relaxed">
        {data.description}
      </TooltipContent>
    </Tooltip>
  ) : null

  if (data.variant === "type") {
    return (
      <div className="w-[240px] rounded-3xl border border-border/70 bg-background/95 p-5 py-2 shadow-sm">
        <div className="mt-1 text-base font-semibold leading-tight text-center">{data.title}</div>
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{data.description}</div>
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-background" style={{ background: data.accentColor }} />
      </div>
    )
  }

  if (data.variant === "event") {
    return (
      <div className="w-[180px] rounded-2xl border border-border/70 bg-background/95 p-4 py-2 shadow-sm">
        <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-background" style={{ background: data.accentColor }} />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="mt-1 text-sm font-semibold leading-tight">{data.title}</div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="nodrag nopan nowheel h-8 w-8 shrink-0 z-10"
            draggable={false}
            onMouseDown={stopNodeGesture}
            onPointerDown={stopNodeGesture}
            onTouchStart={stopNodeGesture}
            onClick={handleAddClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-background" style={{ background: data.accentColor }} />
      </div>
    )
  }

  if (data.variant === "action") {
    return (
      <div
        className={cn(
          "w-[260px] rounded-2xl border bg-background/95 p-4 shadow-sm transition-all flex flex-col",
          selected ? "border-primary ring-2 ring-primary/20" : "border-border/70"
        )}
      >
        <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-background" style={{ background: data.accentColor }} />
        <div className="">
          <div className="space-y-1">
            <div className="flex-1 flex flex-row justify-between items-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {data.stepLabel}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="nodrag nopan nowheel h-7 w-7"
                  draggable={false}
                  onMouseDown={stopNodeGesture}
                  onPointerDown={stopNodeGesture}
                  onTouchStart={stopNodeGesture}
                  onClick={handleRemoveClick}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <GripVertical className="mt-0.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  value={data.actionType}
                  onValueChange={(value) => data.onChangeActionType?.(value as LocationAutomationActionType)}
                >
                  <SelectTrigger
                    className="nodrag nopan nowheel h-9 w-full"
                    onMouseDown={stopNodeGesture}
                    onPointerDown={stopNodeGesture}
                    onTouchStart={stopNodeGesture}
                  >
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2">{infoTrigger}</div>
            </div>
          </div>
          
        </div>
        <div className="mt-3 flex items-center justify-between">
          
          <Badge variant="outline">
            {data.conditionCount} {data.conditionCount === 1 ? "condition" : "conditions"}
          </Badge>
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-background" style={{ background: data.accentColor }} />
      </div>
    )
  }
}

const nodeTypes = {
  [FLOW_NODE_TYPE]: ActionFlowNode,
  [FLOW_TYPE_NODE]: ActionFlowNode,
  [FLOW_EVENT_NODE]: ActionFlowNode,
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function getActionMeta(action: LocationAutomationActionType) {
  return ACTION_OPTIONS.find((option) => option.value === action) ?? ACTION_OPTIONS[0]
}

function getConditionMeta(field: LocationAutomationConditionField) {
  return CONDITION_FIELD_OPTIONS.find((option) => option.value === field) ?? CONDITION_FIELD_OPTIONS[0]
}

function createDefaultCondition(): LocationAutomationCondition {
  const field = CONDITION_FIELD_OPTIONS[0]

  return {
    id: createId("condition"),
    field: field.value,
    operator: field.operators[0],
    value: field.values[0],
  }
}

function createAction(action?: LocationAutomationActionType): LocationAutomationAction {
  return {
    id: createId("action"),
    action: action ?? ACTION_OPTIONS[0].value,
    conditions: [],
  }
}

function normalizeActions(actions: LocationAutomationAction[], fallbackAction: LocationAutomationActionType) {
  const supported = new Set(ACTION_OPTIONS.map((option) => option.value))

  const normalized = actions
    .filter((action) => supported.has(action.action))
    .map((action) => ({ ...action, conditions: action.conditions ?? [] }))
    .map((action) => ({ ...action, action: action.action as LocationAutomationActionType }))

  return normalized.length > 0 ? normalized : [createAction(fallbackAction)]
}

function createRule(type: LocationType): LocationAutomationRule | null {
  if (!type.location_type_id) {
    return null
  }

  const isCollection = Boolean(type.collection_point)
  const isDelivery = Boolean(type.delivery_point)

  return {
    location_type_id: type.location_type_id,
    location_type_name: type.title,
    location_type_slug: type.slug ?? null,
    location_type_icon: type.icon ?? null,
    location_type_color: type.color ?? null,
    entry: [
      createAction("record_vehicle_entry"),
      ...(isCollection ? [createAction("start_run")] : []),
      ...(isDelivery ? [createAction("create_shipment")] : []),
    ],
    exit: [
      createAction("record_vehicle_exit"),
    ],
  }
}

function buildDefaultRules(types: LocationType[]) {
  return types
    .map((type) => createRule(type))
    .filter((rule): rule is LocationAutomationRule => rule !== null)
}

function normalizeLoadedRules(types: LocationType[], rules: LocationAutomationRule[]) {
  const typeMap = new Map(
    types
      .filter((type): type is LocationType & { location_type_id: string } => Boolean(type.location_type_id))
      .map((type) => [type.location_type_id, type])
  )

  return rules
    .filter((rule) => typeMap.has(rule.location_type_id))
    .map((rule) => {
      const type = typeMap.get(rule.location_type_id)!

      return {
        ...rule,
        location_type_name: type.title,
        location_type_slug: type.slug ?? null,
        location_type_icon: type.icon ?? null,
        location_type_color: type.color ?? null,
        entry: normalizeActions(rule.entry, "record_vehicle_entry"),
        exit: normalizeActions(rule.exit, "record_vehicle_exit"),
      }
    })
}

function mergeRulesWithTypes(types: LocationType[], rules: LocationAutomationRule[]) {
  const normalizedRules = normalizeLoadedRules(types, rules)
  const ruleMap = new Map(normalizedRules.map((rule) => [rule.location_type_id, rule]))

  return types
    .filter((type): type is LocationType & { location_type_id: string } => Boolean(type.location_type_id))
    .map((type) => ruleMap.get(type.location_type_id) ?? createRule(type))
    .filter((rule): rule is LocationAutomationRule => rule !== null)
}

function serializeRules(rules: LocationAutomationRule[]) {
  return JSON.stringify(
    rules.map((rule) => ({
      location_type_id: rule.location_type_id,
      entry: rule.entry.map((action) => ({
        id: action.id,
        action: action.action,
        conditions: action.conditions.map((condition) => ({
          id: condition.id,
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
        })),
      })),
      exit: rule.exit.map((action) => ({
        id: action.id,
        action: action.action,
        conditions: action.conditions.map((condition) => ({
          id: condition.id,
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
        })),
      })),
    }))
  )
}

function describeRule(rule: LocationAutomationRule, event: LocationAutomationEvent) {
  const actions = rule[event]
  if (!actions.length) {
    return `No ${event} actions configured.`
  }

  return actions.map((action, index) => `${index + 1}. ${getActionMeta(action.action).label}`).join("  ")
}

function getEventMeta(event: LocationAutomationEvent) {
  if (event === "entry") {
    return {
      label: "On Entry",
      icon: ArrowDownToLine,
      accent: "border-emerald-500/30 bg-emerald-500/5",
      accentColor: "#10b981",
    }
  }

  return {
    label: "On Exit",
    icon: ArrowUpFromLine,
    accent: "border-sky-500/30 bg-sky-500/5",
    accentColor: "#0ea5e9",
  }
}

function buildCombinedFlow(
  rules: LocationAutomationRule[],
  handlers: {
    onAddAction: (locationTypeId: string, event: LocationAutomationEvent) => void
    onRemoveAction: (locationTypeId: string, event: LocationAutomationEvent, actionId: string) => void
    onChangeActionType: (
      locationTypeId: string,
      event: LocationAutomationEvent,
      actionId: string,
      value: LocationAutomationActionType
    ) => void
  }
) {
  const nodes: Node<FlowNodeData>[] = []
  const edges: Edge[] = []

  rules.forEach((rule, ruleIndex) => {
    const groupX = 40 + ruleIndex * TYPE_GROUP_WIDTH
    const typeNodeId = `type-${rule.location_type_id}`

    nodes.push({
      id: typeNodeId,
      type: FLOW_TYPE_NODE,
      draggable: false,
      selectable: false,
      position: { x: groupX + 250, y: TYPE_ROW_Y },
      data: {
        variant: "type",
        title: rule.location_type_name,
        subtitle: rule.location_type_slug ?? undefined,
        description: "",
        conditionCount: 0,
        accentColor: rule.location_type_color ?? "#64748b",
      },
    })

    ;(["entry", "exit"] as const).forEach((event, eventIndex) => {
      const eventMeta = getEventMeta(event)
      const laneKey = `${rule.location_type_id}:${event}`
      const eventNodeId = `event-${laneKey}`
      const eventX = groupX + (eventIndex === 0 ? 90 : 410)

      nodes.push({
        id: eventNodeId,
        type: FLOW_EVENT_NODE,
        draggable: true,
        selectable: false,
        position: { x: eventX, y: EVENT_ROW_Y },
        data: {
          variant: "event",
          title: eventMeta.label,
          subtitle: rule.location_type_name,
          description: describeRule(rule, event),
          conditionCount: 0,
          accentColor: eventMeta.accentColor,
          laneKey,
          onAdd: () => handlers.onAddAction(rule.location_type_id, event),
        },
      })

      edges.push({
        id: `${typeNodeId}-${eventNodeId}`,
        source: typeNodeId,
        target: eventNodeId,
        type: "smoothstep",
        animated: false,
        style: { stroke: eventMeta.accentColor, strokeWidth: 2 },
      })

      rule[event].forEach((action, index) => {
        const meta = getActionMeta(action.action)

        nodes.push({
          id: action.id,
          type: FLOW_NODE_TYPE,
          position: {
            x: eventX - 20,
            y: ACTION_ROW_Y + index * (ACTION_NODE_HEIGHT + NODE_GAP),
          },
          draggable: true,
          data: {
            variant: "action",
            title: meta.label,
            description: meta.description,
            actionType: action.action,
            stepLabel: `Action ${index + 1}`,
            conditionCount: action.conditions.length,
            accentColor: eventMeta.accentColor,
            laneKey,
            onRemove: () => handlers.onRemoveAction(rule.location_type_id, event, action.id),
            onChangeActionType: (value) =>
              handlers.onChangeActionType(rule.location_type_id, event, action.id, value),
          },
        })
      })

      if (rule[event][0]) {
        edges.push({
          id: `${eventNodeId}-${rule[event][0].id}`,
          source: eventNodeId,
          target: rule[event][0].id,
          type: "smoothstep",
          animated: false,
          style: { stroke: eventMeta.accentColor, strokeWidth: 2 },
        })
      }

      rule[event].slice(1).forEach((action, index) => {
        edges.push({
          id: `${rule[event][index].id}-${action.id}`,
          source: rule[event][index].id,
          target: action.id,
          type: "smoothstep",
          animated: false,
          style: { stroke: eventMeta.accentColor, strokeWidth: 2 },
        })
      })
    })
  })

  return { nodes, edges }
}

function CombinedFlowCanvas({
  rules,
  onAddAction,
  onRemoveAction,
  onChangeActionType,
  onReorder,
}: {
  rules: LocationAutomationRule[]
  onAddAction: (locationTypeId: string, event: LocationAutomationEvent) => void
  onRemoveAction: (locationTypeId: string, event: LocationAutomationEvent, actionId: string) => void
  onChangeActionType: (
    locationTypeId: string,
    event: LocationAutomationEvent,
    actionId: string,
    value: LocationAutomationActionType
  ) => void
  onReorder: (laneOrders: Array<{ locationTypeId: string; event: LocationAutomationEvent; orderedActionIds: string[] }>) => void
}) {
  const graph = React.useMemo(
    () => buildCombinedFlow(rules, { onAddAction, onRemoveAction, onChangeActionType }),
    [onAddAction, onRemoveAction, onChangeActionType, rules]
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  React.useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph.edges, graph.nodes, setEdges, setNodes])

  const handleNodeDragStop = React.useCallback(() => {
    const laneMap = new Map<string, string[]>()

    nodes
      .filter((node) => node.data.variant === "action" && node.data.laneKey)
      .sort((left, right) => {
        if (left.data.laneKey === right.data.laneKey) {
          return left.position.y - right.position.y
        }

        return String(left.data.laneKey).localeCompare(String(right.data.laneKey))
      })
      .forEach((node) => {
        const laneKey = String(node.data.laneKey)
        const current = laneMap.get(laneKey) ?? []
        current.push(node.id)
        laneMap.set(laneKey, current)
      })

    onReorder(
      Array.from(laneMap.entries()).map(([laneKey, orderedActionIds]) => {
        const [locationTypeId, event] = laneKey.split(":")
        return {
          locationTypeId,
          event: event as LocationAutomationEvent,
          orderedActionIds,
        }
      })
    )
  }, [nodes, onReorder])

  if (!rules.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-10 text-sm text-muted-foreground">
        No actions configured yet.
      </div>
    )
  }

  return (
    <div className="h-[820px] overflow-hidden rounded-2xl border border-border/70 bg-background/80">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        fitView
        minZoom={0.35}
        maxZoom={1.2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
      >
        <Background color="#94a3b8" gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  )
}

export function LocationAutomationManager({
  accessToken,
  merchantId,
  enabled,
}: {
  accessToken?: string
  merchantId?: string | null
  enabled: boolean
}) {
  const [loading, setLoading] = React.useState(false)
  const [locationTypes, setLocationTypes] = React.useState<LocationType[]>([])
  const [rules, setRules] = React.useState<LocationAutomationRule[]>([])
  const [rulesReady, setRulesReady] = React.useState(false)
  const [automationEnabled, setAutomationEnabled] = React.useState(enabled)
  const [togglingEnabled, setTogglingEnabled] = React.useState(false)
  const [savingRules, setSavingRules] = React.useState(false)
  const [initialSerialized, setInitialSerialized] = React.useState("[]")

  React.useEffect(() => {
    setAutomationEnabled(enabled)
  }, [enabled])

  const loadLocationTypeRules = React.useCallback(async () => {
    if (!merchantId) {
      setLocationTypes([])
      setRules([])
      setRulesReady(true)
      setInitialSerialized("[]")
      return
    }

    setLoading(true)
    const [locationTypesResponse, locationAutomationResponse] = await Promise.all([
      listLocationTypes(accessToken, { merchant_id: merchantId }),
      getMerchantLocationAutomation(merchantId, accessToken),
    ])

    if (isApiErrorResponse(locationTypesResponse)) {
      toast.error(locationTypesResponse.message || "Failed to load location types.")
      setLoading(false)
      setRulesReady(true)
      return
    }

    if (!locationTypesResponse.success) {
      toast.error("Failed to load location types.")
      setLoading(false)
      setRulesReady(true)
      return
    }

    if (isApiErrorResponse(locationAutomationResponse)) {
      toast.error(locationAutomationResponse.message || "Failed to load location automation.")
      setLoading(false)
      setRulesReady(true)
      return
    }

    const types = (locationTypesResponse.data ?? []).filter((type) => Boolean(type.location_type_id))
    const mergedRules = mergeRulesWithTypes(types, locationAutomationResponse.location_types ?? [])

    setLocationTypes(types)
    setRules(mergedRules)
    setAutomationEnabled(Boolean(locationAutomationResponse.enabled))
    setInitialSerialized(serializeRules(mergedRules))
    setLoading(false)
    setRulesReady(true)
  }, [accessToken, merchantId])

  React.useEffect(() => {
    loadLocationTypeRules()
  }, [loadLocationTypeRules])

  const hasUnsavedChanges = React.useMemo(
    () => serializeRules(rules) !== initialSerialized,
    [initialSerialized, rules]
  )

  const handleEnabledChange = async (checked: boolean) => {
    if (!merchantId) {
      toast.error("Select a merchant before changing automation settings.")
      return
    }

    const previous = automationEnabled
    setAutomationEnabled(checked)
    setTogglingEnabled(true)

    const response = await updateMerchantLocationAutomation(
      merchantId,
      { enabled: checked },
      accessToken
    )

    if (isApiErrorResponse(response)) {
      setAutomationEnabled(previous)
      toast.error(response.message || "Failed to update automation status.")
      setTogglingEnabled(false)
      return
    }

    toast.success(
      checked
        ? "Location automation enabled for this merchant."
        : "Location automation disabled for this merchant."
    )
    setInitialSerialized(serializeRules(rules))
    setTogglingEnabled(false)
  }

  const updateRule = (
    locationTypeId: string,
    event: LocationAutomationEvent,
    updater: (actions: LocationAutomationAction[]) => LocationAutomationAction[]
  ) => {
    setRules((current) =>
      current.map((rule) =>
        rule.location_type_id === locationTypeId
          ? { ...rule, [event]: updater(rule[event]) }
          : rule
      )
    )
  }

  const reorderActions = (
    locationTypeId: string,
    event: LocationAutomationEvent,
    orderedActionIds: string[]
  ) => {
    updateRule(locationTypeId, event, (actions) => {
      const order = new Map(orderedActionIds.map((id, index) => [id, index]))
      return [...actions].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    })
  }

  const reorderMultipleLanes = (
    laneOrders: Array<{ locationTypeId: string; event: LocationAutomationEvent; orderedActionIds: string[] }>
  ) => {
    laneOrders.forEach(({ locationTypeId, event, orderedActionIds }) => {
      reorderActions(locationTypeId, event, orderedActionIds)
    })
  }

  const addAction = (locationTypeId: string, event: LocationAutomationEvent) => {
    updateRule(locationTypeId, event, (actions) => [...actions, createAction()])
  }

  const updateActionType = (
    locationTypeId: string,
    event: LocationAutomationEvent,
    actionId: string,
    nextAction: LocationAutomationActionType
  ) => {
    updateRule(locationTypeId, event, (actions) =>
      actions.map((action) => (action.id === actionId ? { ...action, action: nextAction } : action))
    )
  }

  const removeAction = (locationTypeId: string, event: LocationAutomationEvent, actionId: string) => {
    updateRule(locationTypeId, event, (actions) => actions.filter((action) => action.id !== actionId))
  }

  const addCondition = (locationTypeId: string, event: LocationAutomationEvent, actionId: string) => {
    updateRule(locationTypeId, event, (actions) =>
      actions.map((action) =>
        action.id === actionId
          ? { ...action, conditions: [...action.conditions, createDefaultCondition()] }
          : action
      )
    )
  }

  const updateCondition = (
    locationTypeId: string,
    event: LocationAutomationEvent,
    actionId: string,
    conditionId: string,
    patch: Partial<LocationAutomationCondition>
  ) => {
    updateRule(locationTypeId, event, (actions) =>
      actions.map((action) => {
        if (action.id !== actionId) {
          return action
        }

        return {
          ...action,
          conditions: action.conditions.map((condition) => {
            if (condition.id !== conditionId) {
              return condition
            }

            const nextField = (patch.field ?? condition.field) as LocationAutomationConditionField
            const meta = getConditionMeta(nextField)
            const nextOperator = patch.operator ?? (meta.operators.includes(condition.operator) ? condition.operator : meta.operators[0])
            const nextValue = patch.value ?? (meta.values.includes(condition.value) ? condition.value : meta.values[0])

            return {
              ...condition,
              ...patch,
              field: nextField,
              operator: nextOperator,
              value: nextValue,
            }
          }),
        }
      })
    )
  }

  const removeCondition = (
    locationTypeId: string,
    event: LocationAutomationEvent,
    actionId: string,
    conditionId: string
  ) => {
    updateRule(locationTypeId, event, (actions) =>
      actions.map((action) =>
        action.id === actionId
          ? { ...action, conditions: action.conditions.filter((condition) => condition.id !== conditionId) }
          : action
      )
    )
  }

  const saveRules = async () => {
    if (!merchantId) {
      toast.error("Select a merchant before saving.")
      return
    }

    setSavingRules(true)
    try {
      const response = await updateMerchantLocationAutomation(
        merchantId,
        {
          enabled: automationEnabled,
          location_types: rules.map((rule) => ({
            location_type_id: rule.location_type_id,
            entry: rule.entry.map((action) => ({
              id: action.id,
              action: action.action,
              conditions: action.conditions.map((condition) => ({
                id: condition.id,
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
              })),
            })),
            exit: rule.exit.map((action) => ({
              id: action.id,
              action: action.action,
              conditions: action.conditions.map((condition) => ({
                id: condition.id,
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
              })),
            })),
          })),
        },
        accessToken
      )

      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to save location automation.")
        return
      }

      const mergedRules = mergeRulesWithTypes(locationTypes, response.location_types ?? [])
      setRules(mergedRules)
      setAutomationEnabled(Boolean(response.enabled))
      setInitialSerialized(serializeRules(mergedRules))
      toast.success("Location automation saved.")
    } finally {
      setSavingRules(false)
    }
  }

  const resetDraft = () => {
    const next = buildDefaultRules(locationTypes)
    setRules(next)
    toast.success("Rules reset to defaults generated from location types.")
  }

  const merchantMissing = !merchantId

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <PageHeader
        title="Location Automation"
        actions={
          <>
            <Button variant="outline" onClick={resetDraft} disabled={merchantMissing || loading || !rulesReady}>
              Reset defaults
            </Button>
            <Button onClick={saveRules} disabled={merchantMissing || loading || savingRules || !rulesReady || !hasUnsavedChanges}>
              {savingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden border-border/70 bg-muted">
        <CardContent className="">
          

          <div className="flex flex-col gap-4 p-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">Enable location automation</div>
                <div className="text-sm text-muted-foreground">
                  This uses the existing merchant setting `allow_auto_shipment_creations_at_locations`.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={automationEnabled ? "default" : "outline"}>
                  {automationEnabled ? "Enabled" : "Disabled"}
                </Badge>
                <Switch
                  checked={automationEnabled}
                  onCheckedChange={handleEnabledChange}
                  disabled={merchantMissing || togglingEnabled}
                />
              </div>
            </div>

      

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{locationTypes.length} location types</Badge>
              <Badge variant="outline">{rules.reduce((sum, rule) => sum + rule.entry.length + rule.exit.length, 0)} actions</Badge>
              <Badge variant="outline">{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {merchantMissing ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Select a merchant to configure location automation.
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading location types and automation rules...
          </CardContent>
        </Card>
      ) : null}

      {!merchantMissing && !loading && rulesReady && rules.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No location types found for this merchant. Create location types first, then return here to map entry and exit actions.
          </CardContent>
        </Card>
      ) : null}

      {!merchantMissing && !loading && rules.length > 0 ? (
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="border-b border-border/70 bg-muted/10">
            <CardTitle>Automation Flow Map</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ReactFlowProvider>
              <CombinedFlowCanvas
                rules={rules}
                onAddAction={addAction}
                onRemoveAction={removeAction}
                onChangeActionType={updateActionType}
                onReorder={reorderMultipleLanes}
              />
            </ReactFlowProvider>
          </CardContent>
        </Card>
      ) : null}

      {!merchantMissing && !loading && rules.map((rule) => (
        <Card key={rule.location_type_id} className="overflow-hidden border-border/70 p-0!">
          <CardHeader className="border-b border-border/70 bg-muted/10 p-3! pb-1! mb-0!">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full border border-border/60"
                    style={{ backgroundColor: rule.location_type_color ?? "#64748b" }}
                  />
                  <CardTitle>{rule.location_type_name}</CardTitle>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {locationTypes.find((type) => type.location_type_id === rule.location_type_id)?.collection_point ? <Badge>Collection</Badge> : null}
                {locationTypes.find((type) => type.location_type_id === rule.location_type_id)?.delivery_point ? <Badge variant="secondary">Delivery</Badge> : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
            {(["entry", "exit"] as const).map((event) => {
              const eventMeta = getEventMeta(event)
              const EventIcon = eventMeta.icon

              return (
                <div key={event} className={cn("rounded-2xl border p-4", eventMeta.accent)}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <EventIcon className="h-4 w-4" />
                        {eventMeta.label}
                      </div>
                    </div>

                    <Button size="sm" variant="outline" onClick={() => addAction(rule.location_type_id, event)}>
                      <Plus className="h-4 w-4" />
                      Add action
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {rule[event].map((action, index) => {
                      const actionMeta = getActionMeta(action.action)

                      return (
                        <div key={action.id} className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Step {index + 1}
                              </div>
                              <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                <Select
                                  value={action.action}
                                  onValueChange={(value) =>
                                    updateActionType(rule.location_type_id, event, action.id, value as LocationAutomationActionType)
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select an action" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTION_OPTIONS.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAction(rule.location_type_id, event, action.id)}
                                  aria-label="Remove action"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Action details</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                      aria-label={`Show description for ${actionMeta.label}`}
                                    >
                                      <CircleHelp className="h-4 w-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={8} className="max-w-sm text-left leading-relaxed">
                                    {actionMeta.description}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>

                          <Separator className="my-4" />

                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">Conditions</div>
                              </div>

                              <Button size="sm" variant="outline" onClick={() => addCondition(rule.location_type_id, event, action.id)}>
                                <Plus className="h-4 w-4" />
                                Add condition
                              </Button>
                            </div>

                            {action.conditions.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                This action runs without conditions.
                              </div>
                            ) : null}

                            {action.conditions.map((condition) => {
                              const conditionMeta = getConditionMeta(condition.field)

                              return (
                                <div
                                  key={condition.id}
                                  className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_auto]"
                                >
                                  <div className="space-y-2">
                                    <Label>Field</Label>
                                    <Select
                                      value={condition.field}
                                      onValueChange={(value) =>
                                        updateCondition(rule.location_type_id, event, action.id, condition.id, {
                                          field: value as LocationAutomationConditionField,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CONDITION_FIELD_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Operator</Label>
                                    <Select
                                      value={condition.operator}
                                      onValueChange={(value) =>
                                        updateCondition(rule.location_type_id, event, action.id, condition.id, {
                                          operator: value as LocationAutomationConditionOperator,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {conditionMeta.operators.map((operator) => (
                                          <SelectItem key={operator} value={operator}>
                                            {operator === "equals" ? "Equals" : "Does not equal"}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Value</Label>
                                    {conditionMeta.values.length > 0 ? (
                                      <Select
                                        value={condition.value}
                                        onValueChange={(value) =>
                                          updateCondition(rule.location_type_id, event, action.id, condition.id, { value })
                                        }
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {conditionMeta.values.map((value) => (
                                            <SelectItem key={value} value={value}>
                                              {value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        value={condition.value}
                                        onChange={(entry) =>
                                          updateCondition(rule.location_type_id, event, action.id, condition.id, {
                                            value: entry.target.value,
                                          })
                                        }
                                      />
                                    )}
                                  </div>

                                  <div className="flex items-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeCondition(rule.location_type_id, event, action.id, condition.id)}
                                      aria-label="Remove condition"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
      </div>
    </TooltipProvider>
  )
}
