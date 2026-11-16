export type ContentData = {
    title: string;
    description: string;
    body: string;
    author?: string;
    category?: string;
    image?: string;
    image_alt?: string;
    seo_title?: string;
    seo_description?: string;
    location?: string;
    employment_type?: string;
    application_email?: string;
};
export type PublishedContent = {
    id: number;
    kind: string;
    slug: string;
    content: ContentData;
    published_at: string;
};
export type ContentRecord = {
    id: number;
    kind: string;
    slug: string;
    draft: ContentData;
    published: ContentData | null;
    published_at: string | null;
};
export type PublicPrice = {
    uuid: string;
    title: string;
    vehicle_limit: number;
    monthly_charge_zar: string;
    extra_vehicle_price_zar: string;
    public_vat_wording: string;
};
