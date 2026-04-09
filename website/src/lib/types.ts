export type Role = "super_admin" | "user"
export type UUID = string
export type MerchantAccessRole =
  | "account_holder"
  | "member"
  | "modifier"
  | "biller"
  | "resource_viewer"

export type Status =
  | "active"
  | "inactive"
  | "pending"
  | "paused"
  | "failed"
  | "archived"
  | "pending"
  | "revoked"
  | "expired"

export type ShipmentStatus =
  | "draft"
  | "ready"
  | "in_transit"
  | "delivered"
  | "exception"
  | "cancelled"

export type BookingStatus =
  | "booked"
  | "in_transit"
  | "delivered"
  | "failed"
  | "pending"
  | "assigned"
  | "en_route"
  | "picked_up"
  | "completed"
  | "cancelled"

export interface User {
  user_id: UUID
  name: string
  email: string
  role: Role
  status: Status
  telephone?: string | null
  profile_photo_url?: string | null
  is_account_holder?: boolean
  account_country_code?: string | null
  last_login_at?: string | null
  last_accessed_merchant_id?: UUID | null
}

export interface Merchant {
  merchant_id: UUID
  name: string
  status: Status
  primaryEmail: string
  memberCount: number
  environmentCount: number
  createdAt: string
  logo_url?: string | null
  timezone?: string | null
  operating_countries?: string[] | null
  allow_auto_shipment_creations_at_locations?: boolean
  auto_create_shipment_on_dropoff?: boolean
  setup_completed?: boolean
  setup_completed_at?: string | null
  onboarding_completed?: boolean
  onboarding_completed_at?: string | null
  plan?: PricingPlan | null
  access?: {
    role: MerchantAccessRole | null
    permissions: {
      can_manage_users: boolean
      can_manage_merchant: boolean
      can_delete_merchant: boolean
      can_view_resources: boolean
      can_create_update_resources: boolean
      can_delete_resources: boolean
      can_access_billing: boolean
    }
  }
}

export interface MerchantMember {
  user_id: UUID
  name: string
  email: string
  role: MerchantAccessRole
  status: Status
}

export interface MerchantInvite {
  invite_id: UUID
  email: string
  role: MerchantAccessRole
  status: Status
  createdAt: string
}

export interface MerchantPerson {
  person_id: UUID
  kind: "member" | "invite"
  status: Status | string
  email: string
  name: string | null
  telephone?: string | null
  role: MerchantAccessRole
  merchant_id: UUID | null
  invited_by: {
    user_id: UUID
    name: string
    email: string
  } | null
  created_at: string | null
  expires_at: string | null
  accepted_at: string | null
  can_resend: boolean
  can_edit: boolean
  can_edit_role?: boolean
  can_edit_profile?: boolean
  can_delete: boolean
  memberships?: Array<{
    merchant_id: UUID
    name: string
    role: MerchantAccessRole | null
  }>
}

export interface MerchantEnvironment {
  environment_id: UUID
  name: string
  url: string
  mode: "live" | "test"
  color?: string
  token: string
  status: Status
  createdAt: string
}

export interface Quote {
  quote_id: UUID
  merchant_order_ref?: string
  merchant_id?: UUID
  environment_id?: UUID | null
  shipment_id: UUID
  status?: Status | string
  requested_at?: string
  expires_at?: string
  options?: QuoteOption[]
  selected_option?: QuoteOption
  carrier?: string
  serviceLevel?: string
  price?: number
  currency?: string
  etaDays?: number
  createdAt?: string
}

export interface QuoteOption {
  quote_option_id: UUID
  carrier_code: string
  service_code: string
  currency: string
  amount: string
  tax_amount: string
  total_amount: string
  eta_from: string
  eta_to: string
  rules?: {
    max_weight_kg?: number
    [key: string]: unknown
  }
}

