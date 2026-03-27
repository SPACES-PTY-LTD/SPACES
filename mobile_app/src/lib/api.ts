import { getEnvironmentConfig } from '@/src/config/env';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
    request_id?: string;
  } | null;
  meta: {
    request_id?: string;
  };
};

export type AuthUser = {
  user_id: string;
  name: string;
  email: string;
  telephone: string | null;
  role: string;
  last_login_at: string | null;
};

export type AuthPayload = {
  token: string;
  refresh_token: string;
  user: AuthUser;
};

export type SessionState = {
  token: string;
  refreshToken: string;
  user: AuthUser;
};

export type ApiRequestError = Error & {
  code?: string;
  details?: Record<string, string[]>;
  requestId?: string;
  status?: number;
};

type RequestOptions = {
  body?: FormData | Record<string, unknown> | unknown;
  headers?: Record<string, string>;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST';
  token?: string;
};

type ApiMeta = {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  request_id?: string;
  total?: number;
};

export type ApiListResponse<T> = {
  data: T;
  meta: ApiMeta;
};

export type DriverLocation = {
  location_id: string;
  name: string | null;
  code: string | null;
  company: string | null;
  full_address: string | null;
  phone: string | null;
  email: string | null;
};

export type DriverShipment = {
  shipment_id: string;
  merchant: {
    merchant_id: string;
    name: string | null;
  } | null;
  environment_id: string | null;
  merchant_order_ref: string | null;
  delivery_note_number: string | null;
  invoice_number: string | null;
  status: string;
  pickup_location: DriverLocation | null;
  dropoff_location: DriverLocation | null;
  pickup_instructions: string | null;
  dropoff_instructions: string | null;
  ready_at: string | null;
  collection_date: string | null;
  service_type: string | null;
  priority: string | null;
  auto_assign?: boolean;
  auto_created?: boolean;
  notes: string | null;
  run_id?: string | null;
  run_status?: string | null;
  run_sequence?: number | null;
  run_shipment_status?: string | null;
  driver?: {
    driver_id: string;
    name: string | null;
    email: string | null;
    telephone: string | null;
    intergration_id: string | null;
    is_active: boolean;
  } | null;
  vehicle?: {
    vehicle_id: string;
    plate_number: string | null;
    ref_code: string | null;
    make: string | null;
    model: string | null;
    is_active: boolean;
  } | null;
  total_parcel_count?: number;
  scanned_parcel_count?: number;
  all_parcels_scanned?: boolean;
  parcels?: DriverShipmentParcel[];
  stops?: unknown[];
  created_at?: string | null;
  booking: DriverShipmentBooking | null;
  offers?: DeliveryOffer[];
};

export type DriverShipmentPod = {
  pod_id: string;
  file_key: string;
  file_type: string | null;
  signed_by: string | null;
  captured_by_user_id?: string | null;
  created_at: string | null;
} | null;

export type DriverShipmentBooking = {
  booking_id: string;
  status: string;
  carrier_code: string | null;
  carrier_job_id: string | null;
  label_url: string | null;
  current_driver_id?: string | null;
  booked_at: string | null;
  collected_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  cancelled_at: string | null;
  odometer_at_request?: number | null;
  odometer_at_collection?: number | null;
  odometer_at_delivery?: number | null;
  odometer_at_return?: number | null;
  total_km_from_collection?: string | null;
  cancellation_reason_code: string | null;
  cancellation_reason_note: string | null;
  cancel_reason: string | null;
  pod: DriverShipmentPod;
};

export type DriverShipmentParcel = {
  parcel_id: string;
  parcel_code: string | null;
  weight: string | number | null;
  weight_measurement: string | null;
  type: string | null;
  length_cm: string | number | null;
  width_cm: string | number | null;
  height_cm: string | number | null;
  declared_value: string | number | null;
  contents_description: string | null;
  is_picked_up_scanned: boolean;
  picked_up_scanned_at: string | null;
  picked_up_scanned_by_user_id?: string | null;
};

export type DriverShipmentScanResponse = {
  data: DriverShipment;
  meta: {
    request_id?: string;
    scan_status?: 'already_scanned' | 'completed' | 'scanned';
    message?: string;
    scanned_parcel_code?: string;
    scanned_parcel_count?: number;
    total_parcel_count?: number;
    all_parcels_scanned?: boolean;
  };
};

