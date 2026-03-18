export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

export type EndpointField = {
  name: string
  type: string
  required?: boolean
  description: string
}

export type ApiEndpoint = {
  slug: string
  title: string
  method: HttpMethod
  path: string
  summary: string
  description: string
  auth: "none" | "bearer"
  pathParams?: EndpointField[]
  queryParams?: EndpointField[]
  bodyFields?: EndpointField[]
  requestExample?: Record<string, unknown>
  responseExample?: Record<string, unknown>
}

export type ApiCategory = {
  slug: string
  title: string
  description: string
  endpoints: ApiEndpoint[]
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.pickndrop.io"

const sampleLocation = {
  location_id: "loc_001",
  name: "Warehouse A",
  address_line_1: "12 Jet Park Rd",
  city: "Johannesburg",
  country: "ZA",
  post_code: "1459",
  latitude: -26.1367,
  longitude: 28.2225,
}

const sampleQuoteOption = {
  quote_option_id: "qopt_001",
  carrier_code: "fastship",
  service_code: "next_day",
  currency: "ZAR",
  amount: "225.00",
  tax_amount: "33.75",
  total_amount: "258.75",
  eta_from: "2026-02-18T08:00:00Z",
  eta_to: "2026-02-18T17:00:00Z",
  rules: {
    max_weight_kg: 25,
  },
}

const sampleShipment = {
  shipment_id: "shp_101",
  merchant_id: "mrc_001",
  environment_id: "env_live_001",
  merchant_order_ref: "ORD-8842",
  collection_date: "2026-02-18",
  status: "ready",
  pickup_address: sampleLocation,
  dropoff_address: {
    ...sampleLocation,
    location_id: "loc_002",
    name: "Customer Address",
    address_line_1: "90 Bree St",
    city: "Cape Town",
    post_code: "8001",
  },
  pickup_instructions: "Collect from loading bay 2",
  dropoff_instructions: "Call on arrival",
  ready_at: "2026-02-18T07:30:00Z",
  metadata: {
    source: "shopify",
  },
  parcels: [
    {
      parcel_id: "prc_001",
      weight_kg: "3.50",
      length_cm: "35",
      width_cm: "22",
      height_cm: "18",
      declared_value: "899.00",
      contents_description: "Electronics accessories",
    },
  ],
  created_at: "2026-02-17T10:22:00Z",
}

const sampleBooking = {
  booking_id: "bk_909",
  merchant_id: "mrc_001",
  environment_id: "env_live_001",
  shipment_id: "shp_101",
  shipment: sampleShipment,
  quote_option: sampleQuoteOption,
  status: "assigned",
  carrier_code: "fastship",
  carrier_job_id: "JOB-112233",
  label_url: "https://cdn.pickndrop.io/labels/bk_909.pdf",
  driver: {
    driver_id: "drv_001",
    name: "Jane Driver",
    email: "jane.driver@example.com",
    telephone: "+27115551234",
  },
  current_driver_id: "drv_001",
  booked_at: "2026-02-17T11:01:00Z",
  cancelled_at: null,
  cancellation_reason_code: null,
  cancellation_reason_note: null,
  cancel_reason: null,
  pod: null,
}

export const apiReferenceCategories: ApiCategory[] = [
  {
    slug: "auth",
    title: "Authentication",
    description: "Authenticate merchant users and refresh access tokens.",
    endpoints: [
      {
        slug: "login",
        title: "Login",
        method: "POST",
        path: "/api/v1/auth/login",
        summary: "Authenticate a merchant account.",
        description:
          "Returns an access token used in the Authorization header for protected endpoints.",
        auth: "none",
        bodyFields: [
          {
            name: "email",
            type: "string",
            required: true,
            description: "Merchant user email address.",
          },
          {
            name: "password",
            type: "string",
            required: true,
            description: "Merchant user password.",
          },
        ],
        requestExample: {
          email: "merchant@example.com",
          password: "password1234",
        },
        responseExample: {
          success: true,
          data: {
            token: "eyJhbGciOi...",
            refresh_token: "def50200...",
            expires_in: 3600,
            user: {
              user_id: "usr_001",
              name: "Merchant Admin",
              email: "merchant@example.com",
              role: "user",
              status: "active",
            },
          },
        },
      },
      {
        slug: "refresh-token",
        title: "Refresh Token",
        method: "POST",
        path: "/api/v1/auth/refresh",
        summary: "Issue a new access token.",
        description:
          "Use the refresh token to rotate short-lived access tokens without re-authenticating.",
        auth: "none",
        bodyFields: [
          {
            name: "refresh_token",
            type: "string",
            required: true,
            description: "Refresh token issued by the login endpoint.",
          },
        ],
        requestExample: {
          refresh_token: "def50200...",
        },
        responseExample: {
          success: true,
          data: {
            token: "eyJhbGciOi...",
            refresh_token: "def50200...",
            expires_in: 3600,
            user: {
              user_id: "usr_001",
              name: "Merchant Admin",
              email: "merchant@example.com",
              role: "user",
              status: "active",
            },
          },
        },
      },
    ],
  },
  {
    slug: "quotes",
    title: "Quotes",
    description: "Request and manage transport pricing quotes.",
    endpoints: [
      {
        slug: "request-quote",
        title: "Request Quote",
        method: "POST",
        path: "/api/v1/quotes",
        summary: "Create a new quote request.",
        description:
          "Submit shipment dimensions and route details to receive one or more carrier quote options.",
        auth: "bearer",
        bodyFields: [
          {
            name: "merchant_id",
            type: "string",
            required: true,
            description: "Merchant UUID requesting the quote.",
          },
          {
            name: "merchant_order_ref",
            type: "string",
            description: "Optional merchant order reference.",
          },
          {
            name: "collection_date",
            type: "string",
            description: "Requested collection datetime in ISO-8601 format.",
          },
          {
            name: "pickup_address",
            type: "object",
            required: true,
            description: "Origin address object.",
          },
          {
            name: "pickup_address.name",
            type: "string",
            description: "Pickup location name.",
          },
          {
            name: "pickup_address.code",
            type: "string",
            description: "Pickup address code.",
          },
          {
            name: "pickup_address.company",
            type: "string",
            description: "Pickup company name.",
          },
          {
            name: "pickup_address.address_line_1",
            type: "string",
            required: true,
            description: "Primary pickup street line.",
          },
          {
            name: "pickup_address.address_line_2",
            type: "string",
            description: "Secondary pickup street line.",
          },
          {
            name: "pickup_address.town",
            type: "string",
            description: "Pickup town/suburb.",
          },
          {
            name: "pickup_address.city",
            type: "string",
            required: true,
            description: "Pickup city.",
          },
          {
            name: "pickup_address.province",
            type: "string",
            description: "Pickup province/state.",
          },
          {
            name: "pickup_address.post_code",
            type: "string",
            description: "Pickup postal code.",
          },
          {
            name: "pickup_address.country",
            type: "string",
            required: true,
            description: "Two-letter country code.",
          },
          {
            name: "pickup_address.first_name",
            type: "string",
            description: "Pickup contact first name.",
          },
          {
            name: "pickup_address.last_name",
            type: "string",
            description: "Pickup contact last name.",
          },
          {
            name: "pickup_address.phone",
            type: "string",
            description: "Pickup contact phone number.",
          },
          {
            name: "pickup_address.latitude",
            type: "number",
            description: "Pickup latitude.",
          },
          {
            name: "pickup_address.longitude",
            type: "number",
            description: "Pickup longitude.",
          },
          {
            name: "pickup_address.google_place_id",
            type: "string",
            description: "Google place identifier.",
          },
          {
            name: "dropoff_address",
            type: "object",
            required: true,
            description: "Destination address object.",
          },
          {
            name: "dropoff_address.name",
            type: "string",
            description: "Dropoff location name.",
          },
          {
            name: "dropoff_address.code",
            type: "string",
            description: "Dropoff address code.",
          },
          {
            name: "dropoff_address.company",
            type: "string",
            description: "Dropoff company name.",
          },
          {
            name: "dropoff_address.address_line_1",
            type: "string",
            required: true,
            description: "Primary dropoff street line.",
          },
          {
            name: "dropoff_address.address_line_2",
            type: "string",
            description: "Secondary dropoff street line.",
          },
          {
            name: "dropoff_address.town",
            type: "string",
            description: "Dropoff town/suburb.",
          },
          {
            name: "dropoff_address.city",
            type: "string",
            required: true,
            description: "Dropoff city.",
          },
          {
            name: "dropoff_address.province",
            type: "string",
            description: "Dropoff province/state.",
          },
          {
            name: "dropoff_address.post_code",
            type: "string",
            description: "Dropoff postal code.",
          },
          {
            name: "dropoff_address.country",
            type: "string",
            required: true,
            description: "Two-letter country code.",
          },
          {
            name: "dropoff_address.first_name",
            type: "string",
            description: "Dropoff contact first name.",
          },
          {
            name: "dropoff_address.last_name",
            type: "string",
            description: "Dropoff contact last name.",
          },
          {
            name: "dropoff_address.phone",
            type: "string",
            description: "Dropoff contact phone number.",
          },
          {
            name: "dropoff_address.latitude",
            type: "number",
            description: "Dropoff latitude.",
          },
          {
            name: "dropoff_address.longitude",
            type: "number",
            description: "Dropoff longitude.",
          },
          {
            name: "dropoff_address.google_place_id",
            type: "string",
            description: "Google place identifier.",
          },
          {
            name: "parcels",
            type: "array",
            required: true,
            description: "Parcel items in this quote request.",
          },
          {
            name: "parcels[].title",
            type: "string",
            description: "Parcel label/title.",
          },
          {
            name: "parcels[].weight_kg",
            type: "number",
            required: true,
            description: "Parcel weight in kilograms.",
          },
          {
            name: "parcels[].length_cm",
            type: "number",
            required: true,
            description: "Parcel length in centimeters.",
          },
          {
            name: "parcels[].width_cm",
            type: "number",
            required: true,
            description: "Parcel width in centimeters.",
          },
          {
            name: "parcels[].height_cm",
            type: "number",
            required: true,
            description: "Parcel height in centimeters.",
          },
        ],
        requestExample: {
          merchant_id: "mrc_001",
          merchant_order_ref: "ORD-8842",
          collection_date: "2026-02-18T09:00:00Z",
          pickup_address: {
            name: "Warehouse A",
            code: "WH-A",
            company: "PicknDrop",
            address_line_1: "60 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "John",
            last_name: "Doe",
            phone: "+27-21-555-1234",
            latitude: -33.7801,
            longitude: 18.4567,
            google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          },
          dropoff_address: {
            name: "Customer",
            code: "CUST-1001",
            company: "Customer Co",
            address_line_1: "10 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "Jane",
            last_name: "Smith",
            phone: "+27-21-555-5678",
            latitude: -33.7812,
            longitude: 18.4588,
            google_place_id: "ChIJrTLr-GyuEmsRBfy61i59si0",
          },
          parcels: [
            {
              title: "ABC",
              weight_kg: 1,
              length_cm: 10,
              width_cm: 10,
              height_cm: 10,
            },
          ],
        },
        responseExample: {
          success: true,
          data: {
            quote_id: "quote_123",
            merchant_order_ref: "ORD-8842",
            merchant_id: "mrc_001",
            environment_id: "env_live_001",
            shipment_id: "shp_101",
            status: "pending",
            requested_at: "2026-02-17T10:22:00Z",
            expires_at: "2026-02-17T11:22:00Z",
            options: [
              sampleQuoteOption,
            ],
            selected_option: null,
          },
        },
      },
      {
        slug: "list-quotes",
        title: "List Quotes",
        method: "GET",
        path: "/api/v1/quotes",
        summary: "List quote requests.",
        description:
          "Returns paginated quote records for the authenticated merchant environment.",
        auth: "bearer",
        queryParams: [
          {
            name: "page",
            type: "number",
            description: "Page number to retrieve.",
          },
          {
            name: "per_page",
            type: "number",
            description: "Records per page.",
          },
          {
            name: "status",
            type: "string",
            description: "Filter by quote status.",
          },
          {
            name: "search",
            type: "string",
            description: "Search by reference or location text.",
          },
        ],
        responseExample: {
          success: true,
          data: [
            {
              quote_id: "quote_123",
              merchant_order_ref: "ORD-8842",
              shipment_id: "shp_101",
              status: "pending",
              requested_at: "2026-02-17T10:22:00Z",
              expires_at: "2026-02-17T11:22:00Z",
              options: [sampleQuoteOption],
              selected_option: null,
            },
          ],
          meta: {
            current_page: 1,
            last_page: 3,
            per_page: 20,
            total: 45,
          },
        },
      },
      {
        slug: "get-quote",
        title: "Get Quote",
        method: "GET",
        path: "/api/v1/quotes/{quote_id}",
        summary: "Retrieve a single quote.",
        description:
          "Returns quote details and available carrier options for booking.",
        auth: "bearer",
        pathParams: [
          {
            name: "quote_id",
            type: "string",
            required: true,
            description: "Quote identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: {
            quote_id: "quote_123",
            merchant_order_ref: "ORD-8842",
            merchant_id: "mrc_001",
            environment_id: "env_live_001",
            shipment_id: "shp_101",
            status: "booked",
            requested_at: "2026-02-17T10:22:00Z",
            expires_at: "2026-02-17T11:22:00Z",
            options: [sampleQuoteOption],
            selected_option: sampleQuoteOption,
          },
        },
      },
    ],
  },
  {
    slug: "shipments",
    title: "Shipments",
    description: "Create, view, update, and track shipments.",
    endpoints: [
      {
        slug: "create-shipment",
        title: "Create Shipment",
        method: "POST",
        path: "/api/v1/shipments",
        summary: "Create a shipment record.",
        description:
          "Registers shipment details before booking with a carrier option.",
        auth: "bearer",
        bodyFields: [
          {
            name: "merchant_id",
            type: "string",
            required: true,
            description: "Merchant UUID that owns the shipment.",
          },
          {
            name: "merchant_order_ref",
            type: "string",
            required: true,
            description: "External merchant order reference.",
          },
          {
            name: "collection_date",
            type: "string",
            description: "Collection datetime in ISO-8601 format.",
          },
          {
            name: "pickup_address",
            type: "object",
            required: true,
            description: "Collection address object.",
          },
          {
            name: "dropoff_address",
            type: "object",
            required: true,
            description: "Delivery address object.",
          },
          {
            name: "parcels",
            type: "array",
            required: true,
            description: "List of parcel objects.",
          },
          {
            name: "parcels[].title",
            type: "string",
            description: "Parcel label/title.",
          },
          {
            name: "parcels[].weight_kg",
            type: "number",
            required: true,
            description: "Parcel weight in kilograms.",
          },
          {
            name: "parcels[].length_cm",
            type: "number",
            required: true,
            description: "Parcel length in centimeters.",
          },
          {
            name: "parcels[].width_cm",
            type: "number",
            required: true,
            description: "Parcel width in centimeters.",
          },
          {
            name: "parcels[].height_cm",
            type: "number",
            required: true,
            description: "Parcel height in centimeters.",
          },
        ],
        requestExample: {
          merchant_id: "mrc_001",
          merchant_order_ref: "ORD-8842",
          collection_date: "2026-02-18T09:00:00Z",
          pickup_address: {
            name: "Warehouse A",
            code: "WH-A",
            company: "PicknDrop",
            address_line_1: "6 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "John",
            last_name: "Doe",
            phone: "+27-21-555-1234",
            latitude: -33.7801,
            longitude: 18.4567,
            google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          },
          dropoff_address: {
            name: "Customer",
            code: "CUST-1001",
            company: "Customer Co",
            address_line_1: "10 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "Jane",
            last_name: "Smith",
            phone: "+27-21-555-5678",
            latitude: -33.7812,
            longitude: 18.4588,
            google_place_id: "ChIJrTLr-GyuEmsRBfy61i59si0",
          },
          parcels: [
            {
              title: "ABC",
              weight_kg: 1,
              length_cm: 10,
              width_cm: 10,
              height_cm: 10,
            },
          ],
        },
        responseExample: {
          success: true,
          data: sampleShipment,
        },
      },
      {
        slug: "create-on-demand-shipment",
        title: "Create On-Demand Shipment",
        method: "POST",
        path: "/api/v1/shipments/on-demand",
        summary: "Create an on-demand shipment.",
        description:
          "Creates and dispatches an on-demand shipment flow in a single request.",
        auth: "bearer",
        bodyFields: [
          {
            name: "merchant_id",
            type: "string",
            required: true,
            description: "Merchant UUID that owns the on-demand shipment.",
          },
          {
            name: "merchant_order_ref",
            type: "string",
            description: "Optional merchant order reference.",
          },
          {
            name: "collection_date",
            type: "string",
            description: "Collection datetime in ISO-8601 format.",
          },
          {
            name: "pickup_address",
            type: "object",
            required: true,
            description: "Collection address object.",
          },
          {
            name: "dropoff_address",
            type: "object",
            required: true,
            description: "Delivery address object.",
          },
          {
            name: "parcels",
            type: "array",
            required: true,
            description: "List of parcel objects.",
          },
          {
            name: "parcels[].title",
            type: "string",
            description: "Parcel label/title.",
          },
          {
            name: "parcels[].weight_kg",
            type: "number",
            required: true,
            description: "Parcel weight in kilograms.",
          },
          {
            name: "parcels[].length_cm",
            type: "number",
            required: true,
            description: "Parcel length in centimeters.",
          },
          {
            name: "parcels[].width_cm",
            type: "number",
            required: true,
            description: "Parcel width in centimeters.",
          },
          {
            name: "parcels[].height_cm",
            type: "number",
            required: true,
            description: "Parcel height in centimeters.",
          },
        ],
        requestExample: {
          merchant_id: "mrc_001",
          merchant_order_ref: "ORD-ONDEMAND-111",
          collection_date: "2026-02-18T10:00:00Z",
          pickup_address: {
            name: "Warehouse A",
            code: "WH-A",
            company: "PicknDrop",
            address_line_1: "6 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "John",
            last_name: "Doe",
            phone: "+27-21-555-1234",
            latitude: -33.7801,
            longitude: 18.4567,
            google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          },
          dropoff_address: {
            name: "Customer",
            code: "CUST-1001",
            company: "Customer Co",
            address_line_1: "10 Newline Road",
            address_line_2: "Sunningdale",
            town: "Sunningdale",
            city: "Cape Town",
            province: "Western Cape",
            post_code: "7441",
            country: "ZA",
            first_name: "Jane",
            last_name: "Smith",
            phone: "+27-21-555-5678",
            latitude: -33.7812,
            longitude: 18.4588,
            google_place_id: "ChIJrTLr-GyuEmsRBfy61i59si0",
          },
          parcels: [
            {
              title: "Express Parcel",
              weight_kg: 1,
              length_cm: 10,
              width_cm: 10,
              height_cm: 10,
            },
          ],
        },
        responseExample: {
          success: true,
          data: {
            ...sampleShipment,
            shipment_id: "shp_od_22",
            status: "in_transit",
            metadata: {
              mode: "on_demand",
              priority: "immediate",
            },
          },
        },
      },
      {
        slug: "list-shipments",
        title: "List Shipments",
        method: "GET",
        path: "/api/v1/shipments",
        summary: "List shipments.",
        description:
          "Returns paginated shipment records for the authenticated merchant.",
        auth: "bearer",
        queryParams: [
          {
            name: "page",
            type: "number",
            description: "Page number to retrieve.",
          },
          {
            name: "per_page",
            type: "number",
            description: "Records per page.",
          },
          {
            name: "search",
            type: "string",
            description: "Filter by reference, recipient, or address.",
          },
          {
            name: "merchant_order_ref",
            type: "string",
            description: "Filter by external order reference.",
          },
        ],
        responseExample: {
          success: true,
          data: [
            {
              shipment_id: "shp_101",
              merchant_order_ref: "ORD-8842",
              status: "in_transit",
              pickup_address: sampleLocation,
              dropoff_address: {
                ...sampleLocation,
                location_id: "loc_002",
                city: "Cape Town",
              },
              created_at: "2026-02-17T10:22:00Z",
            },
          ],
          meta: {
            current_page: 1,
            last_page: 4,
            per_page: 20,
            total: 78,
          },
        },
      },
      {
        slug: "get-shipment",
        title: "Get Shipment",
        method: "GET",
        path: "/api/v1/shipments/{shipment_id}",
        summary: "Retrieve a shipment by ID.",
        description: "Returns full shipment details including current status.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: {
            ...sampleShipment,
            status: "in_transit",
          },
        },
      },
      {
        slug: "update-shipment",
        title: "Update Shipment",
        method: "PATCH",
        path: "/api/v1/shipments/{shipment_id}",
        summary: "Update mutable shipment fields.",
        description: "Updates shipment details before delivery completion.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        bodyFields: [
          {
            name: "merchant_order_ref",
            type: "string",
            description: "Updated merchant order reference.",
          },
          {
            name: "collection_date",
            type: "string",
            description: "Updated collection datetime in ISO-8601 format.",
          },
          {
            name: "pickup_address",
            type: "object",
            description: "Updated pickup address object.",
          },
          {
            name: "dropoff_address",
            type: "object",
            description: "Updated dropoff address object.",
          },
          {
            name: "pickup_instructions",
            type: "string",
            description: "Updated pickup instructions.",
          },
          {
            name: "dropoff_instructions",
            type: "string",
            description: "Updated dropoff instructions.",
          },
          {
            name: "ready_at",
            type: "string",
            description: "Updated ready datetime in ISO-8601 format.",
          },
          {
            name: "metadata",
            type: "object",
            description: "Arbitrary metadata object.",
          },
          {
            name: "parcels",
            type: "array",
            description: "Updated parcel list.",
          },
          {
            name: "parcels[].weight_kg",
            type: "number",
            description: "Parcel weight in kilograms.",
          },
          {
            name: "parcels[].length_cm",
            type: "number",
            description: "Parcel length in centimeters.",
          },
          {
            name: "parcels[].width_cm",
            type: "number",
            description: "Parcel width in centimeters.",
          },
          {
            name: "parcels[].height_cm",
            type: "number",
            description: "Parcel height in centimeters.",
          },
        ],
        requestExample: {
          dropoff_address: {
            address_line_1: "95 Bree St",
            city: "Cape Town",
            country: "ZA",
          },
          dropoff_instructions: "Call 5 minutes before arrival",
          metadata: {
            priority: "high",
          },
        },
        responseExample: {
          success: true,
          data: {
            ...sampleShipment,
            dropoff_address: {
              ...sampleLocation,
              location_id: "loc_002",
              address_line_1: "95 Bree St",
              city: "Cape Town",
            },
          },
        },
      },
      {
        slug: "get-shipment-tracking",
        title: "Get Shipment Tracking",
        method: "GET",
        path: "/api/v1/shipments/{shipment_id}/tracking",
        summary: "Fetch tracking timeline for a shipment.",
        description: "Returns latest tracking status and milestones.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: {
            shipment_id: "shp_101",
            status: "in_transit",
            events: [
              {
                status: "picked_up",
                occurred_at: "2026-02-17T11:30:00Z",
                note: "Collected from origin",
              },
              {
                status: "in_transit",
                occurred_at: "2026-02-17T14:15:00Z",
                note: "Arrived at sorting facility",
              },
            ],
          },
        },
      },
      {
        slug: "list-shipment-quotes",
        title: "List Shipment Quotes",
        method: "GET",
        path: "/api/v1/shipments/{shipment_id}/quotes",
        summary: "List quote options linked to a shipment.",
        description:
          "Returns carrier options available to book for an existing shipment.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: [
            sampleQuoteOption,
          ],
        },
      },
    ],
  },
  {
    slug: "bookings",
    title: "Bookings",
    description: "Book, view, and cancel booked shipments.",
    endpoints: [
      {
        slug: "book-shipment",
        title: "Book Shipment",
        method: "POST",
        path: "/api/v1/shipments/{shipment_id}/book",
        summary: "Book a shipment using a quote option.",
        description:
          "Creates a booking from a shipment and selected quote option.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        bodyFields: [
          {
            name: "quote_option_id",
            type: "string",
            required: true,
            description: "Selected carrier quote option ID.",
          },
        ],
        requestExample: {
          quote_option_id: "opt_1",
        },
        responseExample: {
          success: true,
          data: sampleBooking,
        },
      },
      {
        slug: "list-bookings",
        title: "List Bookings",
        method: "GET",
        path: "/api/v1/bookings",
        summary: "List merchant bookings.",
        description: "Returns paginated booking records for the merchant.",
        auth: "bearer",
        queryParams: [
          {
            name: "page",
            type: "number",
            description: "Page number to retrieve.",
          },
          {
            name: "per_page",
            type: "number",
            description: "Records per page.",
          },
          {
            name: "status",
            type: "string",
            description: "Filter by booking status.",
          },
        ],
        responseExample: {
          success: true,
          data: [
            {
              booking_id: "bk_909",
              shipment_id: "shp_101",
              status: "assigned",
              carrier_code: "fastship",
              booked_at: "2026-02-17T11:01:00Z",
              quote_option: sampleQuoteOption,
            },
          ],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 20,
            total: 18,
          },
        },
      },
      {
        slug: "get-booking",
        title: "Get Booking",
        method: "GET",
        path: "/api/v1/bookings/{booking_id}",
        summary: "Retrieve a booking by ID.",
        description: "Returns booking details and status progression.",
        auth: "bearer",
        pathParams: [
          {
            name: "booking_id",
            type: "string",
            required: true,
            description: "Booking identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: sampleBooking,
        },
      },
      {
        slug: "cancel-shipment",
        title: "Cancel Shipment",
        method: "POST",
        path: "/api/v1/shipments/{shipment_id}/cancel",
        summary: "Cancel a shipment booking.",
        description: "Cancels a shipment that has not reached final delivery state.",
        auth: "bearer",
        pathParams: [
          {
            name: "shipment_id",
            type: "string",
            required: true,
            description: "Shipment identifier.",
          },
        ],
        bodyFields: [
          {
            name: "reason_code",
            type: "string",
            required: true,
            description: "Predefined cancellation reason code.",
          },
          {
            name: "reason_note",
            type: "string",
            description: "Optional free-text note for the cancellation.",
          },
        ],
        requestExample: {
          reason_code: "customer_request",
          reason_note: "Customer requested cancellation before pickup.",
        },
        responseExample: {
          success: true,
          data: {
            shipment_id: "shp_101",
            status: "cancelled",
            cancellation_reason_code: "customer_request",
            cancellation_reason_note: "Customer requested cancellation before pickup.",
          },
        },
      },
    ],
  },
  {
    slug: "webhooks",
    title: "Webhook Subscriptions",
    description: "Receive real-time delivery and shipment events.",
    endpoints: [
      {
        slug: "create-subscription",
        title: "Create Subscription",
        method: "POST",
        path: "/api/v1/webhooks/subscriptions",
        summary: "Register a webhook endpoint.",
        description: "Creates a webhook subscription for selected event types.",
        auth: "bearer",
        bodyFields: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "HTTPS destination for webhook deliveries.",
          },
          {
            name: "event",
            type: "string",
            description: "Single event key (legacy payload format from Postman).",
          },
          {
            name: "events",
            type: "string[]",
            description: "List of event keys to subscribe to.",
          },
        ],
        requestExample: {
          url: "https://example.com/webhooks/pickndrop",
          event: "shipment.updated",
          events: ["shipment.created", "booking.updated"],
        },
        responseExample: {
          success: true,
          data: {
            subscription_id: "wh_22",
            status: "active",
            url: "https://example.com/webhooks/pickndrop",
            events: ["shipment.created", "booking.updated"],
            createdAt: "2026-02-17T10:45:00Z",
          },
        },
      },
      {
        slug: "list-subscriptions",
        title: "List Subscriptions",
        method: "GET",
        path: "/api/v1/webhooks/subscriptions",
        summary: "List webhook subscriptions.",
        description: "Returns webhook subscriptions configured in the environment.",
        auth: "bearer",
        responseExample: {
          success: true,
          data: [
            {
              subscription_id: "wh_22",
              status: "active",
              url: "https://example.com/webhooks/pickndrop",
              events: ["shipment.created", "booking.updated"],
              createdAt: "2026-02-17T10:45:00Z",
            },
          ],
        },
      },
      {
        slug: "test-subscription",
        title: "Test Subscription",
        method: "POST",
        path: "/api/v1/webhooks/subscriptions/{subscription_id}/test",
        summary: "Trigger a test delivery.",
        description:
          "Sends a synthetic webhook payload to validate endpoint reachability and signatures.",
        auth: "bearer",
        pathParams: [
          {
            name: "subscription_id",
            type: "string",
            required: true,
            description: "Webhook subscription identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: {
            delivery_id: "wdl_001",
            event: "webhook.test",
            status: "pending",
            createdAt: "2026-02-17T10:46:00Z",
          },
        },
      },
      {
        slug: "delete-subscription",
        title: "Delete Subscription",
        method: "DELETE",
        path: "/api/v1/webhooks/subscriptions/{subscription_id}",
        summary: "Delete a webhook subscription.",
        description: "Removes an existing webhook subscription.",
        auth: "bearer",
        pathParams: [
          {
            name: "subscription_id",
            type: "string",
            required: true,
            description: "Webhook subscription identifier.",
          },
        ],
        responseExample: {
          success: true,
          data: {
            deleted: true,
            subscription_id: "wh_22",
          },
        },
      },
    ],
  },
]