export interface Shipment {
  shipment_id: UUID
  merchant_id?: UUID
  merchant?: {
    merchant_id?: UUID
    name?: string
  } | null
  environment_id?: UUID | null
  merchant_order_ref?: string
  delivery_note_number?: string | null
  invoice_invoice_number?: string | null
  invoice_number?: string | null
  invoiced_at?: string | null
  collection_date?: string
  status: ShipmentStatus | string
  pickup_location?: Location
  dropoff_location?: Location
  pickup_address?: Location
  dropoff_address?: Location
  pickup_instructions?: string | null
  dropoff_instructions?: string | null
  ready_at?: string | null
  service_type?: string | null
  priority?: string | null
  auto_assign?: boolean
  auto_created?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
  run_id?: UUID | null
  run_status?: string | null
  run_sequence?: number | null
  run_shipment_status?: string | null
  driver?: {
    driver_id: UUID
    name: string
    email?: string | null
    telephone?: string | null
  } | null
  vehicle?: {
    vehicle_id?: UUID
    plate_number?: string | null
    ref_code?: string | null
    make?: string | null
    model?: string | null
  } | null
  parcels?: ShipmentParcel[]
  stops?: ShipmentStop[]
  files?: EntityFile[]
  created_at?: string
}

export interface ShipmentParcel {
  parcel_id?: UUID
  parcel_code?: string | null
  weight_kg?: string | number | null
  weight?: string | number | null
  weight_measurement?: string | null
  type?: string | null
  length_cm?: string | number | null
  width_cm?: string | number | null
  height_cm?: string | number | null
  declared_value?: string | number | null
  contents_description?: string | null
}