export type DriverShipmentScanMeta = DriverShipmentScanResponse['meta'];

export type DeliveryOfferShipmentSummary = {
  shipment_id: string;
  merchant_order_ref: string | null;
  delivery_note_number: string | null;
  pickup_location: DriverLocation | null;
  dropoff_location: DriverLocation | null;
  requested_vehicle_type_id: string | null;
  status: string;
  ready_at: string | null;
};

export type DeliveryOffer = {
  offer_id: string;
  shipment_id: string | null;
  driver_id: string | null;
  driver_name: string | null;
  status: string;
  sequence: number;
  offered_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  response_reason: string | null;
  shipment?: DeliveryOfferShipmentSummary | null;
};

export type DriverPresence = {
  presence_id: string;
  driver_id: string | null;
  user_device_id: string | null;
  is_online: boolean;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  last_seen_at: string | null;
  last_offered_at: string | null;
  stale_after_at: string | null;
  active_offers: DeliveryOffer[];
};

export type DriverOnlineStatusResponse = {
  user_device_id: string;
  platform: string;
  push_provider: string | null;
  push_token: string | null;
  last_seen_at: string | null;
};

export type CancelReason = {
  cancel_reason_id: string;
  code: string;
  title: string;
  enabled: boolean;
};

export type DriverVehicle = {
  vehicle_id: string;
  driver_id: string | null;
  vehicle_type_id: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  plate_number: string | null;
  vin_number: string | null;
  engine_number: string | null;
  ref_code: string | null;
  odometer: number | null;
  year: number | null;
  last_location_address: string | null;
  location_updated_at: string | null;
  intergration_id: string | null;
  photo_key: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DriverFileType = {
  file_type_id: string;
  merchant_id?: string | null;
  entity_type: 'driver' | 'shipment' | 'vehicle';
  name: string;
  slug?: string | null;
  description?: string | null;
  requires_expiry?: boolean;
  driver_can_upload?: boolean;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DriverEntityFile = {
  file_id: string;
  merchant_id?: string | null;
  entity_type?: 'driver' | 'shipment' | 'vehicle';
  file_type?: DriverFileType | null;
  original_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number;
  expires_at?: string | null;
  is_expired?: boolean;
  uploaded_by_role?: string | null;
  uploaded_by_user?: {
    user_id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  download_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const { apiBaseUrl } = getEnvironmentConfig();

function normalizeAddressValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const orderedParts = [
    record.address_line_1,
    record.address_line_2,
    record.suburb,
    record.city,
    record.state,
    record.postal_code,
    record.country,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  if (orderedParts.length > 0) {
    return orderedParts.join(', ');
  }

  const fallbackParts = Object.values(record)
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return fallbackParts.length > 0 ? fallbackParts.join(', ') : null;
}

function normalizeLocation<T extends DriverLocation | null | undefined>(location: T): T {
  if (!location) {
    return location;
  }

  return {
    ...location,
    full_address: normalizeAddressValue(location.full_address),
  };
}

function normalizeShipment<T extends DriverShipment>(shipment: T): T {
  return {
    ...shipment,
    pickup_location: normalizeLocation(shipment.pickup_location),
    dropoff_location: normalizeLocation(shipment.dropoff_location),
  };
}

function normalizeOffer<T extends DeliveryOffer>(offer: T): T {
  return {
    ...offer,
    shipment: offer.shipment
      ? {
          ...offer.shipment,
          pickup_location: normalizeLocation(offer.shipment.pickup_location),
          dropoff_location: normalizeLocation(offer.shipment.dropoff_location),
        }
      : offer.shipment ?? null,
  };
}

function normalizePresence<T extends DriverPresence>(presence: T): T {
  return {
    ...presence,
    active_offers: (presence.active_offers || []).map((offer) => normalizeOffer(offer)),
  };
}

function normalizeVehicle<T extends DriverVehicle>(vehicle: T): T {
  return {
    ...vehicle,
    last_location_address: normalizeAddressValue(vehicle.last_location_address),
  };
}

function normalizeListResponse<T>(response: ApiListResponse<T>, normalizeItem: (item: T) => T): ApiListResponse<T> {
  return {
    ...response,
    data: normalizeItem(response.data),
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await performRequest<T>(path, options);
  return payload.data;
}

async function requestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<ApiListResponse<T>> {
  const payload = await performRequest<T>(path, options);

  return {
    data: payload.data,
    meta: payload.meta,
  };
}

async function performRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const method = options.method ?? 'GET';
  const url = `${apiBaseUrl}${path}`;
  console.log(`[api] ${method} ${url}`, {
    bodyType: isFormData ? 'form-data' : 'json',
    hasToken: Boolean(options.token),
  });
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    body: options.body ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    console.error(`[api] request failed: ${method} ${url}`, {
      status: response.status,
      error: payload.error,
      meta: payload.meta,
    });
    const error = new Error(payload.error?.message || 'Request failed.') as ApiRequestError;

    error.code = payload.error?.code;
    error.details = payload.error?.details;
    error.requestId = payload.error?.request_id;
    error.status = response.status;

    throw error;
  }

  return payload;
}

export const authApi = {
  apiBaseUrl,
  async login(credentials: { email: string; password: string }) {
    console.log("Attempting login with credentials", credentials, '/auth/login');
    return request<AuthPayload>('/auth/login', {
      body: credentials,
      method: 'POST',
    });
  },
  async refresh(refreshToken: string) {
    return request<AuthPayload>('/auth/refresh', {
      body: { refresh_token: refreshToken },
      method: 'POST',
    });
  },
  async me(token: string) {
    return request<AuthUser>('/me', {
      token,
    });
  },
  async logout(token: string) {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
      token,
    });
  },
};

export const driverApi = {
  async updateProfile(
    token: string,
    payload: {
      name?: string;
      telephone?: string | null;
    },
  ) {
    return request<AuthUser>('/driver/profile', {
      body: payload,
      method: 'PATCH',
      token,
    });
  },
  async registerDevice(
    token: string,
    payload: {
      platform: string;
      push_provider?: string;
      push_token?: string;
      device_name?: string;
      app_version?: string;
    },
  ) {
    return request<{ user_device_id: string; platform: string; push_provider: string | null; push_token: string | null; last_seen_at: string | null }>(
      '/driver/devices/register',
      {
        body: payload,
        method: 'POST',
        token,
      },
    );
  },
  async heartbeat(
    token: string,
    payload: {
      is_online: boolean;
      is_available?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      platform?: string;
      push_provider?: string;
      push_token?: string;
      device_name?: string;
      app_version?: string;
      user_device_id?: string;
    },
  ) {
    const response = await request<DriverPresence>('/driver/presence/heartbeat', {
      body: payload,
      method: 'POST',
      token,
    });

    return normalizePresence(response);
  },
  async updateOnlineStatus(
    token: string,
    isOnline: boolean,
    payload?: {
      is_available?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      platform?: string;
      user_device_id?: string;
    },
  ) {
    const response = await request<DriverOnlineStatusResponse>('/driver/presence/status', {
      body: {
        is_online: isOnline,
        ...(payload ?? {}),
      },
      method: 'POST',
      token,
    });

    console.log('update response', JSON.stringify(response, null, 2));
    return response;
  },
  async listOffers(token: string) {
    const response = await request<DeliveryOffer[]>('/driver/offers', { token });
    return response.map((offer) => normalizeOffer(offer));
  },
  async acceptOffer(token: string, offerId: string) {
    const response = await request<{ offer: DeliveryOffer; shipment: DriverShipment }>(`/driver/offers/${offerId}/accept`, {
      method: 'POST',
      token,
    });

    return {
      ...response,
      offer: normalizeOffer(response.offer),
      shipment: normalizeShipment(response.shipment),
    };
  },
  async declineOffer(token: string, offerId: string, reason?: string) {
    const response = await request<{ next_offer: DeliveryOffer | null }>(`/driver/offers/${offerId}/decline`, {
      body: reason ? { reason } : undefined,
      method: 'POST',
      token,
    });

    return {
      ...response,
      next_offer: response.next_offer ? normalizeOffer(response.next_offer) : null,
    };
  },
  async listShipments(token: string, options: { perPage?: number; status?: string } = {}) {
    const params = new URLSearchParams();
    params.set('per_page', String(options.perPage ?? 20));

    if (options.status) {
      params.set('status', options.status);
    }

    const final_url = `/driver/shipments?${params.toString()}`;
    console.log('Fetching shipments with URL:', final_url);

    const response = await requestWithMeta<DriverShipment[]>(final_url, { token });
    return normalizeListResponse(response, (shipments) => shipments.map((shipment) => normalizeShipment(shipment)) as DriverShipment[]);
  },
  async getShipment(token: string, shipmentId: string) {
    const response = await request<DriverShipment>(`/driver/shipments/${shipmentId}`, { token });
    return normalizeShipment(response);
  },
  async updateShipmentStatus(token: string, shipmentId: string, payload: { status: string; note?: string }) {
    const response = await request<DriverShipment>(`/driver/shipments/${shipmentId}/status`, {
      body: payload,
      method: 'PATCH',
      token,
    });

    return normalizeShipment(response);
  },
  async scanShipment(
    token: string,
    shipmentId: string,
    payload: {
      parcel_code: string;
      event_description?: string;
      occurred_at?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const response = await performRequest<DriverShipment>(`/driver/shipments/${shipmentId}/scan`, {
      body: payload,
      method: 'POST',
      token,
    });

    return {
      data: normalizeShipment(response.data),
      meta: response.meta as DriverShipmentScanResponse['meta'],
    };
  },
  async uploadShipmentPod(
    token: string,
    shipmentId: string,
    payload: {
      file_key: string;
      file_type?: string;
      signed_by?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const response = await request<DriverShipment>(`/driver/shipments/${shipmentId}/pod`, {
      body: payload,
      method: 'POST',
      token,
    });

    return normalizeShipment(response);
  },
  async cancelShipment(
    token: string,
    shipmentId: string,
    payload: {
      reason_code: string;
      reason?: string;
      note?: string;
    },
  ) {
    const response = await request<DriverShipment>(`/driver/shipments/${shipmentId}/cancel`, {
      body: payload,
      method: 'POST',
      token,
    });

    return normalizeShipment(response);
  },
  async listCancelReasons(token: string, perPage = 50) {
    return requestWithMeta<CancelReason[]>(`/cancel-reasons?per_page=${perPage}&enabled=true`, { token });
  },
  async listVehicles(token: string, perPage = 20) {
    const response = await requestWithMeta<DriverVehicle[]>(`/driver/vehicles?per_page=${perPage}`, { token });
    return normalizeListResponse(response, (vehicles) => vehicles.map((vehicle) => normalizeVehicle(vehicle)) as DriverVehicle[]);
  },
  async getVehicle(token: string, vehicleId: string) {
    const response = await request<DriverVehicle>(`/driver/vehicles/${vehicleId}`, { token });
    return normalizeVehicle(response);
  },
  async listFileTypes(token: string, entityType: 'driver' | 'shipment' | 'vehicle' = 'driver') {
    return requestWithMeta<DriverFileType[]>(`/driver/files/types?entity_type=${entityType}`, { token });
  },
  async listFiles(token: string) {
    return requestWithMeta<DriverEntityFile[]>('/driver/files', { token });
  },
  async uploadFile(
    token: string,
    payload: {
      file_type_id: string;
      file: {
        uri: string;
        name: string;
        type?: string | null;
      };
      expires_at?: string;
    },
  ) {
    const body = new FormData();
    body.append('file_type_id', payload.file_type_id);
    body.append('file', {
      uri: payload.file.uri,
      name: payload.file.name,
      type: payload.file.type ?? 'application/octet-stream',
    } as never);

    if (payload.expires_at) {
      body.append('expires_at', payload.expires_at);
    }

    return request<DriverEntityFile>('/driver/files', {
      body,
      method: 'POST',
      token,
    });
  },
  async listShipmentFiles(token: string, shipmentId: string) {
    return requestWithMeta<DriverEntityFile[]>(`/driver/shipments/${shipmentId}/files`, { token });
  },
  async uploadShipmentFile(
    token: string,
    shipmentId: string,
    payload: {
      file_type_id: string;
      file: {
        uri: string;
        name: string;
        type?: string | null;
      };
      expires_at?: string;
    },
  ) {
    const body = new FormData();
    body.append('file_type_id', payload.file_type_id);
    body.append('file', {
      uri: payload.file.uri,
      name: payload.file.name,
      type: payload.file.type ?? 'application/octet-stream',
    } as never);

    if (payload.expires_at) {
      body.append('expires_at', payload.expires_at);
    }

    return request<DriverEntityFile>(`/driver/shipments/${shipmentId}/files`, {
      body,
      method: 'POST',
      token,
    });
  },
  async getFileDownloadUrl(token: string, fileId: string) {
    return request<{ url: string }>(`/files/${fileId}/download?format=url`, { token });
  },
};