export function getApiCategory(categorySlug: string) {
  return apiReferenceCategories.find((category) => category.slug === categorySlug)
}

export function getApiEndpoint(categorySlug: string, endpointSlug: string) {
  return getApiCategory(categorySlug)?.endpoints.find(
    (endpoint) => endpoint.slug === endpointSlug
  )
}

export function getFirstApiEndpointPath() {
  const firstCategory = apiReferenceCategories[0]
  const firstEndpoint = firstCategory?.endpoints[0]

  if (!firstCategory || !firstEndpoint) {
    return "/docs/api-reference"
  }

  return `/docs/api-reference/${firstCategory.slug}/${firstEndpoint.slug}`
}

export function buildCodeSamples(endpoint: ApiEndpoint) {
  const pathWithSampleIds = endpoint.path
    .replace("{quote_id}", "quote_123")
    .replace("{shipment_id}", "shp_101")
    .replace("{booking_id}", "bk_909")
    .replace("{subscription_id}", "wh_22")

  const url = `${API_BASE_URL}${pathWithSampleIds}`
  const bodyString = endpoint.requestExample
    ? JSON.stringify(endpoint.requestExample, null, 2)
    : ""
  const includeAuth = endpoint.auth === "bearer"
  const bodyJsonString = endpoint.requestExample
    ? JSON.stringify(endpoint.requestExample)
    : ""

  const curlHeaders = [
    includeAuth ? '  -H "Authorization: Bearer <token>" \\\\' : "",
    endpoint.requestExample ? '  -H "Content-Type: application/json" \\\\' : "",
  ]
    .filter(Boolean)
    .join("\n")

  const curlBody = endpoint.requestExample
    ? `\n  --data '${bodyString.replace(/'/g, "\\'")}'`
    : ""

  const curl = `curl -X ${endpoint.method} \\\n  "${url}"${curlHeaders ? ` \\\n${curlHeaders}` : ""}${curlBody}`

  const jsHeaders = [
    includeAuth ? '    "Authorization": "Bearer <token>"' : "",
    endpoint.requestExample ? '    "Content-Type": "application/json"' : "",
  ]
    .filter(Boolean)
    .join(",\n")

  const javascript = endpoint.requestExample
    ? `const response = await fetch("${url}", {
  method: "${endpoint.method}",
  headers: {\n${jsHeaders}\n  },
  body: JSON.stringify(${bodyString})
})

const data = await response.json()
console.log(data)`
    : `const response = await fetch("${url}", {
  method: "${endpoint.method}",
  headers: {\n${jsHeaders}\n  }
})

const data = await response.json()
console.log(data)`

  const pyHeaders = [
    includeAuth ? '    "Authorization": "Bearer <token>"' : "",
    endpoint.requestExample ? '    "Content-Type": "application/json"' : "",
  ]
    .filter(Boolean)
    .join(",\n")

  const python = endpoint.requestExample
    ? `import requests

url = "${url}"
headers = {\n${pyHeaders}\n}
payload = ${bodyString}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)
print(response.json())`
    : `import requests

url = "${url}"
headers = {\n${pyHeaders}\n}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)
print(response.json())`

  const phpHeaders = [
    includeAuth ? '        "Authorization" => "Bearer <token>",' : "",
    endpoint.requestExample ? '        "Content-Type" => "application/json",' : "",
  ]
    .filter(Boolean)
    .join("\n")

  const php = endpoint.requestExample
    ? `$client = new \GuzzleHttp\Client();

$response = $client->request("${endpoint.method}", "${url}", [
    "headers" => [\n${phpHeaders}\n    ],
    "body" => '${bodyJsonString.replace(/'/g, "\\'")}',
]);

echo $response->getBody();`
    : `$client = new \GuzzleHttp\Client();

$response = $client->request("${endpoint.method}", "${url}", [
    "headers" => [\n${phpHeaders}\n    ],
]);

echo $response->getBody();`

  return {
    curl,
    javascript,
    python,
    php,
  }
}
