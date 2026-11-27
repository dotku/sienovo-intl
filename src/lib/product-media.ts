// Product photos shown on /products/[slug]. Files live in public/images/products/<slug>/.
// Only products listed here render images; the DB `image` paths of older products 404, so
// they are deliberately left out until real photos are added.

export interface ProductMedia {
  hero: string; // transparent product cut-out, shown in the hero
  og: string; // 1200x630 share image
  category: string; // schema.org Product.category
  gallery: { src: string; alt: string; caption: string; illustrative?: boolean }[];
}

const X = "/images/products/visionint-x300";

export const PRODUCT_MEDIA: Record<string, ProductMedia> = {
  "visionint-x300": {
    hero: `${X}/front.png`,
    og: `${X}/og.jpg`,
    category: "Action Cameras",
    gallery: [
      { src: `${X}/pair.png`, alt: "VisionInt X300 front and side views", caption: "52 g body, 63 × 32 × 31.5 mm" },
      { src: `${X}/4k.jpg`, alt: "2K vs 4K resolution comparison", caption: "True 4K vs 2K detail", illustrative: true },
      { src: `${X}/hdr.jpg`, alt: "HDR off vs HDR on comparison", caption: "HDR for high-contrast scenes", illustrative: true },
      { src: `${X}/fov.jpg`, alt: "110° vs 140° field of view comparison", caption: "140° wide field of view", illustrative: true },
      { src: `${X}/cycling.jpg`, alt: "Mountain biker with helmet-mounted camera", caption: "Cycling & motorcycle POV", illustrative: true },
      { src: `${X}/camping.jpg`, alt: "Tent by a lake at dusk", caption: "Camping & travel", illustrative: true },
      { src: `${X}/campus.jpg`, alt: "Student wearing the camera on a lanyard", caption: "Campus vlog", illustrative: true },
    ],
  },
};