export interface ShipmentStop {
  activity_id?: UUID
  merchant?: {
    merchant_id?: UUID
    name?: string
    status?: Status | string
  } | null
  vehicle?: {
    vehicle_id?: UUID
    plate_number?: string | null
    ref_code?: string | null
    make?: string | null
    model?: string | null
    is_active?: boolean
    last_driver_id?: UUID | null
    driver_logged_at?: string | null
    last_driver?: {
      driver_id?: UUID
      name?: string | null
      email?: string | null
      telephone?: string | null
      intergration_id?: string | null
      is_active?: boolean
    } | null
  } | null
  location?: {
    location_id?: UUID | null
    name?: string | null
    company?: string | null
    code?: string | null
    type?: {
      title?: string | null
      slug?: string | null
      icon?: string | null
    } | null
    full_address?: string | null
    latitude?: number | null
    longitude?: number | null
    city?: string | null
    province?: string | null
    country?: string | null
  } | null
  run_id?: UUID | null
  driver?: {
    driver_id?: UUID
    name?: string | null
    email?: string | null
    telephone?: string | null
    intergration_id?: string | null
    is_active?: boolean
  } | null
  shipment?: {
    shipment_id?: UUID
    merchant_order_ref?: string | null
    status?: string | null
    auto_created?: boolean
  } | null
  event_type?: string | null
  occurred_at?: string | null
  entered_at?: string | null
  exited_at?: string | null
  latitude?: number | null
  longitude?: number | null
  speed_kph?: number | null
  speed_limit_kph?: number | null
  exit_reason?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export type ShipmentParcelInput = {
  title: string
  weight_kg: number
  length_cm: number
  width_cm: number
  height_cm: number
}

export type CreateShipmentParcelPayload = {
  weight: number
  weight_measurement: "kg"
  length_cm: number
  width_cm: number
  height_cm: number
  contents_description?: string
}

export type CreateShipmentPayload = {
  merchant_id: UUID
  merchant_order_ref: string
  delivery_note_number?: string
  invoice_number?: string
  invoiced_at?: string
  collection_date?: string
  environment_id?: UUID | null
  pickup_address: Partial<Location>
  dropoff_address: Partial<Location>
  parcels: CreateShipmentParcelPayload[]
}

export type CreateQuotePayload = {
  merchant_id: UUID
  merchant_order_ref?: string
  collection_date?: string
  pickup_location: Location
  dropoff_location: Location
  pickup_address?: Location
  dropoff_address?: Location
  parcels: ShipmentParcelInput[]
}

export interface Booking {
  booking_id: UUID
  merchant_id?: UUID
  environment_id?: UUID | null
  shipment_id?: UUID
  shipment?: {
    shipment_id: UUID
    merchant_id?: UUID
    environment_id?: UUID | null
    merchant_order_ref?: string
    status?: string
    pickup_location?: Location
    dropoff_location?: Location
    pickup_address?: Location
    dropoff_address?: Location
    pickup_instructions?: string | null
    dropoff_instructions?: string | null
    ready_at?: string | null
    metadata?: Record<string, unknown> | null
    created_at?: string
  }
  quote_option?: QuoteOption
  status: BookingStatus
  carrier_code?: string
  carrier_job_id?: string | null
  label_url?: string | null
  driver?: {
    driver_id: UUID
    name: string
    email: string
    telephone?: string | null
  } | null
  current_driver_id?: string | null
  booked_at?: string | null
  cancelled_at?: string | null
  cancellation_reason_code?: string | null
  cancellation_reason_note?: string | null
  cancel_reason?: string | null
  pod?: string | null
}

export interface RunShipment {
  shipment_id: UUID
  merchant_order_ref?: string | null
  shipment_status?: string
  run_status?: string
  sequence?: number
  pickup_stop_order?: number
  dropoff_stop_order?: number
  total_parcel_count?: number | null
}

export interface Run {
  run_id: UUID
  merchant_id?: UUID
  environment_id?: UUID | null
  status?: string
  planned_start_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  service_area?: string | null
  notes?: string | null
  origin?: Location | null
  latest_location?: Location | null
  stops?: ShipmentStop[]
  route?: {
    route_id?: UUID
    title?: string | null
    code?: string | null
    stops?: RouteStop[]
  } | null
  auto_created?: boolean
  destination?: Location | null
  driver?: {
    driver_id: UUID
    name: string
  } | null
  vehicle?: {
    vehicle_id: UUID
    plate_number?: string | null
  } | null
  shipment_count?: number
  terminal_count?: number
  shipments?: RunShipment[]
  created_at?: string
  updated_at?: string
}

export interface WebhookSubscription {
  subscription_id: UUID
  merchant_id?: UUID
  url: string
  status: Status
  event_types?: string[]
  events?: string[]
  created_at?: string
  createdAt?: string
}

export interface WebhookDelivery {
  webhook_delivery_id?: UUID
  delivery_id?: UUID
  subscription_id?: UUID
  merchant_id?: UUID
  event_type?: string
  event?: string
  status: Status
  attempts?: number
  last_attempt_at?: string | null
  next_attempt_at?: string | null
  last_response_code?: number | null
  last_response_body?: string | null
  created_at?: string
  createdAt?: string
}

export interface Carrier {
  carrier_id: UUID
  uuid?: UUID
  name: string
  code: string
  status: Status
  type: string
}

export interface VehicleType {
  vehicle_type_id: UUID
  uuid?: UUID
  name: string
  payloadKg: number
  status: Status
}

export interface CancelReason {
  cancel_reason_id: UUID
  code: string
  label?: string
  title?: string
  enabled?: boolean
  status?: Status
  created_at?: string
  updated_at?: string
}

export interface VehicleLocation {
  full_address?: string | null
  address_line_1?: string
  address_line_2?: string | null
  town?: string | null
  city?: string | null
  country?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  province?: string | null
  post_code?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface Vehicle {
  driver_vehicle_id?: UUID
  vehicle_id?: UUID
  vehicle_uuid?: UUID
  merchant_id?: UUID
  type?: VehicleType
  make?: string
  model?: string
  color?: string
  odometer: number | null
  plate_number?: string
  photo_key?: string | null
  vin_number?: string | null
  engine_number?: string | null
  ref_code?: string | null
  last_location_address?: VehicleLocation | null
  location_updated_at?: string | null
  intergration_id?: string | null
  is_active?: boolean
  maintenance_mode_at?: string | null
  maintenance_expected_resolved_at?: string | null
  maintenance_description?: string | null
  tags?: Tag[]
  status?: Status
  files?: EntityFile[]
  created_at?: string
  updated_at?: string
}

export type DriverVehicle = Vehicle


export interface Location {
  location_id: UUID
  merchant_id?: UUID
  environment_id?: UUID | null
  location_type_id?: UUID | null
  type?: LocationType | null
  is_loading_location?: boolean
  name?: string
  code?: string
  company?: string
  address_line_1?: string
  address_line_2?: string | null
  town?: string | null
  city?: string | null
  country?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  email?: string | null
  province?: string | null
  post_code?: string | null
  latitude?: number | null
  longitude?: number | null
  full_address?: string | null
  google_place_id?: string | null
  polygon_bounds?: number[][] | null
  tags?: Tag[]
  status?: Status
  created_at?: string
  updated_at?: string
}

export interface Tag {
  tag_id: UUID
  name: string
  slug: string
}

export interface LocationType {
  location_type_id?: UUID | null
  slug?: string | null
  title: string
  collection_point: boolean
  delivery_point: boolean
  sequence: number
  icon?: string | null
  color?: string | null
  default: boolean
  merchant_id?: UUID
  account_id?: UUID
  created_at?: string | null
  updated_at?: string | null
}

export type LocationAutomationEvent = "entry" | "exit"

export type LocationAutomationActionType =
  | "record_vehicle_entry"
  | "record_vehicle_exit"
  | "start_run"
  | "create_shipment"

export type LocationAutomationConditionField =
  | "has_active_run"
  | "run_status"
  | "shipment_exists_for_location"
  | "shipment_status"
  | "location_matches_run_origin"
  | "location_matches_run_destination"

export type LocationAutomationConditionOperator =
  | "equals"
  | "not_equals"

export interface LocationAutomationCondition {
  id: string
  field: LocationAutomationConditionField
  operator: LocationAutomationConditionOperator
  value: string
}

export interface LocationAutomationAction {
  id: string
  action: LocationAutomationActionType
  conditions: LocationAutomationCondition[]
}

export interface LocationAutomationRule {
  location_type_id: UUID
  location_type_name: string
  location_type_slug?: string | null
  location_type_icon?: string | null
  location_type_color?: string | null
  entry: LocationAutomationAction[]
  exit: LocationAutomationAction[]
}

export interface LocationAutomationSettingsDraft {
  enabled: boolean
  location_types: LocationAutomationRule[]
}

export type TrackingProviderFormField = {
  field_id?: UUID
  name: string
  label?: string
  type?: string
  required?: boolean
  placeholder?: string | null
  options?: Array<{ label: string; value: string }>
  order?: number
}

export interface TrackingProvider {
  provider_id: UUID
  name: string
  slug?: string
  image_url?: string | null
  logo_url?: string | null
  logo_file_name?: string | null
  status?: Status
  is_active?: boolean
  activated?: boolean
  active?: boolean
  has_driver_importing?: boolean
  has_locations_importing?: boolean
  has_vehicle_importing?: boolean
  default_tracking?: boolean
  has_location_services?: boolean
  form_fields?: TrackingProviderFormField[]
  integration_data?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export interface MixDecodedToken {
  decodable: boolean
  format: string
  header?: Record<string, unknown> | null
  payload?: Record<string, unknown> | null
  claims?: Record<string, unknown> | null
  issued_at?: string | null
  expires_at?: string | null
  expires_in_seconds?: number | null
  decode_error?: string | null
}

export interface MixTokenTiming {
  issued_at?: string | null
  expires_at?: string | null
  expires_in_seconds?: number | null
  seconds_until_expiry?: number | null
  is_expired?: boolean | null
}

export interface MixTokenAnalysis {
  provider_id: UUID
  merchant_id: UUID
  credential_source: string
  auth_mode?: string | null
  raw_response: Record<string, unknown> | null
  access_token: string | null
  refresh_token: string | null
  token_type?: string | null
  expires_in?: number | null
  scope?: string | null
  access_token_masked?: string | null
  refresh_token_masked?: string | null
  access_token_decoded: MixDecodedToken
  refresh_token_decoded: MixDecodedToken
  timing: MixTokenTiming
  summary: string
}

export interface TrackingProviderVehiclePreview {
  provider_vehicle_id: string
  plate_number?: string | null
  description?: string | null
  make?: string | null
  model?: string | null
}

export interface Driver {
  driver_id: UUID
  uuid?: UUID
  name: string
  email: string
  telephone?: string | null
  carrier?: Carrier
  vehicle_type_id?: UUID
  is_active?: boolean
  notes?: string | null
  created_at?: string
  updated_at?: string
  status?: Status
  vehicles: DriverVehicle[]
  files?: EntityFile[]
}

export interface FileType {
  file_type_id: UUID
  merchant_id?: UUID
  entity_type: "shipment" | "driver" | "vehicle"
  name: string
  slug?: string
  description?: string | null
  requires_expiry?: boolean
  driver_can_upload?: boolean
  is_active?: boolean
  sort_order?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface EntityFile {
  file_id: UUID
  merchant_id?: UUID
  entity_type?: "shipment" | "driver" | "vehicle"
  entity_id?: UUID
  entity_label?: string | null
  file_type?: FileType | null
  original_name?: string | null
  mime_type?: string | null
  size_bytes?: number
  expires_at?: string | null
  is_expired?: boolean
  uploaded_by_role?: string | null
  uploaded_by_user?: {
    user_id?: UUID
    name?: string | null
    email?: string | null
    role?: string | null
  } | null
  download_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface ActivityLog {
  activity_id: UUID
  account_id?: UUID
  merchant_id?: UUID
  environment_id?: UUID | null
  actor_user_id?: UUID | null
  actor_name?: string | null
  action: string
  entity_type: string
  entity_id?: UUID | null
  title: string
  changes?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  request_id?: UUID | null
  ip_address?: string | null
  occurred_at?: string | null
  created_at?: string | null
}

export interface RouteStopLocation {
  location_id: UUID
  name?: string | null
  company?: string | null
  code?: string | null
  type?: string | null
  full_address?: string | null
  latitude?: number | null
  longitude?: number | null
  city?: string | null
  province?: string | null
  country?: string | null
}

export interface RouteStop {
  stop_id?: UUID
  sequence: number
  location_id?: UUID
  location?: RouteStopLocation | null
}

export interface Route {
  route_id: UUID
  merchant_id?: UUID
  environment_id?: UUID | null
  title: string
  code?: string | null
  description?: string | null
  estimated_distance?: number | null
  estimated_duration?: number | null
  estimated_collection_time?: number | null
  estimated_delivery_time?: number | null
  auto_created?: boolean
  stops?: RouteStop[]
  created_at?: string | null
  updated_at?: string | null
}

export interface RouteStatsAverages {
  avg_total_distance_km: number | null
  avg_return_distance_km: number | null
  avg_return_duration_min: number | null
  avg_idle_ratio_pct: number | null
}

export interface RouteStatsTimelineItem {
  segment: string
  distance_km: number
  duration_min: number
  idle_min: number
}

export interface RouteStats {
  route_id: UUID
  generated_at: string
  currency: string
  units: {
    distance: string
    duration: string
    speed: string
    percent: string
  }
  definitions?: {
    moving_speed_threshold_kmh?: number
    return_arrival_radius_km?: number
  }
  window?: {
    from?: string | null
    to?: string | null
    latest_run_id?: UUID | null
  }
  data_quality?: {
    telemetry_coverage_pct?: number
    gps_points_count?: number
    has_return_leg_confidence?: boolean
  }
  summary: {
    planned_distance_km: number | null
    actual_distance_km: number | null
    distance_variance_km: number | null
    distance_variance_pct: number | null
    total_route_duration_min: number
    driving_time_min: number
    idle_time_min: number
    stop_time_min: number
    utilization_pct: number
    idle_ratio_pct: number
    avg_moving_speed_kmh: number
    on_time_stops: number
    late_stops: number
    completed_stops: number
    planned_stops: number
  }
  return_to_collection: {
    collection_point_id: UUID | null
    collection_point_name: string | null
    returned_to_collection: boolean
    return_leg_distance_km: number
    return_leg_duration_min: number
    return_leg_avg_speed_kmh: number
    return_leg_idle_min: number
  }
  averages: {
    driver_last_10_routes: RouteStatsAverages
    same_route_last_30_days: RouteStatsAverages
    fleet_last_30_days: RouteStatsAverages
  }
  deltas: {
    vs_driver_avg_return_distance_km: number | null
    vs_route_avg_return_distance_km: number | null
    vs_fleet_avg_return_distance_km: number | null
    vs_driver_avg_idle_ratio_pct: number | null
  }
  time_breakdown: {
    driving_pct: number
    idle_pct: number
    stopped_pct: number
  }
  timeline: RouteStatsTimelineItem[]
}

export type VehicleActivityEventType =
  | "speeding"
  | "stopped"
  | "moving"
  | "entered_location"
  | "exited_location"
  | string

export interface VehicleActivity {
  activity_id?: UUID
  merchant_id?: UUID
  merchant?: {
    merchant_id?: UUID
    name?: string
    status?: Status | string
  } | null
  vehicle_id?: UUID | null
  vehicle?: {
    vehicle_id?: UUID
    plate_number?: string | null
    ref_code?: string | null
    make?: string | null
    model?: string | null
    is_active?: boolean
    driver_logged_at?: string | null
    last_driver?: {
      driver_id?: UUID
      name?: string | null
      email?: string | null
      telephone?: string | null
      intergration_id?: string | null
      is_active?: boolean
    } | null
  } | null
  location_id?: UUID | null
  location?: {
    location_id?: UUID
    name?: string | null
    company?: string | null
    code?: string | null
    type?: {
      icon?: string | null
      slug?: string | null
      title?: string | null
    } | null
    full_address?: string | null
    city?: string | null
    province?: string | null
    country?: string | null
    is_loading_location?: boolean
  } | null
  run_id?: UUID | null
  driver?: {
    driver_id?: UUID
    name?: string | null
    email?: string | null
    telephone?: string | null
    intergration_id?: string | null
    is_active?: boolean
  } | null
  shipment?: {
    shipment_id?: UUID
    merchant_order_ref?: string | null
    status?: string | null
    auto_created?: boolean
  } | null
  event_type?: VehicleActivityEventType
  occurred_at?: string | null
  entered_at?: string | null
  exited_at?: string | null
  latitude?: number | null
  longitude?: number | null
  speed_kph?: number | null
  speed_limit_kph?: number | null
  exit_reason?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export type CreateDriverPayload = {
  name: string
  email: string
  password: string
  telephone: string
  carrier_id?: UUID
  vehicle_type_id?: UUID
}

export interface LoginResponse {
  token: string
  refresh_token: string
  expires_in?: number
  user: User
}

export interface AcceptMerchantInviteResponse {
  token: string | null
  user: {
    email: string
    name: string
    created: boolean
  }
  merchant: Merchant
  membership_role: MerchantAccessRole
}

export interface MerchantInvitePreview {
  email: string
  recipient_name: string | null
  merchant_name: string | null
  role: MerchantAccessRole
  expires_at: string | null
  invited_by: {
    name: string
    email: string
  } | null
}

export interface ApiListResponse<T> {
  data: T[]
  meta?: {
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
    page?: number
    perPage?: number
  }
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: unknown
  error?: unknown
}

export interface PaymentGateway {
  payment_gateway_id: UUID
  code: string
  name: string
  type: string
  is_active: boolean
  sort_order: number
  supports_card_retrieval: boolean
  supports_hosted_card_capture: boolean
}

export interface CountryPricing {
  country_pricing_id: UUID
  country_name: string
  country_code: string
  currency: string
  is_default: boolean
  payment_gateway: PaymentGateway | null
}

export interface PricingPlan {
  plan_id: UUID
  title: string
  vehicle_limit: number
  monthly_charge_zar: number
  monthly_charge_usd: number
  extra_vehicle_price_zar: number
  extra_vehicle_price_usd: number
  is_free: boolean
  trial_days?: number | null
  is_active: boolean
  sort_order: number
}

export interface BillingPaymentMethod {
  payment_method_id: UUID
  gateway_code: string | null
  brand?: string | null
  last_four?: string | null
  expiry_month?: number | null
  expiry_year?: number | null
  funding_type?: string | null
  bank?: string | null
  signature?: string | null
  is_reusable?: boolean
  retrieved_from_gateway?: boolean
  is_default: boolean
  status: string
  verified_at?: string | null
  payment_gateway?: PaymentGateway | null
  gateway_customer_id?: string | null
  gateway_payment_method_id?: string | null
  gateway_reference?: string | null
}

export interface BillingInvoiceLine {
  invoice_line_id?: UUID
  type: string
  description: string
  quantity: number
  unit_amount: number
  subtotal: number
  included_vehicles: number
  billable_vehicles: number
  merchant?: {
    merchant_id?: UUID
    name?: string
  } | null
  plan?: PricingPlan | null
}

export interface BillingPaymentAttempt {
  payment_attempt_id: UUID
  gateway_code?: string | null
  status: string
  amount: number
  provider_transaction_id?: string | null
  provider_reference?: string | null
  failure_reason?: string | null
  processed_at?: string | null
}

export interface BillingInvoice {
  invoice_id: UUID
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  currency: string
  subtotal: number
  total: number
  invoice_status: string
  payment_status: string
  gateway_code?: string | null
  due_date?: string | null
  paid_at?: string | null
  last_payment_attempt_at?: string | null
  failure_reason?: string | null
  lines?: BillingInvoiceLine[]
  payment_attempts?: BillingPaymentAttempt[]
}

export interface BillingInvoicePreview {
  billing_period_start: string
  billing_period_end: string
  currency: string
  subtotal: number
  total: number
  lines: BillingInvoiceLine[]
}

export interface BillingMerchantSummary {
  merchant_id: UUID
  name: string
  plan_id?: UUID | null
  plan_title?: string | null
  vehicle_limit: number
  active_vehicle_count: number
  extra_vehicle_count: number
  monthly_charge: number
  extra_vehicle_price: number
  extra_vehicle_total: number
}

export interface BillingSummary {
  account_id: UUID
  owner: {
    user_id?: UUID | null
    name?: string | null
    email?: string | null
  }
  country_code: string
  is_billing_exempt: boolean
  currency: string
  current_billing_period_start?: string | null
  current_billing_period_end?: string | null
  next_billing_date?: string | null
  can_select_free_plan: boolean
  free_plan_available_until?: string | null
  current_invoice_preview?: BillingInvoicePreview | null
  gateway: {
    code?: string | null
    name?: string | null
  }
  gateway_capabilities: {
    supports_card_retrieval: boolean
    supports_hosted_card_capture: boolean
  }
  billing_profile?: {
    gateway_code?: string | null
    gateway_customer_id?: string | null
    gateway_reference?: string | null
  } | null
  payment_methods: BillingPaymentMethod[]
  merchants: BillingMerchantSummary[]
  invoices: BillingInvoice[]
}

export interface BillingPaymentMethodSetupIntent {
  gateway_code?: string | null
  hosted_capture_supported: boolean
  mode?: string | null
  publishable_key?: string | null
  client_secret?: string | null
  redirect_url?: string | null
  metadata?: Record<string, unknown>
}

export interface BillingPaymentMethodSyncResult {
  gateway_code?: string | null
  supports_card_retrieval: boolean
  supports_hosted_card_capture: boolean
  retrieved_from_gateway: boolean
  cards: Array<{
    gateway_code?: string | null
    gateway_customer_id?: string | null
    gateway_payment_method_id?: string | null
    gateway_reference?: string | null
    brand?: string | null
    last_four?: string | null
    expiry_month?: number | null
    expiry_year?: number | null
    funding_type?: string | null
    bank?: string | null
    signature?: string | null
    is_reusable?: boolean
    status?: string | null
    retrieved_from_gateway?: boolean
  }>
}
